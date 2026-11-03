// Small ranked search for the command palette: accent-insensitive Vietnamese, katakana = hiragana, romaji → kana.

export interface SearchField { text: string; weight: number; jp: boolean }
export interface SearchDoc<T> { item: T; fields: SearchField[] }

/** Folds one string for matching without changing its length, so match offsets still fit the original text. */
export function fold(input: string): string {
  let out = '';
  for (const ch of input.toLowerCase()) {
    const code = ch.codePointAt(0)!;
    if (code === 0x111) out += 'd';
    else if (code >= 0xc0 && code < 0x250 || code >= 0x1e00 && code < 0x1f00) out += ch.normalize('NFD')[0];
    else if (code >= 0x30a1 && code <= 0x30f6) out += String.fromCodePoint(code - 0x60);
    else out += ch;
  }
  return out;
}

const MAP = new Map<string, string>();
const put = (romaji: string, kana: string) => MAP.set(romaji, kana);
for (const [c, kana] of [['', 'あいうえお'], ['k', 'かきくけこ'], ['s', 'さしすせそ'], ['t', 'たちつてと'], ['n', 'なにぬねの'], ['h', 'はひふへほ'],
  ['m', 'まみむめも'], ['r', 'らりるれろ'], ['g', 'がぎぐげご'], ['z', 'ざじずぜぞ'], ['d', 'だぢづでど'], ['b', 'ばびぶべぼ'], ['p', 'ぱぴぷぺぽ']]) {
  [...kana].forEach((k, i) => put(c + 'aiueo'[i], k));
}
for (const [r, k] of [['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'], ['wa', 'わ'], ['wo', 'を'], ['shi', 'し'], ['chi', 'ち'], ['tsu', 'つ'], ['fu', 'ふ'], ['ji', 'じ']]) put(r, k);
for (const [prefix, kana] of [['ky', 'き'], ['gy', 'ぎ'], ['ny', 'に'], ['hy', 'ひ'], ['my', 'み'], ['ry', 'り'], ['by', 'び'], ['py', 'ぴ'], ['sh', 'し'], ['ch', 'ち'], ['j', 'じ']]) {
  [['a', 'ゃ'], ['u', 'ゅ'], ['o', 'ょ']].forEach(([v, small]) => put(prefix + v, kana + small));
}

/** Hiragana for a whole romaji word ("taberu" → "たべる"), or null when any part is not valid romaji. */
export function romajiToKana(romaji: string): string | null {
  const s = romaji.toLowerCase();
  if (!/^[a-z'-]+$/.test(s)) return null;
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s[i] === '-') { out += 'ー'; i++; continue; }
    if (s[i] === "'") { i++; continue; }
    if (s[i] === s[i + 1] && /[kstcpghmrgzdbfjw]/.test(s[i])) { out += 'っ'; i++; continue; }
    const hit = [3, 2, 1].map(n => s.slice(i, i + n)).find(chunk => MAP.has(chunk));
    if (hit) { out += MAP.get(hit); i += hit.length; continue; }
    if (s[i] === 'n') { out += 'ん'; i++; continue; }
    return null;
  }
  return out;
}

export function buildDoc<T>(item: T, fields: [text: string | undefined | null, weight: number, jp?: boolean][]): SearchDoc<T> {
  return { item, fields: fields.filter(([text]) => text).map(([text, weight, jp]) => ({ text: fold(text!), weight, jp: Boolean(jp) })) };
}

function bestScore(fields: SearchField[], term: string, jpOnly: boolean): number {
  const loose = term.length > 1 || !/[a-z]/.test(term); // one Latin letter would match nearly everything
  let best = 0;
  for (const f of fields) {
    if (jpOnly && !f.jp) continue;
    const t = f.text;
    const s = t === term ? 100 : t.startsWith(term) ? 80 : t.includes(' ' + term) ? 60 : loose && t.includes(term) ? 40 : 0;
    if (s * f.weight > best) best = s * f.weight;
  }
  return best;
}

/** Folded query words plus, when a word is valid romaji, its kana form (used to match Japanese fields). */
export function queryTerms(query: string): { terms: string[]; kana: (string | null)[] } {
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  return { terms, kana: terms.map(t => { const k = romajiToKana(t); return k && k !== t ? k : null; }) };
}

/** Every word must match; each word scores by its best field (exact > prefix > word start > anywhere). */
export function searchDocs<T>(docs: SearchDoc<T>[], query: string, limit = 30): T[] {
  const { terms, kana } = queryTerms(query);
  if (!terms.length) return [];
  const scored: { item: T; score: number; order: number }[] = [];
  docs.forEach((doc, order) => {
    let score = 0;
    for (let i = 0; i < terms.length; i++) {
      const best = Math.max(bestScore(doc.fields, terms[i], false), kana[i] ? bestScore(doc.fields, kana[i]!, true) : 0);
      if (!best) return;
      score += best;
    }
    scored.push({ item: doc.item, score, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(s => s.item);
}

/** Splits text into plain and matched parts for highlighting; matches are found on the folded text. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const { terms, kana } = queryTerms(query);
  const folded = fold(text);
  const ranges: [number, number][] = [];
  for (const term of [...terms, ...kana.filter((k): k is string => Boolean(k))]) {
    const at = folded.indexOf(term);
    if (at >= 0) ranges.push([at, at + term.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: { text: string; hit: boolean }[] = [];
  let pos = 0;
  for (const [from, to] of ranges) {
    if (from < pos) continue;
    if (from > pos) parts.push({ text: text.slice(pos, from), hit: false });
    parts.push({ text: text.slice(from, to), hit: true });
    pos = to;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}
