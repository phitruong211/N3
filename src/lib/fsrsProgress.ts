import {
  Rating as FsrsRating,
  State as FsrsState,
  createEmptyCard,
  fsrs,
  type Card,
  type CardInput,
} from 'ts-fsrs';
import type {
  CardState,
  FsrsProgress,
  Rating,
  SRSCard,
  SrsSchedulingSettings,
} from '@/types';

export const DEFAULT_SRS_SETTINGS: SrsSchedulingSettings = {
  srsAgainMinutes: 1,
  srsGoodMinutes: 10,
  srsDesiredRetention: 0.9,
};

const ratingMap: Record<Rating, Exclude<FsrsRating, FsrsRating.Manual>> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

function appState(state: FsrsState): CardState {
  if (state === FsrsState.Review) return 'review';
  if (state === FsrsState.Relearning) return 'relearning';
  return 'learning';
}

function fsrsState(state: CardState): FsrsState {
  if (state === 'review') return FsrsState.Review;
  if (state === 'relearning') return FsrsState.Relearning;
  return FsrsState.Learning;
}

function isProgress(value: SRSCard | FsrsProgress): value is FsrsProgress {
  return 'dueAt' in value;
}

export function legacyToFsrsProgress(card: SRSCard): FsrsProgress {
  const first = card.firstReviewedAt ?? card.lastReviewedAt ?? null;
  return {
    algorithm: 'fsrs-6',
    state: card.state,
    dueAt: card.dueDate,
    stability: card.stability ?? Math.max(0.1, card.intervalDays ?? 0.1),
    difficulty: card.difficulty ?? 5,
    elapsedDays: card.elapsedDays ?? 0,
    scheduledDays: card.scheduledDays ?? card.intervalDays ?? 0,
    learningSteps: card.learningSteps ?? (card.state === 'review' ? 0 : 1),
    repetitions: card.reps,
    lapses: card.lapses,
    firstReviewedAt: first,
    lastReviewedAt: card.lastReviewedAt,
    lastRating: card.lastRating ?? null,
  };
}

function toLibraryCard(current: SRSCard | FsrsProgress | null, now: Date): Card | CardInput {
  if (!current || (!isProgress(current) && current.state === 'new')) return createEmptyCard(now);
  const progress = isProgress(current) ? current : legacyToFsrsProgress(current);
  if (progress.state === 'new') return createEmptyCard(now);
  return {
    due: progress.dueAt,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsedDays,
    scheduled_days: progress.scheduledDays,
    learning_steps: progress.learningSteps,
    reps: progress.repetitions,
    lapses: progress.lapses,
    state: fsrsState(progress.state),
    last_review: progress.lastReviewedAt,
  };
}

function scheduler(settings: SrsSchedulingSettings, enableFuzz: boolean) {
  return fsrs({
    request_retention: settings.srsDesiredRetention,
    maximum_interval: 36500,
    enable_fuzz: enableFuzz,
    enable_short_term: true,
    learning_steps: [`${settings.srsAgainMinutes}m`, `${settings.srsGoodMinutes}m`],
    relearning_steps: [`${settings.srsAgainMinutes}m`],
  });
}

function fromResult(
  card: Card,
  rating: Rating,
  now: Date,
  previous: SRSCard | FsrsProgress | null,
): FsrsProgress {
  const prior = previous ? (isProgress(previous) ? previous : legacyToFsrsProgress(previous)) : null;
  return {
    algorithm: 'fsrs-6',
    state: appState(card.state),
    dueAt: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    repetitions: card.reps,
    lapses: card.lapses,
    firstReviewedAt: prior?.firstReviewedAt ?? now.toISOString(),
    lastReviewedAt: card.last_review?.toISOString() ?? now.toISOString(),
    lastRating: rating,
  };
}

export function reviewBuiltInCard(
  current: SRSCard | FsrsProgress | null,
  rating: Rating,
  now: Date,
  settings: SrsSchedulingSettings = DEFAULT_SRS_SETTINGS,
  enableFuzz = true,
): FsrsProgress {
  const result = scheduler(settings, enableFuzz).next(toLibraryCard(current, now), now, ratingMap[rating]);
  return fromResult(result.card, rating, now, current);
}

function compactInterval(due: Date, now: Date): string {
  const minutes = Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  const days = Math.max(1, Math.round(minutes / 1440));
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1)} năm`;
}

export function previewBuiltInIntervals(
  current: SRSCard | FsrsProgress | null,
  now: Date,
  settings: SrsSchedulingSettings = DEFAULT_SRS_SETTINGS,
): Record<Rating, string> {
  const preview = scheduler(settings, false).repeat(toLibraryCard(current, now), now);
  return {
    again: compactInterval(preview[FsrsRating.Again].card.due, now),
    hard: compactInterval(preview[FsrsRating.Hard].card.due, now),
    good: compactInterval(preview[FsrsRating.Good].card.due, now),
    easy: compactInterval(preview[FsrsRating.Easy].card.due, now),
  };
}

export function progressToSrsCard(cardId: string, deckType: SRSCard['deckType'], progress: FsrsProgress): SRSCard {
  return {
    cardId,
    deckType,
    state: progress.state,
    easeFactor: 2.5,
    intervalMinutes: progress.state === 'learning' || progress.state === 'relearning'
      ? Math.max(1, Math.round((Date.parse(progress.dueAt) - Date.parse(progress.lastReviewedAt ?? progress.dueAt)) / 60_000))
      : undefined,
    intervalDays: progress.state === 'review' ? progress.scheduledDays : undefined,
    dueDate: progress.dueAt,
    reps: progress.repetitions,
    lapses: progress.lapses,
    lastReviewedAt: progress.lastReviewedAt,
    algorithm: progress.algorithm,
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsedDays: progress.elapsedDays,
    scheduledDays: progress.scheduledDays,
    learningSteps: progress.learningSteps,
    firstReviewedAt: progress.firstReviewedAt,
    lastRating: progress.lastRating,
  };
}
