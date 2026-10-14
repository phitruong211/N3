import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardNoteKey, exportCardWithNote, createCardNotesStore, CARD_NOTES_STORAGE_KEY } from '../src/lib/cardNotes.ts';

function storage(scope = 'guest') {
  const rows = new Map();
  return { scope, getJSON: (key, fallback) => rows.has(key) ? structuredClone(rows.get(key)) : fallback,
    setJSON: (key, value) => rows.set(key, structuredClone(value)) };
}
const key = 'a'.repeat(64);
const note = (text = '', version = 0) => ({ key, text, version, updatedAt: null });

test('note identity survives built-in reordering and personal content/deck changes, without merging same-front cards', async () => {
  const card = { id: 'old-index-4', deckId: 'vocabN3', source: 'BUILT_IN', type: 'VOCABULARY', front: '私', reading: 'わたし' };
  assert.equal(await cardNoteKey(card), await cardNoteKey({ ...card, id: 'old-index-99', position: 99 }));
  assert.notEqual(await cardNoteKey(card), await cardNoteKey({ ...card, reading: 'わたくし' }));
  assert.notEqual(await cardNoteKey(card), await cardNoteKey({ ...card, deckId: 'kanjiN5' }));
  const personal = { ...card, id: '6af32e3a-1ea3-4887-a250-23a06ba04447', source: 'IMPORT' };
  assert.equal(await cardNoteKey(personal), await cardNoteKey({ ...personal, front: '編集', deckId: 'moved', source: 'MANUAL' }));
  const permanent = { ...card, noteIdentity: 'catalog-uuid' };
  assert.equal(await cardNoteKey(permanent), await cardNoteKey({ ...permanent, front: '訂正', reading: 'ていせい', deckId: 'moved' }));
  assert.notEqual(await cardNoteKey(permanent), await cardNoteKey({ ...permanent, noteIdentity: 'different-row' }));
});

test('export excludes personal notes by default and includes them only with explicit opt-in', () => {
  const card = { front: '水', back: 'Nước', reading: 'みず', note: 'Source note', type: 'KANJI', tags: ['N5'] };
  assert.equal(exportCardWithNote(card, 'Private').note, 'Source note');
  assert.equal(exportCardWithNote(card, 'Private', true).note, 'Source note\n\n【Ghi chú cá nhân】\nPrivate');
  assert.equal(card.note, 'Source note');
});

test('guest notes and drafts survive reload, clearing notes is separate from source card notes', () => {
  const local = storage(); const store = createCardNotesStore(local);
  store.ensure(key); store.writeDraft(key, 'Bản nháp');
  assert.equal(createCardNotesStore(local).draft(key).text, 'Bản nháp');
  store.save(key, 'Ghi chú riêng');
  assert.equal(createCardNotesStore(local).getSnapshot()[key].text, 'Ghi chú riêng');
  assert.equal(store.draft(key), undefined);
  store.save(key, ''); assert.equal(store.getSnapshot()[key].text, '');
  assert.equal(createCardNotesStore(storage('user:B')).getSnapshot()[key], undefined);
});

test('offline edit remains pending after restart and uploads when connection returns', async () => {
  const local = storage('user:A'); let offline = true; let remote = note();
  const api = { get: async () => { if (offline) throw Error('Offline'); return remote; },
    put: async (_, text, version) => { assert.equal(version, remote.version); return remote = note(text, version + 1); } };
  const first = createCardNotesStore(local, api); first.save(key, 'Mẹo nhớ'); await first.retry(key); first.stop();
  assert.equal(first.getSnapshot()[key].dirty, true);
  offline = false; const restored = createCardNotesStore(local, api); await restored.retry(key);
  assert.equal(remote.text, 'Mẹo nhớ'); assert.equal(restored.getSnapshot()[key].status, 'saved');
});

test('two-device conflict retains both versions until explicit resolution', async () => {
  const local = storage('user:A'); local.setJSON(CARD_NOTES_STORAGE_KEY, { [key]: { ...note('local edit', 1), dirty: true } });
  let remote = note('remote edit', 2); let writes = 0;
  const store = createCardNotesStore(local, { get: async () => remote, put: async (_, text, version) => {
    writes++; assert.equal(version, remote.version); return remote = note(text, version + 1);
  } });
  await store.retry(key);
  assert.equal(store.getSnapshot()[key].status, 'conflict'); assert.equal(writes, 0);
  assert.equal(store.getSnapshot()[key].text, 'local edit'); assert.equal(store.getSnapshot()[key].remote.text, 'remote edit');
  await assert.rejects(store.flush());
  store.resolve(key, true); await store.retry(key);
  assert.equal(remote.text, 'local edit'); assert.equal(store.getSnapshot()[key].dirty, false);
});

test('remote updates arriving during an open draft cannot silently overwrite either edit', async () => {
  let remote = note('old', 1);
  const store = createCardNotesStore(storage('user:A'), { get: async () => remote, put: async () => { throw Error('Must resolve first'); } });
  await store.retry(key); store.writeDraft(key, 'my draft'); remote = note('other device', 2); await store.retry(key);
  store.save(key, 'my draft');
  assert.equal(store.getSnapshot()[key].status, 'conflict'); assert.equal(store.getSnapshot()[key].remote.text, 'other device');
  store.resolve(key, false); assert.equal(store.getSnapshot()[key].text, 'other device');
});

test('a newer local edit made during an in-flight save is sent with the acknowledged version', async () => {
  let release; let called; const started = new Promise(resolve => { called = resolve; });
  let remote = note(); let calls = 0;
  const store = createCardNotesStore(storage('user:A'), {
    get: async () => remote,
    put: async (_, text, version) => { calls++; assert.equal(version, remote.version);
      if (calls === 1) { called(); await new Promise(resolve => { release = resolve; }); }
      return remote = note(text, version + 1);
    },
  });
  store.save(key, 'first'); await started; store.save(key, 'second'); release(); await store.retry(key);
  assert.equal(remote.text, 'second'); assert.equal(remote.version, 2); assert.equal(store.getSnapshot()[key].status, 'saved');
});

test('quota failure must never be reported as a successful save', () => {
  const store = createCardNotesStore({ scope: 'guest', getJSON: (_, fallback) => fallback, setJSON: () => {} });
  assert.throws(() => store.save(key, 'must keep'), /không lưu được/);
  assert.throws(() => store.writeDraft(key, 'draft'), /Không lưu được/);
});

test('background loading handles unavailable storage without an unhandled rejection', async () => {
  const store = createCardNotesStore({ scope: 'user:A', getJSON: (_, fallback) => fallback, setJSON: () => {} }, { get: async () => note('remote', 1), put: async () => note() });
  await store.retry(key);
  assert.equal(store.getSnapshot()[key].status, 'error');
});
