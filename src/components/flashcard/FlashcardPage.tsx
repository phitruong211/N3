// ============================================================
// Flashcard Mode — Full Screen, Keyboard-Driven
// ============================================================
// Principles:
// - Flow State Design: Zero distractions, full immersion
// - Deep Work: No sidebars, no notifications
// - Fitts's Law: Centered content, large tap area
// - Keyboard-first: Space=Flip, ←→=Navigate, ↑↓=Rate, Esc=Exit
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/hooks/useApp';
import { ChevronLeft, ChevronRight, RotateCcw, X, BookmarkCheck, Sparkles, BookOpen, Volume2 } from 'lucide-react';
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
              {vocabulary.length} words · Meanings & Hiragana
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-tertiary)] mt-6 flex items-center gap-2 font-mono">
            <span>Space: Flip</span>
            <span>·</span>
            <span>←/→: Navigate</span>
          </div>
        </button>

        {/* Kanji Deck (NEW!) */}
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
              Master N3 Kanji
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {kanji.length} characters · Hán Việt & Compound Words
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
  // Split by comma, semicolon, or newline ONLY when followed by Japanese characters and an opening bracket (, （, 【, [
  const parts = rawText.split(/(?:[,;]|\r?\n)\s*(?=[^\(（【\[,;]+[\(（【\[])/);
  const items: { word: string; reading: string; meaning: string; raw: string }[] = [];

  for (const part of parts) {
    const trimmed = part.trim().replace(/^[,;]\s*/, '');
    if (!trimmed) continue;
    // Match pattern like: 抱く (いだく): Ấp ủ or 抱える【かかえる】: Ôm
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
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, onExit]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
      {/* Top bar — 100% synchronized with Kanji Mode */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)] transition-all"
        >
          <X size={18} />
          <span>Exit Session</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
            Vocab Card {index + 1} of {total}
          </span>
          <div className="w-48 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
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

      {/* Card area — perfectly centered vertically and horizontally, aspect-[16/10], same as Kanji Mode */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <button
          onClick={flip}
          className="
            w-full max-w-2xl aspect-[16/10] rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-md hover:shadow-lg flex flex-col items-center justify-center p-8
            cursor-pointer transition-all duration-200
            focus-ring relative overflow-hidden
          "
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {/* Top Left (Anchor): Lesson Pill */}
          <div className="absolute top-6 left-8 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)] tracking-wide select-none">
            {current.lesson || 'Bài 2'}
          </div>

          {!flipped ? (
            /* Front Side (Question view) — dead center! */
            <div className="text-center flex flex-col items-center justify-center my-auto gap-4">
              <div
                className="font-jp-serif font-semibold tracking-tight"
                style={{
                  fontSize: 'clamp(4.5rem, 14vw, 8.5rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2.5 text-xs md:text-sm font-medium text-[var(--color-text-secondary)] opacity-80 tracking-wide select-none">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    speakJapanese(current.kanji);
                  }}
                  title="Nghe phát âm"
                  className="p-2 rounded-full hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-accent)]"
                >
                  <Volume2 size={18} />
                </div>
                <span>•</span>
                <span>Chạm để lật thẻ</span>
              </div>
            </div>
          ) : (
            /* Back Side (Answer view) — dead center! Synchronized gold #C9A84C for furigana! */
            <div className="text-center flex flex-col items-center justify-center gap-4 w-full max-w-lg my-auto">
              {/* Vietnamese meaning */}
              <div
                className="font-bold tracking-tight text-center"
                style={{
                  fontSize: 'clamp(1.8rem, 4.2vw, 2.6rem)',
                  color: 'var(--color-text)',
                  lineHeight: 1.25,
                }}
              >
                {current.meaning}
              </div>

              {/* Reading (Furigana) in synchronized gold/ochre color (#C9A84C) */}
              <div
                className="font-jp font-semibold"
                style={{
                  fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                  color: '#C9A84C',
                  letterSpacing: '0.05em',
                }}
              >
                【{current.hiragana}】
              </div>

              {/* Related Section (Left-aligned, BIG Kanji, 1 horizontal line per word) */}
              {parseRelatedWords(current.relatedWords).length > 0 && (
                <div className="w-full max-w-lg mt-4 pt-4 border-t border-[var(--color-border)] text-left">
                  <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[var(--color-text-tertiary)] mb-2.5">
                    ✦ Từ liên quan / Mở rộng
                  </div>
                  <div className="flex flex-col items-start gap-2 w-full">
                    {parseRelatedWords(current.relatedWords).slice(0, 4).map((v, i) => (
                      <div
                        key={i}
                        className="flex items-baseline gap-2.5 w-full text-left"
                      >
                        {v.word ? (
                          <div className="flex items-baseline gap-2.5 flex-wrap sm:flex-nowrap">
                            {/* Kanji word (BIG font text-xl md:text-2xl) */}
                            <span className="font-jp-serif font-bold text-xl md:text-2xl text-[var(--color-text)] shrink-0">
                              {v.word}
                            </span>
                            {/* Reading in gold brackets */}
                            {v.reading && (
                              <span className="font-jp font-medium text-base md:text-lg text-[#C9A84C] shrink-0">
                                【{v.reading}】
                              </span>
                            )}
                            {/* Meaning on 1 line */}
                            <span className="text-sm md:text-base text-[var(--color-text-secondary)] font-normal">
                              : {v.meaning ? v.meaning.replace(/[\r\n]+/g, ' ').trim() : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm md:text-base text-[var(--color-text-secondary)]">
                            {v.raw ? v.raw.replace(/[\r\n]+/g, ' ').trim() : ''}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Footer — 100% synchronized with Kanji Mode, with optional subtle self-assessment buttons in the center! */}
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-6 font-mono hidden md:flex">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          <span>Esc = Exit</span>
        </div>

        {/* Tactile buttons in footer so card stays perfectly centered */}
        <div className="flex items-center gap-3 mx-auto md:mx-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FECACA] dark:border-[#991B1B]/50 bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 text-[#DC2626] dark:text-[#FCA5A5] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>✕ Chưa nhớ</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#BBF7D0] dark:border-[#166534]/50 bg-[#F0FDF4] dark:bg-[#14532D]/20 text-[#16A34A] dark:text-[#86EFAC] font-medium hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
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
// Fullscreen Kanji Flashcard Session (NEW!)
// ============================================================

function KanjiFlashcardSession({
  items,
  onExit,
}: {
  items: KanjiItem[];
  onExit: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffledItems] = useState(() =>
    [...items].sort(() => Math.random() - 0.5)
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
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flip, next, prev, onExit]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg)] flex flex-col justify-between select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-6">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] cursor-pointer focus-ring px-3 py-1.5 rounded-lg border border-transparent hover:border-[var(--color-border)] transition-all"
        >
          <X size={18} />
          <span>Exit Session</span>
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-medium text-[var(--color-text-secondary)]">
            Kanji Card {index + 1} of {total}
          </span>
          <div className="w-48 h-1.5 rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
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

      {/* Card area — perfectly centered */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <button
          onClick={flip}
          className="
            w-full max-w-2xl aspect-[16/10] rounded-3xl
            bg-[var(--color-surface)] border border-[var(--color-border)]
            shadow-md hover:shadow-lg flex flex-col items-center justify-center p-8
            cursor-pointer transition-all duration-200
            focus-ring relative overflow-hidden
          "
          aria-label={flipped ? 'Showing answer, click to show question' : 'Showing question, click to flip'}
        >
          {!flipped ? (
            /* Front — Kanji + Hán tự */
            <div className="text-center flex flex-col items-center gap-5">
              {/* Kanji lớn */}
              <div
                className="font-jp-serif font-semibold tracking-tight"
                style={{
                  fontSize: 'clamp(5rem, 15vw, 9rem)',
                  lineHeight: 1,
                  color: 'var(--color-text)',
                  textShadow: '0 2px 24px rgba(0,0,0,0.08)',
                }}
              >
                {current.kanji}
              </div>
              {/* Hán tự */}
              <div
                className="uppercase tracking-[0.25em] font-semibold"
                style={{
                  fontSize: 'clamp(1.1rem, 3vw, 1.6rem)',
                  color: '#C9A84C',
                  letterSpacing: '0.3em',
                  textShadow: '0 1px 8px rgba(201,168,76,0.18)',
                }}
              >
                {current.hanViet}
              </div>
            </div>
          ) : (
            /* Back — Từ ghép + Phiên âm + Nghĩa (No kanji duplication) */
            <div className="text-center flex flex-col items-center gap-5 w-full max-w-md my-auto">
              {current.vocabulary && current.vocabulary.length > 0 ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  {current.vocabulary.slice(0, 3).map((v, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="flex items-baseline gap-3 justify-center">
                        <span
                          className="font-jp-serif font-medium"
                          style={{
                            fontSize: 'clamp(1.25rem, 3.5vw, 1.75rem)',
                            color: 'var(--color-text)',
                          }}
                        >
                          {v.word}
                        </span>
                        <span
                          className="font-jp"
                          style={{
                            fontSize: 'clamp(0.95rem, 2.5vw, 1.2rem)',
                            color: '#C9A84C',
                            fontWeight: 500,
                          }}
                        >
                          【{v.reading}】
                        </span>
                      </div>
                      {v.meaning && (
                        <div
                          style={{
                            fontSize: 'clamp(0.8rem, 2vw, 0.95rem)',
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
                  className="uppercase tracking-[0.25em] font-semibold"
                  style={{ fontSize: '1.4rem', color: '#C9A84C', letterSpacing: '0.3em' }}
                >
                  {current.hanViet}
                </div>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Footer / Shortcut Badges */}
      <div className="px-8 py-5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <div className="flex items-center gap-6 font-mono">
          <span>Space / Click = Flip</span>
          <span>← / → = Previous / Next</span>
          <span>Esc = Exit</span>
        </div>
        <div>
          Kanji Card {index + 1} of {total}
        </div>
      </div>
    </div>
  );
}
