// ============================================================
// Grammar Page
// ============================================================
// Principles:
// - Progressive Disclosure: Collapsed by default, expand on click
// - Cognitive Load Theory: One pattern focus at a time
// - Recognition over Recall: Clear structure labels
// ============================================================

import React, { useState, useMemo } from 'react';
import { useApp } from '@/hooks/useApp';
import type { GrammarItem } from '@/types';
import { ChevronDown, ChevronUp, Bookmark, BookmarkCheck, Search, X } from 'lucide-react';

export function GrammarPage() {
  const { grammar, isBookmarked, toggleBookmark } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'bookmarked'>('all');

  const filtered = useMemo(() => {
    return grammar.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.usage.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBookmark = filter === 'all' || isBookmarked(item.id);
      return matchesSearch && matchesBookmark;
    });
  }, [grammar, searchQuery, filter, isBookmarked]);

  return (
    <div className="space-y-6 w-full">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">
            Grammar
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {filtered.length} of {grammar.length} N3 Japanese grammar patterns and usage
          </p>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] shrink-0 self-start sm:self-auto">
          {(['all', 'bookmarked'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-4 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-150 cursor-pointer
                ${
                  filter === f
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                }
              `}
            >
              {f === 'all' ? 'All Patterns' : '★ Saved'}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xs">
        <Search size={16} className="text-[var(--color-text-tertiary)] shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search grammar patterns, meanings, or usage..."
          className="flex-1 bg-transparent text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ============================================================
          2-Column Apple Grammar Workspace (lg:grid-cols-12)
          ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 Spans): Grammar Pattern Cards */}
        <div className="lg:col-span-7 space-y-3">
          {filtered.map((item) => (
            <GrammarCard
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              isBookmarked={isBookmarked(item.id)}
              onBookmark={() => toggleBookmark(item.id, 'grammar')}
            />
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-tertiary)]">
              No grammar patterns match your search criteria.
            </div>
          )}
        </div>

        {/* Right Column (5 Spans): Sticky Grammar Companion & Connection Formula */}
        <div className="lg:col-span-5 sticky top-24 space-y-6">
          {(() => {
            const current = grammar.find((g) => g.id === expandedId) || filtered[0] || grammar[0];
            if (!current) return null;
            return (
              <div className="p-7 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)] mb-3">
                      {expandedId === current.id ? 'Active Pattern' : 'Grammar Reference'}
                    </span>
                    <div className="font-jp text-4xl font-semibold text-[var(--color-text)] tracking-tight">
                      {current.pattern}
                    </div>
                    <div className="text-lg font-medium text-[var(--color-text-secondary)] mt-1">
                      {current.meaning}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleBookmark(current.id, 'grammar')}
                    className="p-2.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    title="Bookmark pattern"
                  >
                    {isBookmarked(current.id) ? (
                      <BookmarkCheck size={20} className="text-[var(--color-warning)]" />
                    ) : (
                      <Bookmark size={20} className="text-[var(--color-text-tertiary)]" />
                    )}
                  </button>
                </div>

                <div className="pt-4 border-t border-[var(--color-border)] space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Connection Formula (Cách Dùng)
                  </div>
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface-alt)] font-jp text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)]">
                    {current.usage}
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Example Usage
                  </div>
                  <div className="space-y-3">
                    {current.examples.slice(0, 2).map((ex, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-[var(--color-surface-alt)] space-y-1">
                        <p className="font-jp text-sm font-medium text-[var(--color-text)]">
                          {ex.japanese}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {ex.meaning}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Grammar Companion Guide */}
          <div className="p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-4 shadow-xs">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Grammar Study Ergonomics
            </h3>
            <div className="space-y-2.5 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between">
                <span>Expand / Collapse Pattern</span>
                <kbd className="kbd-shortcut">Click Card</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Toggle Bookmark</span>
                <kbd className="kbd-shortcut">B</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Global Search</span>
                <kbd className="kbd-shortcut">⌘K / Ctrl+K</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrammarCard({
  item,
  expanded,
  onToggle,
  isBookmarked: bookmarked,
  onBookmark,
}: {
  item: GrammarItem;
  expanded: boolean;
  onToggle: () => void;
  isBookmarked: boolean;
  onBookmark: () => void;
}) {
  return (
    <div className="rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden transition-colors duration-150">
      {/* Header — always visible */}
      <div
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        className="w-full flex items-center justify-between px-6 py-5 text-left cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors duration-150 focus-ring"
      >
        <div className="flex items-baseline gap-4 min-w-0 flex-1 mr-4">
          <span className="font-jp text-xl font-semibold text-[var(--color-text)] shrink-0">
            {item.pattern}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)] truncate">
            {item.meaning}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            className={`p-1.5 rounded-lg cursor-pointer ${
              bookmarked
                ? 'text-[var(--color-warning)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]'
            }`}
            aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
          {expanded ? (
            <ChevronUp size={18} className="text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronDown size={18} className="text-[var(--color-text-tertiary)]" />
          )}
        </div>
      </div>

      {/* Expanded content (Apple Books / Notion style vertical rhythm) */}
      {expanded && (
        <div className="px-6 pb-8 space-y-8 border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]/30">
          {/* Structure pill */}
          <div className="pt-6">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
              Structure & Connection
            </div>
            <div className="inline-block font-mono text-sm px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shadow-xs">
              {item.structure}
            </div>
          </div>

          {/* Usage & Nuance (Vertical paragraphs) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                Usage & Meaning
              </div>
              <p className="text-sm text-[var(--color-text)] leading-relaxed">
                {item.usage}
              </p>
            </div>

            {item.nuance && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
                  Subtle Nuance
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {item.nuance}
                </p>
              </div>
            )}
          </div>

          {/* Common Mistakes / Comparison callouts */}
          {(item.commonMistakes || item.comparison) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
              {item.commonMistakes && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-error)] mb-1">
                    Common Mistakes
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {item.commonMistakes}
                  </p>
                </div>
              )}
              {item.comparison && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-1">
                    Similar Patterns / Comparison
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {item.comparison}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Example sentences with Apple-style left accent border */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
              Example Sentences ({item.examples.length})
            </div>
            <div className="space-y-6">
              {item.examples.map((ex, i) => (
                <div
                  key={i}
                  className="pl-5 border-l-2 border-[var(--color-accent)] space-y-1.5"
                >
                  <div className="font-jp text-base font-medium text-[var(--color-text)] leading-snug">
                    {ex.japanese}
                  </div>
                  <div className="font-jp text-xs text-[var(--color-text-tertiary)]">
                    {ex.reading}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {ex.meaning}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
