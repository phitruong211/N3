import { useEffect, useRef, useState } from 'react';
import { ApiError, reviewCard } from '@/lib/api';
import { reviewBuiltInBatch } from '@/lib/learningSync';
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
    changed: () => { setData(storage.getJSON(REVIEW_OUTBOX_KEY, emptyOutbox())); },
    send: async items => {
      if (items[0].source === 'BUILT_IN') {
        return syncRef.current.syncReviews(() => reviewBuiltInBatch(items));
      }
      const item = items[0];
      const saved = await reviewCard(item.card.cardId, item.rating, item.id, item.responseTimeMs, item.timing, item.card.reps);
      return [{ ...saved, deckType: item.card.deckType }];
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
    data, error, pending: data.items.length,
    retry: () => wake.current(),
    project: (source: string, card: QueuedReview['card']) => projectedReview(data, source, card),
    enqueue: async (item: QueuedReview) => {
      await engine.enqueue(item);
      wake.current();
    },
  };
}
