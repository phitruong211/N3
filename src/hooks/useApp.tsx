// ============================================================
// App Context — Global state management
// ============================================================
// Principle: Compound Components pattern with React Context
// Minimizes prop drilling (cognitive load for developers)
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { VocabItem, KanjiItem, GrammarItem, PageId, AppSettings, SRSCard, Bookmark, NavigationTarget } from '@/types';
import { loadVocabulary, loadKanji, loadGrammar } from '@/lib/data';
import { loadN5Decks } from '@/lib/n5Decks';
import type { BuiltInDeckDefinition } from '@/lib/deckCatalog';
import type { LearningStorage } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { useReviewOutbox } from './useReviewOutbox';
import { useLearningSync } from './useLearningSync';
import { useSettingsSync } from './useSettingsSync';
import { useCardNotes } from './useCardNotes';
import { useLocation, useNavigate } from 'react-router-dom';
import { pageForLocation, pathForPage } from '@/lib/navigation';

interface AppState {
  storage: LearningStorage;
  learningSync: ReturnType<typeof useLearningSync>;
  reviewOutbox: ReturnType<typeof useReviewOutbox>;
  cardNotes: ReturnType<typeof useCardNotes>;
  // <Data>                                 </Data>
  vocabulary: VocabItem[];
  kanji: KanjiItem[];
  grammar: GrammarItem[];
  n5Decks: BuiltInDeckDefinition[];
  loading: boolean;
  loadError: string | null;
  retryLoad: () => void;

  // Navigation
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  navigationTarget: NavigationTarget | null;
  selectSearchResult: (target: NavigationTarget) => void;
  clearNavigationTarget: () => void;

  // Settings
  settings: AppSettings;
  settingsSync: ReturnType<typeof useSettingsSync>;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Bookmarks
  bookmarks: Bookmark[];
  toggleBookmark: (itemId: string, itemType: 'vocabulary' | 'kanji' | 'grammar') => void;
  isBookmarked: (itemId: string) => boolean;

