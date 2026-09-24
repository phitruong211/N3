import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Folder, GripVertical, Maximize2, Minimize2, Plus, Settings2, Upload, X } from 'lucide-react';
import { Reorder } from 'framer-motion';
import { useApp } from '@/hooks/useApp';
import { defaultDeckTemplate, kindLabels, parseImportFile } from '@/lib/ankiImport';
import type { CardField, DeckTemplateConfig, ImportedCard, ImportedDeck, ImportPreview } from '@/lib/ankiImport';
import { loadImportedDecks, moveImportedCards, saveCardOrder, saveDeckOrder, writeImportedDeck } from '@/lib/ankiStorage';
import { createSRSCard, getNextIntervals } from '@/lib/srs';
import { reviewCard } from '@/lib/api';
import { formatSessionTime, useActiveElapsedMinutes, useAnkiSessionTimer } from '@/hooks/useActiveElapsedMinutes';
import { recordStudyActivity } from '@/lib/storage';
import type { Rating } from '@/types';
import { ShuffleLaunchModal, type ShuffleConfig } from './ShuffleLaunchModal';

export function ImportedDecks({ leadingDeck, mode = 'anki' }: { leadingDeck?: ReactNode; mode?: 'flashcards' | 'anki' }) {
  const { settings } = useApp();
  const [decks, setDecks] = useState<ImportedDeck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [creatingDeck, setCreatingDeck] = useState(false);
  const [name, setName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportedCard | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [sessionToken, setSessionToken] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pendingStudyId, setPendingStudyId] = useState<string | null>(null);
  const [flashcardSession, setFlashcardSession] = useState<{ deckName: string; cards: ImportedCard[]; template: DeckTemplateConfig } | null>(null);
  const [orderMode, setOrderMode] = useState(false);
  const [orderSnapshot, setOrderSnapshot] = useState<ImportedDeck[]>([]);
  const [customizing, setCustomizing] = useState<ImportedDeck | null>(null);
  const [cardOrderMode, setCardOrderMode] = useState(false);
  const [cardOrderSnapshot, setCardOrderSnapshot] = useState<ImportedCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [moveTargetId, setMoveTargetId] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const active = decks.find(deck => deck.id === activeId);
  const current = active?.cards.find(card => card.id === queue?.[0]);
  const sessionTimer = useAnkiSessionTimer(settings.ankiSessionMinutes, sessionToken, queue !== null);
  const readCardElapsedMinutes = useActiveElapsedMinutes(`${sessionToken}:${current?.id || 'idle'}`);

  useEffect(() => { loadImportedDecks().then(setDecks).catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được bộ thẻ từ máy chủ.')).finally(() => setLoaded(true)); }, []);

  async function operation(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được thay đổi lên máy chủ.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(deck: ImportedDeck): Promise<ImportedDeck> {
    const saved = await writeImportedDeck(deck);
    setDecks(previous => {
      const index = previous.findIndex(item => item.id === deck.id || item.id === saved.id);
      if (index < 0) return [...previous, saved];
      return previous.map((item, itemIndex) => itemIndex === index ? saved : item);
    });
    if (activeId === deck.id && saved.id !== deck.id) setActiveId(saved.id);
    return saved;
  }
  function open(deck: ImportedDeck) { setActiveId(deck.id); setName(deck.name); setSearch(''); setLimit(50); setEditing(null); setQueue(null); setCreatingDeck(false); setMessage(''); }
  function start(dueOnly: boolean) {
    if (!active) return;
    const cards = active.cards.filter(card => !dueOnly || !card.srs || Date.parse(card.srs.dueDate) <= Date.now());
    cards.sort((a, b) => (a.srs ? Date.parse(a.srs.dueDate) : Number.MAX_SAFE_INTEGER) - (b.srs ? Date.parse(b.srs.dueDate) : Number.MAX_SAFE_INTEGER));
    setSessionToken(value => value + 1); setQueue(cards.map(card => card.id)); setRevealed(false); setEditing(null);
  }
  function rate(rating: Rating) {
    if (!active || !current || !revealed) return;
    void operation(async () => {
      const original = current.srs || createSRSCard(current.id, current.kind === 'general' ? 'vocabulary' : current.kind);
      const srs = await reviewCard(current.id, rating, Math.round(readCardElapsedMinutes() * 60_000));
      setDecks(previous => previous.map(deck => deck.id === active.id ? { ...deck, cards: deck.cards.map(card => card.id === current.id ? { ...card, srs: { ...srs, deckType: card.kind === 'general' ? 'vocabulary' : card.kind } } : card) } : deck));
      recordStudyActivity(1, original.state === 'new' ? 1 : 0, rating === 'again' ? 0 : 1, readCardElapsedMinutes(), 'srs');
      if (sessionTimer.isExpired()) { setQueue(null); setMessage('Đã hết thời gian phiên. Lịch của thẻ vừa học đã được lưu.'); }
      else setQueue(previous => previous!.slice(1));
      setRevealed(false);
    });
  }
  const matching = active?.cards.filter(card => `${card.front} ${card.back} ${card.reading}`.toLowerCase().includes(search.toLowerCase())) || [];
  const due = (deck: ImportedDeck) => deck.cards.filter(card => !card.srs || Date.parse(card.srs.dueDate) <= Date.now()).length;
  const pendingStudyDeck = decks.find(deck => deck.id === pendingStudyId);

  function launchImportedDeck(config: ShuffleConfig) {
    if (!pendingStudyDeck) return;
    const selected = pendingStudyDeck.cards.slice(0, config.rangeEnd);
    const cards = config.mode === 'shuffle' ? [...selected].sort(() => Math.random() - 0.5) : selected;
    setFlashcardSession({ deckName: pendingStudyDeck.name, cards, template: pendingStudyDeck.template });
    setPendingStudyId(null);
  }

  function shiftDeck(deckId: string, delta: number) {
    setDecks(previous => {
      const from = previous.findIndex(deck => deck.id === deckId);
      const to = Math.max(0, Math.min(previous.length - 1, from + delta));
      if (from < 0 || from === to) return previous;
      const next = [...previous];
      const [item] = next.splice(from, 1); next.splice(to, 0, item);
      return next;
    });
  }

  function shiftCard(cardId: string, delta: number) {
    if (!active) return;
    const from = active.cards.findIndex(card => card.id === cardId);
    const to = Math.max(0, Math.min(active.cards.length - 1, from + delta));
    if (from < 0 || from === to) return;
    const cards = [...active.cards]; const [item] = cards.splice(from, 1); cards.splice(to, 0, item);
    setDecks(previous => previous.map(deck => deck.id === active.id ? { ...deck, cards } : deck));
  }

  function finishDeckOrder() {
    void operation(async () => {
      try { await saveDeckOrder(decks); setOrderMode(false); setMessage('Đã lưu thứ tự bộ thẻ.'); }
      catch (reason) { setDecks(orderSnapshot); throw reason; }
    });
  }

  function finishCardOrder() {
    if (!active) return;
    void operation(async () => {
      try { await saveCardOrder(active.id, active.cards); setCardOrderMode(false); setMessage('Đã lưu thứ tự thẻ.'); }
      catch (reason) { setDecks(previous => previous.map(deck => deck.id === active.id ? { ...deck, cards: cardOrderSnapshot } : deck)); throw reason; }
    });
  }

  function moveSelectedCards() {
    if (!active || !moveTargetId || !selectedCardIds.length) return;
    void operation(async () => {
      await moveImportedCards(selectedCardIds, moveTargetId);
      const refreshed = await loadImportedDecks();
      setDecks(refreshed); setSelectedCardIds([]); setMoveTargetId('');
      setMessage(`Đã chuyển ${selectedCardIds.length} thẻ sang bộ khác.`);
    });
  }

  if (flashcardSession) return <ImportedFlashcardSession deckName={flashcardSession.deckName} items={flashcardSession.cards} template={flashcardSession.template} onExit={() => setFlashcardSession(null)}/>;

  return <div className="space-y-6">
    {pendingStudyDeck && <ShuffleLaunchModal deckName={pendingStudyDeck.name} totalCards={pendingStudyDeck.cards.length} onStart={launchImportedDeck} onCancel={() => setPendingStudyId(null)}/>}
    {customizing && <DeckCustomizeDialog deck={customizing} busy={busy} onCancel={() => setCustomizing(null)} onSave={template => void operation(async () => { await save({ ...customizing, template }); setCustomizing(null); setMessage('Đã lưu giao diện bộ thẻ.'); })}/>}
    <section className="study-panel space-y-5" aria-label="Nạp và quản lý bộ thẻ">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold flex items-center gap-2"><Folder size={20}/>Bộ thẻ của bạn</h2><p className="study-copy mt-1">Tạo thẻ thủ công hoặc nhập file. Dữ liệu được đồng bộ với tài khoản.</p></div>
      <div className="flex flex-wrap gap-2"><button className="study-button" disabled={busy || !loaded} onClick={() => { setCreatingDeck(true); setPreview(null); setActiveId(null); setName('Bộ thẻ mới'); setMessage(''); }}><Plus size={17}/>Tạo bộ thủ công</button><button className="study-button study-button-primary" disabled={busy || !loaded} onClick={() => input.current?.click()}><Upload size={17}/>Import file</button></div>
      <input ref={input} type="file" className="sr-only" aria-label="Chọn file nhập bộ thẻ" accept=".txt,.csv,.tsv,.json,.xlsx,.xls" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void operation(async () => { const result = await parseImportFile(file); setPreview(result); setCreatingDeck(false); setName(result.name); setActiveId(null); setQueue(null); setEditing(null); });
      }}/>
    </div>
    <p className="study-copy">TXT/CSV/TSV: mỗi dòng một thẻ, các cột cách nhau bằng tab, dấu phẩy hoặc chấm phẩy. JSON: danh sách thẻ. Excel: đọc tất cả sheet. Dùng cột front/back, mặt trước/mặt sau, từ/nghĩa; nếu không có tiêu đề, hai cột đầu là hai mặt thẻ. Tối đa 20 MB.</p>
    {busy && <p role="status">Đang xử lý…</p>}
    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
    {message && <p role="status" className="text-[var(--color-success)]">{message}</p>}
    {preview && <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
      <h3 className="font-semibold">Xem trước: {preview.source}</h3>
      <p className="study-copy">{preview.format} · {preview.cards.length} thẻ hợp lệ · {preview.skipped} dòng bỏ qua do thiếu nội dung</p>
      <p className="study-copy">{Object.entries(kindLabels).map(([kind, label]) => `${label}: ${preview.cards.filter(card => card.kind === kind).length}`).join(' · ')}</p>
      <label className="block">Tên thư mục<input className="study-input mt-1" value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label>
      <div className="space-y-2">{preview.cards.slice(0, 3).map(card => <div key={card.id} className="grid gap-2 sm:grid-cols-2 border-t border-[var(--color-border)] pt-2"><p className="whitespace-pre-wrap break-words">{card.front}</p><p className="whitespace-pre-wrap break-words">{card.back}</p></div>)}</div>
      <div className="flex gap-2"><button className="study-button study-button-primary" disabled={busy || !name.trim()} onClick={() => void operation(async () => {
        const deck: ImportedDeck = { id: crypto.randomUUID(), name: name.trim(), source: preview.source, format: preview.format, createdAt: new Date().toISOString(), position: decks.length, template: defaultDeckTemplate(), cards: preview.cards };
        const saved = await save(deck); setPreview(null); setActiveId(null); setQueue(null); setEditing(null); setMessage(`Đã tạo bộ thẻ với ${saved.cards.length} thẻ.`);
      })}>Tạo bộ thẻ</button><button className="study-button" disabled={busy} onClick={() => setPreview(null)}>Hủy</button></div>
    </div>}
    {creatingDeck && !preview && <form className="rounded-xl border border-[var(--color-border)] p-4 space-y-3" onSubmit={event => { event.preventDefault(); void operation(async () => {
      const deck: ImportedDeck = { id: crypto.randomUUID(), name: name.trim(), source: 'Tạo thủ công', format: 'Thủ công', createdAt: new Date().toISOString(), position: decks.length, template: defaultDeckTemplate(), cards: [] };
      const saved = await save(deck); open(saved); setEditing({ id: crypto.randomUUID(), front: '', back: '', reading: '', notes: '', kind: 'general' }); setMessage('Đã tạo bộ thẻ. Hãy thêm thẻ đầu tiên.');
    }); }}>
      <h3 className="font-semibold">Tạo bộ thẻ thủ công</h3>
      <label className="block">Tên bộ thẻ<input autoFocus className="study-input mt-1" value={name} maxLength={120} required onChange={event => setName(event.target.value)}/></label>
      <div className="flex gap-2"><button className="study-button study-button-primary" disabled={busy || !name.trim()}>Tạo và thêm thẻ</button><button type="button" className="study-button" disabled={busy} onClick={() => setCreatingDeck(false)}>Hủy</button></div>
    </form>}
    {active && <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center"><button className="study-button" disabled={busy} onClick={() => { setActiveId(null); setQueue(null); setEditing(null); }}>← Các thư mục</button><h3 className="font-semibold break-words">{active.name}</h3></div>
      {queue === null ? <>
        <div className="flex flex-wrap gap-2"><label className="flex-1 min-w-48"><span className="sr-only">Đổi tên thư mục</span><input className="study-input" value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label><button className="study-button" disabled={busy || !name.trim()} onClick={() => void operation(async () => { await save({ ...active, name: name.trim() }); setMessage('Đã đổi tên thư mục.'); })}>Đổi tên</button><button className="study-button text-[var(--color-error)]" disabled={busy} onClick={() => {
          if (window.confirm(`Xóa thư mục “${active.name}” cùng ${active.cards.length} thẻ và lịch ôn?`)) void operation(async () => { await writeImportedDeck(active.id); setDecks(previous => previous.filter(deck => deck.id !== active.id)); setActiveId(null); setEditing(null); });
        }}>Xóa thư mục</button></div>
        <div className="flex flex-wrap gap-2"><button className="study-button study-button-primary" disabled={busy || !due(active)} onClick={() => start(true)}>Ôn {due(active)} thẻ mới / đến hạn</button><button className="study-button" disabled={busy || !active.cards.length} onClick={() => start(false)}>Học tất cả ({active.cards.length})</button><button className="study-button" disabled={busy} onClick={() => setEditing({ id: crypto.randomUUID(), front: '', back: '', reading: '', notes: '', kind: 'general' })}><Plus size={16}/>Thêm thẻ</button><button className="study-button" disabled={busy} onClick={() => setCustomizing(active)}><Settings2 size={16}/>Tùy chỉnh</button><button className="study-button" disabled={busy || !active.cards.length} onClick={() => { if (cardOrderMode) finishCardOrder(); else { setCardOrderSnapshot(active.cards); setCardOrderMode(true); setSearch(''); } }}>{cardOrderMode ? <><Check size={16}/>Xong sắp xếp</> : <><GripVertical size={16}/>Sắp xếp thẻ</>}</button></div>
        {editing && <form className="space-y-3 rounded-xl border border-[var(--color-border)] p-4" onSubmit={event => { event.preventDefault(); void operation(async () => {
          const clean = { ...editing, front: editing.front.trim(), back: editing.back.trim(), reading: editing.reading.trim(), notes: editing.notes.trim() };
          const exists = active.cards.some(card => card.id === editing.id);
          await save({ ...active, cards: exists ? active.cards.map(card => card.id === editing.id ? clean : card) : [...active.cards, clean] });
          setEditing(null); setMessage(exists ? 'Đã lưu thẻ.' : 'Đã thêm thẻ mới.');
        }); }}>
          <h4 className="font-semibold">{active.cards.some(card => card.id === editing.id) ? 'Chỉnh sửa thẻ' : 'Thêm thẻ mới'}</h4>
          {(['front', 'back', 'reading', 'notes'] as const).map((field, index) => <label key={field} className="block">{['Mặt trước', 'Mặt sau', 'Cách đọc', 'Ghi chú'][index]}<textarea className="study-input mt-1" rows={field === 'reading' ? 1 : 3} required={field === 'front' || field === 'back'} value={editing[field]} onChange={e => setEditing({ ...editing, [field]: e.target.value })}/></label>)}
          <label className="block">Loại thẻ<select className="study-input mt-1" value={editing.kind} onChange={e => setEditing({ ...editing, kind: e.target.value as ImportedCard['kind'] })}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="flex gap-2"><button className="study-button study-button-primary" disabled={busy || !editing.front.trim() || !editing.back.trim()}>Lưu thẻ</button><button type="button" className="study-button" disabled={busy} onClick={() => setEditing(null)}>Hủy</button></div>
        </form>}
        {!cardOrderMode && <input className="study-input" aria-label="Tìm thẻ trong thư mục" placeholder="Tìm thẻ trong thư mục…" value={search} onChange={e => { setSearch(e.target.value); setLimit(50); }}/>}
        {!!selectedCardIds.length && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--color-surface-alt)] p-3"><strong>{selectedCardIds.length} thẻ đã chọn</strong><select className="study-input max-w-xs" aria-label="Bộ thẻ đích" value={moveTargetId} onChange={event => setMoveTargetId(event.target.value)}><option value="">Chuyển sang bộ…</option>{decks.filter(deck => deck.id !== active.id).map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select><button className="study-button study-button-primary" disabled={!moveTargetId || busy} onClick={moveSelectedCards}>Di chuyển</button><button className="study-button" onClick={() => setSelectedCardIds([])}>Bỏ chọn</button></div>}
        <Reorder.Group axis="y" values={cardOrderMode ? active.cards : matching.slice(0, limit)} onReorder={cards => { if (cardOrderMode) setDecks(previous => previous.map(deck => deck.id === active.id ? { ...deck, cards } : deck)); }} className="divide-y divide-[var(--color-border)]">{(cardOrderMode ? active.cards : matching.slice(0, limit)).map((card, cardIndex) => <Reorder.Item key={card.id} value={card} drag={cardOrderMode ? 'y' : false} className="py-3 flex flex-wrap items-start gap-3 bg-[var(--color-surface)]"><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={selectedCardIds.includes(card.id)} onChange={event => setSelectedCardIds(previous => event.target.checked ? [...previous, card.id] : previous.filter(id => id !== card.id))}/><span className="sr-only">Chọn thẻ {card.front}</span></label>{cardOrderMode && <div className="flex items-center gap-1"><span className="cursor-grab touch-none p-2 text-[var(--color-text-secondary)]" aria-label="Kéo để sắp xếp"><GripVertical size={20}/></span><button className="study-button !p-2" disabled={cardIndex === 0} onClick={() => shiftCard(card.id, -1)} aria-label="Đưa thẻ lên"><ArrowUp size={16}/></button><button className="study-button !p-2" disabled={cardIndex === active.cards.length - 1} onClick={() => shiftCard(card.id, 1)} aria-label="Đưa thẻ xuống"><ArrowDown size={16}/></button></div>}<div className="flex-1 min-w-0"><p className="font-semibold whitespace-pre-wrap break-words">{card.front}</p><p className="study-copy whitespace-pre-wrap">{card.back}</p><p className="study-copy">{kindLabels[card.kind]}{card.reading ? ` · ${card.reading}` : ''}</p></div><button className="study-button" disabled={busy || cardOrderMode} onClick={() => setEditing({ ...card })}>Sửa</button><button className="study-button" disabled={busy || cardOrderMode} onClick={() => {
          if (window.confirm(`Xóa thẻ “${card.front.slice(0, 80)}”?`)) void operation(async () => { await save({ ...active, cards: active.cards.filter(item => item.id !== card.id) }); if (editing?.id === card.id) setEditing(null); });
        }}>Xóa</button></Reorder.Item>)}</Reorder.Group>
        {!matching.length && <p className="study-copy">Không có thẻ phù hợp.</p>}
        {matching.length > limit && <button className="study-button" onClick={() => setLimit(limit + 50)}>Xem thêm ({matching.length - limit})</button>}
      </> : <div className="space-y-4">
        <button className="study-button" disabled={busy} onClick={() => setQueue(null)}>Kết thúc học</button>
        {current ? <>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="study-copy">Còn {queue.length} thẻ trong lượt này</p>{sessionTimer.remainingSeconds !== null && <p className={sessionTimer.expired ? 'text-sm font-semibold text-[var(--color-error)]' : 'study-copy'}>{sessionTimer.expired ? 'Hết giờ · hoàn tất thẻ này' : `Thời gian còn lại ${formatSessionTime(sessionTimer.remainingSeconds)}`}</p>}</div>
          <div className="study-panel text-center space-y-4"><p className="text-3xl font-jp whitespace-pre-wrap break-words">{current.front}</p>{revealed && <><p className="text-lg whitespace-pre-wrap break-words">{current.back}</p><p className="whitespace-pre-wrap">{current.reading}</p>{current.notes && <details className="text-left"><summary className="cursor-pointer">Ghi chú</summary><p className="study-copy whitespace-pre-wrap">{current.notes}</p></details>}</>}</div>
          {!revealed ? <button className="study-button study-button-primary w-full" onClick={() => setRevealed(true)}>Hiện đáp án</button> : <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating, index) => <button key={rating} className="study-button flex-col" disabled={busy} onClick={() => rate(rating)}>{['Học lại', 'Khó', 'Nhớ', 'Dễ'][index]}<span className="text-xs">{getNextIntervals(current.srs || createSRSCard(current.id, current.kind === 'general' ? 'vocabulary' : current.kind))[rating]}</span></button>)}</div>}
        </> : <p role="status">Đã hoàn thành lượt học. Lịch ôn của từng thẻ đã được lưu.</p>}
      </div>}
    </div>}
    </section>
    {!active && !preview && !creatingDeck && <section aria-label="Các bộ thẻ của bạn">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="study-eyebrow">CỦA BẠN</h2>{!!decks.length && <div className="flex gap-2">{orderMode && <button className="study-button" disabled={busy} onClick={() => { setDecks(orderSnapshot); setOrderMode(false); }}>Hủy</button>}<button className={orderMode ? 'study-button study-button-primary' : 'study-button'} disabled={busy} onClick={() => { if (orderMode) finishDeckOrder(); else { setOrderSnapshot(decks); setOrderMode(true); } }}>{orderMode ? <><Check size={16}/>Lưu thứ tự</> : <><GripVertical size={16}/>Sắp xếp</>}</button></div>}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {leadingDeck}
      </div>
      <Reorder.Group as="div" axis="y" values={decks} onReorder={setDecks} className={`mt-3 grid gap-3 ${orderMode ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {decks.map((deck, deckIndex) => <Reorder.Item as="div" key={deck.id} value={deck} drag={orderMode ? 'y' : false} className="study-panel flex min-w-0 flex-col items-start bg-[var(--color-surface)] text-left">
          {orderMode && <div className="mb-3 flex w-full items-center justify-between border-b border-[var(--color-border)] pb-3"><span className="flex cursor-grab touch-none items-center gap-2 font-semibold text-[var(--color-text-secondary)]"><GripVertical size={20}/>Kéo để di chuyển</span><span className="flex gap-1"><button className="study-button !p-2" disabled={deckIndex === 0} onClick={() => shiftDeck(deck.id, -1)} aria-label="Đưa bộ thẻ lên"><ArrowUp size={16}/></button><button className="study-button !p-2" disabled={deckIndex === decks.length - 1} onClick={() => shiftDeck(deck.id, 1)} aria-label="Đưa bộ thẻ xuống"><ArrowDown size={16}/></button></span></div>}
          <button className="w-full min-w-0 text-left focus-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={orderMode || (mode === 'flashcards' && !deck.cards.length)} onClick={() => mode === 'flashcards' ? setPendingStudyId(deck.id) : open(deck)}>
            <h3 className="font-semibold break-words">{deck.name}</h3><p className="study-copy">{deck.cards.length} thẻ · {due(deck)} mới / đến hạn</p><p className="mt-4 text-sm font-semibold text-[var(--color-accent)]">{mode === 'flashcards' ? 'Bắt đầu học →' : 'Mở bộ thẻ →'}</p>
          </button>
          {!orderMode && <div className="mt-4 flex flex-wrap gap-2"><button className="study-button" onClick={() => open(deck)}>Quản lý</button><button className="study-button" onClick={() => setCustomizing(deck)}><Settings2 size={16}/>Tùy chỉnh</button></div>}
        </Reorder.Item>)}
        {loaded && !decks.length && !leadingDeck && <p className="study-copy">Chưa có bộ thẻ riêng. Bạn có thể tạo thủ công hoặc nhập file để bắt đầu.</p>}
      </Reorder.Group>
    </section>}
  </div>;
}

const fieldLabels: Record<CardField, string> = { front: 'Mặt trước', back: 'Mặt sau', reading: 'Cách đọc', notes: 'Ghi chú', kind: 'Loại thẻ', deckName: 'Tên bộ thẻ' };

function fieldValue(field: CardField, card: ImportedCard, deckName: string): string {
  if (field === 'kind') return kindLabels[card.kind];
  if (field === 'deckName') return deckName;
  return card[field];
}

function CardFace({ card, deckName, fields, template, compact = false }: { card: ImportedCard; deckName: string; fields: CardField[]; template: DeckTemplateConfig; compact?: boolean }) {
  const sizes = { small: 'text-lg', medium: 'text-2xl', large: 'text-3xl sm:text-5xl', xlarge: 'text-4xl sm:text-6xl' };
  return <div className={`w-full space-y-4 ${template.style.alignment === 'left' ? 'text-left' : 'text-center'} ${compact ? '!text-base' : ''}`}>
    {fields.map((field, index) => { const value = fieldValue(field, card, deckName); if (!value) return null; return <div key={`${field}-${index}`} className={field === 'notes' ? 'rounded-xl bg-black/5 p-4 text-base' : field === 'reading' ? 'font-jp text-lg text-[var(--color-accent)]' : field === 'kind' || field === 'deckName' ? 'text-xs font-bold uppercase tracking-wide opacity-70' : `${sizes[template.style.fontScale]} font-semibold whitespace-pre-wrap break-words`}><span className="sr-only">{fieldLabels[field]}: </span>{value}</div>; })}
  </div>;
}

function DeckCustomizeDialog({ deck, busy, onCancel, onSave }: { deck: ImportedDeck; busy: boolean; onCancel: () => void; onSave: (template: DeckTemplateConfig) => void }) {
  const [template, setTemplate] = useState<DeckTemplateConfig>(deck.template);
  const [previewBack, setPreviewBack] = useState(false);
  const example = deck.cards[0] || { id: 'preview', front: '日本語を勉強する', back: 'Học tiếng Nhật', reading: 'にほんごをべんきょうする', notes: 'Ghi chú sẽ xuất hiện ở đây.', kind: 'vocabulary' as const };
  const candidates: CardField[] = ['front', 'back', 'reading', 'notes', 'kind', 'deckName'];
  const updateFields = (side: 'front' | 'back', fields: CardField[]) => setTemplate(previous => ({ ...previous, [side]: { ...previous[side], fields } }));
  const toggleField = (side: 'front' | 'back', field: CardField) => {
    const current = template[side].fields;
    updateFields(side, current.includes(field) ? current.filter(item => item !== field) : [...current, field]);
  };
  const shiftField = (side: 'front' | 'back', index: number, delta: number) => {
    const fields = [...template[side].fields]; const target = Math.max(0, Math.min(fields.length - 1, index + delta));
    if (index === target) return; const [field] = fields.splice(index, 1); fields.splice(target, 0, field); updateFields(side, fields);
  };
  const themeClass = template.style.theme === 'dark' ? 'bg-slate-900 text-white' : template.style.theme === 'blue' ? 'bg-blue-50 text-slate-900' : 'bg-[var(--color-surface)] text-[var(--color-text)]';
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Tùy chỉnh bộ thẻ">
    <div className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-2xl bg-[var(--color-bg)] p-4 shadow-2xl sm:rounded-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><div><p className="study-eyebrow">TÙY CHỈNH BỘ THẺ</p><h2 className="text-xl font-bold">{deck.name}</h2></div><button className="study-button !p-2" onClick={onCancel} aria-label="Đóng"><X size={20}/></button></div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-5">
          {(['front', 'back'] as const).map(side => <fieldset key={side} className="rounded-xl border border-[var(--color-border)] p-4"><legend className="px-2 font-semibold">{side === 'front' ? 'Mặt trước' : 'Mặt sau'}</legend><div className="space-y-2">{candidates.map(field => <label key={field} className="flex items-center gap-3"><input type="checkbox" checked={template[side].fields.includes(field)} onChange={() => toggleField(side, field)}/><span>{fieldLabels[field]}</span></label>)}</div>{template[side].fields.length > 1 && <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3">{template[side].fields.map((field, index) => <div key={field} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-alt)] px-3 py-2"><span><GripVertical className="mr-2 inline" size={15}/>{fieldLabels[field]}</span><span className="flex gap-1"><button className="study-button !p-1.5" disabled={index === 0} onClick={() => shiftField(side, index, -1)} aria-label={`Đưa ${fieldLabels[field]} lên`}><ArrowUp size={14}/></button><button className="study-button !p-1.5" disabled={index === template[side].fields.length - 1} onClick={() => shiftField(side, index, 1)} aria-label={`Đưa ${fieldLabels[field]} xuống`}><ArrowDown size={14}/></button></span></div>)}</div>}</fieldset>)}
          <div className="grid gap-3 sm:grid-cols-2"><label>Chủ đề<select className="study-input mt-1" value={template.style.theme} onChange={event => setTemplate(previous => ({ ...previous, style: { ...previous.style, theme: event.target.value as DeckTemplateConfig['style']['theme'] } }))}><option value="paper">Giấy sáng</option><option value="blue">Xanh nhạt</option><option value="dark">Tối</option><option value="system">Theo hệ thống</option></select></label><label>Cỡ chữ<select className="study-input mt-1" value={template.style.fontScale} onChange={event => setTemplate(previous => ({ ...previous, style: { ...previous.style, fontScale: event.target.value as DeckTemplateConfig['style']['fontScale'] } }))}><option value="small">Nhỏ</option><option value="medium">Vừa</option><option value="large">Lớn</option><option value="xlarge">Rất lớn</option></select></label><label>Căn chữ<select className="study-input mt-1" value={template.style.alignment} onChange={event => setTemplate(previous => ({ ...previous, style: { ...previous.style, alignment: event.target.value as 'left' | 'center' } }))}><option value="center">Giữa</option><option value="left">Trái</option></select></label><label>Hướng học<select className="study-input mt-1" value={template.study.orientation} onChange={event => setTemplate(previous => ({ ...previous, study: { orientation: event.target.value as DeckTemplateConfig['study']['orientation'] } }))}><option value="front-first">Mặt trước → mặt sau</option><option value="back-first">Mặt sau → mặt trước</option><option value="mixed">Trộn hai chiều</option></select></label></div>
        </div>
        <div className="lg:sticky lg:top-0 lg:self-start"><div className={`flex min-h-80 items-center rounded-2xl border border-[var(--color-border)] p-6 shadow-sm ${themeClass}`}><CardFace card={example} deckName={deck.name} fields={previewBack ? template.back.fields : template.front.fields} template={template}/></div><div className="mt-3 grid grid-cols-2 gap-2"><button className={!previewBack ? 'study-button study-button-primary' : 'study-button'} onClick={() => setPreviewBack(false)}>Mặt trước</button><button className={previewBack ? 'study-button study-button-primary' : 'study-button'} onClick={() => setPreviewBack(true)}>Mặt sau</button></div></div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] pt-4"><button className="study-button" disabled={busy} onClick={() => setTemplate(defaultDeckTemplate())}>Khôi phục mặc định</button><button className="study-button" disabled={busy} onClick={onCancel}>Hủy</button><button className="study-button study-button-primary" disabled={busy || !template.front.fields.length || !template.back.fields.length} onClick={() => onSave(template)}>Lưu tùy chỉnh</button></div>
    </div>
  </div>;
}

function ImportedFlashcardSession({ deckName, items, template, onExit }: { deckName: string; items: ImportedCard[]; template: DeckTemplateConfig; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reviewed = useRef<Set<number>>(new Set());
  const current = items[index];
  const total = items.length;
  const reversed = template.study.orientation === 'back-first' || (template.study.orientation === 'mixed' && index % 2 === 1);
  const questionFields = reversed ? template.back.fields : template.front.fields;
  const answerFields = reversed ? template.front.fields : template.back.fields;
  const themeClass = template.style.theme === 'dark' ? 'bg-slate-900 text-white' : template.style.theme === 'blue' ? 'bg-blue-50 text-slate-900' : 'bg-[var(--color-surface)] text-[var(--color-text)]';

  const recordCurrent = useCallback(() => {
    if (!flipped || reviewed.current.has(index)) return;
    reviewed.current.add(index);
    recordStudyActivity(1, 0, 1, 5, 'flashcard');
  }, [flipped, index]);
  const next = useCallback(() => {
    recordCurrent();
    if (index < total - 1) { setIndex(value => value + 1); setFlipped(false); }
  }, [index, total, recordCurrent]);
  const previous = useCallback(() => {
    recordCurrent();
    if (index > 0) { setIndex(value => value - 1); setFlipped(false); }
  }, [index, recordCurrent]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'Escape') { event.preventDefault(); onExit(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
      else if (event.key === ' ') { event.preventDefault(); if (flipped) next(); else setFlipped(true); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flipped, next, previous, onExit]);

  if (!current) return null;
  return <div className="fixed inset-0 z-50 flex flex-col select-none bg-[var(--color-bg)]">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 sm:px-8">
      <button className="study-button" onClick={onExit}><X size={18}/><span className="hidden sm:inline">Thoát (Esc)</span></button>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
        <span className="shrink-0 font-mono text-xs font-semibold text-[var(--color-text-secondary)]">Thẻ {index + 1} / {total}</span>
        <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-[var(--color-surface-alt)] sm:block lg:w-64"><div className="h-full rounded-full bg-[var(--color-accent)] transition-all" style={{ width: `${((index + 1) / total) * 100}%` }}/></div>
      </div>
      <button className="study-button" onClick={() => setIsFullscreen(value => !value)} aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>{isFullscreen ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}<span className="hidden lg:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span></button>
    </header>
    <main className="flex min-h-0 flex-1 items-stretch justify-center overflow-y-auto p-3 sm:p-6">
      <div role="button" tabIndex={0} onClick={() => setFlipped(value => !value)} onKeyDown={event => { if (event.key === 'Enter') setFlipped(value => !value); }} className={`relative flex w-full cursor-pointer flex-col rounded-2xl border border-[var(--color-border)] p-6 focus-ring sm:p-12 ${themeClass} ${isFullscreen ? 'max-w-5xl' : 'max-w-4xl'}`} aria-label={flipped ? 'Đã hiện đáp án, chạm để xem câu hỏi' : 'Đang hiện câu hỏi, chạm để lật'}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-left">{template.front.showDeckName && <span className="rounded-full bg-black/5 px-3 py-1 text-xs font-bold">{deckName}</span>}<span className="text-xs font-semibold text-[var(--color-accent)]">{kindLabels[current.kind]}</span></div>
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {!flipped ? <CardFace card={current} deckName={deckName} fields={questionFields} template={template}/> : <div className="w-full max-w-3xl space-y-5">{template.back.showFront && <div className="border-b border-current/15 pb-5 opacity-60"><CardFace card={current} deckName={deckName} fields={questionFields} template={{ ...template, style: { ...template.style, fontScale: 'small' } }}/></div>}<CardFace card={current} deckName={deckName} fields={answerFields} template={template}/></div>}
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)]">{flipped ? 'Chạm để xem lại câu hỏi' : 'Chạm hoặc nhấn Space để lật thẻ'}</p>
      </div>
    </main>
    <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 sm:flex sm:justify-center sm:px-8">
      <button className="study-button" disabled={index === 0} onClick={previous}><ChevronLeft size={18}/>Thẻ trước</button>
      <button className="study-button study-button-primary" onClick={() => flipped ? next() : setFlipped(true)} disabled={flipped && index === total - 1}>{flipped ? <><span>{index === total - 1 ? 'Đã hết bộ thẻ' : 'Thẻ tiếp'}</span><ChevronRight size={18}/></> : 'Hiện đáp án'}</button>
    </footer>
  </div>;
}
