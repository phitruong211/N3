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
  const [orientation, setOrientation] =
    useState<DeckTemplateConfig["study"]["orientation"]>("front-first");
  const decks = [
    ...["N3", "N4"].map((level) => ({
      id: `vocab${level}`,
      name: `Từ vựng ${level}`,
      cards: vocabulary
        .filter((v) => (v.level || "N3") === level)
        .map((v, i) => vocabularyCard(v, `vocab${level}`, i)),
    })),
    ...["N3", "N2"].map((level) => ({
      id: `kanji${level}`,
      name: `Kanji ${level}`,
      cards: kanji
        .filter((v) => v.level === level)
        .map((v, i) => kanjiCard(v, `kanji${level}`, i)),
    })),
    ...["N3", "N4", "N2"].map((level) => ({
      id: `grammar${level}`,
      name: `Ngữ pháp ${level}`,
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
    template.study.orientation = orientation;
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
    return (
      <article key={deck.id} className="study-panel space-y-3">
        <p className="study-eyebrow">
          {deck.id === "saved" ? "DẤU TRANG · CHỈ ĐỌC" : "CÓ SẴN · CHỈ ĐỌC"}
        </p>
        <h3 className="text-xl font-semibold">{deck.name}</h3>
        <p className="study-copy">
          {deck.cards.length} thẻ · {fresh} mới · {due} đến hạn
        </p>
        {!deck.cards.length && (
          <p className="study-copy">
            Lưu từ vựng, Kanji hoặc ngữ pháp trong thư viện để học tại đây.
          </p>
        )}
        <button
          className="study-button study-button-primary"
          disabled={!eligible(deck.cards).length}
          onClick={() => {
            setPending(deck);
            setLimit(Math.min(20, eligible(deck.cards).length));
          }}
        >
          {deck.cards.length
            ? mode === "anki" && !fresh && !due
              ? "Chưa có thẻ đến hạn"
              : "Bắt đầu học"
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
        <section
          className="study-panel space-y-4"
          aria-label="Thiết lập phiên học"
        >
          <h2 className="text-xl font-semibold">{pending.name}</h2>
          <label className="block">
            Số thẻ{" "}
            <input
              className="study-input"
              type="number"
              min={1}
              max={eligible(pending.cards).length}
              value={limit}
              onChange={(e) =>
                setLimit(
                  Math.max(
                    1,
                    Math.min(
                      eligible(pending.cards).length,
                      Number(e.target.value),
                    ),
                  ),
                )
              }
            />
          </label>
          {mode === "flashcards" && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={shuffle}
                onChange={(e) => setShuffle(e.target.checked)}
              />
              Xáo trộn
            </label>
          )}
          <label className="block">
            Mặt bắt đầu{" "}
            <select
              className="study-input"
              value={orientation}
              onChange={(e) =>
                setOrientation(e.target.value as typeof orientation)
              }
            >
              <option value="front-first">Mặt trước</option>
              <option value="back-first">Mặt sau</option>
              <option value="mixed">Luân phiên</option>
            </select>
          </label>
          <div className="flex gap-3">
            <button
              className="study-button study-button-primary"
              onClick={launch}
            >
              Bắt đầu
            </button>
            <button className="study-button" onClick={() => setPending(null)}>
              Hủy
            </button>
          </div>
        </section>
      )}
      <section>
        <h2 className="study-eyebrow mb-3">BỘ THẺ CÓ SẴN</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map(tile)}
        </div>
      </section>
      <ImportedDecks mode={mode} leadingDeck={tile(saved)} />
    </div>
  );
}
