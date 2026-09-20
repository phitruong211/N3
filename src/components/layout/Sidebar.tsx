import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';
import { LayoutGrid, BookOpen, ScrollText, Languages, RotateCcw, Layers, CircleHelp, ChartNoAxesCombined, Bookmark, Settings, Search, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const groups: { label: string; items: { id: PageId; label: string; icon: typeof BookOpen; shortcut?: string }[] }[] = [
  { label: 'Học', items: [
    { id: 'dashboard', label: 'Hôm nay', icon: LayoutGrid, shortcut: 'G D' },
    { id: 'vocabulary', label: 'Từ vựng', icon: BookOpen, shortcut: 'G V' },
    { id: 'grammar', label: 'Ngữ pháp', icon: ScrollText, shortcut: 'G G' },
    { id: 'kanji', label: 'Kanji', icon: Languages, shortcut: 'G K' },
    { id: 'srs', label: 'Ôn tập', icon: RotateCcw, shortcut: 'G S' },
  ] },
  { label: 'Luyện thêm', items: [
    { id: 'flashcards', label: 'Thẻ học', icon: Layers, shortcut: 'G F' },
    { id: 'quiz', label: 'Trắc nghiệm', icon: CircleHelp, shortcut: 'G Q' },
  ] },
  { label: 'Cá nhân', items: [
    { id: 'progress', label: 'Tiến độ', icon: ChartNoAxesCombined, shortcut: 'G P' },
    { id: 'bookmarks', label: 'Đã lưu', icon: Bookmark, shortcut: 'G B' },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ] },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, setSearchOpen, sidebarCollapsed, setSidebarCollapsed } = useApp();
  return (
    <aside className={`hidden md:flex sticky top-0 h-screen shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-[width] duration-150 ${sidebarCollapsed ? 'w-20' : 'w-60'}`} aria-label="Điều hướng chính">
      <div className="flex items-center justify-between px-4 py-6 border-b border-[var(--color-border)]">
        <button onClick={() => setCurrentPage('dashboard')} className="flex min-w-0 items-baseline gap-2 text-left cursor-pointer" aria-label="Về trang Hôm nay">
          <span className="font-jp-serif text-2xl font-bold text-[var(--color-text)]">学</span>
          {!sidebarCollapsed && <span className="font-semibold tracking-tight text-[var(--color-text)]">Sổ học <span className="text-xs text-[var(--color-text-secondary)]">N2 / N3 / N4</span></span>}
        </button>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="study-button !min-h-9 !w-9 !p-0" aria-label={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}>
          {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <button onClick={() => setSearchOpen(true)} className="study-button mx-3 mt-4 !justify-start" aria-label="Tìm kiếm">
        <Search size={17} /> {!sidebarCollapsed && <><span className="flex-1 text-left">Tìm kiếm</span><kbd className="kbd-shortcut">Ctrl K</kbd></>}
      </button>
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6" aria-label="Các trang học">
        {groups.map(group => (
          <div key={group.label}>
            {!sidebarCollapsed && <p className="study-eyebrow px-3 mb-2">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return <button key={item.id} onClick={() => setCurrentPage(item.id)} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? 'page' : undefined}
                  className={`flex w-full min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-left cursor-pointer transition-colors ${active ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]'} ${sidebarCollapsed ? 'justify-center' : ''}`}>
                  <Icon size={18} strokeWidth={active ? 2 : 1.8} /><span className={sidebarCollapsed ? 'sr-only' : ''}>{item.label}</span>
                </button>;
              })}
            </div>
          </div>
        ))}
      </nav>
      {!sidebarCollapsed && <div className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-text-tertiary)]">Mỗi ngày một chút, nhớ lâu hơn.</div>}
    </aside>
  );
}
