import type { JlptLevel } from '../types/index.ts';

// shortcut: the target level is kept on this device only (no server column yet); add it to user_settings when it must follow the account.
export const TARGET_LEVEL_KEY = 'target_level';
export const JLPT_LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

/** The level a page should open on: the learner's target when this page has content for it, otherwise everything. */
export function startLevel<T extends string>(stored: unknown, available: readonly T[]): 'all' | T {
  return available.includes(stored as T) ? stored as T : 'all';
}
