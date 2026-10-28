import { NavSettings, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Search } from '@/components/ui/icons';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { BrandMark } from '@/components/ui/BrandMark';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavigationItem } from './navigationItems';

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { user, signOut, setPrompt } = useAuth();

  const renderItem = (item: NavigationItem) => {
    const active = isNavigationItemActive(item, currentPage);
    return <button key={item.page} onClick={() => setCurrentPage(item.page)} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-sm transition-[color,background,padding] duration-[var(--dur-base)] ease-[var(--ease-out)] ${active ? 'bg-[color-mix(in_srgb,var(--color-gold)_10%,transparent)] font-semibold text-[var(--color-text)] shadow-[inset_2px_0_0_var(--color-gold)]' : 'font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'} ${sidebarCollapsed ? 'justify-center' : ''}`}>
      <item.icon size={22} strokeWidth={1.6} className="shrink-0"/><span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
    </button>;
  };

  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200 lg:flex ${sidebarCollapsed ? 'w-[4.75rem]' : 'w-60'}`} aria-label="Điều hướng chính">
      <div className={`flex items-center gap-2 px-3 py-4 ${sidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
        <button onClick={() => setCurrentPage('dashboard')} className="flex min-w-0 items-center gap-2.5 text-left" aria-label="SỔ NHẬT, về trang Hôm nay">
          <BrandMark size={44} className="shrink-0"/>
          {!sidebarCollapsed && <span className="whitespace-nowrap font-[family-name:var(--font-display)] text-lg font-medium tracking-[.14em]">SỔ NHẬT</span>}
        </button>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="study-button !min-h-11 !w-11 shrink-0 !p-0" aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
          {sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>} 
        </button>
      </div>

      <button onClick={() => setCurrentPage('settings')} title={sidebarCollapsed ? (user ? `${user.displayName} · ${user.email}` : 'Khách · lưu trên thiết bị') : user?.email} aria-label={user ? `Tài khoản ${user.displayName}, mở cài đặt` : 'Khách, mở cài đặt'}
        className={`mx-3 mb-3 flex min-h-12 items-center gap-3 rounded-lg border border-[var(--color-border)] px-2.5 text-left transition-colors hover:bg-[var(--color-surface-hover)] ${sidebarCollapsed ? 'justify-center !px-0' : ''}`}>
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-text-inverse)]">{(user?.displayName || 'K').trim().charAt(0).toUpperCase()}</span>
        {!sidebarCollapsed && <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--color-text)]">{user?.displayName || 'Khách'}</span><span className="block truncate text-xs text-[var(--color-text-tertiary)]">{user ? 'Đã đăng nhập' : 'Học thử · lưu trên thiết bị'}</span></span>}
      </button>

      <button onClick={() => setSearchOpen(true)} className={`study-button mx-3 !min-h-10 ${sidebarCollapsed ? '!px-0' : '!justify-start'}`} aria-label={sidebarCollapsed ? 'Tìm kiếm' : undefined}>
        <Search size={17}/>{!sidebarCollapsed && <><span className="flex-1 text-left">Tìm kiếm</span><kbd className="kbd-shortcut">⌘ K</kbd></>}
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Các trang học">
        <div className="space-y-1">{PRIMARY_NAV_ITEMS.map(renderItem)}</div>
        <div className="my-5 border-t border-[var(--color-border)]"/>
        <div className="space-y-1">{SECONDARY_NAV_ITEMS.map(renderItem)}</div>
      </nav>

      <div className="space-y-1 border-t border-[var(--color-border)] p-3">
        {renderItem({ page: 'settings', label: 'Cài đặt', icon: NavSettings })}
        <button className={`study-button w-full ${sidebarCollapsed ? '!px-0' : '!justify-start'}`} title={user ? 'Đăng xuất' : 'Đăng nhập'} onClick={() => user ? void signOut() : setPrompt('login')}>
          {user ? <LogOut size={17}/> : <LogIn size={17}/>}<span className={sidebarCollapsed ? 'sr-only' : undefined}>{user ? 'Đăng xuất' : 'Đăng nhập'}</span>
        </button>
      </div>
    </aside>
  );
}
