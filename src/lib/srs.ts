// ============================================================
// SM-2 Spaced Repetition Algorithm
// ============================================================
// Scientific basis: Piotr Wozniak's SuperMemo SM-2 algorithm
// Principle: Spaced Repetition — increasing intervals between
// successful reviews maximizes long-term retention.
// ============================================================

import type { SRSCard, Rating, CardState, DeckType } from '../types';

// Learning steps in minutes (short-term repetition)
const LEARNING_STEPS = [1, 10, 60]; // 1 min, 10 min, 1 hour

// Default ease factor for new cards
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

/**
 * Create a new SRS card for an item.
 */
export function createSRSCard(
  cardId: string,
  deckType: DeckType
): SRSCard {
  return {
    cardId,
    deckType,
    state: 'new',
    easeFactor: DEFAULT_EASE,
    dueDate: new Date().toISOString(),
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
}

/**
 * Process a review rating and return updated card.
 * 
 * SM-2 Algorithm (modified):
 * - Again: Reset to learning, step 0
 * - Hard: Stay at current step or reduce interval
 * - Good: Advance step / increase interval
 * - Easy: Graduate immediately with bonus interval
 */
export function processReview(card: SRSCard, rating: Rating): SRSCard {
  const now = new Date();
  const updated = { ...card };
  updated.lastReviewedAt = now.toISOString();

  switch (card.state) {
    case 'new':
    case 'learning':
    case 'relearning':
      processLearningState(updated, rating);
      break;
    case 'review':
      processReviewState(updated, rating);
      break;
  }

  return updated;
}

function processLearningState(card: SRSCard, rating: Rating): void {
  let currentStepIdx = 0;
  if (card.intervalMinutes) {
    const idx = LEARNING_STEPS.indexOf(card.intervalMinutes);
    if (idx >= 0) currentStepIdx = idx;
  }

  switch (rating) {
    case 'again':
      // Reset to first learning step
      card.intervalMinutes = LEARNING_STEPS[0];
      card.dueDate = addMinutes(new Date(), card.intervalMinutes).toISOString();
      card.state = card.state === 'relearning' ? 'relearning' : 'learning';
      break;

    case 'hard':
      // Repeat current step
      card.intervalMinutes = LEARNING_STEPS[currentStepIdx];
      card.dueDate = addMinutes(new Date(), card.intervalMinutes).toISOString();
      card.state = card.state === 'relearning' ? 'relearning' : 'learning';
      break;

    case 'good':
      // Advance to next step
      if (currentStepIdx + 1 >= LEARNING_STEPS.length) {
        // Graduate to review
        card.state = 'review';
        card.intervalDays = 1; // 1 day
        card.intervalMinutes = undefined;
        card.reps = 1;
        card.dueDate = addDays(new Date(), 1).toISOString();
      } else {
        card.intervalMinutes = LEARNING_STEPS[currentStepIdx + 1];
        card.dueDate = addMinutes(new Date(), card.intervalMinutes).toISOString();
        card.state = card.state === 'relearning' ? 'relearning' : 'learning';
      }
      break;

    case 'easy':
      // Graduate immediately with 4-day interval
      card.state = 'review';
      card.intervalDays = 4;
      card.intervalMinutes = undefined;
      card.reps = 1;
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor + 0.15);
      card.dueDate = addDays(new Date(), 4).toISOString();
      break;
  }
}

function processReviewState(card: SRSCard, rating: Rating): void {
  const currentInterval = card.intervalDays || 1;

  switch (rating) {
    case 'again':
      // Lapse: reset to learning
      card.state = 'relearning';
      card.lapses += 1;
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor - 0.2);
      card.intervalMinutes = LEARNING_STEPS[0];
      card.intervalDays = undefined;
      card.reps = 0;
      card.dueDate = addMinutes(new Date(), card.intervalMinutes).toISOString();
      break;

    case 'hard':
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor - 0.15);
      card.intervalDays = Math.max(1, Math.round(currentInterval * 1.2));
      card.reps += 1;
      card.dueDate = addDays(new Date(), card.intervalDays).toISOString();
      break;

    case 'good':
      card.intervalDays = Math.max(1, Math.round(currentInterval * card.easeFactor));
      card.reps += 1;
      card.dueDate = addDays(new Date(), card.intervalDays).toISOString();
      break;

    case 'easy':
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor + 0.15);
      card.intervalDays = Math.max(1, Math.round(currentInterval * card.easeFactor * 1.3));
      card.reps += 1;
      card.dueDate = addDays(new Date(), card.intervalDays).toISOString();
      break;
  }
}

/**
 * Get all cards due for review today.
 */
export function getDueCards(cards: SRSCard[]): SRSCard[] {
  const now = new Date();
  return cards.filter((card) => {
    if (card.state === 'new') return false;
    return new Date(card.dueDate) <= now;
  });
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

// --- Utility functions ---

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format interval for display.
 */
export function formatCardInterval(card: SRSCard | null): string {
  if (!card || card.state === 'new') return 'Chưa học';
  if (card.state === 'learning' || card.state === 'relearning') {
    const min = card.intervalMinutes || LEARNING_STEPS[0];
    return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
  }
  
  const interval = card.intervalDays || 1;
  if (interval === 1) return '1 ngày';
  if (interval < 30) return `${interval} ngày`;
  if (interval < 365) return `${Math.round(interval / 30)} tháng`;
  return `${(interval / 365).toFixed(1)} năm`;
}

export function formatInterval(interval: number): string {
  if (interval < 1) return '< 1 ngày';
  if (interval === 1) return '1 ngày';
  if (interval < 30) return `${interval} ngày`;
  if (interval < 365) return `${Math.round(interval / 30)} tháng`;
  return `${(interval / 365).toFixed(1)} năm`;
}

/**
 * Get the next review intervals for each rating option.
 */
export function getNextIntervals(
  card: SRSCard
): Record<Rating, string> {
  if (card.state === 'review') {
    const currentInterval = card.intervalDays || 1;
    return {
      again: '1m',
      hard: formatInterval(Math.max(1, Math.round(currentInterval * 1.2))),
      good: formatInterval(Math.max(1, Math.round(currentInterval * card.easeFactor))),
      easy: formatInterval(Math.max(1, Math.round(currentInterval * card.easeFactor * 1.3))),
    };
  } else {
    let currentStepIdx = 0;
    if (card.intervalMinutes) {
      const idx = LEARNING_STEPS.indexOf(card.intervalMinutes);
      if (idx >= 0) currentStepIdx = idx;
    }
    const nextStep = LEARNING_STEPS[currentStepIdx + 1];
    
    return {
      again: '1m',
      hard: `${LEARNING_STEPS[currentStepIdx]}m`,
      good: nextStep ? (nextStep < 60 ? `${nextStep}m` : `${Math.round(nextStep / 60)}h`) : '1 ngày',
      easy: '4 ngày',
    };
  }
}
