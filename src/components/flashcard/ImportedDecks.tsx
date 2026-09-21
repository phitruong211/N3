import { useEffect, useRef, useState } from 'react';
import { Folder, Upload } from 'lucide-react';
import { kindLabels, parseImportFile } from '@/lib/ankiImport';
import type { ImportedCard, ImportedDeck, ImportPreview } from '@/lib/ankiImport';
import { loadImportedDecks, writeImportedDeck } from '@/lib/ankiStorage';
import { createSRSCard, getNextIntervals, processReview } from '@/lib/srs';
import type { Rating } from '@/types';

export function ImportedDecks() {
  const [decks, setDecks] = useState<ImportedDeck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [name, setName] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportedCard | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = decks.find(deck => deck.id === activeId);
  const current = active?.cards.find(card => card.id === queue?.[0]);

  useEffect(() => { loadImportedDecks().then(setDecks).catch(() => setError('Không đọc được bộ thẻ đã lưu. Hãy tải lại trang.')).finally(() => setLoaded(true)); }, []);

  async function operation(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được thay đổi. Hãy kiểm tra dung lượng trình duyệt và thử lại.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function save(deck: ImportedDeck) {
    await writeImportedDeck(deck);
    setDecks(previous => [...previous.filter(item => item.id !== deck.id), deck]);
  }
  function open(deck: ImportedDeck) { setActiveId(deck.id); setName(deck.name); setSearch(''); setLimit(50); setEditing(null); setQueue(null); setMessage(''); }
  function start(dueOnly: boolean) {
    if (!active) return;
    setQueue(active.cards.filter(card => !dueOnly || !card.srs || Date.parse(card.srs.dueDate) <= Date.now()).map(card => card.id)); setRevealed(false); setEditing(null);
  }
  function rate(rating: Rating) {
    if (!active || !current || !revealed) return;
    void operation(async () => {
      const srs = processReview(current.srs || createSRSCard(current.id, current.kind === 'general' ? 'vocabulary' : current.kind), rating);
      await save({ ...active, cards: active.cards.map(card => card.id === current.id ? { ...card, srs } : card) });
      setQueue(previous => previous!.slice(1)); setRevealed(false);
    });
  }
  const matching = active?.cards.filter(card => `${card.front} ${card.back} ${card.reading}`.toLowerCase().includes(search.toLowerCase())) || [];
  const due = (deck: ImportedDeck) => deck.cards.filter(card => !card.srs || Date.parse(card.srs.dueDate) <= Date.now()).length;

  return <section className="study-panel space-y-5" aria-label="Bộ thẻ Anki của bạn">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold flex items-center gap-2"><Folder size={20}/>Bộ thẻ Anki của bạn</h2><p className="study-copy mt-1">Nhập file để tạo thư mục thẻ riêng. Dữ liệu được lưu trong trình duyệt này.</p></div>
      <button className="study-button study-button-primary" disabled={busy || !loaded} onClick={() => input.current?.click()}><Upload size={17}/>Import file</button>
      <input ref={input} type="file" className="sr-only" aria-label="Chọn file nhập Anki" accept=".txt,.csv,.tsv,.json,.xlsx,.xls" disabled={busy} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void operation(async () => { const result = await parseImportFile(file); setPreview(result); setName(result.name); setActiveId(null); setQueue(null); setEditing(null); });
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
        await save(deck); setPreview(null); open(deck); setMessage(`Đã tạo thư mục với ${deck.cards.length} thẻ.`);
      })}>Tạo thư mục Anki</button><button className="study-button" disabled={busy} onClick={() => setPreview(null)}>Hủy</button></div>
    </div>}
    {!active && !preview && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {decks.map(deck => <button key={deck.id} className="study-panel text-left" onClick={() => open(deck)}><h3 className="font-semibold break-words">{deck.name}</h3><p className="study-copy">{deck.cards.length} thẻ · {due(deck)} mới / đến hạn</p><p className="study-copy mt-2">Mở thư mục →</p></button>)}
      {loaded && !decks.length && <p className="study-copy">Chưa có bộ thẻ nhập. Chọn Import file để bắt đầu.</p>}
    </div>}
    {active && <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center"><button className="study-button" disabled={busy} onClick={() => { setActiveId(null); setQueue(null); setEditing(null); }}>← Các thư mục</button><h3 className="font-semibold break-words">{active.name}</h3></div>
      {queue === null ? <>
        <div className="flex flex-wrap gap-2"><label className="flex-1 min-w-48"><span className="sr-only">Đổi tên thư mục</span><input className="study-input" value={name} maxLength={120} onChange={e => setName(e.target.value)}/></label><button className="study-button" disabled={busy || !name.trim()} onClick={() => void operation(async () => { await save({ ...active, name: name.trim() }); setMessage('Đã đổi tên thư mục.'); })}>Đổi tên</button><button className="study-button text-[var(--color-error)]" disabled={busy} onClick={() => {
          if (window.confirm(`Xóa thư mục “${active.name}” cùng ${active.cards.length} thẻ và lịch ôn?`)) void operation(async () => { await writeImportedDeck(active.id); setDecks(previous => previous.filter(deck => deck.id !== active.id)); setActiveId(null); setEditing(null); });
        }}>Xóa thư mục</button></div>
        <div className="flex flex-wrap gap-2"><button className="study-button study-button-primary" disabled={busy || !due(active)} onClick={() => start(true)}>Ôn {due(active)} thẻ mới / đến hạn</button><button className="study-button" disabled={busy || !active.cards.length} onClick={() => start(false)}>Học tất cả ({active.cards.length})</button></div>
        {editing && <form className="space-y-3 rounded-xl border border-[var(--color-border)] p-4" onSubmit={event => { event.preventDefault(); void operation(async () => { await save({ ...active, cards: active.cards.map(card => card.id === editing.id ? { ...editing, front: editing.front.trim(), back: editing.back.trim() } : card) }); setEditing(null); setMessage('Đã lưu thẻ.'); }); }}>
          <h4 className="font-semibold">Chỉnh sửa thẻ</h4>
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
          <p className="study-copy">Còn {queue.length} thẻ trong lượt này</p>
          <div className="study-panel text-center space-y-4"><p className="text-3xl font-jp whitespace-pre-wrap break-words">{current.front}</p>{revealed && <><p className="text-lg whitespace-pre-wrap break-words">{current.back}</p><p className="whitespace-pre-wrap">{current.reading}</p>{current.notes && <details className="text-left"><summary className="cursor-pointer">Ghi chú</summary><p className="study-copy whitespace-pre-wrap">{current.notes}</p></details>}</>}</div>
          {!revealed ? <button className="study-button study-button-primary w-full" onClick={() => setRevealed(true)}>Hiện đáp án</button> : <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating, index) => <button key={rating} className="study-button flex-col" disabled={busy} onClick={() => rate(rating)}>{['Học lại', 'Khó', 'Nhớ', 'Dễ'][index]}<span className="text-xs">{getNextIntervals(current.srs || createSRSCard(current.id, current.kind === 'general' ? 'vocabulary' : current.kind))[rating]}</span></button>)}</div>}
        </> : <p role="status">Đã hoàn thành lượt học. Lịch ôn của từng thẻ đã được lưu.</p>}
      </div>}
    </div>}
  </section>;
}
