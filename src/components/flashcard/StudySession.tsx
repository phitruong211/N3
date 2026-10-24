import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useLearningStorage } from "@/hooks/useApp";
import { projectedReview, type QueuedReview } from '@/lib/reviewOutbox';
import { useReviewTiming } from '@/hooks/useReviewTiming';
import { useAuth } from '@/hooks/useAuth';
import { Sunrise } from '@/components/ui/ink';
import {
  useActiveElapsedMinutes,
} from "@/hooks/useActiveElapsedMinutes";
import { createSRSCard, formatDate, getNextIntervals, processReview } from "@/lib/srs";
import { legacyToFsrsProgress, progressToSrsCard } from "@/lib/fsrsProgress";
import { applyReviewedProgress, createReviewQueue, nearestFutureDue, nextReadyCard, promoteDueCards, reviewSessionSummary } from "@/lib/liveReviewQueue";
import { progressToSrs, type ApiProgress } from "@/lib/api";
import { defaultDeckTemplate, normalizeDeckTemplate, type DeckTemplateConfig } from "@/lib/ankiImport";
import { presentationCard, type CardView } from "@/lib/cards";
import type { Rating, SRSCard } from "@/types";
import { CardFace, DeckCustomizeDialog } from "./CardPresentation";
import { useStudyNote, NoteButton, PersonalNoteView, PersonalNoteEditor } from './PersonalCardNote';
import { Maximize2, Minimize2, Shuffle, X, Settings2, Undo2, HelpCircle } from '@/components/ui/icons';
import "@fontsource/zen-maru-gothic/japanese-500.css";
import "./studySession.css";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { StudyClock, useStudySeconds } from "./StudyClock";

const SWIPE_THRESHOLD = 50;

// Keys stay with the open help; browsers without :popover-open never show it.
function helpIsOpen() {
  try { return document.querySelector('#study-help:popover-open') !== null; } catch { return false; }
}

function fisherYates<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const cardMotion = {
  enter: (direction: number) => ({
    x: direction > 0 ? 88 : -88,
    opacity: 0,
    scale: 0.985,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -88 : 88,
    opacity: 0,
    scale: 0.985,
  }),
};

