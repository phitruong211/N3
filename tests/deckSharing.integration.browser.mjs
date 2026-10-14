// Run against a disposable real backend: SHARING_API_ORIGIN=http://127.0.0.1:18081 node tests/deckSharing.integration.browser.mjs
// Creates isolated test accounts and data; never points to a production API by default.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const apiOrigin = process.env.SHARING_API_ORIGIN || 'http://127.0.0.1:18081';
const runId = randomUUID();
const api = async (path, { auth, method = 'GET', body, status = 200 } = {}) => {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
};
const register = name => api('/auth/register', { method: 'POST', status: 201,
  body: { email: `${randomUUID()}@sharing-integration.test`, password: `Test-${runId}`, displayName: name } });
const owner = await register('Người gửi');
const recipient = await register('Người nhận');
await api('/deck-groups', { auth: owner, method: 'POST', status: 204, body: { name: `Nhóm chia sẻ ${runId.slice(0, 8)}` } });
const [sourceGroup] = await api('/deck-groups', { auth: owner });
const createDeck = async (name, sourceType, count) => {
  const deck = await api('/decks', { auth: owner, method: 'POST', status: 201, body: {
    name, sourceType, source: sourceType, description: 'Bộ thẻ kiểm thử chia sẻ', visibility: 'PRIVATE',
    sourceRef: 'private-upload.csv', sourceSheet: 'Private sheet', tags: ['N3'], templateConfig: { version: 4 },
    cards: Array.from({ length: count }, (_, i) => ({ front: `猫 ${i}`, back: `Con mèo ${i}`, reading: 'ねこ',
      notes: `Ghi chú ${i}`, kind: 'VOCABULARY', position: i, extraData: { sourceRef: 'private-upload.csv', sourceSheet: 'Private sheet', custom: 'keep' } })),
  } });
  await api(`/decks/${deck.deck.id}/group`, { auth: owner, method: 'PUT', status: 204,
    body: { groupId: sourceGroup.id, version: deck.deck.version } });
  return deck;
};
const imported = await createDeck('Từ vựng import', 'IMPORT', 3);
await createDeck('Bộ thủ công riêng tư', 'MANUAL', 2);
await api(`/anki/cards/${imported.cards[0].id}/reviews`, { auth: owner, method: 'POST', body: { rating: 'GOOD', responseTimeMs: 100 } });
const sourceReviewed = await api(`/decks/${imported.deck.id}/cards?includeProgress=true`, { auth: owner });
assert.ok(sourceReviewed.content.find(card => card.id === imported.cards[0].id).progress);
const link = await api(`/deck-groups/${sourceGroup.id}/share`, { auth: owner, method: 'PUT' });
assert.equal(link.deckCount, 1); assert.equal(link.excludedDeckCount, 1); assert.equal(link.cardCount, 3);
const deckLink = await api(`/decks/${imported.deck.id}/share`, { auth: owner, method: 'PUT' });
const standalone = await api(`/shared-decks/${deckLink.token}/copy`, { auth: recipient, method: 'POST' });

const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.SHARING_VITE_PORT || 15176),
  strictPort: true, open: false, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const output = 'artifacts/deck-sharing';
