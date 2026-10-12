import { useEffect, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Folder, FolderOpen, FolderPlus, GripVertical, X } from 'lucide-react';
import {
  listDeckGroups, listDeckPage, createDeckGroup, renameDeckGroup, dissolveDeckGroup,
  moveDeckToGroup, orderDeckGroups, type DeckGroup, type PersonalDeck, type Page,
} from '@/lib/deckApi';
import './deckGroups.css';

type Props = {
  rootDecks: PersonalDeck[]; reload: number; mode: 'free' | 'scheduled'; busy: boolean; reducedMotion?: boolean;
  onChange: () => void; renderDeck: (deck: PersonalDeck) => ReactNode;
};
type Target = { groupId: string | null; beforeId?: string; key: string };
type Drag = { deck: PersonalDeck; x: number; y: number };

export function DeckGroups({ rootDecks, reload, mode, busy, reducedMotion = false, onChange, renderDeck }: Props) {
  const systemReducedMotion = useReducedMotion();
  const layoutTransition = { layout: { duration: reducedMotion || systemReducedMotion ? 0 : 0.18 } };
  const [groups, setGroups] = useState<DeckGroup[]>([]);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Record<string, Page<PersonalDeck>>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [groupLoading, setGroupLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ group?: DeckGroup; name: string } | null>(null);
  const [removing, setRemoving] = useState<DeckGroup | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const epoch = useRef(0);
  const requests = useRef(new Map<string, number>());
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const openRef = useRef(opened); openRef.current = opened;
  const cleanupDrag = useRef<() => void>(() => {});
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const dialogOpen = editor !== null || removing !== null;

  useEffect(() => { alive.current = true; return () => { alive.current = false; cleanupDrag.current(); }; }, []);
  useEffect(() => {
    let valid = true;
    const generation = ++epoch.current;
    setLoading(new Set());
    setGroupLoading(true);
    listDeckGroups().then(async result => {
      if (!valid) return;
      setGroups(result);
      const ids = new Set(result.map(g => g.id));
      setOpened(current => new Set([...current].filter(id => ids.has(id))));
      setPages(current => Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id))));
      await Promise.all([...openRef.current].filter(id => ids.has(id)).map(id => loadGroup(id, pagesRef.current[id]?.number ?? 0, generation)));
    }).catch(e => { if (valid) setError(e.message); }).finally(() => { if (valid) setGroupLoading(false); });
    return () => { valid = false; };
  }, [reload, revision]);

  useEffect(() => {
    if (dialogOpen) {
      returnFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else if (dialog.current?.open) {
      dialog.current.close(); returnFocus.current?.focus();
    }
  }, [dialogOpen]);

  async function loadGroup(id: string, page = 0, generation = epoch.current) {
    const serial = (requests.current.get(id) ?? 0) + 1;
    requests.current.set(id, serial);
    setLoading(current => new Set(current).add(id));
    try {
      let result = await listDeckPage(page, 'position,asc', id);
      if (page > Math.max(0, result.totalPages - 1)) result = await listDeckPage(Math.max(0, result.totalPages - 1), 'position,asc', id);
      if (alive.current && generation === epoch.current && requests.current.get(id) === serial) setPages(current => ({ ...current, [id]: result }));
    } catch (e) {
      if (alive.current && generation === epoch.current) setError((e as Error).message);
    } finally {
      if (alive.current && generation === epoch.current && requests.current.get(id) === serial) setLoading(current => { const next = new Set(current); next.delete(id); return next; });
    }
  }
  function expand(id: string) {
    if (openRef.current.has(id)) return;
    const next = new Set(openRef.current).add(id); openRef.current = next; setOpened(next);
    void loadGroup(id);
  }
  function toggle(id: string) {
    if (!opened.has(id)) expand(id);
    else setOpened(current => { const next = new Set(current); next.delete(id); return next; });
  }
  async function mutate(action: () => Promise<void>, message: string) {
    if (locked.current || busy || groupLoading) return;
    locked.current = true; setSaving(true); setError(''); setNotice('');
    try {
      await action();
      if (alive.current) { setEditor(null); setRemoving(null); setNotice(message); onChange(); }
    } catch (e) {
      if (alive.current) { setError((e as Error).message); onChange(); }
    } finally {
      locked.current = false;
      if (alive.current) { setSaving(false); setRevision(v => v + 1); }
    }
  }
  function move(deck: PersonalDeck, groupId: string | null, beforeId?: string, append = false) {
    if (deck.id === beforeId || (!append && !beforeId && (deck.groupId ?? null) === groupId)) return;
    void mutate(() => moveDeckToGroup(deck, groupId, beforeId), groupId ? 'Đã chuyển bộ thẻ vào nhóm.' : 'Đã cập nhật vị trí bộ thẻ.');
  }
  function shiftGroup(group: DeckGroup, direction: number) {
    const ids = groups.map(g => g.id); const index = ids.indexOf(group.id); const to = index + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void mutate(() => orderDeckGroups(ids), 'Đã lưu thứ tự nhóm.');
  }
  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, deck: PersonalDeck) {
    if (busy || saving || groupLoading || event.button !== 0) return;
    cleanupDrag.current();
    const button = event.currentTarget;
    const pointerId = event.pointerId;
    const start = { x: event.clientX, y: event.clientY };
    let point = start, active = false, destination: Target | null = null;
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let previousKey: string | null = null;
    const oldCursor = document.body.style.cursor;
    const oldSelect = document.body.style.userSelect;
    const activate = () => {
      if (active) return;
      active = true; setDrag({ deck, ...point });
      document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
      frame = requestAnimationFrame(tick);
    };
    const hit = () => {
      const element = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>('[data-deck-drop]');
      const key = element?.dataset.deckDrop ?? null;
      if (key !== previousKey) {
        previousKey = key; clearTimeout(hoverTimer); setTargetKey(key);
        if (element?.dataset.groupId && !element.dataset.beforeId) {
          const id = element.dataset.groupId; hoverTimer = setTimeout(() => expand(id), 600);
        }
      }
      destination = element ? { key: key!, groupId: element.dataset.groupId || null, beforeId: element.dataset.beforeId || undefined } : null;
    };
    function tick() {
      if (!active) return;
      if (overlay.current) overlay.current.style.transform = `translate3d(${point.x + 16}px, ${point.y + 12}px, 0)`;
      const edge = 72;
      const dy = point.y < edge ? -12 : point.y > window.innerHeight - edge ? 12 : 0;
      if (dy) {
        let scrollable = document.elementFromPoint(point.x, point.y)?.parentElement;
        while (scrollable && !(scrollable.scrollHeight > scrollable.clientHeight && /auto|scroll/.test(getComputedStyle(scrollable).overflowY))) scrollable = scrollable.parentElement;
        if (scrollable) scrollable.scrollBy(0, dy); else window.scrollBy(0, dy);
      }
      hit(); frame = requestAnimationFrame(tick);
    }
    const pointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      if (!active && Math.hypot(point.x - start.x, point.y - start.y) > 7) {
        if (event.pointerType === 'touch') { finish(); return; }
        activate();
      }
      if (active) e.preventDefault();
    };
    function finish() {
      active = false; clearTimeout(pressTimer); clearTimeout(hoverTimer); cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', cancel);
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
      document.body.style.cursor = oldCursor; document.body.style.userSelect = oldSelect;
      if (alive.current) { setDrag(null); setTargetKey(null); }
    }
    const pointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const result = active ? destination : null; finish();
      if (result) move(deck, result.groupId, result.beforeId, result.key.startsWith("end:"));
    };
    const cancel = () => finish();
    const keydown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); finish(); } };
    button.setPointerCapture(pointerId);
    window.addEventListener('pointermove', pointerMove, { passive: false }); window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', keydown); window.addEventListener('blur', cancel);
    if (event.pointerType === 'touch') pressTimer = setTimeout(activate, 240);
    cleanupDrag.current = finish;
  }
  function endZone(groupId: string | null) {
    const key = `end:${groupId ?? 'root'}`;
    return <div aria-hidden={!drag} data-deck-drop={drag ? key : undefined} data-group-id={groupId ?? ''}
      className={`deck-end-zone ${drag ? "is-active" : ""} ${targetKey === key ? 'is-target' : ''}`}>
      {groupId ? 'Đặt cuối nhóm' : 'Đặt cuối danh sách'}
    </div>;
  }
  function entry(deck: PersonalDeck) {
    const groupId = deck.groupId ?? null;
    return <motion.div layout="position" transition={layoutTransition} key={deck.id} className={`deck-group-entry ${drag?.deck.id === deck.id ? 'is-dragging' : ''}`}>
      <div data-deck-drop={`before:${deck.id}`} data-group-id={groupId ?? ''} data-before-id={deck.id}
        className={`deck-insert-zone ${drag ? 'is-active' : ''} ${targetKey === `before:${deck.id}` ? 'is-target' : ''}`}><span>Thả để đặt trước bộ này</span></div>
      <div className="deck-group-tools">
        <button type="button" className="deck-drag-handle" disabled={busy || saving || groupLoading} aria-label={`Kéo bộ ${deck.name}`} onPointerDown={e => beginDrag(e, deck)}><GripVertical size={18}/></button>
        <select aria-label={`Chuyển nhóm cho ${deck.name}`} value={groupId ?? ''} disabled={busy || saving || groupLoading}
          onChange={e => move(deck, e.target.value || null)}>
          <option value="">Ngoài nhóm</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {renderDeck(deck)}
    </motion.div>;
  }
  return <div className="deck-groups-library sm:col-span-2 xl:col-span-3" aria-busy={saving}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="study-copy">Gom bộ vào nhóm để tìm và học nhanh hơn.</p>
      <button className="study-button" disabled={busy || saving || groupLoading} onClick={() => { setError(''); setEditor({ name: '' }); }}><FolderPlus size={17}/> Tạo nhóm</button>
    </div>
    {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error} <button className="underline" onClick={() => { setError(''); setRevision(v => v + 1); onChange(); }}>Thử lại</button></p>}
    <p className="sr-only" role="status">{saving ? 'Đang lưu…' : notice}</p>
    {groups.map((group, index) => <motion.section layout="position" transition={layoutTransition} key={group.id} className={`deck-folder ${targetKey === `group:${group.id}` ? 'is-target' : ''}`}
      data-deck-drop={`group:${group.id}`} data-group-id={group.id}>
      <div className="deck-folder-header">
        <button className="deck-folder-toggle" aria-expanded={opened.has(group.id)} aria-controls={`folder-${group.id}`} onClick={() => toggle(group.id)}>
          <span className="deck-folder-icon">{opened.has(group.id) ? <FolderOpen size={27}/> : <Folder size={27}/>}</span>
          <span className="min-w-0 flex-1"><strong className="block break-words">{group.name}</strong><span className="study-copy">{group.deckCount} bộ · {group.cardCount} thẻ{mode === 'scheduled' ? ` · ${group.dueCount} cần ôn` : ''}</span></span>
          <ChevronDown size={18} className={`deck-folder-chevron ${opened.has(group.id) ? 'is-open' : ''}`}/>
        </button>
        <details name="deck-group-actions" className="deck-folder-menu" onClick={e => { if ((e.target as HTMLElement).closest("button")) e.currentTarget.open = false; }}><summary aria-label={`Thao tác nhóm ${group.name}`}>•••</summary><div>
          <button disabled={saving || busy || groupLoading} onClick={() => { setError(''); setEditor({ group, name: group.name }); }}>Đổi tên</button>
          <button disabled={saving || busy || groupLoading || index === 0} onClick={() => shiftGroup(group, -1)}>Đưa lên</button>
          <button disabled={saving || busy || groupLoading || index === groups.length - 1} onClick={() => shiftGroup(group, 1)}>Đưa xuống</button>
          <button disabled={saving || busy || groupLoading} onClick={() => { setError(''); setRemoving(group); }}>Giải tán nhóm</button>
        </div></details>
      </div>
      {targetKey === `group:${group.id}` && <p className="deck-drop-hint">Thả để chuyển vào nhóm</p>}
      {opened.has(group.id) && <div id={`folder-${group.id}`} className="deck-folder-content">
        {loading.has(group.id) && <p role="status" className="study-copy">Đang tải bộ thẻ…</p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pages[group.id]?.content.map(entry)}</div>
        {endZone(group.id)}
        {!loading.has(group.id) && pages[group.id]?.totalElements === 0 && <p className="deck-empty-folder">Kéo bộ thẻ vào đây hoặc chọn nhóm từ menu trên mỗi bộ.</p>}
        {(pages[group.id]?.totalPages ?? 0) > 1 && <div className="mt-4 flex items-center justify-center gap-3">
          <button className="study-button" disabled={loading.has(group.id) || pages[group.id].number === 0} onClick={() => void loadGroup(group.id, pages[group.id].number - 1)}>Trước</button>
          <span className="study-copy">{pages[group.id].number + 1} / {pages[group.id].totalPages}</span>
          <button className="study-button" disabled={loading.has(group.id) || pages[group.id].number + 1 >= pages[group.id].totalPages} onClick={() => void loadGroup(group.id, pages[group.id].number + 1)}>Sau</button>
        </div>}
      </div>}
    </motion.section>)}
    <section className={`deck-root-zone ${!rootDecks.length && !drag ? "hidden" : ""} ${targetKey === 'root' ? 'is-target' : ''}`} data-deck-drop="root" data-group-id="">
      {(groups.length > 0 || drag) && <div className="deck-root-heading"><span>Ngoài nhóm</span>{drag && <span>Thả vào đây để đưa ra ngoài</span>}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rootDecks.map(entry)}</div>
      {endZone(null)}
    </section>
    {!busy && !groupLoading && !groups.length && !rootDecks.length && !error && <p className="study-copy">Chưa có bộ cá nhân. Chọn “Tạo bộ mới” để bắt đầu.</p>}
    <dialog ref={dialog} className="deck-group-dialog" onCancel={e => { if (saving) e.preventDefault(); else { setEditor(null); setRemoving(null); } }} aria-labelledby="deck-group-dialog-title">
      <form onSubmit={e => { e.preventDefault(); if (editor?.name.trim()) void mutate(() => editor.group ? renameDeckGroup(groups.find(g => g.id === editor.group!.id) ?? editor.group, editor.name.trim()) : createDeckGroup(editor.name.trim()), 'Đã lưu nhóm.'); }}>
        <div className="flex items-center justify-between gap-4"><h3 id="deck-group-dialog-title" className="text-xl font-semibold">{removing ? 'Giải tán nhóm?' : editor?.group ? 'Đổi tên nhóm' : 'Tạo nhóm'}</h3><button type="button" aria-label="Đóng" disabled={saving} onClick={() => { setEditor(null); setRemoving(null); }}><X size={20}/></button></div>
        {editor && <label className="mt-5 block">Tên nhóm<input autoFocus required maxLength={200} className="study-input mt-2" value={editor.name} placeholder="Ví dụ: Từ vựng N3" onChange={e => setEditor({ ...editor, name: e.target.value })}/></label>}
        {removing && <p className="study-copy mt-4">Các bộ trong “{removing.name}” sẽ được đưa ra ngoài. Thẻ và tiến độ học vẫn được giữ.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="study-button" disabled={saving} onClick={() => { setEditor(null); setRemoving(null); }}>Hủy</button>
          {removing ? <button type="button" className="study-button study-button-primary" disabled={saving} onClick={() => void mutate(() => dissolveDeckGroup(groups.find(g => g.id === removing.id) ?? removing), 'Đã giải tán nhóm; các bộ thẻ đã được đưa ra ngoài.')}>{saving ? 'Đang lưu…' : 'Giải tán'}</button>
            : <button className="study-button study-button-primary" disabled={saving || !editor?.name.trim()}>{saving ? 'Đang lưu…' : 'Lưu nhóm'}</button>}</div>
      </form>
    </dialog>
    {drag && createPortal(<div ref={overlay} className="deck-drag-preview" style={{ transform: `translate3d(${drag.x + 16}px, ${drag.y + 12}px, 0)` }}><Folder size={21}/><span>{drag.deck.name}<small>{drag.deck.cardCount} thẻ</small></span></div>, document.body)}
  </div>;
}
