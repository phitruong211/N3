# Định dạng thẻ khi import

JSON, CSV, TSV và TXT có thể chứa HTML trong các trường mặt trước, mặt sau và ghi chú. Ứng dụng tự nhận diện các thẻ HTML được hỗ trợ. Nội dung thuần văn bản tiếp tục hiển thị bình thường; xuống dòng bằng `\n` trong JSON vẫn dùng được.

Tải file mẫu cùng thư mục: `import-formatting-sample.json`. Import file, chọn trường mặt trước/mặt sau, kiểm tra xem trước rồi lưu. Định dạng được lưu trong nội dung thẻ, dùng khi học tự do, ôn tập ngắt quãng và khi chia sẻ thẻ. Có thể sửa mã trong ô nội dung của phần Tùy chỉnh.

## Ví dụ JSON

```json
[
  {
    "front": "<b style=\"color:#60a5fa\">Whereas / While</b>",
    "back": "<div style=\"text-align:left\"><p><b>Ý NGHĨA:</b> Trong khi</p><p style=\"padding-left:24px;font-size:20px\">S + V, whereas + S + V.</p></div>",
    "type": "GENERAL"
  }
]
```

Trong chuỗi JSON, dấu nháy kép của HTML phải viết thành `\"`. Trong CSV, đặt ô có HTML trong dấu nháy kép và nhân đôi dấu nháy kép bên trong. Trong TSV, mỗi trường cách nhau bằng tab; tránh tab chưa được trích dẫn trong nội dung.

## Các định dạng được hỗ trợ

| Nhu cầu | Cách viết |
| --- | --- |
| Đậm / nghiêng / gạch chân / gạch ngang | `<b>...</b>`, `<i>...</i>`, `<u>...</u>`, `<s>...</s>` |
| Xuống dòng / đoạn văn | `<br>`, `<p>...</p>` |
| Màu chữ | `<span style="color:#60a5fa">...</span>` |
| Tô nền | `<span style="background-color:#fef08a;color:#1c1917">...</span>` |
| Cỡ chữ | `<span style="font-size:24px">...</span>` |
| Độ đậm | `<span style="font-weight:300">...</span>`; dùng 100–900 theo bước 100, hoặc normal/bold |
| Thụt cả đoạn | `<p style="padding-left:24px">...</p>` |
| Thụt dòng đầu | `<p style="text-indent:24px">...</p>` |
| Căn chữ | `<div style="text-align:left">...</div>`; hỗ trợ left/right/center/justify/start/end |
| Giãn dòng, cách đoạn | `line-height:1.6`, `margin-top:12px`, `margin-bottom:16px` |
| Danh sách | `<ul><li>...</li></ul>` hoặc `<ol><li>...</li></ol>` |
| Tiêu đề / trích dẫn / mã | `<h1>`–`<h6>`, `<blockquote>`, `<pre>`, `<code>` |
| Furigana | `<span style="color:#60a5fa">学校[がっこう]</span>` hoặc `<ruby>学校<rt>がっこう</rt></ruby>` |

Cỡ chữ hỗ trợ 12–72px, 0.5–2em/rem hoặc 50–200%. Khoảng cách hỗ trợ 0–64px, 0–4em/rem hoặc 0–15%. Giãn dòng nhận số từ 1 đến 2. Màu hỗ trợ mã hex, rgb/rgba, hsl/hsla và một số tên màu thông dụng. Độ đậm còn phụ thuộc font có sẵn.

Nếu dùng trường Cách đọc cùng HTML, cách đọc sẽ xuất hiện riêng dưới nội dung. Muốn ruby nằm đúng từng từ, đặt `Kanji[hiragana]` trong cùng một đoạn chữ; đừng tách Kanji và ngoặc đọc bằng thẻ HTML. Nút ẩn cách đọc cũng ẩn ruby.

## Lưu ý

- Kiểu nội tuyến trong file được ưu tiên cho từng đoạn; các đoạn còn lại kế thừa kiểu chung trong Tùy chỉnh. Muốn kiểu chung áp dụng toàn bộ, xóa thuộc tính `style` tương ứng trong nội dung.
- Kiểm tra màu trên cả nền sáng và tối. Tránh màu trắng/đen cố định nếu bộ thẻ dùng nhiều chủ đề.
- Chỉ hỗ trợ CSS nội tuyến trong `style`. CSS qua class, khối `<style>`, file CSS riêng, font ngoài, ảnh và JavaScript chưa được hỗ trợ. Định dạng không được hỗ trợ sẽ bị bỏ khi hiển thị; nội dung gốc vẫn được lưu.
- Excel hiện lấy nội dung ô, không lấy màu/font của ô. Có thể viết HTML ngay trong giá trị ô Excel để hiển thị theo cơ chế này.
- Đây là định dạng nội dung thẻ; ghi chú cá nhân vẫn là văn bản thuần.
- File `.apkg` và template Anki đầy đủ chưa được hỗ trợ. Với TXT/CSV xuất từ Anki, cần xuất kèm HTML trong trường; CSS của template không tự đi theo file.
