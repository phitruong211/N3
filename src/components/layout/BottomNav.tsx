import { useApp } from '@/hooks/useApp';
import type { PageId } from '@/types';
import { LayoutGrid, BookOpen, ScrollText, Languages, RotateCcw, Brain } from 'lucide-react';

const tabs: { id: PageId; label: string; shortLabel: string; icon: typeof BookOpen }[] = [
  { id: 'dashboard', label: 'Hôm nay', shortLabel: 'Hôm nay', icon: LayoutGrid },
  { id: 'vocabulary', label: 'Từ vựng', shortLabel: 'Từ', icon: BookOpen },
  { id: 'grammar', label: 'Ngữ pháp', shortLabel: 'Ngữ', icon: ScrollText },
  { id: 'kanji', label: 'Kanji', shortLabel: 'Kanji', icon: Languages },
  { id: 'srs', label: 'Ôn tập', shortLabel: 'Ôn tập', icon: RotateCcw },
  { id: 'anki', label: 'Anki', shortLabel: 'Anki', icon: Brain },
];

export function BottomNav() {
  const { currentPage, setCurrentPage } = useApp();
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] px-1 pt-1 pb-safe" aria-label="Điều hướng điện thoại">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = currentPage === tab.id;
        return <button key={tab.id} onClick={() => setCurrentPage(tab.id)} aria-label={tab.label} aria-current={active ? 'page' : undefined}
          className={`flex flex-1 min-w-0 min-h-15 flex-col items-center justify-center gap-0.5 rounded-lg text-[9px] tracking-tight font-semibold cursor-pointer ${active ? 'text-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : 'text-[var(--color-text-secondary)]'}`}>
          <Icon size={19} strokeWidth={active ? 2.2 : 1.8} /><span className="whitespace-nowrap min-[400px]:hidden">{tab.shortLabel}</span><span className="hidden whitespace-nowrap min-[400px]:inline">{tab.label}</span>
        </button>;
      })}
    </nav>
  );
}
