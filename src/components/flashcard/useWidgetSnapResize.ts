import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { WIDGET_SIZES, snapWidgetSize, type WidgetSize } from '@/lib/deckWidgets';

export type GridMetrics = { cell: number; gap: number; columns: number };

/** Read the live square grid from layout so snapping always matches what is on screen. */
export function readGridMetrics(grid: HTMLElement | null): GridMetrics | null {
  if (!grid) return null;
  const style = getComputedStyle(grid);
  const tracks = style.gridTemplateColumns.split(' ').map(parseFloat).filter(Number.isFinite);
  const gap = parseFloat(style.columnGap) || 0;
  return tracks.length && tracks[0] > 0 ? { cell: tracks[0], gap, columns: tracks.length } : null;
}

/** Dragging the corner moves between fixed size tiers; the widget itself is the live preview. */
export function useWidgetSnapResize(grid: { current: HTMLElement | null }, commit: (id: string, size: WidgetSize) => void) {
  const [preview, setPreview] = useState<{ id: string; size: WidgetSize } | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const save = useRef(commit); save.current = commit;
  useEffect(() => () => cleanup.current(), []);

  const begin = useCallback((event: ReactPointerEvent<HTMLButtonElement>, id: string, current: WidgetSize) => {
    if (event.button !== 0) return;
    const metrics = readGridMetrics(grid.current);
    const element = event.currentTarget.closest<HTMLElement>('.deck-folder');
    if (!metrics || !element) return;
    event.preventDefault(); event.stopPropagation(); cleanup.current();
    const handle = event.currentTarget, pointerId = event.pointerId;
    const rect = element.getBoundingClientRect(), start = { x: event.clientX, y: event.clientY };
    const cursor = document.body.style.cursor, select = document.body.style.userSelect;
    let size = current;
    document.body.style.cursor = 'nwse-resize'; document.body.style.userSelect = 'none';
    handle.setPointerCapture(pointerId); setPreview({ id, size });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault();
      const next = snapWidgetSize((rect.width + e.clientX - start.x + metrics.gap) / (metrics.cell + metrics.gap),
        (rect.height + e.clientY - start.y + metrics.gap) / (metrics.cell + metrics.gap), metrics.columns);
      if (next !== size) { size = next; setPreview({ id, size }); }
    };
    const finish = (apply: boolean) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      document.body.style.cursor = cursor; document.body.style.userSelect = select;
      setPreview(null); cleanup.current = () => {};
      if (apply && size !== current) save.current(id, size);
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) finish(true); };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', cancel);
    cleanup.current = cancel;
  }, [grid]);

  /** Right/Down grow one tier, Left/Up shrink one tier. */
  const keyboard = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>, id: string, current: WidgetSize) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = WIDGET_SIZES[Math.max(0, Math.min(WIDGET_SIZES.length - 1, WIDGET_SIZES.indexOf(current) + step))];
    if (next !== current) save.current(id, next);
  }, []);

  return { resizing: preview?.id ?? null, preview, begin, keyboard };
}
