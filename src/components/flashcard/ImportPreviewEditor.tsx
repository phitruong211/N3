import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Plus, SlidersHorizontal } from '@/components/ui/icons';
import {
  assignImportColumn,
  remapImportPreview,
  setImportTableHeader,
  setImportTableNoteType,
  type ImportPreview,
  type ImportTable,
} from "@/lib/ankiImport";
import { cardFromFields, mergeSideStyle, resolveTemplate, type NoteType } from "@/lib/deckFormat";
import { surfaceStyle } from "@/lib/cardSurface";
import { cloneNoteType } from "@/lib/noteTypeEdit";
import { summarizeImport } from "@/lib/importSummary";
import { CardFields } from "./CardFields";
import { CardFace } from "./CardPresentation";
import { NoteTypeEditor } from "./NoteTypeEditor";
import { StyleEditor } from "./StyleEditor";

/** Maps file columns to the fields of a note type and shows the cards that will be created. */
export default function ImportPreviewEditor({ preview, onChange }: { preview: ImportPreview; onChange: (preview: ImportPreview) => void }) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<string | null>(null);
  const summary = summarizeImport(preview);
  const typeById = (id: string | undefined) => preview.noteTypes.find(type => type.id === id) ?? preview.noteTypes[0];
  const config = { version: 5 as const, ...(preview.style ? { style: preview.style } : {}), noteTypes: preview.noteTypes };

  const apply = (tables: ImportTable[] | undefined, noteTypes: NoteType[] = preview.noteTypes) => {
    try {
      onChange(tables ? remapImportPreview(preview, tables, noteTypes) : { ...preview, noteTypes });
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không áp dụng được bố cục thẻ");
    }
  };
  const replaceTable = (id: string, next: ImportTable) => apply((preview.tables || []).map(table => table.id === id ? next : table));
  const changeNoteType = (next: NoteType) => apply(preview.tables, preview.noteTypes.map(type => type.id === next.id ? next : type));
  const addNoteType = (table: ImportTable) => {
    const copy = cloneNoteType(typeById(table.noteTypeId), preview.noteTypes.map(type => type.id));
    const noteTypes = [...preview.noteTypes, copy];
    setEditingType(copy.id);
    apply((preview.tables || []).map(item => item.id === table.id ? setImportTableNoteType(item, copy.id, noteTypes) : item), noteTypes);
  };
  const replaceCard = (id: string, card: ImportPreview["cards"][number]) => {
    const row = preview.cards.findIndex(item => item.id === id) + 1;
    const nextWarnings = (preview.warnings || []).filter(warning => warning.cardId !== id);
    for (const warning of cardFromFields(typeById(card.noteType), card.fields ?? {}, { id }).warnings) nextWarnings.push({ cardId: id, row, sheet: card.sourceSheet || "", reason: `${warning.label}: ${warning.reason}` });
    onChange({ ...preview, cards: preview.cards.map(item => item.id === id ? card : item), warnings: nextWarnings });
  };

  return <section className="space-y-5" aria-label="Sắp xếp trường và xem trước thẻ">
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${summary.status === "error" ? "border-[var(--color-error)]/40 bg-[var(--color-error-subtle)]" : summary.status === "warning" ? "border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)]" : "border-[var(--color-success)]/30 bg-[var(--color-success-subtle)]"}`}>
      {summary.status === "success" ? <CheckCircle2 className="text-[var(--color-success)]" size={22} /> : <AlertTriangle className={summary.status === "error" ? "text-[var(--color-error)]" : "text-[var(--color-warning)]"} size={22} />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{summary.valid ? `Sẵn sàng nhập ${summary.valid} thẻ` : "Chưa có thẻ hợp lệ"}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{preview.format} · {summary.skipped} dòng bỏ qua · {summary.duplicates} dòng trùng</p>
      </div>
    </div>

    <div className="space-y-4">
      <div>
        <p className="font-semibold">{preview.tables ? "Đặt cột vào trường của thẻ" : "Loại thẻ trong tệp"}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{preview.tables
          ? "Mỗi cột của tệp đi vào một trường. Cột chưa nhận diện được giữ lại thành trường riêng; bạn có thể đổi trường, đổi loại thẻ hoặc chỉnh các trường ngay tại đây."
          : "Tệp .sonhat.json mang sẵn cấu trúc loại thẻ. Bạn vẫn có thể chỉnh loại thẻ trước khi lưu."}</p>
      </div>
      {preview.tables?.map(table => {
        const type = typeById(table.noteTypeId);
        const sample = table.rows[table.hasHeader ? 1 : 0] || [];
        const mapped = new Set(table.columns.map(column => column.target));
        const mappedFront = mapped.has("front"), mappedBack = mapped.has("back");
        return <fieldset key={table.id} className="min-w-0 space-y-4 rounded-xl border border-[var(--color-border)] p-4">
          <legend className="px-1 font-semibold">{table.name || "Dữ liệu tệp"}</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={table.selected} onChange={event => replaceTable(table.id, { ...table, selected: event.target.checked })} /> Nhập dữ liệu này</label>
          {table.selected && <>
            {(!mappedFront || !mappedBack) && <p role="alert" className="rounded-lg bg-[var(--color-error-subtle)] px-3 py-2 text-sm text-[var(--color-error)]">Cần ít nhất một cột cho “{type.fields.find(field => field.key === "front")?.label}” và một cột cho “{type.fields.find(field => field.key === "back")?.label}”.</p>}
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-48 flex-1 text-sm">Loại thẻ
                <select className="study-input mt-1" value={type.id} onChange={event => replaceTable(table.id, setImportTableNoteType(table, event.target.value, preview.noteTypes))}>
                  {preview.noteTypes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <button type="button" className="study-button" aria-expanded={editingType === type.id} onClick={() => setEditingType(editingType === type.id ? null : type.id)}><SlidersHorizontal size={16} /> Chỉnh loại thẻ</button>
              <button type="button" className="study-button" onClick={() => addNoteType(table)}><Plus size={16} /> Loại thẻ mới</button>
            </div>
            {editingType === type.id && <div className="rounded-xl border border-[var(--color-border)] p-4"><NoteTypeEditor type={type} deckStyle={preview.style} onChange={changeNoteType} /></div>}
            <div className="space-y-2">
              {table.columns.map(column => <div key={column.key} className="grid gap-3 rounded-xl bg-[var(--color-surface-alt)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{column.label}</p>{column.suggested && <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-xs text-[var(--color-accent)]">Đã nhận diện</span>}</div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-[var(--color-text-secondary)]">{sample[column.column] || "Không có dữ liệu mẫu"}</p>
                </div>
                <label className="text-sm"><span className="sr-only">Trường cho {column.label}</span>
                  <select className="study-input" value={type.fields.some(field => field.key === column.target) || column.target.startsWith("@") ? column.target : "ignore"} onChange={event => replaceTable(table.id, assignImportColumn(table, column.key, event.target.value))}>
                    {type.fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
                    <option value="@type">Loại thẻ theo từng dòng</option>
                    <option value="@tags">Nhãn</option>
                    <option value="ignore">Không nhập</option>
                  </select>
                </label>
              </div>)}
            </div>
            <details className="rounded-lg border border-[var(--color-border)] px-3 py-2"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[var(--color-accent)]"><SlidersHorizontal size={16} /> Tùy chọn tệp</summary><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={table.hasHeader} onChange={event => replaceTable(table.id, setImportTableHeader(table, event.target.checked))} /> Dòng đầu là tên trường</label></details>
          </>}
        </fieldset>;
      })}
      {!preview.tables && preview.noteTypes.map(type => <details key={type.id} className="rounded-xl border border-[var(--color-border)] p-4">
        <summary className="cursor-pointer font-semibold">{type.name} · {preview.cards.filter(card => card.noteType === type.id).length} thẻ · {type.fields.length} trường</summary>
        <div className="mt-4"><NoteTypeEditor type={type} deckStyle={preview.style} onChange={changeNoteType} /></div>
      </details>)}
    </div>

    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
    {!!preview.warnings?.length && <div className="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> {preview.warnings.length} cảnh báo furigana</p><p className="mt-1 text-[var(--color-text-secondary)]">Thẻ vẫn được giữ. Viết Kanji[hiragana] ngay sau chữ Kanji để cách đọc nằm đúng phía trên.</p></div>}

    <details className="rounded-xl border border-[var(--color-border)] p-4" open>
      <summary className="cursor-pointer font-semibold">Giao diện bộ thẻ: font, màu, cỡ chữ</summary>
      <p className="mb-3 mt-2 text-sm text-[var(--color-text-secondary)]">Áp dụng cho cả bộ ngay khi nhập; các thẻ bên dưới đổi theo. Loại thẻ, từng mặt, từng trường và từng thẻ có thể ghi đè riêng sau này.</p>
      <StyleEditor label="Giao diện cả bộ" value={preview.style} onChange={style => onChange({ ...preview, style })} />
    </details>

    <div className="space-y-3">
      <div><p className="font-semibold">Thẻ sau khi nhập</p><p className="text-xs text-[var(--color-text-secondary)]">Bản xem trước dùng cùng bố cục với lúc học.</p></div>
      {summary.samples.map((card, index) => {
        const warnings = preview.warnings?.filter(warning => warning.cardId === card.id) || [];
        const template = resolveTemplate(config, card.noteType);
        const type = typeById(card.noteType);
        const cardStyle = (side: "front" | "back") => surfaceStyle(mergeSideStyle(template[side].style, card.style));
        return <article key={card.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {editingId === card.id ? <div className="space-y-3"><CardFields key={card.id} card={card} noteTypes={preview.noteTypes} onChange={next => replaceCard(card.id, next)} compact /><button type="button" className="study-button study-button-primary" onClick={() => setEditingId(null)}>Xong</button></div> : <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="min-w-0 rounded-xl bg-[var(--color-surface-alt)] p-4" style={cardStyle("front")}><p className="study-eyebrow mb-3">{index + 1} · MẶT TRƯỚC</p><CardFace card={card} deckName={preview.name} fields={template.front.fields} template={template} side="front" compact /></div>
            <div className="min-w-0 rounded-xl bg-[var(--color-surface-alt)] p-4" style={cardStyle("back")}><p className="study-eyebrow mb-3">MẶT SAU</p><CardFace card={card} deckName={preview.name} fields={template.back.fields} template={template} side="back" compact /></div>
            <button type="button" className="study-button self-start" onClick={() => setEditingId(card.id)}><Pencil size={16} /> Sửa thẻ</button>
            <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-3">{type.name}{card.tags?.length ? ` · ${card.tags.join(", ")}` : ""}{card.sourceSheet ? ` · Sheet: ${card.sourceSheet}` : ""}</p>
            {warnings.map((warning, warningIndex) => <p key={warningIndex} className="text-xs text-[var(--color-warning)] sm:col-span-3">{warning.reason}</p>)}
          </div>}
        </article>;
      })}
    </div>
    {!!summary.groups.length && <details><summary className="cursor-pointer font-semibold">Lý do bỏ qua ({preview.issues?.length ?? 0})</summary><div className="mt-3 space-y-3 text-sm">{summary.groups.map(group => <div key={group.reason} className="rounded-lg bg-[var(--color-surface-alt)] p-3"><p className="font-semibold">{group.reason} · {group.count} dòng</p>{group.samples.map((issue, index) => <p key={index} className="mt-1 text-[var(--color-text-secondary)]">{issue.sheet ? `${issue.sheet} · ` : ""}Dòng {issue.row}</p>)}</div>)}</div></details>}
  </section>;
}
