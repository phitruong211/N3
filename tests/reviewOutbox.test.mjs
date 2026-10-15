import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewOutbox, emptyOutbox, projectedReview } from '../src/lib/reviewOutbox.ts';
const card = (id = 'c1', reps = 0) => ({ cardId: id, deckType: 'vocabulary', state: 'new', reps, lapses: 0, dueDate: '2026-10-15T00:00:00Z', lastReviewedAt: null, easeFactor: 2.5 });
const item = (id, source = 'BUILT_IN', reps = 0) => ({ id, source, card: card('c1', reps), optimistic: { ...card('c1', reps + 1), state: 'learning' }, rating: 'good', timing: {}, responseTimeMs: 100 });
function fixture(send, initial = emptyOutbox()) {
  let stored = JSON.stringify(initial);
  let writes = 0;
  const options = { read: () => JSON.parse(stored), write: data => { stored = JSON.stringify(data); writes++; },
    lock: async (_, work) => work(), changed() {}, active: () => true, send };
  return { engine: createReviewOutbox(options), read: options.read, options, writes: () => writes };
}
test('enqueue persists immediately while a slow API remains unresolved; later enqueues are retained', async () => {
  let release;
  let calls = 0;
  const f = fixture(async items => {
    if (++calls === 1) await new Promise(resolve => { release = resolve; });
    return items.map(value => value.optimistic);
  });
  await f.engine.enqueue(item('one'));
  const flight = f.engine.drain();
  await new Promise(resolve => setImmediate(resolve));
  await f.engine.enqueue(item('two', 'BUILT_IN', 1));
  assert.equal(f.read().items.length, 2);
  release(); await flight;
  assert.equal(f.read().items.length, 0);
  assert.equal(projectedReview(f.read(), 'BUILT_IN', card()).reps, 2);
});
test('uncertain response survives reload and retries the original immutable payload', async () => {
  const f = fixture(async () => { throw new Error('response lost after commit'); });
  await f.engine.enqueue(item('same-id'));
  await assert.rejects(f.engine.drain());
  const before = f.read();
  let received;
  const restored = fixture(async items => { received = items; return items.map(value => value.optimistic); }, before);
  await restored.engine.drain();
  assert.deepEqual(received, before.items);
  assert.equal(restored.read().items.length, 0);
});
test('batch respects source ordering, sends at most 20 and serializes concurrent drain calls', async () => {
  const batches = [];
  const f = fixture(async items => { batches.push(items); return items.map(value => value.optimistic); });
  for (let i = 0; i < 24; i++) await f.engine.enqueue(item(`b${i}`));
  await f.engine.enqueue(item('personal', 'PERSONAL'));
  await f.engine.enqueue(item('last'));
  await Promise.all([f.engine.drain(), f.engine.drain()]);
  assert.deepEqual(batches.map(batch => batch.length), [20, 4, 1, 1]);
  assert.equal(batches[2][0].source, 'PERSONAL');
});
test('older acknowledgement cannot replace a later pending projection or newer server state', () => {
  const data = { items: [item('second', 'PERSONAL', 1)], confirmed: { 'PERSONAL:vocabulary:c1': card('c1', 1) } };
  assert.equal(projectedReview(data, 'PERSONAL', card()).reps, 2);
  assert.equal(projectedReview(data, 'PERSONAL', card('c1', 3)).reps, 3);
});
test('failed durable write rejects enqueue instead of permitting a card advance', async () => {
  const f = fixture(async () => []);
  f.options.write = () => { throw new Error('Quota exceeded'); };
  await assert.rejects(f.engine.enqueue(item('one')), /Quota/);
  assert.equal(f.read().items.length, 0);
});
test('server conflict retains the operation and every subsequent rating', async () => {
  const f = fixture(async () => { throw new Error('409'); });
  await f.engine.enqueue(item('one')); await f.engine.enqueue(item('two'));
  await assert.rejects(f.engine.drain());
  assert.deepEqual(f.read().items.map(value => value.id), ['one', 'two']);
});
