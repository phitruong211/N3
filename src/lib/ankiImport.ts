import type { SRSCard } from '../types';

export type ImportedKind = 'vocabulary' | 'kanji' | 'grammar' | 'general';
export interface ImportedCard { id: string; front: string; back: string; reading: string; notes: string; kind: ImportedKind; srs?: SRSCard }
export interface ImportedDeck { id: string; name: string; source: string; format: string; createdAt: string; cards: ImportedCard[] }
export interface ImportPreview { name: string; source: string; format: string; cards: ImportedCard[]; skipped: number }
export const kindLabels: Record<ImportedKind, string> = { vocabulary: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp', general: 'Thẻ tổng hợp' };

const text = (value: unknown): string => Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[\s_-]/g, '');
const frontKeys = ['front', 'mat truoc', 'question', 'cau hoi', 'word', 'tu', 'tu vung', 'kanji', 'tu_chinh', 'pattern', 'mau_ngu_phap'];
const backKeys = ['back', 'mat sau', 'answer', 'dap an', 'meaning', 'nghia', 'y nghia', 'nghia_cot_loi', 'han_viet', 'hanViet'];

function objectCard(value: unknown): ImportedCard | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = Object.fromEntries(Object.entries(value).map(([key, val]) => [normalize(key), val]));
  const pick = (keys: string[]) => keys.map(key => text(row[normalize(key)])).find(Boolean) || '';
  const front = pick(frontKeys), back = pick(backKeys);
  if (!front || !back) return null;
  const explicit = pick(['kind', 'type', 'loai']);
  const kind: ImportedKind = ['vocabulary', 'kanji', 'grammar', 'general'].includes(explicit) ? explicit as ImportedKind
    : row.maunguphap || row.pattern || row.congthuc ? 'grammar'
    : row.tuchinh || row.onyomi || row.kunyomi || (row.kanji && !row.word && !row.tu && !row.hiragana) ? 'kanji'
    : row.tu || row.word || row.phienam || row.reading || row.hiragana ? 'vocabulary' : 'general';
  const extra = Object.entries(value).filter(([key]) => ![...frontKeys, ...backKeys, 'reading', 'phien_am', 'hiragana', 'notes', 'ghi_chu', 'id', 'kind', 'type'].map(normalize).includes(normalize(key)))
    .map(([key, val]) => `${key}: ${typeof val === 'object' ? JSON.stringify(val, null, 2) : text(val)}`).join('\n');
  const hanViet = pick(['han_viet', 'hanViet']);
  return { id: crypto.randomUUID(), front, back, reading: pick(['reading', 'phien_am', 'hiragana', 'cach doc']), notes: [pick(['notes', 'ghi_chu']), hanViet && hanViet !== back ? `Hán Việt: ${hanViet}` : '', extra].filter(Boolean).join('\n'), kind };
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
      row.push(field); if (row.some(cell => cell.trim())) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('File có dấu ngoặc kép chưa đóng. Hãy kiểm tra lại dữ liệu.');
  row.push(field); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}

export function parseTextImport(input: string, filename: string): ImportPreview {
  const clean = input.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('File trống.');
  let records: unknown[], format: string;
  if (clean.startsWith('[') || clean.startsWith('{') || /\.json$/i.test(filename)) {
    let parsed: unknown;
    try { parsed = JSON.parse(clean); } catch { throw new Error('JSON không hợp lệ. Hãy kiểm tra cú pháp file.'); }
    if (Array.isArray(parsed)) records = parsed;
    else if (parsed && typeof parsed === 'object') {
      const root = parsed as Record<string, unknown>;
      records = ['cards', 'data', 'items', 'vocabulary', 'kanji', 'grammar'].map(key => root[key]).find(Array.isArray) as unknown[];
      if (!records) throw new Error('JSON cần chứa danh sách thẻ (mảng hoặc trường cards/data/items).');
    } else throw new Error('JSON cần chứa danh sách thẻ.');
    format = 'JSON';
  } else {
    const lines = clean.split(/\r?\n/);
    const directives: string[] = [];
    while (lines[0]?.startsWith('#')) directives.push(lines.shift()!);
    const body = lines.join('\n');
    const separator = directives.find(line => /^#separator:/i.test(line))?.split(':')[1]?.trim().toLowerCase();
    const delimiter = separator === 'tab' ? '\t' : separator === 'semicolon' ? ';' : separator === 'comma' ? ','
      : ['\t', ',', ';'].map(d => ({ d, count: parseDelimited(body, d)[0]?.length || 0 })).sort((a, b) => b.count - a.count)[0].d;
    const rows = parseDelimited(body, delimiter);
    records = tableRecords(rows);
    format = delimiter === '\t' ? 'TSV / TXT' : 'CSV';
  }
  if (records.length > 20000) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file.');
  const cards = records.map(objectCard).filter((card): card is ImportedCard => card !== null);
  if (!cards.length) throw new Error('Không tìm thấy thẻ có đủ mặt trước và mặt sau. Dùng cột front/back hoặc tu/nghia.');
  return { name: filename.replace(/\.[^.]+$/, ''), source: filename, format, cards, skipped: records.length - cards.length };
}

function tableRecords(rows: string[][]): unknown[] {
  const header = rows[0] || [];
  const hasHeader = header.some(cell => frontKeys.map(normalize).includes(normalize(cell))) && header.some(cell => backKeys.map(normalize).includes(normalize(cell)));
  return (hasHeader ? rows.slice(1) : rows).map(row => hasHeader ? Object.fromEntries(header.map((key, i) => [key, row[i] || ''])) : { front: row[0], back: row[1], reading: row[2], notes: row.slice(3).join('\n') });
}

export async function parseExcelImport(buffer: ArrayBuffer, filename: string): Promise<ImportPreview> {
  const { read, utils } = await import('xlsx');
  let workbook;
  try { workbook = read(buffer, { type: 'array', sheetRows: 20002 }); }
  catch { throw new Error('Không đọc được Excel. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.'); }
  const cards: ImportedCard[] = []; let skipped = 0, total = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet['!fullref'] && utils.decode_range(sheet['!fullref']).e.r >= 20001) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file Excel.');
    const rows = utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
    const records = tableRecords(rows); total += records.length;
    if (total > 20000) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file Excel.');
    for (const record of records) {
      const card = objectCard(record);
      if (card) { card.notes = [`Sheet: ${sheetName}`, card.notes].filter(Boolean).join('\n'); cards.push(card); } else skipped++;
    }
  }
  if (!cards.length) throw new Error('Excel không có thẻ hợp lệ. Cần cột mặt trước và mặt sau.');
  return { name: filename.replace(/\.[^.]+$/, ''), source: filename, format: `Excel · ${workbook.SheetNames.length} sheet`, cards, skipped };
}

export async function parseImportFile(file: File): Promise<ImportPreview> {
  if (file.size > 20 * 1024 * 1024) throw new Error('File quá lớn. Giới hạn hiện tại là 20 MB.');
  if (/\.xlsx?$/i.test(file.name)) return parseExcelImport(await file.arrayBuffer(), file.name);
  if (!/\.(json|csv|tsv|txt)$/i.test(file.name)) throw new Error('Định dạng chưa được hỗ trợ. Chọn JSON, CSV, TSV hoặc TXT.');
  return parseTextImport(await file.text(), file.name);
}
