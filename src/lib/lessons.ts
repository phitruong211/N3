// N4–N3 grammar lessons (src/data/lessons/n4n3.json): one group per topic, each pattern with how it connects, meaning and an example.

export interface LessonPattern { id: number; lv: string; n: string; note: string; f: string; m: string; jp: string; vn: string; sub: string; hl?: string }
export interface LessonPair { t: string; d: string; e: string }
export interface LessonGroup {
  id: number; name: string; short: string; intro: string; pic: string[]; note: [string, string][];
  pats: LessonPattern[]; keigo: string[][]; pairs: LessonPair[]; remember: string; tip: string;
}

/** "〜たとたん(に) / 〜最中に" -> ["たとたん", "最中に"], longest first: the pieces worth finding in an example. */
function keys(name: string): string[] {
  return name.replace(/\(.*?\)/g, '').split(/\s*\/\s*|〜|\s+\+\s+/).map(s => s.replace(/[〜\s]|N$/g, ''))
    .filter(s => s.length > 1 && /[ぁ-んァ-ン一-龯]/.test(s)).sort((a, b) => b.length - a.length);
}

/** Where the pattern sits in its example, as [start, length]. Conjugated forms match on a shared head or tail. */
export function locate(p: Pick<LessonPattern, 'n' | 'jp' | 'hl'>): [number, number] | null {
  if (p.hl) { const i = p.jp.indexOf(p.hl); if (i >= 0) return [i, p.hl.length]; }
  for (const k of keys(p.n)) {
    const min = Math.max(2, Math.ceil(k.length * .5));
    for (let n = k.length; n >= min; n--) for (const s of [k.slice(0, n), k.slice(k.length - n)]) {
      const i = p.jp.indexOf(s);
      if (i >= 0) return [i, s.length];
    }
  }
  return null;
}

export type FormPart = { text: string; kind?: 'v' | 'n' | 'a' | 'p' };
/** "Vた + とたん(に)" -> the slots (V, N, A, 普通形…) as chips, the rest as plain text. */
export function formParts(f: string): FormPart[] {
  const parts: FormPart[] = [];
  let last = 0;
  for (const m of f.matchAll(/(普通形|名詞修飾形|丁寧形|V[^\s/;,+()（）]*|N[のにでだ]?(?=[\s/;,+)]|$)|A[いなく][^\s/;,+()]*|Aければ|Aかった)/g)) {
    if (m.index > last) parts.push({ text: f.slice(last, m.index) });
    parts.push({ text: m[0], kind: m[0][0] === 'V' ? 'v' : m[0][0] === 'N' ? 'n' : m[0][0] === 'A' ? 'a' : 'p' });
    last = m.index + m[0].length;
  }
  if (last < f.length) parts.push({ text: f.slice(last) });
  return parts;
}
