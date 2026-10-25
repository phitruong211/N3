// Prompts for AI-assisted authoring, generated from the schema so they cannot drift from what the importer accepts.
import { CARD_MARKUP_TAGS, CARD_STYLE_DOC } from './cardFormatting.ts';
import { FORMAT_NAME, FORMAT_VERSION, LIMITS, type DeckFile, type NoteField, type NoteType } from './deckFormat.ts';

const TYPE_HELP: Record<NoteField['type'], string> = {
  text: 'văn bản, được dùng HTML định dạng',
  ruby: 'văn bản; viết furigana trực tiếp dạng 学校[がっこう], được dùng HTML định dạng',
  kana: 'cách đọc thuần kana, không HTML, không Kanji',
  examples: 'mảng đối tượng {"japanese","reading","meaning"}; reading có thể là ""',
};
const SAMPLE: Record<string, unknown> = {
  front: '勉強[べんきょう]する', frontReading: 'べんきょうする', back: 'học, học tập', backReading: '', hanViet: 'Miễn Cường', notes: 'Động từ nhóm 3',
  examples: [{ japanese: '毎日日本語を勉強します。', reading: 'まいにちにほんごをべんきょうします。', meaning: 'Mỗi ngày tôi học tiếng Nhật.' }],
};
const sampleFor = (field: NoteField): unknown => SAMPLE[field.key] ?? (field.type === 'examples' ? [] : field.type === 'kana' ? 'れい' : `Nội dung ${field.label.toLowerCase()}`);

/** A complete valid file with one card, for download and for the prompt. */
export function exampleDeckFile(type: NoteType): DeckFile {
  const fields = Object.fromEntries(type.fields.map(field => [field.key, sampleFor(field)]));
  return { format: FORMAT_NAME, version: FORMAT_VERSION, deck: { name: 'Tên bộ thẻ', noteTypes: [type] }, cards: [{ type: type.id, fields: fields as DeckFile['cards'][number]['fields'], tags: ['ví dụ'] }] };
}

export function buildStructurePrompt(type: NoteType): string {
  const faces = (key: string) => [type.front.show.includes(key) ? 'mặt trước' : '', type.back.show.includes(key) ? 'mặt sau' : ''].filter(Boolean).join(' + ') || 'không hiện';
  const lines = type.fields.map(field => `- ${field.key} — ${field.label} (${field.type}${field.required ? ', bắt buộc' : ', tùy chọn'}; ${TYPE_HELP[field.type]}; hiện ở ${faces(field.key)})`);
  return `Chuyển nội dung bên dưới thành một tệp JSON hợp lệ theo định dạng "${FORMAT_NAME}" version ${FORMAT_VERSION} để nhập vào SỔ NHẬT. Chỉ trả về JSON, không thêm Markdown hay lời giải thích.

Cấu trúc tệp:
- Gốc: {"format":"${FORMAT_NAME}","version":${FORMAT_VERSION},"deck":{"name":"...","noteTypes":[...]},"cards":[...]}.
- deck.name: tên bộ thẻ (tối đa 200 ký tự). deck.noteTypes: giữ nguyên loại thẻ "${type.name}" ở mục "Ví dụ" bên dưới, không đổi key.
- Mỗi thẻ: {"type":"${type.id}","fields":{...},"tags":["..."]}. tags là mảng chuỗi (tối đa ${LIMITS.tags} nhãn), có thể bỏ.

Các trường của loại thẻ "${type.name}" (type: "${type.id}"):
${lines.join('\n')}

Quy tắc:
- Chỉ dùng các key trường ở trên. Trường tùy chọn không có nội dung thì bỏ hẳn, không điền "N/A".
- Không bịa thông tin hoặc lược bỏ kiến thức. Không tự đoán cách đọc khi chưa chắc; để trống.
- Tối đa ${LIMITS.cards.toLocaleString('vi-VN')} thẻ; mỗi trường văn bản tối đa ${LIMITS.text.toLocaleString('vi-VN')} ký tự.
- Escape dấu nháy kép và xuống dòng đúng chuẩn chuỗi JSON. Lưu thành tệp .sonhat.json mã hóa UTF-8.

Ví dụ:
${JSON.stringify(exampleDeckFile(type), null, 2)}

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]`;
}

export function buildFormattingPrompt(): string {
  const css = CARD_STYLE_DOC.map(rule => `  - ${rule.property}: ${rule.values}`).join('\n');
  return `Hãy định dạng nội dung tệp JSON .sonhat.json bên dưới bằng HTML và CSS nội tuyến để dễ học trên SỔ NHẬT. Chỉ trả về JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Giữ nguyên số thẻ, cấu trúc, key trường, nội dung kiến thức và cách đọc. Chỉ thay đổi định dạng trong các trường text và ruby, và trong japanese/meaning của examples nếu cần. Không thêm HTML vào trường kana (reading) hay vào key.
- Thẻ HTML được phép: ${CARD_MARKUP_TAGS.map(tag => `<${tag}>`).join(' ')}.
- CSS chỉ đặt trong thuộc tính style, và chỉ các thuộc tính sau:
${css}
- Ví dụ: <p style="${CARD_STYLE_DOC[0].property}:${CARD_STYLE_DOC[0].example};font-size:24px;font-weight:700">CÔNG THỨC</p>
- Ưu tiên nội dung căn trái, đoạn ngắn, tiêu đề đậm và màu nhấn vừa đủ; chọn màu đọc được trên cả nền sáng và tối.
- Không dùng script, event handler, class, khối <style>, file CSS, font ngoài hoặc ảnh.
- Giữ nguyên cú pháp 学校[がっこう] trong cùng một đoạn chữ; không tách Kanji và phần đọc bằng thẻ HTML.
- Escape dấu nháy kép của HTML đúng chuẩn chuỗi JSON.

Tệp cần định dạng:
[DÁN JSON CỦA BẠN VÀO ĐÂY]`;
}
