import { isRomaji, toHiragana } from 'wanakana';

export type LocalKind = 'vocabulary' | 'kanji' | 'grammar';
export type LocalEntry = { kind: LocalKind; id: string; word: string; reading: string; meaning: string; hanViet: string; level: string };
export type LocalSources = {
  vocabulary: readonly { id: string; tu: string; phien_am: string; meaning: string; han_viet: string | null; level: string }[];
  kanji: readonly { id: string; kanji: string; hanViet: string; meaning?: string; level: string }[];
  grammar: readonly { id: string; pattern: string; reading?: string; meaning: string; level: string }[];
};

/** Lower-cased, accent-insensitive Vietnamese, so "hoc" finds "học". */
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/** Flattens the app's own library into searchable entries, each with its Vietnamese meaning. */
export function localEntries(sources: LocalSources): LocalEntry[] {
  return [
    ...sources.vocabulary.map(v => ({ kind: 'vocabulary' as const, id: v.id, word: v.tu, reading: v.phien_am, meaning: v.meaning, hanViet: v.han_viet ?? '', level: v.level })),
    ...sources.kanji.map(k => ({ kind: 'kanji' as const, id: k.id, word: k.kanji, reading: '', meaning: k.meaning ?? '', hanViet: k.hanViet, level: k.level })),
    ...sources.grammar.map(g => ({ kind: 'grammar' as const, id: g.id, word: g.pattern, reading: g.reading ?? '', meaning: g.meaning, hanViet: '', level: g.level })),
  ];
}

/**
 * Matches a dictionary query against the app's library. Japanese and romaji (turned into kana) match the word or its
 * reading; anything else matches Hán Việt or the Vietnamese meaning, accents optional. Exact beats prefix beats
 * contains; ties keep library order. Returns at most `limit` entries.
 */
export function searchLocal(entries: readonly LocalEntry[], query: string, limit = 6): LocalEntry[] {
  const q = query.trim();
  if (!q) return [];
  const kana = isRomaji(q) ? toHiragana(q.toLowerCase()) : q;
  const viet = fold(q);
  const scored: { entry: LocalEntry; score: number; order: number }[] = [];
  entries.forEach((entry, order) => {
    const forms = [entry.word, entry.reading].filter(Boolean);
    let score = 0;
    if (forms.some(form => form === q || form === kana)) score = 100;
    else if (forms.some(form => form.startsWith(q) || form.startsWith(kana))) score = 60;
    else if (fold(entry.hanViet) === viet) score = 55;
    else if (viet.length >= 2 && fold(entry.meaning).split(/[,;()/·]\s*|\s+/).includes(viet)) score = 45;
    else if (viet.length >= 2 && (fold(entry.meaning).includes(viet) || fold(entry.hanViet).includes(viet))) score = 25;
    else if (q.length >= 2 && forms.some(form => form.includes(q))) score = 20;
    if (score) scored.push({ entry, score, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(item => item.entry);
}
