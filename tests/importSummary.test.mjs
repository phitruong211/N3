import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeImport } from '../src/lib/importSummary.ts';

test('zero valid cards is an error and repeated issues are grouped', () => {
  const issues = Array.from({ length: 648 }, (_, index) => ({ row: index + 2, reason: 'Loại thẻ không hợp lệ', sheet: 'Cards' }));
  const summary = summarizeImport({ cards: [], skipped: 648, duplicates: 0, issues });
  assert.equal(summary.status, 'error');
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].count, 648);
  assert.equal(summary.groups[0].samples.length, 3);
});

test('preview returns at most three sample cards', () => {
  const cards = Array.from({ length: 10 }, (_, index) => ({ id: String(index), front: `F${index}`, back: `B${index}` }));
  assert.equal(summarizeImport({ cards, skipped: 0, duplicates: 0, issues: [] }).samples.length, 3);
});
