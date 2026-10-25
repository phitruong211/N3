// WCAG contrast for card colors. Only explicit colors are judged; "paper" and "system" follow the app theme, so a lone
// override on them has nothing fixed to compare against.
import type { StyleSpec } from './deckFormat.ts';

const FIXED_THEMES: Record<string, { bg: string; fg: string }> = { blue: { bg: '#eff6ff', fg: '#0f172a' }, dark: { bg: '#0f172a', fg: '#ffffff' } };

function channels(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '');
  const full = h.length <= 4 ? [...h].map(c => c + c).join('') : h;
  if (!/^[\da-f]{6}([\da-f]{2})?$/i.test(full)) return null;
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}
const luminance = ([r, g, b]: [number, number, number]) => {
  const [lr, lg, lb] = [r, g, b].map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

export function contrastRatio(a: string, b: string): number | null {
  const ca = channels(a), cb = channels(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_CONTRAST = 4.5;

/** The text/background pair a style would produce and its ratio, or null when it does not set a comparable pair. */
export function styleContrast(style: StyleSpec | undefined): { ratio: number; ok: boolean } | null {
  const theme = style?.theme ? FIXED_THEMES[style.theme] : undefined;
  const fg = style?.colors?.fg ?? (style?.colors?.bg ? theme?.fg : undefined);
  const bg = style?.colors?.bg ?? (style?.colors?.fg ? theme?.bg : undefined);
  if (!fg || !bg) return null;
  const ratio = contrastRatio(fg, bg);
  return ratio === null ? null : { ratio, ok: ratio >= MIN_CONTRAST };
}
