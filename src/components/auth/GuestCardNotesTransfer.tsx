import { useState } from 'react';
import { useApp } from '@/hooks/useApp';
import { apiRequest } from '@/lib/api';
import { createLearningStorage } from '@/lib/storage';
import { CARD_NOTES_STORAGE_KEY, type NoteEntry, type CardNote } from '@/lib/cardNotes';

export function GuestCardNotesTransfer() {
  const { cardNotes } = useApp();
  const [source] = useState(() => createLearningStorage('guest'));
  const [rows, setRows] = useState(() => source.getJSON<Record<string, NoteEntry>>(CARD_NOTES_STORAGE_KEY, {}));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const pending = Object.entries(rows).filter(([key, note]) => /^[a-f0-9]{64}$/.test(key) && typeof note?.text === 'string' && note.text.trim());
  async function transfer() {
    if (busy) return;
    setBusy(true); setMessage(''); let moved = 0; let skipped = 0;
    try {
      await cardNotes.flush();
      for (const [key, note] of pending) {
        const current = await apiRequest<CardNote>(`/card-notes/${key}`);
        if (current.version > 0 && current.text !== note.text) { skipped++; continue; }
        if (current.text !== note.text) await apiRequest<CardNote>(`/card-notes/${key}`, { method: 'PUT', body: JSON.stringify({ text: note.text, version: current.version }) });
        await cardNotes.retry(key);
        const latest = source.getJSON<Record<string, NoteEntry>>(CARD_NOTES_STORAGE_KEY, {});
        if (latest[key]?.text === note.text) { delete latest[key]; source.setJSON(CARD_NOTES_STORAGE_KEY, latest); }
        moved++;
      }
      setMessage(`Đã chuyển ${moved} ghi chú.${skipped ? ` ${skipped} ghi chú đã có bản khác trong tài khoản nên được giữ ở chế độ học thử.` : ''}`);
    } catch (reason) { setMessage((reason as Error).message + ' Ghi chú chưa chuyển vẫn được giữ ở chế độ học thử.'); }
    finally { setRows(source.getJSON(CARD_NOTES_STORAGE_KEY, {})); setBusy(false); }
  }
  if (!pending.length && !message) return null;
  return <section className="study-panel space-y-3" aria-label="Chuyển ghi chú học thử"><h3 className="font-semibold">Ghi chú học thử</h3><p className="study-copy text-sm">Có {pending.length} ghi chú trên thiết bị này. Bạn có thể chuyển vào tài khoản để dùng trên thiết bị khác. Ghi chú đã có trong tài khoản được ưu tiên.</p>
    {pending.length > 0 && <button className="study-button" disabled={busy} onClick={() => void transfer()}>{busy ? 'Đang chuyển ghi chú…' : 'Chuyển ghi chú vào tài khoản'}</button>}
    {message && <p role="status" className="study-copy text-sm">{message}</p>}
  </section>;
}
