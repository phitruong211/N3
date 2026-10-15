# Hoàn tác lượt ôn gần nhất

## Mục tiêu đã chốt
Space lần đầu hiện đáp án; Space lần tiếp chọn Tốt. Nút ↶ / Backspace hoàn tác lượt gần nhất trong phiên và mở lại mặt đáp án để đánh giá lại. Giữ FSRS và lịch ôn hiện tại. Hỗ trợ bộ có sẵn, bộ cá nhân và khách.

## Hiện trạng và quyết định
Outbox gửi ngay, lưu bền và retry theo UUID. FE hiện chọn tiến độ có reps lớn nhất; không thể hoàn tác bằng cách hạ reps ở giao diện. Log BE hiện lưu kết quả, chưa lưu đầy đủ trạng thái trước lượt ôn. Thêm thao tác undo riêng, có biên nhận và kiểm tra phiên bản; không dùng một lượt ôn mới để giả lập hoàn tác.

## Hành vi
- Chỉ hoàn tác lượt gần nhất của phiên hiện tại; sau khi đánh giá lại sẽ có lượt gần nhất mới. Không cung cấp chuỗi undo nhiều bước trong đợt này.
- Nút có mặt cả ở màn hình chờ học lại và hoàn thành. Backspace không hoạt động trong ô nhập, dialog hoặc khi giữ phím. Không bắt Space của nút công cụ đang được focus.
- Trong khi hoàn tác, khóa đánh giá để không tạo lượt mới trên trạng thái chưa được xác nhận. Lỗi giữ nguyên lịch hiện tại, cho phép thử lại. Không thông báo hoàn tác thành công trước khi dữ liệu được xác nhận.
- Khách hoàn tác cục bộ: khôi phục lịch trước lượt, xóa đúng log của lượt đó và đảo đóng góp thống kê. Đồng hồ học không chạy lùi.

## Backend
- Lưu snapshot trước lượt và dấu đã hoàn tác vào log của cả hai loại thẻ; migration chỉ thêm cột nullable. Lượt cũ không có snapshot không được hoàn tác.
- Thêm POST undo theo clientReviewId, kiểm tra chủ sở hữu, khóa cùng bản ghi như khi review. Chỉ chấp nhận nếu không có lượt mới hơn còn hiệu lực cho thẻ. Không dùng reps làm phiên bản duy nhất vì reps có thể giảm rồi tăng lại.
- Khôi phục toàn bộ trạng thái FSRS trước lượt, kể cả trường hợp chưa có tiến độ. Giữ log làm biên nhận để retry không áp dụng lại; đánh dấu log bị hủy để thống kê/telemetry bỏ qua.
- Response chứa tiến độ có hiệu lực và revision mới. Retry review cũ đã bị undo phải trả xung đột rõ ràng, không hồi sinh kết quả cũ.
- Hai yêu cầu undo cùng UUID phải có cùng kết quả hiệu lực; không ghi đè lượt ôn mới sau lần undo đầu.

## Frontend và đồng bộ
- Lưu receipt của lượt gần nhất: UUID, source, trạng thái trước/sau, queue trước lượt, đóng góp thống kê và ngày ghi nhận.
- Undo chạy tuần tự cùng khóa sender. Nếu review chưa gửi, hủy an toàn trong outbox; nếu đã gửi hoặc mất phản hồi, giải quyết review với UUID cũ trước rồi gọi undo. Không xóa request đang bay.
- Intent undo phải lưu bền để reload/mất mạng không làm mất yêu cầu. Đánh giá tiếp được mở lại sau khi undo hoàn tất. Không giữ khóa sender vô hạn khi mạng lỗi.
- Đồng bộ kết quả undo bằng revision/biên nhận thay vì quy tắc reps lớn nhất. Cập nhật cả cache confirmed, snapshot đồng bộ và tiến độ trong phiên; response review cũ đến muộn không được ghi đè.
- Đảo đúng phần đóng góp của lượt bị hủy vào số đã ôn, thẻ mới và số đúng. Giữ thời gian thực đã học. Không phục hồi toàn bộ thống kê ngày từ snapshot cũ vì có thể làm mất hoạt động khác.
- Nếu thẻ đã được ôn ở phiên khác, báo xung đột và tải tiến độ mới; không cưỡng ép hoàn tác.

## Kiểm chứng bắt buộc
Space ở body/thẻ, giữ phím, input/dialog; undo sau Again/Good và ở cuối phiên; bộ có sẵn/cá nhân/khách; pending/in-flight/đã lưu/mất phản hồi; reload giữa undo; retry lặp; hai tab; phiên khác đã ôn tiếp; lịch và thống kê không bị cộng hai lần hoặc hồi sinh. Test FE outbox và browser, BE transaction và migration.

## Triển khai
Triển khai BE trước FE để endpoint và dữ liệu snapshot sẵn sàng. Bản FE cũ tiếp tục review bình thường. Không đổi cấu hình FSRS để ép nút Tốt về một khoảng cố định.
