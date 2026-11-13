import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateQuiz, isTypedCorrect, quizPoolSize } from '../src/lib/quiz.ts';

const vocab = (i, kanji, hiragana, meaning) => ({ id: `v${i}`, kanji, hiragana, meaning, level: 'N5' });
const pools = {
  vocabulary: [vocab(1, '学校', 'がっこう', 'trường học'), vocab(2, '先生', 'せんせい', 'giáo viên'), vocab(3, '水', 'みず', 'nước'),
    vocab(4, '本', 'ほん', 'sách'), vocab(5, '山', 'やま', 'núi'), vocab(6, 'テレビ', 'テレビ', 'tivi'), vocab(7, '川', 'かわ', 'nước')],
  kanji: [],
  grammar: [1, 2, 3, 4].map(i => ({ id: `g${i}`, pattern: `mẫu ${i}`, meaning: `nghĩa ${i}`, examples: i === 4 ? [] : [{ japanese: `câu ${i}`, reading: '', meaning: `dịch ${i}` }] })),
};

test('every multiple-choice question has the answer once among distinct options', () => {
  for (const type of ['vocab-meaning', 'vocab-reading', 'vocab-reverse', 'grammar-meaning', 'grammar-sentence']) {
    for (const q of generateQuiz(type, pools, 10)) {
      assert.equal(new Set(q.options).size, q.options.length, `${type}: duplicate option`);
      assert.equal(q.options.filter(option => option === q.correctAnswer).length, 1, `${type}: answer must appear once`);
    }
  }
});

test('reading quizzes skip kana-only words and sentence quizzes skip patterns without an example', () => {
  assert.equal(quizPoolSize('vocab-reading', pools), 6);
  assert.equal(quizPoolSize('typing', pools), 6);
  assert.equal(quizPoolSize('grammar-sentence', pools), 3);
  assert.equal(quizPoolSize('kanji-meaning', pools), 0);
});

test('typed questions have no options and grammar questions bookmark as grammar', () => {
  assert.deepEqual(generateQuiz('typing', pools, 3).map(q => q.options), [[], [], []]);
  assert.ok(generateQuiz('grammar-meaning', pools, 2).every(q => q.itemType === 'grammar'));
});

test('a typed reading is accepted in hiragana, katakana or romaji, and nothing else', () => {
  assert.ok(isTypedCorrect(' がっこう ', 'がっこう'));
  assert.ok(isTypedCorrect('gakkou', 'がっこう'));
  assert.ok(isTypedCorrect('Sensei', 'せんせい'));
  assert.ok(isTypedCorrect('terebi', 'テレビ'));
  assert.ok(isTypedCorrect('ガッコウ', 'がっこう'));
  assert.ok(!isTypedCorrect('gako', 'がっこう'));
  assert.ok(!isTypedCorrect('', 'がっこう'));
});
