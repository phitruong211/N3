# Ghi chú cá nhân trên thẻ

Trong thẻ học và ôn ngắt quãng, nút **Ghi chú** hoặc phím **N** mở ô nhập cho thẻ hiện tại. **Lưu ghi chú** / **Ctrl hoặc Cmd + Enter** lưu trên thiết bị trước rồi đồng bộ tài khoản. Đóng hoặc nhấn Escape giữ bản nháp. Ghi chú chỉ hiện ở mặt sau, có thể sửa, mở rộng hoặc xóa bằng cách lưu nội dung rỗng.

`CardView.note` / `ImportedCard.notes` tiếp tục là nội dung gốc của thẻ. Ghi chú cá nhân được lưu riêng, không phụ thuộc bookmark, lịch ôn hoặc template, nên vẫn hiển thị khi template ẩn trường notes. Guest lưu tại scope `guest`; tài khoản lưu tại `user:{id}`. Đăng nhập không tự nhận ghi chú Guest; mục tài khoản trong Cài đặt có nút chuyển và ưu tiên bản có sẵn trong tài khoản.

## Định danh

Mỗi dòng JSON có sẵn có `note_id` cố định. Giữ nguyên giá trị này khi sửa nội dung, đổi vị trí hoặc chuyển bộ; cấp UUID mới cho thẻ mới. Script `node scripts/assign-built-in-note-ids.mjs` chỉ cấp các ID còn thiếu và phát hiện trùng. Các ID tiến độ học cũ không thay đổi. Thẻ cá nhân dùng UUID của card, nên sửa nội dung hoặc chuyển nhóm không làm mất ghi chú.

Khóa API là SHA-256 của `BUILT_IN:{note_id}` hoặc `PERSONAL:{card UUID}`. Một fallback theo nội dung dành cho caller cũ, nhưng mọi bộ có sẵn hiện tại đều có note_id; test kiểm tra toàn bộ danh mục.

## Lưu và đồng bộ

- `GET /api/v1/card-notes/{key}` trả `{ key, text, version, updatedAt }`; bản chưa tồn tại có version 0.
- `PUT` nhận `{ text, version }`, tối đa 5.000 ký tự. API luôn xác định owner từ JWT. Note rỗng vẫn giữ revision để thao tác cũ không phục hồi ghi chú đã xóa.
- Lưu offline giữ cờ dirty. Khi mở lại, có mạng, quay lại cửa sổ hoặc kiểm tra định kỳ, client thử đồng bộ. Chỉ tải thẻ đang xem và các bản chưa gửi, giới hạn bốn tác vụ nền đồng thời.
- HTTP 409 giữ cả bản local và remote; người dùng chọn một bản hoặc kết hợp trong editor. Retry sau khi mất acknowledgement nhận lại bản đã lưu nếu text trùng.
- Lưu thất bại do quota báo lỗi và giữ editor mở. Logout không xóa cache của tài khoản; các callback cũ không ghi vào scope của tài khoản mới.

## Chia sẻ và xuất

Ghi chú cá nhân mặc định không được sao chép khi chia sẻ. Tùy chọn **Kèm ghi chú của tôi** áp dụng độc lập cho bộ và nhóm; cần đồng bộ xong trước khi bật. Người nhận mới có bản ghi chú riêng gắn với UUID thẻ bản sao. Tắt tùy chọn không thu hồi các bản đã nhận. Ghi chú gốc và lịch ôn giữ hành vi hiện có.

Trong editor, **Xuất thẻ này** tải một thẻ JSON. Tùy chọn kèm ghi chú mặc định tắt; bật sẽ thêm nội dung cá nhân vào note của bản xuất.

## Kiểm tra và triển khai

`npm test`, `npm run build`, `node tests/cardNotes.browser.mjs`. Browser test dùng API giả lập local, có thể đặt `PLAYWRIGHT_CHANNEL=msedge` và `CARD_NOTES_TEST_URL`.

Triển khai BE kèm migration `V13__personal_card_notes.sql` trước FE. FE vẫn lưu offline nếu BE chưa cập nhật; đồng bộ và tùy chọn chia sẻ mới cần BE mới.
