// The card designer from a study session: pick a preset, see the real card change, edit the layout, save.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
const cards = [
  { id: 'c1', deckId: 'd', front: '猫', back: 'Con mèo', reading: 'ねこ', hanViet: 'MIÊU', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: 0, noteType: 'vocab', fields: { front: '猫', frontReading: 'ねこ', back: 'Con mèo', hanViet: 'MIÊU' } },
  { id: 'c2', deckId: 'd', front: '犬', back: 'Con chó', reading: 'いぬ', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: 1, noteType: 'vocab', fields: { front: '犬', frontReading: 'いぬ', back: 'Con chó' } },
];
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith('/__designer')) return next();
  const html = await server.transformIndexHtml(request.url, `<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module">
    import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
    import {AuthProvider} from '/src/hooks/useAuth.tsx';import {AppProvider} from '/src/hooks/useApp.tsx';
    import {StudySession} from '/src/components/flashcard/StudySession.tsx';import {builtinNoteTypes} from '/src/lib/deckFormat.ts';import '/src/index.css';
    localStorage.clear();sessionStorage.setItem('guest:session','1');
    window.saved=[];window.cardSaves=[];
    const config={version:5,noteTypes:builtinNoteTypes()};
    const view=c=>({id:c.id,deckId:'d',front:c.front,back:c.back,reading:c.reading,type:'VOCABULARY',tags:[],source:'IMPORT',position:0,noteType:c.noteType,fields:c.fields,style:c.style});
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(AppProvider,null,
      React.createElement(StudySession,{cards:${JSON.stringify(cards)},deckName:'Động vật',mode:'flashcards',config,
        onConfigChange:async c=>{window.saved.push(c);},onCardChange:async c=>{window.cardSaves.push(c);return view(c);},onCardAdd:async c=>view(c),onExit:()=>{}})))));
  </script></body></html>`);
  response.setHeader('Content-Type', 'text/html'); response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/__designer`;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('region', { name: 'Phiên học thẻ' }).waitFor();

  await page.getByRole('button', { name: 'Thêm tùy chọn' }).click();
  await page.getByRole('menuitem', { name: 'Giao diện thẻ' }).click();
  const designer = page.getByRole('dialog', { name: 'Động vật' });
  await designer.waitFor();
  const preview = designer.locator('.card-designer-card');
  assert.match(await preview.innerText(), /猫/);

  // A preset changes the real card at once.
  await designer.getByRole('button', { name: /Thư pháp/ }).click();
  assert.equal(await preview.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(244, 236, 218)');
  assert.equal(await designer.getByRole('button', { name: /Thư pháp/ }).getAttribute('aria-pressed'), 'true');

  // Flip, page through the deck, open the layout tab with the note type editor.
  await designer.getByRole('tab', { name: 'Mặt sau' }).click();
  assert.match(await preview.innerText(), /Con mèo/);
  await designer.getByRole('button', { name: 'Thẻ sau ›' }).click();
  assert.match(await preview.innerText(), /Con chó/);
  await designer.getByRole('tab', { name: 'Bố cục & trường' }).click();
  await designer.getByRole('button', { name: 'Thêm trường' }).waitFor();

  // This card's own look.
  await designer.getByRole('tab', { name: 'Thẻ này' }).click();
  await mkdir('artifacts/card-designer', { recursive: true });
  await designer.getByRole('tab', { name: 'Mẫu' }).click();
  await page.screenshot({ path: 'artifacts/card-designer/desktop.png' });

  await designer.getByRole('button', { name: 'Lưu thiết kế' }).click();
  await designer.waitFor({ state: 'detached' });
  const saved = await page.evaluate(() => window.saved);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].style.font.family, 'shipporiMincho');
  // The session card now wears the saved look.
  assert.equal(await page.locator('.study-session-card').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(244, 236, 218)');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Thêm tùy chọn' }).click();
  await page.getByRole('menuitem', { name: 'Giao diện thẻ' }).click();
  await designer.waitFor();
  await page.screenshot({ path: 'artifacts/card-designer/mobile.png' });
  await designer.getByRole('button', { name: 'Hủy' }).click();

  assert.deepEqual(errors, []);
  console.log('card designer: ok');
} finally {
  await browser?.close();
  await server.close();
}
