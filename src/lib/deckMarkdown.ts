// Pasted text -> rows for the shared column-mapping pipeline (see docs/deck-format-v1.md §6.3).
export interface MarkdownRows { name: string; rows: string[][] }

const LINE_SEPARATOR = ' :: ';

export function parseMarkdownRows(input: string): MarkdownRows {
  const lines = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  let name = '';
  while (lines.length && !lines[0].trim()) lines.shift();
  if (/^#\s+\S/.test(lines[0] ?? '')) name = lines.shift()!.replace(/^#\s+/, '').trim();
  const body = lines.filter(line => line.trim());
  if (!body.length) throw new Error('Nội dung trống.');
  if (body.every(line => line.includes(LINE_SEPARATOR))) {
    const parts = body.map(line => line.split(LINE_SEPARATOR).map(part => part.trim()));
    const width = Math.min(4, Math.max(...parts.map(row => row.length)));
    // The synthetic header lets the shared header detection pick the right fields.
    return { name, rows: [['front', 'back', 'reading', 'note'].slice(0, width), ...parts.map(row => [...row.slice(0, width - 1), row.slice(width - 1).join(LINE_SEPARATOR)].slice(0, width))] };
  }
  const blocks: string[][] = [[]];
  for (const line of lines) {
    if (!line.trim() || /^-{3,}\s*$/.test(line.trim())) { if (blocks.at(-1)!.length) blocks.push([]); }
    else blocks.at(-1)!.push(line);
  }
  const records: Array<Record<string, string>> = [];
  const header: string[] = [];
  let currentType = '';
  for (const block of blocks.filter(item => item.length)) {
    const record: Record<string, string> = {};
    const examples: Array<{ japanese: string; reading: string; meaning: string }> = [];
    let last = '';
    for (const line of block) {
      const match = line.match(/^([^:：\n]{1,40})[:：]\s?(.*)$/);
      if (!match) {
        if (!last) throw new Error(`Dòng "${line.trim().slice(0, 40)}" cần có dạng "khóa: giá trị".`);
        record[last] += `\n${line}`;
        continue;
      }
      const key = match[1].trim().toLowerCase();
      if (['example', 'examples', 'ví dụ', 'vi du'].includes(key)) {
        const [japanese = '', reading = '', meaning = ''] = match[2].split('|').map(part => part.trim());
        if (!japanese || !meaning) throw new Error('Ví dụ cần dạng "example: câu tiếng Nhật | cách đọc | nghĩa".');
        examples.push({ japanese, reading, meaning });
        last = '';
      } else { record[key] = match[2]; last = key; }
    }
    if (examples.length) record.examples = JSON.stringify(examples);
    const keys = Object.keys(record);
    // A block holding only "type:" sets the type of the blocks that follow.
    if (keys.length === 1 && keys[0] === 'type') { currentType = record.type.trim(); continue; }
    if (currentType && !record.type) record.type = currentType;
    for (const key of Object.keys(record)) if (!header.includes(key)) header.push(key);
    records.push(record);
  }
  if (!records.length) throw new Error('Không tìm thấy thẻ nào.');
  return { name, rows: [header, ...records.map(record => header.map(key => (record[key] ?? '').trim()))] };
}
