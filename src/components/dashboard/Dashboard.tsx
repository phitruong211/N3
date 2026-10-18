import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import type { PageId } from '@/types';
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronRight,
  Headphones,
  Languages,
  Layers,
  RotateCcw,
  ScrollText,
} from 'lucide-react';
import { ACTIVE_CAT } from './catConfig';
import { detectCompanionCapabilities, shouldEnableCompanion, watchReducedMotion } from './companionPolicy';

const CatCompanion = lazy(() => import('./CatCompanion'));

export function Dashboard() {
  const { getStudyDays, calculateStreak } = useLearningStorage();
  const { vocabulary, grammar, kanji, srsCards, setCurrentPage, settings } = useApp();
  const { draft, user } = useAuth();
  const todayKey = formatDate(new Date());
  const studyDays = useMemo(() => getStudyDays(), [getStudyDays]);
  const today = studyDays.find(day => day.date === todayKey);
  const legacyDataPresent = useMemo(() => hasLegacyLearningData(), []);
  const streak = calculateStreak().current;
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const reviewed = today?.cardsReviewed ?? 0;
  const goalProgress = settings.dailyGoal > 0 ? Math.min(100, Math.round(reviewed / settings.dailyGoal * 100)) : 0;
  const goalComplete = settings.dailyGoal > 0 && reviewed >= settings.dailyGoal;
  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const library = [
    { page: 'vocabulary' as PageId, title: 'Từ vựng', count: `${vocabulary.length.toLocaleString('vi-VN')} từ`, icon: BookOpen, tone: 'var(--color-accent)' },
    { page: 'grammar' as PageId, title: 'Ngữ pháp', count: `${grammar.length.toLocaleString('vi-VN')} mẫu`, icon: ScrollText, tone: 'var(--color-grammar)' },
    { page: 'kanji' as PageId, title: 'Kanji', count: `${kanji.length.toLocaleString('vi-VN')} chữ`, icon: Languages, tone: 'var(--color-kanji)' },
    { page: 'listening' as PageId, title: 'Luyện nghe', count: 'Theo cấp độ', icon: Headphones, tone: 'var(--color-success)' },
  ];
  const more = [
    { page: 'flashcards' as PageId, title: 'Bộ thẻ', count: 'Học theo bài', icon: Layers, tone: 'var(--color-text-secondary)' },
    { page: 'progress' as PageId, title: 'Tiến độ', count: streak > 0 ? `${streak} ngày liên tiếp` : '', icon: ChartNoAxesCombined, tone: 'var(--color-text-secondary)' },
  ];
  const row = ({ page, title, count, icon: Icon, tone }: typeof library[number]) => <li key={page}>
    <button onClick={() => setCurrentPage(page)} className="today-row">
      <span className="today-row-icon" style={{ background: tone }}><Icon size={17} strokeWidth={2}/></span>
      <span className="today-row-title">{title}</span>
      <span className="today-row-detail">{count}</span>
      <ChevronRight size={16} className="today-row-chevron" aria-hidden="true"/>
    </button>
  </li>;

  return <div className="study-page dashboard-page">
    <header className="dashboard-heading">
      <p className="study-eyebrow capitalize">{dateLabel}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
    </header>

    <section className="today-hero" aria-labelledby="today-focus-title">
      <div className="today-count">
        <strong>{due}</strong>
        <h2 id="today-focus-title">thẻ đến hạn</h2>
      </div>
      <button onClick={() => setCurrentPage(due > 0 ? 'srs' : 'flashcards')} className="study-button study-button-primary today-cta">
        {due > 0 ? <RotateCcw size={18}/> : <Layers size={18}/>} {due > 0 ? 'Ôn ngay' : 'Học tự do'}
      </button>
      {settings.dailyGoal > 0 && <div className="today-progress">
        <div className="today-progress-bar" role="progressbar" aria-label="Mục tiêu hôm nay" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalProgress}>
          <span style={{ width: `${goalProgress}%` }} data-complete={goalComplete || undefined}/>
        </div>
        <p>{goalComplete ? 'Đã đạt mục tiêu hôm nay' : `${reviewed}/${settings.dailyGoal} thẻ hôm nay`}</p>
      </div>}
      <StudyCompanion due={due} goalComplete={goalComplete}/>
    </section>

    {draft && <section className="today-notice" aria-label="Bộ thẻ đang tạo">
      <p>Bộ thẻ đang tạo vẫn được lưu.</p>
      <button className="today-notice-action" onClick={() => setCurrentPage('flashcards')}>Tiếp tục</button>
    </section>}

    <section aria-labelledby="library-title">
      <h2 id="library-title" className="today-group-title">Thư viện</h2>
      <ul className="today-list">{library.map(row)}</ul>
    </section>

    <section aria-label="Khác">
      <ul className="today-list">{more.map(row)}</ul>
    </section>

    {legacyDataPresent && <section className="today-notice" role="note">
      <p><strong>Dữ liệu cũ vẫn an toàn.</strong></p>
      <button className="today-notice-action" onClick={() => setCurrentPage('settings')}>Kiểm tra</button>
    </section>}
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
    <span className="dashboard-header-seal font-serif" aria-hidden="true">猫</span>
    {enabled && <Suspense fallback={null}>
      <CatCompanion config={ACTIVE_CAT} due={due} goalComplete={goalComplete} onReady={() => setReady(true)} onUnavailable={() => setReady(false)}/>
    </Suspense>}
    </div>
  </aside>;
}
