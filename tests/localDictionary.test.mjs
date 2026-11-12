import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localEntries, searchLocal } from '../src/lib/localDictionary.ts';

const entries = localEntries({
  vocabulary: [
    { id: 'v1', tu: '勉強', phien_am: 'べんきょう', meaning: 'Học tập, việc học', han_viet: 'Miễn Cường', level: 'N4' },
    { id: 'v2', tu: '勉強会', phien_am: 'べんきょうかい', meaning: 'Buổi học nhóm', han_viet: 'Miễn Cường Hội', level: 'N3' },
    { id: 'v3', tu: '猫', phien_am: 'ねこ', meaning: 'Con mèo', han_viet: 'Miêu', level: 'N4' },
  ],
  kanji: [{ id: 'k1', kanji: '強', hanViet: 'Cường', meaning: 'mạnh', level: 'N3' }],
  grammar: [{ id: 'g1', pattern: '〜ために', reading: 'ために', meaning: 'Để, vì', level: 'N4' }],
});
const ids = (q) => searchLocal(entries, q).map(e => e.id);

test('Japanese finds the exact word first, then words starting with it', () => {
  assert.deepEqual(ids('勉強'), ['v1', 'v2']);
  assert.deepEqual(ids('猫'), ['v3']);
});

test('romaji is read as kana', () => {
  assert.deepEqual(ids('neko'), ['v3']);
  assert.deepEqual(ids('benkyou'), ['v1', 'v2']);
});

test('Vietnamese finds meanings and Hán Việt, with or without accents', () => {
  assert.deepEqual(ids('mèo'), ['v3']);
  assert.deepEqual(ids('meo'), ['v3']);
  assert.equal(ids('Cường')[0], 'k1');
  assert.ok(ids('học').includes('v1'));
});

test('nothing for an empty query, and the limit holds', () => {
  assert.deepEqual(ids('  '), []);
  assert.equal(searchLocal(entries, 'n', 2).length <= 2, true);
});
