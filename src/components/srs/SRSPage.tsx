// ============================================================
// Spaced Repetition Review Mode
// ============================================================
// Principles:
// - Spaced Repetition: SM-2 scheduling for optimal retention
// - Active Recall: Must recall before seeing answer
// - Testing Effect: Every review is a low-stakes test
// - Peak-End Rule: Session ends with encouraging summary
// - Hick's Law: 4 rating options (Again/Hard/Good/Easy)
// ============================================================

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/hooks/useApp';
import { createSRSCard, processReview, getDueCards, getNextIntervals } from '@/lib/srs';
import { recordStudyActivity } from '@/lib/storage';
import type { Rating, SRSCard, VocabItem, KanjiItem, GrammarItem } from '@/types';
import { RotateCcw, CheckCircle, ArrowRight } from 'lucide-react';
import { PageHeading } from '@/components/ui/StudyUI';

export function SRSPage() {
  const { vocabulary, kanji, grammar, srsCards, updateSRSCard, setCurrentPage } = useApp();
  const [sessionCards, setSessionCards] = useState<SRSCard[] | null>(null);

  // Get or create SRS cards for all items
  const dueCards = useMemo(() => getDueCards(srsCards).filter((card) => {
    if (card.deckType === 'vocabulary') return vocabulary.some((item) => item.id === card.cardId);
    if (card.deckType === 'kanji') return kanji.some((item) => item.id === card.cardId);
    return grammar.some((item) => item.id === card.cardId);
  }), [srsCards, vocabulary, kanji, grammar]);

  // Items that are completely new (never studied)
  const newItemCount = useMemo(() => {
    const studied = new Set(srsCards.map((c) => c.cardId));
    return vocabulary.filter((v) => !studied.has(v.id)).length;
  }, [vocabulary, srsCards]);

  if (sessionCards) {
    return (
      <SRSSession
        cards={sessionCards}
        vocabulary={vocabulary}
        kanji={kanji}
        grammar={grammar}
        updateSRSCard={updateSRSCard}
        onFinish={() => setSessionCards(null)}
      />
    );
  }

  return (
    <div className="study-page">
      <PageHeading eyebrow="HÔM NAY" title="Ôn tập" subtitle="Ôn đúng lúc để nhớ lâu hơn" />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {/* Due reviews */}
        <div className="p-3 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={18} className="text-[var(--color-accent)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--color-text)]">Cần ôn</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{dueCards.length}</div>
          <div className="hidden sm:block text-xs text-[var(--color-text-tertiary)] mt-1">Thẻ cần ôn hôm nay</div>
        </div>

        {/* New items */}
        <div className="p-3 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight size={18} className="text-[var(--color-new)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--color-text)]">Từ mới</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{newItemCount}</div>
          <div className="hidden sm:block text-xs text-[var(--color-text-tertiary)] mt-1">Chưa học</div>
        </div>

        {/* Total in system */}
        <div className="p-3 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-[var(--color-mastered)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--color-text)]">Đã lưu</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{srsCards.length}</div>
          <div className="hidden sm:block text-xs text-[var(--color-text-tertiary)] mt-1">Tổng thẻ đang theo dõi</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {dueCards.length > 0 && (
          <button
            onClick={() => setSessionCards(dueCards)}
            className="study-button study-button-primary"
          >
            <RotateCcw size={16} />
             Ôn {dueCards.length} thẻ đến hạn
          </button>
        )}
        <button
          onClick={() => {
            // Add 10 new items to the SRS system
            const studied = new Set(srsCards.map((c) => c.cardId));
            const newItems = vocabulary
              .filter((v) => !studied.has(v.id))
              .slice(0, 10);
            const cards = newItems.map((item) => createSRSCard(item.id, 'vocabulary'));
            cards.forEach(updateSRSCard);
            if (cards.length > 0) setSessionCards(cards);
          }}
          disabled={newItemCount === 0}
          className={dueCards.length === 0 ? 'study-button study-button-primary' : 'study-button'}
        >
          <ArrowRight size={16} />
          Học {Math.min(10, newItemCount)} từ mới
        </button>
        <button className="study-button" onClick={() => setCurrentPage('flashcards')}>Thẻ học →</button>
        <button className="study-button" onClick={() => setCurrentPage('quiz')}>Trắc nghiệm →</button>
      </div>
    </div>
  );
}

