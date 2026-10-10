import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useLearningStorage } from "@/hooks/useApp";
import {
  useActiveElapsedMinutes,
  useAnkiSessionTimer,
  formatSessionTime,
} from "@/hooks/useActiveElapsedMinutes";
import { createSRSCard, getNextIntervals, processReview } from "@/lib/srs";
import { progressToSrs, reviewCard, type ApiProgress } from "@/lib/api";
import { defaultDeckTemplate, normalizeDeckTemplate, type DeckTemplateConfig } from "@/lib/ankiImport";
import { presentationCard, type CardView } from "@/lib/cards";
import type { Rating, SRSCard } from "@/types";
import { CardFace, DeckCustomizeDialog } from "./CardPresentation";
import { Maximize2, Minimize2, Shuffle, X, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const SWIPE_THRESHOLD = 50;

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
  const { settings, srsCards, updateSRSCard, learningSync } = useApp();
  const { recordStudyActivity, recordFreeStudyActivity, getJSON, setJSON } = useLearningStorage();
  const templateKey = `study_template_${cards[0]?.source === "BUILT_IN" ? deckName : cards[0]?.deckId || deckName}`;
  const [template, setTemplate] = useState(() => cards[0]?.source === "BUILT_IN"
    ? normalizeDeckTemplate(getJSON(templateKey, initialTemplate)) : initialTemplate);
  const [customizing, setCustomizing] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sessionCards, setSessionCards] = useState(() => [...cards]);
  const [shuffled, setShuffled] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, Math.min(cards.length - 1, initialIndex)));
  const [jumpValue, setJumpValue] = useState("1");
  const [revealedCardKey, setRevealedCardKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ count: 0, correct: 0, minutes: 0 });
  const viewed = useRef(new Set<string>());
  const lock = useRef(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const current = sessionCards[index];
  const currentCardKey = current ? `${current.type}:${current.id}` : null;
  const flipped = currentCardKey !== null && revealedCardKey === currentCardKey;
  const elapsed = useActiveElapsedMinutes(
    current ? `${current.type}:${current.id}` : null,
  );
  const timer = useAnkiSessionTimer(
    mode === "anki" ? settings.ankiSessionMinutes : 0,
    deckName,
    !done,
  );
  const progress = current
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
  const type =
    current?.type === "KANJI"
      ? "kanji"
      : current?.type === "GRAMMAR"
        ? "grammar"
        : "vocabulary";
  const state: SRSCard | undefined = current
    ? progress || createSRSCard(current.id, type)
    : undefined;
  const intervals = state ? getNextIntervals(state) : null;
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
    if (lock.current || !current || !state || !flipped) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const minutes = elapsed();
      if (current.source === "BUILT_IN")
        updateSRSCard(processReview(state, rating));
      else await reviewCard(current.id, rating, Math.round(minutes * 60000));
      recordStudyActivity(
        1,
        state.state === "new" ? 1 : 0,
        rating === "again" ? 0 : 1,
        minutes,
        "srs",
      );
      setStats((s) => ({
        count: s.count + 1,
        correct: s.correct + (rating === "again" ? 0 : 1),
        minutes: s.minutes + minutes,
      }));
      if (index + 1 >= sessionCards.length || timer.isExpired()) setDone(true);
      else {
        setIndex((i) => i + 1);
        setRevealedCardKey(null);
      }
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (done || busy) return;
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (mode === "flashcards" && e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (mode === "flashcards" && e.key === "ArrowLeft") {
        e.preventDefault();
        previous();
      } else if (e.key === " ") {
        e.preventDefault();
        if (!flipped) setRevealedCardKey(currentCardKey);
        else if (mode === "flashcards") next();
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
  if (done || !current)
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center space-y-5 bg-[var(--color-bg)] p-6 text-center">
        <h2 className="text-2xl font-semibold">Đã hoàn thành</h2>
        <p>{mode === 'flashcards' ? `Đã xem ${stats.count}/${sessionCards.length} thẻ · ${stats.minutes.toFixed(1)} phút` : `${stats.count} thẻ · ${stats.count ? Math.round((stats.correct / stats.count) * 100) : 0}% chính xác · ${stats.minutes.toFixed(1)} phút`}</p>
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
  return (
    <section
      ref={sessionRef}
      className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[var(--color-bg)] select-none"
      aria-label="Phiên học thẻ"
    >
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:px-8 sm:py-4">
        <button className="study-button" disabled={busy} onClick={finish}>
          <X size={18} />
          <span className="hidden sm:inline">Thoát (Esc)</span>
        </button>
        <div className="flex min-w-0 items-center justify-center gap-3 sm:gap-5">
          <p className="truncate text-xs font-semibold text-[var(--color-text-secondary)] sm:text-sm">
            {deckName} · <span className="text-[var(--color-accent)]">{index + 1}</span>/{sessionCards.length}
          </p>
          <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[var(--color-surface-alt)] sm:block lg:w-64">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
              style={{ width: `${((index + 1) / sessionCards.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="study-button !min-h-10 !px-3" disabled={busy} aria-label="Tùy chỉnh thẻ" onClick={() => { setError(""); setCustomizing(true); }}>
            <Settings2 size={17} /><span className="hidden sm:inline">Tùy chỉnh</span>
          </button>
          {mode === "flashcards" && (
            <button
              className={`study-button !min-h-10 !px-3 ${shuffled ? "study-button-primary" : ""}`}
              aria-label="Xáo trộn"
              aria-pressed={shuffled}
              onClick={toggleShuffle}
            >
              <Shuffle size={17} />
              <span className="hidden sm:inline">Xáo trộn</span>
            </button>
          )}
          <button
            className="study-button !min-h-10 !px-3"
            onClick={() => void toggleFullscreen()}
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
          >
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span className="hidden lg:inline">
              {fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            </span>
          </button>
        </div>
      </header>
      {timer.remainingSeconds !== null && (
        <p className="shrink-0 px-4 text-center text-xs text-[var(--color-text-secondary)]">
          {timer.expired
            ? "Hết giờ · hoàn tất thẻ hiện tại"
            : `Còn ${formatSessionTime(timer.remainingSeconds)}`}
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 items-stretch justify-center overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
        <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
          <motion.div
            key={`${current.type}:${current.id}`}
            custom={slideDirection}
            variants={cardMotion}
            initial={mode === "flashcards" ? "enter" : false}
            animate="center"
            exit={mode === "flashcards" ? "exit" : undefined}
            transition={settings.reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 390, damping: 34, mass: 0.72 }}
            drag={mode === "flashcards" ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.22}
            dragMomentum={false}
            whileDrag={settings.reducedMotion ? undefined : { scale: 0.985 }}
            onDragEnd={(_, info) => {
              if (info.offset.x <= -SWIPE_THRESHOLD) moveCard("next");
              else if (info.offset.x >= SWIPE_THRESHOLD) moveCard("previous");
            }}
            className={`relative flex h-full w-full max-w-5xl cursor-pointer touch-pan-y flex-col items-center ${flipped && (current.type === "GRAMMAR" || current.extraData?.examples) ? "justify-start" : "justify-center"} overflow-y-auto rounded-2xl border border-[var(--color-border)] p-6 sm:rounded-3xl sm:p-12 ${activeStyle.theme === "dark" ? "bg-slate-900 text-white" : activeStyle.theme === "blue" ? "bg-blue-50 text-slate-900" : "bg-[var(--color-surface)]"}`}
            role="button"
            tabIndex={0}
            aria-disabled={busy}
            onKeyDown={event => {
              if (event.key === "Enter" && event.target === event.currentTarget) {
                event.preventDefault();
                if (!busy) setRevealedCardKey(value => mode === "anki" || value !== currentCardKey ? currentCardKey : null);
              }
            }}
            aria-label={flipped ? "Đã hiện đáp án" : "Hiện đáp án"}
            onClick={() => !busy &&
              setRevealedCardKey((value) =>
                mode === "anki" || value !== currentCardKey
                  ? currentCardKey
                  : null,
              )
            }
          >
            <CardFace
              card={presentationCard(current)}
              deckName={deckName}
              fields={fields}
              template={template}
              side={activeSide}
              showExampleReadings={settings.showFuriganaBack}
            />
            {!flipped && (
              <span className="absolute bottom-5 text-xs text-[var(--color-text-tertiary)] sm:hidden">
                Chạm để lật · Vuốt để chuyển thẻ
              </span>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
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
      <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-center gap-3 border-t border-[var(--color-border)] px-3 py-3 sm:px-8">
        {mode === "anki" ? (
          flipped ? (
            (["again", "hard", "good", "easy"] as Rating[]).map((rating, i) => (
              <button
                key={rating}
                disabled={busy}
                className="study-button"
                onClick={() => void rate(rating)}
              >
                {i + 1} · {["Lại", "Khó", "Được", "Dễ"][i]} (
                {intervals?.[rating]})
              </button>
            ))
          ) : (
            <button
              className="study-button study-button-primary"
              onClick={() => setRevealedCardKey(currentCardKey)}
            >
              Hiện đáp án
            </button>
          )
        ) : (
          <>
            <button
              className="study-button hidden sm:inline-flex"
              disabled={!index}
              onClick={previous}
            >
              Thẻ trước
            </button>
            <label className="study-copy inline-flex shrink-0 items-center whitespace-nowrap">
              Đến thẻ{" "}
              <input
                className="study-input !w-24"
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
            </label>
            <button
              className="study-button study-button-primary hidden w-32 shrink-0 whitespace-nowrap sm:inline-flex"
              onClick={() =>
                flipped ? next() : setRevealedCardKey(currentCardKey)
              }
            >
              {flipped
                ? index + 1 === sessionCards.length
                  ? "Hoàn thành"
                  : "Thẻ tiếp"
                : "Hiện đáp án"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
