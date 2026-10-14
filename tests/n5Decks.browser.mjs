// Run against the local Vite app. Uses a fresh Guest browser context.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const baseURL = process.env.N5_TEST_URL || 'http://127.0.0.1:5173';
const decks = [['Từ vựng N5', '601'], ['Kanji N5', '314'], ['Ngữ pháp N5', '107']];

try {
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Học thử', exact: true }).click();
  for (const route of ['/decks', '/review']) {
    await page.goto(`${baseURL}${route}`);
    await page.getByRole('heading', { name: 'Trình độ N5' }).waitFor();
    for (const [name, count] of decks) {
      const deck = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
      assert.equal(await deck.locator('strong').first().innerText(), count);
      await deck.getByRole('button', { name: route === '/decks' ? 'Bắt đầu học →' : 'Ôn ngay →' }).click();
      const session = page.getByRole('region', { name: 'Phiên học thẻ' });
      await session.waitFor();
      await session.getByRole('button', { name: 'Hiện đáp án', exact: true }).first().click();
      if (route === '/review') {
        await session.getByRole('button', { name: /3 · Được/ }).click();
        await page.waitForFunction(() => Object.keys(localStorage).some(key =>
          key.startsWith('guest:srs_cards_') && JSON.parse(localStorage.getItem(key)).some(card => card.cardId.startsWith('grammarN5') || card.cardId.startsWith('kanjiN5') || card.cardId.startsWith('vocabN5'))));
      }
      await page.keyboard.press('Escape');
      await page.getByRole('heading', { name: 'Trình độ N5' }).waitFor();
    }
    if (route === '/decks') {
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('guest:srs_cards_'))
        .flatMap(key => JSON.parse(localStorage.getItem(key))).length), 0, 'Free study must not change the review schedule');
    }
  }
  await page.reload();
  await page.getByRole('heading', { name: 'Trình độ N5' }).waitFor();
  const progress = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('guest:srs_cards_'))
    .flatMap(key => JSON.parse(localStorage.getItem(key))));
  assert.equal(progress.filter(card => /^(vocab|kanji|grammar)N5-/.test(card.cardId)).length, 3);
  assert.deepEqual(errors, []);
  console.log('PASS: all three shared N5 decks open in free and scheduled modes; review progress survives reload; free study leaves scheduling unchanged.');
} finally {
  await browser.close();
}
