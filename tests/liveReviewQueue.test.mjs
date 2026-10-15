import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewQueue, nextReadyCard, applyReviewedProgress, promoteDueCards, reviewSessionSummary } from '../src/lib/liveReviewQueue.ts';

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

test('a due learning card appears after the current card while new cards remain', () => {
  const cards = [{id:'current'}, {id:'new'}, {id:'again'}];
  const queue = createReviewQueue({cards, keyFor:c=>c.id, now,
    progressByKey:new Map([['again', progress]])});
  assert.deepEqual(queue.ready, ['current', 'new']);
  // Passing the deadline must not replace the card being read.
  const ratedAt = new Date('2026-10-10T00:01:05.000Z');
  assert.equal(nextReadyCard(queue).key, 'current');
  const saved = {...progress, state:'review', dueAt:'2026-10-12T00:00:00.000Z'};
  const next = applyReviewedProgress(queue, 'current', saved, ratedAt);
  assert.deepEqual(next.ready, ['again', 'new']);
  assert.equal(nextReadyCard(next).key, 'again');
  assert.deepEqual(queue.ready, ['current', 'new']);
});

test('future review cards are reconsidered at their deadline and are not shown early', () => {
  const cards = [{id:'current'}, {id:'review'}, {id:'new'}];
  const queue = createReviewQueue({cards, keyFor:c=>c.id, now,
    progressByKey:new Map([['review', {...progress, state:'review'}]])});
  const saved = {...progress, dueAt:'2026-10-10T00:10:00.000Z'};
  const before = applyReviewedProgress(queue, 'current', saved, new Date('2026-10-10T00:00:59.999Z'));
  assert.deepEqual(before.ready, ['new']);
  const at = applyReviewedProgress(queue, 'current', saved, new Date('2026-10-10T00:01:00.000Z'));
  assert.deepEqual(at.ready, ['review', 'new']);
  assert.deepEqual(promoteDueCards(at, new Date('2026-10-10T00:01:01.000Z')).ready, at.ready);
});

test('multiple due cards retain priority and prevent premature completion after last ready card', () => {
  const queue = createReviewQueue({cards:['current','review','learning','relearning'].map(id=>({id})), keyFor:c=>c.id, now,
    progressByKey:new Map(['review','learning','relearning'].map(state=>[state,{...progress,state}]))});
  const next = applyReviewedProgress(queue, 'current', {...progress, state:'review', dueAt:'2026-10-12T00:00:00Z'},
    new Date('2026-10-10T00:02:00Z'));
  assert.deepEqual(next.ready, ['relearning','learning','review']);
  assert.equal(next.futureLearning.length, 0);
});

test('session progress counts unique cards and keeps repeated learning separate from new cards', () => {
  let queue = createReviewQueue({cards: [{id:'one'}, {id:'two'}, {id:'excluded'}], keyFor:c=>c.id, now, dailyNewLimit:2});
  assert.deepEqual(reviewSessionSummary(queue), {total:2, reviewed:0, fresh:2, due:0, waiting:0});
  queue = applyReviewedProgress(queue, 'one', progress, now);
  assert.deepEqual(reviewSessionSummary(queue), {total:2, reviewed:1, fresh:1, due:0, waiting:1});
  queue = promoteDueCards(queue, new Date('2026-10-10T00:01:00Z'));
  assert.deepEqual(reviewSessionSummary(queue), {total:2, reviewed:1, fresh:1, due:1, waiting:0});
  queue = applyReviewedProgress(queue, 'one', {...progress,repetitions:2,dueAt:'2026-10-10T00:02:00Z'}, new Date('2026-10-10T00:01:00Z'));
  assert.deepEqual(reviewSessionSummary(queue), {total:2, reviewed:1, fresh:1, due:0, waiting:1});
});
