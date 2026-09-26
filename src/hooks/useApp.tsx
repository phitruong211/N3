// ============================================================
// App Context — Global state management
// ============================================================
// Principle: Compound Components pattern with React Context
// Minimizes prop drilling (cognitive load for developers)
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { VocabItem, KanjiItem, GrammarItem, PageId, AppSettings, SRSCard, Bookmark, NavigationTarget } from '@/types';
import { loadVocabulary, loadKanji, loadGrammar } from '@/lib/data';
import type { LearningStorage } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { useLearningSync } from './useLearningSync';
import { useSettingsSync } from './useSettingsSync';

interface AppState {
  storage: LearningStorage;
  learningSync: ReturnType<typeof useLearningSync>;
  // <Data>                                 </Data>
  vocabulary: VocabItem[];
  kanji: KanjiItem[];
  grammar: GrammarItem[];
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
  const { storage, user, resumePage, rememberPage } = useAuth();
  const { getSettings, applyTheme, getBookmarks, saveBookmarks, getSRSCards, saveSRSCards, upsertSRSCard, setLastPage, getLastPage, migrateV1 } = storage;
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [grammar, setGrammar] = useState<GrammarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentPage, _setCurrentPage] = useState<PageId>(() => {
    const saved = resumePage || getLastPage();
    const pages: PageId[] = ['dashboard', 'vocabulary', 'kanji', 'grammar', 'flashcards', 'anki', 'srs', 'quiz', 'listening', 'progress', 'bookmarks', 'settings'];
    return pages.includes(saved as PageId) ? saved as PageId : 'dashboard';
  });
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const learningSync = useLearningSync(storage, Boolean(user), state => { _setBookmarks(state.bookmarks); _setSRSCards(state.srsCards); });

  // Load data on mount
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    Promise.all([loadVocabulary(), loadKanji(), loadGrammar()])
      .then(([v, k, g]) => {
        if (!active) return;
        setVocabulary(v);
        setKanji(k);
        setGrammar(g);
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

  useEffect(() => { rememberPage(currentPage); }, [currentPage, rememberPage]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const setCurrentPage = useCallback((page: PageId) => {
    _setCurrentPage(page);
    setLastPage(page);
  }, [setLastPage]);

  const selectSearchResult = useCallback((target: NavigationTarget) => {
    setNavigationTarget(target);
    const page = target.type === 'vocabulary' ? 'vocabulary' : target.type;
    _setCurrentPage(page);
    setLastPage(page);
  }, [setLastPage]);

  const clearNavigationTarget = useCallback(() => setNavigationTarget(null), []);

  const settingsSync = useSettingsSync(storage, Boolean(user), _setSettings);
  const updateSettings = settingsSync.change;

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

  return (
    <AppContext.Provider
      value={{
        storage,
        learningSync,
        vocabulary,
        kanji,
        grammar,
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
        srsCards,
        setSRSCards,
        updateSRSCard,
        searchOpen,
        setSearchOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useLearningStorage() { return useApp().storage; }
