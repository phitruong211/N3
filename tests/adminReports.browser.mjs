import assert from "node:assert/strict";
import { createServer } from "vite";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");

// The moderation queue is exercised against an in-page stand-in for the API; the real endpoints and the role checks
// are covered by the backend tests (LibraryIntegrationTest).
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, open: false },
  plugins: [{
    name: "admin-fixture",
    enforce: "pre",
    load(id) {
      const path = id.replaceAll("\\", "/");
      if (path.endsWith("/src/hooks/useAuth.tsx")) return `export const useAuth=()=>({user:globalThis.__role?{id:'u',role:globalThis.__role,displayName:'Q',email:'q@x'}:null});`;
      if (path.endsWith("/src/lib/deckSharing.ts")) return `
        export const REPORT_REASONS=[['COPYRIGHT','Vi phạm bản quyền'],['INAPPROPRIATE','Nội dung không phù hợp'],['SPAM','Spam hoặc quảng cáo'],['OTHER','Lý do khác']];
        globalThis.__calls=[];
        let reports=[
          {id:'r1',deckId:'d1',deckToken:'t1',deckName:'Giáo trình chép',owner:'Cô Hương',reason:'COPYRIGHT',details:'Chép từ sách Minna',reporter:'Bạn A',createdAt:'2026-10-25T01:00:00Z',status:'OPEN',openReportsForDeck:2,moderation:'ACTIVE'},
          {id:'r2',deckId:'d2',deckToken:'t2',deckName:'Quảng cáo',owner:'Spammer',reason:'SPAM',details:null,reporter:'Bạn B',createdAt:'2026-10-25T02:00:00Z',status:'OPEN',openReportsForDeck:1,moderation:'ACTIVE'}];
        export const listReports=async(status)=>({reports:reports.filter(r=>r.status===status),page:0,totalPages:1,total:reports.length});
        export const dismissReport=async id=>{globalThis.__calls.push(['dismiss',id]);reports=reports.map(r=>r.id===id?{...r,status:'DISMISSED'}:r);};
        export const removeDeckFromSharing=async(id,reason)=>{globalThis.__calls.push(['remove',id,reason]);reports=reports.map(r=>r.deckId===id?{...r,status:'ACTIONED',moderation:'REMOVED'}:r);};
        export const restoreDeckSharing=async id=>{globalThis.__calls.push(['restore',id]);reports=reports.map(r=>r.deckId===id?{...r,moderation:'ACTIVE'}:r);};`;
    },
  }],
});
server.middlewares.use(async (request, response, next) => {
  if (!request.url?.startsWith("/__admin__")) return next();
  const role = new URL(request.url, "http://x").searchParams.get("role") || "";
  const html = await server.transformIndexHtml(request.url, `<html><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
    import {AdminReportsPage} from '/src/components/flashcard/AdminReportsPage.tsx'; import '/src/index.css';
    globalThis.__role=${JSON.stringify(role)};
    createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement('main',{className:'mx-auto max-w-3xl p-6'},React.createElement(AdminReportsPage))));
  </script></body></html>`);
  response.setHeader("Content-Type", "text/html"); response.end(html);
});
server.middlewares.stack.unshift(server.middlewares.stack.pop());

let browser;
try {
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}/__admin__`;
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  // Anyone who is not an admin sees the not-found page, not an empty queue.
  await page.goto(`${base}?role=USER`);
  assert.equal(await page.getByRole("heading", { name: "Báo cáo bộ thẻ được chia sẻ" }).count(), 0);
  await page.goto(`${base}?role=ADMIN`);
  await page.getByRole("heading", { name: "Giáo trình chép" }).waitFor();
  assert.match(await page.locator("li").first().innerText(), /Vi phạm bản quyền[\s\S]*Chép từ sách Minna[\s\S]*Bạn A/);
  assert.match(await page.locator("li").first().innerText(), /2 báo cáo đang chờ/);
  // Dismissing removes the report from the open queue.
  await page.locator("li").filter({ hasText: "Quảng cáo" }).getByRole("button", { name: "Bỏ qua" }).click();
  await page.waitForFunction(() => document.querySelectorAll("li").length === 1);
  // Taking a deck down needs a reason the owner will see.
  const first = page.locator("li").filter({ hasText: "Giáo trình chép" });
  await first.getByRole("button", { name: "Gỡ bộ thẻ" }).click();
  const confirm = first.getByRole("button", { name: "Xác nhận gỡ" });
  assert.equal(await confirm.isDisabled(), true);
  await first.getByLabel(/Lý do gỡ/).fill("Chép nguyên văn giáo trình có bản quyền");
  await confirm.click();
  await page.getByText("Không có báo cáo nào.").waitFor();
  assert.deepEqual(await page.evaluate(() => globalThis.__calls), [["dismiss", "r2"], ["remove", "d1", "Chép nguyên văn giáo trình có bản quyền"]]);
  await page.getByRole("button", { name: "Đã gỡ" }).click();
  await page.getByRole("button", { name: "Khôi phục quyền chia sẻ" }).click();
  assert.deepEqual((await page.evaluate(() => globalThis.__calls)).at(-1), ["restore", "d1"]);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(errors, []);
  console.log("PASS: moderation queue hides from non-admins, dismisses, removes with a required reason, restores, fits a phone.");
} finally {
  await browser?.close();
  await server.close();
}
