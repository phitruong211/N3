// ============================================================
// N3 Japanese Learning App — Type Definitions
// ============================================================

// ─── Vocabulary (New Rich Schema) ───────────────────────────

export interface VerbPair {
  tu: string;
  phien_am: string;
  quan_he: string;
}

export interface VerbInfo {
  nhom: number | null;
  nhom_nhat: string | null;
  tu_tha: string | null;
  tro_tu_goi_y: string[];
  cap_tuong_ung: VerbPair[];
}

export interface AlternateReading {
  phien_am: string;
  nghia: string[];
  sac_thai: string | null;
}

export interface Variant {
  tu: string;
  phien_am: string;
  ghi_chu?: string | null;
}

export interface RelatedWord {
  tu: string;
  phien_am: string;
  han_viet?: string | null;
  nghia: string | string[];
  loai_quan_he?: string;
  ghi_chu?: string | null;
  du_lieu_goc?: Record<string, unknown>;
}

export interface VocabMetadata {
  stt_goc: number | string | null;
  cac_id_trung_lap: number[];
}

/** Legacy verb shape found in vocabN3.json `dong_tu.bien_the` */
export interface LegacyVerbVariant {
  tu: string;
  phien_am: string;
  tro_tu_goi_y?: string[];
  nhom_dong_tu?: string;
  tu_tha_dong_tu?: string;
  cap_tu_tuong_ung?: VerbPair[];
  ghi_chu_dac_biet?: string | null;
}

export interface VocabItem {
  // Core identity
  id: string;            // Generated runtime id (e.g. "vocab-n3-42")
  numericId: number;     // Original JSON `id`
  bai: number | null;
  tu: string;            // Kanji / word
  phien_am: string;      // Hiragana reading
  han_viet: string | null;

  // Meanings (always normalized to array)
  nghia: string[];

  // Classification
  loai_tu: string[] | null;

  // Verb-specific
  dong_tu: VerbInfo | null;

  // Alternate readings (same Kanji, different pronunciation)
  cach_doc_khac: AlternateReading[];

  // Written variants (different Kanji, same meaning)
  bien_the: Variant[];

  // Notes
  ghi_chu: string | null;

  // Related words
  tu_lien_quan: RelatedWord[];

  // Tags
  tags: string[];

  // Internal metadata — never render to user
  metadata: VocabMetadata;

  // ─── Backward-compatible derived fields ───
  // These keep existing flashcard/SRS/quiz code working
  kanji: string;         // alias for `tu`
  hiragana: string;      // alias for `phien_am`
  meaning: string;       // joined `nghia` array
  type: 'main' | 'compound';
  relatedWords: string;  // legacy flat string
  lesson: string;
  level: string;
}

// ─── Kanji ──────────────────────────────────────────────────

export interface KanjiVocab {
  word: string;
  reading: string;
  hanViet?: string;
  meaning: string;
}

export interface KanjiItem {
  id: string;
  kanji: string;
  hanViet: string;
  vocabulary: KanjiVocab[];
  level: 'N2' | 'N3';
  onyomi?: string[];
  kunyomi?: string[];
  lesson?: string;
}

// ─── Grammar (New Rich Schema) ──────────────────────────────

export interface GrammarComparison {
  mau: string;
  cap_do_tham_khao: string;
  khac_biet_chinh: string;
}

export interface GrammarUsageVariant {
  mau?: string;
  nghia: string;
  giai_thich?: string;
  goi_y?: string;
  sac_thai?: string;
  vai_tro?: string;
  ghi_chu?: string;
}

export interface GrammarExample {
  japanese: string;
  reading: string;
  meaning: string;
}

export interface GrammarItem {
  // Core identity
  id: string;           // Generated runtime id
  numericId: number;    // Original JSON `id`
  bai: number;
  stt: number;
  cap_do: string;

  // Classification
  nhom_chuc_nang: string;

  // Content
  mau_ngu_phap: string;
  phien_am: string;
  cong_thuc: string;

  // Meaning & explanation
  nghia_cot_loi: string;
  giai_thich_toi_uu: string;

  // Rich sections
  so_sanh_n4_n5: GrammarComparison[];
  cac_cach_dung: GrammarUsageVariant[];
  canh_bao: string[];

  // Examples
  vi_du: GrammarExample[];

  // ─── Backward-compatible derived fields ───
  pattern: string;       // alias for mau_ngu_phap
  reading: string;       // alias for phien_am
  meaning: string;       // alias for nghia_cot_loi
  structure: string;     // alias for cong_thuc
  congThuc: string;
  usage: string;         // alias for giai_thich_toi_uu
  nuance: string;        // alias for giai_thich_toi_uu
  commonMistakes: string;
  comparison: string;
  examples: GrammarExample[];
  lesson: string;
  level: string;
}

// ─── SRS (Spaced Repetition System) ─────────────────────────

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

// ─── Quiz ───────────────────────────────────────────────────

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

// ─── Progress ───────────────────────────────────────────────

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

// ─── Bookmarks ──────────────────────────────────────────────

export interface Bookmark {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  createdAt: string;
  note?: string;
}

// ─── Settings ───────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'reading' | 'high-contrast';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: 'small' | 'medium' | 'large';
  showFurigana: boolean;
  autoPlayAudio: boolean;
  dailyGoal: number;
  reducedMotion: boolean;
}

// ─── Navigation ─────────────────────────────────────────────

export type PageId =
  | 'dashboard'
  | 'vocabulary'
  | 'kanji'
  | 'grammar'
  | 'flashcards'
  | 'anki'
  | 'srs'
  | 'quiz'
  | 'progress'
  | 'search'
  | 'bookmarks'
  | 'settings';

// ─── Search ─────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  type: 'vocabulary' | 'kanji' | 'grammar';
  title: string;
  subtitle: string;
  matchField: string;
}

export type StudyItemType = SearchResult['type'];

export interface NavigationTarget {
  id: string;
  type: StudyItemType;
}
