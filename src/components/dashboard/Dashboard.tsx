import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import type { PageId } from '@/types';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Flame,
  Headphones,
  Languages,
  Layers,
  RotateCcw,
  ScrollText,
} from 'lucide-react';
import { ACTIVE_CAT } from './catConfig';
import { detectCompanionCapabilities, shouldEnableCompanion, watchReducedMotion } from './companionPolicy';
import { daypart, japaneseDate, weekStamps, wordOfDay } from './todayData';
import './dashboard.css';

const CatCompanion = lazy(() => import('./CatCompanion'));

export function Dashboard() {
  const { getStudyDays, calculateStreak } = useLearningStorage();
  const { vocabulary, grammar, kanji, srsCards, setCurrentPage, settings, loading } = useApp();
  const { draft, user } = useAuth();
  const now = new Date();
  const todayKey = formatDate(now);
  const studyDays = useMemo(() => getStudyDays(), [getStudyDays]);
  const today = studyDays.find(day => day.date === todayKey);
  const day = useMemo(() => new Date(`${todayKey}T00:00:00`), [todayKey]);
  const week = useMemo(() => weekStamps(studyDays, day), [studyDays, day]);
  const word = useMemo(() => loading ? null : wordOfDay(vocabulary, day), [loading, vocabulary, day]);
  const legacyDataPresent = useMemo(() => hasLegacyLearningData(), []);
  const streak = calculateStreak().current;
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const reviewed = today?.cardsReviewed ?? 0;
  const goalProgress = settings.dailyGoal > 0 ? Math.min(100, Math.round(reviewed / settings.dailyGoal * 100)) : 0;
  const goalComplete = settings.dailyGoal > 0 && reviewed >= settings.dailyGoal;
  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  const { part, greeting } = daypart(now.getHours());
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  const library = [
    { page: 'vocabulary' as PageId, title: 'Từ vựng', count: loading ? '' : `${vocabulary.length.toLocaleString('vi-VN')} từ`, mark: '語', icon: BookOpen, tone: 'var(--color-accent)' },
    { page: 'grammar' as PageId, title: 'Ngữ pháp', count: loading ? '' : `${grammar.length.toLocaleString('vi-VN')} mẫu`, mark: '文', icon: ScrollText, tone: 'var(--color-grammar)' },
    { page: 'kanji' as PageId, title: 'Kanji', count: loading ? '' : `${kanji.length.toLocaleString('vi-VN')} chữ`, mark: '漢', icon: Languages, tone: 'var(--color-kanji)' },
    { page: 'listening' as PageId, title: 'Luyện nghe', count: 'Theo cấp độ', mark: '聴', icon: Headphones, tone: 'var(--color-success)' },
  ];

  return <div className="study-page dashboard-page" data-daypart={part}>
    <section className="dash-hero" aria-labelledby="today-focus-title">
      <span className="dash-orb" aria-hidden="true"/>
      <p className="dash-vdate" lang="ja" aria-hidden="true">{japaneseDate(now)}</p>
      <div className="dash-hero-main">
        <p className="study-eyebrow capitalize">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
        <div className="dash-due">
          <strong>{due}</strong>
          <h2 id="today-focus-title">thẻ đến hạn</h2>
          <span className="dash-hanko" lang="ja" aria-hidden="true">今日</span>
        </div>
        <button onClick={() => setCurrentPage(due > 0 ? 'srs' : 'flashcards')} className="study-button study-button-primary dash-cta !rounded-full">
          {due > 0 ? <RotateCcw size={18}/> : <Layers size={18}/>} {due > 0 ? 'Ôn ngay' : 'Học tự do'}
        </button>
      </div>
      <StudyCompanion due={due} goalComplete={goalComplete}/>
    </section>

    {draft && <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Bộ thẻ đang tạo dở">
      <p className="font-semibold text-[var(--color-text)]">Bộ thẻ đang tạo vẫn được lưu.</p>
      <button className="study-button shrink-0" onClick={() => setCurrentPage('flashcards')}>Tiếp tục</button>
    </section>}

    <div className="dash-row">
      <section className="dash-panel" aria-label="Mục tiêu hôm nay">
        <p className="dash-panel-title">Mục tiêu</p>
        <div className="dash-goal">
          <EnsoDial value={goalProgress} complete={goalComplete}/>
          <div>
            <p className="dash-count">{reviewed}<span>/ {settings.dailyGoal}</span></p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">thẻ đã ôn hôm nay</p>
          </div>
        </div>
        <TodayPostcard due={due} complete={goalComplete}/>
      </section>

      <section className="dash-panel" aria-label="Tuần này">
        <p className="dash-panel-title">Tuần này</p>
        <ul className="dash-week">
          {week.map((day, index) => <li key={day.date} className={`dash-day ${day.studied ? 'is-studied' : ''} ${day.isToday ? 'is-today' : ''}`} style={{ '--i': index } as CSSProperties}
            aria-label={`${day.label}${day.isToday ? ', hôm nay' : ''}: ${day.studied ? 'đã học' : 'chưa học'}`}>
            <span className="dash-stamp" lang="ja" aria-hidden="true">{day.studied ? '学' : ''}</span>
            <span aria-hidden="true">{day.label}</span>
          </li>)}
        </ul>
        <div className="dash-metrics">
          <MiniMetric icon={Flame} value={`${streak} ngày`} label="Liên tiếp"/>
          <MiniMetric icon={Clock3} value={`${Math.round(today?.timeSpent ?? 0)} phút`} label="Hôm nay"/>
        </div>
        <button onClick={() => setCurrentPage('progress')} className="dash-link">Xem tiến độ <ArrowRight size={14}/></button>
      </section>
    </div>

    {word && <button className="dash-word" onClick={() => setCurrentPage('vocabulary')}>
      <span className="dash-word-kanji" lang="ja">{word.tu}</span>
      <span className="min-w-0">
        <span className="dash-panel-title block">Từ của hôm nay</span>
        <span className="dash-word-reading mt-1 block" lang="ja">{word.phien_am}{word.han_viet ? ` · ${word.han_viet}` : ''}</span>
        <span className="dash-word-meaning block">{word.nghia[0] ?? ''}</span>
      </span>
      <ArrowRight size={18} aria-hidden="true"/>
    </button>}

    <section aria-labelledby="library-title">
      <div className="flex items-end justify-between gap-4">
        <div><p className="study-eyebrow">Khám phá</p><h2 id="library-title" className="mt-1 text-xl font-semibold tracking-[-.025em]">Hôm nay học gì?</h2></div>
        <button className="flex items-center gap-1 text-sm font-semibold text-[var(--color-accent-text)] hover:underline" onClick={() => setCurrentPage('flashcards')}><Layers size={16}/> Học theo bộ</button>
      </div>
      <div className="dash-ema-grid">
        {library.map(({ page, title, count, mark, icon: Icon, tone }, index) => <button key={page} onClick={() => setCurrentPage(page)} className="dashboard-library-card" style={{ '--dashboard-card-tone': tone, '--dashboard-card-delay': `${.14 + index * .055}s` } as CSSProperties}>
          <span className="dash-ema-clip" aria-hidden="true"><span className="dashboard-card-mark" lang="ja" style={{ color: tone }}>{mark}</span></span>
          <span className="dashboard-card-icon" style={{ color: tone }}><Icon size={20}/></span>
          <h3 className="relative mt-5 text-lg font-semibold">{title}</h3>
          <p className="relative mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{count}</p>
        </button>)}
      </div>
    </section>

    <button onClick={() => setCurrentPage('flashcards')} className="dashboard-free-link">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]"><Layers size={20}/></span>
      <span className="flex-1 font-semibold">Mở bộ thẻ và học theo bài</span>
      <ArrowRight size={18} className="text-[var(--color-text-secondary)]" aria-hidden="true"/>
    </button>

    {legacyDataPresent && <section className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between" role="note">
      <p className="text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text)]">Dữ liệu cũ vẫn an toàn.</strong></p>
      <button className="font-semibold text-[var(--color-accent-text)] hover:underline" onClick={() => setCurrentPage('settings')}>Kiểm tra →</button>
    </section>}
  </div>;
}

