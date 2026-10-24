import type { SRSCard } from '../types';
import { normalizeReadingInput, resolveFurigana, segmentsReading } from './furigana.ts';

export type ImportedKind = 'vocabulary' | 'kanji' | 'grammar' | 'general';
export type CardField = 'front' | 'back' | 'reading' | 'hanViet' | 'notes' | 'kind' | 'deckName';
export type CardTheme = 'paper' | 'blue' | 'dark' | 'system';
export type CardFontFamily = 'default' | 'notoSansJp' | 'notoSerifJp' | 'delaGothicOne' | 'system';
export interface CardSideStyle {
  theme: CardTheme;
  fontScale: 'small' | 'medium' | 'large' | 'xlarge';
  fontSize: number;
  bold: boolean;
  italic: boolean;
  fontFamily: CardFontFamily;
  alignment: 'left' | 'center';
  /** Enlarges very short text (single words, kanji) beyond fontSize. Absent in older templates, so they render unchanged. */
  autoFit?: boolean;
}
export interface DeckTemplateConfig {
  version: 4;
  front: { fields: CardField[]; showDeckName: boolean; style: CardSideStyle };
  back: { fields: CardField[]; showFront: boolean; showExamples: boolean; style: CardSideStyle };
}
export interface ImportedCard { id: string; front: string; back: string; reading: string; backReading: string; hanViet: string; notes: string; kind: ImportedKind; tags?: string[]; sourceRef?: string; sourceSheet?: string; extraData?: Record<string, string>; srs?: SRSCard }
export interface ImportedDeck { id: string; name: string; source: string; format: string; createdAt: string; position: number; template: DeckTemplateConfig; cards: ImportedCard[] }
export interface ImportPreview { name: string; source: string; format: string; cards: ImportedCard[]; skipped: number; tables?: ImportTable[]; issues?: ImportIssue[]; warnings?: ImportWarning[]; duplicates?: number }
export const kindLabels: Record<ImportedKind, string> = { vocabulary: 'Từ vựng', kanji: 'Kanji', grammar: 'Ngữ pháp', general: 'Thẻ tổng hợp' };
export const CARD_FONT_PRESETS: Record<CardSideStyle['fontScale'], number> = {
  small: 20,
  medium: 24,
  large: 30,
  xlarge: 36,
};
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
        reading: 'にほんごをべんきょうしはじめたきっかけは、にほんのえいがです。',
        meaning: 'Cơ duyên khiến tôi bắt đầu học tiếng Nhật là phim Nhật.',
      },
    ],
  },
] as const;
export const defaultDeckTemplate = (): DeckTemplateConfig => ({
  version: 4,
  front: { fields: ['front', 'reading'], showDeckName: true, style: { theme: 'paper', fontScale: 'large', fontSize: CARD_FONT_PRESETS.large, bold: false, italic: false, fontFamily: 'default', alignment: 'center', autoFit: true } },
  back: { fields: ['back', 'reading', 'hanViet', 'notes'], showFront: false, showExamples: true, style: { theme: 'paper', fontScale: 'large', fontSize: CARD_FONT_PRESETS.large, bold: false, italic: false, fontFamily: 'default', alignment: 'center' } },
});

