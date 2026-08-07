// ============================================================
// Progress Page — Statistics & Heatmap
// ============================================================
// Principles:
// - Goal Gradient Effect: Visual progress towards mastery
// - Habit Formation: Heatmap shows consistency
// - Recognition over Recall: Visual charts, not raw numbers
// ============================================================

import React, { useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { getStateDistribution, formatDate } from '@/lib/srs';
import { calculateStreak, getStudyDays } from '@/lib/storage';
import { Flame, Target, TrendingUp, Calendar, BarChart3 } from 'lucide-react';

export function ProgressPage() {
  const { srsCards, vocabulary, kanji, grammar } = useApp();
  const distribution = useMemo(() => getStateDistribution(srsCards), [srsCards]);
  const streak = useMemo(() => calculateStreak(), []);
  const studyDays = useMemo(() => getStudyDays(), []);

  const totalAccuracy = useMemo(() => {
    if (srsCards.length === 0) return 0;
    const total = srsCards.reduce((sum, c) => sum + c.reps, 0);
    const correct = srsCards.reduce((sum, c) => sum + Math.max(0, c.reps - c.lapses), 0);
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  }, [srsCards]);

  const totalTime = useMemo(() => {
    return studyDays.reduce((sum, d) => sum + d.timeSpent, 0);
  }, [studyDays]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          Progress
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Track your learning journey
        </p>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Flame size={18} className="text-[var(--color-warning)]" />}
          label="Current Streak"
          value={`${streak.current}`}
          unit="days"
        />
        <StatCard
          icon={<Target size={18} className="text-[var(--color-accent)]" />}
          label="Accuracy"
          value={`${totalAccuracy}`}
          unit="%"
        />
        <StatCard
          icon={<TrendingUp size={18} className="text-[var(--color-success)]" />}
          label="Cards in SRS"
          value={`${srsCards.length}`}
          unit="cards"
        />
        <StatCard
          icon={<Calendar size={18} className="text-[var(--color-new)]" />}
          label="Study Days"
          value={`${studyDays.length}`}
          unit="days"
        />
      </div>

      {/* Mastery distribution */}
      <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4 flex items-center gap-2">
          <BarChart3 size={16} />
          Mastery Distribution
        </h2>

        <div className="space-y-3">
          <ProgressBar label="New" count={distribution.new} total={vocabulary.length + kanji.length + grammar.length} color="var(--color-new)" />
          <ProgressBar label="Learning" count={distribution.learning} total={vocabulary.length + kanji.length + grammar.length} color="var(--color-learning)" />
          <ProgressBar label="Review" count={distribution.review} total={vocabulary.length + kanji.length + grammar.length} color="var(--color-review)" />
          <ProgressBar label="Relearning" count={distribution.relearning} total={vocabulary.length + kanji.length + grammar.length} color="var(--color-forgotten)" />
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>Not started: {(vocabulary.length + kanji.length) - srsCards.length}</span>
          <span>Total items: {vocabulary.length + kanji.length}</span>
        </div>
      </div>

      {/* Study heatmap */}
      <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
          Study Activity
        </h2>
        <Heatmap studyDays={studyDays} />
      </div>

      {/* Weak items */}
      <WeakItems srsCards={srsCards} vocabulary={vocabulary} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-3">{icon}
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-[var(--color-text)]">{value}</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">{unit}</span>
      </div>
    </div>
  );
}

function ProgressBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-[var(--color-text-secondary)] w-20">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--color-surface-alt)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-tertiary)] w-8 text-right">{count}</span>
    </div>
  );
}

// GitHub-style heatmap
function Heatmap({ studyDays }: { studyDays: { date: string; cardsReviewed: number }[] }) {
  const cells = useMemo(() => {
    const today = new Date();
    const result: { date: string; level: number }[] = [];
    const dayMap = new Map(studyDays.map((d) => [d.date, d.cardsReviewed]));

    // Last 12 weeks (84 days)
    for (let i = 83; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      const count = dayMap.get(dateStr) || 0;
      let level = 0;
      if (count > 0) level = 1;
      if (count >= 10) level = 2;
      if (count >= 20) level = 3;
      if (count >= 40) level = 4;
      result.push({ date: dateStr, level });
    }
    return result;
  }, [studyDays]);

  const levelColors = [
    'bg-[var(--color-surface-alt)]',
    'bg-[var(--color-success)]/20',
    'bg-[var(--color-success)]/40',
    'bg-[var(--color-success)]/70',
    'bg-[var(--color-success)]',
  ];

  return (
    <div>
      <div className="grid grid-cols-[repeat(12,1fr)] gap-1">
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`aspect-square rounded-sm ${levelColors[cell.level]}`}
            title={`${cell.date}: ${cell.level > 0 ? 'studied' : 'no activity'}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs text-[var(--color-text-tertiary)]">
        <span>Less</span>
        {levelColors.map((c, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

import type { SRSCard } from '@/types';

function WeakItems({
  srsCards,
  vocabulary,
}: {
  srsCards: SRSCard[];
  vocabulary: { id: string; kanji: string; hiragana: string; meaning: string }[];
}) {
  const weak = useMemo(() => {
    return srsCards
      .filter((c) => c.reps >= 2 && (c.reps === 0 ? 0 : Math.max(0, c.reps - c.lapses) / c.reps) < 0.6)
      .sort((a, b) => {
        const aAcc = a.reps === 0 ? 0 : Math.max(0, a.reps - a.lapses) / a.reps;
        const bAcc = b.reps === 0 ? 0 : Math.max(0, b.reps - b.lapses) / b.reps;
        return aAcc - bAcc;
      })
      .slice(0, 10)
      .map((c) => {
        const vocab = vocabulary.find((v) => v.id === c.cardId);
        return {
          ...c,
          kanji: vocab?.kanji || c.cardId,
          meaning: vocab?.meaning || '',
          accuracy: Math.round((c.reps === 0 ? 0 : Math.max(0, c.reps - c.lapses) / c.reps) * 100),
        };
      });
  }, [srsCards, vocabulary]);

  if (weak.length === 0) return null;

  return (
    <div className="p-6 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
      <h2 className="text-sm font-semibold text-[var(--color-text)] mb-4">
        Weak Items — Need More Practice
      </h2>
      <div className="space-y-2">
        {weak.map((item) => (
          <div
            key={item.cardId}
            className="flex items-center gap-4 px-3 py-2 rounded-lg bg-[var(--color-surface-alt)]"
          >
            <span className="font-jp text-sm font-medium text-[var(--color-text)] w-24">
              {item.kanji}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
              {item.meaning}
            </span>
            <span className={`text-xs font-medium ${
              item.accuracy < 40 ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]'
            }`}>
              {item.accuracy}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
