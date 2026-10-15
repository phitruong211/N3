import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith('/__deck-groups__')) return next();
  const html = `<html><head><style>body{margin:0;background:#0d100f}@media(prefers-color-scheme:light){body{background:#eceeeb}}</style></head><body><div id="root"></div><script type="module">
    import React,{useState,useEffect} from 'react'; import {createRoot} from 'react-dom/client';
    import {DeckGroups} from '/src/components/flashcard/DeckGroups.tsx';
    import {createLearningStorage} from '/src/lib/storage.ts'; const storage=createLearningStorage('user:fixture');
    import {listDeckPage} from '/src/lib/deckApi.ts'; import {currentUser} from '/src/lib/api.ts'; import '/src/index.css';
    localStorage.setItem('auth:refresh_token','fixture');localStorage.setItem('auth:access_token','fixture');
    await currentUser();
    function App(){ const [reload,setReload]=useState(0); const [decks,setDecks]=useState([]);const [mode,setMode]=useState('free'); const [toolbar,setToolbar]=useState(null);const [summary,setSummary]=useState(null);
      useEffect(()=>{ listDeckPage(0,'position,asc',null).then(p=>setDecks(p.content)); },[reload]);
      const h=React.createElement;
      return h('main',{className:'deck-personal-library',style:{maxWidth:1120,margin:'40px auto',padding:20}},h('div',{className:'deck-personal-header'},h('div',null,h('h1',{className:'text-[28px] font-semibold'},'Bộ thẻ của bạn'),h('p',{ref:setSummary,className:'widget-library-summary'})),h('div',{ref:setToolbar})),h('button',{className:'study-button',onClick:()=>setMode(mode==='free'?'scheduled':'free')},'Đổi chế độ'),
        h(DeckGroups,{toolbarTarget:toolbar,summaryTarget:summary,rootDecks:decks,reload,mode,busy:false,storage,onChange:()=>setReload(v=>v+1),renderDeck:(deck,menu,compact)=>compact?h('article',{className:'widget-deck-row'},h('h3',null,deck.name),h('span',null,deck.cardCount+' thẻ'),h('button',{'aria-label':mode==='free'?'Bắt đầu học':'Ôn ngay',onClick:()=>window.started=deck.id},'↗'),menu):h('article',{className:'study-panel deck-hover-card'},menu,h('h3',null,deck.name),h('p',null,deck.cardCount+' thẻ'),h('button',{className:'study-button',onClick:()=>window.started=deck.id},mode==='free'?'Bắt đầu học':'Ôn ngay'))}));
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
let failNextMove = false; let moveCount = 0; let widgetOrderCount = 0;
let browser;
try {
  await server.listen(); browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, hasTouch: true });
  await page.emulateMedia({colorScheme:'dark'});
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
    } else if (path === '/deck-groups/order') {
      assert.deepEqual([...body.ids].sort(),groups.map(g=>g.id).sort());
      groups = body.ids.map((id,position)=>({...groups.find(g=>g.id===id),position})); widgetOrderCount++;
    } else throw new Error('Unexpected '+method+' '+path);
    return route.fulfill({ status:204 });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__deck-groups__`);
  const folder = () => page.locator('.deck-folder');
  await folder().waitFor();
  assert.equal(await page.getByRole('heading',{name:'Bài 2 · Cuộc sống'}).count(),0);
  await page.getByRole('button',{name:/Từ vựng N3.*1 bộ/}).click();
  await page.getByRole('heading',{name:'Bài 2 · Cuộc sống'}).waitFor();
  const studyButton=await folder().getByRole('button',{name:'Bắt đầu học'}).boundingBox();
  await page.mouse.move(studyButton.x+10,studyButton.y+10);await page.mouse.down();await page.mouse.move(studyButton.x+45,studyButton.y+15);
  assert.equal(await page.locator('.deck-drag-preview').count(),0);await page.mouse.up();
  await folder().getByRole('button',{name:'Bắt đầu học'}).click(); assert.equal(await page.evaluate(()=>window.started),'d2');
  await page.getByRole('button',{name:'Đổi chế độ'}).click();
  await folder().getByRole('button',{name:'Ôn ngay'}).click(); assert.equal(await page.evaluate(()=>window.started),'d2');
  assert.equal(decks.find(d=>d.id==='d2').dueCount,3);
  async function moveByMenu(name, groupId) {
    await page.getByRole('button',{name:'Thao tác với bộ '+name,exact:true}).click();
    await page.getByRole('menuitem',{name:'Chuyển đến nhóm…'}).click();
    await page.getByRole('combobox',{name:'Chuyển nhóm cho '+name}).selectOption(groupId);
    await page.getByRole('button',{name:'Chuyển nhóm',exact:true}).click();
  }
  // Menu offers a keyboard/touch alternative.
  await moveByMenu('Bài 1 · Khởi đầu','g1');
  await page.waitForFunction(()=>document.querySelector('.deck-folder-toggle').textContent.includes('2 bộ'));
  assert.equal(moveCount,1);
  failNextMove=true;
  await moveByMenu('Bài 1 · Khởi đầu','');
  await page.getByRole('dialog').getByRole('alert').waitFor();
  await page.getByRole('button',{name:'Hủy',exact:true}).click(); assert.equal(decks[0].groupId,'g1');
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await moveByMenu('Bài 1 · Khởi đầu','');
  await page.waitForFunction(()=>document.querySelector('.deck-root-zone h3')?.textContent==='Bài 1 · Khởi đầu');
  // Drag into a closed folder: hover opens it, drop persists the move.
  await page.getByRole('button',{name:/Từ vựng N3.*1 bộ/}).click();
  const dragHandle=page.getByRole('heading',{name:'Bài 1 · Khởi đầu',exact:true});
  await page.waitForFunction(()=>document.querySelector('.deck-groups-library').getAttribute('aria-busy')==='false');
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
  const cancelHandle=await page.getByRole('heading',{name:'Bài 1 · Khởi đầu',exact:true}).boundingBox();
  await page.mouse.move(cancelHandle.x+10,cancelHandle.y+10);await page.mouse.down();await page.mouse.move(cancelHandle.x+50,cancelHandle.y+40);
  await page.keyboard.press('Escape');await page.mouse.up();assert.equal(moveCount,3);
  await page.getByRole('button',{name:'Tạo mới',exact:true}).click();
  await page.getByRole('menuitem',{name:'Tạo nhóm',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên nhóm'}).fill('Ngữ pháp');await page.getByRole('button',{name:'Lưu nhóm'}).click();
  await page.getByRole('button',{name:/Ngữ pháp.*0 bộ/}).waitFor();
  await page.getByLabel('Thao tác nhóm Ngữ pháp').click();await page.getByRole('menuitem',{name:'Đổi tên',exact:true}).click();
  await page.getByRole('textbox',{name:'Tên nhóm'}).fill('Luyện thi');await page.getByRole('button',{name:'Lưu nhóm'}).click();
  await page.getByRole('button',{name:/Luyện thi.*0 bộ/}).waitFor();
  if(await page.locator('#group-g1 .deck-folder-toggle').getAttribute('aria-expanded')==='true')await page.locator('#group-g1 .deck-folder-toggle').click();
  // Widgets are side-by-side and locked until editing is explicitly enabled.
  assert.equal(await page.getByRole('button',{name:/Kéo để di chuyển/}).count(),0);
  assert.equal(await page.getByRole('button',{name:/Đổi kích thước nhóm/}).count(),0);
  await page.waitForFunction(()=>{const a=document.querySelector('#group-g1').getBoundingClientRect(),b=document.querySelector('#group-g2').getBoundingClientRect();return Math.abs(a.y-b.y)<2&&a.right+10<=b.left;});
  const firstWidget = await page.locator('#group-g1').boundingBox();
  const secondWidget = await page.locator('#group-g2').boundingBox();
  assert.ok(Math.abs(firstWidget.y-secondWidget.y)<2);
  assert.ok(secondWidget.x>firstWidget.x+firstWidget.width);
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).click();
  const gridBeforeCustomize=await page.locator('.deck-folder-grid').boundingBox();
  await page.getByRole('button',{name:'Tùy chỉnh widget Từ vựng N3',exact:true}).click();
  const custom = page.getByRole('complementary',{name:'Giao diện thẻ',exact:true});
  await custom.getByRole('button',{name:/Vừa/}).click();
  await custom.getByRole('button',{name:'Lavender',exact:true}).click();
  await custom.getByRole('slider',{name:'Độ trong suốt của thẻ',exact:true}).focus();await page.keyboard.press('Home');
  for(let step=0;step<35;step++)await page.keyboard.press('ArrowRight');
  const widgetKey = 'user:fixture:deck-group-widgets-v1';
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1,widgetKey),{size:'medium',color:'#b4a0ff',opacity:35,blur:24});
  assert.equal(await page.locator('#group-g1').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await custom.locator('.widget-color-options button').count(),6);
  assert.equal(await custom.locator('.widget-style-preview').count(),0);
  await custom.getByLabel('Chọn màu widget từ bảng màu').fill('#608c9b');
  assert.equal(await page.locator('#group-g1').evaluate(el=>el.style.getPropertyValue('--tint')),'#608c9b');
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1.color,widgetKey),'#608c9b');
  assert.equal(await page.locator('dialog[open]').count(),0);
  assert.equal(await page.locator('#group-g1 .widget-content').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('#group-g1').evaluate(el=>getComputedStyle(el).borderStyle),'solid');
  assert.equal(await custom.evaluate(el=>getComputedStyle(el).position),'fixed');
  const panelBox=await custom.boundingBox(),gridBox=await page.locator('.deck-folder-grid').boundingBox();
  assert.equal(Math.round(panelBox.width),300);assert.equal(Math.round(gridBox.width),Math.round(gridBeforeCustomize.width));
  for(const name of ['Độ trong suốt của thẻ']) {
    const slider=custom.getByRole('slider',{name,exact:true});await slider.focus();
    assert.equal(await slider.evaluate(el=>getComputedStyle(el).outlineWidth),'2px');
    assert.equal(await slider.evaluate(el=>getComputedStyle(el).outlineOffset),'2px');
  }
  await mkdir('artifacts/deck-groups',{recursive:true});
  await page.screenshot({path:'artifacts/deck-groups/widgets-customize.png',fullPage:true});
  await custom.getByRole('button',{name:'Xong',exact:true}).click();
  // Pointer reorder, cancellation and keyboard alternative do not move any deck between groups.
  async function dragWidget(from,to,escape=false) {
    const grip=await page.getByRole('button',{name:'Kéo để di chuyển '+from,exact:true}).boundingBox();
    const target=await page.locator('#group-'+to).boundingBox();
    await page.mouse.move(grip.x+12,grip.y+12);await page.mouse.down();
    await page.mouse.move(target.x+target.width-30,target.y+target.height/2,{steps:10});
    if(escape)await page.keyboard.press('Escape');
    await page.mouse.up();
  }
  await dragWidget('Từ vựng N3','g2',true);assert.equal(widgetOrderCount,0);
  await dragWidget('Từ vựng N3','g2');
  await page.waitForFunction(()=>document.querySelector('.deck-folder').id==='group-g2');assert.equal(widgetOrderCount,1);
  await page.waitForFunction(()=>document.querySelector('.deck-groups-library').getAttribute('aria-busy')==='false');
  await page.getByRole('button',{name:'Kéo để di chuyển Từ vựng N3',exact:true}).focus();await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>document.querySelector('.deck-folder').id==='group-g1');assert.equal(widgetOrderCount,2);assert.equal(moveCount,3);
  await page.getByRole('button',{name:'Xong',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).waitFor();
  assert.equal(await page.locator('#group-g1').getAttribute('data-widget-size'),'medium');
  assert.equal(await page.locator('#group-g1').evaluate(el=>el.style.getPropertyValue('--op')),'35');
  assert.equal(await page.getByRole('button',{name:/Kéo để di chuyển/}).count(),0);
  await page.waitForFunction(()=>{const a=document.querySelector('#group-g1').getBoundingClientRect(),b=document.querySelector('#group-g2').getBoundingClientRect();return Math.abs(a.y-b.y)<2&&a.right+10<=b.left;});
  await page.screenshot({path:'artifacts/deck-groups/widgets-colored.png',fullPage:true});
  await page.getByRole('button',{name:/Từ vựng N3.*2 bộ/}).click();
  await page.getByRole('heading',{name:'Bài 1 · Khởi đầu'}).waitFor();
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).click();

  await page.getByRole('button',{name:'Tùy chỉnh widget Từ vựng N3',exact:true}).click();
  await custom.getByRole('button',{name:/Lớn/}).click();
  await custom.getByRole('button',{name:'Xong',exact:true}).click();
  // Resize is live, persistent, cancellable and keyboard accessible.
  const sizeKey = 'user:fixture:deck-group-sizes-v1';
  const resize = page.getByRole('button',{name:'Đổi kích thước nhóm Từ vựng N3',exact:true});
  let before = await folder().first().boundingBox();
  let grip = await resize.boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
  await page.mouse.move(grip.x+grip.width/2-500,grip.y+grip.height/2+100,{steps:8});
  assert.equal(await page.locator('.deck-drag-preview').count(),0);
  await page.mouse.up();
  const saved = await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1,sizeKey);
  assert.ok(saved.width < before.width-450); assert.ok(saved.height >= before.height+90);
  before = await folder().first().boundingBox();grip = await resize.boundingBox();
  await page.mouse.move(grip.x+20,grip.y+20);await page.mouse.down();await page.mouse.move(grip.x-80,grip.y+70);
  await page.keyboard.press('Escape');await page.mouse.up();
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1,sizeKey),saved);
  assert.ok(Math.abs((await folder().first().boundingBox()).width-before.width)<2);
  await resize.focus();await page.keyboard.press('ArrowRight');
  assert.equal((await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1,sizeKey)).width,saved.width+10);
  await page.reload();await page.locator('#group-g1').waitFor();if(await page.locator('#group-g1 .deck-folder-toggle').getAttribute('aria-expanded')==='false')await page.locator('#group-g1 .deck-folder-toggle').click();
  await page.getByRole('heading',{name:'Bài 1 · Khởi đầu'}).waitFor();
  assert.ok(Math.abs((await folder().first().boundingBox()).width-(saved.width+10))<2);
  // Resizing does not clip portaled menus; Escape restores trigger focus.
  const menuTrigger=page.getByRole('button',{name:'Thao tác với bộ Bài 1 · Khởi đầu',exact:true});
  await menuTrigger.click();await page.getByRole('menuitem',{name:'Chuyển đến nhóm…'}).waitFor();
  assert.equal(await page.getByRole('menu').evaluate(el=>el.parentElement===document.body),true);
  await page.keyboard.press('Escape');assert.equal(await menuTrigger.evaluate(el=>el===document.activeElement),true);
  // Keep the mobile touch fixture compact after testing stored dimensions.
  await page.getByLabel('Thao tác nhóm Từ vựng N3').click();
  await page.getByRole('menuitem',{name:'Đặt lại kích thước'}).click();
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).g1,sizeKey),undefined);
  // Reset appearance restores responsive presets. Capture the board in both themes.
  await page.getByLabel('Thao tác nhóm Từ vựng N3').click();await page.getByRole('menuitem',{name:'Tùy chỉnh widget',exact:true}).click();
  await custom.getByRole('button',{name:'Đặt lại',exact:true}).click();await custom.getByRole('button',{name:'Xong',exact:true}).click();
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).waitFor();
  await mkdir('artifacts/deck-groups',{recursive:true});
  await page.waitForFunction(()=>{const a=document.querySelector('#group-g1').getBoundingClientRect(),b=document.querySelector('#group-g2').getBoundingClientRect();return Math.abs(a.y-b.y)<2&&a.right+10<=b.left;});
  await page.screenshot({path:'artifacts/deck-groups/widgets-desktop.png',fullPage:true});
  await page.emulateMedia({colorScheme:'dark'});
  await page.evaluate(()=>document.documentElement.classList.add('dark'));
  const lavaPosition = () => page.locator('#group-g1').evaluate(el=>getComputedStyle(el,'::before').backgroundPosition);
  const lavaBefore = await lavaPosition();
  await page.waitForTimeout(300);
  assert.notEqual(await lavaPosition(),lavaBefore);
  await page.screenshot({path:'artifacts/deck-groups/widgets-dark.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#group-g1').evaluate(el=>getComputedStyle(el,'::before').animationName),'none');
  await page.evaluate(()=>document.documentElement.classList.remove('dark'));
  await page.setViewportSize({width:360,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'artifacts/deck-groups/widgets-mobile.png',fullPage:true});
  // The widget handle itself supports touch, independently of deck membership dragging.
  if(await page.locator('#group-g1 .deck-folder-toggle').getAttribute('aria-expanded')==='true')await page.locator('#group-g1 .deck-folder-toggle').click();
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).click();
  const widgetTouch = await page.context().newCDPSession(page);
  const widgetGrip = await page.getByRole('button',{name:'Kéo để di chuyển Từ vựng N3',exact:true}).boundingBox();
  const widgetDestination = await page.locator('#group-g2').boundingBox();
  await widgetTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:widgetGrip.x+12,y:widgetGrip.y+12}]});
  await widgetTouch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:widgetDestination.x+widgetDestination.width-25,y:Math.min(810,widgetDestination.y+widgetDestination.height/2)}]});
  await page.waitForFunction(()=>document.querySelector('#group-g2').classList.contains('is-widget-target'));
  await widgetTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('.deck-folder').id==='group-g2');assert.equal(widgetOrderCount,3);
  await page.waitForFunction(()=>document.querySelector('.deck-groups-library').getAttribute('aria-busy')==='false');
  await page.getByRole('button',{name:'Kéo để di chuyển Từ vựng N3',exact:true}).focus();await page.keyboard.press('ArrowUp');
  await page.waitForFunction(()=>document.querySelector('.deck-folder').id==='group-g1');
  await page.waitForFunction(()=>document.querySelector('.deck-groups-library').getAttribute('aria-busy')==='false');
  await page.getByRole('button',{name:'Xong',exact:true}).click();
  await page.getByRole('button',{name:/Từ vựng N3.*2 bộ/}).click();
  await page.getByRole('heading',{name:'Bài 1 · Khởi đầu',exact:true}).waitFor();
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  const touchHandle = await page.getByRole('heading',{name:'Bài 1 · Khởi đầu',exact:true}).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchHandle.x+12,y:touchHandle.y+12}]});
  await page.waitForTimeout(500); // Hold (240 ms) plus drop-zone layout transition.
  const touchTarget = await page.getByRole('button',{name:/Luyện thi.*0 bộ/}).boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchTarget.x+80,y:touchTarget.y+20}]});
  await page.waitForFunction(()=>document.querySelectorAll('.deck-folder.is-target').length===1,undefined,{timeout:5000});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('button',{name:/Luyện thi.*1 bộ/}).waitFor();
  assert.equal(decks[0].groupId,'g2');
  if(await page.locator('#group-g2 .deck-folder-toggle').getAttribute('aria-expanded')==='false')await page.locator('#group-g2 .deck-folder-toggle').click();
  await page.getByRole('heading',{name:'Bài 1 · Khởi đầu',exact:true}).waitFor();
  await moveByMenu('Bài 1 · Khởi đầu','g1');
  await page.getByRole('button',{name:/Từ vựng N3.*2 bộ/}).waitFor();
  await page.getByLabel('Thao tác nhóm Từ vựng N3').click();await page.getByRole('menuitem',{name:'Giải tán nhóm',exact:true}).click();
  await page.getByRole('button',{name:'Giải tán',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.deck-root-zone h3').length===2);
  assert.equal(decks.every(d=>d.groupId===null),true);
  assert.deepEqual(errors,[]);
  // Visual matrix with real group summaries: three sizes, light/dark and a 360px sheet.
  groups=[{id:'g1',name:'Từ vựng N3',version:0,position:0},{id:'g2',name:'FPT',version:0,position:1},{id:'g3',name:'English',version:0,position:2},{id:'g4',name:'Từ vựng N2 · DMR',version:0,position:3}];
  decks=[
    {id:'d1',name:'Bài 1 · Khởi đầu',groupId:'g1',version:0,cardCount:30,dueCount:5,position:0},
    {id:'d2',name:'Bài 2 · Cuộc sống',groupId:'g1',version:0,cardCount:24,dueCount:3,position:1},
    {id:'d3',name:'Bài 1',groupId:'g2',version:0,cardCount:1951,dueCount:0,position:0},
    {id:'d4',name:'Daily words',groupId:'g3',version:0,cardCount:137,dueCount:0,position:0},
    {id:'d5',name:'Từ vựng N2',groupId:'g4',version:0,cardCount:2101,dueCount:0,position:0},
  ];
  await page.evaluate(({widgetKey,sizeKey})=>{
    localStorage.setItem(widgetKey,JSON.stringify({g1:{size:'large',color:'#aa94e8',opacity:30,blur:24},g2:{size:'medium',color:'#65a8ed',opacity:30,blur:24},g3:{size:'small',color:'#59c5a2',opacity:30,blur:24},g4:{size:'medium',color:'#e8b768',opacity:30,blur:24}}));
    localStorage.removeItem(sizeKey);
  },{widgetKey,sizeKey});
  await page.setViewportSize({width:1280,height:1000});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  await page.reload();await page.getByRole('heading',{name:'Bài 2 · Cuộc sống'}).waitFor();
  await page.getByRole('button',{name:'Đổi chế độ',exact:true}).evaluate(el=>el.style.display='none');
  assert.equal(await page.locator('#group-g1').evaluate(el=>getComputedStyle(el).gridColumnStart),'span 6');
  assert.equal(await page.locator('#group-g2').evaluate(el=>getComputedStyle(el).gridColumnStart),'span 3');
  assert.equal(await page.locator('#group-g3').evaluate(el=>getComputedStyle(el).gridColumnStart),'span 2');
  await page.locator('#group-g1').getByRole('img',{name:'8 thẻ cần ôn'}).waitFor();
  assert.equal(await page.locator('#group-g3 .widget-review-ring').count(),0);
  await page.screenshot({path:'artifacts/deck-groups/glass-dark.png',fullPage:true});
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).click();
  await page.getByRole('button',{name:'Tùy chỉnh widget FPT',exact:true}).click();
  await custom.waitFor();await page.screenshot({path:'artifacts/deck-groups/glass-desktop-panel.png',fullPage:true});
  await page.keyboard.press('Escape');assert.equal(await custom.count(),0);
  assert.equal(await page.getByRole('button',{name:'Tùy chỉnh widget FPT',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.getByRole('button',{name:'Xong',exact:true}).click();
  await page.emulateMedia({colorScheme:'light'});
  assert.equal(await page.locator('.deck-groups-library').evaluate(el=>getComputedStyle(el).getPropertyValue('--bg').trim()),'#F7F6F2');
  await page.screenshot({path:'artifacts/deck-groups/glass-light.png',fullPage:true});
  await page.setViewportSize({width:360,height:844});await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.locator('#group-g3').evaluate(el=>getComputedStyle(el).gridColumnStart),'span 3');
  assert.equal(await page.locator('#group-g2').evaluate(el=>getComputedStyle(el).gridColumnStart),'span 6');
  await page.screenshot({path:'artifacts/deck-groups/glass-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Sắp xếp',exact:true}).click();
  await page.getByRole('button',{name:'Tùy chỉnh widget English',exact:true}).click();
  await custom.waitFor();const sheetBox=await custom.boundingBox();
  assert.ok(sheetBox.height<=844*.62+1);assert.ok(sheetBox.y+sheetBox.height<=844);
  assert.equal(await custom.evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.screenshot({path:'artifacts/deck-groups/glass-mobile-panel.png',fullPage:true});
  await custom.getByRole('button',{name:'Đóng bảng tùy chỉnh',exact:true}).click();
  assert.equal(await custom.count(),0);assert.deepEqual(errors,[]);
  assert.equal(await page.locator('.widget-board-backdrop').count(),0);
  for (const theme of ['light','dark','reading','high-contrast']) {
    await page.evaluate(theme=>{document.documentElement.className=theme;},theme);
    const palette=await page.locator('.deck-groups-library').evaluate(el=>{
      const css=getComputedStyle(el);
      return ['--bg','--color-bg','--ink','--color-text','--panel','--color-surface'].map(key=>css.getPropertyValue(key).trim());
    });
    assert.equal(palette[0],palette[1],theme+' background');
    assert.equal(palette[2],palette[3],theme+' text');
    assert.equal(palette[4],palette[5],theme+' panel');
  }
  console.log('PASS: widget lock/side-by-side/color/transparency/blur/persistence, pointer and keyboard reorder/cancel, resize, groups CRUD, study actions, deck move/rollback, mobile touch drag and reduced motion');
} finally { await browser?.close(); await server.close(); }
