import {
  apiRequest,
  type ApiCard,
  type ApiDeck,
  type ApiDeckSummary,
  type ApiProgress,
  type ApiQueueCard,
} from "./api";
import type { ImportedCard } from "./ankiImport";
import { builtinNoteTypes, cardFromFields, noteTypeIdForKind, sanitizeStyle, type CardFieldValues, type DeckConfig, type NoteType } from "./deckFormat";
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
export type PersonalDeck = ApiDeckSummary & {
  groupId?: string | null;
  version?: number;
  newCount: number;
  dueCount: number;
  learnedCount?: number;
  studiedTodayCount?: number;
  newStartedTodayCount?: number;
  unresolvedCount?: number;
  remainingTodayCount?: number;
  source?: "MANUAL" | "IMPORT";
  tags?: string[];
};
export type PersonalCard = ApiCard & {
  progress?: ApiProgress;
  tags?: string[];
  sourceRef?: string;
  sourceSheet?: string;
};
export const listDeckPage = (page = 0, sort = "updatedAt,desc", groupId?: string | null) =>
  apiRequest<Page<PersonalDeck>>(
    `/decks?page=${page}&size=20&sort=${encodeURIComponent(sort)}${groupId !== undefined ? `&grouped=true${groupId ? `&groupId=${encodeURIComponent(groupId)}` : ""}` : ""}`,
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
  includeProgress = true,
) =>
  apiRequest<Page<PersonalCard>>(
    `/decks/${id}/cards?page=${page}&size=${size}&query=${encodeURIComponent(query)}&type=${type}&state=${state}&includeProgress=${includeProgress}`,
  );
export const deckCardIds = (id: string) =>
  apiRequest<string[]>(`/decks/${id}/card-ids`);
export const dueQueue = (id: string, limit = 50) =>
  apiRequest<ApiQueueCard[]>(`/anki/due?deckId=${id}&limit=${limit}`);
export function cardRequest(card: ImportedCard, position?: number) {
  const extraData = { ...card.extraData };
  if (card.backReading.trim()) extraData.backReading = card.backReading.trim();
  else delete extraData.backReading;
  delete extraData.style;
  return {
    front: card.front.trim(),
    back: card.back.trim(),
    reading: card.reading.trim(),
    notes: card.notes.trim(),
    kind: card.kind.toUpperCase(),
    position,
    tags: card.tags || [],
    extraData: {
      ...extraData,
      hanViet: card.hanViet.trim(),
      // The card's own look rides in extraData; the server validates it like every other style.
      ...(card.style ? { style: card.style } : {}),
      ...(card.sourceRef ? { sourceRef: card.sourceRef } : {}),
      ...(card.sourceSheet ? { sourceSheet: card.sourceSheet } : {}),
    },
    // Cards with fields are saved by their fields; the server derives the columns above from them.
    ...(card.fields ? { noteType: card.noteType, fields: card.fields } : {}),
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
  template: object,
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
export function asImported(card: PersonalCard, config?: DeckConfig): ImportedCard {
  const hanViet = ["hanViet", "han_viet", "hanTu", "han_tu"]
    .map((key) => card.extraData?.[key])
    .find((value) => typeof value === "string");
  const style = sanitizeStyle(card.extraData?.style, "");
  const legacy: ImportedCard = {
    id: card.id,
    front: card.front,
    back: card.back,
    reading: card.reading || "",
    backReading: typeof card.extraData?.backReading === "string" ? card.extraData.backReading : "",
    hanViet: typeof hanViet === "string" ? hanViet : "",
    notes: card.notes || "",
    kind: card.kind.toLowerCase() as ImportedCard["kind"],
    tags: card.tags || [],
    sourceRef: card.sourceRef,
    sourceSheet: card.sourceSheet,
    extraData: card.extraData as Record<string, string>,
    ...(style ? { style } : {}),
  };
  if (!card.fields) return legacy;
  // Fields are the source of truth: rebuild the shape the renderers use instead of trusting stored projections.
  const type: NoteType = config?.noteTypes.find((item) => item.id === card.noteType)
    ?? builtinNoteTypes().find((item) => item.id === (card.noteType || noteTypeIdForKind(legacy.kind)))
    ?? builtinNoteTypes()[3];
  const { card: projected } = cardFromFields(type, card.fields as CardFieldValues, { ...legacy, id: card.id });
  return { ...projected, kind: legacy.kind, noteType: card.noteType || type.id };
}

export interface DeckGroup { id: string; name: string; position: number; version: number; deckCount: number; cardCount: number; dueCount: number }
export const listDeckGroups = () => apiRequest<DeckGroup[]>('/deck-groups');
export const createDeckGroup = (name: string) => apiRequest<void>('/deck-groups', { method: 'POST', body: JSON.stringify({ name }) });
export const renameDeckGroup = (group: DeckGroup, name: string) => apiRequest<void>(`/deck-groups/${group.id}`, { method: 'PATCH', body: JSON.stringify({ name, version: group.version }) });
export const dissolveDeckGroup = (group: DeckGroup) => apiRequest<void>(`/deck-groups/${group.id}?version=${group.version}`, { method: 'DELETE' });
export const orderDeckGroups = (ids: string[]) => apiRequest<void>('/deck-groups/order', { method: 'PUT', body: JSON.stringify({ ids }) });
export const moveDeckToGroup = (deck: PersonalDeck, groupId: string | null, beforeId?: string) => apiRequest<void>(`/decks/${deck.id}/group`, { method: 'PUT', body: JSON.stringify({ groupId, beforeId, version: deck.version }) });
