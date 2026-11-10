import { OverflowMenu } from '@/components/ui/OverflowMenu';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';

/** Mobile header only: on desktop the sidebar footer shows the account. */
export function AccountMenu() {
  const { setCurrentPage } = useApp();
  const { user, signOut, setPrompt } = useAuth();
  const name = user?.displayName || 'Khách';
  return <OverflowMenu
    label={user ? `Tài khoản ${name}` : 'Tài khoản khách'}
    triggerClassName="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-[var(--color-text-inverse)] focus-ring"
    triggerContent={name.trim().charAt(0).toUpperCase()}
    header={<div className="mb-1 border-b border-[var(--color-border)] px-3 pb-2.5 pt-2">
      <p className="truncate text-sm font-semibold text-[var(--color-text)]">{name}</p>
      <p className="truncate text-xs text-[var(--color-text-tertiary)]">{user?.email ?? 'Học thử · lưu trên thiết bị'}</p>
    </div>}
    actions={[
      { id: 'settings', label: 'Cài đặt', onSelect: () => setCurrentPage('settings') },
      user ? { id: 'out', label: 'Đăng xuất', onSelect: () => void signOut() } : { id: 'in', label: 'Đăng nhập để lưu tiến độ', onSelect: () => setPrompt('login') },
    ]} />;
}
