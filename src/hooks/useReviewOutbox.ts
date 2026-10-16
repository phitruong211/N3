import { useEffect, useRef, useState } from 'react';
import { ApiError, apiRequest, progressToSrs, reviewCard, type ApiProgress } from '@/lib/api';
import { reviewBuiltInBatch, undoBuiltInReview } from '@/lib/learningSync';
import { createReviewOutbox, emptyOutbox, projectedReview, REVIEW_OUTBOX_KEY, type QueuedReview, type ReviewOutboxData } from '@/lib/reviewOutbox';
import type { LearningStorage } from '@/lib/storage';
import type { useLearningSync } from './useLearningSync';

export function useReviewOutbox(storage: LearningStorage, enabled: boolean, sync: ReturnType<typeof useLearningSync>) {
  const [data, setData] = useState(() => storage.getJSON<ReviewOutboxData>(REVIEW_OUTBOX_KEY, emptyOutbox()));
  const [error, setError] = useState('');
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const active = useRef(false);
  const wake = useRef<() => void>(() => {});
  const [engine] = useState(() => createReviewOutbox({
    read: () => storage.getJSON<ReviewOutboxData>(REVIEW_OUTBOX_KEY, emptyOutbox()),
    write: value => storage.setJSONStrict(REVIEW_OUTBOX_KEY, value),
    lock: (name, work) => navigator.locks
      ? navigator.locks.request(`${storage.scope}:review:${name}`, work)
      : work(),
    active: () => active.current,
    isUnsupportedUndo: reason => reason instanceof ApiError && reason.status === 409
      && reason.message === 'Lượt ôn cũ không hỗ trợ hoàn tác',
    changed: () => { setData(storage.getJSON(REVIEW_OUTBOX_KEY, emptyOutbox())); },
    send: async items => {
      if (items[0].source === 'BUILT_IN') {
        return syncRef.current.syncReviews(() => reviewBuiltInBatch(items));
      }
      const item = items[0];
      const saved = await reviewCard(item.card.cardId, item.rating, item.id, item.responseTimeMs, item.timing, item.card.reps);
      return [{ ...saved, deckType: item.card.deckType }];
    },
    undo: async (item) => {
      if (item.source === 'BUILT_IN') return undoBuiltInReview(item);
      const result = await apiRequest<{ progress: ApiProgress }>(`/anki/cards/${item.card.cardId}/reviews/${item.id}/undo`, { method: 'POST' });
      return { ...progressToSrs(item.card.cardId, result.progress), deckType: item.card.deckType };
    },
    applyUndo: async (item, restored) => {
      if (item.activity) storage.undoReviewActivity(item.id, item.activity);
      if (item.source === 'BUILT_IN') {
        const localOnly = storage.getJSON<ReviewOutboxData>(REVIEW_OUTBOX_KEY, emptyOutbox()).undo?.local;
        if (localOnly) {
          syncRef.current.restoreLocalReview(restored);
          return restored;
        }
        const cards = await syncRef.current.syncReviews(async () => {
          const { getLearningState } = await import('@/lib/learningSync');
          const state = await getLearningState();
          const effective = state.srsCards.find(card => card.cardId === restored.cardId && card.deckType === restored.deckType) ?? restored;
          return { state, cards: [effective] };
        }, true);
        return cards[0];
      }
    },
  }));
  useEffect(() => {
    active.current = enabled && sync.initialized;
    if (!active.current) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let stopped = false;
    const run = () => {
      if (stopped) return;
      clearTimeout(timer);
      setError('');
      void engine.drain().then(() => {
        if (stopped) return;
        failures = 0;
        setError('');
        void syncRef.current.flush().catch(() => {});
      }).catch((reason: unknown) => {
        if (stopped) return;
        setError(reason instanceof Error ? reason.message : 'Chưa đồng bộ được lượt ôn.');
        if (reason instanceof ApiError && reason.status >= 400 && reason.status < 500 && ![408, 429].includes(reason.status)) return;
        timer = setTimeout(run, Math.min(30_000, 2_000 * 2 ** Math.min(failures++, 4)));
      });
    };
    wake.current = run;
    const changed = (event: StorageEvent) => {
      if (event.key !== `${storage.scope}:${REVIEW_OUTBOX_KEY}`) return;
      setData(storage.getJSON(REVIEW_OUTBOX_KEY, emptyOutbox()));
      run();
    };
    window.addEventListener('online', run);
    window.addEventListener('storage', changed);
    run();
    return () => {
      stopped = true;
      active.current = false;
      clearTimeout(timer);
      wake.current = () => {};
      window.removeEventListener('online', run);
      window.removeEventListener('storage', changed);
    };
  }, [enabled, sync.initialized, engine, storage]);
  return {
    data, error, pending: data.items.length, undoPending: Boolean(data.undo),
    retry: () => wake.current(),
    project: (source: string, card: QueuedReview['card']) => projectedReview(data, source, card),
    enqueue: async (item: QueuedReview) => {
      await engine.enqueue(item);
      wake.current();
    },
    undo: async (item: QueuedReview) => {
      if (!active.current) throw new Error('Chưa sẵn sàng đồng bộ. Vui lòng thử lại.');
      await engine.requestUndo(item);
      // Use the background runner too so a failed undo gets the same error
      // reporting and reconnect/backoff recovery as a queued review.
      wake.current();
      await engine.drain();
      const latest = storage.getJSON<ReviewOutboxData>(REVIEW_OUTBOX_KEY, emptyOutbox());
      if (latest.rejectedUndo?.item.id === item.id) throw new Error(latest.rejectedUndo.message);
      const result = latest.lastUndo;
      if (result?.id !== item.id) throw new Error('Chưa hoàn tất hoàn tác. Vui lòng thử lại.');
      return result.card;
    },
  };
}
