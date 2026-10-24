import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Search } from '@/components/ui/icons';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
const SearchModal = lazy(() => import('@/components/search/SearchModal').then(module => ({ default: module.SearchModal })));
import { useApp } from '@/hooks/useApp';
import { BrandMark } from '@/components/ui/BrandMark';
import { applyPageMeta, PAGE_TITLES } from '@/lib/seo';
import type { PageId } from '@/types';

export function MainLayout({ children }: { children: ReactNode }) {
  const { setCurrentPage, setSearchOpen, searchOpen, currentPage } = useApp();
  const [searchMounted, setSearchMounted] = useState(false);
  useEffect(() => { if (searchOpen) setSearchMounted(true); }, [searchOpen]);
  const lastKeyRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const section = useLocation().pathname.split('/')[1];

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

  useEffect(() => { applyPageMeta(currentPage); }, [currentPage]);

  return <div className="flex min-h-screen bg-[var(--color-bg)]">
    <Sidebar/>
    <main className="min-h-screen min-w-0 flex-1 overflow-x-clip" id="main-content" role="main" tabIndex={-1}>
      <header className="sticky top-0 z-30 flex h-11 items-center justify-between gap-3 border-b border-[var(--color-border)]/70 bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] px-4 backdrop-blur-xl lg:hidden">
        <button className="hit" onClick={() => setCurrentPage('dashboard')} aria-label="Về Hôm nay"><BrandMark size={32} variant="small"/></button>
        <span className="truncate text-sm font-semibold">{PAGE_TITLES[currentPage]}</span>
        <button onClick={() => setSearchOpen(true)} className="study-button !min-h-11 !w-11 !border-0 !bg-transparent !p-0" aria-label="Tìm kiếm"><Search size={19}/></button>
      </header>
      <a className="skip-link" href="#main-content">Bỏ qua đến nội dung</a>
      <div className="mx-auto w-full max-w-full px-4 py-5 pb-24 sm:px-6 lg:px-10 lg:py-10 lg:pb-12 xl:px-14"><div key={section} className="page-enter">{children}</div></div>
    </main>
    <BottomNav/>
    {searchMounted && <Suspense fallback={null}><SearchModal/></Suspense>}
  </div>;
}
