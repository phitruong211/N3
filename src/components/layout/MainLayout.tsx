import { useEffect, useRef, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { SearchModal } from '@/components/search/SearchModal';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';

export function MainLayout({ children }: { children: ReactNode }) {
  const { setCurrentPage, setSearchOpen, currentPage } = useApp();
  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      const now = Date.now();
      const isSequence = lastKeyRef.current.key === 'g' && now - lastKeyRef.current.time < 1200;
      if (event.key === 'g' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        lastKeyRef.current = { key: 'g', time: now };
        return;
      }
      if (!isSequence) return;
      const pageMap: Record<string, PageId> = { d: 'dashboard', v: 'vocabulary', f: 'flashcards', s: 'srs', q: 'quiz', p: 'progress', b: 'bookmarks' };
      const page = pageMap[event.key.toLowerCase()];
      if (page) { event.preventDefault(); setCurrentPage(page); lastKeyRef.current = { key: '', time: 0 }; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCurrentPage]);

  const pageTitles: Record<PageId, string> = {
    dashboard: 'Hôm nay', vocabulary: 'Thư viện', grammar: 'Thư viện', kanji: 'Thư viện', listening: 'Thư viện',
    flashcards: 'Bộ thẻ', anki: 'Ôn ngắt quãng', srs: 'Ôn ngắt quãng', quiz: 'Trắc nghiệm', progress: 'Tiến độ',
    search: 'Tìm kiếm', bookmarks: 'Đã lưu', settings: 'Cài đặt',
  };

  return <div className="flex min-h-screen bg-[var(--color-bg)]">
    <Sidebar/>
    <main className="min-h-screen min-w-0 flex-1 overflow-x-clip" id="main-content" role="main">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 lg:hidden">
        <button onClick={() => setCurrentPage('dashboard')} aria-label="Về Hôm nay"><img src="/so-nhat-mark.svg" alt="" className="h-10 w-10 object-contain"/></button>
        <span className="truncate text-sm font-semibold">{pageTitles[currentPage]}</span>
        <button onClick={() => setSearchOpen(true)} className="study-button !min-h-10 !w-10 !border-0 !p-0" aria-label="Tìm kiếm"><Search size={19}/></button>
      </header>
      <div className="mx-auto w-full max-w-full px-4 py-5 pb-28 sm:px-6 lg:px-10 lg:py-8 lg:pb-10 xl:px-12">{children}</div>
    </main>
    <BottomNav/>
    <SearchModal/>
  </div>;
}
