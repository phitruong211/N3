import test from 'node:test';
import assert from 'node:assert/strict';
import { learnedPercent, summarizeLevel, levelTabLabel, initialLevel, nextTabIndex, KIND_GLYPH, KIND_TILT } from '../src/lib/levelDecks.ts';

test('progress never rounds an unfinished deck to 100% or a started one to 0%', () => {
  assert.equal(learnedPercent(0, 600), 0);
  assert.equal(learnedPercent(5, 0), 0);
  assert.equal(learnedPercent(1, 1000), 1);
  assert.equal(learnedPercent(999, 1000), 99);
  assert.equal(learnedPercent(300, 600), 50);
  assert.equal(learnedPercent(600, 600), 100);
  assert.equal(learnedPercent(700, 600), 100);
});

test('a level summarises all of its decks', () => {
  assert.deepEqual(summarizeLevel([]), { totalCards: 0, learnedCount: 0, dueCount: 0, percent: 0 });
  assert.deepEqual(summarizeLevel([{ totalCards: 600, learnedCount: 300, dueCount: 20 }, { totalCards: 400, learnedCount: 100, dueCount: 5 }]),
    { totalCards: 1000, learnedCount: 400, dueCount: 25, percent: 40 });
});

test('the tab line says what to do now when reviewing and how far along otherwise', () => {
  const some = { totalCards: 100, learnedCount: 38, dueCount: 7, percent: 38 };
  assert.equal(levelTabLabel(some, true), '7 cần ôn');
  assert.equal(levelTabLabel({ ...some, dueCount: 0 }, true), '38% đã học');
  assert.equal(levelTabLabel(some, false), '38% đã học');
  assert.equal(levelTabLabel({ totalCards: 0, learnedCount: 0, dueCount: 0, percent: 0 }, true), 'Sắp có');
});

test('the starting level is the remembered one, else the busiest when reviewing, else the first', () => {
  const levels = ['N5', 'N4', 'N3'];
  const due = { N5: { dueCount: 0 }, N4: { dueCount: 9 }, N3: { dueCount: 3 } };
  assert.equal(initialLevel(levels, 'N3', due, true), 'N3');
  assert.equal(initialLevel(levels, 'N2', due, true), 'N4'); // Remembered level no longer exists.
  assert.equal(initialLevel(levels, null, due, true), 'N4');
  assert.equal(initialLevel(levels, 42, due, false), 'N5');
  assert.equal(initialLevel(levels, null, { N5: { dueCount: 0 } }, true), 'N5'); // Nothing due anywhere.
  assert.equal(initialLevel([], 'N5', due, true), undefined);
});

test('tab keys wrap and jump like a native tablist', () => {
  assert.equal(nextTabIndex('ArrowRight', 3, 4), 0);
  assert.equal(nextTabIndex('ArrowLeft', 0, 4), 3);
  assert.equal(nextTabIndex('Home', 2, 4), 0);
  assert.equal(nextTabIndex('End', 1, 4), 3);
  assert.equal(nextTabIndex('Enter', 1, 4), null);
  assert.equal(nextTabIndex('ArrowRight', 0, 0), null);
});

test('each deck kind has its own seal: the Today library glyph and a distinct tilt', () => {
  assert.deepEqual(KIND_GLYPH, { vocabulary: '語', kanji: '漢', grammar: '文' });
  const tilts = Object.values(KIND_TILT);
  assert.equal(new Set(tilts).size, tilts.length);
  assert.ok(tilts.every(degrees => degrees !== 0 && Math.abs(degrees) <= 6), 'off-true but never crooked');
});
