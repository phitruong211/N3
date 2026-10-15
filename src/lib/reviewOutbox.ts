import type { Rating, SRSCard } from '../types';
import type { ReviewTimingData } from './reviewTiming';

export const REVIEW_OUTBOX_KEY = 'review_outbox_v1';
export type QueuedReview = {
  id: string;
  source: 'BUILT_IN' | 'PERSONAL';
  card: SRSCard;
  rating: Rating;
  optimistic: SRSCard;
  timing: ReviewTimingData;
  responseTimeMs: number;
};
export type ReviewOutboxData = { items: QueuedReview[]; confirmed: Record<string, SRSCard> };
export const reviewKey = (source: string, card: SRSCard) => `${source}:${card.deckType}:${card.cardId}`;
export const emptyOutbox = (): ReviewOutboxData => ({ items: [], confirmed: {} });

/** One durable record contains both acknowledgements and pending operations. */
export function createReviewOutbox(options: {
  read: () => ReviewOutboxData;
  write: (data: ReviewOutboxData) => void;
  lock: <T>(name: string, work: () => Promise<T>) => Promise<T>;
  send: (items: QueuedReview[]) => Promise<SRSCard[]>;
  changed: () => void;
  active: () => boolean;
}) {
  let flight: Promise<void> | null = null;
  const mutate = <T>(work: (data: ReviewOutboxData) => T) => options.lock('data', async () => {
    const data = options.read();
    const result = work(data);
    options.write(data); // Must throw if durable storage is unavailable.
    options.changed();
    return result;
  });
  return {
    enqueue: (item: QueuedReview) => mutate(data => {
      if (!data.items.some(value => value.id === item.id)) data.items.push(item);
    }),
    drain() {
      if (flight) return flight;
      flight = options.lock('sender', async () => {
        while (options.active()) {
          const items = options.read().items;
          if (!items.length) return;
          // Personal reviews retain their existing transaction; built-ins share one transaction.
          const batch = items[0].source === 'BUILT_IN'
            ? items.slice(0, 20).filter((item, index, all) => all.slice(0, index + 1).every(value => value.source === 'BUILT_IN'))
            : items.slice(0, 1);
          const results = await options.send(batch);
          if (results.length !== batch.length) throw new Error('Phản hồi đồng bộ không đầy đủ.');
          await mutate(data => {
            batch.forEach((item, index) => {
              const key = reviewKey(item.source, item.card);
              const saved = results[index];
              if (!data.confirmed[key] || data.confirmed[key].reps <= saved.reps) data.confirmed[key] = saved;
            });
            const ids = new Set(batch.map(item => item.id));
            data.items = data.items.filter(item => !ids.has(item.id));
          });
        }
      }).finally(() => { flight = null; });
      return flight;
    },
  };
}

export function projectedReview(data: ReviewOutboxData, source: string, card: SRSCard): SRSCard {
  const key = reviewKey(source, card);
  const candidates = [card, data.confirmed[key], ...data.items
    .filter(item => reviewKey(item.source, item.card) === key).map(item => item.optimistic)]
    .filter((value): value is SRSCard => Boolean(value));
  return candidates.reduce((latest, value) => value.reps >= latest.reps ? value : latest);
}
