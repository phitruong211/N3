import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useLearningStorage } from '@/hooks/useApp';
import type { ThemeMode } from '@/types';
import { PageHeading } from '@/components/ui/StudyUI';
import { useAuth } from '@/hooks/useAuth';
import { AccountLearningStatus } from '@/components/auth/AccountLearningStatus';

const themes: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Sáng' }, { id: 'dark', label: 'Tối' },
  { id: 'reading', label: 'Đọc sách' }, { id: 'high-contrast', label: 'Tương phản cao' },
];
const sizes = [{ id: 'small', label: 'Nhỏ' }, { id: 'medium', label: 'Vừa' }, { id: 'large', label: 'Lớn' }] as const;

export function SettingsPage() {
  const { resetAllData } = useLearningStorage();
  const { settings, updateSettings, settingsSync } = useApp();
  const { user, signOut, requestAuth } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const [srsError, setSrsError] = useState('');
  const changeAgain = (value: number) => {
    const next = Math.min(30, Math.max(1, Math.round(value || 1)));
    if (next >= settings.srsGoodMinutes) { setSrsError('Thời gian kiểm tra lại phải lớn hơn thời gian học lại.'); return; }
    setSrsError(''); updateSettings({ srsAgainMinutes: next });
  };
  const changeGood = (value: number) => {
    const next = Math.min(720, Math.max(2, Math.round(value || 2)));
    if (next <= settings.srsAgainMinutes) { setSrsError('Thời gian kiểm tra lại phải lớn hơn thời gian học lại.'); return; }
    setSrsError(''); updateSettings({ srsGoodMinutes: next });
  };
  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    if (resetAllData()) window.location.reload();
  };
  return <div className="study-page">
    <PageHeading eyebrow="CÁ NHÂN" title="Cài đặt" subtitle="Chỉnh cách đọc và học phù hợp với bạn" />
    {user && <div role="status" className="study-copy">{settingsSync.pending ? "Đang đồng bộ cài đặt…" : settingsSync.error ? <><span role="alert">{settingsSync.error} Cài đặt vẫn được giữ trên thiết bị.</span> <button className="study-button" onClick={()=>void settingsSync.retry()}>Thử lưu lại</button></> : "Cài đặt đã đồng bộ"}</div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <div className="space-y-6">
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Tài khoản</h2>
          <p className="study-copy mt-1">{user ? `${user.displayName} · ${user.email}` : 'Bạn đang học thử trên thiết bị này.'}</p>
          <button className="study-button mt-4" onClick={() => user ? void signOut() : requestAuth()}>{user ? 'Đăng xuất' : 'Đăng nhập / Đăng ký'}</button>
          {user && <div className="mt-5 border-t border-[var(--color-border)] pt-4"><AccountLearningStatus /></div>}
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Giao diện</h2>
          <p className="study-copy mt-1">Chọn màu nền và độ tương phản.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{themes.map(theme => <button key={theme.id} aria-pressed={settings.theme === theme.id}
            className={'study-button min-h-11 ' + (settings.theme === theme.id ? 'study-button-primary' : '')}
            onClick={() => updateSettings({ theme: theme.id })}>{theme.label}</button>)}</div>
          <SettingToggle label="Giảm chuyển động" detail="Giảm hiệu ứng chuyển cảnh và lật thẻ" checked={settings.reducedMotion} onChange={value => updateSettings({ reducedMotion: value })}/>
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Cỡ chữ giao diện</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">{sizes.map(size => <button key={size.id} aria-pressed={settings.fontSize === size.id}
            className={'study-button min-h-11 ' + (settings.fontSize === size.id ? 'study-button-primary' : '')}
            onClick={() => updateSettings({ fontSize: size.id })}>{size.label}</button>)}</div>
        </section>
        <section className="study-panel">
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text)]">Khi học</h2>
          <SettingToggle label="Hiện furigana mặt trước" detail="Hiện hiragana trên Kanji trước khi lật thẻ" checked={settings.showFuriganaFront} onChange={value => updateSettings({ showFuriganaFront: value })}/>
          <SettingToggle label="Hiện furigana mặt sau" detail="Hiện hiragana trên Kanji sau khi lật thẻ" checked={settings.showFuriganaBack} onChange={value => updateSettings({ showFuriganaBack: value })}/>
          <SettingToggle label="Tự phát âm" detail="Đọc thẻ khi bắt đầu học nếu trình duyệt hỗ trợ" checked={settings.autoPlayAudio} onChange={value=>updateSettings({autoPlayAudio:value})}/>
          <label className="block py-3">Mục tiêu mỗi ngày (thẻ)<input className="study-input" type="number" min={1} max={1000} value={settings.dailyGoal} onChange={e=>updateSettings({dailyGoal:Math.max(1,Math.min(1000,Math.round(Number(e.target.value)||1)))})}/></label>
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Ôn ngắt quãng</h2>
          <p className="study-copy mt-1">Nếu không nhớ đáp án, hãy chọn Quên; Khó chỉ dùng khi bạn vẫn nhớ nhưng phải suy nghĩ nhiều.</p>
          <label className="mt-4 block text-sm font-semibold">Thẻ mới mỗi ngày
            <span className="study-copy mt-1 block">Nhập mọi số nguyên từ 0 trở lên. 0 nghĩa là chỉ ôn thẻ đang học và đến hạn.</span>
            <input className="study-input mt-2" aria-label="Thẻ mới mỗi ngày" type="number" min={0} step={1}
              value={settings.srsDailyNewLimit}
              onChange={event => updateSettings({ srsDailyNewLimit: Math.min(2_147_483_647, Math.max(0, Math.round(Number(event.target.value) || 0))) })}/>
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Học lại khi quên
              <span className="study-copy mt-1 block">Số phút trước khi thẻ quay lại</span>
              <input className="study-input mt-2" aria-label="Học lại khi quên" type="number" min={1} max={30} value={settings.srsAgainMinutes} onChange={event => changeAgain(Number(event.target.value))}/>
            </label>
            <label className="text-sm font-semibold">Kiểm tra lại khi vừa nhớ
              <span className="study-copy mt-1 block">Bước nhớ đầu tiên, tính bằng phút</span>
              <input className="study-input mt-2" aria-label="Kiểm tra lại khi vừa nhớ" type="number" min={2} max={720} value={settings.srsGoodMinutes} onChange={event => changeGood(Number(event.target.value))}/>
            </label>
          </div>
          {srsError && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{srsError}</p>}
          <p className="mt-5 text-sm font-semibold">Mức ghi nhớ mục tiêu</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {([{ value: 0.9, label: 'Cân bằng · 90%' }, { value: 0.93, label: 'Ghi nhớ cao · 93%' }, { value: 0.95, label: 'Ôn kỹ · 95%' }] as const).map(option =>
              <button key={option.value} className={'study-button ' + (settings.srsDesiredRetention === option.value ? 'study-button-primary' : '')} aria-pressed={settings.srsDesiredRetention === option.value} onClick={() => updateSettings({ srsDesiredRetention: option.value })}>{option.label}</button>)}
          </div>
          <button className="study-button mt-4" onClick={() => { setSrsError(''); updateSettings({ srsDailyNewLimit: 20, srsAgainMinutes: 1, srsGoodMinutes: 10, srsDesiredRetention: 0.9 }); }}>Khôi phục mặc định</button>
        </section>
        <details className="study-panel">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[var(--color-error)]"><AlertTriangle size={18}/><span className="text-base font-semibold">Vùng nguy hiểm</span></summary>
          <h2 className="mt-4 text-base font-semibold">Xóa dữ liệu trên thiết bị</h2>
          <p className="study-copy mt-2">Xóa lịch ôn, hoạt động học, mục đã lưu, dữ liệu nghe và cài đặt trên thiết bị của phiên hiện tại. Tiến độ đã đồng bộ sẽ được tải lại từ tài khoản. Không xóa dữ liệu của tài khoản khác, dữ liệu Guest khi đang đăng nhập hoặc bộ thẻ trên máy chủ.</p>
          <button className="study-button mt-4 border-[var(--color-error)] text-[var(--color-error)]" onClick={handleReset}>
            {confirmReset ? 'Xác nhận xóa toàn bộ dữ liệu' : 'Xóa dữ liệu học'}
          </button>
          {confirmReset && <button className="study-button ml-2 mt-4" onClick={() => setConfirmReset(false)}>Hủy</button>}
        </details>
      </div>
      <section className="study-panel lg:sticky lg:top-20">
        <p className="study-eyebrow">XEM TRƯỚC</p>
        <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center">
          <p className="study-eyebrow mb-2">Mặt trước</p>
          {settings.showFuriganaFront && <p className="font-jp text-sm text-[var(--color-text-secondary)]">じゅんび</p>}
          <p className="font-jp-serif mt-2 text-5xl text-[var(--color-text)]">準備</p>
          <div className="mt-5 border-t border-[var(--color-border)] pt-4">
            <p className="study-eyebrow mb-2">Mặt sau</p>
            {settings.showFuriganaBack && <p className="font-jp text-sm text-[var(--color-text-secondary)]">じゅんび</p>}
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">sự chuẩn bị</p>
          </div>
        </div>
        <p className="study-copy mt-4">{user ? 'Cài đặt, bộ thẻ, dấu trang và tiến độ ôn được đồng bộ với tài khoản. Lịch sử nghe vẫn lưu trên thiết bị.' : 'Cài đặt và tiến độ học thử chỉ lưu trên thiết bị này, chưa đồng bộ vào tài khoản.'}</p>
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
