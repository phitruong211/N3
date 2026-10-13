import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const server = await createServer({
  server: { host: "127.0.0.1", port: 0, open: false },
});
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, "");
const version = "a".repeat(64);
const word = {
  key: "jmdict:10001",
  version,
  writtenForms: ["猫"],
  readings: [{ text: "ねこ", writtenForms: [], kanaOnly: false }],
  senses: [
    {
      id: "b".repeat(64),
      partsOfSpeech: ["noun"],
      writtenForms: [],
      readings: [],
      glosses: [{ text: "cat", language: "en" }],
      notes: [],
    },
    {
      id: "c".repeat(64),
      partsOfSpeech: ["noun"],
      writtenForms: [],
      readings: [],
      glosses: [{ text: "feline", language: "en" }],
      notes: [],
    },
  ],
  common: true,
  source: "JMdict",
  license: "CC BY-SA 4.0",
};
const user = {
  id: "dictionary-learner",
  email: "dictionary@example.test",
  displayName: "Bạn học",
};
const target = {
  id: "late-deck",
  name: "Bộ ở trang hai",
  sourceType: "IMPORT",
  templateConfig: {},
  groupId: "group",
  groupName: "Nhóm JLPT",
};
const searches = [];
const adds = [];
const creates = [];
const errors = [];
let failAdd = true;
let failCreate = true;
let expireNextAdd = false;
let expireVersionNextAdd = false;
let freshWordEnabled = false;
let pagedResults = false;
const freshWord = {
  ...word,
  version: "d".repeat(64),
  senses: [
    {
      ...word.senses[1],
      id: "e".repeat(64),
      glosses: [{ text: "updated feline", language: "en" }],
    },
  ],
};
let browser;
await mkdir("artifacts/dictionary", { recursive: true });
try {
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    reducedMotion: "reduce",
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname.replace("/api/v1", ""));
    const reply = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/dictionary/sources")
      return reply({
        ready: true,
        entryCount: 200000,
        importedAt: "2026-10-13T00:00:00Z",
        version,
        languages: ["ja", "en"],
      });
    if (path === "/dictionary/search") {
      assert.equal(request.headers().authorization, undefined);
      searches.push(url.searchParams.get("q"));
      if (url.searchParams.has("cursor") && pagedResults) {
        pagedResults = false;
        return reply(
          { message: "Dataset updated", code: "DICTIONARY_CURSOR_EXPIRED" },
          409,
        );
      }
      return reply({
        items: [
          {
            word,
            matchType:
              url.searchParams.get("q") === "feline" ? "meaning" : "exact",
            matchedForm: url.searchParams.get("q") === "neko" ? "ねこ" : "猫",
            matchedSenseId:
              url.searchParams.get("q") === "feline" ? word.senses[1].id : null,
          },
        ],
        version,
        query: url.searchParams.get("q"),
        nextCursor: pagedResults ? "fixture-cursor" : null,
      });
    }
    if (path === `/dictionary/words/${word.key}`)
      return reply(freshWordEnabled ? freshWord : word);
    if (path === "/auth/login")
      return reply({
        accessToken: "dictionary-token",
        refreshToken: "dictionary-refresh",
        user,
      });
    if (path === "/auth/me") return reply(user);
    if (path === "/auth/refresh")
      return reply({ message: "Phiên đã hết hạn" }, 401);
    if (path === "/decks/options") {
      assert.equal(request.headers().authorization, "Bearer dictionary-token");
      const q = url.searchParams.get("q");
      return reply(
        q
          ? { items: q.includes("trang") ? [target] : [], hasMore: false }
          : url.searchParams.get("page") === "1"
            ? { items: [target], hasMore: false }
            : {
                items: Array.from({ length: 20 }, (_, i) => ({
                  id: `deck-${i}`,
                  name: `Bộ ${i}`,
                  sourceType: "MANUAL",
                  templateConfig: {},
                  groupId: null,
                })),
                hasMore: true,
              },
      );
    }
    if (path === "/decks/late-deck/metadata") return reply(target);
    if (path === "/decks/new-deck/metadata")
      return reply({ ...target, id: "new-deck", name: "Bộ mới" });
    if (path === "/dictionary/decks") {
      creates.push({
        key: request.headers()["idempotency-key"],
        body: request.postDataJSON(),
      });
      if (failCreate) {
        failCreate = false;
        return reply({ message: "Lỗi mạng tạo bộ thử nghiệm" }, 503);
      }
      return reply({ deckId: "new-deck", name: request.postDataJSON().name });
    }
    if (path.endsWith("/cards") && path.startsWith("/dictionary/words/")) {
      adds.push({
        key: request.headers()["idempotency-key"],
        body: request.postDataJSON(),
      });
      if (expireNextAdd) {
        expireNextAdd = false;
        return reply({ message: "Phiên đã hết hạn" }, 401);
      }
      if (expireVersionNextAdd) {
        expireVersionNextAdd = false;
        freshWordEnabled = true;
        return reply(
          {
            message: "Old dictionary version",
            code: "DICTIONARY_VERSION_EXPIRED",
          },
          409,
        );
      }
      if (failAdd) {
        failAdd = false;
        return reply({ message: "Lỗi mạng lưu thẻ thử nghiệm" }, 503);
      }
      return reply({
        cardId: "card",
        deckId: request.postDataJSON().targetDeckId,
        outcome: adds.length > 2 ? "alreadyExists" : "added",
        cardCount: 1,
        available: true,
      });
    }
    throw new Error(`Unexpected request: ${request.method()} ${path}`);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/dictionary?q=neko`);
  await page.getByRole("heading", { name: "猫", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
      .count(),
    1,
  );
  await page.screenshot({
    path: "artifacts/dictionary/search-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  const auth = page.getByRole("dialog");
  await auth.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await auth
    .getByLabel("Email", { exact: true })
    .fill("dictionary@example.test");
  await auth.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await auth.locator("button.auth-submit").click();
  const dialog = page.getByRole("dialog", {
    name: "Thêm vào bộ thẻ",
    exact: true,
  });
  await dialog.waitFor();
  assert.match(page.url(), /dictionary\?q=neko$/);
  assert.equal(adds.length, 0);
  assert.equal(await dialog.getByLabel("Nghĩa dùng cho thẻ").isVisible(), true);
  await dialog.getByRole("button", { name: "Tiếp", exact: true }).click();
  await dialog.getByRole("button", { name: /Bộ ở trang hai/ }).click();
  await dialog.locator("summary").click();
  await dialog.getByLabel("Nghĩa dùng cho thẻ").selectOption("c".repeat(64));
  await dialog
    .getByLabel("Mặt sau", { exact: true })
    .fill("Con mèo — nghĩa tự chỉnh");
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ ở trang hai", exact: true })
    .click();
  await dialog.getByRole("alert").filter({ hasText: "Lỗi mạng lưu" }).waitFor();
  assert.equal(
    await dialog.getByLabel("Mặt sau", { exact: true }).inputValue(),
    "Con mèo — nghĩa tự chỉnh",
  );
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ ở trang hai", exact: true })
    .click();
  await dialog
    .getByText("Đã thêm 猫 vào Bộ ở trang hai.", { exact: true })
    .waitFor();
  assert.equal(adds.length, 2);
  assert.equal(adds[0].key, adds[1].key);
  assert.deepEqual(adds[0].body, adds[1].body);
  assert.equal(adds[1].body.senseIds[0], "c".repeat(64));
  assert.equal(adds[1].body.targetDeckId, target.id);
  await dialog.getByRole("button", { name: "Tiếp tục tra từ" }).click();
  await page
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  await dialog
    .getByText("Đã chọn:", { exact: false })
    .filter({ hasText: target.name })
    .waitFor();
  await dialog.getByRole("button", { name: "Tạo bộ mới", exact: true }).click();
  await dialog.getByLabel("Tên bộ mới").fill("Bộ mới");
  await dialog.getByLabel("Tên bộ mới").press("Enter");
  await dialog.getByRole("alert").filter({ hasText: "Lỗi mạng tạo" }).waitFor();
  await dialog.getByLabel("Tên bộ mới").press("Enter");
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .waitFor();
  assert.equal(creates.length, 2);
  assert.equal(creates[0].key, creates[1].key);
  await dialog.getByLabel("Các bộ thẻ").waitFor();
  await page.screenshot({
    path: "artifacts/dictionary/add-dialog.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .click();
  await dialog
    .getByText("Từ này đã có trong Bộ mới.", { exact: true })
    .waitFor();
  await dialog.getByRole("button", { name: "Tiếp tục tra từ" }).click();
  const input = page.getByRole("textbox", { name: "Tra từ điển", exact: true });
  const before = searches.length;
  await input.dispatchEvent("compositionstart");
  await input.fill("た");
  await page.waitForTimeout(350);
  assert.equal(searches.length, before);
  await input.fill("たべる");
  await input.dispatchEvent("compositionend");
  await page.waitForFunction(
    () => new URL(location.href).searchParams.get("q") === "たべる",
  );
  await page.getByText("Kết quả cho “たべる”", { exact: true }).waitFor();
  await page.getByRole("link", { name: "猫 ねこ", exact: true }).click();
  await page.getByText("MỤC TỪ · JMdict", { exact: true }).waitFor();
  await page
    .getByRole("link", { name: "Quay lại kết quả", exact: true })
    .click();
  assert.equal(new URL(page.url()).searchParams.get("q"), "たべる");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/dictionary/search-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  await dialog.waitFor();
  await page.screenshot({
    path: "artifacts/dictionary/add-mobile.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: "artifacts/dictionary/search-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  await dialog.locator("summary").click();
  await dialog
    .getByLabel("Mặt sau", { exact: true })
    .fill("Bản nháp khi hết phiên");
  expireNextAdd = true;
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .click();
  const expiredOperation = adds.at(-1);
  await page
    .getByRole("button", { name: "Đăng nhập để chọn bộ", exact: true })
    .click();
  await auth.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await auth
    .getByLabel("Email", { exact: true })
    .fill("dictionary@example.test");
  await auth.getByLabel("Mật khẩu", { exact: true }).fill("password123");
  await auth.locator("button.auth-submit").click();
  await dialog.locator("summary").click();
  assert.equal(
    await dialog.getByLabel("Mặt sau", { exact: true }).inputValue(),
    "Bản nháp khi hết phiên",
  );
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .click();
  await dialog
    .getByText("Từ này đã có trong Bộ mới.", { exact: true })
    .waitFor();
  assert.equal(adds.at(-1).key, expiredOperation.key);
  assert.deepEqual(adds.at(-1).body, expiredOperation.body);
  await dialog.getByRole("button", { name: "Tiếp tục tra từ" }).click();
  await input.fill("feline");
  await page.getByText("Kết quả cho “feline”", { exact: true }).waitFor();
  await page
    .locator(".dictionary-result")
    .getByText("feline", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Thêm vào bộ thẻ", exact: true })
    .click();
  await dialog.locator("summary").click();
  assert.equal(
    await dialog.getByLabel("Mặt sau", { exact: true }).inputValue(),
    "feline",
  );
  await dialog
    .getByLabel("Mặt sau", { exact: true })
    .fill("Nghĩa Việt đã chỉnh trước khi cập nhật");
  expireVersionNextAdd = true;
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .click();
  const oldVersionOperation = adds.at(-1);
  await dialog
    .getByRole("button", {
      name: "Tải lại nghĩa, giữ nội dung đã sửa",
      exact: true,
    })
    .click();
  await dialog
    .getByText("Nghĩa nguồn đã thay đổi.", { exact: false })
    .waitFor();
  assert.equal(
    await dialog.getByLabel("Mặt sau", { exact: true }).inputValue(),
    "Nghĩa Việt đã chỉnh trước khi cập nhật",
  );
  assert.equal(
    await dialog
      .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
      .isDisabled(),
    true,
  );
  await dialog
    .getByRole("checkbox", {
      name: "Tôi đã kiểm tra nghĩa mới và mặt sau của thẻ",
      exact: true,
    })
    .check();
  await dialog
    .getByRole("button", { name: "Thêm vào Bộ mới", exact: true })
    .click();
  await dialog
    .getByText("Từ này đã có trong Bộ mới.", { exact: true })
    .waitFor();
  assert.equal(adds.at(-1).body.datasetVersion, freshWord.version);
  assert.equal(adds.at(-1).body.senseIds[0], freshWord.senses[0].id);
  assert.notEqual(adds.at(-1).key, oldVersionOperation.key);
  await dialog.getByRole("button", { name: "Tiếp tục tra từ" }).click();
  pagedResults = true;
  await input.fill("paged");
  await page.getByText("Kết quả cho “paged”", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Trang tiếp", exact: true }).click();
  await page
    .getByText("Từ điển vừa cập nhật. Kết quả đã được tải lại từ trang đầu.", {
      exact: true,
    })
    .waitFor();
  await page.getByText("Kết quả cho “paged”", { exact: true }).waitFor();
  await page.evaluate(
    ({ word, user }) => {
      sessionStorage.setItem(
        "dictionary:pending-add",
        JSON.stringify({ word, createdAt: Date.now() }),
      );
      sessionStorage.setItem(
        "dictionary:card-draft",
        JSON.stringify({
          ownerId: user.id,
          wordKey: word.key,
          version: word.version,
          updatedAt: Date.now(),
          reading: "reading-no-longer-exists",
          written: "猫",
          senseId: word.senses[0].id,
          front: "猫",
          back: "invalid draft",
          notes: "",
          selected: null,
          newName: "",
          creating: false,
          operation: { payload: "", key: "" },
          creation: { name: "", key: "" },
        }),
      );
    },
    { word, user },
  );
  await page.reload();
  await dialog.waitFor();
  await dialog.locator("summary").click();
  assert.equal(
    await dialog.getByLabel("Mặt sau", { exact: true }).inputValue(),
    "cat",
  );
  await page.setViewportSize({ width: 320, height: 480 });
  const saveButton = dialog.getByRole("button", {
    name: "Thêm vào Bộ mới",
    exact: true,
  });
  await saveButton.waitFor();
  await dialog.evaluate((element) => {
    element.children[1].scrollTop = element.children[1].scrollHeight;
  });
  const bounds = await saveButton.boundingBox();
  assert.ok(
    bounds && bounds.y >= 0 && bounds.y + bounds.height <= 480,
    "Save stays visible after scrolling on a small screen",
  );
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  await page.screenshot({
    path: "artifacts/dictionary/add-dialog-small.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  const opener = page.getByRole("button", {
    name: "Thêm vào bộ thẻ",
    exact: true,
  });
  await opener.click();
  await dialog.waitFor();
  await dialog.getByRole("button", { name: /Thêm vào Bộ mới/ }).waitFor();
  await dialog.evaluate((el) => {
    el.querySelector(".dictionary-selected strong").textContent =
      "Tên bộ rất dài ".repeat(15);
    el.children[2].querySelector("button span").textContent =
      "Thêm vào " + "Tên bộ rất dài ".repeat(15);
  });
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
    true,
  );
  const longNameButton = await dialog
    .locator(":scope > :nth-child(3) button")
    .boundingBox();
  assert.ok(
    longNameButton &&
      longNameButton.height <= 80 &&
      longNameButton.y + longNameButton.height <= 480,
  );
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(
    await opener.evaluate((el) => document.activeElement === el),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Dictionary browser checks passed: public search, login resume, page-two/grouped deck, edited sense, retry keys, create retry, recent deck, IME, Back, mobile.",
  );
} finally {
  await browser?.close();
  await server.close();
}
