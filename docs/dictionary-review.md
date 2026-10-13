# Rà soát tính đầy đủ và lỗi — 13/10/2026

## Kết luận phạm vi

Luồng MVP đã có: tra công khai → chọn đúng từ/nghĩa → đăng nhập nếu cần → chọn/tạo deck → chỉnh nội dung → thêm → mở/học thẻ; có chống trùng và retry. **Chưa hoàn thành toàn bộ plan từ điển Nhật–Việt.**

Các phần còn thiếu theo giai đoạn: corpus nghĩa Việt được phép sử dụng/đã duyệt; nhận dạng nét viết; KANJIDIC2/Unihan và trang Kanji/hoạt ảnh nét; yêu thích/lịch sử đồng bộ; Tatoeba; khử chia nhiều lớp và sửa lỗi gõ. MVP không hiển thị nút vẽ chưa hoạt động.

## Lỗi tìm thấy và đã sửa

1. Phân trang chặn offset >200 trong khi tập ứng viên có 250, làm mất các kết quả cuối. Đã cho phép duyệt hết 250 và kiểm tra cursor đúng bước trang; test đủ giới hạn 1/20/50 và không trùng mục từ.
2. Kết quả tra nghĩa/cách đọc phụ dùng mặc định sense đầu, dễ thêm sai nghĩa. Backend trả sense khớp, frontend ưu tiên cách viết/cách đọc/sense của kết quả và mang lựa chọn đó vào dialog. Tra romaji/kana vẫn ưu tiên cách viết Kanji của từ khi hợp lệ, không thay mặt trước bằng kana chỉ vì khớp cách đọc.
3. Tìm nghĩa nhiều token có thể ghép token thuộc các sense không liên quan. Đã buộc các token cùng thuộc một sense.
4. Khử chia chỉ kiểm tra POS ở toàn entry, có thể mượn từ loại của một cách viết khác. Đã gắn kiểm tra POS với hạn chế cách viết/cách đọc của sense đó.
5. Dataset bị dọn làm bản nháp cũ trả 409 liên tục. Đã thêm mã lỗi phân biệt; cho tải nghĩa mới và giữ nội dung chỉnh sửa. Nếu sense thay đổi, người dùng phải kiểm tra lại trước khi lưu.
6. Cursor cũ khi catalog đổi cần người dùng tự thử lại. Đã tự tải lại từ trang đầu và báo rõ, tránh nối hai version.
7. Draft trong sessionStorage sai cấu trúc hoặc cách đọc không còn hợp lệ có thể làm lỗi dialog. Đã kiểm tra timestamp, trường, giới hạn, source selection và key trước khi khôi phục; bỏ draft không hợp lệ.
8. Khôi phục draft có thể ghi đè deck đã chọn trước khi metadata tải xong. Đã giữ lựa chọn trong lúc xác minh và chặn lưu trước khi hoàn tất.
9. Lọc sense chính xác làm tăng xử lý lặp trên các truy vấn phổ biến. Đã dùng pattern chuẩn hóa tái sử dụng và cache dữ liệu công khai có khóa version, TTL 60 giây, tối đa 32 truy vấn/ước lượng 16 MB; gom các request cùng truy vấn đang tải. Lỗi và dữ liệu tài khoản không được cache; giới hạn này không thay thế rate limit ở gateway.

## Việc vận hành còn phải chốt khi đưa lên web

- Deploy backend/schema V11, nhập corpus vào database thật rồi mới mở frontend. Database đã dùng kiểm thử là database tạm riêng, không phải production.
- Snapshot hiện khoảng 1,05 GiB MySQL; dự trù staging + phiên bản rollback, theo dõi disk. Chưa có tác vụ dọn version/request tự động; giữ vô hạn sẽ làm dung lượng tăng theo lần cập nhật.
- Lịch cập nhật ít nhất hàng tháng và cảnh báo import thất bại/chậm cập nhật cần cấu hình trên máy vận hành. Script nhập/rollback đã có; chưa cài scheduler của hệ điều hành.
- Public API cần rate limit ở gateway/reverse proxy nơi triển khai. Cấu hình Nginx hiện có chưa bật limit cho từ điển; nếu bỏ qua, bot có thể tạo nhiều truy vấn dù mỗi request đã có giới hạn. Không tin X-Forwarded-For từ client nếu chưa cấu hình proxy đáng tin.
- Chạy benchmark trên host triển khai và kiểm tra CSP/CORS với URL API thật. Số đo localhost không phải đảm bảo mạng production.

Không có kiểm thử hữu hạn nào chứng minh không còn lỗi. Các ca đã chạy và bằng chứng được cập nhật trong `dictionary-verification.md`; cần giữ theo dõi lỗi khi phát hành.
