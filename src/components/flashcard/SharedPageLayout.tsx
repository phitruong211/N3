import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Download } from 'lucide-react';
import type { useSharedSave } from './useSharedSave';
import { BrandMark } from '@/components/ui/BrandMark';
import './sharing.css';

export function SharedPageLayout({ children }: { children: ReactNode }) {
  return <main className="shared-page"><div className="shared-page-inner">
    <header className="shared-brand"><Link to="/today"><BrandMark size={30} variant="small"/>SỔ NHẬT</Link><span>Cùng nhau học mỗi ngày</span></header>
    {children}
  </div></main>;
}
export function SharedSaveAction({ state, kind, disabled }: { state: ReturnType<typeof useSharedSave>; kind: 'deck' | 'group'; disabled?: boolean }) {
  const label = kind === 'group' ? 'Lưu cả nhóm' : 'Lưu bộ thẻ';
  return <div className="shared-save-bar" aria-label={kind === 'group' ? 'Lưu nhóm thẻ' : 'Lưu bộ thẻ'}>
    {state.saved ? <>
      <span className="shared-save-caption" role="status"><Check size={14}/>{state.saved.alreadySaved ? 'Đã có trong thư viện' : 'Đã lưu vào thư viện'}</span>
      <Link className="study-button study-button-primary" to={`/decks?${kind === 'group' ? 'group' : 'deck'}=${encodeURIComponent(state.saved.id)}`}>{kind === 'group' ? 'Mở nhóm để học' : 'Mở bộ để học'}<ArrowUpRight size={17}/></Link>
    </> : <>
      <span className="shared-save-caption">{state.guest ? 'Cần đăng nhập · Bản riêng của bạn' : 'Bản riêng · Tiến độ riêng'}</span>
      <button type="button" className="study-button study-button-primary" disabled={disabled || state.busy || state.authLoading} onClick={() => void state.save()}><Download size={17}/>{state.busy ? 'Đang lưu…' : state.authLoading ? 'Đang kết nối…' : label}</button>
    </>}
  </div>;
}
export function SharedError({ error, unavailable, retry }: { error: string; unavailable?: boolean; retry: () => void }) {
  return <div className="shared-error" role="alert"><h2>{unavailable ? 'Liên kết không còn khả dụng' : 'Chưa thể hoàn tất'}</h2><p>{error}</p>{unavailable ? <p>Hãy nhờ người chia sẻ gửi một liên kết mới.</p> : <button type="button" className="study-button" onClick={retry}>Thử lại</button>}</div>;
}
