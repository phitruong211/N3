// ============================================================
// Dashboard — Study Session & Course Metrics Home
// ============================================================
// Clean, soothing, eye-friendly typography & pastel aesthetics
// Focused purely on study telemetry: streak, today's activity,
// due reviews, SRS retention distribution, and course parameters.
// ============================================================

import React, { useMemo, useEffect } from 'react';
import { useApp } from '@/hooks/useApp';
import { getDueCards, getStateDistribution } from '@/lib/srs';
import { calculateStreak, getStudyDays } from '@/lib/storage';
import {
  Flame,
  TrendingUp,
  Activity,
  Clock,
  Sparkles,
  Compass,
  ArrowRight,
  BookOpen,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export function Dashboard() {
  const { vocabulary, srsCards, setCurrentPage } = useApp();

  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);
  const distribution = useMemo(() => getStateDistribution(srsCards), [srsCards]);
  const streak = useMemo(() => calculateStreak(), []);
  const studyDays = useMemo(() => getStudyDays(), []);

  const todayStudy = studyDays.find(
    (d) => d.date === new Date().toISOString().split('T')[0]
  );

  // Press Enter on Dashboard to launch study session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
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
  }, [dueCards.length, setCurrentPage]);

  return (
    <div className="w-full space-y-10 pb-24 pt-4 min-h-[calc(100vh-4rem)]">
      {/* ============================================================
          PAGE HEADER: Gentle, Soothing & Warm
          ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)]/60 pb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] text-xs font-semibold tracking-wide">
            <Sparkles size={13} className="text-[var(--color-accent)]" />
            <span>HỆ THỐNG THEO DÕI HỌC TẬP N3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] tracking-tight font-sans">
            Tổng Quan Học Tập
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] font-normal">
            Theo dõi chuỗi ngày học, số thẻ đã xem hôm nay và thông số tiến độ ghi nhớ SRS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{dueCards.length > 0 ? `CẦN ÔN: ${dueCards.length} THẺ` : 'ĐÃ ÔN HẾT THẺ HÔM NAY'}</span>
          </div>
          <button
            onClick={() => setCurrentPage(dueCards.length > 0 ? 'srs' : 'flashcards')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-blue-700 text-white font-semibold text-xs tracking-wide transition-colors shadow-xs cursor-pointer"
          >
            <span>Vào bài học</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ============================================================
          SECTION 1: 4 THẺ CHỈ SỐ BÀI HỌC (Soothing Typography)
          ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: CHUỖI NGÀY HỌC */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 hover:border-amber-500/50 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] tracking-wider">
              CHUỖI NGÀY HỌC
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Flame size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] tracking-tight font-sans">
              {streak.current} <span className="text-lg font-normal text-[var(--color-text-secondary)]">ngày</span>
            </div>
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1.5">
              <span>Kỷ lục cao nhất: {streak.longest} ngày</span>
            </div>
          </div>
        </div>

        {/* Metric 2: ĐÃ HỌC HÔM NAY */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 hover:border-blue-500/50 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] tracking-wider">
              ĐÃ HỌC HÔM NAY
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Activity size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] tracking-tight font-sans">
              {todayStudy?.cardsReviewed || 0} <span className="text-lg font-normal text-[var(--color-text-secondary)]">thẻ</span>
            </div>
            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1.5">
              <span>+{todayStudy?.newCardsLearned || 0} từ mới hôm nay</span>
            </div>
          </div>
        </div>

        {/* Metric 3: CẦN ÔN HÔM NAY */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 hover:border-rose-500/50 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] tracking-wider">
              CẦN ÔN HÔM NAY
            </span>
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform ${
              dueCards.length > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {dueCards.length > 0 ? <Clock size={20} /> : <CheckCircle2 size={20} />}
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] tracking-tight font-sans">
              {dueCards.length} <span className="text-lg font-normal text-[var(--color-text-secondary)]">thẻ</span>
            </div>
            <div className={`text-xs font-medium mt-2 flex items-center gap-1.5 ${
              dueCards.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              <span>{dueCards.length > 0 ? 'Sẵn sàng kiểm tra SRS' : 'Hoàn tất bài ôn hôm nay'}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: TỶ LỆ THUỘC BÀI */}
        <div className="p-6 sm:p-7 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 hover:border-emerald-500/50 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] tracking-wider">
              TỶ LỆ THUỘC BÀI
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] tracking-tight font-sans">
              {Math.round((distribution.mastered / Math.max(srsCards.length, 1)) * 100)}%
            </div>
            <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
              <span>{distribution.mastered} / {srsCards.length} thẻ đã thành thạo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          SECTION 2: THÔNG SỐ TIẾN ĐỘ SRS & THAM SỐ KHÓA HỌC
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (col-span-7): Phân Bổ Ghi Nhớ Spaced Repetition */}
        <div className="lg:col-span-7 p-7 sm:p-8 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border)]/50 pb-4">
            <div>
              <h3 className="text-lg font-bold text-[var(--color-text)]">
                Phân bổ tiến độ ghi nhớ SRS
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Các mức độ thành thạo theo lặp lại ngắt quãng của toàn bộ từ vựng N3
              </p>
            </div>
            <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-alt)] px-3 py-1.5 rounded-xl border border-[var(--color-border)]">
              Tổng số lượng: <strong className="text-[var(--color-text)]">{srsCards.length} thẻ</strong>
            </span>
          </div>

          {/* Gentle, Rounded 18px Spectrum Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] font-medium">
              <span>MỨC ĐỘ THÀNH THẠO</span>
              <span>100% TỔNG THẺ</span>
            </div>
            <div className="flex gap-1.5 h-4.5 rounded-full overflow-hidden bg-[var(--color-surface-alt)] p-1 border border-[var(--color-border)]/70">
              {distribution.mastered > 0 && (
                <div
                  className="bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(distribution.mastered / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Thành thạo: ${distribution.mastered}`}
                />
              )}
              {distribution.review > 0 && (
                <div
                  className="bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(distribution.review / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Đang ôn tập: ${distribution.review}`}
                />
              )}
              {distribution.learning > 0 && (
                <div
                  className="bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${(distribution.learning / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Đang học: ${distribution.learning}`}
                />
              )}
              {distribution.new > 0 && (
                <div
                  className="bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-500"
                  style={{ width: `${(distribution.new / Math.max(srsCards.length, 1)) * 100}%` }}
                  title={`Chưa học: ${distribution.new}`}
                />
              )}
            </div>
          </div>

          {/* Soothing 4-stage data grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Thành thạo</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] mt-1.5">
                {distribution.mastered}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {Math.round((distribution.mastered / Math.max(srsCards.length, 1)) * 100)}% tổng số
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Đang ôn</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] mt-1.5">
                {distribution.review}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {Math.round((distribution.review / Math.max(srsCards.length, 1)) * 100)}% tổng số
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Mới quen</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] mt-1.5">
                {distribution.learning}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {Math.round((distribution.learning / Math.max(srsCards.length, 1)) * 100)}% tổng số
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span>Chưa học</span>
              </div>
              <div className="text-2xl font-bold text-[var(--color-text)] mt-1.5">
                {distribution.new}
              </div>
              <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                {Math.round((distribution.new / Math.max(srsCards.length, 1)) * 100)}% tổng số
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (col-span-5): Thông Số Khóa Học N3 & Phím Tắt Thao Tác */}
        <div className="lg:col-span-5 space-y-6">
          {/* Widget 1: Thông Số Học Phần Khóa Học N3 */}
          <div className="p-7 sm:p-8 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 pb-4">
              <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                <Layers size={18} className="text-blue-500" />
                <span>Quy Mô Học Phần N3</span>
              </h3>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">CHỈ SỐ DỮ LIỆU</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text)]">Từ vựng N3</span>
                </div>
                <span className="text-base font-bold text-[var(--color-text)]">{vocabulary.length} từ</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text)]">Hán tự (Kanji) N3</span>
                </div>
                <span className="text-base font-bold text-[var(--color-text)]">200+ Hán tự</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <TrendingUp size={16} />
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text)]">Ngữ pháp N3</span>
                </div>
                <span className="text-base font-bold text-[var(--color-text)]">150+ mẫu câu</span>
              </div>
            </div>
          </div>

          {/* Widget 2: Phím Tắt Thao Tác Nhanh */}
          <div className="p-7 sm:p-8 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 pb-4">
              <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                <Compass size={18} className="text-[var(--color-text-secondary)]" />
                <span>Phím tắt thao tác nhanh</span>
              </h3>
              <span className="text-xs font-medium text-[var(--color-text-tertiary)]">PHÍM NHANH</span>
            </div>
            <div className="space-y-2.5 text-xs font-medium text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/40">
                <span>Lật thẻ / Xem đáp án</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">Space / Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/40">
                <span>Đánh giá độ nhớ (SRS)</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">1 – 4</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/40">
                <span>Đến trang Từ vựng</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G V</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/40">
                <span>Đến trang Kanji</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G K</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/40">
                <span>Đến trang Ngữ pháp</span>
                <kbd className="kbd-shortcut text-xs px-2.5 py-1">G G</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
