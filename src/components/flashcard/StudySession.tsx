import { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useLearningStorage } from "@/hooks/useApp";
import {
  useActiveElapsedMinutes,
  useAnkiSessionTimer,
  formatSessionTime,
} from "@/hooks/useActiveElapsedMinutes";
import { createSRSCard, getNextIntervals, processReview } from "@/lib/srs";
import { progressToSrs, reviewCard, type ApiProgress } from "@/lib/api";
import { defaultDeckTemplate, type DeckTemplateConfig } from "@/lib/ankiImport";
import { presentationCard, type CardView } from "@/lib/cards";
import type { Rating, SRSCard } from "@/types";
import { CardFace } from "./CardPresentation";
import { Maximize2, Minimize2, X } from "lucide-react";

export function StudySession({
  cards,
  deckName,
  mode,
  template = defaultDeckTemplate(),
  initialProgress = {},
  onExit,
}: {
  cards: CardView[];
  deckName: string;
  mode: "flashcards" | "anki";
  template?: DeckTemplateConfig;
  initialProgress?: Record<string, ApiProgress | null>;
  onExit: () => void;
}) {
  const { settings, srsCards, updateSRSCard } = useApp();
  const { recordStudyActivity } = useLearningStorage();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ count: 0, correct: 0, minutes: 0 });
  const viewed = useRef(new Set<string>());
  const lock = useRef(false);
  const current = cards[index];
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
    recordStudyActivity(1, 0, 1, minutes, "flashcard");
    setStats((s) => ({
      count: s.count + 1,
      correct: s.correct + 1,
      minutes: s.minutes + minutes,
    }));
  }, [current, flipped, elapsed, recordStudyActivity]);
  function finish() {
    if (mode === "flashcards") recordView();
    if (document.fullscreenElement) void document.exitFullscreen();
    onExit();
  }
  async function toggleFullscreen() {
    if (!document.fullscreenElement) await sessionRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }
  const next = useCallback(() => {
    if (mode !== "flashcards" || busy) return;
    recordView();
    if (index + 1 >= cards.length) setDone(true);
    else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }, [mode, busy, recordView, index, cards.length]);
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
      if (index + 1 >= cards.length || timer.isExpired()) setDone(true);
      else {
        setIndex((i) => i + 1);
        setFlipped(false);
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
      } else if (e.key === " ") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
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
        <p>
          {stats.count} thẻ ·{" "}
          {stats.count ? Math.round((stats.correct / stats.count) * 100) : 0}%
          chính xác · {stats.minutes.toFixed(1)} phút
        </p>
        <button className="study-button study-button-primary" onClick={onExit}>
          Về danh sách bộ thẻ
        </button>
      </div>
    );
  const reversed =
    template.study.orientation === "back-first" ||
    (template.study.orientation === "mixed" && index % 2 === 1);
  const fields = (
    flipped
      ? reversed
        ? template.front.fields
        : template.back.fields
      : reversed
        ? template.back.fields
        : template.front.fields
  ).filter((field) => settings.showFurigana || field !== "reading");
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
            {deckName} · <span className="text-[var(--color-accent)]">{index + 1}</span>/{cards.length}
          </p>
          <div className="hidden h-2 w-28 overflow-hidden rounded-full bg-[var(--color-surface-alt)] sm:block lg:w-64">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
              style={{ width: `${((index + 1) / cards.length) * 100}%` }}
            />
          </div>
        </div>
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
      </header>
      {timer.remainingSeconds !== null && (
        <p className="shrink-0 px-4 text-center text-xs text-[var(--color-text-secondary)]">
          {timer.expired
            ? "Hết giờ · hoàn tất thẻ hiện tại"
            : `Còn ${formatSessionTime(timer.remainingSeconds)}`}
        </p>
      )}
      <div className="flex min-h-0 flex-1 items-stretch justify-center px-3 py-2 sm:px-6 sm:py-4">
        <button
          className={`relative flex w-full max-w-5xl cursor-pointer flex-col items-center justify-center overflow-y-auto rounded-2xl border border-[var(--color-border)] p-6 transition-colors sm:rounded-3xl sm:p-12 ${template.style.theme === "dark" ? "bg-slate-900 text-white" : template.style.theme === "blue" ? "bg-blue-50 text-slate-900" : "bg-[var(--color-surface)]"}`}
          disabled={busy}
          aria-label={flipped ? "Đã hiện đáp án" : "Hiện đáp án"}
          onClick={() => setFlipped((v) => (mode === "anki" ? true : !v))}
        >
          <CardFace
            card={presentationCard(current)}
            deckName={deckName}
            fields={fields}
            template={template}
            immersivePrimary={!flipped}
          />
          {!flipped && (
            <span className="absolute bottom-5 text-xs text-[var(--color-text-tertiary)] sm:hidden">
              Chạm để lật thẻ
            </span>
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="shrink-0 px-4 text-center text-[var(--color-error)]">
          {error}
        </p>
      )}
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
              onClick={() => setFlipped(true)}
            >
              Hiện đáp án
            </button>
          )
        ) : (
          <>
            <button
              className="study-button"
              disabled={!index}
              onClick={() => {
                recordView();
                setIndex((i) => i - 1);
                setFlipped(false);
              }}
            >
              Thẻ trước
            </button>
            <label className="study-copy">
              Đến thẻ{" "}
              <input
                className="study-input !w-24"
                type="number"
                min={1}
                max={cards.length}
                value={index + 1}
                onChange={(e) => {
                  recordView();
                  setIndex(
                    Math.min(
                      cards.length - 1,
                      Math.max(0, Number(e.target.value) - 1),
                    ),
                  );
                  setFlipped(false);
                }}
              />
            </label>
            <button
              className="study-button study-button-primary"
              onClick={() => (flipped ? next() : setFlipped(true))}
            >
              {flipped
                ? index + 1 === cards.length
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
