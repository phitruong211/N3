// After a kana game: "Luyện lại N chữ này" opens a drill that asks only the characters just missed.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/library/kana?guest=1`);
  await page.getByRole('button', { name: 'Trò chơi' }).click();
  // Kana rain with nobody typing: three characters land and the game ends.
  await page.locator('article', { hasText: 'Mưa chữ' }).getByRole('button', { name: 'Chơi' }).click();
  await page.getByText('Kết thúc').waitFor({ timeout: 90000 });
  const missed = await page.locator('button[aria-label*="đọc là"] .font-jp-serif').allTextContents();
  assert.ok(missed.length > 0);
  await page.getByRole('button', { name: `Luyện lại ${missed.length} chữ này` }).click();

  const drill = page.locator('section[aria-label="Trắc nghiệm"]');
  for (let i = 0; i < 6; i++) {
    const ch = await drill.locator('.font-jp-serif').first().textContent();
    assert.ok(missed.includes(ch), `${ch} was not missed`);
    assert.equal(await drill.locator('.grid button').count(), 4);
    await page.keyboard.press('1');
    const next = page.getByRole('button', { name: 'Tiếp tục' });
    if (await next.isVisible().catch(() => false)) await next.click(); else await page.waitForTimeout(900);
  }
  assert.deepEqual(errors, []);
  console.log(`kana drill: ok (${missed.join(' ')})`);
} finally {
  await browser?.close();
  await server.close();
}
