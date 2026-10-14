import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadVocabulary, loadKanji, loadGrammar } from '../src/lib/data.ts';
import { loadN5Decks } from '../src/lib/n5Decks.ts';
import { buildBuiltInDecks } from '../src/lib/deckCatalog.ts';
import { cardNoteKey } from '../src/lib/cardNotes.ts';

test('every built-in study card has a unique permanent note identity and keeps it when content or order changes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
  try {
    const [v, k, g, n5] = await Promise.all([loadVocabulary(), loadKanji(), loadGrammar(), loadN5Decks()]);
    const cards = buildBuiltInDecks(v, k, g, n5).flatMap(deck => deck.cards);
    const identities = new Set();
    for (const card of cards) {
      assert.match(card.noteIdentity, /^[a-f0-9-]{36}$/);
      assert.ok(!identities.has(card.noteIdentity), `Duplicate note identity for ${card.front}`);
      identities.add(card.noteIdentity);
      assert.equal(await cardNoteKey(card), await cardNoteKey({ ...card, id: 'reordered', position: 123, front: 'corrected', reading: 'corrected' }));
    }
  } finally { globalThis.fetch = original; }
});
