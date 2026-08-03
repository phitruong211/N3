// ============================================================
// Main Layout — Content area wrapper
// ============================================================
// Principle: Single clear purpose per screen
// The layout simply holds the sidebar + active page content
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { SearchModal } from '@/components/search/SearchModal';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { sidebarCollapsed, setCurrentPage, setSearchOpen } = useApp();
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

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <Sidebar />

      {/* Main content area — naturally positioned next to sticky sidebar */}
      <main
        className="flex-1 min-w-0 min-h-screen overflow-x-hidden"
        id="main-content"
        role="main"
      >
        <div className="max-w-full w-full mx-auto px-6 py-8 md:px-10 md:py-10">
          {children}
        </div>
      </main>

      {/* Global search modal */}
      <SearchModal />
    </div>
  );
}
