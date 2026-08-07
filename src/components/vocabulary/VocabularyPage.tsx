// ============================================================
// Vocabulary Page (Apple/Quizlet Lexicon Workspace Style)
// ============================================================

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/hooks/useApp';
import type { VocabItem } from '@/types';
import {
  Bookmark,
  BookmarkCheck,
  Search,
  X,
  Eye,
  Volume2,
} from 'lucide-react';
import {
  VocabFlashcardSession,
  parseRelatedWords,
  speakJapanese,
} from '@/components/flashcard/FlashcardPage';

// Helper for example context sentences
function getExampleContext(item: VocabItem) {
  const map: Record<string, { jp: string; kana: string; vi: string }> = {
    '抱く': {
      jp: '子供を抱く。',
      kana: 'こどもをだく。',
      vi: 'Bé đứa trẻ.',
    },
    '誘う': {
      jp: '友達を旅行に誘う。',
      kana: 'ともだちをりょこうにさそう。',
      vi: 'Rủ bạn đi du lịch.',
    },
    '高齢': {
      jp: '日本は高齢化社会だ。',
      kana: 'にほんはこうれいかしゃかいだ。',
      vi: 'Nhật Bản là xã hội già hóa.',
    },
    '目上': {
      jp: '目上の人に敬語を使う。',
      kana: 'めうえのひとにけいごをつかう。',
      vi: 'Dùng kính ngữ với người trên.',
    },
    '先輩': {
      jp: '先輩にアドバイスをもらう。',
      kana: 'せんぱいにアドバイスをもらう。',
      vi: 'Nhận lời khuyên từ tiền bối.',
    },
  };

  if (map[item.kanji]) {
    return map[item.kanji];
  }

  return {
    jp: `日本語の${item.kanji}を毎日勉強しています。`,
    kana: `${item.hiragana}をまいにちべんきょうしています。`,
    vi: `Tôi đang học từ "${item.meaning}" mỗi ngày.`,
  };
}

