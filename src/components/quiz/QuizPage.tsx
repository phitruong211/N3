// ============================================================
// Quiz Mode
// ============================================================
// Principles:
// - Testing Effect: Frequent quizzing strengthens memory
// - Hick's Law: 4 options per question (optimal choice count)
// - Immediate Feedback: Correct/incorrect shown instantly
// - Dopamine without addiction: Satisfying correct feedback
//   without streaks, points, or leaderboards
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import { generateVocabQuiz, generateKanjiQuiz } from '@/lib/quiz';
import type { QuizQuestion, QuizType } from '@/types';
import { CheckCircle, XCircle, ArrowRight, RotateCcw, Target } from 'lucide-react';

export function QuizPage() {
  const { vocabulary, kanji } = useApp();
  const [sessionActive, setSessionActive] = useState(false);
  const [quizType, setQuizType] = useState<QuizType>('vocab-meaning');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  const startQuiz = useCallback(
    (type: QuizType) => {
      setQuizType(type);
      let qs: QuizQuestion[];
      if (type === 'kanji-meaning' || type === 'kanji-reading') {
        qs = generateKanjiQuiz(kanji, 10, type);
      } else {
        qs = generateVocabQuiz(vocabulary, 10, type);
      }
      setQuestions(qs);
      setSessionActive(true);
    },
    [vocabulary, kanji]
  );

  if (sessionActive && questions.length > 0) {
    return (
      <QuizSession
        questions={questions}
        onFinish={() => setSessionActive(false)}
        onRetry={() => startQuiz(quizType)}
      />
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Quiz</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Test your N3 knowledge with timed multiple-choice active recall quizzes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <QuizTypeCard
          title="Vocabulary → Meaning"
          description="See kanji, choose the Vietnamese meaning"
          count={vocabulary.length}
          onClick={() => startQuiz('vocab-meaning')}
        />
        <QuizTypeCard
          title="Vocabulary → Reading"
          description="See kanji, choose the hiragana reading"
          count={vocabulary.length}
          onClick={() => startQuiz('vocab-reading')}
        />
        <QuizTypeCard
          title="Kanji → Hán Việt"
          description="See kanji, choose the Hán Việt reading"
          count={kanji.length}
          onClick={() => startQuiz('kanji-meaning')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3 shadow-xs">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Cognitive Testing Principles (Active Recall)
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            Active recall through randomized multiple-choice quizzing strengthens neural pathways and prevents the illusion of competence. Quizzes are generated from your current N3 library with distractor options mathematically matched by length and difficulty.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-3 shadow-xs">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Quiz Ergonomics & Shortcuts
          </h3>
          <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center justify-between">
              <span>Select Answer Choice 1 – 4</span>
              <kbd className="kbd-shortcut">1 / 2 / 3 / 4</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Next Question / Continue</span>
              <kbd className="kbd-shortcut">Enter / Space</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span>Exit Active Quiz</span>
              <kbd className="kbd-shortcut">Esc</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizTypeCard({
  title,
  description,
  count,
  onClick,
}: {
  title: string;
  description: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]
        hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]
        transition-colors duration-150 cursor-pointer text-left focus-ring
      "
    >
      <div className="text-sm font-medium text-[var(--color-text)] mb-1">{title}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mb-3">{description}</div>
      <div className="text-xs text-[var(--color-text-tertiary)]">10 questions · {count} items</div>
    </button>
  );
}

// ============================================================
// Quiz Session
// ============================================================

function QuizSession({
  questions,
  onFinish,
  onRetry,
}: {
  questions: QuizQuestion[];
  onFinish: () => void;
  onRetry: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const current = questions[currentIndex];
  const isCorrect = selectedAnswer === current?.correctAnswer;

  // Keyboard: 1-4 for options, Enter/Space for next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (done) {
        if (e.key === 'Escape') onFinish();
        return;
      }

      if (!answered && current) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= current.options.length) {
          handleAnswer(current.options[num - 1]);
        }
      } else if (answered) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answered, done, current, currentIndex]);

  const handleAnswer = useCallback(
    (answer: string) => {
      if (answered) return;
      setSelectedAnswer(answer);
      setAnswered(true);
      if (answer === current.correctAnswer) {
        setCorrectCount((c) => c + 1);
      }
    },
    [answered, current]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      setDone(true);
    }
  }, [currentIndex, questions.length]);

  // Session summary (Peak-End Rule)
  if (done) {
    const accuracy = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 text-center space-y-8 select-none">
        <div
          className={`w-20 h-20 rounded-3xl flex items-center justify-center shadow-sm ${
            accuracy >= 70
              ? 'bg-[var(--color-success-subtle)] border border-[var(--color-success)]/20'
              : 'bg-[var(--color-warning-subtle)] border border-[var(--color-warning)]/20'
          }`}
        >
          <Target
            size={40}
            className={
              accuracy >= 70
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-warning)]'
            }
          />
        </div>
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight">
            Quiz Complete!
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {accuracy >= 80
              ? 'Excellent mastery!'
              : accuracy >= 60
              ? 'Good effort, keep drilling!'
              : 'Keep practicing to reinforce active recall.'}
          </p>
        </div>
        <div className="space-y-1">
          <div className="text-6xl font-semibold text-[var(--color-text)] tracking-tight">
            {accuracy}%
          </div>
          <div className="text-sm font-medium text-[var(--color-text-secondary)]">
            {correctCount} of {questions.length} correct
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer focus-ring shadow-sm"
          >
            <RotateCcw size={16} />
            <span>Try Again</span>
          </button>
          <button
            onClick={onFinish}
            className="px-6 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer focus-ring shadow-xs"
          >
            Back to Quiz Library
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={onFinish}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)] transition-all"
        >
          <span>Exit Quiz</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <div className="w-48 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-[var(--color-success)]">
            {correctCount} correct
          </span>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Active Recall Mode
        </div>
      </div>

      {/* Question canvas */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 max-w-2xl mx-auto w-full space-y-10">
        <div className="text-center space-y-3">
          <div className="font-jp-serif text-5xl md:text-6xl font-semibold text-[var(--color-text)] tracking-tight">
            {current.prompt}
          </div>
          {current.promptSub && (
            <div className="text-sm font-mono text-[var(--color-text-tertiary)]">
              {current.promptSub}
            </div>
          )}
        </div>

        {/* Options grid (Hick's Law: exactly 4 choices) */}
        <div className="w-full space-y-3">
          {current.options.map((option, i) => {
            let optionStyle =
              'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]';

            if (answered) {
              if (option === current.correctAnswer) {
                optionStyle =
                  'bg-[var(--color-success-subtle)] border-[var(--color-success)] text-[var(--color-text)]';
              } else if (option === selectedAnswer && !isCorrect) {
                optionStyle =
                  'bg-[var(--color-error-subtle)] border-[var(--color-error)] text-[var(--color-text)]';
              } else {
                optionStyle =
                  'bg-[var(--color-surface)] border-[var(--color-border)] opacity-40';
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleAnswer(option)}
                disabled={answered}
                className={`
                  w-full flex items-center gap-4 px-5 py-4 rounded-2xl border
                  text-left transition-all duration-150 shadow-xs
                  ${
                    answered
                      ? 'cursor-default'
                      : 'cursor-pointer hover:bg-[var(--color-surface-hover)]'
                  }
                  focus-ring ${optionStyle}
                `}
              >
                <kbd className="kbd-shortcut shrink-0">{i + 1}</kbd>
                <span className="text-base font-medium text-[var(--color-text)] flex-1">
                  {option}
                </span>
                {answered && option === current.correctAnswer && (
                  <CheckCircle
                    size={20}
                    className="text-[var(--color-success)] shrink-0"
                  />
                )}
                {answered &&
                  option === selectedAnswer &&
                  !isCorrect && (
                    <XCircle
                      size={20}
                      className="text-[var(--color-error)] shrink-0"
                    />
                  )}
              </button>
            );
          })}
        </div>

        {/* Feedback pill */}
        {answered && (
          <div className="w-full space-y-4 pt-2">
            <div
              className={`px-5 py-4 rounded-2xl text-sm font-medium flex items-center justify-between border ${
                isCorrect
                  ? 'bg-[var(--color-success-subtle)] border-[var(--color-success)]/20 text-[var(--color-success)]'
                  : 'bg-[var(--color-error-subtle)] border-[var(--color-error)]/20 text-[var(--color-error)]'
              }`}
            >
              <div>
                <strong>{isCorrect ? '✓ Correct!' : '✗ Incorrect'}</strong> —{' '}
                <span className="text-[var(--color-text)] font-normal">
                  {current.explanation}
                </span>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="
                w-full py-4 rounded-2xl font-medium text-sm
                bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]
                transition-colors duration-150 cursor-pointer focus-ring shadow-sm flex items-center justify-center gap-2
              "
            >
              <span>
                {currentIndex < questions.length - 1
                  ? 'Next Question'
                  : 'See Results'}
              </span>
              <kbd className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                Space / Enter
              </kbd>
            </button>
          </div>
        )}
      </div>

      {/* Bottom shortcut bar */}
      <div className="px-8 py-4 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/50 text-center text-xs text-[var(--color-text-tertiary)]">
        <span>Press <kbd className="kbd-shortcut">1-4</kbd> to select option</span>
        <span className="mx-2">·</span>
        <span><kbd className="kbd-shortcut">Space</kbd> / <kbd className="kbd-shortcut">Enter</kbd> to continue</span>
        <span className="mx-2">·</span>
        <span><kbd className="kbd-shortcut">Esc</kbd> to exit</span>
      </div>
    </div>
  );
}
