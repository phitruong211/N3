// Requires local Vite + API backed by a disposable MySQL schema. Creates synthetic accounts.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const base = process.env.SRS_TEST_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route("https://raw.githubusercontent.com/**", (r) => r.abort());
const button = (name) => page.getByRole("button", { name, exact: true });
const nav = (name) =>
  page
    .getByRole("navigation", { name: "Các trang học" })
    .getByRole("button", { name, exact: true })
    .click();
async function api(path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const r = await fetch("/api/v1" + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("auth:access_token"),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      return {
        status: r.status,
        data: r.status === 204 ? null : await r.json(),
      };
    },
    { path, options },
  );
}
try {
  await page.goto(base);
  await button("Khám phá với tư cách khách").click();
  await nav("Từ vựng");
  await button("Lưu từ").click();
  await nav("Thẻ học");
  await page.getByLabel("Chọn file nhập bộ thẻ").setInputFiles({
    name: "integration.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "front,back,reading,note,type,tags\n猫,Con mèo,ねこ,Ghi chú gốc,VOCABULARY,animal\n犬,Con chó,いぬ,Ghi chú khác,VOCABULARY,animal\n猫,Con mèo,ねこ,trùng,VOCABULARY,animal",
    ),
  });
  await button("Tạo bộ thẻ").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await dialog.getByLabel("Tên hiển thị").fill("SRS integration");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill(`srs-${Date.now()}@example.test`);
  await dialog
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Local-test-only-123");
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await dialog.waitFor({ state: "detached" });
  await page.getByLabel("Tôi xác nhận dữ liệu này thuộc về tôi").check();
  await button("Chuyển dữ liệu vào tài khoản").click();
  await page.getByText(/Đã chuyển 1 dấu trang/).waitFor();
  assert.equal((await api("/users/me/learning")).data.bookmarks.length, 1);
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("guest:n3_bookmarks")),
    ),
    [],
  );
  await button("Tạo bộ thẻ").click();
  await page.getByRole("region", { name: "Kết quả import" }).waitFor();
  let listing = await api("/decks?page=0&size=20");
  assert.equal(listing.status, 200);
  assert.equal(listing.data.content.length, 1);
  const deck = listing.data.content[0];
  assert.equal(deck.cardCount, 2);
  assert.equal(deck.newCount, 2);
  await button("Quản lý bộ").click();
  await page.getByText("Ghi chú gốc", { exact: true }).waitFor();
  const first = (await api(`/decks/${deck.id}/cards?page=0&size=1`)).data;
  assert.equal(first.totalElements, 2);
  assert.equal(first.content.length, 1);
  const card = first.content[0];
  const review = await api(`/anki/cards/${card.id}/reviews`, {
    method: "POST",
    body: { cardId: card.id, rating: "GOOD", responseTimeMs: 1200 },
  });
  assert.equal(review.status, 200, JSON.stringify(review));
  const before = (
    await api(`/decks/${deck.id}/cards?page=0&size=50`)
  ).data.content.find((c) => c.id === card.id).progress;
  await api(`/cards/${card.id}`, {
    method: "PATCH",
    body: { front: "猫 updated", back: "Con mèo", notes: "Ghi chú gốc" },
  });
  const after = (
    await api(`/decks/${deck.id}/cards?page=0&size=50`)
  ).data.content.find((c) => c.id === card.id);
  assert.deepEqual(after.progress, before);
  assert.equal(after.front, "猫 updated");
  await nav("Anki");
  await page
    .locator("article")
    .filter({
      has: page.getByRole("heading", { name: "integration", exact: true }),
    })
    .getByRole("button", { name: "Bắt đầu học", exact: true })
    .click();
  await button("Bắt đầu phiên").click();
  await page
    .getByRole("button", { name: "Hiện đáp án", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: /3 · Được/ }).click();
  await page
    .getByRole("heading", { name: "Đã hoàn thành", exact: true })
    .waitFor();
  await button("Về danh sách bộ thẻ").click();
  assert.equal((await api(`/decks/${deck.id}/metadata`)).data.newCount, 0);
  await nav("Cài đặt");
  await page.getByLabel("Mục tiêu mỗi ngày (thẻ)").fill("35");
  await page.getByText("Cài đặt đã đồng bộ", { exact: true }).waitFor();
  assert.equal((await api("/users/me/settings")).data.dailyGoal, 35);
  await nav("Từ vựng");
  await button("Bỏ lưu từ").click();
  await page.getByText("Tiến độ đã đồng bộ", { exact: true }).waitFor();
  assert.equal((await api("/users/me/learning")).data.bookmarks.length, 0);
  // A second clean browser restores account state from the API, without copied learning storage.
  const tokens = await page.evaluate(() =>
    Object.fromEntries(
      ["auth:access_token", "auth:refresh_token", "auth:session_id"].map(
        (k) => [k, localStorage.getItem(k)],
      ),
    ),
  );
  const second = await browser.newContext();
  await second.addInitScript((tokens) => {
    for (const [k, v] of Object.entries(tokens))
      if (v) localStorage.setItem(k, v);
  }, tokens);
  const p2 = await second.newPage();
  await p2.goto(base);
  await p2.getByText("Tiến độ đã đồng bộ", { exact: true }).waitFor();
  assert.equal(
    await p2.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find(
              (k) => k.startsWith("user:") && k.endsWith(":n3_settings"),
            ),
          ),
        ).dailyGoal,
    ),
    35,
  );
  await second.close();
  // A competing revision must not silently replace local work or the server.
  const prior = (await api("/users/me/learning")).data;
  assert.equal(
    (
      await api("/users/me/learning", {
        method: "PUT",
        body: {
          ...prior,
          bookmarks: [
            {
              itemId: "server-only",
              itemType: "grammar",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      })
    ).status,
    200,
  );
  await nav("Từ vựng");
  await button("Lưu từ").click();
  await page.getByRole("alert").filter({ hasText: "thiết bị khác" }).waitFor();
  assert.equal(
    (await api("/users/me/learning")).data.bookmarks[0].itemId,
    "server-only",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await button("Dùng bản tài khoản, giữ bản sao cục bộ").click();
  await page.getByText("Tiến độ đã đồng bộ", { exact: true }).waitFor();
  assert.ok(
    await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) =>
          k.endsWith(":learning_conflict_backup") &&
          JSON.parse(localStorage.getItem(k)).data.bookmarks.length === 1,
      ),
    ),
  );
  // Offline write stays queued and retry acknowledges it only after the API succeeds.
  await nav("Từ vựng");
  await context.route("**/api/v1/users/me/learning", (route) =>
    route.request().method() === "PUT" ? route.abort() : route.continue(),
  );
  await button("Lưu từ").click();
  await button("Thử đồng bộ lại").waitFor();
  await context.unroute("**/api/v1/users/me/learning");
  await button("Thử đồng bộ lại").click();
  await page.getByText("Tiến độ đã đồng bộ", { exact: true }).waitFor();
  assert.equal((await api("/users/me/learning")).data.bookmarks.length, 2);
  await nav("Thẻ học");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Quy tắc nhập tệp" }).click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.ok(
    await button("Import").evaluate(
      (el) => el.getBoundingClientRect().right <= innerWidth,
    ),
  );
  await mkdir("/tmp/n3-srs-verification", { recursive: true });
  await page.screenshot({
    path: "/tmp/n3-srs-verification/mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS real MySQL/API/browser: Guest consent migration, dedupe import, paging, review survives content edit, settings/learning sync, second-device restore, mobile rules.",
  );
} catch (e) {
  await mkdir("/tmp/n3-srs-verification", { recursive: true });
  await page.screenshot({
    path: "/tmp/n3-srs-verification/failure.png",
    fullPage: true,
  });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}
