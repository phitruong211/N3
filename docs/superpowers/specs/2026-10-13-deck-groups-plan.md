# Kế hoạch thực hiện

Đặc tả: 2026-10-12-deck-groups-design.md. Người dùng đồng ý bỏ bước skill writing-plans bị thiếu và triển khai đến khi kiểm thử xong.

1. Backend: migration V9, entity nhóm và groupId của deck; API nhóm, phân trang theo nhóm, chuyển vị trí có kiểm tra quyền sở hữu và phiên bản.
2. Frontend: API có kiểu dữ liệu; thành phần thư viện nhóm dùng chung trong ImportedDecks. Giữ luồng học hiện tại bằng render callback; tải deck con khi mở nhóm.
3. Tương tác: tạo/đổi tên/giải tán, chuyển nhóm bằng menu, kéo bằng Pointer Events với vùng nhận, mở nhóm khi giữ, hủy Escape và reduced motion.
4. Kiểm chứng: test service quyền sở hữu, dữ liệu/progress và phân trang; browser test CRUD/di chuyển/lỗi và hai chế độ; build và bộ test hiện có.
5. Báo cáo kết quả và yêu cầu chạy backend mới có migration trước khi phát hành frontend. Không push khi chưa được yêu cầu.

## Kết quả

- Hoàn tất nhóm một cấp lưu theo tài khoản; phân trang theo nơi chứa, thống kê nhóm và kiểm tra phiên bản deck khi chuyển.
- UI dùng chung hai chế độ; chuyển bằng menu, kéo chuột/cảm ứng, giữ để mở nhóm, Escape để hủy, vùng chèn trước/cuối và reduced motion.
- Build đạt; 87 unit test frontend và 23 test backend đạt. Lint các file mới/sửa của chức năng không có cảnh báo; lint toàn repo có cảnh báo cũ.
- `npm run test:deck-groups`: CRUD, chuyển/lỗi, chuột, cảm ứng, Escape và bố cục nhỏ đạt.
- `npm run test:deck-groups:integration`: chạy trên MySQL 8.4 dùng riêng để thử; mở phiên học tự do và SRS từ deck con, tải lại/đổi trang và giải tán giữ ID thẻ đều đạt.
- Flyway chạy V1–V9 thành công trên MySQL thử nghiệm. Kiểm tra schema khi khởi động phát hiện khai báo LOB cũ của anki_review_logs.result_progress không khớp longtext trong migration; đã chỉ định columnDefinition=longtext, backend khởi động với validate thành công.
- Ảnh kiểm chứng lưu tại artifacts/deck-groups/. Không thay đổi dữ liệu tài khoản thật.

## Khi phát hành

Triển khai backend japanese-server có V9 trước frontend N3. API nhóm mới cần backend mới; dữ liệu deck cũ mặc định ở ngoài nhóm. Chưa push hoặc triển khai lên máy chủ thật.
