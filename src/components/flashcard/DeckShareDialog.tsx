import { useEffect, useRef, useState } from 'react';
import { Copy, Share2, Link2, Link2Off } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { enableShare, revokeShare, shareStatus, shareUrl } from '@/lib/deckSharing';

export function DeckShareDialog({ deck, onClose }: { deck: { id: string; name: string }; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const locked = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let valid = true;
    setLoading(true); setError('');
    shareStatus(deck.id).then(result => { if (valid) setToken(result.token); })
      .catch(e => { if (valid) setError(e.message); }).finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [deck.id, attempt]);

  async function changeSharing(revoke = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (revoke) { await revokeShare(deck.id); setToken(null); setConfirmRevoke(false); setNotice('Đã tắt liên kết. Các bản người nhận đã lưu vẫn được giữ.'); }
      else { const result = await enableShare(deck.id); setToken(result.token); setNotice('Liên kết đã sẵn sàng. Sao chép để gửi cho bạn bè.'); }
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function copy() {
    if (!token) return;
    try { await navigator.clipboard.writeText(shareUrl(token)); setNotice('Đã sao chép liên kết.'); }
    catch { input.current?.focus(); input.current?.select(); setNotice('Hãy sao chép liên kết trong ô bên trên.'); }
  }
  async function nativeShare() {
    if (!token) return;
    try { await navigator.share({ title: deck.name, text: `Cùng học bộ thẻ ${deck.name} trên SỔ NHẬT`, url: shareUrl(token) }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(); }
  }
  return <AppDialog open title="Chia sẻ bộ thẻ" onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4" aria-busy={busy || loading}>
      <div><h3 className="text-lg font-semibold break-words">{deck.name}</h3><p className="study-copy mt-2">Ai có liên kết đều có thể xem trước và lưu bộ thẻ thành bản riêng. Nội dung thẻ, ghi chú, giao diện và tên hiển thị của bạn được chia sẻ; lịch ôn của bạn được giữ riêng.</p></div>
      {loading ? <p role="status">Đang kiểm tra liên kết…</p> : token ? <>
        <p className="text-sm font-medium text-[var(--color-accent)] flex items-center gap-2"><Link2 size={16}/>Đang chia sẻ bằng liên kết</p>
        <label className="block text-sm font-medium">Liên kết chia sẻ<input ref={input} readOnly className="study-input mt-2" value={shareUrl(token)} onFocus={e => e.target.select()}/></label>
        <div className="flex flex-wrap gap-2"><button className="study-button study-button-primary" onClick={() => void copy()}><Copy size={16}/>Sao chép liên kết</button>{typeof navigator.share === 'function' && <button className="study-button" onClick={() => void nativeShare()}><Share2 size={16}/>Gửi liên kết</button>}</div>
        <p className="study-copy text-xs">Liên kết hiển thị nội dung hiện tại. Thay đổi sau này không cập nhật các bản người nhận đã lưu.</p>
        {confirmRevoke ? <div className="rounded-xl border border-[var(--color-border)] p-3 space-y-3"><p className="text-sm">Tắt liên kết này? Người nhận sẽ không thể xem hoặc lưu thêm. Khi chia sẻ lại, bạn sẽ nhận một liên kết mới.</p><div className="flex gap-2"><button className="study-button" disabled={busy} onClick={() => void changeSharing(true)}>{busy ? 'Đang tắt…' : 'Tắt liên kết'}</button><button className="study-button" disabled={busy} onClick={() => setConfirmRevoke(false)}>Giữ liên kết</button></div></div> : <button className="study-button" disabled={busy} onClick={() => setConfirmRevoke(true)}><Link2Off size={16}/>Ngừng chia sẻ</button>}
      </> : !error && <button className="study-button study-button-primary" disabled={busy} onClick={() => void changeSharing()}><Link2 size={16}/>{busy ? 'Đang tạo…' : 'Tạo liên kết chia sẻ'}</button>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-[var(--color-error)]">{error}</p><button className="study-button" disabled={busy} onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>}
      {notice && <p role="status" className="study-copy">{notice}</p>}
    </div>
  </AppDialog>;
}
