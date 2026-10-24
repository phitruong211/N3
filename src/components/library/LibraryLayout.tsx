import { NavLink, Outlet, useLocation } from 'react-router-dom';

const tabs = [
  ['/library/vocabulary', 'Từ vựng'],
  ['/library/grammar', 'Ngữ pháp'],
  ['/library/kanji', 'Kanji'],
  ['/library/listening', 'Luyện nghe'],
] as const;

export function LibraryLayout() {
  const { pathname } = useLocation();
  return <div className="space-y-8">
    <div className="border-b border-[var(--color-border-strong)]">
      <nav aria-label="Nội dung thư viện" className="-mb-px flex max-w-full gap-6 overflow-x-auto">
        {tabs.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-[color,border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] ${isActive ? 'border-[var(--color-gold)] text-[var(--color-text)]' : 'border-transparent text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]'}`}>{label}</NavLink>)}
      </nav>
    </div>
    <div key={pathname} className="page-turn"><Outlet/></div>
  </div>;
}
