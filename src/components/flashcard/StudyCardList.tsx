import { useMemo, useState } from "react";
import { parseTextImport, type ImportedCard } from "@/lib/ankiImport";
import type { NoteType } from "@/lib/deckFormat";
import { blankCard, presentationCard, type CardView } from "@/lib/cards";
import { Pencil, Plus, Search, Upload, X } from "@/components/ui/icons";
import { CardFields } from "./CardFields";

// shortcut: renders the first matches only; a deck of a few thousand cards is searched, not scrolled. Virtualise if decks grow.
const SHOWN = 150;

/**
 * The deck beside the card being studied: search it, fix any card, add new ones, without leaving the session.
 * Not a modal, so study keys keep working while nothing in here has focus.
 */
export function StudyCardList({ cards, currentId, noteTypes, onSave, onClose }: {
  cards: CardView[];
  currentId?: string;
  noteTypes?: NoteType[];
  /** `added` is true for a new card. Resolves once the card is stored; rejects with a message to show. */
  onSave: (card: ImportedCard, added: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<{ card: ImportedCard; added: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [bulk, setBulk] = useState<string | null>(null);
  const [bulkDone, setBulkDone] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(card => [card.front, card.back, card.reading, card.hanViet, card.note]
      .some(value => value?.toLowerCase().includes(q)));
  }, [cards, query]);
  const current = cards.find(card => card.id === currentId);
  const like = current && presentationCard(current);
  // Pasted rows reuse the deck import parser: Tab (Excel, Sheets), CSV, "front :: back" or JSON; a third column is the reading.
  const parsed = useMemo(() => {
    if (!bulk?.trim()) return null;
    try {
      const preview = parseTextImport(bulk, "paste.txt");
      // A deck with its own note types may not know the parser's "general" type: those cards take the type of the card on screen.
      const known = !noteTypes?.length || preview.cards.every(card => noteTypes.some(type => type.id === card.noteType));
      const base = current && presentationCard(current);
      return { cards: known || !base ? preview.cards : preview.cards.map(card => ({ ...card, kind: base.kind, noteType: base.noteType })), skipped: preview.skipped, error: "" };
    } catch (reason) {
      return { cards: [], skipped: 0, error: reason instanceof Error ? reason.message : "Không đọc được nội dung." };
    }
  }, [bulk, noteTypes, current]);

  const addAll = async () => {
    if (!parsed?.cards.length) return;
    setSaving(true);
    setError("");
    let done = 0;
    try {
      // shortcut: one request per card, fine for a paste of a few hundred rows; use a bulk endpoint if people paste thousands.
      for (const card of parsed.cards.filter(card => card.front.trim() && card.back.trim())) {
        await onSave(card, true);
        setBulkDone(++done);
      }
      setSaved(`Đã thêm ${done} thẻ vào phiên học.`);
      setBulk(null);
    } catch (reason) {
      // Cards already stored stay stored; the rest stay in the box so nothing typed is lost.
      setBulk(parsed.cards.slice(done).map(card => `${card.front}\t${card.back}${card.reading ? `\t${card.reading}` : ""}`).join("\n"));
      setError(`Đã thêm ${done} thẻ, dừng lại vì: ${reason instanceof Error ? reason.message : "lỗi không rõ"}. Các thẻ còn lại vẫn ở trong ô.`);
    } finally {
      setSaving(false);
      setBulkDone(0);
    }
  };

  const open = (card: ImportedCard, added: boolean) => { setDraft({ card, added }); setBulk(null); setError(""); setSaved(""); };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      await onSave(draft.card, draft.added);
      setSaved(draft.added ? `Đã thêm “${draft.card.front}” vào phiên học.` : `Đã lưu “${draft.card.front}”.`);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được thẻ.");
    } finally {
      setSaving(false);
    }
  };

  const editor = draft && <form className="study-card-list-editor" onSubmit={event => { event.preventDefault(); void save(); }}
    onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(null); } }}>
    <p className="study-eyebrow">{draft.added ? "Thẻ mới" : "Sửa thẻ"}</p>
    <CardFields key={draft.card.id} card={draft.card} noteTypes={noteTypes} onChange={card => setDraft({ ...draft, card })} compact showPreview={false} />
    {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
    <div className="flex gap-2">
      <button className="study-button study-button-primary !min-h-10" disabled={saving || !draft.card.front.trim() || !draft.card.back.trim()}>
        {saving ? "Đang lưu…" : draft.added ? "Thêm thẻ" : "Lưu"}
      </button>
      <button type="button" className="study-button !min-h-10" disabled={saving} onClick={() => setDraft(null)}>Hủy</button>
    </div>
  </form>;

  return <aside className="study-card-list" aria-label="Danh sách thẻ trong bộ">
    <div className="study-card-list-head">
      <div>
        <p className="study-eyebrow">Thẻ trong phiên</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{cards.length} thẻ</p>
      </div>
      <button className="study-session-tool" onClick={onClose} aria-label="Đóng danh sách thẻ" title="Đóng (L)"><X size={18} /></button>
    </div>

    <div className="study-card-list-tools">
      <button className="study-button study-button-primary !min-h-10" disabled={saving}
        onClick={() => open(blankCard(like), true)}>
        <Plus size={16} /> Thêm thẻ
      </button>
      <button className="study-button !min-h-10" disabled={saving} aria-pressed={bulk !== null} title="Dán nhiều dòng hoặc chọn file"
        onClick={() => { setDraft(null); setError(""); setSaved(""); setBulk(bulk === null ? "" : null); }}>
        <Upload size={16} /> Nhập nhiều
      </button>
    </div>
    <div className="study-card-list-tools">
      <label className="study-card-list-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong bộ…" aria-label="Tìm thẻ trong bộ" />
      </label>
    </div>
    <p role="status" className="min-h-5 px-4 text-xs text-[var(--color-success)]">{saved}</p>

    {draft?.added && editor}
    {bulk !== null && <form className="study-card-list-editor" onSubmit={event => { event.preventDefault(); void addAll(); }}
      onKeyDown={event => { if (event.key === "Escape" && !saving) { event.preventDefault(); event.stopPropagation(); setBulk(null); } }}>
      <p className="study-eyebrow">Nhập nhiều thẻ</p>
      <label className="text-sm">
        Mỗi dòng một thẻ: <b>mặt trước</b>, <b>mặt sau</b>, (cách đọc). Cả danh sách dùng cùng một kiểu ngăn cách: Tab, dấu phẩy hoặc “::”. Dán thẳng từ Excel, Google Sheets được.
        <textarea className="study-input mt-2 min-h-36 font-mono text-sm" value={bulk} disabled={saving} autoFocus
          placeholder={"猫\tcon mèo\tねこ\n犬 :: con chó"} onChange={event => setBulk(event.target.value)} />
      </label>
      <label className="study-button !min-h-9 w-fit cursor-pointer text-sm">
        Chọn file .csv / .txt / .json / .md
        <input type="file" accept=".csv,.tsv,.txt,.json,.md,.markdown,text/*,application/json" className="sr-only" disabled={saving}
          onChange={async event => { const file = event.target.files?.[0]; if (file) setBulk(await file.text()); event.target.value = ""; }} />
      </label>
      {parsed?.error && <p role="alert" className="text-sm text-[var(--color-error)]">{parsed.error}</p>}
      {parsed && !parsed.error && <div className="text-sm">
        <p className="text-[var(--color-text-secondary)]">Đọc được <b className="text-[var(--color-text)]">{parsed.cards.length}</b> thẻ{parsed.skipped ? ` · bỏ qua ${parsed.skipped} dòng thiếu nội dung` : ""}</p>
        <ul className="mt-1 space-y-0.5">
          {parsed.cards.slice(0, 5).map((card, i) => <li key={i} className="truncate"><span className="font-semibold">{card.front}</span> — {card.back}{card.reading ? ` (${card.reading})` : ""}</li>)}
          {parsed.cards.length > 5 && <li className="text-xs text-[var(--color-text-tertiary)]">… và {parsed.cards.length - 5} thẻ nữa</li>}
        </ul>
      </div>}
      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      <div className="flex gap-2">
        <button className="study-button study-button-primary !min-h-10" disabled={saving || !parsed?.cards.length}>
          {saving ? `Đang thêm ${bulkDone}/${parsed?.cards.length ?? 0}…` : `Thêm ${parsed?.cards.length ?? 0} thẻ`}
        </button>
        <button type="button" className="study-button !min-h-10" disabled={saving} onClick={() => setBulk(null)}>Hủy</button>
      </div>
    </form>}

    <ul className="study-card-list-items">
      {matches.slice(0, SHOWN).map(card => {
        const editing = draft && !draft.added && draft.card.id === card.id;
        return <li key={card.id} data-current={card.id === currentId || undefined}>
          {editing ? editor : <button className="study-card-list-row" onClick={() => open(presentationCard(card), false)} disabled={saving}
            aria-label={`Sửa thẻ ${card.front}${card.id === currentId ? ", thẻ đang học" : ""}`}>
            <span className="min-w-0 flex-1">
              <span className="study-card-list-front">{card.front}</span>
              <span className="study-card-list-back">{card.reading ? `${card.reading} · ` : ""}{card.back}</span>
            </span>
            {card.id === currentId && <span className="study-card-list-badge">Đang học</span>}
            <Pencil size={14} aria-hidden="true" className="shrink-0 opacity-50" />
          </button>}
        </li>;
      })}
      {!matches.length && <li className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">Không có thẻ nào khớp “{query}”.</li>}
      {matches.length > SHOWN && <li className="px-4 py-3 text-center text-xs text-[var(--color-text-tertiary)]">Đang hiện {SHOWN} / {matches.length} thẻ. Gõ để tìm thẻ khác.</li>}
    </ul>
  </aside>;
}
