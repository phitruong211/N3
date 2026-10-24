// Sumi-e illustrations for empty states, heroes and loaders. Pure SVG: ink is currentColor, washes are tints of it,
// the sun and seals use --color-seal, paper uses --color-surface, so every piece follows the active theme.
// Strokes draw themselves in (class "draw", pathLength=1); reduced-motion settles them instantly.
import type { ReactNode } from 'react';

export type InkProps = { size?: number; className?: string };

function Frame({ name, size = 160, className = '', children }: InkProps & { name: string; children: ReactNode }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width={size} height={size * .75} className={`ink ${className}`} data-ink={name} aria-hidden="true" focusable="false">{children}</svg>;
}
const D = { pathLength: 1 } as const;

/** An open ensō, the brushed circle of a finished thought. */
export function Enso(props: InkProps) {
  return <Frame name="enso" {...props}>
    <path className="line draw" {...D} d="M96 24c-26-9-56 6-61 33-5 27 15 49 43 50 25 1 45-17 46-42" strokeWidth="9"/>
    <path className="line draw d2" {...D} d="M99 27c-24-8-52 7-57 32-4 24 13 44 38 46" strokeWidth="2" opacity=".55"/>
    <circle className="solid" cx="118" cy="43" r="2.4" opacity=".7"/>
  </Frame>;
}

/** A red sun lifting over a still horizon. */
export function Sunrise(props: InkProps) {
  return <Frame name="sunrise" {...props}>
    <clipPath id="ink-sun-clip"><rect x="0" y="0" width="160" height="78"/></clipPath>
    <circle className="sun" cx="80" cy="76" r="26" clipPath="url(#ink-sun-clip)"/>
    <path className="line draw" {...D} d="M18 78h124" strokeWidth="3"/>
    <path className="line draw d2" {...D} d="M40 90h80M58 100h44" strokeWidth="1.6" opacity=".5"/>
    <path className="line draw d3" {...D} d="M30 40q4-5 8 0 4-5 8 0M116 30q3-4 6 0 3-4 6 0" strokeWidth="1.5"/>
  </Frame>;
}

/** Layered mountains in mist, the far range only a wash. */
export function Mountains(props: InkProps) {
  return <Frame name="mountains" {...props}>
    <path className="wash" d="M10 100 40 48l18 22 22-36 34 48 18-24 18 42z"/>
    <path className="line draw" {...D} d="M10 100 46 52l20 24 24-38 36 52 18-24 8 12" strokeWidth="2.6"/>
    <path className="line draw d2" {...D} d="M18 108h124M44 114h72" strokeWidth="1.6" opacity=".5"/>
    <circle className="sun" cx="122" cy="28" r="9"/>
  </Frame>;
}

/** Three culms of bamboo, nodes and leaves. */
export function Bamboo(props: InkProps) {
  return <Frame name="bamboo" {...props}>
    <path className="line draw" {...D} d="M52 112V12M80 112V4M108 112V20" strokeWidth="5"/>
    <path className="line" d="M46 40h12M46 74h12M74 34h12M74 70h12M102 46h12M102 84h12" strokeWidth="2.2"/>
    <path className="solid leaf" d="M58 38q14-2 24-14-4 14-24 14zM86 68q14-1 24-12-4 13-24 12zM46 72q-14-1-24-11 5 12 24 11zM108 50q12-3 20-14-2 13-20 14z"/>
  </Frame>;
}

/** An open notebook with a ribbon and a small seal. */
export function Notebook(props: InkProps) {
  return <Frame name="notebook" {...props}>
    <path className="paper" d="M80 30c-14-8-34-9-56-4v62c22-5 42-4 56 4 14-8 34-9 56-4V26c-22-5-42-4-56 4z"/>
    <path className="line draw" {...D} d="M80 30c-14-8-34-9-56-4v62c22-5 42-4 56 4 14-8 34-9 56-4V26c-22-5-42-4-56 4zM80 30v62" strokeWidth="2.4"/>
    <path className="line draw d2" {...D} d="M34 46q18-3 36 2M34 58q18-3 36 2M34 70q18-3 36 2M92 48q18-5 34-2M92 60q18-5 34-2" strokeWidth="1.6" opacity=".6"/>
    <path className="sun" d="M108 26h10v22l-5-4-5 4z"/>
    <rect className="sun" x="94" y="68" width="14" height="14" rx="2" transform="rotate(-6 101 75)"/>
  </Frame>;
}

/** An inkstone with a brush laid across it. */
export function Inkstone(props: InkProps) {
  return <Frame name="inkstone" {...props}>
    <path className="wash" d="M34 70h92l-8 24H42z"/>
    <path className="line draw" {...D} d="M34 70h92l-8 24H42zM46 70c0-12 14-18 34-18s34 6 34 18" strokeWidth="2.6"/>
    <ellipse className="solid" cx="80" cy="76" rx="24" ry="5" opacity=".85"/>
    <path className="line draw d2" {...D} d="M26 44 98 80" strokeWidth="5"/>
    <path className="solid" d="M98 80l16 7-14 1z"/>
    <circle className="sun" cx="126" cy="46" r="4" opacity=".9"/>
  </Frame>;
}

/** A crane at rest, one leg drawn up. */
export function Crane(props: InkProps) {
  return <Frame name="crane" {...props}>
    <path className="line draw" {...D} d="M64 72c-8-10 0-18-4-28-3-8 0-14 4-18" strokeWidth="3.4"/>
    <path className="paper" d="M58 74c12-12 46-14 68-2-12 3-22 12-30 22-14 1-30-6-38-20z"/>
    <path className="line draw d2" {...D} d="M58 74c12-12 46-14 68-2-12 3-22 12-30 22-14 1-30-6-38-20zM100 72c10-6 22-8 32-6" strokeWidth="2.4"/>
    <path className="line draw d3" {...D} d="M88 94l-2 18m0 0-7 2M98 92c6 6 6 10-2 14" strokeWidth="2.4"/>
    <path className="line" d="M64 26l-12 3M126 70l16-4M124 74l14 4" strokeWidth="2.4"/>
    <circle className="sun" cx="64" cy="22" r="3.2"/>
  </Frame>;
}

/** Seigaiha, waves drawn as overlapping arcs. */
export function Wave(props: InkProps) {
  const rows = [0, 1, 2].flatMap(row => [0, 1, 2, 3, 4].map(col => ({ row, col })));
  return <Frame name="wave" {...props}>
    {rows.map(({ row, col }) => {
      const cx = 16 + col * 32 + (row % 2 ? 16 : 0), cy = 50 + row * 18;
      return <g key={`${row}-${col}`} className="line" strokeWidth="1.8"><path d={`M${cx - 16} ${cy}a16 16 0 0 1 32 0`}/><path d={`M${cx - 10} ${cy}a10 10 0 0 1 20 0`} opacity=".6"/><path d={`M${cx - 4} ${cy}a4 4 0 0 1 8 0`} opacity=".4"/></g>;
    })}
    <circle className="sun" cx="132" cy="24" r="8"/>
  </Frame>;
}

export const INK = { enso: Enso, sunrise: Sunrise, mountains: Mountains, bamboo: Bamboo, notebook: Notebook, inkstone: Inkstone, crane: Crane, wave: Wave };
export type InkName = keyof typeof INK;
