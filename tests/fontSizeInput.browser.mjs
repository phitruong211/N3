import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
server.middlewares.use(async (req, res, next) => {
  if (req.url !== '/__font-size__') return next();
  const html = await server.transformIndexHtml(req.url, `<html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {DeckCustomizeDialog} from '/src/components/flashcard/CardPresentation.tsx';
    import {defaultDeckTemplate} from '/src/lib/ankiImport.ts'; import '/src/index.css';
    createRoot(document.getElementById('root')).render(React.createElement(DeckCustomizeDialog, {
      deck:{name:'Test',template:defaultDeckTemplate(),cards:[]},busy:false,onCancel:()=>{},
      onSave:template=>window.savedTemplate=template
    }));
  </script></body></html>`);
  res.setHeader('Content-Type', 'text/html'); res.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__font-size__`);
  const input = page.getByRole('spinbutton', { name: 'Cỡ chữ chính xác mặt trước' });
  await input.fill('');
  assert.equal(await input.inputValue(), '');
  await input.pressSequentially('3');
  assert.equal(await input.inputValue(), '3');
  await input.pressSequentially('6');
  assert.equal(await input.inputValue(), '36');
  await input.press('Enter');
  assert.equal(await input.inputValue(), '36');
  await input.fill('9'); await input.press('Tab');
  assert.equal(await input.inputValue(), '12');
  await input.fill('100'); await input.press('Enter');
  assert.equal(await input.inputValue(), '72');
  await input.fill(''); await input.press('Tab');
  assert.equal(await input.inputValue(), '72');
  await input.fill('24');
  await page.getByRole('button', { name: 'Lưu tùy chỉnh', exact: true }).click();
  assert.equal(await page.evaluate(() => window.savedTemplate.front.style.fontSize), 24);
  await page.getByRole('button', { name: 'Tăng cỡ chữ', exact: true }).click();
  assert.equal(await input.inputValue(), '25');
  console.log('Font size: free typing, empty draft, Enter/blur limits, save and increment passed.');
} finally { await browser?.close(); await server.close(); }
