import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type AppDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function AppDialog({ open, title, onClose, children, className = '' }: AppDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => dialog.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]')?.focus());
    return () => {
      document.body.style.overflow = '';
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} className={`m-auto w-[min(92vw,34rem)] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-2xl backdrop:bg-black/40 ${className}`}
      aria-labelledby="app-dialog-title" onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
        <h2 id="app-dialog-title" className="text-lg font-semibold">{title}</h2>
        <button className="study-button !min-h-10 !w-10 !p-0" onClick={onClose} aria-label="Đóng"><X size={18}/></button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
