import { useCallback, useRef, useState } from 'react';
import type { LearningStorage } from '@/lib/storage';
import { DECK_WIDGETS_KEY, normalizeWidgetStyle, readWidgetStyles, sizeFromPixels, type DeckWidgetStyle } from '@/lib/deckWidgets';

/** Pixel sizes saved before widgets snapped to fixed tiers. */
const LEGACY_SIZES_KEY = 'deck-group-sizes-v1';
type LegacySizes = Record<string, { width?: number; height?: number }>;

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
  /** One-time: turn legacy pixel sizes into the nearest tier, then empty the old key. */
  const migrateLegacySizes = useCallback((metrics: { cell: number; gap: number; columns: number }) => {
    let legacy: LegacySizes | undefined;
    try { legacy = storage?.getJSON<LegacySizes>(LEGACY_SIZES_KEY, {}); } catch { return; }
    const entries = Object.entries(legacy ?? {}).filter(([, size]) => size && Number.isFinite(size.width) && Number.isFinite(size.height));
    if (!entries.length) return;
    const next = { ...current.current };
    for (const [id, size] of entries) next[id] = normalizeWidgetStyle({ ...normalizeWidgetStyle(next[id]), size: sizeFromPixels(size.width!, size.height!, metrics.cell, metrics.gap, metrics.columns) });
    persist(next);
    try { storage?.setJSON(LEGACY_SIZES_KEY, {}); } catch { /* A stale key only re-runs this harmless conversion. */ }
  }, [storage, persist]);
  return { styles, update, reset, prune, migrateLegacySizes };
}
