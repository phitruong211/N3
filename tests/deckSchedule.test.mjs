import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScheduledDeckQueue } from '../src/lib/deckSchedule.ts';

const cards = [
  { id: 'future-learning', position: 0 },
  { id: 'new-1', position: 1 },
  { id: 'review', position: 2 },
  { id: 'learning', position: 3 },
  { id: 'new-2', position: 4 },
];
const now = new Date('2026-10-10T00:00:00.000Z');
const progress = new Map([
  ['future-learning', { state: 'learning', dueDate: '2026-10-11T00:00:00.000Z' }],
  ['review', { state: 'review', dueDate: '2026-10-09T00:00:00.000Z' }],
  ['learning', { state: 'relearning', dueDate: '2026-10-09T12:00:00.000Z' }],
]);

test('scheduled deck queue separates states and prioritizes learning, review, then new', () => {
  const result = buildScheduledDeckQueue(cards, card => progress.get(card.id), { now, newLimit: 1 });
  assert.deepEqual(result.summary, { newCount: 2, learningCount: 1, dueCount: 1, queuedCount: 3 });
  assert.deepEqual(result.cards.map(card => card.id), ['learning', 'review', 'new-1']);
});

test('scheduled deck queue can review due cards without introducing new cards', () => {
  const result = buildScheduledDeckQueue(cards, card => progress.get(card.id), { now, newLimit: 0 });
  assert.deepEqual(result.cards.map(card => card.id), ['learning', 'review']);
  assert.equal(result.summary.newCount, 2);
  assert.equal(result.summary.queuedCount, 2);
});
