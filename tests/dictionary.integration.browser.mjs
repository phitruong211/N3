// Run only against an isolated API/database: creates a fresh account and one deck.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const api = process.env.DICTIONARY_TEST_API_URL;
if (!api || process.env.DICTIONARY_TEST_ALLOW_WRITES !== "1")
  throw new Error(
    "Set DICTIONARY_TEST_API_URL and DICTIONARY_TEST_ALLOW_WRITES=1 for a disposable database.",
  );
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 0,
    open: false,
    proxy: { "/api": { target: api, changeOrigin: true } },
  },
});
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
let browser;
try {
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/dictionary?q=neko`);
  const result = page
    .locator(".dictionary-result")
    .filter({ has: page.getByRole("heading", { name: "猫", exact: true }) })
    .first();
  await result.waitFor();
  await mkdir("artifacts/dictionary", { recursive: true });
  await page.screenshot({
    path: "artifacts/dictionary/real-search.png",
    fullPage: true,
  });
  await result
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  const auth = page.getByRole("dialog");
  await auth.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await auth
    .getByLabel("Tên hiển thị", { exact: true })
    .fill("Dictionary integration");
  await auth
    .getByLabel("Email", { exact: true })
    .fill(`dictionary-${Date.now()}@example.test`);
  await auth
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Dictionary-test-password-2026");
  await auth.locator("button.auth-submit").click();
  const dialog = page.getByRole("dialog", {
    name: "Thêm vào bộ thẻ",
    exact: true,
  });
  await dialog.waitFor();
  assert.match(page.url(), /dictionary\?q=neko$/);
  const name = `Từ mới ${Date.now()}`;
  await dialog.getByRole("button", { name: "Tạo bộ mới", exact: true }).click();
  await dialog.getByLabel("Tên bộ mới", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Tạo bộ", exact: true }).click();
  await dialog
    .getByRole("button", { name: `Thêm vào ${name}`, exact: true })
    .waitFor();
  await dialog.locator("summary").click();
  await dialog
    .getByLabel("Mặt sau", { exact: true })
    .fill("Con mèo — kiểm thử");
  await dialog
    .getByRole("button", { name: `Thêm vào ${name}`, exact: true })
    .click();
  await dialog.getByText(`Đã thêm 猫 vào ${name}.`, { exact: true }).waitFor();
  await dialog
    .getByRole("button", { name: "Tiếp tục tra từ", exact: true })
    .click();
  await result
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: `Thêm vào ${name}`, exact: true })
    .click();
  await dialog
    .getByText(`Từ này đã có trong ${name}.`, { exact: true })
    .waitFor();
  await dialog.getByRole("link", { name: "Mở bộ thẻ", exact: true }).click();
  await page.getByText("Con mèo — kiểm thử", { exact: true }).waitFor();
  await mkdir("artifacts/dictionary", { recursive: true });
  await page.screenshot({
    path: "artifacts/dictionary/real-deck.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Học tự do", exact: true }).click();
  const start = page.getByRole("button", { name: "Bắt đầu học", exact: true });
  if (await start.isVisible()) await start.click();
  await page.getByLabel("Phiên học thẻ", { exact: true }).waitFor();
  await page.getByLabel("Hiện đáp án", { exact: true }).click();
  await page.getByText("Con mèo — kiểm thử", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Real dictionary → register → create deck → edit/save → deduplicate → open stored card passed.",
  );
} finally {
  await browser?.close();
  await server.close();
}
