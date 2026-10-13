import { ApiError, apiRequest } from "@/lib/api";
import { toHiragana } from "wanakana";

export interface DictionaryReading {
  text: string;
  writtenForms: string[];
  kanaOnly: boolean;
}
export interface DictionarySense {
  id: string;
  partsOfSpeech: string[];
  writtenForms: string[];
  readings: string[];
  glosses: { text: string; language: string }[];
  notes: string[];
}
export interface DictionaryWord {
  // Local UI selection carried from a search hit into the add dialog.
  preferredSelection?: { written: string; reading: string; senseId: string };
  key: string;
  version: string;
  writtenForms: string[];
  readings: DictionaryReading[];
  senses: DictionarySense[];
  common: boolean;
  source: string;
  license: string;
}
export interface DictionaryHit {
  matchedSenseId?: string | null;
  word: DictionaryWord;
  matchType: string;
  matchedForm: string;
}
export interface SearchResponse {
  items: DictionaryHit[];
  version: string;
  query: string;
  nextCursor: string | null;
}
export interface DeckOption {
  id: string;
  name: string;
  groupId: string | null;
  groupName?: string | null;
  sourceType: string;
  templateConfig: Record<string, unknown>;
}
export interface AddDictionaryRequest {
  targetDeckId: string;
  datasetVersion: string;
  writtenForm: string;
  reading: string;
  senseIds: string[];
  front: string;
  back: string;
  notes: string;
}
export interface AddDictionaryResult {
  cardId: string;
  deckId: string;
  outcome: "added" | "alreadyExists";
  cardCount: number;
  available: boolean;
}
const base = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
async function publicGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${base}/dictionary${path}`, {
    credentials: "omit",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.message || "Không thể tải từ điển.",
      undefined,
      error.code,
    );
  }
  return response.json();
}
export function searchDictionary(
  query: string,
  cursor: string | null,
  signal: AbortSignal,
) {
  const normalized = query.normalize("NFKC").trim();
  const kana = /^[a-z\s'-]+$/i.test(normalized)
    ? toHiragana(normalized.toLowerCase())
    : "";
  const params = new URLSearchParams({ q: query, limit: "20" });
  if (kana && kana !== normalized && /^[\u3040-\u309fー]+$/.test(kana))
    params.set("kana", kana);
  if (cursor) params.set("cursor", cursor);
  return publicGet<SearchResponse>(`/search?${params}`, signal);
}
export const getDictionaryWord = (key: string, signal: AbortSignal) =>
  publicGet<DictionaryWord>(`/words/${encodeURIComponent(key)}`, signal);
export const dictionarySources = (signal: AbortSignal) =>
  publicGet<{
    ready: boolean;
    entryCount: number;
    importedAt: string | null;
    version: string | null;
    languages: string[];
  }>("/sources", signal);
export const deckOptions = (q: string, page: number, signal: AbortSignal) =>
  apiRequest<{ items: DeckOption[]; hasMore: boolean }>(
    `/decks/options?q=${encodeURIComponent(q)}&page=${page}`,
    { signal },
  );
export const addDictionaryCard = (
  word: DictionaryWord,
  body: AddDictionaryRequest,
  key: string,
) =>
  apiRequest<AddDictionaryResult>(
    `/dictionary/words/${encodeURIComponent(word.key)}/cards`,
    {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(body),
    },
  );
export const createDictionaryDeck = (name: string, key: string) =>
  apiRequest<{ deckId: string; name: string }>("/dictionary/decks", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ name }),
  });
export function validSenses(
  word: DictionaryWord,
  written: string,
  reading: string,
) {
  return word.senses.filter(
    (s) =>
      (!s.writtenForms.length || s.writtenForms.includes(written)) &&
      (!s.readings.length || s.readings.includes(reading)),
  );
}
export function validWrittenForms(
  word: DictionaryWord,
  reading: DictionaryReading,
) {
  const forms =
    reading.kanaOnly || !word.writtenForms.length
      ? [reading.text]
      : [
          ...(reading.writtenForms.length
            ? reading.writtenForms
            : word.writtenForms),
          reading.text,
        ];
  return [...new Set(forms)].filter(
    (w) => validSenses(word, w, reading.text).length > 0,
  );
}
export function defaultSelection(
  word: DictionaryWord,
  matchedForm = "",
  matchedSenseId?: string | null,
) {
  const preferred = word.preferredSelection;
  if (preferred) {
    const sense = validSenses(word, preferred.written, preferred.reading).find(
      (s) => s.id === preferred.senseId,
    );
    if (
      sense &&
      word.readings.some(
        (r) =>
          r.text === preferred.reading &&
          validWrittenForms(word, r).includes(preferred.written),
      )
    )
      return { written: preferred.written, reading: preferred.reading, sense };
  }
  const fold = (value: string) =>
    value
      .normalize("NFKC")
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const form = fold(matchedForm);
  const selections = word.readings.flatMap((r) =>
    validWrittenForms(word, r).flatMap((written) =>
      validSenses(word, written, r.text).map((sense) => ({
        written,
        reading: r.text,
        sense,
      })),
    ),
  );
  const matchingForm = (choices: typeof selections) =>
    choices.find(
      (s) => word.writtenForms.includes(s.written) && fold(s.written) === form,
    ) ||
    choices.find(
      (s) => word.writtenForms.includes(s.written) && fold(s.reading) === form,
    ) ||
    choices.find((s) => fold(s.written) === form) ||
    choices.find((s) => fold(s.reading) === form);
  if (matchedSenseId) {
    const senseSelections = selections.filter(
      (s) => s.sense.id === matchedSenseId,
    );
    const selection = matchingForm(senseSelections) || senseSelections[0];
    if (selection) return selection;
  }
  if (form) {
    const selection = matchingForm(selections);
    if (selection) return selection;
  }
  for (const r of word.readings) {
    const forms =
      r.kanaOnly || !word.writtenForms.length
        ? [r.text]
        : r.writtenForms.length
          ? r.writtenForms
          : word.writtenForms;
    for (const written of forms) {
      const sense = validSenses(word, written, r.text)[0];
      if (sense) return { written, reading: r.text, sense };
    }
  }
  return {
    written: word.writtenForms[0] || word.readings[0]?.text || "",
    reading: word.readings[0]?.text || "",
    sense: word.senses[0],
  };
}
export const senseText = (sense: DictionarySense) =>
  sense.glosses.map((g) => g.text).join("; ");
