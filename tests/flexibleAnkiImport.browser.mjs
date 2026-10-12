import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith("/__flexible-import-test__")) return next();
  const html = await server.transformIndexHtml(request.url, `<html><body><div id="root"></div><script type="module">
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import ImportPreviewEditor from '/src/components/flashcard/ImportPreviewEditor.tsx';
    import {parseTextImport} from '/src/lib/ankiImport.ts';
    import '/src/index.css';
    const source=JSON.stringify([{Question:'丘[おか]',Meaning:'Đồi',Sentence:'丘[おか]の上[うえ]'}]);
    function Fixture(){const [preview,setPreview]=useState(()=>parseTextImport(source,'natural-fields.json')); window.preview=preview; return React.createElement('main',{className:'mx-auto max-w-5xl p-6'},React.createElement(ImportPreviewEditor,{preview,onChange:setPreview}));}
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));
  </script></body></html>`);
  response.setHeader("Content-Type", "text/html"); response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__flexible-import-test__`);
  assert.equal(await page.getByLabel("Vị trí cho Question").inputValue(), "front");
  assert.equal(await page.getByLabel("Vị trí cho Meaning").inputValue(), "back");
  assert.equal(await page.getByLabel("Vị trí cho Sentence").inputValue(), "back");
  await page.getByLabel("Vị trí cho Sentence").selectOption("front");
  await page.getByRole("button", { name: "Đưa Sentence lên" }).click();
  const front = page.getByText("1 · MẶT TRƯỚC").locator("..");
  assert.deepEqual(await front.locator("section p").allTextContents(), ["Sentence", "Question"]);
  assert.deepEqual(await front.locator("ruby rt").allTextContents(), ["おか", "うえ", "おか"]);
  assert.deepEqual(await page.evaluate(() => JSON.parse(window.preview.cards[0].extraData.importFieldLayout).fields.filter(field => field.destination === 'front').sort((a,b) => a.order-b.order).map(field => field.label)), ["Sentence", "Question"]);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS: flexible source fields map, reorder and render with independent furigana.");
} finally {
  await browser?.close();
  await server.close();
}
