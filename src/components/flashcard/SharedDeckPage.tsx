import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Check, Download, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { saveSharedDeck, sharedDeckPreview, type SharedDeckPreview } from '@/lib/deckSharing';

export function SharedDeckPage() {
  const { token = '' } = useParams();
  const { user, loading: authLoading, requestAuth, restoreError, retryRestore } = useAuth();
  const [deck, setDeck] = useState<SharedDeckPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const previewSection = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ deckId: string; alreadySaved: boolean } | null>(null);
  const lock = useRef(false);
  const identity = `${user?.id ?? 'guest'}:${token}`;
  const currentIdentity = useRef(identity); currentIdentity.current = identity;
  useEffect(() => { setSaved(null); }, [user?.id, token]);
  useEffect(() => { setPreviewPage(0); setDeck(null); }, [token]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setUnavailable(false);
    sharedDeckPreview(token, controller.signal, previewPage).then(result => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(0, result.totalPages - 1);
      if (previewPage > lastPage) { setPreviewPage(lastPage); return; }
      setDeck(result);
    })
      .catch(e => { if (!controller.signal.aborted) { setError(e instanceof ApiError ? e.message : 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.'); setUnavailable(e instanceof ApiError && e.status === 404); if (e instanceof ApiError && e.status === 404) setDeck(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt, previewPage]);
  function changePreviewPage(page: number) {
    setPreviewPage(page);
    previewSection.current?.scrollIntoView({ block: 'start' });
  }
  async function save() {
    if (!user) { requestAuth(); return; }
    if (lock.current) return;
    const account = identity;
    lock.current = true; setBusy(true); setError('');
    try { const result = await saveSharedDeck(token); if (currentIdentity.current === account) setSaved(result); }
    catch (e) { if (currentIdentity.current === account) { setError((e as Error).message); if (e instanceof ApiError && e.status === 404) { setUnavailable(true); setDeck(null); } } }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="min-h-screen bg-[var(--color-bg)] px-4 py-8 text-[var(--color-text)] sm:py-12">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/today" className="inline-flex items-center gap-3 font-semibold"><img src="/so-nhat-mark.svg" alt="" className="h-10 w-10"/>SỔ NHẬT</Link>
      {loading && !deck ? <div className="study-panel" role="status">Đang mở bộ thẻ được chia sẻ…</div> : deck && <>
        <section className="study-panel space-y-5">
          <p className="study-eyebrow flex items-center gap-2"><BookOpen size={16}/>BỘ THẺ ĐƯỢC CHIA SẺ</p>
          <h1 className="text-3xl font-semibold break-words">{deck.name}</h1>
          <p className="study-copy">{deck.cardCount.toLocaleString('vi-VN')} thẻ · Chia sẻ bởi {deck.author}</p>
          {deck.description && <p className="study-copy whitespace-pre-wrap break-words">{deck.description}</p>}
          {saved ? <div className="space-y-3"><p role="status" className="flex items-center gap-2 font-medium text-[var(--color-accent)]"><Check size={18}/>{saved.alreadySaved ? 'Bộ thẻ này đã có trong thư viện của bạn.' : 'Đã lưu vào bộ thẻ của bạn.'}</p><Link className="study-button study-button-primary inline-flex" to={`/decks?deck=${encodeURIComponent(saved.deckId)}`}>Mở bộ thẻ để học<ArrowRight size={16}/></Link></div> : <div className="space-y-3"><button className="study-button study-button-primary" disabled={busy || authLoading} onClick={() => void save()}><Download size={17}/>{busy ? 'Đang lưu bộ thẻ…' : authLoading ? 'Đang khôi phục tài khoản…' : user ? 'Lưu vào bộ thẻ của tôi' : 'Đăng nhập để lưu bộ thẻ'}</button><p className="study-copy text-sm">Bạn nhận một bản riêng, có thể chỉnh sửa và bắt đầu lịch ôn mới.</p></div>}
        </section>
        <section ref={previewSection} aria-labelledby="shared-preview" aria-busy={loading} className="scroll-mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 id="shared-preview" className="text-lg font-semibold">Xem trước nội dung</h2><p className="study-copy text-sm">Xem trước {deck.previewCount.toLocaleString('vi-VN')} / {deck.cardCount.toLocaleString('vi-VN')} thẻ</p></div>
          <p className="study-copy mb-4 text-sm">Bạn có thể xem trước một nửa bộ thẻ. Lưu bộ thẻ để học toàn bộ nội dung.</p>
          {loading && <p role="status" className="study-copy mb-3">Đang tải thẻ xem trước…</p>}
          <div className="grid gap-3 sm:grid-cols-2">{deck.cards.map((card, index) => <article className="study-panel min-w-0 space-y-2" key={`${deck.page}-${index}`}><p className="study-eyebrow">THẺ {deck.page * deck.size + index + 1}</p><p lang="ja" className="font-jp text-xl whitespace-pre-wrap break-words">{card.front}</p>{card.reading && <p lang="ja" className="study-copy break-words">{card.reading}</p>}<p className="whitespace-pre-wrap break-words">{card.back}</p></article>)}</div>
          {!deck.cards.length && <p className="study-copy">{deck.cardCount ? 'Trang này không có thẻ xem trước.' : 'Bộ thẻ này chưa có nội dung.'}</p>}
          {deck.totalPages > 1 && <nav aria-label="Trang xem trước" className="mt-4 flex flex-wrap items-center justify-between gap-3"><button className="study-button" disabled={loading || deck.page === 0} onClick={() => changePreviewPage(deck.page - 1)}>Trang trước</button><span className="study-copy text-sm">Trang {deck.page + 1} / {deck.totalPages}</span><button className="study-button" disabled={loading || deck.page + 1 >= deck.totalPages} onClick={() => changePreviewPage(deck.page + 1)}>Trang tiếp</button></nav>}
        </section>
      </>}
      {error && <div className="study-panel space-y-3" role="alert"><h1 className="text-lg font-semibold">{unavailable ? 'Liên kết không còn khả dụng' : 'Chưa thể hoàn tất'}</h1><p className="study-copy">{error}</p>{unavailable ? <p className="study-copy">Hãy nhờ người chia sẻ gửi một liên kết mới.</p> : <button className="study-button" disabled={busy} onClick={() => setAttempt(v => v + 1)}>Thử tải lại</button>}</div>}
      {restoreError && <div role="alert" className="study-panel space-y-3"><p>{restoreError}</p><button className="study-button" onClick={retryRestore}>Kết nối lại tài khoản</button></div>}
      <p className="study-copy text-sm">Chỉ nội dung bộ thẻ được sao chép. Lịch ôn và tiến độ học của mỗi người được giữ riêng.</p>
    </div>
  </main>;
}
