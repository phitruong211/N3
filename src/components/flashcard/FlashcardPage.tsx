// ============================================================
// Flashcard Mode — Full Screen, Keyboard-Driven
// ============================================================
// Principles:
// - Flow State Design: Zero distractions, full immersion
// - Scaled Card Size: Large 5xl cards, big text
// - YouTube-style Fullscreen Icon Button: Placed in the bottom-right corner INSIDE the card
// ============================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ContentBadge, PageHeading } from '@/components/ui/StudyUI';
import { ImportedDecks } from './ImportedDecks';
import { useApp } from '@/hooks/useApp';
import {
  X,
  Volume2,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Hash,
  ChevronsRight,
  Shuffle,
  ListOrdered,
  Play,
} from 'lucide-react';
import type { VocabItem, KanjiItem, GrammarItem, Rating } from '@/types';
import {
  createSRSCard,
  processReview,
  getDueCards,
  getReadyAnkiItems,
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

function EmptyAnkiSession({ onExit }: { onExit: () => void }) {
  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--color-bg)] p-6 text-center">
    <h2 className="text-2xl font-semibold text-[var(--color-text)]">Chưa có thẻ đến hạn</h2>
    <p className="study-copy max-w-md">Các thẻ trong bộ này đã được hẹn lịch. Hãy quay lại khi đến giờ ôn.</p>
    <button className="study-button study-button-primary" onClick={onExit}>Về danh sách bộ thẻ</button>
  </div>;
}

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
        <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border-2 border-[var(--color-accent)] rounded-xl px-2 py-1 ">
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
            className="ml-1 p-1 rounded-lg bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition-opacity cursor-pointer"
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
      title="Chọn thẻ bất kỳ"
      className="group flex shrink-0 items-center gap-2 whitespace-nowrap font-mono font-semibold text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer transition-colors sm:text-sm"
    >
      <span className="group-hover:underline underline-offset-2">
        {label} <span className="text-[var(--color-accent)]">{index + 1}</span>
        <span className="text-[var(--color-text-tertiary)]"> / {total}</span>
      </span>
      <Hash size={13} className="hidden opacity-0 group-hover:opacity-60 transition-opacity sm:block" />
    </button>
  );
}

function FullscreenToggle({ isFullscreen, onClick }: { isFullscreen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
      aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
      className="flex shrink-0 items-center justify-center gap-2 min-h-10 min-w-10 px-2 sm:px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] focus-ring cursor-pointer text-xs font-semibold"
    >
      {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
      <span className="hidden lg:inline">{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
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

  return { handlers: { onTouchStart, onTouchMove, onTouchEnd }, swipeDir };
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
    { rating: 'again', label: '1 · Quên', sub: intervals.again, cls: 'bg-[var(--color-error-subtle)] border-[var(--color-error)] text-[var(--color-error)]' },
    { rating: 'hard',  label: '2 · Khó',  sub: intervals.hard,  cls: 'bg-[var(--color-warning-subtle)] border-[var(--color-warning)] text-[var(--color-warning)]' },
    { rating: 'good',  label: '3 · Nhớ',  sub: intervals.good,  cls: 'bg-[var(--color-accent-subtle)] border-[var(--color-accent)] text-[var(--color-accent)]' },
    { rating: 'easy',  label: '4 · Dễ',   sub: intervals.easy,  cls: 'bg-[var(--color-success-subtle)] border-[var(--color-success)] text-[var(--color-success)]' },
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
      <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)] select-none">
        <span>Thẻ mới</span>
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
    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-success)] select-none">
      <span>
        {stageLabels[card.state as keyof typeof stageLabels]} · Ôn sau {formatCardInterval(card)}
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
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-[var(--color-error-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-error)] text-[var(--color-error)] font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 1: Học lại"
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
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-[var(--color-warning-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-warning)] text-[var(--color-warning)] font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 2: Khó"
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
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-[var(--color-accent-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-accent)] text-[var(--color-accent)] font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 3: Nhớ"
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
        className="flex-1 min-w-[110px] py-3 px-3 rounded-2xl bg-[var(--color-success-subtle)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-success)] text-[var(--color-success)] font-semibold text-xs transition-all flex flex-col items-center gap-1 cursor-pointer focus-ring shadow-xs"
        title="Phím 4: Thuộc"
      >
        <span className="font-bold tracking-wider uppercase">4. Dễ</span>
        <span className="text-[11px] font-mono opacity-80">{intervals.easy}</span>
      </button>
    </div>
  );
}

// ============================================================
// Shuffle Launch Modal
// ============================================================
type DeckKey = 'vocabN3' | 'vocabN4' | 'kanjiN3' | 'kanjiN2' | 'grammarN2' | 'grammarN3' | 'grammarN4' | 'saved';

interface ShuffleConfig {
  mode: 'sequential' | 'shuffle';
  rangeEnd: number; // 1-based, inclusive
}

