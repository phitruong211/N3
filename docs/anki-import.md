# Nhập và học bộ thẻ

Trong **Thẻ học** hoặc **Anki**, đến **Bộ thẻ của bạn**. Hai hành động chính là **Tạo bộ thủ công** và **Import**. Nút **! — Quy tắc nhập tệp** mở hướng dẫn và mẫu CSV/JSON.

- Hỗ trợ TXT, CSV, TSV, JSON, XLSX và XLS; tối đa 20 MB / 20.000 dòng thẻ.
- Guest có thể đọc file, đổi mapping và xem preview tại máy. Đăng nhập chỉ bắt buộc khi xác nhận tạo; bản nháp giữ trong phiên trang, không giữ sau tải lại/đóng trang.
- Chọn sheet Excel, bật/tắt header và kiểm tra mapping mặt trước/mặt sau. Cột ngoài schema chỉ được lưu khi chọn rõ trong preview.
- Preview hiển thị tối đa 10 mẫu cùng tổng số hợp lệ, số bị bỏ và lý do theo dòng/sheet. Cặp mặt trước/mặt sau trùng sau chuẩn hóa Unicode/khoảng trắng giữ lần đầu; hai đáp án khác nhau không bị gộp.
- `reading`, `note/notes`, `type/kind`, `tags` là tùy chọn. Tên file và sheet lưu thành metadata, không thay ghi chú.
- Sau xác nhận, server tạo deck/card trong một transaction. Khóa idempotency giữ nguyên khi thử lại cùng bản nháp, tránh tạo hai bộ sau lỗi mạng. Thay nội dung bản nháp là một yêu cầu mới.
- Bộ cá nhân và lịch Anki lưu qua REST API vào MySQL theo tài khoản; không dùng IndexedDB. Danh sách chỉ tải metadata phân trang; mở quản lý mới tải trang thẻ.

Ví dụ CSV:

```csv
front,back,reading,note,type,tags
猫,Con mèo,ねこ,Động vật,VOCABULARY,animal
```

Ví dụ JSON:

```json
[{"front":"猫","back":"Con mèo","reading":"ねこ","note":"Động vật","type":"VOCABULARY","tags":["animal"]}]
```

JSON cũng chấp nhận các mảng `cards/data/items/vocabulary/kanji/grammar`. CSV hỗ trợ dấu phân cách trong dấu ngoặc kép, dấu ngoặc kép thoát và ô nhiều dòng. TXT/TSV hỗ trợ tab; CSV hỗ trợ dấu phẩy/chấm phẩy.

Tạo thủ công cần tên và ít nhất một cặp mặt trước/mặt sau; chọn **Tạo bộ trống** nếu muốn thêm sau. Bộ trống có **Thêm thẻ**, chưa thể bắt đầu học. Quản lý cho phép tìm/lọc loại và trạng thái, sửa nội dung giữ lịch ôn, đổi tên, sắp xếp và di chuyển có xác nhận. Nguồn tích hợp chỉ đọc và bộ dấu trang ảo không có thao tác xóa/sửa nội dung.

Chế độ Thẻ học dùng khoảng thẻ, xáo trộn và hướng lật. Anki lấy thẻ đến hạn trước, sau đó thẻ mới, tối đa 200 mỗi phiên. Các nút 1–4 chỉ đánh giá sau khi lật. Chỉ thời gian tab hiện được tính vào tiến độ.
