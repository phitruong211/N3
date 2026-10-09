import { useState } from "react";
import { Check, Copy, Download, FileQuestion } from "lucide-react";
import { IMPORT_EXAMPLE } from "@/lib/ankiImport";

const aiPrompt = `Hãy chuyển nội dung tôi cung cấp thành dữ liệu import bộ thẻ cho ứng dụng SỔ NHẬT.

Yêu cầu:
- Trả về duy nhất một mảng JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Mỗi thẻ có: front, back, reading, back_reading, han_viet, note, type, tags.
- front và back bắt buộc. Các trường còn lại có thể là chuỗi rỗng; tags là mảng chuỗi.
- type chỉ dùng một trong: VOCABULARY, KANJI, GRAMMAR, GENERAL.
- Khi có Kanji, ghi furigana chính xác theo dạng 学校[がっこう]. Có thể dùng ở cả front và back.
- Không tự đoán cách đọc khi không chắc; để reading hoặc back_reading trống để tôi bổ sung.
- Giữ nguyên xuống dòng cần thiết trong back bằng ký tự \\n.

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
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]">
      <FileQuestion size={18} /> Hướng dẫn import và prompt tạo file
    </summary>
    <div className="mt-4 space-y-5 text-sm leading-relaxed">
      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">1. Chuẩn bị</strong>JSON, TXT, CSV, TSV, XLSX hoặc XLS; tối đa 20 MB và 20.000 thẻ.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">2. Chọn file</strong>Hệ thống tự nhận diện cột và hiển thị bản xem trước để sửa.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">3. Kiểm tra</strong>Thấy đúng hai mặt và furigana thì bấm “Tạo bộ thẻ”.</li>
      </ol>
      <div>
        <h4 className="font-semibold">Quy tắc chung cho mọi định dạng</h4>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Cột bắt buộc: <code>front</code>, <code>back</code>. Cột tùy chọn: <code>reading</code>, <code>back_reading</code>, <code>han_viet</code>, <code>note</code>, <code>type</code>, <code>tags</code>, <code>examples</code>. Đặt hiragana trên Kanji bằng <code>学校[がっこう]</code> ở mặt trước hoặc mặt sau.
        </p>
      </div>
      <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(IMPORT_EXAMPLE, null, 2)}</code></pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" onClick={() => onDownload("json")}><Download size={16} /> Mẫu JSON</button>
        <button type="button" className="study-button" onClick={() => onDownload("csv")}><Download size={16} /> Mẫu CSV</button>
        <button type="button" className="study-button" onClick={() => onDownload("txt")}><Download size={16} /> Mẫu TXT/TSV</button>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Prompt dùng ngay với AI</h4><button type="button" className="study-button !min-h-9 !py-1.5" onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Đã sao chép" : "Sao chép prompt"}</button></div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{aiPrompt}</pre>
      </div>
    </div>
  </details>;
}
