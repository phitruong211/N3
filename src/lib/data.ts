// ============================================================
// Data Layer — Process raw JSON into typed application data
// ============================================================
// Reads vocabN3.json (rich schema) + vocabN4.json (legacy flat)
// Reads the built-in vocabulary, Kanji and grammar datasets.
// ============================================================

import type {
  VocabItem, KanjiItem, GrammarItem,
  VerbInfo, AlternateReading, Variant, RelatedWord, VocabMetadata,
  LegacyVerbVariant, GrammarExample,
} from '../types';
import { normalizeGrammarCard, type GrammarCardData } from './grammarData.ts';
import { n5CardId } from './n5Decks.ts';

// ─── Helpers ────────────────────────────────────────────────

/** Normalize `nghia` from string or string[] to string[] */
function normalizeNghia(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/,\s*/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

async function fetchArray<T>(path: string): Promise<T[]> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error(`Invalid data in ${path}: expected an array`);
  return data as T[];
}

// ─── Vocabulary ─────────────────────────────────────────────

interface RawVocabN3 {
  note_id?: string;
  id: number;
  stt_goc?: number | string;
  bai?: number;
  tu: string;
  phien_am: string;
  han_viet?: string | null;
  nghia: string | string[];
  loai_tu?: string[] | null;
  dong_tu?: {
    bien_the?: LegacyVerbVariant[];
    nhom?: number | null;
    nhom_nhat?: string | null;
    tu_tha?: string | null;
    tro_tu_goi_y?: string[];
    cap_tuong_ung?: unknown[];
  } | null;
  cach_doc_khac?: AlternateReading[];
  bien_the?: Variant[];
  ghi_chu_dac_biet?: string | null;
  ghi_chu?: string | null;
  tu_lien_quan?: RelatedWord[];
  tags?: string[];
  cac_id_trung_lap?: number[];
  metadata?: VocabMetadata;
  examples?: GrammarExample[];
}


/** Convert old dong_tu.bien_the format into clean VerbInfo */
function normalizeVerbInfo(raw: RawVocabN3['dong_tu']): VerbInfo | null {
  if (!raw) return null;

  // If already in the new format (has nhom directly)
  if (raw.nhom !== undefined || raw.nhom_nhat !== undefined) {
    return {
      nhom: raw.nhom ?? null,
      nhom_nhat: raw.nhom_nhat ?? null,
      tu_tha: raw.tu_tha ?? null,
      tro_tu_goi_y: raw.tro_tu_goi_y ?? [],
      cap_tuong_ung: (raw.cap_tuong_ung as VerbInfo['cap_tuong_ung']) ?? [],
    };
  }

  // Legacy format: dong_tu.bien_the[0] holds the info
  if (raw.bien_the && raw.bien_the.length > 0) {
    const v = raw.bien_the[0];
    let nhom: number | null = null;
    let nhom_nhat: string | null = null;

    if (v.nhom_dong_tu) {
      const match = v.nhom_dong_tu.match(/^(I+|III?)\s*[（(]?(.*?)[）)]?$/);
      if (match) {
        const roman = match[1];
        nhom_nhat = match[2] || null;
        if (roman === 'I') nhom = 1;
        else if (roman === 'II') nhom = 2;
        else if (roman === 'III') nhom = 3;
      }
    }

    return {
      nhom,
      nhom_nhat,
      tu_tha: v.tu_tha_dong_tu ?? null,
      tro_tu_goi_y: v.tro_tu_goi_y ?? [],
      cap_tuong_ung: (v.cap_tu_tuong_ung as VerbInfo['cap_tuong_ung']) ?? [],
    };
  }

  return null;
}

// Shares one in-flight request between concurrent callers (StrictMode, retries); a failure is not cached.
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch(error => { pending = null; throw error; });
    return pending;
  };
}

/** A study-card word (N5, N4, N2): fill the rich schema with empty values. */
function flatVocab(id: string, item: RawStudyCard, index: number, level: 'N5' | 'N4' | 'N2'): VocabItem {
  const nghia = normalizeNghia(item.back);
  return {
    id, noteId: item.note_id, numericId: index + { N5: 20000, N4: 10000, N2: 30000 }[level], bai: null,
    tu: item.front || '', phien_am: item.reading || '', han_viet: item.han_viet || null, nghia,
    loai_tu: null, dong_tu: null, cach_doc_khac: [], bien_the: [], ghi_chu: item.note || null, tu_lien_quan: [],
    examples: item.examples, tags: item.tags?.length ? item.tags : [level], metadata: { stt_goc: index, cac_id_trung_lap: [] },
    // Backward-compatible
    kanji: item.front || '', hiragana: item.reading || '', meaning: nghia.join(', '), type: 'main',
    relatedWords: '', lesson: '', level,
  };
}

