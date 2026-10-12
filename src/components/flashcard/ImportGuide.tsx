import { useState } from "react";
import { Check, Copy, Download, FileQuestion } from "lucide-react";
import { IMPORT_EXAMPLE } from "@/lib/ankiImport";

const aiPrompt = `Hãy chuyển nội dung tôi cung cấp thành bộ thẻ học cho ứng dụng SỔ NHẬT.

Yêu cầu:
- Trả về duy nhất một mảng JSON hợp lệ, không thêm Markdown, lời giải thích hay dấu phẩy sau phần tử cuối.
- Mỗi đối tượng là một thẻ. Đặt nội dung cần học ở trường đầu tiên, đáp án/nghĩa ở trường tiếp theo.
- Tên trường có thể tùy ý, nhưng phải ngắn, rõ nghĩa và nhất quán giữa các thẻ. Có thể dùng front/back/reading/note như mẫu để thuận tiện nhận diện; đây không phải tên bắt buộc.
- Để thẻ hiển thị rõ ràng, tách riêng: nội dung cần học, nghĩa/đáp án, cách đọc, Hán Việt (nếu có), ghi chú, loại thẻ, nhãn và danh sách ví dụ. Không gộp tất cả vào phần nghĩa.
- Với mỗi ví dụ, dùng một đối tượng có japanese (câu tiếng Nhật), reading (cách đọc bằng kana) và meaning (nghĩa tiếng Việt). Giữ đúng ba khóa bên trong ví dụ để ứng dụng đọc được cấu trúc này.
- Loại thẻ, nếu có, chỉ dùng VOCABULARY, KANJI, GRAMMAR hoặc GENERAL. Nhãn là danh sách chuỗi.
- Cách đọc riêng chỉ chứa kana. Có thể dùng Kanji[hiragana] để chỉ rõ chú âm ngay trên từng chữ/cụm, ví dụ 日本[にほん]へ行[い]く; không đặt cách đọc cả câu trong ngoặc ở cuối câu.
- Không bịa cách đọc, Hán Việt hay ví dụ. Trường tùy chọn chưa có thông tin để null hoặc danh sách rỗng.
- Giữ xuống dòng cần thiết bằng ký tự \\n.

Mẫu nội dung mong muốn (tên trường bên ngoài có thể đổi):
${JSON.stringify(IMPORT_EXAMPLE, null, 2)}

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]`;

