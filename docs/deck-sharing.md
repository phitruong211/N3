# Chia sẻ bộ thẻ và nhóm

Chia sẻ hỗ trợ **deck import**, riêng lẻ hoặc cả nhóm. Trong menu ⋯ của deck chọn **Chia sẻ bộ thẻ**; trong menu nhóm chọn **Chia sẻ nhóm**. Hộp thoại cho biết số bộ import/số thẻ và số bộ tạo thủ công không được chia sẻ. Nhóm chưa có bộ import sẽ không tạo được link.

Mở hộp thoại chỉ đọc trạng thái. Bấm **Tạo liên kết** để bật, **Sao chép** để gửi; thiết bị hỗ trợ có **Gửi liên kết** mở bảng chia sẻ hệ điều hành. **Tùy chọn chia sẻ** chứa giải thích chi tiết và **Ngừng chia sẻ** có xác nhận. Bật lại sau thu hồi tạo token mới. Link nhóm và từng deck độc lập; bật nhóm không tự bật link từng deck.

## Trang nhận tối giản

- Link deck: `/shared/:token`; link nhóm: `/shared/groups/:token`.
- Người nhận xem ngay không cần đăng nhập. Link nhóm hiển thị tối đa 20 deck/trang; bấm một deck mới tải thẻ học thử bằng token nhóm, không dùng token riêng của deck.
- Mỗi deck được xem nửa đầu số thẻ, làm tròn lên, 50 thẻ/trang; server thực thi giới hạn. Bấm thẻ/Space/Enter để lật, ←/→ hoặc vuốt để chuyển; hàng điều hướng gồm Trước · số thẻ · Tiếp. Bấm số thẻ để nhảy. Chuyển Học thử/Danh sách giữ vị trí. Học thử không ghi tiến độ.
- Nút **Lưu bộ thẻ/Lưu cả nhóm** ở phần đầu trên desktop và thanh đáy trên điện thoại. Khách bấm lưu mở đăng nhập tại chỗ; đăng nhập thành công tự tiếp tục ý định lưu. Hủy đăng nhập không lưu. Chỉ đăng nhập mà không bấm lưu cũng không tự nhận nội dung.
- Thành công đổi thành **Mở bộ để học/Mở nhóm để học**, dẫn đúng nội dung trong thư viện (`?deck=...` / `?group=...`). Lỗi có thể thử lại đúng thao tác; link đã thu hồi không còn nút lưu.

## Nội dung và tính độc lập

Ai có link đều có thể xem trước và nhận toàn bộ nội dung được chia sẻ. Public API không trả email, tiến độ, ghi chú, metadata tệp hoặc token riêng của deck; có no-store/noindex. Chỉ tên hiển thị chủ bộ/nhóm được trả về.

Khi lưu, sao chép nội dung, ghi chú, tags, dữ liệu bổ sung, giao diện và attribution từ điển. Bản nhận có ID mới, PRIVATE, không mang tiến độ/lịch ôn/đường dẫn tệp nguồn. Link phản ánh nội dung hiện tại; bản đã lưu độc lập và không tự cập nhật.

Nhận nhóm là một transaction: tạo nhóm riêng và các deck IMPORT theo thứ tự nguồn, bỏ MANUAL. Không di chuyển hoặc ghi đè bản deck người nhận đã có từ link riêng. Nhấn lại/retry trả về bản nhóm đang có, không tự phục hồi deck người nhận đã xóa/chuyển đi. Nếu giải tán bản nhóm, lần nhận tiếp tạo nhóm và bản deck mới; deck cũ vẫn ở vị trí người nhận đã đặt.

Giới hạn một lần nhận nhóm: 100 bộ import và 20.000 thẻ tổng cộng. Server kiểm tra trước khi tải toàn nội dung; vượt giới hạn không để lại bản nhận dở dang. Khóa tài khoản theo thứ tự cố định phối hợp sửa nhóm/chia sẻ để chống trùng, snapshot cũ và deadlock khi hai người nhận nhóm của nhau.

Thu hồi/xóa deck nguồn vô hiệu hóa link deck; thu hồi/giải tán nhóm nguồn vô hiệu hóa link nhóm. Deck rời nhóm không còn xem được qua token nhóm. Bản người nhận đã lưu vẫn giữ nguyên.

## API

Deck (tương thích link cũ):
- `GET/PUT/DELETE /api/v1/decks/{id}/share`
- `GET /api/v1/shared-decks/{token}?page=0`
- `POST /api/v1/shared-decks/{token}/copy` → `{deckId, alreadySaved}`

Nhóm:
- `GET/PUT /api/v1/deck-groups/{id}/share` → `{token, deckCount, excludedDeckCount, cardCount}`; DELETE trả 204.
- `GET /api/v1/shared-deck-groups/{token}?page=0` → metadata, counts và danh sách IMPORT, 20 bộ/trang.
- `GET /api/v1/shared-deck-groups/{token}/decks/{deckId}?page=0` → preview deck giới hạn nửa bộ; kiểm tra membership mỗi request.
- `POST /api/v1/shared-deck-groups/{token}/copy` → `{groupId, deckIds, alreadySaved}`.

Chỉ GET preview được public; API quản lý token chỉ chủ bộ/nhóm, API copy cần đăng nhập.

## Kiểm chứng và triển khai

- Frontend: `npm test`, `npm run build`, lint file thay đổi, `npm run test:sharing`, `npm run test:deck-groups`. Kiểm thử API/browser thật: `npm run test:sharing:integration` với API thử riêng tại `SHARING_API_ORIGIN` (mặc định http://127.0.0.1:18081), Vite15176 và CORS tương ứng.
- Backend Java 21: `bash mvnw -q test`; H2 có test chia sẻ deck/nhóm, quyền, thứ tự/bảo toàn nội dung, rollback giới hạn, thu hồi, snapshot/concurrency và tiến độ riêng.
- MySQL thử riêng: `bash mvnw -q test -Dtest=DeckShareIntegrationTest,DeckGroupShareIntegrationTest -Dsharing.mysql.url='jdbc:mysql://127.0.0.1:33317/group_share_test?useSSL=false&allowPublicKeyRetrieval=true' -Dsharing.mysql.username=root -Dsharing.mysql.password=`. Chỉ dùng database thử riêng: test tạo dữ liệu và chạy Flyway.
- Deploy backend trước để Flyway chạy V12__deck_group_sharing.sql (bao gồm V10/V11 nếu chưa có), rồi frontend. Host frontend cần SPA fallback `/shared/*`.
- Chưa xác nhận triển khai production trong lần thay đổi này.
