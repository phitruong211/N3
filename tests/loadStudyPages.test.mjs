import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStudyPages } from '../src/lib/loadStudyPages.ts';

test('study pages load with bounded concurrency and retain order despite out-of-order responses', async () => {
  let active = 0, maximum = 0;
  const calls = [];
  const cards = await loadStudyPages(async page => {
    calls.push(page);
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, page % 2 ? 15 : 5));
    active--;
    return { content: [page], totalPages: 11 };
  });
  assert.deepEqual(cards, Array.from({ length: 11 }, (_, index) => index));
  assert.equal(maximum, 3);
  assert.equal(new Set(calls).size, 11);
});

test('study pages use the server total, handle empty decks and report failed pages', async () => {
  assert.deepEqual(await loadStudyPages(async () => ({ content: [], totalPages: 0 })), []);
  await assert.rejects(loadStudyPages(async page => {
    if (page === 1) throw new Error('Cannot load page');
    return { content: [0], totalPages: 2 };
  }), /Cannot load page/);
});
