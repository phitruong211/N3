// ============================================================
// Sidebar Navigation
// ============================================================
// Desktop: Collapsible sidebar (left rail)
// Mobile: Hidden — replaced by BottomNav component
// ============================================================

import React from 'react';
import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';
import {
  LayoutDashboard,
  BookOpen,
  Languages,
  GraduationCap,
  Layers,
  RotateCcw,
  HelpCircle,
  BarChart3,
  Search,
  Bookmark,
  Settings,
  Flame,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ReactNode;
  group: 'Study' | 'Practice' | 'System';
  shortcut: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} />, group: 'Study', shortcut: 'G D' },
  { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen size={22} />, group: 'Study', shortcut: 'G V' },
  { id: 'kanji', label: 'Kanji', icon: <Languages size={22} />, group: 'Study', shortcut: 'G K' },
  { id: 'grammar', label: 'Grammar', icon: <GraduationCap size={22} />, group: 'Study', shortcut: 'G G' },

  { id: 'flashcards', label: 'Flashcards', icon: <Layers size={22} />, group: 'Practice', shortcut: 'G F' },
  { id: 'srs', label: 'SRS Review', icon: <RotateCcw size={22} />, group: 'Practice', shortcut: 'G S' },
  { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={22} />, group: 'Practice', shortcut: 'G Q' },

  { id: 'progress', label: 'Progress', icon: <BarChart3 size={22} />, group: 'System', shortcut: 'G P' },
  { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark size={22} />, group: 'System', shortcut: 'G B' },
  { id: 'settings', label: 'Settings', icon: <Settings size={22} />, group: 'System', shortcut: '' },
];

export { NAV_ITEMS };

export function Sidebar() {
  const {
    currentPage,
    setCurrentPage,
    setSearchOpen,
    sidebarCollapsed: collapsed,
    setSidebarCollapsed: setCollapsed,
  } = useApp();

  // Group nav items
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside
      className={`
        hidden md:flex
        shrink-0 sticky top-0 h-screen z-30
        flex-col p-4
        bg-[#F3F4F6] dark:bg-[#0C0D0E] border-r border-gray-200/80 dark:border-[var(--color-border)]
        transition-[width] duration-200 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Header: Logo & Clean Toggle Button */}
      <div className="flex items-center justify-between h-14 px-2 mb-2 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <span className="font-jp-serif text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              N3
            </span>
            <span className="text-xs font-bold text-[#1D63ED] bg-[#DCEBFE] dark:bg-blue-950/60 px-2.5 py-1 rounded-lg">
              学習
            </span>
          </div>
        ) : (
          <span className="font-jp-serif text-xl font-bold text-gray-900 dark:text-white mx-auto">
            N3
          </span>
        )}

        {/* Clean Header Toggle Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`
            p-2 rounded-xl text-gray-400 hover:text-gray-800 dark:hover:text-gray-200
            hover:bg-gray-200/80 dark:hover:bg-gray-800/80
            transition-colors duration-150 cursor-pointer focus-ring
            ${collapsed ? 'mx-auto mt-2' : ''}
          `}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* Search Input Button */}
      <div className="mb-4 shrink-0">
        <button
          onClick={() => setSearchOpen(true)}
          className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-2xl
            text-base text-gray-500 dark:text-gray-400 font-semibold
            bg-white dark:bg-[var(--color-surface)] hover:bg-gray-50 dark:hover:bg-[var(--color-surface-hover)]
            border border-gray-200/80 dark:border-[var(--color-border)] shadow-2xs
            transition-all duration-150 cursor-pointer focus-ring
          `}
          aria-label="Search (Ctrl+K)"
        >
          <Search size={20} className="text-gray-400 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search...</span>
              <kbd className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-md border border-gray-200 dark:border-[var(--color-border)]">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navigation Group Section */}
      <nav className="flex-1 overflow-y-auto space-y-6 pr-1">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            {!collapsed && (
              <div className="px-3 text-xs font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">
                {group}
              </div>
            )}
            <div className="space-y-2">
              {items.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`
                      group w-full flex items-center justify-between px-4 py-3 rounded-2xl
                      text-base font-bold transition-all duration-150
                      cursor-pointer focus-ring
                      ${
                        isActive
                          ? 'bg-[#DCEBFE] text-[#1D63ED] shadow-2xs'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-[#EBECEF] dark:hover:bg-gray-800/80 hover:text-gray-900 dark:hover:text-white'
                      }
                      ${collapsed ? 'justify-center px-2 py-3' : ''}
                    `}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className={isActive ? 'text-[#1D63ED]' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-800'}>
                        {item.icon}
                      </span>
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && item.shortcut && (
                      <span className="text-xs font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: Study Streak */}
      {!collapsed && (
        <div className="pt-3 mt-2 border-t border-gray-200/80 dark:border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-orange-100/60 dark:bg-amber-950/30 text-orange-700 dark:text-amber-400 font-bold text-sm">
            <Flame size={18} className="text-[#FF7043]" />
            <span>Study Streak</span>
          </div>
        </div>
      )}
    </aside>
  );
}
