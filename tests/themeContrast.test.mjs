import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
const block = selector => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block exists`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/(--color-[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(match => [match[1], match[2]]));
};
const root = { ...block(':root'), ...block(':root, .light') };
const themes = { light: root, dark: { ...root, ...block('.dark') }, reading: { ...root, ...block('.reading') }, 'high-contrast': { ...root, ...block('.high-contrast') } };

const luminance = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };

const PAIRS = [
  ['--color-text', '--color-bg'], ['--color-text', '--color-surface'],
  ['--color-text-secondary', '--color-bg'], ['--color-text-secondary', '--color-surface'],
  ['--color-text-tertiary', '--color-bg'], ['--color-text-tertiary', '--color-surface'], ['--color-text-tertiary', '--color-surface-alt'],
  ['--color-text-secondary', '--color-surface-alt'],
  ['--color-accent-text', '--color-surface'], ['--color-accent-text', '--color-bg'],
  ['--color-text-inverse', '--color-accent'],
  ['--color-seal-ink', '--color-seal'],
];

for (const [name, tokens] of Object.entries(themes)) {
  test(`${name} theme: every text and seal pair meets WCAG AA (4.5:1)`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(tokens[fg] && tokens[bg], `${name} defines ${fg} and ${bg}`);
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= 4.5, `${name}: ${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} is ${ratio.toFixed(2)}:1`);
    }
  });
}
