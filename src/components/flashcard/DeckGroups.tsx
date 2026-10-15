import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Folder, FolderOpen, Plus, MoveDiagonal2, X, Grip, SlidersHorizontal } from 'lucide-react';
import {
  listDeckGroups, listDeckPage, createDeckGroup, renameDeckGroup, dissolveDeckGroup,
  moveDeckToGroup, orderDeckGroups, type DeckGroup, type PersonalDeck, type Page,
} from '@/lib/deckApi';
import './deckGroups.css';
import { OverflowMenu, type DeckAction } from '@/components/ui/OverflowMenu';
import type { LearningStorage } from '@/lib/storage';
import { useDeckGroupSizes } from './useDeckGroupSizes';
import { useDeckWidgetStyles } from '@/hooks/useDeckWidgetStyles';
import { moveWidget, normalizeWidgetStyle, widgetInk } from '@/lib/deckWidgets';
import { DeckWidgetCustomize } from './DeckWidgetCustomize';

type Props = {
  rootDecks: PersonalDeck[]; reload: number; mode: 'free' | 'scheduled'; busy: boolean; reducedMotion?: boolean;
  onChange: () => void; renderDeck: (deck: PersonalDeck, menu: ReactNode, compact?: boolean) => ReactNode;
  deckActions?: (deck: PersonalDeck) => DeckAction[]; createActions?: DeckAction[]; toolbarTarget?: HTMLElement | null;
  storage?: Pick<LearningStorage, 'getJSON' | 'setJSON'>;
  onShareGroup?: (group: DeckGroup) => void; requestedGroup?: string | null; onGroupOpened?: () => void;
  onReviewGroup?: (group: DeckGroup) => void; summaryTarget?: HTMLElement | null;
};
type Target = { groupId: string | null; beforeId?: string; key: string };
type Drag = { deck: PersonalDeck; x: number; y: number };
function usesLightTheme() { return !document.documentElement.classList.contains('dark'); }

