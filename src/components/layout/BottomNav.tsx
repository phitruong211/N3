// ============================================================
// Bottom Navigation Bar — Mobile only (md:hidden)
// ============================================================
// Shows the 5 most-used pages as a fixed bottom tab bar
// The "More" button opens a sheet for the rest of the pages
// ============================================================

import React, { useState } from 'react';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';
import {
  LayoutDashboard,
  BookOpen,
  RotateCcw,
  Layers,
  MoreHorizontal,
  X,
  Languages,
  GraduationCap,
  HelpCircle,
  BarChart3,
  Bookmark,
  Settings,
  Search,
} from 'lucide-react';

// Primary 5 tabs (shown in bottom bar)
const PRIMARY_TABS = [
  { id: 'dashboard' as PageId, label: 'Home', icon: <LayoutDashboard size={22} /> },
  { id: 'vocabulary' as PageId, label: 'Từ vựng', icon: <BookOpen size={22} /> },
  { id: 'srs' as PageId, label: 'Ôn tập', icon: <RotateCcw size={22} /> },
  { id: 'flashcards' as PageId, label: 'Flashcard', icon: <Layers size={22} /> },
];

// Secondary pages shown in the "More" sheet
const SECONDARY_TABS = [
  { id: 'kanji' as PageId, label: 'Kanji', icon: <Languages size={20} /> },
  { id: 'grammar' as PageId, label: 'Ngữ pháp', icon: <GraduationCap size={20} /> },
  { id: 'quiz' as PageId, label: 'Quiz', icon: <HelpCircle size={20} /> },
  { id: 'progress' as PageId, label: 'Tiến độ', icon: <BarChart3 size={20} /> },
  { id: 'bookmarks' as PageId, label: 'Đã lưu', icon: <Bookmark size={20} /> },
  { id: 'settings' as PageId, label: 'Cài đặt', icon: <Settings size={20} /> },
];

export function BottomNav() {
  const { currentPage, setCurrentPage, setSearchOpen } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNav = (id: PageId) => {
    setCurrentPage(id);
    setSheetOpen(false);
  };

  return (
    <>
      {/* ======================================================
          BOTTOM NAVIGATION BAR
          ====================================================== */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0C0D0E]/95 backdrop-blur-md border-t border-gray-200/80 dark:border-[var(--color-border)] safe-area-inset-bottom"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around px-2 py-1 pb-safe">
          {PRIMARY_TABS.map((tab) => {
            const isActive = currentPage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleNav(tab.id)}
                className={`
                  flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[60px]
                  transition-all duration-150 cursor-pointer
                  ${isActive
                    ? 'text-[#1D63ED] bg-blue-50 dark:bg-blue-950/30'
                    : 'text-gray-400 dark:text-gray-500 active:text-gray-700 dark:active:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={`transition-transform duration-150 ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
                <span className="text-[10px] font-semibold leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[60px] text-gray-400 dark:text-gray-500 transition-all duration-150 cursor-pointer active:text-gray-700"
          >
            <Search size={22} />
            <span className="text-[10px] font-semibold leading-tight">Tìm</span>
          </button>

          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl min-w-[60px]
              transition-all duration-150 cursor-pointer
              ${sheetOpen ? 'text-[#1D63ED]' : 'text-gray-400 dark:text-gray-500'}
            `}
          >
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-semibold leading-tight">Thêm</span>
          </button>
        </div>
      </nav>

      {/* ======================================================
          MORE SHEET (Bottom drawer)
          ====================================================== */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#0C0D0E] rounded-t-3xl border-t border-gray-200/80 dark:border-[var(--color-border)] shadow-2xl animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-base font-bold text-gray-900 dark:text-white">Menu</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid of secondary pages */}
            <div className="grid grid-cols-3 gap-2 px-4 pb-6 pt-2 pb-safe">
              {SECONDARY_TABS.map((tab) => {
                const isActive = currentPage === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleNav(tab.id)}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-2xl
                      transition-all duration-150 cursor-pointer
                      ${isActive
                        ? 'bg-[#DCEBFE] text-[#1D63ED]'
                        : 'bg-gray-100/80 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <span>{tab.icon}</span>
                    <span className="text-xs font-semibold text-center leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
