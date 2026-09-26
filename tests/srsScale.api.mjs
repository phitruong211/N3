// Run only against a disposable local API/database. Leaves synthetic records for inspection.
import assert from "node:assert/strict";
const base = process.env.SRS_API_URL || "http://127.0.0.1:8080/api/v1";
async function request(path, token, method = "GET", body, headers = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  return {
    status: r.status,
    data: text ? JSON.parse(text) : null,
    bytes: Buffer.byteLength(text),
  };
}
const account = async () => {
  const r = await request("/auth/register", null, "POST", {
    email: `scale-${crypto.randomUUID()}@example.test`,
    password: "Local-test-only-123",
    displayName: "Scale test",
  });
  assert.equal(r.status, 201);
  return r.data.accessToken;
};
const token = await account();
const stranger = await account();
const cards = Array.from({ length: 20000 }, (_, i) => ({
  front: `語 ${i}`,
  back: `Nghĩa ${i}`,
  kind: "VOCABULARY",
  position: i,
  extraData: { sourceSheet: "Large sheet", sourceRef: "scale.csv" },
}));
const body = { name: "20k scale", sourceType: "IMPORT", cards };
const started = Date.now();
const created = await request("/decks/import", token, "POST", body, {
  "Idempotency-Key": "scale-import",
});
assert.equal(created.status, 201, JSON.stringify(created.data).slice(0, 400));
const id = created.data.deck.id;
assert.equal(created.data.deck.cardCount, 20000);
const listing = await request("/decks?page=0&size=20", token);
assert.equal(listing.data.content[0].cardCount, 20000);
assert.equal(listing.data.content[0].cards, undefined);
assert.ok(listing.bytes < 10000);
const page = await request(`/decks/${id}/cards?page=399&size=50`, token);
assert.equal(page.data.content.length, 50);
assert.equal(page.data.totalElements, 20000);
assert.equal(page.data.content[0].sourceSheet, "Large sheet");
const retry = await request("/decks/import", token, "POST", body, {
  "Idempotency-Key": "scale-import",
});
assert.equal(retry.data.deck.id, id);
assert.equal(
  (await request("/decks?page=0&size=20", token)).data.totalElements,
  1,
);
assert.equal(
  (await request(`/decks/${id}/cards?page=0&size=50`, stranger)).status,
  404,
);
assert.equal(
  (
    await request(`/cards/${page.data.content[0].id}`, stranger, "PATCH", {
      front: "unauthorized",
    })
  ).status,
  404,
);
assert.equal(
  (
    await request(
      "/decks/import",
      token,
      "POST",
      { ...body, cards: [...cards, cards[0]] },
      { "Idempotency-Key": "too-many" },
    )
  ).status,
  400,
);
const oversized = await fetch(base + "/decks/import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": "too-big",
  },
  body: " ".repeat(20 * 1024 * 1024 + 1),
});
assert.equal(oversized.status, 413);
for (let i = 0; i < 21; i++)
  assert.equal(
    (await request("/decks", token, "POST", { name: `Empty ${i}`, cards: [] }))
      .status,
    201,
  );
const second = await request("/decks?page=1&size=20&sort=name,asc", token);
assert.equal(second.data.totalElements, 22);
assert.equal(second.data.content.length, 2);
const cors = await fetch(base + "/decks/reorder", {
  method: "OPTIONS",
  headers: {
    Origin: "http://127.0.0.1:5173",
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "authorization,content-type",
  },
});
assert.equal(cors.status, 200);
assert.ok(cors.headers.get("access-control-allow-methods").includes("PUT"));
console.log(
  `PASS 20,000 cards + 22 decks: metadata ${listing.bytes} bytes, page 399=50 cards, idempotent retry, ownership, 20k/20MB rejection, CORS PUT (${((Date.now() - started) / 1000).toFixed(1)}s).`,
);
