// ============================================================
// Dashboard — Home page
// ============================================================
// Scaled & Balanced Layout:
// - Generous scale: text-3xl/4xl metrics, h-40 cards, p-8 panels
// - Even vertical & horizontal spacing across the full viewport
// - 2-Column layout matching target design (Hero, 4 Stat Cards, SRS Mastery | Weakest Items, Shortcuts)
// ============================================================

import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/hooks/useApp';
import { getDueCards, getStateDistribution } from '@/lib/srs';
import { calculateStreak, getStudyDays } from '@/lib/storage';
import {
  RotateCcw,
  Flame,
  Target,
  TrendingUp,
  AlertCircle,
  Layers,
  X,
} from 'lucide-react';

export function Dashboard() {
  const { vocabulary, srsCards, setCurrentPage } = useApp();

  // State for interactive Weak Item Preview Modal
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);
  const distribution = useMemo(() => getStateDistribution(srsCards), [srsCards]);
  const streak = useMemo(() => calculateStreak(), []);
  const studyDays = useMemo(() => getStudyDays(), []);

  const todayStudy = studyDays.find(
    (d) => d.date === new Date().toISOString().split('T')[0]
  );

  // Weak items: top cards with low accuracy (< 60%)
  const weakItems = useMemo(() => {
    return srsCards
      .filter((c) => c.totalReviews > 0 && c.correctCount / c.totalReviews < 0.6)
      .slice(0, 5);
  }, [srsCards]);

  const previewVocab = useMemo(() => {
    if (!previewItemId) return null;
    return vocabulary.find((v) => v.id === previewItemId) || null;
  }, [vocabulary, previewItemId]);

  // Press Enter on Dashboard to start session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        previewItemId !== null
      ) {
        return;
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCurrentPage(dueCards.length > 0 ? 'srs' : 'flashcards');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dueCards.length, setCurrentPage, previewItemId]);

  return (
    <div className="w-full space-y-8 pb-20 pt-2 min-h-[calc(100vh-4rem)]">
      {/* ============================================================
          Page Header (Scaled up for bold presence)
          ============================================================ */}
      <div className="flex items-baseline justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-[var(--color-text)] tracking-tight">
            Dashboard
          </h1>
          <p className="text-base text-[var(--color-text-secondary)]">
            N3 Japanese vocabulary, kanji, and grammar study progress
          </p>
        </div>
        <div className="text-sm text-[var(--color-text-tertiary)] hidden sm:flex items-center gap-2">
          <span>Press</span>
          <kbd className="kbd-shortcut text-xs px-2 py-1">Enter</kbd>
          <span>to begin study session</span>
        </div>
      </div>

      {/* ============================================================
          Main Two-Column Grid (Scaled 8:4 Ratio, gap-8 lg:gap-10)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* Left/Middle Main Column (col-span-8): Hero Card, 4 Stat Cards, SRS Mastery */}
        <div className="lg:col-span-8 space-y-8">
          {/* Panel 1: Blue Hero Card (Generous p-8 padding) */}
          <div className="p-7 sm:p-8 rounded-3xl bg-[#EEF4FF] dark:bg-blue-950/30 border border-blue-100/90 dark:border-blue-900/40 shadow-xs card-hover-effect">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] tracking-tight">
                  {dueCards.length > 0
                    ? `${dueCards.length} review cards ready for today`
                    : 'All caught up with due reviews!'}
                </h2>
                <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
                  {dueCards.length > 0
                    ? 'You have scheduled Spaced Repetition reviews waiting. Practice flashcards or continue learning vocabulary at your own pace.'
                    : "You've completed today's scheduled SRS reviews. Practice flashcards or explore new vocabulary at your own pace."}
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 shrink-0 pt-2 md:pt-0">
                {dueCards.length > 0 ? (
                  <button
                    onClick={() => setCurrentPage('srs')}
                    className="
                      flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl
                      bg-[#1D63ED] text-white text-base font-bold
                      hover:bg-blue-700 shadow-xs
                      transition-colors duration-150 cursor-pointer focus-ring
                    "
                  >
                    <RotateCcw size={18} />
                    <span>Start Review Session</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentPage('flashcards')}
                    className="
                      flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl
                      bg-[#1D63ED] text-white text-base font-bold
                      hover:bg-blue-700 shadow-xs
                      transition-colors duration-150 cursor-pointer focus-ring
                    "
                  >
                    <Layers size={18} />
                    <span>Practice Flashcards</span>
                  </button>
                )}
                <button
                  onClick={() => setCurrentPage('vocabulary')}
                  className="
                    text-base font-bold text-[#1D63ED] hover:underline
                    transition-colors duration-150 cursor-pointer focus-ring py-2 px-1
                  "
                >
                  Explore Vocabulary
                </button>
              </div>
            </div>
          </div>

          {/* Panel 2: 4 Metric Cards Grid (Scaled height h-40, big text-3xl/4xl numbers) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {/* Card 1: CURRENT STREAK */}
            <div className="h-40 p-6 rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] flex flex-col justify-between card-hover-effect shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  CURRENT STREAK
                </span>
                <Flame size={22} className="text-[#FF7043] badge-pulse" />
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
                  {streak.current} days
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1.5 font-medium">
                  Best: {streak.longest} days
                </div>
              </div>
            </div>

            {/* Card 2: TODAY'S ACTIVITY */}
            <div className="h-40 p-6 rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] flex flex-col justify-between card-hover-effect shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  TODAY&apos;S ACTIVITY
                </span>
                <Target size={22} className="text-[#1D63ED]" />
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
                  {todayStudy?.cardsReviewed || 0} reviewed
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1.5 font-medium">
                  {todayStudy?.newCardsLearned || 0} new cards
                </div>
              </div>
            </div>

            {/* Card 3: MASTERED CARDS */}
            <div className="h-40 p-6 rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] flex flex-col justify-between card-hover-effect shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  MASTERED CARDS
                </span>
                <TrendingUp size={22} className="text-[#10B981]" />
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
                  {distribution.mastered}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1.5 font-medium">
                  of {srsCards.length} tracked
                </div>
              </div>
            </div>

            {/* Card 4: NEEDS DRILL */}
            <div className="h-40 p-6 rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] flex flex-col justify-between card-hover-effect shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  NEEDS DRILL
                </span>
                <AlertCircle size={22} className="text-[#EF4444]" />
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight">
                  {weakItems.length} items
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] mt-1.5 font-medium">
                  Accuracy &lt; 60%
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Spaced Repetition Mastery (p-8, h-4.5 thick progress bar) */}
          <div className="p-7 sm:p-8 rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] space-y-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">
                Spaced Repetition Mastery
              </h2>
              <span className="text-sm font-mono font-medium text-[var(--color-text-secondary)]">
                {srsCards.length} cards total
              </span>
            </div>

            <div className="flex gap-2 h-4.5 rounded-full overflow-hidden bg-[var(--color-surface-alt)]">
              {distribution.mastered > 0 && (
                <div
                  className="bg-[#10B981] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.mastered / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Mastered: ${distribution.mastered}`}
                />
              )}
              {distribution.review > 0 && (
                <div
                  className="bg-[#1D63ED] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.review / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Reviewing: ${distribution.review}`}
                />
              )}
              {distribution.learning > 0 && (
                <div
                  className="bg-[#F59E0B] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.learning / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Learning: ${distribution.learning}`}
                />
              )}
              {distribution.new > 0 && (
                <div
                  className="bg-[#8A8A8A] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.new / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`New: ${distribution.new}`}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-8 text-sm text-[var(--color-text-secondary)] pt-2">
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                <span>
                  Mastered <strong className="text-[var(--color-text)] font-mono font-bold">{distribution.mastered}</strong>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#1D63ED]" />
                <span>
                  Reviewing <strong className="text-[var(--color-text)] font-mono font-bold">{distribution.review}</strong>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span>
                  Learning <strong className="text-[var(--color-text)] font-mono font-bold">{distribution.learning}</strong>
                </span>
              </span>
              <span className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#8A8A8A]" />
                <span>
                  New <strong className="text-[var(--color-text)] font-mono font-bold">{distribution.new}</strong>
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Sidebar Column (col-span-4): Weakest Items & Keyboard Shortcuts */}
        <div className="lg:col-span-4 space-y-10 pt-2">
          {/* Widget 1: Weakest Items */}
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-[var(--color-border)]/60 pb-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-[#EF4444]" />
                <h2 className="text-base font-bold text-[var(--color-text)]">
                  Weakest Items
                </h2>
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">
                Below 60% accuracy
              </span>
            </div>

            {weakItems.length > 0 ? (
              <div className="space-y-4">
                {weakItems.map((card) => {
                  const vocab = vocabulary.find((v) => v.id === card.itemId);
                  if (!vocab) return null;
                  const accuracy = Math.round(
                    (card.correctCount / card.totalReviews) * 100
                  );
                  return (
                    <div
                      key={card.itemId}
                      className="flex items-center justify-between text-base group hover:bg-[var(--color-surface-alt)] p-2 -mx-2 rounded-xl transition-colors cursor-pointer"
                      onClick={() => setPreviewItemId(vocab.id)}
                      title="Click to drill item"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-jp text-lg font-bold text-[var(--color-text)] shrink-0">
                          {vocab.kanji}
                        </span>
                        <span className="font-jp text-sm font-medium text-[#FF7043] truncate">
                          【{vocab.hiragana}】
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {/* Red Marker Bar */}
                        <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-[var(--color-surface-alt)] overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-[#EF4444] rounded-full"
                            style={{ width: `${Math.max(15, accuracy)}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono font-bold text-[#EF4444] shrink-0">
                          {accuracy}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-sm text-[var(--color-text-secondary)]">
                All reviewed items are currently above 60% accuracy. Great retention!
              </div>
            )}
          </div>

          {/* Widget 2: Keyboard Shortcuts */}
          <div className="space-y-4 pt-2">
            <h2 className="text-base font-bold text-[var(--color-text)] border-b border-gray-100 dark:border-[var(--color-border)]/60 pb-3">
              Keyboard Shortcuts
            </h2>
            <div className="space-y-3 text-sm text-[var(--color-text-secondary)] font-medium">
              <div className="flex items-center justify-between">
                <span>Start Review / Flip</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">Space / Enter</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Rate Answer (SRS)</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">1 – 4</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Command Palette</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">⌘K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Vocabulary</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Kanji</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Grammar</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G G</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          Interactive Weak Item Preview Modal
          ============================================================ */}
      {previewVocab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[var(--color-surface)] border border-gray-100 dark:border-[var(--color-border)] shadow-lg p-7 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/60 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-[#EF4444]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#EF4444]">
                  Needs Drill
                </span>
              </div>
              <button
                onClick={() => setPreviewItemId(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-center py-4 space-y-2">
              <div className="font-jp text-4xl font-bold text-[var(--color-text)]">
                {previewVocab.kanji}
              </div>
              <div className="font-jp text-base text-[#1D63ED] font-semibold">
                【{previewVocab.hiragana}】
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] pt-1">
                {previewVocab.meaning}
              </div>
              {previewVocab.relatedWords && (
                <div className="text-xs text-[var(--color-text-secondary)] font-jp">
                  Related: {previewVocab.relatedWords}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  setPreviewItemId(null);
                  setCurrentPage('flashcards');
                }}
                className="w-full py-3.5 rounded-2xl bg-[#1D63ED] text-white text-base font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-xs"
              >
                Practice in Flashcards
              </button>
              <button
                onClick={() => setPreviewItemId(null)}
                className="px-6 py-3.5 rounded-2xl bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] text-[var(--color-text)] text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
