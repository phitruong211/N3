// ============================================================
// Search Modal (Command Palette)
// ============================================================
// Principles:
// - Recognition over Recall: Search rather than navigate
// - Fitts's Law: Large clickable results
// - Hick's Law: Grouped results reduce decision time
// - Inspired by: Raycast, Linear, Notion
// ============================================================

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import { Search, X, BookOpen, Languages, GraduationCap } from 'lucide-react';
import Fuse from 'fuse.js';
import type { SearchResult } from '@/types';

export function SearchModal() {
  const { searchOpen, setSearchOpen, vocabulary, kanji, grammar, selectSearchResult } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build search index
  const fuse = useMemo(() => {
    const items: SearchResult[] = [
      ...vocabulary.map((v) => ({
        id: v.id,
        type: 'vocabulary' as const,
        title: v.kanji,
        subtitle: `${v.hiragana}${v.han_viet ? ` · ${v.han_viet}` : ''} — ${v.meaning}`,
        matchField: `${v.kanji} ${v.hiragana} ${v.han_viet || ''} ${v.meaning}`,
      })),
      ...kanji.map((k) => ({
        id: k.id,
        type: 'kanji' as const,
        title: k.kanji,
        subtitle: `${k.hanViet} · ${k.level}`,
        matchField: `${k.kanji} ${k.hanViet} ${k.level} ${k.vocabulary.map(word => `${word.word} ${word.reading} ${word.hanViet || ''}`).join(' ')}`,
      })),
      ...grammar.map((g) => ({
        id: g.id,
        type: 'grammar' as const,
        title: g.pattern,
        subtitle: g.meaning,
        matchField: `${g.pattern} ${g.meaning}`,
      })),
    ];

    return new Fuse(items, {
      keys: ['title', 'subtitle', 'matchField'],
      threshold: 0.4,
      includeScore: true,
    });
  }, [vocabulary, kanji, grammar]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return fuse.search(query).slice(0, 20).map((r) => r.item);
  }, [query, fuse]);

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setQuery('');
      setSelectedIndex(0);
      const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        window.clearTimeout(timer);
        previousFocusRef.current?.focus();
      };
    }
  }, [searchOpen]);

  const handleSelect = useCallback((result: SearchResult) => {
    setSearchOpen(false);
    selectSearchResult({ id: result.id, type: result.type });
  }, [setSearchOpen, selectSearchResult]);

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, results.length - 1)));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          setSearchOpen(false);
          break;
        case 'Tab': {
          const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('input, button');
          if (!focusable?.length) break;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          break;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, results, selectedIndex, handleSelect, setSearchOpen]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'vocabulary': return <BookOpen size={14} />;
      case 'kanji': return <Languages size={14} />;
      case 'grammar': return <GraduationCap size={14} />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'vocabulary': return 'Từ vựng';
      case 'kanji': return 'Kanji';
      case 'grammar': return 'Ngữ pháp';
      default: return type;
    }
  };

  if (!searchOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm"
        onClick={() => setSearchOpen(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        className="fixed left-1/2 top-[10%] z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 sm:top-[20%]"
        role="dialog"
        aria-label="Tìm kiếm nội dung học"
        aria-modal="true"
      >
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Search size={18} className="text-[var(--color-text-tertiary)] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Tìm từ vựng, kanji, ngữ pháp..."
              className="flex-1 bg-transparent text-[var(--color-text)] text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
              aria-label="Từ khóa tìm kiếm"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Đóng tìm kiếm"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[65vh] overflow-y-auto" role="listbox" aria-label="Kết quả tìm kiếm">
            {query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                Không tìm thấy kết quả cho “{query}”
              </div>
            )}

            {results.map((result, i) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`
                  w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3
                  text-left cursor-pointer transition-colors duration-100
                  ${
                    i === selectedIndex
                      ? 'bg-[var(--color-accent-subtle)]'
                      : 'hover:bg-[var(--color-surface-hover)]'
                  }
                `}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)] bg-[var(--color-surface-alt)] px-2 py-0.5 rounded shrink-0">
                  {getTypeIcon(result.type)}
                  {getTypeLabel(result.type)}
                </span>
                <span className="font-jp min-w-0 break-words text-sm font-medium text-[var(--color-text)]">
                  {result.title}
                </span>
                <span className="min-w-0 break-words text-xs text-[var(--color-text-secondary)] sm:ml-auto">
                  {result.subtitle}
                </span>
              </button>
            ))}

            {!query.trim() && (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                <p>Nhập chữ Nhật, cách đọc hoặc nghĩa để tìm.</p>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <span><kbd className="kbd-shortcut">↑↓</kbd> Chọn</span>
                  <span><kbd className="kbd-shortcut">↵</kbd> Mở</span>
                  <span><kbd className="kbd-shortcut">Esc</kbd> Đóng</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
