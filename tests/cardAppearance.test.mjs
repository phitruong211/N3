import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultDeckTemplate } from '../src/lib/ankiImport.ts';
import { copySideStyle, createAppearanceDraft } from '../src/lib/cardAppearance.ts';

test('legacy different faces open in separate mode without mutation', () => {
  const template = defaultDeckTemplate();
  template.front.style.fontSize = 70;
  template.back.style.fontSize = 24;
  const draft = createAppearanceDraft(template);
  assert.equal(draft.separateSides, true);
  assert.equal(draft.template.front.style.fontSize, 70);
  assert.equal(draft.template.back.style.fontSize, 24);
});

test('copying one side is explicit and copies style only', () => {
  const template = defaultDeckTemplate();
  template.front.style.fontSize = 42;
  template.back.style.fontSize = 24;
  const copied = copySideStyle(template, 'front');
  assert.deepEqual(copied.back.style, template.front.style);
  assert.deepEqual(copied.back.fields, template.back.fields);
});
