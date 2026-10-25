import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { dismissReport, listReports, removeDeckFromSharing, restoreDeckSharing, REPORT_REASONS, type ModerationPage } from "@/lib/deckSharing";
import { useAuth } from "@/hooks/useAuth";
import { NotFoundPage } from "@/components/layout/NotFoundPage";

const STATUSES: Array<[string, string]> = [["OPEN", "Đang chờ"], ["ACTIONED", "Đã gỡ"], ["DISMISSED", "Đã bỏ qua"]];
const reasonLabel = (reason: string) => REPORT_REASONS.find(([value]) => value === reason)?.[1] ?? reason;

/** Moderator queue for reported shared decks. The server checks the role again on every call. */
export function AdminReportsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("OPEN");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ModerationPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const admin = user?.role === "ADMIN";
  useEffect(() => {
    if (!admin) return;
    let valid = true;
    listReports(status, page).then(next => { if (valid) { setResult(next); setError(""); } })
      .catch(reasonError => { if (valid) setError(reasonError instanceof ApiError ? reasonError.message : "Không tải được danh sách báo cáo."); });
    return () => { valid = false; };
  }, [admin, status, page, reload]);
  if (!admin) return <NotFoundPage />;
  async function act(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); setRemoving(null); setReason(""); setReload(value => value + 1); }
    catch (reasonError) { setError(reasonError instanceof Error ? reasonError.message : "Thao tác chưa thành công."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5" aria-label="Báo cáo bộ thẻ">
    <div><p className="study-eyebrow">QUẢN TRỊ</p><h1 className="text-2xl font-semibold">Báo cáo bộ thẻ được chia sẻ</h1>
      <p className="study-copy mt-1 text-sm">Ba báo cáo đang chờ trên cùng một bộ sẽ tự ẩn bộ đó khỏi thư viện cho tới khi bạn xử lý. Gỡ một bộ làm liên kết và mã ngừng hoạt động; bản người khác đã lưu vẫn giữ nguyên.</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Trạng thái báo cáo">
      {STATUSES.map(([value, label]) => <button key={value} type="button" className={`study-button ${status === value ? "study-button-primary" : ""}`} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); }}>{label}</button>)}
    </div>
    {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
    {result && !result.reports.length && <p className="study-copy">Không có báo cáo nào.</p>}
    <ul className="space-y-3">
      {result?.reports.map(report => <li key={report.id} className="study-panel space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0"><h2 className="break-words font-semibold">{report.deckName}</h2><p className="study-copy text-xs">Chủ bộ: {report.owner} · {report.openReportsForDeck} báo cáo đang chờ · {report.moderation ?? "đã xóa"}</p></div>
          <span className="study-pill">{reasonLabel(report.reason)}</span>
        </div>
        {report.details && <p className="whitespace-pre-wrap break-words text-sm">{report.details}</p>}
        <p className="study-copy text-xs">Người báo cáo: {report.reporter} · {new Date(report.createdAt).toLocaleString("vi-VN")}</p>
        {report.status === "OPEN" && (removing === report.id ? <div className="space-y-2">
          <label className="block text-sm">Lý do gỡ (người chia sẻ sẽ thấy)<textarea className="study-input mt-1" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><button type="button" className="study-button study-button-primary" disabled={busy || !reason.trim()} onClick={() => void act(() => removeDeckFromSharing(report.deckId, reason))}>Xác nhận gỡ</button><button type="button" className="study-button" disabled={busy} onClick={() => setRemoving(null)}>Hủy</button></div>
        </div> : <div className="flex flex-wrap gap-2">
          {report.deckToken && <a className="study-button" href={`/shared/${encodeURIComponent(report.deckToken)}`} target="_blank" rel="noreferrer">Xem bộ thẻ</a>}
          <button type="button" className="study-button" disabled={busy} onClick={() => void act(() => dismissReport(report.id))}>Bỏ qua</button>
          <button type="button" className="study-button" disabled={busy} onClick={() => { setRemoving(report.id); setReason(""); }}>Gỡ bộ thẻ</button>
        </div>)}
        {report.status === "ACTIONED" && report.moderation === "REMOVED" && <button type="button" className="study-button" disabled={busy} onClick={() => void act(() => restoreDeckSharing(report.deckId))}>Khôi phục quyền chia sẻ</button>}
      </li>)}
    </ul>
    {result && result.totalPages > 1 && <div className="flex items-center gap-3"><button type="button" className="study-button" disabled={page <= 0} onClick={() => setPage(page - 1)}>Trước</button><span className="study-copy text-sm">Trang {page + 1} / {result.totalPages}</span><button type="button" className="study-button" disabled={page >= result.totalPages - 1} onClick={() => setPage(page + 1)}>Sau</button></div>}
  </section>;
}
