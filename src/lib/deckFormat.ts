// Core of the SoNhat deck format v1 (see docs/deck-format-v1.md). Kept free of runtime imports from
// ankiImport.ts so both can be used from plain node tests; ankiImport re-exports what callers used to import from it.
import { isFontId } from './fontRegistry.ts';
import { MIN_CONTRAST, styleContrast } from './styleContrast.ts';
import { normalizeReadingInput, parseFuriganaMarkup, parseStoredFurigana, resolveFurigana, segmentsReading, serializeFurigana } from './furigana.ts';
import type { ImportedCard, ImportedKind } from './ankiImport.ts';

export const FORMAT_NAME = 'sonhat.deck';
export const FORMAT_VERSION = 1;
export const LIMITS = { fileBytes: 20 * 1024 * 1024, cards: 20000, noteTypes: 16, fields: 24, text: 20000, kana: 10000, examples: 100, tags: 100, tagLength: 100, cardChars: 100000 } as const;

// ---------- resolved template (the shape every renderer already consumes) ----------
export type CardTheme = 'paper' | 'blue' | 'dark' | 'system';
/** A font id from fontRegistry.ts (bundled), or later `custom:<uuid>`. */
export type CardFontFamily = string;
export type CardField = 'front' | 'back' | 'reading' | 'hanViet' | 'notes' | 'kind' | 'deckName' | `field:${string}`;
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
  /** Custom colors; absent keys follow the theme. */
  colors?: { bg?: string; fg?: string; accent?: string };
}
export interface DeckTemplateConfig {
  version: 4;
  front: { fields: CardField[]; showDeckName: boolean; style: CardSideStyle };
  back: { fields: CardField[]; showFront: boolean; showExamples: boolean; style: CardSideStyle };
  /** Labels of custom note-type fields (`field:<key>`), present only when the note type has any. */
  fieldLabels?: Record<string, string>;
  /** Per-field style overrides of the note type, keyed by field key. */
  fieldStyles?: Record<string, StyleSpec>;
}
export const CARD_FONT_PRESETS: Record<CardSideStyle['fontScale'], number> = { small: 20, medium: 24, large: 30, xlarge: 36 };
export const defaultDeckTemplate = (): DeckTemplateConfig => ({
  version: 4,
  front: { fields: ['front', 'reading'], showDeckName: true, style: { theme: 'paper', fontScale: 'large', fontSize: CARD_FONT_PRESETS.large, bold: false, italic: false, fontFamily: 'default', alignment: 'center', autoFit: true } },
  back: { fields: ['back', 'reading', 'hanViet', 'notes'], showFront: false, showExamples: true, style: { theme: 'paper', fontScale: 'large', fontSize: CARD_FONT_PRESETS.large, bold: false, italic: false, fontFamily: 'default', alignment: 'center' } },
});

const THEMES: CardTheme[] = ['paper', 'blue', 'dark', 'system'];
const SCALES: CardSideStyle['fontScale'][] = ['small', 'medium', 'large', 'xlarge'];
const LEGACY_FIELDS: CardField[] = ['front', 'back', 'reading', 'hanViet', 'notes', 'kind', 'deckName'];
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function legacyTemplate(value: unknown): DeckTemplateConfig {
  const fallback = defaultDeckTemplate();
  if (!isRecord(value)) return fallback;
  const version = typeof value.version === 'number' ? value.version : 1;
  const frontConfig = isRecord(value.front) ? value.front : {};
  const backConfig = isRecord(value.back) ? value.back : {};
  const legacyStyle = isRecord(value.style) ? value.style : {};
  const fields = (candidate: unknown, defaults: CardField[]) => Array.isArray(candidate)
    ? candidate.filter((field): field is CardField => LEGACY_FIELDS.includes(field as CardField) || (typeof field === 'string' && /^field:[a-z][A-Za-z0-9]{0,31}$/.test(field))).slice(0, 12)
    : defaults;
  const style = (candidate: unknown, defaults: CardSideStyle): CardSideStyle => {
    const source = isRecord(candidate) ? candidate : legacyStyle;
    const fontScale = SCALES.includes(source.fontScale as CardSideStyle['fontScale']) ? source.fontScale as CardSideStyle['fontScale'] : defaults.fontScale;
    const requested = typeof source.fontSize === 'number' && Number.isFinite(source.fontSize) ? Math.round(source.fontSize) : CARD_FONT_PRESETS[fontScale];
    const colors = sanitizeStyle({ colors: source.colors }, '')?.colors;
    return {
      theme: THEMES.includes(source.theme as CardTheme) ? source.theme as CardTheme : defaults.theme,
      fontScale,
      fontSize: Math.max(12, Math.min(72, requested)),
      bold: source.bold === true,
      italic: source.italic === true,
      fontFamily: isFontId(source.fontFamily) ? source.fontFamily : defaults.fontFamily,
      alignment: source.alignment === 'left' ? 'left' : 'center',
      ...(typeof source.autoFit === 'boolean' ? { autoFit: source.autoFit } : {}),
      ...(colors ? { colors } : {}),
    };
  };
  const labels = isRecord(value.fieldLabels)
    ? Object.fromEntries(Object.entries(value.fieldLabels).filter(([key, label]) => KEY_PATTERN.test(key) && typeof label === 'string' && label.trim()).map(([key, label]) => [key, (label as string).trim().slice(0, 60)]))
    : {};
  const fieldStyles = isRecord(value.fieldStyles)
    ? Object.fromEntries(Object.entries(value.fieldStyles).filter(([key]) => KEY_PATTERN.test(key)).flatMap(([key, raw]) => { const spec = sanitizeStyle(raw, ''); return spec ? [[key, spec]] : []; }))
    : {};
  return {
    version: 4,
    ...(Object.keys(labels).length ? { fieldLabels: labels } : {}),
    ...(Object.keys(fieldStyles).length ? { fieldStyles } : {}),
    front: { fields: fields(frontConfig.fields, fallback.front.fields), showDeckName: typeof frontConfig.showDeckName === 'boolean' ? frontConfig.showDeckName : fallback.front.showDeckName, style: style(frontConfig.style, fallback.front.style) },
    back: { fields: fields(backConfig.fields, fallback.back.fields), showFront: version >= 3 && typeof backConfig.showFront === 'boolean' ? backConfig.showFront : false, showExamples: typeof backConfig.showExamples === 'boolean' ? backConfig.showExamples : true, style: style(backConfig.style, fallback.back.style) },
  };
}

