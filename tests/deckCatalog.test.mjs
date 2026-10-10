import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortDeckDefinitions, deckCapabilities } from '../src/lib/deckCatalog.ts';

test('built-in decks follow N4 N3 N2 and content order', () => {
  const input = [
    { id: 'grammarN2', level: 'N2', kind: 'grammar' },
    { id: 'vocabN3', level: 'N3', kind: 'vocabulary' },
    { id: 'kanjiN4', level: 'N4', kind: 'kanji' },
  ];
  assert.deepEqual(sortDeckDefinitions(input).map(deck => deck.id), ['kanjiN4', 'vocabN3', 'grammarN2']);
});

test('capabilities distinguish built-in personal saved and empty', () => {
  assert.deepEqual(deckCapabilities('BUILT_IN', 10), { canStudy: true, canManage: false, canReorder: false });
  assert.deepEqual(deckCapabilities('SAVED', 0), { canStudy: false, canManage: false, canReorder: false });
  assert.deepEqual(deckCapabilities('IMPORT', 0), { canStudy: false, canManage: true, canReorder: true });
});
