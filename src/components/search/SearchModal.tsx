// ============================================================
// Search Modal (Command Palette)
// ============================================================
// Principles:
// - Recognition over Recall: Search rather than navigate
// - Fitts's Law: Large clickable results
// - Hick's Law: Grouped results reduce decision time
// - Inspired by: Raycast, Linear, Notion
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import { Search, X, BookOpen, Languages, GraduationCap } from 'lucide-react';
import Fuse from 'fuse.js';
import type { SearchResult } from '@/types';

export function SearchModal() {
  const { searchOpen, setSearchOpen, vocabulary, kanji, grammar, setCurrentPage } = useApp();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build search index
  const fuse = useMemo(() => {
    const items: SearchResult[] = [
      ...vocabulary.map((v) => ({
        id: v.id,
        type: 'vocabulary' as const,
        title: v.kanji,
        subtitle: `${v.hiragana} — ${v.meaning}`,
        matchField: `${v.kanji} ${v.hiragana} ${v.meaning}`,
      })),
      ...kanji.map((k) => ({
        id: k.id,
        type: 'kanji' as const,
        title: k.kanji,
        subtitle: k.hanViet,
        matchField: `${k.kanji} ${k.hanViet}`,
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
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!searchOpen) return;

    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
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
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, results, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    setSearchOpen(false);
    // Navigate to the appropriate page
    switch (result.type) {
      case 'vocabulary':
        setCurrentPage('vocabulary');
        break;
      case 'kanji':
        setCurrentPage('kanji');
        break;
      case 'grammar':
        setCurrentPage('grammar');
        break;
    }
  };

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
      case 'vocabulary': return 'Vocab';
      case 'kanji': return 'Kanji';
      case 'grammar': return 'Grammar';
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
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50"
        role="dialog"
        aria-label="Search"
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
              placeholder="Search vocabulary, kanji, grammar..."
              className="flex-1 bg-transparent text-[var(--color-text)] text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
              aria-label="Search input"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-tertiary)]">
                No results found for "{query}"
              </div>
            )}

            {results.map((result, i) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3
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
                <span className="font-jp text-sm font-medium text-[var(--color-text)] truncate">
                  {result.title}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] truncate ml-auto">
                  {result.subtitle}
                </span>
              </button>
            ))}

            {!query.trim() && (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                <p>Type to search across all content</p>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <span><kbd className="px-1.5 py-0.5 bg-[var(--color-surface-alt)] rounded border border-[var(--color-border)]">↑↓</kbd> Navigate</span>
                  <span><kbd className="px-1.5 py-0.5 bg-[var(--color-surface-alt)] rounded border border-[var(--color-border)]">↵</kbd> Select</span>
                  <span><kbd className="px-1.5 py-0.5 bg-[var(--color-surface-alt)] rounded border border-[var(--color-border)]">Esc</kbd> Close</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