export function normalizeDeckTemplate(value: unknown): DeckTemplateConfig {
  const fallback = defaultDeckTemplate();
  if (!value || typeof value !== 'object') return fallback;
  const config = value as Record<string, unknown>;
  const version = typeof config.version === 'number' ? config.version : 1;
  const frontConfig = config.front && typeof config.front === 'object' ? config.front as Record<string, unknown> : {};
  const backConfig = config.back && typeof config.back === 'object' ? config.back as Record<string, unknown> : {};
  const legacyStyle = config.style && typeof config.style === 'object' ? config.style as Record<string, unknown> : {};
  const allowedFields: CardField[] = ['front', 'back', 'reading', 'hanViet', 'notes', 'kind', 'deckName'];
  const fields = (candidate: unknown, defaults: CardField[]) => Array.isArray(candidate)
    ? candidate.filter((field): field is CardField => allowedFields.includes(field as CardField)).slice(0, 6)
    : defaults;
  const themes: CardTheme[] = ['paper', 'blue', 'dark', 'system'];
  const scales: CardSideStyle['fontScale'][] = ['small', 'medium', 'large', 'xlarge'];
  const fontFamilies: CardFontFamily[] = ['default', 'notoSansJp', 'notoSerifJp', 'delaGothicOne', 'system'];
  const style = (candidate: unknown, defaults: CardSideStyle): CardSideStyle => {
    const source = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : legacyStyle;
    const fontScale = scales.includes(source.fontScale as CardSideStyle['fontScale']) ? source.fontScale as CardSideStyle['fontScale'] : defaults.fontScale;
    const requestedFontSize = typeof source.fontSize === 'number' && Number.isFinite(source.fontSize)
      ? Math.round(source.fontSize)
      : CARD_FONT_PRESETS[fontScale];
    return {
      theme: themes.includes(source.theme as CardTheme) ? source.theme as CardTheme : defaults.theme,
      fontScale,
      fontSize: Math.max(12, Math.min(72, requestedFontSize)),
      bold: source.bold === true,
      italic: source.italic === true,
      fontFamily: fontFamilies.includes(source.fontFamily as CardFontFamily) ? source.fontFamily as CardFontFamily : defaults.fontFamily,
      alignment: source.alignment === 'left' ? 'left' : 'center',
      ...(typeof source.autoFit === 'boolean' ? { autoFit: source.autoFit } : {}),
    };
  };
  return {
    version: 4,
    front: { fields: fields(frontConfig.fields, fallback.front.fields), showDeckName: typeof frontConfig.showDeckName === 'boolean' ? frontConfig.showDeckName : fallback.front.showDeckName, style: style(frontConfig.style, fallback.front.style) },
    back: { fields: fields(backConfig.fields, fallback.back.fields), showFront: version >= 3 && typeof backConfig.showFront === 'boolean' ? backConfig.showFront : false, showExamples: typeof backConfig.showExamples === 'boolean' ? backConfig.showExamples : true, style: style(backConfig.style, fallback.back.style) },
  };
}

export type ImportField = 'front' | 'back' | 'reading' | 'backReading' | 'hanViet' | 'notes' | 'kind' | 'tags' | 'examples';
export type ImportDestination = 'front' | 'back' | 'frontReading' | 'backReading' | 'hanViet' | 'notes' | 'kind' | 'tags' | 'examples' | 'ignore';
export interface ImportSourceField {
 key: string;
 label: string;
 column: number;
 destination: ImportDestination;
 order: number;
 suggested?: boolean;
}
export interface StoredImportFieldLayout {
 version: 1;
 fields: Array<Pick<ImportSourceField, 'key' | 'label' | 'destination' | 'order'>>;
}
export interface ImportFaceBlock { key: string; label: string; value: string; order: number }
export interface CardExample { japanese: string; reading: string; meaning: string }
export function parseCardExamples(value: unknown): CardExample[] {
 if (value == null || value === '') return [];
 const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
 if (!Array.isArray(parsed) || parsed.length > 100) throw new Error('examples phải là danh sách, tối đa 100 ví dụ.');
 return parsed.map(example => {
  if (!example || typeof example !== 'object' || Array.isArray(example)) throw new Error('Mỗi ví dụ phải là một đối tượng.');
  const entry = example as Record<string, unknown>;
  if (typeof entry.japanese !== 'string' || !entry.japanese.trim() || typeof entry.meaning !== 'string' || !entry.meaning.trim() || (entry.reading != null && typeof entry.reading !== 'string')) throw new Error('Ví dụ cần japanese và meaning; reading là chuỗi tùy chọn.');
  return { japanese: entry.japanese.trim(), reading: typeof entry.reading === 'string' ? entry.reading.trim() : '', meaning: entry.meaning.trim() };
 });
}
export interface ImportTable { id: string; name: string; rows: string[][]; hasHeader: boolean; selected: boolean; mapping: Partial<Record<ImportField, number>>; extraColumns: number[]; inferredKind?: ImportedKind; layoutVersion?: 1; sourceFields?: ImportSourceField[] }
export interface ImportIssue { row: number; sheet: string; reason: string }
export interface ImportWarning extends ImportIssue { cardId: string }
const text = (value: unknown): string => (Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : typeof value === 'object' && value !== null ? JSON.stringify(value) : value == null ? '' : String(value)).replace(/\r\n?/g, '\n').trim().normalize('NFC');
const normalize = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[\s_-]/g, '');
const keys: Record<ImportField, string[]> = {
 front: ['front','mat truoc','question','cau hoi','word','tu','tu vung','kanji','tu_chinh','pattern','mau_ngu_phap'],
 back: ['back','mat sau','answer','dap an','meaning','nghia','y nghia','nghia_cot_loi'],
 reading: ['reading','front_reading','phien_am','hiragana','kana','yomikata','cach doc','cach_doc'], backReading: ['back_reading','back hiragana','back_hiragana','back kana','mat sau reading','mat_sau_reading','cach doc mat sau','cach_doc_mat_sau'], hanViet: ['hanViet','han_viet','han viet','hán việt','hanTu','han_tu','han tu','hán tự'], notes: ['notes','note','ghi_chu'], kind: ['kind','type','loai'], tags: ['tags','tag','nhan'], examples: ['examples','example','vi du','ví dụ'],
};

