// Run against a disposable real backend: FORMAT_API_ORIGIN=http://127.0.0.1:18081 node tests/deckFormat.integration.browser.mjs
// Creates an isolated account; imports, studies, exports and re-imports a deck with a custom field through the real UI and API.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const apiOrigin = process.env.FORMAT_API_ORIGIN || 'http://127.0.0.1:18081';
const runId = randomUUID();
const api = async (path, { auth, method = 'GET', body, status = 200 } = {}) => {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth.accessToken}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  assert.equal(response.status, status, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : undefined;
};
const user = await api('/auth/register', { method: 'POST', status: 201, body: { email: `${randomUUID()}@format-integration.test`, password: `Test-${runId}`, displayName: 'Người thử định dạng' } });
const decks = () => api('/decks', { auth: user });
const fullDeck = async name => { const summary = (await decks()).find(deck => deck.name === name); assert.ok(summary, `deck ${name} exists`); return api(`/decks/${summary.id}`, { auth: user }); };

const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.FORMAT_VITE_PORT || 15176), strictPort: true, open: false, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  await context.addInitScript(({ accessToken, refreshToken, sessionId }) => {
    localStorage.setItem('auth:access_token', accessToken); localStorage.setItem('auth:refresh_token', refreshToken); localStorage.setItem('auth:session_id', sessionId);
  }, { accessToken: user.accessToken, refreshToken: user.refreshToken, sessionId: runId });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('response', async response => { if (response.status() >= 400 && response.url().includes('/api/v1/decks')) console.log('API', response.status(), response.url(), (await response.text()).slice(0, 300)); });
  await page.goto(`${base}/decks`);
  const fileInput = page.locator('input[aria-label="Chọn file nhập bộ thẻ"]');
  await fileInput.waitFor({ state: 'attached' });

  // 1. A CSV with a column the format does not know keeps it as a labelled custom field.
  await fileInput.setInputFiles({ name: 'ngu-vung.csv', mimeType: 'text/csv', buffer: Buffer.from('front,back,reading,Cấp độ\n勉強[べんきょう]する,học,,N4\n猫,mèo,ねこ,N5\n') });
  await page.getByText('Sẵn sàng nhập 2 thẻ').waitFor();
  assert.equal(await page.getByLabel('Trường cho Cấp độ').inputValue(), 'col4');
  // The look is chosen while importing: a bundled font and custom colors.
  const look = page.getByRole('group', { name: 'Giao diện cả bộ' });
  await look.getByLabel('Font chữ').selectOption('kleeOne');
  await look.getByLabel('Màu nền', { exact: true }).fill('#fff7e6');
  await look.getByRole('button', { name: 'Dùng màu đang hiện cho màu chữ' }).click(); // the swatch shown while unset (#1f2937)
  await page.getByRole('button', { name: 'Tạo bộ thẻ', exact: true }).click();
  await page.getByText(/Đã tạo “ngu-vung”/).waitFor();
  const created = await fullDeck('ngu-vung');
  assert.equal(created.deck.templateConfig.version, 5);
  assert.deepEqual(created.deck.templateConfig.style, { colors: { bg: '#fff7e6', fg: '#1f2937' }, font: { family: 'kleeOne' } });
  assert.deepEqual(created.deck.templateConfig.noteTypes[0].fields.at(-1), { key: 'col4', label: 'Cấp độ', type: 'ruby' });
  const first = created.cards.find(card => card.front === '勉強する');
  assert.equal(first.noteType, created.deck.templateConfig.noteTypes[0].id);
  assert.deepEqual(first.fields, { front: '勉強[べんきょう]する', back: 'học', col4: 'N4' });
  assert.equal(first.reading, 'べんきょうする');
  assert.equal(first.extraData.frontFuriganaSegments.includes('べんきょう'), true);

  // 2. Studying shows the custom field with its label.
  await page.getByRole('button', { name: 'Bắt đầu học', exact: false }).first().click();
  await page.locator('.study-session-card').first().click();
  assert.equal(await page.locator('.study-session-card').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 247, 230)');
  assert.match(await page.locator('[data-field="back"]').first().evaluate(el => getComputedStyle(el).fontFamily), /Klee One/);
  assert.match(await page.locator('.study-session-face').innerText(), /CẤP ĐỘ/i);
  assert.match(await page.locator('.study-session-face').innerText(), /N[45]/);
  await page.keyboard.press('Escape');
  await page.getByText('Bộ thẻ của bạn').first().waitFor();

  // 3. Export to .sonhat.json through the deck menu, then import that file as a new deck.
  await page.getByRole('button', { name: 'Thao tác với bộ ngu-vung' }).click();
  await page.getByRole('menuitem', { name: 'Xuất bộ thẻ' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '.sonhat.json' }).click()]);
  assert.equal(download.suggestedFilename(), 'ngu-vung.sonhat.json');
  const exportedPath = await download.path();
  const exported = JSON.parse(await readFile(exportedPath, 'utf8'));
  assert.equal(exported.format, 'sonhat.deck');
  assert.equal(exported.cards.length, 2);
  assert.deepEqual(exported.deck.style, created.deck.templateConfig.style);
  assert.deepEqual(exported.cards.map(card => card.fields.col4).sort(), ['N4', 'N5']);
  assert.equal(JSON.stringify(exported).includes(created.cards[0].id), false);
  await page.getByRole('button', { name: 'Đóng' }).first().click();
  exported.deck.name = 'ngu-vung-nhap-lai';
  await fileInput.setInputFiles({ name: 'ngu-vung.sonhat.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
  await page.getByText('Sẵn sàng nhập 2 thẻ').waitFor();
  await page.getByRole('button', { name: 'Tạo bộ thẻ', exact: true }).click();
  await page.getByText(/Đã tạo “ngu-vung-nhap-lai”/).waitFor();
  const again = await fullDeck('ngu-vung-nhap-lai');
  const byFront = deck => Object.fromEntries(deck.cards.map(card => [card.front, card.fields]));
  assert.deepEqual(byFront(again), byFront(created));
  assert.deepEqual(again.deck.templateConfig.noteTypes, created.deck.templateConfig.noteTypes);
  assert.deepEqual(again.deck.templateConfig.style, created.deck.templateConfig.style);

  // 4. Pasted Markdown is checked, then imported.
  await page.getByRole('button', { name: 'Tạo mới' }).first().click();
  await page.getByRole('menuitem', { name: 'Tạo bộ thẻ', exact: true }).click();
  await page.getByText('Hướng dẫn: định dạng tệp, prompt AI và dán nội dung').click();
  await page.getByLabel('Nội dung', { exact: true }).fill('# Bộ dán\n先生[せんせい] :: giáo viên :: せんせい\n学生 :: sinh viên');
  await page.getByRole('button', { name: 'Kiểm tra' }).click();
  await page.getByText('2 thẻ hợp lệ').waitFor();
  await page.getByRole('button', { name: 'Xem trước và nhập' }).click();
  await page.getByText('Sẵn sàng nhập 2 thẻ').waitFor();
  await page.getByRole('button', { name: 'Tạo bộ thẻ', exact: true }).click();
  await page.getByText(/Đã tạo “Bộ dán”/).waitFor();
  assert.equal((await fullDeck('Bộ dán')).cards.length, 2);

  // 5. The API refuses fields that do not belong to the deck's note types.
  const deck = await fullDeck('ngu-vung');
  // A card's own look survives the server and the study queue.
  const styled = await api(`/decks/${deck.deck.id}/cards`, { auth: user, method: 'POST', status: 201, body: { noteType: deck.cards[0].noteType, fields: { front: 'b', back: 'c', col4: 'N2' }, extraData: { style: { colors: { fg: '#ff0000' } } } } });
  assert.deepEqual(styled.extraData.style, { colors: { fg: '#ff0000' } });
  await api(`/decks/${deck.deck.id}/cards`, { auth: user, method: 'POST', status: 400, body: { noteType: deck.cards[0].noteType, fields: { front: 'b2', back: 'c2' }, extraData: { style: { colors: { fg: 'red' } } } } });

  await api(`/decks/${deck.deck.id}/cards`, { auth: user, method: 'POST', status: 400, body: { noteType: deck.cards[0].noteType, fields: { front: 'a', back: 'b', ghost: 'x' } } });
  await api(`/decks/${deck.deck.id}/cards`, { auth: user, method: 'POST', status: 201, body: { noteType: deck.cards[0].noteType, fields: { front: 'a', back: 'b', col4: 'N1' } } });
  assert.deepEqual(errors, []);
  console.log('PASS: import with a custom column and deck style, study with colors and a bundled font, export, re-import round trip, pasted Markdown, card style and API validation against the real backend.');
} finally {
  await browser.close();
  await server.close();
}
