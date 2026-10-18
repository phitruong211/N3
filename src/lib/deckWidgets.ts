export const DECK_WIDGETS_KEY = 'deck-group-widgets-v1';
export type WidgetSize = 'small' | 'medium' | 'large' | 'xlarge';
export const WIDGET_SIZES: WidgetSize[] = ['small', 'medium', 'large', 'xlarge'];
export interface DeckWidgetStyle { size: WidgetSize; color: string; opacity: number; blur: number }
/** "Trong" is the neutral tone: no hue of its own, so only the quiet glow behind the glass shows through. */
export const CLEAR_TINT = '#e9edf2';
export const DEFAULT_WIDGET_STYLE: DeckWidgetStyle = { size: 'small', color: CLEAR_TINT, opacity: 14, blur: 24 };
export const WIDGET_COLORS = [
  { value: CLEAR_TINT, label: 'Trong' },
  { value: '#0a84ff', label: 'Xanh trời' },
  { value: '#00c7be', label: 'Bạc hà' },
  { value: '#34c759', label: 'Xanh lá' },
  { value: '#ffcc00', label: 'Vàng' },
  { value: '#ff9f0a', label: 'Cam' },
  { value: '#ff375f', label: 'Hồng' },
  { value: '#af52de', label: 'Tím' },
];
export const MAX_WIDGET_OPACITY = 70;
export const MIN_WIDGET_BLUR = 8;
export const MAX_WIDGET_BLUR = 40;

export function normalizeWidgetStyle(value: unknown): DeckWidgetStyle {
  const raw = value && typeof value === 'object' ? value as Partial<DeckWidgetStyle> : {};
  const color = typeof raw.color === 'string' ? raw.color.toLowerCase() : '';
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  return {
    size: WIDGET_SIZES.includes(raw.size as WidgetSize) ? raw.size! : DEFAULT_WIDGET_STYLE.size,
    color: /^#[0-9a-f]{6}$/.test(color) ? color : DEFAULT_WIDGET_STYLE.color,
    opacity: finite(raw.opacity) ? Math.max(0, Math.min(MAX_WIDGET_OPACITY, raw.opacity)) : DEFAULT_WIDGET_STYLE.opacity,
    blur: finite(raw.blur) ? Math.max(0, Math.min(MAX_WIDGET_BLUR, raw.blur)) : DEFAULT_WIDGET_STYLE.blur,
  };
}

export function readWidgetStyles(value: unknown): Record<string, DeckWidgetStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, style]) => [id, normalizeWidgetStyle(style)]));
}

/** Grid footprint in cells. Extra-large is 4×2, or 2×3 on the two-column phone grid. */
export function widgetSpan(size: WidgetSize, columns: number): { cols: number; rows: number } {
  const wide = Math.max(1, Math.floor(columns));
  switch (size) {
    case 'small': return { cols: 1, rows: 1 };
    case 'medium': return { cols: Math.min(2, wide), rows: 1 };
    case 'large': return { cols: Math.min(2, wide), rows: 2 };
    default: return wide >= 4 ? { cols: 4, rows: 2 } : { cols: Math.min(2, wide), rows: 3 };
  }
}

/** Nearest preset to a fractional cell footprint; ties go to the smaller preset. */
export function snapWidgetSize(cols: number, rows: number, columns: number): WidgetSize {
  let best: WidgetSize = 'small', bestDistance = Infinity;
  for (const size of WIDGET_SIZES) {
    const span = widgetSpan(size, columns);
    const distance = Math.hypot(span.cols - cols, span.rows - rows);
    if (distance < bestDistance - 1e-9) { best = size; bestDistance = distance; }
  }
  return best;
}

/** Convert a legacy pixel size to the preset that fills the closest block of cells. */
export function sizeFromPixels(width: number, height: number, cell: number, gap: number, columns: number): WidgetSize {
  if (!(cell > 0) || !Number.isFinite(width) || !Number.isFinite(height)) return DEFAULT_WIDGET_STYLE.size;
  return snapWidgetSize((width + gap) / (cell + gap), (height + gap) / (cell + gap), columns);
}

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as Rgb;
const mix = (front: Rgb, back: Rgb, alpha: number): Rgb => front.map((channel, index) => channel * alpha + back[index] * (1 - alpha)) as Rgb;
function luminance(color: Rgb) {
  const linear = color.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a: Rgb, b: Rgb) { const first = luminance(a), second = luminance(b); return (Math.max(first, second) + .05) / (Math.min(first, second) + .05); }

/** Mirrors --glass-fill in index.css; keep the two in step. */
export const GLASS_FILL = { light: { color: '#ffffff', alpha: .34 }, dark: { color: '#181c24', alpha: .34 } };
/** A group's tint is identity, not atmosphere: the saved strength is drawn at this fraction (--tint-strength in widgetGlass.css). */
export const TINT_STRENGTH = .55;
/** Quiet light behind the grid per theme (peak strength; mirrors .widget-ambient in widgetGlass.css). It never carries a group's colour. */
export const AMBIENT_GLOWS = {
  light: [{ color: '#ffffff', alpha: .55 }, { color: '#9db7d9', alpha: .10 }],
  dark: [{ color: '#9db7d9', alpha: .18 }, { color: '#d8b99a', alpha: .14 }],
};
const BASES = { light: ['#eef0ec', '#f5f0e3'], dark: ['#0d100f', '#151b1e'] };

/** Every colour the glass can plausibly sit on: page base, with and without each glow, under fill and tint. */
export function glassBackgrounds(style: DeckWidgetStyle, light: boolean): Rgb[] {
  const bases = (light ? BASES.light : BASES.dark).map(rgb);
  const behind = bases.flatMap(base => [base, ...AMBIENT_GLOWS[light ? 'light' : 'dark'].map(glow => mix(rgb(glow.color), base, glow.alpha))]);
  const fill = light ? GLASS_FILL.light : GLASS_FILL.dark;
  return behind.flatMap(surface => {
    const glass = mix(rgb(style.color), mix(rgb(fill.color), surface, fill.alpha), style.opacity / 100 * TINT_STRENGTH);
    return [glass, mix(rgb('#ffffff'), glass, .18), mix(rgb('#000000'), glass, .06)];
  });
}

/** Glass at the upper opacity bound can need dark ink even in a dark theme. */
export function widgetInk(style: DeckWidgetStyle, light: boolean) {
  const backgrounds = glassBackgrounds(style, light);
  const minimum = (hex: string) => Math.min(...backgrounds.map(background => contrast(rgb(hex), background)));
  const preferred = light ? '#171a18' : '#eef1ef', inverse = light ? '#eef1ef' : '#0d100f';
  let ink = minimum(preferred) >= minimum(inverse) ? preferred : inverse;
  if (minimum(ink) < 4.5) ink = minimum('#ffffff') >= minimum('#000000') ? '#ffffff' : '#000000';
  // At transitional luminance, a small opaque halo provides the text background
  // without adding a second panel or changing the requested glass tint/alpha.
  const halo = minimum(ink) < 4.5 ? (ink === '#ffffff' ? '#0d100f' : '#fbfcfb') : null;
  const muted = light ? '#5d6762' : '#a3aca7';
  return { ink, ink2: minimum(muted) >= 4.5 ? muted : ink, halo };
}

/** Move without mutating the source; dropping on either half of a widget chooses its side. */
export function moveWidget(ids: string[], id: string, target: string, after = false): string[] {
  if (id === target || !ids.includes(id) || !ids.includes(target)) return ids;
  const next = ids.filter(item => item !== id);
  next.splice(next.indexOf(target) + (after ? 1 : 0), 0, id);
  return next;
}