await mkdir(output, { recursive: true });
let browser;
const errors = [];
try {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(({ accessToken, refreshToken, sessionId }) => {
    localStorage.setItem('auth:access_token', accessToken);
    localStorage.setItem('auth:refresh_token', refreshToken);
    localStorage.setItem('auth:session_id', sessionId);
  }, { accessToken: recipient.accessToken, refreshToken: recipient.refreshToken, sessionId: runId });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const scopedLoads = [];
  page.on('request', request => { if (request.url().includes(`/shared-deck-groups/${link.token}/decks/`)) scopedLoads.push(request.url()); });
  await page.goto(`${base}/shared/groups/${link.token}`);
  await page.getByRole('heading', { name: sourceGroup.name, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Xem trước bộ / }).count(), 1);
  assert.equal(await page.getByText('Bộ thủ công riêng tư', { exact: true }).count(), 0);
  assert.equal(scopedLoads.length, 0);
  await page.getByRole('button', { name: 'Xem trước bộ Từ vựng import', exact: true }).click();
  await page.getByRole('button', { name: 'Lật thẻ để xem nghĩa', exact: true }).waitFor();
  await page.getByText('Xem trước 2 / 3 thẻ', { exact: true }).waitFor();
  assert.ok(scopedLoads.every(url => url.includes(imported.deck.id)));
  const copyResponse = page.waitForResponse(response => response.url().includes(`/shared-deck-groups/${link.token}/copy`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu cả nhóm', exact: true }).click();
  const savedResponse = await copyResponse;
  assert.equal(savedResponse.status(), 200);
  const saved = await savedResponse.json();
  assert.equal(saved.alreadySaved, false); assert.equal(saved.deckIds.length, 1);
  assert.notEqual(saved.groupId, sourceGroup.id); assert.notEqual(saved.deckIds[0], imported.deck.id); assert.notEqual(saved.deckIds[0], standalone.deckId);
  const openGroup = page.getByRole('link', { name: 'Mở nhóm để học', exact: true });
  await openGroup.waitFor();
  assert.equal(await openGroup.getAttribute('href'), `/decks?group=${saved.groupId}`);
  await page.screenshot({ path: `${output}/group-real-api-saved.png`, fullPage: true });
  await openGroup.click();
  await page.waitForURL("**/decks**");
  const folder = page.locator(`#group-${saved.groupId}`);
  await folder.locator('.deck-folder-toggle[aria-expanded="true"]').waitFor();
  await folder.getByText('Từ vựng import', { exact: true }).waitFor();
  await page.screenshot({ path: `${output}/group-real-api-opened.png`, fullPage: true });
  const copied = await api(`/decks/${saved.deckIds[0]}`, { auth: recipient });
  assert.equal(copied.deck.groupId, saved.groupId);
  assert.deepEqual(copied.deck.templateConfig, imported.deck.templateConfig);
  assert.deepEqual(copied.deck.tags, imported.deck.tags);
  assert.equal(copied.cards.length, 3);
  const receivedProgress = await api(`/decks/${saved.deckIds[0]}/cards?includeProgress=true`, { auth: recipient });
  assert.ok(receivedProgress.content.every(card => card.progress === null));
  assert.equal(copied.cards[0].notes, imported.cards[0].notes);
  assert.equal(copied.cards[0].extraData.custom, 'keep');
  assert.equal(copied.deck.sourceRef, null);
  assert.equal(copied.cards[0].extraData.sourceRef, undefined);
  assert.equal(copied.cards[0].extraData.sourceSheet, undefined);
  assert.equal((await api(`/decks/${standalone.deckId}`, { auth: recipient })).deck.groupId, null);
  const retry = await api(`/shared-deck-groups/${link.token}/copy`, { auth: recipient, method: 'POST' });
  assert.equal(retry.groupId, saved.groupId); assert.equal(retry.alreadySaved, true);
  await api(`/deck-groups/${sourceGroup.id}/share`, { auth: owner, method: 'DELETE', status: 204 });
  await api(`/shared-deck-groups/${link.token}`, { status: 404 });
  await api(`/shared-deck-groups/${link.token}/decks/${imported.deck.id}`, { status: 404 });
  await page.goto(`${base}/shared/groups/${link.token}`);
  await page.getByText('Liên kết không tồn tại hoặc đã ngừng chia sẻ.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Lưu cả nhóm', exact: true }).count(), 0);
  await page.goto(`${base}/shared/${deckLink.token}`);
  await page.getByRole('heading', { name: imported.deck.name, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Lật thẻ để xem nghĩa', exact: true }).waitFor();
  const oldCopyResponse = page.waitForResponse(response => response.url().includes(`/shared-decks/${deckLink.token}/copy`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu bộ thẻ', exact: true }).click();
  assert.equal((await (await oldCopyResponse).json()).deckId, standalone.deckId);
  await page.getByRole('link', { name: 'Mở bộ để học', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS real MySQL/API/browser: IMPORT-only lazy group preview, save CTA, independent copy/template/tags/notes/progress/privacy, existing standalone untouched, idempotency, exact open-group deeplink, revoke and old single-deck links.');
} finally { await browser?.close(); await server.close(); }
