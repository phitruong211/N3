// ============================================================
// Data Layer — Process raw JSON into typed application data
// ============================================================

import type { VocabItem, KanjiItem, GrammarItem } from '../types';

// --- Vocabulary ---

interface RawVocab {
  kanji?: string;
  hiragana?: string;
  meaning?: string;
  type?: string;
  'Từ vựng'?: string;
  'Cách đọc (Phiên âm)'?: string;
  'Ý nghĩa'?: string;
  'Từ liên quan (Từ (Phiên âm): Nghĩa)'?: string;
}

let _vocabCache: VocabItem[] | null = null;

export async function loadVocabulary(): Promise<VocabItem[]> {
  if (_vocabCache) return _vocabCache;

  const res = await fetch('/data/all_vocab.json?t=' + Date.now());
  const raw: RawVocab[] = await res.json();

  _vocabCache = raw.map((item, index) => ({
    id: `vocab-${index}`,
    kanji: item['Từ vựng'] || item.kanji || '',
    hiragana: item['Cách đọc (Phiên âm)'] || item.hiragana || '',
    meaning: item['Ý nghĩa'] || item.meaning || '',
    type: item.type === 'compound' ? 'compound' : 'main',
    relatedWords: item['Từ liên quan (Từ (Phiên âm): Nghĩa)'] || '',
  }));

  return _vocabCache;
}

// --- Kanji ---

interface RawKanji {
  kanji: string;
  han_viet: string;
  vocabulary: { word: string; reading: string; meaning: string }[];
}

let _kanjiCache: KanjiItem[] | null = null;

export async function loadKanji(): Promise<KanjiItem[]> {
  if (_kanjiCache) return _kanjiCache;

  const res = await fetch('/data/kanjiN3_vocab_full.json?t=' + Date.now());
  const raw: RawKanji[] = await res.json();

  _kanjiCache = raw.map((item, index) => ({
    id: `kanji-${index}`,
    kanji: item.kanji,
    hanViet: item.han_viet,
    vocabulary: item.vocabulary
      .filter((v) => v.word.length <= 6 && v.reading.length > 1)
      .slice(0, 5)
      .map((v) => ({ word: v.word, reading: v.reading, meaning: v.meaning ?? '' })),
  }));

  return _kanjiCache;
}

// --- Grammar (curated N3 patterns) ---

interface RawGrammar {
  bai?: number | string;
  stt?: number | string;
  mau_ngu_phap?: string;
  pattern?: string;
  phien_am?: string;
  cong_thuc?: string;
  y_nghia?: string;
  meaning?: string;
  chu_y?: string;
  usage?: string;
  nuance?: string;
  structure?: string;
  vi_du?: {
    nhat?: string;
    japanese?: string;
    viet?: string;
    meaning?: string;
    reading?: string;
  }[];
  examples?: {
    japanese: string;
    reading: string;
    meaning: string;
  }[];
  commonMistakes?: string;
  comparison?: string;
  lesson?: string;
}

let _grammarCache: GrammarItem[] | null = null;

export async function loadGrammar(): Promise<GrammarItem[]> {
  if (_grammarCache && import.meta.env.PROD) return _grammarCache;

  const res = await fetch('/data/grammar.json?t=' + Date.now());
  const raw: RawGrammar[] = await res.json();

  _grammarCache = raw.map((item, index) => {
    const pattern = item.mau_ngu_phap || item.pattern || `Grammar #${index + 1}`;
    const reading = item.phien_am || '';
    const meaning = item.y_nghia || item.meaning || '';
    const usage = item.chu_y || item.usage || '';
    const congThuc = item.cong_thuc || '';
    const structure = item.cong_thuc || item.structure || '';
    const nuance = item.nuance || item.chu_y || '';
    const lesson = item.lesson || (item.bai !== undefined ? `Bài ${item.bai}` : 'N3 Grammar');

    const examples = (item.vi_du || item.examples || []).map((ex) => ({
      japanese: ex.nhat || ex.japanese || '',
      reading: ex.reading || '',
      meaning: ex.viet || ex.meaning || '',
    }));

    return {
      id: `grammar-${item.bai || 0}-${item.stt || index}`,
      pattern,
      reading,
      meaning,
      structure,
      congThuc,
      usage,
      nuance,
      commonMistakes: item.commonMistakes || '',
      comparison: item.comparison || '',
      examples,
      lesson,
    };
  });

  return _grammarCache;
}