// ============================================================
// SRS Review Session
// ============================================================

interface SessionStats {
  total: number;
  correct: number;
  startTime: number;
}

function SRSSession({
  cards,
  vocabulary,
  kanji,
  grammar,
  updateSRSCard,
  onFinish,
}: {
  cards: SRSCard[];
  vocabulary: VocabItem[];
  kanji: KanjiItem[];
  grammar: GrammarItem[];
  updateSRSCard: (card: SRSCard) => void;
  onFinish: () => void;
}) {
  const [queue] = useState<SRSCard[]>(() => [...cards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const ratingLocked = useRef(false);
  useEffect(() => { ratingLocked.current = false; }, [currentIndex]);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats] = useState<SessionStats>({
    total: cards.length,
    correct: 0,
    startTime: Date.now(),
  });

  const currentCard = queue[currentIndex];
  const studyItem = useMemo(() => {
    if (!currentCard) return null;
    if (currentCard.deckType === 'vocabulary') {
      const item = vocabulary.find((v) => v.id === currentCard.cardId);
      return item ? { prompt: item.kanji, reading: item.hiragana, meaning: item.meaning } : null;
    }
    if (currentCard.deckType === 'kanji') {
      const item = kanji.find((k) => k.id === currentCard.cardId);
      return item ? { prompt: item.kanji, reading: item.hanViet, meaning: item.vocabulary[0]?.meaning || '' } : null;
    }
    const item = grammar.find((g) => g.id === currentCard.cardId);
    return item ? { prompt: item.pattern, reading: item.meaning, meaning: item.structure || item.usage } : null;
  }, [currentCard, vocabulary, kanji, grammar]);

  const handleRate = useCallback((rating: Rating) => {
    if (!currentCard || ratingLocked.current || !revealed) return;
    ratingLocked.current = true;

    const updated = processReview(currentCard, rating);
    updateSRSCard(updated);

    if (rating !== 'again') {
      stats.correct++;
    }

    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
      setRevealed(false);
    } else {
      // Session complete
      const elapsed = Math.round((Date.now() - stats.startTime) / 60000);
      recordStudyActivity(
        stats.total,
        0,
        stats.total > 0 ? stats.correct / stats.total : 0,
        elapsed,
        'srs'
      );
      setSessionDone(true);
    }
  }, [currentCard, currentIndex, queue.length, updateSRSCard, stats, revealed]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
      if ((e.key === ' ' || e.key === 'Enter') && target.closest('button')) return;
      if (sessionDone) {
        if (e.key === 'Escape' || e.key === 'Enter') onFinish();
        return;
      }
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRevealed(true); }
        if (e.key === 'Escape') onFinish();
        return;
      }
      switch (e.key) {
        case '1': handleRate('again'); break;
        case '2': handleRate('hard'); break;
        case '3': handleRate('good'); break;
        case '4': handleRate('easy'); break;
        case 'Escape': onFinish(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, sessionDone, handleRate, onFinish]);

  // Session complete summary (Peak-End Rule)
  if (sessionDone) {
    const elapsed = Math.round((Date.now() - stats.startTime) / 60000);
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-subtle)] flex items-center justify-center">
          <CheckCircle size={32} className="text-[var(--color-success)]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)]">
            Đã hoàn thành
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Lịch ôn hôm nay đã được cập nhật.
          </p>
        </div>

        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-text)]">{stats.total}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Đã ôn</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-success)]">{accuracy}%</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Chính xác</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-text)]">{elapsed || '< 1'}m</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Thời gian</div>
          </div>
        </div>

        <button
          onClick={onFinish}
          className="study-button study-button-primary"
        >
          Về trang ôn tập
        </button>
      </div>
    );
  }

  if (!currentCard || !studyItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <CheckCircle size={48} className="text-[var(--color-success)]" />
        <h2 className="text-xl font-semibold text-[var(--color-text)]">Đã ôn xong!</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Hiện không có thẻ đến hạn.</p>
        <button
          onClick={onFinish}
          className="study-button study-button-primary"
        >
          Quay lại
        </button>
      </div>
    );
  }

  const intervals = getNextIntervals(currentCard);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
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
            Thẻ {currentIndex + 1} / {queue.length}
          </span>
          <div className="hidden w-32 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden sm:block">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Ôn tập SRS
        </div>
      </div>

      {/* Card area — perfectly centered */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto px-4 py-4 sm:px-6">
        <button
          onClick={() => !revealed && setRevealed(true)}
          disabled={revealed}
          className={`
            w-full max-w-2xl min-h-[260px] rounded-2xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            flex flex-col items-center justify-center p-6 sm:p-8
            transition-all duration-200 relative
            ${!revealed ? 'cursor-pointer focus-ring' : 'cursor-default'}
          `}
          aria-label={
            revealed
              ? 'Đã hiện đáp án, hãy đánh giá bên dưới'
              : 'Chạm hoặc nhấn Space để xem đáp án'
          }
        >
          {!revealed ? (
            <div className="text-center">
              <div className="font-jp-serif break-words text-5xl font-semibold text-[var(--color-text)] md:text-7xl">
                {studyItem.prompt}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="font-jp-serif break-words text-4xl font-medium text-[var(--color-text)] sm:text-5xl">
                {studyItem.prompt}
              </div>
              <div className="font-jp break-words text-xl text-[var(--color-accent)] font-medium sm:text-3xl">
                {studyItem.reading}
              </div>
              <div className="w-12 h-px bg-[var(--color-border)] mx-auto" />
              <div className="text-xl text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                {studyItem.meaning}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Rating bar & shortcuts (Anki / SuperMemo horizontal layout) */}
      <div className="flex flex-col items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 pb-[calc(16px+env(safe-area-inset-bottom))] sm:px-8">
        {revealed ? (
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl">
            <RatingButton
              label="Lại"
              sublabel={intervals.again}
              color="var(--color-error)"
              shortcut="1"
              onClick={() => handleRate('again')}
            />
            <RatingButton
              label="Khó"
              sublabel={intervals.hard}
              color="var(--color-warning)"
              shortcut="2"
              onClick={() => handleRate('hard')}
            />
            <RatingButton
              label="Được"
              sublabel={intervals.good}
              color="var(--color-success)"
              shortcut="3"
              onClick={() => handleRate('good')}
            />
            <RatingButton
              label="Dễ"
              sublabel={intervals.easy}
              color="var(--color-accent)"
              shortcut="4"
              onClick={() => handleRate('easy')}
            />
          </div>
        ) : (
          <div className="text-xs font-mono text-[var(--color-text-tertiary)] py-3">
            Chạm thẻ hoặc nhấn <kbd className="kbd-shortcut">Space</kbd> để xem đáp án
          </div>
        )}
      </div>
    </div>
  );
}

function RatingButton({
  label,
  sublabel,
  color,
  shortcut,
  onClick,
}: {
  label: string;
  sublabel: string;
  color: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="
        flex-1 min-w-[130px] flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl
        bg-[var(--color-surface)] border border-[var(--color-border)]
        hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]
        transition-all duration-150 cursor-pointer focus-ring shadow-xs
      "
    >
      <kbd className="kbd-shortcut">{shortcut}</kbd>
      <span className="text-sm font-semibold" style={{ color }}>
        {label}
      </span>
      <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
        ({sublabel})
      </span>
    </button>
  );
}
