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
}

// --- Grammar ---
export interface GrammarItem {
  id: string;
  pattern: string;
  meaning: string;
  structure: string;
  usage: string;
  nuance: string;
  commonMistakes: string;
  comparison: string;
  examples: GrammarExample[];
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
export type CardState = 'new' | 'learning' | 'review' | 'mastered' | 'forgotten';

/**
 * Rating options (SM-2 inspired):
 * - again: Complete failure, reset
 * - hard: Correct but difficult
 * - good: Correct with moderate effort
 * - easy: Correct with no effort
 */
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SRSCard {
  /** Unique ID matching the vocab/kanji item */
  itemId: string;
  /** Type of content */
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  /** Current learning state */
  state: CardState;
  /** Ease factor (SM-2), starts at 2.5 */
  easeFactor: number;
  /** Current interval in days */
  interval: number;
  /** Number of consecutive correct reviews */
  repetitions: number;
  /** Next review date (ISO string) */
  dueDate: string;
  /** Last review date (ISO string) */
  lastReview: string | null;
  /** Total number of reviews */
  totalReviews: number;
  /** Total correct answers */
  correctCount: number;
  /** Current learning step (for learning state) */
  learningStep: number;
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
  cardsReviewed: number;
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
