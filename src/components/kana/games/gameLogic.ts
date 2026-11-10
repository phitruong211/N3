import type { KanaScript } from '../kanaData.ts';
import { KANA_POOL, ROMAJI, pickKana, type KanaProgress } from '../kanaProgress.ts';

export type GameId = 'rain' | 'impostor' | 'torii';
export const GAME_SCORES_KEY = 'nhat-kana-games-v1';
export type GameScores = Partial<Record<`${GameId}-${KanaScript}`, number>>;

/** Other common romanisations, so a learner who types "si" for し is not punished for the spelling system. */
const ALIASES: Record<string, string[]> = { shi: ['si'], chi: ['ti'], tsu: ['tu'], fu: ['hu'], wo: ['o'], n: ['nn'] };
export const readingsOf = (ch: string) => [ROMAJI[ch], ...(ALIASES[ROMAJI[ch]] ?? [])];

/**
 * Matches what the player has typed against the characters on screen, most urgent first.
 * A full reading fires at once unless it is also the start of a longer one on screen ("n" while な is falling): then it
 * waits for the next letter or Enter (`force`).
 */
export function resolveTyped<T extends { ch: string }>(input: string, items: readonly T[], force = false): { hit: T | null; wrong: boolean } {
  const typed = input.trim().toLowerCase();
  if (!typed) return { hit: null, wrong: false };
  const hit = items.find(item => readingsOf(item.ch).includes(typed)) ?? null;
  const longer = items.some(item => item !== hit && readingsOf(item.ch).some(r => r.length > typed.length && r.startsWith(typed)));
  if (hit && (force || !longer)) return { hit, wrong: false };
  return { hit: null, wrong: force || !longer };
}

/** Kana rain difficulty: every 8 hits is a level; drops fall faster, come sooner and crowd the sky. */
export function rainLevel(hits: number) {
  const level = 1 + Math.floor(hits / 8);
  return { level, fallSeconds: Math.max(3.4, 9.5 - level * 0.7), spawnEvery: Math.max(0.75, 2.3 - level * 0.18), maxDrops: Math.min(8, 1 + level) };
}

/** Pairs beginners mix up: the impostor hunt and the torii decoys draw from these. */
export const LOOKALIKES: Record<KanaScript, string[][]> = {
  hira: [['さ', 'ち'], ['ぬ', 'め'], ['わ', 'ね', 'れ'], ['る', 'ろ'], ['は', 'ほ'], ['あ', 'お'], ['き', 'さ'], ['い', 'り'], ['ま', 'も'], ['こ', 'に']],
  kata: [['シ', 'ツ'], ['ソ', 'ン'], ['ス', 'ヌ'], ['ク', 'ケ'], ['コ', 'ユ'], ['チ', 'テ'], ['ウ', 'ワ'], ['ノ', 'メ'], ['タ', 'ク'], ['ナ', 'メ']],
};

export type ImpostorRound = { base: string; target: string; size: number; index: number; seconds: number };

/** One grid: `size × size` copies of `base` with the `target` hidden at `index`. Grids grow to 8 × 8 and the clock shortens. */
export function impostorRound(script: KanaScript, level: number, rand = Math.random): ImpostorRound {
  const group = LOOKALIKES[script][Math.floor(rand() * LOOKALIKES[script].length)];
  const t = Math.floor(rand() * group.length);
  const target = group[t];
  const rest = group.filter((_, i) => i !== t);
  const base = rest[Math.floor(rand() * rest.length)];
  const size = level < 3 ? 4 : level < 6 ? 5 : level < 9 ? 6 : level < 12 ? 7 : 8;
  return { base, target, size, index: Math.floor(rand() * size * size), seconds: Math.max(5, 12 - level * 0.5) };
}

export type GateRow = { gates: string[]; lane: number };

/** Three torii, one carrying the asked character. A lookalike joins the decoys whenever the answer has one. */
export function gateRow(script: KanaScript, progress: KanaProgress, avoid?: string, rand = Math.random): GateRow {
  const pool = KANA_POOL[script];
  const answer = pickKana(pool, progress, avoid, rand);
  const twin = LOOKALIKES[script].filter(g => g.includes(answer)).flat().filter(k => k !== answer);
  const decoys: string[] = [];
  if (twin.length) decoys.push(twin[Math.floor(rand() * twin.length)]);
  while (decoys.length < 2) {
    const k = pool[Math.floor(rand() * pool.length)];
    if (k !== answer && !decoys.includes(k) && ROMAJI[k] !== ROMAJI[answer]) decoys.push(k);
  }
  const lane = Math.floor(rand() * 3);
  const gates = [...decoys];
  gates.splice(lane, 0, answer);
  return { gates, lane };
}

/** Torii run difficulty: every 6 gates is a level and the path speeds up. Speed is board heights per second. */
export function toriiLevel(passed: number) {
  const level = 1 + Math.floor(passed / 6);
  return { level, speed: Math.min(0.5, 0.2 + level * 0.035) };
}