function ShuffleLaunchModal({
  deckKey,
  totalCards,
  onStart,
  onCancel,
}: {
  deckKey: DeckKey;
  totalCards: number;
  onStart: (config: ShuffleConfig) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'sequential' | 'shuffle'>('sequential');
  const [rangeEnd, setRangeEnd] = useState(totalCards);
  const [inputVal, setInputVal] = useState(String(totalCards));
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, input');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, [onCancel]);

  const deckLabels: Record<DeckKey, string> = {
    vocabN3: 'Từ vựng N3',
    vocabN4: 'Từ vựng N4',
    kanjiN3: 'Hán tự N3',
    kanjiN2: 'Hán tự N2',
    grammarN2: 'Ngữ pháp N2',
    grammarN3: 'Ngữ pháp N3',
    grammarN4: 'Ngữ pháp N4',
    saved: 'Đã Lưu',
  };

  const handleRangeInput = (val: string) => {
    setInputVal(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 1 && n <= totalCards) {
      setRangeEnd(n);
    }
  };

  const handleStart = () => {
    const n = parseInt(inputVal, 10);
    const safeEnd = isNaN(n) || n < 1 ? 1 : Math.min(n, totalCards);
    onStart({ mode, rangeEnd: safeEnd });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={'Bắt đầu ' + deckLabels[deckKey]} className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-1">Bắt đầu học</div>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{deckLabels[deckKey]}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{totalCards} thẻ trong bộ</p>
          </div>
          <button onClick={onCancel} aria-label="Đóng" className="study-button">
            <X size={18} />
          </button>
        </div>

        {/* Mode selection */}
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Chế độ</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('sequential')}
              className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                mode === 'sequential'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <ListOrdered size={22} />
              <div className="text-center">
                <div className="font-bold text-sm">Tuần tự</div>
                <div className="text-[11px] opacity-70 mt-0.5">Từ 1 → {rangeEnd}</div>
              </div>
            </button>
            <button
              onClick={() => setMode('shuffle')}
              className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                mode === 'shuffle'
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
              }`}
            >
              <Shuffle size={22} />
              <div className="text-center">
                <div className="font-bold text-sm">Ngẫu nhiên</div>
                <div className="text-[11px] opacity-70 mt-0.5">Ngẫu nhiên 1–{rangeEnd}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Range selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Phạm vi thẻ</div>
            <span className="text-xs font-mono text-[var(--color-text-secondary)]">1 → <strong className="text-[var(--color-text)]">{Math.min(Math.max(parseInt(inputVal)||1,1), totalCards)}</strong> / {totalCards}</span>
          </div>
          {/* Slider */}
          <input
            type="range"
            min={1}
            max={totalCards}
            value={Math.min(Math.max(parseInt(inputVal)||1,1), totalCards)}
            onChange={(e) => handleRangeInput(e.target.value)}
            className="w-full h-2 rounded-full accent-[var(--color-accent)] cursor-pointer"
          />
          {/* Number input */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">Đến thẻ thứ</span>
            <input
              type="number"
              min={1}
              max={totalCards}
              value={inputVal}
              onChange={(e) => handleRangeInput(e.target.value)}
              aria-label="Số thẻ muốn học"
              className="study-input !w-24 text-center"
            />
            <button
              onClick={() => handleRangeInput(String(totalCards))}
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] underline cursor-pointer transition-colors"
            >Tất cả</button>
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="study-button study-button-primary w-full"
        >
          {mode === 'shuffle' ? <Shuffle size={18} /> : <Play size={18} />}
          <span>
            {mode === 'shuffle'
              ? `Học ngẫu nhiên ${Math.min(Math.max(parseInt(inputVal)||1,1), totalCards)} thẻ`
              : `Bắt đầu ${Math.min(Math.max(parseInt(inputVal)||1,1), totalCards)} thẻ`
            }
          </span>
        </button>
      </div>
    </div>
  );
}

export function FlashcardPage() {
  return <DeckPage mode="flashcards" />;
}

export function AnkiPage() {
  return <DeckPage mode="anki" />;
}

function DeckPage({ mode }: { mode: 'flashcards' | 'anki' }) {
  const ankiMode = mode === 'anki';
  const { vocabulary, kanji, grammar, isBookmarked, srsCards } = useApp();
  const [clockTick, setClockTick] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const [activeDeck, setActiveDeckState] = useState<ActiveDeck>(() => getLastActiveDeck(mode));

  const setActiveDeck = useCallback((deck: ActiveDeck) => {
    setLastActiveDeck(deck, mode);
    setActiveDeckState(deck);
  }, [mode]);

  const [pendingDeck, setPendingDeck] = useState<DeckKey | null>(null);
  const [shuffleConfig, setShuffleConfig] = useState<ShuffleConfig>({ mode: 'sequential', rangeEnd: 9999 });

  const savedVocabulary = vocabulary.filter((v) => isBookmarked(v.id));

  // Compute live Anki SRS due and mastered stats across the decks
  const dueCards = useMemo(() => getDueCards(srsCards, new Date(clockTick)), [srsCards, clockTick]);

  const n3VocabIds = useMemo(() => new Set(vocabulary.filter(v => v.level !== 'N4').map(v => v.id)), [vocabulary]);
  const n4VocabIds = useMemo(() => new Set(vocabulary.filter(v => v.level === 'N4').map(v => v.id)), [vocabulary]);

  const n2GrammarIds = useMemo(() => new Set(grammar.filter(g => g.level === 'N2').map(g => g.id)), [grammar]);
  const n3GrammarIds = useMemo(() => new Set(grammar.filter(g => g.level === 'N3').map(g => g.id)), [grammar]);
  const n4GrammarIds = useMemo(() => new Set(grammar.filter(g => g.level === 'N4').map(g => g.id)), [grammar]);
  const n3KanjiIds = useMemo(() => new Set(kanji.filter(k => k.level === 'N3').map(k => k.id)), [kanji]);
  const n2KanjiIds = useMemo(() => new Set(kanji.filter(k => k.level === 'N2').map(k => k.id)), [kanji]);

  const vocabN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'vocabulary' && n3VocabIds.has(c.cardId)).length, [dueCards, n3VocabIds]);
  const vocabN4DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'vocabulary' && n4VocabIds.has(c.cardId)).length, [dueCards, n4VocabIds]);

  const kanjiN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'kanji' && n3KanjiIds.has(c.cardId)).length, [dueCards, n3KanjiIds]);
  const kanjiN2DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'kanji' && n2KanjiIds.has(c.cardId)).length, [dueCards, n2KanjiIds]);

  const grammarN2DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'grammar' && n2GrammarIds.has(c.cardId)).length, [dueCards, n2GrammarIds]);
  const grammarN3DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'grammar' && n3GrammarIds.has(c.cardId)).length, [dueCards, n3GrammarIds]);
  const grammarN4DueCount = useMemo(() => dueCards.filter((c) => c.deckType === 'grammar' && n4GrammarIds.has(c.cardId)).length, [dueCards, n4GrammarIds]);

  const vocabN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'vocabulary' && c.intervalDays && c.intervalDays >= 21 && n3VocabIds.has(c.cardId)).length, [srsCards, n3VocabIds]);
  const vocabN4MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'vocabulary' && c.intervalDays && c.intervalDays >= 21 && n4VocabIds.has(c.cardId)).length, [srsCards, n4VocabIds]);

  const kanjiN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'kanji' && c.intervalDays && c.intervalDays >= 21 && n3KanjiIds.has(c.cardId)).length, [srsCards, n3KanjiIds]);
  const kanjiN2MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'kanji' && c.intervalDays && c.intervalDays >= 21 && n2KanjiIds.has(c.cardId)).length, [srsCards, n2KanjiIds]);

  const grammarN2MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'grammar' && c.intervalDays && c.intervalDays >= 21 && n2GrammarIds.has(c.cardId)).length, [srsCards, n2GrammarIds]);
  const grammarN3MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'grammar' && c.intervalDays && c.intervalDays >= 21 && n3GrammarIds.has(c.cardId)).length, [srsCards, n3GrammarIds]);
  const grammarN4MasteredCount = useMemo(() => srsCards.filter((c) => c.deckType === 'grammar' && c.intervalDays && c.intervalDays >= 21 && n4GrammarIds.has(c.cardId)).length, [srsCards, n4GrammarIds]);

  // Helper: get raw items for a deck
  const getItemsForDeck = (deck: DeckKey) => {
    if (deck === 'vocabN3') return vocabulary.filter(v => v.level !== 'N4');
    if (deck === 'vocabN4') return vocabulary.filter(v => v.level === 'N4');
    if (deck === 'saved') return savedVocabulary;
    if (deck === 'kanjiN3') return kanji.filter(k => k.level === 'N3');
    if (deck === 'kanjiN2') return kanji.filter(k => k.level === 'N2');
    if (deck === 'grammarN2') return grammar.filter(g => g.level === 'N2');
    if (deck === 'grammarN3') return grammar.filter(g => g.level === 'N3');
    if (deck === 'grammarN4') return grammar.filter(g => g.level === 'N4');
    return [];
  };

  const handleDeckClick = (deck: DeckKey) => {
    setPendingDeck(deck);
  };

  const handleModalStart = (config: ShuffleConfig) => {
    setShuffleConfig(config);
    setActiveDeck(pendingDeck);
    setPendingDeck(null);
  };

  const handleModalCancel = () => {
    setPendingDeck(null);
  };

  const handleExit = () => {
    setActiveDeck(null);
    setShuffleConfig({ mode: 'sequential', rangeEnd: 9999 });
  };

  if (activeDeck === 'vocabN3' || activeDeck === 'vocabN4' || activeDeck === 'saved') {
    let rawItems = getItemsForDeck(activeDeck) as VocabItem[];
    const sliced = rawItems.slice(0, shuffleConfig.rangeEnd);
    const activeItems = shuffleConfig.mode === 'shuffle'
      ? [...sliced].sort(() => Math.random() - 0.5)
      : sliced;

    const savedIdx = Math.min(getLastVocabIndex(), Math.max(0, activeItems.length - 1));
    return (
      <VocabFlashcardSession
        key={`${activeDeck}-${shuffleConfig.mode}-${shuffleConfig.rangeEnd}`}
        items={activeItems}
        preserveOrder={true}
        initialIndex={shuffleConfig.mode === 'shuffle' ? 0 : savedIdx}
        onExit={handleExit}
        ankiMode={ankiMode}
      />
    );
  }

  if (activeDeck === 'kanjiN3' || activeDeck === 'kanjiN2') {
    const rawItems = getItemsForDeck(activeDeck) as KanjiItem[];
    const sliced = rawItems.slice(0, shuffleConfig.rangeEnd);
    const activeItems = shuffleConfig.mode === 'shuffle'
      ? [...sliced].sort(() => Math.random() - 0.5)
      : sliced;
    const savedIdx = Math.min(getLastKanjiIndex(activeDeck === 'kanjiN2' ? 'N2' : 'N3'), Math.max(0, activeItems.length - 1));
    return (
      <KanjiFlashcardSession
        key={`${activeDeck}-${shuffleConfig.mode}-${shuffleConfig.rangeEnd}`}
        items={activeItems}
        initialIndex={shuffleConfig.mode === 'shuffle' ? 0 : savedIdx}
        onExit={handleExit}
        ankiMode={ankiMode}
      />
    );
  }

  if (activeDeck === 'grammarN2' || activeDeck === 'grammarN3' || activeDeck === 'grammarN4') {
    const rawItems = getItemsForDeck(activeDeck) as GrammarItem[];
    const sliced = rawItems.slice(0, shuffleConfig.rangeEnd);
    const activeItems = shuffleConfig.mode === 'shuffle'
      ? [...sliced].sort(() => Math.random() - 0.5)
      : sliced;
    const progressLevel = activeDeck === 'grammarN2' ? 'N2' : activeDeck === 'grammarN4' ? 'N4' : 'N3';
    const savedIdx = Math.min(getLastGrammarIndex(progressLevel), Math.max(0, activeItems.length - 1));
    return (
      <GrammarFlashcardSession
        key={`${activeDeck}-${shuffleConfig.mode}-${shuffleConfig.rangeEnd}`}
        items={activeItems}
        preserveOrder={true}
        initialIndex={shuffleConfig.mode === 'shuffle' ? 0 : savedIdx}
        progressLevel={progressLevel}
        onExit={handleExit}
        ankiMode={ankiMode}
      />
    );
  }

  // Compute total for pending modal
  const pendingTotal = pendingDeck ? getItemsForDeck(pendingDeck).length : 0;

  const decks: {key: DeckKey; title: string; count: number; due: number; mastered: number; tone: 'vocabulary' | 'kanji' | 'grammar' | 'neutral'}[] = [
    {key:'vocabN3', title:'Từ vựng N3', count:n3VocabIds.size, due:vocabN3DueCount, mastered:vocabN3MasteredCount, tone:'vocabulary'},
    {key:'kanjiN3', title:'Kanji N3', count:n3KanjiIds.size, due:kanjiN3DueCount, mastered:kanjiN3MasteredCount, tone:'kanji'},
    {key:'grammarN3', title:'Ngữ pháp N3', count:n3GrammarIds.size, due:grammarN3DueCount, mastered:grammarN3MasteredCount, tone:'grammar'},
    {key:'vocabN4', title:'Từ vựng N4', count:n4VocabIds.size, due:vocabN4DueCount, mastered:vocabN4MasteredCount, tone:'vocabulary'},
    {key:'grammarN4', title:'Ngữ pháp N4', count:n4GrammarIds.size, due:grammarN4DueCount, mastered:grammarN4MasteredCount, tone:'grammar'},
    {key:'kanjiN2', title:'Kanji N2', count:n2KanjiIds.size, due:kanjiN2DueCount, mastered:kanjiN2MasteredCount, tone:'kanji'},
    {key:'grammarN2', title:'Ngữ pháp N2', count:n2GrammarIds.size, due:grammarN2DueCount, mastered:grammarN2MasteredCount, tone:'grammar'},
    {key:'saved', title:'Từ đã lưu', count:savedVocabulary.length, due:0, mastered:0, tone:'neutral'},
  ];
  const renderDeck = ({key, ...deck}: (typeof decks)[number]) => <DeckCard key={key} {...deck} ankiMode={ankiMode} onClick={() => handleDeckClick(key)} />;
  const {key: savedKey, ...savedDeck} = decks[7];
  return <>
    {pendingDeck && pendingTotal > 0 && <ShuffleLaunchModal deckKey={pendingDeck} totalCards={pendingTotal} onStart={handleModalStart} onCancel={handleModalCancel} />}
    <div className="study-page">
        <PageHeading eyebrow="LUYỆN TẬP" title={ankiMode ? 'Anki' : 'Thẻ học'} subtitle={ankiMode ? 'Học thẻ mới và thẻ đến hạn; đánh giá mức độ nhớ để lên lịch ôn lại' : 'Chọn bộ thẻ, tự nhớ trước khi xem đáp án'} />
      {ankiMode && <ImportedDecks />}
      <section><h2 className="study-eyebrow mb-3">TRÌNH ĐỘ N3</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{decks.slice(0,3).map(renderDeck)}</div></section>
      <section><h2 className="study-eyebrow mb-3">TRÌNH ĐỘ N4</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{decks.slice(3,5).map(renderDeck)}</div></section>
      <section><h2 className="study-eyebrow mb-3">TRÌNH ĐỘ N2</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{decks.slice(5,7).map(renderDeck)}</div></section>
      <section><h2 className="study-eyebrow mb-3">CỦA BẠN</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><DeckCard key={savedKey} {...savedDeck} ankiMode={ankiMode} disabled={!savedVocabulary.length} onClick={() => handleDeckClick('saved')} /></div></section>
    </div>
  </>;
}
function DeckCard({title,count,due,mastered,tone,ankiMode,disabled,onClick}: {title:string;count:number;due:number;mastered:number;tone:'vocabulary'|'kanji'|'grammar'|'neutral';ankiMode:boolean;disabled?:boolean;onClick:()=>void}) {
  return <button disabled={disabled} onClick={onClick} className="study-panel group min-w-0 text-left transition-colors hover:border-[var(--color-border-strong)] focus-ring disabled:cursor-not-allowed disabled:opacity-50">
    <ContentBadge tone={tone}>{title}</ContentBadge>
    <p className="mt-4 text-2xl font-semibold text-[var(--color-text)]">{count} <span className="text-sm font-normal text-[var(--color-text-secondary)]">thẻ</span></p>
    {ankiMode && tone !== 'neutral' && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{due} cần ôn · {mastered} đã nhớ</p>}
    <p className="mt-4 text-sm font-semibold text-[var(--color-accent)]">Bắt đầu học →</p>
  </button>;
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
  ankiMode = false,
}: {
  items: VocabItem[];
  onExit: () => void;
  initialIndex?: number;
  preserveOrder?: boolean;
  ankiMode?: boolean;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const [index, setIndex] = useState(ankiMode ? 0 : initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const ratingLocked = useRef(false);
  useEffect(() => { ratingLocked.current = false; }, [index]);
  const reviewedRef = useRef<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shuffledItems] = useState(() =>
    preserveOrder ? [...items] : [...items].sort(() => Math.random() - 0.5)
  );
  const [studyItems, setStudyItems] = useState(() => ankiMode ? getReadyAnkiItems(shuffledItems, srsCards, 'vocabulary') : shuffledItems);

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    if (!ankiMode) setLastVocabIndex(idx);
    setFlipped(false);
  }, [ankiMode]);

  const current = studyItems[index];
  const total = studyItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: boolean) => {
    if (ankiMode && !isAnki) return;
    if (isAnki !== true && flipped && !reviewedRef.current.has(index)) {
      reviewedRef.current.add(index);
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      if (!ankiMode) setLastVocabIndex(nextIdx);
      setFlipped(false);
    }
  }, [index, total, flipped, ankiMode]);
  const prev = useCallback(() => {
    if (ankiMode) return;
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastVocabIndex(prevIdx);
      setFlipped(false);
    }
  }, [index, ankiMode]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      if (ratingLocked.current || !flipped) return;
      ratingLocked.current = true;
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'vocabulary');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      if (index === total - 1) {
        const updatedCards = [...srsCards.filter(c => !(c.cardId === updated.cardId && c.deckType === updated.deckType)), updated];
        const readyAgain = getReadyAnkiItems(shuffledItems, updatedCards, 'vocabulary');
        if (readyAgain.length) {
          setStudyItems(readyAgain);
          setIndex(0);
          setFlipped(false);
          ratingLocked.current = false;
        } else {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onExit();
        }
      } else {
        next(true);
      }
    },
    [srsCards, current?.id, updateSRSCard, next, index, total, onExit, flipped, shuffledItems]
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
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest('button') && e.key === 'Enter') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (e.repeat) return;
          if (!flipped) flip();
          else if (ankiMode) handleAnkiRate('good');
          else next();
          break;
        case '=':
        case 'ArrowRight':
          e.preventDefault();
          if (!ankiMode) next();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!ankiMode) prev();
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

  if (!current) return <EmptyAnkiSession onExit={onExit} />;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      {/* Top bar — compact on mobile */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Thoát (Esc)</span>
          </button>

        </div>

        {/* Progress bar + jump */}
        <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-4">
          {ankiMode ? <span className="font-mono text-xs font-semibold text-[var(--color-text-secondary)]">Thẻ {index + 1} / {total}</span> : <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />}
          <div className="hidden sm:block w-24 lg:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <FullscreenToggle isFullscreen={isFullscreen} onClick={toggleFullscreen} />
      </div>

      {/* Card area — flex-1, swipeable */}
      <div
        className="flex-1 min-h-0 flex items-stretch justify-center px-3 py-2 sm:px-6 sm:py-4"
        {...swipe.handlers}
      >
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-y-auto
            ${
              isFullscreen
                ? 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-12'
                : 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]  p-5 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Đã hiện đáp án, chạm để xem câu hỏi' : 'Đang hiện câu hỏi, chạm để lật'}
        >
          {/* Top Left: Lesson + Anki Badge */}
          <div className="absolute top-3 left-3 sm:top-8 sm:left-10 flex flex-wrap items-center gap-2 select-none">
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide">
              {current.lesson || `Từ vựng ${current.level}`}
            </div>
            {ankiMode && <AnkiCardBadge itemId={current.id} itemType="vocabulary" />}
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
                className="font-jp-serif font-bold tracking-tight transition-all duration-300 break-words max-w-full"
                style={{
                  fontSize: isFullscreen ? 'clamp(3rem, 14vw, 10rem)' : 'clamp(2.5rem, 13vw, 8rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji || current.hiragana}
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
                <span className="hidden sm:inline">Chạm hoặc Space để lật</span>
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
                  color: 'var(--color-accent)',
                }}
              >
                【{current.hiragana}】
              </div>
              {current.han_viet && <div className="text-sm font-medium text-[var(--color-text-secondary)]">Hán Việt: {current.han_viet}</div>}
            </div>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-3 pb-3 pt-2 sm:px-8 sm:py-5 border-t border-[var(--color-border)] shrink-0">
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
        ) : !ankiMode ? (
          /* Non-Anki mode: jump to a card; arrow keys and swipes navigate */
          <div className="flex items-center justify-center min-h-10">
            <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />
          </div>
        ) : null}

      </div>
    </div>
  );
}

function KanjiFlashcardSession({
  items,
  onExit,
  initialIndex = 0,
  ankiMode = false,
}: {
  items: KanjiItem[];
  onExit: () => void;
  initialIndex?: number;
  ankiMode?: boolean;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const deckLevel = items[0]?.level ?? 'N3';
  const [sourceItems] = useState(() => [...items]);
  const [studyItems, setStudyItems] = useState(() => ankiMode ? getReadyAnkiItems(sourceItems, srsCards, 'kanji') : sourceItems);
  const [index, setIndex] = useState(ankiMode ? 0 : initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const ratingLocked = useRef(false);
  useEffect(() => { ratingLocked.current = false; }, [index]);
  const reviewedRef = useRef<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    if (!ankiMode) setLastKanjiIndex(idx, deckLevel);
    setFlipped(false);
  }, [deckLevel, ankiMode]);

  const current = studyItems[index];
  const total = studyItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: boolean) => {
    if (ankiMode && !isAnki) return;
    if (isAnki !== true && flipped && !reviewedRef.current.has(index)) {
      reviewedRef.current.add(index);
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      if (!ankiMode) setLastKanjiIndex(nextIdx, deckLevel);
      setFlipped(false);
    }
  }, [index, total, flipped, deckLevel, ankiMode]);
  const prev = useCallback(() => {
    if (ankiMode) return;
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastKanjiIndex(prevIdx, deckLevel);
      setFlipped(false);
    }
  }, [index, deckLevel, ankiMode]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      if (ratingLocked.current || !flipped) return;
      ratingLocked.current = true;
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'kanji');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      if (index === total - 1) {
        const updatedCards = [...srsCards.filter(c => !(c.cardId === updated.cardId && c.deckType === updated.deckType)), updated];
        const readyAgain = getReadyAnkiItems(sourceItems, updatedCards, 'kanji');
        if (readyAgain.length) {
          setStudyItems(readyAgain);
          setIndex(0);
          setFlipped(false);
          ratingLocked.current = false;
        } else {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onExit();
        }
      } else {
        next(true);
      }
    },
    [srsCards, current?.id, updateSRSCard, next, index, total, onExit, flipped, sourceItems]
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest('button') && e.key === 'Enter') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (e.repeat) return;
          if (!flipped) flip();
          else if (ankiMode) handleAnkiRate('good');
          else next();
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

  if (!current) return <EmptyAnkiSession onExit={onExit} />;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Thoát (Esc)</span>
          </button>

        </div>

        <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-4">
          {ankiMode ? <span className="font-mono text-xs font-semibold text-[var(--color-text-secondary)]">Thẻ {index + 1} / {total}</span> : <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />}
          <div className="hidden sm:block w-24 lg:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <FullscreenToggle isFullscreen={isFullscreen} onClick={toggleFullscreen} />
      </div>

      <div className="flex-1 min-h-0 flex items-stretch justify-center px-3 py-2 sm:px-6 sm:py-4" {...swipe.handlers}>
        <button
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300
            focus-ring relative overflow-y-auto
            ${
              isFullscreen
                ? 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-12'
                : 'max-w-4xl lg:max-w-5xl mx-auto rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)]  p-5 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Đang hiện đáp án' : 'Đang hiện câu hỏi'}
        >
          {ankiMode && (
            <div className="absolute top-3 left-3 sm:top-8 sm:left-10 flex items-center select-none">
              <AnkiCardBadge itemId={current.id} itemType="kanji" />
            </div>
          )}

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
                {current.kanji || current.hanViet || 'N/A'}
              </div>
              <div className="text-xs sm:hidden text-[var(--color-text-tertiary)]">Chạm để lật • Vuốt ← →</div>
            </div>
          ) : (
            <div className="text-center flex flex-col items-center justify-center gap-4 sm:gap-6 w-full max-w-xl my-auto">
              <div className="text-xl font-bold text-[var(--color-kanji)]">{current.hanViet}</div>
              {(current.onyomi?.length || current.kunyomi?.length) ? <div className="text-sm text-[var(--color-text-secondary)]">
                {!!current.onyomi?.length && <p>Âm On: <span className="font-jp">{current.onyomi.join(' · ')}</span></p>}
                {!!current.kunyomi?.length && <p>Âm Kun: <span className="font-jp">{current.kunyomi.join(' · ')}</span></p>}
              </div> : null}
              {current.vocabulary && current.vocabulary.length > 0 ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  {current.vocabulary.slice(0, 3).map((v, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="flex items-baseline gap-3 justify-center flex-wrap">
                        <span className="font-jp-serif font-bold" style={{ fontSize: 'clamp(1.4rem, 4vw, 2.2rem)', color: 'var(--color-text)' }}>
                          {v.word}
                        </span>
                        <span className="font-jp font-bold" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', color: 'var(--color-accent)' }}>
                          【{v.reading}】
                        </span>
                      </div>
                      {v.hanViet && <div className="text-xs font-medium text-[var(--color-kanji)]">Hán Việt: {v.hanViet}</div>}
                      {v.meaning && (
                        <div className="font-semibold" style={{ fontSize: 'clamp(0.9rem, 2.2vw, 1.3rem)', color: 'var(--color-text-secondary)' }}>
                          {v.meaning}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="uppercase font-extrabold" style={{ fontSize: '2rem', color: 'var(--color-accent)', letterSpacing: '0.3em' }}>
                  {current.hanViet}
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      <div className="px-3 pb-3 pt-2 sm:px-8 sm:py-5 border-t border-[var(--color-border)] shrink-0">
        {ankiMode && flipped ? (
          <>
            <div className="sm:hidden">
              <MobileAnkiControls itemId={current.id} itemType="kanji" onRate={handleAnkiRate} />
            </div>
            <div className="hidden sm:flex justify-center">
              <AnkiSRSControls itemId={current.id} itemType="kanji" onRate={handleAnkiRate} />
            </div>
          </>
        ) : !ankiMode ? (
          <div className="flex items-center justify-center min-h-10">
            <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />
          </div>
        ) : null}
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
              style={{ color: 'var(--color-accent)' }}
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
  progressLevel = 'N3',
  preserveOrder = true,
  ankiMode = false,
}: {
  items: GrammarItem[];
  onExit: () => void;
  initialIndex?: number;
  progressLevel?: 'N2' | 'N3' | 'N4';
  preserveOrder?: boolean;
  ankiMode?: boolean;
}) {
  const { srsCards, updateSRSCard } = useApp();
  const [index, setIndex] = useState(ankiMode ? 0 : initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const ratingLocked = useRef(false);
  useEffect(() => { ratingLocked.current = false; }, [index]);
  const reviewedRef = useRef<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealedExamples, setRevealedExamples] = useState<Record<number, boolean>>({});
  const [shuffledItems] = useState(() =>
    preserveOrder ? [...items] : [...items].sort(() => Math.random() - 0.5)
  );
  const [studyItems, setStudyItems] = useState(() => ankiMode ? getReadyAnkiItems(shuffledItems, srsCards, 'grammar') : shuffledItems);

  const jumpTo = useCallback((idx: number) => {
    setIndex(idx);
    if (!ankiMode) setLastGrammarIndex(idx, progressLevel);
    setFlipped(false);
    setRevealedExamples({});
  }, [progressLevel, ankiMode]);

  const current = studyItems[index];
  const total = studyItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback((isAnki?: boolean) => {
    if (ankiMode && !isAnki) return;
    if (isAnki !== true && flipped && !reviewedRef.current.has(index)) {
      reviewedRef.current.add(index);
      recordStudyActivity(1, 0, 1, 5, 'flashcard');
    }
    if (index < total - 1) {
      const nextIdx = index + 1;
      setIndex(nextIdx);
      if (!ankiMode) setLastGrammarIndex(nextIdx, progressLevel);
      setFlipped(false);
      setRevealedExamples({});
    }
  }, [index, total, flipped, progressLevel, ankiMode]);
  const prev = useCallback(() => {
    if (ankiMode) return;
    if (index > 0) {
      const prevIdx = index - 1;
      setIndex(prevIdx);
      setLastGrammarIndex(prevIdx, progressLevel);
      setFlipped(false);
      setRevealedExamples({});
    }
  }, [index, progressLevel, ankiMode]);

  const swipe = useSwipeGesture({
    onSwipeLeft: () => next(),
    onSwipeRight: () => prev(),
    onSwipeUp: () => flip(),
  });

  const handleAnkiRate = useCallback(
    (rating: Rating) => {
      if (ratingLocked.current || !flipped) return;
      ratingLocked.current = true;
      const existing = srsCards.find((c) => c.cardId === current.id);
      const card = existing || createSRSCard(current.id, 'grammar');
      const isNew = card.state === 'new';
      const updated = processReview(card, rating);
      updateSRSCard(updated);
      recordStudyActivity(1, isNew ? 1 : 0, rating === 'again' ? 0 : 1, 10, 'srs');
      if (index === total - 1) {
        const updatedCards = [...srsCards.filter(c => !(c.cardId === updated.cardId && c.deckType === updated.deckType)), updated];
        const readyAgain = getReadyAnkiItems(shuffledItems, updatedCards, 'grammar');
        if (readyAgain.length) {
          setStudyItems(readyAgain);
          setIndex(0);
          setFlipped(false);
          setRevealedExamples({});
          ratingLocked.current = false;
        } else {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          onExit();
        }
      } else {
        next(true);
      }
    },
    [srsCards, current?.id, updateSRSCard, next, index, total, onExit, flipped, shuffledItems]
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
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (target.closest('button') && e.key === 'Enter') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (e.repeat) return;
          if (!flipped) flip();
          else if (ankiMode) handleAnkiRate('good');
          else next();
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

  if (!current) return <EmptyAnkiSession onExit={onExit} />;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-none transition-all duration-300 ${
        isFullscreen
          ? 'bg-[var(--color-bg)]'
          : 'bg-[var(--color-bg)]'
      }`}
    >
      {/* Top bar — compact on mobile */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:px-8 sm:py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
          >
            <X size={18} />
            <span className="hidden sm:inline">Thoát (Esc)</span>
          </button>

        </div>

        <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-4">
          {ankiMode ? <span className="font-mono text-xs font-semibold text-[var(--color-text-secondary)]">Thẻ {index + 1} / {total}</span> : <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />}
          <div className="hidden sm:block w-24 lg:w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-grammar)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <FullscreenToggle isFullscreen={isFullscreen} onClick={toggleFullscreen} />
      </div>

      {/* Card area — swipeable */}
      <div className="flex-1 min-h-0 flex items-stretch justify-center px-3 py-2 sm:px-6 sm:py-4 overflow-hidden" {...swipe.handlers}>
        <div
          role="button"
          tabIndex={0}
          onClick={flip}
          className={`
            w-full flex flex-col items-center justify-start overflow-y-auto cursor-pointer transition-all duration-300
            focus-ring relative
            ${
              isFullscreen
                ? 'max-w-4xl lg:max-w-5xl mx-auto max-h-[88vh] rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-12'
                : 'max-w-4xl lg:max-w-5xl mx-auto max-h-[82vh] rounded-2xl sm:rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-4 sm:p-12'
            }
          `}
          aria-label={flipped ? 'Đã hiện đáp án, chạm để xem câu hỏi' : 'Đang hiện câu hỏi, chạm để lật'}
        >
          {/* Keep the lesson label in the scroll flow so long answers cannot overlap it. */}
          <div className="self-start shrink-0 mb-5 sm:mb-6 flex flex-wrap items-center gap-2 select-none">
            <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide">
              {current.lesson || 'Ngữ pháp N3'}
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
                {current.pattern || current.reading || 'N/A'}
              </div>

              {/* 2. Phiên âm nhỏ ở dưới (màu vàng ánh kim #C9A84C, font-jp font-bold như Kanji/Vocab) */}
              {current.reading && (
                <div
                  className="font-jp font-bold tracking-wide"
                  style={{
                    fontSize: 'clamp(1.2rem, 2.8vw, 1.8rem)',
                    color: 'var(--color-accent)',
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
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-accent)] mb-2">
                    Công thức / Cấu trúc
                  </div>
                  <div className="w-full flex justify-center">
                    {renderFormulaBlock(current.congThuc || current.structure)}
                   </div>
                </div>
              )}

              {/* 2. DƯỚI LÀ Ý NGHĨA (nếu có nhiều nghĩa thì mỗi nghĩa xuống dòng) */}
              <div className="w-full space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-accent)]">
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
                    <div className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-accent)] mb-1.5">
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
                  <div className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-accent)] px-1">
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
                                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
                                >
                                  {isRevealed ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                              )}
                              <div className="p-1.5 rounded-full text-[var(--color-text-tertiary)] group-hover/ex:text-[var(--color-accent)]">
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
        {ankiMode && flipped ? (
          <>
            <div className="sm:hidden">
              <MobileAnkiControls itemId={current.id} itemType="grammar" onRate={handleAnkiRate} />
            </div>
            <div className="hidden sm:flex justify-center">
              <AnkiSRSControls itemId={current.id} itemType="grammar" onRate={handleAnkiRate} />
            </div>
          </>
        ) : !ankiMode ? (
          <div className="flex items-center justify-center min-h-10">
            <CardJumpControl index={index} total={total} label="Thẻ" onJump={jumpTo} />
          </div>
        ) : null}

      </div>
    </div>
  );
}
