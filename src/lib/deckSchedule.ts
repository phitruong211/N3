export type DeckScheduleState = 'new' | 'learning' | 'review' | 'relearning';

export type DeckScheduleProgress = {
  state: DeckScheduleState;
  dueDate: string;
};

export type DeckScheduleSummary = {
  newCount: number;
  learningCount: number;
  dueCount: number;
  queuedCount: number;
};

export function buildScheduledDeckQueue<T>(
  cards: readonly T[],
  progressFor: (card: T) => DeckScheduleProgress | null | undefined,
  options?: { now?: Date },
): { cards: T[]; summary: DeckScheduleSummary } {
  const now = (options?.now ?? new Date()).getTime();
  const fresh: T[] = [];
  const learning: Array<{ card: T; due: number }> = [];
  const review: Array<{ card: T; due: number }> = [];

  for (const card of cards) {
    const progress = progressFor(card);
    if (!progress || progress.state === 'new') {
      fresh.push(card);
      continue;
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
    ...fresh,
  ];

  return {
    cards: cardsForSession,
    summary: {
      newCount: fresh.length,
      learningCount: learning.length,
      dueCount: review.length,
      queuedCount: cardsForSession.length,
    },
  };
}