let _vocabCache: VocabItem[] | null = null;

export const loadVocabulary = once(loadVocabularyOnce);

async function loadVocabularyOnce(): Promise<VocabItem[]> {
  if (_vocabCache) return _vocabCache;

  const [rawN2, rawN3, rawN4, rawN5] = await Promise.all([
    fetchArray<RawStudyCard>('/data/vocabN2.json'),
    fetchArray<RawVocabN3>('/data/vocabN3.json'),
    fetchArray<RawStudyCard>('/data/vocabN4.json'),
    fetchArray<RawStudyCard>('/data/vocabN5.json'),
  ]);

  // Process N3 vocabulary (rich schema)
  const n3Vocab: VocabItem[] = rawN3.map((item, index) => {
    const nghia = normalizeNghia(item.nghia);
    const dong_tu = normalizeVerbInfo(item.dong_tu);
    const ghi_chu = item.ghi_chu ?? item.ghi_chu_dac_biet ?? null;
    const tu_lien_quan = (item.tu_lien_quan ?? []).map(r => ({
      ...r,
      nghia: normalizeNghia(r.nghia),
    }));
    const tags = item.tags ?? [];
    const bai = item.bai ?? null;
    const lesson = bai != null ? `Bài ${bai}` : '';
    // The source file defines this curriculum deck. Its tags describe the
    // item's other associations; every N3 entry currently includes "N4".
    const level = 'N3';

    return {
      // Core
      id: `vocab-n3-${index}`,
      noteId: item.note_id,
      numericId: item.id,
      bai,
      tu: item.tu,
      phien_am: item.phien_am,
      han_viet: item.han_viet ?? null,
      nghia,
      loai_tu: item.loai_tu ?? null,
      dong_tu,
      cach_doc_khac: item.cach_doc_khac ?? [],
      bien_the: item.bien_the ?? [],
      ghi_chu,
      tu_lien_quan,
      examples: item.examples,
      tags,
      metadata: item.metadata ?? {
        stt_goc: item.stt_goc ?? null,
        cac_id_trung_lap: item.cac_id_trung_lap ?? [],
      },

      // Backward-compatible
      kanji: item.tu,
      hiragana: item.phien_am,
      meaning: nghia.join(', '),
      type: 'main' as const,
      relatedWords: tu_lien_quan.map(r => `${r.tu} (${r.phien_am}): ${Array.isArray(r.nghia) ? r.nghia.join(', ') : r.nghia}`).join(' | '),
      lesson,
      level,
    };
  });

  // Ids stay index-based for N4/N2 and front-based for N5, so saved progress keeps matching.
  const n4Vocab = rawN4.map((item, index) => flatVocab(`vocab-n4-${index}`, item, index, 'N4'));
  const n2Vocab = rawN2.map((item, index) => flatVocab(`vocab-n2-${index}`, item, index, 'N2'));
  const n5Vocab = rawN5.map((item, index) => flatVocab(n5CardId('vocabN5', 'VOCABULARY', item.front || '', item.reading), item, index, 'N5'));

  _vocabCache = [...n3Vocab, ...n4Vocab, ...n5Vocab, ...n2Vocab];
  return _vocabCache;
}

// ─── Kanji ──────────────────────────────────────────────────

interface RawKanjiVocab {
  word?: string;
  reading?: string;
  meaning?: string;
  han_viet?: string;
}

/** The N3 and N2 Kanji files: one entry per character with its readings and words. */
interface RawKanji {
  note_id?: string;
  kanji?: string;
  han_viet?: string;
  meaning?: string;
  onyomi?: string[];
  kunyomi?: string[];
  words?: RawKanjiVocab[];
  note?: string;
  examples?: GrammarExample[];
  level?: 'N3' | 'N2' | 'N1';
  lesson?: string;
  /** Extraction noise kept only so later index-based ids do not shift. */
  hidden?: boolean;
}

let _kanjiCache: KanjiItem[] | null = null;

interface RawStudyCard {
  note_id?: string;
  front?: string;
  back?: string;
  reading?: string;
  han_viet?: string | null;
  note?: string;
  type?: string;
  tags?: string[];
  examples?: GrammarExample[];
}

function splitKanjiReading(raw: string, label: 'On' | 'Kun'): string[] {
  const match = raw.match(new RegExp(`${label}:\\s*([^/]+)`));
  if (!match) return [];
  return match[1].split(/[、,・]/).map(value => value.trim()).filter(value => value && value !== 'なし');
}

function relatedWordsFromNote(note = ''): RawKanjiVocab[] {
  const words: RawKanjiVocab[] = [];
  // N4 lists one word per line after the heading; N5 lists them on the heading line, separated by ';'.
  const [first, ...rest] = note.split(/\r?\n/);
  [...rest, ...first.replace(/^[^:]*:\s*/, '').split(';')].forEach(line => {
    const match = line.trim().match(/^(.+?)（([^）]+)）:\s*(.+)$/);
    if (match) words.push({ word: match[1], reading: match[2], meaning: match[3] });
  });
  return words;
}

