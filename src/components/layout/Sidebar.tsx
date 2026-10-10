import { LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { isNavigationItemActive, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, type NavigationItem } from './navigationItems';

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { user, signOut, setPrompt } = useAuth();

  const renderItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const active = isNavigationItemActive(item, currentPage);
    return <button key={item.page} onClick={() => setCurrentPage(item.page)} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors ${active ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'} ${sidebarCollapsed ? 'justify-center' : ''}`}>
      <Icon size={19} strokeWidth={active ? 2.2 : 1.8}/><span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
    </button>;
  };

  return (
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-200 lg:flex ${sidebarCollapsed ? 'w-[4.75rem]' : 'w-60'}`} aria-label="Điều hướng chính">
      <div className={`flex items-center gap-2 px-3 py-4 ${sidebarCollapsed ? 'flex-col' : 'justify-between'}`}>
        <button onClick={() => setCurrentPage('dashboard')} className="flex min-w-0 items-center gap-2.5 text-left" aria-label="Về trang Hôm nay">
          <img src="/so-nhat-mark.svg" alt="" className="h-11 w-11 shrink-0 object-contain"/>
          {!sidebarCollapsed && <span className="whitespace-nowrap text-lg font-bold tracking-wide">SỔ NHẬT</span>}
        </button>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="study-button !min-h-9 !w-9 !p-0" aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
          {sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>} 
        </button>
      </div>

      <button onClick={() => setSearchOpen(true)} className={`study-button mx-3 !min-h-10 ${sidebarCollapsed ? '!px-0' : '!justify-start'}`} aria-label="Tìm kiếm">
        <Search size={17}/>{!sidebarCollapsed && <><span className="flex-1 text-left">Tìm kiếm</span><kbd className="kbd-shortcut">⌘ K</kbd></>}
      </button>

      <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Các trang học">
        <div className="space-y-1">{PRIMARY_NAV_ITEMS.map(renderItem)}</div>
        <div className="my-5 border-t border-[var(--color-border)]"/>
        <div className="space-y-1">{SECONDARY_NAV_ITEMS.map(renderItem)}</div>
      </nav>

      <div className="space-y-1 border-t border-[var(--color-border)] p-3">
        {renderItem({ page: 'settings', label: 'Cài đặt', icon: Settings })}
        {!sidebarCollapsed && <p className="truncate px-3 pt-2 text-xs text-[var(--color-text-tertiary)]" title={user?.email}>{user?.displayName || 'Khách · lưu trên thiết bị'}</p>}
        <button className={`study-button w-full ${sidebarCollapsed ? '!px-0' : '!justify-start'}`} title={user ? 'Đăng xuất' : 'Đăng nhập'} onClick={() => user ? void signOut() : setPrompt('login')}>
          {user ? <LogOut size={17}/> : <LogIn size={17}/>}<span className={sidebarCollapsed ? 'sr-only' : undefined}>{user ? 'Đăng xuất' : 'Đăng nhập'}</span>
        </button>
      </div>
    </aside>
  );
}
