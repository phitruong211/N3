import type { PageId } from '@/types';
import { Bookmark, BookOpen, ChartNoAxesCombined, CircleHelp, Layers, LayoutGrid, RotateCcw, Settings } from 'lucide-react';

export type NavigationItem = { page: PageId; label: string; icon: typeof BookOpen; shortcut?: string };

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'dashboard', label: 'Hôm nay', icon: LayoutGrid, shortcut: 'G D' },
  { page: 'vocabulary', label: 'Thư viện', icon: BookOpen, shortcut: 'G V' },
  { page: 'flashcards', label: 'Bộ thẻ', icon: Layers, shortcut: 'G F' },
  { page: 'srs', label: 'Ôn ngắt quãng', icon: RotateCcw, shortcut: 'G S' },
  { page: 'quiz', label: 'Trắc nghiệm', icon: CircleHelp, shortcut: 'G Q' },
];

export const SECONDARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'progress', label: 'Tiến độ', icon: ChartNoAxesCombined, shortcut: 'G P' },
  { page: 'bookmarks', label: 'Đã lưu', icon: Bookmark, shortcut: 'G B' },
];

export const MOBILE_NAV_ITEMS: NavigationItem[] = PRIMARY_NAV_ITEMS
  .filter(item => item.page !== 'quiz')
  .map(item => item.page === 'srs' ? { ...item, label: 'Ôn tập' } : item);
export const MORE_NAV_ITEMS: NavigationItem[] = [
  PRIMARY_NAV_ITEMS.find(item => item.page === 'quiz')!,
  ...SECONDARY_NAV_ITEMS,
  { page: 'settings', label: 'Cài đặt', icon: Settings },
];

export function isNavigationItemActive(item: NavigationItem, currentPage: PageId): boolean {
  if (item.page === 'vocabulary') return ['vocabulary', 'grammar', 'kanji', 'listening'].includes(currentPage);
  if (item.page === 'flashcards') return currentPage === 'flashcards';
  if (item.page === 'srs') return currentPage === 'srs' || currentPage === 'anki';
  return item.page === currentPage;
}
