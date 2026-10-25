import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = await createServer({ server: { host: "127.0.0.1", port: 0, open: false } });
const noteType = { id: "plus", name: "Từ vựng + cấp độ", kind: "VOCABULARY", fields: [
  { key: "front", label: "Mặt trước", type: "ruby", required: true }, { key: "frontReading", label: "Cách đọc mặt trước", type: "kana", for: "front" },
  { key: "back", label: "Mặt sau", type: "ruby", required: true }, { key: "backReading", label: "Cách đọc mặt sau", type: "kana", for: "back" },
  { key: "level", label: "Cấp độ", type: "text", style: { colors: { fg: "#b91c1c" }, font: { family: "lexend" } } },
], front: { show: ["front", "frontReading"] }, back: { show: ["back", "backReading", "level"], style: { colors: { fg: "#0f172a" } } } };
const config = { version: 5, style: { colors: { bg: "#fff7e6", accent: "#0f766e" }, font: { family: "kleeOne", size: 34 } }, noteTypes: [noteType] };
const card = { id: "c1", deckId: "d", front: "勉強", reading: "べんきょう", back: "Học", backReading: "", note: "", type: "VOCABULARY", tags: [], source: "IMPORT", position: 0, noteType: "plus",
  fields: { front: "勉強", frontReading: "べんきょう", back: "Học", level: "N3" }, extraData: {} };

