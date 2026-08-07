// ============================================================
// localStorage Persistence Layer
// ============================================================
// All user data (SRS state, bookmarks, settings, progress)
// is persisted in localStorage for zero-backend operation.
// ============================================================

import type {
  SRSCard,
  Bookmark,
  AppSettings,
  StudyDay,
  ThemeMode,
} from '../types';
import { formatDate } from './srs';

const KEYS = {
  SRS_CARDS_VOCAB_V1: 'srs_cards_vocab_v1',
  SRS_CARDS_KANJI_V1: 'srs_cards_kanji_v1',
  SRS_CARDS_GRAMMAR_V1: 'srs_cards_grammar_v1',
  MIGRATED_SRS_V1: 'migrated_srs_v1',
  BOOKMARKS: 'n3_bookmarks',
  SETTINGS: 'n3_settings',
  STUDY_DAYS: 'n3_study_days',
  LAST_PAGE: 'n3_last_page',
  LAST_VOCAB_INDEX: 'n3_last_vocab_index',
  LAST_KANJI_INDEX: 'n3_last_kanji_index',
} as const;

// --- Generic helpers ---

function getJSON<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- SRS Cards ---

export function getSRSKey(deckType: 'vocabulary' | 'kanji' | 'grammar'): string {
  switch (deckType) {
    case 'vocabulary': return KEYS.SRS_CARDS_VOCAB_V1;
    case 'kanji': return KEYS.SRS_CARDS_KANJI_V1;
    case 'grammar': return KEYS.SRS_CARDS_GRAMMAR_V1;
  }
}

export function getSRSCards(deckType: 'vocabulary' | 'kanji' | 'grammar'): SRSCard[] {
  return getJSON<SRSCard[]>(getSRSKey(deckType), []);
}

export function saveSRSCards(deckType: 'vocabulary' | 'kanji' | 'grammar', cards: SRSCard[]): void {
  setJSON(getSRSKey(deckType), cards);
}

export function getSRSCard(cardId: string, deckType: 'vocabulary' | 'kanji' | 'grammar'): SRSCard | undefined {
  return getSRSCards(deckType).find((c) => c.cardId === cardId);
}

export function upsertSRSCard(card: SRSCard): void {
  const cards = getSRSCards(card.deckType);
  const index = cards.findIndex((c) => c.cardId === card.cardId);
  if (index >= 0) {
    cards[index] = card;
  } else {
    cards.push(card);
  }
  saveSRSCards(card.deckType, cards);
}

export function getOrCreateSRSCard(cardId: string, deckType: 'vocabulary' | 'kanji' | 'grammar'): SRSCard {
  const existing = getSRSCard(cardId, deckType);
  if (existing) return existing;

  const newCard: SRSCard = {
    cardId,
    deckType,
    state: 'new',
    easeFactor: 2.5,
    dueDate: new Date().toISOString(),
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
  };
  return newCard;
}

export function migrateV1(): void {
  const isMigrated = getJSON<boolean>(KEYS.MIGRATED_SRS_V1, false);
  if (isMigrated) return;

  const oldCards = getJSON<any[]>('n3_srs_cards', []);
  if (!oldCards || oldCards.length === 0) {
    setJSON(KEYS.MIGRATED_SRS_V1, true);
    return;
  }

  const vocabCards: SRSCard[] = [];
  const kanjiCards: SRSCard[] = [];
  const grammarCards: SRSCard[] = [];

  oldCards.forEach(old => {
    // Map old fields to new schema
    let newState: SRSCard['state'] = 'new';
    if (old.state === 'mastered' || old.state === 'review') newState = 'review';
    else if (old.state === 'learning' || old.state === 'forgotten') newState = 'learning';

    const card: SRSCard = {
      cardId: old.itemId,
      deckType: old.itemType,
      state: newState,
      easeFactor: old.easeFactor ?? 2.5,
      intervalDays: old.interval, // Old interval was in days
      dueDate: old.dueDate || new Date().toISOString(),
      reps: old.repetitions ?? 0,
      lapses: old.state === 'forgotten' ? 1 : 0, // Approximate lapses
      lastReviewedAt: old.lastReview || null,
    };

    if (card.deckType === 'vocabulary') vocabCards.push(card);
    else if (card.deckType === 'kanji') kanjiCards.push(card);
    else if (card.deckType === 'grammar') grammarCards.push(card);
  });

  saveSRSCards('vocabulary', vocabCards);
  saveSRSCards('kanji', kanjiCards);
  saveSRSCards('grammar', grammarCards);
  setJSON(KEYS.MIGRATED_SRS_V1, true);
}

// --- Bookmarks ---

export function getBookmarks(): Bookmark[] {
  return getJSON<Bookmark[]>(KEYS.BOOKMARKS, []);
}

export function saveBookmarks(bookmarks: Bookmark[]): void {
  setJSON(KEYS.BOOKMARKS, bookmarks);
}

