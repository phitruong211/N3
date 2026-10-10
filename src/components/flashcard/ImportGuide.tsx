import { useState } from "react";
import { Check, Copy, Download, FileQuestion } from "lucide-react";
import { IMPORT_EXAMPLE } from "@/lib/ankiImport";

const aiPrompt = `Hãy chuyển nội dung tôi cung cấp thành dữ liệu import bộ thẻ cho ứng dụng SỔ NHẬT.

Yêu cầu:
- Trả về duy nhất một mảng JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Mỗi thẻ có: front, back, reading, back_reading, han_viet, note, type, tags.
- front và back bắt buộc. Các trường còn lại có thể là chuỗi rỗng; tags là mảng chuỗi.
- type chỉ dùng một trong: VOCABULARY, KANJI, GRAMMAR, GENERAL.
- Quy tắc furigana: đặt [hiragana] NGAY SAU đúng chữ hoặc cụm Kanji cần chú âm. Ví dụ: 立場[たちば], 日本[にほん]へ行[い]く.
- Áp dụng quy tắc Kanji[hiragana] cho cả front và back. Không đặt cách đọc của cả câu ở cuối câu.
- reading và back_reading chỉ chứa cách đọc bằng kana, không lặp lại Kanji và không dùng dấu ngoặc. Ví dụ: reading là "たちば", không phải "立場[たちば]".
- Không tự đoán cách đọc khi không chắc; để reading/back_reading trống và giữ Kanji không có ngoặc để tôi bổ sung sau.
- Giữ nguyên xuống dòng cần thiết trong back bằng ký tự \\n.

Ví dụ một thẻ đúng:
{"front":"立場[たちば]","back":"Lập trường; 日本[にほん]での立場[たちば]","reading":"たちば","back_reading":"","han_viet":"Lập Trường","note":"","type":"VOCABULARY","tags":["N3"]}

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
      <FileQuestion size={18} /> JSON, Excel, CSV, TXT · Xem hướng dẫn và file mẫu
    </summary>
    <div className="mt-4 space-y-5 text-sm leading-relaxed">
      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">1. Chuẩn bị</strong>JSON, TXT, CSV, TSV, XLSX hoặc XLS; tối đa 20 MB và 20.000 thẻ.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">2. Chọn tệp</strong>Hệ thống tự nhận diện cột và hiển thị bản xem trước để sửa.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">3. Kiểm tra</strong>Thấy đúng hai mặt và furigana thì bấm “Tạo bộ thẻ”.</li>
      </ol>
      <div>
        <h4 className="font-semibold">Quy tắc chung cho mọi định dạng</h4>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Cột bắt buộc: <code>front</code>, <code>back</code>. Cột tùy chọn: <code>reading</code>, <code>back_reading</code>, <code>han_viet</code>, <code>note</code>, <code>type</code>, <code>tags</code>, <code>examples</code>. Muốn hiragana nằm trên chữ nào, đặt <code>[hiragana]</code> ngay sau chữ hoặc cụm Kanji đó: <code>立場[たちば]</code>, <code>日本[にほん]へ行[い]く</code>. Dùng được ở cả hai mặt; riêng <code>reading</code> và <code>back_reading</code> chỉ nhập kana.
        </p>
      </div>
      <pre className="max-h-72 overflow-auto rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(IMPORT_EXAMPLE, null, 2)}</code></pre>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" onClick={() => onDownload("json")}><Download size={16} /> Mẫu JSON</button>
        <button type="button" className="study-button" onClick={() => onDownload("csv")}><Download size={16} /> Mẫu CSV</button>
        <button type="button" className="study-button" onClick={() => onDownload("txt")}><Download size={16} /> Mẫu TXT/TSV</button>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Câu lệnh mẫu cho AI</h4><button type="button" className="study-button !min-h-9 !py-1.5" onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Đã sao chép" : "Sao chép câu lệnh"}</button></div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{aiPrompt}</pre>
      </div>
    </div>
  </details>;
}
