import type { VocabItem, KanjiItem, GrammarItem } from "../types";
import type { ImportedCard } from "./ankiImport";
export type CardSource = "BUILT_IN" | "MANUAL" | "IMPORT";
export interface CardView {
  id: string;
  deckId: string;
  front: string;
  back: string;
  reading?: string;
  hanViet?: string;
  note?: string;
  type: "VOCABULARY" | "KANJI" | "GRAMMAR" | "GENERAL";
  tags: string[];
  source: CardSource;
  sourceRef?: string;
  position: number;
  extraData?: Record<string, string>;
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
    hanViet: item.han_viet,
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
    back: item.cardBack ?? [item.meaning, item.structure, item.usage ? `【Cách dùng】\n${item.usage}` : ""].filter(Boolean).join("\n\n"),
    reading: item.reading,
    note: [
      ...(item.cac_cach_dung || []).map(variant => [variant.mau, variant.nghia, variant.giai_thich, variant.goi_y, variant.sac_thai, variant.vai_tro, variant.ghi_chu].filter(Boolean).join("\n")),
      ...(item.so_sanh_n4_n5 || []).map(comparison => `${comparison.mau} (${comparison.cap_do_tham_khao})\n${comparison.khac_biet_chinh}`),
      ...(item.canh_bao || []),
    ].filter(Boolean).join("\n\n") || undefined,
    type: "GRAMMAR",
    extraData: { examples: JSON.stringify(item.examples) },
    tags: item.tags || [item.level],
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
    hanViet: card.hanViet,
    note: card.notes,
    type: card.kind.toUpperCase() as CardView["type"],
    tags: card.tags || [],
    source,
    sourceRef: card.sourceRef,
    extraData: card.extraData,
    position,
  };
}
export function presentationCard(card: CardView): ImportedCard {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    reading: card.reading || "",
    hanViet: card.hanViet || "",
    notes: card.note || "",
    kind: card.type.toLowerCase() as ImportedCard["kind"],
    extraData: card.extraData,
  };
}
