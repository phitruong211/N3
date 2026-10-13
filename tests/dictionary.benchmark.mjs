import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
const api = process.env.DICTIONARY_TEST_API_URL;
if (!api)
  throw new Error("Set DICTIONARY_TEST_API_URL to the isolated API URL.");
const source = await (await fetch(`${api}/api/v1/dictionary/sources`)).json();
assert.equal(source.ready, true);
assert.ok(source.entryCount > 150000, "Full corpus required.");
const queries = [
  "猫",
  "食べる",
  "ねこ",
  "ﾈｺ",
  "はし",
  "ありがとう",
  "cat",
  "study",
  "食べました",
  "書いて",
  "行った",
  "高かった",
  "勉強しました",
];
const durations = [];
const warmupDurations = [];
async function request(q, measure = true) {
  const start = performance.now();
  const response = await fetch(
    `${api}/api/v1/dictionary/search?${new URLSearchParams({ q, limit: "20" })}`,
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.items.length, `No results for ${q}`);
  if (measure) durations.push(performance.now() - start);
  else warmupDurations.push(performance.now() - start);
}
for (const q of queries) await request(q, false);
for (let batch = 0; batch < 5; batch++)
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      request(queries[(batch * 20 + i) % queries.length]),
    ),
  );
durations.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      entries: source.entryCount,
      version: source.version,
      concurrentClients: 20,
      requests: durations.length,
      p50Ms: Math.round(durations[49]),
      p95Ms: Math.round(durations[94]),
      maxMs: Math.round(durations.at(-1)),
      warmupMaxMs: Math.round(Math.max(...warmupDurations)),
    },
    null,
    2,
  ),
);
