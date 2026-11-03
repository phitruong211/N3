// ============================================================
// Search Modal (Command Palette)
// ============================================================
// Searches the built-in library (vocabulary, kanji, grammar) and app pages.
// Accent-insensitive Vietnamese, katakana = hiragana and romaji are handled in lib/searchIndex.
// Signed-in users also get their own cards and decks, fetched from the server after a short debounce.
// ============================================================

import { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import { useApp } from '@/hooks/useApp';
import { Search, X, ArrowRight } from '@/components/ui/icons';
import { Seal } from '@/components/ui/Seal';
import { buildDoc, fold, highlightParts, searchDocs } from '@/lib/searchIndex';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { searchCards, type CardSearchResult } from '@/lib/deckApi';

type Kind = 'card' | 'vocabulary' | 'kanji' | 'grammar' | 'page';
interface Hit { kind: Kind | 'dict'; id: string; title: string; reading?: string; han?: string; meaning: string; level?: string; deck?: string; to?: string }

const GROUPS: { kind: Kind; label: string; glyph: string; shown: number; tone: string }[] = [
  { kind: 'card', label: 'Thẻ của bạn', glyph: '札', shown: 5, tone: 'var(--color-seal)' },
  { kind: 'vocabulary', label: 'Từ vựng', glyph: '語', shown: 6, tone: 'var(--color-accent)' },
  { kind: 'kanji', label: 'Kanji', glyph: '漢', shown: 4, tone: 'var(--color-kanji)' },
  { kind: 'grammar', label: 'Ngữ pháp', glyph: '文', shown: 4, tone: 'var(--color-grammar)' },
  { kind: 'page', label: 'Trang', glyph: '頁', shown: 2, tone: 'var(--color-gold)' },
];

const PAGES: { label: string; to: string; keys: string; glyph: string }[] = [
  { label: 'Bảng chữ cái', to: '/library/kana', keys: 'hiragana katakana kana chu cai bang chu', glyph: '仮' },
  { label: 'Từ vựng', to: '/library/vocabulary', keys: 'thu vien vocabulary', glyph: '語' },
  { label: 'Ngữ pháp', to: '/library/grammar', keys: 'thu vien grammar', glyph: '文' },
  { label: 'Kanji', to: '/library/kanji', keys: 'thu vien han tu', glyph: '漢' },
  { label: 'Luyện nghe', to: '/library/listening', keys: 'listening nghe', glyph: '聴' },
  { label: 'Đề thi JLPT', to: '/library/exam', keys: 'jlpt thi exam', glyph: '試' },
  { label: 'Từ điển', to: '/dictionary', keys: 'dictionary tra tu jmdict', glyph: '辞' },
  { label: 'Bộ thẻ', to: '/decks', keys: 'flashcard the deck anki', glyph: '札' },
  { label: 'Ôn ngắt quãng', to: '/review', keys: 'on tap review srs fsrs', glyph: '復' },
  { label: 'Trắc nghiệm', to: '/quiz', keys: 'quiz kiem tra', glyph: '問' },
  { label: 'Tiến độ', to: '/progress', keys: 'progress thong ke', glyph: '進' },
  { label: 'Đã lưu', to: '/saved', keys: 'bookmark yeu thich', glyph: '保' },
  { label: 'Cài đặt', to: '/settings', keys: 'settings giao dien furigana', glyph: '設' },
];
const PAGE_DOCS = PAGES.map(p => buildDoc<Hit>({ kind: 'page', id: p.to, title: p.label, meaning: 'Mở trang', to: p.to }, [[p.label, 10], [p.keys, 4]]));

const RECENT_KEY = 'nhat-recent-searches-v1';
const loadRecent = (): string[] => {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : []; } catch { return []; }
};
const saveRecent = (list: string[]) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* private mode: recents are optional */ } };

function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((p, i) => p.hit
    ? <mark key={i} className="rounded-sm bg-[color-mix(in_srgb,var(--color-gold)_32%,transparent)] text-inherit">{p.text}</mark>
    : <span key={i}>{p.text}</span>)}</>;
}