export function StudySession({
  cards,
  deckName,
  mode,
  template: initialTemplate = defaultDeckTemplate(),
  initialProgress = {},
  onExit,
  onTemplateChange,
  onCardChange,
  initialIndex = 0,
  onPositionChange,
  onComplete,
}: {
  cards: CardView[];
  deckName: string;
  mode: "flashcards" | "anki";
  template?: DeckTemplateConfig;
  initialProgress?: Record<string, ApiProgress | null>;
  onExit: () => void;
  onTemplateChange?: (template: DeckTemplateConfig) => Promise<void> | void;
  onCardChange?: (card: ReturnType<typeof presentationCard>) => Promise<CardView>;
  initialIndex?: number;
  onPositionChange?: (cardId: string) => void;
  onComplete?: () => void;
}) {
  const { settings, srsCards, updateSRSCard, learningSync, reviewOutbox } = useApp();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = settings.reducedMotion || Boolean(prefersReducedMotion);
  const { recordStudyActivity, recordFreeStudyActivity, undoReviewActivity, getJSON, setJSON } = useLearningStorage();
  const templateKey = `study_template_${cards[0]?.source === "BUILT_IN" ? deckName : cards[0]?.deckId || deckName}`;
  const [template, setTemplate] = useState(() => {
    if (cards[0]?.source !== 'BUILT_IN') return initialTemplate;
    const stored = getJSON<DeckTemplateConfig | null>(templateKey, null);
    if (stored) return normalizeDeckTemplate(stored);
    return initialTemplate;
  });
  const [customizing, setCustomizing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sessionCards, setSessionCards] = useState(() => [...cards]);
  const [reviewQueue, setReviewQueue] = useState(() => {
    const progressByKey = new Map<string, ReturnType<typeof legacyToFsrsProgress> | null>();
    for (const card of cards) {
      const stored = card.source === 'BUILT_IN'
        ? srsCards.find(item => item.cardId === card.id && item.deckType === card.type.toLowerCase())
        : initialProgress[card.id] ? progressToSrs(card.id, initialProgress[card.id]!) : null;
      const projected = reviewOutbox.project(card.source === 'BUILT_IN' ? 'BUILT_IN' : 'PERSONAL', { ...(stored ?? createSRSCard(card.id, 'vocabulary')), deckType: card.type === 'KANJI' ? 'kanji' : card.type === 'GRAMMAR' ? 'grammar' : 'vocabulary' });
      progressByKey.set(card.id, legacyToFsrsProgress(projected));
    }
    return createReviewQueue({ cards, keyFor: card => card.id, progressByKey, now: new Date(), dailyNewLimit: settings.srsDailyNewLimit });
  });
  const [shuffled, setShuffled] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(cards.length - 1, initialIndex)));
  const [jumpValue, setJumpValue] = useState("1");
  const [revealedCardKey, setRevealedCardKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [stats, setStats] = useState({ count: 0, correct: 0, minutes: 0 });
  const [receipt, setReceipt] = useState<{ item: QueuedReview; queue: typeof reviewQueue; stats: typeof stats } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");
  const undoPending = mode === 'anki' && (undoing || reviewOutbox.undoPending);
  const recoveringUndo = useRef(reviewOutbox.data.undo?.item);
  const blocked = busy || undoPending;
  const viewed = useRef(new Set<string>());
  const lock = useRef(false);
  const dragged = useRef(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const scheduled = mode === 'anki' ? nextReadyCard(reviewQueue) : null;
  const current = mode === 'anki' ? scheduled?.card : sessionCards[index];
  const personalNote = useStudyNote(current);
  const currentCardKey = current ? `${current.type}:${current.id}` : null;
  const flipped = currentCardKey !== null && revealedCardKey === currentCardKey;
  const studySeconds = useStudySeconds(Boolean(current) && !done && !customizing && !personalNote.open);
  const readReviewTiming = useReviewTiming(currentCardKey, flipped, customizing || personalNote.open || busy || done);
  const elapsed = useActiveElapsedMinutes(
    current ? `${current.type}:${current.id}` : null,
  );
  const progress = current && mode === 'anki'
    ? reviewQueue.progressByKey.get(current.id) ?? undefined
    : current
    ? current.source === "BUILT_IN"
      ? srsCards.find(
          (c) =>
            c.cardId === current.id &&
            c.deckType === current.type.toLowerCase(),
        )
      : initialProgress[current.id]
        ? progressToSrs(current.id, initialProgress[current.id]!)
        : undefined
    : undefined;
  const sessionRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [chromeIdle, setChromeIdle] = useState(false);
  const type =
    current?.type === "KANJI"
      ? "kanji"
      : current?.type === "GRAMMAR"
        ? "grammar"
        : "vocabulary";
  const state: SRSCard | undefined = current
    ? progress
      ? ('dueAt' in progress ? progressToSrsCard(current.id, type, progress) : progress)
      : createSRSCard(current.id, type)
    : undefined;
  const intervals = state ? getNextIntervals(state, settings) : null;
  const recordView = useCallback(() => {
    if (
      !current ||
      !flipped ||
      viewed.current.has(`${current.type}:${current.id}`)
    )
      return;
    viewed.current.add(`${current.type}:${current.id}`);
    const minutes = elapsed();
    recordFreeStudyActivity(1, minutes);
    setStats((s) => ({
      count: s.count + 1,
      correct: s.correct,
      minutes: s.minutes + minutes,
    }));
  }, [current, flipped, elapsed, recordFreeStudyActivity]);
  function finish() {
    if (mode === "flashcards") recordView();
    if (mode === "flashcards") {
      if (done) onComplete?.();
      else if (current) onPositionChange?.(current.id);
    }
    queueMicrotask(() => void learningSync.flush().catch(() => {}));
    if (document.fullscreenElement) void document.exitFullscreen();
    onExit();
  }
  async function toggleFullscreen() {
    if (!document.fullscreenElement) await sessionRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }
  const moveCard = useCallback((direction: "next" | "previous") => {
    if (mode !== "flashcards" || busy) return;
    if (direction === "previous" && index === 0) return;
    recordView();
    setSlideDirection(direction === "next" ? 1 : -1);
    if (direction === "next" && index + 1 >= sessionCards.length) {
      setDone(true);
      onComplete?.();
    } else {
      const nextIndex = index + (direction === "next" ? 1 : -1);
      setIndex(nextIndex);
      onPositionChange?.(sessionCards[nextIndex].id);
      setRevealedCardKey(null);
    }
  }, [mode, busy, index, recordView, sessionCards, onComplete, onPositionChange]);
  const next = useCallback(() => moveCard("next"), [moveCard]);
  const previous = useCallback(() => moveCard("previous"), [moveCard]);
  function toggleShuffle() {
    const currentId = current?.id;
    const nextCards = shuffled ? [...cards] : fisherYates(cards);
    const nextIndex = currentId
      ? nextCards.findIndex((card) => card.id === currentId)
      : 0;
    setSessionCards(nextCards);
    setIndex(Math.max(0, nextIndex));
    setShuffled((value) => !value);
  }
  function commitJump() {
    if (!jumpValue.trim()) {
      setJumpValue(String(index + 1));
      return;
    }
    const requested = Number.parseInt(jumpValue, 10);
    if (!Number.isFinite(requested)) {
      setJumpValue(String(index + 1));
      return;
    }
    const nextIndex = Math.min(
      sessionCards.length - 1,
      Math.max(0, requested - 1),
    );
    if (nextIndex !== index) {
      recordView();
      setSlideDirection(nextIndex > index ? 1 : -1);
      setIndex(nextIndex);
      onPositionChange?.(sessionCards[nextIndex].id);
      setRevealedCardKey(null);
    }
    setJumpValue(String(nextIndex + 1));
  }
  async function rate(rating: Rating) {
    if (lock.current || undoPending || !current || !state || !flipped) return;
    const timing = readReviewTiming();
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const minutes = elapsed();
      const now = new Date();
      const saved = processReview(state, rating, now, settings);
      const item: QueuedReview = {
        id: crypto.randomUUID(),
        source: current.source === 'BUILT_IN' ? 'BUILT_IN' : 'PERSONAL',
        card: { ...state }, rating, optimistic: { ...saved }, timing,
        responseTimeMs: Math.round(minutes * 60000),
        activity: { date: formatDate(now), isNew: state.state === 'new', correct: rating !== 'again' },
      };
      if (user) {
        await reviewOutbox.enqueue(item);
      } else {
        const guestLogs = getJSON<unknown[]>('guest_review_logs', []);
        setJSON('guest_review_logs', [...guestLogs, { id: item.id, cardId: current.id, deckType: type, rating,
          ...timing, reviewedAt: new Date().toISOString(), schedulerVersion: 'fsrs-6/ts-fsrs-5.4.2' }]);
        updateSRSCard(saved);
      }
      recordStudyActivity(
        1,
        state.state === "new" ? 1 : 0,
        rating === "again" ? 0 : 1,
        minutes,
        "srs",
      );
      setReceipt({ item, queue: reviewQueue, stats: { ...stats } });
      setUndoError("");
      setStats((s) => ({
        count: s.count + 1,
        correct: s.correct + (rating === "again" ? 0 : 1),
        minutes: s.minutes + minutes,
      }));
      const nextQueue = applyReviewedProgress(reviewQueue, current.id, legacyToFsrsProgress(saved), new Date());
      setReviewQueue(nextQueue);
      setRevealedCardKey(null);
      if (!nextQueue.ready.length && !nextQueue.futureLearning.length) setDone(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Chưa lưu được lịch ôn. Thử lại.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function undoLastReview() {
    if (!receipt || lock.current || undoing) return;
    lock.current = true;
    setUndoing(true);
    setUndoError("");
    try {
      const { item, queue, stats: previousStats } = receipt;
      let restored = item.card;
      if (user) {
        await reviewOutbox.undo(item);
        // The completion effect also handles retries after a network failure.
        return;
      }
      else {
        updateSRSCard(restored);
        const logs = getJSON<Array<{ id?: string }>>('guest_review_logs', []);
        setJSON('guest_review_logs', logs.filter(log => log.id !== item.id));
        if (item.activity) undoReviewActivity(item.id, item.activity);
      }
      setReviewQueue({
        ...queue,
        progressByKey: new Map(queue.progressByKey).set(item.card.cardId, legacyToFsrsProgress(restored)),
        ready: [item.card.cardId, ...queue.ready.filter(key => key !== item.card.cardId)],
        futureLearning: queue.futureLearning.filter(key => key !== item.card.cardId),
      });
      setStats(value => ({ ...previousStats, minutes: value.minutes }));
      const restoredCard = queue.cardsByKey.get(item.card.cardId)!;
      setRevealedCardKey(`${restoredCard.type}:${restoredCard.id}`);
      setDone(false);
      setError("");
      setReceipt(null);
    } catch (reason) {
      setUndoError(reason instanceof Error ? reason.message : "Chưa hoàn tác được. Thử lại.");
    } finally {
      lock.current = false;
      setUndoing(false);
    }
  }
  const undoButton = mode === 'anki' ? <button
    className="study-session-tool"
    title="Quay lại lượt vừa trả lời (Backspace)"
    aria-label="Quay lại lượt vừa trả lời (Backspace)"
    aria-keyshortcuts="Backspace"
    disabled={!receipt || busy || undoing}
    onClick={() => void undoLastReview()}
  ><Undo2 size={18}/></button> : null;
  const undoStatus = mode !== 'anki' ? null
    : reviewOutbox.data.rejectedUndo ? <p role="status" className="study-undo-status">{reviewOutbox.data.rejectedUndo.message}</p>
    : undoing ? <p role="status" className="study-undo-status">Đang hoàn tác…</p>
    : undoPending && reviewOutbox.error ? <p role="alert" className="study-undo-status">{reviewOutbox.error} <button onClick={reviewOutbox.retry}>Thử lại</button></p>
    : undoPending ? <p role="status" className="study-undo-status">Đang chờ hoàn tất hoàn tác.</p>
    : undoError ? <p role="alert" className="study-undo-status">{undoError} <button onClick={() => void undoLastReview()}>Thử lại</button></p> : null;
  const outboxData = reviewOutbox.data;
  useEffect(() => {
    if (mode !== 'anki') return;
    if (outboxData.rejectedUndo) {
      recoveringUndo.current = undefined;
      if (receipt?.item.id === outboxData.rejectedUndo.item.id) setReceipt(null);
      setUndoError('');
      return;
    }
    if (outboxData.undo) recoveringUndo.current = outboxData.undo.item;
    const completed = outboxData.lastUndo;
    const previous = receipt?.item.id === completed?.id ? receipt : null;
    const item = previous?.item ?? recoveringUndo.current;
    if (!completed || !item || item.id !== completed.id || outboxData.undo) return;
    recoveringUndo.current = undefined;
    const restoredCard = cards.find(card => card.id === item.card.cardId);
    if (restoredCard) {
      setReviewQueue(currentQueue => {
        const queue = previous?.queue ?? currentQueue;
        return {
          ...queue,
          progressByKey: new Map(queue.progressByKey).set(item.card.cardId, legacyToFsrsProgress(completed.card)),
          ready: [item.card.cardId, ...queue.ready.filter(key => key !== item.card.cardId)],
          futureLearning: queue.futureLearning.filter(key => key !== item.card.cardId),
        };
      });
      setRevealedCardKey(`${restoredCard.type}:${restoredCard.id}`);
      setDone(false);
    }
    if (previous) {
      setStats(value => ({ ...previous.stats, minutes: value.minutes }));
      setReceipt(null);
    }
    setUndoError('');
    setError('');
  }, [outboxData.undo, outboxData.lastUndo, outboxData.rejectedUndo, receipt, cards, mode]);
  useEffect(() => {
    if (mode !== 'anki') return;
    setReviewQueue(queue => {
      let next = queue;
      for (const card of cards) {
        const old = next.progressByKey.get(card.id);
        if (!old || !next.answeredToday.has(card.id)) continue;
        const type = card.type === 'KANJI' ? 'kanji' : card.type === 'GRAMMAR' ? 'grammar' : 'vocabulary';
        const projected = projectedReview(outboxData, card.source === 'BUILT_IN' ? 'BUILT_IN' : 'PERSONAL', progressToSrsCard(card.id, type, old));
        if (projected.reps === old.repetitions && JSON.stringify(legacyToFsrsProgress(projected)) !== JSON.stringify(old)) {
          const currentKey = next.ready[0];
          // Do not replace the progress of a card whose question is already visible.
          if (currentKey === card.id) continue;
          next = applyReviewedProgress(next, card.id, legacyToFsrsProgress(projected), new Date());
          if (currentKey && next.ready.includes(currentKey)) next = { ...next, ready: [currentKey, ...next.ready.filter(key => key !== currentKey)] };
        }
      }
      return next;
    });
  }, [outboxData, cards, mode]);
  useEffect(() => {
    if (mode !== 'anki' || done || reviewQueue.ready.length || !reviewQueue.futureLearning.length) return;
    const promote = () => {
      setClock(Date.now());
      setReviewQueue(queue => promoteDueCards(queue, new Date()));
    };
    promote();
    const id = window.setInterval(promote, 1000);
    return () => window.clearInterval(id);
  }, [mode, done, reviewQueue.ready.length, reviewQueue.futureLearning.length]);
  useEffect(() => {
    if (
      !settings.autoPlayAudio ||
      !current ||
      done ||
      !("speechSynthesis" in window)
    )
      return;
    const speech = new SpeechSynthesisUtterance(
      current.reading || current.front,
    );
    speech.lang = "ja-JP";
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [current, settings.autoPlayAudio, done]);
  useEffect(() => {
    setJumpValue(String(index + 1));
  }, [index]);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  // Quiet reading: after a pause the chrome dims (windowed) or hides (fullscreen), and returns on pointer, touch or Tab.
  useEffect(() => {
    let timer = 0;
    const wake = () => { setChromeIdle(false); window.clearTimeout(timer); timer = window.setTimeout(() => setChromeIdle(true), fullscreen ? 2500 : 4000); };
    const wakeOnTab = (event: KeyboardEvent) => { if (event.key === 'Tab') wake(); };
    wake();
    const pointer = ['pointermove', 'pointerdown', 'touchstart'] as const;
    pointer.forEach(name => window.addEventListener(name, wake, { passive: true }));
    window.addEventListener('keydown', wakeOnTab);
    return () => { window.clearTimeout(timer); pointer.forEach(name => window.removeEventListener(name, wake)); window.removeEventListener('keydown', wakeOnTab); };
  }, [fullscreen]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (busy || undoing || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        customizing || personalNote.open || helpIsOpen() || document.querySelector('dialog[open],[role="dialog"]')
      )
        return;
      if (e.key === 'Backspace' && mode === 'anki' && receipt) {
        e.preventDefault();
        void undoLastReview();
        return;
      }
      if (done || undoPending) return;
      // Space/Enter on native controls must retain their normal activation behavior.
      if ((e.key === ' ' || e.key === 'Enter') && (e.target as HTMLElement).closest('button,a')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && personalNote.key) {
        e.preventDefault(); personalNote.setOpen(true);
      } else if (mode === "flashcards" && e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (mode === "flashcards" && e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setRevealedCardKey(currentCardKey);
        else if (mode === "flashcards") next();
        else if (e.key === " ") void rate("good");
      } else if (
        mode === "anki" &&
        flipped &&
        ["1", "2", "3", "4"].includes(e.key)
      ) {
        e.preventDefault();
        void rate(
          (["again", "hard", "good", "easy"] as Rating[])[Number(e.key) - 1],
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const summary = reviewSessionSummary(reviewQueue);
  const progressValue = mode === 'anki' ? summary.reviewed : index + 1;
  const progressTotal = mode === 'anki' ? summary.total : sessionCards.length;
  const futureDue = mode === 'anki' ? nearestFutureDue(reviewQueue) : null;
  if (!done && mode === 'anki' && !current && futureDue) {
    const seconds = Math.max(0, Math.ceil((Date.parse(futureDue) - clock) / 1000));
    return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[var(--color-bg)] p-6 text-center">
      <StudyClock seconds={studySeconds}/>
      {undoButton}{undoStatus}
      <p className="study-eyebrow">THẺ QUÊN SẼ QUAY LẠI</p>
      <h2 className="text-3xl font-semibold">Tiếp tục sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</h2>
      <p className="study-copy max-w-xl">Bạn đã xem hết các thẻ đang sẵn sàng. Có thể chờ để học lại đúng lịch hoặc kết thúc và quay lại sau.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button className="study-button" onClick={finish}>Kết thúc phiên</button>
        <button className="study-button study-button-primary" onClick={() => setReviewQueue(queue => promoteDueCards(queue, new Date()))}>Kiểm tra lại</button>
      </div>
    </div>;
  }
  if (done || !current)
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center space-y-5 bg-[var(--color-bg)] p-6 text-center">
        <Sunrise size={190}/>
        <StudyClock seconds={studySeconds}/>
        {undoButton}{undoStatus}
        <h2 className="study-title">Đã hoàn thành</h2>
        <p>{mode === 'flashcards' ? `Đã xem ${stats.count}/${sessionCards.length} thẻ · ${(studySeconds / 60).toFixed(1)} phút` : `${reviewQueue.answeredToday.size} thẻ · ${stats.count} lượt trả lời · ${stats.count ? Math.round((stats.correct / stats.count) * 100) : 0}% chính xác · ${(studySeconds / 60).toFixed(1)} phút`}</p>
        <button className="study-button study-button-primary" onClick={finish}>
          Về danh sách bộ thẻ
        </button>
      </div>
    );
  const sideFields = (
    flipped
      ? template.back.fields
      : template.front.fields
  ).filter((field) => (flipped ? settings.showFuriganaBack : settings.showFuriganaFront) || field !== "reading");
  const fields = flipped && template.back.showFront && !sideFields.includes("front") ? ["front" as const, ...sideFields] : sideFields;
  const activeSide = flipped ? "back" : "front";
  const activeStyle = template[activeSide].style;
  // With no buttons under the card, a tap does what Space does: reveal, then move on.
  const tapCard = () => mode === "flashcards" && flipped ? next() : setRevealedCardKey(currentCardKey);
  return (
    <section
      ref={sessionRef}
      className="study-session fixed inset-0 z-50 flex min-h-0 flex-col bg-[var(--color-bg)] select-none"
      data-reduced-motion={reduceMotion || undefined}
      data-fullscreen={fullscreen || undefined}
      data-chrome={chromeIdle && !customizing && !personalNote.open ? (fullscreen ? 'hidden' : 'dim') : undefined}
      aria-label="Phiên học thẻ"
    >
      <header className="study-session-header">
        <div className="study-session-toolbar">
          <button className="study-session-end" disabled={blocked} onClick={finish} title="Kết thúc phiên (Esc)" aria-label="Kết thúc phiên">
            <X size={17} /><span>Kết thúc phiên</span>
          </button>
          <div className="study-session-heading">
            <p className="study-session-deck">{deckName}</p>
            <p className="study-session-count"><strong>{progressValue}<span> / {progressTotal}</span></strong> {mode === 'anki' ? 'thẻ đã ôn' : 'thẻ'}

            </p>
          </div>
          <div className="study-session-tools">
            <StudyClock seconds={studySeconds}/>
            {undoButton}
            <NoteButton note={personalNote} compact/>
            <button className="study-session-tool" popoverTarget="study-help" title="Cách dùng và phím tắt" aria-label="Cách dùng và phím tắt"><HelpCircle size={18}/></button>
            <button className="study-session-tool" disabled={blocked} title="Tùy chỉnh thẻ" aria-label="Tùy chỉnh thẻ" onClick={() => { setError(""); setCustomizing(true); }}><Settings2 size={18}/></button>
            {mode === 'flashcards' && <button className="study-session-tool" title="Xáo trộn thẻ" aria-label="Xáo trộn" aria-pressed={shuffled} onClick={toggleShuffle}><Shuffle size={18}/></button>}
            <button className="study-session-tool" onClick={() => void toggleFullscreen()} title={fullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'} aria-label={fullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}>
              {fullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
          </div>
        </div>
        <div className="study-session-progress" role="progressbar" aria-label={mode === 'anki' ? 'Số thẻ đã ôn trong phiên' : 'Vị trí trong bộ thẻ'} aria-valuenow={progressValue} aria-valuemin={0} aria-valuemax={progressTotal} aria-valuetext={`${progressValue} trên ${progressTotal} thẻ`}>
          <div style={{ width: `${progressTotal ? progressValue / progressTotal * 100 : 0}%` }}/>
        </div>

      </header>
      <div className="study-session-workspace">

      <div className="study-session-stage">
        <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
          <motion.div
            key={`${current.type}:${current.id}`}
            custom={slideDirection}
            variants={cardMotion}
            initial={mode === "flashcards" ? "enter" : false}
            animate="center"
            exit={mode === "flashcards" ? "exit" : undefined}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 34, mass: 0.72 }}
            drag={mode === "flashcards" ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.22}
            dragMomentum={false}
            whileDrag={reduceMotion ? undefined : { scale: 0.985 }}
            onPointerDown={() => { dragged.current = false; }}
            onDragStart={() => { dragged.current = true; }}
            onDragEnd={(_, info) => {
              if (info.offset.x <= -SWIPE_THRESHOLD) moveCard("next");
              else if (info.offset.x >= SWIPE_THRESHOLD) moveCard("previous");
            }}
            className={`study-session-card ${flipped && (current.type === "GRAMMAR" || current.extraData?.examples || current.extraData?.kanjiVocabulary || personalNote.entry?.text) ? "study-session-card-rich" : ""}`}
            data-card-theme={activeStyle.theme}
            data-kind={current.type.toLowerCase()}
            data-side={activeSide}
            role="button"
            tabIndex={0}
            aria-disabled={blocked}
            onKeyDown={event => {
              if (event.ctrlKey || event.metaKey || event.altKey) return;
              if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) {
                event.preventDefault();
                event.stopPropagation();
                if (!blocked && !event.repeat) {
                  if (mode === "anki" && flipped && event.key === " ") void rate("good");
                  else tapCard();
                }
              }
            }}
            aria-label={!flipped ? "Hiện đáp án" : mode === "flashcards" ? "Sang thẻ tiếp" : "Đã hiện đáp án"}
            onClick={event => {
              // A swipe ends with a click on the same card; it must not advance a second time.
              if (dragged.current || blocked || (event.target as HTMLElement).closest('button,a,input,textarea,select')) return;
              tapCard();
            }}
          >
            <p className="study-session-face-label" aria-hidden="true">
              {{ VOCABULARY: "Từ vựng", KANJI: "Kanji", GRAMMAR: "Ngữ pháp" }[current.type] ?? current.type} · {flipped ? "Đáp án" : "Câu hỏi"}
            </p>
            <motion.div key={`${currentCardKey}:${activeSide}`} className="study-session-face"
              initial={reduceMotion ? false : { opacity: 0.35, rotateY: -8, y: 3 }}
              animate={{ opacity: 1, rotateY: 0, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}>
            <CardFace
              card={presentationCard(current)}
              deckName={deckName}
              fields={fields}
              template={template}
              side={activeSide}
              showExampleReadings={settings.showFuriganaBack}
            />
            {flipped && <PersonalNoteView note={personalNote}/>}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
      {undoStatus}
      {error && (
        <p role="alert" className="shrink-0 px-4 text-center text-[var(--color-error)]">
          {error}
        </p>
      )}
      {customizing && <DeckCustomizeDialog
        deck={{ id: cards[0]?.deckId || "study", name: deckName, source: "Phiên học", format: "", createdAt: "", position: 0, template, cards: [presentationCard(current)] }}
        busy={savingTemplate}
        error={error}
        editableCard={current.source === "IMPORT" && onCardChange ? presentationCard(current) : undefined}
        onCancel={() => setCustomizing(false)}
        onSave={async (next, changedCard) => {
          setSavingTemplate(true);
          try {
            if (changedCard && onCardChange && JSON.stringify(changedCard) !== JSON.stringify(presentationCard(current))) {
              const updated = await onCardChange(changedCard);
              setSessionCards((previous) => previous.map((card) => card.id === updated.id ? updated : card));
              setReviewQueue(previous => ({
                ...previous,
                cardsByKey: new Map(previous.cardsByKey).set(updated.id, updated),
              }));
            }
            if (JSON.stringify(next) !== JSON.stringify(template)) {
              if (onTemplateChange) await onTemplateChange(next);
              else setJSON(templateKey, next);
            }
            setTemplate(next);
            setCustomizing(false);
            setError("");
          } catch (reason) { setError(reason instanceof Error ? reason.message : "Không lưu được tùy chỉnh"); }
          finally { setSavingTemplate(false); }
        }}
      />}
      <div id="study-help" popover="auto" className="study-help">
        <p className="study-help-title">Cách dùng</p>
        <dl>
          {(mode === "flashcards" ? [
            ["Chạm thẻ · Space", "Lật thẻ, rồi sang thẻ tiếp"],
            ["→ · vuốt trái", "Thẻ tiếp"],
            ["← · vuốt phải", "Thẻ trước"],
            ["Ô số dưới thẻ", "Nhảy tới thẻ bất kỳ"],
          ] : [
            ["Chạm thẻ · Space", "Hiện đáp án"],
            ["1 · 2 · 3 · 4", "Quên · Khó · Tốt · Dễ"],
            ["Space (sau khi lật)", "Tốt"],
            ["Backspace", "Hoàn tác lượt vừa trả lời"],
          ]).concat([["N", "Ghi chú riêng"], ["Esc", "Kết thúc phiên"]]).map(([key, action]) => (
            <div key={key}><dt><kbd>{key}</kbd></dt><dd>{action}</dd></div>
          ))}
        </dl>
      </div>
      <PersonalNoteEditor note={personalNote} card={current}/>
      <div className={`study-session-actions ${mode === "flashcards" ? "study-free-controls" : ""} ${mode === "anki" && flipped ? "study-session-ratings" : ""}`} aria-label={mode === "anki" && flipped ? "Đánh giá mức độ ghi nhớ" : "Điều khiển thẻ"}>
        {mode === "anki" ? (
          flipped ? (
            (["again", "hard", "good", "easy"] as Rating[]).map((rating, i) => (
              <button
                key={rating}
                aria-keyshortcuts={String(i + 1)}
                aria-label={`${i + 1} · ${["Quên", "Khó", "Tốt", "Dễ"][i]} (${intervals?.[rating]})`}
                disabled={blocked}
                title={["Không nhớ hoặc trả lời sai", "Nhớ đúng nhưng khó khăn", "Nhớ đúng bình thường", "Nhớ đúng và dễ dàng"][i]}
                className={`study-session-rating study-session-rating-${rating}`}
                onClick={() => void rate(rating)}
              >
                <span className="study-session-rating-title"><kbd>{i + 1}</kbd>{["Quên", "Khó", "Tốt", "Dễ"][i]}</span>
                <span className="study-session-interval">{intervals?.[rating]}</span>
              </button>
            ))
          ) : null
        ) : (
          <>
            <label className="study-free-position">
              <span className="sr-only">Đến thẻ</span>
              <input
                className="study-free-index"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label="Số thứ tự thẻ muốn mở"
                value={jumpValue}
                onChange={(event) => {
                  if (/^\d*$/.test(event.target.value))
                    setJumpValue(event.target.value);
                }}
                onBlur={commitJump}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setJumpValue(String(index + 1));
                  }
                }}
              />
              <span className="study-free-total">/ {sessionCards.length}</span>
            </label>
          </>
        )}
      </div>
      </div>
    </section>
  );
}
