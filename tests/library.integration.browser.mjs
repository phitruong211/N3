// Run against a disposable real backend: FORMAT_API_ORIGIN=http://127.0.0.1:18081 node tests/library.integration.browser.mjs
// Share code, QR, publishing, browsing as a guest, saving by code, reporting and revoking, through the real UI and API.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
const register = name => api('/auth/register', { method: 'POST', status: 201, body: { email: `${randomUUID()}@library-integration.test`, password: `Test-${runId}`, displayName: name } });
const owner = await register('Cô Hương');
const viewer = await register('Bạn Minh');
const title = `Từ vựng ${runId.slice(0, 6)}`;
await api('/decks', { auth: owner, method: 'POST', status: 201, body: { name: title, sourceType: 'IMPORT', source: 'IMPORT', visibility: 'PRIVATE', templateConfig: { version: 4 },
  cards: Array.from({ length: 4 }, (_, i) => ({ front: `猫 ${i}`, back: `Mèo ${i}`, reading: 'ねこ', kind: 'VOCABULARY', position: i, extraData: {} })) } });

const server = await createServer({ server: { host: '127.0.0.1', port: Number(process.env.FORMAT_VITE_PORT || 15176), strictPort: true, open: false, proxy: { '/api': { target: apiOrigin, changeOrigin: true } } } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
const signedIn = async (account, id) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addInitScript(({ accessToken, refreshToken, sessionId }) => { localStorage.setItem('auth:access_token', accessToken); localStorage.setItem('auth:refresh_token', refreshToken); localStorage.setItem('auth:session_id', sessionId); }, { accessToken: account.accessToken, refreshToken: account.refreshToken, sessionId: id });
  return context;
};
try {
  const errors = [];
  const ownerContext = await signedIn(owner, `${runId}-o`);
  const page = await ownerContext.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/decks`);

  // 1. Share the deck: link, short code and QR.
  await page.getByRole('button', { name: `Thao tác với bộ ${title}` }).click();
  await page.getByRole('menuitem', { name: 'Chia sẻ bộ thẻ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chia sẻ bộ thẻ' });
  await dialog.getByRole('button', { name: 'Tạo liên kết' }).click();
  const code = (await dialog.locator('section[aria-label="Mã chia sẻ"] p.font-mono').textContent()).trim();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  await dialog.getByRole('button', { name: 'Hiện QR' }).click();
  const qr = dialog.getByRole('img', { name: new RegExp(`Mã QR mở ${title}`) });
  await qr.waitFor();
  assert.ok((await qr.evaluate(img => img.naturalWidth)) > 50, 'the QR image decodes');
  assert.match(await dialog.getByText(`/s/${code.replace('-', '')}`).textContent(), /\/s\/[A-Z2-9]{8}/);

  // 2. Short expiry, then publish to the library (which clears expiry).
  await dialog.getByText('Tùy chọn chia sẻ', { exact: true }).click();
  await dialog.getByLabel('Thời hạn liên kết và mã').selectOption('7');
  await dialog.getByRole('button', { name: 'Lưu tùy chọn chia sẻ' }).click();
  await dialog.getByText(/Hết hạn lúc/).waitFor();
  await dialog.getByText('Thư viện cộng đồng', { exact: true }).click();
  await dialog.getByLabel('Cấp độ').selectOption('N3');
  await dialog.getByLabel(/^Mô tả/).fill('Từ vựng chủ đề động vật, kèm cách đọc.');
  await dialog.getByRole('button', { name: 'Đăng lên thư viện' }).click();
  await dialog.getByText('Bộ thẻ đã có trong thư viện cộng đồng.').waitFor();
  assert.equal(await dialog.getByText(/Hết hạn lúc/).count(), 0, 'a published deck does not expire');
  assert.equal((await api(`/decks`, { auth: owner })).find(d => d.name === title).visibility, 'PUBLIC');
  await page.keyboard.press('Escape');

  // 3. A guest browses the library, filters, and opens the deck.
  const guest = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  guest.on('pageerror', error => errors.push(error.message));
  await guest.goto(`${base}/explore`);
  await guest.getByRole('heading', { name: title }).waitFor();
  assert.match(await guest.getByRole('status').filter({ hasText: 'bộ thẻ' }).first().textContent(), /bộ thẻ/);
  await guest.getByLabel('Tìm bộ thẻ').fill('cô hương');
  await guest.getByRole('button', { name: 'Tìm', exact: true }).click();
  await guest.getByRole('heading', { name: title }).waitFor();
  await guest.getByLabel('Tìm bộ thẻ').fill('không có gì khớp');
  await guest.getByRole('button', { name: 'Tìm', exact: true }).click();
  await guest.getByText('Chưa có bộ thẻ phù hợp.').waitFor();
  await guest.getByLabel('Tìm bộ thẻ').fill('');
  await guest.getByRole('button', { name: 'Tìm', exact: true }).click();
  await guest.getByRole('button', { name: 'N1' }).click();
  await guest.getByText('Chưa có bộ thẻ phù hợp.').waitFor();
  await guest.getByRole('button', { name: 'N3' }).click();
  await guest.getByRole('heading', { name: title }).click();
  await guest.getByRole('heading', { name: title, level: 1 }).waitFor();
  // Reporting asks a guest to sign in instead of failing.
  await guest.getByRole('button', { name: 'Báo cáo bộ thẻ này' }).click();
  await guest.getByRole('dialog').waitFor();
  await guest.close();

  // 4. A signed-in viewer enters the typed code, saves the deck, and reports it.
  const viewerContext = await signedIn(viewer, `${runId}-v`);
  const person = await viewerContext.newPage();
  person.on('pageerror', error => errors.push(error.message));
  await person.goto(`${base}/decks`);
  await person.getByRole('button', { name: 'Tạo mới' }).first().click();
  await person.getByRole('menuitem', { name: 'Nhập mã chia sẻ' }).click();
  const enter = person.getByRole('dialog', { name: 'Nhập mã chia sẻ' });
  await enter.getByLabel('Mã chia sẻ').fill('zzzz-zzzz');
  await enter.getByRole('button', { name: 'Mở bộ thẻ' }).click();
  await enter.getByRole('alert').waitFor();
  await enter.getByLabel('Mã chia sẻ').fill(code.toLowerCase().replace('-', ' '));
  await enter.getByRole('button', { name: 'Mở bộ thẻ' }).click();
  await person.getByRole('heading', { name: title, level: 1 }).waitFor();
  await person.getByRole('button', { name: 'Lưu bộ thẻ' }).click();
  await person.getByText('Đã lưu vào thư viện').waitFor();
  const listed = await (await fetch(`${apiOrigin}/api/v1/library`)).json();
  assert.equal(listed.items.find(item => item.name === title).downloads, 1);
  await person.getByRole('button', { name: 'Báo cáo bộ thẻ này' }).click();
  const report = person.getByRole('dialog', { name: 'Báo cáo bộ thẻ' });
  await report.getByRole('radio', { name: 'Spam hoặc quảng cáo' }).check();
  await report.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await report.getByText(/Cảm ơn bạn/).waitFor();
  await report.getByText('Đóng', { exact: true }).click();
  await person.getByRole('button', { name: 'Báo cáo bộ thẻ này' }).click();
  await person.getByRole('dialog', { name: 'Báo cáo bộ thẻ' }).getByRole('button', { name: 'Gửi báo cáo' }).click();
  await person.getByRole('alert').filter({ hasText: 'đã báo cáo' }).waitFor();
  await person.keyboard.press('Escape');
  // The short link a QR code carries opens the same page.
  await person.goto(`${base}/s/${code.replace('-', '')}`);
  await person.getByRole('heading', { name: title, level: 1 }).waitFor();

  // 5. Revoking kills the link, the code and the listing.
  const token = (await api('/decks', { auth: owner })).find(d => d.name === title).id;
  await api(`/decks/${token}/share`, { auth: owner, method: 'DELETE', status: 204 });
  assert.equal((await (await fetch(`${apiOrigin}/api/v1/library`)).json()).items.some(item => item.name === title), false);
  await person.goto(`${base}/s/${code.replace('-', '')}`);
  await person.getByRole('heading', { name: 'Liên kết không còn khả dụng' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: share code and QR, expiry, publish, guest browsing and filters, enter code, save, report once, short link, revoke removes everything.');
} finally {
  await browser.close();
  await server.close();
}