export function SearchModal() {
  const navigate = useNavigate();
  const { searchOpen, setSearchOpen, vocabulary, kanji, grammar, selectSearchResult, loading, ensureLibrary } = useApp();
  const { user, requestAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [mine, setMine] = useState<{ q: string; data: CardSearchResult } | null>(null);
  const [tab, setTab] = useState<'all' | Kind>('all');
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const deferred = useDeferredValue(query);
  const q = deferred.trim();

  useEffect(() => { if (searchOpen) ensureLibrary(); }, [searchOpen, ensureLibrary]);

  // The user's own cards live on the server: ask after a pause in typing, never as a guest.
  const mineEnabled = Boolean(user && searchOpen && q);
  useEffect(() => {
    if (!mineEnabled) { setMine(null); return; }
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      searchCards(q, 20, ctrl.signal)
        .then(data => setMine({ q, data }))
        .catch(() => { if (!ctrl.signal.aborted) setMine({ q, data: { cards: [], decks: [] } }); }); // offline or expired session: the library results still work
    }, 250);
    return () => { window.clearTimeout(timer); ctrl.abort(); };
  }, [mineEnabled, q]);
  const minePending = mineEnabled && mine?.q !== q;

  // Build the index only while searching, once the library has arrived.
  const index = useMemo(() => {
    if (!searchOpen || loading) return null;
    return {
      vocabulary: vocabulary.map(v => buildDoc<Hit>(
        { kind: 'vocabulary', id: v.id, title: v.kanji, reading: v.hiragana, han: v.han_viet || undefined, meaning: v.meaning, level: v.level },
        [[v.kanji, 10, true], [v.hiragana, 9, true], [v.han_viet, 7], ...v.nghia.map(m => [m, 5] as [string, number]),
          ...v.cach_doc_khac.map(r => [r.phien_am, 6, true] as [string, number, boolean]),
          ...v.bien_the.flatMap(b => [[b.tu, 6, true], [b.phien_am, 6, true]] as [string, number, boolean][])])),
      kanji: kanji.map(k => buildDoc<Hit>(
        { kind: 'kanji', id: k.id, title: k.kanji, han: k.hanViet, meaning: k.meaning || k.vocabulary.slice(0, 2).map(w => w.word).join(' · '), level: k.level },
        [[k.kanji, 10, true], [k.hanViet, 8], [k.meaning, 4], ...[...(k.onyomi ?? []), ...(k.kunyomi ?? [])].map(r => [r, 6, true] as [string, number, boolean]),
          ...k.vocabulary.flatMap(w => [[w.word, 3, true], [w.reading, 3, true], [w.hanViet, 3], [w.meaning, 2]] as [string | undefined, number, boolean?][])])),
      grammar: grammar.map(g => buildDoc<Hit>(
        { kind: 'grammar', id: g.id, title: g.pattern, reading: g.reading, meaning: g.meaning, level: g.level },
        [[g.pattern, 10, true], [g.reading, 8, true], [g.meaning, 6], [g.structure, 3, true]])),
    };
  }, [searchOpen, loading, vocabulary, kanji, grammar]);

  const found = useMemo<Record<Kind, Hit[]>>(() => {
    // The word lists repeat some entries across lessons; show each word once.
    const unique = (hits: Hit[]) => { const seen = new Set<string>(); return hits.filter(h => { const key = `${h.title}|${h.reading}|${h.meaning}`; return !seen.has(key) && seen.add(key); }); };
    const run = (docs: NonNullable<typeof index>[keyof NonNullable<typeof index>]) => unique(searchDocs(docs, q, 60)).slice(0, 30);
    const data = mine?.q === q ? mine.data : null;
    return {
      card: data ? [
        ...data.decks.map<Hit>(d => ({ kind: 'card', id: `deck-${d.id}`, title: d.name, meaning: 'Bộ thẻ', to: `/decks?deck=${d.id}` })),
        ...data.cards.map<Hit>(c => ({ kind: 'card', id: c.cardId, title: c.front, reading: c.reading || undefined, meaning: c.back, deck: c.deckName, to: `/decks?deck=${c.deckId}&q=${encodeURIComponent(c.front)}` })),
      ] : [],
      vocabulary: index && q ? run(index.vocabulary) : [],
      kanji: index && q ? run(index.kanji) : [],
      grammar: index && q ? run(index.grammar) : [],
      page: q ? searchDocs(PAGE_DOCS, q, 4) : [],
    };
  }, [index, q, mine]);

  // What is on screen, in keyboard order: groups of hits, then the dictionary fallback.
  const sections = useMemo(() => {
    const picked = GROUPS.filter(g => tab === 'all' || g.kind === tab)
      .map(g => ({ ...g, hits: found[g.kind].slice(0, tab === 'all' ? g.shown : 30), total: found[g.kind].length }))
      .filter(s => s.hits.length);
    // A page whose name starts with the query ("ngu phap" → Ngữ pháp) is almost certainly what was meant.
    const pageFirst = found.page[0] && fold(found.page[0].title).startsWith(fold(q));
    return pageFirst ? [...picked.filter(s => s.kind === 'page'), ...picked.filter(s => s.kind !== 'page')] : picked;
  }, [found, tab]);
  const flat = useMemo<Hit[]>(() => {
    const hits = sections.flatMap(s => s.hits);
    return q ? [...hits, { kind: 'dict', id: 'dict', title: q, meaning: '' }] : [];
  }, [sections, q]);

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setQuery('');
      setTab('all');
      setSelectedIndex(0);
      setRecent(loadRecent());
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        window.clearTimeout(timer);
        previousFocusRef.current?.focus();
      };
    }
  }, [searchOpen]);

  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [selectedIndex, flat]);

  const handleSelect = useCallback((hit: Hit) => {
    const text = query.trim();
    if (text) saveRecent([text, ...loadRecent().filter(r => r !== text)].slice(0, 6));
    setSearchOpen(false);
    if (hit.kind === 'dict') navigate(`/dictionary${text ? `?q=${encodeURIComponent(text)}` : ''}`);
    else if (hit.kind === 'page' || hit.kind === 'card') navigate(hit.to!);
    else selectSearchResult({ id: hit.id, type: hit.kind });
  }, [query, navigate, setSearchOpen, selectSearchResult]);

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.isComposing) return; // Enter inside a Japanese IME confirms the text, it must not open a result
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, flat.length - 1)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (flat[selectedIndex]) handleSelect(flat[selectedIndex]);
          break;
        case 'Escape':
          setSearchOpen(false);
          break;
        case 'Tab': {
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button');
          if (!focusable?.length) break;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, flat, selectedIndex, handleSelect, setSearchOpen]);

  if (!searchOpen) return null;

  const hasQuery = Boolean(q);
  const noHits = hasQuery && !loading && !minePending && sections.length === 0;
  const total = flat.length - (hasQuery ? 1 : 0);
  let row = -1;
  const rowClass = (active: boolean) => `mx-2 grid min-h-12 w-[calc(100%-1rem)] cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-0.5 rounded-xl px-3 py-2 text-left sm:grid-cols-[minmax(0,34%)_minmax(0,1fr)_auto] transition-colors duration-100 ${active ? 'bg-[var(--color-accent-subtle)]' : 'hover:bg-[var(--color-surface-hover)]'}`;
  const count = (n: number) => n >= 30 ? '30+' : String(n);
  const tabs = [['all', 'Tất cả', 0] as const, ...GROUPS.filter(g => g.kind !== 'page' && found[g.kind].length > 0).map(g => [g.kind, g.label, found[g.kind].length] as const)];

  return (
    <>
      <div className="palette-scrim fixed inset-0 z-50 bg-black/40 backdrop-blur-[3px]" onClick={() => setSearchOpen(false)} aria-hidden="true" />

      <div ref={dialogRef} className="fixed left-1/2 top-2 z-50 w-[calc(100%-16px)] max-w-[44rem] -translate-x-1/2 sm:top-[12vh] sm:w-[calc(100%-32px)]" role="dialog" aria-label="Tìm kiếm nội dung học" aria-modal="true">
        <div className="palette-panel overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          {/* Input: focus shows as the rule under it, not as a second box */}
          <div className="flex h-16 items-center gap-3 border-b border-[var(--color-border)] px-5 transition-colors focus-within:border-[var(--color-accent)]">
            <Search size={20} className="shrink-0 text-[var(--color-text-tertiary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              placeholder={user ? 'Tìm từ, kanji, ngữ pháp, thẻ của bạn…' : 'Tìm từ, kanji, ngữ pháp…'}
              className="min-w-0 flex-1 bg-transparent text-[1.125rem] text-[var(--color-text)] caret-[var(--color-accent)] placeholder:text-[var(--color-text-tertiary)]"
              style={{ outline: 'none', boxShadow: 'none' }} /* the rule under the field is the focus indicator; the global ring would draw a second box */
              aria-label="Từ khóa tìm kiếm"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls="search-results"
              aria-activedescendant={flat.length ? `search-option-${selectedIndex}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            {query && <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]" aria-label="Xóa từ khóa"><X size={16} /></button>}
            <button onClick={() => setSearchOpen(false)} className="shrink-0 cursor-pointer rounded-md px-1 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] sm:px-0 sm:py-0" aria-label="Đóng tìm kiếm">
              <span className="sm:hidden">Đóng</span><span className="hidden sm:inline"><kbd className="kbd-shortcut">Esc</kbd></span>
            </button>
          </div>

          {/* Filters: only the groups that have results */}
          {hasQuery && !noHits && !loading && tabs.length > 2 && <div className="flex gap-1 overflow-x-auto px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Lọc kết quả">
            {tabs.map(([key, label, n]) =>
              <button key={key} aria-pressed={tab === key} onClick={() => { setTab(key as 'all' | Kind); setSelectedIndex(0); }}
                className={'relative cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ' + (tab === key ? 'font-semibold text-[var(--color-text)] after:bg-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] after:bg-transparent hover:text-[var(--color-text)]')}>
                {label}{key !== 'all' && <span className="ml-1.5 text-xs font-normal tabular-nums text-[var(--color-text-tertiary)]">{count(n)}</span>}
              </button>)}
          </div>}

          <div role="status" className="sr-only">{hasQuery && !loading && !minePending ? `${total} kết quả` : ''}</div>
          <div ref={listRef} id="search-results" className="max-h-[calc(100dvh-10.5rem)] overflow-y-auto overscroll-contain pb-0 sm:max-h-[min(58vh,32rem)]" role="listbox" aria-label="Kết quả tìm kiếm">
            {hasQuery && loading && <div className="space-y-2 px-5 py-4" aria-hidden="true">
              {[0, 1, 2].map(i => <div key={i} className="flex animate-pulse items-center gap-3.5 py-1.5"><div className="h-6 w-14 rounded bg-[var(--color-surface-alt)]" /><div className="h-4 flex-1 rounded bg-[var(--color-surface-alt)]" /></div>)}
              <p className="sr-only">Đang tải dữ liệu…</p>
            </div>}

            {minePending && !found.card.length && <div className="flex items-center gap-2 px-5 pb-1 pt-3 text-xs font-semibold text-[var(--color-text-secondary)]">
              <Seal glyph="札" size="xs" tone="var(--color-seal)" />Thẻ của bạn
              <span className="font-normal text-[var(--color-text-tertiary)]">Đang tìm…</span>
            </div>}

            {sections.map(section => <div key={section.kind} role="group" aria-label={section.label} className="pb-1">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--color-surface)] px-5 pb-1 pt-3 text-xs font-semibold text-[var(--color-text-secondary)]">
                <Seal glyph={section.glyph} size="xs" tone={section.tone} />{section.label}
                <span className="font-normal tabular-nums text-[var(--color-text-tertiary)]">{count(section.total)}</span>
                {section.total > section.hits.length && <button className="ml-auto cursor-pointer font-medium text-[var(--color-accent-text)] hover:underline" onClick={() => { setTab(section.kind); setSelectedIndex(0); }}>Xem tất cả</button>}
              </div>
              {section.hits.map(hit => {
                row += 1;
                const i = row;
                const active = i === selectedIndex;
                return <button key={hit.kind + hit.id} id={`search-option-${i}`} role="option" aria-selected={active}
                  onClick={() => handleSelect(hit)} onMouseMove={() => setSelectedIndex(i)} className={rowClass(active)}>
                  <span className="font-jp-serif min-w-0 break-words text-[1.375rem] leading-tight text-[var(--color-text)]"><Highlight text={hit.title} query={q} /></span>
                  <span className="min-w-0 max-sm:col-span-2 max-sm:row-start-2">
                    <span className="block truncate text-[0.9375rem] leading-snug text-[var(--color-text)]"><Highlight text={hit.meaning} query={q} /></span>
                    {(hit.reading || hit.han) && <span className="mt-0.5 block truncate text-[0.8125rem] leading-snug text-[var(--color-text-secondary)]">
                      {hit.reading && <span className="font-jp"><Highlight text={hit.reading} query={q} /></span>}
                      {hit.reading && hit.han && <span className="mx-1.5 text-[var(--color-border-strong)]" aria-hidden="true">/</span>}
                      {hit.han && <span><span className="sr-only">Hán Việt: </span><Highlight text={hit.han} query={q} /></span>}
                    </span>}
                  </span>
                  <span className="flex items-center justify-end gap-3 max-sm:col-start-2 max-sm:row-start-1">
                    {hit.deck && <span className="max-w-[9rem] truncate text-xs text-[var(--color-text-tertiary)]" title={hit.deck}>{hit.deck}</span>}
                    {hit.level && <span className="text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{hit.level}</span>}
                    <span className={'hidden sm:inline ' + (active ? '' : 'invisible')} aria-hidden="true"><kbd className="kbd-shortcut">↵</kbd></span>
                  </span>
                </button>;
              })}
            </div>)}

            {noHits && <div className="px-5 py-10 text-center">
              <p className="text-[0.9375rem] text-[var(--color-text)]">Không có kết quả cho “{q}”</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-[var(--color-text-tertiary)]">Thử gõ romaji (<span className="font-jp">taberu</span>), tiếng Việt không dấu (<span className="font-jp">an uong</span>) hoặc chữ Nhật.</p>
            </div>}

            {!hasQuery && <div className="px-5 pb-5 pt-4">
              {recent.length > 0 && <div className="mb-5">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-text-secondary)]">Tìm gần đây</span>
                  <button className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]" onClick={() => { saveRecent([]); setRecent([]); }}>Xóa lịch sử</button>
                </div>
                <div className="-mx-2 flex flex-col">{recent.map(r => <button key={r} onClick={() => { setQuery(r); setSelectedIndex(0); inputRef.current?.focus(); }}
                  className="font-jp flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-[0.9375rem] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]">
                  <Search size={15} className="shrink-0 text-[var(--color-text-tertiary)]" /><span className="min-w-0 truncate">{r}</span></button>)}</div>
              </div>}
              <p className="mb-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">Đi tới</p>
              <div className="-mx-2 grid grid-cols-1 sm:grid-cols-2">{PAGES.slice(0, 8).map(p => <button key={p.to} onClick={() => { setSearchOpen(false); navigate(p.to); }}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-[0.9375rem] text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-hover)]">
                <Seal glyph={p.glyph} size="xs" tone="var(--color-text-secondary)" />{p.label}</button>)}</div>
            </div>}

            {/* Always reachable: the fallback for anything the library does not hold */}
            {hasQuery && !loading && <button id={`search-option-${flat.length - 1}`} role="option" aria-selected={selectedIndex === flat.length - 1}
              onClick={() => handleSelect(flat[flat.length - 1])} onMouseMove={() => setSelectedIndex(flat.length - 1)}
              className="sticky bottom-0 z-10 flex min-h-12 w-full cursor-pointer items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-left text-[0.9375rem] transition-colors hover:bg-[var(--color-surface-hover)] aria-selected:bg-[var(--color-accent-subtle)]">
              <Seal glyph="辞" size="xs" tone="var(--color-accent)" />
              <span className="min-w-0 flex-1 truncate">Tra “{q}” trong từ điển JMdict</span>
              <ArrowRight size={16} className="shrink-0 text-[var(--color-text-tertiary)]" />
            </button>}
          </div>

          <div className="hidden items-center gap-4 border-t border-[var(--color-border)] bg-[var(--color-surface-alt)] px-5 py-2 text-xs text-[var(--color-text-tertiary)] sm:flex">
            <span><kbd className="kbd-shortcut">↑↓</kbd> Chọn</span>
            <span><kbd className="kbd-shortcut">↵</kbd> Mở</span>
            <span><kbd className="kbd-shortcut">Esc</kbd> Đóng</span>
            {!user && <button className="ml-auto cursor-pointer text-[var(--color-accent-text)] hover:underline" onClick={() => { setSearchOpen(false); requestAuth(); }}>Đăng nhập để tìm cả thẻ của bạn</button>}
          </div>
        </div>
      </div>
    </>
  );
}
