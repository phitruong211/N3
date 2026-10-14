// Give source rows permanent note IDs without changing study/progress IDs or formatting.
// Run when adding a dataset; retain note_id when editing or moving an existing row.
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const files = ['vocabN3', 'vocabN4', 'kanjiN3_vocab_full', 'kanjiN4', 'kanjiN2', 'grammarN2', 'grammarN3', 'grammarN4', 'vocabN5', 'kanjiN5', 'grammarN5'];
const known = new Set();
for (const name of files) {
  const url = new URL(`../public/data/${name}.json`, import.meta.url);
  let source = await readFile(url, 'utf8');
  const parsed = JSON.parse(source); const rows = Array.isArray(parsed) ? parsed : parsed.data;
  const start = Array.isArray(parsed) ? source.indexOf('[') : source.indexOf('[', source.indexOf('"data"'));
  const offsets = []; let depth = 0; let quoted = false; let escape = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quoted) { if (escape) escape = false; else if (char === '\\') escape = true; else if (char === '"') quoted = false; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === '{' && depth === 1) offsets.push(i);
    if (char === '[' || char === '{') depth++;
    if (char === ']' || char === '}') { depth--; if (depth === 0) break; }
  }
  if (offsets.length !== rows.length) throw Error(`Could not locate all rows in ${name}`);
  for (let i = rows.length - 1; i >= 0; i--) {
    const id = rows[i].note_id || randomUUID();
    if (known.has(id)) throw Error(`Duplicate note identity ${id}`); known.add(id);
    if (rows[i].note_id) continue;
    const offset = offsets[i] + 1;
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const indent = source.slice(offset).match(/^\s*\n([ \t]*)"/)?.[1] || '    ';
    source = `${source.slice(0, offset)}${newline}${indent}"note_id": "${id}",${source.slice(offset)}`;
  }
  await writeFile(url, source);
  console.log(`${name}: ${rows.length} permanent note IDs`);
}
