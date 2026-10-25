import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AppDialog } from "@/components/ui/AppDialog";
import { codeDigits, resolveShareCode, sharedPath } from "@/lib/deckSharing";

/** Opens a shared deck or group from the short code someone gave you. */
export function EnterCodeDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const complete = codeDigits(code).length === 8;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!complete || busy) return;
    setBusy(true); setError("");
    try {
      const resolved = await resolveShareCode(code);
      onClose();
      navigate(sharedPath(resolved));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không mở được mã này."); setBusy(false); }
  }
  return <AppDialog open title="Nhập mã chia sẻ" onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4" onSubmit={event => void submit(event)} aria-busy={busy}>
      <p className="study-copy text-sm">Nhập mã 8 ký tự người chia sẻ gửi cho bạn, ví dụ <span className="font-mono">K7QM-3XPD</span>. Không phân biệt chữ hoa, chữ thường.</p>
      <label className="block text-sm">Mã chia sẻ
        <input className="study-input mt-1 text-center font-mono text-2xl tracking-[0.2em]" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12} aria-label="Mã chia sẻ"
          value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setError(""); }} placeholder="XXXX-XXXX" />
      </label>
      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      <button type="submit" className="study-button study-button-primary w-full justify-center" disabled={!complete || busy}>{busy ? "Đang tìm…" : "Mở bộ thẻ"}</button>
    </form>
  </AppDialog>;
}
