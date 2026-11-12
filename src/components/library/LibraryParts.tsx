import type { ReactNode } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import { LEARN_LABEL, LEARN_STATES, type LearnState } from '@/lib/learnState';

/** A small mark of where the learner is with an item: hollow when new, gold while learning, green once known. */
export function LearnDot({ state, decorative = false }: { state: LearnState; decorative?: boolean }) {
  if (decorative) return <span className="learn-dot" data-state={state} aria-hidden="true"/>;
  return <span className="learn-dot" data-state={state} title={LEARN_LABEL[state]}><span className="sr-only">{LEARN_LABEL[state]}</span></span>;
}

/** "All · not started · learning · known" with counts, so a learner can go straight to what they have not done. */
export function LearnFilter({ value, counts, onChange }: { value: LearnState | 'all'; counts: Record<LearnState, number>; onChange: (next: LearnState | 'all') => void }) {
  const total = counts.new + counts.learning + counts.known;
  return <div className="learn-filter" role="group" aria-label="Lọc theo tiến độ">
    {(['all', ...LEARN_STATES] as const).map(key => <button key={key} type="button" className="hit" aria-pressed={value === key} onClick={() => onChange(key)}>
      {key !== 'all' && <LearnDot state={key} decorative/>}
      {key === 'all' ? 'Tất cả' : LEARN_LABEL[key]} <span className="tabular-nums">{(key === 'all' ? total : counts[key]).toLocaleString('vi-VN')}</span>
    </button>)}
  </div>;
}

/**
 * The item detail: beside the list on wide screens, a sheet over it on phones, so picking an item never scrolls the
 * list away and closing the sheet lands back where you were.
 */
export function DetailPane({ wide, open, title, onClose, children }: { wide: boolean; open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (wide) return <>{children}</>;
  return <AppDialog open={open} title={title} onClose={onClose} className="library-sheet">{children}</AppDialog>;
}