server.middlewares.use(async (request, response, next) => {
  const url = request.url || "";
  if (url.startsWith("/__tiers-study__")) {
    const html = await server.transformIndexHtml(url, `<html><body><div id="root"></div><script type="module">
      import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
      import {AuthProvider} from '/src/hooks/useAuth.tsx'; import {AppProvider} from '/src/hooks/useApp.tsx';
      import {StudySession} from '/src/components/flashcard/StudySession.tsx'; import '/src/index.css';
      localStorage.clear(); sessionStorage.setItem('guest:session','1');
      localStorage.setItem('guest:n3_settings',JSON.stringify({autoPlayAudio:false,reducedMotion:true}));
      const card=${JSON.stringify(card)};
      if (new URL(location.href).searchParams.has('own')) card.style={colors:{bg:'#111827',fg:'#f9fafb'},font:{family:'bizUdpGothic'}};
      createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(AuthProvider,null,React.createElement(AppProvider,null,
        React.createElement(StudySession,{cards:[card],deckName:'Tiers',mode:'flashcards',config:${JSON.stringify(config)},onExit:()=>{}})))));
    </script></body></html>`);
    response.setHeader("Content-Type", "text/html"); response.end(html); return;
  }
  if (url.startsWith("/__tiers-import__")) {
    const html = await server.transformIndexHtml(url, `<html><body><div id="root"></div><script type="module">
      import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
      import ImportPreviewEditor from '/src/components/flashcard/ImportPreviewEditor.tsx';
      import {parseTextImport} from '/src/lib/ankiImport.ts'; import '/src/index.css';
      function Fixture(){const [preview,setPreview]=useState(()=>parseTextImport('front,back\\n勉強,Học','x.csv')); window.preview=preview;
        return React.createElement('main',{className:'mx-auto max-w-5xl p-6'},React.createElement(ImportPreviewEditor,{preview,onChange:setPreview}));}
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script></body></html>`);
    response.setHeader("Content-Type", "text/html"); response.end(html); return;
  }
  next();
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const loadedFamilies = () => page.evaluate(() => [...new Set([...document.fonts].filter(face => face.status === "loaded").map(face => face.family.replaceAll('"', "")))]);

  // Study: deck colors/font reach the card surface; the field and side tiers override them; fonts load only when used.
  await page.goto(`${base}/__tiers-study__`);
  const surface = page.locator(".study-session-card");
  await surface.waitFor();
  assert.equal(await surface.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 247, 230)");
  const front = page.locator('[data-field="front"]');
  assert.match(await front.evaluate(el => getComputedStyle(el).fontFamily), /Klee One/);
  assert.equal(await front.evaluate(el => getComputedStyle(el).fontSize), "81.6px"); // 34px x 2.4: short front text is auto-fitted
  assert.equal(await surface.evaluate(el => getComputedStyle(el).getPropertyValue("--card-reading")), "#0f766e");
  await page.evaluate(() => document.fonts.load("20px 'Klee One'", "勉強"));
  assert.ok((await loadedFamilies()).includes("Klee One"), "Klee One loads when a card uses it");
  assert.ok(!(await loadedFamilies()).includes("Lexend"), "Lexend is not loaded before a field uses it");
  await surface.click();
  const level = page.locator('[data-field="field:level"]');
  await level.waitFor();
  assert.equal(await level.evaluate(el => getComputedStyle(el).color), "rgb(185, 28, 28)");
  assert.match(await level.locator("div").last().evaluate(el => getComputedStyle(el).fontFamily), /Lexend/);
  assert.equal(await page.locator('[data-field="back"]').evaluate(el => getComputedStyle(el).color), "rgb(15, 23, 42)");
  await page.evaluate(() => document.fonts.load("20px 'Lexend'", "N3"));
  assert.ok((await loadedFamilies()).includes("Lexend"), "Lexend loads once a field uses it");

  // A card's own style beats every other tier.
  await page.goto(`${base}/__tiers-study__?own`);
  await page.locator(".study-session-card").waitFor();
  assert.equal(await page.locator(".study-session-card").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(17, 24, 39)");
  assert.match(await page.locator('[data-field="front"]').evaluate(el => getComputedStyle(el).fontFamily), /BIZ UDPGothic/);

  // Import: the deck style is chosen while importing and the sample cards change at once.
  await page.goto(`${base}/__tiers-import__`);
  await page.getByText("Giao diện bộ thẻ: font, màu, cỡ chữ").waitFor();
  const deck = page.getByRole("group", { name: "Giao diện cả bộ" });
  await deck.getByLabel("Font chữ").selectOption("lexend");
  await deck.getByLabel("Màu nền", { exact: true }).fill("#112233");
  await deck.getByLabel("Màu chữ", { exact: true }).fill("#fdf6e3");
  await deck.getByLabel("Cỡ chữ", { exact: true }).fill("40");
  assert.deepEqual(await page.evaluate(() => window.preview.style), { colors: { bg: "#112233", fg: "#fdf6e3" }, font: { family: "lexend", size: 40 } });
  const sample = page.getByText("1 · MẶT TRƯỚC").locator("..");
  assert.equal(await sample.evaluate(el => getComputedStyle(el).backgroundColor), "rgb(17, 34, 51)");
  assert.match(await sample.locator('[data-field="front"]').evaluate(el => getComputedStyle(el).fontFamily), /Lexend/);
  assert.equal(await page.getByText(/tương phản/).count(), 0);
  await deck.getByLabel("Màu chữ", { exact: true }).fill("#223344");
  await page.getByText(/Chữ và nền chỉ đạt tương phản/).first().waitFor();
  // The same card can then carry its own look.
  await page.getByRole("button", { name: "Sửa thẻ" }).click();
  await page.getByText("Giao diện riêng của thẻ này").click();
  const own = page.getByRole("group", { name: "Giao diện thẻ" });
  await own.getByLabel("Màu chữ", { exact: true }).fill("#ff0000");
  await page.getByRole("button", { name: "Xong" }).click();
  assert.deepEqual(await page.evaluate(() => window.preview.cards[0].style), { colors: { fg: "#ff0000" } });
  assert.equal(await page.getByText("1 · MẶT TRƯỚC").locator("..").evaluate(el => getComputedStyle(el).color), "rgb(255, 0, 0)");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS: deck, side, field and card style tiers render with custom colors and bundled fonts that load only when used; import applies the style at once.");
} finally {
  await browser?.close();
  await server.close();
}
