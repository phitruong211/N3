import type { PageId } from '@/types';
import { Bookmark, BookOpen, ChartNoAxesCombined, CircleHelp, Layers, LayoutGrid, RotateCcw, Settings } from 'lucide-react';

export type NavigationItem = { page: PageId; label: string; icon: typeof BookOpen; shortcut?: string };

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'dashboard', label: 'Hôm nay', icon: LayoutGrid, shortcut: 'G D' },
  { page: 'vocabulary', label: 'Thư viện', icon: BookOpen, shortcut: 'G V' },
  { page: 'flashcards', label: 'Bộ thẻ', icon: Layers, shortcut: 'G F' },
  { page: 'srs', label: 'Ôn tập', icon: RotateCcw, shortcut: 'G S' },
  { page: 'quiz', label: 'Trắc nghiệm', icon: CircleHelp, shortcut: 'G Q' },
];

export const SECONDARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'progress', label: 'Tiến độ', icon: ChartNoAxesCombined, shortcut: 'G P' },
  { page: 'bookmarks', label: 'Đã lưu', icon: Bookmark, shortcut: 'G B' },
];

export const MOBILE_NAV_ITEMS = PRIMARY_NAV_ITEMS.slice(0, 4);
export const MORE_NAV_ITEMS: NavigationItem[] = [
  ...PRIMARY_NAV_ITEMS.slice(4),
  ...SECONDARY_NAV_ITEMS,
  { page: 'settings', label: 'Cài đặt', icon: Settings },
];

export function isNavigationItemActive(item: NavigationItem, currentPage: PageId): boolean {
  if (item.page === 'vocabulary') return ['vocabulary', 'grammar', 'kanji', 'listening'].includes(currentPage);
  if (item.page === 'flashcards') return currentPage === 'flashcards' || currentPage === 'anki';
  return item.page === currentPage;
}
