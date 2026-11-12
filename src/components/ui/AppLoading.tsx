import { BRAND_LINES, BRAND_PAGE_LEFT, BRAND_PAGE_RIGHT, BRAND_RIBBON, BRAND_RING } from '@/lib/brand';

type AppLoadingProps = {
  message?: string;
  fullScreen?: boolean;
};

/** Ink motes lifting off the open pages: start point, drift, and size, in mark units. */
const MOTES: [x: number, dx: number, dy: number, r: number][] = [[20, -3, -13, .7], [26, 2, -17, .5], [38, -2, -16, .6], [44, 3, -12, .7], [16, -4, -9, .45], [48, 4, -10, .5]];

/**
 * The SỔ NHẬT mark drawing itself, then letting go: the notebook opens, the red sun rises out of it, a dry-brush ensō
 * sweeps around them, the ribbon drops like a stamp and ink motes lift off the pages; then the brush lifts the ring
 * away, the sun sinks back into the book and it begins again. Geometry comes from lib/brand, so it is the real mark.
 * Pure SVG + CSS (loading.css), so index.html paints the same mark before any script runs: keep the two in step.
 */
export function InkLoader() {
  return <svg className="nhat-mark" viewBox="0 0 64 64" width="132" height="132" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      {/* Dry brush: streaks of paper show through the stroke where the bristles run out of ink. */}
      <filter id="nhat-mark-dry" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="2.4 .16" numOctaves="1" seed="11" result="grain"/>
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.62" result="bristles"/>
        <feComposite in="SourceGraphic" in2="bristles" operator="in"/>
      </filter>
      <filter id="nhat-mark-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle className="nhat-mark-glow" cx="32" cy="31" r="13" fill="currentColor" stroke="none" filter="url(#nhat-mark-glow)"/>
    <circle className="nhat-mark-sun" cx="32" cy="31" r="9" fill="currentColor" stroke="none"/>
    <g className="nhat-mark-book" strokeWidth="2.6">
      <path d={BRAND_PAGE_LEFT}/>
      <path d={BRAND_PAGE_RIGHT}/>
    </g>
    <path className="nhat-mark-lines" d={BRAND_LINES} pathLength="1" strokeWidth="1.6"/>
    <path className="nhat-mark-ribbon" d={BRAND_RIBBON} fill="currentColor" stroke="none"/>
    <g className="nhat-mark-ring" filter="url(#nhat-mark-dry)">
      <path d={BRAND_RING} pathLength="1" strokeWidth="3.6"/>
    </g>
    <g className="nhat-mark-motes">
      {MOTES.map(([x, dx, dy, r], i) => <circle key={i} cx={x} cy="36" r={r} fill="currentColor" stroke="none"
        style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--i': i } as React.CSSProperties}/>)}
    </g>
  </svg>;
}

export function AppLoading({ message = 'Đang mở trang…', fullScreen = false }: AppLoadingProps) {
  return <div className={`nhat-loading ${fullScreen ? 'nhat-loading-screen' : 'nhat-loading-inline'}`} role="status" aria-live="polite" aria-atomic="true">
    <div className="nhat-loading-art" aria-hidden="true">
      <InkLoader/>
    </div>
    {fullScreen && <p className="nhat-loading-brand">SỔ NHẬT<span>MỖI NGÀY, MỘT TRANG MỚI</span></p>}
    <p className="nhat-loading-message">{message}</p>
  </div>;
}
