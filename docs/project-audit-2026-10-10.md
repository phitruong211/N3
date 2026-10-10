# Rà soát dự án — 10/10/2026

## Đã xử lý trong vòng này

- Tách hoàn toàn Học tự do (`/decks`) và Ôn ngắt quãng (`/review`) ở route, sidebar, dashboard, danh sách bộ và phiên học.
- Thay scheduler cố định bằng FSRS-6, thêm hàng đợi sống trong phiên và cho thẻ Quên quay lại đúng thời gian cấu hình.
- Đồng bộ đủ trạng thái lịch ôn cho nội dung có sẵn và bộ cá nhân; thêm khóa retry để tránh ghi hai lần.
- Chuẩn hóa bốn số theo từng bộ ở trang ôn: Cần ôn, Chưa nhớ, Hôm nay, Còn lại.
- Giữ giới hạn 20 thẻ mới theo ngày kể cả khi thẻ mới đã tốt nghiệp khỏi bước học ngắn.
- Thêm phần cài đặt thời gian học lại và retention; loại giới hạn thời gian phiên khỏi luồng ôn mới.
- Xác nhận CORS backend cho phép `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Chuyển test khởi động backend sang H2 để bộ test không phụ thuộc MySQL đang chạy trên máy.

## Kết quả rà soát phần còn lại

- Router đang lazy-load các khu lớn; màn hình đăng nhập vẫn là cổng vào, nút Học thử mở ứng dụng ở chế độ Guest và đăng nhập/đăng ký thành công quay về trang Hôm nay.
- Sidebar có một mục cho mỗi mô hình sử dụng; Bộ thẻ và Ôn ngắt quãng không còn là hai nút đổi chế độ trên cùng card.
- Dashboard đã có một hành động chính theo trạng thái hôm nay, tiến độ mục tiêu, chuỗi ngày và các lối vào thư viện. Không còn khối điều khiển SRS chi tiết trên dashboard.
- Import dùng cùng pipeline chuẩn hóa cho JSON, TXT, CSV, TSV, XLSX và XLS; test bao phủ alias, furigana, nhiều sheet, mapping, trùng và file lỗi.
- Các màn hình cũ `SRSPage` và phần Anki cũ trong `FlashcardPage` vẫn được giữ làm lớp tương thích mã nguồn nhưng không còn được route mới gọi. Việc xóa chúng nên thực hiện ở một đợt dọn mã riêng để không làm tăng rủi ro hồi quy cho dữ liệu cũ.

## Giới hạn kiểm chứng

- Build và test tự động đã chạy local. Migration V7 được đối chiếu với entity và cú pháp MySQL hiện tại nhưng chưa chạy trên bản sao cơ sở dữ liệu production.
- Cần kiểm tra một vòng smoke test sau deploy với tài khoản thật: chấm Quên, tải lại trang, đợi đúng số phút và xác nhận thẻ quay lại; sau đó đăng nhập ở trình duyệt thứ hai để xác nhận cùng lịch.
