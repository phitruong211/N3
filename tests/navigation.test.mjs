import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageForLocation, pathForPage, resolveInitialPath } from '../src/lib/navigation.ts';

test('legacy page ids map to canonical routes', () => {
  assert.equal(pathForPage('dashboard'), '/today');
  assert.equal(pathForPage('flashcards'), '/decks');
  assert.equal(pathForPage('anki'), '/review');
  assert.equal(pathForPage('srs'), '/review');
  assert.equal(pageForLocation('/decks', '?mode=scheduled'), 'flashcards');
  assert.equal(pageForLocation('/review'), 'srs');
});

test('library routes retain their content page ids', () => {
  assert.equal(pageForLocation('/library/vocabulary'), 'vocabulary');
  assert.equal(pageForLocation('/library/grammar'), 'grammar');
  assert.equal(pageForLocation('/library/kanji'), 'kanji');
  assert.equal(pageForLocation('/library/listening'), 'listening');
});

test('the URL wins and root migrates the stored page', () => {
  assert.equal(resolveInitialPath('/library/kanji', 'dashboard'), '/library/kanji');
  assert.equal(resolveInitialPath('/', 'anki'), '/review');
  assert.equal(resolveInitialPath('/', '/progress'), '/progress');
  assert.equal(resolveInitialPath('/', 'unknown'), '/today');
});