export const loadKanji = once(loadKanjiOnce);

async function loadKanjiOnce(): Promise<KanjiItem[]> {
  if (_kanjiCache) return _kanjiCache;

  const [rawN2, rawN3, rawN4, rawN5] = await Promise.all([
    fetchArray<RawKanji>('/data/kanjiN2.json'),
    fetchArray<RawKanji>('/data/kanjiN3.json'),
    fetchArray<RawStudyCard>('/data/kanjiN4.json'),
    fetchArray<RawStudyCard>('/data/kanjiN5.json'),
  ]);

  // An entry may name its own level: the N2 source book also holds N1 Kanji.
  const structured = (items: RawKanji[], level: 'N3' | 'N2', idPrefix: string): KanjiItem[] => items.map((item, index) => ({
    hidden: item.hidden,
    id: `${idPrefix}${index}`,
    noteId: item.note_id,
    kanji: item.kanji || '',
    hanViet: item.han_viet || '',
    meaning: item.meaning || undefined,
    level: item.level || level,
    onyomi: item.onyomi || [],
    kunyomi: item.kunyomi || [],
    vocabulary: (item.words || []).map(word => ({
      word: word.word || '',
      reading: word.reading || '',
      hanViet: word.han_viet || undefined,
      meaning: word.meaning || '',
    })).filter(word => word.word),
    note: item.note || undefined,
    examples: item.examples,
    lesson: item.lesson,
  })).filter(item => !item.hidden).map(({ hidden: _, ...item }) => item);

  // N5 and N4 keep the study-card schema: the note holds the related words, then memory tips.
  const cardKanji = (cards: RawStudyCard[], level: 'N4' | 'N5', id: (item: RawStudyCard) => string): KanjiItem[] =>
    cards.filter(item => item.type === 'KANJI' && item.front).map(item => ({
      id: id(item),
      noteId: item.note_id,
      kanji: item.front || '',
      hanViet: item.han_viet || '',
      meaning: item.back || '',
      level,
      onyomi: splitKanjiReading(item.reading || '', 'On'),
      kunyomi: splitKanjiReading(item.reading || '', 'Kun'),
      vocabulary: relatedWordsFromNote(item.note).map(word => ({
        word: word.word || '',
        reading: word.reading || '',
        meaning: word.meaning || '',
      })),
      note: (item.note || '').split(/\r?\n/).filter(line => line.startsWith('【')).join('\n') || undefined,
      examples: item.examples,
      lesson: item.tags?.find(tag => /^bài\s*\d+/i.test(tag)),
    }));
  // Ids match what each level used before, so saved progress keeps matching.
  _kanjiCache = [
    ...structured(rawN3, 'N3', 'kanji-'),
    ...cardKanji(rawN4, 'N4', item => `kanji-n4-${encodeURIComponent(item.front || '')}`),
    ...structured(rawN2, 'N2', 'kanji-n2-'),
    ...cardKanji(rawN5, 'N5', item => n5CardId('kanjiN5', 'KANJI', item.front || '', item.reading)),
  ];
  return _kanjiCache;
}

// ─── Grammar ────────────────────────────────────────────────

let _grammarCache: GrammarItem[] | null = null;

export const loadGrammar = once(loadGrammarOnce);

async function loadGrammarOnce(): Promise<GrammarItem[]> {
  if (_grammarCache) return _grammarCache;

  const [rawN2, rawN3, rawN4, rawN5] = await Promise.all([
    fetchArray<GrammarCardData>('/data/grammarN2.json'),
    fetchArray<GrammarCardData>('/data/grammarN3.json'),
    fetchArray<GrammarCardData>('/data/grammarN4.json'),
    fetchArray<GrammarCardData>('/data/grammarN5.json'),
  ]);
  const n2Grammar = rawN2.map((item, index) => normalizeGrammarCard(item, 'N2', index));
  const n3Grammar = rawN3.map((item, index) => normalizeGrammarCard(item, 'N3', index));

  const n4Grammar: GrammarItem[] = rawN4.map((item, index) => normalizeGrammarCard(item, 'N4', index));

  // Same ids as the N5 deck, so progress and bookmarks are shared.
  const n5Grammar = rawN5.map((item, index) => ({ ...normalizeGrammarCard(item, 'N5', index), id: n5CardId('grammarN5', 'GRAMMAR', item.front, item.reading) }));

  _grammarCache = [...n2Grammar, ...n3Grammar, ...n4Grammar, ...n5Grammar];
  return _grammarCache;
}
