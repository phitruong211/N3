// ============================================================
// Quiz Logic Engine
// ============================================================
// Every quiz type is one row in SPECS: which pool it draws from,
// what it shows and what the answer is. Wrong options come from
// the same pool, so they look like plausible answers.
// ============================================================

import type { VocabItem, KanjiItem, GrammarItem, QuizQuestion, QuizType } from '../types';
import { fold, romajiToKana } from './searchIndex.ts';

export interface QuizPools { vocabulary: VocabItem[]; kanji: KanjiItem[]; grammar: GrammarItem[] }

interface Row { id: string; itemType: QuizQuestion['itemType']; prompt: string; sub?: string; answer: string; explanation: string }

const KANA_ONLY = /^[ぁ-んァ-ヶー]+$/;

const vocabRow = (v: VocabItem, prompt: string, sub: string, answer: string): Row =>
  ({ id: v.id, itemType: 'vocabulary', prompt, sub, answer, explanation: `${v.kanji} (${v.hiragana}) = ${v.meaning}` });

const SPECS: Record<QuizType, { typed?: boolean; rows: (pools: QuizPools) => Row[] }> = {
  'vocab-meaning': { rows: p => p.vocabulary.map(v => vocabRow(v, v.kanji, v.hiragana, v.meaning)) },
  // A kana-only word would show its own answer.
  'vocab-reading': { rows: p => p.vocabulary.filter(v => v.kanji !== v.hiragana).map(v => vocabRow(v, v.kanji, v.meaning, v.hiragana)) },
  'vocab-reverse': { rows: p => p.vocabulary.map(v => vocabRow(v, v.meaning, 'Chọn từ tiếng Nhật', v.kanji)) },
  'typing': { typed: true, rows: p => p.vocabulary.filter(v => v.kanji !== v.hiragana && KANA_ONLY.test(v.hiragana)).map(v => vocabRow(v, v.kanji, v.meaning, v.hiragana)) },
  'kanji-meaning': { rows: p => p.kanji.map(k => ({ id: k.id, itemType: 'kanji', prompt: k.kanji, sub: 'Hán Việt', answer: k.hanViet, explanation: `${k.kanji} = ${k.hanViet}` })) },
  'grammar-meaning': { rows: p => p.grammar.map(g => ({ id: g.id, itemType: 'grammar', prompt: g.pattern, sub: 'Chọn nghĩa', answer: g.meaning, explanation: `${g.pattern} = ${g.meaning}` })) },
  // Read a sentence, name the pattern it uses.
  'grammar-sentence': { rows: p => p.grammar.filter(g => g.examples[0]?.japanese).map(g => ({
    id: g.id, itemType: 'grammar', prompt: g.examples[0].japanese, sub: g.examples[0].meaning, answer: g.pattern,
    explanation: `${g.pattern} = ${g.meaning}`,
  })) },
};

export const isTypedQuiz = (type: QuizType) => Boolean(SPECS[type].typed);

/** How many items a quiz type can ask about; the picker shows it and hides types with too few. */
export const quizPoolSize = (type: QuizType, pools: QuizPools) => usable(SPECS[type].rows(pools)).length;

const usable = (rows: Row[]) => rows.filter(row => row.prompt.trim() && row.answer.trim());

export function generateQuiz(type: QuizType, pools: QuizPools, count = 10): QuizQuestion[] {
  const spec = SPECS[type];
  const rows = usable(spec.rows(pools));
  return shuffle(rows).slice(0, count).map((row, i) => {
    // Distinct wrong answers only: two identical options would make the question unfair.
    const wrong = spec.typed ? [] : [...new Set(shuffle(rows).map(other => other.answer).filter(answer => answer !== row.answer))].slice(0, 3);
    return {
      id: `quiz-${i}`, type, prompt: row.prompt, promptSub: row.sub, correctAnswer: row.answer,
      options: spec.typed ? [] : shuffle([row.answer, ...wrong]),
      explanation: row.explanation, itemId: row.id, itemType: row.itemType,
    };
  });
}

/** A typed reading is right in hiragana, katakana or romaji ("gakkou" = がっこう). */
export function isTypedCorrect(input: string, correct: string): boolean {
  const typed = fold(input.trim().replace(/\s+/g, ''));
  if (!typed) return false;
  const want = fold(correct);
  return typed === want || romajiToKana(typed) === want;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
