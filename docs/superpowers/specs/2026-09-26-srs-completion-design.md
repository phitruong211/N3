# Hoàn thiện SRS 1.1

Theo yêu cầu mới của người dùng, phạm vi gồm tất cả yêu cầu mục tiêu 17–22 và đối chiếu 1–16. Hạn chế chỉ Guest ở lần trước hết áp dụng. Backend thật là ../japanese-server.

Thiết kế: API metadata/card phân trang tương thích endpoint cũ; API import giao dịch với idempotency; CardView chung cho bộ tích hợp/cá nhân/ảo; tách thao tác card khỏi snapshot deck. Parser giữ bảng gốc để đổi mapping, báo dòng lỗi/trùng và metadata nguồn riêng, không sửa note. Server giữ chủ sở hữu, validation và progress độc lập. API P3 dùng revision, account snapshot và import Guest idempotent, giữ SRS tài khoản khi trùng; đồng ý trước chuyển và chỉ xóa bản nguồn đã được xác nhận. Legacy vô chủ chỉ nhập sau xác nhận người dùng.

Mỗi phần có unit/contract/integration tests, migration Flyway riêng. Luồng UI giữ màu/typography hiện có, nút thao tác rõ, keyboard và mobile. Việc triển khai làm trực tiếp trong hai repo theo quyền đầy đủ của người dùng, không thêm vòng duyệt skill.
