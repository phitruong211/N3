import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadN5Decks, n5StudyCard } from '../src/lib/n5Decks.ts';
import { buildBuiltInDecks, buildSavedDeck } from '../src/lib/deckCatalog.ts';
import { presentationCard } from '../src/lib/cards.ts';
import { buildScheduledDeckQueue } from '../src/lib/deckSchedule.ts';
import { buildFreeStudyQueue } from '../src/lib/studySetup.ts';

test('all supplied N5 cards are available in free and scheduled shared decks without losing content', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
  try {
    const loaded = await loadN5Decks();
    const decks = buildBuiltInDecks([], [], [], loaded);
    assert.deepEqual(decks.map(deck => [deck.id, deck.cards.length]), [
      ['vocabN5', 601], ['kanjiN5', 314], ['grammarN5', 107],
    ]);
    const ids = new Set();
    for (const deck of decks) {
      const raw = JSON.parse(await readFile(new URL(`../public/data/${deck.id}.json`, import.meta.url), 'utf8'));
      assert.equal(buildFreeStudyQueue(deck.cards, { mode: 'free', lessonKey: null }).length, raw.length);
      const scheduled = buildScheduledDeckQueue(deck.cards, () => null, { dailyNewLimit: 20 });
      assert.equal(scheduled.cards.length, 20);
      deck.cards.forEach((card, index) => {
        const source = raw[index];
        assert.ok(!ids.has(card.id), `Duplicate identity: ${card.id}`);
        assert.ok(card.id.length <= 200, 'Card identity must fit the backend learning API');
        ids.add(card.id);
        assert.equal(card.type, source.type);
        assert.equal(card.front, source.front);
        assert.equal(card.back, source.back);
        assert.equal(card.reading, source.reading);
        assert.equal(card.hanViet, source.han_viet || undefined);
        assert.equal(card.note, source.note);
        assert.deepEqual(card.tags, source.tags);
        if (source.examples) assert.deepEqual(JSON.parse(presentationCard(card).extraData.examples), source.examples);
        assert.equal(n5StudyCard(source, deck.id, raw.length - index).id, card.id, 'Reordering must preserve progress identity');
      });
    }
    const related = decks[1].cards.filter(card => card.front === '水');
    assert.deepEqual(related.map(card => card.type), ['KANJI', 'VOCABULARY']);
    assert.notEqual(related[0].id, related[1].id);
    assert.deepEqual(buildSavedDeck(decks, [{ itemId: related[1].id, itemType: 'vocabulary' }]).cards, [related[1]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