/** Template for renderers. v5 configs resolve to their first note type; use resolveTemplate for a specific card. */
export function normalizeDeckTemplate(value: unknown): DeckTemplateConfig {
  return isRecord(value) && value.version === 5 ? resolveTemplate(normalizeConfig(value)) : legacyTemplate(value);
}

// ---------- style spec (format) ----------
export interface StyleSpec {
  theme?: CardTheme;
  colors?: { bg?: string; fg?: string; accent?: string };
  font?: { family?: string; size?: number; bold?: boolean; italic?: boolean };
  align?: 'left' | 'center';
  autoFit?: boolean;
}
const COLOR = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;
const FONT_ID = /^(?:[A-Za-z][A-Za-z0-9]{0,31}|custom:[0-9a-f-]{36})$/;

export function sanitizeStyle(value: unknown, path: string, issues?: Issue[]): StyleSpec | undefined {
  if (value === undefined) return undefined;
  const warn = (sub: string, message: string) => issues?.push({ severity: 'warning', path: `${path}${sub}`, code: 'bad_value', message });
  if (!isRecord(value)) { warn('', 'style phải là một đối tượng'); return undefined; }
  const out: StyleSpec = {};
  if (value.theme !== undefined) {
    if (THEMES.includes(value.theme as CardTheme)) out.theme = value.theme as CardTheme;
    else warn('.theme', 'theme không được hỗ trợ');
  }
  if (isRecord(value.colors)) {
    const colors: NonNullable<StyleSpec['colors']> = {};
    for (const key of ['bg', 'fg', 'accent'] as const) {
      const color = value.colors[key];
      if (color === undefined) continue;
      if (typeof color === 'string' && COLOR.test(color)) colors[key] = color.toLowerCase();
      else warn(`.colors.${key}`, 'màu phải dạng #rgb, #rrggbb hoặc #rrggbbaa');
    }
    if (Object.keys(colors).length) out.colors = colors;
  } else if (value.colors !== undefined) warn('.colors', 'colors phải là một đối tượng');
  if (isRecord(value.font)) {
    const font: NonNullable<StyleSpec['font']> = {};
    const { family, size, bold, italic } = value.font;
    if (family !== undefined) {
      if (typeof family === 'string' && FONT_ID.test(family)) font.family = family;
      else warn('.font.family', 'font không hợp lệ');
    }
    if (size !== undefined) {
      if (typeof size === 'number' && Number.isInteger(size) && size >= 12 && size <= 72) font.size = size;
      else warn('.font.size', 'cỡ chữ phải là số nguyên 12–72');
    }
    if (bold !== undefined) {
      if (typeof bold === 'boolean') font.bold = bold;
      else warn('.font.bold', 'bold phải là true/false');
    }
    if (italic !== undefined) {
      if (typeof italic === 'boolean') font.italic = italic;
      else warn('.font.italic', 'italic phải là true/false');
    }
    if (Object.keys(font).length) out.font = font;
  } else if (value.font !== undefined) warn('.font', 'font phải là một đối tượng');
  if (value.align !== undefined) {
    if (value.align === 'left' || value.align === 'center') out.align = value.align;
    else warn('.align', 'align phải là left hoặc center');
  }
  if (value.autoFit !== undefined) {
    if (typeof value.autoFit === 'boolean') out.autoFit = value.autoFit;
    else warn('.autoFit', 'autoFit phải là true/false');
  }
  const contrast = styleContrast(out);
  if (contrast && !contrast.ok) issues?.push({ severity: 'warning', path, code: 'low_contrast', message: `Chữ và nền chỉ đạt tương phản ${contrast.ratio.toFixed(1)}:1 (khuyến nghị ≥ ${MIN_CONTRAST}:1)` });
  return Object.keys(out).length ? out : undefined;
}

