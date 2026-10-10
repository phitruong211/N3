import type { SRSCard, Rating, CardState, DeckType, SrsSchedulingSettings } from '../types';
import {
  DEFAULT_SRS_SETTINGS,
  previewBuiltInIntervals,
  progressToSrsCard,
  reviewBuiltInCard,
} from './fsrsProgress.ts';

/** Create a new unscheduled card. It receives its FSRS memory state on first rating. */
export function createSRSCard(cardId: string, deckType: DeckType): SRSCard {
  return {
    cardId,
    deckType,
    state: 'new',
    easeFactor: 2.5,
    dueDate: new Date().toISOString(),
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    lastRating: null,
  };
}

/** Apply an FSRS-6 rating while retaining the storage-compatible SRSCard shape. */
export function processReview(
  card: SRSCard,
  rating: Rating,
  now = new Date(),
  settings: SrsSchedulingSettings = DEFAULT_SRS_SETTINGS,
): SRSCard {
  return progressToSrsCard(
    card.cardId,
    card.deckType,
    reviewBuiltInCard(card, rating, now, settings, true),
  );
}

/**
 * Get all cards due for review today.
 */
export function getDueCards(cards: SRSCard[], now = new Date()): SRSCard[] {
  return cards.filter((card) => {
    if (card.state === 'new') return false;
    return new Date(card.dueDate) <= now;
  });
}

/** Due reviews come first, followed by cards that have never been studied. */
export function getReadyAnkiItems<T extends { id: string }>(
  items: T[],
  cards: SRSCard[],
  deckType: DeckType,
  now = new Date()
): T[] {
  const byId = new Map(cards.filter(card => card.deckType === deckType).map(card => [card.cardId, card]));
  const nowMs = now.getTime();
  const due: { item: T; dueAt: number; sourceIndex: number }[] = [];
  const fresh: T[] = [];
  for (const [sourceIndex, item] of items.entries()) {
    const card = byId.get(item.id);
    if (!card || card.state === 'new') fresh.push(item);
    else {
      const dueAt = new Date(card.dueDate).getTime();
      if (Number.isFinite(dueAt) && dueAt <= nowMs) due.push({ item, dueAt, sourceIndex });
    }
  }
  due.sort((a, b) => a.dueAt - b.dueAt || a.sourceIndex - b.sourceIndex);
  return [...due.map(({ item }) => item), ...fresh];
}

/**
 * Get review forecast: how many cards are due each day
 * for the next N days.
 */
export function getReviewForecast(
  cards: SRSCard[],
  days: number = 7
): { date: string; count: number }[] {
  const forecast: { date: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const dateStr = formatDate(date);
    const count = cards.filter((card) => {
      if (card.state === 'new') return false;
      const due = new Date(card.dueDate);
      due.setHours(0, 0, 0, 0);
      return due <= date;
    }).length;
    forecast.push({ date: dateStr, count });
  }

  return forecast;
}

/**
 * Calculate card state distribution.
 */
export function getStateDistribution(
  cards: SRSCard[]
): Record<CardState, number> {
  const dist: Record<CardState, number> = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
  };
  cards.forEach((card) => {
    if (dist[card.state] !== undefined) dist[card.state]++;
  });
  return dist;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format interval for display.
 */
export function formatCardInterval(card: SRSCard | null): string {
  if (!card || card.state === 'new') return 'Chưa học';
  if (card.state === 'learning' || card.state === 'relearning') {
    const min = card.intervalMinutes || DEFAULT_SRS_SETTINGS.srsAgainMinutes;
    return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
  }
  
  const interval = card.intervalDays || 1;
  if (interval === 1) return '1 ngày';
  if (interval < 30) return `${interval} ngày`;
  if (interval < 365) return `${Math.round(interval / 30)} tháng`;
  return `${(interval / 365).toFixed(1)} năm`;
}

/** Format the actual time remaining until a persisted due date. */
export function formatTimeUntilDue(card: SRSCard | null, now = new Date()): string {
  if (!card || card.state === 'new') return 'Chưa học';

  const remainingMs = new Date(card.dueDate).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return 'Đến hạn';

  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) return `${remainingMinutes}m`;

  const remainingHours = Math.ceil(remainingMs / 3_600_000);
  if (remainingHours < 24) return `${remainingHours}h`;

  const remainingDays = Math.ceil(remainingMs / 86_400_000);
  if (remainingDays < 30) return `${remainingDays} ngày`;
  if (remainingDays < 365) return `${Math.ceil(remainingDays / 30)} tháng`;
  return `${(remainingDays / 365).toFixed(1)} năm`;
}

export function formatInterval(interval: number): string {
  if (interval < 1) return '< 1 ngày';
  if (interval === 1) return '1 ngày';
  if (interval < 30) return `${interval} ngày`;
  if (interval < 365) return `${Math.round(interval / 30)} tháng`;
  return `${(interval / 365).toFixed(1)} năm`;
}

/** Preview FSRS intervals using the same account settings as scheduling. */
export function getNextIntervals(
  card: SRSCard,
  settings: SrsSchedulingSettings = DEFAULT_SRS_SETTINGS,
  now = new Date(),
): Record<Rating, string> {
  return previewBuiltInIntervals(card, now, settings);
}
