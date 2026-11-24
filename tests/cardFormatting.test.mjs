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

test('size buttons wrap a selection or the caret line, replace instead of nesting, and unwrap', async () => {
  const { resizeTextRange } = await import('../src/lib/cardFormatting.ts');
  const text = '日本語\n学校[がっこう]に行く';
  const big = resizeTextRange(text, 0, 2, 1.5);
  assert.equal(big.text, '<span style="font-size:1.5em">日本</span>語\n学校[がっこう]に行く');
  assert.equal(big.text.slice(big.start, big.end), '<span style="font-size:1.5em">日本</span>');
  // Selecting just the inner text again replaces the size rather than stacking 1.5em × 2em.
  const inner = big.text.indexOf('日本');
  assert.equal(resizeTextRange(big.text, inner, inner + 2, 2).text, '<span style="font-size:2em">日本</span>語\n学校[がっこう]に行く');
  // A caret with no selection resizes its whole line, and only that line.
  const caret = text.indexOf('行');
  assert.equal(resizeTextRange(text, caret, caret, 0.75).text, '日本語\n<span style="font-size:0.75em">学校[がっこう]に行く</span>');
  assert.equal(resizeTextRange(text, 0, 0, 2).text, '<span style="font-size:2em">日本語</span>\n学校[がっこう]に行く');
  // Normal size unwraps every size span in the range, nested ones included.
  const nested = '<span style="font-size:2em">a <span style="font-size:0.75em">b</span> c</span>';
  assert.equal(resizeTextRange(nested, 0, nested.length, null).text, 'a b c');
  // Blank lines and plain text asked for normal size are left alone.
  assert.equal(resizeTextRange('a\n\nb', 2, 2, 2).text, 'a\n\nb');
  assert.equal(resizeTextRange('abc', 0, 3, null).text, 'abc');
  // What the buttons write passes the renderer's own style filter.
  for (const em of ['0.75', '1.5', '2']) assert.equal(safeCardStyle('font-size', `${em}em`), `${em}em`);
});

test('furigana of the whole text is handed out piece by piece as formatting splits it', async () => {
  const { segmentCursor } = await import('../src/lib/furigana.ts');
  const take = segmentCursor([{ text: '猫', reading: 'ねこ' }, { text: 'が' }, { text: '好', reading: 'す' }, { text: 'き' }]);
  // "<span style=…>猫</span>が好き" renders as two text nodes: 猫 | が好き.
  assert.deepEqual(take('猫'), [{ text: '猫', reading: 'ねこ' }]);
  assert.deepEqual(take('が好き'), [{ text: 'が' }, { text: '好', reading: 'す' }, { text: 'き' }]);
  // A tag cutting through one reading keeps the reading on the first piece only.
  const split = segmentCursor([{ text: '日本', reading: 'にほん' }, { text: '語' }]);
  assert.deepEqual([split('日'), split('本語')], [[{ text: '日', reading: 'にほん' }], [{ text: '本' }, { text: '語' }]]);
});
