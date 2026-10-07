// ============================================================
// Data Layer — Process raw JSON into typed application data
// ============================================================
// Reads vocabN3.json (rich schema) + vocabN4.json (legacy flat)
// Reads the built-in vocabulary, Kanji and grammar datasets.
// ============================================================

import type {
  VocabItem, KanjiItem, GrammarItem,
  VerbInfo, AlternateReading, Variant, RelatedWord, VocabMetadata,
  LegacyVerbVariant,
} from '../types';
import { normalizeGrammarCard, type GrammarCardData } from './grammarData';

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
}

interface RawVocabN4 {
  kanji?: string;
  phien_am?: string;
  nghia?: string;
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

let _vocabCache: VocabItem[] | null = null;

export async function loadVocabulary(): Promise<VocabItem[]> {
  if (_vocabCache) return _vocabCache;

  const [rawN3, rawN4] = await Promise.all([
    fetchArray<RawVocabN3>('/data/vocabN3.json'),
    fetchArray<RawVocabN4>('/data/vocabN4.json'),
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

  // Process N4 vocabulary (legacy flat format)
  const n4Vocab: VocabItem[] = rawN4.map((item, index) => {
    const rawPhienAm = item.phien_am || '';
    const hvMatch = rawPhienAm.match(/^(.*?)\s*\[([^\]]*)\]\s*$/);
    const phien_am = hvMatch ? hvMatch[1].trim() : rawPhienAm.trim();
    const han_viet = hvMatch ? hvMatch[2].trim() : null;
    const nghia = normalizeNghia(item.nghia);
    const tu = item.kanji || '';

    return {
      id: `vocab-n4-${index}`,
      numericId: index + 10000,
      bai: null,
      tu,
      phien_am,
      han_viet,
      nghia,
      loai_tu: null,
      dong_tu: null,
      cach_doc_khac: [],
      bien_the: [],
      ghi_chu: null,
      tu_lien_quan: [],
      tags: ['N4'],
      metadata: { stt_goc: index, cac_id_trung_lap: [] },

      // Backward-compatible
      kanji: tu,
      hiragana: phien_am,
      meaning: nghia.join(', '),
      type: 'main' as const,
      relatedWords: '',
      lesson: '',
      level: 'N4',
    };
  });

  _vocabCache = [...n3Vocab, ...n4Vocab];
  return _vocabCache;
}

// ─── Kanji ──────────────────────────────────────────────────

interface RawKanjiVocab {
  word?: string;
  tu?: string;
  reading?: string;
  phien_am?: string;
  meaning?: string;
  nghia?: string;
  han_viet?: string;
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

interface RawKanjiN2 {
  kanji?: string;
  han_viet?: string;
  onyomi?: string[];
  kunyomi?: string[];
  words?: RawKanjiVocab[];
}

interface RawKanjiN2File {
  data?: RawKanjiN2[];
}

interface RawKanjiN4Card {
  front?: string;
  back?: string;
  reading?: string;
  han_viet?: string | null;
  note?: string;
  type?: string;
}

function splitKanjiReading(raw: string, label: 'On' | 'Kun'): string[] {
  const match = raw.match(new RegExp(`${label}:\\s*([^/]+)`));
  if (!match) return [];
  return match[1].split(/[、,・]/).map(value => value.trim()).filter(value => value && value !== 'なし');
}

function relatedWordsFromNote(note = ''): RawKanjiVocab[] {
  const words: RawKanjiVocab[] = [];
  note.split(/\r?\n/).slice(1).forEach(line => {
    const match = line.trim().match(/^(.+?)（([^）]+)）:\s*(.+)$/);
    if (match) words.push({ word: match[1], reading: match[2], meaning: match[3] });
  });
  return words;
}

export async function loadKanji(): Promise<KanjiItem[]> {
  if (_kanjiCache) return _kanjiCache;

  const [raw, rawN4, n2Response] = await Promise.all([
    fetchArray<RawKanji>('/data/kanjiN3_vocab_full.json'),
    fetchArray<RawKanjiN4Card>('/data/kanjiN4.json'),
    fetch('/data/kanjiN2.json'),
  ]);
  if (!n2Response.ok) throw new Error(`Could not load /data/kanjiN2.json: ${n2Response.status}`);
  const n2File: RawKanjiN2File = await n2Response.json();
  if (!Array.isArray(n2File.data)) throw new Error('Invalid data in /data/kanjiN2.json: expected data array');

  const n3Kanji: KanjiItem[] = raw.map((item, index) => {
    const kanjiChar = item.tu_chinh || item.kanji || '';
    const hanVietStr = item.han_viet || item.Han_viet || '';
    const rawVocab = item.tu_lien_quan || item.vocabulary || [];

    return {
      id: `kanji-${index}`,
      kanji: kanjiChar,
      hanViet: hanVietStr,
      level: 'N3',
      vocabulary: rawVocab
        .map((v) => ({
          word: v.tu || v.word || '',
          reading: v.phien_am || v.reading || '',
          hanViet: v.han_viet || undefined,
          meaning: v.nghia || v.meaning || '',
        }))
        .filter((v) => v.word.length <= 6 && v.reading.length > 1)
        .slice(0, 5),
    };
  });

  const n2Kanji: KanjiItem[] = n2File.data.map((item, index) => ({
    id: `kanji-n2-${index}`,
    kanji: item.kanji || '',
    hanViet: item.han_viet || '',
    level: 'N2',
    onyomi: item.onyomi || [],
    kunyomi: item.kunyomi || [],
    vocabulary: (item.words || []).map((word) => ({
      word: word.word || '',
      reading: word.reading || '',
      hanViet: word.han_viet || undefined,
      meaning: word.meaning || '',
    })).filter((word) => word.word),
  }));

  const n4Kanji: KanjiItem[] = rawN4.filter(item => item.type === 'KANJI' && item.front).map(item => ({
    id: `kanji-n4-${encodeURIComponent(item.front || '')}`,
    kanji: item.front || '',
    hanViet: item.han_viet || '',
    meaning: item.back || '',
    level: 'N4',
    onyomi: splitKanjiReading(item.reading || '', 'On'),
    kunyomi: splitKanjiReading(item.reading || '', 'Kun'),
    vocabulary: relatedWordsFromNote(item.note).map(word => ({
      word: word.word || '',
      reading: word.reading || '',
      meaning: word.meaning || '',
    })),
  }));

  _kanjiCache = [...n3Kanji, ...n4Kanji, ...n2Kanji];

  return _kanjiCache;
}

// ─── Grammar ────────────────────────────────────────────────

let _grammarCache: GrammarItem[] | null = null;

export async function loadGrammar(): Promise<GrammarItem[]> {
  if (_grammarCache) return _grammarCache;

  const [rawN2, rawN3, rawN4] = await Promise.all([
    fetchArray<GrammarCardData>('/data/grammarN2.json'),
    fetchArray<GrammarCardData>('/data/grammarN3.json'),
    fetchArray<GrammarCardData>('/data/grammarN4.json'),
  ]);
  const n2Grammar = rawN2.map((item, index) => normalizeGrammarCard(item, 'N2', index));
  const n3Grammar = rawN3.map((item, index) => normalizeGrammarCard(item, 'N3', index));

  const n4Grammar: GrammarItem[] = rawN4.map((item, index) => normalizeGrammarCard(item, 'N4', index));

  _grammarCache = [...n2Grammar, ...n3Grammar, ...n4Grammar];
  return _grammarCache;
}
