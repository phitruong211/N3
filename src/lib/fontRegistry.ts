// Fonts a deck can choose (docs/deck-format-v1.md §5.1). Pure data so tests and the server contract can read it;
// the stylesheets that actually load a font live in fontLoader.ts.
export type FontGroup = 'jp-sans' | 'jp-serif' | 'jp-display' | 'latin' | 'system';
export interface FontInfo { id: string; label: string; group: FontGroup; stack: string; note: string }

const JP_FALLBACK = "'SN Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";
const JP_SERIF_FALLBACK = "'SN Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif";

export const FONTS: readonly FontInfo[] = [
  { id: 'default', label: 'Mặc định (Be Vietnam Pro)', group: 'latin', stack: `'Be Vietnam Pro', ${JP_SERIF_FALLBACK}`, note: 'Chữ Việt rõ, chữ Nhật theo bộ font của ứng dụng' },
  { id: 'notoSansJp', label: 'Noto Sans JP', group: 'jp-sans', stack: "'SN Sans JP', 'Noto Sans JP Local', sans-serif", note: 'Gothic trung tính, dễ đọc' },
  { id: 'notoSerifJp', label: 'Noto Serif JP', group: 'jp-serif', stack: "'SN Serif JP', 'Noto Serif JP Local', serif", note: 'Mincho cổ điển' },
  { id: 'delaGothicOne', label: 'Dela Gothic One', group: 'jp-display', stack: "'Dela Gothic One Local', sans-serif", note: 'Đậm, dùng cho tiêu đề và từ đơn' },
  { id: 'zenMaruGothic', label: 'Zen Maru Gothic', group: 'jp-sans', stack: `'Zen Maru Gothic', 'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Gothic bo tròn, thân thiện' },
  { id: 'mPlusRounded', label: 'M PLUS Rounded 1c', group: 'jp-sans', stack: `'M PLUS Rounded 1c', 'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Bo tròn, nét đều' },
  { id: 'zenKakuGothic', label: 'Zen Kaku Gothic New', group: 'jp-sans', stack: `'Zen Kaku Gothic New', 'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Gothic hiện đại, gọn' },
  { id: 'bizUdpGothic', label: 'BIZ UDP Gothic', group: 'jp-sans', stack: `'BIZ UDPGothic', 'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Thiết kế phổ quát, dễ phân biệt chữ' },
  { id: 'shipporiMincho', label: 'Shippori Mincho', group: 'jp-serif', stack: `'Shippori Mincho', 'Newsreader', ${JP_SERIF_FALLBACK}`, note: 'Mincho thanh, hợp văn bản dài' },
  { id: 'kleeOne', label: 'Klee One', group: 'jp-display', stack: `'Klee One', 'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Nét bút như sách giáo khoa viết tay' },
  { id: 'beVietnamPro', label: 'Be Vietnam Pro', group: 'latin', stack: `'Be Vietnam Pro', ${JP_FALLBACK}`, note: 'Sans hiện đại, đủ dấu tiếng Việt' },
  { id: 'newsreader', label: 'Newsreader', group: 'latin', stack: `'Newsreader', ${JP_SERIF_FALLBACK}`, note: 'Serif cho đoạn giải thích dài' },
  { id: 'lexend', label: 'Lexend', group: 'latin', stack: `'Lexend', ${JP_FALLBACK}`, note: 'Thiết kế cho dễ đọc, đủ dấu tiếng Việt' },
  { id: 'playfairDisplay', label: 'Playfair Display', group: 'latin', stack: `'Playfair Display', ${JP_SERIF_FALLBACK}`, note: 'Serif tương phản cao cho tiêu đề' },
  { id: 'system', label: 'Font hệ thống', group: 'system', stack: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", note: 'Dùng font có sẵn trên thiết bị' },
];

export const FONT_GROUP_LABELS: Record<FontGroup, string> = {
  'jp-sans': 'Tiếng Nhật · Gothic', 'jp-serif': 'Tiếng Nhật · Mincho', 'jp-display': 'Tiếng Nhật · Nổi bật',
  latin: 'Tiếng Việt và chữ Latin', system: 'Hệ thống',
};
export const FONT_IDS: readonly string[] = FONTS.map(font => font.id);
/** An uploaded font's id: `custom:<uuid>`. Only its owner can load the bytes; everyone else falls through the stack. */
export const CUSTOM_FONT_ID = /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isCustomFontId = (value: unknown): value is string => typeof value === 'string' && CUSTOM_FONT_ID.test(value);
export const isFontId = (value: unknown): value is string => isCustomFontId(value) || (typeof value === 'string' && FONT_IDS.includes(value));
/** The CSS family name an uploaded font is registered under. */
export const customFamilyName = (id: string) => `sonhat-${id.slice('custom:'.length)}`;
export const fontStack = (id: string | undefined): string => isCustomFontId(id)
  ? `'${customFamilyName(id)}', 'Be Vietnam Pro', ${JP_FALLBACK}`
  : (FONTS.find(font => font.id === id) ?? FONTS[0]).stack;
