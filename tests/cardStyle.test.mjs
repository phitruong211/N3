import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FONTS, FONT_IDS, fontStack, isFontId } from '../src/lib/fontRegistry.ts';
import { contrastRatio, styleContrast } from '../src/lib/styleContrast.ts';
import { builtinNoteTypes, mergeSideStyle, normalizeConfig, normalizeDeckTemplate, resolveTemplate, sanitizeStyle, validateDeckFile, applyResolvedTemplate } from '../src/lib/deckFormat.ts';

test('the font registry offers 10-15 distinct, valid fonts including the three that already existed', () => {
  assert.ok(FONTS.length >= 10 && FONTS.length <= 15, String(FONTS.length));
  assert.equal(new Set(FONT_IDS).size, FONT_IDS.length);
  for (const id of ['default', 'notoSansJp', 'notoSerifJp', 'delaGothicOne', 'system']) assert.ok(isFontId(id), id);
  for (const font of FONTS) { assert.match(font.id, /^[A-Za-z][A-Za-z0-9]{0,31}$/); assert.ok(font.stack.length && font.label && font.note); }
  assert.equal(fontStack('nope'), FONTS[0].stack);
  assert.equal(isFontId('custom:123e4567-e89b-12d3-a456-426614174000'), true);
  assert.equal(isFontId('custom:not-a-uuid'), false);
  assert.match(fontStack('custom:123e4567-e89b-12d3-a456-426614174000'), /^'sonhat-123e4567-e89b-12d3-a456-426614174000', 'Be Vietnam Pro'/);
});

test('every Japanese or Vietnamese font falls back to something that can draw the other script', () => {
  for (const font of FONTS.filter(item => item.group !== 'system')) {
    assert.match(font.stack, /SN (Sans|Serif) JP|Local/, `${font.id} needs a Japanese fallback`);
    if (font.group.startsWith('jp-') && font.id !== 'delaGothicOne' && !font.id.startsWith('noto')) assert.match(font.stack, /Be Vietnam Pro|Newsreader/, `${font.id} needs a Vietnamese fallback`);
  }
});

test('contrast follows WCAG and only explicit pairs are judged', () => {
  assert.equal(Math.round(contrastRatio('#000', '#fff')), 21);
  assert.equal(contrastRatio('#777', '#777'), 1);
  assert.equal(contrastRatio('red', '#fff'), null);
  assert.deepEqual(styleContrast({ colors: { fg: '#111', bg: '#fff' } }).ok, true);
  assert.equal(styleContrast({ colors: { fg: '#aaa', bg: '#bbb' } }).ok, false);
  assert.equal(styleContrast({ colors: { fg: '#fff' } }), null);
  assert.equal(styleContrast({ theme: 'dark', colors: { fg: '#222' } }).ok, false);
  assert.equal(styleContrast({ theme: 'dark', colors: { bg: '#000' } }).ok, true);
  assert.equal(styleContrast({ theme: 'paper', colors: { fg: '#222' } }), null);
});

