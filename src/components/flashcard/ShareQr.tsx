import { useEffect, useState } from "react";
import { Download } from "@/components/ui/icons";
import { qrDataUri, qrPng } from "@/lib/qr";
import { downloadFile } from "@/lib/download";

/** A scannable QR for a share link. The image is drawn locally from the link. */
export function ShareQr({ url, name }: { url: string; name: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let valid = true;
    qrDataUri(url).then(uri => { if (valid) setSrc(uri); }).catch(() => { if (valid) setError("Không tạo được mã QR."); });
    return () => { valid = false; };
  }, [url]);
  return <div className="space-y-3 text-center">
    {src ? <img src={src} alt={`Mã QR mở ${name}`} width={208} height={208} className="mx-auto rounded-xl bg-white p-2" /> : <p role="status" className="study-copy text-sm">{error || "Đang tạo mã QR…"}</p>}
    <p className="study-copy break-all text-xs">{url}</p>
    {src && <button type="button" className="study-button" onClick={() => void qrPng(url).then(blob => downloadFile(`qr-${name.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "bo-the"}.png`, blob, "image/png"))}><Download size={16} />Tải ảnh QR</button>}
  </div>;
}
