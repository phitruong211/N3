import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadVocabulary, loadKanji, loadGrammar } from '../src/lib/data.ts';

test('public/data/today.json matches the library (run scripts/build-today-summary.mjs if this fails)', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
  try {
    const [vocabulary, kanji, grammar] = await Promise.all([loadVocabulary(), loadKanji(), loadGrammar()]);
    const summary = JSON.parse(await readFile(new URL('../public/data/today.json', import.meta.url), 'utf8'));
    assert.deepEqual(summary.counts, { vocabulary: vocabulary.length, kanji: kanji.length, grammar: grammar.length });
    assert.equal(summary.words.length, vocabulary.length);
    vocabulary.forEach((word, index) => assert.deepEqual(summary.words[index], [word.tu, word.phien_am, word.han_viet ?? '', word.nghia[0] ?? '']));
  } finally { globalThis.fetch = original; }
});
