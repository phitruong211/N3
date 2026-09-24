import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Folder, Maximize2, Minimize2, Plus, Upload, X } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { kindLabels, parseImportFile } from '@/lib/ankiImport';
import type { ImportedCard, ImportedDeck, ImportPreview } from '@/lib/ankiImport';
import { loadImportedDecks, writeImportedDeck } from '@/lib/ankiStorage';
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
  const [flashcardSession, setFlashcardSession] = useState<{ deckName: string; cards: ImportedCard[] } | null>(null);
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
    setDecks(previous => [...previous.filter(item => item.id !== deck.id && item.id !== saved.id), saved]);
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
    setFlashcardSession({ deckName: pendingStudyDeck.name, cards });
    setPendingStudyId(null);
  }

  if (flashcardSession) return <ImportedFlashcardSession deckName={flashcardSession.deckName} items={flashcardSession.cards} onExit={() => setFlashcardSession(null)}/>;

  return <div className="space-y-6">
    {pendingStudyDeck && <ShuffleLaunchModal deckName={pendingStudyDeck.name} totalCards={pendingStudyDeck.cards.length} onStart={launchImportedDeck} onCancel={() => setPendingStudyId(null)}/>}
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
        const deck: ImportedDeck = { id: crypto.randomUUID(), name: name.trim(), source: preview.source, format: preview.format, createdAt: new Date().toISOString(), cards: preview.cards };
        const saved = await save(deck); setPreview(null); setActiveId(null); setQueue(null); setEditing(null); setMessage(`Đã tạo bộ thẻ với ${saved.cards.length} thẻ.`);
      })}>Tạo bộ thẻ</button><button className="study-button" disabled={busy} onClick={() => setPreview(null)}>Hủy</button></div>
    </div>}
    {creatingDeck && !preview && <form className="rounded-xl border border-[var(--color-border)] p-4 space-y-3" onSubmit={event => { event.preventDefault(); void operation(async () => {
      const deck: ImportedDeck = { id: crypto.randomUUID(), name: name.trim(), source: 'Tạo thủ công', format: 'Thủ công', createdAt: new Date().toISOString(), cards: [] };
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
        <div className="flex flex-wrap gap-2"><button className="study-button study-button-primary" disabled={busy || !due(active)} onClick={() => start(true)}>Ôn {due(active)} thẻ mới / đến hạn</button><button className="study-button" disabled={busy || !active.cards.length} onClick={() => start(false)}>Học tất cả ({active.cards.length})</button><button className="study-button" disabled={busy} onClick={() => setEditing({ id: crypto.randomUUID(), front: '', back: '', reading: '', notes: '', kind: 'general' })}><Plus size={16}/>Thêm thẻ</button></div>
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
        <input className="study-input" aria-label="Tìm thẻ trong thư mục" placeholder="Tìm thẻ trong thư mục…" value={search} onChange={e => { setSearch(e.target.value); setLimit(50); }}/>
        <div className="divide-y divide-[var(--color-border)]">{matching.slice(0, limit).map(card => <div key={card.id} className="py-3 flex flex-wrap items-start gap-3"><div className="flex-1 min-w-0"><p className="font-semibold whitespace-pre-wrap break-words">{card.front}</p><p className="study-copy whitespace-pre-wrap">{card.back}</p><p className="study-copy">{kindLabels[card.kind]}{card.reading ? ` · ${card.reading}` : ''}</p></div><button className="study-button" disabled={busy} onClick={() => setEditing({ ...card })}>Sửa</button><button className="study-button" disabled={busy} onClick={() => {
          if (window.confirm(`Xóa thẻ “${card.front.slice(0, 80)}”?`)) void operation(async () => { await save({ ...active, cards: active.cards.filter(item => item.id !== card.id) }); if (editing?.id === card.id) setEditing(null); });
        }}>Xóa</button></div>)}</div>
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
      <h2 className="study-eyebrow mb-3">CỦA BẠN</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {leadingDeck}
        {decks.map(deck => <div key={deck.id} className="study-panel flex min-w-0 flex-col items-start text-left">
          <button className="w-full min-w-0 text-left focus-ring disabled:cursor-not-allowed disabled:opacity-50" disabled={mode === 'flashcards' && !deck.cards.length} onClick={() => mode === 'flashcards' ? setPendingStudyId(deck.id) : open(deck)}>
            <h3 className="font-semibold break-words">{deck.name}</h3><p className="study-copy">{deck.cards.length} thẻ · {due(deck)} mới / đến hạn</p><p className="mt-4 text-sm font-semibold text-[var(--color-accent)]">{mode === 'flashcards' ? 'Bắt đầu học →' : 'Mở bộ thẻ →'}</p>
          </button>
          {mode === 'flashcards' && <button className="study-button mt-4" onClick={() => open(deck)}>Quản lý bộ thẻ</button>}
        </div>)}
        {loaded && !decks.length && !leadingDeck && <p className="study-copy">Chưa có bộ thẻ riêng. Bạn có thể tạo thủ công hoặc nhập file để bắt đầu.</p>}
      </div>
    </section>}
  </div>;
}

function ImportedFlashcardSession({ deckName, items, onExit }: { deckName: string; items: ImportedCard[]; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reviewed = useRef<Set<number>>(new Set());
  const current = items[index];
  const total = items.length;

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
      else if (event.key === ' ') { event.preventDefault(); flipped ? next() : setFlipped(true); }
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
      <div role="button" tabIndex={0} onClick={() => setFlipped(value => !value)} onKeyDown={event => { if (event.key === 'Enter') setFlipped(value => !value); }} className={`relative flex w-full cursor-pointer flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center focus-ring sm:p-12 ${isFullscreen ? 'max-w-5xl' : 'max-w-4xl'}`} aria-label={flipped ? 'Đã hiện đáp án, chạm để xem câu hỏi' : 'Đang hiện câu hỏi, chạm để lật'}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-left"><span className="rounded-full bg-[var(--color-surface-alt)] px-3 py-1 text-xs font-bold text-[var(--color-text-secondary)]">{deckName}</span><span className="text-xs font-semibold text-[var(--color-accent)]">{kindLabels[current.kind]}</span></div>
        <div className="flex flex-1 flex-col items-center justify-center py-8">
          {!flipped ? <p className="font-jp text-3xl font-semibold whitespace-pre-wrap break-words sm:text-5xl">{current.front}</p> : <div className="w-full max-w-3xl space-y-5">
            <p className="font-jp text-xl text-[var(--color-text-secondary)] whitespace-pre-wrap break-words sm:text-2xl">{current.front}</p>
            <div className="h-px bg-[var(--color-border)]"/>
            <p className="text-2xl font-semibold whitespace-pre-wrap break-words sm:text-4xl">{current.back}</p>
            {current.reading && <p className="font-jp text-lg text-[var(--color-accent)] whitespace-pre-wrap">{current.reading}</p>}
            {current.notes && <div className="rounded-xl bg-[var(--color-surface-alt)] p-4 text-left" onClick={event => event.stopPropagation()}><p className="study-copy whitespace-pre-wrap">{current.notes}</p></div>}
          </div>}
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
