import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFreeStudyQueue, parseStudySetup, serializeStudySetup } from '../src/lib/studySetup.ts';

const cards = Array.from({ length: 250 }, (_, position) => ({ id: String(position), position, tags: position < 30 ? ['Bài 1'] : ['Bài 2'] }));

test('free study filters lessons, orders, and caps large all sessions', () => {
  const queue = buildFreeStudyQueue(cards, { mode: 'free', limit: 'all', order: 'source', lessonKey: 'lesson-2' });
  assert.equal(queue.length, 200);
  assert.equal(queue[0].id, '30');
});

test('scheduled setup does not accept shuffle or card limits', () => {
  assert.deepEqual(parseStudySetup('?mode=scheduled&order=shuffle&limit=50&minutes=20&new=10'), { mode: 'scheduled', sessionMinutes: 20, newLimit: 10 });
});

test('free setup round-trips through the URL', () => {
  const setup = { mode: 'free', limit: 20, order: 'shuffle', lessonKey: 'lesson-6' };
  assert.deepEqual(parseStudySetup(`?${serializeStudySetup(setup)}`), setup);
});
