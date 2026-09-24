import { useEffect, useRef, useState } from 'react';
import { ListOrdered, Play, Shuffle, X } from 'lucide-react';

export interface ShuffleConfig {
  mode: 'sequential' | 'shuffle';
  rangeEnd: number;
}

export function ShuffleLaunchModal({
  deckName,
  totalCards,
  onStart,
  onCancel,
}: {
  deckName: string;
  totalCards: number;
  onStart: (config: ShuffleConfig) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'sequential' | 'shuffle'>('sequential');
  const [rangeEnd, setRangeEnd] = useState(totalCards);
  const [inputVal, setInputVal] = useState(String(totalCards));
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, input');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, [onCancel]);

  const handleRangeInput = (value: string) => {
    setInputVal(value);
    const count = parseInt(value, 10);
    if (!Number.isNaN(count) && count >= 1 && count <= totalCards) setRangeEnd(count);
  };

  const visibleCount = Math.min(Math.max(parseInt(inputVal, 10) || 1, 1), totalCards);
  const handleStart = () => {
    const count = parseInt(inputVal, 10);
    onStart({ mode, rangeEnd: Number.isNaN(count) || count < 1 ? 1 : Math.min(count, totalCards) });
  };

  return <div
    className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    role="presentation"
    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    onClick={event => { if (event.target === event.currentTarget) onCancel(); }}
  >
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Bắt đầu ${deckName}`} className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-1">Bắt đầu học</div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">{deckName}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{totalCards} thẻ trong bộ</p>
        </div>
        <button onClick={onCancel} aria-label="Đóng" className="study-button"><X size={18}/></button>
      </div>
      <div className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Chế độ</div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setMode('sequential')} className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'sequential' ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]' : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'}`}>
            <ListOrdered size={22}/><div className="text-center"><div className="font-bold text-sm">Tuần tự</div><div className="text-[11px] opacity-70 mt-0.5">Từ 1 → {rangeEnd}</div></div>
          </button>
          <button onClick={() => setMode('shuffle')} className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${mode === 'shuffle' ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]' : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'}`}>
            <Shuffle size={22}/><div className="text-center"><div className="font-bold text-sm">Ngẫu nhiên</div><div className="text-[11px] opacity-70 mt-0.5">Ngẫu nhiên 1–{rangeEnd}</div></div>
          </button>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Phạm vi thẻ</div><span className="text-xs font-mono text-[var(--color-text-secondary)]">1 → <strong className="text-[var(--color-text)]">{visibleCount}</strong> / {totalCards}</span></div>
        <input type="range" min={1} max={totalCards} value={visibleCount} onChange={event => handleRangeInput(event.target.value)} className="w-full h-2 rounded-full accent-[var(--color-accent)] cursor-pointer"/>
        <div className="flex items-center gap-3"><span className="text-sm text-[var(--color-text-secondary)]">Đến thẻ thứ</span><input type="number" min={1} max={totalCards} value={inputVal} onChange={event => handleRangeInput(event.target.value)} aria-label="Số thẻ muốn học" className="study-input !w-24 text-center"/><button onClick={() => handleRangeInput(String(totalCards))} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] underline cursor-pointer transition-colors">Tất cả</button></div>
      </div>
      <button onClick={handleStart} className="study-button study-button-primary w-full">
        {mode === 'shuffle' ? <Shuffle size={18}/> : <Play size={18}/>}<span>{mode === 'shuffle' ? `Học ngẫu nhiên ${visibleCount} thẻ` : `Bắt đầu ${visibleCount} thẻ`}</span>
      </button>
    </div>
  </div>;
}
