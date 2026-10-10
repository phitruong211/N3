import type { PageId } from '../types/index.ts';

export const PAGE_PATHS: Record<PageId, string> = {
  dashboard: '/today',
  vocabulary: '/library/vocabulary',
  grammar: '/library/grammar',
  kanji: '/library/kanji',
  listening: '/library/listening',
  flashcards: '/decks',
  anki: '/decks',
  srs: '/decks',
  quiz: '/quiz',
  progress: '/progress',
  bookmarks: '/saved',
  settings: '/settings',
  search: '/today',
};

export function pathForPage(page: PageId): string {
  return PAGE_PATHS[page] ?? '/today';
}

export function pageForLocation(pathname: string, _search = ''): PageId | null {
  if (pathname === '/decks') return 'flashcards';
  const entry = Object.entries(PAGE_PATHS).find(([, path]) => path.split('?')[0] === pathname);
  return (entry?.[0] as PageId | undefined) ?? null;
}

export function resolveInitialPath(pathname: string, storedPage: string | null): string {
  if (pathname !== '/') return pathname;
  if (!storedPage) return '/today';
  if (storedPage.startsWith('/')) {
    const [path, query = ''] = storedPage.split('?');
    return pageForLocation(path, query) ? storedPage : '/today';
  }
  return PAGE_PATHS[storedPage as PageId] ?? '/today';
}