const fieldGuide = [
  ["Nội dung cần học · front / Từ / Câu hỏi", "Mặt trước"],
  ["Nghĩa, đáp án · back / Nghĩa / Trả lời", "Mặt sau"],
  ["Cách đọc · reading / Kana", "Cách đọc mặt trước"],
  ["Hán Việt · han_viet / Hán Việt", "Hán Việt"],
  ["Ghi chú · note / Ghi chú", "Ghi chú"],
  ["Loại · type / Loại", "Loại thẻ"],
  ["Nhãn · tags / Nhãn", "Nhãn"],
  ["Danh sách ví dụ · examples / Ví dụ", "Ví dụ có cấu trúc"],
];

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
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]"><FileQuestion size={18} /> JSON, Excel, CSV, TXT · Nhập tự do, trình bày thẻ rõ ràng</summary>
    <div className="mt-4 space-y-5 text-sm leading-relaxed">
      <p className="text-[var(--color-text-secondary)]">Bạn có thể giữ tên trường hoặc cột của file đang có. Mẫu bên dưới gợi ý nội dung để thẻ có nghĩa, cách đọc, ghi chú và ví dụ riêng như lúc học; không bắt buộc đổi tên trường theo mẫu.</p>
      <ol className="grid gap-3 sm:grid-cols-3">
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">1. Chọn file được hỗ trợ</strong>JSON, Excel, CSV hoặc TXT/TSV; mỗi thẻ một đối tượng hoặc một dòng.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">2. Gán vai trò cho trường</strong>Trường đầu tiên vào mặt trước. Kiểm tra gợi ý và chọn lại vai trò cho các trường còn lại.</li>
        <li className="rounded-xl bg-[var(--color-surface-alt)] p-3"><strong className="block">3. Xem trước rồi tạo</strong>Kiểm tra nghĩa, ghi chú và ví dụ. Có thể đổi thứ tự các trường trên hai mặt.</li>
      </ol>
      <div>
        <h4 className="font-semibold">Đủ nội dung, thẻ dễ học hơn</h4>
        <p className="mt-1 text-[var(--color-text-secondary)]">Mỗi thẻ cần nội dung ở cả mặt trước và mặt sau. Các phần còn lại là tùy chọn. Hãy tách ghi chú và ví dụ khỏi phần nghĩa để chúng hiển thị thành khối riêng; ví dụ có nút hiện/ẩn nghĩa.</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-alt)]"><tr><th className="px-3 py-2 font-semibold">Nội dung · Tên trường minh họa</th><th className="px-3 py-2 font-semibold">Chọn vai trò khi nhập</th></tr></thead>
            <tbody>{fieldGuide.map(([content, role]) => <tr key={role} className="border-t border-[var(--color-border)]"><td className="px-3 py-2">{content}</td><td className="px-3 py-2 font-medium">{role}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[var(--color-text-secondary)]">Ví dụ: cột “Từ tiếng Nhật” có thể gán vào Mặt trước, cột “Giải nghĩa” vào Mặt sau. Tên tự đặt chưa được nhận diện sẽ cần bạn chọn lại vai trò ở bước xem trước.</p>
      </div>
      <div>
        <h4 className="font-semibold">Mẫu thẻ có ghi chú và ví dụ</h4>
        <p className="mb-2 mt-1 text-[var(--color-text-secondary)]">Đây là một mảng JSON hoàn chỉnh. Với ví dụ có cấu trúc, giữ các khóa bên trong là <code>japanese</code>, <code>reading</code> và <code>meaning</code>; thêm nhiều ví dụ bằng cách thêm đối tượng vào danh sách.</p>
        <pre className="max-h-96 overflow-auto rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(IMPORT_EXAMPLE, null, 2)}</code></pre>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="study-button" onClick={() => onDownload("json")}><Download size={16} /> Mẫu JSON đầy đủ</button>
        <button type="button" className="study-button" onClick={() => onDownload("csv")}><Download size={16} /> Mẫu CSV</button>
        <button type="button" className="study-button" onClick={() => onDownload("txt")}><Download size={16} /> Mẫu TXT/TSV</button>
      </div>
      <p className="text-[var(--color-text-secondary)]">JSON thuận tiện nhất cho nhiều ví dụ. Trong Excel, CSV hoặc TXT/TSV, ô ví dụ chứa cả danh sách JSON như mẫu; gán ô đó vào “Ví dụ có cấu trúc”. Nhãn có thể ngăn bằng dấu chấm phẩy. Muốn giữ bố cục nghĩa–ghi chú–ví dụ như mẫu, giữ các vai trò tương ứng và bật hiển thị ví dụ ở mặt sau trong bố cục bộ thẻ.</p>
      <div>
        <h4 className="font-semibold">Cách đọc và chú âm</h4>
        <p className="mt-1 text-[var(--color-text-secondary)]">Trường cách đọc riêng chỉ nên chứa kana. Muốn hiragana nằm trên đúng chữ hoặc cụm Kanji, đặt <code>[hiragana]</code> ngay sau cụm đó: <code>立場[たちば]</code>, <code>日本[にほん]へ行[い]く</code>. Cách này dùng được ở cả hai mặt.</p>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Nhờ AI chuẩn bị nội dung theo mẫu</h4><button type="button" className="study-button !min-h-9 !py-1.5" onClick={() => void copyPrompt()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Đã sao chép" : "Sao chép câu lệnh"}</button></div>
        {copyError && <p role="status" className="mb-2 text-[var(--color-error)]">Chưa sao chép được. Bạn có thể chọn và sao chép câu lệnh bên dưới.</p>}
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{aiPrompt}</pre>
      </div>
    </div>
  </details>;
}
