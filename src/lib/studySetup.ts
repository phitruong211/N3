import type { CardView } from './cards.ts';

export type FreeStudySetup = { mode: 'free'; lessonKey: string | null };
export type StudySetup = FreeStudySetup;
export type LessonOption = { key: string; label: string; count: number };

// "Bài 3" or "Bài 3: Thể て" — the optional title names the lesson in the picker.
const LESSON_TAG = /^b(?:à|a)i\s*(\d+)(?:\s*[:·.-]\s*(.+))?$/iu;

export function lessonKey(tag: string): string | null {
  const match = tag.trim().match(LESSON_TAG);
  return match ? `lesson-${Number(match[1])}` : null;
}

/** Lesson number of a card, or Infinity when it has none, so untagged cards sort last. */
export function lessonNumber(card: Pick<CardView, 'tags'>): number {
  for (const tag of card.tags) { const match = tag.trim().match(LESSON_TAG); if (match) return Number(match[1]); }
  return Infinity;
}

export function lessonOptions(cards: CardView[]): LessonOption[] {
  const counts = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const card of cards) {
    for (const tag of card.tags) {
      const title = tag.trim().match(LESSON_TAG)?.[2];
      const key = lessonKey(tag);
      if (key && title && !titles.has(key)) titles.set(key, title.trim());
    }
    for (const key of new Set(card.tags.map(lessonKey).filter(Boolean) as string[])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count, label: `Bài ${Number(key.slice(7))}${titles.has(key) ? ` · ${titles.get(key)}` : ''}` }))
    .sort((a, b) => Number(a.key.slice(7)) - Number(b.key.slice(7)));
}

export function belongsToLesson(card: Pick<CardView, 'tags'>, key: string): boolean {
  return card.tags.some(tag => lessonKey(tag) === key);
}

export function buildFreeStudyQueue<T extends Pick<CardView, 'tags' | 'position'>>(cards: T[], setup: FreeStudySetup): T[] {
  const filtered = setup.lessonKey ? cards.filter(card => belongsToLesson(card, setup.lessonKey!)) : cards;
  return [...filtered].sort((a, b) => a.position - b.position);
}

export function serializeStudySetup(setup: StudySetup): URLSearchParams {
  const params = new URLSearchParams({ mode: setup.mode });
  if (setup.lessonKey) params.set('lesson', setup.lessonKey);
  return params;
}

export function parseStudySetup(search: string): StudySetup {
  const params = new URLSearchParams(search);
  return { mode: 'free', lessonKey: params.get('lesson') || null };
}
