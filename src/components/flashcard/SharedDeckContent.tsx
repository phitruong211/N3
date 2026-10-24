import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from '@/components/ui/icons';
import type { SharedDeckPreview } from '@/lib/deckSharing';
import { FuriganaText } from './FuriganaText';

export function SharedDeckContent({ deck, loading, onPageChange }: {
  deck: SharedDeckPreview; loading: boolean; onPageChange: (page: number) => void;
}) {
  const [mode, setMode] = useState<'study' | 'list'>('study');
  const [position, setPosition] = useState({ page: 0, index: 0 });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [jump, setJump] = useState('');
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (jumpOpen) jumpInput.current?.focus(); }, [jumpOpen]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = position.page === deck.page ? Math.min(position.index, Math.max(0, deck.cards.length - 1)) : 0;
  const absoluteIndex = deck.page * deck.size + index;
  const current = deck.cards[index];
  const cardKey = `${deck.page}:${index}:${current?.front}:${current?.back}`;
  const revealed = revealedKey === cardKey;
  const goTo = useCallback((next: number) => {
    if (loading || next < 0 || next >= deck.previewCount) return;
    const page = Math.floor(next / deck.size);
    setPosition({ page, index: next % deck.size });
    setRevealedKey(null);
    if (page !== deck.page) onPageChange(page);
  }, [deck.page, deck.previewCount, deck.size, loading, onPageChange]);
  useEffect(() => {
    if (mode !== 'study' || loading || !current) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,button,a,[role="tab"],[contenteditable="true"]')) return;
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setRevealedKey(value => value === cardKey ? null : cardKey); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(absoluteIndex + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(absoluteIndex - 1); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [absoluteIndex, cardKey, current, goTo, loading, mode]);
  function switchMode(next: 'study' | 'list') { setMode(next); setRevealedKey(null); }
  function jumpToCard(event: FormEvent) {
    event.preventDefault();
    const number = Number(jump);
    if (!Number.isInteger(number) || number < 1 || number > deck.previewCount) return;
    goTo(number - 1); setJump(''); setJumpOpen(false);
  }
  return <div className="space-y-4">
    <div className="shared-modes" aria-label="Chế độ xem trước">
      <button type="button" aria-pressed={mode === 'study'} onClick={() => switchMode('study')}>Học thử</button>
      <button type="button" aria-pressed={mode === 'list'} onClick={() => switchMode('list')}>Danh sách</button>
    </div>
    {loading && <p role="status" className="study-copy">Đang tải thẻ xem trước…</p>}
    {!current ? <p className="study-copy">{deck.cardCount ? 'Trang này không có thẻ xem trước.' : 'Bộ thẻ này chưa có nội dung.'}</p> : mode === 'study' ? <div className="space-y-4" aria-label="Học thử bộ thẻ">
      <div role="button" tabIndex={loading ? -1 : 0} aria-label={revealed ? 'Lật về mặt trước' : 'Lật thẻ để xem nghĩa'} aria-disabled={loading} aria-expanded={revealed}
        className={`shared-preview-card outline-offset-4 ${loading ? 'opacity-50' : ''}`}
        onClick={() => { if (!loading) setRevealedKey(value => value === cardKey ? null : cardKey); }}
        onTouchStart={event => { const first = event.touches[0]; touch.current = { x: first.clientX, y: first.clientY }; }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={event => {
          const first = event.changedTouches[0]; const start = touch.current; touch.current = null;
          if (!start) return;
          const dx = first.clientX - start.x; const dy = first.clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            event.preventDefault();
            goTo(absoluteIndex + (dx < 0 ? 1 : -1));
          }
        }}>
        {revealed ? <><p lang="ja" className="font-jp mb-5 text-base text-[var(--color-text-tertiary)]"><FuriganaText text={current.front} reading={current.reading || ''}/></p><p className="max-w-full whitespace-pre-wrap break-words text-2xl leading-relaxed sm:text-3xl">{current.back}</p></> : <p lang="ja" className="font-jp max-w-full whitespace-pre-wrap break-words text-4xl leading-relaxed sm:text-5xl"><FuriganaText text={current.front} reading={current.reading || ''}/></p>}
        <small>{revealed ? 'Bấm để quay lại mặt trước' : 'Bấm vào thẻ để xem nghĩa'}</small>
      </div>
      <nav className="shared-card-nav" aria-label="Điều hướng học thử">
        <button type="button" disabled={loading || absoluteIndex === 0} aria-label="Thẻ trước" onClick={() => goTo(absoluteIndex - 1)}><ArrowLeft size={18}/></button>
        <button type="button" className="shared-card-index" aria-label="Chọn số thẻ" aria-expanded={jumpOpen} disabled={loading} onClick={() => setJumpOpen(value => !value)}><span role="status">{absoluteIndex + 1} / {deck.previewCount.toLocaleString('vi-VN')}</span><ChevronDown size={14}/></button>
        <button type="button" disabled={loading || absoluteIndex + 1 >= deck.previewCount} aria-label="Thẻ tiếp" onClick={() => goTo(absoluteIndex + 1)}><ArrowRight size={18}/></button>
      </nav>
      {jumpOpen && <form onSubmit={jumpToCard} className="shared-jump"><input ref={jumpInput} type="number" min={1} max={deck.previewCount} step={1} value={jump} onChange={event => setJump(event.target.value)} aria-label="Số thẻ muốn xem" placeholder="Số thẻ" className="study-input !w-24" disabled={loading} onKeyDown={e => { if (e.key === 'Escape') setJumpOpen(false); }}/><button type="submit" className="study-button" disabled={loading || !jump}>Đến thẻ</button></form>}
      {absoluteIndex + 1 === deck.previewCount && <p className="study-copy rounded-xl bg-[var(--color-surface-alt)] p-4 text-sm">Bạn đã xem hết phần học thử. Lưu để học đủ {deck.cardCount.toLocaleString('vi-VN')} thẻ.</p>}
    </div> : <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"><table className="w-full table-fixed text-left text-sm" aria-label="Danh sách từ và nghĩa"><thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]"><tr><th scope="col" className="w-1/2 p-3 font-semibold sm:w-2/5">Từ / cách đọc</th><th scope="col" className="p-3 font-semibold">Nghĩa</th></tr></thead><tbody>{deck.cards.map((card, row) => <tr key={row} className="border-b border-[var(--color-border)] last:border-b-0"><td className="p-3 align-top"><button className="max-w-full text-left text-[var(--color-accent)] hover:underline" disabled={loading} aria-label={`Học thử thẻ ${deck.page * deck.size + row + 1}`} onClick={() => { goTo(deck.page * deck.size + row); setMode('study'); }}><span className="font-jp whitespace-pre-wrap break-words text-base"><FuriganaText text={card.front} reading={card.reading || ''}/></span></button></td><td className="whitespace-pre-wrap break-words p-3 align-top leading-relaxed">{card.back}</td></tr>)}</tbody></table></div>
      {deck.totalPages > 1 && <nav aria-label="Trang xem trước" className="flex flex-wrap items-center justify-between gap-3"><button className="study-button" disabled={loading || deck.page === 0} onClick={() => goTo((deck.page - 1) * deck.size)}>Trang trước</button><span className="study-copy text-sm">Trang {deck.page + 1} / {deck.totalPages}</span><button className="study-button" disabled={loading || deck.page + 1 >= deck.totalPages} onClick={() => goTo((deck.page + 1) * deck.size)}>Trang tiếp</button></nav>}
    </div>}
  </div>;
}
