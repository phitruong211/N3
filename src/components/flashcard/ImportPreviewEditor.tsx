import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, SlidersHorizontal } from "lucide-react";
import { remapImportPreview, type ImportField, type ImportPreview, type ImportTable } from "@/lib/ankiImport";
import { resolveFurigana } from "@/lib/furigana";
import { CardFields } from "./CardFields";
import { FuriganaText } from "./FuriganaText";
import { summarizeImport } from '@/lib/importSummary';

const fields: [ImportField, string][] = [
  ["front", "Mặt trước *"], ["back", "Mặt sau *"],
  ["reading", "Cách đọc mặt trước"], ["backReading", "Cách đọc mặt sau"],
  ["hanViet", "Hán Việt"], ["notes", "Ghi chú"], ["kind", "Loại thẻ"],
  ["tags", "Nhãn"], ["examples", "Ví dụ (JSON)"],
];

/** Maps source columns, previews ruby, and lets the user repair a card before import. */
export default function ImportPreviewEditor({ preview, onChange }: { preview: ImportPreview; onChange: (preview: ImportPreview) => void }) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const summary = summarizeImport(preview);
  const update = (id: string, change: Partial<ImportTable>) => {
    try {
      onChange(remapImportPreview(preview, (preview.tables || []).map((table) => table.id === id ? { ...table, ...change } : table)));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không áp dụng được ánh xạ");
    }
  };
  const replaceCard = (id: string, card: ImportPreview["cards"][number]) => {
    const row = preview.cards.findIndex((item) => item.id === id) + 1;
    const nextWarnings = (preview.warnings || []).filter((warning) => warning.cardId !== id);
    const frontWarning = resolveFurigana(card.front, card.reading).warning;
    const backWarning = resolveFurigana(card.back, card.backReading).warning;
    if (frontWarning) nextWarnings.push({ cardId: id, row, sheet: card.sourceSheet || "", reason: `Mặt trước: ${frontWarning}` });
    if (backWarning) nextWarnings.push({ cardId: id, row, sheet: card.sourceSheet || "", reason: `Mặt sau: ${backWarning}` });
    onChange({
      ...preview,
      cards: preview.cards.map((item) => item.id === id ? card : item),
      warnings: nextWarnings,
    });
  };

  return <section className="space-y-4" aria-label="Ánh xạ và xem trước nhập tệp">
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${summary.status === 'error' ? 'border-[var(--color-error)]/40 bg-[var(--color-error-subtle)]' : summary.status === 'warning' ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)]' : 'border-[var(--color-success)]/30 bg-[var(--color-success-subtle)]'}`}>
      {summary.status === 'success' ? <CheckCircle2 className="text-[var(--color-success)]" size={22} /> : <AlertTriangle className={summary.status === 'error' ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'} size={22}/>} 
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{summary.valid ? `Sẵn sàng nhập ${summary.valid} thẻ` : 'Chưa có thẻ hợp lệ'}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{preview.format} · {summary.skipped} dòng bỏ qua · {summary.duplicates} dòng trùng</p>
      </div>
    </div>

    <details className="rounded-xl border border-[var(--color-border)] p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]">
        <SlidersHorizontal size={18} /> Kiểm tra cột và tùy chọn nâng cao
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">Hệ thống đã tự nhận diện cột. Chỉ thay đổi khi bản xem trước phía dưới chưa đúng.</p>
        {preview.tables?.map((table) => {
          const width = table.rows.reduce((max, row) => Math.max(max, row.length), 0);
          const columns = Array.from({ length: width }, (_, index) => ({ index, label: table.hasHeader ? table.rows[0]?.[index] || `Cột ${index + 1}` : `Cột ${index + 1}` }));
          return <fieldset key={table.id} className="min-w-0 space-y-3 rounded-xl border border-[var(--color-border)] p-3">
            <legend className="px-1 font-semibold">{table.name || "Dữ liệu tệp"}</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label><input type="checkbox" checked={table.selected} onChange={(event) => update(table.id, { selected: event.target.checked })} /> Nhập trang tính này</label>
              <label><input type="checkbox" checked={table.hasHeader} onChange={(event) => update(table.id, { hasHeader: event.target.checked })} /> Dòng đầu là tiêu đề</label>
            </div>
            {table.selected && <>
              <div className="grid gap-3 sm:grid-cols-2">{fields.map(([field, label]) => <label key={field} className="flex flex-col gap-1 text-sm">{label}
                <select className="study-input" value={table.mapping[field] ?? ""} onChange={(event) => update(table.id, { mapping: { ...table.mapping, [field]: event.target.value === "" ? undefined : Number(event.target.value) } })}>
                  <option value="">Không dùng cột này</option>{columns.map((column) => <option key={column.index} value={column.index}>{column.index + 1}. {column.label.slice(0, 100)}</option>)}
                </select>
              </label>)}</div>
              {columns.filter((column) => !Object.values(table.mapping).includes(column.index)).map((column) => <label key={column.index} className="block break-words text-sm">
                <input type="checkbox" checked={table.extraColumns.includes(column.index)} onChange={(event) => update(table.id, { extraColumns: event.target.checked ? [...table.extraColumns, column.index] : table.extraColumns.filter((index) => index !== column.index) })} /> Lưu cột mở rộng: {column.label.slice(0, 100)}
              </label>)}
            </>}
          </fieldset>;
        })}
      </div>
    </details>

    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
    {!!preview.warnings?.length && <div className="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-subtle)] p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> {preview.warnings.length} cảnh báo furigana</p>
      <p className="mt-1 text-[var(--color-text-secondary)]">Thẻ vẫn được giữ. Bấm “Sửa thẻ” để dùng cú pháp Kanji[hiragana] khi cần.</p>
    </div>}

    <div className="space-y-3">
      <div><p className="font-semibold">Xem trước {summary.samples.length}/{preview.cards.length} thẻ</p><p className="text-xs text-[var(--color-text-secondary)]">Giữ bản đầu khi trùng cặp mặt trước / mặt sau.</p></div>
      {summary.samples.map((card, index) => {
        const warnings = preview.warnings?.filter((warning) => warning.cardId === card.id) || [];
        return <article key={card.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          {editingId === card.id ? <div className="space-y-3">
            <CardFields key={card.id} card={card} onChange={(next) => replaceCard(card.id, next)} compact />
            <button type="button" className="study-button study-button-primary" onClick={() => setEditingId(null)}>Xong</button>
          </div> : <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div><p className="study-eyebrow mb-2">{index + 1} · MẶT TRƯỚC</p><p lang="ja" className="font-jp whitespace-pre-wrap break-words text-lg leading-loose"><FuriganaText text={card.front} reading={card.reading} storedSegments={card.extraData?.frontFuriganaSegments} /></p></div>
            <div><p className="study-eyebrow mb-2">MẶT SAU</p><p lang="ja" className="font-jp whitespace-pre-wrap break-words text-lg leading-loose"><FuriganaText text={card.back} reading={card.backReading} storedSegments={card.extraData?.backFuriganaSegments} /></p></div>
            <button type="button" className="study-button self-start" onClick={() => setEditingId(card.id)}><Pencil size={16} /> Sửa thẻ</button>
            <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-3">{card.kind}{card.tags?.length ? ` · ${card.tags.join(", ")}` : ""}{card.sourceSheet ? ` · Sheet: ${card.sourceSheet}` : ""}</p>
            {warnings.map((warning, warningIndex) => <p key={warningIndex} className="text-xs text-[var(--color-warning)] sm:col-span-3">{warning.reason}</p>)}
          </div>}
        </article>;
      })}
    </div>
    {!!summary.groups.length && <details><summary className="cursor-pointer font-semibold">Lý do bỏ qua ({preview.issues?.length ?? 0})</summary><div className="mt-3 space-y-3 text-sm">{summary.groups.map(group => <div key={group.reason} className="rounded-lg bg-[var(--color-surface-alt)] p-3"><p className="font-semibold">{group.reason} · {group.count} dòng</p>{group.samples.map((issue, index) => <p key={index} className="mt-1 text-[var(--color-text-secondary)]">{issue.sheet ? `${issue.sheet} · ` : ''}Dòng {issue.row}</p>)}</div>)}</div></details>}
  </section>;
}
