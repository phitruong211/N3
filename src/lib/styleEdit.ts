// Edits of a partial StyleSpec for the style editor. `null` clears a key; the result never holds empty objects.
import type { CardTheme, StyleSpec } from './deckFormat.ts';

export interface StylePatch {
  theme?: CardTheme | null;
  align?: 'left' | 'center' | null;
  autoFit?: boolean | null;
  colors?: Partial<Record<'bg' | 'fg' | 'accent', string | null>>;
  font?: { family?: string | null; size?: number | null; bold?: boolean | null; italic?: boolean | null };
}

function pruned<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null);
  return entries.length ? Object.fromEntries(entries) as T : undefined;
}

export function updateStyle(style: StyleSpec | undefined, patch: StylePatch): StyleSpec | undefined {
  const next: Record<string, unknown> = { ...style };
  for (const key of ['theme', 'align', 'autoFit'] as const) if (key in patch) next[key] = patch[key] ?? undefined;
  if (patch.colors) next.colors = pruned({ ...style?.colors, ...patch.colors });
  if (patch.font) {
    const font = { ...style?.font, ...patch.font };
    if (font.size != null) font.size = Math.max(12, Math.min(72, Math.round(font.size)));
    next.font = pruned(font);
  }
  return pruned(next) as StyleSpec | undefined;
}

/** The style a layer ends up with once it sits on top of what it inherits. */
export function layered(inherited: StyleSpec | undefined, own: StyleSpec | undefined): StyleSpec {
  return { ...inherited, ...own, colors: { ...inherited?.colors, ...own?.colors }, font: { ...inherited?.font, ...own?.font } };
}
