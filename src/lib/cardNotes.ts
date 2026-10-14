import type { CardView } from './cards.ts';

export const CARD_NOTE_LIMIT = 5000;
export const CARD_NOTES_STORAGE_KEY = 'card_notes_v1';
export const CARD_NOTE_DRAFTS_KEY = 'card_note_drafts_v1';
export interface CardNote { key: string; text: string; version: number; updatedAt: string | null }
export type NoteStatus = 'local' | 'loading' | 'saved' | 'pending' | 'error' | 'conflict';
export interface NoteEntry extends CardNote { dirty: boolean; status: NoteStatus; error?: string; remote?: CardNote }
export interface NoteDraft { text: string; baseText: string; version: number }
interface NoteStorage { scope: string; getJSON<T>(key: string, fallback: T): T; setJSON<T>(key: string, value: T): void }
interface NoteApi { get(key: string): Promise<CardNote>; put(key: string, text: string, version: number): Promise<CardNote> }

/** Built-in notes follow content rather than array indices. Personal notes follow the immutable UUID. */
export async function cardNoteKey(card: CardView): Promise<string> {
  const identity = card.source === 'BUILT_IN'
    ? card.noteIdentity ? `BUILT_IN:${card.noteIdentity}` : `BUILT_IN:${JSON.stringify([card.deckId, card.type, card.front, card.reading || ''])}`
    : `PERSONAL:${card.id}`;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

const blank = (key: string, enabled: boolean): NoteEntry => ({ key, text: '', version: 0, updatedAt: null, dirty: false, status: enabled ? 'loading' : 'local' });

export function exportCardWithNote(card: CardView, personalText = '', includePersonalNotes = false) {
  let examples: unknown;
  try { examples = card.extraData?.examples ? JSON.parse(card.extraData.examples) : undefined; } catch { /* Optional imported metadata may be malformed. */ }
  return { front: card.front, back: card.back, reading: card.reading || '', back_reading: card.backReading || '',
    han_viet: card.hanViet || null, type: card.type, tags: card.tags,
    note: [card.note, includePersonalNotes && personalText.trim() ? `【Ghi chú cá nhân】\n${personalText.trim()}` : ''].filter(Boolean).join('\n\n'),
    ...(examples ? { examples } : {}),
  };
}

export function createCardNotesStore(storage: NoteStorage, api?: NoteApi) {
  const persisted = storage.getJSON<Record<string, NoteEntry>>(CARD_NOTES_STORAGE_KEY, {});
  let entries: Record<string, NoteEntry> = {};
  for (const [key, entry] of Object.entries(persisted)) {
    if (/^[a-f0-9]{64}$/.test(key) && entry && typeof entry.text === 'string' && Number.isSafeInteger(entry.version))
      entries[key] = { ...entry, status: api ? entry.remote ? 'conflict' : entry.dirty ? 'pending' : 'saved' : 'local' };
  }
  const listeners = new Set<() => void>();
  const flights = new Map<string, Promise<void>>();
  const loaded = new Set<string>();
  let visibleKey: string | null = null;
  let active = true;
  const publish = () => listeners.forEach(listener => listener());
  function persist(key: string, entry: NoteEntry) {
    const next = { ...storage.getJSON<Record<string, NoteEntry>>(CARD_NOTES_STORAGE_KEY, {}), [key]: entry };
    storage.setJSON(CARD_NOTES_STORAGE_KEY, next);
    if (JSON.stringify(storage.getJSON<Record<string, NoteEntry>>(CARD_NOTES_STORAGE_KEY, {})[key]) !== JSON.stringify(entry))
      throw new Error('Thiết bị không lưu được ghi chú. Hãy sao chép nội dung trước khi đóng.');
    entries = { ...entries, [key]: entry };
    publish();
  }
  function change(key: string, patch: Partial<NoteEntry>) {
    persist(key, { ...(entries[key] || blank(key, Boolean(api))), ...patch });
  }
  function markError(key: string, message: string) {
    try { change(key, { status: 'error', error: message }); }
    catch (error) {
      // Quota failures must be visible without causing an unhandled background rejection.
      entries = { ...entries, [key]: { ...(entries[key] || blank(key, Boolean(api))), status: 'error', error: (error as Error).message } };
      publish();
    }
  }
  function drafts() { return storage.getJSON<Record<string, NoteDraft>>(CARD_NOTE_DRAFTS_KEY, {}); }
  function draft(key: string): NoteDraft | undefined { return drafts()[key]; }
  function writeDraft(key: string, text: string) {
    const current = entries[key] || blank(key, Boolean(api));
    const next = { ...drafts(), [key]: { ...(draft(key) || { baseText: current.text, version: current.version }), text } };
    storage.setJSON(CARD_NOTE_DRAFTS_KEY, next);
    if (storage.getJSON<Record<string, NoteDraft>>(CARD_NOTE_DRAFTS_KEY, {})[key]?.text !== text)
      throw new Error('Không lưu được bản nháp trên thiết bị. Hãy sao chép nội dung trước khi đóng.');
  }
  function clearDraft(key: string) {
    const next = drafts(); delete next[key]; storage.setJSON(CARD_NOTE_DRAFTS_KEY, next);
  }
  async function sync(key: string, refresh = false): Promise<void> {
    if (!api || !active) return;
    if (flights.has(key)) return flights.get(key)!;
    const run = async () => {
      try {
        if (refresh || !loaded.has(key)) {
          const remote = await api.get(key);
          if (!active) return;
          loaded.add(key);
          const local = entries[key];
          if (local?.dirty && remote.version !== local.version && remote.text !== local.text) {
            change(key, { remote, status: 'conflict' }); return;
          }
          if (!local?.dirty || remote.text === local.text) persist(key, { ...remote, dirty: false, status: 'saved' });
        }
        while (active && entries[key]?.dirty && !entries[key].remote) {
          const sent = entries[key];
          change(key, { status: 'pending', error: undefined });
          const saved = await api.put(key, sent.text, sent.version);
          if (!active) return;
          const latest = entries[key];
          persist(key, latest.text === sent.text
            ? { ...saved, dirty: false, status: 'saved' }
            : { ...latest, version: saved.version, dirty: true, status: 'pending' });
        }
      } catch (error) {
        if (!active) return;
        if ((error as { status?: number }).status === 409) {
          try {
            const remote = await api.get(key);
            if (active) change(key, { remote, status: 'conflict' });
          } catch { if (active) markError(key, 'Chưa tải được bản trên máy chủ. Bản của bạn vẫn được giữ.'); }
        } else markError(key, error instanceof Error ? error.message : 'Chưa đồng bộ được ghi chú.');
      }
    };
    const flight = run().finally(() => flights.delete(key));
    flights.set(key, flight);
    return flight;
  }
  function ensure(key: string) {
    visibleKey = key;
    if (!entries[key]) { entries = { ...entries, [key]: blank(key, Boolean(api)) }; publish(); }
    if (api) void sync(key, true);
  }
  function save(key: string, text: string) {
    const clean = text.trim();
    if (clean.length > CARD_NOTE_LIMIT) throw new Error('Ghi chú tối đa 5.000 ký tự.');
    const local = entries[key] || blank(key, Boolean(api));
    const editing = draft(key);
    // A remote update arriving while the editor is open must not be overwritten silently.
    const changedRemotely = editing && editing.version !== local.version && editing.baseText !== local.text && clean !== local.text && !local.dirty;
    persist(key, { ...local, text: clean, dirty: Boolean(api), status: api ? 'pending' : 'local',
      remote: changedRemotely ? { key, text: local.text, version: local.version, updatedAt: local.updatedAt } : local.remote,
      ...(changedRemotely ? { status: 'conflict' as const } : {}) });
    clearDraft(key);
    if (api && !entries[key].remote) void sync(key);
  }
  function resolve(key: string, useLocal: boolean) {
    const local = entries[key];
    if (!local?.remote) return;
    persist(key, useLocal
      ? { ...local, version: local.remote.version, remote: undefined, status: 'pending', dirty: true }
      : { ...local.remote, dirty: false, status: 'saved' });
    clearDraft(key);
    if (useLocal) void sync(key);
  }
  function retryAll() {
    // Refresh the active card and unsent edits, rather than every card seen in a long session.
    const keys = [...new Set([...(visibleKey ? [visibleKey] : []), ...Object.keys(entries).filter(key => entries[key].dirty)])];
    let cursor = 0;
    void Promise.all(Array.from({ length: Math.min(4, keys.length) }, async () => {
      while (cursor < keys.length && active) await sync(keys[cursor++], true);
    }));
  }
  async function flush() {
    const dirtyKeys = Object.keys(entries).filter(key => entries[key].dirty);
    await Promise.all(dirtyKeys.map(key => sync(key, true)));
    if (dirtyKeys.some(key => entries[key].dirty)) throw new Error('Hãy đồng bộ hoặc xử lý xung đột ghi chú trước khi chia sẻ kèm ghi chú cá nhân.');
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => entries,
    ensure, save, draft, writeDraft, clearDraft, resolve,
    retry: (key: string) => sync(key, true), retryAll, flush,
    start: () => { active = true; retryAll(); }, stop: () => { active = false; },
  };
}
export type CardNotesStore = ReturnType<typeof createCardNotesStore>;
