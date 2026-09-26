import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { currentUser, hasSession, apiRequest, login, logout, clearSession, invalidateApiSession, sessionIdentity } from '../src/lib/api.ts';

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
const data = new Map();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  invalidateApiSession();
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
  assert.equal(data.get('auth:refresh_token'), 'new-refresh');
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
    assert.equal(data.get('auth:refresh_token'), 'valid-refresh');
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

test('legacy tokens migrate once and do not overwrite namespaced tokens', () => {
  data.set('auth:refresh_token', 'preferred');
  assert.equal(hasSession(), true);
  assert.equal(data.get('auth:refresh_token'), 'preferred');
  assert.equal(data.has('n3_refresh_token'), false);
  assert.ok(sessionIdentity());
});

test('Guest cannot fetch any protected endpoint even with a supplied Authorization header', async () => {
  clearSession();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return json({}); };
  for (const path of ['/decks', '/users/me/settings', '/anki/cards/1/reviews', '/auth/me']) {
    await assert.rejects(apiRequest(path, { headers: { Authorization: 'Bearer old' } }), error => error.status === 401);
  }
  assert.equal(calls, 0);
});

test('public auth does not send an old JWT and establishes the new protected session', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push([url, init.headers.get('Authorization')]);
    return url.endsWith('/auth/login') ? json({ accessToken: 'A', refreshToken: 'R', user: { id: 'A' } }) : json([]);
  };
  assert.deepEqual(await login('a@example.com', 'password'), { id: 'A' });
  await apiRequest('/decks');
  assert.deepEqual(calls, [['/api/v1/auth/login', null], ['/api/v1/decks', 'Bearer A']]);
});

test('logout during refresh cannot restore tokens or retry the old request', async () => {
  let release;
  let started;
  const refreshing = new Promise(resolve => { started = resolve; });
  globalThis.fetch = async url => {
    if (url.endsWith('/auth/refresh')) { started(); return new Promise(resolve => { release = resolve; }); }
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return json({}, 401);
  };
  const result = assert.rejects(currentUser(), error => error.status === 401);
  await refreshing;
  await logout();
  release(json({ accessToken: 'late', refreshToken: 'late-refresh' }));
  await result;
  assert.equal(hasSession(), false);
});

test('late response from account A is rejected after another tab changes the session', async () => {
  globalThis.fetch = async () => json({ id: 'A' });
  await currentUser();
  let release;
  globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
  const result = assert.rejects(apiRequest('/decks'), error => error.status === 401);
  data.set('auth:session_id', 'account-B');
  release(json([{ id: 'private-A' }]));
  await result;
  await assert.rejects(apiRequest('/decks'), error => error.status === 401);
});

test('late error body cannot trigger a new mutation as another account', async () => {
  globalThis.fetch = async () => json({ id: 'A' });
  await currentUser();
  let release;
  let started;
  const parsing = new Promise(resolve => { started = resolve; });
  globalThis.fetch = async () => ({ status: 404, ok: false, json: () => { started(); return new Promise(resolve => { release = resolve; }); } });
  const result = assert.rejects(apiRequest('/decks/missing'), error => error.status === 401);
  await parsing;
  data.set('auth:session_id', 'account-B');
  release({ message: 'missing' });
  await result;
});

test('cancelled authentication never stores tokens, even if a response arrives late', async () => {
  clearSession();
  const controller = new AbortController();
  let release;
  globalThis.fetch = async () => new Promise(resolve => { release = resolve; });
  const result = assert.rejects(login('a@example.com', 'password', controller.signal), error => error.name === 'AbortError');
  controller.abort();
  release(json({ accessToken: 'late', refreshToken: 'late-refresh', user: { id: 'A' } }));
  await result;
  assert.equal(hasSession(), false);
});
