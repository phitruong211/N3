import { useLearningStorage } from '@/hooks/useApp';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Check, ExternalLink, RefreshCw, RotateCcw, Search, Volume2, X } from '@/components/ui/icons';
import { AppDialog } from '@/components/ui/AppDialog';
import { EmptyState, PageHeading } from '@/components/ui/StudyUI';
import { JlptListeningPractice } from './JlptListeningPractice';

type Level = 'N4' | 'N3' | 'N2';
type Episode = {
  id: string;
  sourceId: string;
  title: string;
  levels: Level[];
  category: string;
  kind: string;
  publishedAt: string;
  durationSeconds: number;
  audioUrl: string;
  sourceUrl: string;
};
type Source = { id: string; name: string; url: string };
type Catalogue = { updatedAt: string; sources: Source[]; episodes: Episode[] };
type Practice = { saved?: boolean; listened?: boolean; difficult?: boolean; hidden?: boolean; note?: string };
type PracticeMap = Record<string, Practice>;
type View = 'all' | 'saved' | 'difficult' | 'listened' | 'hidden';
type Mode = 'understand' | 'dictation' | 'shadow';

const STORAGE_KEY = 'nhat-listening-v1';
const PAGE_SIZE = 24;
const REMOTE_CATALOGUE = 'https://raw.githubusercontent.com/phitruong211/N3/main/public/data/listening.json';



function formatDuration(seconds: number) {
  if (!seconds) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function mixSources(episodes: Episode[]) {
  const buckets = new Map<string, Episode[]>();
  for (const episode of episodes) {
    if (!buckets.has(episode.sourceId)) buckets.set(episode.sourceId, []);
    buckets.get(episode.sourceId)!.push(episode);
  }
  const mixed: Episode[] = [];
  while (mixed.length < episodes.length) {
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (next) mixed.push(next);
    }
  }
  return mixed;
}