  // SRS
  srsCards: SRSCard[];
  setSRSCards: (cards: SRSCard[]) => void;
  updateSRSCard: (card: SRSCard) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { storage, user, rememberPage } = useAuth();
  const { getSettings, applyTheme, getBookmarks, saveBookmarks, getSRSCards, saveSRSCards, upsertSRSCard, setLastPage, migrateV1 } = storage;
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [grammar, setGrammar] = useState<GrammarItem[]>([]);
  const [n5Decks, setN5Decks] = useState<BuiltInDeckDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pageForLocation(location.pathname, location.search) ?? 'dashboard';
  const [navigationTarget, setNavigationTarget] = useState<NavigationTarget | null>(null);
  const [settings, _setSettings] = useState<AppSettings>(getSettings());
  const [bookmarks, _setBookmarks] = useState<Bookmark[]>(getBookmarks());
  const [srsCards, _setSRSCards] = useState<SRSCard[]>(() => {
    migrateV1(); // ensure data is migrated before reading
    return [
      ...getSRSCards('vocabulary'),
      ...getSRSCards('kanji'),
      ...getSRSCards('grammar'),
    ];
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(storage.getSidebarCollapsed);

  const learningSync = useLearningSync(storage, Boolean(user), state => { _setBookmarks(state.bookmarks); _setSRSCards(state.srsCards); });
  const reviewOutbox = useReviewOutbox(storage, Boolean(user), learningSync);
  const cardNotes = useCardNotes(storage, Boolean(user));

  // Load data on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([loadVocabulary(), loadKanji(), loadGrammar(), loadN5Decks()])
      .then(([v, k, g, n5]) => {
        if (!active) return;
        setVocabulary(v);
        setKanji(k);
        setGrammar(g);
        setN5Decks(n5);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load data:', err);
        setLoadError(err instanceof Error ? err.message : 'Không thể tải nội dung học.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [loadAttempt]);

  useEffect(() => {
    rememberPage(currentPage);
    if (location.pathname !== '/') setLastPage(`${location.pathname}${location.search}`);
  }, [currentPage, location.pathname, location.search, rememberPage, setLastPage]);

  const retryLoad = useCallback(() => setLoadAttempt((attempt) => attempt + 1), []);

  // Apply theme on settings change
  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.className = `${settings.theme} font-${settings.fontSize}${settings.reducedMotion ? ' reduced-motion' : ''}`;
  }, [settings.theme, settings.fontSize, settings.reducedMotion, applyTheme]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K → Open search (Raycast/Linear style)
      if (location.pathname === '/dictionary' || location.pathname.startsWith('/dictionary/')) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [location.pathname]);

  const setCurrentPage = useCallback((page: PageId) => {
    const path = pathForPage(page);
    navigate(path);
    setLastPage(path);
  }, [navigate, setLastPage]);

  const selectSearchResult = useCallback((target: NavigationTarget) => {
    setNavigationTarget(target);
    const page = target.type === 'vocabulary' ? 'vocabulary' : target.type;
    const path = pathForPage(page);
    navigate(path);
    setLastPage(path);
  }, [navigate, setLastPage]);

  const clearNavigationTarget = useCallback(() => setNavigationTarget(null), []);

  const settingsSync = useSettingsSync(storage, Boolean(user), _setSettings);
  const updateSettings = settingsSync.change;

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    storage.setSidebarCollapsed(collapsed);
  }, [storage]);

  const toggleBookmark = useCallback(
    (itemId: string, itemType: 'vocabulary' | 'kanji' | 'grammar') => {
      _setBookmarks((prev) => {
        const index = prev.findIndex((b) => b.itemId === itemId && b.itemType === itemType);
        let next: Bookmark[];
        if (index >= 0) {
          next = prev.filter((_, i) => i !== index);
        } else {
          next = [...prev, { itemId, itemType, createdAt: new Date().toISOString() }];
        }
        saveBookmarks(next);
        return next;
      });
    },
    [saveBookmarks]
  );

  const isBookmarked = useCallback(
    (itemId: string) => bookmarks.some((b) => b.itemId === itemId),
    [bookmarks]
  );

  const setSRSCards = useCallback((cards: SRSCard[]) => {
    _setSRSCards(cards);
    // Note: setSRSCards shouldn't really be used directly to overwrite all cards anymore, 
    // but if it is, we need to split them and save.
    const vocab = cards.filter(c => c.deckType === 'vocabulary');
    const kanji = cards.filter(c => c.deckType === 'kanji');
    const grammar = cards.filter(c => c.deckType === 'grammar');
    saveSRSCards('vocabulary', vocab);
    saveSRSCards('kanji', kanji);
    saveSRSCards('grammar', grammar);
  }, [saveSRSCards]);

  const updateSRSCard = useCallback((card: SRSCard) => {
    _setSRSCards((prev) => {
      const index = prev.findIndex((c) => c.cardId === card.cardId && c.deckType === card.deckType);
      let next: SRSCard[];
      if (index >= 0) {
        next = [...prev];
        next[index] = card;
      } else {
        next = [...prev, card];
      }
      return next;
    });
    // Immediately save to storage (Single Source of Truth)
    upsertSRSCard(card);
  }, [upsertSRSCard]);

  const visibleCards = useMemo(() => {
    return reviewOutbox.project
      ? (() => {
        const all = new Map(srsCards.map(card => [`${card.deckType}:${card.cardId}`, card]));
        // Apply outbox-confirmed and in-flight optimistic values, respecting undo cutoffs.
        const candidates = [
          ...Object.entries(reviewOutbox.data.confirmed)
            .filter(([key]) => key.startsWith('BUILT_IN:'))
            .map(([, card]) => card),
          ...reviewOutbox.data.items.filter(i => i.source === 'BUILT_IN').map(i => i.optimistic),
        ];
        for (const card of candidates) {
          const key = `${card.deckType}:${card.cardId}`;
          // Use projectedReview logic: honours reverted cutoff so undo result wins.
          const projected = reviewOutbox.project('BUILT_IN', card);
          const existing = all.get(key);
          all.set(key, reviewOutbox.project('BUILT_IN', existing ?? projected));
        }
        return [...all.values()];
      })()
      : srsCards;
  }, [srsCards, reviewOutbox.data, reviewOutbox.project]);
  return (
    <AppContext.Provider
      value={{
        storage,
        learningSync,
        reviewOutbox,
        cardNotes,
        vocabulary,
        kanji,
        grammar,
        n5Decks,
        loading,
        loadError,
        retryLoad,
        currentPage,
        setCurrentPage,
        navigationTarget,
        selectSearchResult,
        clearNavigationTarget,
        settings,
        settingsSync,
        updateSettings,
        bookmarks,
        toggleBookmark,
        isBookmarked,
        srsCards: visibleCards,
        setSRSCards,
        updateSRSCard,
        searchOpen,
        setSearchOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
      {(reviewOutbox.pending > 0 || reviewOutbox.undoPending) && <div role="status" className="fixed right-3 top-20 z-[70] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs shadow-lg">
        {reviewOutbox.undoPending
          ? reviewOutbox.error ? `Chưa hoàn tác được lượt ôn: ${reviewOutbox.error}` : 'Đang hoàn tác lượt ôn…'
          : reviewOutbox.error ? `Chưa đồng bộ ${reviewOutbox.pending} lượt ôn: ${reviewOutbox.error}` : `Đang đồng bộ ${reviewOutbox.pending} lượt ôn…`}
        {reviewOutbox.error && <button className="ml-3 underline" onClick={reviewOutbox.retry}>Thử lại</button>}
      </div>}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useLearningStorage() { return useApp().storage; }
