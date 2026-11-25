import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGuide, lessonCards, patternKeys } from '../src/lib/grammarGuide.ts';
import { normalizeGrammarCard } from '../src/lib/grammarData.ts';

const load = level => ({
  guide: parseGuide(readFileSync(new URL(`../src/data/guide/${level}.md`, import.meta.url), 'utf8')),
  grammar: JSON.parse(readFileSync(new URL(`../public/data/grammar${level}.json`, import.meta.url), 'utf8')).map((item, i) => normalizeGrammarCard(item, level, i)),
});

test('patternKeys drops 〜, notes in brackets and splits alternatives', () => {
  assert.deepEqual(patternKeys('〜たとたん(に) / 〜最中だ'), ['たとたん', '最中だ']);
  assert.deepEqual(patternKeys('〜うちに (thay đổi)'), ['うちに']);
});

test('each guide becomes lessons whose pattern rows become unique cards', () => {
  for (const level of ['N3', 'N4']) {
    const { guide, grammar } = load(level);
    assert.ok(guide.lessons.length >= 10, level);
    const cards = lessonCards(guide.lessons, level, grammar);
    assert.ok(cards.length > 120, `${level}: ${cards.length}`);
    assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
    assert.ok(cards.some(card => !card.id.startsWith('guide-')), 'reuses built-in cards');
  }
});

test('a blank line between two tables keeps them apart', () => {
  const { guide } = load('N4');
  const tables = guide.lessons.flatMap(lesson => lesson.blocks).filter(block => block.kind === 'table');
  assert.ok(tables.some(table => table.head[0] === 'Động từ thường'));
});
