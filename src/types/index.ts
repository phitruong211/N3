// ============================================================
// N3 Japanese Learning App — Type Definitions
// ============================================================

// --- Vocabulary ---
export interface VocabItem {
  id: string;
  kanji: string;
  hiragana: string;
  meaning: string;
  type: 'main' | 'compound';
  relatedWords?: string;
  lesson?: string;
  level?: string;
}

// --- Kanji ---
export interface KanjiVocab {
  word: string;
  reading: string;
  meaning: string;
}

export interface KanjiItem {
  id: string;
  kanji: string;
  hanViet: string;
  vocabulary: KanjiVocab[];
  lesson?: string;
}

// --- Grammar ---
export interface GrammarItem {
  id: string;
  pattern: string;
  reading?: string;
  meaning: string;
  structure: string;
  congThuc?: string;
  usage: string;
  nuance: string;
  commonMistakes: string;
  comparison: string;
  examples: GrammarExample[];
  lesson?: string;
  level?: string;
}

export interface GrammarExample {
  japanese: string;
  reading: string;
  meaning: string;
}

// --- SRS (Spaced Repetition System) ---

/**
 * Card states following Anki's model:
 * - new: Never studied
 * - learning: Currently in short-term learning
 * - review: In long-term review cycle
 * - mastered: Interval > 30 days, consistently correct
 * - forgotten: Failed during review, needs relearning
 */
export type CardState = 'new' | 'learning' | 'review' | 'relearning';

/**
 * Rating options (SM-2 inspired):
 * - again: Complete failure, reset
 * - hard: Correct but difficult
 * - good: Correct with moderate effort
 * - easy: Correct with no effort
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type DeckType = 'vocabulary' | 'kanji' | 'grammar';

export interface SRSCard {
  cardId: string;
  deckType: DeckType;
  state: CardState;
  easeFactor: number;
  intervalMinutes?: number;
  intervalDays?: number;
  dueDate: string;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
}

// --- Quiz ---
export type QuizType =
  | 'vocab-meaning'     // Show kanji → pick meaning
  | 'vocab-reading'     // Show kanji → pick reading
  | 'kanji-reading'     // Show kanji → pick reading
  | 'kanji-meaning'     // Show kanji → pick meaning
  | 'typing'            // Type the answer
  | 'sentence-completion';

export interface QuizQuestion {
  id: string;
  type: QuizType;
  prompt: string;
  promptSub?: string;
  correctAnswer: string;
  options: string[];
  explanation: string;
  itemId: string;
  itemType: 'vocabulary' | 'kanji';
}

export interface QuizResult {
  questionId: string;
  correct: boolean;
  userAnswer: string;
  timeSpent: number; // ms
}

export interface QuizSession {
  id: string;
  type: QuizType;
  questions: QuizQuestion[];
  results: QuizResult[];
  startTime: string;
  endTime: string | null;
  accuracy: number;
}

// --- Progress ---
export interface StudyDay {
  date: string; // YYYY-MM-DD
  cardsReviewed: number; // Legacy total
  flashcardReviewed?: number; // New: flashcard specific
  srsReviewed?: number; // New: Anki specific
  newCardsLearned: number;
  accuracy: number;
  timeSpent: number; // minutes
}

export interface ProgressStats {
  totalVocab: number;
  totalKanji: number;
  masteredVocab: number;
  masteredKanji: number;
  currentStreak: number;
  longestStreak: number;
  totalReviews: number;
  averageAccuracy: number;
  studyDays: StudyDay[];
}

// --- Bookmarks ---
export interface Bookmark {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  createdAt: string;
  note?: string;
}

// --- Settings ---
export type ThemeMode = 'light' | 'dark' | 'reading' | 'high-contrast';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: 'small' | 'medium' | 'large';
  showFurigana: boolean;
  autoPlayAudio: boolean;
  dailyGoal: number;
  reducedMotion: boolean;
}

// --- Navigation ---
export type PageId =
  | 'dashboard'
  | 'vocabulary'
  | 'kanji'
  | 'grammar'
  | 'flashcards'
  | 'srs'
  | 'quiz'
  | 'progress'
  | 'search'
  | 'bookmarks'
  | 'settings';

// --- Search ---
export interface SearchResult {
  id: string;
  type: 'vocabulary' | 'kanji' | 'grammar';
  title: string;
  subtitle: string;
  matchField: string;
}
