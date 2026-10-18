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
const tab = level => page.getByRole('tab', { name: new RegExp(`^${level}`) });
const levelReady = async level => { await tab(level).waitFor(); await tab(level).click(); await page.getByRole('button', { name: new RegExp(`^Từ vựng ${level},`) }).waitFor(); };

try {
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Học thử', exact: true }).click();
  for (const route of ['/decks', '/review']) {
    await page.goto(`${baseURL}${route}`);
    await levelReady('N5');
    for (const [name, count] of decks) {
      await page.getByRole('button', { name: new RegExp(`^${name}, ${count} thẻ`) }).click();
      const session = page.getByRole('region', { name: 'Phiên học thẻ' });
      await session.waitFor();
      await session.getByRole('button', { name: 'Hiện đáp án', exact: true }).first().click();
      if (route === '/review') {
        await session.getByRole('button', { name: /3 · Tốt/ }).click();
        await page.waitForFunction(() => Object.keys(localStorage).some(key =>
          key.startsWith('guest:srs_cards_') && JSON.parse(localStorage.getItem(key)).some(card => card.cardId.startsWith('grammarN5') || card.cardId.startsWith('kanjiN5') || card.cardId.startsWith('vocabN5'))));
      }
      await page.keyboard.press('Escape');
      await levelReady('N5');
    }
    if (route === '/decks') {
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('guest:srs_cards_'))
        .flatMap(key => JSON.parse(localStorage.getItem(key))).length), 0, 'Free study must not change the review schedule');
    }
  }
  await page.reload();
  await tab('N5').waitFor();
  const progress = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('guest:srs_cards_'))
    .flatMap(key => JSON.parse(localStorage.getItem(key))));
  assert.equal(progress.filter(card => /^(vocab|kanji|grammar)N5-/.test(card.cardId)).length, 3);
  // One level at a time: switching shows that level's decks, the choice is remembered, and the tablist is keyboard-operable.
  await page.goto(`${baseURL}/decks`);
  await levelReady('N5');
  await tab('N4').click();
  await page.getByRole('button', { name: /^Từ vựng N4, 603 thẻ/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Từ vựng N5,/ }).count(), 0);
  assert.equal(await tab('N4').getAttribute('aria-selected'), 'true');
  await page.reload();
  await page.getByRole('button', { name: /^Từ vựng N4,/ }).waitFor();
  assert.equal(await tab('N4').getAttribute('aria-selected'), 'true');
  await tab('N4').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tab('N3').getAttribute('aria-selected'), 'true');
  assert.equal(await tab('N3').evaluate(el => el === document.activeElement), true);
  assert.equal(await tab('N4').getAttribute('tabindex'), '-1');
  await page.keyboard.press('Home');
  assert.equal(await tab('N5').getAttribute('aria-selected'), 'true');
  assert.deepEqual(errors, []);
  console.log('PASS: all three shared N5 decks open in free and scheduled modes; review progress survives reload; free study leaves scheduling unchanged; level tabs switch, remember and work by keyboard.');
} finally {
  await browser.close();
}
