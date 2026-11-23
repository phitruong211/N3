// Font sizes on a card: one shared size for a whole side, and a different size for one word or one line.
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
  // A phone: the size controls are meant to work with a thumb and an on-screen keyboard.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('region', { name: 'Phiên học thẻ' }).waitFor();
  await page.getByRole('button', { name: 'Thêm tùy chọn' }).click();
  await page.getByRole('menuitem', { name: 'Giao diện thẻ' }).click();
  const designer = page.getByRole('dialog', { name: 'Động vật' });
  await designer.waitFor();
  const frontSize = () => designer.locator('.card-designer-card [data-field="front"]').evaluate(el => getComputedStyle(el).fontSize);

  // Short words are auto-enlarged by default, so 猫 is not at the side's own size yet.
  const before = await frontSize();

  // One size for the whole front: every card, whatever its length, shows at exactly that size.
  await designer.getByRole('tab', { name: 'Bố cục & trường' }).click();
  const sizeInput = designer.getByLabel('Cùng một cỡ chữ cho mọi chữ mặt trước');
  await sizeInput.fill('40');
  await designer.getByRole('button', { name: 'Đồng bộ cỡ chữ mặt trước' }).click();
  assert.equal(await frontSize(), '40px', `was ${before}`);
  await designer.getByRole('button', { name: 'Thẻ sau ›' }).click();
  assert.equal(await frontSize(), '40px');
  await designer.getByText('Mọi trường ở mặt trước đang cùng cỡ 40px').waitFor();
  await mkdir('artifacts/card-font-size', { recursive: true });
  await sizeInput.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/card-font-size/shared-size.png' });

  // One word bigger: select it, tap "Rất lớn"; the field keeps focus and the size is relative to the 40px.
  await designer.getByRole('button', { name: '‹ Thẻ trước' }).click();
  await designer.getByRole('tab', { name: 'Thẻ này' }).click();
  const front = designer.getByRole('textbox', { name: /^Mặt trước/ });
  await front.fill('猫が好き');
  await front.evaluate(el => el.setSelectionRange(0, 1));
  await designer.getByRole('button', { name: 'Rất lớn' }).click();
  assert.equal(await front.inputValue(), '<span style="font-size:2em">猫</span>が好き');
  assert.equal(await front.evaluate(el => el === document.activeElement), true);
  assert.equal(await designer.locator('.card-designer-card [data-field="front"] span[style*="font-size"]').evaluate(el => getComputedStyle(el).fontSize), '80px');
  await page.screenshot({ path: 'artifacts/card-font-size/one-word.png' });
  // Again on the same word replaces the size instead of stacking it; a caret alone resets the whole line.
  await front.evaluate(el => { const at = el.value.indexOf('猫'); el.setSelectionRange(at, at + 1); });
  await designer.getByRole('button', { name: 'Nhỏ', exact: true }).click();
  assert.equal(await front.inputValue(), '<span style="font-size:0.75em">猫</span>が好き');
  await front.evaluate(el => el.setSelectionRange(el.value.length, el.value.length));
  await designer.getByRole('button', { name: 'Cỡ thường' }).click();
  assert.equal(await front.inputValue(), '猫が好き');
  await front.evaluate(el => el.setSelectionRange(0, 1));
  await designer.getByRole('button', { name: 'Lớn', exact: true }).click();

  await designer.getByRole('button', { name: 'Lưu thiết kế' }).click();
  await designer.waitFor({ state: 'detached' });
  const [config] = await page.evaluate(() => window.saved);
  const vocab = config.noteTypes.find(type => type.id === 'vocab');
  for (const key of ['front', 'frontReading']) assert.equal(vocab.fields.find(field => field.key === key).style.font.size, 40);
  assert.equal(vocab.front.style.autoFit, false);
  const [card] = await page.evaluate(() => window.cardSaves);
  assert.equal(card.front, '<span style="font-size:1.5em">猫</span>が好き');

  assert.deepEqual(errors, []);
  console.log('card font size: ok');
} finally {
  await browser?.close();
  await server.close();
}
