import { useEffect, useRef, useState } from 'react';
import { EllipsisVertical } from 'lucide-react';

export type DeckAction = { id: string; label: string; destructive?: boolean; disabled?: boolean; onSelect: () => void };

export function OverflowMenu({ label = 'Mở menu', actions }: { label?: string; actions: DeckAction[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); };
  }, [open]);
  return <div ref={root} className="relative">
    <button ref={trigger} className="study-button !min-h-9 !w-9 !p-0" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><EllipsisVertical size={18}/></button>
    {open && <div role="menu" className="absolute right-0 top-11 z-20 min-w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl">
      {actions.map(action => <button key={action.id} role="menuitem" disabled={action.disabled} className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-[var(--color-surface-hover)] disabled:opacity-40 ${action.destructive ? 'text-[var(--color-error)]' : ''}`} onClick={() => { action.onSelect(); setOpen(false); }}>{action.label}</button>)}
    </div>}
  </div>;
}
