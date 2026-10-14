import { useState } from "react";
import { Check, Copy, Download, Eye, FileQuestion } from "lucide-react";
import { IMPORT_EXAMPLE } from "@/lib/ankiImport";

const sampleCard = IMPORT_EXAMPLE[0];
const guideExample = [{
  front: sampleCard.front,
  reading: sampleCard.reading,
  back: sampleCard.back,
  back_reading: sampleCard.back_reading,
  note: sampleCard.note,
  examples: sampleCard.examples,
}];
const aiPrompt = `Chuyển nội dung bên dưới thành một mảng JSON hợp lệ để nhập thẻ vào SỔ NHẬT. Chỉ trả về JSON.
- Mỗi thẻ có nội dung mặt trước, nghĩa mặt sau và ghi chú nếu có. Tên các trường này có thể đặt tùy ý.
- Cách đọc bằng kana của mặt trước để ở reading, của mặt sau để ở back_reading. Nếu mặt sau là tiếng Việt, để back_reading trống. Khi nhập, gán đúng “Cách đọc mặt trước” và “Cách đọc mặt sau”.
- Tách ví dụ thành danh sách riêng như mẫu, không gộp vào phần nghĩa. Mỗi ví dụ giữ đúng japanese (câu tiếng Nhật), reading (cách đọc bằng kana, có thể bỏ nếu chưa có), meaning (nghĩa tiếng Việt). Nhờ vậy ứng dụng hiển thị khung ví dụ và nút con mắt để hiện/ẩn nghĩa.
- Không bịa thông tin. Có thể thêm nhiều ví dụ vào danh sách.
- Có thể dùng HTML và CSS nội tuyến trong front/back/note để phân biệt từng phần: <b>in đậm</b>, <i>in nghiêng</i>, <br> xuống dòng, <p> đoạn văn, <ul><li> danh sách. Dùng style="color:#60a5fa;font-size:24px;font-weight:700" để đổi màu/cỡ/độ đậm; padding-left:24px hoặc text-indent:24px để thụt dòng; text-align:left và line-height:1.6 để dễ đọc. Cỡ chữ 12–72px, khoảng cách 0–64px. Escape dấu nháy kép đúng chuẩn JSON. Không dùng script, CSS class, khối style, file CSS hoặc font ngoài. Chỉ thêm định dạng khi có ích, chọn màu dễ đọc trên cả nền sáng và tối.

Mẫu:
${JSON.stringify(guideExample, null, 2)}

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]`;

