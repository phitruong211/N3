import type { FsrsProgress } from '@/types';

export type ReviewQueue<T> = {
  cardsByKey: Map<string, T>;
  progressByKey: Map<string, FsrsProgress | null>;
  sourceOrder: Map<string, number>;
  ready: string[];
  futureLearning: string[];
  introducedToday: Set<string>;
  answeredToday: Set<string>;
  nextDayStart: Date;
};

type QueueOptions<T> = {
  cards: readonly T[];
  keyFor: (card: T) => string;
  progressByKey?: Map<string, FsrsProgress | null>;
  now: Date;
  nextDayStart?: Date;
  dailyNewLimit?: number;
  introducedToday?: Iterable<string>;
};

const priority = (progress: FsrsProgress | null | undefined) =>
  progress?.state === 'relearning' ? 0 : progress?.state === 'learning' ? 1 : progress?.state === 'review' ? 2 : 3;

function sorted<T>(queue: ReviewQueue<T>, keys: string[]) {
  return [...new Set(keys)].sort((left, right) => {
    const lp = queue.progressByKey.get(left);
    const rp = queue.progressByKey.get(right);
    return priority(lp) - priority(rp)
      || (lp ? Date.parse(lp.dueAt) : Number.MAX_SAFE_INTEGER) - (rp ? Date.parse(rp.dueAt) : Number.MAX_SAFE_INTEGER)
      || (queue.sourceOrder.get(left) ?? 0) - (queue.sourceOrder.get(right) ?? 0);
  });
}

export function createReviewQueue<T>(options: QueueOptions<T>): ReviewQueue<T> {
  const nextDayStart = options.nextDayStart ?? new Date(options.now.getFullYear(), options.now.getMonth(), options.now.getDate() + 1);
  const queue: ReviewQueue<T> = {
    cardsByKey: new Map(options.cards.map(card => [options.keyFor(card), card])),
    progressByKey: new Map(options.progressByKey ?? []),
    sourceOrder: new Map(options.cards.map((card, index) => [options.keyFor(card), index])),
    ready: [], futureLearning: [],
    introducedToday: new Set(options.introducedToday ?? []),
    answeredToday: new Set(), nextDayStart,
  };
  const fresh: string[] = [];
  for (const card of options.cards) {
    const key = options.keyFor(card);
    const progress = queue.progressByKey.get(key);
    if (!progress || progress.state === 'new') fresh.push(key);
    else if (Date.parse(progress.dueAt) <= options.now.getTime()) queue.ready.push(key);
    else if ((progress.state === 'learning' || progress.state === 'relearning') && Date.parse(progress.dueAt) < nextDayStart.getTime()) queue.futureLearning.push(key);
  }
  const allowance = Math.max(0, (options.dailyNewLimit ?? 20) - queue.introducedToday.size);
  queue.ready = sorted(queue, [...queue.ready, ...fresh.slice(0, allowance)]);
  return queue;
}

export const nextReadyCard = <T>(queue: ReviewQueue<T>) => {
  const key = queue.ready[0];
  return key ? { key, card: queue.cardsByKey.get(key)! } : null;
};

export function applyReviewedProgress<T>(queue: ReviewQueue<T>, key: string, progress: FsrsProgress, now: Date): ReviewQueue<T> {
  const next: ReviewQueue<T> = {
    ...queue,
    progressByKey: new Map(queue.progressByKey),
    ready: queue.ready.filter(value => value !== key),
    futureLearning: queue.futureLearning.filter(value => value !== key),
    introducedToday: new Set(queue.introducedToday),
    answeredToday: new Set(queue.answeredToday),
  };
  next.progressByKey.set(key, progress);
  next.answeredToday.add(key);
  next.introducedToday.add(key);
  const due = Date.parse(progress.dueAt);
  if (due <= now.getTime()) next.ready.push(key);
  else if ((progress.state === 'learning' || progress.state === 'relearning') && due < next.nextDayStart.getTime()) next.futureLearning.push(key);
  next.ready = sorted(next, next.ready);
  next.futureLearning = sorted(next, next.futureLearning);
  return next;
}

export function promoteDueCards<T>(queue: ReviewQueue<T>, now: Date): ReviewQueue<T> {
  const due = queue.futureLearning.filter(key => Date.parse(queue.progressByKey.get(key)?.dueAt ?? '') <= now.getTime());
  if (!due.length) return queue;
  return {
    ...queue,
    ready: sorted(queue, [...queue.ready, ...due]),
    futureLearning: queue.futureLearning.filter(key => !due.includes(key)),
  };
}

export const nearestFutureDue = <T>(queue: ReviewQueue<T>) => queue.futureLearning
  .map(key => queue.progressByKey.get(key)?.dueAt)
  .filter((value): value is string => Boolean(value))
  .sort()[0] ?? null;
