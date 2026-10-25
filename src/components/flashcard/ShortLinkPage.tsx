import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { resolveShareCode, sharedPath } from "@/lib/deckSharing";
import { AppLoading } from "@/components/ui/AppLoading";
import { SharedError, SharedPageLayout } from "./SharedPageLayout";

/** /s/:code, the address inside a QR code: finds what the code points to and opens it. */
export function ShortLinkPage() {
  const { code = "" } = useParams();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [gone, setGone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(""); setGone(false);
    resolveShareCode(code, controller.signal).then(resolved => { if (!controller.signal.aborted) setTarget(sharedPath(resolved)); })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof ApiError ? reason.message : "Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.");
        setGone(reason instanceof ApiError && reason.status === 404);
      });
    return () => controller.abort();
  }, [code, attempt]);
  if (target) return <Navigate to={target} replace />;
  return <SharedPageLayout>{error ? <SharedError error={error} unavailable={gone} retry={() => setAttempt(value => value + 1)} /> : <AppLoading message="Đang mở bộ thẻ được chia sẻ…" />}</SharedPageLayout>;
}