export function ListeningPage() {
  const { getJSON, setJSON } = useLearningStorage();
  const readPractice = () => getJSON<PracticeMap>(STORAGE_KEY, {});
  const [section, setSection] = useState<'library' | 'exam'>('library');
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [practice, setPractice] = useState<PracticeMap>(readPractice);
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [source, setSource] = useState('all');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<'mixed' | 'newest'>('mixed');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('understand');
  const [speed, setSpeed] = useState(1);
  const [audioFailed, setAudioFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;
    const accept = (data: Catalogue) => {
      if (!active || !Array.isArray(data.episodes) || !Array.isArray(data.sources)) return;
      setCatalogue(current => !current || data.updatedAt > current.updatedAt ? data : current);
      setLoadError(false);
    };
    const local = fetch(`${import.meta.env.BASE_URL}data/listening.json`).then(response => {
      if (!response.ok) throw new Error('Local catalogue unavailable');
      return response.json();
    }).then(accept).catch(() => { if (active) setLoadError(true); });
    // The scheduled feed sync commits this file daily. Reading it directly also updates
    // deployments that do not rebuild when GitHub Actions commits a catalogue change.
    void local.then(() => active ? fetch(`${REMOTE_CATALOGUE}?t=${Math.floor(Date.now() / 3600000)}`) : Promise.reject(new Error("Unmounted")))
      .then(response => { if (!response.ok) throw new Error('Remote catalogue unavailable'); return response.json(); })
      .then(accept).catch(() => {});
    return () => { active = false; };
  }, []);

  const updatePractice = (id: string, patch: Partial<Practice>) => {
    setPractice(previous => {
      const next = { ...previous, [id]: { ...previous[id], ...patch } };
      setJSON(STORAGE_KEY, next);
      return next;
    });
  };

  const resetResults = () => setVisibleCount(PAGE_SIZE);
  const categories = useMemo(() => [...new Set(catalogue?.episodes.map(episode => episode.category) || [])].sort(), [catalogue]);
  const kinds = useMemo(() => [...new Set(catalogue?.episodes.map(episode => episode.kind) || [])].sort(), [catalogue]);
  const sources = useMemo(() => Object.fromEntries((catalogue?.sources || []).map(item => [item.id, item.name])), [catalogue]);
  const selected = catalogue?.episodes.find(episode => episode.id === selectedId);
  const results = useMemo(() => {
    const filtered = (catalogue?.episodes || []).filter(episode => {
      const state = practice[episode.id] || {};
      if (level !== 'all' && !episode.levels.includes(level)) return false;
      if (source !== 'all' && episode.sourceId !== source) return false;
      if (category !== 'all' && episode.category !== category) return false;
      if (kind !== 'all' && episode.kind !== kind) return false;
      if (view === 'all' && state.hidden) return false;
      if (view === 'saved' && (!state.saved || state.hidden)) return false;
      if (view === 'difficult' && (!state.difficult || state.hidden)) return false;
      if (view === 'listened' && (!state.listened || state.hidden)) return false;
      if (view === 'hidden' && !state.hidden) return false;
      return !query.trim() || episode.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) || episode.category.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    });
    return sort === 'mixed' ? mixSources(filtered) : filtered;
  }, [catalogue, level, source, category, kind, query, view, sort, practice]);

  const openEpisode = (episode: Episode) => {
    setSelectedId(episode.id);
    setAudioFailed(false);
    setMode('understand');
    setSpeed(1);
  };

  const [filtersOpen, setFiltersOpen] = useState(false);
  const listened = Object.values(practice).filter(item => item.listened).length;
  const activeFilters = [level !== 'all', source !== 'all', category !== 'all', kind !== 'all', sort !== 'mixed'].filter(Boolean).length;
  const tabs = <nav className="tab-row" aria-label="Chọn cách luyện nghe">
    <button className="tab" aria-current={section === 'library' ? 'page' : undefined} onClick={() => setSection('library')}>Thư viện nghe</button>
    <button className="tab" aria-current={section === 'exam' ? 'page' : undefined} onClick={() => { setSelectedId(null); setSection('exam'); }}>Luyện thi JLPT</button>
  </nav>;

  if (section === 'exam') return <div className="study-page">
    <PageHeading title="Luyện nghe" />
    {tabs}
    <JlptListeningPractice />
  </div>;

  return <div className="study-page">
    <PageHeading title="Luyện nghe"
      action={<p className="text-right"><strong className="block font-[family-name:var(--font-display)] text-4xl font-normal leading-none">{listened}</strong><span className="study-eyebrow">Bạn đã nghe</span></p>} />
    {tabs}

    <section className="space-y-4" aria-label="Lọc bài nghe">
      <div className="flex gap-3">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Tìm bài nghe</span><Search className="absolute left-3 top-3.5 text-[var(--color-text-tertiary)]" size={17} /><input value={query} onChange={event => { setQuery(event.target.value); resetResults(); }} className="study-input !pl-10" placeholder="Tìm chủ đề, tiêu đề…" /></label>
        <button className="study-button shrink-0" aria-expanded={filtersOpen} aria-controls="listening-filters" onClick={() => setFiltersOpen(open => !open)}>Bộ lọc{activeFilters > 0 && <span className="study-pill !min-h-6 !px-2" aria-label={`${activeFilters} bộ lọc đang bật`}>{activeFilters}</span>}</button>
      </div>
      {filtersOpen && <div id="listening-filters" className="study-panel grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label><span className="study-eyebrow">Cấp độ</span><select className="study-input mt-2" value={level} onChange={event => { setLevel(event.target.value as typeof level); resetResults(); }}><option value="all">Tất cả mức</option>{(['N4', 'N3', 'N2'] as const).map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span className="study-eyebrow">Nguồn</span><select className="study-input mt-2" value={source} onChange={event => { setSource(event.target.value); resetResults(); }}><option value="all">Tất cả nguồn</option>{catalogue?.sources.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label><span className="study-eyebrow">Chủ đề</span><select className="study-input mt-2" value={category} onChange={event => { setCategory(event.target.value); resetResults(); }}><option value="all">Tất cả chủ đề</option>{categories.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span className="study-eyebrow">Dạng bài</span><select className="study-input mt-2" value={kind} onChange={event => { setKind(event.target.value); resetResults(); }}><option value="all">Tất cả dạng bài</option>{kinds.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
        <label><span className="study-eyebrow">Sắp xếp</span><select className="study-input mt-2" value={sort} onChange={event => { setSort(event.target.value as 'mixed' | 'newest'); resetResults(); }}><option value="mixed">Trộn nhiều nguồn</option><option value="newest">Mới nhất trước</option></select></label>
      </div>}
      <div className="tab-row" role="group" aria-label="Danh sách bài">
        {([['all', 'Khám phá'], ['saved', 'Đã lưu'], ['difficult', 'Cần ôn'], ['listened', 'Đã nghe'], ['hidden', 'Đã ẩn']] as [View, string][]).map(([id, label]) => <button key={id} className="tab" onClick={() => { setView(id); resetResults(); }} aria-pressed={view === id}>{label}</button>)}
      </div>
    </section>

    {loadError && !catalogue && <EmptyState art="wave" title="Chưa tải được thư viện nghe" detail="Hãy kiểm tra kết nối rồi tải lại trang." />}
    {catalogue && <section className="space-y-4" aria-label="Kết quả bài nghe">
      <h2 className="text-lg font-semibold">{results.length.toLocaleString('vi-VN')} bài phù hợp</h2>
      {results.length === 0 ? <EmptyState art="wave" title="Không có bài phù hợp" detail="Hãy thử đổi bộ lọc hoặc xem các bài đã ẩn." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {results.slice(0, visibleCount).map(episode => {
          const state = practice[episode.id] || {};
          return <article key={episode.id} className="study-panel !p-5 flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5"><span className="study-pill">{episode.levels.join(' / ')}</span><span className="study-pill">{episode.kind}</span>{state.listened && <span className="study-pill !bg-[var(--color-success-subtle)] !text-[var(--color-success)]"><Check size={13} /> Đã nghe</span>}</div>
            <h3 className="font-jp text-base font-semibold leading-relaxed line-clamp-2" lang="ja">{episode.title}</h3>
            <p className="mt-auto text-xs text-[var(--color-text-secondary)]">{sources[episode.sourceId]}{episode.durationSeconds ? ` · ${formatDuration(episode.durationSeconds)}` : ''}{episode.publishedAt ? ` · ${new Date(episode.publishedAt).toLocaleDateString('vi-VN')}` : ''}</p>
            <div className="flex gap-2"><button className="study-button study-button-primary flex-1" onClick={() => openEpisode(episode)}>Luyện nghe</button><button className="study-button !min-w-11 !px-3" aria-label={state.saved ? 'Bỏ lưu bài' : 'Lưu bài'} aria-pressed={!!state.saved} onClick={() => updatePractice(episode.id, { saved: !state.saved })}><Bookmark size={17} fill={state.saved ? 'currentColor' : 'none'} /></button></div>
          </article>;
        })}
      </div>}
      {visibleCount < results.length && <div className="text-center"><button className="study-button" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}><RefreshCw size={16} /> Tải thêm bài ({results.length - visibleCount} còn lại)</button></div>}
    </section>}

    {selected && <AppDialog open title={selected.title} onClose={() => setSelectedId(null)} className="!w-[min(94vw,42rem)] max-h-[95vh] overflow-y-auto">
      <div className="space-y-5">
        <p className="study-eyebrow">{sources[selected.sourceId]} · {selected.levels.join(' / ')} · {selected.kind} · {selected.category}</p>
        <div className="rounded-xl bg-[var(--color-surface-alt)] p-4 space-y-3"><p className="text-sm font-semibold flex items-center gap-2"><Volume2 size={17} /> Nghe từ nguồn gốc</p><audio key={selected.id} ref={audioRef} controls preload="none" className="w-full" src={selected.audioUrl} onEnded={() => updatePractice(selected.id, { listened: true })} onError={() => setAudioFailed(true)} aria-label={`Audio: ${selected.title}`} />{audioFailed && <p className="text-sm text-[var(--color-error)]">Nguồn audio hiện không phát được tại đây. Hãy mở bài trên trang gốc.</p>}<div className="flex flex-wrap items-center gap-2"><span className="text-xs text-[var(--color-text-secondary)]">Tốc độ</span>{[0.8, 1, 1.2].map(rate => <button key={rate} className={`study-button !min-h-8 !px-2 !py-1 !text-xs ${speed === rate ? 'study-button-primary' : ''}`} onClick={() => { setSpeed(rate); if (audioRef.current) audioRef.current.playbackRate = rate; }}>{rate}×</button>)}<button className="study-button !min-h-8 !px-2 !py-1 !text-xs" onClick={() => { if (audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play(); } }}><RotateCcw size={13} /> Nghe lại</button></div></div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Cách luyện"><button className={`study-button !min-h-9 ${mode === 'understand' ? 'study-button-primary' : ''}`} onClick={() => setMode('understand')}>Nghe hiểu</button><button className={`study-button !min-h-9 ${mode === 'dictation' ? 'study-button-primary' : ''}`} onClick={() => setMode('dictation')}>Ghi lại</button><button className={`study-button !min-h-9 ${mode === 'shadow' ? 'study-button-primary' : ''}`} onClick={() => setMode('shadow')}>Nhại theo</button></div>
        <div className="text-sm text-[var(--color-text-secondary)] min-h-16">{mode === 'understand' && <p>Nghe một lần và tự trả lời: chủ đề chính là gì, người nói nhắc đến những chi tiết nào, bạn hiểu khoảng bao nhiêu phần? Nghe lại để kiểm tra.</p>}{mode === 'dictation' && <p>Nghe một đoạn ngắn, tạm dừng rồi ghi lại các từ hoặc câu bạn bắt được. Phát lại để sửa ghi chú của mình.</p>}{mode === 'shadow' && <p>Nghe một câu, tạm dừng và nói theo nhịp của người nói. Lặp lại ở tốc độ 0.8× rồi thử 1×.</p>}</div>
        <label className="block text-sm font-semibold">Ghi chú của bạn<textarea className="study-input mt-2 min-h-24 resize-y" placeholder="Từ mới, ý chính hoặc câu bạn nghe được…" value={practice[selected.id]?.note || ''} onChange={event => updatePractice(selected.id, { note: event.target.value })} /></label>
        <div className="flex flex-wrap gap-2"><button className="study-button" onClick={() => updatePractice(selected.id, { listened: true })}><Check size={16} /> {practice[selected.id]?.listened ? 'Đã nghe' : 'Đánh dấu đã nghe'}</button><button className="study-button" onClick={() => updatePractice(selected.id, { difficult: !practice[selected.id]?.difficult })}>{practice[selected.id]?.difficult ? 'Bỏ khỏi cần ôn' : 'Thêm vào cần ôn'}</button><button className="study-button" onClick={() => { updatePractice(selected.id, { hidden: !practice[selected.id]?.hidden }); setSelectedId(null); }}>{practice[selected.id]?.hidden ? 'Hiện lại' : 'Ẩn bài này'}</button></div>
        <div className="border-t border-[var(--color-border)] pt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--color-text-tertiary)]">Audio và nội dung thuộc nguồn phát hành. Chưa có lời thoại hoặc đáp án cho bài này.</p><a className="text-sm font-semibold text-[var(--color-accent-text)] inline-flex items-center gap-1" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Mở bài gốc <ExternalLink size={14} /></a></div>
      </div>
    </AppDialog>}
  </div>;
}
