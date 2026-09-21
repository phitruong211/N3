import assert from 'node:assert/strict';
import test from 'node:test';

import { formatTimeUntilDue, getReadyAnkiItems } from '../src/lib/srs.ts';

function card(cardId, dueDate, state = 'review') {
  return {
    cardId,
    deckType: 'vocabulary',
    state,
    easeFactor: 2.5,
    dueDate,
    reps: 1,
    lapses: 0,
    lastReviewedAt: null,
  };
}

test('Anki queue prioritizes the oldest due cards, then keeps fresh source order', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');
  const items = [{ id: 'fresh-1' }, { id: 'due-newer' }, { id: 'future' }, { id: 'due-older' }, { id: 'fresh-2' }];
  const cards = [
    card('due-newer', '2026-09-21T11:59:00.000Z'),
    card('future', '2026-09-21T12:01:00.000Z'),
    card('due-older', '2026-09-20T12:00:00.000Z'),
  ];

  assert.deepEqual(
    getReadyAnkiItems(items, cards, 'vocabulary', now).map(({ id }) => id),
    ['due-older', 'due-newer', 'fresh-1', 'fresh-2']
  );
});

test('Anki queue isolates cards by deck type even when ids collide', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');
  const items = [{ id: 'shared-id' }];
  const cards = [{ ...card('shared-id', '2026-09-22T12:00:00.000Z'), deckType: 'kanji' }];

  assert.deepEqual(getReadyAnkiItems(items, cards, 'vocabulary', now), items);
});

test('remaining time is calculated from dueDate instead of the original interval', () => {
  const now = new Date('2026-09-21T12:00:00.000Z');

  assert.equal(formatTimeUntilDue(card('one', '2026-09-21T12:00:30.000Z'), now), '1m');
  assert.equal(formatTimeUntilDue(card('two', '2026-09-21T13:01:00.000Z'), now), '2h');
  assert.equal(formatTimeUntilDue(card('three', '2026-09-21T11:59:59.000Z'), now), 'Đến hạn');
});
