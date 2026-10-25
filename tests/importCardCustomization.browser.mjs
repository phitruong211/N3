import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
const card = {
  id: "import-1", deckId: "fixture", front: "勉強", back: "日本語を勉強する",
  reading: "べんきょう", backReading: "にほんごをべんきょうする", note: "",
  type: "VOCABULARY", tags: ["N3"], source: "IMPORT", position: 0, extraData: {},
};
server.middlewares.use(async (request, response, next) => {
  if (request.url?.startsWith("/__reading-isolation__")) {
    const html = await server.transformIndexHtml(request.url, `<html><body><div id="root"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {CardFace} from '/src/components/flashcard/CardPresentation.tsx';
      import {defaultDeckTemplate} from '/src/lib/ankiImport.ts';
      const card={id:'reading-test',front:'地形',back:'Địa hình',reading:'ちけい',backReading:'',hanViet:'',notes:'',kind:'vocabulary'};
      createRoot(document.getElementById('root')).render(React.createElement('main',null,
        ...[
          ['front',card,'front',['reading']],
          ['empty-back',card,'back',['reading']],
          ['filled-back',{...card,backReading:'うら'},'back',['reading']],
          ['answer-with-fallback',card,'back',['back','reading']],
          ['hidden-back',card,'back',['back']],
          ['hidden-front',{...card,front:'地形[ちけい]'},'front',['front']],
          ['hidden-explicit-back',{...card,back:'日本[にほん]'},'back',['back']],
        ].map(([id,value,side,fields]) =>
          React.createElement('section',{id,key:id},React.createElement(CardFace,{card:value,deckName:'Test',fields,template:defaultDeckTemplate(),side})))));
    </script></body></html>`);
    response.setHeader("Content-Type", "text/html"); response.end(html);
    return;
  }
  if (!request.url?.startsWith("/__import-card-test__")) return next();
  const withConfig = new URL(request.url, "http://fixture").searchParams.has("config");
  const customType = { id: "plus", name: "Từ vựng + cấp độ", kind: "VOCABULARY", fields: [
    { key: "front", label: "Mặt trước", type: "ruby", required: true }, { key: "frontReading", label: "Cách đọc mặt trước", type: "kana", for: "front" },
    { key: "back", label: "Mặt sau", type: "ruby", required: true }, { key: "backReading", label: "Cách đọc mặt sau", type: "kana", for: "back" },
    { key: "level", label: "Cấp độ", type: "text" },
  ], front: { show: ["front", "frontReading"] }, back: { show: ["back", "backReading", "level"] } };
  const html = await server.transformIndexHtml(request.url, `<html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
    import {AuthProvider} from '/src/hooks/useAuth.tsx'; import {AppProvider} from '/src/hooks/useApp.tsx';
    import {StudySession} from '/src/components/flashcard/StudySession.tsx'; import '/src/index.css';
    localStorage.clear(); sessionStorage.setItem('guest:session','1');
    localStorage.setItem('guest:n3_settings',JSON.stringify({autoPlayAudio:false,reducedMotion:true}));
    const withConfig=${withConfig};
    const card=${JSON.stringify(card)};
    if (withConfig) Object.assign(card,{noteType:'plus',front:'勉強',reading:'べんきょう',back:'Học',backReading:'',fields:{front:'勉強[べんきょう]',back:'Học',level:'N3'},extraData:{frontFuriganaSegments:JSON.stringify([{text:'勉強',reading:'べんきょう'}])}});
    const props={cards:[card],deckName:'Import fixture',mode:'flashcards',onExit:()=>{},
      onCardChange:async value=>{window.savedCard=value;return {...card,...value,note:value.notes,type:value.kind.toUpperCase()};}};
    if (withConfig) Object.assign(props,{config:{version:5,noteTypes:[${JSON.stringify(customType)}]},onConfigChange:async value=>{window.savedConfig=value;}});
    else props.onTemplateChange=async value=>{window.savedTemplate=value;};
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(AppProvider,null,React.createElement(StudySession,props)))));
  </script></body></html>`);
  response.setHeader("Content-Type", "text/html"); response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__reading-isolation__`);
  await page.locator('#front').waitFor();
  assert.match(await page.locator('#front').innerText(), /ちけい/);
  assert.match(await page.locator('#empty-back').innerText(), /ちけい/);
  assert.match(await page.locator('#answer-with-fallback').innerText(), /Địa hình/);
  assert.match(await page.locator('#answer-with-fallback').innerText(), /ちけい/);
  assert.doesNotMatch(await page.locator('#hidden-back').innerText(), /ちけい/);
  assert.equal(await page.locator('#hidden-front ruby rt').count(), 0);
  assert.equal(await page.locator('#hidden-explicit-back ruby rt').count(), 0);
  assert.match(await page.locator('#filled-back').innerText(), /うら/);
  assert.doesNotMatch(await page.locator('#filled-back').innerText(), /ちけい/);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__import-card-test__`);
  assert.equal(await page.evaluate(async () => {
    const names = ["Noto Sans JP Local", "Noto Serif JP Local", "Dela Gothic One Local"];
    await Promise.all(names.map((name) => document.fonts.load(`20px '${name}'`)));
    return names.every((name) => document.fonts.check(`20px '${name}'`));
  }), true);
  assert.equal(await page.locator("ruby rt").first().innerText(), "べんきょう");
  await page.getByRole("button", { name: "Tùy chỉnh thẻ", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Tùy chỉnh bộ thẻ" });
  await dialog.getByText("Nội dung thẻ hiện tại", { exact: true }).waitFor();
  await dialog.getByLabel(/Mặt trước/).first().fill("学校[がっこう]");
  await dialog.getByLabel(/Mặt sau/).first().fill("日本[にほん]へ行[い]く");
  await dialog.locator("label").filter({ hasText: "Cách đọc mặt trước" }).locator("textarea").fill("学校[がっこう]");
  await dialog.locator("label").filter({ hasText: "Cách đọc mặt sau" }).locator("textarea").fill("");
  await dialog.getByLabel("Cách đọc", { exact: true }).uncheck();
  await dialog.getByRole("group", { name: /^Kiểu mặt/ }).getByLabel("Font chữ").selectOption("notoSansJp");
  await dialog.getByRole("button", { name: "Áp dụng kiểu này cho cả hai mặt", exact: true }).click();
  await dialog.getByRole("button", { name: "Lưu tùy chỉnh", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  const saved = await page.evaluate(() => ({ card: window.savedCard, template: window.savedTemplate }));
  assert.equal(saved.card.front, "学校");
  assert.equal(saved.card.back, "日本へ行く");
  assert.equal(saved.card.reading, "がっこう");
  assert.equal(JSON.parse(saved.card.extraData.frontFuriganaSegments)[0].reading, "がっこう");
  assert.equal(saved.template.front.style.fontFamily, "notoSansJp");
  assert.equal(saved.template.back.style.fontFamily, "notoSansJp");
  assert.equal(await page.locator("ruby rt").count(), 0);
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  assert.deepEqual(await page.locator("ruby rt").allTextContents(), ["にほん", "い"]);
  // A deck with its own note type: the custom field renders with its label, is editable, and the layout is saved into the config.
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__import-card-test__?config`);
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  const answer = page.locator(".study-session-face");
  assert.match(await answer.innerText(), /CẤP ĐỘ/i);
  assert.match(await answer.innerText(), /N3/);
  await page.getByRole("button", { name: "Tùy chỉnh thẻ", exact: true }).click();
  const typed = page.getByRole("dialog", { name: "Tùy chỉnh bộ thẻ" });
  await typed.locator("label").filter({ hasText: "Cấp độ" }).locator("textarea").fill("N2");
  await typed.getByRole("tab", { name: "Mặt sau" }).click();
  await typed.getByRole("checkbox", { name: "Cấp độ" }).uncheck();
  await typed.getByRole("button", { name: "Lưu tùy chỉnh", exact: true }).click();
  await typed.waitFor({ state: "detached" });
  const savedTyped = await page.evaluate(() => ({ card: window.savedCard, config: window.savedConfig }));
  assert.equal(savedTyped.card.noteType, "plus");
  assert.equal(savedTyped.card.fields.level, "N2");
  assert.equal(savedTyped.card.fields.front, "勉強[べんきょう]");
  assert.deepEqual(savedTyped.config.noteTypes[0].back.show, ["back", "backReading"]);
  assert.doesNotMatch(await page.locator(".study-session-face").innerText(), /CẤP ĐỘ/i);
  assert.deepEqual(errors, []);
  console.log("PASS: imported current-card editing, two-sided furigana and synchronized font styles.");
} finally {
  await browser?.close();
  await server.close();
}