export function ImportGuide({ onDownload }: { onDownload: (format: "json" | "csv" | "txt") => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  }
  return <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]"><FileQuestion size={18} /> Hướng dẫn import: ví dụ, màu chữ và định dạng</summary>
    <div className="mt-4 space-y-4 text-sm leading-relaxed">
      <p className="text-[var(--color-text-secondary)]">Tên trường hoặc cột đặt tùy ý. Để có <strong className="text-[var(--color-text)]">khung ví dụ và nút con mắt</strong>, hãy để ví dụ riêng theo mẫu dưới đây.</p>
      <ol className="space-y-2 text-[var(--color-text-secondary)]">
        <li><strong className="text-[var(--color-text)]">1. Tách ví dụ khỏi phần nghĩa.</strong> Mỗi ví dụ gồm <code>japanese</code> — câu tiếng Nhật, <code>meaning</code> — nghĩa tiếng Việt; thêm <code>reading</code> nếu muốn hiện cách đọc. Giữ đúng các tên bên trong ví dụ này.</li>
        <li><strong className="text-[var(--color-text)]">2. Khi nhập file, chọn “Ví dụ có cấu trúc”.</strong> Gán trường chứa danh sách ví dụ vào mục này ở bước xem trước. Gán phần ghi chú vào “Ghi chú” để có khung riêng.</li>
        <li><strong className="text-[var(--color-text)]">3. Xem mặt sau của thẻ.</strong> Ví dụ sẽ nằm trong khung; bấm <Eye className="inline-block align-text-bottom" size={15} aria-hidden="true" /> “Hiện nghĩa” để xem bản dịch.</li>
      </ol>
      <div className="rounded-xl bg-[var(--color-surface-alt)] p-3">
        <h4 className="font-semibold">Cách đọc đặt ở đâu?</h4>
        <ul className="mt-2 space-y-1 text-[var(--color-text-secondary)]">
          <li><code>reading</code>: cách đọc của <strong>mặt trước</strong> → chọn “Cách đọc mặt trước”.</li>
          <li><code>back_reading</code>: cách đọc của <strong>mặt sau</strong> → chọn “Cách đọc mặt sau”. Nếu mặt sau là nghĩa tiếng Việt, để trống như mẫu.</li>
          <li><code>reading</code> bên trong từng ví dụ: chỉ là cách đọc của <strong>câu ví dụ đó</strong>.</li>
        </ul>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Cách đọc viết bằng kana. Mặt sau chưa có cách đọc riêng sẽ dùng mặt trước; muốn ẩn, vào Tùy chỉnh thẻ → Mặt sau và bỏ chọn “Cách đọc”.</p>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Màu chữ, cỡ chữ và thụt dòng từ file</h4>
        <p className="text-[var(--color-text-secondary)]">Nội dung mặt trước, mặt sau và ghi chú tự nhận HTML/CSS nội tuyến. Định dạng hiển thị trong bước xem trước và khi học. Ví dụ:</p>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify([{ front: '<b style="color:#60a5fa">Whereas / While</b>', back: '<div style="text-align:left;line-height:1.6"><p><strong style="color:#c084fc">CÔNG THỨC:</strong></p><p style="padding-left:24px;font-size:20px">S + V, <b>whereas</b> + S + V.</p></div>', type: 'GENERAL' }], null, 2)}</code></pre>
        <ul className="mt-3 space-y-1 text-[var(--color-text-secondary)]">
          <li><code>{'<b>…</b>, <i>…</i>, <u>…</u>'}</code>: đậm, nghiêng, gạch chân; <code>{'<br>'}</code>: xuống dòng.</li>
          <li><code>color</code>, <code>background-color</code>: màu chữ, tô nền; <code>font-size</code>: 12–72px; <code>font-weight</code>: 100–900 theo bước 100.</li>
          <li><code>padding-left:24px</code>: thụt cả đoạn; <code>text-indent:24px</code>: thụt dòng đầu. Khoảng cách nhận 0–64px.</li>
          <li>CSS qua class, file CSS riêng và định dạng màu/font của ô Excel chưa được hỗ trợ. Với Excel, viết HTML ngay trong nội dung ô.</li>
          <li>Trong JSON, escape dấu nháy kép bằng <code>{'\\"'}</code>. Trong CSV, nhân đôi dấu nháy kép bên trong ô.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <a className="study-button" href="/data/import-formatting-sample.json" download><Download size={16} /> Mẫu JSON có định dạng</a>
          <a className="study-button" href="/data/import-formatting-guide.md" download><Download size={16} /> Hướng dẫn định dạng đầy đủ</a>
        </div>
      </div>
      <div>
        <h4 className="mb-2 font-semibold">Mẫu JSON — có thể sao chép và dùng ngay</h4>
        <pre className="max-h-80 overflow-auto rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(guideExample, null, 2)}</code></pre>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Thêm ví dụ bằng cách thêm phần tử vào danh sách. Với Excel, CSV hoặc TXT/TSV, đặt danh sách này trong một ô; tải file mẫu bên dưới để xem.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" onClick={() => onDownload("json")}><Download size={16} /> Mẫu JSON</button>
        <button type="button" className="study-button" onClick={() => onDownload("csv")}><Download size={16} /> Mẫu CSV</button>
        <button type="button" className="study-button" onClick={() => onDownload("txt")}><Download size={16} /> Mẫu TXT/TSV</button>
        <button type="button" className="study-button" onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Đã sao chép" : "Sao chép câu lệnh cho AI"}</button>
      </div>
      {copyError && <p role="status" className="text-[var(--color-error)]">Chưa sao chép được. Mở câu lệnh bên dưới để sao chép thủ công.</p>}
      <details>
        <summary className="cursor-pointer text-[var(--color-text-secondary)]">Xem câu lệnh cho AI</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{aiPrompt}</pre>
      </details>
    </div>
  </details>;
}
