import { useEffect, useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Search, X } from '@/components/ui/icons';
import { useApp } from '@/hooks/useApp';
import type { KanjiItem } from '@/types';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';
import { DetailPane, LearnDot, LearnFilter } from '@/components/library/LibraryParts';
import { countStates, learnStates, stateOf, type LearnState } from '@/lib/learnState';
import { useWide } from '@/hooks/useWide';

export function KanjiPage() {
  const { kanji, isBookmarked, toggleBookmark, setCurrentPage, navigationTarget, clearNavigationTarget, srsCards } = useApp();
  const wide = useWide();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [learn, setLearn] = useState<LearnState | 'all'>('all');
  const states = useMemo(() => learnStates(srsCards, 'kanji'), [srsCards]);
  // The dictionary links here with ?q=, so a word found there opens already filtered.
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [level, setLevel] = useState<'all' | 'N3' | 'N4' | 'N2'>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<KanjiItem | null>(null);

  useEffect(() => {
    if (navigationTarget?.type !== 'kanji') return;
    const target = kanji.find(item => item.id === navigationTarget.id);
    setQuery(target?.kanji ?? '');
    setLevel(target?.level ?? 'all');
    setSavedOnly(false);
    setSelected(target ?? null);
    clearNavigationTarget();
    setSheetOpen(true);
  }, [navigationTarget, kanji, clearNavigationTarget]);

  const matching = useMemo(() => kanji.filter((item) =>
    (level === 'all' || item.level === level) &&
    (!savedOnly || isBookmarked(item.id)) &&
    (!query.trim() || [item.kanji, item.hanViet, ...item.vocabulary.flatMap(word => [word.word, word.reading, word.hanViet || '', word.meaning])].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  ), [kanji, level, savedOnly, query, isBookmarked]);
  const counts = useMemo(() => countStates(matching.map(item => item.id), states), [matching, states]);
  const filtered = useMemo(() => learn === 'all' ? matching : matching.filter(item => stateOf(states, item.id) === learn), [matching, learn, states]);
  const current = filtered.find((item) => item.id === selected?.id) ?? filtered[0];

  return <div className="study-page">
    <PageHeading title="Kanji" subtitle={filtered.length === kanji.length ? `${kanji.length} chữ` : `${filtered.length} / ${kanji.length} chữ`}
      action={<button className="study-button study-button-primary" onClick={() => setCurrentPage('flashcards')}>Học bằng thẻ →</button>} />
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="study-input flex min-w-0 flex-1 items-center gap-2">
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="sr-only">Tìm kanji hoặc âm Hán Việt</span>
        <input className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm chữ hoặc âm Hán Việt" />
        {query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={18}/></button>}
      </label>
      <div className="flex flex-wrap gap-2">
        {(['all', 'N4', 'N3', 'N2'] as const).map(value => <button key={value} className={'study-button ' + (level === value ? 'study-button-primary' : '')} aria-pressed={level === value} onClick={() => { setLevel(value); setSelected(null); }}>{value === 'all' ? 'Tất cả' : `${value} · ${kanji.filter(item => item.level === value).length}`}</button>)}
        <button className={'study-button ' + (savedOnly ? 'study-button-primary' : '')} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)}>Đã lưu</button>
      </div>
    </div>
    <LearnFilter value={learn} counts={counts} onChange={setLearn}/>
    {filtered.length === 0 ? <EmptyState title="Chưa có kanji phù hợp" detail="Thử từ khóa khác hoặc bỏ bộ lọc." action={<button className="study-button" onClick={() => { setQuery(''); setLevel('all'); setSavedOnly(false); setLearn('all'); }}>Xem tất cả</button>} /> :
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-7">
          {filtered.map(item => <button key={item.id} onClick={() => { setSelected(item); setSheetOpen(true); }} aria-pressed={wide && current.id === item.id}
            className={'relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-xl border p-1 transition-colors focus-ring ' + (wide && current.id === item.id ? 'border-[var(--color-kanji)] bg-[var(--color-surface-alt)]' : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]')}>
            <span className="absolute left-1.5 top-1.5 flex items-center gap-1 text-xs font-semibold text-[var(--color-text-tertiary)]"><LearnDot state={stateOf(states, item.id)}/>{level === 'all' && item.level}</span>
            <span className="font-jp-serif text-3xl leading-none text-[var(--color-text)] sm:text-4xl">{item.kanji}</span>
            <span className="mt-1 max-w-full truncate text-xs text-[var(--color-text-secondary)]">{item.hanViet}</span>
            {isBookmarked(item.id) && <BookmarkCheck size={12} className="absolute right-1 top-1 text-[var(--color-kanji)]" aria-label="Đã lưu" />}
          </button>)}
        </div>
        <DetailPane wide={wide} open={sheetOpen} title={`${current.kanji} · ${current.hanViet}`} onClose={() => setSheetOpen(false)}>
        <section className="study-panel min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto" aria-label={'Chi tiết chữ ' + current.kanji}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <ContentBadge tone="kanji">KANJI {current.level}</ContentBadge>
              <p className="font-jp-serif mt-4 text-7xl leading-none text-[var(--color-text)]">{current.kanji}</p>
              <h2 className="mt-3 text-xl font-semibold text-[var(--color-text)]">{current.hanViet}</h2>
              {current.meaning && <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{current.meaning}</p>}
              {(current.onyomi?.length || current.kunyomi?.length) ? <div className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {!!current.onyomi?.length && <p>Âm On: <span className="font-jp">{current.onyomi.join(' · ')}</span></p>}
                {!!current.kunyomi?.length && <p>Âm Kun: <span className="font-jp">{current.kunyomi.join(' · ')}</span></p>}
              </div> : null}
            </div>
            <button className="study-button shrink-0" aria-label={isBookmarked(current.id) ? 'Bỏ lưu kanji' : 'Lưu kanji'} onClick={() => toggleBookmark(current.id, 'kanji')}>
              {isBookmarked(current.id) ? <BookmarkCheck size={19} className="stamp-pop"/> : <Bookmark size={19}/>}
            </button>
          </div>
          <div className="mt-7 border-t border-[var(--color-border)] pt-5">
            <h3 className="study-eyebrow mb-3">TỪ GHÉP · CÁCH ĐỌC TRONG NGỮ CẢNH</h3>
            {current.vocabulary.length ? <>
              <div className="divide-y divide-[var(--color-border)]">
                {current.vocabulary.slice(0, 3).map((word, i) => <WordRow key={i} word={word}/>)}
              </div>
              {current.vocabulary.length > 3 && <details className="mt-3 border-t border-[var(--color-border)] pt-3">
                <summary className="hit cursor-pointer text-sm font-semibold text-[var(--color-kanji)]">Xem thêm {current.vocabulary.length - 3} từ</summary>
                <div className="divide-y divide-[var(--color-border)]">{current.vocabulary.slice(3).map((word, i) => <WordRow key={i} word={word}/>)}</div>
              </details>}
            </> : <p className="text-sm text-[var(--color-text-secondary)]">Chưa có từ ghép trong dữ liệu.</p>}
          </div>
        </section>
        </DetailPane>
      </div>}
  </div>;
}

function WordRow({ word }: { word: KanjiItem['vocabulary'][number] }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
    <div className="min-w-0"><p className="font-jp-serif break-words text-lg text-[var(--color-text)]">{word.word}</p><p className="font-jp text-sm text-[var(--color-text-secondary)]">{word.reading}</p>{word.hanViet && <p className="break-words text-xs font-medium text-[var(--color-kanji)]">Hán Việt: {word.hanViet}</p>}</div>
    <p className="self-center break-words text-sm text-[var(--color-text-secondary)]">{word.meaning}</p>
  </div>;
}
