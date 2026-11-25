import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { GoogleButton, googleEnabled } from './GoogleButton';

/** Settings row: link Google to the signed-in account so later sign-ins can use it. */
export function GoogleLink() {
  const { user, linkGoogleAccount } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (!user || !googleEnabled) return null;
  if (user.googleLinked) return <p className="study-copy mt-4">✓ Đã liên kết Google — bạn có thể đăng nhập bằng Google.</p>;
  async function link(idToken: string) {
    setBusy(true); setMessage(null);
    try { await linkGoogleAccount(idToken); setMessage({ ok: true, text: 'Đã liên kết Google.' }); }
    catch (reason) { setMessage({ ok: false, text: reason instanceof Error ? reason.message : 'Không thể liên kết Google.' }); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 border-t border-[var(--color-border)] pt-4">
    <h3 className="text-sm font-semibold">Liên kết Google</h3>
    <p className="study-copy mt-1 mb-3">Liên kết để lần sau đăng nhập bằng Google thay cho mật khẩu.</p>
    <div className="max-w-xs"><GoogleButton disabled={busy} text="continue_with" onCredential={idToken => void link(idToken)}/></div>
    {message && <p role={message.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${message.ok ? '' : 'text-[var(--color-error)]'}`}>{message.text}</p>}
  </div>;
}
