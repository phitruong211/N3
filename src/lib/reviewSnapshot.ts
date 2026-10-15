import type { Bookmark, SRSCard, StudyDay } from '../types';
import type { LearningData, LearningSnapshot } from './learningSync';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const cardKey = (card: SRSCard) => `${card.deckType}:${card.cardId}`;
function mergeChanges<T>(local: T[], base: T[], remote: T[], key: (value: T) => string) {
  const result = new Map(remote.map(value => [key(value), value]));
  const before = new Map(base.map(value => [key(value), value]));
  const current = new Set(local.map(key));
  for (const value of base) if (!current.has(key(value))) result.delete(key(value));
  for (const value of local) if (!equal(value, before.get(key(value)))) result.set(key(value), value);
  return result;
}

/** Apply only local changes since the last confirmed snapshot, preserving other devices' work. */
export function mergeReviewSnapshot(local: LearningData, base: LearningData, remote: LearningSnapshot, acknowledged: SRSCard[], force = false): LearningData {
  const bookmarks = mergeChanges<Bookmark>(local.bookmarks, base.bookmarks, remote.bookmarks, value => `${value.itemType}:${value.itemId}`);
  const cards = mergeChanges(local.srsCards, base.srsCards, remote.srsCards, cardKey);
  for (const card of [...remote.srsCards, ...acknowledged]) {
    if ((force && acknowledged.includes(card)) || (cards.get(cardKey(card))?.reps ?? -1) <= card.reps) cards.set(cardKey(card), card);
  }
  const days = new Map(remote.studyDays.map(day => [day.date, day]));
  const oldDays = new Map(base.studyDays.map(day => [day.date, day]));
  for (const day of local.studyDays) {
    const previous = oldDays.get(day.date);
    const server = days.get(day.date);
    if (equal(day, previous)) continue;
    if (!server || equal(server, previous) || equal(server, day)) { days.set(day.date, day); continue; }
    const combined: StudyDay = { ...server, ...day };
    const fields = ['cardsReviewed', 'flashcardReviewed', 'flashcardViewed', 'srsReviewed', 'newCardsLearned', 'timeSpent'] as const;
    for (const field of fields) combined[field] = Math.max(0, (server[field] ?? 0) + (day[field] ?? 0) - (previous?.[field] ?? 0));
    const correct = server.accuracy * server.cardsReviewed + day.accuracy * day.cardsReviewed - (previous?.accuracy ?? 0) * (previous?.cardsReviewed ?? 0);
    combined.accuracy = combined.cardsReviewed ? Math.max(0, Math.min(100, correct / combined.cardsReviewed)) : 0;
    days.set(day.date, combined);
  }
  return { bookmarks: [...bookmarks.values()], srsCards: [...cards.values()], studyDays: [...days.values()] };
}

export function sameLearningData(a: LearningData, b: LearningData) {
  return equal(a.bookmarks, b.bookmarks) && equal(a.srsCards, b.srsCards) && equal(a.studyDays, b.studyDays);
}
