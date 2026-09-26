import {
  apiRequest,
  type ApiCard,
  type ApiDeck,
  type ApiDeckSummary,
  type ApiProgress,
  type ApiQueueCard,
} from "./api";
import type { ImportedCard, DeckTemplateConfig } from "./ankiImport";
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
export type PersonalDeck = ApiDeckSummary & {
  newCount: number;
  dueCount: number;
  source?: "MANUAL" | "IMPORT";
  tags?: string[];
};
export type PersonalCard = ApiCard & {
  progress?: ApiProgress;
  tags?: string[];
  sourceRef?: string;
  sourceSheet?: string;
};
export const listDeckPage = (page = 0, sort = "updatedAt,desc") =>
  apiRequest<Page<PersonalDeck>>(
    `/decks?page=${page}&size=20&sort=${encodeURIComponent(sort)}`,
  );
export const deckMetadata = (id: string) =>
  apiRequest<PersonalDeck>(`/decks/${id}/metadata`);
export const cardPage = (
  id: string,
  page = 0,
  query = "",
  type = "",
  state = "",
  size = 50,
) =>
  apiRequest<Page<PersonalCard>>(
    `/decks/${id}/cards?page=${page}&size=${size}&query=${encodeURIComponent(query)}&type=${type}&state=${state}`,
  );
export const deckCardIds = (id: string) =>
  apiRequest<string[]>(`/decks/${id}/card-ids`);
export const dueQueue = (id: string, limit = 50) =>
  apiRequest<ApiQueueCard[]>(`/anki/due?deckId=${id}&limit=${limit}`);
export function cardRequest(card: ImportedCard, position?: number) {
  return {
    front: card.front.trim(),
    back: card.back.trim(),
    reading: card.reading.trim(),
    notes: card.notes.trim(),
    kind: card.kind.toUpperCase(),
    position,
    tags: card.tags || [],
    extraData: {
      ...card.extraData,
      ...(card.sourceRef ? { sourceRef: card.sourceRef } : {}),
      ...(card.sourceSheet ? { sourceSheet: card.sourceSheet } : {}),
    },
  };
}
export function importDeck(body: unknown, key: string) {
  return apiRequest<ApiDeck>("/decks/import", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}
export function creationBody(
  name: string,
  cards: ImportedCard[],
  source: string,
  format: string,
  template: DeckTemplateConfig,
  manual = false,
) {
  return {
    name: name.trim(),
    sourceType: manual ? "MANUAL" : "IMPORT",
    source: manual ? "MANUAL" : "IMPORT",
    sourceName: source,
    sourceRef: source,
    importFormat: format.slice(0, 20),
    visibility: "PRIVATE",
    templateConfig: template,
    cards: cards.map((card, index) => ({
      ...cardRequest(card, index),
      externalId: card.id,
    })),
  };
}
export function asImported(card: PersonalCard): ImportedCard {
  return {
    id: card.id,
    front: card.front,
    back: card.back,
    reading: card.reading || "",
    notes: card.notes || "",
    kind: card.kind.toLowerCase() as ImportedCard["kind"],
    tags: card.tags || [],
    sourceRef: card.sourceRef,
    sourceSheet: card.sourceSheet,
    extraData: card.extraData as Record<string, string>,
  };
}
