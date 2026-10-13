# Chia sẻ bộ thẻ tự import

Trong Bộ thẻ hoặc Ôn ngắt quãng, mở menu của bộ import → **Chia sẻ bộ thẻ** → **Tạo liên kết chia sẻ** → **Sao chép liên kết**. Trong màn quản lý bộ cũng có nút **Chia sẻ**. Trên thiết bị hỗ trợ, **Gửi liên kết** mở bảng chia sẻ của hệ điều hành.

Người nhận mở `/shared/:token` để xem tên bộ, người chia sẻ, số thẻ và một nửa số thẻ (làm tròn lên), chia trang 50 thẻ trước khi đăng nhập. Đăng nhập/đăng ký giữ nguyên trang; bấm **Lưu vào bộ thẻ của tôi** để nhận bản riêng, rồi **Mở bộ thẻ để học**. Bản sao giữ nội dung, ghi chú, dữ liệu bổ sung, nhãn và cấu hình trình bày. Không sao chép tiến độ, lịch ôn, nhóm, ID thẻ hoặc đường dẫn tệp nguồn của chủ bộ.

Liên kết không được liệt kê công khai. Ai có liên kết đều có thể xem trước và lưu toàn bộ nội dung; hộp chia sẻ thông báo điều này trước khi bật. Tên hiển thị của chủ bộ được hiển thị, email và thông tin tài khoản không được trả về. Không tự bật chia sẻ khi mở hộp thoại. **Ngừng chia sẻ** thu hồi liên kết; bật lại tạo token mới. Xóa bộ nguồn cũng vô hiệu hóa liên kết. Bản người nhận đã lưu vẫn độc lập và không tự cập nhật.

Lưu lại cùng nguồn trả về bản đã có, kể cả qua liên kết mới. Nếu người nhận đã xóa bản cũ, họ có thể lưu lại. Backend khóa đọc bộ nguồn khi sao chép và khóa tài khoản nhận để chống tạo trùng khi có request đồng thời. Xem trước không tải toàn bộ bộ thẻ, không trả tiến độ hoặc ghi chú, và dùng `Cache-Control: no-store`.

## API

Trang liên kết mặc định mở **Học thử**: lật thẻ để xem nghĩa, chuyển thẻ bằng nút, phím mũi tên hoặc vuốt trên điện thoại; Space/Enter để lật. Ô **Số thẻ** cho phép đến trực tiếp thẻ bất kỳ trong nửa bộ được xem trước. **Danh sách** hiển thị từ, cách đọc và nghĩa theo từng trang; bấm một từ để mở thẻ tương ứng. Chuyển chế độ giữ vị trí đang xem. Học thử không ghi tiến độ hoặc lịch ôn.

- `GET /api/v1/decks/{id}/share`: trạng thái, chỉ chủ bộ.
- `PUT /api/v1/decks/{id}/share`: tạo/giữ liên kết, chỉ chủ bộ import.
- `DELETE /api/v1/decks/{id}/share`: thu hồi liên kết, trả 204.
- `GET /api/v1/shared-decks/{token}?page=0`: xem trước công khai, 50 thẻ/trang, giới hạn nửa đầu bộ thẻ tại server.
- `POST /api/v1/shared-decks/{token}/copy`: cần đăng nhập; trả `deckId`, `alreadySaved`.

## Kiểm thử và triển khai

- Frontend: `npm test`, `npm run build`, `npm run lint`, `npm run test:sharing` (Playwright, fixture API; tự mở Vite ở cổng trống).
- Nếu dùng Edge có sẵn thay Chromium của Playwright trên Windows: `$env:PLAYWRIGHT_CHANNEL='msedge'; npm run test:sharing`.
- Backend: Java 21, `mvnw.cmd test`; `DeckShareIntegrationTest` kiểm tra quyền, xem trước giới hạn, bản sao độc lập, thu hồi, xóa và request đồng thời bằng H2.
- Có thể chạy riêng bộ test chia sẻ với MySQL thử nghiệm: `mvnw.cmd test -Dtest=DeckShareIntegrationTest -Dsharing.mysql.url=jdbc:mysql://127.0.0.1:13307/deck_share_verification`. Chỉ dùng database thử nghiệm riêng; test tạo dữ liệu và chạy Flyway. Có thể đặt thêm `sharing.mysql.username` và `sharing.mysql.password` theo cấu hình máy thử.
- Đã kiểm tra migration V1–V10 trên MySQL 8.0.44 với isolation mặc định `REPEATABLE READ`. Tra cứu bản đã lưu dùng khóa để thấy request vừa commit, kể cả khi request hiện tại đã đọc snapshot cũ.
- Deploy backend trước để Flyway chạy **V10__deck_sharing.sql**, rồi deploy frontend. Host frontend cần SPA fallback cho `/shared/*` như các route hiện có. Chưa triển khai lên production trong thay đổi này.
