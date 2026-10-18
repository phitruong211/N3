import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, EllipsisVertical } from 'lucide-react';

export type DeckAction = { id: string; label: string; destructive?: boolean; disabled?: boolean; onSelect: () => void };

type Props = { label?: string; actions: DeckAction[]; horizontal?: boolean; triggerContent?: ReactNode; disabled?: boolean; menuClassName?: string; compact?: boolean };

export function OverflowMenu({ label = 'Mở menu', actions, horizontal, triggerContent, disabled, menuClassName = '', compact }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = (restore = false) => { setOpen(false); if (restore) trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      const box = menu.current?.getBoundingClientRect();
      if (!anchor || !box) return;
      setPosition({ left: Math.max(8, Math.min(anchor.right - box.width, innerWidth - box.width - 8)),
        top: Math.max(8, anchor.bottom + box.height + 8 <= innerHeight ? anchor.bottom + 6 : anchor.top - box.height - 6) });
    };
    place();
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', escape); };
  }, [open]);
  return <>
    <button ref={trigger} type="button" disabled={disabled} className={`study-button ${triggerContent ? 'study-button-primary' : compact ? '!min-h-9 !w-9 !p-0' : '!min-h-11 !w-11 !p-0'}`}
      aria-label={label} aria-haspopup="menu" aria-controls={open ? id : undefined} aria-expanded={open}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); } }}
      onClick={() => setOpen(value => !value)}>{triggerContent ?? (horizontal ? <Ellipsis size={20}/> : <EllipsisVertical size={18}/>)}</button>
    {open && createPortal(<div ref={menu} id={id} role="menu" aria-label={label}
      className={`fixed z-[1100] min-w-52 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl ${menuClassName}`}
      style={position} onKeyDown={event => {
        const items = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items[next]?.focus();
        } else if (event.key === 'Tab') { close(true); }
      }}>
      {actions.map(action => <button key={action.id} type="button" role="menuitem" disabled={action.disabled}
        className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-[var(--color-surface-hover)] focus-visible:bg-[var(--color-surface-hover)] disabled:opacity-40 ${action.destructive ? 'mt-1 border-t border-[var(--color-border)] text-[var(--color-error)]' : ''}`}
        onClick={() => { close(true); action.onSelect(); }}>{action.label}</button>)}
    </div>, document.body)}
  </>;
}
