import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NotebookPen, X, Check, LockKeyhole, Download, ChevronDown } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { cardNoteKey, exportCardWithNote, CARD_NOTE_LIMIT, type CardNotesStore, type NoteEntry } from '@/lib/cardNotes';
import type { CardView } from '@/lib/cards';
import './personalCardNote.css';

export function useStudyNote(card: CardView | undefined) {
  const { cardNotes } = useApp();
  const entries = useSyncExternalStore(cardNotes.subscribe, cardNotes.getSnapshot);
  const [identity, setIdentity] = useState<{ cardId: string; key: string } | null>(null);
  const [open, setOpen] = useState(false);
  const token = card ? `${card.source}:${card.deckId}:${card.id}` : '';
  useEffect(() => {
    let active = true;
    setOpen(false);
    if (card) void cardNoteKey(card).then(key => {
      if (!active) return;
      setIdentity({ cardId: token, key }); cardNotes.ensure(key);
    });
    return () => { active = false; };
  // Card IDs stay stable during personal content edits; the original built-in content is read-only.
  }, [token, cardNotes]); // eslint-disable-line react-hooks/exhaustive-deps
  const key = identity?.cardId === token ? identity.key : null;
  return { store: cardNotes, key, entry: key ? entries[key] : undefined, open, setOpen };
}

