import { useApp } from '@/hooks/useApp';
import { isNavigationItemActive, MOBILE_NAV_ITEMS } from './navigationItems';

/** Phones: the five study pages. Settings, progress and saved cards are in the account menu of the header. */
export function BottomNav() {
  const { currentPage, setCurrentPage } = useApp();
  return <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)]/70 bg-[color-mix(in_srgb,var(--color-surface)_85%,transparent)] px-1 pb-safe backdrop-blur-xl lg:hidden" aria-label="Điều hướng điện thoại">
    {MOBILE_NAV_ITEMS.map(item => {
      const active = isNavigationItemActive(item, currentPage);
      return <button key={item.page} onClick={() => setCurrentPage(item.page)} aria-current={active ? 'page' : undefined}
        className={`flex min-h-[56px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>
        <item.icon size={24} strokeWidth={1.6} /><span className="whitespace-nowrap">{item.label}</span>
      </button>;
    })}
  </nav>;
}
