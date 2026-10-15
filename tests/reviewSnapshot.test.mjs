import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeReviewSnapshot, sameLearningData } from '../src/lib/reviewSnapshot.ts';
const data = () => ({ bookmarks: [], srsCards: [], studyDays: [] });
const bookmark = id => ({ itemType: 'vocabulary', itemId: id, createdAt: '2026-10-15T00:00:00Z' });
const day = count => ({ date: '2026-10-15', cardsReviewed: count, srsReviewed: count, newCardsLearned: count, accuracy: 1, timeSpent: count });
test('acknowledgement preserves unrelated additions and deletions on both devices', () => {
  const base = { ...data(), bookmarks: [bookmark('deleted'), bookmark('unchanged')] };
  const local = { ...base, bookmarks: [bookmark('unchanged'), bookmark('local')] };
  const remote = { ...data(), revision: 9, bookmarks: [bookmark('deleted'), bookmark('remote')] };
  assert.deepEqual(mergeReviewSnapshot(local, base, remote, []).bookmarks.map(b => b.itemId).sort(), ['local', 'remote']);
});
test('concurrent study-day additions merge only the local delta and retain weighted accuracy', () => {
  const base = { ...data(), studyDays: [day(10)] };
  const local = { ...base, studyDays: [{ ...day(12), accuracy: 10 / 12 }] };
  const remote = { ...data(), revision: 2, studyDays: [day(13)] };
  const result = mergeReviewSnapshot(local, base, remote, []).studyDays[0];
  assert.equal(result.cardsReviewed, 15);
  assert.equal(result.srsReviewed, 15);
  assert.equal(result.accuracy, 13 / 15);
});
test('replayed receipt never overwrites newer confirmed card progress', () => {
  const older = { cardId: 'one', deckType: 'kanji', reps: 1 };
  const latest = { ...older, reps: 3 };
  const remote = { ...data(), revision: 3, srsCards: [latest] };
  assert.deepEqual(mergeReviewSnapshot(data(), data(), remote, [older]).srsCards, [latest]);
});
test('revision metadata alone does not trigger another snapshot PUT', () => {
  assert.equal(sameLearningData(data(), { ...data(), revision: 5 }), true);
});
