import { useEffect, useRef, useState } from 'react';
import { Copy, Share2, Link2, Link2Off } from '@/components/ui/icons';
import { AppDialog } from '@/components/ui/AppDialog';
import {
  enableShare, revokeShare, shareStatus, shareUrl, touchShare, publishDeck,
  groupShareStatus, enableGroupShare, revokeGroupShare, groupShareUrl, touchGroupShare, shortUrl,
  type GroupShareLink, type LibraryState, type ShareExpiry, type ShareLink,
} from '@/lib/deckSharing';
import './sharing.css';
import { useApp } from '@/hooks/useApp';
import { ShareQr } from './ShareQr';

type Props = { deck: { id: string; name: string; cardCount?: number; description?: string | null }; kind?: 'deck' | 'group'; onClose: () => void };
type ExpiryChoice = 'keep' | 'never' | '1' | '7' | '30';
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];
const toExpiry = (choice: ExpiryChoice): ShareExpiry => choice === 'keep' ? 'keep' : choice === 'never' ? null : Number(choice);
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

export function DeckShareDialog({ deck, kind = 'deck', onClose }: Props) {
  const { cardNotes } = useApp();
  const group = kind === 'group';
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [counts, setCounts] = useState<GroupShareLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [includePersonalNotes, setIncludePersonalNotes] = useState(false);
  const [savedPersonalNotes, setSavedPersonalNotes] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>('keep');
  const [showQr, setShowQr] = useState(false);
  const [level, setLevel] = useState('');
  const [description, setDescription] = useState(deck.description ?? '');
  const locked = useRef(false);
  const alive = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const url = token ? (group ? groupShareUrl(token) : shareUrl(token)) : '';
  const expired = Boolean(expiresAt && Date.parse(expiresAt) <= Date.now());
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  function apply(result: ShareLink | GroupShareLink) {
    setToken(result.token); setCode(result.code ?? null); setExpiresAt(result.expiresAt ?? null);
    setIncludePersonalNotes(Boolean(result.includePersonalNotes)); setSavedPersonalNotes(Boolean(result.includePersonalNotes));
    if ('deckCount' in result) setCounts(result as GroupShareLink);
    const state = 'library' in result ? result.library ?? null : null;
    setLibrary(state);
    if (state) setLevel(state.level ?? '');
    setExpiry('keep');
  }
  useEffect(() => {
    let valid = true;
    setLoading(true); setError('');
    (group ? groupShareStatus(deck.id) : shareStatus(deck.id)).then(async result => {
      if (!valid) return;
      apply(result);
      // Links made before short codes existed get one now; this keeps their settings.
      if (result.token && !result.code) {
        try { const touched = await (group ? touchGroupShare(deck.id) : touchShare(deck.id)); if (valid) apply(touched); } catch { /* the link still works without a code */ }
      }
    }).catch(e => { if (valid) setError(e.message); }).finally(() => { if (valid) setLoading(false); });
    return () => { valid = false; };
  }, [deck.id, group, attempt]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { if (alive.current) setError((e as Error).message); }
    finally { locked.current = false; if (alive.current) setBusy(false); }
  }
  const changeSharing = (revoke = false) => run(async () => {
    if (revoke) {
      await (group ? revokeGroupShare(deck.id) : revokeShare(deck.id));
      if (alive.current) { setToken(null); setCode(null); setExpiresAt(null); setLibrary(null); setIncludePersonalNotes(false); setSavedPersonalNotes(false); setConfirmRevoke(false); setShowQr(false); setNotice('Đã tắt liên kết và mã. Bản người nhận đã lưu vẫn được giữ.'); }
    } else {
      if (includePersonalNotes) await cardNotes.flush();
      const result = await (group ? enableGroupShare(deck.id, includePersonalNotes, toExpiry(expiry)) : enableShare(deck.id, includePersonalNotes, toExpiry(expiry)));
      if (alive.current) { apply(result); setNotice('Đã lưu tùy chọn chia sẻ.'); }
    }
  });
  const renew = () => run(async () => { const result = await (group ? touchGroupShare(deck.id) : touchShare(deck.id)); if (alive.current) { apply(result); setNotice('Đã gia hạn: liên kết và mã dùng lại được.'); } });
  const publish = (published: boolean) => run(async () => {
    const result = await publishDeck(deck.id, { published, level: level || null, description });
    if (alive.current) { apply(result); setNotice(published ? 'Bộ thẻ đã có trong thư viện cộng đồng.' : 'Đã gỡ khỏi thư viện. Liên kết riêng vẫn dùng được.'); }
  });
  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); if (alive.current) setNotice(done); }
    catch { input.current?.focus(); input.current?.select(); if (alive.current) setNotice('Hãy sao chép nội dung trong ô bên trên.'); }
  }
  async function nativeShare() {
    if (!url) return;
    try { await navigator.share({ title: deck.name, text: `Cùng học ${group ? 'nhóm' : 'bộ thẻ'} ${deck.name} trên SỔ NHẬT${code ? ` · mã ${code}` : ''}`, url: code ? shortUrl(code) : url }); }
    catch (e) { if ((e as Error).name !== 'AbortError') await copy(url, 'Đã sao chép liên kết.'); }
  }
  const dirty = token && (includePersonalNotes !== savedPersonalNotes || expiry !== 'keep');
  const removed = library?.moderation === 'REMOVED';

  return <AppDialog open title={group ? 'Chia sẻ nhóm' : 'Chia sẻ bộ thẻ'} onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-5" aria-busy={busy || loading}>
      <div><h3 className="text-lg font-semibold break-words">{deck.name}</h3>
        {group && counts ? <p className="study-copy mt-1 text-sm">{counts.deckCount.toLocaleString('vi-VN')} bộ import · {counts.cardCount.toLocaleString('vi-VN')} thẻ</p> : deck.cardCount !== undefined && !group && <p className="study-copy mt-1 text-sm">{deck.cardCount.toLocaleString('vi-VN')} thẻ</p>}
        <p className="study-copy mt-3 text-sm">Ai có liên kết hoặc mã có thể học thử và lưu {group ? 'cả nhóm' : 'bộ thẻ'} thành bản riêng.</p>
        {group && Boolean(counts?.excludedDeckCount) && <p className="study-copy mt-2 text-xs">{counts!.excludedDeckCount} bộ tạo thủ công không được chia sẻ.</p>}
      </div>
      {removed && <p role="alert" className="rounded-lg bg-[var(--color-error-subtle)] p-3 text-sm text-[var(--color-error)]">Bộ thẻ này đã bị gỡ khỏi chia sẻ{library?.removedReason ? `: ${library.removedReason}` : '.'} Những người đã lưu vẫn giữ bản của họ.</p>}
      {loading ? <p role="status" className="study-copy text-sm">Đang kiểm tra liên kết…</p> : token ? <>
        <label htmlFor="share-link" className="sr-only">Liên kết chia sẻ</label>
        <div className="share-link-box"><input id="share-link" ref={input} readOnly value={url} onFocus={e => e.target.select()}/><button type="button" className="study-button study-button-primary" onClick={() => void copy(url, 'Đã sao chép liên kết.')}><Copy size={16}/>Sao chép</button></div>
        {typeof navigator.share === 'function' && <button type="button" className="study-button w-full justify-center" onClick={() => void nativeShare()}><Share2 size={16}/>Gửi liên kết</button>}
        {expiresAt && <p role="status" className={`text-sm ${expired ? 'text-[var(--color-error)]' : 'study-copy'}`}>{expired ? `Liên kết và mã đã hết hạn lúc ${when(expiresAt)}.` : `Hết hạn lúc ${when(expiresAt)}.`}{expired && <> <button type="button" className="underline" disabled={busy} onClick={() => void renew()}>Gia hạn</button></>}</p>}
        {code && <section aria-label="Mã chia sẻ" className="rounded-xl bg-[var(--color-surface-alt)] p-4 text-center">
          <p className="study-eyebrow">MÃ CHIA SẺ</p>
          <p className="my-2 select-all font-mono text-3xl font-semibold tracking-[0.18em]">{code}</p>
          <p className="study-copy text-xs">Người nhận chọn “Nhập mã chia sẻ” trong Bộ thẻ, hoặc quét QR.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" className="study-button" onClick={() => void copy(code, 'Đã chép mã.')}><Copy size={16}/>Chép mã</button>
            <button type="button" className="study-button" aria-expanded={showQr} onClick={() => setShowQr(value => !value)}>{showQr ? 'Ẩn QR' : 'Hiện QR'}</button>
          </div>
          {showQr && <div className="mt-4"><ShareQr url={shortUrl(code)} name={deck.name} /></div>}
        </section>}
      </> : !error && <div>{group && counts?.deckCount === 0 ? <p className="study-copy text-sm">Nhóm chưa có bộ import để chia sẻ.</p> : !removed && <button type="button" className="study-button study-button-primary w-full justify-center" disabled={busy} onClick={() => void changeSharing()}><Link2 size={16}/>{busy ? 'Đang tạo…' : 'Tạo liên kết'}</button>}</div>}
      {error && <div role="alert" className="space-y-2"><p className="text-sm text-[var(--color-error)]">{error}</p><button type="button" className="study-button" disabled={busy} onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div>}
      {notice && <p role="status" className="study-copy text-xs">{notice}</p>}
      <details className="share-options"><summary>Tùy chọn chia sẻ</summary>
        <p>Nội dung, ghi chú gốc, giao diện và tên hiển thị của bạn được chia sẻ. Font riêng bạn tải lên không đi kèm; người nhận thấy font mặc định. Lịch ôn luôn riêng. Các bản đã nhận không tự cập nhật.</p>
        <label className="my-3 flex items-start gap-3"><input type="checkbox" checked={includePersonalNotes} disabled={loading || busy} onChange={event => setIncludePersonalNotes(event.target.checked)}/><span>Kèm ghi chú của tôi<span className="mt-1 block text-xs">Khi bật, người nhận mới sẽ nhận cả ghi chú cá nhân đã đồng bộ. Tắt không xóa ghi chú trong bản họ đã nhận.</span></span></label>
        {token && <label className="my-3 block text-sm">Thời hạn liên kết và mã
          <select className="study-input mt-1" value={expiry} disabled={busy || library?.published} onChange={event => setExpiry(event.target.value as ExpiryChoice)}>
            <option value="keep">{library?.published ? 'Không hết hạn (bộ đang công khai)' : expiresAt ? 'Giữ nguyên thời hạn hiện tại' : 'Không hết hạn (hiện tại)'}</option>
            {expiresAt && !library?.published && <option value="never">Không hết hạn</option>}
            <option value="1">Hết hạn sau 1 ngày</option><option value="7">Hết hạn sau 7 ngày</option><option value="30">Hết hạn sau 30 ngày</option>
          </select>
        </label>}
        {dirty && <button className="study-button" disabled={busy} onClick={() => void changeSharing()}>Lưu tùy chọn chia sẻ</button>}
        {token && (confirmRevoke ? <div className="space-y-3"><p>Tắt liên kết này? Người nhận sẽ không thể xem hoặc lưu thêm, và mã cũng ngừng dùng được. Chia sẻ lại sẽ tạo liên kết và mã mới.</p><div className="flex flex-wrap gap-2"><button type="button" className="study-button" disabled={busy} onClick={() => void changeSharing(true)}>{busy ? 'Đang tắt…' : 'Tắt liên kết'}</button><button type="button" className="study-button" disabled={busy} onClick={() => setConfirmRevoke(false)}>Giữ liên kết</button></div></div> : <button type="button" className="study-button" disabled={busy} onClick={() => setConfirmRevoke(true)}><Link2Off size={16}/>Ngừng chia sẻ</button>)}
      </details>
      {!group && !removed && <details className="share-options" open={Boolean(library?.published)}><summary>Thư viện cộng đồng</summary>
        <p>Đăng bộ thẻ để mọi người tìm thấy, xem trước và lưu về. Ai cũng thấy tên bộ, mô tả, tên hiển thị của bạn và số thẻ. Bạn có thể gỡ bất cứ lúc nào; bản người khác đã lưu vẫn là của họ. Chỉ đăng nội dung bạn có quyền chia sẻ.</p>
        {library?.moderation === 'UNDER_REVIEW' && <p role="status" className="my-2 text-sm text-[var(--color-warning)]">Bộ thẻ đang được xem xét vì có báo cáo nên tạm ẩn khỏi thư viện. Liên kết riêng vẫn dùng được.</p>}
        <div className="my-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
          <label className="text-sm">Cấp độ<select className="study-input mt-1" value={level} disabled={busy} onChange={event => setLevel(event.target.value)}><option value="">Chưa rõ</option>{LEVELS.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="text-sm">Mô tả (tối đa 500 ký tự)<textarea className="study-input mt-1 min-h-20" maxLength={500} value={description} disabled={busy} onChange={event => setDescription(event.target.value)}/></label>
        </div>
        {library?.published && <p className="study-copy mb-2 text-xs">Đang công khai · {library.downloads.toLocaleString('vi-VN')} lượt lưu. Bộ công khai không có hạn dùng.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="study-button study-button-primary" disabled={busy || loading} onClick={() => void publish(true)}>{library?.published ? 'Cập nhật thông tin' : 'Đăng lên thư viện'}</button>
          {library?.published && <button type="button" className="study-button" disabled={busy} onClick={() => void publish(false)}>Gỡ khỏi thư viện</button>}
        </div>
      </details>}
    </div>
  </AppDialog>;
}
