import { startLevel, TARGET_LEVEL_KEY } from '@/lib/targetLevel';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck, Search, X } from '@/components/ui/icons';
import { useApp } from '@/hooks/useApp';
import type { GrammarItem } from '@/types';
import { StudySession } from '@/components/flashcard/StudySession';
import { grammarCard } from '@/lib/cards';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';
import { DetailPane, LearnDot, LearnFilter } from '@/components/library/LibraryParts';
import { countStates, learnStates, stateOf, type LearnState } from '@/lib/learnState';
import { useWide } from '@/hooks/useWide';

export function GrammarPage() {
  const { grammar, isBookmarked, toggleBookmark, navigationTarget, clearNavigationTarget, srsCards, storage } = useApp();
  const wide = useWide();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [learn, setLearn] = useState<LearnState | 'all'>('all');
  const states = useMemo(() => learnStates(srsCards, 'grammar'), [srsCards]);
  // Links can carry ?q= so the page opens already filtered.
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [savedOnly, setSavedOnly] = useState(false);
  const [level, setLevel] = useState<'all' | 'N5' | 'N4' | 'N3' | 'N2'>(() => startLevel(storage.getJSON(TARGET_LEVEL_KEY, 'all'), ['N5', 'N4', 'N3', 'N2'] as const));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashcardMode, setFlashcardMode] = useState(false);

  useEffect(() => {
    if (navigationTarget?.type !== 'grammar') return;
    setQuery(grammar.find(item => item.id === navigationTarget.id)?.pattern ?? '');
    setSavedOnly(false);
    setLevel('all');
    setSelectedId(navigationTarget.id);
    clearNavigationTarget();
    setSheetOpen(true);
  }, [navigationTarget, grammar, clearNavigationTarget]);

  const matching = useMemo(() => grammar.filter(item => {
    const text = [item.pattern, item.meaning, item.usage, item.nhom_chuc_nang, item.cong_thuc].join(' ').toLowerCase();
    return (level === 'all' || item.level === level) && (!savedOnly || isBookmarked(item.id)) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [grammar, level, savedOnly, query, isBookmarked]);
  const counts = useMemo(() => countStates(matching.map(item => item.id), states), [matching, states]);
  const filtered = useMemo(() => learn === 'all' ? matching : matching.filter(item => stateOf(states, item.id) === learn), [matching, learn, states]);
  const current = filtered.find(item => item.id === selectedId) ?? filtered[0];

  if (flashcardMode && filtered.length) return <StudySession cards={filtered.map((item, index) => grammarCard(item, `library-grammar-${level}`, index))} deckName={`Ngữ pháp · ${level === 'all' ? 'Tất cả' : level}`} mode="flashcards" onExit={() => setFlashcardMode(false)} />;

  return <div className="study-page">
    <PageHeading title="Ngữ pháp" subtitle={filtered.length === grammar.length ? `${grammar.length} mẫu` : `${filtered.length} / ${grammar.length} mẫu`}
      action={<button className="study-button study-button-primary" disabled={!filtered.length} onClick={() => setFlashcardMode(true)}>Học bằng thẻ →</button>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <label className="study-input flex min-w-0 flex-1 items-center gap-2">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Tìm mẫu ngữ pháp</span>
        <input className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm mẫu, nghĩa hoặc cách dùng" />
        {query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={18}/></button>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(['all', 'N5', 'N4', 'N3', 'N2'] as const).map(value => <button key={value} className={'study-button ' + (level === value ? 'study-button-primary' : '')} aria-pressed={level === value} onClick={() => setLevel(value)}>{value === 'all' ? 'Tất cả' : value}</button>)}
        <button className={'study-button ' + (savedOnly ? 'study-button-primary' : '')} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Đã lưu</button>
      </div>
    </div>
    <LearnFilter value={learn} counts={counts} onChange={setLearn}/>
    {!filtered.length ? <EmptyState title="Chưa có mẫu ngữ pháp phù hợp" detail="Thử từ khóa khác hoặc bỏ bộ lọc." action={<button className="study-button" onClick={() => { setQuery(''); setLevel('all'); setSavedOnly(false); setLearn('all'); }}>Xem tất cả</button>} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-2 lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto">
          {filtered.map(item => <button key={item.id} onClick={() => { setSelectedId(item.id); setSheetOpen(true); }} aria-pressed={wide && current.id === item.id}
            className={'w-full min-w-0 rounded-xl border p-4 text-left transition-colors focus-ring ' + (wide && current.id === item.id ? 'border-[var(--color-grammar)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <div className="flex items-start justify-between gap-3"><span className="font-jp-serif min-w-0 break-words text-lg font-semibold text-[var(--color-text)]">{item.pattern}</span><span className="flex shrink-0 items-center gap-2"><LearnDot state={stateOf(states, item.id)}/><span className="study-eyebrow">{item.level}</span></span></div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{item.meaning}</p>
          </button>)}
        </div>
        <DetailPane wide={wide} open={sheetOpen} title={current.pattern} onClose={() => setSheetOpen(false)}>
          <div className="min-w-0 lg:sticky lg:top-20"><GrammarDetail item={current} bookmarked={isBookmarked(current.id)} onBookmark={() => toggleBookmark(current.id, 'grammar')} /></div>
        </DetailPane>
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
      <button className="study-button shrink-0" aria-label={bookmarked ? 'Bỏ lưu ngữ pháp' : 'Lưu ngữ pháp'} onClick={onBookmark}>{bookmarked ? <BookmarkCheck size={19} className="stamp-pop"/> : <Bookmark size={19}/>}</button>
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
    <summary className="hit cursor-pointer text-sm font-semibold text-[var(--color-text)]">{title}</summary>
    <div className="mt-3">{children}</div>
  </details>;
}
