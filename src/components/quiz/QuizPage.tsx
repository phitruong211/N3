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

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import { generateVocabQuiz, generateKanjiQuiz } from '@/lib/quiz';
import type { QuizQuestion, QuizType } from '@/types';
import { CheckCircle, XCircle, RotateCcw, Target } from 'lucide-react';
import { PageHeading } from '@/components/ui/StudyUI';

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
    <div className="study-page">
      <PageHeading eyebrow="LUYỆN TẬP" title="Trắc nghiệm" subtitle="Chọn đáp án để tự kiểm tra điều đã nhớ" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        <QuizTypeCard
          title="Từ vựng → Nghĩa"
          description="Nhìn từ Nhật, chọn nghĩa tiếng Việt"
          count={vocabulary.length}
          onClick={() => startQuiz('vocab-meaning')}
        />
        <QuizTypeCard
          title="Từ vựng → Cách đọc"
          description="Nhìn từ Nhật, chọn cách đọc hiragana"
          count={vocabulary.length}
          onClick={() => startQuiz('vocab-reading')}
        />
        <QuizTypeCard
          title="Kanji → Hán Việt"
          description="Kanji N3/N2 · nhìn chữ, chọn âm Hán Việt"
          count={kanji.length}
          onClick={() => startQuiz('kanji-meaning')}
        />
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
        hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]
        transition-colors duration-150 cursor-pointer text-left focus-ring
      "
    >
      <div className="text-sm font-medium text-[var(--color-text)] mb-1">{title}</div>
      <div className="text-xs text-[var(--color-text-secondary)] mb-3">{description}</div>
      <div className="text-xs text-[var(--color-text-tertiary)]">10 câu · {count} mục</div>
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

  // Keyboard: 1-4 for options, Enter/Space for next
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onFinish(); return; }
      if (done) return;
      if (!answered && current) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= current.options.length) handleAnswer(current.options[num - 1]);
      } else if (answered && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answered, done, current, handleAnswer, handleNext, onFinish]);

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
            Đã hoàn thành
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {accuracy >= 80
              ? 'Bạn đã nhớ rất tốt.'
              : accuracy >= 60
              ? 'Tiếp tục ôn để nhớ chắc hơn.'
              : 'Thử học lại các mục chưa nhớ.'}
          </p>
        </div>
        <div className="space-y-1">
          <div className="text-6xl font-semibold text-[var(--color-text)] tracking-tight">
            {accuracy}%
          </div>
          <div className="text-sm font-medium text-[var(--color-text-secondary)]">
            {correctCount} / {questions.length} câu đúng
          </div>
        </div>
        <div className="flex gap-4 pt-4">
          <button
            onClick={onRetry}
            className="study-button study-button-primary"
          >
            <RotateCcw size={16} />
            <span>Làm lại</span>
          </button>
          <button
            onClick={onFinish}
            className="px-6 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer focus-ring shadow-xs"
          >
            Về chọn bài
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none overflow-y-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-6">
        <button
          onClick={onFinish}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)] transition-all"
        >
          <span>Thoát</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
            Câu {currentIndex + 1} / {questions.length}
          </span>
          <div className="hidden w-32 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden sm:block">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs font-mono font-medium text-[var(--color-success)]">
            {correctCount} đúng
          </span>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Tự kiểm tra
        </div>
      </div>

      {/* Question canvas */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-2xl mx-auto w-full space-y-8 sm:px-6">
        <div className="text-center space-y-3">
          <div className="font-jp-serif break-words text-4xl font-semibold text-[var(--color-text)] md:text-6xl">
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
                  w-full flex items-center gap-4 px-4 py-3 rounded-xl border sm:px-5 sm:py-4
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
                <strong>{isCorrect ? '✓ Đúng' : '✗ Chưa đúng'}</strong> —{' '}
                <span className="text-[var(--color-text)] font-normal">
                  {current.explanation}
                </span>
              </div>
            </div>

            <button
              onClick={handleNext}
              className="study-button study-button-primary w-full"
            >
              <span>
                {currentIndex < questions.length - 1
                  ? 'Câu tiếp theo'
                  : 'Xem kết quả'}
              </span>
              <kbd className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">
                Space / Enter
              </kbd>
            </button>
          </div>
        )}
      </div>

      {/* Bottom shortcut bar */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs text-[var(--color-text-tertiary)]">
        <span>Nhấn <kbd className="kbd-shortcut">1–4</kbd> để chọn</span>
        <span className="mx-2">·</span>
        <span><kbd className="kbd-shortcut">Space</kbd> / <kbd className="kbd-shortcut">Enter</kbd> để tiếp tục</span>
        <span className="mx-2">·</span>
        <span><kbd className="kbd-shortcut">Esc</kbd> để thoát</span>
      </div>
    </div>
  );
}
