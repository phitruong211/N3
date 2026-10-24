import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const files = async dir => (await readdir(dir, { withFileTypes: true, recursive: true }))
  .filter(entry => entry.isFile() && /\.(css|tsx)$/.test(entry.name))
  .map(entry => join(entry.parentPath, entry.name));

test('easing curves live in index.css tokens only, and the lingering-transform rule holds', async () => {
  const src = new URL('../src', import.meta.url).pathname;
  const index = join(src, 'index.css');
  const stray = [], bothFill = [];
  for (const file of await files(src)) {
    const text = await readFile(file, 'utf8');
    if (file !== index) for (const line of text.split('\n')) if (/cubic-bezier\(/.test(line)) stray.push(`${file.replace(src, 'src')}: ${line.trim().slice(0, 90)}`);
    // rise-in/page-turn must fill `backwards`: a `both` fill keeps a transform that traps fixed descendants (the study session).
    for (const line of text.split('\n')) if (/animation:[^;]*(rise-in|page-turn)[^;]*\sboth/.test(line)) bothFill.push(`${file.replace(src, 'src')}: ${line.trim().slice(0, 90)}`);
  }
  assert.deepEqual(stray, [], 'use var(--ease-out), var(--ease-soft) or var(--ease-stamp)');
  assert.deepEqual(bothFill, []);
});