test('low contrast is a warning on every tier and never rejects the file', () => {
  const type = builtinNoteTypes()[0];
  type.style = { colors: { fg: '#ccc', bg: '#ddd' } };
  type.fields[0].style = { colors: { fg: '#ccc', bg: '#ddd' } };
  const result = validateDeckFile({ format: 'sonhat.deck', version: 1, deck: { name: 'x', style: { colors: { fg: '#ccc', bg: '#ddd' } }, noteTypes: [type] }, cards: [{ type: 'vocab', fields: { front: 'a', back: 'b' }, style: { colors: { fg: '#ccc', bg: '#ddd' } } }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues.filter(issue => issue.code === 'low_contrast').map(issue => issue.path).sort(),
    ['cards[0].style', 'deck.noteTypes[0].fields[0].style', 'deck.noteTypes[0].style', 'deck.style']);
  assert.equal(result.file.cards[0].style.colors.bg, '#ddd');
});

test('colors, fonts and the field tier travel from the note type into the resolved template', () => {
  const [vocab] = builtinNoteTypes();
  vocab.style = { colors: { bg: '#fffaf0' }, font: { family: 'kleeOne' } };
  vocab.back = { ...vocab.back, style: { colors: { fg: '#334155' } } };
  vocab.fields[0].style = { colors: { accent: '#b45309' }, font: { family: 'shipporiMincho', size: 40 } };
  const config = { version: 5, style: { colors: { accent: '#0f766e' } }, noteTypes: [vocab] };
  const template = resolveTemplate(config, 'vocab');
  assert.equal(template.front.style.fontFamily, 'kleeOne');
  assert.deepEqual(template.front.style.colors, { accent: '#0f766e', bg: '#fffaf0' });
  assert.deepEqual(template.back.style.colors, { accent: '#0f766e', bg: '#fffaf0', fg: '#334155' });
  assert.deepEqual(template.fieldStyles.front, { colors: { accent: '#b45309' }, font: { family: 'shipporiMincho', size: 40 } });
  assert.equal(normalizeDeckTemplate(config).front.style.fontFamily, 'kleeOne');
});

test('field and card styles layer on top of the side style, most specific last', () => {
  const side = resolveTemplate(normalizeConfig({ version: 5, noteTypes: builtinNoteTypes() }), 'vocab').front.style;
  const field = { font: { family: 'lexend', size: 20 }, colors: { fg: '#111111' } };
  const card = { font: { size: 50 }, colors: { fg: '#ff0000' } };
  assert.equal(mergeSideStyle(side), side);
  const merged = mergeSideStyle(side, field, card);
  assert.equal(merged.fontFamily, 'lexend');
  assert.equal(merged.fontSize, 50);
  assert.deepEqual(merged.colors, { fg: '#ff0000' });
  assert.equal(merged.autoFit, true);
  assert.equal(side.fontSize, 30);
});

test('unknown font ids and bad colors fall back instead of breaking old templates', () => {
  const t = normalizeDeckTemplate({ front: { style: { fontFamily: 'comicSans', colors: { bg: 'red', fg: '#abc' } } } });
  assert.equal(t.front.style.fontFamily, 'default');
  assert.deepEqual(t.front.style.colors, { fg: '#abc' });
  assert.equal(normalizeDeckTemplate({ front: { style: { fontFamily: 'lexend' } } }).front.style.fontFamily, 'lexend');
  assert.deepEqual(sanitizeStyle({ font: { family: 'custom:123e4567-e89b-12d3-a456-426614174000' } }, 's'), { font: { family: 'custom:123e4567-e89b-12d3-a456-426614174000' } });
});

test('appearance edits keep colors and fonts when written back', () => {
  const config = normalizeConfig({ version: 5, noteTypes: builtinNoteTypes() });
  const edited = resolveTemplate(config, 'vocab');
  edited.front.style.colors = { bg: '#101010', fg: '#f0f0f0' };
  edited.front.style.fontFamily = 'mPlusRounded';
  const next = resolveTemplate(applyResolvedTemplate(config, 'vocab', edited), 'vocab');
  assert.deepEqual(next.front.style.colors, { bg: '#101010', fg: '#f0f0f0' });
  assert.equal(next.front.style.fontFamily, 'mPlusRounded');
  assert.equal(next.back.style.colors, undefined);
});

import { layered, updateStyle } from '../src/lib/styleEdit.ts';
test('style edits set, clear and prune keys without leaving empty objects', () => {
  let style = updateStyle(undefined, { theme: 'dark', colors: { bg: '#101010' }, font: { family: 'lexend', size: 200 } });
  assert.deepEqual(style, { theme: 'dark', colors: { bg: '#101010' }, font: { family: 'lexend', size: 72 } });
  style = updateStyle(style, { colors: { fg: '#fff' }, font: { bold: true } });
  assert.deepEqual(style.colors, { bg: '#101010', fg: '#fff' });
  style = updateStyle(style, { colors: { bg: null, fg: null }, font: { family: null, size: null, bold: null }, theme: null });
  assert.equal(style, undefined);
  assert.equal(updateStyle({ align: 'left' }, { align: null }), undefined);
  assert.deepEqual(updateStyle({ autoFit: true }, { autoFit: false }), { autoFit: false });
  assert.equal(updateStyle({ font: { size: 20 } }, { font: { size: 5 } }).font.size, 12);
});

test('a layer is judged on top of what it inherits', () => {
  assert.deepEqual(layered({ colors: { bg: '#000' } }, { colors: { fg: '#fff' } }).colors, { bg: '#000', fg: '#fff' });
  assert.equal(styleContrast(layered({ colors: { bg: '#000' } }, { colors: { fg: '#111' } })).ok, false);
});
