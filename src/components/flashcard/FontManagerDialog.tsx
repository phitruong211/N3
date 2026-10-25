import { useEffect, useState } from "react";
import { AppDialog } from "@/components/ui/AppDialog";
import { Trash2, Upload, X } from "@/components/ui/icons";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { addCustomFont, customFontId, removeCustomFont } from "@/lib/customFonts";
import { checkFontFile } from "@/lib/fontApi";
import { ensureFont } from "@/lib/fontLoader";
import { fontStack } from "@/lib/fontRegistry";

const megabytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 * 10 ? 1 : 0)} MB`;

/** Upload, preview and delete the user's own fonts. They stay private to the account. */
export function FontManagerDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded?: (fontId: string) => void }) {
  const { fonts, limits, status, error: loadError, signedIn } = useCustomFonts();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [licensed, setLicensed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  useEffect(() => { fonts.forEach(font => ensureFont(customFontId(font))); }, [fonts]);
  const full = limits ? fonts.length >= limits.maxFonts : false;

  function choose(next: File | undefined) {
    setError(""); setNotice("");
    if (!next) { setFile(null); return; }
    const problem = checkFontFile(next, limits ?? undefined);
    if (problem) { setError(problem); setFile(null); return; }
    setFile(next);
    setName(next.name.replace(/\.(woff2|ttf)$/i, ""));
  }
  async function upload() {
    if (!file || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const font = await addCustomFont(file, name);
      setNotice(`Đã thêm “${font.name}”. Bạn chọn nó trong ô Font chữ ở mục “Font của bạn”.`);
      setFile(null); setName(""); setLicensed(false);
      onUploaded?.(customFontId(font));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Không tải được font."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError(""); setNotice("");
    try { await removeCustomFont(id); setConfirmDelete(null); setNotice("Đã xóa font. Bộ thẻ đang dùng font này sẽ hiện font mặc định."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Không xóa được font."); }
    finally { setBusy(false); }
  }

  return <AppDialog open title="Font của bạn" onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-5" aria-busy={busy || status === "loading"}>
      <p className="study-copy text-sm">Tải font .woff2 hoặc .ttf (tối đa {limits ? megabytes(limits.maxFileBytes) : "5 MB"} mỗi tệp) để dùng cho thẻ của bạn. Font chỉ nằm trong tài khoản của bạn: khi chia sẻ bộ thẻ, <strong>font riêng không đi kèm</strong> và người nhận thấy font mặc định.</p>
      {!signedIn ? <p role="status" className="rounded-lg bg-[var(--color-surface-alt)] p-3 text-sm">Đăng nhập để tải và dùng font riêng.</p> : <>
        <fieldset className="space-y-3 rounded-xl border border-[var(--color-border)] p-4" disabled={busy || full}>
          <legend className="px-2 font-semibold">Thêm font</legend>
          <label className="block text-sm">Tệp font
            <input type="file" accept=".woff2,.ttf" aria-label="Chọn tệp font" className="study-input mt-1" onChange={event => { choose(event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {file && <>
            <label className="block text-sm">Tên hiển thị
              <input className="study-input mt-1" maxLength={60} value={name} onChange={event => setName(event.target.value)} />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={licensed} onChange={event => setLicensed(event.target.checked)} />
              <span>Tôi có quyền sử dụng font này (giấy phép cho phép dùng cá nhân hoặc nhúng vào nội dung của tôi).</span>
            </label>
            <button type="button" className="study-button study-button-primary" disabled={!licensed} onClick={() => void upload()}><Upload size={16} />{busy ? "Đang tải lên…" : `Tải lên (${megabytes(file.size)})`}</button>
          </>}
          {full && <p className="text-sm text-[var(--color-warning)]">Bạn đã dùng hết {limits?.maxFonts} font. Xóa bớt để thêm font mới.</p>}
        </fieldset>
        {limits && <p className="text-xs text-[var(--color-text-secondary)]">Đã dùng {fonts.length}/{limits.maxFonts} font · {megabytes(limits.usedBytes)}/{megabytes(limits.maxTotalBytes)}</p>}
        {status === "error" && <p role="alert" className="text-sm text-[var(--color-error)]">{loadError}</p>}
        <ul className="space-y-2" aria-label="Danh sách font của bạn">
          {fonts.map(font => <li key={font.id} className="space-y-2 rounded-xl bg-[var(--color-surface-alt)] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-semibold">{font.name}</p><p className="text-xs text-[var(--color-text-secondary)]">.{font.format} · {megabytes(font.sizeBytes)}</p></div>
              {confirmDelete === font.id
                ? <span className="flex gap-2"><button type="button" className="study-button" disabled={busy} onClick={() => void remove(font.id)}>Xóa</button><button type="button" className="study-button" disabled={busy} onClick={() => setConfirmDelete(null)}><X size={16} />Giữ</button></span>
                : <button type="button" className="study-button" disabled={busy} aria-label={`Xóa font ${font.name}`} onClick={() => setConfirmDelete(font.id)}><Trash2 size={16} /></button>}
            </div>
            <p lang="ja" className="text-xl leading-relaxed" style={{ fontFamily: fontStack(customFontId(font)) }}>日本語を勉強する · Tiếng Việt có dấu</p>
          </li>)}
          {status === "ready" && !fonts.length && <li className="text-sm text-[var(--color-text-secondary)]">Chưa có font nào.</li>}
        </ul>
      </>}
      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
      {notice && <p role="status" className="study-copy text-xs">{notice}</p>}
    </div>
  </AppDialog>;
}
