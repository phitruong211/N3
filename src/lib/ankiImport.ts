// File -> preview pipeline. Every format ends up as a table whose columns are mapped to the fields of a
// note type (docs/deck-format-v1.md §6), except native .sonhat.json files which are validated directly.
import type { SRSCard } from '../types';
import { LIMITS, FORMAT_NAME, builtinNoteTypes, cardFromFields, kindOfNoteType, noteTypeIdForKind, parseCardExamples, validateCardFields, validateDeckFile, type CardFieldValues, type DeckConfig, type Issue, type NoteType, type StyleSpec } from './deckFormat.ts';
import { normalizeReadingInput } from './furigana.ts';
import { parseMarkdownRows } from './deckMarkdown.ts';

export { CARD_FONT_PRESETS, defaultDeckTemplate, normalizeDeckTemplate, parseCardExamples } from './deckFormat.ts';
export type { CardExample, CardField, CardFontFamily, CardSideStyle, CardTheme, DeckTemplateConfig } from './deckFormat.ts';

export type ImportedKind = 'vocabulary' | 'kanji' | 'grammar' | 'general';
export interface ImportedCard { id: string; front: string; back: string; reading: string; backReading: string; hanViet: string; notes: string; kind: ImportedKind; tags?: string[]; sourceRef?: string; sourceSheet?: string; extraData?: Record<string, string>; srs?: SRSCard; noteType?: string; fields?: CardFieldValues; style?: StyleSpec }
export interface ImportedDeck { id: string; name: string; source: string; format: string; createdAt: string; position: number; template: import('./deckFormat.ts').DeckTemplateConfig; config?: DeckConfig; cards: ImportedCard[] }
export interface ImportPreview {
  name: string; source: string; format: string; cards: ImportedCard[]; skipped: number;
  /** Note types the cards can use. Tables only: derived types created for extra columns are included. */
  noteTypes: NoteType[]; style?: StyleSpec; description?: string; deckTags?: string[];
  tables?: ImportTable[]; issues?: ImportIssue[]; warnings?: ImportWarning[]; duplicates?: number;
}
export const kindLabels: Record<ImportedKind, string> = { vocabulary: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp', general: 'Thẻ tổng hợp' };
export const IMPORT_EXAMPLE = [
  {
    front: 'きっかけ',
    back: 'cơ duyên; nguyên nhân/động lực khởi đầu',
    reading: 'きっかけ',
    back_reading: '',
    han_viet: null,
    note: 'Ôn bài 1',
    type: 'VOCABULARY',
    tags: ['N3', 'từ vựng', 'bài 1'],
    examples: [
      {
        japanese: '日本語を勉強し始めたきっかけは、日本の映画です。',
        reading: 'にほんごをべんきょうし始めたきっかけは、にほんのえいがです。',
        meaning: 'Cơ duyên khiến tôi bắt đầu học tiếng Nhật là phim Nhật.',
      },
    ],
  },
] as const;

/** Targets besides field keys: "@type" picks the note type per row, "@tags" fills card tags. */
export type ImportTarget = string;
export interface ImportColumn { key: string; label: string; column: number; target: ImportTarget; suggested?: boolean }
export interface ImportTable { id: string; name: string; rows: string[][]; hasHeader: boolean; selected: boolean; noteTypeId: string; columns: ImportColumn[]; inferredKind?: ImportedKind }
export interface ImportIssue { row: number; sheet: string; reason: string }
export interface ImportWarning extends ImportIssue { cardId: string }

// Cards imported before note types existed stacked extra source columns on a face; they are still rendered from these.
export interface StoredImportFieldLayout { version: 1; fields: Array<{ key: string; label: string; destination: string; order: number }> }
export interface ImportFaceBlock { key: string; label: string; value: string; order: number }
export function importFaceBlocks(card: Pick<ImportedCard, 'extraData'>, side: 'front' | 'back'): ImportFaceBlock[] {
 try {
  const layout = JSON.parse(card.extraData?.importFieldLayout || '') as StoredImportFieldLayout;
  const values = JSON.parse(card.extraData?.importFieldValues || '') as Record<string, unknown>;
  if (layout.version !== 1 || !Array.isArray(layout.fields) || !values || typeof values !== 'object') return [];
  return layout.fields
   .filter(field => field.destination === side && typeof values[field.key] === 'string' && String(values[field.key]).trim())
   .map(field => ({ key: field.key, label: String(field.label || ''), value: String(values[field.key]), order: Number.isFinite(field.order) ? field.order : 0 }))
   .sort((a, b) => a.order - b.order);
 } catch { return []; }
}

const text = (value: unknown): string => (Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : typeof value === 'object' && value !== null ? JSON.stringify(value) : value == null ? '' : String(value)).replace(/\r\n?/g, '\n').trim().normalize('NFC');
const normalize = (value: string) => value.replace(/^﻿/, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[\s_-]/g, '');
// Header names recognised for each target. The only place column aliases live.
const ALIASES: Record<string, string[]> = {
 front: ['front','mat truoc','question','cau hoi','word','tu','tu vung','kanji','tu_chinh','pattern','mau_ngu_phap'],
 back: ['back','mat sau','answer','dap an','meaning','nghia','y nghia','nghia_cot_loi'],
 frontReading: ['reading','front_reading','phien_am','hiragana','kana','yomikata','cach doc','cach_doc'],
 backReading: ['back_reading','back hiragana','back_hiragana','back kana','mat sau reading','mat_sau_reading','cach doc mat sau','cach_doc_mat_sau'],
 hanViet: ['hanViet','han_viet','han viet','hán việt','hanTu','han_tu','han tu','hán tự'],
 notes: ['notes','note','ghi_chu'],
 '@type': ['kind','type','loai'],
 '@tags': ['tags','tag','nhan'],
 examples: ['examples','example','vi du','ví dụ'],
};
const KIND_ALIASES: Record<string, ImportedKind> = { vocabulary: 'vocabulary', vocab: 'vocabulary', tuvung: 'vocabulary', kanji: 'kanji', grammar: 'grammar', nguphap: 'grammar', general: 'general' };

const widthOf = (rows: string[][]) => rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
const labelFor = (table: Pick<ImportTable, 'rows' | 'hasHeader'>, column: number) => (table.hasHeader ? text(table.rows[0]?.[column]) || `Cột ${column + 1}` : `Cột ${column + 1}`).slice(0, 200);

interface BuildContext { noteTypes: NoteType[]; derived: number }
function deriveNoteType(base: NoteType, name: string, extras: Array<{ key: string; label: string }>, context: BuildContext): NoteType {
 const id = `import-${++context.derived}`;
 const type: NoteType = {
  ...base, id, name: `${base.name} · ${name || 'tệp'}`.slice(0, 60),
  fields: [...base.fields, ...extras.map(extra => ({ key: extra.key, label: extra.label.slice(0, 60) || extra.key, type: 'ruby' as const }))],
  back: { ...base.back, show: [...base.back.show, ...extras.map(extra => extra.key)] },
 };
 context.noteTypes.push(type);
 return type;
}

function table(rows: string[][], name: string, json: boolean, context: BuildContext): ImportTable {
 const header = rows[0] || [];
 const found: Record<string, number> = {};
 for (const target of Object.keys(ALIASES)) {
  const index = ALIASES[target].map(key => header.findIndex(cell => normalize(key) === normalize(cell))).find(i => i >= 0) ?? -1;
  if (index >= 0) found[target] = index;
 }
 const hasHeader = json || (found.front !== undefined && found.back !== undefined);
 const normalized = header.map(normalize);
 const inferredKind: ImportedKind = normalized.some(k => ['maunguphap','pattern','congthuc'].includes(k)) ? 'grammar' : normalized.some(k => ['tuchinh','onyomi','kunyomi'].includes(k)) || (normalized.includes('kanji') && !normalized.includes('hiragana')) ? 'kanji' : normalized.some(k => ['word','tu','phienam','reading','hiragana'].includes(k)) ? 'vocabulary' : 'general';
 const kind = hasHeader ? inferredKind : 'general';
 const width = widthOf(rows);
 const targets: Array<ImportTarget | undefined> = Array.from({ length: width });
 const suggested = new Set<number>();
 if (hasHeader) {
  for (const [target, column] of Object.entries(found)) if (targets[column] === undefined) { targets[column] = target; if (target !== 'front' && target !== 'back') suggested.add(column); }
  for (const target of ['front', 'back']) if (!targets.includes(target)) {
   const column = targets.findIndex(item => item === undefined);
   if (column >= 0) targets[column] = target;
  }
 } else {
  targets[0] = 'front'; if (width > 1) targets[1] = 'back'; if (width > 2) { targets[2] = 'frontReading'; suggested.add(2); }
 }
 const base = context.noteTypes.find(type => type.id === noteTypeIdForKind(kind))!;
 const extras: Array<{ key: string; label: string }> = [];
 const draft = { rows, hasHeader };
 for (let column = 0; column < width; column++) if (targets[column] === undefined) {
  targets[column] = `col${column + 1}`;
  extras.push({ key: `col${column + 1}`, label: labelFor(draft, column) });
 }
 const type = extras.length ? deriveNoteType(base, name, extras, context) : base;
 return { id: crypto.randomUUID(), name, rows, hasHeader, selected: true, noteTypeId: type.id, inferredKind: hasHeader ? inferredKind : 'general',
  columns: targets.map((target, column) => ({ key: `col-${column}`, label: labelFor(draft, column), column, target: target!, ...(suggested.has(column) ? { suggested: true } : {}) })) };
}

// ---------- editing helpers used by the preview UI ----------
/** Points a column at a field. A field takes one column, so the column that held it is released. */
export function assignImportColumn(tableValue: ImportTable, key: string, target: ImportTarget): ImportTable {
 return { ...tableValue, columns: tableValue.columns.map(column => column.key === key ? { ...column, target, suggested: false } : target !== 'ignore' && column.target === target ? { ...column, target: 'ignore' } : column) };
}
export function setImportTableNoteType(tableValue: ImportTable, noteTypeId: string, noteTypes: NoteType[]): ImportTable {
 const type = noteTypes.find(item => item.id === noteTypeId);
 if (!type) return tableValue;
 return { ...tableValue, noteTypeId, columns: tableValue.columns.map(column => column.target.startsWith('@') || column.target === 'ignore' || type.fields.some(field => field.key === column.target) ? column : { ...column, target: 'ignore' }) };
}
export function setImportTableHeader(tableValue: ImportTable, hasHeader: boolean): ImportTable {
 const next = { ...tableValue, hasHeader };
 return { ...next, columns: tableValue.columns.map(column => ({ ...column, label: labelFor(next, column.column) })) };
}

function resolveRowType(value: string, tableType: NoteType, noteTypes: NoteType[]): NoteType | undefined {
 const key = normalize(value);
 const exact = noteTypes.find(type => normalize(type.id) === key || normalize(type.name) === key);
 if (exact) return exact;
 const kind = KIND_ALIASES[key];
 if (!kind) return undefined;
 return kindOfNoteType(tableType) === kind ? tableType : noteTypes.find(type => type.id === noteTypeIdForKind(kind));
}

const reasonFor = (issue: Issue, type: NoteType): string => {
 const key = issue.path.split('.').pop() || '';
 const label = type.fields.find(field => field.key === key)?.label ?? key;
 if (issue.code === 'required') return key === 'front' ? 'Thiếu dữ liệu mặt trước' : key === 'back' ? 'Thiếu dữ liệu mặt sau' : issue.message;
 if (issue.code === 'too_long') return `Vượt giới hạn trường: ${label} (mặt trước/mặt sau/ghi chú 20.000, cách đọc 10.000 ký tự)`;
 return issue.message;
};

export function remapImportPreview(preview: ImportPreview, tables: ImportTable[], noteTypes: NoteType[] = preview.noteTypes): ImportPreview {
 const cards: ImportedCard[] = [], issues: ImportIssue[] = [], warnings: ImportWarning[] = [], seen = new Set<string>(); let duplicates = 0, total = 0;
 for (const tab of tables.filter(t => t.selected)) {
  const tableType = noteTypes.find(type => type.id === tab.noteTypeId) ?? noteTypes[0];
  const mapped = tab.columns.filter(column => column.target !== 'ignore');
  const typeColumn = mapped.find(column => column.target === '@type'), tagsColumn = mapped.find(column => column.target === '@tags');
  const start = tab.hasHeader ? 1 : 0;
  total += tab.rows.length - start;
  if (total > LIMITS.cards) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file.');
  for (let index = start; index < tab.rows.length; index++) {
   const row = tab.rows[index];
   const fail = (reason: string) => issues.push({ row: index + 1, sheet: tab.name, reason });
   let type = tableType;
   const typeValue = typeColumn ? text(row[typeColumn.column]) : '';
   if (typeValue) {
    const resolved = resolveRowType(typeValue, tableType, noteTypes);
    if (!resolved) { fail('Loại thẻ không hợp lệ'); continue; }
    type = resolved;
   }
   const fields: CardFieldValues = {};
   let broken = false;
   for (const column of mapped) {
    const field = type.fields.find(item => item.key === column.target);
    const value = text(row[column.column]);
    if (!field || !value) continue;
    if (field.type === 'examples') {
     try { const examples = parseCardExamples(value); if (examples.length) fields[field.key] = examples; }
     catch (error) { fail(error instanceof Error ? error.message : 'examples không hợp lệ'); broken = true; break; }
    } else fields[field.key] = field.type === 'kana' ? normalizeReadingInput(value) : value;
   }
   if (broken) continue;
   const fieldIssues: Issue[] = [];
   const valid = validateCardFields(type, fields, 'fields', fieldIssues);
   const failure = fieldIssues.find(issue => issue.severity === 'error');
   if (!valid || failure) { fail(reasonFor(failure!, type)); continue; }
   const tags = tagsColumn ? text(row[tagsColumn.column]).split(/[,;\n]/).map(t => t.trim()).filter(Boolean) : [];
   if (tags.length > LIMITS.tags || tags.some(t => t.length > LIMITS.tagLength)) { fail('Nhãn hoặc dữ liệu mở rộng vượt giới hạn'); continue; }
   const id = crypto.randomUUID();
   const { card, warnings: fieldWarnings } = cardFromFields(type, valid, { id, tags, sourceRef: preview.source, ...(tab.name ? { sourceSheet: tab.name } : {}) });
   const pair = JSON.stringify([card.front.replace(/\s+/g, ' '), card.back.replace(/\s+/g, ' ')]);
   if (seen.has(pair)) { duplicates++; fail('Trùng cặp mặt trước / mặt sau'); continue; }
   seen.add(pair);
   for (const warning of fieldWarnings) warnings.push({ cardId: id, row: index + 1, sheet: tab.name, reason: `${warning.label}: ${warning.reason}` });
   cards.push(card);
  }
 }
 return { ...preview, noteTypes, tables, cards, skipped: issues.length, issues, warnings, duplicates };
}

/** Deck config to store with the deck: only the note types the cards use, unless the file declared its own. */
export function previewConfig(preview: ImportPreview): DeckConfig {
 const used = new Set(preview.cards.map(card => card.noteType));
 const types = preview.tables ? preview.noteTypes.filter(type => used.has(type.id)) : preview.noteTypes;
 return { version: 5, ...(preview.style ? { style: preview.style } : {}), noteTypes: types.length ? types : preview.noteTypes.slice(0, 1) };
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

const baseName = (filename: string) => filename.replace(/\.[^.]+$/, '').replace(/\.sonhat$/i, '');
const newContext = (): BuildContext => ({ noteTypes: builtinNoteTypes(), derived: 0 });
function fromTables(tables: ImportTable[], context: BuildContext, name: string, source: string, format: string): ImportPreview {
 return remapImportPreview({ name, source, format, cards: [], skipped: 0, noteTypes: context.noteTypes }, tables, context.noteTypes);
}

function fromDeckFile(parsed: unknown, filename: string): ImportPreview {
 const result = validateDeckFile(parsed);
 if (!result.ok || !result.file) {
  const first = result.issues.find(issue => issue.severity === 'error');
  throw new Error(`${first?.path ? `${first.path}: ` : ''}${first?.message ?? 'Tệp .sonhat.json không hợp lệ.'}`);
 }
 const file = result.file, types = new Map(file.deck.noteTypes.map(type => [type.id, type]));
 const cards: ImportedCard[] = [], warnings: ImportWarning[] = [];
 file.cards.forEach((entry, index) => {
  const id = crypto.randomUUID();
  const made = cardFromFields(types.get(entry.type)!, entry.fields, { id, tags: entry.tags ?? [], sourceRef: filename, ...(entry.style ? { style: entry.style } : {}), ...(entry.uid ? { extraData: { uid: entry.uid } } : {}) });
  cards.push(made.card);
  for (const warning of made.warnings) warnings.push({ cardId: id, row: index + 1, sheet: '', reason: `${warning.label}: ${warning.reason}` });
 });
 const issues: ImportIssue[] = result.issues.filter(issue => issue.severity === 'error').map(issue => ({ row: Number(issue.path.match(/^cards\[(\d+)\]/)?.[1] ?? -1) + 1, sheet: '', reason: issue.message }));
 return { name: file.deck.name, source: filename, format: 'SoNhat JSON', cards, skipped: result.skipped, noteTypes: file.deck.noteTypes, ...(file.deck.style ? { style: file.deck.style } : {}),
  ...(file.deck.description ? { description: file.deck.description } : {}), ...(file.deck.tags ? { deckTags: file.deck.tags } : {}), issues, warnings, duplicates: result.issues.filter(issue => issue.code === 'duplicate').length };
}

export function parseMarkdownImport(input: string, filename: string): ImportPreview {
 const { name, rows } = parseMarkdownRows(input);
 const context = newContext();
 return fromTables([table(rows, '', false, context)], context, name || baseName(filename), filename, 'Markdown');
}

export function parseTextImport(input: string, filename: string): ImportPreview {
 const clean = input.replace(/^﻿/, '').trim();
 if (!clean) throw new Error('File trống.');
 if (/\.(md|markdown)$/i.test(filename)) return parseMarkdownImport(clean, filename);
 const context = newContext();
 if (clean.startsWith('[') || clean.startsWith('{') || /\.json$/i.test(filename)) {
  let parsed: unknown;
  try { parsed = JSON.parse(clean); } catch { throw new Error('JSON không hợp lệ. Hãy kiểm tra cú pháp file.'); }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as Record<string, unknown>).format === FORMAT_NAME) return fromDeckFile(parsed, filename);
  const records = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? ['cards','data','items','vocabulary','kanji','grammar'].map(k => (parsed as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined : undefined;
  if (!records) throw new Error('JSON cần chứa danh sách thẻ (mảng hoặc trường cards/data/items).');
  const header = [...new Set(records.flatMap(r => r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r) : []))];
  const tab = table([header, ...records.map(r => header.map(k => {
   const value = r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>)[k] : '';
   return value != null && (k === 'examples' || (Array.isArray(value) && value.some(item => item != null && typeof item === 'object'))) ? JSON.stringify(value) : text(value);
  }))], '', true, context);
  return fromTables([tab], context, baseName(filename), filename, 'JSON');
 }
 const lines = clean.split(/\r?\n/), directives: string[] = [];
 while (lines[0]?.startsWith('#')) directives.push(lines.shift()!);
 const body = lines.join('\n');
 if (!directives.length && lines.find(line => line.trim())?.includes(' :: ')) return parseMarkdownImport(clean, filename);
 const separator = directives.find(line => /^#separator:/i.test(line))?.split(':')[1]?.trim().toLowerCase();
 const delimiter = separator === 'tab' ? '\t' : separator === 'semicolon' ? ';' : separator === 'comma' ? ',' : ['\t', ',', ';'].map(d => ({ d, count: parseDelimited(body, d)[0]?.length || 0 })).sort((a,b) => b.count - a.count)[0].d;
 return fromTables([table(parseDelimited(body, delimiter), '', false, context)], context, baseName(filename), filename, delimiter === '\t' ? 'TSV / TXT' : 'CSV');
}

export async function parseExcelImport(buffer: ArrayBuffer, filename: string): Promise<ImportPreview> {
 const { read, utils } = await import('xlsx');
 let workbook;
 try { workbook = read(buffer, { type: 'array', sheetRows: LIMITS.cards + 2 }); }
 catch { throw new Error('Không đọc được Excel. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.'); }
 const context = newContext();
 const tables = workbook.SheetNames.map(name => {
  const sheet = workbook.Sheets[name];
  if (sheet['!fullref'] && utils.decode_range(sheet['!fullref']).e.r >= LIMITS.cards + 1) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file Excel.');
  return table(utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true }), name, false, context);
 });
 return fromTables(tables, context, baseName(filename), filename, `Excel · ${tables.length} sheet`);
}

