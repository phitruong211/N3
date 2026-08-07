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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import { createSRSCard, processReview, getDueCards, getNextIntervals } from '@/lib/srs';
import { recordStudyActivity } from '@/lib/storage';
import type { Rating, SRSCard } from '@/types';
import { RotateCcw, CheckCircle, ArrowRight } from 'lucide-react';

export function SRSPage() {
  const { vocabulary, kanji, srsCards, updateSRSCard, setCurrentPage } = useApp();
  const [sessionActive, setSessionActive] = useState(false);

  // Get or create SRS cards for all items
  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);

  // Items that are completely new (never studied)
  const newItemCount = useMemo(() => {
    const studied = new Set(srsCards.map((c) => c.cardId));
    return vocabulary.filter((v) => !studied.has(v.id)).length;
  }, [vocabulary, srsCards]);

  if (sessionActive) {
    return (
      <SRSSession
        srsCards={srsCards}
        vocabulary={vocabulary}
        updateSRSCard={updateSRSCard}
        onFinish={() => setSessionActive(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          Spaced Repetition
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Review cards at optimal intervals for long-term memory
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Due reviews */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw size={18} className="text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">Due Reviews</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{dueCards.length}</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Cards to review today</div>
        </div>

        {/* New items */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight size={18} className="text-[var(--color-new)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">New Items</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{newItemCount}</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Not yet studied</div>
        </div>

        {/* Total in system */}
        <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={18} className="text-[var(--color-mastered)]" />
            <span className="text-sm font-medium text-[var(--color-text)]">In System</span>
          </div>
          <div className="text-3xl font-semibold text-[var(--color-text)]">{srsCards.length}</div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Total cards tracked</div>
        </div>
      </div>

      <div className="flex gap-3">
        {dueCards.length > 0 && (
          <button
            onClick={() => setSessionActive(true)}
            className="
              flex items-center gap-2 px-6 py-3 rounded-lg
              bg-[var(--color-accent)] text-white text-sm font-medium
              hover:bg-[var(--color-accent-hover)]
              transition-colors duration-150 cursor-pointer focus-ring
            "
          >
            <RotateCcw size={16} />
            Review {dueCards.length} Due Cards
          </button>
        )}
        <button
          onClick={() => {
            // Add 10 new items to the SRS system
            const studied = new Set(srsCards.map((c) => c.cardId));
            const newItems = vocabulary
              .filter((v) => !studied.has(v.id))
              .slice(0, 10);
            newItems.forEach((item) => {
              const card = createSRSCard(item.id, 'vocabulary');
              updateSRSCard(card);
            });
            if (newItems.length > 0) setSessionActive(true);
          }}
          className="
            flex items-center gap-2 px-6 py-3 rounded-lg
            bg-[var(--color-surface)] text-[var(--color-text)] text-sm font-medium
            border border-[var(--color-border)]
            hover:bg-[var(--color-surface-hover)]
            transition-colors duration-150 cursor-pointer focus-ring
          "
        >
          <ArrowRight size={16} />
          Learn 10 New Cards
        </button>
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
  srsCards,
  vocabulary,
  updateSRSCard,
  onFinish,
}: {
  srsCards: SRSCard[];
  vocabulary: { id: string; kanji: string; hiragana: string; meaning: string }[];
  updateSRSCard: (card: SRSCard) => void;
  onFinish: () => void;
}) {
  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);
  const [queue, setQueue] = useState<SRSCard[]>(() => [...dueCards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [stats] = useState<SessionStats>({
    total: dueCards.length,
    correct: 0,
    startTime: Date.now(),
  });

  const currentCard = queue[currentIndex];
  const vocabItem = vocabulary.find((v) => v.id === currentCard?.cardId);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (sessionDone) {
        if (e.key === 'Escape' || e.key === 'Enter') onFinish();
        return;
      }
      if (!revealed) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setRevealed(true);
        }
        if (e.key === 'Escape') onFinish();
        return;
      }
      // Rating shortcuts
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
  }, [revealed, sessionDone, currentCard]);

  const handleRate = useCallback((rating: Rating) => {
    if (!currentCard) return;

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
  }, [currentCard, currentIndex, queue.length, updateSRSCard, stats]);

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
            Session Complete!
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Great work on your review today
          </p>
        </div>

        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-text)]">{stats.total}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Reviewed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-success)]">{accuracy}%</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-[var(--color-text)]">{elapsed || '< 1'}m</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">Duration</div>
          </div>
        </div>

        <button
          onClick={onFinish}
          className="px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors duration-150 cursor-pointer focus-ring"
        >
          Back to Overview
        </button>
      </div>
    );
  }

  if (!currentCard || !vocabItem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <CheckCircle size={48} className="text-[var(--color-success)]" />
        <h2 className="text-xl font-semibold text-[var(--color-text)]">All caught up!</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">No cards due for review</p>
        <button
          onClick={onFinish}
          className="px-6 py-3 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium cursor-pointer focus-ring"
        >
          Back
        </button>
      </div>
    );
  }

  const intervals = getNextIntervals(currentCard);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={onFinish}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)] transition-all"
        >
          <span>Exit Review</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
            Review {currentIndex + 1} of {queue.length}
          </span>
          <div className="w-48 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / queue.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          SRS Study Mode
        </div>
      </div>

      {/* Card area — perfectly centered */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <button
          onClick={() => !revealed && setRevealed(true)}
          disabled={revealed}
          className={`
            w-full max-w-2xl aspect-[16/10] rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-md flex flex-col items-center justify-center p-8
            transition-all duration-200 relative
            ${!revealed ? 'cursor-pointer hover:shadow-lg focus-ring' : 'cursor-default'}
          `}
          aria-label={
            revealed
              ? 'Showing answer, select rating below'
              : 'Showing question, click or press Space to show answer'
          }
        >
          {!revealed ? (
            <div className="text-center">
              <div className="font-jp-serif text-7xl md:text-8xl font-semibold text-[var(--color-text)] tracking-tight">
                {vocabItem.kanji}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="font-jp-serif text-5xl font-medium text-[var(--color-text)]">
                {vocabItem.kanji}
              </div>
              <div className="font-jp text-3xl text-[var(--color-accent)] font-medium">
                {vocabItem.hiragana}
              </div>
              <div className="w-12 h-px bg-[var(--color-border)] mx-auto" />
              <div className="text-xl text-[var(--color-text-secondary)] max-w-md mx-auto leading-relaxed">
                {vocabItem.meaning}
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Rating bar & shortcuts (Anki / SuperMemo horizontal layout) */}
      <div className="px-8 py-6 border-t border-[var(--color-border)]/60 bg-[var(--color-surface)]/50 flex flex-col items-center gap-3">
        {revealed ? (
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-2xl">
            <RatingButton
              label="Again"
              sublabel={intervals.again}
              color="var(--color-error)"
              shortcut="1"
              onClick={() => handleRate('again')}
            />
            <RatingButton
              label="Hard"
              sublabel={intervals.hard}
              color="var(--color-warning)"
              shortcut="2"
              onClick={() => handleRate('hard')}
            />
            <RatingButton
              label="Good"
              sublabel={intervals.good}
              color="var(--color-success)"
              shortcut="3"
              onClick={() => handleRate('good')}
            />
            <RatingButton
              label="Easy"
              sublabel={intervals.easy}
              color="var(--color-accent)"
              shortcut="4"
              onClick={() => handleRate('easy')}
            />
          </div>
        ) : (
          <div className="text-xs font-mono text-[var(--color-text-tertiary)] py-3">
            Press <kbd className="kbd-shortcut">Space</kbd> or <kbd className="kbd-shortcut">Enter</kbd> to reveal answer
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
