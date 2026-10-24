import type { CSSProperties } from 'react';

/** A hanko-style seal carrying one Han character with a real meaning (今 today, 語 words, 札 decks…). Replaces generic icons for navigation and content kinds. */
export function Seal({ glyph, size = 'md', tone, tilt = 0, className = '' }: { glyph: string; size?: 'xs' | 'sm' | 'md'; tone?: string; tilt?: number; className?: string }) {
  const style = { ...(tone ? { '--tone': tone } : {}), '--tilt': tilt } as CSSProperties;
  return <span className={`level-seal seal-${size} ${className}`} style={style} lang="ja" aria-hidden="true">{glyph}</span>;
}
