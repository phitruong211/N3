import type { ImportedCard, ImportedDeck, ImportedKind } from './ankiImport';
import { ApiError, addCard, createDeck, getDeck, getDeckProgress, listDecks, progressToSrs, removeCard, removeDeck, updateCard, updateDeck, type ApiCard, type ApiDeck, type ApiQueueCard } from './api';

const toApiKind = (kind: ImportedKind) => kind.toUpperCase();
const fromApiKind = (kind: string) => kind.toLowerCase() as ImportedKind;

function cardFromApi(card: ApiCard, progress?: ApiQueueCard): ImportedCard {
  const kind = fromApiKind(card.kind);
  const srs = progress?.progress ? progressToSrs(card.id, progress.progress) : undefined;
  return { id: card.id, front: card.front, back: card.back, reading: card.reading || '', notes: card.notes || '',
    kind, srs: srs ? { ...srs, deckType: kind === 'general' ? 'vocabulary' : kind } : undefined };
}

async function deckFromApi(response: ApiDeck): Promise<ImportedDeck> {
  const progress = await getDeckProgress(response.deck.id);
  const progressByCard = new Map(progress.map(item => [item.cardId, item]));
  return { id: response.deck.id, name: response.deck.name, source: response.deck.sourceName || 'Tạo thủ công',
    format: response.deck.importFormat || 'Thủ công', createdAt: response.deck.createdAt,
    cards: response.cards.map(card => cardFromApi(card, progressByCard.get(card.id))) };
}

function cardBody(card: ImportedCard, position: number) {
  return { front: card.front, back: card.back, reading: card.reading || null, notes: card.notes || null,
    kind: toApiKind(card.kind), position, externalId: card.id };
}

function cardUpdateBody(card: ImportedCard, position: number) {
  const { externalId: _externalId, ...body } = cardBody(card, position);
  return body;
}

export async function loadImportedDecks(): Promise<ImportedDeck[]> {
  const summaries = await listDecks();
  return Promise.all(summaries.map(summary => getDeck(summary.id).then(deckFromApi)));
}

export async function writeImportedDeck(deck: ImportedDeck): Promise<ImportedDeck>;
export async function writeImportedDeck(deck: string): Promise<void>;
export async function writeImportedDeck(deck: ImportedDeck | string): Promise<ImportedDeck | void> {
  if (typeof deck === 'string') { await removeDeck(deck); return; }
  let remote: ApiDeck;
  try { remote = await getDeck(deck.id); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    const created = await createDeck({ name: deck.name, sourceType: deck.source === 'Tạo thủ công' ? 'MANUAL' : 'IMPORT',
      sourceName: deck.source, importFormat: deck.format.slice(0, 20), visibility: 'PRIVATE',
      cards: deck.cards.map(cardBody) });
    return deckFromApi(created);
  }

  if (remote.deck.name !== deck.name) await updateDeck(deck.id, { name: deck.name });
  const localIds = new Set(deck.cards.map(card => card.id));
  await Promise.all(remote.cards.filter(card => !localIds.has(card.id)).map(card => removeCard(card.id)));
  const remoteById = new Map(remote.cards.map(card => [card.id, card]));
  await Promise.all(deck.cards.map((card, position) => {
    const existing = remoteById.get(card.id);
    return existing ? updateCard(card.id, cardUpdateBody(card, position)) : addCard(deck.id, cardBody(card, position));
  }));
  return deckFromApi(await getDeck(deck.id));
}
