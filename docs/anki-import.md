# Import bộ thẻ

SỔ NHẬT đọc cùng một schema từ JSON, TXT, CSV, TSV, XLSX và XLS. File tối đa 20 MB và 20.000 thẻ.

## Các trường

| Trường | Bắt buộc | Nội dung |
| --- | --- | --- |
| `front` | Có | Mặt trước |
| `back` | Có | Mặt sau |
| `reading` | Không | Cách đọc mặt trước |
| `back_reading` | Không | Cách đọc mặt sau |
| `han_viet` | Không | Âm Hán Việt |
| `note` | Không | Ghi chú |
| `type` | Không | `VOCABULARY`, `KANJI`, `GRAMMAR` hoặc `GENERAL` |
| `tags` | Không | Danh sách nhãn; với file bảng có thể ngăn bằng dấu phẩy hoặc chấm phẩy |
| `examples` | Không | Mảng JSON gồm `japanese`, `meaning` và `reading` tùy chọn |

Tên cột cũ như `hanViet`, `notes`, `kind`, `hiragana`, `phien_am` vẫn được nhận diện.

## Furigana ở hai mặt

Người dùng cung cấp cách đọc; ứng dụng không dùng từ điển hoặc AI để đoán. Có hai cách nhập:

```json
{
  "front": "勉強する",
  "reading": "べんきょうする",
  "back": "日本語を勉強する",
  "back_reading": "にほんごをべんきょうする"
}
```

Khi một câu có nhiều cụm Kanji hoặc cần ghép chính xác, dùng cú pháp `Kanji[hiragana]` trực tiếp ở một trong hai mặt:

```json
{
  "front": "学校[がっこう]へ行[い]く",
  "back": "Đi đến 学校[がっこう]"
}
```

Ứng dụng lưu phần chữ sạch trong `front`/`back` và lưu các đoạn furigana có cấu trúc trong `extraData`. Cú pháp mơ hồ hoặc thiếu ngoặc tạo cảnh báo trong preview nhưng không làm mất thẻ.

## TXT, CSV, TSV và Excel

- Có tiêu đề: đặt tên cột theo bảng schema. Hệ thống tự ánh xạ và cho phép kiểm tra lại trong phần nâng cao.
- Không có tiêu đề: cột 1 là `front`, cột 2 là `back`, cột 3 là `reading`.
- TXT hỗ trợ chỉ thị Anki `#separator:Tab`, `#separator:comma` và `#separator:semicolon`.
- Dấu phân cách, dấu nháy kép và nội dung nhiều dòng trong ô được giữ theo quy tắc CSV.
- `examples` trong một ô bảng phải là một chuỗi JSON hợp lệ.

Mọi định dạng đều được đưa qua cùng bước chuẩn hóa, kiểm tra trường, loại thẻ, trùng lặp và furigana trước khi tạo bộ.

## Prompt tạo dữ liệu

```text
Hãy chuyển nội dung tôi cung cấp thành dữ liệu import bộ thẻ cho ứng dụng SỔ NHẬT.

Yêu cầu:
- Trả về duy nhất một mảng JSON hợp lệ, không thêm Markdown hay lời giải thích.
- Mỗi thẻ có: front, back, reading, back_reading, han_viet, note, type, tags.
- front và back bắt buộc. Các trường còn lại có thể là chuỗi rỗng; tags là mảng chuỗi.
- type chỉ dùng một trong: VOCABULARY, KANJI, GRAMMAR, GENERAL.
- Khi có Kanji, ghi furigana chính xác theo dạng 学校[がっこう]. Có thể dùng ở cả front và back.
- Không tự đoán cách đọc khi không chắc; để reading hoặc back_reading trống để tôi bổ sung.
- Giữ nguyên xuống dòng cần thiết trong back bằng ký tự \n.

Nội dung cần chuyển:
[DÁN NỘI DUNG CỦA BẠN VÀO ĐÂY]
```

Prompt này cũng có sẵn trong giao diện ở **Tạo bộ mới → Hướng dẫn import và prompt tạo file** cùng nút sao chép và file mẫu.

## Lưu, quản lý và học

- Khách có thể đọc file, đổi mapping và xem preview tại máy. Đăng nhập chỉ bắt buộc khi lưu bộ thẻ lên tài khoản.
- Preview hiển thị tối đa 10 mẫu, tổng số hợp lệ, số dòng bỏ qua, cảnh báo furigana và lý do theo dòng/sheet.
- Server tạo bộ và thẻ trong một transaction. Khóa idempotency giữ nguyên khi thử lại cùng bản nháp để tránh tạo hai bộ sau lỗi mạng.
- Sửa nội dung thẻ giữ nguyên card ID và lịch SRS. Trong phiên học, khối sửa nội dung chỉ xuất hiện với bộ import; bộ tích hợp vẫn chỉ đọc và bộ thủ công tiếp tục sửa trong màn hình quản lý.
- Template lưu riêng kiểu của hai mặt: font, cỡ chữ 12–72 px, in đậm, in nghiêng, căn chữ và chủ đề. Nút **Áp dụng kiểu này cho cả hai mặt** sao chép kiểu hiện tại một lần.
