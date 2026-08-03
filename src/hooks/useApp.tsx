// ============================================================
// App Context — Global state management
// ============================================================
// Principle: Compound Components pattern with React Context
// Minimizes prop drilling (cognitive load for developers)
// ============================================================

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { VocabItem, KanjiItem, GrammarItem, PageId, AppSettings, SRSCard, Bookmark } from '@/types';
import { loadVocabulary, loadKanji, loadGrammar } from '@/lib/data';
import { getSettings, saveSettings, applyTheme, getBookmarks, saveBookmarks, getSRSCards, saveSRSCards, setLastPage } from '@/lib/storage';

interface AppState {
  // <Data>                                 </Data>
  vocabulary: VocabItem[];
  kanji: KanjiItem[];
  grammar: GrammarItem[];
  loading: boolean;

  // Navigation
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;

  // Settings
  settings: AppSettings;
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
  const [vocabulary, setVocabulary] = useState<VocabItem[]>([]);
  const [kanji, setKanji] = useState<KanjiItem[]>([]);
  const [grammar, setGrammar] = useState<GrammarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, _setCurrentPage] = useState<PageId>('dashboard');
  const [settings, _setSettings] = useState<AppSettings>(getSettings());
  const [bookmarks, _setBookmarks] = useState<Bookmark[]>(getBookmarks());
  const [srsCards, _setSRSCards] = useState<SRSCard[]>(getSRSCards());
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load data on mount
  useEffect(() => {
    Promise.all([loadVocabulary(), loadKanji(), loadGrammar()])
      .then(([v, k, g]) => {
        setVocabulary(v);
        setKanji(k);
        setGrammar(g);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  // Apply theme on settings change
  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.className = `${settings.theme} font-${settings.fontSize}`;
  }, [settings.theme, settings.fontSize]);

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
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    _setSettings((prev) => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleBookmark = useCallback(
    (itemId: string, itemType: 'vocabulary' | 'kanji' | 'grammar') => {
      _setBookmarks((prev) => {
        const index = prev.findIndex((b) => b.itemId === itemId);
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
    []
  );

  const isBookmarked = useCallback(
    (itemId: string) => bookmarks.some((b) => b.itemId === itemId),
    [bookmarks]
  );

  const setSRSCards = useCallback((cards: SRSCard[]) => {
    _setSRSCards(cards);
    saveSRSCards(cards);
  }, []);

  const updateSRSCard = useCallback((card: SRSCard) => {
    _setSRSCards((prev) => {
      const index = prev.findIndex((c) => c.itemId === card.itemId);
      let next: SRSCard[];
      if (index >= 0) {
        next = [...prev];
        next[index] = card;
      } else {
        next = [...prev, card];
      }
      saveSRSCards(next);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        vocabulary,
        kanji,
        grammar,
        loading,
        currentPage,
        setCurrentPage,
        settings,
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
