// ============================================================
// Flashcard Mode — Full Screen, Keyboard-Driven
// ============================================================
// Principles:
// - Flow State Design: Zero distractions, full immersion
// - Scaled Card Size: Large 5xl cards, big text
// - YouTube-style Fullscreen Icon Button: Placed in the bottom-right corner INSIDE the card
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  BookmarkCheck,
  Sparkles,
  BookOpen,
  Volume2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { VocabItem, KanjiItem } from '@/types';

export function FlashcardPage() {
  const { vocabulary, kanji, isBookmarked } = useApp();
  const [activeDeck, setActiveDeck] = useState<'vocab' | 'kanji' | 'saved' | null>(null);

  const savedVocabulary = vocabulary.filter((v) => isBookmarked(v.id));

  if (activeDeck === 'vocab' || activeDeck === 'saved') {
    const activeItems = activeDeck === 'saved' ? savedVocabulary : vocabulary;
    return (
      <VocabFlashcardSession
        items={activeItems}
        onExit={() => setActiveDeck(null)}
      />
    );
  }

  if (activeDeck === 'kanji') {
    return (
      <KanjiFlashcardSession
        items={kanji}
        onExit={() => setActiveDeck(null)}
      />
    );
  }

  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">
          Flashcards
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Distraction-free fullscreen flashcard study sessions for Vocabulary and Kanji
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Vocabulary Deck */}
        <button
          onClick={() => setActiveDeck('vocab')}
          className="
            group p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]
            hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]/50
            transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
            flex flex-col justify-between
          "
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
                Vocab Deck
              </span>
              <BookOpen size={18} className="text-[var(--color-accent)]" />
            </div>
            <div className="text-lg font-semibold text-[var(--color-text)] mb-1">
              Complete N3 Vocabulary
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {vocabulary.length} words · Meanings &amp; Hiragana
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-6 flex items-center gap-2 font-mono">
            <span>Space: Flip</span>
            <span>·</span>
            <span>←/→: Navigate</span>
          </div>
        </button>

        {/* Kanji Deck */}
        <button
          onClick={() => setActiveDeck('kanji')}
          className="
            group p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]
            hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]/50
            transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
            flex flex-col justify-between
          "
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]">
                Kanji Deck
              </span>
              <Sparkles size={18} className="text-[var(--color-warning)]" />
            </div>
            <div className="text-lg font-semibold text-[var(--color-text)] mb-1">
              Master N3 Kanji (1 → N Order)
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {kanji.length} characters · Sequential Dataset Order
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-6 flex items-center gap-2 font-mono">
            <span>Space: Flip</span>
            <span>·</span>
            <span>←/→: Navigate</span>
          </div>
        </button>

        {/* Saved Bookmarks Deck */}
        <button
          onClick={() => savedVocabulary.length > 0 && setActiveDeck('saved')}
          disabled={savedVocabulary.length === 0}
          className="
            group p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]
            hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]/50
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
            flex flex-col justify-between
          "
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
                Saved Deck
              </span>
              <BookmarkCheck size={18} className="text-[var(--color-warning)]" />
            </div>
            <div className="text-lg font-semibold text-[var(--color-text)] mb-1">
              Saved Bookmarks Deck
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {savedVocabulary.length} bookmarked cards
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-6 font-mono">
            {savedVocabulary.length > 0 ? 'Click to drill saved items' : 'No bookmarks saved yet'}
          </div>
        </button>
      </div>
    </div>
  );
}

