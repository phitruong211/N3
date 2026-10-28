import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LogIn } from '@/components/ui/icons';
import { BrandMark } from '@/components/ui/BrandMark';
import { Seal } from '@/components/ui/Seal';
import { useAuth } from '@/hooks/useAuth';
import './auth.css';
import { useLocation, useNavigate } from 'react-router-dom';

export function AuthPage({ initialMode = 'login', compact = false }: { initialMode?: 'login' | 'register'; compact?: boolean }) {
  const { signIn, signUp, enterGuest, setPrompt } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password, displayName);
      setPrompt(null);
      if (!compact || (!/^\/shared\/(?:groups\/)?[^/]+\/?$/.test(location.pathname) && !/^\/dictionary(?:\/|$)/.test(location.pathname))) navigate('/today', { replace: true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết nối máy chủ.'); }
    finally { setBusy(false); }
  }

  return <main className={compact ? "auth-page auth-page-compact" : "auth-page"}>
    {!compact && <section className="auth-story" aria-label="Học tiếng Nhật mỗi ngày">
      <img className="auth-photo" src="/landing/photos/1280-20181110_fushimi_inari_torii_12.jpg" alt="" referrerPolicy="no-referrer" decoding="async"/>
      <a className="auth-brand" href="/welcome.html" aria-label="SỔ NHẬT, về trang giới thiệu"><BrandMark size={46}/><div>SỔ NHẬT<small>HỌC TIẾNG NHẬT MỖI NGÀY</small></div></a>
      <div className="auth-editorial"><p className="auth-eyebrow">MỘT CHÚT MỖI NGÀY</p><h1>Những bước nhỏ.<br/><em>Một hành trình lớn.</em></h1><p className="auth-description">Từ những từ vựng đầu tiên đến một thế giới mới.<br/>Tiếp tục hành trình tiếng Nhật theo nhịp của bạn.</p></div>
      <p className="auth-bigkanji" lang="ja" aria-hidden="true">歩</p>
      <div className="auth-story-footer"><span>Fushimi Inari, Kyōto — ảnh Balon Greyjoy, CC0</span><span lang="ja">一日一歩。</span></div>
    </section>}
    <section className="auth-form-side" aria-label="Tài khoản">
    <div className="auth-welcome">KHÔNG GIAN HỌC TẬP CỦA BẠN <span>✳</span></div>
    <div className="auth-form-wrap">
      <div className="auth-heading"><p className="auth-eyebrow">{mode === 'login' ? 'RẤT VUI ĐƯỢC GẶP LẠI BẠN' : 'MỘT KHỞI ĐẦU MỚI'}</p><h2>{mode === 'login' ? 'Chào bạn trở lại.' : 'Bắt đầu hành trình.'}</h2><span className="auth-rule"/><p>{mode === 'login' ? 'Bộ thẻ và lịch ôn đang chờ. Cùng học tiếp nhé.' : 'Tạo không gian học tiếng Nhật của riêng bạn.'}</p></div>
      <div className="auth-tabs"><button disabled={busy} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); setShowPassword(false); }}><LogIn size={16}/>Đăng nhập</button><button disabled={busy} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); setShowPassword(false); }}>Đăng ký</button></div>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-5">
        {mode === 'register' && <label className="block text-sm font-semibold">Tên hiển thị<input className="study-input mt-1" required maxLength={100} value={displayName} onChange={e => setDisplayName(e.target.value)}/></label>}
        <label className="block text-sm font-semibold">Email<input className="study-input mt-1" type="email" autoComplete="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)}/></label>
        <div><label htmlFor="auth-password" className="block text-sm font-semibold">Mật khẩu</label><div className="auth-password"><input id="auth-password" className="study-input mt-1" placeholder="Nhập mật khẩu của bạn" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{mode === 'register' && <p className="auth-hint">Sử dụng ít nhất 8 ký tự.</p>}</div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={19}/>Đang kết nối…</> : <>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}<ArrowRight size={19}/></>}</button>
      </form>
      <button type="button" className="study-button w-full mt-4" disabled={busy && !compact} onClick={() => {
        if (compact) setPrompt(null);
        else { enterGuest(); navigate('/today', { replace: true }); }
      }}>{compact ? 'Tiếp tục học thử' : 'Học thử'}</button>
      <div className="auth-benefits"><Seal glyph="札" size="xs"/><span>Bộ thẻ cá nhân</span><span aria-hidden="true">·</span><span>Ôn tập theo nhịp của bạn</span></div>
    </div>
    <footer className="auth-bottom"><span>SỔ NHẬT</span><span>Bước nhỏ, hành trình lớn.</span></footer>
    </section>
  </main>;
}
