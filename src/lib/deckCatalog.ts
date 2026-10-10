import type { Bookmark, GrammarItem, KanjiItem, VocabItem } from '../types/index.ts';
import { grammarCard, kanjiCard, vocabularyCard, type CardView, type DeckSummary } from './cards.ts';

export type DeckLevel = 'N4' | 'N3' | 'N2';
export type DeckKind = 'vocabulary' | 'kanji' | 'grammar';
export interface BuiltInDeckDefinition {
  id: string;
  name: string;
  level: DeckLevel;
  kind: DeckKind;
  cards: CardView[];
}

const levelOrder: Record<DeckLevel, number> = { N4: 0, N3: 1, N2: 2 };
const kindOrder: Record<DeckKind, number> = { vocabulary: 0, kanji: 1, grammar: 2 };

export function sortDeckDefinitions<T extends { level: DeckLevel; kind: DeckKind }>(decks: T[]): T[] {
  return [...decks].sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || kindOrder[a.kind] - kindOrder[b.kind]);
}

export function deckCapabilities(source: 'BUILT_IN' | 'MANUAL' | 'IMPORT' | 'SAVED', totalCards: number) {
  const personal = source === 'MANUAL' || source === 'IMPORT';
  return { canStudy: totalCards > 0, canManage: personal, canReorder: personal };
}

export function buildBuiltInDecks(vocabulary: VocabItem[], kanji: KanjiItem[], grammar: GrammarItem[]): BuiltInDeckDefinition[] {
  const decks: BuiltInDeckDefinition[] = [];
  for (const level of ['N4', 'N3'] as const) {
    const id = `vocab${level}`;
    decks.push({ id, name: `Từ vựng ${level}`, level, kind: 'vocabulary', cards: vocabulary.filter(item => (item.level || 'N3') === level).map((item, index) => vocabularyCard(item, id, index)) });
  }
  for (const level of ['N4', 'N3', 'N2'] as const) {
    const id = `kanji${level}`;
    decks.push({ id, name: `Kanji ${level}`, level, kind: 'kanji', cards: kanji.filter(item => item.level === level).map((item, index) => kanjiCard(item, id, index)) });
  }
  for (const level of ['N4', 'N3', 'N2'] as const) {
    const id = `grammar${level}`;
    decks.push({ id, name: `Ngữ pháp ${level}`, level, kind: 'grammar', cards: grammar.filter(item => item.level === level).map((item, index) => grammarCard(item, id, index)) });
  }
  return sortDeckDefinitions(decks).filter(deck => deck.cards.length > 0);
}

export function buildSavedDeck(decks: BuiltInDeckDefinition[], bookmarks: Bookmark[]): BuiltInDeckDefinition {
  const saved = new Set(bookmarks.map(bookmark => `${bookmark.itemType.toUpperCase()}:${bookmark.itemId}`));
  return { id: 'saved', name: 'Thẻ đã lưu', level: 'N3', kind: 'vocabulary', cards: decks.flatMap(deck => deck.cards).filter(card => saved.has(`${card.type}:${card.id}`)) };
}

export function deckSummary(deck: { id: string; name: string; cards?: CardView[]; cardCount?: number; newCount?: number; dueCount?: number; source?: DeckSummary['source'] }, progress: Map<string, { state: string; dueDate: string }> = new Map()): DeckSummary {
  const cards = deck.cards ?? [];
  const due = cards.filter(card => { const item = progress.get(`${card.type}:${card.id}`); return item && item.state !== 'new' && Date.parse(item.dueDate) <= Date.now(); }).length;
  const fresh = cards.filter(card => !progress.get(`${card.type}:${card.id}`) || progress.get(`${card.type}:${card.id}`)?.state === 'new').length;
  return { id: deck.id, name: deck.name, source: deck.source ?? 'BUILT_IN', totalCards: deck.cardCount ?? cards.length, newCount: deck.newCount ?? fresh, dueCount: deck.dueCount ?? due };
}
