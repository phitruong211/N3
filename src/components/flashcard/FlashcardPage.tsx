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
} from 'lucide-react';
import type { VocabItem, KanjiItem, GrammarItem } from '@/types';

export function FlashcardPage() {
  const { vocabulary, kanji, grammar, isBookmarked } = useApp();
  const [activeDeck, setActiveDeck] = useState<'vocab' | 'kanji' | 'grammar' | 'saved' | null>(null);

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

  if (activeDeck === 'grammar') {
    return (
      <GrammarFlashcardSession
        items={grammar}
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
          Distraction-free fullscreen flashcard study sessions for Vocabulary, Kanji, and Grammar
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
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

        {/* Grammar Deck */}
        <button
          onClick={() => setActiveDeck('grammar')}
          className="
            group p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)]
            hover:border-purple-500 hover:bg-purple-500/5
            transition-all duration-150 cursor-pointer text-left focus-ring shadow-xs hover:shadow-sm
            flex flex-col justify-between
          "
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
                Grammar Deck
              </span>
              <Compass size={18} className="text-purple-500" />
            </div>
            <div className="text-lg font-semibold text-[var(--color-text)] mb-1">
              Master N3 Grammar
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {grammar.length} patterns · Structure &amp; Usage
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
                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 whitespace-nowrap text-xs sm:text-sm md:text-base font-mono shadow-2xs"
                >
                  {item}{commonSuffix}
                </div>
              ))}
            </div>

            {/* Column 2: Plus sign centered */}
            <div className="font-extrabold text-blue-500 dark:text-blue-400 text-lg sm:text-xl md:text-2xl select-none justify-self-center px-1">
              +
            </div>

            {/* Column 3: Right side pattern left aligned */}
            <div className="text-left font-bold text-sm sm:text-base md:text-lg text-[var(--color-text)] leading-snug justify-self-start">
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
  preserveOrder = false,
}: {
  items: GrammarItem[];
  onExit: () => void;
  initialIndex?: number;
  preserveOrder?: boolean;
}) {
  const [index, setIndex] = useState(initialIndex || 0);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealedExamples, setRevealedExamples] = useState<Record<number, boolean>>({});
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
      setRevealedExamples({});
    }
  }, [index, total]);
  const prev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setFlipped(false);
      setRevealedExamples({});
    }
  }, [index]);

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
            Grammar Card {index + 1} of {total}
          </span>
          <div className="w-64 h-2 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-300"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </div>

        <div className="w-24 text-right text-xs text-[var(--color-text-tertiary)] hidden sm:block">
          Grammar Mode
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 py-6 overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={flip}
          className="
            w-full max-w-4xl lg:max-w-5xl min-h-[460px] sm:min-h-[520px] max-h-[82vh] overflow-y-auto rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-lg hover:shadow-xl flex flex-col items-center justify-center p-8 sm:p-12
            cursor-pointer transition-all duration-200
            focus-ring relative
          "
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left (Anchor): Lesson Pill */}
          <div className="absolute top-6 left-8 inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 tracking-wide select-none">
            {current.lesson || 'N3 Grammar'}
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
            className="absolute top-6 right-8 p-2.5 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-purple-500 cursor-pointer"
          >
            <Volume2 size={20} />
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
            /* Front side (Question view) — Japanese Pattern, Reading, and Formula in BLUE, sized so it does not wrap */
            <div className="text-center flex flex-col items-center justify-center my-auto gap-4 py-6 w-full max-w-4xl px-4">
              {/* 1. Mẫu ngữ pháp (Màu xanh dương dễ nhớ, font chữ vừa phải không bị xuống dòng) */}
              <div
                className="font-jp font-extrabold tracking-tight text-center text-blue-600 dark:text-blue-400"
                style={{
                  fontSize: 'clamp(1.7rem, 4vw, 3.2rem)',
                  lineHeight: 1.3,
                  textShadow: '0 2px 18px rgba(37, 99, 235, 0.12)',
                }}
              >
                {current.pattern}
              </div>

              {/* 2. Phiên âm nhỏ ở dưới */}
              {current.reading && (
                <div className="font-mono text-sm sm:text-base text-[var(--color-text-tertiary)] font-medium">
                  {current.reading}
                </div>
              )}
            </div>
          ) : (
            /* Back side (Answer view) — 1. Công thức ở đầu, 2. Ý nghĩa (xuống dòng từng nghĩa), 3. Chú ý, 4. Ví dụ (ẩn dịch, ấn mắt ra dịch) */
            <div className="text-center flex flex-col items-center justify-start gap-5 w-full max-w-3xl my-auto py-4">
              {/* 1. CÔNG THỨC Ở ĐẦU */}
              {(current.congThuc || current.structure) && (
                <div className="w-full p-3.5 sm:p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-left sm:text-center shadow-xs flex flex-col items-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
                    Công thức / Cấu trúc
                  </div>
                  <div className="w-full flex justify-center">
                    {renderFormulaBlock(current.congThuc || current.structure)}
                   </div>
                </div>
              )}

              {/* 2. DƯỚI LÀ Ý NGHĨA (nếu có nhiều nghĩa thì mỗi nghĩa xuống dòng) */}
              <div className="w-full space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Ý nghĩa
                </div>
                <div className="flex flex-col gap-2 items-center">
                  {formatMeanings(current.meaning).map((meaningItem, mIdx) => (
                    <div
                      key={mIdx}
                      className="w-full text-center text-lg sm:text-xl md:text-2xl font-extrabold text-[var(--color-text)] leading-snug py-2 px-4 rounded-xl bg-[var(--color-surface-alt)]/60 border border-[var(--color-border)]/70 shadow-2xs"
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
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)] mb-1.5">
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
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200">
                      <span className="font-bold">Phân biệt: </span>
                      {current.comparison}
                    </div>
                  )}
                  {current.commonMistakes && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                      <span className="font-bold">Lưu ý lỗi: </span>
                      {current.commonMistakes}
                    </div>
                  )}
                </div>
              )}

              {/* 4. VÍ DỤ (Normal ẩn phần dịch, ấn con mắt hiển thị bản dịch) */}
              {current.examples && current.examples.length > 0 && (
                <div className="w-full space-y-2 text-left mt-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
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
                            <div className="font-jp text-base sm:text-lg font-bold text-[var(--color-text)] group-hover/ex:text-purple-600 dark:group-hover/ex:text-purple-400 transition-colors">
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
                                  className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-purple-600 hover:bg-purple-500/10 transition-colors cursor-pointer"
                                >
                                  {isRevealed ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                              )}
                              <div className="p-1.5 rounded-full text-[var(--color-text-tertiary)] group-hover/ex:text-purple-500">
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
          Grammar Card {index + 1} of {total}
        </div>
      </div>
    </div>
  );
}

