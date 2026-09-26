# Hoàn thiện SRS 1.1

Người dùng yêu cầu đối chiếu và hoàn thiện toàn bộ SRS, cả N3 và japanese-server; quyền triển khai toàn bộ đã được cấp. Mục tiêu 17–22 thay thế các giới hạn as-built tương ứng ở 1–16. Không bổ sung thanh toán/admin hoặc tính năng ngoài SRS.

## Thiết kế và tác động

Giữ endpoint cũ để tương thích; frontend mới dùng danh sách metadata phân trang, trang card có bộ lọc, import có khóa idempotency. Bộ tích hợp chỉ đọc ánh xạ sang CardView chung; deck ảo bookmark không có quyền sửa. Mỗi thao tác card cập nhật qua API riêng, không ghi lại toàn deck gây mất nội dung/progress khi phân trang. Import có mapping/preview/lý do bỏ qua, metadata nguồn riêng. P3 lưu dữ liệu học tích hợp theo chủ sở hữu với revision và consent chuyển Guest; không ghi đè xung đột hoặc xóa bản Guest trước server xác nhận.

## Phân công theo plan-mode

- Agent backend_decks: BE pagination/import transaction/idempotency/metadata/CORS và tests; migration V3.
- Agent learning_sync: BE P3 + modules FE riêng; migration V4, revision/consent/conflict tests.
- Agent import_parser: parser mapping/dedup/metadata/worker + preview editor/tests.
- Root: frontend card model/deck management/import flow, sync integration, môi trường Java/DB, kiểm chứng E2E và ma trận SRS.

## Theo dõi

- [x] Audit yêu cầu hiện có/mục tiêu và lập ma trận bằng chứng.
- [x] API deck/card phân trang và import idempotent toàn vẹn.
- [x] CardView/DeckSummary và danh sách/chi tiết/học thống nhất, empty/filter/order/edit.
- [x] Import hai nút + !, rules/mẫu/mapping/preview/kết quả, tạo thủ công >=1 thẻ hoặc chọn bộ trống.
- [x] P3 đồng bộ/Guest consent/idempotent conflict và migration legacy có chủ đích.
- [x] Cài đặt lỗi/retry/dailyGoal/autoPlay; đo thời gian foreground; sửa các khoảng trống mục16.
- [x] Java21/backend tests/DB migration, FE test/build/lint, browser E2E, ownership và 20k workload.
- [x] Báo cáo SRS theo mã, phân biệt đã kiểm chứng và giới hạn môi trường.

## Kiểm chứng

Unit parser/storage/scheduler; Spring integration ownership/paging/import rollback/retry/sync revision/Guest retry; browser real frontend+backend, guest no API, file mapping/import, card CRUD/filter/paging, review persistence, account A/B sync and consent. Kiểm tra mobile và trạng thái lỗi. Không coi fixture là xác nhận DB thật.

## Kết quả

Đã hoàn thiện các luồng P1–P3 và kiểm chứng local; xem `docs/srs-verification.md` để phân biệt bằng chứng tự động, kiểm tra mã và giới hạn production/browser/audio. Các agent đã dừng do hạn mức sau khi bàn giao mã; root hoàn tất tích hợp và kiểm thử.