export function DeckGroups({ rootDecks, reload, mode, busy, reducedMotion = false, onChange, renderDeck, deckActions, createActions = [], toolbarTarget, storage, onShareGroup, requestedGroup, onGroupOpened, onReviewGroup, summaryTarget }: Props) {
  const sizing = useDeckGroupSizes(storage);
  const widgets = useDeckWidgetStyles(storage);
  const pruneWidgets = widgets.prune;
  const [editingLayout, setEditingLayout] = useState(false);
  const [customizingWidget, setCustomizingWidget] = useState<DeckGroup | null>(null);
  const [widgetDrag, setWidgetDrag] = useState<string | null>(null);
  const [widgetTarget, setWidgetTarget] = useState<string | null>(null);
  const cleanupWidgetDrag = useRef<() => void>(() => {});
  const workspace = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [lightTheme, setLightTheme] = useState(usesLightTheme);
  const stylesRef = useRef(widgets.styles); stylesRef.current = widgets.styles;
  const pruneSizes = sizing.prune;
  const suppressClick = useRef(false);
  const [moving, setMoving] = useState<PersonalDeck | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
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
  const dialogOpen = editor !== null || removing !== null || moving !== null;

  useEffect(() => { alive.current = true; return () => { alive.current = false; cleanupDrag.current(); cleanupWidgetDrag.current(); }; }, []);
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => setGridWidth(element.clientWidth);
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const changed = () => setLightTheme(usesLightTheme());
    const observer = new MutationObserver(changed); observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const scheme = matchMedia('(prefers-color-scheme: light)'); scheme.addEventListener('change', changed);
    return () => { observer.disconnect(); scheme.removeEventListener('change', changed); };
  }, []);
  useEffect(() => {
    let valid = true;
    const generation = ++epoch.current;
    setLoading(new Set());
    setGroupLoading(true);
    listDeckGroups().then(async result => {
      if (!valid) return;
      setGroups(result);
      pruneSizes(new Set(result.map(group => group.id)));
      pruneWidgets(new Set(result.map(group => group.id)));
      const ids = new Set(result.map(g => g.id));
      const largeIds = result.filter(group => normalizeWidgetStyle(stylesRef.current[group.id]).size === 'large').map(group => group.id);
      setOpened(current => new Set([...current, ...largeIds].filter(id => ids.has(id))));
      setPages(current => Object.fromEntries(Object.entries(current).filter(([id]) => ids.has(id))));
      await Promise.all([...new Set([...openRef.current, ...largeIds])].filter(id => ids.has(id)).map(id => loadGroup(id, pagesRef.current[id]?.number ?? 0, generation)));
    }).catch(e => { if (valid) setError(e.message); }).finally(() => { if (valid) setGroupLoading(false); });
    return () => { valid = false; };
  }, [reload, revision, pruneSizes, pruneWidgets]);

  useEffect(() => {
    if (dialogOpen) {
      setCustomizingWidget(null);
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
  const pendingGroup = useRef<string | null>(null);
  useEffect(() => {
    if (!requestedGroup) { pendingGroup.current = null; return; }
    if (groupLoading || pendingGroup.current === requestedGroup) return;
    pendingGroup.current = requestedGroup;
    if (groups.some(group => group.id === requestedGroup)) {
      expand(requestedGroup);
      requestAnimationFrame(() => document.getElementById(`group-${requestedGroup}`)?.scrollIntoView({ block: 'start' }));
    } else setError('Không tìm thấy nhóm. Nhóm có thể đã được giải tán.');
    onGroupOpened?.();
  }, [requestedGroup, groupLoading, groups, onGroupOpened]);
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
      if (alive.current) { setEditor(null); setRemoving(null); setMoving(null); setNotice(message); onChange(); }
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
  function beginWidgetDrag(event: ReactPointerEvent<HTMLButtonElement>, group: DeckGroup) {
    if (!editingLayout || saving || busy || groupLoading || sizing.resizing || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); cleanupWidgetDrag.current();
    const handle = event.currentTarget, pointerId = event.pointerId;
    const originalCursor = document.body.style.cursor, originalSelect = document.body.style.userSelect;
    let destination: { id: string; after: boolean } | null = null;
    let point = { x: event.clientX, y: event.clientY }, frame = 0;
    handle.setPointerCapture(pointerId); setWidgetDrag(group.id);
    document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
    const hit = () => {
      const target = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>('[data-widget-id]');
      if (!target || target.dataset.widgetId === group.id) { destination = null; setWidgetTarget(null); return; }
      const rect = target.getBoundingClientRect();
      destination = { id: target.dataset.widgetId!, after: point.x > rect.left + rect.width / 2 };
      setWidgetTarget(destination.id);
    };
    const tick = () => {
      let scrollable = handle.closest<HTMLElement>('main');
      while (scrollable && !(scrollable.scrollHeight > scrollable.clientHeight && /auto|scroll/.test(getComputedStyle(scrollable).overflowY))) scrollable = scrollable.parentElement;
      const box = scrollable?.getBoundingClientRect();
      const top = Math.max(0, box?.top ?? 0), bottom = Math.min(innerHeight, box?.bottom ?? innerHeight);
      const dy = point.y < top + 60 ? -10 : point.y > bottom - 60 ? 10 : 0;
      if (dy) { if (scrollable) scrollable.scrollBy(0, dy); else window.scrollBy(0, dy); }
      hit(); frame = requestAnimationFrame(tick);
    };
    const movePointer = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      e.preventDefault(); point = { x: e.clientX, y: e.clientY }; hit();
    };
    const finish = (save: boolean) => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', movePointer); window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key); window.removeEventListener('blur', cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      document.body.style.cursor = originalCursor; document.body.style.userSelect = originalSelect;
      setWidgetDrag(null); setWidgetTarget(null); cleanupWidgetDrag.current = () => {};
      if (save && destination) {
        const ids = groups.map(item => item.id);
        const next = moveWidget(ids, group.id, destination.id, destination.after);
        if (next.some((id, index) => id !== ids[index])) void mutate(async () => {
          await orderDeckGroups(next);
          if (alive.current) setGroups(current => [...current].sort((a, b) => next.indexOf(a.id) - next.indexOf(b.id)));
        }, 'Đã lưu vị trí widget.');
      }
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) { point = { x: e.clientX, y: e.clientY }; hit(); finish(true); } };
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); cancel(); } };
    window.addEventListener('pointermove', movePointer, { passive: false }); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key); window.addEventListener('blur', cancel);
    frame = requestAnimationFrame(tick); cleanupWidgetDrag.current = cancel;
  }
  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, deck: PersonalDeck) {
    suppressClick.current = false;
    if (editingLayout || busy || saving || groupLoading || sizing.resizing || event.button !== 0 || (event.target as HTMLElement).closest('button,a,input,select,textarea,summary,[role=menu],[contenteditable=true]')) return;
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
      active = true; suppressClick.current = true; button.setPointerCapture(pointerId); setDrag({ deck, ...point });
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
      const edge = 60;
      let scrollable = document.elementFromPoint(point.x, point.y)?.parentElement;
      while (scrollable && !(scrollable.scrollHeight > scrollable.clientHeight && /auto|scroll/.test(getComputedStyle(scrollable).overflowY))) scrollable = scrollable.parentElement;
      const box = scrollable?.getBoundingClientRect();
      const top = Math.max(0, box?.top ?? 0), bottom = Math.min(window.innerHeight, box?.bottom ?? window.innerHeight);
      const dy = point.y < top + edge ? -10 : point.y > bottom - edge ? 10 : 0;
      if (dy) { if (scrollable) scrollable.scrollBy(0, dy); else window.scrollBy(0, dy); }
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
      active = false; setTimeout(() => { suppressClick.current = false; }, 0); clearTimeout(pressTimer); clearTimeout(hoverTimer); cancelAnimationFrame(frame);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('pointermove', pointerMove); window.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', keydown); window.removeEventListener('blur', cancel);
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
      document.body.style.cursor = oldCursor; document.body.style.userSelect = oldSelect;
      if (alive.current) { setDrag(null); setTargetKey(null); }
    }
    const pointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      if (active) hit();
      const result = active ? destination : null; finish();
      if (result) move(deck, result.groupId, result.beforeId, result.key.startsWith("end:"));
    };
    const cancel = () => finish();
    const keydown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); finish(); } };
    // Prevent native touch scrolling only after the hold activates drag.
    const touchMove = (e: TouchEvent) => { if (active) e.preventDefault(); };
    window.addEventListener('touchmove', touchMove, { passive: false });
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
  function entry(deck: PersonalDeck, compact = false) {
    const groupId = deck.groupId ?? null;
    const actions = deckActions?.(deck) ?? [];
    const menu = <OverflowMenu menuClassName="deck-widget-menu" horizontal label={`Thao tác với bộ ${deck.name}`} actions={[
      ...actions.slice(0, 1),
      { id: 'move-group', label: 'Chuyển đến nhóm…', disabled: busy || saving || groupLoading, onSelect: () => { setMoving(deck); setMoveTarget(groupId ?? ''); setError(''); } },
      ...actions.slice(1),
    ]}/>;
    return <motion.div layout="position" transition={layoutTransition} key={deck.id}
      onPointerDown={e => beginDrag(e, deck)}
      onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}
      className={`deck-group-entry ${compact ? 'is-compact' : ''} ${drag?.deck.id === deck.id ? 'is-dragging' : ''}`}>
      <div data-deck-drop={`before:${deck.id}`} data-group-id={groupId ?? ''} data-before-id={deck.id}
        className={`deck-insert-zone ${drag ? 'is-active' : ''} ${targetKey === `before:${deck.id}` ? 'is-target' : ''}`}><span>Thả để đặt trước bộ này</span></div>
      {renderDeck(deck, menu, compact)}
    </motion.div>;
  }
  const createMenu = <OverflowMenu menuClassName="deck-widget-menu" label="Tạo mới" triggerContent={<><Plus size={18}/><span>Tạo mới</span><ChevronDown size={15}/></>} actions={[
    ...createActions,
    { id: 'create-group', label: 'Tạo nhóm', disabled: busy || saving || groupLoading, onSelect: () => { setError(''); setEditor({ name: '' }); } },
  ]}/>;
  const summary = `${groups.length} nhóm · ${groups.reduce((total, group) => total + group.dueCount, 0).toLocaleString('vi-VN')} thẻ cần ôn hôm nay`;
  const arrangeButton = groups.length > 0 && <button type="button" className="widget-pill" aria-pressed={editingLayout} disabled={saving || busy || Boolean(widgetDrag) || Boolean(sizing.resizing)}
    onClick={() => { setEditingLayout(value => !value); setCustomizingWidget(null); }}>{editingLayout ? 'Xong' : 'Sắp xếp'}</button>;
  const toolbar = <div className="widget-toolbar-actions">{arrangeButton}{createMenu}</div>;

  return <div className={`deck-groups-library sm:col-span-2 xl:col-span-3 ${drag ? "is-drag-active" : ""} ${sizing.resizing ? "is-resizing" : ""}`} data-study-mode={mode} data-reduced-motion={reducedMotion || systemReducedMotion || undefined} aria-busy={saving}>
    <div className="widget-board-backdrop" aria-hidden="true"><span/><span/></div>
    {toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbarTarget === undefined ? <div className="deck-library-toolbar"><p className="widget-library-summary">{summary}</p>{toolbar}</div> : null}
    {summaryTarget && createPortal(summary, summaryTarget)}
    {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error} <button className="underline" onClick={() => { setError(''); setRevision(v => v + 1); onChange(); }}>Thử lại</button></p>}
    <p className="sr-only" role="status">{saving ? 'Đang lưu…' : notice}</p>
    <div ref={workspace} className={`deck-widget-workspace ${customizingWidget ? 'has-customizer' : ''}`}>
    <div ref={grid} className={`deck-folder-grid ${editingLayout ? 'is-editing-layout' : ''}`}>{groups.map((group, index) => {
      const style = normalizeWidgetStyle(widgets.styles[group.id]);
      const ink = widgetInk(style, lightTheme);
      const customSize = sizing.sizes[group.id];
      const customSpan = customSize && gridWidth > 0 ? Math.max(gridWidth <= 600 ? 3 : 2, Math.min(6, Math.ceil((customSize.width + 16) / ((gridWidth + 16) / 6)))) : undefined;
      const due = Math.max(0, group.dueCount || 0);
      const groupMenu = <OverflowMenu menuClassName="deck-widget-menu" horizontal label={`Thao tác nhóm ${group.name}`} actions={[
        { id: 'rename', label: 'Đổi tên', disabled: saving || busy || groupLoading, onSelect: () => { setError(''); setEditor({ group, name: group.name }); } },
        ...(onShareGroup ? [{ id: 'share', label: 'Chia sẻ nhóm', disabled: saving || busy || groupLoading, onSelect: () => onShareGroup(group) }] : []),
        { id: 'up', label: 'Đưa lên', disabled: !editingLayout || saving || busy || groupLoading || index === 0, onSelect: () => shiftGroup(group, -1) },
        { id: 'down', label: 'Đưa xuống', disabled: !editingLayout || saving || busy || groupLoading || index === groups.length - 1, onSelect: () => shiftGroup(group, 1) },
        { id: 'customize-widget', label: 'Tùy chỉnh widget', onSelect: () => { setEditingLayout(true); setCustomizingWidget(group); } },
        { id: 'reset', label: 'Đặt lại kích thước', disabled: !sizing.sizes[group.id], onSelect: () => sizing.reset(group.id) },
        { id: 'dissolve', label: 'Giải tán nhóm', destructive: true, disabled: saving || busy || groupLoading, onSelect: () => { setError(''); setRemoving(group); } },
      ]}/>;
      return <motion.section layout="position" transition={layoutTransition} key={group.id} id={`group-${group.id}`}
      style={{ width: customSize?.width, height: customSize?.height, maxHeight: customSize ? 'none' : undefined, gridColumn: customSpan ? `span ${customSpan}` : undefined,
        '--tint': style.color, '--op': style.opacity, '--blur': `${style.blur}px`,
        '--widget-ink': ink.ink, '--widget-ink2': ink.ink2,
        '--widget-text-shadow': ink.halo ? `0 0 1px ${ink.halo}, 0 0 2px ${ink.halo}` : 'none',
        '--review-percent': `${Math.min(100, group.cardCount > 0 ? due / group.cardCount * 100 : 0)}%`,
      } as CSSProperties} data-widget-size={style.size} data-widget-id={group.id}
      className={`deck-folder ${customizingWidget?.id === group.id ? 'is-selected' : ''} ${editingLayout ? 'is-layout-editing' : ''} ${widgetDrag === group.id ? 'is-widget-moving' : ''} ${widgetTarget === group.id ? 'is-widget-target' : ''} ${sizing.resizing === group.id ? 'is-resizing' : ''} ${opened.has(group.id) ? 'is-open' : ''} ${targetKey === `group:${group.id}` ? 'is-target' : ''}`}
      data-deck-drop={!editingLayout ? `group:${group.id}` : undefined} data-group-id={group.id}>
      {editingLayout && <div className="widget-edit-controls">
        <button className="widget-move-handle widget-icon-button" aria-label={`Kéo để di chuyển ${group.name}`} title="Kéo để đổi chỗ · Phím mũi tên để sắp xếp" disabled={saving || busy || Boolean(sizing.resizing)} onPointerDown={event => beginWidgetDrag(event, group)}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(event.key)) { event.preventDefault(); shiftGroup(group, ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1); } }}><Grip size={18}/></button>
        <button className="widget-customize-trigger widget-icon-button" aria-label={`Tùy chỉnh widget ${group.name}`} onClick={() => setCustomizingWidget(group)}><SlidersHorizontal size={16}/></button>
      </div>}
      <div className="widget-content">
      <div className="deck-folder-header">
        <button className="deck-folder-toggle" aria-expanded={opened.has(group.id)} aria-controls={`folder-${group.id}`} onClick={() => toggle(group.id)}>
          <span className="deck-folder-icon">{opened.has(group.id) ? <FolderOpen size={22}/> : <Folder size={22}/>}</span>
          <span className="widget-title"><strong>{group.name}</strong><span>{group.deckCount} bộ · {group.cardCount.toLocaleString('vi-VN')} thẻ</span></span>
        </button>
        {style.size !== 'small' && <div className="widget-review-meter"><div className="widget-review-ring" role="img" aria-label={`${due} thẻ cần ôn`}><span>{due}</span></div><small>thẻ cần ôn</small></div>}
      </div>
      {style.size !== 'large' && <div className="widget-group-menu">{groupMenu}</div>}
      {(!opened.has(group.id) || style.size !== 'small') && <div className="widget-primary-action"><button type="button" className="widget-pill widget-open-button" disabled={busy || saving}
        onClick={() => due > 0 && style.size !== 'small' && onReviewGroup ? onReviewGroup(group) : toggle(group.id)}>{style.size !== 'small' && due > 0 ? `Ôn ${due} thẻ` : opened.has(group.id) ? 'Thu gọn' : 'Mở nhóm'}</button>{style.size === 'large' && <div className="widget-inline-group-menu">{groupMenu}</div>}</div>}
      {targetKey === `group:${group.id}` && <p className="deck-drop-hint">Thả để chuyển vào nhóm</p>}
      {opened.has(group.id) && <div id={`folder-${group.id}`} className="deck-folder-content">
        {loading.has(group.id) && <p role="status" className="study-copy">Đang tải bộ thẻ…</p>}
        <div className="deck-responsive-grid">{pages[group.id]?.content.map(deck => entry(deck, true))}</div>
        {endZone(group.id)}
        {!loading.has(group.id) && pages[group.id]?.totalElements === 0 && <p className="deck-empty-folder">Kéo bộ thẻ vào đây hoặc chọn “Chuyển đến nhóm” trong menu bộ thẻ.</p>}
        {(pages[group.id]?.totalPages ?? 0) > 1 && <div className="mt-4 flex items-center justify-center gap-3">
          <button className="study-button" disabled={loading.has(group.id) || pages[group.id].number === 0} onClick={() => void loadGroup(group.id, pages[group.id].number - 1)}>Trước</button>
          <span className="study-copy">{pages[group.id].number + 1} / {pages[group.id].totalPages}</span>
          <button className="study-button" disabled={loading.has(group.id) || pages[group.id].number + 1 >= pages[group.id].totalPages} onClick={() => void loadGroup(group.id, pages[group.id].number + 1)}>Sau</button>
        </div>}
      </div>}
      </div>
      {editingLayout && <button type="button" className="deck-resize-handle" aria-label={`Đổi kích thước nhóm ${group.name}`} title="Kéo để đổi kích thước · Phím mũi tên để điều chỉnh"
        disabled={Boolean(drag) || Boolean(widgetDrag) || saving || busy} onPointerDown={e => sizing.begin(e, group.id)} onKeyDown={e => sizing.keyboard(e, group.id)}><MoveDiagonal2 size={19}/></button>}
    </motion.section>; })}</div>
    {customizingWidget && <DeckWidgetCustomize name={customizingWidget.name} anchor={workspace} value={normalizeWidgetStyle(widgets.styles[customizingWidget.id])}
      onChange={patch => { if (patch.size) { sizing.reset(customizingWidget.id); if (patch.size === 'large') expand(customizingWidget.id); else setOpened(current => { const next = new Set(current); next.delete(customizingWidget.id); return next; }); } widgets.update(customizingWidget.id, patch); }}
      onReset={() => { sizing.reset(customizingWidget.id); widgets.reset(customizingWidget.id); setOpened(current => { const next = new Set(current); next.delete(customizingWidget.id); return next; }); }} onClose={() => setCustomizingWidget(null)}/>}
    </div>
    <section className={`deck-root-zone ${!rootDecks.length && !drag ? "hidden" : ""} ${targetKey === 'root' ? 'is-target' : ''}`} data-deck-drop="root" data-group-id="">
      {(groups.length > 0 || drag) && <div className="deck-root-heading"><span>Ngoài nhóm</span>{drag && <span>Thả vào đây để đưa ra ngoài</span>}</div>}
      <div className="deck-responsive-grid">{rootDecks.map(deck => entry(deck))}</div>
      {endZone(null)}
    </section>
    {!busy && !groupLoading && !groups.length && !rootDecks.length && !error && <p className="study-copy">Chưa có bộ cá nhân. Chọn “Tạo mới” để bắt đầu.</p>}
    <dialog ref={dialog} className="deck-group-dialog" onCancel={e => { if (saving) e.preventDefault(); else { setEditor(null); setRemoving(null); setMoving(null); } }} aria-labelledby="deck-group-dialog-title">
      <form onSubmit={e => { e.preventDefault(); if (moving) { void mutate(() => moveDeckToGroup(moving, moveTarget || null), 'Đã chuyển bộ thẻ.'); return; } if (editor?.name.trim()) void mutate(() => editor.group ? renameDeckGroup(groups.find(g => g.id === editor.group!.id) ?? editor.group, editor.name.trim()) : createDeckGroup(editor.name.trim()), 'Đã lưu nhóm.'); }}>
        <div className="flex items-center justify-between gap-4"><h3 id="deck-group-dialog-title" className="text-xl font-semibold">{moving ? 'Chuyển bộ thẻ' : removing ? 'Giải tán nhóm?' : editor?.group ? 'Đổi tên nhóm' : 'Tạo nhóm'}</h3><button type="button" aria-label="Đóng" disabled={saving} onClick={() => { setEditor(null); setRemoving(null); setMoving(null); }}><X size={20}/></button></div>
        {moving && <label className="mt-5 block">Chuyển “{moving.name}” đến<select autoFocus className="study-input mt-2" aria-label={`Chuyển nhóm cho ${moving.name}`} value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
          <option value="">Ngoài nhóm</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select></label>}
        {editor && <label className="mt-5 block">Tên nhóm<input autoFocus required maxLength={200} className="study-input mt-2" value={editor.name} placeholder="Ví dụ: Từ vựng N3" onChange={e => setEditor({ ...editor, name: e.target.value })}/></label>}
        {removing && <p className="study-copy mt-4">Các bộ trong “{removing.name}” sẽ được đưa ra ngoài. Thẻ và tiến độ học vẫn được giữ.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="study-button" disabled={saving} onClick={() => { setEditor(null); setRemoving(null); setMoving(null); }}>Hủy</button>
          {removing ? <button type="button" className="study-button study-button-primary" disabled={saving} onClick={() => void mutate(() => dissolveDeckGroup(groups.find(g => g.id === removing.id) ?? removing), 'Đã giải tán nhóm; các bộ thẻ đã được đưa ra ngoài.')}>{saving ? 'Đang lưu…' : 'Giải tán'}</button>
            : <button className="study-button study-button-primary" disabled={saving || (moving ? moveTarget === (moving.groupId ?? '') : !editor?.name.trim())}>{saving ? 'Đang lưu…' : moving ? 'Chuyển nhóm' : 'Lưu nhóm'}</button>}</div>
      </form>
    </dialog>
    {drag && createPortal(<div ref={overlay} className="deck-drag-preview" style={{ transform: `translate3d(${drag.x + 16}px, ${drag.y + 12}px, 0)` }}><Folder size={21}/><span>{drag.deck.name}<small>{drag.deck.cardCount} thẻ</small></span></div>, document.body)}
  </div>;
}
