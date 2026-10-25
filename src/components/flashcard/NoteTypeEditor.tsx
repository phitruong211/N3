import { ArrowDown, ArrowUp, Plus, X } from "@/components/ui/icons";
import type { FieldType, NoteKind, NoteType } from "@/lib/deckFormat";
import type { StyleSpec } from "@/lib/deckFormat";
import { layered } from "@/lib/styleEdit";
import { StyleEditor } from "./StyleEditor";
import { addNoteTypeField, faceChoices, isFixedField, moveFaceField, moveNoteTypeField, removeNoteTypeField, renameNoteType, setFaceField, setNoteTypeKind, updateNoteTypeField } from "@/lib/noteTypeEdit";

const KIND_LABELS: Record<NoteKind, string> = { VOCABULARY: "Từ vựng", KANJI: "Kanji", GRAMMAR: "Ngữ pháp", GENERAL: "Tổng hợp" };
const TYPE_LABELS: Record<FieldType, string> = { text: "Văn bản", ruby: "Văn bản có furigana", kana: "Cách đọc (kana)", examples: "Ví dụ" };

/** Edits the fields of one note type and which of them each side of the card shows. */
export function NoteTypeEditor({ type, deckStyle, onChange }: { type: NoteType; deckStyle?: StyleSpec; onChange: (type: NoteType) => void }) {
  const typeBase = layered(deckStyle, type.style);
  const choices = faceChoices(type);
  const labelOf = (key: string) => choices.find(choice => choice.key === key)?.label ?? key;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <label>Tên loại thẻ<input className="study-input mt-1" maxLength={60} value={type.name} onChange={event => onChange(renameNoteType(type, event.target.value))} /></label>
      <label>Nhóm<select className="study-input mt-1" value={type.kind} onChange={event => onChange(setNoteTypeKind(type, event.target.value as NoteKind))}>
        {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>

    <details className="rounded-xl border border-[var(--color-border)] p-3">
      <summary className="cursor-pointer font-semibold">Giao diện của loại thẻ này</summary>
      <div className="mt-3"><StyleEditor label="Giao diện loại thẻ" value={type.style} inherited={deckStyle} onChange={style => onChange({ ...type, style })} /></div>
    </details>

    <section aria-label="Các trường" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold">Các trường ({type.fields.length}/24)</h4>
        <button type="button" className="study-button" disabled={type.fields.length >= 24} onClick={() => onChange(addNoteTypeField(type))}><Plus size={16} /> Thêm trường</button>
      </div>
      {type.fields.map((field, index) => <div key={field.key} className="grid gap-2 rounded-xl bg-[var(--color-surface-alt)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto] sm:items-center">
        <label className="min-w-0"><span className="sr-only">Tên trường {field.key}</span>
          <input className="study-input" maxLength={60} value={field.label} onChange={event => onChange(updateNoteTypeField(type, field.key, { label: event.target.value }))} />
          <span className="mt-1 block truncate text-xs text-[var(--color-text-secondary)]">Mã: {field.key}{field.for ? ` · đọc của ${labelOf(field.for)}` : ""}{isFixedField(field.key) ? " · bắt buộc" : ""}</span>
        </label>
        <label><span className="sr-only">Kiểu của {field.label}</span>
          <select className="study-input" value={field.type}
            onChange={event => onChange(updateNoteTypeField(type, field.key, { type: event.target.value as FieldType }))}>
            {(Object.keys(TYPE_LABELS) as FieldType[]).filter(value => !isFixedField(field.key) || value === "text" || value === "ruby").map(value => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          {!isFixedField(field.key) && <label className="mr-2 flex items-center gap-1 text-xs"><input type="checkbox" checked={field.required === true} onChange={event => onChange(updateNoteTypeField(type, field.key, { required: event.target.checked }))} />Bắt buộc</label>}
          <button type="button" className="study-button !min-h-10 !px-3" disabled={index === 0} aria-label={`Đưa ${field.label} lên`} onClick={() => onChange(moveNoteTypeField(type, field.key, -1))}><ArrowUp size={16} /></button>
          <button type="button" className="study-button !min-h-10 !px-3" disabled={index === type.fields.length - 1} aria-label={`Đưa ${field.label} xuống`} onClick={() => onChange(moveNoteTypeField(type, field.key, 1))}><ArrowDown size={16} /></button>
          <button type="button" className="study-button !min-h-10 !px-3" disabled={isFixedField(field.key)} aria-label={`Xóa trường ${field.label}`} onClick={() => onChange(removeNoteTypeField(type, field.key))}><X size={16} /></button>
        </div>
        {field.type !== "examples" && <details className="sm:col-span-3">
          <summary className="cursor-pointer text-sm text-[var(--color-accent)]">Giao diện trường “{field.label}”{field.style ? " · đã tùy chỉnh" : ""}</summary>
          <div className="mt-2"><StyleEditor scope="field" label={`Giao diện trường ${field.label}`} value={field.style} inherited={layered(typeBase, type.back.style)} onChange={style => onChange({ ...type, fields: type.fields.map(item => item.key === field.key ? (({ style: _drop, ...rest }) => style ? { ...rest, style } : rest)(item) : item) })} /></div>
        </details>}
      </div>)}
    </section>

    {(["front", "back"] as const).map(side => <section key={side} aria-label={side === "front" ? "Mặt trước" : "Mặt sau"} className="space-y-2">
      <h4 className="font-semibold">{side === "front" ? "Mặt trước hiện" : "Mặt sau hiện"}</h4>
      <ul className="space-y-1">
        {type[side].show.map((key, index) => <li key={key} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--color-surface-alt)] px-3 py-2">
          <span className="min-w-0 truncate">{labelOf(key)}</span>
          <span className="flex gap-1">
            <button type="button" className="study-button !p-1.5" disabled={index === 0} aria-label={`Đưa ${labelOf(key)} lên ở ${side === "front" ? "mặt trước" : "mặt sau"}`} onClick={() => onChange(moveFaceField(type, side, key, -1))}><ArrowUp size={14} /></button>
            <button type="button" className="study-button !p-1.5" disabled={index === type[side].show.length - 1} aria-label={`Đưa ${labelOf(key)} xuống ở ${side === "front" ? "mặt trước" : "mặt sau"}`} onClick={() => onChange(moveFaceField(type, side, key, 1))}><ArrowDown size={14} /></button>
            <button type="button" className="study-button !p-1.5" disabled={type[side].show.length === 1} aria-label={`Ẩn ${labelOf(key)} ở ${side === "front" ? "mặt trước" : "mặt sau"}`} onClick={() => onChange(setFaceField(type, side, key, false))}><X size={14} /></button>
          </span>
        </li>)}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm text-[var(--color-accent)]">Giao diện {side === "front" ? "mặt trước" : "mặt sau"}{type[side].style ? " · đã tùy chỉnh" : ""}</summary>
        <div className="mt-2"><StyleEditor label={`Giao diện ${side === "front" ? "mặt trước" : "mặt sau"}`} value={type[side].style} inherited={typeBase} onChange={style => onChange({ ...type, [side]: (({ style: _drop, ...rest }) => style ? { ...rest, style } : rest)(type[side]) })} /></div>
      </details>
      {choices.some(choice => !type[side].show.includes(choice.key)) && <label className="block text-sm">Thêm trường vào {side === "front" ? "mặt trước" : "mặt sau"}
        <select className="study-input mt-1" value="" onChange={event => event.target.value && onChange(setFaceField(type, side, event.target.value, true))}>
          <option value="">Chọn trường…</option>
          {choices.filter(choice => !type[side].show.includes(choice.key)).map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
        </select>
      </label>}
    </section>)}
  </div>;
}
