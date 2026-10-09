// Exercises the real study screen with local fixtures; no backend or account is used.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const server = await createServer({
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'study-fixture', enforce: 'pre',
    load(id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/hooks/useApp.tsx')) return;
      return `
        const settings = {showFuriganaFront:true,showFuriganaBack:true,autoPlayAudio:false,ankiSessionMinutes:0,reducedMotion:true};
        const learningSync = {flush:async()=>{}};
        const recordStudyActivity = ()=>{};
        export const useApp = ()=>({settings,srsCards:[],updateSRSCard:()=>{},learningSync});
        export const useLearningStorage = ()=>({recordStudyActivity,getJSON:(key,fallback)=>JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback)),setJSON:(key,value)=>localStorage.setItem(key,JSON.stringify(value))});
      `;
    },
  }],
});
const cards = [1, 2].map(index => ({
  id: `example-${index}`, deckId: 'fixture', front: `きっかけ ${index}`,
  back: 'cớ / lý do / động lực', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: index,
  extraData: { examples: JSON.stringify([{ japanese: '日本語を勉強します。', reading: 'にほんごをべんきょうします。', meaning: 'Tôi học tiếng Nhật.' }]) },
}));
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith('/__example-test__')) return next();
  const builtin = request.url.includes('builtin=1');
  const html = await server.transformIndexHtml(request.url, `
    <html><body><div id="root"></div><script type="module">
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {StudySession} from '/src/components/flashcard/StudySession.tsx';
      import '/src/index.css';
      createRoot(document.getElementById('root')).render(React.createElement(StudySession, {
        cards: ${JSON.stringify(cards.map(card => ({ ...card, source: builtin ? 'BUILT_IN' : card.source })))}, deckName:'Fixture', mode:'flashcards', onExit:()=>{}, onTemplateChange:${builtin ? 'undefined' : 'async config=>{window.savedTemplate=config;}'}
      }));
    </script></body></html>`);
  response.setHeader('Content-Type', 'text/html');
  response.end(html);
});
// Register the fixture before Vite's SPA fallback serves the application index.
server.middlewares.stack.unshift(server.middlewares.stack.pop());
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__example-test__`);
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  const translation = page.getByText('Tôi học tiếng Nhật.', { exact: true });
  const show = () => page.getByRole('button', { name: 'Hiện nghĩa ví dụ 1', exact: true });
  const hide = () => page.getByRole('button', { name: 'Ẩn nghĩa ví dụ 1', exact: true });
  assert.equal(await translation.count(), 0);
  await show().click();
  await translation.waitFor({ state: 'visible' });
  assert.equal(await page.getByRole('button', { name: 'Đã hiện đáp án', exact: true }).count(), 1);
  await hide().click();
  assert.equal(await translation.count(), 0);
  await show().focus();
  await show().press('Enter');
  await translation.waitFor({ state: 'visible' });
  await hide().press('Space');
  assert.equal(await translation.count(), 0);
  await show().tap();
  await translation.waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Thẻ tiếp', exact: true }).click();
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  await show().waitFor();
  assert.equal(await translation.count(), 0);
  await page.getByRole('button', { name: 'Tùy chỉnh thẻ', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tùy chỉnh bộ thẻ' }).waitFor();
  await page.getByRole('dialog', { name: 'Tùy chỉnh bộ thẻ' }).getByLabel('Cách đọc', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Lưu tùy chỉnh', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tùy chỉnh bộ thẻ' }).waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => window.savedTemplate.front.fields), ['front']);
  assert.equal(await page.getByRole('button', { name: 'Đã hiện đáp án', exact: true }).count(), 1);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__example-test__?builtin=1`);
  await page.getByRole('button', { name: 'Tùy chỉnh thẻ', exact: true }).click();
  await page.getByRole('tab', { name: 'Mặt sau', exact: true }).click();
  await page.getByLabel(/Cỡ chữ nhanh mặt sau/).selectOption('small');
  await page.getByLabel('Hiện ví dụ', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Lưu tùy chỉnh', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tùy chỉnh bộ thẻ' }).waitFor({ state: 'detached' });
  await page.reload();
  await page.getByRole('button', { name: 'Tùy chỉnh thẻ', exact: true }).click();
  await page.getByRole('tab', { name: 'Mặt sau', exact: true }).click();
  assert.equal(await page.getByLabel(/Cỡ chữ nhanh mặt sau/).inputValue(), 'small');
  assert.equal(await page.getByLabel('Hiện ví dụ', { exact: true }).isChecked(), false);
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  assert.equal(await show().count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: translation controls, imported template save, built-in customization persistence and example visibility.');
} finally {
  await browser?.close();
  await server.close();
}
