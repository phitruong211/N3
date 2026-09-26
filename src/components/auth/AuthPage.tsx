import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle, BookOpen, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import './auth.css';

export function AuthPage({ initialMode = 'login', compact = false }: { initialMode?: 'login' | 'register'; compact?: boolean }) {
  const { signIn, signUp, enterGuest, setPrompt } = useAuth();
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không thể kết nối máy chủ.'); }
    finally { setBusy(false); }
  }

  return <main className={compact ? "auth-page auth-page-compact" : "auth-page"}>
    {!compact && <section className="auth-story" aria-label="Học tiếng Nhật mỗi ngày">
      <div className="auth-brand"><span lang="ja">学</span><div>N3 学習<small>TIẾNG NHẬT · MỖI NGÀY</small></div></div>
      <div className="auth-editorial"><p className="auth-eyebrow">MỘT CHÚT MỖI NGÀY</p><h1>Những bước nhỏ.<br/><em>Một hành trình lớn.</em></h1><p className="auth-description">Từ những từ vựng đầu tiên đến một thế giới mới.<br/>Tiếp tục hành trình tiếng Nhật theo nhịp của bạn.</p>
        <div className="auth-art"><div className="auth-orbit" aria-hidden="true"/><div className="auth-card"><div className="auth-card-label"><span>TỪ VỰNG HÔM NAY</span><span>01 / 一</span></div><p className="auth-kanji" lang="ja">一歩</p><p className="auth-reading" lang="ja">いっぽ <span>· ippo</span></p><div className="auth-card-footer">Một bước chân.<ArrowRight size={20} aria-hidden="true"/></div><span className="auth-stamp" lang="ja" aria-hidden="true">日々</span></div><span className="auth-caption" lang="ja" aria-hidden="true">千里の道も一歩から</span></div>
      </div>
      <div className="auth-story-footer"><span>Học chậm mà chắc. Nhớ lâu hơn.</span><span lang="ja">一日一歩。</span></div>
    </section>}
    <section className="auth-form-side" aria-label="Tài khoản">
    <div className="auth-welcome">KHÔNG GIAN HỌC TẬP CỦA BẠN <span>✳</span></div>
    <div className="auth-form-wrap">
      <div className="auth-heading"><p className="auth-eyebrow">{mode === 'login' ? 'RẤT VUI ĐƯỢC GẶP LẠI BẠN' : 'MỘT KHỞI ĐẦU MỚI'}</p><h2>{mode === 'login' ? 'Chào bạn trở lại.' : 'Bắt đầu hành trình.'}</h2><span className="auth-rule"/><p>{mode === 'login' ? 'Bộ thẻ và lịch ôn đang chờ. Cùng học tiếp nhé.' : 'Tạo không gian học tiếng Nhật của riêng bạn.'}</p></div>
      <div className="auth-tabs"><button disabled={busy} aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); setShowPassword(false); }}><LogIn size={16}/>Đăng nhập</button><button disabled={busy} aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(''); setShowPassword(false); }}><UserPlus size={16}/>Đăng ký</button></div>
      <form className="auth-form" onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={busy} className="space-y-5">
        {mode === 'register' && <label className="block text-sm font-semibold">Tên hiển thị<input className="study-input mt-1" required maxLength={100} value={displayName} onChange={e => setDisplayName(e.target.value)}/></label>}
        <label className="block text-sm font-semibold">Email<input className="study-input mt-1" type="email" autoComplete="email" required maxLength={320} value={email} onChange={e => setEmail(e.target.value)}/></label>
        <div><label htmlFor="auth-password" className="block text-sm font-semibold">Mật khẩu</label><div className="auth-password"><input id="auth-password" className="study-input mt-1" placeholder="Nhập mật khẩu của bạn" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} maxLength={72} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{mode === 'register' && <p className="auth-hint">Sử dụng ít nhất 8 ký tự.</p>}</div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? <><LoaderCircle className="auth-spinner" size={19}/>Đang kết nối…</> : <>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}<ArrowRight size={19}/></>}</button>
      </form>
      <button type="button" className="study-button w-full mt-4" disabled={busy && !compact} onClick={() => compact ? setPrompt(null) : enterGuest()}>{compact ? 'Tiếp tục học thử' : 'Khám phá với tư cách khách'}</button>
      <div className="auth-benefits"><BookOpen size={17} aria-hidden="true"/><span>Bộ thẻ cá nhân</span><span aria-hidden="true">·</span><span>Ôn tập theo nhịp của bạn</span></div>
    </div>
    <footer className="auth-bottom"><span>N3 学習</span><span>Mỗi ngày, gần hơn một chút.</span></footer>
    </section>
  </main>;
}
