# Lưu và chuyển dữ liệu học

Guest lưu riêng dưới `guest:*`; mỗi tài khoản dùng `user:<id>:*`. Token dùng `auth:*`. Đổi tài khoản thay toàn bộ cây trạng thái học; request trả chậm của phiên cũ bị loại.

Tài khoản tải bookmark/SRS tích hợp/ngày hoạt động bằng GET `/api/v1/users/me/learning`. PUT gửi revision hiện tại. Server khóa theo người dùng và trả 409 nếu revision khác; không ghi đè âm thầm. Thay đổi offline được giữ cục bộ và có nút thử lại. Khi chọn dùng bản server sau xung đột, bản chưa gửi được lưu ở `learning_conflict_backup`; nút tải bản sao xuất JSON. Không tự cộng lại toàn bộ lịch sử tài khoản vì có thể nhân đôi ngày học.

Sau đăng nhập, người học có thể chuyển Guest hoặc dữ liệu phiên bản cũ chưa có namespace. Màn hình liệt kê số mục và yêu cầu xác nhận quyền sở hữu/đồng ý. POST `/users/me/learning/guest` dùng khóa SHA-256 theo tài khoản/nguồn/payload: bookmark hợp nhất theo loại+ID, lịch ôn trùng giữ bản server, hoạt động cộng một lần theo ngày. Chỉ dọn đúng bản nguồn đã xác nhận sau khi server thành công; phần nghe/cài đặt không bị dọn. Lỗi giữa chừng giữ nguồn để thử lại.

Dữ liệu cục bộ tài khoản chưa từng có revision được giữ thành bản chờ chuyển, không tự coi là dữ liệu server. Reset trên thiết bị dọn cả hàng đợi đồng bộ để lần tải lại không gửi snapshot rỗng xóa tiến độ server. Lịch sử nghe và điểm bài nghe vẫn chỉ lưu tại thiết bị theo SRS.

Cài đặt lưu cục bộ ngay; chỉ các trường thay đổi được PATCH tuần tự. Hàng đợi còn tồn tại sau tải lại và có thông báo/thử lại khi mất mạng. Thay đổi mới hơn không bị response tải cũ ghi đè.

# Chạy kiểm thử

- `npm test`, `npm run build`, `npm run lint`.
- `npm run test:guest`: Vite chạy ở 5173, API dùng fixture để thử lỗi/cancel/A–B.
- `node tests/srsIntegration.browser.mjs`: Vite 5173 và API 8080 với DB thử riêng; tạo tài khoản tổng hợp để thử API/MySQL thật.
- `node tests/srsScale.api.mjs`: API/DB thử riêng; tạo 20.000 thẻ + 22 deck, thử quyền sở hữu, retry, giới hạn và CORS. Không chạy trên production.
- Backend: Java 21, MySQL 8.4, cấu hình `DB_URL/DB_USERNAME/DB_PASSWORD`, chạy `bash mvnw test`.

# Triển khai

`deploy/nginx.conf` cung cấp CSP và header cho bản build, proxy `/api` đến service `backend`. Cấu hình TLS, hostname và `JWT_SECRET` ngẫu nhiên riêng trước khi triển khai; giới hạn CORS đúng origin. File này chưa được đưa lên hạ tầng production. Token hiện vẫn ở localStorage theo hợp đồng ứng dụng; chuyển refresh token sang cookie HttpOnly là quyết định kiến trúc riêng, không được tuyên bố đã thực hiện. Không đưa `.env` vào Git/image.