const semanticDestination: Partial<Record<ImportField, ImportDestination>> = {
 reading: 'frontReading', backReading: 'backReading', hanViet: 'hanViet', notes: 'notes', kind: 'kind', tags: 'tags', examples: 'examples',
};
const destinationMapping: Partial<Record<ImportDestination, ImportField>> = {
 front: 'front', back: 'back', frontReading: 'reading', backReading: 'backReading', hanViet: 'hanViet', notes: 'notes', kind: 'kind', tags: 'tags', examples: 'examples',
};
const validDestinations = new Set<ImportDestination>(['front', 'back', 'frontReading', 'backReading', 'hanViet', 'notes', 'kind', 'tags', 'examples', 'ignore']);
const uniqueDestinations = new Set<ImportDestination>(['frontReading', 'backReading', 'hanViet', 'notes', 'kind', 'tags', 'examples']);

function widthOf(rows: string[][]) {
 return rows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
}

function labelFor(table: Pick<ImportTable, 'rows' | 'hasHeader'>, column: number) {
 return (table.hasHeader ? text(table.rows[0]?.[column]) || `Cột ${column + 1}` : `Cột ${column + 1}`).slice(0, 200);
}

function normalizeOrders(fields: ImportSourceField[]): ImportSourceField[] {
 const orders = new Map<string, number>();
 for (const destination of new Set(fields.map(field => field.destination))) {
  fields
   .filter(field => field.destination === destination)
   .sort((a, b) => a.order - b.order || a.column - b.column)
   .forEach((field, order) => orders.set(field.key, order));
 }
 return fields
  .map(field => ({ ...field, order: orders.get(field.key) ?? 0 }))
  .sort((a, b) => a.column - b.column);
}

function detectedFieldForColumn(mapping: ImportTable['mapping'], column: number): ImportField | undefined {
 return (Object.keys(mapping) as ImportField[]).find(field => mapping[field] === column && field !== 'front' && field !== 'back');
}

function createSourceFields(table: Pick<ImportTable, 'rows' | 'hasHeader' | 'mapping'>, legacy = false): ImportSourceField[] {
 const width = widthOf(table.rows);
 const destinations: ImportDestination[] = Array.from({ length: width }, (_, column) => {
  if (legacy) {
   if (table.mapping.front === column) return 'front';
   if (table.mapping.back === column) return 'back';
   const detected = detectedFieldForColumn(table.mapping, column);
   return detected ? semanticDestination[detected] ?? 'ignore' : 'ignore';
  }
  if (column === 0) return 'front';
  const detected = detectedFieldForColumn(table.mapping, column);
  return detected ? semanticDestination[detected] ?? 'back' : 'back';
 });
 const counters = new Map<ImportDestination, number>();
 return destinations.map((destination, column) => {
  const order = counters.get(destination) ?? 0;
  counters.set(destination, order + 1);
  return { key: `field-${column}`, label: labelFor(table, column), column, destination, order, suggested: destination !== 'front' && destination !== 'back' && destination !== 'ignore' };
 });
}