export function VocabularyPage() {
  const { vocabulary, isBookmarked, toggleBookmark } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'main' | 'compound' | 'bookmarked'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'N3' | 'N4'>('all');
  const [focusMode, setFocusMode] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter and search vocabulary
  const filtered = useMemo(() => {
    let items = vocabulary;

    if (levelFilter !== 'all') items = items.filter((v) => v.level === levelFilter);
    if (filter === 'main') items = items.filter((v) => v.type === 'main');
    if (filter === 'compound') items = items.filter((v) => v.type === 'compound');
    if (filter === 'bookmarked') items = items.filter((v) => isBookmarked(v.id));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (v) =>
          v.kanji.toLowerCase().includes(q) ||
          v.hiragana.toLowerCase().includes(q) ||
          v.meaning.toLowerCase().includes(q)
      );
    }

    return items;
  }, [vocabulary, filter, levelFilter, searchQuery, isBookmarked]);

  const currentCard = filtered[focusIndex] || filtered[0];

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in input
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (focusMode) return; // Flashcard session handles its own keys

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusIndex((prev) => Math.min(prev + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIndex((prev) => Math.max(prev - 1, 0));
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          if (filtered.length > 0) {
            setFocusMode(true);
          }
          break;
        case 'b':
        case 'B':
          if (currentCard) toggleBookmark(currentCard.id, 'vocabulary');
          break;
        case '/':
        case 'k':
          if (e.metaKey || e.ctrlKey || e.key === '/') {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, filtered.length, currentCard, toggleBookmark]);

  const enterFocusMode = useCallback((index: number) => {
    setFocusIndex(index);
    setFocusMode(true);
  }, []);

  // When Launch Focus Mode is triggered, render our science-backed Quizlet Plus session
  if (focusMode && filtered.length > 0) {
    return (
      <VocabFlashcardSession
        items={filtered}
        initialIndex={focusIndex}
        preserveOrder={true}
        onExit={() => setFocusMode(false)}
      />
    );
  }

  const example = currentCard ? getExampleContext(currentCard) : null;
  const relatedList = currentCard ? parseRelatedWords(currentCard.relatedWords) : [];

  return (
    <div className="w-full select-none pb-12">
      {/* 2-Column Apple/Quizlet Lexicon Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ============================================================
            LEFT COLUMN (7 Spans): Vocabulary List & Table
            ============================================================ */}
        <div className="lg:col-span-7 space-y-4">
          {/* Title and Count Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-[#1E293B] dark:text-white tracking-tight">
              Vocabulary
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                {filtered.length} of {vocabulary.length} words
              </span>
              <div className="flex gap-1 bg-[#F1F5F9] dark:bg-[#1E293B] rounded-lg p-0.5 border border-[#E2E8F0] dark:border-[#334155]">
                {(['all', 'N3', 'N4'] as const).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors ${
                      levelFilter === lvl
                        ? 'bg-white dark:bg-[#334155] text-[#1E293B] dark:text-white shadow-sm'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white'
                    }`}
                  >
                    {lvl === 'all' ? 'TẤT CẢ' : lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
            <Search size={18} className="text-[#94A3B8] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusIndex(0);
              }}
              placeholder="Search by kanji, hiragana, or meaning..."
              className="flex-1 bg-transparent text-sm text-[#1E293B] dark:text-white outline-none placeholder:text-[#94A3B8]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="cursor-pointer text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'main', 'compound', 'bookmarked'] as const).map((f) => {
              const labels: Record<string, string> = {
                all: 'All Words',
                main: 'Main',
                compound: 'Compounds',
                bookmarked: '★ Saved',
              };
              const active = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setFocusIndex(0);
                  }}
                  className={`
                    px-3.5 py-1.5 rounded-lg text-xs font-medium
                    transition-all duration-150 cursor-pointer
                    ${
                      active
                        ? 'bg-[#2563EB] text-white shadow-sm font-semibold'
                        : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                    }
                  `}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Table Header Row */}
          <div className="flex items-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] border-b border-[#E2E8F0] dark:border-[#334155] select-none">
            <div className="w-28 shrink-0">KANJI</div>
            <div className="w-32 shrink-0">READING</div>
            <div className="flex-1">VIETNAMESE</div>
            <div className="w-6 shrink-0" />
          </div>

          {/* Table Rows */}
          <div className="space-y-0.5">
            {filtered.map((item, index) => {
              const isSelected = index === focusIndex;
              const bookmarked = isBookmarked(item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => setFocusIndex(index)}
                  onDoubleClick={() => enterFocusMode(index)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3.5
                    border-b border-[#E2E8F0]/70 dark:border-[#334155]/70
                    transition-colors duration-150 cursor-pointer text-left
                    ${
                      isSelected
                        ? 'bg-[#EFF6FF]/70 dark:bg-[#1E293B] border-l-4 border-l-[#2563EB]'
                        : 'border-l-4 border-l-transparent hover:bg-[#F8FAFC] dark:hover:bg-white/5'
                    }
                  `}
                >
                  <div className="flex items-center min-w-0 flex-1">
                    {/* Kanji */}
                    <span className="font-jp-serif text-lg font-bold text-[#1E293B] dark:text-white w-28 shrink-0">
                      {item.kanji}
                    </span>

                    {/* Reading */}
                    <span className="font-jp text-sm font-medium text-[#64748B] dark:text-[#94A3B8] w-32 shrink-0">
                      {item.hiragana}
                    </span>

                    {/* Meaning and Badges */}
                    <div className="flex-1 flex flex-col items-start min-w-0">
                      <span className="text-sm font-medium text-[#1E293B] dark:text-[#F8FAFC] w-full truncate">
                        {item.meaning}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.type === 'compound' && (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                            Compound
                          </span>
                        )}
                        {item.level && (
                          <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                            item.level === 'N3' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}>
                            {item.level}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Bookmark Indicator */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBookmark(item.id, 'vocabulary');
                    }}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0 ml-2"
                    title={bookmarked ? 'Remove bookmark' : 'Bookmark word'}
                  >
                    {bookmarked ? (
                      <BookmarkCheck size={16} className="text-[#F59E0B]" />
                    ) : (
                      <Bookmark size={16} className="text-[#94A3B8] hover:text-[#1E293B] dark:hover:text-white" />
                    )}
                  </button>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm text-[#94A3B8]">
                No vocabulary items match your search or filter.
              </div>
            )}
          </div>
        </div>

        {/* ============================================================
            RIGHT COLUMN (5 Spans): Sticky Inspector View & 5 Cards
            ============================================================ */}
        <div className="lg:col-span-5 sticky top-20 space-y-4">
          {currentCard ? (
            <>
              {/* Top Bar of Inspector */}
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  {currentCard.lesson ? currentCard.lesson.toUpperCase() : 'LESSON 1'} · N3 CURRICULUM
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleBookmark(currentCard.id, 'vocabulary')}
                    className="p-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    title="Bookmark word"
                  >
                    {isBookmarked(currentCard.id) ? (
                      <BookmarkCheck size={18} className="text-[#F59E0B]" />
                    ) : (
                      <Bookmark size={18} className="text-[#64748B] dark:text-[#94A3B8]" />
                    )}
                  </button>

                  <button
                    onClick={() => enterFocusMode(focusIndex)}
                    className="
                      flex items-center gap-2 px-4 py-2 rounded-xl
                      bg-[#2563EB] text-white text-sm font-semibold
                      hover:bg-[#1D4ED8] shadow-sm
                      transition-all duration-150 cursor-pointer
                    "
                  >
                    <Eye size={16} />
                    <span>Launch Focus Mode</span>
                  </button>
                </div>
              </div>

              {/* CARD 1: MAIN VOCABULARY */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B] dark:text-[#94A3B8] mb-3">
                  MAIN VOCABULARY
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-jp-serif text-5xl md:text-6xl font-bold text-[#1E293B] dark:text-[#F8FAFC] tracking-tight">
                      {currentCard.kanji}
                    </div>
                    <div className="font-jp text-xl font-medium text-[#2563EB] dark:text-[#60A5FA] mt-2.5">
                      {currentCard.hiragana}
                    </div>
                  </div>

                  <button
                    onClick={() => speakJapanese(currentCard.kanji)}
                    className="p-3 rounded-full hover:bg-[#F1F5F9] dark:hover:bg-white/10 text-[#2563EB] dark:text-[#60A5FA] transition-colors"
                    title="Nghe phát âm"
                  >
                    <Volume2 size={24} />
                  </button>
                </div>
              </div>

              {/* CARD 2: VIETNAMESE MEANING */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B] dark:text-[#94A3B8] mb-2">
                  VIETNAMESE MEANING
                </div>
                <div className="text-2xl md:text-3xl font-bold text-[#1E293B] dark:text-[#F8FAFC] leading-snug">
                  {currentCard.meaning}
                </div>
              </div>

              {/* CARD 3: EXAMPLE CONTEXT */}
              {example && (
                <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B] dark:text-[#94A3B8] mb-3">
                    EXAMPLE CONTEXT
                  </div>
                  <p className="font-jp text-base font-bold text-[#1E293B] dark:text-[#F8FAFC]">
                    {example.jp}
                  </p>
                  <p className="font-jp text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {example.kana}
                  </p>
                  <p className="text-sm font-medium text-[#475569] dark:text-[#CBD5E1] pt-1 italic">
                    {example.vi}
                  </p>
                </div>
              )}

              {/* CARD 4: RELATED & EXPANDED */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B] dark:text-[#94A3B8] mb-3">
                  RELATED & EXPANDED
                </div>
                {relatedList.length > 0 ? (
                  <div className="flex flex-col items-start gap-2.5 w-full">
                    {relatedList.map((v, i) => (
                      <div
                        key={i}
                        className="flex items-baseline gap-2.5 w-full py-1.5 border-b last:border-b-0 border-[#E2E8F0]/50 dark:border-[#334155]/50 text-left"
                      >
                        {v.word ? (
                          <div className="flex items-baseline gap-2.5 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 flex-wrap">
                              {v.type === 'compound' && (
                                <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase tracking-wider">
                                  Compound
                                </span>
                              )}
                              {v.level && (
                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                                  v.level === 'N3' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                }`}>
                                  {v.level}
                                </span>
                              )}
                            </div>
                            {/* BIG Kanji word */}
                            <span className="font-jp-serif font-bold text-xl md:text-2xl text-[#1E293B] dark:text-[#F8FAFC] shrink-0">
                              {v.word}
                            </span>
                            {/* Gold Reading in brackets */}
                            {v.reading && (
                              <span className="font-jp font-medium text-base md:text-lg text-[#C9A84C] shrink-0">
                                【{v.reading}】
                              </span>
                            )}
                            {/* Single-line Meaning */}
                            <span className="text-sm md:text-base text-[#64748B] dark:text-[#94A3B8] font-normal">
                              : {v.meaning ? v.meaning.replace(/[\r\n]+/g, ' ').trim() : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm md:text-base text-[#64748B] dark:text-[#94A3B8]">
                            {v.raw ? v.raw.replace(/[\r\n]+/g, ' ').trim() : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-[#94A3B8] italic">
                    Không có từ ghép mở rộng cho mục này.
                  </div>
                )}
              </div>

              {/* CARD 5: LEXICON NAVIGATION & ERGONOMICS */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748B] dark:text-[#94A3B8] mb-3">
                  LEXICON NAVIGATION & ERGONOMICS
                </div>
                <div className="space-y-2.5 text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                  <div className="flex items-center justify-between">
                    <span>Navigate Word List</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#E2E8F0] font-mono">
                      ↑ / ↓
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Focus Selected Card</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#E2E8F0] font-mono">
                      Space / Enter
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Toggle Bookmark</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#E2E8F0] font-mono">
                      B
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Global Search</span>
                    <kbd className="px-2 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#E2E8F0] font-mono">
                      ⌘ / Ctrl + K
                    </kbd>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-center text-sm text-[#94A3B8]">
              Select a vocabulary word to inspect
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
