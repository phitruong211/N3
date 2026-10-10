import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyToFsrsProgress, reviewBuiltInCard, previewBuiltInIntervals } from '../src/lib/fsrsProgress.ts';

const settings = { srsAgainMinutes: 1, srsGoodMinutes: 10, srsDesiredRetention: 0.9 };

test('legacy migration preserves due date and counters', () => {
  const legacy = { cardId: 'v-1', deckType: 'vocabulary', state: 'review', easeFactor: 2.5,
    intervalDays: 12, dueDate: '2026-10-15T00:00:00.000Z', reps: 7, lapses: 2,
    lastReviewedAt: '2026-10-03T00:00:00.000Z' };
  const migrated = legacyToFsrsProgress(legacy);
  assert.equal(migrated.dueAt, legacy.dueDate);
  assert.equal(migrated.repetitions, 7);
  assert.equal(migrated.lapses, 2);
  assert.equal(migrated.stability, 12);
  assert.equal(migrated.difficulty, 5);
});

test('again schedules the configured same-session retry', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const next = reviewBuiltInCard(null, 'again', now, settings, false);
  assert.equal(next.state, 'learning');
  assert.equal(next.dueAt, '2026-10-10T00:01:00.000Z');
  assert.equal(next.lastRating, 'again');
});

test('custom short steps drive previews and persisted due times', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const custom = { ...settings, srsAgainMinutes: 3, srsGoodMinutes: 15 };
  assert.equal(previewBuiltInIntervals(null, now, custom).again, '3m');
  assert.equal(reviewBuiltInCard(null, 'again', now, custom, false).dueAt, '2026-10-10T00:03:00.000Z');
});
