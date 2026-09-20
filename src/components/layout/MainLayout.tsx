// ============================================================
// Main Layout — Content area wrapper
// ============================================================
// Desktop: sidebar + content
// Mobile: top header + content + bottom nav
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { SearchModal } from '@/components/search/SearchModal';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';
import { Menu, Search, X, Layers, CircleHelp, ChartNoAxesCombined, Bookmark, Settings } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { setCurrentPage, setSearchOpen, currentPage } = useApp();
  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const menuButton = menuButtonRef.current;
    menuDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); return; }
      if (event.key !== 'Tab') return;
      const buttons = menuDialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => { window.removeEventListener('keydown', handler); menuButton?.focus(); };
  }, [menuOpen]);

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
  }, [setCurrentPage]);

  // Page title mapping for mobile header
  const pageTitles: Record<PageId, string> = {
    dashboard: 'Hôm nay',
    vocabulary: 'Từ vựng',
    kanji: 'Kanji',
    grammar: 'Ngữ pháp',
    flashcards: 'Thẻ học',
    srs: 'Ôn tập',
    quiz: 'Trắc nghiệm',
    progress: 'Tiến độ',
    search: 'Tìm kiếm',
    bookmarks: 'Đã lưu',
    settings: 'Cài đặt',
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
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 h-14 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <span className="font-jp-serif text-xl font-bold text-[var(--color-text)]" aria-label="Sổ học">学</span>
          <span className="text-sm font-semibold text-[var(--color-text)] truncate">
            {pageTitles[currentPage] ?? 'N3 学習'}
          </span>
          <div className="flex items-center">
            <button onClick={() => setSearchOpen(true)} className="study-button !w-10 !min-h-10 !p-0 !border-0" aria-label="Tìm kiếm"><Search size={19} /></button>
            <button ref={menuButtonRef} onClick={() => setMenuOpen(true)} className="study-button !w-10 !min-h-10 !p-0 !border-0" aria-label="Mở trang khác"><Menu size={19} /></button>
          </div>
        </div>

        {/* Page content */}
        <div className="max-w-full w-full mx-auto px-4 py-5 md:px-8 lg:px-12 md:py-9 pb-28 md:pb-10">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav — hidden on desktop */}
      <BottomNav />

      {menuOpen && <div className="md:hidden fixed inset-0 z-50 bg-black/35" onClick={() => setMenuOpen(false)}>
        <div ref={menuDialogRef} className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--color-border)] bg-[var(--color-surface)] p-5 pb-8 safe-area-inset-bottom" role="dialog" aria-modal="true" aria-label="Trang khác" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Trang khác</h2><button onClick={() => setMenuOpen(false)} className="study-button !w-10 !min-h-10 !p-0" aria-label="Đóng menu"><X size={18} /></button></div>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['flashcards', 'Thẻ học', Layers], ['quiz', 'Trắc nghiệm', CircleHelp],
              ['progress', 'Tiến độ', ChartNoAxesCombined], ['bookmarks', 'Đã lưu', Bookmark], ['settings', 'Cài đặt', Settings],
            ] as const).map(([page, label, Icon]) => <button key={page} onClick={() => { setCurrentPage(page); setMenuOpen(false); }} className="study-button !justify-start"><Icon size={18} />{label}</button>)}
          </div>
        </div>
      </div>}

      {/* Global search modal */}
      <SearchModal />
    </div>
  );
}
