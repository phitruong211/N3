import { useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { REPORT_REASONS, reportDeck, type ReportReason } from "@/lib/deckSharing";

/** Tells moderators a shared deck breaks the rules. The owner is not told who reported. */
export function ReportDialog({ token, deckName, onClose }: { token: string; deckName: string; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason>("COPYRIGHT");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function send() {
    if (busy) return;
    setBusy(true); setError("");
    try { await reportDeck(token, reason, details); setSent(true); }
    catch (reasonError) { setError(reasonError instanceof Error ? reasonError.message : "Chưa gửi được báo cáo."); }
    finally { setBusy(false); }
  }
  return <AppDialog open title="Báo cáo bộ thẻ" onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4" aria-busy={busy}>
      <h3 className="text-lg font-semibold break-words">{deckName}</h3>
      {sent ? <>
        <p role="status" className="study-copy text-sm">Cảm ơn bạn. Báo cáo đã được gửi tới người kiểm duyệt; người chia sẻ không biết ai đã báo cáo.</p>
        <button type="button" className="study-button study-button-primary" onClick={onClose}>Đóng</button>
      </> : <>
        <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Lý do</legend>
          {REPORT_REASONS.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="report-reason" checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}
        </fieldset>
        <label className="block text-sm">Chi tiết {reason === "OTHER" ? <span aria-hidden="true">*</span> : "(không bắt buộc)"}
          <textarea className="study-input mt-1 min-h-24" maxLength={500} value={details} onChange={event => setDetails(event.target.value)} placeholder={reason === "COPYRIGHT" ? "Nội dung này thuộc sách hoặc tài liệu nào?" : "Mô tả ngắn vấn đề"} />
        </label>
        {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="study-button study-button-primary" disabled={busy || (reason === "OTHER" && details.trim().length < 5)} onClick={() => void send()}>{busy ? "Đang gửi…" : "Gửi báo cáo"}</button>
          <button type="button" className="study-button" disabled={busy} onClick={onClose}>Hủy</button>
        </div>
      </>}
    </div>
  </AppDialog>;
}