export function importSourceFields(table: ImportTable): ImportSourceField[] {
 if (table.layoutVersion === 1 && Array.isArray(table.sourceFields)) {
  const width = widthOf(table.rows);
  const byColumn = new Map(table.sourceFields.filter(field => Number.isInteger(field.column) && field.column >= 0 && field.column < width).map(field => [field.column, field]));
  const fields = Array.from({ length: width }, (_, column) => {
   const existing = byColumn.get(column);
   return existing ? {
    ...existing,
    key: existing.key || `field-${column}`,
    label: labelFor(table, column),
    destination: validDestinations.has(existing.destination) ? existing.destination : 'back',
    order: Number.isFinite(existing.order) ? existing.order : column,
   } : { key: `field-${column}`, label: labelFor(table, column), column, destination: 'back' as const, order: column };
  });
  return normalizeOrders(fields);
 }
 return normalizeOrders(createSourceFields(table, true));
}

function mappingForFields(table: ImportTable, fields: ImportSourceField[]) {
 const mapping = { ...table.mapping };
 for (const field of Object.keys(mapping) as ImportField[]) {
  if (['front', 'back', 'reading', 'backReading', 'hanViet', 'notes', 'kind', 'tags', 'examples'].includes(field)) delete mapping[field];
 }
 for (const source of fields) {
  if (source.destination === 'ignore') continue;
  const target = destinationMapping[source.destination];
  if (target !== undefined && mapping[target] === undefined) mapping[target] = source.column;
 }
 return mapping;
}

function withFields(table: ImportTable, fields: ImportSourceField[]): ImportTable {
 const normalized = normalizeOrders(fields);
 return { ...table, layoutVersion: 1, sourceFields: normalized, mapping: mappingForFields(table, normalized) };
}

export function assignImportSourceField(table: ImportTable, key: string, destination: ImportDestination): ImportTable {
 let fields = importSourceFields(table);
 const target = fields.find(field => field.key === key);
 if (!target) return withFields(table, fields);
 if (uniqueDestinations.has(destination)) {
  const nextBackOrder = fields.filter(field => field.destination === 'back').length;
  fields = fields.map(field => field.key !== key && field.destination === destination ? { ...field, destination: 'back' as const, order: nextBackOrder } : field);
 }
 const nextOrder = fields.filter(field => field.destination === destination && field.key !== key).length;
 fields = fields.map(field => field.key === key ? { ...field, destination, order: nextOrder, suggested: false } : field);
 return withFields(table, fields);
}

export function moveImportSourceField(table: ImportTable, key: string, delta: -1 | 1): ImportTable {
 const fields = importSourceFields(table);
 const target = fields.find(field => field.key === key);
 if (!target || (target.destination !== 'front' && target.destination !== 'back')) return withFields(table, fields);
 const group = fields.filter(field => field.destination === target.destination).sort((a, b) => a.order - b.order);
 const index = group.findIndex(field => field.key === key), destinationIndex = index + delta;
 if (index < 0 || destinationIndex < 0 || destinationIndex >= group.length) return withFields(table, fields);
 const other = group[destinationIndex];
 return withFields(table, fields.map(field => field.key === target.key ? { ...field, order: other.order } : field.key === other.key ? { ...field, order: target.order } : field));
}

