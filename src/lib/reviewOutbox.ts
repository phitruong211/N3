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
  activity?: { date: string; isNew: boolean; correct: boolean };
  attempted?: boolean;
};
export type ReviewOutboxData = {
  items: QueuedReview[]; confirmed: Record<string, SRSCard>;
  undo?: { item: QueuedReview; local: boolean; result?: SRSCard };
  lastUndo?: { id: string; card: SRSCard };
  reverted?: Record<string, string>;
};
export const reviewKey = (source: string, card: SRSCard) => `${source}:${card.deckType}:${card.cardId}`;
export const emptyOutbox = (): ReviewOutboxData => ({ items: [], confirmed: {} });

/** One durable record contains both acknowledgements and pending operations. */
export function createReviewOutbox(options: {
  read: () => ReviewOutboxData;
  write: (data: ReviewOutboxData) => void;
  lock: <T>(name: string, work: () => Promise<T>) => Promise<T>;
  send: (items: QueuedReview[]) => Promise<SRSCard[]>;
  undo?: (item: QueuedReview) => Promise<SRSCard>;
  applyUndo?: (item: QueuedReview, restored: SRSCard) => Promise<SRSCard | void> | SRSCard | void;
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
      if (data.undo) throw new Error('Đang hoàn tác lượt ôn. Vui lòng đợi.');
      if (!data.items.some(value => value.id === item.id)) data.items.push(item);
    }),
    requestUndo: (item: QueuedReview) => mutate(data => {
      if (data.lastUndo?.id === item.id) return;
      if (data.undo) {
        if (data.undo.item.id !== item.id) throw new Error('Đang hoàn tác một lượt khác.');
        return;
      }
      const index = data.items.findIndex(value => value.id === item.id);
      if (data.items.some((value, i) => (index < 0 || i > index) && reviewKey(value.source, value.card) === reviewKey(item.source, item.card)))
        throw new Error('Thẻ đã có lượt ôn mới hơn. Không thể hoàn tác lượt này.');
      const local = index >= 0 && !data.items[index].attempted;
      data.undo = { item, local };
      if (local) data.items.splice(index, 1);
    }),
    drain() {
      if (flight) return flight;
      flight = options.lock('sender', async () => {
        while (options.active()) {
          const pending = options.read().undo;
          if (pending && (pending.local || !options.read().items.some(item => item.id === pending.item.id))) {
            let restored = pending.result;
            if (!restored) {
              if (!pending.local && !options.undo) throw new Error('Chưa hỗ trợ hoàn tác trên máy chủ.');
              restored = pending.local ? pending.item.card : await options.undo!(pending.item);
              const result = restored;
              await mutate(data => { if (data.undo?.item.id === pending.item.id) data.undo.result = result; });
            }
            const applied = await options.applyUndo?.(pending.item, restored);
            if (applied) restored = applied;
            const result = restored;
            await mutate(data => {
              const key = reviewKey(pending.item.source, pending.item.card);
              data.confirmed[key] = result;
              data.reverted ??= {};
              data.reverted[key] = pending.item.optimistic.lastReviewedAt ?? pending.item.timing.ratedAt ?? new Date().toISOString();
              data.lastUndo = { id: pending.item.id, card: result };
              delete data.undo;
            });
            continue;
          }
          // Claim before I/O under the same lock used by cancellation. Once claimed,
          // a lost response must be resolved by replaying its immutable UUID.
          const batch = await mutate(data => {
            const items = data.items;
            const selected = items[0]?.source === 'BUILT_IN'
              ? items.slice(0, 20).filter((_, index, all) => all.slice(0, index + 1).every(value => value.source === 'BUILT_IN'))
              : items.slice(0, 1);
            selected.forEach(item => { item.attempted = true; });
            return selected;
          });
          if (!batch.length) return;
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
  const cutoff = data.reverted?.[key];
  // A server-confirmed rollback may legitimately have fewer reps than an old
  // cached prop. Keep that stale prop from resurrecting the canceled review.
  const input = cutoff && (!card.lastReviewedAt || Date.parse(card.lastReviewedAt) <= Date.parse(cutoff))
    ? data.confirmed[key] ?? card : card;
  const candidates = [input, data.confirmed[key], ...data.items
    .filter(item => reviewKey(item.source, item.card) === key).map(item => item.optimistic)]
    .filter((value): value is SRSCard => Boolean(value));
  return candidates.reduce((latest, value) => value.reps >= latest.reps ? value : latest);
}
