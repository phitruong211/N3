import { BRAND_GEOMETRY, BRAND_LINES, BRAND_PAGE_LEFT, BRAND_PAGE_RIGHT, BRAND_RIBBON, BRAND_RING, type BrandVariant } from '@/lib/brand';

/** The SỔ NHẬT mark in theme colours: ink follows the text colour, the sun and paper follow the tokens. */
export function BrandMark({ size = 32, variant = 'full', className }: { size?: number; variant?: BrandVariant; className?: string }) {
  const g = BRAND_GEOMETRY[variant];
  const paper = { fill: 'var(--color-surface)' };
  return <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d={BRAND_RING} strokeWidth={g.ring}/>
    <circle cx="32" cy={g.sunY} r={g.sunR} stroke="none" style={{ fill: 'var(--color-error)' }}/>
    <path d={BRAND_PAGE_LEFT} strokeWidth={g.book} style={paper}/>
    <path d={BRAND_PAGE_RIGHT} strokeWidth={g.book} style={paper}/>
    {g.detail && <>
      <path d={BRAND_LINES} strokeWidth="1.6" opacity=".55"/>
      <path d={BRAND_RIBBON} stroke="none" style={{ fill: 'var(--color-error)' }}/>
    </>}
  </svg>;
}
