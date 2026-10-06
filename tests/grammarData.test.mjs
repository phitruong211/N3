import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeGrammarCard } from '../src/lib/grammarData.ts';
import { grammarCard } from '../src/lib/cards.ts';

for (const [level, count] of [['N3', 249], ['N4', 132]]) {
  test(`${level} built-in library and study cards retain all supplied content`, () => {
    const source = JSON.parse(readFileSync(new URL(`../public/data/grammar${level}.json`, import.meta.url), 'utf8'));
    assert.equal(source.length, count);
    const ids = new Set();
    source.forEach((raw, index) => {
      const item = normalizeGrammarCard(raw, level, index);
      const card = grammarCard(item, `grammar${level}`, index);
      assert.ok(item.meaning);
      assert.ok(item.structure);
      assert.ok(item.usage);
      assert.equal(item.level, level);
      assert.equal(card.front, raw.front);
      assert.equal(card.back, raw.back);
      assert.equal(card.reading, raw.reading);
      assert.deepEqual(card.tags, raw.tags);
      assert.deepEqual(JSON.parse(card.extraData.examples), raw.examples);
      for (const marker of ['Sắc thái', 'Phân biệt']) {
        if (raw.back.includes(`【${marker}】`)) assert.ok(item.usage.includes(`【${marker}】`));
      }
      assert.ok(!ids.has(item.id), `Duplicate ID: ${raw.front}`);
      ids.add(item.id);
    });
  });
}
