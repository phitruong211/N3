import type { CardView } from './cards.ts';

export type FreeStudyLimit = 10 | 20 | 50 | 200 | 'all';
export type FreeStudySetup = { mode: 'free'; limit: FreeStudyLimit; order: 'source' | 'shuffle'; lessonKey: string | null };
export type ScheduledStudySetup = { mode: 'scheduled'; sessionMinutes: number };
export type StudySetup = FreeStudySetup | ScheduledStudySetup;
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

function shuffle<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function buildFreeStudyQueue<T extends Pick<CardView, 'tags' | 'position'>>(cards: T[], setup: FreeStudySetup, random = Math.random): T[] {
  const filtered = setup.lessonKey ? cards.filter(card => belongsToLesson(card, setup.lessonKey!)) : cards;
  const ordered = setup.order === 'shuffle' ? shuffle(filtered, random) : [...filtered].sort((a, b) => a.position - b.position);
  const requested = setup.limit === 'all' ? 200 : setup.limit;
  return ordered.slice(0, Math.min(requested, 200));
}

export function serializeStudySetup(setup: StudySetup): URLSearchParams {
  const params = new URLSearchParams({ mode: setup.mode });
  if (setup.mode === 'scheduled') params.set('minutes', String(Math.max(0, Math.min(180, Math.round(setup.sessionMinutes)))));
  else {
    params.set('limit', String(setup.limit));
    params.set('order', setup.order);
    if (setup.lessonKey) params.set('lesson', setup.lessonKey);
  }
  return params;
}

export function parseStudySetup(search: string): StudySetup {
  const params = new URLSearchParams(search);
  if (params.get('mode') === 'scheduled') {
    return { mode: 'scheduled', sessionMinutes: Math.max(0, Math.min(180, Number(params.get('minutes')) || 0)) };
  }
  const rawLimit = params.get('limit');
  const limit: FreeStudyLimit = rawLimit === 'all' ? 'all' : ([10, 20, 50, 200].includes(Number(rawLimit)) ? Number(rawLimit) as 10 | 20 | 50 | 200 : 20);
  return { mode: 'free', limit, order: params.get('order') === 'shuffle' ? 'shuffle' : 'source', lessonKey: params.get('lesson') || null };
}