export function toggleBookmark(
  itemId: string,
  itemType: 'vocabulary' | 'kanji' | 'grammar'
): boolean {
  const bookmarks = getBookmarks();
  const index = bookmarks.findIndex((b) => b.itemId === itemId);
  if (index >= 0) {
    bookmarks.splice(index, 1);
    saveBookmarks(bookmarks);
    return false; // removed
  } else {
    bookmarks.push({
      itemId,
      itemType,
      createdAt: new Date().toISOString(),
    });
    saveBookmarks(bookmarks);
    return true; // added
  }
}

export function isBookmarked(itemId: string): boolean {
  return getBookmarks().some((b) => b.itemId === itemId);
}

// --- Settings ---

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  fontSize: 'medium',
  showFurigana: true,
  autoPlayAudio: false,
  dailyGoal: 20,
  reducedMotion: false,
};

export function getSettings(): AppSettings {
  return getJSON<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings: AppSettings): void {
  setJSON(KEYS.SETTINGS, settings);
}

export function updateSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
): AppSettings {
  const settings = getSettings();
  settings[key] = value;
  saveSettings(settings);
  return settings;
}

// --- Study Days (Progress tracking) ---

export function getStudyDays(): StudyDay[] {
  return getJSON<StudyDay[]>(KEYS.STUDY_DAYS, []);
}

export function recordStudyActivity(
  cardsReviewed: number,
  newCardsLearned: number,
  accuracy: number,
  timeSpent: number,
  mode: 'flashcard' | 'srs'
): void {
  const days = getStudyDays();
  const today = formatDate(new Date());
  const existing = days.find((d) => d.date === today);

  if (existing) {
    existing.cardsReviewed += cardsReviewed;
    if (mode === 'flashcard') {
      existing.flashcardReviewed = (existing.flashcardReviewed || 0) + cardsReviewed;
    } else {
      existing.srsReviewed = (existing.srsReviewed || 0) + cardsReviewed;
    }
    existing.newCardsLearned += newCardsLearned;
    existing.accuracy =
      (existing.accuracy + accuracy) / 2; // rolling average
    existing.timeSpent += timeSpent;
  } else {
    days.push({
      date: today,
      cardsReviewed,
      flashcardReviewed: mode === 'flashcard' ? cardsReviewed : 0,
      srsReviewed: mode === 'srs' ? cardsReviewed : 0,
      newCardsLearned,
      accuracy,
      timeSpent,
    });
  }

  setJSON(KEYS.STUDY_DAYS, days);
}

// --- Session continuity (Zeigarnik Effect) ---

export function getLastPage(): string {
  return localStorage.getItem(KEYS.LAST_PAGE) || 'dashboard';
}

export function setLastPage(page: string): void {
  localStorage.setItem(KEYS.LAST_PAGE, page);
}

export function getLastVocabIndex(): number {
  return parseInt(localStorage.getItem(KEYS.LAST_VOCAB_INDEX) || '0', 10);
}

export function setLastVocabIndex(index: number): void {
  localStorage.setItem(KEYS.LAST_VOCAB_INDEX, index.toString());
}

// --- Streak calculation ---

export function calculateStreak(): { current: number; longest: number } {
  const days = getStudyDays().sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (days.length === 0) return { current: 0, longest: 0 };

  let current = 0;
  let longest = 0;
  let streak = 0;
  const today = formatDate(new Date());
  const yesterday = formatDate(
    new Date(Date.now() - 86400000)
  );

  // Check if studied today or yesterday (streak still active)
  if (days[0].date !== today && days[0].date !== yesterday) {
    current = 0;
  } else {
    for (let i = 0; i < days.length; i++) {
      const expected = formatDate(
        new Date(Date.now() - i * 86400000)
      );
      // Allow starting from yesterday
      if (i === 0 && days[0].date === yesterday) {
        const expectedYesterday = yesterday;
        if (days[0].date === expectedYesterday) {
          streak++;
          continue;
        }
      }
      if (days[i]?.date === expected) {
        streak++;
      } else {
        break;
      }
    }
    current = streak;
  }

  // Calculate longest streak
  streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1].date);
    const curr = new Date(days[i].date);
    const diff = (prev.getTime() - curr.getTime()) / 86400000;
    if (Math.abs(diff - 1) < 0.1) {
      streak++;
    } else {
      longest = Math.max(longest, streak);
      streak = 1;
    }
  }
  longest = Math.max(longest, streak, current);

  return { current, longest };
}

// --- Theme management ---

export function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'reading', 'high-contrast');
  root.classList.add(theme);

  // Also set color-scheme for native elements
  if (theme === 'dark') {
    root.style.colorScheme = 'dark';
  } else {
    root.style.colorScheme = 'light';
  }
}

// --- Reset ---

export function resetAllData(): void {
  Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
}
