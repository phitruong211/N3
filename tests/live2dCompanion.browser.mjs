// Run with Vite running: LIVE2D_TEST_URL=http://127.0.0.1:5174 npm run test:live2d
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.LIVE2D_TEST_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: true });

async function openDashboard(reducedMotion) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(`${baseURL}/today`);
  const trial = page.getByRole('button', { name: 'Học thử' });
  if (await trial.isVisible().catch(() => false)) await trial.click();
  await page.getByRole('heading', { name: /Chào buổi/ }).waitFor();
  return { context, page, pageErrors };
}

try {
  const enabled = await openDashboard(false);
  await enabled.page.locator('.dashboard-live2d-slot.is-ready').waitFor({ timeout: 10_000 });
  const canvas = enabled.page.locator('.dashboard-live2d-host canvas');
  await canvas.hover();
  await canvas.dispatchEvent('pointerdown', { clientX: 20, clientY: 20 });
  await enabled.page.waitForTimeout(250);
  const resources = await enabled.page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert.ok(resources.some(url => url.includes('/vendor/live2d/live2dcubismcore.min.js')));
  assert.ok(resources.some(url => url.includes('/models/haru/Haru.model3.json')));
  assert.deepEqual(enabled.pageErrors, []);
  await enabled.context.close();

  const reduced = await openDashboard(true);
  await reduced.page.waitForTimeout(1_200);
  const reducedResources = await reduced.page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
  assert.equal(reducedResources.some(url => url.includes('/vendor/live2d/live2dcubismcore.min.js')), false);
  assert.equal(reducedResources.some(url => url.includes('/models/haru/Haru.model3.json')), false);
  assert.deepEqual(reduced.pageErrors, []);
  await reduced.context.close();
  console.log('Live2D companion: lazy runtime, interaction and reduced-motion fallback passed.');
} finally {
  await browser.close();
}
