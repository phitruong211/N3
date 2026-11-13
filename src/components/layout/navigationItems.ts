import type { PageId } from '@/types';
import { NavDecks, NavLibrary, NavQuiz, NavReview, NavToday, type Icon } from '@/components/ui/icons';

export type NavigationItem = { page: PageId; label: string; icon: Icon; shortcut?: string };

export const PRIMARY_NAV_ITEMS: NavigationItem[] = [
  { page: 'dashboard', label: 'Hôm nay', icon: NavToday, shortcut: 'G D' },
  { page: 'library', label: 'Thư viện', icon: NavLibrary, shortcut: 'G V' },
  { page: 'flashcards', label: 'Bộ thẻ', icon: NavDecks, shortcut: 'G F' },
  { page: 'srs', label: 'Ôn ngắt quãng', icon: NavReview, shortcut: 'G S' },
  { page: 'quiz', label: 'Trắc nghiệm', icon: NavQuiz, shortcut: 'G Q' },
];

// Phones show the same five; short labels keep them on one row.
const MOBILE_LABELS: Partial<Record<PageId, string>> = { srs: 'Ôn tập', quiz: 'Kiểm tra' };
export const MOBILE_NAV_ITEMS: NavigationItem[] = PRIMARY_NAV_ITEMS.map(item => ({ ...item, label: MOBILE_LABELS[item.page] ?? item.label }));

export function isNavigationItemActive(item: NavigationItem, currentPage: PageId): boolean {
  if (item.page === 'library') return ['library', 'vocabulary', 'kana', 'grammar', 'kanji', 'listening', 'exam'].includes(currentPage);
  if (item.page === 'flashcards') return currentPage === 'flashcards';
  if (item.page === 'srs') return currentPage === 'srs' || currentPage === 'anki';
  return item.page === currentPage;
}
