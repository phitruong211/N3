import { useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { getDueCards, formatDate } from '@/lib/srs';
import { getStudyDays } from '@/lib/storage';
import { ArrowRight, BookOpen, ScrollText, Languages, RotateCcw, Layers, ChartNoAxesCombined } from 'lucide-react';
import { PageHeading } from '@/components/ui/StudyUI';
import type { PageId } from '@/types';

export function Dashboard() {
  const { vocabulary, grammar, kanji, srsCards, setCurrentPage } = useApp();
  const due = useMemo(() => getDueCards(srsCards).length, [srsCards]);
  const today = getStudyDays().find(day => day.date === formatDate(new Date()));
  const cards = [
    { page: 'vocabulary' as PageId, title: 'Từ vựng', subtitle: `${vocabulary.filter(item => item.level === 'N3').length} từ N3`, icon: BookOpen, tone: 'var(--color-accent)' },
    { page: 'grammar' as PageId, title: 'Ngữ pháp', subtitle: `${grammar.filter(item => item.level === 'N3').length} mẫu N3`, icon: ScrollText, tone: 'var(--color-grammar)' },
    { page: 'kanji' as PageId, title: 'Kanji', subtitle: `${kanji.filter(item => item.level === 'N3').length} N3 · ${kanji.filter(item => item.level === 'N2').length} N2`, icon: Languages, tone: 'var(--color-kanji)' },
  ];

  return <div className="study-page space-y-8">
    <PageHeading eyebrow="Sổ học · N2 / N3 / N4" title="Hôm nay học gì?" subtitle="Một phiên ngắn, tập trung vào điều cần nhớ." />
    <section className="study-panel p-6 sm:p-8 lg:p-10 relative overflow-hidden" aria-labelledby="next-study-title">
      <div className="absolute inset-y-0 left-0 w-1 bg-[var(--color-accent)]" />
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="space-y-3 max-w-xl">
          <p className="study-eyebrow">Bước tiếp theo</p>
          <h2 id="next-study-title" className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            {due > 0 ? `Bạn có ${due} thẻ cần ôn` : 'Sẵn sàng học điều mới?'}
          </h2>
          <p className="study-subtitle">{due > 0 ? 'Ôn đúng lúc giúp bạn giữ lại những gì đã học.' : 'Bắt đầu với bộ từ vựng N3 hoặc chọn một chủ đề bên dưới.'}</p>
        </div>
        <button onClick={() => setCurrentPage(due > 0 ? 'srs' : 'flashcards')} className="study-button study-button-primary shrink-0">
          {due > 0 ? <RotateCcw size={18} /> : <Layers size={18} />}{due > 0 ? 'Ôn ngay' : 'Chọn bộ thẻ'}<ArrowRight size={17} />
        </button>
      </div>
    </section>
    <section aria-labelledby="library-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3"><div><p className="study-eyebrow">Khám phá</p><h2 id="library-title" className="text-xl font-semibold">Thư viện học</h2></div><span className="text-xs text-[var(--color-text-tertiary)]">N2 / N3 / N4</span></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ page, title, subtitle, icon: Icon, tone }) => <button key={page} onClick={() => setCurrentPage(page)} className="study-panel min-h-36 p-5 text-left cursor-pointer hover:border-[var(--color-border-strong)] transition-colors group">
          <div className="flex items-center justify-between"><Icon size={23} style={{ color: tone }} /><ArrowRight size={17} className="text-[var(--color-text-tertiary)] group-hover:translate-x-1 transition-transform" /></div>
          <h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
        </button>)}
      </div>
    </section>
    <section className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center border-t border-[var(--color-border)] pt-6" aria-label="Tiến độ hôm nay">
      <div><p className="study-eyebrow">Hôm nay</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]"><strong className="text-[var(--color-text)]">{today?.cardsReviewed ?? 0}</strong> thẻ đã học · <strong className="text-[var(--color-text)]">{due}</strong> thẻ còn đến hạn</p></div>
      <button onClick={() => setCurrentPage('progress')} className="study-button"><ChartNoAxesCombined size={17} /> Xem tiến độ</button>
    </section>
  </div>;
}
