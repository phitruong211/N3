// ============================================================
// Flashcard Mode — Full Screen, Keyboard-Driven
// ============================================================
// Principles:
// - Flow State Design: Zero distractions, full immersion
// - Scaled Card Size: Large 5xl cards, big text
// - YouTube-style Fullscreen Icon Button: Placed in the bottom-right corner INSIDE the card
// ============================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '@/hooks/useApp';
import {
  X,
  BookmarkCheck,
  Sparkles,
  BookOpen,
  Volume2,
  Maximize2,
  Minimize2,
  Compass,
  Eye,
  EyeOff,
  Clock,
  Brain,
  CheckCircle2,
  RotateCcw,
  Hash,
  ChevronsRight,
} from 'lucide-react';
import type { VocabItem, KanjiItem, GrammarItem, Rating, SRSCard } from '@/types';
import {
  createSRSCard,
  processReview,
  getDueCards,
  getNextIntervals,
  formatCardInterval,
} from '@/lib/srs';
import {
  recordStudyActivity,
  getLastVocabIndex,
  setLastVocabIndex,
  getLastKanjiIndex,
  setLastKanjiIndex,
  getLastGrammarIndex,
  setLastGrammarIndex,
  getLastActiveDeck,
  setLastActiveDeck,
  type ActiveDeck,
} from '@/lib/storage';

// ============================================================
// Card Jump Control — Click counter to jump to any card
// ============================================================
function CardJumpControl({
  index,
  total,
  label,
  onJump,
}: {
  index: number;
  total: number;
  label: string;
  onJump: (idx: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const openEdit = () => {
    setInputVal(String(index + 1));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.select();
    }, 30);
  };

  const commit = () => {
    const num = parseInt(inputVal, 10);
    if (!isNaN(num) && num >= 1 && num <= total) {
      onJump(num - 1);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{label}</span>
        <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border-2 border-[var(--color-accent)] rounded-xl px-2 py-1 shadow-md">
          <Hash size={13} className="text-[var(--color-accent)] shrink-0" />
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={total}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
            }}
            onBlur={commit}
            className="w-16 bg-transparent text-sm font-mono font-bold text-[var(--color-text)] outline-none text-center"
            style={{ MozAppearance: 'textfield' } as React.CSSProperties}
          />
          <span className="text-xs text-[var(--color-text-tertiary)] font-mono">/ {total}</span>
          <button
            onMouseDown={(e) => { e.preventDefault(); commit(); }}
            className="ml-1 p-1 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity cursor-pointer"
            title="Nhảy đến thẻ"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={openEdit}
      title="Click để nhảy đến thẻ bất kỳ"
      className="group flex items-center gap-2 font-mono font-semibold text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer transition-colors"
    >
      <span className="group-hover:underline underline-offset-2">
        {label} <span className="text-[var(--color-accent)]">{index + 1}</span>
        <span className="text-[var(--color-text-tertiary)]"> / {total}</span>
      </span>
      <Hash size={13} className="opacity-0 group-hover:opacity-60 transition-opacity" />
    </button>
  );
}

// ============================================================
// useSwipeGesture — Touch swipe for mobile navigation
// ============================================================
function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  threshold = 50,
}: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  threshold?: number;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setSwipeDir(null);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.touches[0].clientX - touchStart.current.x;
    if (Math.abs(dx) > 20) {
      setSwipeDir(dx < 0 ? 'left' : 'right');
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    setSwipeDir(null);

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDy > absDx && dy < -threshold && onSwipeUp) {
      onSwipeUp();
    } else if (absDx > threshold && absDx > absDy) {
      if (dx < 0 && onSwipeLeft) onSwipeLeft();
      else if (dx > 0 && onSwipeRight) onSwipeRight();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, threshold]);

  return { onTouchStart, onTouchMove, onTouchEnd, swipeDir };
}

// ============================================================
// Mobile-optimised Anki 4-button grid (2×2)
// ============================================================
function MobileAnkiControls({
  itemId,
  itemType,
  onRate,
}: {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  onRate: (rating: Rating) => void;
}) {
  const { srsCards } = useApp();
  const currentCard = useMemo(() => {
    return (
      srsCards.find((c) => c.cardId === itemId && c.deckType === itemType) ||
      createSRSCard(itemId, itemType)
    );
  }, [srsCards, itemId, itemType]);
  const intervals = useMemo(() => getNextIntervals(currentCard), [currentCard]);

  const btns: { rating: Rating; label: string; sub: string; cls: string }[] = [
    { rating: 'again', label: '1 · Quên', sub: intervals.again, cls: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400 active:bg-rose-500/25' },
    { rating: 'hard',  label: '2 · Khó',  sub: intervals.hard,  cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 active:bg-amber-500/25' },
    { rating: 'good',  label: '3 · Nhớ',  sub: intervals.good,  cls: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 active:bg-blue-500/25' },
    { rating: 'easy',  label: '4 · Dễ',   sub: intervals.easy,  cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 active:bg-emerald-500/25' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {btns.map(({ rating, label, sub, cls }) => (
        <button
          key={rating}
          onClick={(e) => { e.stopPropagation(); onRate(rating); }}
          className={`flex flex-col items-center justify-center py-3 rounded-2xl border font-semibold text-sm transition-all cursor-pointer ${cls}`}
        >
          <span className="font-bold">{label}</span>
          <span className="text-[11px] font-mono opacity-75 mt-0.5">{sub}</span>
        </button>
      ))}
    </div>
  );
}

export function AnkiCardBadge({
  itemId,
  itemType,
}: {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
}) {
  const { srsCards } = useApp();
  const card = srsCards.find((c) => c.cardId === itemId && c.deckType === itemType);

  if (!card || card.state === 'new') {
    return (
      <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs select-none">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span>Anki SRS: Thẻ mới (Chưa học)</span>
      </div>
    );
  }

  const stageLabels = {
    learning: 'Đang làm quen',
    review: 'Đang ôn tập',
    relearning: 'Đã quên (Học lại)',
    new: 'Chưa học',
  };

  return (
    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs select-none">
      <span className="w-2 h-2 rounded-full bg-emerald-500" />
      <span>
        Anki SRS: {stageLabels[card.state as keyof typeof stageLabels]} · Lặp lại sau {formatCardInterval(card)}
      </span>
    </div>
  );
}

// ============================================================
// Anki SRS 4-Rating Control Toolbar (Again/Hard/Good/Easy)
// ============================================================
export function AnkiSRSControls({
  itemId,
  itemType,
  onRate,
}: {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  onRate: (rating: Rating) => void;
}) {
  const { srsCards } = useApp();
  const currentCard = useMemo(() => {
    return (
      srsCards.find((c) => c.cardId === itemId && c.deckType === itemType) ||
      createSRSCard(itemId, itemType)
    );
  }, [srsCards, itemId, itemType]);

  const intervals = useMemo(() => getNextIntervals(currentCard), [currentCard]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 w-full max-w-2xl my-2">
      {/* 1. Again */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate('again');
        }}
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 1: Học lại (Again)"
      >
        <span className="font-bold tracking-wider uppercase">1. Quên</span>
        <span className="text-[11px] font-mono opacity-80">{intervals.again}</span>
      </button>

      {/* 2. Hard */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate('hard');
        }}
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 2: Khó (Hard)"
      >
        <span className="font-bold tracking-wider uppercase">2. Khó</span>
        <span className="text-[11px] font-mono opacity-80">{intervals.hard}</span>
      </button>

      {/* 3. Good */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate('good');
        }}
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 3: Nhớ (Good)"
      >
        <span className="font-bold tracking-wider uppercase">3. Nhớ</span>
        <span className="text-[11px] font-mono opacity-80">{intervals.good}</span>
      </button>

      {/* 4. Easy */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate('easy');
        }}
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 4: Thuộc (Easy)"
      >
        <span className="font-bold tracking-wider uppercase">4. Dễ</span>
        <span className="text-[11px] font-mono opacity-80">{intervals.easy}</span>
      </button>
    </div>
  );
}

