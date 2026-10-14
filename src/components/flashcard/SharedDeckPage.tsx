import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { sharedDeckPreview, type SharedDeckPreview } from '@/lib/deckSharing';
import { SharedDeckContent } from './SharedDeckContent';
import { AppLoading } from '@/components/ui/AppLoading';
import { SharedPageLayout, SharedSaveAction, SharedError } from './SharedPageLayout';
import { useSharedSave } from './useSharedSave';

export function SharedDeckPage() {
  const { token = '' } = useParams();
  return <DeckPage key={token} token={token}/>;
}
function DeckPage({ token }: { token: string }) {
  const [deck, setDeck] = useState<SharedDeckPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const save = useSharedSave(token, 'deck');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setUnavailable(false);
    sharedDeckPreview(token, controller.signal, previewPage).then(result => {
      if (controller.signal.aborted) return;
      const lastPage = Math.max(0, result.totalPages - 1);
      if (previewPage > lastPage) { setPreviewPage(lastPage); return; }
      setDeck(result);
    }).catch(e => {
      if (!controller.signal.aborted) {
        setError(e instanceof ApiError ? e.message : 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.');
        if (e instanceof ApiError && e.status === 404) { setUnavailable(true); setDeck(null); }
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, attempt, previewPage]);
  const gone = unavailable || save.unavailable;
  return <SharedPageLayout>
    {loading && !deck ? <AppLoading message="Đang mở bộ thẻ được chia sẻ…"/> : deck && !gone && <>
      <section className="shared-hero">
        <div className="shared-hero-copy"><p className="study-eyebrow">BỘ THẺ ĐƯỢC CHIA SẺ</p><h1>{deck.name}</h1><p className="shared-meta">{deck.cardCount.toLocaleString('vi-VN')} thẻ · {deck.author}</p>
          {deck.description && <div className="shared-description"><p className={!descriptionOpen && (deck.description.length > 140 || deck.description.includes('\n')) ? 'line-clamp-2' : ''}>{deck.description}</p>{(deck.description.length > 140 || deck.description.includes('\n')) && <button type="button" aria-expanded={descriptionOpen} onClick={() => setDescriptionOpen(value => !value)}>{descriptionOpen ? 'Thu gọn' : 'Xem thêm'}</button>}</div>}
        </div><SharedSaveAction state={save} kind="deck"/>
      </section>
      {save.error && <SharedError error={save.error} retry={() => void save.save()}/>}
      <section aria-labelledby="shared-preview" aria-busy={loading}>
        <div className="shared-content-header"><h2 id="shared-preview">Xem trước nội dung</h2><p>Xem trước {deck.previewCount.toLocaleString('vi-VN')} / {deck.cardCount.toLocaleString('vi-VN')} thẻ</p></div>
        <SharedDeckContent deck={deck} loading={loading} onPageChange={setPreviewPage}/>
      </section>
    </>}
    {(error || (save.unavailable && save.error)) && <SharedError error={error || save.error} unavailable={gone} retry={() => setAttempt(v => v + 1)}/>}
    {save.restoreError && <SharedError error={save.restoreError} retry={save.retryRestore}/>}
    <footer className="shared-footer"><p>Lưu để học toàn bộ nội dung. Bản sao và lịch ôn của bạn luôn độc lập.</p>
      {deck?.cards.some(card => card.dictionarySource) && <p>Một số thẻ dựa trên JMdict — EDRDG / James William Breen, có thể đã được chỉnh sửa. <a href="https://www.edrdg.org/edrdg/licence.html" className="underline" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · <Link to="/dictionary/sources" className="underline">Nguồn từ điển</Link></p>}
    </footer>
  </SharedPageLayout>;
}
