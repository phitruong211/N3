import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// The daily new-card limit must hold across sessions, and "Học thêm" must stay reachable once it is used up.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'silent' });
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addInitScript(() => {
    sessionStorage.setItem('guest:session', '1');
    if (localStorage.getItem('daily-limit-seeded')) return;
    localStorage.setItem('daily-limit-seeded', '1');
    localStorage.setItem('guest:n3_settings', JSON.stringify({ theme: 'light', autoPlayAudio: false, reducedMotion: true, srsDailyNewLimit: 3 }));
  });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  const squash = text => text.replace(/\s+/g, ' ').trim();
  const row = () => page.locator('.level-row').filter({ hasText: 'Từ vựng' }).first();
  const header = async () => squash(await page.locator('.study-session-count').innerText());
  const answer = async () => {
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /4 · Dễ/ }).waitFor();
    await page.keyboard.press('4');
    await page.waitForTimeout(350);
  };
  const exit = async () => { await page.getByRole('button', { name: 'Kết thúc phiên', exact: true }).click(); await row().waitFor(); };

  await page.goto(base + '/review');
  await row().waitFor({ timeout: 60000 });
  await page.getByRole('tab', { name: /^N5/ }).click();
  await row().click();
  await page.locator('.study-session-card').waitFor();
  assert.equal(await header(), '3 mới · 0 đến hạn · 0 đã ôn');
  await answer(); await answer();
  assert.equal(await header(), '1 mới · 0 đến hạn · 2 đã ôn');
  await exit();

  // Coming back must not hand out the whole allowance again.
  await row().click();
  await page.locator('.study-session-card').waitFor();
  assert.equal(await header(), '1 mới · 0 đến hạn · 0 đã ôn', 'the limit survives leaving the session');
  await answer();
  await page.getByText('Đã hoàn thành').waitFor();
  assert.ok(await page.getByRole('button', { name: /^Tất cả/ }).isVisible(), 'study more is offered when the limit is used up');
  await page.getByRole('button', { name: /Về danh sách/ }).click();
  await row().waitFor();

  // Limit used up, unseen cards left: the deck stays open and offers "Học thêm".
  assert.equal(await row().isDisabled(), false, 'a deck with unseen cards is not marked finished');
  assert.match(squash(await row().innerText()), /Học thêm/);
  await row().click();
  await page.getByText('Đã hoàn thành').waitFor();
  await page.getByRole('button', { name: '+10', exact: true }).click();
  await page.locator('.study-session-card').waitFor();
  // "đã ôn" counts this session only, so it starts again at 0 in the new one.
  assert.equal(await header(), '10 mới · 0 đến hạn · 0 đã ôn', 'study more adds cards for today only');
  await exit();
  assert.match(squash(await row().innerText()), /Học thêm/);
  console.log('Daily limit: holds across sessions, and study more stays reachable after it is used up.');
} finally { await browser?.close(); await server.close(); }
