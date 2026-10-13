import {
  validSenses,
  validWrittenForms,
  type DeckOption,
  type DictionaryWord,
} from "./api";
export const CARD_DRAFT_KEY = "dictionary:card-draft";
export function cardDraftOwner(): string | undefined {
  try {
    const draft = JSON.parse(sessionStorage.getItem(CARD_DRAFT_KEY) || "null");
    return draft &&
      Number.isFinite(draft.updatedAt) &&
      draft.updatedAt > 0 &&
      draft.updatedAt <= Date.now() + 1000 &&
      Date.now() - draft.updatedAt < 30 * 60_000 &&
      typeof draft.ownerId === "string"
      ? draft.ownerId
      : undefined;
  } catch {
    return undefined;
  }
}
export interface CardDraft {
  ownerId: string;
  wordKey: string;
  version: string;
  updatedAt: number;
  written: string;
  reading: string;
  senseId: string;
  front: string;
  back: string;
  notes: string;
  selected: DeckOption | null;
  newName: string;
  creating: boolean;
  needsMeaningConfirmation?: boolean;
  operation: { payload: string; key: string };
  creation: { name: string; key: string };
}
export function readCardDraft(
  word: DictionaryWord,
  ownerId: string,
): CardDraft | null {
  try {
    const d = JSON.parse(
      sessionStorage.getItem(CARD_DRAFT_KEY) || "null",
    ) as CardDraft | null;
    if (
      !d ||
      d.ownerId !== ownerId ||
      d.wordKey !== word.key ||
      d.version !== word.version ||
      !Number.isFinite(d.updatedAt) ||
      d.updatedAt <= 0 ||
      d.updatedAt > Date.now() + 1000 ||
      Date.now() - d.updatedAt > 30 * 60_000
    )
      return null;
    if (
      typeof d.operation?.payload !== "string" ||
      typeof d.creation?.name !== "string" ||
      typeof d.creating !== "boolean"
    )
      return null;
    if (
      d.front.length > 20000 ||
      d.back.length > 20000 ||
      d.notes.length > 20000 ||
      d.newName.length > 200 ||
      d.operation.payload.length > 200000
    )
      return null;
    const keyValid = (key: string) =>
      key === "" || /^[A-Za-z0-9_-]{16,100}$/.test(key);
    if (!keyValid(d.operation.key) || !keyValid(d.creation.key)) return null;
    const reading = word.readings.find((r) => r.text === d.reading);
    if (
      !reading ||
      !validWrittenForms(word, reading).includes(d.written) ||
      !validSenses(word, d.written, d.reading).some((s) => s.id === d.senseId)
    )
      return null;
    if (
      d.selected !== null &&
      (!d.selected ||
        typeof d.selected.id !== "string" ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(d.selected.id))
    )
      return null;
    if (
      d.needsMeaningConfirmation !== undefined &&
      typeof d.needsMeaningConfirmation !== "boolean"
    )
      return null;
    if (
      ![
        d.written,
        d.reading,
        d.senseId,
        d.front,
        d.back,
        d.notes,
        d.newName,
        d.operation?.key,
        d.creation?.key,
      ].every((v) => typeof v === "string")
    )
      return null;
    return d;
  } catch {
    return null;
  }
}
export function writeCardDraft(draft: CardDraft) {
  try {
    sessionStorage.setItem(CARD_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* in-memory draft remains usable */
  }
}
export function clearCardDraft() {
  try {
    sessionStorage.removeItem(CARD_DRAFT_KEY);
  } catch {
    /* optional persistence */
  }
}
