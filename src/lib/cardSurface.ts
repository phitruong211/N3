// CSS for the colors of a resolved card style. The background belongs to whatever element is the card; text and accent
// cascade into the face.
import type { CSSProperties } from 'react';
import type { CardSideStyle, StyleSpec } from './deckFormat';

type Vars = CSSProperties & Record<`--${string}`, string>;

// The study card colors meaning and Hán Việt by role; a chosen text color replaces those so nothing keeps a clashing hue.
const textVars = (fg: string): Vars => ({ color: fg, '--role-meaning': fg, '--role-hanviet': fg });
const accentVars = (accent: string): Vars => ({ '--card-reading': accent, '--role-reading': accent, '--color-accent': accent });

/** For the element that is the card: custom background, text and accent colors. */
export function surfaceStyle(style: CardSideStyle): CSSProperties {
  const colors = style.colors;
  const vars: Vars = {};
  if (colors?.bg) vars.background = colors.bg;
  if (colors?.fg) Object.assign(vars, textVars(colors.fg));
  if (colors?.accent) Object.assign(vars, accentVars(colors.accent));
  return vars;
}

/** For one field: only what the field itself overrides, so everything else keeps inheriting. */
export function fieldDecoration(spec: StyleSpec | undefined): CSSProperties | undefined {
  if (!spec) return undefined;
  const vars: Vars = {};
  if (spec.colors?.fg) Object.assign(vars, textVars(spec.colors.fg));
  if (spec.colors?.bg) { vars.backgroundColor = spec.colors.bg; vars.borderRadius = '.4em'; vars.padding = '.15em .5em'; }
  if (spec.colors?.accent) Object.assign(vars, accentVars(spec.colors.accent));
  return Object.keys(vars).length ? vars : undefined;
}

/** Every font id a face may need, so the loader can fetch them before the text is drawn. */
export function fontIdsOf(style: CardSideStyle, fieldStyles?: Record<string, StyleSpec>, cardStyle?: StyleSpec): string[] {
  return [...new Set([style.fontFamily, cardStyle?.font?.family, ...Object.values(fieldStyles ?? {}).map(spec => spec.font?.family)].filter((id): id is string => !!id))];
}
