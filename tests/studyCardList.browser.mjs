// The deck list inside a study session: open it with L, edit a card, add a card, and keep studying.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
const cards = [
  { id: 'c1', deckId: 'd', front: '猫', back: 'Con mèo', reading: 'ねこ', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: 0, noteType: 'general', fields: { front: '猫', back: 'Con mèo' } },
  { id: 'c2', deckId: 'd', front: '犬', back: 'Con chó', reading: 'いぬ', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: 1, noteType: 'general', fields: { front: '犬', back: 'Con chó' } },
  { id: 'c3', deckId: 'd', front: '鳥', back: 'Con chim', reading: 'とり', type: 'VOCABULARY', tags: [], source: 'IMPORT', position: 2, noteType: 'general', fields: { front: '鳥', back: 'Con chim' } },
];
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith('/__study-list')) return next();
  const mode = new URL(request.url, 'http://fixture').searchParams.get('mode') || 'flashcards';
  const html = await server.transformIndexHtml(request.url, `<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module">
    import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
    import {AuthProvider} from '/src/hooks/useAuth.tsx';import {AppProvider} from '/src/hooks/useApp.tsx';
    import {StudySession} from '/src/components/flashcard/StudySession.tsx';import '/src/index.css';
    localStorage.clear();sessionStorage.setItem('guest:session','1');
    window.saved=[];window.added=[];
    const view=(card,i)=>({id:card.id,deckId:'d',front:card.front,back:card.back,reading:card.reading,type:'VOCABULARY',tags:[],source:'IMPORT',position:i,noteType:card.noteType,fields:card.fields});
    const onCardChange=async card=>{window.saved.push(card);return view(card,0);};
    const onCardAdd=async card=>{window.added.push(card);return view({...card,id:'new-'+window.added.length},99);};
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(AppProvider,null,
      React.createElement(StudySession,{cards:${JSON.stringify(cards)},deckName:'Động vật',mode:'${mode}',onCardChange,onCardAdd,onExit:()=>{}})))));
  </script></body></html>`);
  response.setHeader('Content-Type', 'text/html'); response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/__study-list`;
  browser = await chromium.launch();
  for (const mode of ['flashcards', 'anki']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}?mode=${mode}`);
    await page.getByRole('region', { name: 'Phiên học thẻ' }).waitFor();

    await page.keyboard.press('l');
    const list = page.getByRole('complementary', { name: 'Danh sách thẻ trong bộ' });
    await list.waitFor();
    assert.equal(await list.locator('.study-card-list-row').count(), 3);
    assert.ok(await list.getByText('Đang học').isVisible(), 'the card on screen is marked');

    // Search narrows the list; the study keys stay quiet while typing.
    await list.getByLabel('Tìm thẻ trong bộ').fill('chim');
    assert.equal(await list.locator('.study-card-list-row').count(), 1);
    await list.getByLabel('Tìm thẻ trong bộ').fill('');

    // Edit a card in place.
    await list.getByRole('button', { name: /Sửa thẻ 犬/ }).click();
    await list.getByLabel(/^Mặt sau/).fill('Con chó nhỏ');
    await list.getByRole('button', { name: 'Lưu' }).click();
    await list.getByText(/Đã lưu/).waitFor();
    assert.equal((await page.evaluate(() => window.saved))[0].back, 'Con chó nhỏ');

    // Add a card; it joins the session list.
    await list.getByRole('button', { name: 'Thêm thẻ' }).first().click();
    await list.getByLabel(/^Mặt trước/).fill('魚');
    await list.getByLabel(/^Mặt sau/).fill('Con cá');
    await list.locator('.study-card-list-editor').getByRole('button', { name: 'Thêm thẻ' }).click();
    await list.getByText(/Đã thêm/).waitFor();
    assert.equal(await list.locator('.study-card-list-row').count(), 4);
    assert.equal((await page.evaluate(() => window.added))[0].front, '魚');

    // Paste several rows at once, as copied from a spreadsheet.
    await list.getByRole('button', { name: 'Nhập nhiều' }).click();
    await list.getByRole('textbox', { name: /Mỗi dòng một thẻ/ }).fill('馬\tCon ngựa\tうま\n牛\tCon bò\n羊\tCon cừu');
    await list.getByRole('button', { name: /Thêm \d+ thẻ/ }).waitFor();
    const label = await list.getByRole('button', { name: /Thêm \d+ thẻ/ }).textContent();
    assert.equal(label, 'Thêm 3 thẻ');
    await list.getByRole('button', { name: /Thêm \d+ thẻ/ }).click();
    await list.getByText(/Đã thêm \d+ thẻ vào phiên học/).waitFor();
    const added = await page.evaluate(() => window.added.map(card => [card.front, card.back, card.reading]));
    assert.deepEqual(added.slice(1), [['馬', 'Con ngựa', 'うま'], ['牛', 'Con bò', ''], ['羊', 'Con cừu', '']]);
    assert.equal(await list.locator('.study-card-list-row').count(), 3 + added.length);

    // Studying continues with the list open: Space still reveals the card once focus leaves the list.
    await page.locator('.study-session-card').click();
    assert.ok(await page.getByText('Đáp án').first().isVisible());

    if (mode === 'flashcards') {
      await mkdir('artifacts/study-card-list', { recursive: true });
      await page.screenshot({ path: 'artifacts/study-card-list/desktop.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'artifacts/study-card-list/mobile.png' });
    }
    await page.keyboard.press('l');
    await list.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('study card list: ok');
} finally {
  await browser?.close();
  await server.close();
}
