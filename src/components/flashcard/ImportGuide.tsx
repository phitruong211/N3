import { useState } from 'react';
import { Check, Copy, Download } from '@/components/ui/icons';
import { IMPORT_EXAMPLE } from '@/lib/ankiImport';

const sampleCard = IMPORT_EXAMPLE[0];
const guideExample = [{
  front: sampleCard.front,
  reading: sampleCard.reading,
  back: sampleCard.back,
  back_reading: sampleCard.back_reading,
  note: sampleCard.note,
  examples: sampleCard.examples,
}];
const formattingPrompt = `Hãy định dạng nội dung bộ thẻ JSON bên dưới bằng HTML và CSS nội tuyến để dễ học trên SỔ NHẬT. Chỉ trả về mảng JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Giữ nguyên số thẻ, cấu trúc trường, nội dung kiến thức và cách đọc. Chỉ thay đổi định dạng trong front, back, note và japanese/meaning của examples nếu cần; không thêm HTML vào reading hoặc back_reading.
- Dùng <b>/<strong> để in đậm, <i>/<em> để in nghiêng, <u> gạch chân, <br> xuống dòng, <p> chia đoạn, <ul>/<ol>/<li> cho danh sách. Dùng <span> hoặc <div> với style để định dạng từng đoạn.
- CSS được hỗ trợ: color, background-color; font-size 12–72px; font-weight 100–900 theo bước 100; font-style normal/italic; text-align left/right/center/justify; line-height từ 1 đến 2; padding-left, text-indent, margin-left, margin-top, margin-bottom từ 0–64px.
- Ưu tiên nội dung căn trái, đoạn ngắn, tiêu đề đậm và màu nhấn vừa đủ. Chọn màu dễ đọc trên cả nền sáng và tối. Ví dụ: <p style="color:#60a5fa;font-size:24px;font-weight:700">CÔNG THỨC</p>.
- Chỉ dùng CSS trong thuộc tính style. Không dùng script, event handler, class, khối <style>, file CSS, font ngoài hoặc ảnh.
- Giữ nguyên cú pháp 学校[がっこう] trong cùng một đoạn chữ; không tách Kanji và phần đọc bằng thẻ HTML.
- Escape dấu nháy kép của HTML đúng chuẩn chuỗi JSON.

Bộ thẻ cần định dạng:
[DÁN JSON CỦA BẠN VÀO ĐÂY]`;

const structurePrompt = `Chuyển nội dung bên dưới thành một mảng JSON hợp lệ để import vào SỔ NHẬT. Chỉ trả về JSON, không thêm Markdown hay lời giải thích.
- Mỗi thẻ dùng các trường: front, back, reading, back_reading, note, type, tags, examples.
- front và back là chuỗi bắt buộc, có nội dung. reading, back_reading và note là chuỗi, có thể để trống. tags là mảng chuỗi.
- type là VOCABULARY, KANJI, GRAMMAR hoặc GENERAL tùy nội dung.
- reading là cách đọc bằng kana của mặt trước; back_reading là cách đọc bằng kana của mặt sau. Nếu mặt sau là tiếng Việt, để back_reading trống. Không tự đoán cách đọc khi chưa chắc.
- Có thể viết furigana chính xác trực tiếp trong nội dung theo dạng 学校[がっこう].
- Tách ví dụ khỏi phần nghĩa vào examples, là mảng đối tượng có đúng các trường japanese (câu ví dụ), reading (cách đọc bằng kana, có thể để trống), meaning (nghĩa tiếng Việt). Nếu không có ví dụ, dùng []. Ứng dụng dùng cấu trúc này để hiện khung ví dụ và nút hiện/ẩn nghĩa.
- Không bịa thông tin hoặc lược bỏ kiến thức. Dùng văn bản thuần trước; có thể dùng prompt HTML/CSS riêng để định dạng sau.
- Lưu kết quả thành file .json mã hóa UTF-8. Khi import, gán examples vào “Ví dụ có cấu trúc”, reading/back_reading vào đúng cách đọc của từng mặt.

Ví dụ cấu trúc:
${JSON.stringify([{ ...guideExample[0], type: 'VOCABULARY', tags: [] }], null, 2)}

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]`;

function PromptSection({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setError(true); }
  }
  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="font-semibold">{title}</h4>
      <button type="button" className="study-button" aria-label={`Sao chép ${title}`} onClick={() => void copy()}>
        {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Đã sao chép' : 'Sao chép prompt'}
      </button>
    </div>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6">{text}</pre>
    {error && <p role="status" className="text-[var(--color-error)]">Chưa sao chép được. Bạn có thể chọn nội dung prompt phía trên để sao chép thủ công.</p>}
  </section>;
}

export function ImportGuide({ onDownload }: { onDownload: (format: 'json' | 'csv' | 'txt') => void }) {
  return <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-[var(--color-accent)]">Hướng dẫn import: 2 prompt và JSON mẫu</summary>
    <div className="mt-4 space-y-6 text-sm leading-relaxed">
      <PromptSection title="1. Prompt HTML/CSS" text={formattingPrompt} />
      <PromptSection title="2. Prompt cấu trúc file" text={structurePrompt} />
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">3. JSON mẫu</h4>
          <button type="button" className="study-button" onClick={() => onDownload('json')}><Download size={16} /> Tải JSON mẫu</button>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[var(--color-surface-alt)] p-3 text-xs leading-6"><code>{JSON.stringify(guideExample, null, 2)}</code></pre>
      </section>
    </div>
  </details>;
}
