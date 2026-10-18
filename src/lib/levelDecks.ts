import type { DeckKind, DeckLevel } from './deckCatalog.ts';

/** The Han characters the Today library already uses, so a kind reads the same everywhere (語 words, 漢 kanji, 文 sentences). */
export const KIND_GLYPH: Record<DeckKind, string> = { vocabulary: '語', kanji: '漢', grammar: '文' };
/** Degrees. Each seal sits slightly off-true, like a stamp pressed by hand, and no two lean the same way. */
export const KIND_TILT: Record<DeckKind, number> = { vocabulary: -4, kanji: 3, grammar: -2 };

export interface LevelDeckStat { level: DeckLevel; kind: DeckKind; totalCards: number; learnedCount: number; dueCount: number }
export interface LevelSummary { totalCards: number; learnedCount: number; dueCount: number; percent: number }

/** Whole-number progress that never rounds an unfinished deck up to 100% or a started one down to 0%. */
export function learnedPercent(learned: number, total: number): number {
  if (!(total > 0) || !(learned > 0)) return 0;
  if (learned >= total) return 100;
  return Math.min(99, Math.max(1, Math.round(learned / total * 100)));
}

export function summarizeLevel(stats: readonly Pick<LevelDeckStat, 'totalCards' | 'learnedCount' | 'dueCount'>[]): LevelSummary {
  const totalCards = stats.reduce((sum, stat) => sum + stat.totalCards, 0);
  const learnedCount = stats.reduce((sum, stat) => sum + stat.learnedCount, 0);
  const dueCount = stats.reduce((sum, stat) => sum + stat.dueCount, 0);
  return { totalCards, learnedCount, dueCount, percent: learnedPercent(learnedCount, totalCards) };
}

/** One short line under a level tab: what to do now in review mode, otherwise how far along the learner is. */
export function levelTabLabel(summary: LevelSummary, scheduled: boolean): string {
  if (scheduled && summary.dueCount > 0) return `${summary.dueCount.toLocaleString('vi-VN')} cần ôn`;
  if (summary.totalCards === 0) return 'Sắp có';
  return `${summary.percent}% đã học`;
}

/** The remembered level if it still exists; else, when reviewing, the level with the most cards waiting; else the first. */
export function initialLevel(levels: readonly DeckLevel[], saved: unknown, summaries: Partial<Record<DeckLevel, Pick<LevelSummary, 'dueCount'>>>, scheduled: boolean): DeckLevel | undefined {
  if (!levels.length) return undefined;
  if (typeof saved === 'string' && (levels as readonly string[]).includes(saved)) return saved as DeckLevel;
  if (!scheduled) return levels[0];
  let best = levels[0], most = 0;
  for (const level of levels) {
    const due = summaries[level]?.dueCount ?? 0;
    if (due > most) { best = level; most = due; }
  }
  return best;
}

/** Roving-tab target for ←/→/Home/End; wraps like a native tablist. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}
