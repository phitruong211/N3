# Nhập bộ thẻ Anki

Trong **Anki** hoặc **Ôn tập**, mở **Bộ thẻ Anki của bạn → Import file**.

- Hỗ trợ `.txt`, `.csv`, `.tsv`, `.json`, `.xlsx`, `.xls`, tối đa 20 MB và 20.000 thẻ mỗi file.
- Mỗi file tạo một thư mục riêng. Excel gộp các sheet, giữ tên sheet trong ghi chú.
- Xem trước số thẻ hợp lệ, số dòng thiếu nội dung và loại thẻ trước khi tạo thư mục.
- Nhận diện loại dựa trên tên trường: từ vựng, Kanji, ngữ pháp hoặc thẻ tổng hợp. Có thể sửa loại ở màn hình chỉnh sửa thẻ.
- Dữ liệu và lịch ôn lưu trong IndexedDB của trình duyệt đang dùng. Không đồng bộ sang trình duyệt hoặc máy khác.

## TXT, CSV, TSV và Excel

Hai cột bắt buộc là `front` / `back` (hoặc `Mặt trước` / `Mặt sau`, `từ` / `nghĩa`). Các cột tùy chọn: `reading`, `notes`, `kind`.

Nếu không có tiêu đề, thứ tự cột là mặt trước, mặt sau, cách đọc, ghi chú. TXT dùng tab, dấu phẩy hoặc chấm phẩy để phân cột. Đây là nhập dữ liệu có cấu trúc, không tự tạo câu hỏi từ đoạn văn tự do.

```text
front	back	reading
猫	Con mèo	ねこ
犬	Con chó	いぬ
```

## JSON

```json
[
  { "front": "猫", "back": "Con mèo", "reading": "ねこ", "kind": "vocabulary" },
  { "front": "山", "back": "Núi", "kind": "kanji" }
]
```

Cũng hỗ trợ mảng bên trong `cards`, `data`, `items`, `vocabulary`, `kanji`, `grammar` và các cấu trúc dữ liệu tiếng Nhật đang có trong ứng dụng. Các trường bổ sung được giữ trong ghi chú.

## Quản lý và học

Mở thư mục để đổi tên, tìm thẻ, sửa mặt trước/mặt sau/cách đọc/ghi chú/loại thẻ, hoặc xóa thẻ. Xóa thư mục sẽ xóa cả thẻ và lịch ôn trong thư mục đó sau bước xác nhận.

Chọn học tất cả hoặc chỉ học thẻ mới/đến hạn. Sau khi hiện đáp án, chọn Học lại / Khó / Nhớ / Dễ để lưu lịch ôn. Chỉnh sửa nội dung giữ lại lịch ôn hiện tại.

## Kiểm thử parser

Với Node 22.19 trở lên:

```sh
node --experimental-strip-types --test tests/ankiImport.test.mjs
```
