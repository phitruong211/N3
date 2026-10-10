import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  ['/library/vocabulary', 'Từ vựng'],
  ['/library/grammar', 'Ngữ pháp'],
  ['/library/kanji', 'Kanji'],
  ['/library/listening', 'Luyện nghe'],
] as const;

export function LibraryLayout() {
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="study-eyebrow">KHÁM PHÁ</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Thư viện</h1></div>
      <nav aria-label="Nội dung thư viện" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[var(--color-surface-alt)] p-1">
        {tabs.map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-[var(--color-surface)] text-[var(--color-accent-text)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'}`}>{label}</NavLink>)}
      </nav>
    </div>
    <Outlet/>
  </div>;
}
