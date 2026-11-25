import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formParts, locate } from '../src/lib/lessons.ts';

const groups = JSON.parse(readFileSync(new URL('../src/data/lessons/n4n3.json', import.meta.url), 'utf8'));

test('locate marks the pattern, conjugated or given outright', () => {
  assert.deepEqual(locate({ n: '〜たとたん(に)', jp: '窓を開けたとたん、風が入った。' }), [4, 4]);
  assert.deepEqual(locate({ n: '〜てくる', jp: 'だんだん暑くなってきた。', hl: 'てきた' }), [8, 3]);
  assert.equal(locate({ n: '〜とき', jp: 'ありがとう。' }), null);
});

test('formParts turns slots into chips and keeps every character', () => {
  const parts = formParts('Vた + とたん / Nの');
  assert.deepEqual(parts.filter(p => p.kind).map(p => [p.text, p.kind]), [['Vた', 'v'], ['Nの', 'n']]);
  assert.equal(parts.map(p => p.text).join(''), 'Vた + とたん / Nの');
});

test('every lesson pattern has a name, a meaning and an example', () => {
  assert.equal(groups.length, 12);
  for (const g of groups) for (const p of g.pats) assert.ok(p.n && p.m && p.jp, `${g.short} #${p.id}`);
});
