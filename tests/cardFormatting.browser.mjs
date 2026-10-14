import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';

const sample = JSON.parse(await readFile(new URL('../public/data/import-formatting-sample.json', import.meta.url), 'utf8'));
sample[0].back += '<img src="https://invalid.example/tracker" onerror="window.compromised=true"><script>window.compromised=true</script><style>body{display:none}</style><span style="position:fixed;color:expression(alert(1))" onclick="window.compromised=true">safe</span><p>&lt;b&gt;literal&lt;/b&gt;</p>';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
server.middlewares.use(async (req, res, next) => {
  if (!req.url?.startsWith('/__formatting')) return next();
  const html = await server.transformIndexHtml(req.url, `<html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {CardFace} from '/src/components/flashcard/CardPresentation.tsx';
    import {parseTextImport,defaultDeckTemplate} from '/src/lib/ankiImport.ts';
    import '/src/index.css';
    const cards=parseTextImport(${JSON.stringify(JSON.stringify(sample)).replaceAll('<', '\\u003c')},'sample.json').cards;
    createRoot(document.getElementById('root')).render(React.createElement('main', {style:{padding:16}}, ...cards.flatMap((card,i)=>['front','back'].map(side=>React.createElement('section',{id:side+i,key:side+i},React.createElement(CardFace,{card,deckName:'Sample',fields:[side,'reading'],template:defaultDeckTemplate(),side})))), React.createElement('section',{id:'hidden'},React.createElement(CardFace,{card:cards[1],deckName:'Sample',fields:['front'],template:defaultDeckTemplate(),side:'front'}))));
  </script></body></html>`);
  res.setHeader('Content-Type', 'text/html'); res.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__formatting`);
  await page.locator('#back0 strong').first().waitFor();
  assert.equal(await page.locator('#back0 strong').first().evaluate(el => getComputedStyle(el).color), 'rgb(96, 165, 250)');
  assert.equal(await page.locator('#front0 b').evaluate(el => getComputedStyle(el).fontWeight), '700');
  assert.equal(await page.locator('#back0 span[style*="padding-left"]').first().evaluate(el => getComputedStyle(el).paddingLeft), '24px');
  assert.equal(await page.locator('#back1 span[style*="font-weight"]').evaluate(el => getComputedStyle(el).fontWeight), '300');
  assert.equal(await page.locator('#back0 li').count(), 2);
  assert.equal(await page.locator('#front1 rt').textContent(), 'がっこう');
  assert.equal(await page.locator('#hidden rt').count(), 0);
  assert.equal(await page.locator('main script, main style, main img, main [onclick]').count(), 0);
  assert.equal(await page.evaluate(() => window.compromised), undefined);
  assert.ok((await page.locator('#back0').textContent()).includes('<b>literal</b>'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  await mkdir('artifacts/card-notes', { recursive: true });
  await page.screenshot({ path: 'artifacts/card-notes/import-formatting-mobile.png', fullPage: true });
  console.log('Formatted import: typography, indentation, ruby, mobile layout and active-content filtering passed.');
} finally { await browser?.close(); await server.close(); }
