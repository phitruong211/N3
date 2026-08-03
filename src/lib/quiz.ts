// ============================================================
// Quiz Logic Engine
// ============================================================
// Principles:
// - Testing Effect: Frequent low-stakes quizzing improves retention
// - Adaptive Difficulty: Prioritize weak items
// - Immediate Feedback: Show explanation after each answer
// ============================================================

import type { VocabItem, KanjiItem, QuizQuestion, QuizType } from '../types';

/**
 * Generate quiz questions from vocabulary data.
 * Uses shuffled wrong answers from the same pool for distractors.
 */
export function generateVocabQuiz(
  vocab: VocabItem[],
  count: number = 10,
  type: QuizType = 'vocab-meaning'
): QuizQuestion[] {
  const shuffled = [...vocab].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, vocab.length));

  return selected.map((item, i) => {
    if (type === 'vocab-meaning') {
      // Show kanji → pick meaning
      const correctAnswer = item.meaning;
      const distractors = getDistractors(vocab, item, 'meaning', 3);
      const options = shuffle([correctAnswer, ...distractors]);

      return {
        id: `quiz-${i}`,
        type,
        prompt: item.kanji,
        promptSub: item.hiragana,
        correctAnswer,
        options,
        explanation: `${item.kanji} (${item.hiragana}) = ${item.meaning}`,
        itemId: item.id,
        itemType: 'vocabulary' as const,
      };
    } else {
      // vocab-reading: Show kanji → pick reading
      const correctAnswer = item.hiragana;
      const distractors = getDistractors(vocab, item, 'hiragana', 3);
      const options = shuffle([correctAnswer, ...distractors]);

      return {
        id: `quiz-${i}`,
        type,
        prompt: item.kanji,
        promptSub: item.meaning,
        correctAnswer,
        options,
        explanation: `${item.kanji} = ${item.hiragana} (${item.meaning})`,
        itemId: item.id,
        itemType: 'vocabulary' as const,
      };
    }
  });
}

/**
 * Generate quiz questions from kanji data.
 */
export function generateKanjiQuiz(
  kanji: KanjiItem[],
  count: number = 10,
  type: QuizType = 'kanji-meaning'
): QuizQuestion[] {
  const shuffled = [...kanji].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, kanji.length));

  return selected.map((item, i) => {
    const correctAnswer = item.hanViet;
    const distractors = getKanjiDistractors(kanji, item, 3);
    const options = shuffle([correctAnswer, ...distractors]);

    return {
      id: `quiz-${i}`,
      type,
      prompt: item.kanji,
      promptSub: `Hán Việt`,
      correctAnswer,
      options,
      explanation: `${item.kanji} = ${item.hanViet}`,
      itemId: item.id,
      itemType: 'kanji' as const,
    };
  });
}

function getDistractors(
  vocab: VocabItem[],
  correct: VocabItem,
  field: 'meaning' | 'hiragana',
  count: number
): string[] {
  return vocab
    .filter((v) => v.id !== correct.id && v[field] !== correct[field])
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((v) => v[field]);
}

function getKanjiDistractors(
  kanji: KanjiItem[],
  correct: KanjiItem,
  count: number
): string[] {
  return kanji
    .filter((k) => k.id !== correct.id && k.hanViet !== correct.hanViet)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((k) => k.hanViet);
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
