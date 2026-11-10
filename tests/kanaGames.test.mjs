import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KANA_POOL, ROMAJI } from '../src/components/kana/kanaProgress.ts';
import { LOOKALIKES, gateRow, impostorRound, rainLevel, resolveTyped, toriiLevel } from '../src/components/kana/games/gameLogic.ts';

const drops = chars => chars.map(ch => ({ ch }));

test('typing a reading hits the most urgent matching drop', () => {
  assert.equal(resolveTyped('ka', drops(['か', 'き'])).hit?.ch, 'か');
  assert.equal(resolveTyped('KA ', drops(['か'])).hit?.ch, 'か');
  assert.equal(resolveTyped('si', drops(['し'])).hit?.ch, 'し');
  assert.equal(resolveTyped('tu', drops(['つ'])).hit?.ch, 'つ');
});

test('a reading that starts a longer one on screen waits for more letters or Enter', () => {
  assert.deepEqual(resolveTyped('n', drops(['ん', 'な'])), { hit: null, wrong: false });
  assert.equal(resolveTyped('n', drops(['ん', 'な']), true).hit?.ch, 'ん');
  assert.equal(resolveTyped('n', drops(['ん'])).hit?.ch, 'ん');
  assert.deepEqual(resolveTyped('k', drops(['か'])), { hit: null, wrong: false });
});

test('a dead-end prefix is wrong straight away', () => {
  assert.equal(resolveTyped('x', drops(['か'])).wrong, true);
  assert.equal(resolveTyped('ki', drops(['か'])).wrong, true);
  assert.equal(resolveTyped('k', drops(['か']), true).wrong, true);
  assert.equal(resolveTyped('', drops(['か'])).wrong, false);
});

test('every lookalike is a real character of its script', () => {
  for (const script of ['hira', 'kata']) for (const group of LOOKALIKES[script]) {
    assert.ok(group.length >= 2);
    for (const k of group) assert.ok(KANA_POOL[script].includes(k), `${k} in ${script}`);
  }
});

test('an impostor grid hides one different lookalike and grows to 8 x 8', () => {
  for (let level = 1; level <= 20; level++) {
    const r = impostorRound(level % 2 ? 'hira' : 'kata', level);
    assert.notEqual(r.base, r.target);
    assert.ok(LOOKALIKES[level % 2 ? 'hira' : 'kata'].some(g => g.includes(r.base) && g.includes(r.target)));
    assert.ok(r.index >= 0 && r.index < r.size * r.size);
    assert.ok(r.seconds >= 5);
  }
  assert.equal(impostorRound('hira', 1).size, 4);
  assert.equal(impostorRound('hira', 15).size, 8);
});

test('each torii row has three distinct gates with the answer in its lane', () => {
  for (let i = 0; i < 200; i++) {
    const row = gateRow(i % 2 ? 'hira' : 'kata', {});
    assert.equal(row.gates.length, 3);
    assert.equal(new Set(row.gates).size, 3);
    assert.equal(new Set(row.gates.map(k => ROMAJI[k])).size, 3);
    assert.ok(row.lane >= 0 && row.lane < 3);
  }
});

test('difficulty only ever climbs', () => {
  for (let n = 0; n < 200; n++) {
    assert.ok(rainLevel(n + 1).fallSeconds <= rainLevel(n).fallSeconds);
    assert.ok(rainLevel(n + 1).maxDrops >= rainLevel(n).maxDrops);
    assert.ok(toriiLevel(n + 1).speed >= toriiLevel(n).speed);
  }
});

test('music stays in the miyako-bushi scale and only gently thickens with the level', async () => {
  const { musicEvents, noteFreq, bpmFor } = await import('../src/components/kana/games/gameMusic.ts');
  const inScale = f => { const semis = Math.round(12 * Math.log2(f / 146.83)); return [0, 1, 5, 7, 8].includes(((semis % 12) + 12) % 12); };
  assert.equal(noteFreq(0).toFixed(2), '146.83');
  assert.equal(noteFreq(5).toFixed(2), (146.83 * 2).toFixed(2));
  const count = level => Array.from({ length: 64 }, (_, s) => musicEvents(s, level)).flat();
  for (let level = 1; level <= 6; level++) for (const e of count(level)) if ('freq' in e) assert.ok(inScale(e.freq), `${e.kind} ${e.freq}`);
  // The melody leads from level 1, above the chords.
  const top = (level, kind) => Math.max(...count(level).filter(e => e.kind === kind).map(e => e.freq));
  assert.ok(count(1).some(e => e.kind === 'pluck'));
  assert.ok(Math.min(...count(1).filter(e => e.kind === 'pluck').map(e => e.freq)) > top(1, 'bass'));
  assert.ok(count(4).length > count(2).length && count(3).length > count(2).length && count(2).length > count(1).length);
  // Background music: the tempo only drifts, from a lofi 76 to at most 94 BPM.
  assert.equal(bpmFor(1), 76);
  assert.ok(bpmFor(50) <= 94 && bpmFor(50) === bpmFor(7));
});
