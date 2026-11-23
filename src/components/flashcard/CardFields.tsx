import { useMemo, useRef, useState } from "react";
import type { ImportedCard } from "@/lib/ankiImport";
import { builtinNoteTypes, cardFromFields, exampleLines, fieldsFromCard, noteTypeIdForKind, parseExampleLines, type CardExample, type CardFieldValues, type NoteField, type NoteType } from "@/lib/deckFormat";
import { parseFuriganaMarkup } from "@/lib/furigana";
import { resizeTextRange } from "@/lib/cardFormatting";
import { FuriganaText } from "./FuriganaText";
import { StyleEditor } from "./StyleEditor";

// Relative sizes, so the word keeps its proportion when the deck's font size changes later.
const SIZE_BUTTONS = [[0.75, "Nhỏ", ".75rem"], [1.5, "Lớn", "1rem"], [2, "Rất lớn", "1.125rem"], [null, "Cỡ thường", ".875rem"]] as const;

function typeOf(card: ImportedCard, noteTypes: NoteType[]): NoteType {
  return noteTypes.find(type => type.id === card.noteType)
    ?? noteTypes.find(type => type.id === noteTypeIdForKind(card.kind))
    ?? noteTypes[0];
}

/** Edits a card through the fields of its note type; the card's front/back/reading/... are re-derived on every change. */
export function CardFields({
  card,
  onChange,
  noteTypes: provided,
  compact = false,
  showPreview = true,
}: {
  card: ImportedCard;
  onChange: (card: ImportedCard) => void;
  noteTypes?: NoteType[];
  compact?: boolean;
  showPreview?: boolean;
}) {
  const noteTypes = provided?.length ? provided : builtinNoteTypes();
  const type = typeOf(card, noteTypes);
  const [values, setValues] = useState<CardFieldValues>(() => fieldsFromCard(card));
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const initial = fieldsFromCard(card);
    return Object.fromEntries(type.fields.filter(field => field.type === "examples").map(field => [field.key, exampleLines(initial[field.key])]));
  });
  const warnings = useMemo(() => Object.fromEntries(type.fields
    .filter(field => field.type === "ruby" && typeof values[field.key] === "string")
    .map(field => [field.key, parseFuriganaMarkup(values[field.key] as string).warning])), [type, values]);
  const emit = (nextType: NoteType, nextValues: CardFieldValues) => onChange(cardFromFields(nextType, nextValues, { ...card, id: card.id }).card);
  const setField = (key: string, value: string | CardExample[]) => {
    const next = { ...values };
    if ((typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length)) delete next[key];
    else next[key] = value;
    setValues(next);
    emit(type, next);
  };
  const changeType = (id: string) => {
    const nextType = noteTypes.find(item => item.id === id);
    if (nextType) emit(nextType, values);
  };
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [active, setActive] = useState<string>();
  const resize = (key: string, em: number | null) => {
    const area = areas.current[key];
    if (!area) return;
    const next = resizeTextRange(area.value, area.selectionStart, area.selectionEnd, em);
    if (next.text === area.value) return;
    setField(key, next.text);
    requestAnimationFrame(() => area.setSelectionRange(next.start, next.end));
  };
  const label = (field: NoteField) => <>{field.label}{field.required && <span aria-hidden="true"> *</span>}</>;
  const wide = (field: NoteField) => field.key === "front" || field.key === "back";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
        Đặt hiragana trên Kanji bằng <code className="font-semibold text-[var(--color-text)]">学校[がっこう]</code>.
        Trường “Cách đọc” vẫn dùng được khi hệ thống ghép chắc chắn; cú pháp trong ngoặc vuông cho kết quả chính xác nhất.
        <span className="mt-2 block">Có thể nhập HTML để định dạng từng đoạn: <code>{'<b>In đậm</b>'}</code>, <code>{'<br>'}</code> xuống dòng, <code>{'<span style="color:#60a5fa">Chữ màu</span>'}</code>. Xem <a className="underline" href="/data/import-formatting-guide.md" target="_blank" rel="noreferrer">hướng dẫn và mẫu</a>.</span>
      </div>
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        {type.fields.map(field => field.type === "examples" ? (
          <label key={field.key} className={compact ? "" : "sm:col-span-2"}>
            {label(field)} <span className="text-xs text-[var(--color-text-secondary)]">(mỗi dòng: câu tiếng Nhật | cách đọc | nghĩa)</span>
            <textarea className="study-input mt-1 min-h-20" value={drafts[field.key] ?? ""}
              onChange={event => {
                setDrafts(previous => ({ ...previous, [field.key]: event.target.value }));
                setField(field.key, parseExampleLines(event.target.value).examples);
              }} />
            {parseExampleLines(drafts[field.key] ?? "").invalid > 0 && <span className="mt-1 block text-xs text-[var(--color-warning)]">{parseExampleLines(drafts[field.key] ?? "").invalid} dòng chưa đúng dạng nên bị bỏ qua.</span>}
          </label>
        ) : (
          <div key={field.key}>
            <label>
              {label(field)}
              <textarea ref={element => { areas.current[field.key] = element; }} onFocus={() => setActive(field.key)}
                className={`study-input mt-1 ${wide(field) ? "min-h-24" : ""}`} required={field.required} maxLength={field.type === "kana" ? 10000 : 20000}
                placeholder={field.type === "kana" ? "Chỉ nhập hiragana" : undefined}
                value={typeof values[field.key] === "string" ? values[field.key] as string : ""}
                onChange={event => setField(field.key, event.target.value)} />
              {warnings[field.key] && <span className="mt-1 block text-xs text-[var(--color-warning)]">{warnings[field.key]}</span>}
            </label>
            {active === field.key && <div role="group" aria-label={`Cỡ chữ trong ${field.label}`} className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {SIZE_BUTTONS.map(([em, text, preview]) => <button key={text} type="button" className="study-button hit !min-h-9 !px-3 !py-1" style={{ fontSize: preview }}
                // Keeps the field focused, so the selection and the phone keyboard survive the tap.
                onPointerDown={event => event.preventDefault()} onClick={() => resize(field.key, em)}>{text}</button>)}
              <span className="w-full text-xs text-[var(--color-text-tertiary)]">Bôi đen chữ cần đổi cỡ, hoặc đặt con trỏ vào một dòng để đổi cả dòng.{field.type === "ruby" && <> Có furigana thì ghi kiểu <code>猫[ねこ]</code> để furigana vẫn nằm trên chữ.</>}</span>
            </div>}
          </div>
        ))}
        {noteTypes.length > 1 && (
          <label>
            Loại thẻ
            <select className="study-input mt-1" value={type.id} onChange={event => changeType(event.target.value)}>
              {noteTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        <label>
          Tags (cách nhau bằng dấu phẩy)
          <input
            className="study-input mt-1"
            value={card.tags?.join(", ") || ""}
            onChange={(event) => onChange({ ...card, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
          />
        </label>
      </div>
      <details className="rounded-xl border border-[var(--color-border)] p-3">
        <summary className="cursor-pointer font-semibold">Giao diện riêng của thẻ này{card.style ? " · đã tùy chỉnh" : ""}</summary>
        <p className="mb-3 mt-2 text-xs text-[var(--color-text-secondary)]">Ghi đè giao diện của bộ thẻ chỉ cho thẻ này, ví dụ đổi màu hoặc font để đánh dấu một thẻ đặc biệt.</p>
        <StyleEditor label="Giao diện thẻ" value={card.style} onChange={style => { const { style: _drop, ...rest } = card; onChange(style ? { ...rest, style } : rest); }} />
      </details>
      {showPreview && (
        <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
          {(["front", "back"] as const).map((side) => (
            <div key={side} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="study-eyebrow mb-3">XEM TRƯỚC {side === "front" ? "MẶT TRƯỚC" : "MẶT SAU"}</p>
              <p lang="ja" className="font-jp whitespace-pre-wrap break-words text-xl leading-loose">
                <FuriganaText
                  text={card[side]}
                  reading={side === "front" ? card.reading : card.backReading}
                  storedSegments={side === "front" ? card.extraData?.frontFuriganaSegments : card.extraData?.backFuriganaSegments}
                />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
