import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Pencil, SlidersHorizontal } from '@/components/ui/icons';
import {
  assignImportSourceField,
  defaultDeckTemplate,
  importSourceFields,
  moveImportSourceField,
  remapImportPreview,
  setImportTableHeader,
  type ImportDestination,
  type ImportPreview,
  type ImportTable,
} from "@/lib/ankiImport";
import { resolveFurigana } from "@/lib/furigana";
import { summarizeImport } from "@/lib/importSummary";
import { CardFields } from "./CardFields";
import { CardFace } from "./CardPresentation";

const destinations: Array<[ImportDestination, string]> = [
  ["front", "Mặt trước"],
  ["back", "Mặt sau"],
  ["frontReading", "Cách đọc mặt trước"],
  ["backReading", "Cách đọc mặt sau"],
  ["hanViet", "Hán Việt"],
  ["notes", "Ghi chú"],
  ["kind", "Loại thẻ"],
  ["tags", "Nhãn"],
  ["examples", "Ví dụ có cấu trúc"],
  ["ignore", "Không nhập"],
];

/** Lets users compose both card faces directly from the source fields. */
export default function ImportPreviewEditor({ preview, onChange }: { preview: ImportPreview; onChange: (preview: ImportPreview) => void }) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const summary = summarizeImport(preview);
  const applyTables = (tables: ImportTable[]) => {
    try {
      onChange(remapImportPreview(preview, tables));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không áp dụng được bố cục thẻ");
    }
  };
  const replaceTable = (id: string, next: ImportTable) => applyTables((preview.tables || []).map(table => table.id === id ? next : table));
  const updateTable = (id: string, change: Partial<ImportTable>) => applyTables((preview.tables || []).map(table => table.id === id ? { ...table, ...change } : table));
  const replaceCard = (id: string, card: ImportPreview["cards"][number]) => {
    const row = preview.cards.findIndex(item => item.id === id) + 1;
    const nextWarnings = (preview.warnings || []).filter(warning => warning.cardId !== id);
    const frontWarning = resolveFurigana(card.front, card.reading).warning;
    const backWarning = resolveFurigana(card.back, card.backReading).warning;
    if (frontWarning) nextWarnings.push({ cardId: id, row, sheet: card.sourceSheet || "", reason: `Mặt trước: ${frontWarning}` });
    if (backWarning) nextWarnings.push({ cardId: id, row, sheet: card.sourceSheet || "", reason: `Mặt sau: ${backWarning}` });
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
        <p className="font-semibold">Đặt nội dung lên thẻ</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Trường đầu tiên được đặt ở mặt trước. Các trường còn lại ở mặt sau; bạn có thể đổi vị trí hoặc thứ tự ngay tại đây.</p>
      </div>
      {preview.tables?.map(table => {
        const sourceFields = importSourceFields(table);
        const sampleRow = table.rows[table.hasHeader ? 1 : 0] || [];
        const frontCount = sourceFields.filter(field => field.destination === "front").length;
        const backCount = sourceFields.filter(field => field.destination === "back").length;
        return <fieldset key={table.id} className="min-w-0 space-y-4 rounded-xl border border-[var(--color-border)] p-4">
          <legend className="px-1 font-semibold">{table.name || "Dữ liệu tệp"}</legend>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={table.selected} onChange={event => updateTable(table.id, { selected: event.target.checked })} /> Nhập dữ liệu này</label>
          {table.selected && <>
            {(!frontCount || !backCount) && <p role="alert" className="rounded-lg bg-[var(--color-error-subtle)] px-3 py-2 text-sm text-[var(--color-error)]">Mỗi thẻ cần ít nhất một trường ở mặt trước và một trường ở mặt sau.</p>}
            <div className="space-y-2">
              {sourceFields.map(field => {
                const faceGroup = sourceFields.filter(item => item.destination === field.destination).sort((a, b) => a.order - b.order);
                const position = faceGroup.findIndex(item => item.key === field.key);
                const canOrder = field.destination === "front" || field.destination === "back";
                return <div key={field.key} className="grid gap-3 rounded-xl bg-[var(--color-surface-alt)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.8fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{field.label}</p>{field.suggested && <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-xs text-[var(--color-accent)]">Đã nhận diện</span>}</div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-[var(--color-text-secondary)]">{sampleRow[field.column] || "Không có dữ liệu mẫu"}</p>
                  </div>
                  <label className="text-sm"><span className="sr-only">Vị trí cho {field.label}</span><select className="study-input" value={field.destination} onChange={event => replaceTable(table.id, assignImportSourceField(table, field.key, event.target.value as ImportDestination))}>{destinations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <div className="flex items-center gap-1" aria-label={`Thứ tự ${field.label}`}>
                    {canOrder ? <>
                      <button type="button" className="study-button !min-h-10 !px-3" disabled={position <= 0} aria-label={`Đưa ${field.label} lên`} onClick={() => replaceTable(table.id, moveImportSourceField(table, field.key, -1))}><ArrowUp size={16} /></button>
                      <button type="button" className="study-button !min-h-10 !px-3" disabled={position < 0 || position >= faceGroup.length - 1} aria-label={`Đưa ${field.label} xuống`} onClick={() => replaceTable(table.id, moveImportSourceField(table, field.key, 1))}><ArrowDown size={16} /></button>
                    </> : <span className="px-2 text-xs text-[var(--color-text-secondary)]">Thông tin phụ</span>}
                  </div>
                </div>;
              })}
            </div>
            <details className="rounded-lg border border-[var(--color-border)] px-3 py-2"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[var(--color-accent)]"><SlidersHorizontal size={16} /> Tùy chọn tệp</summary><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={table.hasHeader} onChange={event => replaceTable(table.id, setImportTableHeader(table, event.target.checked))} /> Dòng đầu là tên trường</label></details>
          </>}
        </fieldset>;
      })}
    </div>

    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
    {!!preview.warnings?.length && <div className="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> {preview.warnings.length} cảnh báo furigana</p><p className="mt-1 text-[var(--color-text-secondary)]">Thẻ vẫn được giữ. Viết Kanji[hiragana] ngay sau chữ Kanji để cách đọc nằm đúng phía trên.</p></div>}

    <div className="space-y-3">
      <div><p className="font-semibold">Thẻ sau khi nhập</p><p className="text-xs text-[var(--color-text-secondary)]">Bản xem trước dùng cùng bố cục với lúc học.</p></div>
      {summary.samples.map((card, index) => {
        const warnings = preview.warnings?.filter(warning => warning.cardId === card.id) || [];
        const template = defaultDeckTemplate();
        return <article key={card.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {editingId === card.id ? <div className="space-y-3"><CardFields key={card.id} card={card} onChange={next => replaceCard(card.id, next)} compact /><button type="button" className="study-button study-button-primary" onClick={() => setEditingId(null)}>Xong</button></div> : <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="min-w-0 rounded-xl bg-[var(--color-surface-alt)] p-4"><p className="study-eyebrow mb-3">{index + 1} · MẶT TRƯỚC</p><CardFace card={card} deckName={preview.name} fields={["front", "reading"]} template={template} side="front" compact /></div>
            <div className="min-w-0 rounded-xl bg-[var(--color-surface-alt)] p-4"><p className="study-eyebrow mb-3">MẶT SAU</p><CardFace card={card} deckName={preview.name} fields={["back", "reading"]} template={template} side="back" compact /></div>
            <button type="button" className="study-button self-start" onClick={() => setEditingId(card.id)}><Pencil size={16} /> Sửa thẻ</button>
            <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-3">{card.kind}{card.tags?.length ? ` · ${card.tags.join(", ")}` : ""}{card.sourceSheet ? ` · Sheet: ${card.sourceSheet}` : ""}</p>
            {warnings.map((warning, warningIndex) => <p key={warningIndex} className="text-xs text-[var(--color-warning)] sm:col-span-3">{warning.reason}</p>)}
          </div>}
        </article>;
      })}
    </div>
    {!!summary.groups.length && <details><summary className="cursor-pointer font-semibold">Lý do bỏ qua ({preview.issues?.length ?? 0})</summary><div className="mt-3 space-y-3 text-sm">{summary.groups.map(group => <div key={group.reason} className="rounded-lg bg-[var(--color-surface-alt)] p-3"><p className="font-semibold">{group.reason} · {group.count} dòng</p>{group.samples.map((issue, index) => <p key={index} className="mt-1 text-[var(--color-text-secondary)]">{issue.sheet ? `${issue.sheet} · ` : ""}Dòng {issue.row}</p>)}</div>)}</div></details>}
  </section>;
}
