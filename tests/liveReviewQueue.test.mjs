import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewQueue, nextReadyCard, applyReviewedProgress, promoteDueCards } from '../src/lib/liveReviewQueue.ts';

const now = new Date('2026-10-10T00:00:00.000Z');
const card = { id: 'one' };
const progress = { algorithm:'fsrs-6', state:'learning', dueAt:'2026-10-10T00:01:00.000Z', stability:1, difficulty:5,
  elapsedDays:0, scheduledDays:0, learningSteps:1, repetitions:1, lapses:0, firstReviewedAt:now.toISOString(), lastReviewedAt:now.toISOString(), lastRating:'again' };

test('again leaves the ready queue and returns exactly when due', () => {
  let queue = createReviewQueue({ cards:[card], keyFor:c=>c.id, now });
  assert.equal(nextReadyCard(queue).key, 'one');
  queue = applyReviewedProgress(queue, 'one', progress, now);
  assert.equal(nextReadyCard(queue), null);
  assert.equal(nextReadyCard(promoteDueCards(queue, new Date('2026-10-10T00:00:59.999Z'))), null);
  queue = promoteDueCards(queue, new Date('2026-10-10T00:01:00.000Z'));
  assert.equal(nextReadyCard(queue).key, 'one');
});

test('daily allowance limits new cards and due cards stay ahead', () => {
  const cards = Array.from({length:25}, (_,i)=>({id:String(i)}));
  const due = {...progress, state:'review', dueAt:'2026-10-09T00:00:00.000Z'};
  const queue = createReviewQueue({ cards, keyFor:c=>c.id, progressByKey:new Map([['24', due]]), now, dailyNewLimit:20 });
  assert.equal(queue.ready.length, 21);
  assert.equal(queue.ready[0], '24');
});
