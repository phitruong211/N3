import { useMemo } from 'react';
import { ArrowRight, BookmarkCheck, Trash2 } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { ContentBadge, EmptyState, PageHeading } from '@/components/ui/StudyUI';
import type { Bookmark } from '@/types';

const labels: Record<Bookmark['itemType'], string> = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', kanji: 'Kanji' };
export function BookmarksPage() {
  const { bookmarks, vocabulary, grammar, kanji, toggleBookmark, selectSearchResult, setCurrentPage } = useApp();
  const items = useMemo(() => bookmarks.map(bookmark => {
    const item = bookmark.itemType === 'vocabulary' ? vocabulary.find(value => value.id === bookmark.itemId)
      : bookmark.itemType === 'grammar' ? grammar.find(value => value.id === bookmark.itemId)
      : kanji.find(value => value.id === bookmark.itemId);
    return { ...bookmark, title: item ? ('tu' in item ? item.tu : 'pattern' in item ? item.pattern : item.kanji) : bookmark.itemId,
      detail: item ? ('meaning' in item ? item.meaning : item.hanViet) : '' };
  }), [bookmarks, vocabulary, grammar, kanji]);
  return <div className="study-page">
    <PageHeading eyebrow="CÁ NHÂN" title="Đã lưu" subtitle={bookmarks.length + ' mục để học lại'} />
    {!items.length ? <EmptyState title="Chưa lưu mục nào" detail="Chạm biểu tượng dấu trang khi học từ vựng, ngữ pháp hoặc kanji." action={<button className="study-button study-button-primary" onClick={() => setCurrentPage('vocabulary')}>Khám phá từ vựng →</button>} /> :
      <div className="study-panel divide-y divide-[var(--color-border)] !p-0">
        {items.map(item => <div key={item.itemType + item.itemId} className="flex min-w-0 items-center gap-2 p-3 sm:gap-4 sm:p-4">
          <BookmarkCheck size={18} className="hidden shrink-0 text-[var(--color-accent)] sm:block"/>
          <button className="min-w-0 flex-1 text-left focus-ring" onClick={() => selectSearchResult({ id: item.itemId, type: item.itemType })}>
            <ContentBadge tone={item.itemType}>{labels[item.itemType]}</ContentBadge>
            <p className="font-jp-serif mt-2 break-words text-lg font-semibold text-[var(--color-text)]">{item.title}</p>
            <p className="mt-1 line-clamp-2 break-words text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
          </button>
          <button className="study-button shrink-0" aria-label={'Mở ' + item.title} onClick={() => selectSearchResult({ id: item.itemId, type: item.itemType })}><ArrowRight size={18}/></button>
          <button className="study-button shrink-0" aria-label={'Bỏ lưu ' + item.title} onClick={() => toggleBookmark(item.itemId, item.itemType)}><Trash2 size={18}/></button>
        </div>)}
      </div>}
  </div>;
}
