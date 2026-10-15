export const DECK_WIDGETS_KEY = 'deck-group-widgets-v1';
export type WidgetSize = 'small' | 'medium' | 'large';
export interface DeckWidgetStyle { size: WidgetSize; color: string; opacity: number; blur: number }
export const DEFAULT_WIDGET_STYLE: DeckWidgetStyle = { size: 'small', color: '#8b93a1', opacity: 30, blur: 24 };
export const WIDGET_COLORS = [
  { value: '#8b93a1', label: 'Sương' },
  { value: '#65a8ed', label: 'Xanh trời' },
  { value: '#59c5a2', label: 'Bạc hà' },
  { value: '#e8b768', label: 'Mơ vàng' },
  { value: '#e58fa6', label: 'Hồng đào' },
  { value: '#aa94e8', label: 'Lavender' },
];


export function normalizeWidgetStyle(value: unknown): DeckWidgetStyle {
  const raw = value && typeof value === 'object' ? value as Partial<DeckWidgetStyle> : {};
  const color = typeof raw.color === 'string' ? raw.color.toLowerCase() : '';
  return {
    size: ['small', 'medium', 'large'].includes(raw.size ?? '') ? raw.size! : 'small',
    color: /^#[0-9a-f]{6}$/.test(color) ? color : DEFAULT_WIDGET_STYLE.color,
    opacity: typeof raw.opacity === 'number' && Number.isFinite(raw.opacity) ? Math.max(5, Math.min(70, raw.opacity)) : 30,
    blur: typeof raw.blur === 'number' && Number.isFinite(raw.blur) ? Math.max(0, Math.min(40, raw.blur)) : 24,
  };
}

export function readWidgetStyles(value: unknown): Record<string, DeckWidgetStyle> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, style]) => [id, normalizeWidgetStyle(style)]));
}

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as Rgb;
const mix = (front: Rgb, back: Rgb, alpha: number): Rgb => front.map((channel, index) => channel * alpha + back[index] * (1 - alpha)) as Rgb;
function luminance(color: Rgb) {
  const linear = color.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a: Rgb, b: Rgb) { const first = luminance(a), second = luminance(b); return (Math.max(first, second) + .05) / (Math.min(first, second) + .05); }

/** Glass at the upper opacity bound can need dark ink even in a dark theme. */
export function widgetInk(style: DeckWidgetStyle, light: boolean) {
  const surfaces = (light ? ['#eceeeb', '#c7e1d5', '#dbd6ec'] : ['#0d100f', '#151b1e', '#1f3930', '#2f2a42', '#14432c', '#322046']).map(rgb);
  const backgrounds = surfaces.flatMap(surface => { const glass = mix(rgb(style.color), surface, style.opacity / 100); return [glass, mix(rgb('#ffffff'), glass, .18), mix(rgb('#000000'), glass, .06)]; });
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
