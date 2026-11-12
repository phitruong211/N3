import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countStates, learnStates, stateOf } from '../src/lib/learnState.ts';

const cards = [
  { cardId: 'a', deckType: 'vocabulary', state: 'review' },
  { cardId: 'b', deckType: 'vocabulary', state: 'learning' },
  { cardId: 'c', deckType: 'vocabulary', state: 'relearning' },
  { cardId: 'd', deckType: 'vocabulary', state: 'new' },
  { cardId: 'a', deckType: 'kanji', state: 'learning' },
];

test('review is known, learning and relearning are in progress, everything else is new', () => {
  const states = learnStates(cards, 'vocabulary');
  assert.equal(stateOf(states, 'a'), 'known');
  assert.equal(stateOf(states, 'b'), 'learning');
  assert.equal(stateOf(states, 'c'), 'learning');
  assert.equal(stateOf(states, 'd'), 'new');
  assert.equal(stateOf(states, 'never-seen'), 'new');
});

test('deck types do not leak into each other, and counts cover every item', () => {
  assert.equal(stateOf(learnStates(cards, 'kanji'), 'a'), 'learning');
  assert.deepEqual(countStates(['a', 'b', 'c', 'd', 'x'], learnStates(cards, 'vocabulary')), { new: 2, learning: 2, known: 1 });
});

test('level progress counts started items per level, easiest first', async () => {
  const { levelProgress } = await import('../src/lib/learnState.ts');
  const items = [{ id: 'a', level: 'N3' }, { id: 'b', level: 'N4' }, { id: 'c', level: 'N4' }, { id: 'x', level: 'N2' }];
  const result = levelProgress(items, learnStates(cards, 'vocabulary'));
  assert.deepEqual(result.levels.map(l => [l.level, l.studied, l.total]), [['N4', 2, 2], ['N3', 1, 1], ['N2', 0, 1]]);
  assert.equal(result.studied, 3);
  assert.equal(result.total, 4);
});