export function parseRelatedWords(rawText?: string) {
  if (!rawText) return [];
  const parts = rawText.split(/(?:[,;]|\r?\n)\s*(?=[^\(（【\[,;]+[\(（【\[])/);
  const items: { word: string; reading: string; meaning: string; raw: string }[] = [];

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
  preserveOrder = false,
}: {
  items: VocabItem[];
  onExit: () => void;
  initialIndex?: number;
  preserveOrder?: boolean;
}) {
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shuffledItems] = useState(() =>
    preserveOrder ? [...items] : [...items].sort(() => Math.random() - 0.5)
  );

  const current = shuffledItems[index];
  const total = shuffledItems.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback(() => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setFlipped(false);
    }
  }, [index]);

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

  // Keyboard controls
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, handleExit]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
        >
          <X size={18} />
          <span>Exit Session (Esc)</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono font-semibold text-[var(--color-text-secondary)]">
            Vocab Card {index + 1} of {total}
          </span>
          <div className="w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Vocab Mode
        </div>
      </div>

      {/* Card area — Scaled up max-w-5xl, min-h-[520px], YouTube-style Fullscreen Icon inside */}
      <div className="flex-1 flex items-center justify-center px-6 py-6">
        <button
          onClick={flip}
          className="
            w-full max-w-4xl lg:max-w-5xl min-h-[460px] sm:min-h-[520px] rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-lg hover:shadow-xl flex flex-col items-center justify-center p-8 sm:p-12
            cursor-pointer transition-all duration-200
            focus-ring relative overflow-hidden
          "
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left (Anchor): Lesson Pill */}
          <div className="absolute top-8 left-10 inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide select-none">
            {current.lesson || 'N3 Vocab'}
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
            className="
              absolute bottom-6 right-6 z-20 p-2.5 rounded-xl
              bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)]
              text-[var(--color-text-secondary)] hover:text-[var(--color-text)]
              transition-all duration-150 cursor-pointer focus-ring
              backdrop-blur-xs shadow-2xs flex items-center gap-1.5 text-xs font-semibold
            "
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </div>

          {!flipped ? (
            /* Front Side (Question view) — Huge Kanji */
            <div className="text-center flex flex-col items-center justify-center my-auto gap-6">
              <div
                className="font-jp-serif font-bold tracking-tight"
                style={{
                  fontSize: 'clamp(6rem, 18vw, 11rem)',
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
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-mono">
        <div className="flex items-center gap-6 hidden md:flex">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          <span>Esc = Exit Session / Fullscreen</span>
        </div>

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

        <div>
          Vocab Card {index + 1} of {total}
        </div>
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
}: {
  items: KanjiItem[];
  onExit: () => void;
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Preserve exact dataset order from start to end (1 -> N)
  const current = items[index];
  const total = items.length;

  const flip = useCallback(() => setFlipped((f) => !f), []);
  const next = useCallback(() => {
    if (index < total - 1) {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setFlipped(false);
    }
  }, [index]);

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

  // Keyboard controls
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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, handleExit]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={handleExit}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-4 py-2 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-all shadow-2xs"
        >
          <X size={18} />
          <span>Exit Session (Esc)</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-mono font-semibold text-[var(--color-text-secondary)]">
            Kanji Card {index + 1} of {total}
          </span>
          <div className="w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Kanji Mode
        </div>
      </div>

      {/* Card area — YouTube-style Fullscreen Icon inside bottom-right corner */}
      <div className="flex-1 flex items-center justify-center px-6 py-6">
        <button
          onClick={flip}
          className="
            w-full max-w-4xl lg:max-w-5xl min-h-[460px] sm:min-h-[520px] rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-lg hover:shadow-xl flex flex-col items-center justify-center p-8 sm:p-12
            cursor-pointer transition-all duration-200
            focus-ring relative overflow-hidden
          "
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* YouTube-style Fullscreen Icon Button (Bottom Right inside card) */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            className="
              absolute bottom-6 right-6 z-20 p-2.5 rounded-xl
              bg-[var(--color-surface-alt)]/80 hover:bg-[var(--color-surface-alt)]
              text-[var(--color-text-secondary)] hover:text-[var(--color-text)]
              transition-all duration-150 cursor-pointer focus-ring
              backdrop-blur-xs shadow-2xs flex items-center gap-1.5 text-xs font-semibold
            "
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </div>

          {!flipped ? (
            /* Front — Kanji + Hán tự (Huge Size) */
            <div className="text-center flex flex-col items-center gap-6 my-auto">
              {/* Kanji lớn */}
              <div
                className="font-jp-serif font-bold tracking-tight"
                style={{
                  fontSize: 'clamp(6rem, 18vw, 11rem)',
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
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)] font-mono">
        <div className="flex items-center gap-6 hidden md:flex">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          <span>Esc = Exit Session / Fullscreen</span>
        </div>

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

        <div>
          Kanji Card {index + 1} of {total}
        </div>
      </div>
    </div>
  );
}
