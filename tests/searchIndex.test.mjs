import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDoc, fold, highlightParts, romajiToKana, searchDocs } from '../src/lib/searchIndex.ts';

test('fold keeps the length and drops Vietnamese accents, not kana marks', () => {
  assert.equal(fold('Ôm, bế (cụ thể) Đà'), 'om, be (cu the) da');
  assert.equal(fold('ガ'), 'が');
  assert.equal(fold('コーヒー').length, 4);
});

test('romaji becomes hiragana, invalid input stays null', () => {
  assert.equal(romajiToKana('taberu'), 'たべる');
  assert.equal(romajiToKana('shinbun'), 'しんぶん');
  assert.equal(romajiToKana('kippu'), 'きっぷ');
  assert.equal(romajiToKana('kyou'), 'きょう');
  assert.equal(romajiToKana('jisho'), 'じしょ');
  assert.equal(romajiToKana('hello?'), null);
  assert.equal(romajiToKana('xyz'), null);
});

const docs = [
  buildDoc('hug', [['抱く', 10, true], ['だく', 9, true], ['Ôm, bế (cụ thể)', 5]]),
  buildDoc('eat', [['食べる', 10, true], ['たべる', 9, true], ['ăn', 5]]),
  buildDoc('food', [['食べ物', 10, true], ['たべもの', 9, true], ['đồ ăn', 5]]),
];

test('accent-insensitive Vietnamese and romaji both find words', () => {
  assert.deepEqual(searchDocs(docs, 'om'), ['hug']);
  assert.deepEqual(searchDocs(docs, 'an'), ['eat', 'food']);
  assert.deepEqual(searchDocs(docs, 'taberu'), ['eat']);
  assert.deepEqual(searchDocs(docs, 'タベル'), ['eat']);
});

test('exact and prefix matches rank above partial ones, every word must match', () => {
  assert.deepEqual(searchDocs(docs, 'たべ'), ['eat', 'food']);
  assert.deepEqual(searchDocs(docs, 'ăn đồ'), ['food']);
  assert.deepEqual(searchDocs(docs, 'n'), [], 'one Latin letter only matches word starts');
});

test('highlight splits on the original text', () => {
  assert.deepEqual(highlightParts('Ôm, bế', 'om'), [{ text: 'Ôm', hit: true }, { text: ', bế', hit: false }]);
});
