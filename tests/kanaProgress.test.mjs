import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KANA_POOL, KANA_TOTAL, ROMAJI, buildQuestion, countLearned, isLearned, kanaLearned } from '../src/components/kana/kanaProgress.ts';

test('the pools hold every character once', () => {
  assert.equal(KANA_POOL.hira.length, 46);
  assert.equal(KANA_POOL.kata.length, 46);
  assert.equal(KANA_TOTAL, 92);
  assert.equal(new Set(KANA_POOL.hira).size, 46);
  assert.equal(ROMAJI['あ'], 'a');
  assert.equal(ROMAJI['ツ'], 'tsu');
});

test('a character counts as learned after two correct answers in a row', () => {
  assert.equal(isLearned({ あ: 1 }, 'あ'), false);
  assert.equal(isLearned({ あ: 2 }, 'あ'), true);
  assert.equal(isLearned({}, 'あ'), false);
  assert.equal(countLearned({ あ: 2, い: 2, う: 1 }, KANA_POOL.hira), 2);
  assert.equal(kanaLearned({ あ: 2, ア: 2 }), 2);
});

test('every question offers four distinct readings, one of them right', () => {
  for (let i = 0; i < 50; i++) {
    const q = buildQuestion(KANA_POOL.hira, {});
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.romaji));
    assert.equal(q.romaji, ROMAJI[q.ch]);
  }
});

test('questions skip learned characters and never repeat the one just asked', () => {
  const progress = Object.fromEntries(KANA_POOL.hira.slice(0, 44).map(kana => [kana, 2]));
  const left = KANA_POOL.hira.slice(44);
  for (let i = 0; i < 50; i++) {
    assert.ok(left.includes(buildQuestion(KANA_POOL.hira, progress).ch));
    assert.notEqual(buildQuestion(KANA_POOL.hira, progress, left[0]).ch, left[0]);
  }
});

test('once everything is learned it still asks, rather than running dry', () => {
  const progress = Object.fromEntries(KANA_POOL.hira.map(kana => [kana, 2]));
  const q = buildQuestion(KANA_POOL.hira, progress);
  assert.ok(KANA_POOL.hira.includes(q.ch));
  assert.ok(q.choices.includes(q.romaji));
});

test('a drill of a few missed characters still offers four readings from the whole script', () => {
  const focus = ['さ', 'ち'];
  for (let i = 0; i < 50; i++) {
    const q = buildQuestion(focus, {}, undefined, KANA_POOL.hira);
    assert.ok(focus.includes(q.ch));
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.romaji));
  }
});
