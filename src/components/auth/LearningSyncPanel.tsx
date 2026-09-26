import { useEffect, useRef, useState } from "react";
import {
  getLearningState,
  migrateGuestLearning,
  migrationKey,
  type LearningData,
  type LearningSnapshot,
  type MigrationReport,
} from "@/lib/learningSync";

export interface LearningMigrationSource {
  id: string;
  label: string;
  snapshot: LearningData;
  /** Only remove transferred source records, preserving listening/preferences and newer work. */
  onTransferred: (transferred: LearningData) => void;
}
export interface LearningSyncPanelProps {
  accountId: string;
  sources: LearningMigrationSource[];
  beforeTransfer: () => Promise<void>;
  afterTransfer: () => void;
  onState: (state: LearningSnapshot) => void;
}

export default function LearningSyncPanel({
  accountId,
  sources,
  onState,
  beforeTransfer,
  afterTransfer,
}: LearningSyncPanelProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const busyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = busyDialog.current;
    if (busy) element?.showModal();
    return () => element?.close();
  }, [busy]);
  const active = useRef(true);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      abort.current?.abort();
    };
  }, [accountId]);
  async function transfer(source: LearningMigrationSource) {
    if (busy || !consent[source.id]) return;
    setBusy(source.id);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    const data = structuredClone(source.snapshot);
    try {
      await beforeTransfer();
      const key = await migrationKey(accountId, source.id, data);
      controller.signal.throwIfAborted();
      const result = await migrateGuestLearning(data, key, controller.signal);
      if (!active.current || controller.signal.aborted) return;
      // The migration was committed. Retain the source until a current account snapshot is available.
      const latest = await getLearningState(controller.signal);
      if (!active.current || controller.signal.aborted) return;
      onState(latest);
      source.onTransferred(data);
      setReport(result);
      setDismissed((items) => [...items, source.id]);
    } catch (e) {
      if (active.current && !controller.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "Chưa chuyển được dữ liệu. Bản trên thiết bị vẫn được giữ; hãy thử lại.",
        );
    } finally {
      afterTransfer();
      if (active.current && !controller.signal.aborted) setBusy(null);
    }
  }
  const visible = sources.filter(
    (s) =>
      !dismissed.includes(s.id) &&
      s.snapshot.bookmarks.length +
        s.snapshot.srsCards.length +
        s.snapshot.studyDays.length >
        0,
  );
  if (!visible.length && !report) return null;
  return (
    <section
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3"
      aria-label="Chuyển dữ liệu học trên thiết bị"
    >
      {busy && (
        <dialog
          ref={busyDialog}
          className="m-auto rounded-2xl bg-[var(--color-surface)] text-[var(--color-text)] p-6 backdrop:bg-black/50"
          onCancel={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label="Đang chuyển dữ liệu"
        >
          <p role="status">Đang chuyển dữ liệu…</p>
        </dialog>
      )}
      {visible.map((source) => (
        <div key={source.id} className="space-y-3">
          <h2 className="font-semibold">Chuyển {source.label} vào tài khoản</h2>
          <p className="text-sm">
            {source.snapshot.bookmarks.length} dấu trang ·{" "}
            {source.snapshot.srsCards.length} tiến độ SRS ·{" "}
            {source.snapshot.studyDays.length} ngày hoạt động.
          </p>
          <p className="text-sm">
            Dấu trang được gộp. Thẻ đã có tiến độ tài khoản sẽ giữ bản tài
            khoản. Hoạt động được cộng theo ngày. Chỉ xóa bản nguồn sau khi máy
            chủ xác nhận.
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!consent[source.id]}
              disabled={!!busy}
              onChange={(e) =>
                setConsent((c) => ({ ...c, [source.id]: e.target.checked }))
              }
            />
            Tôi xác nhận dữ liệu này thuộc về tôi và đồng ý chuyển vào tài khoản
            hiện tại.
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="study-button study-button-primary"
              disabled={!!busy || !consent[source.id]}
              onClick={() => void transfer(source)}
            >
              {busy === source.id
                ? "Đang chuyển…"
                : error
                  ? "Thử chuyển lại"
                  : "Chuyển dữ liệu vào tài khoản"}
            </button>
            <button
              className="study-button"
              disabled={!!busy}
              onClick={() => setDismissed((items) => [...items, source.id])}
            >
              Để lại trên thiết bị
            </button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error} Dữ liệu nguồn vẫn được giữ trên thiết bị.
        </p>
      )}
      {report && (
        <p role="status" className="text-sm">
          Đã chuyển {report.bookmarksCreated} dấu trang, {report.srsCreated}{" "}
          tiến độ SRS và {report.activitiesMerged} ngày hoạt động. Bỏ qua{" "}
          {report.srsSkipped} tiến độ Guest vì tài khoản đã có.
        </p>
      )}
    </section>
  );
}
