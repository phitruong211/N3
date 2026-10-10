import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGuestSession, writeGuestSession } from '../src/lib/guestSession.ts';

test('Guest session survives recreation in the same tab', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  writeGuestSession(true, storage);
  assert.equal(readGuestSession(storage), true);
  writeGuestSession(false, storage);
  assert.equal(readGuestSession(storage), false);
});
