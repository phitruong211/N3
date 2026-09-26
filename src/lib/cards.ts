import type { VocabItem, KanjiItem, GrammarItem } from "../types";
import type { ImportedCard } from "./ankiImport";
export type CardSource = "BUILT_IN" | "MANUAL" | "IMPORT";
export interface CardView {
  id: string;
  deckId: string;
  front: string;
  back: string;
  reading?: string;
  note?: string;
  type: "VOCABULARY" | "KANJI" | "GRAMMAR" | "GENERAL";
  tags: string[];
  source: CardSource;
  sourceRef?: string;
  position: number;
}
export interface DeckSummary {
  id: string;
  name: string;
  source: CardSource | "SAVED";
  totalCards: number;
  newCount: number;
  dueCount: number;
  updatedAt?: string;
}
export function vocabularyCard(
  item: VocabItem,
  deckId: string,
  position: number,
): CardView {
  return {
    id: item.id,
    deckId,
    front: item.tu,
    back: item.meaning,
    reading: item.phien_am,
    note: item.ghi_chu || undefined,
    type: "VOCABULARY",
    tags: item.tags || [],
    source: "BUILT_IN",
    sourceRef: item.id,
    position,
  };
}
export function kanjiCard(
  item: KanjiItem,
  deckId: string,
  position: number,
): CardView {
  return {
    id: item.id,
    deckId,
    front: item.kanji,
    back: item.hanViet,
    reading: [...(item.onyomi || []), ...(item.kunyomi || [])].join("・"),
    note: item.vocabulary
      .map((v) => `${v.word} ${v.reading} — ${v.meaning}`)
      .join("\n"),
    type: "KANJI",
    tags: [item.level],
    source: "BUILT_IN",
    sourceRef: item.id,
    position,
  };
}
export function grammarCard(
  item: GrammarItem,
  deckId: string,
  position: number,
): CardView {
  return {
    id: item.id,
    deckId,
    front: item.pattern,
    back: item.meaning,
    reading: item.reading,
    note: [
      item.structure,
      item.usage,
      ...item.examples.map((e) => `${e.japanese}\n${e.meaning}`),
    ]
      .filter(Boolean)
      .join("\n"),
    type: "GRAMMAR",
    tags: [item.level],
    source: "BUILT_IN",
    sourceRef: item.id,
    position,
  };
}
export function importedCardView(
  card: ImportedCard,
  deckId: string,
  source: CardSource,
  position: number,
): CardView {
  return {
    id: card.id,
    deckId,
    front: card.front,
    back: card.back,
    reading: card.reading,
    note: card.notes,
    type: card.kind.toUpperCase() as CardView["type"],
    tags: card.tags || [],
    source,
    sourceRef: card.sourceRef,
    position,
  };
}
export function presentationCard(card: CardView): ImportedCard {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    reading: card.reading || "",
    notes: card.note || "",
    kind: card.type.toLowerCase() as ImportedCard["kind"],
  };
}
