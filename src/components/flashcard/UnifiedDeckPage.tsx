import { useState } from "react";
import { useApp } from "@/hooks/useApp";
import {
  vocabularyCard,
  kanjiCard,
  grammarCard,
  type CardView,
} from "@/lib/cards";
import { defaultDeckTemplate, type DeckTemplateConfig } from "@/lib/ankiImport";
import { StudySession } from "./StudySession";
import { ImportedDecks } from "./ImportedDecks";
import { ContentBadge } from "@/components/ui/StudyUI";
import { ListOrdered, Play, Shuffle, X } from "lucide-react";

export function UnifiedDeckPage({ mode }: { mode: "flashcards" | "anki" }) {
  const { vocabulary, kanji, grammar, bookmarks, srsCards } = useApp();
  const [pending, setPending] = useState<{
    name: string;
    cards: CardView[];
  } | null>(null);
  const [session, setSession] = useState<{
    name: string;
    cards: CardView[];
    template: DeckTemplateConfig;
  } | null>(null);
  const [limit, setLimit] = useState(20);
  const [shuffle, setShuffle] = useState(false);
  const levelOrder = ["N3", "N4", "N2"] as const;
  const decks = [
    ...["N3", "N4"].map((level) => ({
      id: `vocab${level}`,
      name: `Từ vựng ${level}`,
      level,
      cards: vocabulary
        .filter((v) => (v.level || "N3") === level)
        .map((v, i) => vocabularyCard(v, `vocab${level}`, i)),
    })),
    ...["N3", "N2"].map((level) => ({
      id: `kanji${level}`,
      name: `Kanji ${level}`,
      level,
      cards: kanji
        .filter((v) => v.level === level)
        .map((v, i) => kanjiCard(v, `kanji${level}`, i)),
    })),
    ...["N3", "N4", "N2"].map((level) => ({
      id: `grammar${level}`,
      name: `Ngữ pháp ${level}`,
      level,
      cards: grammar
        .filter((v) => v.level === level)
        .map((v, i) => grammarCard(v, `grammar${level}`, i)),
    })),
  ];
  const saved = {
    id: "saved",
    name: "Thẻ đã lưu",
    cards: decks
      .flatMap((d) => d.cards)
      .filter((c) =>
        bookmarks.some(
          (b) => b.itemId === c.id && b.itemType.toUpperCase() === c.type,
        ),
      ),
  };
  const progressById = new Map(
    srsCards.map((card) => [
      `${card.deckType.toUpperCase()}:${card.cardId}`,
      card,
    ]),
  );
  const progress = (card: CardView) =>
    progressById.get(`${card.type}:${card.id}`);
  function eligible(cards: CardView[]) {
    return mode === "flashcards"
      ? cards
      : cards
          .filter((c) => {
            const p = progress(c);
            return (
              !p || p.state === "new" || Date.parse(p.dueDate) <= Date.now()
            );
          })
          .sort((a, b) => {
            const pa = progress(a),
              pb = progress(b);
            return (
              (pa && pa.state !== "new" ? Date.parse(pa.dueDate) : Infinity) -
              (pb && pb.state !== "new" ? Date.parse(pb.dueDate) : Infinity)
            );
          });
  }
  function launch() {
    if (!pending) return;
    let cards = eligible(pending.cards).slice(0, limit);
    if (shuffle && mode === "flashcards") {
      cards = [...cards];
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    const template = defaultDeckTemplate();
    setSession({ name: pending.name, cards, template });
    setPending(null);
  }
  function tile(deck: typeof saved) {
    const fresh = deck.cards.filter(
      (c) => !progress(c) || progress(c)?.state === "new",
    ).length;
    const due = deck.cards.filter((c) => {
      const p = progress(c);
      return p && p.state !== "new" && Date.parse(p.dueDate) <= Date.now();
    }).length;
    if (deck.id === "saved") {
      const canStudy = eligible(deck.cards).length > 0;
      return (
        <article key={deck.id} className="study-panel flex min-h-52 flex-col">
          <ContentBadge>Đã lưu</ContentBadge>
          <h3 className="mt-5 text-base font-semibold">{deck.name}</h3>
          <p
            className={`mt-3 flex items-baseline gap-1.5 ${deck.cards.length ? "" : "text-[var(--color-text-tertiary)]"}`}
          >
            <strong className="text-4xl font-semibold tracking-tight">
              {deck.cards.length}
            </strong>
            <span className="text-sm">thẻ</span>
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            {fresh} mới · {due} đến hạn
          </p>
          <button
            className={`mt-auto pt-5 text-left text-sm font-semibold ${
              canStudy
                ? "text-[var(--color-accent)] hover:underline"
                : "cursor-default text-[var(--color-text-tertiary)]"
            }`}
            disabled={!canStudy}
            onClick={() => {
              setPending(deck);
              setLimit(Math.min(20, eligible(deck.cards).length));
            }}
          >
            {deck.cards.length
              ? canStudy
                ? "Bắt đầu học →"
                : "Chưa có thẻ đến hạn"
              : "Chưa có thẻ"}
          </button>
        </article>
      );
    }
    const badge = deck.id.startsWith("vocab")
      ? { label: "Từ vựng", tone: "vocabulary" as const }
      : deck.id.startsWith("kanji")
        ? { label: "Kanji", tone: "kanji" as const }
        : { label: "Ngữ pháp", tone: "grammar" as const };
    const canStudy = eligible(deck.cards).length > 0;
    return (
      <article key={deck.id} className="study-panel flex min-h-52 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <ContentBadge tone={badge.tone}>{badge.label}</ContentBadge>
          <span className="study-pill text-[var(--color-text-tertiary)]">
            Chỉ đọc
          </span>
        </div>
        <h3 className="mt-5 text-xl font-semibold">{deck.name}</h3>
        <p className="study-copy mt-3">
          {deck.cards.length} thẻ · {fresh} mới · {due} đến hạn
        </p>
        {!deck.cards.length && (
          <p className="study-copy">
            Lưu từ vựng, Kanji hoặc ngữ pháp trong thư viện để học tại đây.
          </p>
        )}
        <button
          className={`mt-auto pt-5 text-left text-sm font-semibold ${
            canStudy
              ? "text-[var(--color-accent)] hover:underline"
              : "cursor-default text-[var(--color-text-tertiary)]"
          }`}
          disabled={!canStudy}
          onClick={() => {
            setPending(deck);
            setLimit(Math.min(20, eligible(deck.cards).length));
          }}
        >
          {deck.cards.length
            ? mode === "anki" && !fresh && !due
              ? "Chưa có thẻ đến hạn"
              : "Bắt đầu học →"
            : "Chưa có thẻ"}
        </button>
      </article>
    );
  }
  if (session)
    return (
      <StudySession
        cards={session.cards}
        deckName={session.name}
        template={session.template}
        mode={mode}
        onExit={() => setSession(null)}
      />
    );
  return (
    <div className="study-page">
      <header>
        <p className="study-eyebrow">LUYỆN TẬP</p>
        <h1 className="text-3xl font-semibold">
          {mode === "anki" ? "Anki" : "Thẻ học"}
        </h1>
        <p className="study-copy mt-3">
          Chọn bộ thẻ để học. Tiến độ ôn được lưu riêng với nội dung thẻ.
        </p>
      </header>
      {pending && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPending(null);
          }}
        >
          <section
            className="w-full max-w-lg space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl sm:p-7"
            role="dialog"
            aria-modal="true"
            aria-label={`Bắt đầu ${pending.name}`}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="study-eyebrow mb-1">BẮT ĐẦU HỌC</p>
                <h2 className="text-2xl font-semibold">{pending.name}</h2>
                <p className="study-copy mt-1">
                  {eligible(pending.cards).length} thẻ có thể học
                </p>
              </div>
              <button
                className="study-button !h-10 !min-h-10 !w-10 !p-0"
                aria-label="Đóng"
                onClick={() => setPending(null)}
              >
                <X size={18} />
              </button>
            </header>

            {mode === "flashcards" && (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">
                  Thứ tự học
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={!shuffle}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      !shuffle
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                    onClick={() => setShuffle(false)}
                  >
                    <ListOrdered size={21} />
                    <strong className="mt-3 block text-sm">Theo thứ tự</strong>
                    <span className="mt-1 block text-xs opacity-70">
                      Học lần lượt từ đầu bộ
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={shuffle}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      shuffle
                        ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-text)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                    onClick={() => setShuffle(true)}
                  >
                    <Shuffle size={21} />
                    <strong className="mt-3 block text-sm">Ngẫu nhiên</strong>
                    <span className="mt-1 block text-xs opacity-70">
                      Trộn thẻ trong phạm vi chọn
                    </span>
                  </button>
                </div>
              </fieldset>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="study-card-limit" className="text-sm font-semibold">
                  Số thẻ muốn học
                </label>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {limit}/{eligible(pending.cards).length}
                </span>
              </div>
              <input
                id="study-card-limit"
                className="w-full accent-[var(--color-accent)]"
                type="range"
                min={1}
                max={eligible(pending.cards).length}
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              />
              <div className="flex items-center gap-3">
                <input
                  className="study-input !w-24 text-center"
                  aria-label="Số thẻ nhập trực tiếp"
                  type="number"
                  min={1}
                  max={eligible(pending.cards).length}
                  value={limit}
                  onChange={(event) =>
                    setLimit(
                      Math.max(
                        1,
                        Math.min(
                          eligible(pending.cards).length,
                          Number(event.target.value) || 1,
                        ),
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
                  onClick={() => setLimit(eligible(pending.cards).length)}
                >
                  Chọn tất cả
                </button>
              </div>
            </div>

            <button
              className="study-button study-button-primary w-full"
              onClick={launch}
            >
              {shuffle ? <Shuffle size={18} /> : <Play size={18} />}
              {shuffle ? `Học ngẫu nhiên ${limit} thẻ` : `Bắt đầu ${limit} thẻ`}
            </button>
          </section>
        </div>
      )}
      <section>
        <h2 className="study-eyebrow mb-3">BỘ THẺ CÓ SẴN</h2>
        <div className="space-y-7">
          {levelOrder.map((level) => (
            <section key={level} aria-labelledby={`deck-level-${level}`}>
              <div className="mb-3 flex items-center gap-3">
                <h3
                  id={`deck-level-${level}`}
                  className="text-sm font-semibold text-[var(--color-text-secondary)]"
                >
                  Trình độ {level}
                </h3>
                <span className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {decks.filter((deck) => deck.level === level).map(tile)}
              </div>
            </section>
          ))}
        </div>
      </section>
      <ImportedDecks
        mode={mode}
        leadingDeck={saved.cards.length ? tile(saved) : undefined}
      />
    </div>
  );
}
