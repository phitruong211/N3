import { useMemo, useState } from "react";
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

export function UnifiedDeckPage({ mode }: { mode: "flashcards" | "anki" }) {
  const { vocabulary, kanji, grammar, bookmarks, srsCards } = useApp();
  const [session, setSession] = useState<{
    name: string;
    cards: CardView[];
    template: DeckTemplateConfig;
  } | null>(null);
  const levelOrder = ["N3", "N4", "N2"] as const;
  const decks = useMemo(() => [
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
  ], [vocabulary, kanji, grammar]);
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
  function launch(deck: { name: string; cards: CardView[] }) {
    setSession({
      name: deck.name,
      cards: eligible(deck.cards),
      template: defaultDeckTemplate(),
    });
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
            onClick={() => launch(deck)}
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
          onClick={() => launch(deck)}
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
