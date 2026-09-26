> Báo cáo lịch sử của giai đoạn Guest. Kết quả hoàn thiện P1/P2/P3 ngày 27/09/2026 xem [srs-verification.md](srs-verification.md); các giới hạn chưa có đồng bộ trong báo cáo dưới đây đã được thay thế.

# Luồng Guest — triển khai và kiểm chứng

Ngày kiểm chứng: 26/09/2026.

## Đã triển khai

- Trang chào có “Khám phá với tư cách khách”; vào Hôm nay không gọi API tài khoản.
- Guest dùng thư viện, tìm kiếm, flashcard/Anki tích hợp, SRS, quiz và nghe. Bộ cá nhân/settings API/review server chỉ gọi sau xác thực.
- Bookmark, SRS, hoạt động học, cài đặt, điều hướng và dữ liệu nghe dùng `guest:*` hoặc `user:<id>:*`. Storage instance giữ chủ thể cố định trong callback. Reset chỉ xóa namespace hiện tại.
- Token dùng `auth:*`; token cũ chuyển một lần. Session identity vô hiệu hóa phản hồi cũ sau logout/đổi tài khoản. Phiên đổi ở tab khác được khôi phục trước khi tiếp tục thao tác.
- Preview và tên bộ giữ trong bộ nhớ khi mở/hủy/hoàn tất xác thực. Đăng nhập không tự tạo bộ; người học xác nhận lại. Lỗi lưu giữ preview. Reload/đóng trang có thể cần chọn lại file, có thông báo trên preview.
- Guest chỉnh cài đặt cục bộ không gửi PATCH. Nhãn sidebar và cài đặt phân biệt Guest/tài khoản.
- Khi có tiến độ học thử, sau đăng nhập chỉ cung cấp “Giữ dữ liệu học thử trên thiết bị”; không gộp hay báo đã đồng bộ.

## Giới hạn có chủ đích

FR-GUEST-07/08 chưa triển khai vì chưa có API đồng bộ P3. TODO nằm ở bước xác thực trong `src/hooks/useAuth.tsx`. Dữ liệu học phiên bản cũ không có danh tính chủ sở hữu được giữ nguyên ở khóa cũ và có thông báo; không tự gán cho Guest hoặc tài khoản đầu tiên đăng nhập. Đây là migration riêng theo FR-GUEST-09.

Giữ parser, giao diện import hiện có và hợp đồng deck/card. Không bổ sung mapping, idempotency import hoặc phân trang thuộc mục 19–21. Retry sau lỗi kết nối không được xem là có bảo đảm chống trùng từ server.

## Kết quả tự động

- `npm test`: 28/28 đạt; gồm parser, SRS, refresh, namespace, legacy, reset, dữ liệu JSON lỗi, quota và phản hồi phiên cũ.
- `npm run build`: đạt.
- `npm run lint`: không có lỗi; còn cảnh báo Fast Refresh, escape regex và script skill. Không thay mã ngoài phạm vi chỉ để dọn cảnh báo.
- `npm run test:guest`: đạt trên Chromium headless, desktop 1280×800 và mobile 375×812. API tài khoản/deck được giả lập trong Playwright; không tạo tài khoản hay deck trên server thật.

Bài kiểm thử trình duyệt xác nhận học và đánh giá 10 thẻ Guest lưu trạng thái learning/10 phút, timestamp và tổng hoạt động 10 thẻ; không dùng `reps` để đếm bước learning vì thuật toán hiện tại chỉ tăng chỉ số đó khi tốt nghiệp/review. Không thay thuật toán SRS.

Backend không chạy tại `localhost:8080` trong lần kiểm chứng này. Chưa xác nhận integration Spring Boot/MySQL hoặc quyền sở hữu backend bằng bộ test frontend.

## Chạy lại

```sh
npm ci
npx playwright install chromium --only-shell
npm test
npm run build
npm run lint
```

Mở Vite bằng `npm run dev -- --host 127.0.0.1`, sau đó ở terminal khác chạy:

```sh
npm run test:guest
```

Biến tùy chọn: `GUEST_TEST_URL` để đổi URL Vite; `GUEST_TEST_OUTPUT` để đổi thư mục screenshot, mặc định `/tmp/n3-guest-verification`. Bài test dùng browser context mới, không đọc hồ sơ trình duyệt cá nhân.

## Kiểm tra thủ công với backend thật

1. **AC-GUEST-01:** cửa sổ riêng tư → Guest → tìm/lưu từ, học flashcard/SRS, quiz, nghe → reload. Bookmark vẫn còn; Network không có JWT hoặc request tài khoản từ luồng học thử.
2. **AC-GUEST-02:** Guest chọn file, sửa tên, xem preview → Tạo bộ → hủy đăng nhập. Preview/bookmark còn nguyên, không POST deck. Thử lại, đăng nhập/đăng ký; kiểm tra preview rồi xác nhận mới tạo bộ. Kiểm tra cả lỗi mật khẩu và lỗi lưu.
3. **AC-GUEST-03:** A lưu bookmark/tiến độ và có bộ cá nhân → logout → Guest giữ dữ liệu riêng → B đăng nhập. Không thấy dữ liệu A. Thử logout ở tab thứ hai. Không kỳ vọng chuyển Guest vào tài khoản khi P3 chưa có.
