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
  phien_am?: string;
  nghia?: string;
}

let _vocabCache: VocabItem[] | null = null;

export async function loadVocabulary(): Promise<VocabItem[]> {
  if (_vocabCache) return _vocabCache;

  const [resN3, resN4] = await Promise.all([
    fetch('/data/all_vocab.json?t=' + Date.now()),
    fetch('/data/vocabN4.json?t=' + Date.now()).catch(() => null)
  ]);

  const rawN3: RawVocab[] = await resN3.json();
  const rawN4: RawVocab[] = resN4 ? await resN4.json() : [];

  const n3Vocab = rawN3.map((item, index) => ({
    id: `vocab-n3-${index}`,
    kanji: item['Từ vựng'] || item.kanji || '',
    hiragana: item['Cách đọc (Phiên âm)'] || item.hiragana || item.phien_am || '',
    meaning: item['Ý nghĩa'] || item.meaning || item.nghia || '',
    type: (item.type === 'compound' ? 'compound' : 'main') as 'main' | 'compound',
    relatedWords: item['Từ liên quan (Từ (Phiên âm): Nghĩa)'] || '',
    level: 'N3',
  }));


  const n4Vocab = rawN4.map((item, index) => {
    const rawHiragana = item['Cách đọc (Phiên âm)'] || item.hiragana || item.phien_am || '';
    // Strip Sino-Vietnamese annotations like [GIAN HỢP], [CHẨN], etc.
    const cleanHiragana = rawHiragana.replace(/\s*\[[^\]]*\]/g, '').trim();
    return {
      id: `vocab-n4-${index}`,
      kanji: item['Từ vựng'] || item.kanji || '',
      hiragana: cleanHiragana,
      meaning: item['Ý nghĩa'] || item.meaning || item.nghia || '',
      type: (item.type === 'compound' ? 'compound' : 'main') as 'main' | 'compound',
      relatedWords: item['Từ liên quan (Từ (Phiên âm): Nghĩa)'] || '',
      level: 'N4',
    };
  });

  _vocabCache = [...n3Vocab, ...n4Vocab];

  return _vocabCache;
}

// --- Kanji ---

interface RawKanjiVocab {
  word?: string;
  tu?: string;
  reading?: string;
  phien_am?: string;
  meaning?: string;
  nghia?: string;
}

interface RawKanji {
  kanji?: string;
  tu_chinh?: string;
  han_viet?: string;
  Han_viet?: string;
  vocabulary?: RawKanjiVocab[];
  tu_lien_quan?: RawKanjiVocab[];
}

let _kanjiCache: KanjiItem[] | null = null;

export async function loadKanji(): Promise<KanjiItem[]> {
  if (_kanjiCache) return _kanjiCache;

  const res = await fetch('/data/kanjiN3_vocab_full.json?t=' + Date.now());
  const raw: RawKanji[] = await res.json();

  _kanjiCache = raw.map((item, index) => {
    const kanjiChar = item.tu_chinh || item.kanji || '';
    const hanVietStr = item.han_viet || item.Han_viet || '';
    const rawVocab = item.tu_lien_quan || item.vocabulary || [];

    return {
      id: `kanji-${index}`,
      kanji: kanjiChar,
      hanViet: hanVietStr,
      vocabulary: rawVocab
        .map((v) => ({
          word: v.tu || v.word || '',
          reading: v.phien_am || v.reading || '',
          meaning: v.nghia || v.meaning || '',
        }))
        .filter((v) => v.word.length <= 6 && v.reading.length > 1)
        .slice(0, 5),
    };
  });

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
  level?: string;
}

let _grammarCache: GrammarItem[] | null = null;

export async function loadGrammar(): Promise<GrammarItem[]> {
  if (_grammarCache && import.meta.env.PROD) return _grammarCache;

  const [resN3, resN4] = await Promise.all([
    fetch('/data/grammar.json?t=' + Date.now()),
    fetch('/data/grammarN4.json?t=' + Date.now()).catch(() => null)
  ]);
  const rawN3: RawGrammar[] = await resN3.json();
  const rawN4: RawGrammar[] = resN4 ? await resN4.json() : [];

  const processedN3 = rawN3.map(item => ({ ...item, level: item.level || 'N3' }));
  const processedN4 = rawN4.map(item => ({ ...item, level: item.level || 'N4' }));

  const raw = [...processedN3, ...processedN4];

  _grammarCache = raw.map((item, index) => {
    const level = item.level.toLowerCase();
    const pattern = item.mau_ngu_phap || item.pattern || `Grammar #${index + 1}`;
    const reading = item.phien_am || '';
    const meaning = item.y_nghia || item.meaning || '';
    const usage = item.chu_y || item.usage || '';
    const congThuc = item.cong_thuc || '';
    const structure = item.cong_thuc || item.structure || '';
    const nuance = item.nuance || item.chu_y || '';
    const defaultLesson = item.bai !== undefined ? `${level.toUpperCase()} - Bài ${item.bai}` : `${level.toUpperCase()} Grammar`;
    const lesson = item.lesson || defaultLesson;

    const examples = (item.vi_du || item.examples || []).map((ex) => ({
      japanese: ex.nhat || ex.japanese || '',
      reading: ex.reading || '',
      meaning: ex.viet || ex.meaning || '',
    }));

    return {
      id: `grammar-${level}-${item.bai || 0}-${item.stt || index}`,
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
      level: item.level || 'N3',
    };
  });

  return _grammarCache;
}

