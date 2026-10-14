import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { sharedGroupPreview, sharedGroupDeckPreview, type SharedGroupPreview, type SharedDeckPreview } from '@/lib/deckSharing';
import { SharedDeckContent } from './SharedDeckContent';
import { AppLoading } from '@/components/ui/AppLoading';
import { SharedPageLayout, SharedSaveAction, SharedError } from './SharedPageLayout';
import { useSharedSave } from './useSharedSave';

export function SharedGroupPage() {
  const { token = '' } = useParams();
  return <GroupPage key={token} token={token}/>;
}
function GroupPage({ token }: { token: string }) {
  const [group, setGroup] = useState<SharedGroupPreview | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [deck, setDeck] = useState<SharedDeckPreview | null>(null);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState('');
  const [deckAttempt, setDeckAttempt] = useState(0);
  const preview = useRef<HTMLElement>(null);
  const save = useSharedSave(token, 'group');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setUnavailable(false);
    sharedGroupPreview(token, controller.signal, page).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(0, result.totalPages - 1);
      if (page > last) { setPage(last); return; }
      setGroup(result);
    }).catch(e => {
      if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Không thể kết nối máy chủ.'); if (e instanceof ApiError && e.status === 404) { setUnavailable(true); setGroup(null); } }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, page, attempt]);
  useEffect(() => {
    if (!selected) { setDeck(null); setDeckError(''); setDeckLoading(false); return; }
    const controller = new AbortController();
    setDeckLoading(true); setDeckError('');
    sharedGroupDeckPreview(token, selected, controller.signal, previewPage).then(result => {
      if (controller.signal.aborted) return;
      const last = Math.max(0, result.totalPages - 1);
      if (previewPage > last) { setPreviewPage(last); return; }
      setDeck(result);
    }).catch(e => { if (!controller.signal.aborted) { setDeckError(e instanceof Error ? e.message : 'Chưa thể tải thẻ.'); if (e instanceof ApiError && e.status === 404) setDeck(null); } })
      .finally(() => { if (!controller.signal.aborted) setDeckLoading(false); });
    return () => controller.abort();
  }, [token, selected, previewPage, deckAttempt]);
  function selectDeck(id: string) {
    setDeck(null); setDeckError(''); setPreviewPage(0); setSelected(id);
    requestAnimationFrame(() => preview.current?.scrollIntoView({ block: 'start' }));
  }
  function changePage(next: number) { setPage(next); setSelected(null); }
  const gone = unavailable || save.unavailable;
  return <SharedPageLayout>
    {loading && !group ? <AppLoading message="Đang mở nhóm được chia sẻ…"/> : group && !gone && <>
      <section className="shared-hero"><div className="shared-hero-copy"><p className="study-eyebrow">NHÓM THẺ ĐƯỢC CHIA SẺ</p><h1>{group.name}</h1><p className="shared-meta">{group.deckCount.toLocaleString('vi-VN')} bộ · {group.cardCount.toLocaleString('vi-VN')} thẻ · {group.author}</p></div><SharedSaveAction state={save} kind="group" disabled={!group.deckCount}/></section>
      {save.error && <SharedError error={save.error} retry={() => void save.save()}/>}
      <section aria-labelledby="shared-group-list" aria-busy={loading}>
        <div className="shared-content-header"><h2 id="shared-group-list">Bộ thẻ trong nhóm</h2><p>Chọn một bộ để học thử</p></div>
        {!group.deckCount ? <p className="study-copy">Nhóm hiện chưa có bộ import để chia sẻ.</p> : <div className="shared-group-list">{group.decks.map((item, index) => <button key={item.id} type="button" className="shared-group-row" data-shared-deck={item.id} aria-label={`Xem trước bộ ${item.name}`} aria-expanded={selected === item.id} aria-controls={selected === item.id ? 'group-deck-preview' : undefined} onClick={() => selectDeck(item.id)}>
          <span className="shared-group-number">{page * group.size + index + 1}</span><span className="min-w-0 flex-1"><strong>{item.name}</strong><small>{item.cardCount.toLocaleString('vi-VN')} thẻ</small></span><ChevronRight size={17} className="shrink-0 text-[var(--color-text-tertiary)]"/>
        </button>)}</div>}
        {group.totalPages > 1 && <nav className="shared-pagination" aria-label="Danh sách bộ thẻ"><button type="button" className="study-button" disabled={loading || page === 0} onClick={() => changePage(page - 1)}>Trang trước</button><span>{page + 1} / {group.totalPages}</span><button type="button" className="study-button" disabled={loading || page + 1 >= group.totalPages} onClick={() => changePage(page + 1)}>Trang tiếp</button></nav>}
      </section>
      {selected && <section ref={preview} id="group-deck-preview" className="shared-group-preview" aria-label="Xem trước bộ thẻ" aria-busy={deckLoading}>
        <div className="shared-group-preview-title"><h2>{deck?.name ?? group.decks.find(item => item.id === selected)?.name}</h2><button type="button" className="study-button !min-h-11 !w-11 !p-0" aria-label="Đóng xem trước" onClick={() => { setSelected(null); document.querySelector<HTMLButtonElement>(`[data-shared-deck="${selected}"]`)?.focus(); }}><X size={18}/></button></div>
        {deckLoading && !deck ? <AppLoading message="Đang tải thẻ xem trước…"/> : deck && <><p className="study-copy mb-4 text-xs">Xem trước {deck.previewCount.toLocaleString('vi-VN')} / {deck.cardCount.toLocaleString('vi-VN')} thẻ</p><SharedDeckContent key={selected} deck={deck} loading={deckLoading} onPageChange={setPreviewPage}/></>}
        {deckError && <SharedError error={deckError} retry={() => setDeckAttempt(v => v + 1)}/>}
        {deck?.cards.some(card => card.dictionarySource) && <p className="study-copy mt-4 text-xs">Một số thẻ dựa trên JMdict — EDRDG / James William Breen, có thể đã chỉnh sửa. <a href="https://www.edrdg.org/edrdg/licence.html" className="underline" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · <Link to="/dictionary/sources" className="underline">Nguồn từ điển</Link></p>}
      </section>}
    </>}
    {(error || (save.unavailable && save.error)) && <SharedError error={error || save.error} unavailable={gone} retry={() => setAttempt(v => v + 1)}/>}
    {save.restoreError && <SharedError error={save.restoreError} retry={save.retryRestore}/>}
    <footer className="shared-footer">Chỉ các bộ import được chia sẻ. Lưu cả nhóm để có bản riêng; nội dung và lịch ôn của bạn không tự thay đổi theo người gửi.</footer>
  </SharedPageLayout>;
}
