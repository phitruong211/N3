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
  ['future-learning', { state: 'learning', dueDate: '2026-10-11T00:00:00.000Z', lastReviewedAt: '2026-10-10T00:00:00.000Z', repetitions: 0 }],
  ['review', { state: 'review', dueDate: '2026-10-09T00:00:00.000Z', lastReviewedAt: '2026-10-08T00:00:00.000Z', repetitions: 4, lastRating: 'good' }],
  ['learning', { state: 'relearning', dueDate: '2026-10-09T12:00:00.000Z', lastReviewedAt: '2026-10-09T00:00:00.000Z', repetitions: 0, lastRating: 'again' }],
]);

test('scheduled deck queue prioritizes due cards and applies the automatic daily new-card allowance', () => {
  const result = buildScheduledDeckQueue(cards, card => progress.get(card.id), { now, dailyNewLimit: 2 });
  assert.deepEqual(result.summary, {
    newCount: 2,
    learningCount: 1,
    dueCount: 2,
    queuedCount: 3,
    studiedTodayCount: 1,
    learnedCount: 3,
    remainingCount: 3,
    newStartedTodayCount: 1,
    unresolvedCount: 1,
    remainingTodayCount: 3,
  });
  assert.deepEqual(result.cards.map(card => card.id), ['learning', 'review', 'new-1']);
});

test('scheduled deck queue stops introducing new cards after the daily allowance is used', () => {
  const result = buildScheduledDeckQueue(cards, card => progress.get(card.id), { now, dailyNewLimit: 1 });
  assert.deepEqual(result.cards.map(card => card.id), ['learning', 'review']);
  assert.equal(result.summary.newCount, 2);
  assert.equal(result.summary.queuedCount, 2);
});

test('a card introduced today still occupies its daily slot after graduating', () => {
  const now = new Date('2026-10-10T12:00:00.000Z');
  const cards = Array.from({ length: 22 }, (_, index) => ({ id: String(index) }));
  const result = buildScheduledDeckQueue(cards, card => card.id === '0' ? {
    state: 'review',
    dueDate: '2026-10-20T00:00:00.000Z',
    firstReviewedAt: '2026-10-10T01:00:00.000Z',
    lastReviewedAt: '2026-10-10T01:10:00.000Z',
    repetitions: 2,
  } : null, { now, dailyNewLimit: 20 });
  assert.equal(result.summary.newStartedTodayCount, 1);
  assert.equal(result.cards.length, 19);
});
