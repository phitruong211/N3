import type { DeckType, SRSCard } from '../types/index.ts';

/** What a learner needs to know about one library item: not started, being learned, or known. */
export type LearnState = 'new' | 'learning' | 'known';
export const LEARN_STATES: LearnState[] = ['new', 'learning', 'known'];
export const LEARN_LABEL: Record<LearnState, string> = { new: 'Chưa học', learning: 'Đang học', known: 'Đã thuộc' };

/** One pass over the review cards of a deck type: item id → state. Items with no card are new. */
export function learnStates(cards: readonly Pick<SRSCard, 'cardId' | 'deckType' | 'state'>[], deckType: DeckType): Map<string, LearnState> {
  const out = new Map<string, LearnState>();
  for (const card of cards) {
    if (card.deckType !== deckType || card.state === 'new') continue;
    out.set(card.cardId, card.state === 'review' ? 'known' : 'learning');
  }
  return out;
}

export const stateOf = (states: ReadonlyMap<string, LearnState>, id: string): LearnState => states.get(id) ?? 'new';

/** How many items are in each state, for the filter's counts. */
export function countStates(ids: readonly string[], states: ReadonlyMap<string, LearnState>): Record<LearnState, number> {
  const counts: Record<LearnState, number> = { new: 0, learning: 0, known: 0 };
  for (const id of ids) counts[stateOf(states, id)]++;
  return counts;
}

const LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];
export type LevelProgress = { level: string; total: number; studied: number };

/** Items started (learning or known) per JLPT level, easiest level first, plus the whole. */
export function levelProgress(items: readonly { id: string; level: string }[], states: ReadonlyMap<string, LearnState>): { levels: LevelProgress[]; total: number; studied: number } {
  const byLevel = new Map<string, LevelProgress>();
  for (const item of items) {
    const row = byLevel.get(item.level) ?? { level: item.level, total: 0, studied: 0 };
    row.total++;
    if (stateOf(states, item.id) !== 'new') row.studied++;
    byLevel.set(item.level, row);
  }
  const levels = [...byLevel.values()].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));
  return { levels, total: items.length, studied: levels.reduce((sum, row) => sum + row.studied, 0) };
}
