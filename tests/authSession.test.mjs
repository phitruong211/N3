import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { currentUser, hasSession } from '../src/lib/api.ts';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const data = new Map();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  data.clear();
  data.set('n3_access_token', 'expired');
  data.set('n3_refresh_token', 'valid-refresh');
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
});
afterEach(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });

test('reopening with an expired access token refreshes and restores the user', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(url);
    if (url.endsWith('/auth/refresh')) return json({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    return init.headers.get('Authorization') === 'Bearer new-access'
      ? json({ id: 'learner' }) : json({}, 401);
  };
  assert.deepEqual(await currentUser(), { id: 'learner' });
  assert.deepEqual(calls, ['/api/v1/auth/me', '/api/v1/auth/refresh', '/api/v1/auth/me']);
  assert.equal(data.get('n3_refresh_token'), 'new-refresh');
});

for (const failure of ['offline', 'server']) {
  test(`temporary ${failure} failure preserves the saved session`, async () => {
    globalThis.fetch = async url => {
      if (url.endsWith('/auth/me')) return json({}, 401);
      if (failure === 'offline') throw new TypeError('Network unavailable');
      return json({}, 503);
    };
    await assert.rejects(currentUser());
    assert.equal(hasSession(), true);
    assert.equal(data.get('n3_refresh_token'), 'valid-refresh');
  });
}

test('expired or revoked refresh token clears the session without retry loops', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}, 401); };
  await assert.rejects(currentUser(), error => error.status === 401);
  assert.equal(hasSession(), false);
  assert.equal(calls, 2);
});

test('concurrent restore requests share one refresh request', async () => {
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return json({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    }
    return init.headers.get('Authorization') === 'Bearer new-access' ? json({ id: 'learner' }) : json({}, 401);
  };
  await Promise.all([currentUser(), currentUser()]);
  assert.equal(refreshes, 1);
});
