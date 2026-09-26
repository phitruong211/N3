import type { SRSCard } from '../types';

export type ImportedKind = 'vocabulary' | 'kanji' | 'grammar' | 'general';
export type CardField = 'front' | 'back' | 'reading' | 'notes' | 'kind' | 'deckName';
export type CardTheme = 'paper' | 'blue' | 'dark' | 'system';
export type CardOrientation = 'front-first' | 'back-first' | 'mixed';
export interface DeckTemplateConfig {
  version: 1;
  front: { fields: CardField[]; showDeckName: boolean };
  back: { fields: CardField[]; showFront: boolean };
  style: { theme: CardTheme; fontScale: 'small' | 'medium' | 'large' | 'xlarge'; alignment: 'left' | 'center' };
  study: { orientation: CardOrientation };
}
export interface ImportedCard { id: string; front: string; back: string; reading: string; notes: string; kind: ImportedKind; tags?: string[]; sourceRef?: string; sourceSheet?: string; extraData?: Record<string, string>; srs?: SRSCard }
export interface ImportedDeck { id: string; name: string; source: string; format: string; createdAt: string; position: number; template: DeckTemplateConfig; cards: ImportedCard[] }
export interface ImportPreview { name: string; source: string; format: string; cards: ImportedCard[]; skipped: number; tables?: ImportTable[]; issues?: ImportIssue[]; duplicates?: number }
export const kindLabels: Record<ImportedKind, string> = { vocabulary: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp', general: 'Thẻ tổng hợp' };
export const defaultDeckTemplate = (): DeckTemplateConfig => ({
  version: 1,
  front: { fields: ['front', 'reading'], showDeckName: true },
  back: { fields: ['back', 'reading', 'notes'], showFront: true },
  style: { theme: 'paper', fontScale: 'large', alignment: 'center' },
  study: { orientation: 'front-first' },
});

export function normalizeDeckTemplate(value: unknown): DeckTemplateConfig {
  const fallback = defaultDeckTemplate();
  if (!value || typeof value !== 'object') return fallback;
  const config = value as Partial<DeckTemplateConfig>;
  const allowedFields: CardField[] = ['front', 'back', 'reading', 'notes', 'kind', 'deckName'];
  const fields = (candidate: unknown, defaults: CardField[]) => Array.isArray(candidate)
    ? candidate.filter((field): field is CardField => allowedFields.includes(field as CardField)).slice(0, 6)
    : defaults;
  const themes: CardTheme[] = ['paper', 'blue', 'dark', 'system'];
  const scales: DeckTemplateConfig['style']['fontScale'][] = ['small', 'medium', 'large', 'xlarge'];
  const orientations: CardOrientation[] = ['front-first', 'back-first', 'mixed'];
  return {
    version: 1,
    front: { fields: fields(config.front?.fields, fallback.front.fields), showDeckName: typeof config.front?.showDeckName === 'boolean' ? config.front.showDeckName : fallback.front.showDeckName },
    back: { fields: fields(config.back?.fields, fallback.back.fields), showFront: typeof config.back?.showFront === 'boolean' ? config.back.showFront : fallback.back.showFront },
    style: {
      theme: themes.includes(config.style?.theme as CardTheme) ? config.style!.theme : fallback.style.theme,
      fontScale: scales.includes(config.style?.fontScale as DeckTemplateConfig['style']['fontScale']) ? config.style!.fontScale : fallback.style.fontScale,
      alignment: config.style?.alignment === 'left' ? 'left' : 'center',
    },
    study: { orientation: orientations.includes(config.study?.orientation as CardOrientation) ? config.study!.orientation : fallback.study.orientation },
  };
}

export type ImportField = 'front' | 'back' | 'reading' | 'notes' | 'kind' | 'tags';
export interface ImportTable { id: string; name: string; rows: string[][]; hasHeader: boolean; selected: boolean; mapping: Partial<Record<ImportField, number>>; extraColumns: number[]; inferredKind?: ImportedKind }
export interface ImportIssue { row: number; sheet: string; reason: string }
const text = (value: unknown): string => (Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : typeof value === 'object' && value !== null ? JSON.stringify(value) : value == null ? '' : String(value)).replace(/\r\n?/g, '\n').trim().normalize('NFC');
const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[\s_-]/g, '');
const keys: Record<ImportField, string[]> = {
 front: ['front','mat truoc','question','cau hoi','word','tu','tu vung','kanji','tu_chinh','pattern','mau_ngu_phap'],
 back: ['back','mat sau','answer','dap an','meaning','nghia','y nghia','nghia_cot_loi','han_viet','hanViet'],
 reading: ['reading','phien_am','hiragana','cach doc'], notes: ['notes','note','ghi_chu'], kind: ['kind','type','loai'], tags: ['tags','tag','nhan'],
};
function table(rows: string[][], name: string, json = false): ImportTable {
 const header = rows[0] || [];
 const mapping: ImportTable['mapping'] = {};
 for (const field of Object.keys(keys) as ImportField[]) {
  const index = keys[field].map(key => header.findIndex(cell => normalize(key) === normalize(cell))).find(i => i >= 0) ?? -1;
  if (index >= 0) mapping[field] = index;
 }
 const hasHeader = json || (mapping.front !== undefined && mapping.back !== undefined);
 const normalized = header.map(normalize);
 const inferredKind: ImportedKind = normalized.some(k => ['maunguphap','pattern','congthuc'].includes(k)) ? 'grammar' : normalized.some(k => ['tuchinh','onyomi','kunyomi'].includes(k)) || (normalized.includes('kanji') && !normalized.includes('hiragana')) ? 'kanji' : normalized.some(k => ['word','tu','phienam','reading','hiragana'].includes(k)) ? 'vocabulary' : 'general';
 return { id: crypto.randomUUID(), name, rows, hasHeader, selected: true, mapping: hasHeader ? { front: 0, back: 1, ...mapping } : { front: 0, back: 1, ...(header.length > 2 ? { reading: 2 } : {}) }, extraColumns: [], inferredKind: hasHeader ? inferredKind : 'general' };
}
export function remapImportPreview(preview: ImportPreview, tables: ImportTable[]): ImportPreview {
 const cards: ImportedCard[] = [], issues: ImportIssue[] = [], seen = new Set<string>(); let duplicates = 0, total = 0;
 for (const tab of tables.filter(t => t.selected)) {
  const start = tab.hasHeader ? 1 : 0;
  total += tab.rows.length - start;
  if (total > 20000) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file.');
  for (let index = start; index < tab.rows.length; index++) {
   const row = tab.rows[index];
   const pick = (field: ImportField) => text(row[tab.mapping[field] ?? -1]);
   const front = pick('front'), back = pick('back'), reading = pick('reading'), notes = pick('notes');
   const fail = (reason: string) => issues.push({ row: index + 1, sheet: tab.name, reason });
   if (!front || !back) { fail('Thiếu mặt trước hoặc mặt sau'); continue; }
   if (front.length > 20000 || back.length > 20000 || notes.length > 20000 || reading.length > 10000) { fail('Vượt giới hạn trường: front/back/note 20.000, reading 10.000 ký tự'); continue; }
   const kindText = pick('kind').toLowerCase();
   const aliases: Record<string, ImportedKind> = { vocabulary: 'vocabulary', vocab: 'vocabulary', tuvung: 'vocabulary', kanji: 'kanji', grammar: 'grammar', nguphap: 'grammar', general: 'general' };
   const kind = kindText ? aliases[normalize(kindText)] : tab.inferredKind || 'general';
   if (!kind) { fail('Loại thẻ không hợp lệ'); continue; }
   const tags = pick('tags').split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
   const extraData = Object.fromEntries(tab.extraColumns.filter(i => !Object.values(tab.mapping).includes(i)).map(i => [tab.hasHeader ? tab.rows[0][i] || `Cột ${i + 1}` : `Cột ${i + 1}`, text(row[i])]));
   if (tags.length > 100 || tags.some(t => t.length > 100) || JSON.stringify(extraData).length > 20000) { fail('Tags hoặc dữ liệu mở rộng vượt giới hạn'); continue; }
   const pair = JSON.stringify([front.replace(/\s+/g, ' '), back.replace(/\s+/g, ' ')]);
   if (seen.has(pair)) { duplicates++; fail('Trùng cặp mặt trước / mặt sau'); continue; }
   seen.add(pair);
   cards.push({ id: crypto.randomUUID(), front, back, reading, notes, kind, tags, sourceRef: preview.source, ...(tab.name ? { sourceSheet: tab.name } : {}), ...(Object.keys(extraData).length ? { extraData } : {}) });
  }
 }
 return { ...preview, tables, cards, skipped: issues.length, issues, duplicates };
}
// Quoted fields may contain separators, escaped quotes and line breaks.
export function parseDelimited(input: string, delimiter: string): string[][] {
 const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
 for (let i = 0; i < input.length; i++) {
  const char = input[i];
  if (char === '"' && (quoted || !field)) {
   if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted;
  } else if (!quoted && char === delimiter) { row.push(field); field = ''; }
  else if (!quoted && (char === '\n' || char === '\r')) {
   if (char === '\r' && input[i + 1] === '\n') i++;
   row.push(field); rows.push(row); row = []; field = '';
  } else field += char;
 }
 if (quoted) throw new Error('File có dấu ngoặc kép chưa đóng. Hãy kiểm tra lại dữ liệu.');
 row.push(field); if (row.some(cell => cell.trim())) rows.push(row);
 return rows;
}
export function parseTextImport(input: string, filename: string): ImportPreview {
 const clean = input.replace(/^\uFEFF/, '').trim();
 if (!clean) throw new Error('File trống.');
 let tab: ImportTable, format: string;
 if (clean.startsWith('[') || clean.startsWith('{') || /\.json$/i.test(filename)) {
  let parsed: unknown;
  try { parsed = JSON.parse(clean); } catch { throw new Error('JSON không hợp lệ. Hãy kiểm tra cú pháp file.'); }
  const records = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? ['cards','data','items','vocabulary','kanji','grammar'].map(k => (parsed as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined : undefined;
  if (!records) throw new Error('JSON cần chứa danh sách thẻ (mảng hoặc trường cards/data/items).');
  const header = [...new Set(records.flatMap(r => r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r) : []))];
  tab = table([header, ...records.map(r => header.map(k => text(r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>)[k] : '')))], '', true); format = 'JSON';
 } else {
  const lines = clean.split(/\r?\n/), directives: string[] = [];
  while (lines[0]?.startsWith('#')) directives.push(lines.shift()!);
  const body = lines.join('\n');
  const separator = directives.find(line => /^#separator:/i.test(line))?.split(':')[1]?.trim().toLowerCase();
  const delimiter = separator === 'tab' ? '\t' : separator === 'semicolon' ? ';' : separator === 'comma' ? ',' : ['\t', ',', ';'].map(d => ({ d, count: parseDelimited(body, d)[0]?.length || 0 })).sort((a,b) => b.count - a.count)[0].d;
  tab = table(parseDelimited(body, delimiter), ''); format = delimiter === '\t' ? 'TSV / TXT' : 'CSV';
 }
 return remapImportPreview({ name: filename.replace(/\.[^.]+$/, ''), source: filename, format, cards: [], skipped: 0 }, [tab]);
}
export async function parseExcelImport(buffer: ArrayBuffer, filename: string): Promise<ImportPreview> {
 const { read, utils } = await import('xlsx');
 let workbook;
 try { workbook = read(buffer, { type: 'array', sheetRows: 20002 }); }
 catch { throw new Error('Không đọc được Excel. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.'); }
 const tables = workbook.SheetNames.map(name => {
  const sheet = workbook.Sheets[name];
  if (sheet['!fullref'] && utils.decode_range(sheet['!fullref']).e.r >= 20001) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file Excel.');
  return table(utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true }), name);
 });
 return remapImportPreview({ name: filename.replace(/\.[^.]+$/, ''), source: filename, format: `Excel · ${tables.length} sheet`, cards: [], skipped: 0 }, tables);
}
export async function parseImportFile(file: File, signal?: AbortSignal): Promise<ImportPreview> {
 if (file.size > 20 * 1024 * 1024) throw new Error('File quá lớn. Giới hạn hiện tại là 20 MB.');
 if (!/\.(json|csv|tsv|txt|xlsx|xls)$/i.test(file.name)) throw new Error('Định dạng chưa được hỗ trợ. Chọn JSON, CSV, TSV, TXT, XLSX hoặc XLS.');
 signal?.throwIfAborted();
 if (typeof Worker !== 'undefined') return new Promise((resolve, reject) => {
  const worker = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
  const cleanup = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
  const abort = () => { cleanup(); reject(new DOMException('Đã hủy đọc tệp', 'AbortError')); };
  signal?.addEventListener('abort', abort, { once: true });
  worker.onmessage = ({ data }) => { cleanup(); if (data.error) reject(new Error(data.error)); else resolve(data.preview); };
  worker.onerror = () => { cleanup(); reject(new Error('Không đọc được tệp. Hãy kiểm tra định dạng.')); };
  worker.postMessage({ file });
 });
 const result = /\.xlsx?$/i.test(file.name) ? await parseExcelImport(await file.arrayBuffer(), file.name) : parseTextImport(await file.text(), file.name);
 signal?.throwIfAborted(); return result;
}
