import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_PRESETS, activePreset, applyPreset } from '../src/lib/cardPresets.ts';
import { builtinNoteTypes, normalizeConfig, resolveTemplate, sanitizeStyle } from '../src/lib/deckFormat.ts';

const base = () => {
  const types = builtinNoteTypes();
  types[0] = { ...types[0], style: { theme: 'blue' }, front: { ...types[0].front, style: { align: 'left' } }, fields: types[0].fields.map(f => f.key === 'back' ? { ...f, style: { font: { size: 18 } } } : f) };
  return { version: 5, noteTypes: types };
};

test('every preset is a style the deck format accepts unchanged', () => {
  for (const preset of CARD_PRESETS) {
    const issues = [];
    assert.deepEqual(sanitizeStyle(preset.style, 'style', issues), preset.style, preset.id);
    assert.deepEqual(issues, [], preset.id);
  }
});

test('a preset replaces the deck look but keeps per-field choices', () => {
  const next = applyPreset(base(), CARD_PRESETS[2]);
  assert.deepEqual(next.style, CARD_PRESETS[2].style);
  assert.equal(next.noteTypes[0].style, undefined);
  assert.equal(next.noteTypes[0].front.style, undefined);
  assert.deepEqual(next.noteTypes[0].fields.find(f => f.key === 'back').style, { font: { size: 18 } });
  // It survives the round trip through the server-side shape and resolves to the preset's font.
  const resolved = resolveTemplate(normalizeConfig(next), next.noteTypes[0].id);
  assert.equal(resolved.front.style.fontFamily, 'shipporiMincho');
  assert.equal(resolved.front.style.theme, 'paper');
});

test('the picker knows which preset is on, and that a custom look is none', () => {
  assert.equal(activePreset(applyPreset(base(), CARD_PRESETS[1])), 'ink');
  assert.equal(activePreset(base()), null);
});
