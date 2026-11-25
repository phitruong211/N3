import { useEffect, useRef, useState } from 'react';

const CLIENT_ID: string = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

type GoogleId = {
  initialize(config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: 'popup' }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
};
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

let scriptPromise: Promise<GoogleId> | null = null;
function loadGoogle(): Promise<GoogleId> {
  scriptPromise ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL; script.async = true;
    script.onload = () => window.google ? resolve(window.google.accounts.id) : reject(new Error('missing google'));
    script.onerror = () => { scriptPromise = null; reject(new Error('load failed')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export const googleEnabled = Boolean(CLIENT_ID);

/** Google's own button; hands the ID token to `onCredential`. Renders nothing without VITE_GOOGLE_CLIENT_ID. */
export function GoogleButton({ onCredential, text = 'continue_with', disabled = false }: { onCredential: (idToken: string) => void; text?: 'continue_with' | 'signin_with' | 'signup_with'; disabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  useEffect(() => { callback.current = onCredential; });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let active = true;
    loadGoogle().then(google => {
      if (!active || !host.current) return;
      // initialize is global; the latest mounted button owns the callback.
      google.initialize({ client_id: CLIENT_ID, ux_mode: 'popup', callback: response => callback.current(response.credential) });
      google.renderButton(host.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text, locale: 'vi', width: Math.min(host.current.clientWidth || 320, 400) });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [text]);

  if (!CLIENT_ID) return null;
  if (failed) return <p className="auth-hint">Không tải được đăng nhập Google. Kiểm tra kết nối mạng rồi tải lại trang.</p>;
  return <div ref={host} className="google-button" aria-disabled={disabled} style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined}/>;
}
