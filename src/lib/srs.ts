// ============================================================
// SM-2 Spaced Repetition Algorithm
// ============================================================
// Scientific basis: Piotr Wozniak's SuperMemo SM-2 algorithm
// Principle: Spaced Repetition — increasing intervals between
// successful reviews maximizes long-term retention.
// ============================================================

import type { SRSCard, Rating, CardState } from '../types';

// Learning steps in minutes (short-term repetition)
const LEARNING_STEPS = [1, 10, 60]; // 1 min, 10 min, 1 hour

// Default ease factor for new cards
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

/**
 * Create a new SRS card for an item.
 */
export function createSRSCard(
  itemId: string,
  itemType: 'vocabulary' | 'kanji' | 'grammar'
): SRSCard {
  return {
    itemId,
    itemType,
    state: 'new',
    easeFactor: DEFAULT_EASE,
    interval: 0,
    repetitions: 0,
    dueDate: new Date().toISOString(),
    lastReview: null,
    totalReviews: 0,
    correctCount: 0,
    learningStep: 0,
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
  updated.totalReviews++;
  updated.lastReview = now.toISOString();

  if (rating !== 'again') {
    updated.correctCount++;
  }

  switch (card.state) {
    case 'new':
    case 'learning':
    case 'forgotten':
      updated.state = processLearningState(updated, rating);
      break;
    case 'review':
    case 'mastered':
      processReviewState(updated, rating);
      break;
  }

  return updated;
}

function processLearningState(card: SRSCard, rating: Rating): CardState {
  switch (rating) {
    case 'again':
      // Reset to first learning step
      card.learningStep = 0;
      card.dueDate = addMinutes(new Date(), LEARNING_STEPS[0]).toISOString();
      return 'learning';

    case 'hard':
      // Repeat current step
      card.dueDate = addMinutes(
        new Date(),
        LEARNING_STEPS[card.learningStep] || LEARNING_STEPS[0]
      ).toISOString();
      return 'learning';

    case 'good':
      // Advance to next step
      card.learningStep++;
      if (card.learningStep >= LEARNING_STEPS.length) {
        // Graduate to review
        card.interval = 1; // 1 day
        card.repetitions = 1;
        card.dueDate = addDays(new Date(), 1).toISOString();
        return 'review';
      }
      card.dueDate = addMinutes(
        new Date(),
        LEARNING_STEPS[card.learningStep]
      ).toISOString();
      return 'learning';

    case 'easy':
      // Graduate immediately with 4-day interval
      card.interval = 4;
      card.repetitions = 1;
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor + 0.15);
      card.dueDate = addDays(new Date(), 4).toISOString();
      return 'review';
  }
}

function processReviewState(card: SRSCard, rating: Rating): void {
  switch (rating) {
    case 'again':
      // Lapse: reset to learning
      card.state = 'forgotten';
      card.learningStep = 0;
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor - 0.2);
      card.interval = 1;
      card.repetitions = 0;
      card.dueDate = addMinutes(new Date(), LEARNING_STEPS[0]).toISOString();
      break;

    case 'hard':
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor - 0.15);
      card.interval = Math.max(1, Math.round(card.interval * 1.2));
      card.repetitions++;
      card.dueDate = addDays(new Date(), card.interval).toISOString();
      card.state = card.interval >= 30 ? 'mastered' : 'review';
      break;

    case 'good':
      card.interval = Math.max(1, Math.round(card.interval * card.easeFactor));
      card.repetitions++;
      card.dueDate = addDays(new Date(), card.interval).toISOString();
      card.state = card.interval >= 30 ? 'mastered' : 'review';
      break;

    case 'easy':
      card.easeFactor = Math.max(MIN_EASE, card.easeFactor + 0.15);
      card.interval = Math.max(1, Math.round(card.interval * card.easeFactor * 1.3));
      card.repetitions++;
      card.dueDate = addDays(new Date(), card.interval).toISOString();
      card.state = card.interval >= 30 ? 'mastered' : 'review';
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
    mastered: 0,
    forgotten: 0,
  };
  cards.forEach((card) => dist[card.state]++);
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
export function formatInterval(interval: number): string {
  if (interval < 1) return '< 1 day';
  if (interval === 1) return '1 day';
  if (interval < 30) return `${interval} days`;
  if (interval < 365) return `${Math.round(interval / 30)} months`;
  return `${(interval / 365).toFixed(1)} years`;
}

/**
 * Get the next review intervals for each rating option.
 */
export function getNextIntervals(
  card: SRSCard
): Record<Rating, string> {
  return {
    again: card.state === 'review' || card.state === 'mastered' ? '1 min' : '1 min',
    hard:
      card.state === 'learning' || card.state === 'new' || card.state === 'forgotten'
        ? `${LEARNING_STEPS[card.learningStep] || LEARNING_STEPS[0]} min`
        : formatInterval(Math.max(1, Math.round(card.interval * 1.2))),
    good:
      card.state === 'learning' || card.state === 'new' || card.state === 'forgotten'
        ? card.learningStep + 1 >= LEARNING_STEPS.length
          ? '1 day'
          : `${LEARNING_STEPS[card.learningStep + 1]} min`
        : formatInterval(Math.max(1, Math.round(card.interval * card.easeFactor))),
    easy:
      card.state === 'learning' || card.state === 'new' || card.state === 'forgotten'
        ? '4 days'
        : formatInterval(
            Math.max(1, Math.round(card.interval * card.easeFactor * 1.3))
          ),
  };
}
