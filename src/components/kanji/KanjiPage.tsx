// ============================================================
// Kanji Page
// ============================================================
// Principles:
// - Progressive Disclosure: Grid overview → Detail on click
// - Recognition over Recall: Hán Việt prominently displayed
// - Cognitive Load Theory: One kanji detail at a time
// ============================================================

import React, { useState, useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import type { KanjiItem } from '@/types';
import { Search, X, Bookmark, BookmarkCheck } from 'lucide-react';

export function KanjiPage() {
  const { kanji, isBookmarked, toggleBookmark, setCurrentPage } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'bookmarked'>('all');

  const filtered = useMemo(() => {
    let items = kanji;
    if (filter === 'bookmarked') items = items.filter((k) => isBookmarked(k.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (k) =>
          k.kanji.includes(q) ||
          k.hanViet.toLowerCase().includes(q)
      );
    }
    return items;
  }, [kanji, filter, searchQuery, isBookmarked]);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Kanji
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {filtered.length} of {kanji.length} kanji · N3 Curriculum
          </p>
        </div>
        <button
          onClick={() => setCurrentPage('flashcards')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-medium transition-colors cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <span>Launch Kanji Flashcards →</span>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
          <Search size={16} className="text-[var(--color-text-tertiary)] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search kanji by character or Hán Việt reading..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] self-start sm:self-auto">
          {(['all', 'bookmarked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors duration-150 cursor-pointer
                ${filter === f
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }`}
            >
              {f === 'bookmarked' ? '★ Saved' : f}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================
          2-Column Apple Kanji Studio Workspace (lg:grid-cols-12)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 Spans): Kanji Grid */}
        <div className="lg:col-span-7">
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-3.5 w-full">
            {filtered.map((item) => {
              const active = (selectedKanji?.id || filtered[0]?.id) === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedKanji(item)}
                  className={`
                    group relative aspect-square flex flex-col items-center justify-center
                    rounded-2xl border transition-all duration-150 cursor-pointer focus-ring shadow-xs
                    ${active
                      ? 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]'
                    }
                  `}
                >
                  <span className="font-jp-serif text-4xl font-semibold text-[var(--color-text)]">
                    {item.kanji}
                  </span>
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] mt-1.5 truncate max-w-full px-1">
                    {item.hanViet}
                  </span>
                  {isBookmarked(item.id) && (
                    <span className="absolute top-2 right-2 text-[var(--color-warning)]">
                      <BookmarkCheck size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-tertiary)]">
              No kanji match your search or filter.
            </div>
          )}
        </div>

        {/* Right Column (5 Spans): Sticky Kanji Inspector & Study Panel */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          {(() => {
            const current = selectedKanji || filtered[0] || kanji[0];
            if (!current) return null;
            return (
              <div className="p-7 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-7">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 flex items-center justify-center rounded-2xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
                      <span className="font-jp-serif text-6xl font-semibold text-[var(--color-text)]">
                        {current.kanji}
                      </span>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
                        {current.hanViet}
                      </div>
                      <span className="inline-block mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] bg-[var(--color-surface-alt)] px-2.5 py-0.5 rounded-full border border-[var(--color-border)]">
                        N3 Level Kanji
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleBookmark(current.id, 'kanji')}
                    className="p-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    title="Bookmark Kanji"
                  >
                    {isBookmarked(current.id) ? (
                      <BookmarkCheck size={20} className="text-[var(--color-warning)]" />
                    ) : (
                      <Bookmark size={20} className="text-[var(--color-text-tertiary)]" />
                    )}
                  </button>
                </div>

                {/* Compound Vocabulary */}
                {current.vocabulary.length > 0 ? (
                  <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      Compound Vocabulary (Từ Ghép N3)
                    </h3>
                    <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                      {current.vocabulary.map((v, i) => (
                        <div
                          key={i}
                          className="px-4 py-3 bg-[var(--color-surface)] flex items-baseline justify-between gap-4"
                        >
                          <span className="font-jp-serif text-base font-medium text-[var(--color-text)]">
                            {v.word}
                          </span>
                          <span className="font-jp text-xs font-mono text-[var(--color-text-secondary)]">
                            {v.reading}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-tertiary)]">
                    No compound vocabulary items listed for this Kanji.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Kanji Studio Navigation Card */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Kanji Studio Ergonomics
            </h3>
            <div className="space-y-2.5 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Select Kanji Card</span>
                <kbd className="kbd-shortcut">Click / Tap</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Toggle Bookmark</span>
                <kbd className="kbd-shortcut">B</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Global Command Palette</span>
                <kbd className="kbd-shortcut">⌘K / Ctrl+K</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
