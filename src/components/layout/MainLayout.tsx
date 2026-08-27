// ============================================================
// Main Layout — Content area wrapper
// ============================================================
// Desktop: sidebar + content
// Mobile: top header + content + bottom nav
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { SearchModal } from '@/components/search/SearchModal';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed, setCurrentPage, setSearchOpen, currentPage } = useApp();
  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Ctrl+K / Cmd+K — Search
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      const now = Date.now();
      const isSequence = lastKeyRef.current.key === 'g' && now - lastKeyRef.current.time < 1200;

      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        lastKeyRef.current = { key: 'g', time: now };
        return;
      }

      if (isSequence) {
        const pageMap: Record<string, PageId> = {
          d: 'dashboard',
          v: 'vocabulary',
          k: 'kanji',
          g: 'grammar',
          s: 'srs',
          f: 'flashcards',
          q: 'quiz',
          p: 'progress',
          b: 'bookmarks',
        };

        const targetPage = pageMap[e.key.toLowerCase()];
        if (targetPage) {
          e.preventDefault();
          setCurrentPage(targetPage);
          lastKeyRef.current = { key: '', time: 0 };
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCurrentPage, setSearchOpen]);

  // Page title mapping for mobile header
  const pageTitles: Record<PageId, string> = {
    dashboard: 'Tổng Quan',
    vocabulary: 'Từ Vựng',
    kanji: 'Kanji',
    grammar: 'Ngữ Pháp',
    flashcards: 'Flashcard',
    srs: 'Ôn Tập SRS',
    quiz: 'Quiz',
    progress: 'Tiến Độ',
    bookmarks: 'Đã Lưu',
    settings: 'Cài Đặt',
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <main
        className="flex-1 min-w-0 min-h-screen overflow-x-hidden"
        id="main-content"
        role="main"
      >
        {/* Mobile Top Header */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white/95 dark:bg-[#0C0D0E]/95 backdrop-blur-md border-b border-gray-200/80 dark:border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <span className="font-jp-serif text-xl font-extrabold text-gray-900 dark:text-white">
              N3
            </span>
            <span className="text-[10px] font-bold text-[#1D63ED] bg-[#DCEBFE] dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
              学習
            </span>
          </div>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {pageTitles[currentPage] ?? 'N3 学習'}
          </span>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>

        {/* Page content */}
        <div className="max-w-full w-full mx-auto px-4 py-4 md:px-10 md:py-10 pb-24 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />

      {/* Global search modal */}
      <SearchModal />
    </div>
  );
}
