// Deck -> file (docs/deck-format-v1.md §9). Never includes progress, personal notes or server ids.
import { FORMAT_NAME, FORMAT_VERSION, builtinNoteTypes, fieldsFromCard, noteTypeIdForKind, type DeckConfig, type DeckFile, type FileCard, type NoteType } from './deckFormat.ts';
import type { ImportedCard } from './ankiImport.ts';

export function buildDeckFile(deck: { name: string; description?: string | null; tags?: string[] }, config: DeckConfig, cards: ImportedCard[]): DeckFile {
  const noteTypes: NoteType[] = [...config.noteTypes];
  const typeFor = (card: ImportedCard): NoteType => {
    const found = noteTypes.find(type => type.id === card.noteType) ?? noteTypes.find(type => type.kind.toLowerCase() === card.kind);
    if (found) return found;
    const builtin = builtinNoteTypes().find(type => type.id === noteTypeIdForKind(card.kind))!;
    noteTypes.push(builtin);
    return builtin;
  };
  const fileCards: FileCard[] = cards.map((card, index) => ({
    uid: typeof card.extraData?.uid === 'string' && card.extraData.uid ? card.extraData.uid : `c-${String(index + 1).padStart(4, '0')}`,
    type: typeFor(card).id,
    fields: fieldsFromCard(card),
    ...(card.tags?.length ? { tags: card.tags } : {}),
    ...(card.style ? { style: card.style } : {}),
  }));
  return {
    format: FORMAT_NAME, version: FORMAT_VERSION,
    deck: { name: deck.name, ...(deck.description ? { description: deck.description } : {}), ...(deck.tags?.length ? { tags: deck.tags } : {}), ...(config.style ? { style: config.style } : {}), noteTypes: noteTypes.filter(type => config.noteTypes.includes(type) || fileCards.some(card => card.type === type.id)) },
    cards: fileCards,
  };
}

export const exportJson = (file: DeckFile) => JSON.stringify(file, null, 2);

export interface ExportTable { name: string; header: string[]; rows: string[][] }
/** One table per note type that has cards: a column per field, then tags. */
export function exportTables(file: DeckFile): ExportTable[] {
  return file.deck.noteTypes.flatMap(type => {
    const own = file.cards.filter(card => card.type === type.id);
    if (!own.length) return [];
    const keys = type.fields.map(field => field.key);
    return [{ name: type.name, header: [...keys, 'tags'], rows: own.map(card => [...keys.map(key => { const value = card.fields[key]; return Array.isArray(value) ? JSON.stringify(value) : value ?? ''; }), (card.tags ?? []).join(';')]) }];
  });
}

const quote = (value: string) => /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
/** UTF-8 with BOM so Excel opens Vietnamese and Japanese text correctly. */
export const toCsv = (table: ExportTable) => `﻿${[table.header, ...table.rows].map(row => row.map(quote).join(',')).join('\r\n')}\r\n`;

export async function toXlsx(tables: ExportTable[]): Promise<ArrayBuffer> {
  const { utils, write } = await import('xlsx');
  const book = utils.book_new();
  const used = new Set<string>();
  for (const table of tables) {
    let name = table.name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${name.slice(0, 28)} ${n}`;
    used.add(name.toLowerCase());
    utils.book_append_sheet(book, utils.aoa_to_sheet([table.header, ...table.rows]), name);
  }
  return write(book, { type: 'array', bookType: 'xlsx' });
}