export function setImportTableHeader(table: ImportTable, hasHeader: boolean): ImportTable {
 return withFields({ ...table, hasHeader }, importSourceFields(table).map(field => ({ ...field, label: hasHeader ? text(table.rows[0]?.[field.column]) || `Cột ${field.column + 1}` : `Cột ${field.column + 1}` })));
}

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
function table(rows: string[][], name: string, json = false): ImportTable {
 const header = rows[0] || [];
 const mapping: ImportTable['mapping'] = {};
 for (const field of Object.keys(keys) as ImportField[]) {
  const index = keys[field].map(key => header.findIndex(cell => normalize(key) === normalize(cell))).find(i => i >= 0) ?? -1;
  if (index >= 0) mapping[field] = index;
 }
 if (mapping.back === undefined && mapping.hanViet !== undefined) mapping.back = mapping.hanViet;
 const hasHeader = json || (mapping.front !== undefined && mapping.back !== undefined);
 const normalized = header.map(normalize);
 const inferredKind: ImportedKind = normalized.some(k => ['maunguphap','pattern','congthuc'].includes(k)) ? 'grammar' : normalized.some(k => ['tuchinh','onyomi','kunyomi'].includes(k)) || (normalized.includes('kanji') && !normalized.includes('hiragana')) ? 'kanji' : normalized.some(k => ['word','tu','phienam','reading','hiragana'].includes(k)) ? 'vocabulary' : 'general';
 const result: ImportTable = { id: crypto.randomUUID(), name, rows, hasHeader, selected: true, mapping: hasHeader ? { front: 0, back: 1, ...mapping } : { front: 0, back: 1, ...(header.length > 2 ? { reading: 2 } : {}) }, extraColumns: [], inferredKind: hasHeader ? inferredKind : 'general' };
 return withFields(result, createSourceFields(result));
}
export function remapImportPreview(preview: ImportPreview, tables: ImportTable[]): ImportPreview {
 const cards: ImportedCard[] = [], issues: ImportIssue[] = [], warnings: ImportWarning[] = [], seen = new Set<string>(); let duplicates = 0, total = 0;
 const normalizedTables = tables.map(tab => withFields(tab, importSourceFields(tab)));
 for (const tab of normalizedTables.filter(t => t.selected)) {
  const sourceFields = importSourceFields(tab);
  const frontFields = sourceFields.filter(field => field.destination === 'front').sort((a, b) => a.order - b.order);
  const backFields = sourceFields.filter(field => field.destination === 'back').sort((a, b) => a.order - b.order);
  const start = tab.hasHeader ? 1 : 0;
  total += tab.rows.length - start;
  if (total > 20000) throw new Error('Mỗi file tối đa 20.000 thẻ. Hãy chia nhỏ file.');
  for (let index = start; index < tab.rows.length; index++) {
   const row = tab.rows[index];
   const pick = (field: ImportField) => text(row[tab.mapping[field] ?? -1]);
   const valueFor = (field: ImportSourceField) => text(row[field.column]);
   const frontValues = frontFields.map(field => ({ field, value: valueFor(field) })).filter(item => item.value);
   const backValues = backFields.map(field => ({ field, value: valueFor(field) })).filter(item => item.value);
   const rawReading = normalizeReadingInput(pick('reading')), rawBackReading = normalizeReadingInput(pick('backReading')), hanViet = pick('hanViet'), notes = pick('notes');
   const fail = (reason: string) => issues.push({ row: index + 1, sheet: tab.name, reason });
   if (!frontValues.length) { fail('Thiếu dữ liệu mặt trước'); continue; }
   if (!backValues.length) { fail('Thiếu dữ liệu mặt sau'); continue; }
   const rawFront = frontValues.map(item => item.value).join('\n\n');
   const rawBack = backValues.map(item => item.value).join('\n\n');
   if (rawFront.length > 20000 || rawBack.length > 20000 || notes.length > 20000 || rawReading.length > 10000 || rawBackReading.length > 10000 || hanViet.length > 10000) { fail('Vượt giới hạn trường: mặt trước/mặt sau/ghi chú 20.000, cách đọc/Hán Việt 10.000 ký tự'); continue; }
   const kindText = pick('kind').toLowerCase();
   const aliases: Record<string, ImportedKind> = { vocabulary: 'vocabulary', vocab: 'vocabulary', tuvung: 'vocabulary', kanji: 'kanji', grammar: 'grammar', nguphap: 'grammar', general: 'general' };
   const kind = kindText ? aliases[normalize(kindText)] : tab.inferredKind || 'general';
   if (!kind) { fail('Loại thẻ không hợp lệ'); continue; }
   const tags = pick('tags').split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
   const id = crypto.randomUUID();
   const frontRuby = resolveFurigana(frontValues[0].value, rawReading);
   const backRuby = resolveFurigana(backValues[0].value, rawBackReading);
   const front = [frontRuby.text, ...frontValues.slice(1).map(item => resolveFurigana(item.value, '').text)].join('\n\n');
   const back = [backRuby.text, ...backValues.slice(1).map(item => resolveFurigana(item.value, '').text)].join('\n\n');
   const reading = rawReading || (frontRuby.explicit && !frontRuby.warning ? segmentsReading(frontRuby.segments) : '');
   const backReading = rawBackReading || (backRuby.explicit && !backRuby.warning ? segmentsReading(backRuby.segments) : '');
   if (frontRuby.warning) warnings.push({ cardId: id, row: index + 1, sheet: tab.name, reason: `${frontValues[0].field.label}: ${frontRuby.warning}` });
   if (backRuby.warning) warnings.push({ cardId: id, row: index + 1, sheet: tab.name, reason: `${backValues[0].field.label}: ${backRuby.warning}` });
   for (const item of [...frontValues.slice(1), ...backValues.slice(1)]) {
    const ruby = resolveFurigana(item.value, '');
    if (ruby.warning) warnings.push({ cardId: id, row: index + 1, sheet: tab.name, reason: `${item.field.label}: ${ruby.warning}` });
   }
   const extraData: Record<string, string> = Object.fromEntries(tab.extraColumns.filter(i => !Object.values(tab.mapping).includes(i)).map(i => [tab.hasHeader ? tab.rows[0][i] || `Cột ${i + 1}` : `Cột ${i + 1}`, text(row[i])]));
   const layout: StoredImportFieldLayout = { version: 1, fields: sourceFields.filter(field => field.destination !== 'ignore').map(({ key, label, destination, order }) => ({ key, label, destination, order })) };
   extraData.importFieldLayout = JSON.stringify(layout);
   extraData.importFieldValues = JSON.stringify(Object.fromEntries(sourceFields.filter(field => field.destination !== 'ignore').map(field => [field.key, valueFor(field)])));
   if (backReading) extraData.backReading = backReading;
   if (frontRuby.segments.some(segment => segment.reading)) extraData.frontFuriganaSegments = JSON.stringify(frontRuby.segments);
   if (backRuby.segments.some(segment => segment.reading)) extraData.backFuriganaSegments = JSON.stringify(backRuby.segments);
   try {
    const examples = parseCardExamples(pick('examples'));
    if (examples.length) extraData.examples = JSON.stringify(examples);
   } catch (error) { fail(error instanceof Error ? error.message : 'examples không hợp lệ'); continue; }
   if (tags.length > 100 || tags.some(t => t.length > 100) || JSON.stringify(extraData).length > 100000) { fail('Nhãn hoặc dữ liệu mở rộng vượt giới hạn'); continue; }
   const pair = JSON.stringify([front.replace(/\s+/g, ' '), back.replace(/\s+/g, ' ')]);
   if (seen.has(pair)) { duplicates++; fail('Trùng cặp mặt trước / mặt sau'); continue; }
   seen.add(pair);
   cards.push({ id, front, back, reading, backReading, hanViet, notes, kind, tags, sourceRef: preview.source, ...(tab.name ? { sourceSheet: tab.name } : {}), ...(Object.keys(extraData).length ? { extraData } : {}) });
  }
 }
 return { ...preview, tables: normalizedTables, cards, skipped: issues.length, issues, warnings, duplicates };
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
  tab = table([header, ...records.map(r => header.map(k => {
   const value = r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>)[k] : '';
   return value != null && (k === 'examples' || (Array.isArray(value) && value.some(item => item != null && typeof item === 'object'))) ? JSON.stringify(value) : text(value);
  }))], '', true); format = 'JSON';
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
