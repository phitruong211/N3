import { useMemo, type CSSProperties } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import type { PageId } from '@/types';
import {
  BookOpen,
  Clock3,
  Flame,
  Headphones,
  Languages,
  Layers,
  RotateCcw,
  ScrollText,
} from 'lucide-react';

export function Dashboard() {
  const { getStudyDays, calculateStreak } = useLearningStorage();
  const { vocabulary, grammar, kanji, srsCards, setCurrentPage, settings } = useApp();
  const { draft, user } = useAuth();
  const todayKey = formatDate(new Date());
  const today = getStudyDays().find(day => day.date === todayKey);
  const streak = calculateStreak().current;
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const reviewed = today?.cardsReviewed ?? 0;
  const goalProgress = settings.dailyGoal > 0 ? Math.min(100, Math.round(reviewed / settings.dailyGoal * 100)) : 100;
  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const library = [
    { page: 'vocabulary' as PageId, title: 'Từ vựng', count: `${vocabulary.length.toLocaleString('vi-VN')} từ`, mark: '語', icon: BookOpen, tone: 'var(--color-accent)' },
    { page: 'grammar' as PageId, title: 'Ngữ pháp', count: `${grammar.length.toLocaleString('vi-VN')} mẫu`, mark: '文', icon: ScrollText, tone: 'var(--color-grammar)' },
    { page: 'kanji' as PageId, title: 'Kanji', count: `${kanji.length.toLocaleString('vi-VN')} chữ`, mark: '漢', icon: Languages, tone: 'var(--color-kanji)' },
    { page: 'listening' as PageId, title: 'Luyện nghe', count: 'Theo cấp độ', mark: '聴', icon: Headphones, tone: 'var(--color-success)' },
  ];

  return <div className="study-page dashboard-page">
    <header className="dashboard-heading flex items-end justify-between gap-5 border-b border-[var(--color-border)] pb-5">
      <div>
        <p className="study-eyebrow capitalize">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
      </div>
      <span className="hidden h-11 w-11 rotate-3 place-items-center rounded-full border border-[var(--color-error)] font-serif text-xl text-[var(--color-error)] sm:grid" aria-hidden="true">日</span>
    </header>

    <section className="dashboard-focus overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)]" aria-labelledby="today-focus-title">
      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
        <div className="relative overflow-hidden p-6 sm:p-9 lg:p-11">
          <span className="absolute left-0 top-10 h-20 w-1 bg-[var(--color-error)]" aria-hidden="true"/>
          <span className="study-eyebrow flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[var(--color-error)]"/>Hôm nay</span>
          <div className="mt-5 flex items-end gap-4">
            <strong className="font-serif text-[clamp(5rem,11vw,8.5rem)] font-normal leading-[.75] tracking-[-.08em] text-[var(--color-text)]">{due}</strong>
            <h2 id="today-focus-title" className="max-w-48 pb-1 text-xl font-semibold leading-tight tracking-[-.03em] sm:pb-2 sm:text-2xl">thẻ đến hạn</h2>
          </div>
          <button onClick={() => setCurrentPage(due > 0 ? 'srs' : 'flashcards')} className="study-button study-button-primary mt-8 min-w-40 !rounded-full">
            {due > 0 ? <RotateCcw size={18}/> : <Layers size={18}/>} {due > 0 ? 'Ôn ngay' : 'Học tự do'}
          </button>
          <span className="pointer-events-none absolute -bottom-14 right-5 select-none font-serif text-[11rem] leading-none text-[var(--color-text)] opacity-[.035]" aria-hidden="true">学</span>
        </div>

        <div className="dashboard-progress relative flex min-h-72 flex-col justify-between overflow-hidden bg-[var(--color-accent)] p-6 text-[var(--color-text-inverse)] sm:p-8">
          <span className="absolute -right-6 -top-12 font-serif text-[10rem] leading-none opacity-10" aria-hidden="true">今</span>
          <div className="relative flex items-start justify-between gap-4">
            <div><p className="text-[.7rem] font-bold uppercase tracking-[.14em] opacity-65">Mục tiêu</p><p className="mt-2 text-3xl font-semibold tracking-[-.04em]">{reviewed}<span className="ml-1 text-base font-medium opacity-65">/ {settings.dailyGoal}</span></p></div>
            <GoalDial value={goalProgress}/>
          </div>
          <div className="relative grid grid-cols-2 gap-3 border-t border-current/20 pt-5">
            <MiniMetric icon={Flame} value={`${streak} ngày`} label="Liên tiếp"/>
            <MiniMetric icon={Clock3} value={`${Math.round(today?.timeSpent ?? 0)} phút`} label="Hôm nay"/>
          </div>
          <button onClick={() => setCurrentPage('progress')} className="relative mt-5 flex w-fit items-center gap-1.5 text-xs font-semibold opacity-75 transition-opacity hover:opacity-100">Xem tiến độ</button>
        </div>
      </div>
    </section>

    {draft && <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Bộ thẻ đang tạo dở">
      <p className="font-semibold text-[var(--color-text)]">Bộ thẻ đang tạo vẫn được lưu.</p>
      <button className="study-button shrink-0" onClick={() => setCurrentPage('flashcards')}>Tiếp tục</button>
    </section>}

    <section aria-labelledby="library-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="study-eyebrow">Khám phá</p><h2 id="library-title" className="mt-1 text-xl font-semibold tracking-[-.025em]">Hôm nay học gì?</h2></div>
        <button className="flex items-center gap-1 text-sm font-semibold text-[var(--color-accent)] hover:underline" onClick={() => setCurrentPage('flashcards')}><Layers size={16}/> Học theo bộ</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {library.map(({ page, title, count, mark, icon: Icon, tone }) => <button key={page} onClick={() => setCurrentPage(page)} className="dashboard-library-card group relative min-h-44 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-left" style={{ '--dashboard-card-tone': tone } as CSSProperties}>
          <span className="absolute -bottom-7 right-2 select-none font-serif text-[7rem] leading-none opacity-[.08]" style={{ color: tone }} aria-hidden="true">{mark}</span>
          <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]" style={{ color: tone }}><Icon size={20}/></span>
          <h3 className="relative mt-7 text-lg font-semibold">{title}</h3>
          <p className="relative mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{count}</p>
        </button>)}
      </div>
    </section>

    <button onClick={() => setCurrentPage('flashcards')} className="dashboard-free-link group flex items-center gap-4 rounded-2xl border border-[var(--color-border)] px-5 py-4 text-left transition-colors hover:border-[var(--color-border-strong)] sm:px-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"><Layers size={20}/></span>
      <span className="flex-1 font-semibold">Mở bộ thẻ và học theo bài</span>
    </button>

    {hasLegacyLearningData() && <section className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between" role="note">
      <p className="text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text)]">Dữ liệu cũ vẫn an toàn.</strong></p>
      <button className="font-semibold text-[var(--color-accent)] hover:underline" onClick={() => setCurrentPage('settings')}>Kiểm tra →</button>
    </section>}
  </div>;
}

function GoalDial({ value }: { value: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative grid h-16 w-16 shrink-0 place-items-center" aria-label={`Đã hoàn thành ${value}% mục tiêu`}>
    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="5"/><circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}/></svg>
    <strong className="text-xs">{value}%</strong>
  </div>;
}

function MiniMetric({ icon: Icon, value, label }: { icon: typeof Flame; value: string; label: string }) {
  return <div><Icon size={17} className="mb-2 opacity-65"/><strong className="block text-sm">{value}</strong><span className="mt-0.5 block text-[.7rem] opacity-60">{label}</span></div>;
}
