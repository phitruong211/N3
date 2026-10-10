export type DeckScheduleState = 'new' | 'learning' | 'review' | 'relearning';

export type DeckScheduleProgress = {
  state: DeckScheduleState;
  dueDate: string;
  lastReviewedAt?: string | null;
  repetitions?: number;
};

export type DeckScheduleSummary = {
  newCount: number;
  learningCount: number;
  dueCount: number;
  queuedCount: number;
  studiedTodayCount: number;
  learnedCount: number;
  remainingCount: number;
  newStartedTodayCount: number;
};

export const DAILY_NEW_CARD_LIMIT = 20;

function sameLocalDay(value: string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

export function buildScheduledDeckQueue<T>(
  cards: readonly T[],
  progressFor: (card: T) => DeckScheduleProgress | null | undefined,
  options: { now?: Date; dailyNewLimit?: number } = {},
): { cards: T[]; summary: DeckScheduleSummary } {
  const nowDate = options.now ?? new Date();
  const now = nowDate.getTime();
  const dailyNewLimit = Math.max(0, options.dailyNewLimit ?? DAILY_NEW_CARD_LIMIT);
  const fresh: T[] = [];
  const learning: Array<{ card: T; due: number }> = [];
  const review: Array<{ card: T; due: number }> = [];
  let studiedTodayCount = 0;
  let learnedCount = 0;
  let newStartedTodayCount = 0;

  for (const card of cards) {
    const progress = progressFor(card);
    if (!progress || progress.state === 'new') {
      fresh.push(card);
      continue;
    }
    learnedCount++;
    if (sameLocalDay(progress.lastReviewedAt, nowDate)) {
      studiedTodayCount++;
      if (progress.state === 'learning' || (progress.state === 'review' && (progress.repetitions ?? 0) <= 1)) newStartedTodayCount++;
    }
    const due = Date.parse(progress.dueDate);
    if (!Number.isFinite(due) || due > now) continue;
    if (progress.state === 'learning' || progress.state === 'relearning') learning.push({ card, due });
    else review.push({ card, due });
  }

  learning.sort((left, right) => left.due - right.due);
  review.sort((left, right) => left.due - right.due);
  const cardsForSession = [
    ...learning.map(item => item.card),
    ...review.map(item => item.card),
    ...fresh.slice(0, Math.max(0, dailyNewLimit - newStartedTodayCount)),
  ];

  return {
    cards: cardsForSession,
    summary: {
      newCount: fresh.length,
      learningCount: learning.length,
      dueCount: review.length,
      queuedCount: cardsForSession.length,
      studiedTodayCount,
      learnedCount,
      remainingCount: fresh.length,
      newStartedTodayCount,
    },
  };
}
