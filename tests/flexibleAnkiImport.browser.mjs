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
  // Question -> front, Meaning -> back, Sentence has no standard field so it becomes a custom field kept on the back.
  assert.equal(await page.getByLabel("Trường cho Question").inputValue(), "front");
  assert.equal(await page.getByLabel("Trường cho Meaning").inputValue(), "back");
  assert.equal(await page.getByLabel("Trường cho Sentence").inputValue(), "col3");
  const back = page.getByText("MẶT SAU", { exact: true }).locator("..");
  assert.deepEqual(await back.locator("section p").allTextContents(), ["Sentence"]);
  assert.deepEqual(await back.locator("ruby rt").allTextContents(), ["おか", "うえ"]);
  // Moving the column to another field takes it off the back and the card keeps working.
  await page.getByLabel("Trường cho Sentence").selectOption("notes");
  assert.equal(await back.locator("section p").count(), 0);
  assert.equal(await page.evaluate(() => window.preview.cards[0].notes), "丘[おか]の上[うえ]");
  // The note type editor adds a field and the column can be pointed at it.
  await page.getByRole("button", { name: "Chỉnh loại thẻ" }).click();
  await page.getByRole("button", { name: "Thêm trường" }).click();
  await page.getByLabel("Tên trường field9").fill("Câu ví dụ");
  await page.getByLabel("Trường cho Sentence").selectOption("field9");
  assert.deepEqual(await back.locator("section p").allTextContents(), ["Câu ví dụ"]);
  assert.deepEqual(await page.evaluate(() => window.preview.cards[0].fields), { front: "丘[おか]", back: "Đồi", field9: "丘[おか]の上[うえ]" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS: columns map to note type fields, extra columns stay as labelled custom fields, and the note type editor adds fields.");
} finally {
  await browser?.close();
  await server.close();
}
