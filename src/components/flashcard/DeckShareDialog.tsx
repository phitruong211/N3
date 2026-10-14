import { useEffect, useRef, useState } from 'react';
import { Copy, Share2, Link2, Link2Off } from 'lucide-react';
import { AppDialog } from '@/components/ui/AppDialog';
import { enableShare, revokeShare, shareStatus, shareUrl, groupShareStatus, enableGroupShare, revokeGroupShare, groupShareUrl, type GroupShareLink } from '@/lib/deckSharing';
import './sharing.css';

type Props = { deck: { id: string; name: string; cardCount?: number }; kind?: 'deck' | 'group'; onClose: () => void };
export function DeckShareDialog({ deck, kind = 'deck', onClose }: Props) {
  const group = kind === 'group';
  const [token, setToken] = useState<string | null>(null);
  const [counts, setCounts] = useState<GroupShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const url = token ? (group ? groupShareUrl(token) : shareUrl(token)) : '';
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let valid = true;
    setLoading(true); setError('');
    (group ? groupShareStatus(deck.id) : shareStatus(deck.id)).then(result => {
      if (valid) { setToken(result.token); if ('deckCount' in result) setCounts(result as GroupShareLink); }
    }).catch(e => { if (valid) setError(e.message); }).finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [deck.id, group, attempt]);
  async function changeSharing(revoke = false) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      if (revoke) {
        await (group ? revokeGroupShare(deck.id) : revokeShare(deck.id));
        if (alive.current) { setToken(null); setConfirmRevoke(false); setNotice('Đã tắt liên kết. Bản người nhận đã lưu vẫn được giữ.'); }
      } else {
        const result = await (group ? enableGroupShare(deck.id) : enableShare(deck.id));
        if (alive.current) { setToken(result.token); if ('deckCount' in result) setCounts(result as GroupShareLink); setNotice('Liên kết đã sẵn sàng.'); }
      }
    } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); if (alive.current) setNotice('Đã sao chép liên kết.'); }
    catch { input.current?.focus(); input.current?.select(); if (alive.current) setNotice('Hãy sao chép liên kết trong ô bên trên.'); }
  }
  async function nativeShare() {
    if (!url) return;
    try { await navigator.share({ title: deck.name, text: `Cùng học ${group ? 'nhóm' : 'bộ thẻ'} ${deck.name} trên SỔ NHẬT`, url }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(); }
  }
  return <AppDialog open title={group ? 'Chia sẻ nhóm' : 'Chia sẻ bộ thẻ'} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-5" aria-busy={busy || loading}>
      <div><h3 className="text-lg font-semibold break-words">{deck.name}</h3>
        {group && counts ? <p className="study-copy mt-1 text-sm">{counts.deckCount.toLocaleString('vi-VN')} bộ import · {counts.cardCount.toLocaleString('vi-VN')} thẻ</p> : deck.cardCount !== undefined && !group && <p className="study-copy mt-1 text-sm">{deck.cardCount.toLocaleString('vi-VN')} thẻ</p>}
        <p className="study-copy mt-3 text-sm">Ai có liên kết có thể học thử và lưu {group ? 'cả nhóm' : 'bộ thẻ'} thành bản riêng.</p>
        {group && Boolean(counts?.excludedDeckCount) && <p className="study-copy mt-2 text-xs">{counts!.excludedDeckCount} bộ tạo thủ công không được chia sẻ.</p>}
      </div>
      {loading ? <p role="status" className="study-copy text-sm">Đang kiểm tra liên kết…</p> : token ? <>
        <label htmlFor="share-link" className="sr-only">Liên kết chia sẻ</label>
        <div className="share-link-box"><input id="share-link" ref={input} readOnly value={url} onFocus={e => e.target.select()}/><button type="button" className="study-button study-button-primary" onClick={() => void copy()}><Copy size={16}/>Sao chép</button></div>
        {typeof navigator.share === 'function' && <button type="button" className="study-button w-full justify-center" onClick={() => void nativeShare()}><Share2 size={16}/>Gửi liên kết</button>}
      </> : !error && <div>{group && counts?.deckCount === 0 ? <p className="study-copy text-sm">Nhóm chưa có bộ import để chia sẻ.</p> : <button type="button" className="study-button study-button-primary w-full justify-center" disabled={busy} onClick={() => void changeSharing()}><Link2 size={16}/>{busy ? 'Đang tạo…' : 'Tạo liên kết'}</button>}</div>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-[var(--color-error)]">{error}</p><button type="button" className="study-button" disabled={busy} onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>}
      {notice && <p role="status" className="study-copy text-xs">{notice}</p>}
      <details className="share-options"><summary>Tùy chọn chia sẻ</summary>
        <p>Nội dung, ghi chú, giao diện và tên hiển thị của bạn được chia sẻ. Lịch ôn luôn riêng. Liên kết hiển thị nội dung hiện tại; các bản đã nhận không tự cập nhật.</p>
        {token && (confirmRevoke ? <div className="space-y-3"><p>Tắt liên kết này? Người nhận sẽ không thể xem hoặc lưu thêm. Chia sẻ lại sẽ tạo liên kết mới.</p><div className="flex flex-wrap gap-2"><button type="button" className="study-button" disabled={busy} onClick={() => void changeSharing(true)}>{busy ? 'Đang tắt…' : 'Tắt liên kết'}</button><button type="button" className="study-button" disabled={busy} onClick={() => setConfirmRevoke(false)}>Giữ liên kết</button></div></div> : <button type="button" className="study-button" disabled={busy} onClick={() => setConfirmRevoke(true)}><Link2Off size={16}/>Ngừng chia sẻ</button>)}
      </details>
    </div>
  </AppDialog>;
}
