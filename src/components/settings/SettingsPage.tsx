import { useState } from 'react';
import { AlertTriangle } from '@/components/ui/icons';
import { useApp } from '@/hooks/useApp';
import { useLearningStorage } from '@/hooks/useApp';
import type { ThemeMode } from '@/types';
import { PageHeading } from '@/components/ui/StudyUI';
import { useAuth } from '@/hooks/useAuth';
import { AccountLearningStatus } from '@/components/auth/AccountLearningStatus';

// Swatch colours are fixed so each card previews its own theme whichever one is active.
const themes: { id: ThemeMode; label: string; bg: string; surface: string; text: string; accent: string }[] = [
  { id: 'light', label: 'Sáng', bg: '#F4F0E8', surface: '#FAF7F1', text: '#1B1A17', accent: '#2C4A3E' },
  { id: 'dark', label: 'Tối', bg: '#0A0F1E', surface: '#0F1630', text: '#ECE6D8', accent: '#D9C08C' },
  { id: 'reading', label: 'Đọc sách', bg: '#EFE5CF', surface: '#F6EEDC', text: '#3A2F22', accent: '#8A4426' },
  { id: 'high-contrast', label: 'Tương phản cao', bg: '#FFFFFF', surface: '#FFFFFF', text: '#000000', accent: '#003EA8' },
];
const sizes = [{ id: 'small', label: 'Nhỏ' }, { id: 'medium', label: 'Vừa' }, { id: 'large', label: 'Lớn' }] as const;
const dailyNewCardPresets = [0, 10, 20, 50, 100] as const;

export function SettingsPage() {
  const { resetAllData } = useLearningStorage();
  const { settings, updateSettings, settingsSync } = useApp();
  const { user, signOut, requestAuth } = useAuth();
  const [confirmReset, setConfirmReset] = useState(false);
  const [srsError, setSrsError] = useState('');
  const dailyNewLimitStatus = !user
    ? 'Tự động lưu trên thiết bị'
    : settingsSync.pending
      ? 'Đang lưu…'
      : settingsSync.error
        ? 'Chưa đồng bộ'
        : 'Đã lưu';
  const changeDailyNewLimit = (value: number) => {
    const next = Number.isFinite(value) ? Math.round(value) : 0;
    updateSettings({ srsDailyNewLimit: Math.min(2_147_483_647, Math.max(0, next)) });
  };
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
    <PageHeading title="Cài đặt" />
    {user && <div role="status" className="study-copy">{settingsSync.pending ? "Đang đồng bộ cài đặt…" : settingsSync.error ? <><span role="alert">{settingsSync.error} Cài đặt vẫn được giữ trên thiết bị.</span> <button className="study-button" onClick={()=>void settingsSync.retry()}>Thử lưu lại</button></> : "Cài đặt đã đồng bộ"}</div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
      <div className="space-y-6">
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Tài khoản</h2>
          <p className="study-copy mt-1">{user ? `${user.displayName} · ${user.email}` : 'Bạn đang học thử trên thiết bị này.'}</p>
          {user?.role === 'ADMIN' && <p className="mt-1"><a className="underline" href="/admin/reports">Quản trị: báo cáo bộ thẻ</a></p>}
          <button className="study-button mt-4" onClick={() => user ? void signOut() : requestAuth()}>{user ? 'Đăng xuất' : 'Đăng nhập / Đăng ký'}</button>
          {user && <div className="mt-5 border-t border-[var(--color-border)] pt-4"><AccountLearningStatus /></div>}
        </section>
        <section className="study-panel">
          <h2 className="text-base font-semibold text-[var(--color-text)]">Giao diện</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{themes.map(theme => {
            const active = settings.theme === theme.id;
            return <button key={theme.id} aria-pressed={active} onClick={() => updateSettings({ theme: theme.id })}
              className={'group rounded-lg border p-2 text-left transition-[border-color,box-shadow,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 ' + (active ? 'border-[var(--color-gold)] shadow-[0_0_0_1px_var(--color-gold)]' : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]')}>
              <span aria-hidden="true" className="relative block aspect-[16/10] overflow-hidden rounded-md border" style={{ background: theme.bg, borderColor: theme.text + '22' }}>
                <span className="absolute inset-x-2 top-2 h-1.5 w-1/3 rounded-full" style={{ background: theme.text }}/>
                <span className="absolute inset-x-2 top-5 h-1 w-1/2 rounded-full opacity-50" style={{ background: theme.text }}/>
                <span className="absolute inset-x-2 bottom-2 flex h-[38%] items-end justify-between rounded-sm p-1.5" style={{ background: theme.surface, border: `1px solid ${theme.text}1f` }}>
                  <span className="h-1.5 w-1/3 rounded-full" style={{ background: theme.accent }}/>
                  <span className="size-2 rounded-full" style={{ background: theme.accent }}/>
                </span>
              </span>
              <span className="mt-2 block text-sm font-semibold text-[var(--color-text)]">{theme.label}</span>
            </button>;
          })}</div>
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
          <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <label htmlFor="srs-daily-new-limit" className="block text-sm font-semibold text-[var(--color-text)]">Giới hạn thẻ mới mỗi ngày</label>
                <p className="study-copy mt-1">Thẻ đến hạn luôn được ưu tiên trước thẻ mới.</p>
              </div>
              <span role="status" className={'study-pill ' + (settingsSync.error && user ? '!text-[var(--color-error)]' : '')}>{dailyNewLimitStatus}</span>
            </div>

            <div className="relative mt-4">
              <input
                id="srs-daily-new-limit"
                className="study-input !pr-28 text-lg font-semibold"
                aria-describedby="srs-daily-new-limit-help"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={settings.srsDailyNewLimit}
                onChange={event => changeDailyNewLimit(Number(event.target.value))}
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-[var(--color-text-secondary)]">thẻ / ngày</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Chọn nhanh giới hạn thẻ mới">
              <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">Chọn nhanh</span>
              {dailyNewCardPresets.map(value => <button
                key={value}
                type="button"
                aria-pressed={settings.srsDailyNewLimit === value}
                className={'min-h-11 min-w-11 rounded-lg border px-3 text-sm font-semibold transition-colors focus-ring ' + (settings.srsDailyNewLimit === value
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-text-inverse)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]')}
                onClick={() => changeDailyNewLimit(value)}
              >{value === 0 ? 'Chỉ ôn' : value}</button>)}
            </div>

            <p id="srs-daily-new-limit-help" className="mt-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {settings.srsDailyNewLimit === 0
                ? 'Hôm nay hệ thống chỉ đưa thẻ đang học và thẻ đến hạn vào phiên ôn.'
                : `Mỗi ngày hệ thống đưa tối đa ${settings.srsDailyNewLimit.toLocaleString('vi-VN')} thẻ mới vào lịch ôn. Bạn vẫn có thể nhập một số khác.`}
            </p>
          </div>
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
          <summary className="hit flex cursor-pointer list-none items-center gap-2 text-[var(--color-error)]"><AlertTriangle size={18}/><span className="text-base font-semibold">Vùng nguy hiểm</span></summary>
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
      className={'hit relative h-7 w-12 shrink-0 rounded-full transition-colors focus-ring ' + (checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border-strong)]')}>
      <span className={'absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform ' + (checked ? 'translate-x-5' : '')}/>
    </button>
  </div>;
}
