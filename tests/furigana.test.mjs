import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alignFurigana, normalizeReadingInput, parseFuriganaMarkup, parseStoredFurigana, resolveFurigana, segmentsReading, serializeFurigana } from '../src/lib/furigana.ts';

test('explicit furigana markup becomes clean text and round-trips', () => {
  const result = parseFuriganaMarkup('明日[あした]は学校[がっこう]へ行[い]く');
  assert.equal(result.warning, undefined);
  assert.equal(result.text, '明日は学校へ行く');
  assert.equal(segmentsReading(result.segments), 'あしたはがっこうへいく');
  assert.equal(serializeFurigana(result.segments), '明日[あした]は学校[がっこう]へ行[い]く');
});

test('reading fields accept kana or extract kana from Kanji[hiragana]', () => {
  assert.equal(normalizeReadingInput('たちば'), 'たちば');
  assert.equal(normalizeReadingInput('立場[たちば]'), 'たちば');
});

test('reading aligns to kanji runs only when kana anchors are unambiguous', () => {
  assert.deepEqual(alignFurigana('勉強する', 'べんきょうする').segments, [
    { text: '勉強', reading: 'べんきょう' },
    { text: 'する' },
  ]);
  assert.deepEqual(alignFurigana('学校へ行く', 'がっこうへいく').segments, [
    { text: '学校', reading: 'がっこう' },
    { text: 'へ' },
    { text: '行', reading: 'い' },
    { text: 'く' },
  ]);
  assert.match(alignFurigana('時々と時', 'ときどきととき').warning, /複数|多く|furigana/);
});

test('invalid markup stays visible and reports an actionable warning', () => {
  const result = resolveFurigana('学校[がっこう', 'がっこう');
  assert.equal(result.text, '学校[がっこう');
  assert.match(result.warning, /Kanji\[hiragana\]/);
});

test('stored segments reject malformed data safely', () => {
  assert.deepEqual(parseStoredFurigana('[{"text":"学校","reading":"がっこう"}]'), [{ text: '学校', reading: 'がっこう' }]);
  assert.deepEqual(parseStoredFurigana('{bad'), []);
  assert.deepEqual(parseStoredFurigana([{ nope: true }]), []);
});
