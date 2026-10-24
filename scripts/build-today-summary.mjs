// Writes public/data/today.json: the counts and the word list the Today page needs, so it can render without
// downloading the whole 2.6 MB library. Runs before every build; tests/todaySummary.test.mjs fails if the file is stale.
// Order matters: wordOfDay picks by index, so words stay in loadVocabulary() order.
import { readFile, writeFile } from 'node:fs/promises';
import { loadVocabulary, loadKanji, loadGrammar } from '../src/lib/data.ts';

const original = globalThis.fetch;
globalThis.fetch = async path => new Response(await readFile(new URL(`../public${path}`, import.meta.url)));
try {
  const [vocabulary, kanji, grammar] = await Promise.all([loadVocabulary(), loadKanji(), loadGrammar()]);
  const summary = {
    counts: { vocabulary: vocabulary.length, kanji: kanji.length, grammar: grammar.length },
    words: vocabulary.map(word => [word.tu, word.phien_am, word.han_viet ?? '', word.nghia[0] ?? '']),
  };
  await writeFile(new URL('../public/data/today.json', import.meta.url), JSON.stringify(summary));
  console.log(`today.json: ${summary.words.length} words, counts ${JSON.stringify(summary.counts)}`);
} finally { globalThis.fetch = original; }
