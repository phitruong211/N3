// Grammar guides (src/data/guide/*.md) -> lessons. Each "## " section is one lesson; tables whose
// first column is "Mẫu" or "Cặp" are pattern lists and become flashcards.
import type { CardView } from './cards.ts';
import { grammarCard } from './cards.ts';
import type { GrammarItem } from '../types';

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] };
/** Levels with a guide in src/data/guide. */
export const GUIDE_LEVELS: readonly string[] = ['N4', 'N3'];
export interface GuideLesson { title: string; blocks: GuideBlock[] }
export interface Guide { title: string; lessons: GuideLesson[] }

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());

export function parseGuide(markdown: string): Guide {
  const guide: Guide = { title: '', lessons: [] };
  let blocks: GuideBlock[] = [];
  let open = false; // a blank line ends the current table or list
  for (const raw of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const last = open ? blocks.at(-1) : undefined;
    open = line.startsWith('|') || line.startsWith('- ');
    if (!line) continue;
    if (line.startsWith('# ')) guide.title = line.slice(2).trim();
    else if (line.startsWith('## ')) guide.lessons.push({ title: line.slice(3).trim(), blocks: blocks = [] });
    else if (line.startsWith('### ')) blocks.push({ kind: 'h3', text: line.slice(4).trim() });
    else if (line.startsWith('|')) {
      if (/^\|[\s|:-]+\|$/.test(line)) continue; // the header separator row
      if (last?.kind === 'table') last.rows.push(cells(line));
      else blocks.push({ kind: 'table', head: cells(line), rows: [] });
    } else if (line.startsWith('- ')) {
      if (last?.kind === 'list') last.items.push(line.slice(2));
      else blocks.push({ kind: 'list', items: [line.slice(2)] });
    } else if (guide.lessons.length) blocks.push({ kind: 'p', text: line });
  }
  return guide;
}

export const isPatternTable = (block: GuideBlock) => block.kind === 'table' && /^(Mẫu|Cặp)$/.test(block.head[0]);

/** "〜たとたん(に) / 〜最中だ" -> ["たとたん", "最中だ"]: comparable keys for matching the built-in deck. */
export function patternKeys(pattern: string): string[] {
  return pattern.split('/').map(part => part.replace(/[(（][^)）]*[)）]/g, '').replace(/[〜～\s]/g, '')).filter(Boolean);
}

/**
 * One card per pattern row. A row that names a pattern the built-in deck already has reuses that card
 * (fuller examples, shared progress); the rest are built from the row itself.
 */
export function lessonCards(lessons: GuideLesson[], level: string, grammar: GrammarItem[]): CardView[] {
  const byKey = new Map<string, GrammarItem>();
  for (const item of grammar) if (item.level === level) for (const key of patternKeys(item.pattern)) if (!byKey.has(key)) byKey.set(key, item);
  const deckId = `guide-${level}`;
  const seen = new Set<string>();
  const cards: CardView[] = [];
  for (const lesson of lessons) for (const block of lesson.blocks) if (block.kind === 'table' && isPatternTable(block)) for (const row of block.rows) {
    const match = block.head[0] === 'Mẫu' ? patternKeys(row[0]).map(key => byKey.get(key)).find(Boolean) : undefined;
    const card: CardView = match ? grammarCard(match, deckId, cards.length) : {
      id: `${deckId}-${encodeURIComponent(row[0])}`, deckId, front: row[0], type: 'GRAMMAR', source: 'BUILT_IN', position: cards.length, tags: [level],
      back: rowBack(block.head, row),
    };
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  return cards;
}

/** Meaning first, then the other columns as 【heading】 sections, the way built-in grammar backs read. */
function rowBack(head: string[], row: string[]): string {
  const parts = head.slice(1).map((title, i) => [title, (row[i + 1] ?? '').replace(/\*\*/g, '')]).filter(([, text]) => text);
  const lead = (title: string) => /^(Nghĩa|Khác nhau)/.test(title);
  return [...parts.filter(([title]) => lead(title)).map(([, text]) => text), ...parts.filter(([title]) => !lead(title)).map(([title, text]) => `【${title}】\n${text}`)].join('\n\n');
}

/** "Nhờ có (kết quả tốt)" -> ["Nhờ có", "kết quả tốt"]: a trailing aside reads better as its own note line. */
export function splitNote(text: string): [string, string] {
  const match = text.match(/^(.*\S)\s*\(([^()]+)\)$/);
  return match ? [match[1], match[2]] : [text, ''];
}

/** Pieces of a pattern to mark in its example: "〜ば〜ほど" -> ["ほど"], "〜たとたん(に)" -> ["たとたん"]. One-kana pieces would mark noise. */
export function patternPieces(pattern: string): string[] {
  return pattern.split('/').flatMap(part => part.replace(/[(（][^)）]*[)）]/g, '').split(/[〜～+\s]/)).filter(piece => piece.length > 1 && /^[぀-ヿ一-鿿]+$/.test(piece));
}

/** "Mẹo ôn: …" -> ["Mẹo ôn", "…"]: the guide's tips, shown as call-outs. */
export function calloutParts(text: string): [string, string] | null {
  const match = text.match(/^(Mẹo ôn|Lưu ý[^:]*|Cách nhớ nhanh|Phân biệt nhanh|Quy tắc chọn|Bẫy thường gặp|Mức độ chắc chắn[^:]*):\s*(.*)$/);
  return match ? [match[1], match[2]] : null;
}
