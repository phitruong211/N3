import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStorage, hasLegacyLearningData } from '../src/lib/storage.ts';
const data = new Map();
beforeEach(() => {
  data.clear();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
});
const bookmark = id => ({ itemId: id, itemType: 'vocabulary', createdAt: '2026-09-26' });

test('Guest, A and B keep separate bookmarks, SRS, progress, settings and listening data', () => {
  const guest = createLearningStorage('guest');
  const a = createLearningStorage('user:A');
  const b = createLearningStorage('user:B');
  guest.saveBookmarks([bookmark('guest')]);
  a.saveBookmarks([bookmark('A')]);
  a.saveSRSCards('vocabulary', [{ cardId: 'A-card', deckType: 'vocabulary' }]);
  a.recordStudyActivity(1, 1, 1, 2, 'srs');
  a.updateSetting('theme', 'dark');
  a.setJSON('nhat-listening-v1', { episode: { listened: true } });
  a.setJSON('nhat-jlpt-listening-scores-v1', { exam: 2 });
  assert.equal(a.getBookmarks()[0].itemId, 'A');
  assert.deepEqual(b.getBookmarks(), []);
  assert.deepEqual(guest.getSRSCards('vocabulary'), []);
  assert.deepEqual(b.getStudyDays(), []);
  assert.equal(b.getSettings().theme, 'light');
  assert.deepEqual(guest.getJSON('nhat-listening-v1', {}), {});
  assert.deepEqual(b.getJSON('nhat-jlpt-listening-scores-v1', {}), {});
  assert.equal(createLearningStorage('guest').getBookmarks()[0].itemId, 'guest');
  const lateSave = a.saveBookmarks;
  lateSave([bookmark('late-A')]);
  assert.deepEqual(b.getBookmarks(), []);
  assert.equal(a.getBookmarks()[0].itemId, 'late-A');
});

test('legacy learning data remains preserved but is never assigned to Guest or an arbitrary account', () => {
  data.set('n3_bookmarks', JSON.stringify([bookmark('unknown-owner')]));
  data.set('n3_srs_cards', JSON.stringify([{ itemId: 'legacy', itemType: 'vocabulary' }]));
  assert.equal(hasLegacyLearningData(), true);
  for (const scope of ['guest', 'user:A', 'user:B']) {
    const storage = createLearningStorage(scope);
    storage.migrateV1(); storage.migrateV1();
    assert.deepEqual(storage.getBookmarks(), []);
    assert.deepEqual(storage.getSRSCards('vocabulary'), []);
  }
  assert.ok(data.get('n3_srs_cards'));
  assert.equal(JSON.parse(data.get('n3_bookmarks'))[0].itemId, 'unknown-owner');
});

test('reset removes only the current scope including listening and leaves tokens and legacy intact', () => {
  const a = createLearningStorage('user:A');
  const guest = createLearningStorage('guest');
  a.saveBookmarks([bookmark('A')]);
  a.setJSON('nhat-listening-v1', { episode: true });
  a.setJSON('nhat-jlpt-listening-scores-v1', { exam: 2 });
  guest.saveBookmarks([bookmark('guest')]);
  data.set('auth:refresh_token', 'token'); data.set('n3_bookmarks', 'legacy');
  a.resetAllData();
  assert.deepEqual(a.getBookmarks(), []);
  assert.deepEqual(a.getJSON('nhat-listening-v1', {}), {});
  assert.deepEqual(a.getJSON('nhat-jlpt-listening-scores-v1', {}), {});
  assert.equal(guest.getBookmarks()[0].itemId, 'guest');
  assert.equal(data.get('auth:refresh_token'), 'token');
  assert.equal(data.get('n3_bookmarks'), 'legacy');
});

test('corrupt JSON falls back safely within the current scope', () => {
  data.set('guest:n3_bookmarks', '{broken');
  assert.deepEqual(createLearningStorage('guest').getBookmarks(), []);
});

test('wrong JSON shapes cannot crash consumers expecting arrays or settings', () => {
  data.set('guest:n3_bookmarks', 'null');
  data.set('guest:n3_settings', 'null');
  data.set('guest:n3_study_days', '{}');
  const storage = createLearningStorage('guest');
  assert.deepEqual(storage.getBookmarks(), []);
  assert.deepEqual(storage.getStudyDays(), []);
  assert.equal(storage.getSettings().theme, 'light');
});

test('quota failure reports the persistence problem without crashing the learning UI', async () => {
  const originalWindow = globalThis.window;
  const events = new EventTarget();
  let failures = 0;
  events.addEventListener('learning-storage-error', () => failures++);
  globalThis.window = events;
  try {
    globalThis.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
    assert.doesNotThrow(() => createLearningStorage('guest').saveBookmarks([bookmark('unsaved')]));
    await Promise.resolve();
    assert.equal(failures, 1);
    assert.deepEqual(createLearningStorage('guest').getBookmarks(), []);
  } finally { globalThis.window = originalWindow; }
});

test('learning revision can be restored and reset discards the outgoing sync queue', () => {
  const store = createLearningStorage('user:A');
  store.setJSON('learning_revision', 7);
  store.setJSON('learning_dirty', true);
  store.setJSON('settings_pending', { dailyGoal: 30 });
  assert.equal(store.getJSON('learning_revision', null), 7);
  store.resetAllData();
  assert.equal(store.getJSON('learning_revision', null), null);
  assert.equal(store.getJSON('learning_dirty', false), false);
  assert.deepEqual(store.getJSON('settings_pending', {}), {});
});

test('applying server learning does not echo writes, and subscriptions stay scoped', async () => {
  const a = createLearningStorage('user:A'); const b = createLearningStorage('user:B');
  let changes = 0; const stop = a.subscribeLearning(() => changes++);
  a.withoutLearningEvents(() => a.saveBookmarks([bookmark('remote')]));
  b.saveBookmarks([bookmark('other')]);
  await Promise.resolve(); assert.equal(changes, 0);
  a.saveBookmarks([bookmark('local')]); await Promise.resolve(); assert.equal(changes, 1);
  stop(); a.recordStudyActivity(1, 1, 1, 0.1, 'srs'); await Promise.resolve(); assert.equal(changes, 1);
});
