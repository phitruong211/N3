import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith('/__deck-groups__')) return next();
  const html = `<html><body><div id="root"></div><script type="module">
    import React,{useState,useEffect} from 'react'; import {createRoot} from 'react-dom/client';
    import {DeckGroups} from '/src/components/flashcard/DeckGroups.tsx';
    import {listDeckPage} from '/src/lib/deckApi.ts'; import {currentUser} from '/src/lib/api.ts'; import '/src/index.css';
    localStorage.setItem('auth:refresh_token','fixture');localStorage.setItem('auth:access_token','fixture');
    await currentUser();
    function App(){ const [reload,setReload]=useState(0); const [decks,setDecks]=useState([]);const [mode,setMode]=useState('free');
      useEffect(()=>{ listDeckPage(0,'position,asc',null).then(p=>setDecks(p.content)); },[reload]);
      const h=React.createElement;
      return h('main',{style:{maxWidth:1120,margin:'40px auto',padding:20}},h('h1',null,'Thư viện của bạn'),h('button',{className:'study-button',onClick:()=>setMode(mode==='free'?'scheduled':'free')},'Đổi chế độ'),
        h(DeckGroups,{rootDecks:decks,reload,mode,busy:false,onChange:()=>setReload(v=>v+1),renderDeck:deck=>h('article',{className:'study-panel'},h('h3',null,deck.name),h('p',null,deck.cardCount+' thẻ'),h('button',{className:'study-button',onClick:()=>window.started=deck.id},mode==='free'?'Bắt đầu học':'Ôn ngay'))}));
    }createRoot(document.getElementById('root')).render(React.createElement(App));
  </script></body></html>`;
  response.setHeader('Content-Type', 'text/html'); response.end(await server.transformIndexHtml(request.url, html));
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());
let groups = [{ id: 'g1', name: 'Từ vựng N3', version: 0, position: 0 }];
let decks = [
  { id: 'd1', name: 'Bài 1 · Khởi đầu', groupId: null, version: 0, cardCount: 30, dueCount: 5, position: 0 },
  { id: 'd2', name: 'Bài 2 · Cuộc sống', groupId: 'g1', version: 0, cardCount: 24, dueCount: 3, position: 0 },
];
let failNextMove = false; let moveCount = 0;
let browser;
try {
  await server.listen(); browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname.replace('/api/v1',''); const method = route.request().method();
    const body = route.request().postDataJSON();
    const json = data => route.fulfill({ contentType:'application/json', body:JSON.stringify(data) });
    if (path === '/auth/me') return json({ id:'fixture' });
    if (path === '/deck-groups' && method === 'GET') return json(groups.map(g => ({ ...g,
      deckCount: decks.filter(d => d.groupId === g.id).length,
      cardCount: decks.filter(d => d.groupId === g.id).reduce((n,d)=>n+d.cardCount,0),
      dueCount: decks.filter(d => d.groupId === g.id).reduce((n,d)=>n+d.dueCount,0),
    })));
    if (path === '/decks') {
      const filtered = decks.filter(d => d.groupId === url.searchParams.get('groupId')).sort((a,b)=>a.position-b.position);
      const number = +(url.searchParams.get('page') || 0);
      return json({ content:filtered.slice(number*20,(number+1)*20),number,size:20,totalElements:filtered.length,totalPages:Math.ceil(filtered.length/20) });
    }
    if (path === '/deck-groups' && method === 'POST') groups.push({ id:'g'+(groups.length+1),name:body.name,version:0,position:groups.length });
    else if (path.match(/^\/deck-groups\/g\d+$/) && method === 'PATCH') { const group=groups.find(g=>path.endsWith('/'+g.id));group.name=body.name;group.version++; }
    else if (path.match(/^\/deck-groups\/g\d+$/) && method === 'DELETE') { const id=path.split('/').at(-1);groups=groups.filter(g=>g.id!==id);decks.forEach(d=>{if(d.groupId===id)d.groupId=null;}); }
    else if (path.endsWith('/group') && method === 'PUT') {
      if(failNextMove){failNextMove=false;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Dữ liệu đã thay đổi. Hãy thử lại.'})});}
      const deck=decks.find(d=>d.id===path.split('/')[2]);assert.equal(body.version,deck.version);
      deck.groupId=body.groupId;deck.version++;moveCount++;
    } else if (path !== '/deck-groups/order') throw new Error('Unexpected '+method+' '+path);
    return route.fulfill({ status:204 });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__deck-groups__`);
  const folder = () => page.locator('.deck-folder');
  await folder().waitFor();
  assert.equal(await page.getByRole('heading',{name:'Bài 2 · Cuộc sống'}).count(),0);
  await page.getByRole('button',{name:/Từ vựng N3.*1 bộ/}).click();
  await page.getByRole('heading',{name:'Bài 2 · Cuộc sống'}).waitFor();
  await folder().getByRole('button',{name:'Bắt đầu học'}).click(); assert.equal(await page.evaluate(()=>window.started),'d2');
  await page.getByRole('button',{name:'Đổi chế độ'}).click();
  await folder().getByRole('button',{name:'Ôn ngay'}).click(); assert.equal(await page.evaluate(()=>window.started),'d2');
  assert.match(await folder().innerText(),/3 cần ôn/);
  // Native select offers a keyboard/touch alternative.
  await page.getByRole('combobox',{name:'Chuyển nhóm cho Bài 1 · Khởi đầu'}).selectOption('g1');
  await page.waitForFunction(()=>document.querySelector('.deck-folder-toggle').textContent.includes('2 bộ'));
  assert.equal(moveCount,1);
  failNextMove=true;
  await page.getByRole('combobox',{name:'Chuyển nhóm cho Bài 1 · Khởi đầu'}).selectOption('');
  await page.getByRole('alert').waitFor(); assert.equal(decks[0].groupId,'g1');
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.getByRole('combobox',{name:'Chuyển nhóm cho Bài 1 · Khởi đầu'}).selectOption('');
  await page.waitForFunction(()=>document.querySelector('.deck-root-zone h3')?.textContent==='Bài 1 · Khởi đầu');
  // Drag into a closed folder: hover opens it, drop persists the move.
  await page.getByRole('button',{name:/Từ vựng N3.*1 bộ/}).click();
  const dragHandle=page.getByRole('button',{name:'Kéo bộ Bài 1 · Khởi đầu',exact:true});
  await page.waitForFunction(()=>!document.querySelector('.deck-root-zone .deck-drag-handle')?.disabled);
  await dragHandle.hover();
  const handle=await dragHandle.boundingBox();
  const target=await page.locator('.deck-folder-toggle').boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
  await page.mouse.move(target.x+100,target.y+20,{steps:12});
  await page.waitForFunction(()=>document.querySelector('.deck-folder-toggle').getAttribute('aria-expanded')==='true');
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.deck-folder-toggle').textContent.includes('2 bộ'));
  assert.equal(moveCount,3);
  // Escape cancels without a network mutation.
  const cancelHandle=await page.getByRole('button',{name:'Kéo bộ Bài 1 · Khởi đầu',exact:true}).boundingBox();
  await page.mouse.move(cancelHandle.x+10,cancelHandle.y+10);await page.mouse.down();await page.mouse.move(cancelHandle.x+50,cancelHandle.y+40);
  await page.keyboard.press('Escape');await page.mouse.up();assert.equal(moveCount,3);
  await page.getByRole('button',{name:'Tạo nhóm',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên nhóm'}).fill('Ngữ pháp');await page.getByRole('button',{name:'Lưu nhóm'}).click();
  await page.getByRole('button',{name:/Ngữ pháp.*0 bộ/}).waitFor();
  await page.getByLabel('Thao tác nhóm Ngữ pháp').click();await page.getByRole('button',{name:'Đổi tên',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên nhóm'}).fill('Luyện thi');await page.getByRole('button',{name:'Lưu nhóm'}).click();
  await page.getByRole('button',{name:/Luyện thi.*0 bộ/}).waitFor();
  await mkdir('artifacts/deck-groups',{recursive:true});
  await page.screenshot({path:'artifacts/deck-groups/desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'artifacts/deck-groups/mobile.png',fullPage:true});
  const touchHandle = await page.getByRole('button',{name:'Kéo bộ Bài 1 · Khởi đầu',exact:true}).boundingBox();
  const touchTarget = await page.getByRole('button',{name:/Luyện thi.*0 bộ/}).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchHandle.x+12,y:touchHandle.y+12}]});
  await page.waitForTimeout(280); // Touch hold activation threshold is 240 ms.
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchTarget.x+80,y:touchTarget.y+20}]});
  await page.waitForFunction(()=>document.querySelectorAll('.deck-folder.is-target').length===1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('button',{name:/Luyện thi.*1 bộ/}).waitFor();
  assert.equal(decks[0].groupId,'g2');
  await page.getByRole('button',{name:/Luyện thi.*1 bộ/}).click();
  await page.getByRole('combobox',{name:'Chuyển nhóm cho Bài 1 · Khởi đầu'}).selectOption('g1');
  await page.getByRole('button',{name:/Từ vựng N3.*2 bộ/}).waitFor();
  await page.getByLabel('Thao tác nhóm Từ vựng N3').click();await page.getByRole('button',{name:'Giải tán nhóm',exact:true}).click();
  await page.getByRole('button',{name:'Giải tán',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.deck-root-zone h3').length===2);
  assert.equal(decks.every(d=>d.groupId===null),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: groups CRUD, both study actions, move, rollback, hover-open drag, Escape, dissolve, mobile touch drag and reduced motion');
} finally { await browser?.close(); await server.close(); }
