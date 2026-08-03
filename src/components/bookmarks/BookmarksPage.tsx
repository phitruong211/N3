// ============================================================
// Bookmarks Page
// ============================================================

import React, { useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { BookmarkCheck, BookOpen, Languages, GraduationCap, Trash2 } from 'lucide-react';

export function BookmarksPage() {
  const { bookmarks, vocabulary, kanji, grammar, toggleBookmark, setCurrentPage } = useApp();

  const bookmarkItems = useMemo(() => {
    return bookmarks.map((b) => {
      let title = '';
      let subtitle = '';
      let icon = <BookOpen size={14} />;

      if (b.itemType === 'vocabulary') {
        const v = vocabulary.find((v) => v.id === b.itemId);
        title = v?.kanji || b.itemId;
        subtitle = v ? `${v.hiragana} — ${v.meaning}` : '';
        icon = <BookOpen size={14} />;
      } else if (b.itemType === 'kanji') {
        const k = kanji.find((k) => k.id === b.itemId);
        title = k?.kanji || b.itemId;
        subtitle = k?.hanViet || '';
        icon = <Languages size={14} />;
      } else if (b.itemType === 'grammar') {
        const g = grammar.find((g) => g.id === b.itemId);
        title = g?.pattern || b.itemId;
        subtitle = g?.meaning || '';
        icon = <GraduationCap size={14} />;
      }

      return { ...b, title, subtitle, icon };
    });
  }, [bookmarks, vocabulary, kanji, grammar]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">Bookmarks</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {bookmarks.length} saved items
        </p>
      </div>

      {bookmarkItems.length === 0 ? (
        <div className="text-center py-16 text-sm text-[var(--color-text-tertiary)]">
          <BookmarkCheck size={32} className="mx-auto mb-3 opacity-30" />
          <p>No bookmarks yet.</p>
          <p className="mt-1">Bookmark vocabulary, kanji, or grammar while studying.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {bookmarkItems.map((item) => (
            <div
              key={item.itemId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
            >
              <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] bg-[var(--color-surface-alt)] px-2 py-0.5 rounded shrink-0">
                {item.icon}
                {item.itemType}
              </span>
              <span className="font-jp text-sm font-medium text-[var(--color-text)]">
                {item.title}
              </span>
              <span className="text-xs text-[var(--color-text-secondary)] flex-1 truncate">
                {item.subtitle}
              </span>
              <button
                onClick={() => toggleBookmark(item.itemId, item.itemType)}
                className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] cursor-pointer transition-colors duration-150"
                aria-label="Remove bookmark"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