function mergeStyle(...layers: Array<StyleSpec | undefined>): StyleSpec {
  const out: StyleSpec = {};
  for (const layer of layers) {
    if (!layer) continue;
    const { colors, font, ...rest } = layer;
    Object.assign(out, rest);
    if (colors) out.colors = { ...out.colors, ...colors };
    if (font) out.font = { ...out.font, ...font };
  }
  return out;
}

function specToSide(spec: StyleSpec, defaults: CardSideStyle): CardSideStyle {
  const size = Math.max(12, Math.min(72, spec.font?.size ?? defaults.fontSize));
  const family = spec.font?.family as CardFontFamily | undefined;
  return {
    theme: spec.theme ?? defaults.theme,
    fontScale: SCALES.find(scale => CARD_FONT_PRESETS[scale] === size) ?? 'large',
    fontSize: size,
    bold: spec.font?.bold ?? defaults.bold,
    italic: spec.font?.italic ?? defaults.italic,
    // Unknown ids (fonts added by later versions, uploaded fonts) fall back instead of failing.
    fontFamily: isFontId(family) ? family : defaults.fontFamily,
    alignment: spec.align ?? defaults.alignment,
    ...((spec.colors ?? defaults.colors) ? { colors: { ...defaults.colors, ...spec.colors } } : {}),
    // false and absent render the same, so false is omitted to keep older templates byte-identical.
    ...((spec.autoFit ?? defaults.autoFit) ? { autoFit: true } : {}),
  };
}

const sideToSpec = (style: CardSideStyle): StyleSpec => ({
  theme: style.theme,
  font: { family: style.fontFamily, size: style.fontSize, bold: style.bold, italic: style.italic },
  align: style.alignment,
  autoFit: style.autoFit === true,
  ...(style.colors ? { colors: style.colors } : {}),
});

/** A resolved side style with more specific layers (field, card) applied on top. */
export function mergeSideStyle(base: CardSideStyle, ...layers: Array<StyleSpec | undefined>): CardSideStyle {
  return layers.some(Boolean) ? specToSide(mergeStyle(sideToSpec(base), ...layers), base) : base;
}

// ---------- note types ----------
export type FieldType = 'text' | 'ruby' | 'kana' | 'examples';
export type NoteKind = 'VOCABULARY' | 'KANJI' | 'GRAMMAR' | 'GENERAL';
export interface NoteField { key: string; label: string; type: FieldType; required?: boolean; for?: string; style?: StyleSpec }
export interface NoteFace { show: string[]; showFront?: boolean; style?: StyleSpec }
export interface NoteType { id: string; name: string; kind: NoteKind; fields: NoteField[]; front: NoteFace; back: NoteFace; style?: StyleSpec }
export interface CardExample { japanese: string; reading: string; meaning: string }
export type FieldValue = string | CardExample[];
export type CardFieldValues = Record<string, FieldValue>;
export interface DeckConfig { version: 5; style?: StyleSpec; noteTypes: NoteType[] }

export const KEY_PATTERN = /^[a-z][A-Za-z0-9]{0,31}$/;
export const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const PSEUDO_KEYS = ['@kind', '@deckName'] as const;
const FIELD_TYPES: FieldType[] = ['text', 'ruby', 'kana', 'examples'];
const KINDS: NoteKind[] = ['VOCABULARY', 'KANJI', 'GRAMMAR', 'GENERAL'];

export function parseCardExamples(value: unknown): CardExample[] {
  if (value == null || value === '') return [];
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.length > LIMITS.examples) throw new Error('examples phải là danh sách, tối đa 100 ví dụ.');
  return parsed.map(example => {
    if (!isRecord(example)) throw new Error('Mỗi ví dụ phải là một đối tượng.');
    if (typeof example.japanese !== 'string' || !example.japanese.trim() || typeof example.meaning !== 'string' || !example.meaning.trim() || (example.reading != null && typeof example.reading !== 'string')) throw new Error('Ví dụ cần japanese và meaning; reading là chuỗi tùy chọn.');
    return { japanese: example.japanese.trim(), reading: typeof example.reading === 'string' ? example.reading.trim() : '', meaning: example.meaning.trim() };
  });
}

export const exampleLines = (value: unknown) => Array.isArray(value)
  ? (value as CardExample[]).map(example => `${example.japanese} | ${example.reading} | ${example.meaning}`).join('\n')
  : '';

/** One line per example: "câu tiếng Nhật | cách đọc | nghĩa". The reading may be left empty or omitted. */
export function parseExampleLines(input: string): { examples: CardExample[]; invalid: number } {
  const examples: CardExample[] = [];
  let invalid = 0;
  for (const line of input.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|').map(part => part.trim());
    const [japanese, reading, meaning] = parts.length === 2 ? [parts[0], '', parts[1]] : parts;
    if (parts.length < 2 || parts.length > 3 || !japanese || !meaning) { invalid++; continue; }
    examples.push({ japanese, reading, meaning });
  }
  return { examples, invalid };
}

