import { useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import { Download } from '@/components/ui/icons';
import { getDeck } from '@/lib/api';
import { asImported, type PersonalDeck } from '@/lib/deckApi';
import { buildDeckFile, exportJson, exportTables, toCsv, toXlsx } from '@/lib/deckExport';
import { normalizeConfig } from '@/lib/deckFormat';
import { downloadFile, safeFileName } from '@/lib/download';

type Format = 'json' | 'csv' | 'xlsx';

/** Exports one deck to .sonhat.json (everything), CSV or XLSX (content only). */
export function DeckExportDialog({ deck, onClose }: { deck: PersonalDeck; onClose: () => void }) {
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(format: Format) {
    if (busy) return;
    setBusy(format); setError(''); setNotice('');
    try {
      const response = await getDeck(deck.id);
      const config = normalizeConfig(response.deck.templateConfig);
      const file = buildDeckFile({ name: deck.name, description: deck.description, tags: deck.tags }, config, response.cards.map(card => asImported(card as never, config)));
      const base = safeFileName(deck.name);
      if (format === 'json') downloadFile(`${base}.sonhat.json`, exportJson(file), 'application/json');
      else {
        const tables = exportTables(file);
        if (!tables.length) throw new Error('Bộ thẻ chưa có thẻ để xuất.');
        if (format === 'xlsx') downloadFile(`${base}.xlsx`, await toXlsx(tables), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        else for (const table of tables) downloadFile(`${base}${tables.length > 1 ? ` - ${safeFileName(table.name)}` : ''}.csv`, toCsv(table), 'text/csv;charset=utf-8');
      }
      setNotice('Đã tạo tệp. Tệp không chứa lịch ôn, ghi chú cá nhân hay mã nội bộ.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không xuất được bộ thẻ.'); }
    finally { setBusy(null); }
  }
  return <AppDialog open title="Xuất bộ thẻ" onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4" aria-busy={Boolean(busy)}>
      <h3 className="text-lg font-semibold break-words">{deck.name}</h3>
      <p className="study-copy text-sm">Chọn <strong>.sonhat.json</strong> để sao lưu đầy đủ (nội dung, loại thẻ, giao diện) và nhập lại sau này. CSV và Excel chỉ giữ nội dung, mỗi loại thẻ một bảng. Tệp không chứa font bạn đã tải lên; mã font chỉ có tác dụng trong tài khoản của bạn.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {([['json', '.sonhat.json'], ['csv', 'CSV'], ['xlsx', 'Excel']] as const).map(([format, label]) =>
          <button key={format} type="button" className={`study-button justify-center ${format === 'json' ? 'study-button-primary' : ''}`} disabled={Boolean(busy)} onClick={() => void run(format)}><Download size={16} />{busy === format ? 'Đang tạo…' : label}</button>)}
      </div>
      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      {notice && <p role="status" className="study-copy text-xs">{notice}</p>}
    </div>
  </AppDialog>;
}
