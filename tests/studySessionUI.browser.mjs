import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
const cards = [
  {id:'kanji-1',deckId:'ui-fixture',front:'日本',back:'Nhật Bản',reading:'にほん',hanViet:'NHẬT BẢN',type:'KANJI',tags:[],source:'BUILT_IN',position:0,
    extraData:{examples:JSON.stringify([{japanese:'日本に行きます。',reading:'にほんにいきます。',meaning:'Tôi đến Nhật Bản.'}]),kanjiVocabulary:JSON.stringify([{word:'日本語',reading:'にほんご',meaning:'Tiếng Nhật'}])},note:'日本語 にほんご — Tiếng Nhật'},
  {id:'kanji-2',deckId:'ui-fixture',front:'学校',back:'Trường học',reading:'がっこう',type:'KANJI',tags:[],source:'BUILT_IN',position:1},
  {id:'kanji-3',deckId:'ui-fixture',front:'先生',back:'Giáo viên',reading:'せんせい',type:'KANJI',tags:[],source:'BUILT_IN',position:2},
];
server.middlewares.use(async (request,response,next) => {
  if (!request.url?.startsWith('/__study-ui')) return next();
  const params = new URL(request.url,'http://fixture').searchParams;
  const mode = params.get('mode') || 'anki';
  const theme = params.get('card') || 'system';
  const appTheme = params.get('theme') || 'light';
  const html = await server.transformIndexHtml(request.url, `<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module">
    import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
    import {AuthProvider} from '/src/hooks/useAuth.tsx';import {AppProvider} from '/src/hooks/useApp.tsx';
    import {DeckCard} from '/src/components/flashcard/DeckCard.tsx';import {StudySession} from '/src/components/flashcard/StudySession.tsx';import {defaultDeckTemplate} from '/src/lib/ankiImport.ts';import '/src/index.css';
    localStorage.clear();sessionStorage.setItem('guest:session','1');
    localStorage.setItem('guest:n3_settings',JSON.stringify({theme:'${appTheme}',autoPlayAudio:false,reducedMotion:false}));
    const template=defaultDeckTemplate();template.front.style.theme=template.back.style.theme='${theme}';
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(AppProvider,null,'${mode}' === 'decks' ? React.createElement('div',{style:{padding:32,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:16}},...['Kanji N4','Từ vựng N4','Ngữ pháp N4'].map((name,i)=>React.createElement(DeckCard,{summary:{name,totalCards:120+i*40,newCount:24,dueCount:12},badge:{label:['Kanji','Từ vựng','Ngữ pháp'][i],tone:'kanji'},primaryLabel:'Học ngay →',onPrimary:()=>{window.deckOpened=true;},metrics:[{label:'Cần ôn',value:12},{label:'Mới',value:24}]}))) : React.createElement(StudySession,{cards:${JSON.stringify(cards)},deckName:'Kanji N4',mode:'${mode}',template,onExit:()=>{window.sessionExited=true;}})))));
  </script></body></html>`);
  response.setHeader('Content-Type','text/html');response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());
const luminance = rgb => {
  const values=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
};
let browser;
try {
  await server.listen();
  const base=`http://127.0.0.1:${server.httpServer.address().port}/__study-ui`;
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await mkdir('artifacts/study-session-ui',{recursive:true});
  const card=()=>page.locator('.study-session-card');
  const reveal=()=>card();
  for (const query of ['', '?theme=dark','?theme=reading','?card=dark','?card=blue']) {
    await page.goto(base+query);await card().waitFor();await page.evaluate(()=>document.fonts.ready);
    const colors=await page.locator('.study-session-card rt').first().evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.study-session-card')).backgroundColor,size:parseFloat(getComputedStyle(el).fontSize)}));
    const [a,b]=[luminance(colors.fg),luminance(colors.bg)].sort((a,b)=>b-a);
    assert.ok((a+.05)/(b+.05)>=4.5,`furigana contrast ${query}: ${(a+.05)/(b+.05)}`);
    assert.ok(colors.size>=14);
  }
  await page.goto(base);await card().waitFor();await page.evaluate(()=>document.fonts.ready);
  // The session clock survives card changes and excludes hidden-tab time.
  await page.waitForTimeout(1150);
  const beforeHidden = await page.locator('.study-clock-digits').textContent();
  assert.notEqual(beforeHidden, '0:00');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('.study-clock-digits').textContent(), beforeHidden);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Toàn màn hình', exact: true }).click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.locator('.study-session[data-fullscreen="true"]').waitFor();
  await page.screenshot({path:'artifacts/study-session-ui/fullscreen-question.png'});
  await page.getByRole('button', { name: 'Thu nhỏ màn hình', exact: true }).click();
  await page.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuemax'),'3');
  const surface = await card().boundingBox();
  assert.ok(surface.width >= 1100 && surface.height >= 650, JSON.stringify(surface));
  assert.equal(await page.locator('.study-session-reveal').count(),0);
  await page.screenshot({path:'artifacts/study-session-ui/desktop-question.png'});

  await page.screenshot({path:'artifacts/study-session-ui/desktop-question.png'});
  await card().focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:/3 · Tốt/}).waitFor();
  await page.getByRole('button',{name:'Hiện nghĩa ví dụ 1',exact:true}).click();
  await page.getByText('Tôi đến Nhật Bản.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/3 · Tốt/}).count(),1,'example buttons do not flip the card');
  await page.screenshot({path:'artifacts/study-session-ui/desktop-answer.png'});
  // Native keyboard activation must reveal once, without also rating or skipping.
  await page.getByRole('button',{name:'Tùy chỉnh thẻ',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  const font=page.getByLabel('Font chữ',{exact:true});
  await font.selectOption('notoSansJp');
  await page.getByRole('button',{name:'Áp dụng kiểu này cho cả hai mặt',exact:true}).click();
  await page.getByRole('button',{name:/Lưu/}).last().click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:/2 · Khó/}).focus();
  await page.keyboard.press('1');
  await page.locator('.study-session-card ruby').filter({hasText:'学校'}).first().waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'1');

  await card().focus();await page.keyboard.press('Space');await page.getByRole('button',{name:/3 · Tốt/}).waitFor();
  assert.ok(await page.locator('.study-session-face').evaluate(el=>getComputedStyle(el.firstElementChild.querySelector('[style*="font-family"]')).fontFamily.includes('Noto Sans JP')));
  await page.keyboard.press('3');await page.locator('.study-session-card ruby').filter({hasText:'先生'}).first().waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  // Two separate Space presses reveal then rate Good; holding Space cannot rate twice.
  await page.goto(base);await card().waitFor();await card().focus();
  await page.keyboard.press('Space');await page.getByRole('button',{name:/3 · Tốt/}).waitFor();
  await page.keyboard.down('Space');
  await page.locator('.study-session-card ruby').filter({hasText:'学校'}).first().waitFor();
  await page.keyboard.down('Space');await page.keyboard.up('Space');
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'1');
  assert.equal(await page.getByRole('button',{name:/3 · Tốt/}).count(),0);
  // Undo restores the previous answer, queue and daily counters, then permits a new rating.
  const day = () => page.evaluate(() => JSON.parse(localStorage.getItem('guest:n3_study_days') || '[]')[0]);
  const beforeUndoDay = await day();
  const logs = () => page.evaluate(() => JSON.parse(localStorage.getItem('guest:guest_review_logs') || '[]'));
  await page.keyboard.press('Backspace');
  await page.locator('.study-session-card ruby').filter({hasText:'日本'}).first().waitFor();
  await page.getByRole('button',{name:/3 · Tốt/}).waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  assert.equal((await logs()).length,0);
  assert.equal((await day()).cardsReviewed,0);
  assert.equal((await day()).newCardsLearned,0);
  assert.equal((await day()).timeSpent,beforeUndoDay.timeSpent);
  assert.equal(await page.getByRole('button',{name:'Quay lại lượt vừa trả lời (Backspace)',exact:true}).isDisabled(),true);
  await page.keyboard.press('1');
  await page.locator('.study-session-card ruby').filter({hasText:'学校'}).first().waitFor();
  assert.equal((await logs()).length,1);
  await page.keyboard.press('Backspace');
  await page.getByRole('button',{name:/4 · Dễ/}).waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
  assert.equal((await logs()).length,0);
  for (let i=0;i<3;i++) {
    if (i) { await card().focus();await page.keyboard.press('Space'); }
    await page.getByRole('button',{name:/4 · Dễ/}).click();
  }
  await page.getByRole('heading',{name:'Đã hoàn thành',exact:true}).waitFor();
  await page.getByText(/3 thẻ · 3 lượt trả lời · 100%/).waitFor();
  assert.equal((await logs()).length,3);
  await page.keyboard.press('Backspace');
  await card().getByText('Giáo viên',{exact:true}).waitFor();
  await page.getByRole('button',{name:/4 · Dễ/}).waitFor();
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  assert.equal((await logs()).length,2);
  await page.getByRole('button',{name:/4 · Dễ/}).click();
  await page.getByRole('heading',{name:'Đã hoàn thành',exact:true}).waitFor();
  await page.getByRole('button',{name:'Quay lại lượt vừa trả lời (Backspace)',exact:true}).click();
  await page.getByRole('button',{name:/4 · Dễ/}).waitFor();
  // Mobile, short landscape and free study all keep action targets inside the viewport.
  for (const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await page.goto(base);await card().waitFor();
    await reveal().click();await page.getByRole('button',{name:/4 · Dễ/}).waitFor();
    for (const button of await page.locator('.study-session-rating').all()) {
      const box=await button.boundingBox();assert.ok(box.height>=44 && box.x>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height,JSON.stringify({viewport,box}));
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    if (viewport.width===390) await page.screenshot({path:'artifacts/study-session-ui/mobile-answer.png'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base);await card().waitFor();
  assert.equal(await page.locator('.study-session').getAttribute('data-reduced-motion'),'true');
  await page.keyboard.press('Space');await page.getByRole('button',{name:/4 · Dễ/}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.goto(base+'?mode=flashcards');await card().waitFor();
  const freeNext=page.locator('.study-session-free-next');assert.equal(await freeNext.count(),0);
  assert.equal(await page.getByRole('button',{name:'Thẻ trước',exact:true}).isVisible(),true);
  for (const control of await page.locator('.study-free-controls button').all()) {
    const box=await control.boundingBox();assert.ok(box.height>=44 && box.x>=0 && box.x+box.width<=390);
  }
  await page.screenshot({path:'artifacts/study-session-ui/free-controls-mobile.png'});

  await card().focus();await page.keyboard.press('Enter');await page.locator('.study-session-card').getByText(/Nhật Bản/).first().waitFor();
  assert.equal(await freeNext.isVisible(),true);
  await freeNext.focus();await page.keyboard.press('Enter');await page.locator('.study-session-card ruby').filter({hasText:'学校'}).first().waitFor();
  await page.getByRole('button',{name:'Kết thúc phiên',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.sessionExited),true);
  await page.setViewportSize({width:1100,height:760});await page.goto(base+'?mode=decks');
  await page.getByRole('heading',{name:'Kanji N4',exact:true}).waitFor();
  await page.screenshot({path:'artifacts/study-session-ui/deck-library.png'});
  await page.getByRole('button',{name:'Học ngay →',exact:true}).first().click();
  assert.equal(await page.evaluate(()=>window.deckOpened),true);
  assert.deepEqual(errors,[]);
  console.log('Study UI: keyboard/click, unique progress, fonts, five contrast combinations, reduced motion, desktop/mobile/landscape and free study passed.');
} finally {await browser?.close();await server.close();}
