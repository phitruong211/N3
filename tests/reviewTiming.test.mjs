import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewTimer, relativeRecallTime } from '../src/lib/reviewTiming.ts';

function clock() {
  let time = 0;
  return { advance(ms) { time += ms; }, timer: createReviewTimer(() => time, () => new Date(time).toISOString()) };
}
test('separates recall and decision and excludes hidden, blurred or paused time', () => {
  const { timer, advance } = clock();
  timer.setActive(true); advance(3000);
  timer.setActive(false); advance(90000); timer.setActive(true);
  advance(2000); timer.reveal();
  advance(400); timer.setActive(false); advance(50000); timer.setActive(true);
  advance(600);
  const result = timer.finish();
  assert.equal(result.recallTimeMs, 5000);
  assert.equal(result.decisionTimeMs, 1000);
  assert.equal(result.isTimeValid, true);
  advance(10000);
  assert.deepEqual(timer.finish(), result);
});
test('zero time and rating without reveal are invalid telemetry', () => {
  const { timer } = clock();
  timer.reveal();
  assert.equal(timer.finish().isTimeValid, false);
  assert.equal(clock().timer.finish().isTimeValid, false);
});
test('repeated reveal does not restart decision timing', () => {
  const { timer, advance } = clock();
  timer.setActive(true); advance(1000); timer.reveal(); advance(1000); timer.reveal(); advance(1000);
  assert.equal(timer.finish().decisionTimeMs, 2000);
});
test('normalization uses valid median and a caller-selected sample requirement', () => {
  assert.equal(relativeRecallTime(12000, [5000], 3), null);
  assert.deepEqual(relativeRecallTime(12000, [3000, 5000, 7000, NaN, 0], 3), {
    baselineRecallTimeMs: 5000, relativeRecallTime: 2.4, sampleCount: 3,
  });
});
test('wall clock reversal invalidates telemetry without negative elapsed durations', () => {
  let time = 0;
  let wall = 10000;
  const timer = createReviewTimer(() => time, () => new Date(wall).toISOString());
  timer.setActive(true); time = 1000; wall = 9000; timer.reveal();
  time = 2000; wall = 8000;
  assert.equal(timer.finish().isTimeValid, false);
});
