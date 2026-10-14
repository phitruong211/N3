// Local UI verification with account APIs mocked; never touches production data.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.CARD_NOTES_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const errors = []; const notes = new Map(); let offline = false;
async function context(owner) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  if (owner) await ctx.addInitScript(id => {
    localStorage.setItem('auth:access_token', id); localStorage.setItem('auth:refresh_token', `refresh-${id}`); localStorage.setItem('auth:session_id', `session-${id}`);
  }, owner);
  await ctx.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (!owner) throw Error(`Guest must not call account API: ${path}`);
    if (path === '/auth/me') return reply({ id: owner, email: `${owner}@test.local`, displayName: owner });
    if (path === '/users/me/learning') return reply({ revision: 0, bookmarks: [], srsCards: [], studyDays: [] });
    if (path === '/users/me/settings') return reply({ theme: 'light', fontSize: 'medium', reducedMotion: true });
    if (path === '/deck-groups') return reply([]);
    if (path === '/decks') return reply({ content: [], totalPages: 0, totalElements: 0 });
    if (path.startsWith('/card-notes/')) {
      if (offline) return route.abort('failed');
      const key = path.split('/').at(-1); const mapKey = `${owner}:${key}`;
      const current = notes.get(mapKey) || { key, text: '', version: 0, updatedAt: null };
      if (route.request().method() === 'GET') return reply(current);
      const body = route.request().postDataJSON();
      if (body.version !== current.version && body.text !== current.text) return reply({ message: 'Ghi chú đã thay đổi trên thiết bị khác.' }, 409);
      const next = { key, text: body.text, version: current.version + 1, updatedAt: new Date().toISOString() };
      notes.set(mapKey, next); return reply(next);
    }
    throw Error(`Unexpected API ${path}`);
  });
  return ctx;
}
async function pageFor(ctx, route = '/decks', guest = false) {
  const page = await ctx.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}${route}`);
  if (guest) { await page.getByRole('button', { name: 'Học thử', exact: true }).click(); await page.goto(`${base}${route}`); }
  await openDeck(page, route); return page;
}
async function openDeck(page, route = '/decks') {
  const deck = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Từ vựng N5', exact: true }) });
  await deck.getByRole('button', { name: route === '/decks' ? 'Bắt đầu học →' : 'Ôn ngay →' }).click();
  await page.getByRole('button', { name: 'Ghi chú cá nhân' }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[aria-label="Ghi chú cá nhân"]').disabled);
}
async function edit(page, text, save = true) {
  await page.getByRole('button', { name: 'Ghi chú cá nhân' }).click();
  await page.getByLabel('Ghi chú cá nhân', { exact: true }).filter({ hasNot: page.locator('svg') }).fill(text);
  if (save) await page.getByRole('button', { name: 'Lưu ghi chú' }).click();
}
async function flip(page) { await page.getByRole('button', { name: 'Hiện đáp án', exact: true }).first().click(); }
try {
  const guest = await context(); const gp = await pageFor(guest, '/decks', true);
  await gp.keyboard.press('n');
  await gp.getByLabel('Ghi chú cá nhân', { exact: true }).filter({ hasNot: gp.locator('svg') }).fill('Nháp chưa lưu');
  await gp.keyboard.press('Escape');
  assert.equal(await gp.getByRole('region', { name: 'Phiên học thẻ' }).count(), 1);
  await gp.getByRole('button', { name: 'Ghi chú cá nhân' }).click();
  assert.equal(await gp.locator('textarea').inputValue(), 'Nháp chưa lưu');
  await gp.locator('textarea').fill('Ghi chú riêng của tôi\nDễ nhầm với từ khác');
  await gp.locator('textarea').press('Control+Enter');
  assert.equal(await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).count(), 0);
  await flip(gp);
  assert.match(await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).innerText(), /Ghi chú riêng của tôi/);
  assert.ok((await gp.locator('body').innerText()).includes('Phổ biến, trung tính'), 'Original note remains visible');
  await gp.keyboard.press('ArrowRight');
  await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).waitFor({ state: 'hidden' });
  assert.equal(await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).count(), 0);
  await gp.keyboard.press('ArrowLeft');
  await gp.reload(); await openDeck(gp); await flip(gp);
  assert.match(await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).innerText(), /Ghi chú riêng của tôi/);
  await gp.getByRole('button', { name: 'Ghi chú cá nhân' }).click();
  await mkdir('artifacts/card-notes', { recursive: true });
  await gp.screenshot({ path: 'artifacts/card-notes/desktop.png' });
  await gp.getByRole('button', { name: 'Đóng ghi chú' }).click();
  await gp.goto(`${base}/review`); await openDeck(gp, '/review'); await flip(gp);
  assert.match(await gp.getByRole('complementary', { name: 'Ghi chú của tôi' }).innerText(), /Ghi chú riêng của tôi/);
  await gp.setViewportSize({ width: 390, height: 844 });
  await gp.getByRole('button', { name: 'Ghi chú cá nhân' }).click();
  await mkdir('artifacts/card-notes', { recursive: true }); await gp.screenshot({ path: 'artifacts/card-notes/mobile.png' });
  assert.equal(await gp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await gp.setViewportSize({ width: 390, height: 480 });
  await gp.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Lưu ghi chú'));
    const rect = button?.getBoundingClientRect(); return rect && rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  await gp.screenshot({ path: 'artifacts/card-notes/mobile-compact.png' });
  await gp.getByRole('button', { name: 'Đóng ghi chú' }).click();
  const a1 = await context('A'); const p1 = await pageFor(a1);
  await edit(p1, 'Bản A'); await p1.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'saved' && note.text === 'Bản A'));
  const a2 = await context('A'); const p2 = await pageFor(a2); await flip(p2);
  await p2.getByRole('complementary', { name: 'Ghi chú của tôi' }).getByText('Bản A', { exact: true }).waitFor();
  await edit(p2, 'Bản thiết bị 2', false);
  await edit(p1, 'Thiết bị 1 đã sửa');
  await p1.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'saved' && note.text === 'Thiết bị 1 đã sửa'));
  await p2.getByRole('button', { name: 'Lưu ghi chú' }).click();
  await p2.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'conflict'));
  if (!await p2.getByRole('dialog').isVisible()) await p2.getByRole('button', { name: 'Xem hai bản' }).click();
  await p2.getByRole('button', { name: 'Giữ bản của tôi' }).waitFor();
  assert.ok((await p2.getByRole('dialog').innerText()).includes('Thiết bị 1 đã sửa'));
  await p2.getByRole('button', { name: 'Giữ bản của tôi' }).click();
  await p2.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'saved' && note.text === 'Bản thiết bị 2'));
  offline = true; await edit(p2, 'Chờ mạng');
  await p2.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'error' && note.text === 'Chờ mạng'));
  await p2.reload(); await openDeck(p2); await flip(p2);
  assert.match(await p2.getByRole('complementary', { name: 'Ghi chú của tôi' }).innerText(), /Chờ mạng/);
  offline = false; await p2.evaluate(() => window.dispatchEvent(new Event('online')));
  await p2.waitForFunction(() => Object.values(JSON.parse(localStorage.getItem('user:A:card_notes_v1') || '{}')).some(note => note.status === 'saved' && note.text === 'Chờ mạng'));
  const b = await context('B'); const bp = await pageFor(b); await flip(bp);
  assert.equal(await bp.getByRole('complementary', { name: 'Ghi chú của tôi' }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: draft recovery, keyboard shortcuts, source note preservation, card isolation, reload, shared free/review notes, mobile, two devices, conflict, offline retry and account isolation.');
} finally { await browser.close(); }
