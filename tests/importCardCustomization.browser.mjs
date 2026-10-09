import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

const server = await createServer({
  server: { host: "127.0.0.1", port: 0, open: false },
  plugins: [{
    name: "import-card-customization-fixture",
    enforce: "pre",
    load(id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/hooks/useApp.tsx")) return;
      return `
        const settings={showFuriganaFront:true,showFuriganaBack:true,autoPlayAudio:false,ankiSessionMinutes:0,reducedMotion:true};
        export const useApp=()=>({settings,srsCards:[],updateSRSCard:()=>{},learningSync:{flush:async()=>{}}});
        export const useLearningStorage=()=>({recordStudyActivity:()=>{},getJSON:(key,fallback)=>fallback,setJSON:()=>{}});
      `;
    },
  }],
});
const card = {
  id: "import-1", deckId: "fixture", front: "勉強", back: "日本語を勉強する",
  reading: "べんきょう", backReading: "にほんごをべんきょうする", note: "",
  type: "VOCABULARY", tags: ["N3"], source: "IMPORT", position: 0, extraData: {},
};
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith("/__import-card-test__")) return next();
  const html = await server.transformIndexHtml(request.url, `<html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {StudySession} from '/src/components/flashcard/StudySession.tsx'; import '/src/index.css';
    const card=${JSON.stringify(card)};
    createRoot(document.getElementById('root')).render(React.createElement(StudySession,{
      cards:[card],deckName:'Import fixture',mode:'flashcards',onExit:()=>{},
      onTemplateChange:async value=>{window.savedTemplate=value;},
      onCardChange:async value=>{window.savedCard=value;return {...card,...value,note:value.notes,type:value.kind.toUpperCase()};}
    }));
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
  await dialog.locator("label").filter({ hasText: "Font chữ" }).locator("select").selectOption("notoSansJp");
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
  assert.equal(await page.locator("ruby rt").first().innerText(), "がっこう");
  await page.locator('div[role="button"][aria-label="Hiện đáp án"]').click();
  assert.deepEqual(await page.locator("ruby rt").allTextContents(), ["にほん", "い"]);
  assert.deepEqual(errors, []);
  console.log("PASS: imported current-card editing, two-sided furigana and synchronized font styles.");
} finally {
  await browser?.close();
  await server.close();
}
