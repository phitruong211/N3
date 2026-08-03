// ============================================================
// Dashboard — Home page
// ============================================================
// Principles:
// - Zeigarnik Effect: "Continue where you left off" + pending reviews
// - Goal Gradient Effect: Progress bars approaching completion
// - Habit Formation: Streak counter
// - Single clear purpose: Today's study priorities
// ============================================================

import React, { useMemo, useEffect } from 'react';
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
  Sparkles,
} from 'lucide-react';

export function Dashboard() {
  const { vocabulary, kanji, grammar, srsCards, setCurrentPage } = useApp();

  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);
  const distribution = useMemo(() => getStateDistribution(srsCards), [srsCards]);
  const streak = useMemo(() => calculateStreak(), []);
  const studyDays = useMemo(() => getStudyDays(), []);

  const todayStudy = studyDays.find(
    (d) => d.date === new Date().toISOString().split('T')[0]
  );

  // Weak items: cards with low accuracy
  const weakItems = useMemo(() => {
    return srsCards
      .filter((c) => c.totalReviews > 0 && c.correctCount / c.totalReviews < 0.6)
      .slice(0, 5);
  }, [srsCards]);

  // Press Enter on Dashboard to start session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCurrentPage(dueCards.length > 0 ? 'srs' : 'flashcards');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dueCards.length, setCurrentPage]);

  return (
    <div className="space-y-8 w-full">
      {/* Page header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            N3 Japanese vocabulary, kanji, and grammar study progress
          </p>
        </div>
        <div className="text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Press <kbd className="kbd-shortcut">Enter</kbd> to begin study session
        </div>
      </div>

      {/* ============================================================
          Primary Focal Point: Daily Study Session Hero Banner
          ============================================================ */}
      <div className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
              <Sparkles size={12} />
              Daily Study Plan
            </div>
            <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
              {dueCards.length > 0
                ? `${dueCards.length} review cards ready for today`
                : 'All caught up with due reviews!'}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {dueCards.length > 0
                ? 'Your Spaced Repetition interval queue has cards scheduled for review. Maintaining daily sessions strengthens long-term memory.'
                : `You have completed today's scheduled SRS reviews. You can practice flashcards or learn new vocabulary at your own pace.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {dueCards.length > 0 ? (
              <button
                onClick={() => setCurrentPage('srs')}
                className="
                  flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                  bg-[var(--color-accent)] text-white text-sm font-medium
                  hover:bg-[var(--color-accent-hover)] shadow-sm
                  transition-colors duration-150 cursor-pointer focus-ring
                "
              >
                <RotateCcw size={16} />
                <span>Start Review Session</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                  Enter
                </span>
              </button>
            ) : (
              <button
                onClick={() => setCurrentPage('flashcards')}
                className="
                  flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                  bg-[var(--color-accent)] text-white text-sm font-medium
                  hover:bg-[var(--color-accent-hover)] shadow-sm
                  transition-colors duration-150 cursor-pointer focus-ring
                "
              >
                <Layers size={16} />
                <span>Practice Flashcards</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                  Enter
                </span>
              </button>
            )}
            <button
              onClick={() => setCurrentPage('vocabulary')}
              className="
                flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl
                bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] text-sm font-medium
                hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]
                border border-[var(--color-border)]
                transition-colors duration-150 cursor-pointer focus-ring
              "
            >
              <span>Explore Vocabulary</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================
          Balanced 2-Column Dashboard Grid
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 spans): Key Metrics & SRS Mastery */}
        <div className="lg:col-span-7 space-y-8">
          {/* Quick Stats Cards (Goal Gradient Effect) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={<Flame size={18} className="text-[var(--color-warning)]" />}
              label="Current Streak"
              value={`${streak.current} days`}
              sub={`Best: ${streak.longest} days`}
            />
            <StatCard
              icon={<Target size={18} className="text-[var(--color-accent)]" />}
              label="Today's Activity"
              value={`${todayStudy?.cardsReviewed || 0} reviewed`}
              sub={`${todayStudy?.newCardsLearned || 0} new cards`}
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-[var(--color-success)]" />}
              label="Mastered Cards"
              value={`${distribution.mastered}`}
              sub={`of ${srsCards.length} tracked`}
            />
            <StatCard
              icon={<AlertCircle size={18} className="text-[var(--color-error)]" />}
              label="Needs Drill"
              value={`${weakItems.length} items`}
              sub="Accuracy < 60%"
            />
          </div>

          {/* SRS State Distribution */}
          <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Spaced Repetition Mastery
              </h2>
              <span className="text-xs font-mono text-[var(--color-text-secondary)]">
                {srsCards.length} cards total
              </span>
            </div>

            <div className="flex gap-1.5 h-3 rounded-full overflow-hidden bg-[var(--color-surface-alt)]">
              {distribution.mastered > 0 && (
                <div
                  className="bg-[var(--color-mastered)] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.mastered / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Mastered: ${distribution.mastered}`}
                />
              )}
              {distribution.review > 0 && (
                <div
                  className="bg-[var(--color-review)] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.review / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Review: ${distribution.review}`}
                />
              )}
              {distribution.learning > 0 && (
                <div
                  className="bg-[var(--color-learning)] rounded-full transition-all duration-300"
                  style={{ width: `${(distribution.learning / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Learning: ${distribution.learning}`}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-6 text-xs text-[var(--color-text-secondary)] pt-1">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-mastered)]" />
                <span>Mastered: <strong className="text-[var(--color-text)]">{distribution.mastered}</strong></span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-review)]" />
                <span>Reviewing: <strong className="text-[var(--color-text)]">{distribution.review}</strong></span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-learning)]" />
                <span>Learning: <strong className="text-[var(--color-text)]">{distribution.learning}</strong></span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-new)]" />
                <span>New: <strong className="text-[var(--color-text)]">{distribution.new}</strong></span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (1 span): Weak Items & Keyboard Shortcuts */}
        <div className="lg:col-span-5 space-y-8">
          {/* Weakest Items (Error Management Theory) */}
          <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-[var(--color-error)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Weakest Items
                </h2>
              </div>
              {weakItems.length > 0 && (
                <button
                  onClick={() => setCurrentPage('flashcards')}
                  className="text-xs font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
                >
                  Drill →
                </button>
              )}
            </div>

            {weakItems.length > 0 ? (
              <div className="divide-y divide-[var(--color-border)]">
                {weakItems.map((card) => {
                  const vocab = vocabulary.find((v) => v.id === card.itemId);
                  if (!vocab) return null;
                  const accuracy = Math.round(
                    (card.correctCount / card.totalReviews) * 100
                  );
                  return (
                    <div
                      key={card.itemId}
                      className="py-3 flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-jp text-base font-medium text-[var(--color-text)] shrink-0">
                          {vocab.kanji}
                        </span>
                        <span className="font-jp text-xs text-[var(--color-text-secondary)] truncate">
                          {vocab.hiragana} · {vocab.meaning}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-medium text-[var(--color-error)] shrink-0 ml-2">
                        {accuracy}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
                All reviewed items are currently above 60% accuracy. Great retention!
              </div>
            )}
          </div>

          {/* Keyboard Shortcuts Card */}
          <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Keyboard Shortcuts
            </h2>
            <div className="space-y-2.5 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Start Review / Flip Card</span>
                <kbd className="kbd-shortcut">Space / Enter</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Rate Answer (SRS)</span>
                <kbd className="kbd-shortcut">1 – 4</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Command Palette</span>
                <kbd className="kbd-shortcut">⌘K / Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Vocabulary</span>
                <kbd className="kbd-shortcut">G V</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Kanji</span>
                <kbd className="kbd-shortcut">G K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Go to Grammar</span>
                <kbd className="kbd-shortcut">G G</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
          {value}
        </div>
        <div className="text-xs text-[var(--color-text-tertiary)] mt-1">
          {sub}
        </div>
      </div>
    </div>
  );
}
