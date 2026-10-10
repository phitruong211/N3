import type { CardView } from './cards.ts';

export type FreeStudySetup = { mode: 'free'; lessonKey: string | null };
export type StudySetup = FreeStudySetup;
export type LessonOption = { key: string; label: string; count: number };

export function lessonKey(tag: string): string | null {
  const match = tag.trim().match(/^b(?:à|a)i\s*(\d+)$/iu);
  return match ? `lesson-${Number(match[1])}` : null;
}

export function lessonOptions(cards: CardView[]): LessonOption[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const key of new Set(card.tags.map(lessonKey).filter(Boolean) as string[])) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count, label: `Bài ${Number(key.slice(7))}` }))
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