export interface ImportCheck { cards: number; skipped: number; issues: Issue[] }
/** Dry run for pasted text: what would import, and every problem with its location. */
export function checkImportText(input: string, filename = 'dán.json'): ImportCheck {
 try {
  const parsed: unknown = /^\s*[{[]/.test(input) ? JSON.parse(input) : undefined;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as Record<string, unknown>).format === FORMAT_NAME) {
   const result = validateDeckFile(parsed);
   return { cards: result.file?.cards.length ?? 0, skipped: result.skipped, issues: result.issues };
  }
  const preview = parseTextImport(input, filename);
  const where = (issue: ImportIssue) => `${issue.sheet ? `${issue.sheet} · ` : ''}dòng ${issue.row}`;
  return { cards: preview.cards.length, skipped: preview.skipped, issues: [
   ...(preview.issues ?? []).map((issue): Issue => ({ severity: 'error', path: where(issue), code: 'bad_value', message: issue.reason })),
   ...(preview.warnings ?? []).map((issue): Issue => ({ severity: 'warning', path: where(issue), code: 'bad_markup', message: issue.reason })),
  ] };
 } catch (error) {
  return { cards: 0, skipped: 0, issues: [{ severity: 'error', path: '', code: 'bad_value', message: error instanceof Error ? error.message : 'Không đọc được nội dung' }] };
 }
}

export async function parseImportFile(file: File, signal?: AbortSignal): Promise<ImportPreview> {
 if (file.size > LIMITS.fileBytes) throw new Error('File quá lớn. Giới hạn hiện tại là 20 MB.');
 if (!/\.(json|csv|tsv|txt|md|markdown|xlsx|xls)$/i.test(file.name)) throw new Error('Định dạng chưa được hỗ trợ. Chọn JSON, CSV, TSV, TXT, Markdown, XLSX hoặc XLS.');
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
