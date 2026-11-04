import { KANA_ROWS, type KanaScript } from './kanaData.ts';

/** Kana mastery stays on this device: the account sync only carries vocabulary, kanji and grammar cards. */
export const KANA_PROGRESS_KEY = 'nhat-kana-progress-v1';

/** Correct answers in a row before a character counts as learned. */
const MASTERY = 2;

/** Characters answered correctly in a row, keyed by the character itself. */
export type KanaProgress = Record<string, number>;

export const KANA_POOL: Record<KanaScript, string[]> = {
  hira: KANA_ROWS.flatMap(row => row.hira.filter(kana => kana)),
  kata: KANA_ROWS.flatMap(row => row.kata.filter(kana => kana)),
};

/** Reading of every character in both scripts. */
export const ROMAJI: Record<string, string> = Object.fromEntries(
  KANA_ROWS.flatMap(row => (['hira', 'kata'] as const)
    .flatMap(script => row[script].map((kana, i) => [kana, row.romaji[i]] as const).filter(([kana]) => kana))),
);

export const isLearned = (progress: KanaProgress, kana: string) => (progress[kana] ?? 0) >= MASTERY;

export const countLearned = (progress: KanaProgress, pool: readonly string[]) =>
  pool.reduce((n, kana) => n + (isLearned(progress, kana) ? 1 : 0), 0);

/** Total characters learned across both scripts, for the library overview. */
export const kanaLearned = (progress: KanaProgress) => countLearned(progress, [...KANA_POOL.hira, ...KANA_POOL.kata]);

export const KANA_TOTAL = KANA_POOL.hira.length + KANA_POOL.kata.length;

export type Question = { ch: string; romaji: string; choices: string[] };

function shuffled(items: string[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One practice question: a character still being learned, plus three readings it is not. */
export function buildQuestion(pool: string[], progress: KanaProgress, avoid?: string): Question {
  const left = pool.filter(kana => !isLearned(progress, kana) && kana !== avoid);
  // A character you just missed is worth asking twice as often as one you have never answered.
  const weighted = left.flatMap(kana => (progress[kana] ?? 0) === 0 ? [kana, kana] : [kana]);
  const bucket = weighted.length ? weighted : pool.filter(kana => kana !== avoid);
  const ch = bucket[Math.floor(Math.random() * bucket.length)];
  const romaji = ROMAJI[ch];
  const others = shuffled([...new Set(pool.map(kana => ROMAJI[kana]))].filter(reading => reading !== romaji));
  return { ch, romaji, choices: shuffled([romaji, ...others.slice(0, 3)]) };
}
