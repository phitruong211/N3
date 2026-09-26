import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasLegacyLearningData } from '@/lib/storage';
import { AccountLearningStatus } from './AccountLearningStatus';
import { AuthPage } from './AuthPage';

export function AuthDialog() {
  const { prompt, setPrompt } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const open = Boolean(prompt);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, [open]);
  useEffect(() => { dialog.current?.querySelector<HTMLElement>('input, button')?.focus(); }, [prompt]);
  if (!prompt) return null;
  return <dialog ref={dialog} className="guest-auth-dialog" aria-labelledby="guest-auth-title"
    onKeyDown={event => event.stopPropagation()}
    onCancel={event => { event.preventDefault(); setPrompt(null); }}>
    <h2 id="guest-auth-title" className="text-xl font-semibold">Đăng nhập để lưu và đồng bộ bộ thẻ của bạn</h2>
    {prompt === 'choice' ? <div className="space-y-5 mt-4">
      <p className="study-copy">Thao tác của bạn vẫn được giữ lại. Sau khi đăng nhập, bạn có thể kiểm tra và xác nhận tiếp.</p>
      <div className="flex flex-wrap gap-3">
        <button className="study-button study-button-primary" onClick={() => setPrompt('login')}>Đăng nhập</button>
        <button className="study-button" onClick={() => setPrompt('register')}>Đăng ký</button>
        <button className="study-button" onClick={() => setPrompt(null)}>Tiếp tục học thử</button>
      </div>
    </div> : <AuthPage key={prompt} initialMode={prompt} compact />}
  </dialog>;
}

export function SessionNotices() {
  const { mode, requestAuth, restoreError } = useAuth();
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const failed = () => setStorageError(true);
    window.addEventListener('learning-storage-error', failed);
    return () => window.removeEventListener('learning-storage-error', failed);
  }, []);
  return <div className="space-y-3 mb-5">
    {mode === 'guest' && <div className="study-panel flex flex-wrap items-center justify-between gap-3 !p-4">
      <p className="study-copy"><strong>Đang học thử.</strong> Tiến độ được lưu trên trình duyệt này, chưa đồng bộ nhiều thiết bị.</p>
      <button className="study-button" onClick={requestAuth}>Đăng nhập / Đăng ký</button>
    </div>}
    <AccountLearningStatus />
    {hasLegacyLearningData() && <p className="study-copy" role="note">Dữ liệu học phiên bản cũ vẫn được giữ trên thiết bị. Vì chưa xác định được chủ sở hữu, dữ liệu này chưa tự chuyển vào Guest hoặc tài khoản.</p>}
    {storageError && <p role="alert" className="text-[var(--color-error)]">Không lưu được dữ liệu trên thiết bị. Hãy kiểm tra dung lượng trình duyệt; thay đổi vừa rồi có thể chưa được lưu.</p>}
    {restoreError && <p role="alert" className="study-copy">{restoreError}</p>}
  </div>;
}
