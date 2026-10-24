import test from 'node:test';
import assert from 'node:assert/strict';
import { daypart, weekStamps, wordOfDay } from '../src/components/dashboard/todayData.ts';

test('greeting keeps its original cut-offs and the sky follows the hour', () => {
  const cases = [[0, 'Chào buổi sáng', 'night'], [4, 'Chào buổi sáng', 'night'], [5, 'Chào buổi sáng', 'dawn'], [10, 'Chào buổi sáng', 'dawn'],
    [11, 'Chào buổi trưa', 'day'], [13, 'Chào buổi trưa', 'day'], [14, 'Chào buổi chiều', 'day'], [16, 'Chào buổi chiều', 'day'],
    [17, 'Chào buổi chiều', 'dusk'], [19, 'Chào buổi tối', 'dusk'], [20, 'Chào buổi tối', 'night'], [23, 'Chào buổi tối', 'night']];
  for (const [hour, greeting, part] of cases) assert.deepEqual(daypart(hour), { part, greeting }, `hour ${hour}`);
});

test('week starts on Monday and marks studied days and today', () => {
  const days = [{ date: '2026-10-19', cardsReviewed: 5 }, { date: '2026-10-20', cardsReviewed: 0 }, { date: '2026-10-25', cardsReviewed: 2 }, { date: '2026-10-18', cardsReviewed: 9 }];
  const week = weekStamps(days, new Date(2026, 9, 20)); // Tuesday
  assert.deepEqual(week.map(day => day.date), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.deepEqual(week.map(day => day.studied), [true, false, false, false, false, false, true]);
  assert.deepEqual(week.map(day => day.isToday), [false, true, false, false, false, false, false]);
});

test('a Sunday still belongs to the week that began on the previous Monday', () => {
  const week = weekStamps([], new Date(2026, 9, 25));
  assert.equal(week[0].date, '2026-10-19');
  assert.equal(week[6].isToday, true);
  assert.equal(week[6].label, '日');
});

test('week crosses month and year borders', () => {
  const week = weekStamps([], new Date(2026, 0, 1)); // Thursday
  assert.equal(week[0].date, '2025-12-29');
  assert.equal(week[6].date, '2026-01-04');
});

test('word of the day is stable within a day and empty-safe', () => {
  const words = Array.from({ length: 500 }, (_, i) => i);
  assert.equal(wordOfDay([], new Date(2026, 9, 20)), null);
  assert.equal(wordOfDay(words, new Date(2026, 9, 20, 1)), wordOfDay(words, new Date(2026, 9, 20, 23)));
  const picks = new Set(Array.from({ length: 14 }, (_, i) => wordOfDay(words, new Date(2026, 9, 1 + i))));
  assert.ok(picks.size >= 10, 'neighbouring days should rarely repeat');
});
