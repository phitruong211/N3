// Run with Vite running: npm run test:companion
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.COMPANION_TEST_URL || 'http://127.0.0.1:5173';

async function enterDashboard(page) {
  await page.goto(baseURL);
  const trial = page.getByRole('button', { name: 'Học thử', exact: true });
  if (await trial.count()) await trial.click();
  await page.getByRole('heading', { name: /Chào buổi/ }).waitFor();
}

async function assertCompanionDisabled(context, label) {
  const page = await context.newPage();
  await enterDashboard(page);
  await page.waitForTimeout(1_000);
  assert.equal(await page.locator('.dashboard-header-companion canvas').count(), 0, `${label}: canvas must stay disabled`);
  assert.equal(await page.locator('.dashboard-header-seal').count(), 1, `${label}: fallback seal must remain`);
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert.equal(resources.some(name => /CatCompanion|three/i.test(name)), false, `${label}: lazy chunks must not load`);
}

const browser = await chromium.launch();
try {
  const normal = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  const page = await normal.newPage();
  const errors = [];
  const warnings = [];
  const memoryLeaks = [];
  const missingModelResponses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (/\/models\/black-cat\/cat_blink\.glb(?:\?|$)/.test(response.url()) && response.status() >= 400) missingModelResponses.push(response.status());
  });
  page.on('console', message => {
    if (message.type() === 'warning') warnings.push(message.text());
    if (/released resources before renderer disposal/i.test(message.text())) memoryLeaks.push(message.text());
  });
  await enterDashboard(page);
  const companion = page.locator('.dashboard-header-companion');
  await companion.waitFor();
  await companion.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await companion.locator('canvas').waitFor({ state: 'visible', timeout: 8_000 });
  await page.locator('.dashboard-header-companion.is-ready').waitFor({ timeout: 15_000 });
  assert.equal(await page.getByRole('button', { name: 'Tùy chỉnh mèo', exact: true }).count(), 0);
  assert.equal(await page.locator('.cat-config-gui').count(), 0);
  assert.ok(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/models/black-cat/cat_blink.glb'))));
  await page.screenshot({ path: '/tmp/n3-black-cat-dashboard.png' });
  assert.deepEqual(missingModelResponses, []);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('n3-cat-companion-greeting-seen')), '1');

  // The app-level reduced-motion class must stop and unmount an already running renderer.
  await page.evaluate(() => document.documentElement.classList.add('reduced-motion'));
  await companion.locator('canvas').waitFor({ state: 'detached' });
  assert.equal(await companion.locator('.dashboard-header-seal').isVisible(), true);
  await page.evaluate(() => document.documentElement.classList.remove('reduced-motion'));
  await companion.locator('canvas').waitFor({ state: 'visible', timeout: 8_000 });

  await page.mouse.move(120, 160);
  await page.waitForTimeout(150);
  await companion.locator('canvas').click({ position: { x: 130, y: 120 } });
  await companion.locator('.dashboard-cat-bubble.is-visible').waitFor();
  assert.ok((await companion.locator('.dashboard-cat-bubble').textContent())?.trim());
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(warnings.some(message => /too many active webgl contexts/i.test(message)), false);

  // Re-enter the dashboard repeatedly to exercise StrictMode cleanup and context disposal.
  for (let index = 0; index < 10; index += 1) {
    await page.getByRole('navigation', { name: 'Các trang học' }).getByRole('button', { name: 'Thư viện', exact: true }).click();
    await page.getByRole('navigation', { name: 'Các trang học' }).getByRole('button', { name: 'Hôm nay', exact: true }).click();
    await page.getByRole('heading', { name: /Chào buổi/ }).waitFor();
    await page.locator('.dashboard-header-companion.is-ready').waitFor({ timeout: 8_000 });
  }
  assert.ok(await page.locator('.dashboard-header-companion canvas').count() <= 1);
  assert.equal(await page.locator('.cat-config-gui').count(), 0);
  assert.equal(warnings.some(message => /too many active webgl contexts/i.test(message)), false);
  assert.deepEqual(memoryLeaks, []);
  await page.getByRole('button', { name: 'Học tự do', exact: true }).click();
  await page.getByRole('heading', { name: 'Bộ thẻ', exact: true }).waitFor();
  await normal.close();

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await assertCompanionDisabled(reduced, 'reduced motion');
  await reduced.close();

  const saveData = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  await saveData.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true, effectiveType: '4g' } });
  });
  await assertCompanionDisabled(saveData, 'save data');
  await saveData.close();

  const withoutWebGl = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });
  await withoutWebGl.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...options) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...options);
    };
  });
  await assertCompanionDisabled(withoutWebGl, 'WebGL unavailable');
  await withoutWebGl.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const mobilePage = await mobile.newPage();
  await enterDashboard(mobilePage);
  await mobilePage.locator('.dashboard-header-companion.is-ready').waitFor({ timeout: 15_000 });
  assert.equal(await mobilePage.locator('.dashboard-header-companion canvas').isVisible(), true);
  assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobilePage.getByRole('button', { name: 'Chạm để chào Kuro', exact: true }).press('Enter');
  await mobilePage.locator('.dashboard-cat-bubble.is-visible').waitFor();
  await mobilePage.screenshot({ path: '/tmp/n3-black-cat-mobile.png' });
  assert.equal(await mobilePage.getByRole('heading', { name: /Chào buổi/ }).isVisible(), true);
  await mobile.close();
} finally {
  await browser.close();
}
