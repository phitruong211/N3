import type { CardView } from './cards.ts';
import type { BuiltInDeckDefinition } from './deckCatalog.ts';
import type { GrammarExample } from '../types/index.ts';

interface StudyCardData {
  note_id?: string;
  front: string;
  back: string;
  reading?: string;
  han_viet?: string | null;
  note?: string;
  type: CardView['type'];
  tags?: string[];
  examples?: GrammarExample[];
}

/** Keep the supplied card schema, including vocabulary cards in the Kanji deck. */
export function n5StudyCard(item: StudyCardData, deckId: string, position: number): CardView {
  // Include the deck, kind and reading: related vocabulary can share a Kanji front.
  // Keep Unicode as-is: URI encoding can exceed the API's 200-character ID limit.
  const id = `${deckId}-${item.type.toLowerCase()}-${JSON.stringify([item.front, item.reading || ''])}`;
  return {
    id, deckId, front: item.front, back: item.back, reading: item.reading,
    noteIdentity: item.note_id,
    hanViet: item.han_viet || undefined, note: item.note, type: item.type,
    tags: item.tags || ['N5'], source: 'BUILT_IN', sourceRef: id, position,
    extraData: item.examples ? { examples: JSON.stringify(item.examples) } : undefined,
  };
}

let cached: BuiltInDeckDefinition[] | null = null;

export async function loadN5Decks(): Promise<BuiltInDeckDefinition[]> {
  if (cached) return cached;
  const definitions = [
    { id: 'vocabN5', name: 'Từ vựng N5', kind: 'vocabulary' },
    { id: 'kanjiN5', name: 'Kanji N5', kind: 'kanji' },
    { id: 'grammarN5', name: 'Ngữ pháp N5', kind: 'grammar' },
  ] as const;
  const decks = await Promise.all(definitions.map(async definition => {
    const path = `/data/${definition.id}.json`;
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error(`Invalid data in ${path}: expected an array`);
    const ids = new Set<string>();
    const cards = data.map((item: StudyCardData, index) => {
      if (!item || typeof item.front !== 'string' || !item.front.trim() || typeof item.back !== 'string'
        || !['VOCABULARY', 'KANJI', 'GRAMMAR', 'GENERAL'].includes(item.type)) {
        throw new Error(`Invalid card in ${path} at position ${index}`);
      }
      const card = n5StudyCard(item, definition.id, index);
      if (ids.has(card.id)) throw new Error(`Duplicate card in ${path}: ${item.front}`);
      ids.add(card.id);
      return card;
    });
    return { ...definition, level: 'N5' as const, cards };
  }));
  cached = decks;
  return decks;
}
