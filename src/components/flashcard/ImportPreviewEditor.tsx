import { useState } from 'react';
import { remapImportPreview, type ImportField, type ImportPreview, type ImportTable } from '../../lib/ankiImport';

const fields: [ImportField, string][] = [['front', 'Mặt trước *'], ['back', 'Mặt sau *'], ['reading', 'Cách đọc'], ['notes', 'Ghi chú'], ['kind', 'Loại thẻ'], ['tags', 'Tags']];
/** Local mapping and sheet editor. onChange returns the complete replacement preview; no API calls. */
export default function ImportPreviewEditor({ preview, onChange }: { preview: ImportPreview; onChange: (preview: ImportPreview) => void }) {
  const [error, setError] = useState('');
  const update = (id: string, change: Partial<ImportTable>) => {
    try { onChange(remapImportPreview(preview, (preview.tables || []).map(t => t.id === id ? { ...t, ...change } : t))); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không áp dụng được ánh xạ'); }
  };
  return <section className="space-y-4" aria-label="Ánh xạ và xem trước nhập tệp">
    <p className="text-sm">Kiểm tra ánh xạ trước khi xác nhận. Cột mở rộng chỉ được lưu khi bạn chọn duyệt bên dưới.</p>
    {preview.tables?.map(tab => {
      const width = tab.rows.reduce((max, row) => Math.max(max, row.length), 0);
      const columns = Array.from({ length: width }, (_, i) => ({ index: i, label: tab.hasHeader ? tab.rows[0]?.[i] || `Cột ${i + 1}` : `Cột ${i + 1}` }));
      return <fieldset key={tab.id} className="rounded-xl border border-slate-300 p-3 space-y-3 min-w-0">
        <legend className="px-1 font-semibold">{tab.name || 'Dữ liệu tệp'}</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label><input type="checkbox" checked={tab.selected} onChange={e => update(tab.id, { selected: e.target.checked })} /> Nhập sheet này</label>
          <label><input type="checkbox" checked={tab.hasHeader} onChange={e => update(tab.id, { hasHeader: e.target.checked })} /> Dòng đầu là tiêu đề</label>
        </div>
        {tab.selected && <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{fields.map(([field, label]) => <label key={field} className="text-sm flex flex-col gap-1">{label}
            <select className="rounded-lg border border-slate-300 p-2 bg-white text-slate-900 max-w-full" value={tab.mapping[field] ?? ''} onChange={e => update(tab.id, { mapping: { ...tab.mapping, [field]: e.target.value === '' ? undefined : Number(e.target.value) } })}>
              <option value="">Không ánh xạ</option>{columns.map(c => <option key={c.index} value={c.index}>{c.index + 1}. {c.label.slice(0, 100)}</option>)}
            </select>
          </label>)}</div>
          {columns.filter(c => !Object.values(tab.mapping).includes(c.index)).map(c => <label key={c.index} className="block text-sm break-words">
            <input type="checkbox" checked={tab.extraColumns.includes(c.index)} onChange={e => update(tab.id, { extraColumns: e.target.checked ? [...tab.extraColumns, c.index] : tab.extraColumns.filter(i => i !== c.index) })} /> Duyệt cột mở rộng: {c.label.slice(0, 100)}
            <span className="block text-xs text-slate-500 ml-4">Mẫu: {(tab.rows[tab.hasHeader ? 1 : 0]?.[c.index] || '(trống)').slice(0, 200)}</span>
          </label>)}
        </>}
      </fieldset>;
    })}
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <p className="font-medium">{preview.cards.length} thẻ hợp lệ · {preview.skipped} dòng bỏ qua · {preview.duplicates || 0} dòng trùng</p>
    <p className="text-xs text-slate-500">Mẫu {Math.min(10, preview.cards.length)}/{preview.cards.length} thẻ. Giữ bản đầu khi trùng cặp mặt trước / mặt sau.</p>
    <div className="space-y-2">{preview.cards.slice(0, 10).map((card, i) => <div key={card.id} className="rounded-lg border border-slate-200 p-3 text-sm whitespace-pre-wrap break-words">
      <strong>{i + 1}. {card.front}</strong><p>{card.back}</p>{card.reading && <p>{card.reading}</p>}{card.notes && <p className="text-slate-500">Ghi chú: {card.notes}</p>}
      <p className="text-xs text-slate-500">{card.kind}{card.tags?.length ? ` · ${card.tags.join(', ')}` : ''}{card.sourceSheet ? ` · Sheet: ${card.sourceSheet}` : ''}</p>
      {card.extraData && <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(card.extraData, null, 2)}</pre>}
    </div>)}</div>
    {!!preview.issues?.length && <details><summary className="cursor-pointer">Lý do bỏ qua ({preview.issues.length})</summary><div className="max-h-60 overflow-auto text-sm">{preview.issues.map((issue, i) => <p key={i}>{issue.sheet ? `${issue.sheet} · ` : ''}Dòng {issue.row}: {issue.reason}</p>)}</div></details>}
  </section>;
}
