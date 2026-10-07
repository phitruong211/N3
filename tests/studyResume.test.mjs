import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtInDeckResumeKey, resolveResumeIndex } from '../src/lib/studyResume.ts';

test('built-in decks keep independent resume keys', () => {
  assert.equal(builtInDeckResumeKey('vocabN3'), 'built_in_deck_resume_vocabN3');
  assert.notEqual(builtInDeckResumeKey('vocabN3'), builtInDeckResumeKey('grammarN3'));
});

test('resume position follows the saved card id and safely handles changed decks', () => {
  const cards = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.equal(resolveResumeIndex(cards, 'two'), 1);
  assert.equal(resolveResumeIndex(cards, 'removed-card'), 0);
  assert.equal(resolveResumeIndex(cards, null), 0);
});