const STANDARD_FIELDS = (): NoteField[] => [
  { key: 'front', label: 'Mặt trước', type: 'ruby', required: true },
  { key: 'frontReading', label: 'Cách đọc mặt trước', type: 'kana', for: 'front' },
  { key: 'back', label: 'Mặt sau', type: 'ruby', required: true },
  { key: 'backReading', label: 'Cách đọc mặt sau', type: 'kana', for: 'back' },
  { key: 'hanViet', label: 'Hán Việt', type: 'text' },
  { key: 'notes', label: 'Ghi chú', type: 'text' },
  { key: 'examples', label: 'Ví dụ', type: 'examples' },
];
const BUILTIN: Array<[string, string, NoteKind]> = [['vocab', 'Từ vựng', 'VOCABULARY'], ['kanji', 'Kanji', 'KANJI'], ['grammar', 'Ngữ pháp', 'GRAMMAR'], ['general', 'Thẻ tổng hợp', 'GENERAL']];
export const builtinNoteTypes = (): NoteType[] => BUILTIN.map(([id, name, kind]) => ({
  id, name, kind, fields: STANDARD_FIELDS(),
  front: { show: ['front', 'frontReading'] },
  back: { show: ['back', 'backReading', 'hanViet', 'notes', 'examples'] },
}));
export const noteTypeIdForKind = (kind: ImportedKind | NoteKind): string => BUILTIN.find(([, , k]) => k === kind.toUpperCase())?.[0] ?? 'general';
export const kindOfNoteType = (type: Pick<NoteType, 'kind'>): ImportedKind => type.kind.toLowerCase() as ImportedKind;

export function sanitizeNoteType(value: unknown, path: string, issues: Issue[]): NoteType | undefined {
  const fail = (sub: string, code: IssueCode, message: string) => { issues.push({ severity: 'error', path: `${path}${sub}`, code, message }); };
  if (!isRecord(value)) { fail('', 'bad_type', 'Loại thẻ phải là một đối tượng'); return; }
  const before = issues.length;
  const id = typeof value.id === 'string' && ID_PATTERN.test(value.id) ? value.id : (fail('.id', 'bad_value', 'id loại thẻ phải dạng [a-z][a-z0-9-]{0,31}'), '');
  const name = typeof value.name === 'string' && value.name.trim() && value.name.trim().length <= 60 ? value.name.trim() : (fail('.name', 'bad_value', 'Tên loại thẻ cần 1–60 ký tự'), '');
  const kind = value.kind === undefined ? 'GENERAL' : KINDS.includes(value.kind as NoteKind) ? value.kind as NoteKind : (fail('.kind', 'bad_value', 'kind phải là VOCABULARY, KANJI, GRAMMAR hoặc GENERAL'), 'GENERAL');
  const fields: NoteField[] = [];
  if (!Array.isArray(value.fields) || value.fields.length < 2 || value.fields.length > LIMITS.fields) fail('.fields', 'bad_value', `Loại thẻ cần 2–${LIMITS.fields} trường`);
  else {
    const seen = new Set<string>();
    value.fields.forEach((raw, index) => {
      const at = `.fields[${index}]`;
      if (!isRecord(raw)) return fail(at, 'bad_type', 'Trường phải là một đối tượng');
      const key = typeof raw.key === 'string' && KEY_PATTERN.test(raw.key) ? raw.key : '';
      if (!key) return fail(`${at}.key`, 'bad_value', 'key trường phải dạng [a-z][A-Za-z0-9]{0,31}');
      if (seen.has(key)) return fail(`${at}.key`, 'duplicate', `key "${key}" bị trùng`);
      seen.add(key);
      const type = FIELD_TYPES.includes(raw.type as FieldType) ? raw.type as FieldType : (fail(`${at}.type`, 'bad_value', 'type trường phải là text, ruby, kana hoặc examples'), 'text' as FieldType);
      const label = typeof raw.label === 'string' && raw.label.trim() && raw.label.trim().length <= 60 ? raw.label.trim() : (fail(`${at}.label`, 'bad_value', 'Nhãn trường cần 1–60 ký tự'), key);
      const style = sanitizeStyle(raw.style, `${path}${at}.style`, issues);
      fields.push({ key, label, type, ...(raw.required === true ? { required: true } : {}), ...(typeof raw.for === 'string' ? { for: raw.for } : {}), ...(style ? { style } : {}) });
    });
    for (const field of fields) if (field.for !== undefined && fields.find(other => other.key === field.for)?.type !== 'ruby') fail('.fields', 'bad_value', `"for" của trường ${field.key} phải trỏ tới một trường ruby`);
    for (const key of ['front', 'back']) if (fields.filter(field => field.key === key).length !== 1) fail('.fields', 'required', `Loại thẻ cần đúng một trường có key "${key}"`);
  }
  const keys = new Set([...fields.map(field => field.key), ...PSEUDO_KEYS]);
  const face = (side: 'front' | 'back'): NoteFace => {
    const raw = value[side];
    const shown = isRecord(raw) && Array.isArray(raw.show) ? raw.show.filter((key): key is string => typeof key === 'string') : [];
    if (!isRecord(raw) || !Array.isArray(raw.show) || shown.length !== raw.show.length || !shown.length || shown.some(key => !keys.has(key))) fail(`.${side}.show`, 'bad_value', `Mặt ${side === 'front' ? 'trước' : 'sau'} cần ít nhất một trường hợp lệ`);
    const style = sanitizeStyle(isRecord(raw) ? raw.style : undefined, `${path}.${side}.style`, issues);
    return { show: [...new Set(shown)], ...(side === 'back' && isRecord(raw) && raw.showFront === true ? { showFront: true } : {}), ...(style ? { style } : {}) };
  };
  const front = face('front'), back = face('back');
  const style = sanitizeStyle(value.style, `${path}.style`, issues);
  if (issues.length > before && issues.slice(before).some(issue => issue.severity === 'error')) return;
  return { id, name, kind, fields, front, back, ...(style ? { style } : {}) };
}