function TodayPostcard({ due, complete }: { due: number; complete: boolean }) {
  const title = complete ? 'Hôm nay đã xong' : due > 0 ? 'Một lượt ôn ngắn' : 'Sẵn sàng học mới';
  const caption = complete ? 'Mục tiêu đã hoàn thành' : due > 0 ? `${due} thẻ đang chờ bạn` : 'Chọn một bộ thẻ để bắt đầu';
  return <div className={`dashboard-postcard ${complete ? 'is-complete' : ''}`} role="status">
    <div className="dashboard-card-stack" aria-hidden="true">
      <span className="dashboard-study-card dashboard-study-card-back"/>
      <span className="dashboard-study-card dashboard-study-card-middle"/>
      <span className="dashboard-study-card dashboard-study-card-front">
        <span className="dashboard-postcard-mark" lang="ja">{complete ? '完' : '学'}</span>
        {complete && <span className="dashboard-complete-check"><Check size={12} strokeWidth={3}/></span>}
      </span>
    </div>
    <div className="min-w-0">
      <p className="dash-postcard-label">Bưu thiếp hôm nay</p>
      <p className="mt-1 text-sm font-semibold leading-snug">{title}</p>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{caption}</p>
    </div>
  </div>;
}

function StudyCompanion({ due, goalComplete }: { due: number; goalComplete: boolean }) {
  const [ready, setReady] = useState(false);
  const initiallyEnabled = useMemo(() => shouldEnableCompanion(detectCompanionCapabilities()), []);
  const [enabled, setEnabled] = useState(initiallyEnabled);

  useEffect(() => watchReducedMotion(reduced => {
    setEnabled(reduced ? false : shouldEnableCompanion(detectCompanionCapabilities()));
    if (reduced) setReady(false);
  }), []);

  return <aside className="dashboard-companion-nook" aria-label="Góc của Kuro">
    <div className="dashboard-companion-note">
      <span className="dashboard-companion-name">くろ · KURO</span>
      <p>{goalComplete ? 'Giỏi lắm. Nghỉ một chút nhé.' : due > 0 ? 'Từng chút một, mình cùng học nhé.' : 'Một trang mới, có mình bên cạnh.'}</p>
      <span className="dashboard-companion-hint">{ready ? 'Chạm nhẹ để chào Kuro' : 'Bạn đồng hành mỗi ngày'}</span>
    </div>
    <div className={`dashboard-header-companion ${ready ? 'is-ready' : ''}`}>
    <span className="dashboard-header-seal" lang="ja" aria-hidden="true">猫</span>
    {enabled && <Suspense fallback={null}>
      <CatCompanion config={ACTIVE_CAT} due={due} goalComplete={goalComplete} onReady={() => setReady(true)} onUnavailable={() => setReady(false)}/>
    </Suspense>}
    </div>
  </aside>;
}

/** An ink circle that stays open like a brushed ensō, drawn to the goal percentage. */
function EnsoDial({ value, complete }: { value: number; complete: boolean }) {
  return <div className={`dash-enso ${complete ? 'is-complete' : ''}`} role="img" aria-label={`Đã hoàn thành ${value}% mục tiêu`}>
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="track" cx="50" cy="50" r="42" pathLength="100" strokeDasharray="94 100"/>
      <circle className="ink" cx="50" cy="50" r="42" pathLength="100" style={{ strokeDasharray: `${(value * .94).toFixed(1)} 100`, opacity: value > 0 ? 1 : 0 }}/>
    </svg>
    <strong aria-hidden="true">{value}%</strong>
  </div>;
}

function MiniMetric({ icon: Icon, value, label }: { icon: typeof Flame; value: string; label: string }) {
  return <div><Icon size={17}/><strong>{value}</strong><span>{label}</span></div>;
}
