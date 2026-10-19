/** Geometry of the SỔ NHẬT mark: an open notebook with a red sun rising from its spine, inside a brushed ensō. One source for the React mark and the generated files. */
export type BrandVariant = 'full' | 'small';

export const BRAND_COLORS = { ink: '#233C35', sun: '#B3433A', paper: '#FAF4E7' } as const;
export const BRAND_DARK_COLORS = { ink: '#EDE6D4', sun: '#E27D6F', paper: '#262B27' } as const;

export const BRAND_GEOMETRY = {
  full: { ring: 3.2, book: 2.6, sunY: 31, sunR: 9, detail: true },
  small: { ring: 4.6, book: 3.8, sunY: 30, sunR: 10.5, detail: false },
} as const;

/** Open ring: the gap sits at the upper right, like the end of a brush stroke. */
export const BRAND_RING = 'M55.4 18.5A27 27 0 1 1 46.3 9.1';
export const BRAND_PAGE_LEFT = 'M32 38C26 34.2 18 33.2 11 35V47.5C18 45.8 26 47 32 51.5Z';
export const BRAND_PAGE_RIGHT = 'M32 38C38 34.2 46 33.2 53 35V47.5C46 45.8 38 47 32 51.5Z';
export const BRAND_RIBBON = 'M30 51.5h4v5l-2-1.6-2 1.6z';
export const BRAND_LINES = 'M39 40h9M39 43.5h7';

/** Standalone SVG text with fixed colours; dark browsers get lighter ink through a media query. */
export function brandSvg(variant: BrandVariant, title = 'SỔ NHẬT'): string {
  const g = BRAND_GEOMETRY[variant];
  const c = BRAND_COLORS, d = BRAND_DARK_COLORS;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${title}">
  <title>${title}</title>
  <style>.i{stroke:${c.ink}}.p{fill:${c.paper}}.s{fill:${c.sun}}@media (prefers-color-scheme:dark){.i{stroke:${d.ink}}.p{fill:${d.paper}}.s{fill:${d.sun}}}</style>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path class="i" d="${BRAND_RING}" stroke-width="${g.ring}"/>
    <circle class="s" cx="32" cy="${g.sunY}" r="${g.sunR}"/>
    <path class="i p" d="${BRAND_PAGE_LEFT}" stroke-width="${g.book}"/>
    <path class="i p" d="${BRAND_PAGE_RIGHT}" stroke-width="${g.book}"/>${g.detail ? `
    <path class="i" d="${BRAND_LINES}" stroke-width="1.6" opacity=".55"/>
    <path class="s" d="${BRAND_RIBBON}" stroke="none"/>` : ''}
  </g>
</svg>
`;
}