// ---------- validation ----------
export type IssueCode = 'required' | 'too_long' | 'bad_type' | 'bad_value' | 'unknown_type' | 'unknown_field' | 'unknown_key' | 'duplicate' | 'limit_exceeded' | 'low_contrast' | 'bad_version' | 'bad_markup';
export interface Issue { severity: 'error' | 'warning'; path: string; code: IssueCode; message: string }
export interface FileCard { uid?: string; type: string; fields: CardFieldValues; tags?: string[]; style?: StyleSpec }
export interface DeckFile {
  format: typeof FORMAT_NAME;
  version: number;
  deck: { name: string; description?: string; tags?: string[]; style?: StyleSpec; noteTypes: NoteType[]; ext?: Record<string, unknown> };
  cards: FileCard[];
  ext?: Record<string, unknown>;
}
export interface ValidationResult { file?: DeckFile; issues: Issue[]; skipped: number; ok: boolean }

const pairKey = (fields: CardFieldValues) => JSON.stringify([text(fields.front).replace(/\s+/g, ' '), text(fields.back).replace(/\s+/g, ' ')]);
const text = (value: FieldValue | undefined) => typeof value === 'string' ? value : '';

export function validateTags(value: unknown, path: string, issues: Issue[]): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > LIMITS.tags || value.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > LIMITS.tagLength)) {
    issues.push({ severity: 'error', path, code: 'bad_value', message: `tags phải là mảng tối đa ${LIMITS.tags} chuỗi không rỗng, mỗi chuỗi ≤ ${LIMITS.tagLength} ký tự` });
    return undefined;
  }
  return value.map(tag => (tag as string).trim());
}

/** Validates one card's fields against its note type. Returns normalized fields, or issues with severity "error" when the card must be skipped. */
export function validateCardFields(noteType: NoteType, raw: unknown, path: string, issues: Issue[]): CardFieldValues | undefined {
  if (!isRecord(raw)) { issues.push({ severity: 'error', path, code: 'bad_type', message: 'fields phải là một đối tượng' }); return; }
  const before = issues.length;
  const out: CardFieldValues = {};
  const known = new Map(noteType.fields.map(field => [field.key, field]));
  let total = 0;
  const rejected = new Set<string>();
  for (const [key, value] of Object.entries(raw)) {
    const field = known.get(key);
    if (!field) { issues.push({ severity: 'warning', path: `${path}.${key}`, code: 'unknown_field', message: `Trường "${key}" không thuộc loại thẻ ${noteType.name}` }); continue; }
    if (field.type === 'examples') {
      try { const examples = parseCardExamples(value); if (examples.length) out[key] = examples; total += JSON.stringify(examples).length; }
      catch (error) { rejected.add(key); issues.push({ severity: 'error', path: `${path}.${key}`, code: 'bad_value', message: error instanceof Error ? error.message : 'examples không hợp lệ' }); }
      continue;
    }
    if (value == null) continue;
    if (typeof value !== 'string') { rejected.add(key); issues.push({ severity: 'error', path: `${path}.${key}`, code: 'bad_type', message: `Trường "${field.label}" phải là chuỗi` }); continue; }
    const limit = field.type === 'kana' ? LIMITS.kana : LIMITS.text;
    if (value.length > limit) { rejected.add(key); issues.push({ severity: 'error', path: `${path}.${key}`, code: 'too_long', message: `Trường "${field.label}" vượt ${limit.toLocaleString('vi-VN')} ký tự` }); continue; }
    total += value.length;
    const normalized = value.replace(/\r\n?/g, '\n').trim().normalize('NFC');
    if (normalized) out[key] = normalized;
  }
  if (total > LIMITS.cardChars) issues.push({ severity: 'error', path, code: 'too_long', message: 'Tổng dữ liệu của thẻ vượt giới hạn 100.000 ký tự' });
  for (const field of noteType.fields) if (field.required && !rejected.has(field.key) && !text(out[field.key])) issues.push({ severity: 'error', path: `${path}.${field.key}`, code: 'required', message: `Thiếu "${field.label}"` });
  for (const field of noteType.fields) {
    const value = out[field.key];
    if (field.type === 'ruby' && typeof value === 'string' && parseFuriganaMarkup(value).warning) issues.push({ severity: 'warning', path: `${path}.${field.key}`, code: 'bad_markup', message: `${field.label}: cú pháp furigana chưa đúng, dùng dạng 学校[がっこう]` });
  }
  return issues.slice(before).some(issue => issue.severity === 'error') ? undefined : out;
}

