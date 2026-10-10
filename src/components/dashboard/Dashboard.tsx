import { useMemo } from 'react';
import { useApp, useLearningStorage } from '@/hooks/useApp';
import { formatDate, getDueCards } from '@/lib/srs';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import type { PageId } from '@/types';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Clock3,
  Flame,
  Headphones,
  Languages,
  Layers,
  ScrollText,
  Target,
} from 'lucide-react';

export function Dashboard() {
  const { getStudyDays, calculateStreak } = useLearningStorage();
  const { vocabulary, grammar, kanji, srsCards, setCurrentPage, settings } = useApp();
  const { draft, user } = useAuth();
  const todayKey = formatDate(new Date());
  const studyDays = getStudyDays();
  const today = studyDays.find(day => day.date === todayKey);
  const streak = calculateStreak().current;
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const reviewed = today?.cardsReviewed ?? 0;
  const remaining = Math.max(0, settings.dailyGoal - reviewed);
  const goalProgress = settings.dailyGoal > 0 ? Math.min(100, Math.round(reviewed / settings.dailyGoal * 100)) : 100;
  const displayName = user?.displayName?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const dateLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const library = [
    { page: 'vocabulary' as PageId, title: 'Từ vựng', subtitle: `${vocabulary.length.toLocaleString('vi-VN')} từ theo cấp độ`, icon: BookOpen, tone: 'var(--color-accent)' },
    { page: 'grammar' as PageId, title: 'Ngữ pháp', subtitle: `${grammar.length.toLocaleString('vi-VN')} mẫu N4–N2`, icon: ScrollText, tone: 'var(--color-grammar)' },
    { page: 'kanji' as PageId, title: 'Kanji', subtitle: `${kanji.length.toLocaleString('vi-VN')} chữ và từ mở rộng`, icon: Languages, tone: 'var(--color-kanji)' },
    { page: 'listening' as PageId, title: 'Luyện nghe', subtitle: 'Podcast và hội thoại theo cấp độ', icon: Headphones, tone: 'var(--color-success)' },
  ];

  return <div className="study-page dashboard-page">
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="study-eyebrow capitalize">{dateLabel}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{greeting}{displayName ? `, ${displayName}` : ''}.</h1>
      </div>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)] sm:text-right">Giữ nhịp đều mỗi ngày. Một phiên tập trung là đủ để tiến về phía trước.</p>
    </header>

    <section className="dashboard-hero overflow-hidden rounded-[1.4rem] bg-[var(--color-text)] text-[var(--color-bg)]" aria-labelledby="today-focus-title">
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
        <span className="pointer-events-none absolute -right-4 -top-16 select-none font-serif text-[13rem] leading-none opacity-[.055]" aria-hidden="true">学</span>
        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.14em] opacity-60">Nhịp học hôm nay</p>
          <h2 id="today-focus-title" className="mt-3 max-w-xl text-2xl font-semibold leading-tight tracking-[-.035em] sm:text-3xl">{remaining > 0 ? `Còn ${remaining} thẻ để hoàn thành mục tiêu.` : 'Bạn đã hoàn thành mục tiêu hôm nay.'}</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 opacity-70">{due > 0 ? `${due} thẻ đang đến hạn. Chọn đúng bộ thẻ rồi bắt đầu chế độ ôn ngắt quãng.` : 'Chọn một bộ thẻ để học tự do hoặc bắt đầu xây lịch ôn ngắt quãng.'}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setCurrentPage('flashcards')} className="study-button !border-transparent !bg-[var(--color-bg)] !text-[var(--color-text)] hover:!opacity-90"><Layers size={18}/> Mở bộ thẻ <ArrowRight size={17}/></button>
            <button onClick={() => setCurrentPage('progress')} className="study-button !border-white/20 !bg-transparent !text-inherit hover:!bg-white/10">Xem tiến độ</button>
          </div>
        </div>
        <GoalRing value={goalProgress} reviewed={reviewed} goal={settings.dailyGoal}/>
      </div>
      <div className="grid border-t border-white/10 sm:grid-cols-3">
        <HeroMetric icon={Flame} value={`${streak} ngày`} label="Chuỗi hiện tại"/>
        <HeroMetric icon={Clock3} value={`${Math.round(today?.timeSpent ?? 0)} phút`} label="Thời gian học"/>
        <HeroMetric icon={Target} value={`${due} thẻ`} label="Đang đến hạn"/>
      </div>
    </section>

    {draft && <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-accent)]/25 bg-[var(--color-accent-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Bộ thẻ đang tạo dở">
      <div><p className="font-semibold text-[var(--color-text)]">Tiếp tục bộ thẻ đang tạo</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Tên bộ và nội dung đã nhập vẫn được giữ nguyên.</p></div>
      <button className="study-button shrink-0" onClick={() => setCurrentPage('flashcards')}>Tiếp tục <ArrowRight size={17}/></button>
    </section>}

    <section aria-labelledby="library-title">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div><p className="study-eyebrow">Thư viện</p><h2 id="library-title" className="mt-1 text-xl font-semibold">Chọn nội dung muốn luyện</h2></div>
        <button className="hidden items-center gap-1 text-sm font-semibold text-[var(--color-accent)] hover:underline sm:flex" onClick={() => setCurrentPage('vocabulary')}>Mở thư viện <ArrowUpRight size={16}/></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {library.map(({ page, title, subtitle, icon: Icon, tone }) => <button key={page} onClick={() => setCurrentPage(page)} className="study-panel group min-h-40 cursor-pointer text-left transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)]">
          <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-surface-alt)]"><Icon size={21} style={{ color: tone }}/></span><ArrowUpRight size={17} className="text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/></div>
          <h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{subtitle}</p>
        </button>)}
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-2" aria-label="Hành động nhanh">
      <button onClick={() => setCurrentPage('flashcards')} className="study-panel group flex min-h-28 cursor-pointer items-center gap-4 text-left transition-colors hover:border-[var(--color-border-strong)]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"><Layers size={23}/></span>
        <span className="min-w-0 flex-1"><strong className="block">Bộ thẻ của bạn</strong><span className="mt-1 block text-sm text-[var(--color-text-secondary)]">Học tự do hoặc ôn ngắt quãng theo từng bộ</span></span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/>
      </button>
      <button onClick={() => setCurrentPage('progress')} className="study-panel group flex min-h-28 cursor-pointer items-center gap-4 text-left transition-colors hover:border-[var(--color-border-strong)]">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-success-subtle)] text-[var(--color-success)]"><ChartNoAxesCombined size={23}/></span>
        <span className="min-w-0 flex-1"><strong className="block">Tiến độ học tập</strong><span className="mt-1 block text-sm text-[var(--color-text-secondary)]">Xem chuỗi ngày học và lịch sử hoạt động</span></span><ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/>
      </button>
    </section>

    {hasLegacyLearningData() && <section className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-5 text-sm sm:flex-row sm:items-center sm:justify-between" role="note">
      <p className="text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text)]">Dữ liệu phiên bản cũ vẫn an toàn.</strong> Kiểm tra và chuyển dữ liệu trong Cài đặt.</p>
      <button className="font-semibold text-[var(--color-accent)] hover:underline" onClick={() => setCurrentPage('settings')}>Kiểm tra dữ liệu →</button>
    </section>}
  </div>;
}

function GoalRing({ value, reviewed, goal }: { value: number; reviewed: number; goal: number }) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  return <div className="relative z-[1] mx-auto grid h-36 w-36 shrink-0 place-items-center lg:mx-5" aria-label={`Đã học ${reviewed} trên mục tiêu ${goal} thẻ`}>
    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeOpacity=".14" strokeWidth="8"/><circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}/></svg>
    <div className="text-center"><strong className="block text-3xl leading-none">{reviewed}</strong><span className="mt-2 block text-[.68rem] font-semibold uppercase tracking-[.12em] opacity-60">/ {goal} thẻ</span></div>
  </div>;
}

function HeroMetric({ icon: Icon, value, label }: { icon: typeof Flame; value: string; label: string }) {
  return <div className="flex items-center gap-3 px-6 py-4 sm:px-8"><Icon size={18} className="shrink-0 opacity-60"/><div><strong className="block text-sm">{value}</strong><span className="block text-xs opacity-[.55]">{label}</span></div></div>;
}