export function NoteButton({ note }: { note: ReturnType<typeof useStudyNote> }) {
  return <button type="button" className="study-button note-toolbar-button !min-h-10 !px-3" aria-label="Ghi chú cá nhân" title="Ghi chú (N)" disabled={!note.key} onClick={() => note.setOpen(true)}>
    <NotebookPen size={17}/><span className="hidden sm:inline">Ghi chú</span>{(note.entry?.text || note.key && note.store.draft(note.key)) && <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" aria-label="Đã có ghi chú hoặc bản nháp"/>}
  </button>;
}

const statusText = (entry: NoteEntry | undefined) => entry?.status === 'local' ? 'Đã lưu trên thiết bị này'
  : entry?.status === 'saved' ? 'Đã đồng bộ' : entry?.status === 'loading' ? 'Đang tải ghi chú…'
  : entry?.status === 'conflict' ? 'Có thay đổi trên thiết bị khác' : entry?.status === 'error' ? 'Đã lưu trên thiết bị · Chờ đồng bộ' : 'Đang đồng bộ…';

export function PersonalNoteView({ note }: { note: ReturnType<typeof useStudyNote> }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [note.key]);
  if (!note.entry?.text && note.entry?.status !== 'conflict') return null;
  return <aside aria-label="Ghi chú của tôi" className="personal-note" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><NotebookPen size={15} aria-hidden="true"/>Ghi chú của tôi</h3><button className="note-text-action" onClick={() => note.setOpen(true)}>Sửa</button></div>
    <p className={`mt-2 whitespace-pre-wrap break-words text-base leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>{note.entry.text || 'Đã xóa ghi chú trên thiết bị này.'}</p>
    {(note.entry.text.length > 160 || note.entry.text.split('\n').length > 3) && <button className="note-text-action mt-1" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Thu gọn' : 'Xem thêm'}</button>}
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-tertiary)]"><span className="note-status" data-state={note.entry.status} role="status">{statusText(note.entry)}</span>
      {note.entry.status === 'error' && <button className="text-[var(--color-accent)]" onClick={() => { if (note.key) void note.store.retry(note.key); }}>Thử đồng bộ lại</button>}
      {note.entry.status === 'conflict' && <button className="text-[var(--color-accent)]" onClick={() => note.setOpen(true)}>Xem hai bản</button>}
    </div>
  </aside>;
}

export function PersonalNoteEditor({ note, card }: { note: ReturnType<typeof useStudyNote>; card: CardView }) {
  if (!note.open || !note.key) return null;
  return <NoteEditor key={note.key} store={note.store} noteKey={note.key} entry={note.entry} card={card} onClose={() => note.setOpen(false)}/>;
}

function NoteEditor({ store, noteKey, entry, card, onClose }: { store: CardNotesStore; noteKey: string; entry?: NoteEntry; card: CardView; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const initial = store.draft(noteKey)?.text ?? entry?.text ?? '';
  const [text, setText] = useState(initial);
  const [error, setError] = useState('');
  const [includePersonalNotes, setIncludePersonalNotes] = useState(false);
  const [touched, setTouched] = useState(Boolean(store.draft(noteKey)));
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current; element?.showModal(); input.current?.focus();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  useEffect(() => { if (!touched && !store.draft(noteKey)) setText(entry?.text ?? ''); }, [entry?.text, touched, store, noteKey]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      dialog.current?.style.setProperty('--note-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      dialog.current?.style.setProperty('--note-viewport-top', `${viewport?.offsetTop ?? 0}px`);
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); };
  }, []);
  function edit(value: string) {
    setText(value); setTouched(true);
    try { store.writeDraft(noteKey, value); setError(''); } catch (reason) { setError((reason as Error).message); }
  }
  function save() {
    try { store.save(noteKey, text); setError(''); if (store.getSnapshot()[noteKey].status !== 'conflict') onClose(); }
    catch (reason) { setError((reason as Error).message); }
  }
  function close() {
    try { if (touched) store.writeDraft(noteKey, text); onClose(); }
    catch (reason) { setError((reason as Error).message); }
  }
  function exportCard() {
    const file = new Blob([JSON.stringify([exportCardWithNote(card, text, includePersonalNotes)], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file); const link = document.createElement('a'); link.href = url; link.download = 'the-hoc.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <dialog ref={dialog} className="personal-note-dialog" aria-labelledby="personal-note-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form className="note-editor-form" onSubmit={event => { event.preventDefault(); save(); }} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); save(); } }}>
      <header className="note-editor-header">
        <div className="note-editor-heading"><span className="note-editor-icon"><NotebookPen size={20} aria-hidden="true"/></span><div><h2 id="personal-note-title" className="text-lg font-semibold">Ghi chú của tôi</h2><p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]"><LockKeyhole size={11} aria-hidden="true"/>Riêng tư · Theo thẻ ở mọi lần học</p></div></div>
        <button type="button" className="study-button note-close-button" aria-label="Đóng ghi chú" onClick={close}><X size={18}/></button>
      </header>
      <div className="note-editor-body">
        <div className="note-card-context"><span className="study-eyebrow">THẺ ĐANG HỌC</span><p className="font-jp mt-1 line-clamp-2 break-words text-lg font-medium">{card.front}</p>{card.reading && card.reading !== card.front && <p className="font-jp mt-1 line-clamp-1 text-xs text-[var(--color-text-secondary)]">{card.reading}</p>}</div>
        <div className="mt-4 flex items-baseline justify-between gap-3"><label htmlFor="personal-note-text" className="text-sm font-medium">Ghi chú cá nhân</label><span className="note-character-count" data-near-limit={text.length >= CARD_NOTE_LIMIT * 0.9 || undefined}>{text.length.toLocaleString('vi-VN')} / 5.000</span></div>
        <textarea ref={input} id="personal-note-text" className="study-input note-textarea" rows={6} maxLength={CARD_NOTE_LIMIT} value={text} onChange={event => edit(event.target.value)} placeholder="Mẹo nhớ, lỗi hay nhầm hoặc ví dụ của bạn…" aria-describedby="note-draft-status"/>
        <p id="note-draft-status" className="note-status mt-2" data-state={error ? 'error' : touched ? 'local' : entry?.status} role="status">{error ? 'Chưa lưu được bản nháp' : touched ? 'Bản nháp đã giữ trên thiết bị' : statusText(entry)}</p>
        {entry?.remote && <div role="alert" className="note-conflict"><p className="font-semibold">Có bản mới trên thiết bị khác</p><p className="mt-3 text-xs text-[var(--color-text-secondary)]">Bản trên máy chủ</p><p className="note-remote-text">{entry.remote.text || '(Đã xóa)'}</p>
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">Bản của bạn ở ô nhập bên trên. Có thể kết hợp hai bản rồi chọn bản muốn giữ.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" className="study-button justify-center" onClick={() => { try { store.resolve(noteKey, false); onClose(); } catch (reason) { setError((reason as Error).message); } }}>Dùng bản trên máy chủ</button><button type="button" className="study-button justify-center" onClick={() => { try { store.save(noteKey, text); store.resolve(noteKey, true); onClose(); } catch (reason) { setError((reason as Error).message); } }}>Giữ bản của tôi</button></div>
        </div>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
        <details className="note-export"><summary><span className="flex items-center gap-2"><Download size={14} aria-hidden="true"/>Xuất thẻ này</span><ChevronDown size={15} aria-hidden="true"/></summary><label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={includePersonalNotes} onChange={event => setIncludePersonalNotes(event.target.checked)}/>Kèm ghi chú của tôi</label><button type="button" className="study-button" onClick={exportCard}>Tải thẻ (.json)</button></details>
      </div>
      <footer className="note-editor-footer"><p className="note-keyboard-hint">Lưu nhanh <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd></p><div className="note-editor-actions"><button type="button" className="study-button justify-center" onClick={close}>Để sau</button><button type="submit" className="study-button study-button-primary justify-center" disabled={Boolean(entry?.remote)}><Check size={16} aria-hidden="true"/>Lưu ghi chú</button></div></footer>
    </form>
  </dialog>;
}