export function validateDeckFile(input: unknown): ValidationResult {
  const issues: Issue[] = [];
  const reject = (path: string, code: IssueCode, message: string): ValidationResult => ({ issues: [...issues, { severity: 'error', path, code, message }], skipped: 0, ok: false });
  if (!isRecord(input)) return reject('', 'bad_type', 'Tệp phải là một đối tượng JSON');
  if (input.format !== FORMAT_NAME) return reject('format', 'bad_value', `format phải là "${FORMAT_NAME}"`);
  if (typeof input.version !== 'number' || !Number.isInteger(input.version) || input.version < 1) return reject('version', 'bad_version', 'version phải là số nguyên ≥ 1');
  if (input.version > FORMAT_VERSION) return reject('version', 'bad_version', 'Tệp dùng định dạng mới hơn. Hãy cập nhật ứng dụng.');
  const ext: Record<string, unknown> = {};
  const known = new Set(['format', 'version', 'deck', 'cards']);
  for (const key of Object.keys(input)) {
    if (known.has(key)) continue;
    if (key.startsWith('x-')) ext[key] = input[key];
    else issues.push({ severity: 'warning', path: key, code: 'unknown_key', message: `Bỏ qua khóa "${key}"` });
  }
  const deck = input.deck;
  if (!isRecord(deck)) return reject('deck', 'required', 'Thiếu deck');
  const name = typeof deck.name === 'string' ? deck.name.trim() : '';
  if (!name || name.length > 200) return reject('deck.name', 'bad_value', 'Tên bộ thẻ cần 1–200 ký tự');
  if (deck.description !== undefined && (typeof deck.description !== 'string' || deck.description.length > 5000)) return reject('deck.description', 'bad_value', 'description phải là chuỗi ≤ 5.000 ký tự');
  const deckTags = validateTags(deck.tags, 'deck.tags', issues);
  if (issues.some(issue => issue.severity === 'error')) return { issues, skipped: 0, ok: false };
  const deckExt: Record<string, unknown> = {};
  for (const key of Object.keys(deck)) {
    if (['name', 'description', 'tags', 'style', 'noteTypes'].includes(key)) continue;
    if (key.startsWith('x-')) deckExt[key] = deck[key];
    else issues.push({ severity: 'warning', path: `deck.${key}`, code: 'unknown_key', message: `Bỏ qua khóa "deck.${key}"` });
  }

  let noteTypes: NoteType[];
  if (deck.noteTypes === undefined) noteTypes = builtinNoteTypes();
  else {
    if (!Array.isArray(deck.noteTypes) || !deck.noteTypes.length || deck.noteTypes.length > LIMITS.noteTypes) return reject('deck.noteTypes', 'bad_value', `noteTypes cần 1–${LIMITS.noteTypes} loại thẻ`);
    const parsed = deck.noteTypes.map((value, index) => sanitizeNoteType(value, `deck.noteTypes[${index}]`, issues));
    if (issues.some(issue => issue.severity === 'error') || parsed.some(type => !type)) return { issues, skipped: 0, ok: false };
    noteTypes = parsed as NoteType[];
    const ids = new Set<string>();
    for (const type of noteTypes) { if (ids.has(type.id)) return reject('deck.noteTypes', 'duplicate', `id loại thẻ "${type.id}" bị trùng`); ids.add(type.id); }
  }
  const style = sanitizeStyle(deck.style, 'deck.style', issues);
  if (!Array.isArray(input.cards)) return reject('cards', 'required', 'cards phải là một mảng');
  if (input.cards.length > LIMITS.cards) return reject('cards', 'limit_exceeded', 'Mỗi tệp tối đa 20.000 thẻ. Hãy chia nhỏ tệp.');
  const types = new Map(noteTypes.map(type => [type.id, type]));
  const cards: FileCard[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  input.cards.forEach((raw, index) => {
    const path = `cards[${index}]`;
    const before = issues.length;
    const drop = (sub: string, code: IssueCode, message: string) => { issues.push({ severity: 'error', path: `${path}${sub}`, code, message }); skipped++; };
    if (!isRecord(raw)) return drop('', 'bad_type', 'Thẻ phải là một đối tượng');
    const type = typeof raw.type === 'string' ? types.get(raw.type) : undefined;
    if (!type) return drop('.type', 'unknown_type', `Loại thẻ "${String(raw.type)}" không có trong noteTypes`);
    const fields = validateCardFields(type, raw.fields, `${path}.fields`, issues);
    const tags = validateTags(raw.tags, `${path}.tags`, issues);
    if (raw.uid !== undefined && (typeof raw.uid !== 'string' || !raw.uid.trim() || raw.uid.length > 64)) issues.push({ severity: 'error', path: `${path}.uid`, code: 'bad_value', message: 'uid phải là chuỗi 1–64 ký tự' });
    const cardStyle = sanitizeStyle(raw.style, `${path}.style`, issues);
    if (!fields || issues.slice(before).some(issue => issue.severity === 'error')) { skipped++; return; }
    const keys = [pairKey(fields), ...(typeof raw.uid === 'string' ? [`uid:${raw.uid}`] : [])];
    if (keys.some(key => seen.has(key))) { issues.push({ severity: 'error', path, code: 'duplicate', message: 'Trùng cặp mặt trước / mặt sau hoặc uid' }); skipped++; return; }
    keys.forEach(key => seen.add(key));
    cards.push({ ...(typeof raw.uid === 'string' ? { uid: raw.uid } : {}), type: type.id, fields, ...(tags?.length ? { tags } : {}), ...(cardStyle ? { style: cardStyle } : {}) });
  });
  const usedTypes = noteTypes.filter(type => deck.noteTypes !== undefined || cards.some(card => card.type === type.id));
  const file: DeckFile = {
    format: FORMAT_NAME, version: input.version,
    deck: { name, ...(typeof deck.description === 'string' && deck.description.trim() ? { description: deck.description.trim() } : {}), ...(deckTags?.length ? { tags: deckTags } : {}), ...(style ? { style } : {}), noteTypes: usedTypes.length ? usedTypes : noteTypes.slice(0, 1), ...(Object.keys(deckExt).length ? { ext: deckExt } : {}) },
    cards, ...(Object.keys(ext).length ? { ext } : {}),
  };
  return { file, issues, skipped, ok: true };
}

// ---------- persisted template (decks.template_config, version 5) ----------
export function upgradeLegacyTemplate(legacy: DeckTemplateConfig): DeckConfig {
  const toShow = (fields: CardField[], side: 'front' | 'back'): string[] => {
    const show: string[] = [];
    for (const field of fields) {
      const keys = field === 'reading' ? [side === 'front' ? 'frontReading' : 'backReading'] : field === 'kind' ? ['@kind'] : field === 'deckName' ? ['@deckName'] : field.startsWith('field:') ? [field.slice(6)] : [field];
      for (const key of keys) if (!show.includes(key)) show.push(key);
    }
    if (side === 'back' && legacy.back.showExamples !== false && fields.includes('back')) show.push('examples');
    return show.length ? show : [side];
  };
  const noteTypes = builtinNoteTypes().map(type => ({
    ...type,
    front: { show: toShow(legacy.front.fields, 'front'), style: sideToSpec(legacy.front.style) },
    back: { show: toShow(legacy.back.fields, 'back'), ...(legacy.back.showFront ? { showFront: true } : {}), style: sideToSpec(legacy.back.style) },
  }));
  return { version: 5, noteTypes };
}

/** Accepts persisted v5 configs and every older template shape; anything unusable falls back to the built-in note types. */
export function normalizeConfig(value: unknown): DeckConfig {
  if (isRecord(value) && value.version === 5) {
    const issues: Issue[] = [];
    const noteTypes = (Array.isArray(value.noteTypes) ? value.noteTypes : []).slice(0, LIMITS.noteTypes)
      .map((raw, index) => sanitizeNoteType(raw, `noteTypes[${index}]`, issues)).filter((type): type is NoteType => !!type);
    const style = sanitizeStyle(value.style, 'style');
    if (noteTypes.length) return { version: 5, ...(style ? { style } : {}), noteTypes };
  }
  return upgradeLegacyTemplate(legacyTemplate(value));
}

export function noteTypeOf(config: DeckConfig, id: string | undefined): NoteType {
  return config.noteTypes.find(type => type.id === id) ?? config.noteTypes[0];
}

/** Renderer-facing view of one note type: the v4 shape every study and preview component already understands. */
export function resolveTemplate(config: DeckConfig, noteTypeId?: string): DeckTemplateConfig {
  const type = noteTypeOf(config, noteTypeId);
  const defaults = defaultDeckTemplate();
  const toFields = (face: NoteFace): CardField[] => {
    const out: CardField[] = [];
    for (const key of face.show) {
      const field: CardField | null = key === 'frontReading' || key === 'backReading' ? 'reading' : key === 'examples' ? null : key === '@kind' ? 'kind' : key === '@deckName' ? 'deckName'
        : ['front', 'back', 'hanViet', 'notes'].includes(key) ? key as CardField : `field:${key}`;
      if (field && !out.includes(field)) out.push(field);
    }
    return out;
  };
  const fieldStyles = Object.fromEntries(type.fields.filter(field => field.style).map(field => [field.key, field.style!]));
  const customLabels = Object.fromEntries(type.fields.filter(field => ![...STANDARD_FIELDS().map(item => item.key)].includes(field.key)).map(field => [field.key, field.label]));
  return {
    version: 4,
    front: { fields: toFields(type.front), showDeckName: defaults.front.showDeckName, style: specToSide(mergeStyle(config.style, type.style, type.front.style), defaults.front.style) },
    back: { fields: toFields(type.back), showFront: type.back.showFront === true, showExamples: type.back.show.includes('examples'), style: specToSide(mergeStyle(config.style, type.style, type.back.style), defaults.back.style) },
    ...(Object.keys(customLabels).length ? { fieldLabels: customLabels } : {}),
    ...(Object.keys(fieldStyles).length ? { fieldStyles } : {}),
  };
}

const fieldSignature = (type: NoteType) => type.fields.map(field => field.key).join('|');

/**
 * Writes what a v4-shaped editor (appearance dialog) changed back into the deck config. The edit lands on the note type
 * it was made for and on every type with the same field keys, so decks that never had note types (all four built-ins
 * share one layout) keep changing as a whole.
 */
export function applyResolvedTemplate(config: DeckConfig, noteTypeId: string, resolved: DeckTemplateConfig): DeckConfig {
  const normalized = legacyTemplate(resolved);
  const edited = config.noteTypes.find(type => type.id === noteTypeId);
  return {
    ...config,
    noteTypes: config.noteTypes.map(type => {
      if (!edited || (type.id !== noteTypeId && fieldSignature(type) !== fieldSignature(edited))) return type;
      const has = (key: string) => type.fields.some(field => field.key === key);
      const toShow = (fields: CardField[], side: 'front' | 'back'): string[] => {
        const show: string[] = [];
        for (const field of fields) {
          const keys = field === 'reading' ? [side === 'front' ? 'frontReading' : 'backReading'] : field === 'kind' ? ['@kind'] : field === 'deckName' ? ['@deckName'] : field.startsWith('field:') ? [field.slice(6)] : [field];
          for (const key of keys) if ((has(key) || key.startsWith('@')) && !show.includes(key)) show.push(key);
        }
        if (side === 'back' && normalized.back.showExamples && has('examples')) show.push('examples');
        return show.length ? show : [side];
      };
      return {
        ...type,
        front: { ...type.front, show: toShow(normalized.front.fields, 'front'), style: sideToSpec(normalized.front.style) },
        back: { ...type.back, show: toShow(normalized.back.fields, 'back'), showFront: normalized.back.showFront, style: sideToSpec(normalized.back.style) },
      };
    }),
  };
}

// ---------- card <-> fields ----------
const asString = (value: unknown) => typeof value === 'string' ? value : '';

/** Field values for any card; cards saved before the format existed derive them from their legacy columns. */
export function fieldsFromCard(card: ImportedCard): CardFieldValues {
  if (card.fields) return card.fields;
  const markup = (side: 'front' | 'back') => {
    const segments = parseStoredFurigana(card.extraData?.[side === 'front' ? 'frontFuriganaSegments' : 'backFuriganaSegments']);
    return segments.length && segments.some(segment => segment.reading) ? serializeFurigana(segments) : card[side];
  };
  let examples: CardExample[] = [];
  try { examples = parseCardExamples(card.extraData?.examples); } catch { /* malformed legacy examples stay in extraData only */ }
  const fields: CardFieldValues = { front: markup('front'), back: markup('back') };
  for (const [key, value] of [['frontReading', card.reading], ['backReading', card.backReading], ['hanViet', card.hanViet], ['notes', card.notes]] as const) if (value) fields[key] = value;
  if (examples.length) fields.examples = examples;
  return fields;
}

export interface FieldWarning { field: string; label: string; reason: string }

/** Builds the card shape the renderers and the legacy API columns use from `fields`. */
export function cardFromFields(type: NoteType, fields: CardFieldValues, base: Partial<ImportedCard> & { id: string }): { card: ImportedCard; warnings: FieldWarning[] } {
  const warnings: FieldWarning[] = [];
  const rawReading = normalizeReadingInput(asString(fields.frontReading)), rawBackReading = normalizeReadingInput(asString(fields.backReading));
  const frontRuby = resolveFurigana(asString(fields.front), rawReading), backRuby = resolveFurigana(asString(fields.back), rawBackReading);
  if (frontRuby.warning) warnings.push({ field: 'front', label: type.fields.find(field => field.key === 'front')?.label ?? 'front', reason: frontRuby.warning });
  if (backRuby.warning) warnings.push({ field: 'back', label: type.fields.find(field => field.key === 'back')?.label ?? 'back', reason: backRuby.warning });
  for (const field of type.fields) {
    const value = fields[field.key];
    if (field.type !== 'ruby' || typeof value !== 'string' || field.key === 'front' || field.key === 'back') continue;
    const ruby = resolveFurigana(value, '');
    if (ruby.warning) warnings.push({ field: field.key, label: field.label, reason: ruby.warning });
  }
  const extraData: Record<string, string> = { ...base.extraData };
  for (const key of ['backReading', 'frontFuriganaSegments', 'backFuriganaSegments', 'examples', 'importFieldLayout', 'importFieldValues']) delete extraData[key];
  const backReading = rawBackReading || (backRuby.explicit && !backRuby.warning ? segmentsReading(backRuby.segments) : '');
  if (backReading) extraData.backReading = backReading;
  if (frontRuby.segments.some(segment => segment.reading)) extraData.frontFuriganaSegments = JSON.stringify(frontRuby.segments);
  if (backRuby.segments.some(segment => segment.reading)) extraData.backFuriganaSegments = JSON.stringify(backRuby.segments);
  if (Array.isArray(fields.examples) && fields.examples.length) extraData.examples = JSON.stringify(fields.examples);
  const card: ImportedCard = {
    ...base,
    id: base.id,
    front: frontRuby.text, back: backRuby.text,
    reading: rawReading || (frontRuby.explicit && !frontRuby.warning ? segmentsReading(frontRuby.segments) : ''),
    backReading,
    hanViet: asString(fields.hanViet), notes: asString(fields.notes),
    kind: kindOfNoteType(type), noteType: type.id, fields,
    ...(Object.keys(extraData).length ? { extraData } : {}),
  };
  return { card, warnings };
}

/** Custom field values for the renderer, keyed by `field:<key>`. */
export function customFieldValue(card: Pick<ImportedCard, 'fields'>, key: string): FieldValue | undefined {
  return card.fields?.[key];
}
