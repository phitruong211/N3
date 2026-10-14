import test from 'node:test';
import assert from 'node:assert/strict';
import { safeCardStyle, hasCardMarkup } from '../src/lib/cardFormatting.ts';
import { resolveFurigana } from '../src/lib/furigana.ts';

test('recognizes explicit formatting without treating comparisons as HTML', () => {
  assert.equal(hasCardMarkup('a < b và c > d'), false);
  assert.equal(hasCardMarkup('<span style="color:red">đỏ</span>'), true);
});
test('allows bounded typography and spacing, rejects CSS with external effects', () => {
  for (const [property, value] of [['color', '#60a5fa'], ['font-weight', '300'], ['font-size', '24px'], ['padding-left', '2em'], ['text-align', 'left']]) assert.equal(safeCardStyle(property, value), value);
  for (const [property, value] of [['position', 'fixed'], ['color', 'var(--secret)'], ['background-color', 'url(https://example.com)'], ['font-size', '999px'], ['margin-left', '-10px'], ['padding-left', '999em'], ['color', 'red;display:none'], ['font-family', 'external']]) assert.equal(safeCardStyle(property, value), undefined);
});
test('import normalization preserves HTML, brackets, and inline styles for the renderer', () => {
  const source = '<p style="color:#60a5fa">学校[がっこう]</p>';
  assert.equal(resolveFurigana(source, 'がっこう').text, source);
  assert.equal(resolveFurigana(source, 'がっこう').warning, undefined);
});