export function FlashcardPage() {
  const { vocabulary, kanji, grammar, isBookmarked, srsCards } = useApp();
  const [activeDeck, setActiveDeckState] = useState<ActiveDeck>(() => getLastActiveDeck());

  const setActiveDeck = useCallback((deck: ActiveDeck) => {
    setLastActiveDeck(deck);
    setActiveDeckState(deck);
  }, []);

  // Persistent Anki Mode setting in localStorage (biến nhớ kể cả khi tắt web)
  const [ankiMode, setAnkiMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('n3_anki_mode_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleAnkiMode = useCallback(() => {
    setAnkiMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('n3_anki_mode_enabled', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const savedVocabulary = vocabulary.filter((v) => isBookmarked(v.id));

  // Compute live Anki SRS due and mastered stats across the decks
  const dueCards = useMemo(() => getDueCards(srsCards), [srsCards]);

  const n3VocabIds = useMemo(() => new Set(vocabulary.filter(v => v.level !== 'N4').map(v => v.id)), [vocabulary]);
  const n4VocabIds = useMemo(() => new Set(vocabulary.filter(v => v.level === 'N4').map(v => v.id)), [vocabulary]);

  const n3GrammarIds = useMemo(() => new Set(grammar.filter(g => g.level !== 'N4').map(g => g.id)), [grammar]);
  const n4GrammarIds = useMemo(() => new Set(grammar.filter(g => g.level === 'N4').map(g => g.id)), [grammar]);

  const vocabN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'vocabulary' && n3VocabIds.has(c.cardId)).length, [dueCards, n3VocabIds]);
  const vocabN4DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'vocabulary' && n4VocabIds.has(c.cardId)).length, [dueCards, n4VocabIds]);

  const kanjiN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'kanji').length, [dueCards]);

  const grammarN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'grammar' && n3GrammarIds.has(c.cardId)).length, [dueCards, n3GrammarIds]);
  const grammarN4DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'grammar' && n4GrammarIds.has(c.cardId)).length, [dueCards, n4GrammarIds]);

  const vocabN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'vocabulary' && c.intervalDays && c.intervalDays >= 21 && n3VocabIds.has(c.cardId)).length, [srsCards, n3VocabIds]);
  const vocabN4MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'vocabulary' && c.intervalDays && c.intervalDays >= 21 && n4VocabIds.has(c.cardId)).length, [srsCards, n4VocabIds]);

  const kanjiN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'kanji' && c.intervalDays && c.intervalDays >= 21).length, [srsCards]);

  const grammarN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'grammar' && c.intervalDays && c.intervalDays >= 21 && n3GrammarIds.has(c.cardId)).length, [srsCards, n3GrammarIds]);
  const grammarN4MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'grammar' && c.intervalDays && c.intervalDays >= 21 && n4GrammarIds.has(c.cardId)).length, [srsCards, n4GrammarIds]);

  if (activeDeck === 'vocabN3' || activeDeck === 'vocabN4' || activeDeck === 'saved') {
    let activeItems = vocabulary;
    if (activeDeck === 'vocabN3') activeItems = vocabulary.filter(v => v.level !== 'N4');
    if (activeDeck === 'vocabN4') activeItems = vocabulary.filter(v => v.level === 'N4');
    if (activeDeck === 'saved') activeItems = savedVocabulary;

    const savedIdx = Math.min(getLastVocabIndex(), Math.max(0, activeItems.length - 1));

    return (
      <VocabFlashcardSession
        items={activeItems}
        preserveOrder={true}
        initialIndex={savedIdx}
        onExit={() => setActiveDeck(null)}
        ankiMode={ankiMode}
        onToggleAnki={toggleAnkiMode}
      />
    );
  }

  if (activeDeck === 'kanjiN3') {
    const savedIdx = Math.min(getLastKanjiIndex(), Math.max(0, kanji.length - 1));
    return (
      <KanjiFlashcardSession
        items={kanji}
        initialIndex={savedIdx}
        onExit={() => setActiveDeck(null)}
        ankiMode={ankiMode}
        onToggleAnki={toggleAnkiMode}
      />
    );
  }

  if (activeDeck === 'grammarN3' || activeDeck === 'grammarN4') {
    const activeItems = activeDeck === 'grammarN3' ? grammar.filter(g => g.level !== 'N4') : grammar.filter(g => g.level === 'N4');
    const savedIdx = Math.min(getLastGrammarIndex(), Math.max(0, activeItems.length - 1));
    return (
      <GrammarFlashcardSession
        items={activeItems}
        preserveOrder={true}
        initialIndex={savedIdx}
        onExit={() => setActiveDeck(null)}
        ankiMode={ankiMode}
        onToggleAnki={toggleAnkiMode}
      />
    );
  }

  return (
    <div className="space-y-8 w-full pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] tracking-tight font-sans">
          Flashcards
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Học từ vựng, kanji và ngữ pháp với chế độ lặp lại ngắt quãng Anki SRS
        </p>
      </div>

      {/* ============================================================
          Anki SRS Spaced Repetition Control Banner (Soothing & Apple-like)
          ============================================================ */}
      <div className="p-6 sm:p-7 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)]/60 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Brain size={14} />
              <span>CHẾ ĐỘ HỌC ANKI (SPACED REPETITION)</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--color-text)]">
              Lặp lại ngắt quãng theo thời gian & độ nhớ
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Tự động nhắc lại từ vựng, kanji, ngữ pháp theo 4 mức độ nhớ (Quên, Khó, Nhớ, Dễ). Dữ liệu tiến độ được lưu vĩnh viễn trên trình duyệt kể cả khi tắt web.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Chế độ Anki:
            </span>
            <button
              onClick={toggleAnkiMode}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs
                ${
                  ankiMode
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border)]'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${ankiMode ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
              <span>{ankiMode ? 'ĐANG BẬT ANKI SRS' : 'ĐANG TẮT'}</span>
            </button>
          </div>
        </div>

        {/* Live Anki Stats for 3 Decks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[var(--color-text)]">Từ Vựng (Vocab)</div>
              <div className="text-[11px] text-[var(--color-text-secondary)]">
                Cần ôn hôm nay: <strong className="text-rose-500 font-bold">{vocabN3DueCount + vocabN4DueCount} thẻ</strong>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {vocabN3MasteredCount + vocabN4MasteredCount} thuộc
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[var(--color-text)]">Hán Tự (Kanji)</div>
              <div className="text-[11px] text-[var(--color-text-secondary)]">
                Cần ôn hôm nay: <strong className="text-rose-500 font-bold">{kanjiN3DueCount} thẻ</strong>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {kanjiN3MasteredCount} thuộc
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/50 border border-[var(--color-border)]/60 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-[var(--color-text)]">Ngữ Pháp (Grammar)</div>
              <div className="text-[11px] text-[var(--color-text-secondary)]">
                Cần ôn hôm nay: <strong className="text-rose-500 font-bold">{grammarN3DueCount + grammarN4DueCount} thẻ</strong>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              {grammarN3MasteredCount + grammarN4MasteredCount} thuộc
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-10 w-full">
        {/* ============================================================
            N4 DECKS
            ============================================================ */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-[var(--color-text)] uppercase tracking-wider">Trình độ N4</h2>
            <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* N4 Vocabulary Deck */}
            <button
              onClick={() => setActiveDeck('vocabN4')}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-purple-500 hover:bg-purple-500/5
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  Vocab Deck
                </span>
                <BookOpen size={20} className="text-purple-500" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Từ vựng N4
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {n4VocabIds.size} từ vựng · {ankiMode ? `Anki SRS (${vocabN4DueCount} cần ôn)` : 'Tuần tự'}
              </div>
            </button>

            {/* N4 Grammar Deck */}
            <button
              onClick={() => setActiveDeck('grammarN4')}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-rose-500 hover:bg-rose-500/5
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  Grammar Deck
                </span>
                <Compass size={20} className="text-rose-500" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Ngữ pháp N4
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {n4GrammarIds.size} mẫu câu · {ankiMode ? `Anki SRS (${grammarN4DueCount} cần ôn)` : 'Tuần tự'}
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================
            N3 DECKS
            ============================================================ */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-[var(--color-text)] uppercase tracking-wider">Trình độ N3</h2>
            <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* N3 Vocabulary Deck */}
            <button
              onClick={() => setActiveDeck('vocabN3')}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-blue-500 hover:bg-[var(--color-accent-subtle)]/30
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/15 text-[#1D63ED]">
                  Vocab Deck
                </span>
                <BookOpen size={20} className="text-[#1D63ED]" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Từ vựng N3
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {n3VocabIds.size} từ vựng · {ankiMode ? `Anki SRS (${vocabN3DueCount} cần ôn)` : 'Tuần tự'}
              </div>
            </button>

            {/* N3 Kanji Deck */}
            <button
              onClick={() => setActiveDeck('kanjiN3')}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-amber-500 hover:bg-amber-500/5
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  Kanji Deck
                </span>
                <Sparkles size={20} className="text-amber-500" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Hán tự N3
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {kanji.length} hán tự · {ankiMode ? `Anki SRS (${kanjiN3DueCount} cần ôn)` : 'Tuần tự'}
              </div>
            </button>

            {/* N3 Grammar Deck */}
            <button
              onClick={() => setActiveDeck('grammarN3')}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-emerald-500 hover:bg-emerald-500/5
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Grammar Deck
                </span>
                <Compass size={20} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Ngữ pháp N3
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {n3GrammarIds.size} mẫu câu · {ankiMode ? `Anki SRS (${grammarN3DueCount} cần ôn)` : 'Tuần tự'}
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================
            OTHER DECKS
            ============================================================ */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-[var(--color-text)] uppercase tracking-wider">Khác</h2>
            <div className="flex-1 h-px bg-[var(--color-border)]/50"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Saved Bookmarks Deck */}
            <button
              onClick={() => savedVocabulary.length > 0 && setActiveDeck('saved')}
              disabled={savedVocabulary.length === 0}
              className="
                group p-6 rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]/70
                hover:border-emerald-500 hover:bg-emerald-500/5
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
              "
            >
              <div className="flex items-center justify-between mb-3">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Saved Deck
                </span>
                <BookmarkCheck size={20} className="text-emerald-500" />
              </div>
              <div className="text-lg font-bold text-[var(--color-text)] mb-1">
                Saved Bookmarks Deck
              </div>
              <div className="text-sm text-[var(--color-text-secondary)]">
                {savedVocabulary.length} thẻ đã lưu
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function parseRelatedWords(rawText?: string) {
  if (!rawText) return [];
  const parts = rawText.split(/(?:[,;]|\r?\n)\s*(?=[^\(（【\[,;]+[\(（【\[])/);
  const items: { word: string; reading: string; meaning: string; raw: string; type?: string; level?: string }[] = [];

  for (const part of parts) {
    const trimmed = part.trim().replace(/^[,;]\s*/, '');
    if (!trimmed) continue;
    const match = trimmed.match(/^([^\(（【\[]+)[\(（【\[]([^\)）】\]]+)[\)）】\]]\s*[:：]?\s*(.*)$/);
    if (match) {
      items.push({
        word: match[1].trim(),
        reading: match[2].trim(),
        meaning: match[3].trim().replace(/[\r\n]+/g, ' '),
        raw: trimmed.replace(/[\r\n]+/g, ' '),
      });
    } else {
      items.push({ word: '', reading: '', meaning: '', raw: trimmed.replace(/[\r\n]+/g, ' ') });
    }
  }
  return items;
}

export function speakJapanese(text?: string) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

// ============================================================
// Fullscreen Vocabulary Flashcard Session
// ============================================================

export function VocabFlashcardSession({
  items,
  onExit,
  initialIndex = 0,
  preserveOrder = true,
  ankiMode = true,
  onToggleAnki,
}: {
  items: VocabItem[];
  onExit: () => void;
  initialIndex?: number;
  preserveOrder?: boolean;
  ankiMode?: boolean;
  onToggleAnki?: () => void;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shuffledItems] = useState(() =>
    preserveOrder ? [...items] : [...items].sort(() => Math.random() - 0.5)
  );

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    setLastVocabIndex(idx);
    setFlipped(false);
  }, []);

  const current = shuffledItems[index];
  const total = shuffledItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: any) => {
    if (isAnki !== true) {
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setLastVocabIndex(nextIdx);
      setFlipped(false);
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastVocabIndex(prevIdx);
      setFlipped(false);
    }
  }, [index]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'vocabulary');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      next(true);
    },
    [srsCards, current.id, updateSRSCard, next]
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit();
  }, [onExit]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keyboard controls including Anki keys 1, 2, 3, 4
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          flip();
          break;
        case '=':
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'Escape':
          e.preventDefault();
          handleExit();
          break;
        case '1':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('again');
          }
          break;
        case '2':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('hard');
          }
          break;
        case '3':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('good');
          }
          break;
        case '4':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('easy');
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, handleExit, ankiMode, flipped, handleAnkiRate]);

  if (!current) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-gradient-to-b from-[var(--color-bg)] via-[var(--color-surface-alt)]/40 to-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      {/* Top bar — compact on mobile */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Exit (Esc)</span>
          </button>

          {onToggleAnki && (
            <button
              onClick={onToggleAnki}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                ankiMode
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              <Brain size={15} />
              <span className="hidden sm:inline">{ankiMode ? 'Anki: BẬT' : 'Anki: TẮT'}</span>
              <span className="sm:hidden">{ankiMode ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        {/* Progress bar + jump */}
        <div className="flex items-center gap-2 sm:gap-4">
          <CardJumpControl index={index} total={total} label="Vocab" onJump={jumpTo} />
          <div className="w-24 sm:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          {isFullscreen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] font-bold tracking-wide shadow-2xs animate-pulse">
              <span>✦ ZEN FULLSCREEN</span>
            </span>
          ) : (
            <span>Vocab Mode</span>
          )}
        </div>
      </div>

      {/* Card area — flex-1, swipeable */}
      <div
        className="flex-1 flex items-stretch px-3 py-2 sm:px-6 sm:py-4"
        {...swipe}
      >
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-hidden
            ${
              isFullscreen
                ? 'max-w-5xl lg:max-w-6xl mx-auto rounded-[2.5rem] bg-[var(--color-surface)] border-2 border-[#C9A84C]/45 shadow-[0_0_70px_rgba(201,168,76,0.18)] p-6 sm:p-16'
                : 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg p-5 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left: Lesson + Anki Badge */}
          <div className="absolute top-3 left-3 sm:top-8 sm:left-10 flex flex-wrap items-center gap-2 select-none">
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide">
              {current.lesson || 'N3 Vocab'}
            </div>
            {ankiMode && <AnkiCardBadge itemId={current.id} itemType="vocabulary" />}
          </div>

          {/* Fullscreen button */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className={`
              absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 p-2.5 rounded-xl
              transition-all duration-200 cursor-pointer focus-ring
              flex items-center gap-2 text-xs font-bold
              ${
                isFullscreen
                  ? 'bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/50 text-[#C9A84C] shadow-md'
                  : 'bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] backdrop-blur-xs shadow-2xs'
              }
            `}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Focus'}</span>
          </div>

          {/* Swipe hint — mobile only */}
          {swipe.swipeDir && (
            <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-4xl font-bold opacity-30 transition-all ${swipe.swipeDir === 'left' ? 'right-4' : 'left-4'}`}>
              {swipe.swipeDir === 'left' ? '→' : '←'}
            </div>
          )}

          {!flipped ? (
            <div className="text-center flex flex-col items-center justify-center my-auto gap-4 sm:gap-6">
              <div
                className="font-jp-serif font-bold tracking-tight transition-all duration-300"
                style={{
                  fontSize: isFullscreen ? 'clamp(7.5rem, 22vw, 13rem)' : 'clamp(4.5rem, 18vw, 11rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>

              <div className="mt-2 flex items-center justify-center gap-3 text-sm sm:text-base font-semibold text-[var(--color-text-secondary)] opacity-80 tracking-wide select-none">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); speakJapanese(current.kanji); }}
                  title="Nghe phát âm"
                  className="p-2.5 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-accent)]"
                >
                  <Volume2 size={22} />
                </div>
                <span>•</span>
                <span className="hidden sm:inline">Click / Space to Flip</span>
                <span className="sm:hidden text-xs">Chạm để lật • Vuốt ← →</span>
              </div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center gap-4 sm:gap-6 w-full max-w-2xl my-auto">
              <div
                className="font-extrabold tracking-tight text-center"
                style={{
                  fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
                  color: 'var(--color-text)',
                  lineHeight: 1.2,
                }}
              >
                {current.meaning}
              </div>

              <div
                className="font-jp font-bold"
                style={{
                  fontSize: 'clamp(1.3rem, 3.5vw, 2.2rem)',
                  color: '#C9A84C',
                }}
              >
                【{current.hiragana}】
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 sm:px-8 sm:py-5 border-t border-[var(--color-border)] shrink-0">
        {/* Desktop shortcut hints */}
        <div className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-tertiary)] font-mono mb-3">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating</span>}
          <span>Esc = Exit</span>
        </div>

        {/* Anki controls */}
        {ankiMode && flipped ? (
          <>
            {/* Mobile: 2×2 grid */}
            <div className="sm:hidden">
              <MobileAnkiControls itemId={current.id} itemType="vocabulary" onRate={handleAnkiRate} />
            </div>
            {/* Desktop: original horizontal */}
            <div className="hidden sm:flex justify-center">
              <AnkiSRSControls itemId={current.id} itemType="vocabulary" onRate={handleAnkiRate} />
            </div>
          </>
        ) : ankiMode && !flipped ? (
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-3 rounded-xl">
            <span>💡 <span className="hidden sm:inline">Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span><span className="sm:hidden">Chạm để lật thẻ · Vuốt ← → chuyển</span></span>
          </div>
        ) : (
          /* Non-Anki mode: prev/next */
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-sm"
            >
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Vocab" onJump={jumpTo} />
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-sm"
            >
              Tiếp →
            </button>
          </div>
        )}

        {/* Anki mode footer nav row */}
        {ankiMode && (
          <div className="flex items-center justify-between gap-3 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Vocab" onJump={jumpTo} />
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="px-4 py-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Fullscreen Kanji Flashcard Session
// ============================================================


        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span>Exit Session (Esc)</span>
          </button>

          {onToggleAnki && (
            <button
              onClick={onToggleAnki}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                ankiMode
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              <Brain size={15} />
              <span>{ankiMode ? 'Anki SRS: BẬT' : 'Anki SRS: TẮT'}</span>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <CardJumpControl
            index={index}
            total={total}
            label="Vocab"
            onJump={jumpTo}
          />
          <div className="w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end text-xs text-[var(--color-text-tertiary)] hidden sm:flex">
          {isFullscreen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] font-bold tracking-wide shadow-2xs animate-pulse">
              <span>✦ ZEN FULLSCREEN</span>
            </span>
          ) : (
            <span>Vocab Mode</span>
          )}
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 py-6">
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-hidden
            ${
              isFullscreen
                ? 'max-w-5xl lg:max-w-6xl min-h-[580px] sm:min-h-[660px] rounded-[2.5rem] bg-[var(--color-surface)] border-2 border-[#C9A84C]/45 shadow-[0_0_70px_rgba(201,168,76,0.18)] p-10 sm:p-16'
                : 'max-w-4xl lg:max-w-5xl min-h-[460px] sm:min-h-[520px] rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg hover:shadow-xl p-8 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left (Anchor): Lesson Pill & Anki Badge */}
          <div className="absolute top-8 left-10 flex flex-wrap items-center gap-2 select-none">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide">
              {current.lesson || 'N3 Vocab'}
            </div>
            {ankiMode && <AnkiCardBadge itemId={current.id} itemType="vocabulary" />}
          </div>

          {/* YouTube-style Fullscreen Icon Button (Bottom Right inside card) */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            className={`
              absolute bottom-6 right-6 z-20 p-3 rounded-2xl
              transition-all duration-200 cursor-pointer focus-ring
              flex items-center gap-2 text-xs font-bold
              ${
                isFullscreen
                  ? 'bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/50 text-[#C9A84C] shadow-md'
                  : 'bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] backdrop-blur-xs shadow-2xs'
              }
            `}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={18} />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 size={18} />
                <span>Fullscreen Focus</span>
              </>
            )}
          </div>

          {!flipped ? (
            /* Front Side (Question view) — Huge Kanji */
            <div className="text-center flex flex-col items-center justify-center my-auto gap-6">
              <div
                className="font-jp-serif font-bold tracking-tight transition-all duration-300"
                style={{
                  fontSize: isFullscreen ? 'clamp(7.5rem, 22vw, 13rem)' : 'clamp(6rem, 18vw, 11rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 text-base font-semibold text-[var(--color-text-secondary)] opacity-80 tracking-wide select-none">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    speakJapanese(current.kanji);
                  }}
                  title="Nghe phát âm"
                  className="p-2.5 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-accent)]"
                >
                  <Volume2 size={22} />
                </div>
                <span>•</span>
                <span>Click / Space to Flip</span>
              </div>
            </div>
          ) : (
            /* Back Side (Answer view) — Scaled up text */
            <div className="text-center flex flex-col items-center justify-center gap-6 w-full max-w-2xl my-auto">
              <div
                className="font-extrabold tracking-tight text-center"
                style={{
                  fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
                  color: 'var(--color-text)',
                  lineHeight: 1.2,
                }}
              >
                {current.meaning}
              </div>

              <div
                className="font-jp font-bold"
                style={{
                  fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
                  color: '#C9A84C',
                }}
              >
                【{current.hiragana}】
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Footer / Shortcut Badges */}
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--color-text-tertiary)] font-mono">
        <div className="flex items-center gap-6 hidden md:flex">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating (Khi lật thẻ)</span>}
          <span>Esc = Exit Session / Fullscreen</span>
        </div>

        {ankiMode && flipped ? (
          <AnkiSRSControls
            itemId={current.id}
            itemType="vocabulary"
            onRate={handleAnkiRate}
          />
        ) : ankiMode && !flipped ? (
          <div className="flex items-center gap-2 mx-auto md:mx-0 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-2 rounded-xl">
            <span>💡 Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mx-auto md:mx-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✕ Chưa nhớ</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✓ Đã nhớ</span>
            </button>
          </div>
        )}

        <CardJumpControl
          index={index}
          total={total}
          label="Vocab"
          onJump={jumpTo}
        />
      </div>
    </div>
  );
}

// ============================================================
// Fullscreen Kanji Flashcard Session
// ============================================================

function KanjiFlashcardSession({
  items,
  onExit,
  initialIndex = 0,
  ankiMode = true,
  onToggleAnki,
}: {
  items: KanjiItem[];
  onExit: () => void;
  initialIndex?: number;
  ankiMode?: boolean;
  onToggleAnki?: () => void;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    setLastKanjiIndex(idx);
    setFlipped(false);
  }, []);

  // Preserve exact dataset order from start to end (1 -> N)
  const current = items[index];
  const total = items.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: any) => {
    if (isAnki !== true) {
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setLastKanjiIndex(nextIdx);
      setFlipped(false);
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastKanjiIndex(prevIdx);
      setFlipped(false);
    }
  }, [index]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'kanji');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      next(true);
    },
    [srsCards, current.id, updateSRSCard, next]
  );

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit();
  }, [onExit]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keyboard controls including Anki keys 1, 2, 3, 4
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          flip();
          break;
        case '=':
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'Escape':
          e.preventDefault();
          handleExit();
          break;
        case '1':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('again');
          }
          break;
        case '2':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('hard');
          }
          break;
        case '3':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('good');
          }
          break;
        case '4':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('easy');
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, handleExit, ankiMode, flipped, handleAnkiRate]);

  if (!current) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-gradient-to-b from-[var(--color-bg)] via-[var(--color-surface-alt)]/40 to-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      {/* Top bar — compact on mobile */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Exit (Esc)</span>
          </button>

          {onToggleAnki && (
            <button
              onClick={onToggleAnki}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                ankiMode
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              <Brain size={15} />
              <span className="hidden sm:inline">{ankiMode ? 'Anki: BẬT' : 'Anki: TẮT'}</span>
              <span className="sm:hidden">{ankiMode ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <CardJumpControl index={index} total={total} label="Kanji" onJump={jumpTo} />
          <div className="w-24 sm:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          {isFullscreen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] font-bold tracking-wide shadow-2xs animate-pulse">
              <span>✦ ZEN FULLSCREEN</span>
            </span>
          ) : (
            <span>Kanji Mode</span>
          )}
        </div>
      </div>

      {/* Card area — swipeable */}
      <div className="flex-1 flex items-stretch px-3 py-2 sm:px-6 sm:py-4" {...swipe}>
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-hidden
            ${
              isFullscreen
                ? 'max-w-5xl lg:max-w-6xl mx-auto rounded-[2.5rem] bg-[var(--color-surface)] border-2 border-[#C9A84C]/45 shadow-[0_0_70px_rgba(201,168,76,0.18)] p-6 sm:p-16'
                : 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg p-5 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Showing answer' : 'Showing question'}
        >
          {ankiMode && (
            <div className="absolute top-3 left-3 sm:top-8 sm:left-10 flex items-center select-none">
              <AnkiCardBadge itemId={current.id} itemType="kanji" />
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className={`
              absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 p-2.5 rounded-xl
              transition-all duration-200 cursor-pointer focus-ring flex items-center gap-2 text-xs font-bold
              ${isFullscreen
                ? 'bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/50 text-[#C9A84C] shadow-md'
                : 'bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] backdrop-blur-xs shadow-2xs'}
            `}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </div>

          {swipe.swipeDir && (
            <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-4xl font-bold opacity-30 ${swipe.swipeDir === 'left' ? 'right-4' : 'left-4'}`}>
              {swipe.swipeDir === 'left' ? '→' : '←'}
            </div>
          )}

          {!flipped ? (
            <div className="text-center flex flex-col items-center gap-4 sm:gap-6 my-auto">
              <div
                className="font-jp-serif font-bold tracking-tight transition-all duration-300"
                style={{
                  fontSize: isFullscreen ? 'clamp(7.5rem, 22vw, 13rem)' : 'clamp(4.5rem, 18vw, 11rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>
              <div
                className="uppercase font-extrabold"
                style={{
                  fontSize: 'clamp(1.1rem, 4vw, 2.2rem)',
                  color: '#C9A84C',
                  letterSpacing: '0.3em',
                }}
              >
                {current.hanViet}
              </div>
              <div className="text-xs sm:hidden text-[var(--color-text-tertiary)]">Chạm để lật • Vuốt ← →</div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center gap-4 sm:gap-6 w-full max-w-xl my-auto">
              {current.vocabulary && current.vocabulary.length > 0 ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  {current.vocabulary.slice(0, 3).map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="flex items-baseline gap-3 justify-center flex-wrap">
                        <span className="font-jp-serif font-bold" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', color: 'var(--color-text)' }}>
                          {v.word}
                        </span>
                        <span className="font-jp font-bold" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', color: '#C9A84C' }}>
                          【{v.reading}】
                        </span>
                      </div>
                      {v.meaning && (
                        <div className="font-semibold" style={{ fontSize: 'clamp(0.9rem, 2.2vw, 1.3rem)', color: 'var(--color-text-secondary)' }}>
                          {v.meaning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="uppercase font-extrabold" style={{ fontSize: '2rem', color: '#C9A84C', letterSpacing: '0.3em' }}>
                  {current.hanViet}
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 sm:px-8 sm:py-5 border-t border-[var(--color-border)] shrink-0">
        <div className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-tertiary)] font-mono mb-3">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating</span>}
          <span>Esc = Exit</span>
        </div>

        {ankiMode && flipped ? (
          <>
            <div className="sm:hidden">
              <MobileAnkiControls itemId={current.id} itemType="kanji" onRate={handleAnkiRate} />
            </div>
            <div className="hidden sm:flex justify-center">
              <AnkiSRSControls itemId={current.id} itemType="kanji" onRate={handleAnkiRate} />
            </div>
          </>
        ) : ankiMode && !flipped ? (
          <div className="flex items-center justify-center text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-3 rounded-xl">
            💡 <span className="hidden sm:inline ml-1">Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span>
            <span className="sm:hidden ml-1">Chạm để lật • Vuốt ← → chuyển</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="flex-1 flex items-center justify-center py-3 sm:py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold text-sm transition-all cursor-pointer active:scale-95">
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Kanji" onJump={jumpTo} />
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="flex-1 flex items-center justify-center py-3 sm:py-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold text-sm transition-all cursor-pointer active:scale-95">
              Tiếp →
            </button>
          </div>
        )}

        {ankiMode && (
          <div className="flex items-center justify-between gap-3 mt-2">
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold text-xs transition-all cursor-pointer active:scale-95">
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Kanji" onJump={jumpTo} />
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="px-4 py-2 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-bold text-xs transition-all cursor-pointer active:scale-95">
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Fullscreen Grammar Flashcard Session
// ============================================================


        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span>Exit Session (Esc)</span>
          </button>

          {onToggleAnki && (
            <button
              onClick={onToggleAnki}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                ankiMode
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              <Brain size={15} />
              <span>{ankiMode ? 'Anki SRS: BẬT' : 'Anki SRS: TẮT'}</span>
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <CardJumpControl
            index={index}
            total={total}
            label="Kanji"
            onJump={jumpTo}
          />
          <div className="w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end text-xs text-[var(--color-text-tertiary)] hidden sm:flex">
          {isFullscreen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] font-bold tracking-wide shadow-2xs animate-pulse">
              <span>✦ ZEN FULLSCREEN</span>
            </span>
          ) : (
            <span>Kanji Mode</span>
          )}
        </div>
      </div>

      {/* Card area — YouTube-style Fullscreen Icon inside bottom-right corner */}
      <div className="flex-1 flex items-center justify-center px-6 py-6">
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-hidden
            ${
              isFullscreen
                ? 'max-w-5xl lg:max-w-6xl min-h-[580px] sm:min-h-[660px] rounded-[2.5rem] bg-[var(--color-surface)] border-2 border-[#C9A84C]/45 shadow-[0_0_70px_rgba(201,168,76,0.18)] p-10 sm:p-16'
                : 'max-w-4xl lg:max-w-5xl min-h-[460px] sm:min-h-[520px] rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg hover:shadow-xl p-8 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left: Anki Card Badge */}
          {ankiMode && (
            <div className="absolute top-8 left-10 flex items-center select-none">
              <AnkiCardBadge itemId={current.id} itemType="kanji" />
            </div>
          )}

          {/* YouTube-style Fullscreen Icon Button (Bottom Right inside card) */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            className={`
              absolute bottom-6 right-6 z-20 p-3 rounded-2xl
              transition-all duration-200 cursor-pointer focus-ring
              flex items-center gap-2 text-xs font-bold
              ${
                isFullscreen
                  ? 'bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/50 text-[#C9A84C] shadow-md'
                  : 'bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] backdrop-blur-xs shadow-2xs'
              }
            `}
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={18} />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 size={18} />
                <span>Fullscreen Focus</span>
              </>
            )}
          </div>

          {!flipped ? (
            /* Front — Kanji + Hán tự (Huge Size) */
            <div className="text-center flex flex-col items-center gap-6 my-auto">
              {/* Kanji lớn */}
              <div
                className="font-jp-serif font-bold tracking-tight transition-all duration-300"
                style={{
                  fontSize: isFullscreen ? 'clamp(7.5rem, 22vw, 13rem)' : 'clamp(6rem, 18vw, 11rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>
              {/* Hán tự */}
              <div
                className="uppercase tracking-[0.25em] font-extrabold"
                style={{
                  fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
                  color: '#C9A84C',
                  letterSpacing: '0.3em',
                  textShadow: '0 1px 8px rgba(201,168,76,0.18)',
                }}
              >
                {current.hanViet}
              </div>
            </div>
          ) : (
            /* Back — Từ ghép + Phiên âm + Nghĩa (Scaled up) */
            <div className="text-center flex flex-col items-center justify-center gap-6 w-full max-w-xl my-auto">
              {current.vocabulary && current.vocabulary.length > 0 ? (
                <div className="flex flex-col items-center gap-5 w-full">
                  {current.vocabulary.slice(0, 3).map((v, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="flex items-baseline gap-4 justify-center">
                        <span
                          className="font-jp-serif font-bold"
                          style={{
                          fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)',
                          color: 'var(--color-text)',
                          }}
                        >
                          {v.word}
                        </span>
                        <span
                          className="font-jp font-bold"
                          style={{
                            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
                            color: '#C9A84C',
                          }}
                        >
                          【{v.reading}】
                        </span>
                      </div>
                      {v.meaning && (
                        <div
                          className="font-semibold"
                          style={{
                            fontSize: 'clamp(1rem, 2.2vw, 1.3rem)',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          {v.meaning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="uppercase tracking-[0.25em] font-extrabold"
                  style={{ fontSize: '2rem', color: '#C9A84C', letterSpacing: '0.3em' }}
                >
                  {current.hanViet}
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Footer / Shortcut Badges */}
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--color-text-tertiary)] font-mono">
        <div className="flex items-center gap-6 hidden md:flex">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating (Khi lật thẻ)</span>}
          <span>Esc = Exit Session / Fullscreen</span>
        </div>

        {ankiMode && flipped ? (
          <AnkiSRSControls
            itemId={current.id}
            itemType="kanji"
            onRate={handleAnkiRate}
          />
        ) : ankiMode && !flipped ? (
          <div className="flex items-center gap-2 mx-auto md:mx-0 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-2 rounded-xl">
            <span>💡 Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mx-auto md:mx-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✕ Chưa nhớ</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✓ Đã nhớ</span>
            </button>
          </div>
        )}

        <CardJumpControl
          index={index}
          total={total}
          label="Kanji"
          onJump={jumpTo}
        />
      </div>
    </div>
  );
}

// ============================================================
// Fullscreen Grammar Flashcard Session
// ============================================================

function formatMeanings(str?: string): string[] {
  if (!str) return [];
  let parts = str.split(/(?:\r?\n)+|\s*\/\s*(?=\d+[.)）])/g);
  if (parts.length === 1 && /\b1\..*\b2\./.test(str)) {
    parts = str.split(/(?=\b\d+[.)）]\s)/g);
  }
  return parts.map((s) => s.trim()).filter(Boolean);
}

function renderFormulaBlock(str?: string) {
  if (!str) return null;

  // 1. Split by pipe "|" if there are multiple formula variants/groups
  const groups = str.split('|').map((g) => g.trim()).filter(Boolean);

  return (
    <div className="flex flex-col gap-3 w-full items-center justify-center">
      {groups.map((group, gIdx) => {
        const plusIdx = group.indexOf('+');
        if (plusIdx === -1) {
          return (
            <div key={gIdx} className="text-center w-full font-bold text-sm sm:text-base md:text-lg">
              {group}
            </div>
          );
        }

        const leftRaw = group.slice(0, plusIdx).trim();
        const rightRaw = group.slice(plusIdx + 1).trim();

        let commonSuffix = '';
        let leftContent = leftRaw;
        const suffixMatch = leftRaw.match(/(\s*\([^)]+\))$/);
        if (suffixMatch && (leftRaw.match(/\(/g) || []).length === 1) {
          commonSuffix = suffixMatch[1];
          leftContent = leftRaw.slice(0, suffixMatch.index).trim();
        }

        const leftItems = leftContent
          .split(/(?:\s*・\s*|\s+\/\s+)/)
          .map((item) => item.trim())
          .filter(Boolean);

        return (
          <div
            key={gIdx}
            className="grid grid-cols-[auto_auto_auto] gap-x-2.5 sm:gap-x-4 gap-y-1.5 items-center justify-center w-fit mx-auto py-1"
          >
            {/* Column 1: Left items (V, Aい, Aな, N...) right aligned */}
            <div className="flex flex-col items-end justify-center gap-1.5 font-bold justify-self-end">
              {leftItems.map((item, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] whitespace-nowrap text-xs sm:text-sm md:text-base font-semibold shadow-2xs"
                >
                  {item}{commonSuffix}
                </div>
              ))}
            </div>

            {/* Column 2: Plus sign centered */}
            <div
              className="font-extrabold text-lg sm:text-xl md:text-2xl select-none justify-self-center px-1"
              style={{ color: '#C9A84C' }}
            >
              +
            </div>

            {/* Column 3: Right side pattern left aligned */}
            <div className="text-left font-bold text-sm sm:text-base md:text-lg text-[var(--color-text)] leading-snug justify-self-start font-jp-serif">
              {rightRaw}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GrammarFlashcardSession({
  items,
  onExit,
  initialIndex = 0,
  preserveOrder = true,
  ankiMode = true,
  onToggleAnki,
}: {
  items: GrammarItem[];
  onExit: () => void;
  initialIndex?: number;
  preserveOrder?: boolean;
  ankiMode?: boolean;
  onToggleAnki?: () => void;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealedExamples, setRevealedExamples] = useState<Record<number, boolean>>({});
  const [shuffledItems] = useState(() =>
    preserveOrder ? [...items] : [...items].sort(() => Math.random() - 0.5)
  );

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    setLastGrammarIndex(idx);
    setFlipped(false);
    setRevealedExamples({});
  }, []);

  const current = shuffledItems[index];
  const total = shuffledItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: any) => {
    if (isAnki !== true) {
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      setLastGrammarIndex(nextIdx);
      setFlipped(false);
      setRevealedExamples({});
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastGrammarIndex(prevIdx);
      setFlipped(false);
      setRevealedExamples({});
    }
  }, [index]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'grammar');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      next(true);
    },
    [srsCards, current.id, updateSRSCard, next]
  );

  const toggleExampleTranslation = useCallback((idx: number) => {
    setRevealedExamples((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  }, []);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onExit();
  }, [onExit]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Keyboard controls including Anki keys 1, 2, 3, 4
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          flip();
          break;
        case '=':
        case 'ArrowRight':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prev();
          break;
        case 'Escape':
          e.preventDefault();
          handleExit();
          break;
        case '1':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('again');
          }
          break;
        case '2':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('hard');
          }
          break;
        case '3':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('good');
          }
          break;
        case '4':
          if (ankiMode && flipped) {
            e.preventDefault();
            handleAnkiRate('easy');
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, handleExit, ankiMode, flipped, handleAnkiRate]);

  if (!current) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-gradient-to-b from-[var(--color-bg)] via-[var(--color-surface-alt)]/40 to-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      {/* Top bar — compact on mobile */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Exit (Esc)</span>
          </button>

          {onToggleAnki && (
            <button
              onClick={onToggleAnki}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                ankiMode
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border)]'
              }`}
            >
              <Brain size={15} />
              <span className="hidden sm:inline">{ankiMode ? 'Anki: BẬT' : 'Anki: TẮT'}</span>
              <span className="sm:hidden">{ankiMode ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <CardJumpControl index={index} total={total} label="Grammar" onJump={jumpTo} />
          <div className="w-24 sm:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
          {isFullscreen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] font-bold tracking-wide shadow-2xs animate-pulse">
              <span>✦ ZEN FULLSCREEN</span>
            </span>
          ) : (
            <span>Grammar Mode</span>
          )}
        </div>
      </div>

      {/* Card area — swipeable */}
      <div className="flex-1 flex items-stretch px-3 py-2 sm:px-6 sm:py-4 overflow-hidden" {...swipe}>
        <div
          role="button"
          tabIndex={0}
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center overflow-y-auto cursor-pointer transition-all duration-300
            focus-ring relative
            ${
              isFullscreen
                ? 'max-w-5xl lg:max-w-6xl mx-auto max-h-[88vh] rounded-[2.5rem] bg-[var(--color-surface)] border-2 border-[#C9A84C]/45 shadow-[0_0_70px_rgba(201,168,76,0.18)] p-6 sm:p-16'
                : 'max-w-4xl lg:max-w-5xl mx-auto max-h-[82vh] rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg p-4 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left (Anchor): Lesson Pill & Anki Card Badge */}
          <div className="absolute top-3 left-3 sm:top-8 sm:left-10 flex flex-wrap items-center gap-2 select-none">
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide">
              {current.lesson || 'N3 Grammar'}
            </div>
            {ankiMode && <AnkiCardBadge itemId={current.id} itemType="grammar" />}
          </div>

          {/* Top Right: Sound Button */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              speakJapanese(current.pattern);
            }}
            title="Nghe phát âm mẫu câu"
            className="absolute top-6 right-8 p-2.5 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-accent)] cursor-pointer"
          >
            <Volume2 size={20} />
          </div>

          {/* Fullscreen Icon */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            className={`
              absolute bottom-3 right-3 sm:bottom-6 sm:right-6 z-20 p-2.5 rounded-xl
              transition-all duration-200 cursor-pointer focus-ring
              flex items-center gap-2 text-xs font-bold
              ${
                isFullscreen
                  ? 'bg-[#C9A84C]/20 hover:bg-[#C9A84C]/30 border border-[#C9A84C]/50 text-[#C9A84C] shadow-md'
                  : 'bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] backdrop-blur-xs shadow-2xs'
              }
            `}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Focus'}</span>
          </div>

          {/* Swipe hint */}
          {swipe.swipeDir && (
            <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none text-4xl font-bold opacity-30 ${swipe.swipeDir === 'left' ? 'right-4' : 'left-4'}`}>
              {swipe.swipeDir === 'left' ? '→' : '←'}
            </div>
          )}
          {!flipped ? (
            /* Front side (Question view) — Japanese Pattern & Reading harmonized with Kanji/Vocab flashcards */
            <div className="text-center flex flex-col items-center justify-center my-auto gap-4 py-6 w-full max-w-4xl px-4">
              {/* 1. Mẫu ngữ pháp (font-jp-serif font-bold var(--color-text), chuẩn như Vocab/Kanji) */}
              <div
                className="font-jp-serif font-bold tracking-tight text-center transition-all duration-300"
                style={{
                  fontSize: isFullscreen ? 'clamp(2.5rem, 5.5vw, 4.6rem)' : 'clamp(2rem, 4.5vw, 3.8rem)',
                  lineHeight: 1.25,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.pattern}
              </div>

              {/* 2. Phiên âm nhỏ ở dưới (màu vàng ánh kim #C9A84C, font-jp font-bold như Kanji/Vocab) */}
              {current.reading && (
                <div
                  className="font-jp font-bold tracking-wide"
                  style={{
                    fontSize: 'clamp(1.2rem, 2.8vw, 1.8rem)',
                    color: '#C9A84C',
                    textShadow: '0 1px 8px rgba(201,168,76,0.18)',
                  }}
                >
                  【{current.reading}】
                </div>
              )}
            </div>
          ) : (
            /* Back side (Answer view) — 1. Công thức ở đầu, 2. Ý nghĩa (xuống dòng từng nghĩa), 3. Chú ý, 4. Ví dụ */
            <div className="text-center flex flex-col items-center justify-start gap-5 w-full max-w-3xl my-auto py-4">
              {/* 1. CÔNG THỨC Ở ĐẦU */}
              {(current.congThuc || current.structure) && (
                <div className="w-full p-3.5 sm:p-4 rounded-2xl bg-[var(--color-surface-alt)]/60 border border-[var(--color-border)] text-left sm:text-center shadow-2xs flex flex-col items-center">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#C9A84C] mb-2">
                    Công thức / Cấu trúc
                  </div>
                  <div className="w-full flex justify-center">
                    {renderFormulaBlock(current.congThuc || current.structure)}
                   </div>
                </div>
              )}

              {/* 2. DƯỚI LÀ Ý NGHĨA (nếu có nhiều nghĩa thì mỗi nghĩa xuống dòng) */}
              <div className="w-full space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#C9A84C]">
                  Ý nghĩa
                </div>
                <div className="flex flex-col gap-2.5 items-center">
                  {formatMeanings(current.meaning).map((meaningItem, mIdx) => (
                    <div
                      key={mIdx}
                      className="w-full text-center font-extrabold tracking-tight text-[var(--color-text)] leading-snug"
                      style={{
                        fontSize: 'clamp(1.5rem, 3.5vw, 2.4rem)',
                      }}
                    >
                      {meaningItem}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. CHÚ Ý */}
              {(current.usage || current.nuance) && (
                <div className="w-full text-left">
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-alt)]/60 border border-[var(--color-border)]">
                    <div className="text-xs font-extrabold uppercase tracking-widest text-[#C9A84C] mb-1.5">
                      Chú ý / Cách dùng
                    </div>
                    <div className="text-sm sm:text-base text-[var(--color-text)] leading-relaxed">
                      {current.usage}
                    </div>
                    {current.nuance && current.nuance !== current.usage && (
                      <div className="text-sm sm:text-base text-[var(--color-text)] leading-relaxed mt-2 pt-2 border-t border-[var(--color-border)]/60">
                        {current.nuance}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* So sánh & Lỗi thường gặp (nếu có) */}
              {(current.comparison || current.commonMistakes) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
                  {current.comparison && (
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface-alt)]/40 border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      <span className="font-bold text-[var(--color-text)]">Phân biệt: </span>
                      {current.comparison}
                    </div>
                  )}
                  {current.commonMistakes && (
                    <div className="p-3.5 rounded-xl bg-[var(--color-surface-alt)]/40 border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                      <span className="font-bold text-[var(--color-text)]">Lưu ý lỗi: </span>
                      {current.commonMistakes}
                    </div>
                  )}
                </div>
              )}

              {/* 4. VÍ DỤ (Normal ẩn phần dịch, ấn con mắt hiển thị bản dịch) */}
              {current.examples && current.examples.length > 0 && (
                <div className="w-full space-y-2 text-left mt-1">
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[#C9A84C] px-1">
                    Ví dụ (Ấn vào biểu tượng mắt để xem dịch)
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {current.examples.map((ex, idx) => {
                      const isRevealed = !!revealedExamples[idx];
                      return (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            speakJapanese(ex.japanese);
                          }}
                          className="p-3.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)] border border-[var(--color-border)] transition-colors cursor-pointer group/ex flex flex-col gap-1.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-3 w-full">
                            <div className="font-jp-serif text-base sm:text-lg font-bold text-[var(--color-text)] transition-colors">
                              {ex.japanese}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {ex.meaning && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExampleTranslation(idx);
                                  }}
                                  title={isRevealed ? 'Ẩn bản dịch' : 'Xem bản dịch'}
                                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[#C9A84C] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
                                >
                                  {isRevealed ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                              )}
                              <div className="p-1.5 rounded-full text-[var(--color-text-tertiary)] group-hover/ex:text-[#C9A84C]">
                                <Volume2 size={17} />
                              </div>
                            </div>
                          </div>
                          {ex.reading && (
                            <div className="font-jp text-xs text-[var(--color-text-tertiary)]">
                              {ex.reading}
                            </div>
                          )}
                          {isRevealed && ex.meaning && (
                            <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-medium mt-1 p-2.5 rounded-lg bg-[var(--color-surface-alt)]/80 border border-[var(--color-border)] animate-fadeIn">
                              {ex.meaning}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 sm:px-8 sm:py-5 border-t border-[var(--color-border)] shrink-0">
        <div className="hidden md:flex items-center gap-6 text-xs text-[var(--color-text-tertiary)] font-mono mb-3">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating</span>}
          <span>Esc = Exit</span>
        </div>

        {ankiMode && flipped ? (
          <>
            <div className="sm:hidden">
              <MobileAnkiControls itemId={current.id} itemType="grammar" onRate={handleAnkiRate} />
            </div>
            <div className="hidden sm:flex justify-center">
              <AnkiSRSControls itemId={current.id} itemType="grammar" onRate={handleAnkiRate} />
            </div>
          </>
        ) : ankiMode && !flipped ? (
          <div className="flex items-center justify-center text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-3 rounded-xl">
            💡 <span className="hidden sm:inline ml-1">Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span>
            <span className="sm:hidden ml-1">Chạm để lật • Vuốt ← → chuyển</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="flex-1 flex items-center justify-center py-3 sm:py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold text-sm transition-all cursor-pointer active:scale-95">
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Grammar" onJump={jumpTo} />
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="flex-1 flex items-center justify-center py-3 sm:py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-sm transition-all cursor-pointer active:scale-95">
              Tiếp →
            </button>
          </div>
        )}

        {ankiMode && (
          <div className="flex items-center justify-between gap-3 mt-2">
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] font-bold text-xs transition-all cursor-pointer active:scale-95">
              ← Trước
            </button>
            <CardJumpControl index={index} total={total} label="Grammar" onJump={jumpTo} />
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="px-4 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs transition-all cursor-pointer active:scale-95">
              Tiếp →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          {ankiMode && <span>1 - 4 = Anki Rating (Khi lật thẻ)</span>}
          <span>Esc = Exit Session / Fullscreen</span>
        </div>

        {ankiMode && flipped ? (
          <AnkiSRSControls
            itemId={current.id}
            itemType="grammar"
            onRate={handleAnkiRate}
          />
        ) : ankiMode && !flipped ? (
          <div className="flex items-center gap-2 mx-auto md:mx-0 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-4 py-2 rounded-xl">
            <span>💡 Bấm Space / Click để lật thẻ · Bấm 1 - 4 để chọn độ nhớ Anki</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 mx-auto md:mx-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✕ Chưa nhớ</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-xs"
            >
              <span>✓ Đã nhớ</span>
            </button>
          </div>
        )}

        <CardJumpControl
          index={index}
          total={total}
          label="Grammar"
          onJump={jumpTo}
        />
      </div>
    </div>
  );
}

