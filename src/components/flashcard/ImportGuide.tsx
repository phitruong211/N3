import { useState } from "react";
import { Check, Copy, Download, FileQuestion } from "lucide-react";
import { IMPORT_EXAMPLE } from "@/lib/ankiImport";

const aiPrompt = `Hãy chuyển nội dung tôi cung cấp thành dữ liệu import bộ thẻ cho ứng dụng SỔ NHẬT.

Yêu cầu:
- Trả về duy nhất một mảng JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Giữ tên trường ngắn, dễ hiểu và nhất quán giữa mọi thẻ. Không bắt buộc dùng front/back.
- Trường ĐẦU TIÊN của mỗi đối tượng phải là nội dung tôi cần nhìn ở mặt trước; các trường còn lại sẽ được tôi tự xếp lên mặt trước hoặc mặt sau sau khi tải file.
- Nếu có trường loại thẻ, chỉ dùng một trong: VOCABULARY, KANJI, GRAMMAR, GENERAL.
- Đặt [hiragana] NGAY SAU đúng chữ hoặc cụm Kanji cần chú âm. Ví dụ: 立場[たちば], 日本[にほん]へ行[い]く.
- Áp dụng Kanji[hiragana] ở mọi trường có tiếng Nhật. Không đặt cách đọc của cả câu ở cuối câu.
- Nếu tách riêng trường cách đọc, trường đó chỉ chứa kana. Không tự đoán khi không chắc.
- Giữ nguyên xuống dòng cần thiết bằng ký tự \\n.

Ví dụ một thẻ đúng:
{"Từ":"立場[たちば]","Nghĩa":"Lập trường","Câu ví dụ":"日本[にほん]での立場[たちば]","Hán Việt":"Lập Trường","Loại":"VOCABULARY","Nhãn":["N3"]}

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]`;

export function ImportGuide({ onDownload }: { onDownload: (format: "json" | "csv" | "txt") => void }) {
  const [copied, setCopied] = useState(false);
  async function copyPrompt() {
    await navigator.clipboard.writeText(aiPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]"><FileQuestion size={18} /> JSON, Excel, CSV, TXT · Cách nhập nhanh</summary>
    <div className="mt-4 space-y-5 text-sm leading-relaxed">
      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">1. Chọn tệp bất kỳ</strong>Không cần đổi tên cột theo mẫu.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">2. Xếp các trường</strong>Trường đầu tiên vào mặt trước; bạn có thể đổi lại.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">3. Xem rồi tạo</strong>Bản xem trước giống lúc học.</li>
      </ol>
      <div>
        <h4 className="font-semibold">Quy tắc chung</h4>
        <p className="mt-1 text-[var(--color-text-secondary)]">Mỗi dòng cần ít nhất hai trường có nội dung. Tên trường có thể là bất kỳ tên nào. Muốn hiragana nằm trên chữ nào, đặt <code>[hiragana]</code> ngay sau chữ hoặc cụm Kanji đó: <code>立場[たちば]</code>, <code>日本[にほん]へ行[い]く</code>. Dùng được ở mọi trường của cả hai mặt. Nếu tách riêng cột cách đọc, cột đó chỉ nên chứa kana.</p>
      </div>
      <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(IMPORT_EXAMPLE, null, 2)}</code></pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" onClick={() => onDownload("json")}><Download size={16} /> Ví dụ JSON</button>
        <button type="button" className="study-button" onClick={() => onDownload("csv")}><Download size={16} /> Ví dụ CSV</button>
        <button type="button" className="study-button" onClick={() => onDownload("txt")}><Download size={16} /> Ví dụ TXT/TSV</button>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Câu lệnh mẫu cho AI</h4><button type="button" className="study-button !min-h-9 !py-1.5" onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Đã sao chép" : "Sao chép câu lệnh"}</button></div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{aiPrompt}</pre>
      </div>
    </div>
  </details>;
}
