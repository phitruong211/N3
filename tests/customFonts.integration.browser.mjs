// Run against a disposable real backend: FORMAT_API_ORIGIN=http://127.0.0.1:18081 node tests/customFonts.integration.browser.mjs
// Uploads fonts through the UI, uses one on a deck, shares the deck and deletes the font; uses throwaway accounts.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const apiOrigin = process.env.FORMAT_API_ORIGIN || 'http://127.0.0.1:18081';
const runId = randomUUID();
const api = async (path, { auth, method = 'GET', body, status = 200 } = {}) => {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, { method, headers: { ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
};
const register = name => api('/auth/register', { method: 'POST', status: 201, body: { email: `${randomUUID()}@fonts-integration.test`, password: `Test-${runId}`, displayName: name } });
const owner = await register('Chủ font');
const recipient = await register('Người nhận');
const woff2 = await readFile(new URL('../node_modules/@fontsource/lexend/files/lexend-latin-400-normal.woff2', import.meta.url));
const ttf = await readFile(new URL('../node_modules/playwright-core/lib/vite/dashboard/assets/codicon-DCmgc-ay.ttf', import.meta.url));

const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.FORMAT_VITE_PORT || 15176), strictPort: true, open: false, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(({ accessToken, refreshToken, sessionId }) => {
    localStorage.setItem('auth:access_token', accessToken); localStorage.setItem('auth:refresh_token', refreshToken); localStorage.setItem('auth:session_id', sessionId);
  }, { accessToken: owner.accessToken, refreshToken: owner.refreshToken, sessionId: runId });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/decks`);
  await page.locator('input[aria-label="Chọn file nhập bộ thẻ"]').setInputFiles({ name: 'chu.csv', mimeType: 'text/csv', buffer: Buffer.from('front,back\n勉強,học\n') });
  await page.getByText('Sẵn sàng nhập 1 thẻ').waitFor();

  // 1. Upload a .woff2 and a .ttf through the font manager; refuse a file that is not a font.
  await page.getByRole('button', { name: 'Font của bạn: tải lên và quản lý' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Font của bạn' });
  await dialog.getByText('Chưa có font nào.').waitFor();
  await dialog.getByLabel('Chọn tệp font').setInputFiles({ name: 'fake.ttf', mimeType: 'font/ttf', buffer: Buffer.from('chỉ là chữ'.repeat(100)) });
  await dialog.getByLabel('Tôi có quyền sử dụng font này', { exact: false }).check();
  await dialog.getByRole('button', { name: /^Tải lên/ }).click();
  await dialog.getByRole('alert').filter({ hasText: /font|tệp/i }).first().waitFor();
  assert.equal((await api('/fonts', { auth: owner })).fonts.length, 0);
  await dialog.getByLabel('Chọn tệp font').setInputFiles({ name: 'icons.ttf', mimeType: 'font/ttf', buffer: ttf });
  await dialog.getByLabel('Tôi có quyền sử dụng font này', { exact: false }).check();
  await dialog.getByRole('button', { name: /^Tải lên/ }).click();
  await dialog.getByRole('list', { name: 'Danh sách font của bạn' }).getByText('icons', { exact: true }).waitFor();
  assert.equal((await api('/fonts', { auth: owner })).fonts[0].name, 'icons');
  await dialog.getByLabel('Chọn tệp font').setInputFiles({ name: 'Lexend Latin.woff2', mimeType: 'font/woff2', buffer: woff2 });
  await dialog.getByLabel('Tên hiển thị').fill('Lexend riêng');
  await dialog.getByLabel('Tôi có quyền sử dụng font này', { exact: false }).check();
  await dialog.getByRole('button', { name: /^Tải lên/ }).click();
  await dialog.getByRole('list', { name: 'Danh sách font của bạn' }).getByText('Lexend riêng').waitFor();
  const fonts = (await api('/fonts', { auth: owner })).fonts;
  assert.deepEqual(fonts.map(font => font.format).sort(), ['ttf', 'woff2']);
  const lexend = fonts.find(font => font.name === 'Lexend riêng');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  // 2. The uploaded font was selected for the deck on upload; create the deck with it.
  const select = page.getByRole('group', { name: 'Giao diện cả bộ' }).getByLabel('Font chữ');
  assert.equal(await select.inputValue(), `custom:${lexend.id}`);
  await page.getByRole('button', { name: 'Tạo bộ thẻ', exact: true }).click();
  await page.getByText(/Đã tạo “chu”/).waitFor();
  const deck = (await api('/decks', { auth: owner })).find(item => item.name === 'chu');
  assert.deepEqual(deck.templateConfig.style, { font: { family: `custom:${lexend.id}` } });

  // 3. Studying loads the font from the account and draws with it.
  await page.getByRole('button', { name: 'Bắt đầu học', exact: false }).first().click();
  const family = `sonhat-${lexend.id}`;
  await page.locator('[data-field="front"]').first().waitFor();
  assert.match(await page.locator('[data-field="front"]').first().evaluate(el => getComputedStyle(el).fontFamily), new RegExp(family));
  await page.waitForFunction(name => [...document.fonts].some(face => face.family.replaceAll('"', '') === name && face.status === 'loaded'), family);

  // 4. Sharing leaves the font behind: the recipient's copy names no uploaded font and cannot read the file.
  const link = await api(`/decks/${deck.id}/share`, { auth: owner, method: 'PUT' });
  const saved = await api(`/shared-decks/${link.token}/copy`, { auth: recipient, method: 'POST' });
  const copy = await api(`/decks/${saved.deckId}`, { auth: recipient });
  assert.equal(JSON.stringify(copy.deck.templateConfig).includes('custom:'), false);
  assert.equal((await fetch(`${apiOrigin}/api/v1/fonts/${lexend.id}/file`, { headers: { Authorization: `Bearer ${recipient.accessToken}` } })).status, 404);

  // 5. Deleting the font leaves the deck readable with the fallback font.
  await page.keyboard.press('Escape');
  await api(`/fonts/${lexend.id}`, { auth: owner, method: 'DELETE', status: 204 });
  await page.reload();
  await page.getByRole('button', { name: 'Bắt đầu học', exact: false }).first().click();
  await page.locator('[data-field="front"]').first().waitFor();
  assert.equal(await page.evaluate(name => [...document.fonts].some(face => face.family.replaceAll('"', '') === name && face.status === 'loaded'), family), false);
  assert.match(await page.locator('[data-field="front"]').first().evaluate(el => getComputedStyle(el).fontFamily), /Be Vietnam Pro/);

  // 6. The real server refuses an oversized upload with 413 before reading it all.
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(6 * 1024 * 1024)]), 'huge.ttf');
  const big = await fetch(`${apiOrigin}/api/v1/fonts`, { method: 'POST', headers: { Authorization: `Bearer ${owner.accessToken}` }, body: form });
  assert.equal(big.status, 413);
  assert.match((await big.json()).message, /5 MB/);
  assert.deepEqual(errors, []);
  console.log('PASS: upload .woff2/.ttf, reject non-fonts, use on a deck, font stays private when shared, deleted font falls back, oversize refused.');
} finally {
  await browser.close();
  await server.close();
}
