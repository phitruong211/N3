import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFreeStudyQueue, parseStudySetup, serializeStudySetup } from '../src/lib/studySetup.ts';

const cards = Array.from({ length: 250 }, (_, position) => ({ id: String(position), position, tags: position < 30 ? ['Bài 1'] : ['Bài 2'] }));

test('free study only filters by lesson and keeps the deck order', () => {
  const queue = buildFreeStudyQueue(cards, { mode: 'free', lessonKey: 'lesson-2' });
  assert.equal(queue.length, 220);
  assert.equal(queue[0].id, '30');
});

test('legacy study options are ignored', () => {
  assert.deepEqual(parseStudySetup('?mode=scheduled&order=shuffle&limit=50&minutes=20&new=10'), { mode: 'free', lessonKey: null });
});

test('free setup round-trips through the URL', () => {
  const setup = { mode: 'free', lessonKey: 'lesson-6' };
  assert.deepEqual(parseStudySetup(`?${serializeStudySetup(setup)}`), setup);
});
