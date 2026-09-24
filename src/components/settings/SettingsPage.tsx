import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { resetAllData } from '@/lib/storage';
import type { ThemeMode } from '@/types';
import { PageHeading } from '@/components/ui/StudyUI';
import { useAuth } from '@/hooks/useAuth';

const themes: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Sáng' }, { id: 'dark', label: 'Tối' },
  { id: 'reading', label: 'Đọc sách' }, { id: 'high-contrast', label: 'Tương phản cao' },
];
const sizes = [{ id: 'small', label: 'Nhỏ' }, { id: 'medium', label: 'Vừa' }, { id: 'large', label: 'Lớn' }] as const;

export function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const { user, signOut } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    resetAllData();
    window.location.reload();
  };
  return <div className="study-page">
    <PageHeading eyebrow="CÁ NHÂN" title="Cài đặt" subtitle="Chỉnh cách đọc và học phù hợp với bạn" />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <div className="space-y-6">
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Tài khoản</h2>
          <p className="study-copy mt-1">{user?.displayName} · {user?.email}</p>
          <button className="study-button mt-4" onClick={() => void signOut()}>Đăng xuất</button>
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Giao diện</h2>
          <p className="study-copy mt-1">Chọn màu nền và độ tương phản.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{themes.map(theme => <button key={theme.id} aria-pressed={settings.theme === theme.id}
            className={'study-button min-h-11 ' + (settings.theme === theme.id ? 'study-button-primary' : '')}
            onClick={() => updateSettings({ theme: theme.id })}>{theme.label}</button>)}</div>
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Cỡ chữ</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">{sizes.map(size => <button key={size.id} aria-pressed={settings.fontSize === size.id}
            className={'study-button min-h-11 ' + (settings.fontSize === size.id ? 'study-button-primary' : '')}
            onClick={() => updateSettings({ fontSize: size.id })}>{size.label}</button>)}</div>
        </section>
        <section className="study-panel">
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Khi học</h2>
          <SettingToggle label="Hiện Furigana" detail="Hiện cách đọc hiragana khi học" checked={settings.showFurigana} onChange={value => updateSettings({ showFurigana: value })}/>
          <SettingToggle label="Giảm chuyển động" detail="Giảm hiệu ứng chuyển cảnh" checked={settings.reducedMotion} onChange={value => updateSettings({ reducedMotion: value })}/>
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Thời gian phiên Anki</h2>
          <p className="study-copy mt-1">Chỉ tính thời gian tab đang hoạt động. Khi hết giờ, bạn hoàn tất thẻ hiện tại rồi phiên sẽ kết thúc.</p>
          <label className="mt-4 block text-sm font-semibold text-[var(--color-text)]">
            Giới hạn tổng (phút)
            <input type="number" min={0} max={180} step={1} className="study-input mt-2" value={settings.ankiSessionMinutes}
              onChange={event => updateSettings({ ankiSessionMinutes: Math.min(180, Math.max(0, Number(event.target.value) || 0)) })}/>
          </label>
          <p className="study-copy mt-2">Nhập 0 để học không giới hạn. Tối đa 180 phút mỗi phiên.</p>
          <div className="mt-3 flex flex-wrap gap-2">{[0, 10, 20, 30, 45, 60].map(minutes => <button key={minutes} className={'study-button ' + (settings.ankiSessionMinutes === minutes ? 'study-button-primary' : '')} onClick={() => updateSettings({ ankiSessionMinutes: minutes })}>{minutes === 0 ? 'Không giới hạn' : `${minutes}m`}</button>)}</div>
        </section>
        <section className="study-panel">
          <div className="flex items-center gap-2 text-[var(--color-error)]"><AlertTriangle size={18}/><h2 className="text-base font-semibold">Xóa tiến độ</h2></div>
          <p className="study-copy mt-2">Xóa lịch ôn SRS, hoạt động học và mục đã lưu trên trình duyệt này. Không thể khôi phục sau khi xóa.</p>
          <button className="study-button mt-4 border-[var(--color-error)] text-[var(--color-error)]" onClick={handleReset}>
            {confirmReset ? 'Xác nhận xóa toàn bộ dữ liệu' : 'Xóa dữ liệu học'}
          </button>
          {confirmReset && <button className="study-button ml-2 mt-4" onClick={() => setConfirmReset(false)}>Hủy</button>}
        </section>
      </div>
      <section className="study-panel lg:sticky lg:top-20">
        <p className="study-eyebrow">XEM TRƯỚC</p>
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center">
          {settings.showFurigana && <p className="font-jp text-sm text-[var(--color-text-secondary)]">じゅんび</p>}
          <p className="font-jp-serif mt-2 text-5xl text-[var(--color-text)]">準備</p>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">sự chuẩn bị</p>
        </div>
        <p className="study-copy mt-4">Cài đặt và các bộ thẻ Anki được đồng bộ với tài khoản của bạn.</p>
      </section>
    </div>
  </div>;
}

function SettingToggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] py-4">
    <div><p className="text-sm font-semibold text-[var(--color-text)]">{label}</p><p className="study-copy mt-1">{detail}</p></div>
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={'relative h-7 w-12 shrink-0 rounded-full transition-colors focus-ring ' + (checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')}>
      <span className={'absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ' + (checked ? 'translate-x-5' : '')}/>
    </button>
  </div>;
}
