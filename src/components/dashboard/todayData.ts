export type Daypart = 'dawn' | 'day' | 'dusk' | 'night';
export interface WeekStamp { date: string; label: string; studied: boolean; isToday: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The greeting keeps its original cut-offs; the sky only decides the colour of the hero. */
export function daypart(hour: number): { part: Daypart; greeting: string } {
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const part: Daypart = hour < 5 || hour >= 20 ? 'night' : hour < 11 ? 'dawn' : hour < 17 ? 'day' : 'dusk';
  return { part, greeting };
}

const WEEK_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** Monday to Sunday of the week that contains `today`, marking days with at least one review. */
export function weekStamps(studyDays: { date: string; cardsReviewed: number }[], today: Date): WeekStamp[] {
  const studied = new Set(studyDays.filter(day => day.cardsReviewed > 0).map(day => day.date));
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const todayKey = key(today);
  return WEEK_LABELS.map((label, index) => {
    const date = key(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index));
    return { date, label, studied: studied.has(date), isToday: date === todayKey };
  });
}

/** Same word for the whole local day; null while the list is empty or still loading. */
export function wordOfDay<T>(items: readonly T[], date: Date): T | null {
  if (!items.length) return null;
  const seed = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate();
  return items[(Math.imul(seed, 2654435761) >>> 0) % items.length];
}

/** What the Today page needs from the library, prebuilt by scripts/build-today-summary.mjs so it skips the 2.6 MB download. */
export interface TodaySummary { counts: { vocabulary: number; kanji: number; grammar: number }; words: [string, string, string, string][] }
export interface TodayWord { tu: string; phien_am: string; han_viet: string | null; nghia: string[] }
let summaryRequest: Promise<TodaySummary> | null = null;
export function loadTodaySummary(): Promise<TodaySummary> {
  summaryRequest ??= fetch('/data/today.json').then(response => { if (!response.ok) throw new Error('today.json'); return response.json(); }).catch(error => { summaryRequest = null; throw error; });
  return summaryRequest;
}
export const todayWord = ([tu, phien_am, han_viet, meaning]: TodaySummary['words'][number]): TodayWord => ({ tu, phien_am, han_viet: han_viet || null, nghia: meaning ? [meaning] : [] });
