import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { LearningStorage } from '@/lib/storage';

type Size = { width: number; height: number };
type Sizes = Record<string, Size>;
const KEY = 'deck-group-sizes-v1';
export function useDeckGroupSizes(storage?: Pick<LearningStorage, 'getJSON' | 'setJSON'>) {
  const [sizes, setSizes] = useState<Sizes>(() => {
    const saved = storage?.getJSON<Sizes>(KEY, {}) ?? {};
    return Object.fromEntries(Object.entries(saved).filter(([, size]) => size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0));
  });
  const [resizing, setResizing] = useState<string | null>(null);
  const current = useRef(sizes); current.current = sizes;
  const cleanup = useRef<() => void>(() => {});
  useEffect(() => () => cleanup.current(), []);
  const persist = useCallback((next: Sizes) => { current.current = next; setSizes(next); storage?.setJSON(KEY, next); }, [storage]);
  const reset = (id: string) => { const next = { ...current.current }; delete next[id]; persist(next); };
  const prune = useCallback((ids: Set<string>) => {
    const next = Object.fromEntries(Object.entries(current.current).filter(([id]) => ids.has(id)));
    if (Object.keys(next).length !== Object.keys(current.current).length) persist(next);
  }, [persist]);
  function bounds(element: HTMLElement, width: number, height: number): Size {
    const max = element.parentElement!.clientWidth;
    return { width: Math.round(Math.max(Math.min(300, max), Math.min(width, max))), height: Math.round(Math.max(260, Math.min(height, 1600))) };
  }
  function begin(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); cleanup.current();
    const handle = event.currentTarget;
    const element = handle.closest<HTMLElement>('.deck-folder')!;
    const original = current.current;
    const rect = element.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY };
    const pointerId = event.pointerId;
    let nextSize = { width: rect.width, height: rect.height };
    const cursor = document.body.style.cursor, select = document.body.style.userSelect;
    document.body.style.cursor = 'nwse-resize'; document.body.style.userSelect = 'none';
    setResizing(id); handle.setPointerCapture(pointerId);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault(); nextSize = bounds(element, rect.width + e.clientX - start.x, rect.height + e.clientY - start.y);
      setSizes({ ...original, [id]: nextSize });
    };
    const finish = (save: boolean) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      document.body.style.cursor = cursor; document.body.style.userSelect = select;
      setResizing(null); if (save) persist({ ...original, [id]: nextSize }); else { current.current = original; setSizes(original); }
      cleanup.current = () => {};
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) finish(true); };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', cancel);
    cleanup.current = cancel;
  }
  function keyboard(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const element = event.currentTarget.closest<HTMLElement>('.deck-folder')!;
    const rect = element.getBoundingClientRect(); const step = event.shiftKey ? 40 : 10;
    persist({ ...current.current, [id]: bounds(element, rect.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), rect.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)) });
  }
  return { sizes, resizing, begin, keyboard, reset, prune };
}
