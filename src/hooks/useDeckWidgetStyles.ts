import { useCallback, useRef, useState } from 'react';
import type { LearningStorage } from '@/lib/storage';
import { DECK_WIDGETS_KEY, normalizeWidgetStyle, readWidgetStyles, type DeckWidgetStyle } from '@/lib/deckWidgets';

export function useDeckWidgetStyles(storage?: Pick<LearningStorage, 'getJSON' | 'setJSON'>) {
  const [styles, setStyles] = useState(() => { try { return readWidgetStyles(storage?.getJSON(DECK_WIDGETS_KEY, {})); } catch { return {}; } });
  const current = useRef(styles); current.current = styles;
  const persist = useCallback((next: Record<string, DeckWidgetStyle>) => {
    current.current = next; setStyles(next);
    try { storage?.setJSON(DECK_WIDGETS_KEY, next); } catch { /* UI remains usable if browser storage is unavailable. */ }
  }, [storage]);
  const update = (id: string, patch: Partial<DeckWidgetStyle>) => {
    persist({ ...current.current, [id]: normalizeWidgetStyle({ ...normalizeWidgetStyle(current.current[id]), ...patch }) });
  };
  const reset = (id: string) => { const next = { ...current.current }; delete next[id]; persist(next); };
  const prune = useCallback((ids: Set<string>) => {
    const next = Object.fromEntries(Object.entries(current.current).filter(([id]) => ids.has(id)));
    if (Object.keys(next).length !== Object.keys(current.current).length) persist(next);
  }, [persist]);
  return { styles, update, reset, prune };
}
