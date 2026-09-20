import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bookmark, BookmarkCheck, Search, Volume2, X } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import type { VocabItem } from '@/types';
import { VocabFlashcardSession, speakJapanese } from '@/components/flashcard/FlashcardPage';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';

export function VocabularyPage() {
  const { vocabulary, isBookmarked, toggleBookmark, navigationTarget, clearNavigationTarget } = useApp();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | 'N3' | 'N4'>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(80);
  const [focusMode, setFocusMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigationTarget?.type !== 'vocabulary') return;
    const target = vocabulary.find(item => item.id === navigationTarget.id);
    setQuery(target?.tu ?? '');
    setLevel('all');
    setSavedOnly(false);
    setSelectedId(navigationTarget.id);
    setVisibleCount(80);
    clearNavigationTarget();
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  }, [navigationTarget, vocabulary, clearNavigationTarget]);

  const filtered = useMemo(() => vocabulary.filter(item => {
    const text = [item.tu, item.phien_am, item.meaning, item.han_viet ?? ''].join(' ').toLowerCase();
    return (level === 'all' || item.level === level) && (!savedOnly || isBookmarked(item.id)) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [vocabulary, level, savedOnly, query, isBookmarked]);
  const current = filtered.find(item => item.id === selectedId) ?? filtered[0];
  const focusIndex = current ? filtered.findIndex(item => item.id === current.id) : 0;
  const select = useCallback((id: string) => {
    setSelectedId(id);
    const index = filtered.findIndex(item => item.id === id);
    if (index >= visibleCount) setVisibleCount(index + 1);
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  }, [filtered, visibleCount]);
  const changeFilter = (change: () => void) => { change(); setSelectedId(null); setVisibleCount(80); };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (focusMode || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
      if (event.key === '/' || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); searchRef.current?.focus(); }
      if (!current) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = Math.max(0, Math.min(filtered.length - 1, focusIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        select(filtered[next].id);
      }
      if (event.key.toLowerCase() === 'b') toggleBookmark(current.id, 'vocabulary');
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusMode(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, current, filtered, focusIndex, toggleBookmark, select]);

  if (focusMode && current) return <VocabFlashcardSession items={filtered} initialIndex={focusIndex} preserveOrder onExit={() => setFocusMode(false)} />;

  return <div className="study-page">
    <PageHeading eyebrow="THƯ VIỆN" title="Từ vựng" subtitle={filtered.length + ' / ' + vocabulary.length + ' từ · Đọc, nghe và nhớ nghĩa'}
      action={<button className="study-button study-button-primary" disabled={!current} onClick={() => setFocusMode(true)}>Học bằng thẻ →</button>} />
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <label className="study-input flex min-w-0 flex-1 items-center gap-2">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Tìm từ vựng</span>
        <input ref={searchRef} className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e => changeFilter(() => setQuery(e.target.value))} placeholder="Tìm chữ, cách đọc hoặc nghĩa" />
        {query && <button aria-label="Xóa tìm kiếm" onClick={() => changeFilter(() => setQuery(''))}><X size={18}/></button>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(['all', 'N3', 'N4'] as const).map(value => <button key={value} className={'study-button ' + (level === value ? 'study-button-primary' : '')} aria-pressed={level === value} onClick={() => changeFilter(() => setLevel(value))}>{value === 'all' ? 'Tất cả' : value}</button>)}
        <button className={'study-button ' + (savedOnly ? 'study-button-primary' : '')} aria-pressed={savedOnly} onClick={() => changeFilter(() => setSavedOnly(!savedOnly))}>Đã lưu</button>
      </div>
    </div>
    {!filtered.length ? <EmptyState title="Chưa có từ phù hợp" detail="Thử từ khóa khác hoặc bỏ bộ lọc." action={<button className="study-button" onClick={() => { setQuery(''); setLevel('all'); setSavedOnly(false); }}>Xem tất cả</button>} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="max-h-[40vh] space-y-2 overflow-y-auto lg:max-h-[calc(100vh-230px)]">
          {filtered.slice(0, visibleCount).map(item => <button key={item.id} onClick={() => select(item.id)} aria-pressed={current.id === item.id}
            className={'w-full min-w-0 rounded-xl border p-4 text-left transition-colors focus-ring ' + (current.id === item.id ? 'border-[var(--color-accent)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <div className="flex items-start justify-between gap-3"><span className="font-jp-serif break-words text-lg font-semibold text-[var(--color-text)]">{item.tu}</span><span className="study-eyebrow shrink-0">{item.level}</span></div>
            <p className="font-jp mt-1 break-words text-sm text-[var(--color-text-secondary)]">{item.phien_am}</p>
            {item.han_viet && <p className="mt-1 break-words text-xs text-[var(--color-text-tertiary)]">Hán Việt: {item.han_viet}</p>}
            <p className="mt-1 line-clamp-2 break-words text-sm text-[var(--color-text-secondary)]">{item.meaning}</p>
          </button>)}
          {visibleCount < filtered.length && <button className="study-button w-full" onClick={() => setVisibleCount(Math.min(filtered.length, visibleCount + 80))}>Xem thêm {Math.min(80, filtered.length - visibleCount)} từ</button>}
        </div>
        <div ref={detailRef} className="min-w-0 scroll-mt-16 lg:sticky lg:top-20"><VocabDetail item={current} bookmarked={isBookmarked(current.id)} onBookmark={() => toggleBookmark(current.id, 'vocabulary')} onStudy={() => setFocusMode(true)} /></div>
      </div>}
  </div>;
}

function VocabDetail({ item, bookmarked, onBookmark, onStudy }: { item: VocabItem; bookmarked: boolean; onBookmark: () => void; onStudy: () => void }) {
  return <section className="study-panel min-w-0 lg:sticky lg:top-20" aria-label={'Chi tiết từ ' + item.tu}>
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0"><ContentBadge tone="vocabulary">TỪ VỰNG {item.level}</ContentBadge>
        <h2 className="font-jp-serif mt-4 break-words text-4xl font-semibold leading-snug text-[var(--color-text)] sm:text-5xl">{item.tu}</h2>
        <p className="font-jp mt-2 break-words text-lg text-[var(--color-accent)]">{item.phien_am}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button className="study-button" aria-label="Nghe phát âm" onClick={() => speakJapanese(item.tu)}><Volume2 size={19}/></button>
        <button className="study-button" aria-label={bookmarked ? 'Bỏ lưu từ' : 'Lưu từ'} onClick={onBookmark}>{bookmarked ? <BookmarkCheck size={19}/> : <Bookmark size={19}/>}</button>
      </div>
    </div>
    <div className="mt-5 border-t border-[var(--color-border)] pt-5">
      <h3 className="study-eyebrow mb-2">NGHĨA TIẾNG VIỆT</h3>
      {item.nghia.map((meaning, i) => <p key={i} className="break-words text-lg font-semibold leading-relaxed text-[var(--color-text)]">{item.nghia.length > 1 ? (i + 1) + '. ' : ''}{meaning}</p>)}
      <div className="mt-4 flex flex-wrap gap-2">{item.han_viet && <ContentBadge>Hán Việt: {item.han_viet}</ContentBadge>}{item.loai_tu?.map((type, i) => <ContentBadge key={i}>{type}</ContentBadge>)}</div>
    </div>
    {item.dong_tu && <DetailSection title="Thông tin động từ">
      {item.dong_tu.nhom && <p className="study-copy">Nhóm {item.dong_tu.nhom}</p>}
      {item.dong_tu.tu_tha && <p className="study-copy">{item.dong_tu.tu_tha}</p>}
      {item.dong_tu.tro_tu_goi_y.length > 0 && <p className="study-copy">Trợ từ: {item.dong_tu.tro_tu_goi_y.join(', ')}</p>}
      {item.dong_tu.cap_tuong_ung.map((pair, i) => <p key={i} className="study-copy"><span className="font-jp">{pair.tu} ({pair.phien_am})</span> · {pair.quan_he}</p>)}
    </DetailSection>}
    {item.cach_doc_khac.length > 0 && <DetailSection title="Cách đọc khác">{item.cach_doc_khac.map((reading, i) => <p key={i} className="study-copy mb-2"><span className="font-jp">{reading.phien_am}</span> · {reading.nghia.join(', ')}{reading.sac_thai && ' · ' + reading.sac_thai}</p>)}</DetailSection>}
    {item.bien_the.length > 0 && <DetailSection title="Biến thể">{item.bien_the.map((variant, i) => <p key={i} className="study-copy mb-2"><span className="font-jp">{variant.tu} ({variant.phien_am})</span>{variant.ghi_chu && ' · ' + variant.ghi_chu}</p>)}</DetailSection>}
    {item.tu_lien_quan.length > 0 && <DetailSection title={'Từ liên quan (' + item.tu_lien_quan.length + ')'}>{item.tu_lien_quan.map((related, i) => <p key={i} className="study-copy mb-2"><span className="font-jp">{related.tu} ({related.phien_am})</span> · {Array.isArray(related.nghia) ? related.nghia.join(', ') : related.nghia}</p>)}</DetailSection>}
    {item.ghi_chu && <DetailSection title="Ghi chú"><p className="study-copy whitespace-pre-wrap">{item.ghi_chu}</p></DetailSection>}
    <button className="study-button study-button-primary mt-6 w-full" onClick={onStudy}>Học từ này →</button>
  </section>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="mt-5 border-t border-[var(--color-border)] pt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--color-text)]">{title}</summary><div className="mt-3">{children}</div></details>;
}
