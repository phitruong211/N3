import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFreeStudy } from '../src/lib/studyMetrics.ts';

test('free study never creates accuracy or learned-card counts', () => {
  const summary = summarizeFreeStudy(new Set(['a', 'b']), 20, 3.2);
  assert.deepEqual(summary, { viewed: 2, total: 20, minutes: 3.2 });
  assert.equal('accuracy' in summary, false);
  assert.equal('newCardsLearned' in summary, false);
});
