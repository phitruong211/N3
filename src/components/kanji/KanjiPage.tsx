import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Search, X } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import type { KanjiItem } from '@/types';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';

export function KanjiPage() {
  const { kanji, isBookmarked, toggleBookmark, setCurrentPage, navigationTarget, clearNavigationTarget } = useApp();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<'all' | 'N3' | 'N2'>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<KanjiItem | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const showDetail = () => {
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  };

  useEffect(() => {
    if (navigationTarget?.type !== 'kanji') return;
    const target = kanji.find(item => item.id === navigationTarget.id);
    setQuery(target?.kanji ?? '');
    setLevel(target?.level ?? 'all');
    setSavedOnly(false);
    setSelected(target ?? null);
    clearNavigationTarget();
    if (window.innerWidth < 1024) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: 'start' }));
  }, [navigationTarget, kanji, clearNavigationTarget]);

  const filtered = useMemo(() => kanji.filter((item) =>
    (level === 'all' || item.level === level) &&
    (!savedOnly || isBookmarked(item.id)) &&
    (!query.trim() || [item.kanji, item.hanViet, ...item.vocabulary.flatMap(word => [word.word, word.reading, word.hanViet || '', word.meaning])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  ), [kanji, level, savedOnly, query, isBookmarked]);
  const current = filtered.find((item) => item.id === selected?.id) ?? filtered[0];

  return <div className="study-page">
    <PageHeading eyebrow="THƯ VIỆN" title="Kanji" subtitle={filtered.length + ' / ' + kanji.length + ' chữ · N3 và N2'}
      action={<button className="study-button study-button-primary" onClick={() => setCurrentPage('flashcards')}>Học bằng thẻ →</button>} />
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="study-input flex min-w-0 flex-1 items-center gap-2">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Tìm kanji hoặc âm Hán Việt</span>
        <input className="min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm chữ hoặc âm Hán Việt" />
        {query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={18}/></button>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(['all', 'N3', 'N2'] as const).map(value => <button key={value} className={'study-button ' + (level === value ? 'study-button-primary' : '')} aria-pressed={level === value} onClick={() => { setLevel(value); setSelected(null); }}>{value === 'all' ? 'Tất cả' : `${value} · ${kanji.filter(item => item.level === value).length}`}</button>)}
        <button className={'study-button ' + (savedOnly ? 'study-button-primary' : '')} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Đã lưu</button>
      </div>
    </div>
    {filtered.length === 0 ? <EmptyState title="Chưa có kanji phù hợp" detail="Thử từ khóa khác hoặc bỏ bộ lọc." action={<button className="study-button" onClick={() => { setQuery(''); setLevel('all'); setSavedOnly(false); }}>Xem tất cả</button>} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="grid max-h-[320px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6 lg:max-h-none lg:overflow-visible xl:grid-cols-7">
          {filtered.map(item => <button key={item.id} onClick={() => { setSelected(item); showDetail(); }} aria-label={`${item.kanji}, ${item.hanViet}, ${item.level}`} aria-pressed={current.id === item.id}
            className={'relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border p-1 transition-colors focus-ring ' + (current.id === item.id ? 'border-[var(--color-kanji)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <span className="absolute left-1 top-1 text-[9px] font-semibold text-[var(--color-text-tertiary)]">{item.level}</span>
            <span className="font-jp-serif text-3xl leading-none text-[var(--color-text)] sm:text-4xl">{item.kanji}</span>
            <span className="mt-1 max-w-full truncate text-[10px] text-[var(--color-text-secondary)] sm:text-xs">{item.hanViet}</span>
            {isBookmarked(item.id) && <BookmarkCheck size={12} className="absolute right-1 top-1 text-[var(--color-kanji)]" aria-label="Đã lưu" />}
          </button>)}
        </div>
        <section ref={detailRef} className="study-panel min-w-0 scroll-mt-16 lg:sticky lg:top-20" aria-label={'Chi tiết chữ ' + current.kanji}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <ContentBadge tone="kanji">KANJI {current.level}</ContentBadge>
              <p className="font-jp-serif mt-4 text-7xl leading-none text-[var(--color-text)]">{current.kanji}</p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)]">{current.hanViet}</h2>
              {(current.onyomi?.length || current.kunyomi?.length) ? <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {!!current.onyomi?.length && <p>Âm On: <span className="font-jp">{current.onyomi.join(' · ')}</span></p>}
                {!!current.kunyomi?.length && <p>Âm Kun: <span className="font-jp">{current.kunyomi.join(' · ')}</span></p>}
              </div> : null}
            </div>
            <button className="study-button shrink-0" aria-label={isBookmarked(current.id) ? 'Bỏ lưu kanji' : 'Lưu kanji'} onClick={() => toggleBookmark(current.id, 'kanji')}>
              {isBookmarked(current.id) ? <BookmarkCheck size={19}/> : <Bookmark size={19}/>}
            </button>
          </div>
          <div className="mt-7 border-t border-[var(--color-border)] pt-5">
            <h3 className="study-eyebrow mb-3">TỪ GHÉP · CÁCH ĐỌC TRONG NGỮ CẢNH</h3>
            {current.vocabulary.length ? <>
              <div className="divide-y divide-[var(--color-border)]">
                {current.vocabulary.slice(0, 3).map((word, i) => <WordRow key={i} word={word}/>)}
              </div>
              {current.vocabulary.length > 3 && <details className="mt-3 border-t border-[var(--color-border)] pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-[var(--color-kanji)]">Xem thêm {current.vocabulary.length - 3} từ</summary>
                <div className="divide-y divide-[var(--color-border)]">{current.vocabulary.slice(3).map((word, i) => <WordRow key={i} word={word}/>)}</div>
              </details>}
            </> : <p className="text-sm text-[var(--color-text-secondary)]">Chưa có từ ghép trong dữ liệu.</p>}
          </div>
        </section>
      </div>}
  </div>;
}

function WordRow({ word }: { word: KanjiItem['vocabulary'][number] }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
    <div className="min-w-0"><p className="font-jp-serif break-words text-lg text-[var(--color-text)]">{word.word}</p><p className="font-jp text-sm text-[var(--color-text-secondary)]">{word.reading}</p>{word.hanViet && <p className="break-words text-xs font-medium text-[var(--color-kanji)]">Hán Việt: {word.hanViet}</p>}</div>
    <p className="self-center break-words text-sm text-[var(--color-text-secondary)]">{word.meaning}</p>
  </div>;
}
