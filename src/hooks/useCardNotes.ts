import { useEffect, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { createCardNotesStore, type CardNote } from '@/lib/cardNotes';
import type { LearningStorage } from '@/lib/storage';

export function useCardNotes(storage: LearningStorage, enabled: boolean) {
  const store = useMemo(() => createCardNotesStore(storage, enabled ? {
    get: key => apiRequest<CardNote>(`/card-notes/${key}`),
    put: (key, text, version) => apiRequest<CardNote>(`/card-notes/${key}`, { method: 'PUT', body: JSON.stringify({ text, version }) }),
  } : undefined), [storage, enabled]);
  useEffect(() => {
    store.start();
    const refresh = () => store.retryAll();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => { store.stop(); window.clearInterval(timer); window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
  }, [store]);
  return store;
}
