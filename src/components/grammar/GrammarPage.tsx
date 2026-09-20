import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck, Search, X } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import type { GrammarItem } from '@/types';
import { GrammarFlashcardSession } from '@/components/flashcard/FlashcardPage';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';

export function GrammarPage() {
  const { grammar, isBookmarked, toggleBookmark, navigationTarget, clearNavigationTarget } = useApp();
  const [query, setQuery] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);
  const [level, setLevel] = useState<'all' | 'N2' | 'N3' | 'N4'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashcardMode, setFlashcardMode] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigationTarget?.type !== 'grammar') return;
    setQuery(grammar.find(item => item.id === navigationTarget.id)?.pattern ?? '');
    setSavedOnly(false);
    setLevel('all');
    setSelectedId(navigationTarget.id);
    clearNavigationTarget();
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  }, [navigationTarget, grammar, clearNavigationTarget]);

  const filtered = useMemo(() => grammar.filter(item => {
    const text = [item.pattern, item.meaning, item.usage, item.nhom_chuc_nang, item.cong_thuc].join(' ').toLowerCase();
    return (level === 'all' || item.level === level) && (!savedOnly || isBookmarked(item.id)) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [grammar, level, savedOnly, query, isBookmarked]);
  const current = filtered.find(item => item.id === selectedId) ?? filtered[0];

  if (flashcardMode && filtered.length) return <GrammarFlashcardSession items={filtered} preserveOrder progressLevel={level === 'all' ? 'N3' : level} onExit={() => setFlashcardMode(false)} />;

  return <div className="study-page">
    <PageHeading eyebrow="THƯ VIỆN" title="Ngữ pháp" subtitle={filtered.length + ' / ' + grammar.length + ' mẫu · Hiểu cách dùng qua ví dụ'}
      action={<button className="study-button study-button-primary" disabled={!filtered.length} onClick={() => setFlashcardMode(true)}>Học bằng thẻ →</button>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <label className="study-input flex min-w-0 flex-1 items-center gap-2">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Tìm mẫu ngữ pháp</span>
        <input className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mẫu, nghĩa hoặc cách dùng" />
        {query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={18}/></button>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(['all', 'N2', 'N3', 'N4'] as const).map(value => <button key={value} className={'study-button ' + (level === value ? 'study-button-primary' : '')} aria-pressed={level === value} onClick={() => setLevel(value)}>{value === 'all' ? 'Tất cả' : value}</button>)}
        <button className={'study-button ' + (savedOnly ? 'study-button-primary' : '')} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Đã lưu</button>
      </div>
    </div>
    {!filtered.length ? <EmptyState title="Chưa có mẫu ngữ pháp phù hợp" detail="Thử từ khóa khác hoặc bỏ bộ lọc." action={<button className="study-button" onClick={() => { setQuery(''); setLevel('all'); setSavedOnly(false); }}>Xem tất cả</button>} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="max-h-[40vh] space-y-2 overflow-y-auto lg:max-h-[calc(100vh-230px)]">
          {filtered.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' })); }} aria-pressed={current.id === item.id}
            className={'w-full min-w-0 rounded-xl border p-4 text-left transition-colors focus-ring ' + (current.id === item.id ? 'border-[var(--color-grammar)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <div className="flex items-start justify-between gap-3"><span className="font-jp-serif min-w-0 break-words text-lg font-semibold text-[var(--color-text)]">{item.pattern}</span><span className="study-eyebrow shrink-0">{item.level}</span></div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{item.meaning}</p>
          </button>)}
        </div>
        <div ref={detailRef} className="min-w-0 scroll-mt-16 lg:sticky lg:top-20"><GrammarDetail item={current} bookmarked={isBookmarked(current.id)} onBookmark={() => toggleBookmark(current.id, 'grammar')} /></div>
      </div>}
  </div>;
}

function GrammarDetail({ item, bookmarked, onBookmark }: { item: GrammarItem; bookmarked: boolean; onBookmark: () => void }) {
  return <section className="study-panel min-w-0 lg:sticky lg:top-20" aria-label={'Chi tiết ' + item.pattern}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <ContentBadge tone="grammar">NGỮ PHÁP {item.level}</ContentBadge>
        <h2 className="font-jp-serif mt-4 break-words text-3xl font-semibold leading-snug text-[var(--color-text)] sm:text-4xl">{item.pattern}</h2>
        {item.reading && <p className="font-jp mt-2 break-words text-sm text-[var(--color-text-secondary)]">{item.reading}</p>}
      </div>
      <button className="study-button shrink-0" aria-label={bookmarked ? 'Bỏ lưu ngữ pháp' : 'Lưu ngữ pháp'} onClick={onBookmark}>{bookmarked ? <BookmarkCheck size={19}/> : <Bookmark size={19}/>}</button>
    </div>
    <p className="mt-5 break-words text-lg font-semibold text-[var(--color-text)]">{item.meaning}</p>
    {item.cong_thuc && <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4">
      <h3 className="study-eyebrow mb-2">CÔNG THỨC</h3><p className="font-jp whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--color-text)]">{item.cong_thuc}</p>
    </div>}
    {item.giai_thich_toi_uu && <DetailSection title="Cách dùng" open><p className="study-copy whitespace-pre-wrap">{item.giai_thich_toi_uu}</p></DetailSection>}
    {item.vi_du.length > 0 && <DetailSection title={'Ví dụ (' + item.vi_du.length + ')'} open>
      <div className="divide-y divide-[var(--color-border)]">{item.vi_du.map((example, i) => <div key={i} className="py-3 first:pt-0 last:pb-0"><p className="font-jp break-words text-base text-[var(--color-text)]">{example.japanese}</p>{example.reading && <p className="font-jp mt-1 break-words text-xs text-[var(--color-text-tertiary)]">{example.reading}</p>}<p className="mt-1 break-words text-sm text-[var(--color-text-secondary)]">{example.meaning}</p></div>)}</div>
    </DetailSection>}
    {item.cac_cach_dung.length > 0 && <DetailSection title="Các cách dùng">{item.cac_cach_dung.map((usage, i) => <div key={i} className="mb-3 last:mb-0"><p className="font-jp font-semibold text-[var(--color-text)]">{usage.mau || usage.nghia}</p><p className="study-copy">{usage.nghia}{usage.giai_thich ? ' · ' + usage.giai_thich : ''}</p></div>)}</DetailSection>}
    {item.so_sanh_n4_n5.length > 0 && <DetailSection title="So sánh mẫu ngữ pháp">{item.so_sanh_n4_n5.map((comparison, i) => <div key={i} className="mb-3 last:mb-0"><p className="font-jp font-semibold text-[var(--color-text)]">{comparison.mau}</p><p className="study-copy">{comparison.khac_biet_chinh}</p></div>)}</DetailSection>}
    {item.canh_bao.length > 0 && <DetailSection title="Lưu ý">{item.canh_bao.map((warning, i) => <p className="study-copy mb-2 last:mb-0" key={i}>{warning}</p>)}</DetailSection>}
  </section>;
}

function DetailSection({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  const [expanded, setExpanded] = useState(open);
  return <details className="mt-5 border-t border-[var(--color-border)] pt-4" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text)]">{title}</summary>
    <div className="mt-3">{children}</div>
  </details>;
}
