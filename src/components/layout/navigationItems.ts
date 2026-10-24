import type { PageId } from '@/types';
import { NavDecks, NavDictionary, NavLibrary, NavProgress, NavQuiz, NavReview, NavSaved, NavSettings, NavToday, type Icon } from '@/components/ui/icons';

export type NavigationItem = { page: PageId; label: string; icon: Icon; shortcut?: string };

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'dashboard', label: 'Hôm nay', icon: NavToday, shortcut: 'G D' },
  { page: 'vocabulary', label: 'Thư viện', icon: NavLibrary, shortcut: 'G V' },
  { page: 'flashcards', label: 'Bộ thẻ', icon: NavDecks, shortcut: 'G F' },
  { page: 'srs', label: 'Ôn ngắt quãng', icon: NavReview, shortcut: 'G S' },
  { page: 'quiz', label: 'Trắc nghiệm', icon: NavQuiz, shortcut: 'G Q' },
];

export const SECONDARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'dictionary', label: 'Từ điển', icon: NavDictionary },
  { page: 'progress', label: 'Tiến độ', icon: NavProgress, shortcut: 'G P' },
  { page: 'bookmarks', label: 'Đã lưu', icon: NavSaved, shortcut: 'G B' },
];

export const MOBILE_NAV_ITEMS: NavigationItem[] = PRIMARY_NAV_ITEMS
  .filter(item => item.page !== 'quiz')
  .map(item => item.page === 'srs' ? { ...item, label: 'Ôn tập' } : item);
export const MORE_NAV_ITEMS: NavigationItem[] = [
  PRIMARY_NAV_ITEMS.find(item => item.page === 'quiz')!,
  ...SECONDARY_NAV_ITEMS,
  { page: 'settings', label: 'Cài đặt', icon: NavSettings },
];

export function isNavigationItemActive(item: NavigationItem, currentPage: PageId): boolean {
  if (item.page === 'vocabulary') return ['vocabulary', 'grammar', 'kanji', 'listening'].includes(currentPage);
  if (item.page === 'flashcards') return currentPage === 'flashcards';
  if (item.page === 'srs') return currentPage === 'srs' || currentPage === 'anki';
  return item.page === currentPage;
}
