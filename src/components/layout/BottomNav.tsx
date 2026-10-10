import { useState } from 'react';
import { Ellipsis } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { AppDialog } from '@/components/ui/AppDialog';
import { isNavigationItemActive, MOBILE_NAV_ITEMS, MORE_NAV_ITEMS } from './navigationItems';

export function BottomNav() {
  const { currentPage, setCurrentPage } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_NAV_ITEMS.some(item => isNavigationItemActive(item, currentPage));
  return <>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 pb-safe pt-1 lg:hidden" aria-label="Điều hướng điện thoại">
      {MOBILE_NAV_ITEMS.map(item => {
        const Icon = item.icon;
        const active = isNavigationItemActive(item, currentPage);
        return <button key={item.page} onClick={() => setCurrentPage(item.page)} aria-label={item.label} aria-current={active ? 'page' : undefined}
          className={`flex min-h-16 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium ${active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>
          <Icon size={20} strokeWidth={active ? 2.2 : 1.8}/><span className="whitespace-nowrap">{item.label}</span>
        </button>;
      })}
      <button onClick={() => setMoreOpen(true)} aria-label="Thêm" aria-expanded={moreOpen}
        className={`flex min-h-16 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium ${moreActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}>
        <Ellipsis size={21}/><span>Thêm</span>
      </button>
    </nav>
    <AppDialog open={moreOpen} title="Thêm" onClose={() => setMoreOpen(false)} className="self-end !mb-0 !w-full !max-w-none !rounded-b-none lg:hidden">
      <div className="grid grid-cols-2 gap-2">
        {MORE_NAV_ITEMS.map(item => {
          const Icon = item.icon;
          return <button key={item.page} className="study-button !min-h-14 !justify-start" onClick={() => { setCurrentPage(item.page); setMoreOpen(false); }}>
            <Icon size={19}/>{item.label}
          </button>;
        })}
      </div>
    </AppDialog>
  </>;
}
