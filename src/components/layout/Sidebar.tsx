// ============================================================
// Sidebar Navigation
// ============================================================
// Principles:
// - Hick's Law: Limited navigation items, grouped logically
// - Miller's Law: Items grouped into chunks (Study, Review, Tools)
// - Fitts's Law: Large touch targets (44px min height)
// - Recognition over Recall: Icons + labels for all items
// - Goal Gradient Effect: Streak counter shows progress
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
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, group: 'Study', shortcut: 'G D' },
  { id: 'vocabulary', label: 'Vocabulary', icon: <BookOpen size={18} />, group: 'Study', shortcut: 'G V' },
  { id: 'kanji', label: 'Kanji', icon: <Languages size={18} />, group: 'Study', shortcut: 'G K' },
  { id: 'grammar', label: 'Grammar', icon: <GraduationCap size={18} />, group: 'Study', shortcut: 'G G' },

  { id: 'flashcards', label: 'Flashcards', icon: <Layers size={18} />, group: 'Practice', shortcut: 'G F' },
  { id: 'srs', label: 'SRS Review', icon: <RotateCcw size={18} />, group: 'Practice', shortcut: 'G S' },
  { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={18} />, group: 'Practice', shortcut: 'G Q' },

  { id: 'progress', label: 'Progress', icon: <BarChart3 size={18} />, group: 'System', shortcut: 'G P' },
  { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark size={18} />, group: 'System', shortcut: 'G B' },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} />, group: 'System', shortcut: '' },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen, sidebarCollapsed: collapsed, setSidebarCollapsed: setCollapsed } = useApp();

  // Group nav items
  const groups = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside
      className={`
        shrink-0 sticky top-0 h-screen z-30
        flex flex-col
        bg-[var(--color-surface)] border-r border-[var(--color-border)]
        transition-[width] duration-200 ease-in-out
        ${collapsed ? 'w-16' : 'w-64'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo / Brand */}
      <div className="flex items-center h-14 px-4 border-b border-[var(--color-border)]">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-jp-serif text-xl font-semibold text-[var(--color-text)]">
              N3
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] font-medium tracking-wide">
              学習
            </span>
          </div>
        )}
        {collapsed && (
          <span className="font-jp-serif text-lg font-semibold text-[var(--color-text)] mx-auto">
            N3
          </span>
        )}
      </div>

      {/* Search button */}
      <button
        onClick={() => setSearchOpen(true)}
        className={`
          mx-3 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm text-[var(--color-text-secondary)]
          bg-[var(--color-surface-alt)] hover:bg-[var(--color-surface-hover)]
          transition-colors duration-150 cursor-pointer
          focus-ring
        `}
        aria-label="Search (Ctrl+K)"
      >
        <Search size={16} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Search...</span>
            <kbd className="text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">
              ⌘K
            </kbd>
          </>
        )}
      </button>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            {!collapsed && (
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {group}
              </div>
            )}
            <div className="space-y-0.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`
                    group w-full flex items-center justify-between px-3 py-2 rounded-lg
                    text-sm font-medium transition-colors duration-150
                    cursor-pointer focus-ring
                    ${
                      currentPage === item.id
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                  aria-current={currentPage === item.id ? 'page' : undefined}
                  title={collapsed ? `${item.label} (${item.shortcut})` : undefined}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </div>
                  {!collapsed && item.shortcut && (
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: Streak + Collapse toggle */}
      <div className="border-t border-[var(--color-border)] p-3">
        {/* Study streak indicator (Goal Gradient Effect) */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg bg-[var(--color-surface-alt)]">
            <Flame size={16} className="text-[var(--color-warning)]" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              Study Streak
            </span>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
            text-sm text-[var(--color-text-tertiary)]
            hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]
            transition-colors duration-150 cursor-pointer focus-ring
          "
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
