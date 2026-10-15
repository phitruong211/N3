# Đồng bộ nền cho ôn ngắt quãng

## Luồng đánh giá

- `StudySession` tính lịch FSRS tạm, lưu lượt ôn vào `user:<id>:review_outbox_v1`, rồi chuyển thẻ. Không chờ HTTP.
- Nếu localStorage không ghi được (ví dụ hết dung lượng), giữ thẻ và báo lỗi; không chuyển thẻ với một lượt ôn chưa lưu.
- Một worker ở AppProvider tiếp tục gửi sau khi đóng phiên học. Reload khôi phục cả hàng đợi và lịch tạm.
- Mỗi lượt giữ nguyên UUID, rating, timing và expectedRepetitions khi retry. Không gộp mất các lần ôn cùng thẻ.
- Web Locks tách khóa cập nhật localStorage ngắn hạn và khóa worker gửi, để các tab không ghi đè hàng đợi hoặc cùng gửi song song.
- Thẻ có sẵn gửi tối đa 20 lượt chờ liên tiếp qua `POST /users/me/learning/reviews/batch`. Thẻ cá nhân giữ endpoint đánh giá hiện có và gửi tuần tự.
- Phản hồi xác nhận được đối chiếu với lượt mới hơn; phản hồi cũ không kéo giao diện về thẻ trước.

## Snapshot và DB

- Lịch tạm nằm trong outbox, không được gửi nhầm qua PUT snapshot như lịch đã xác nhận.
- Snapshot PUT tạm dừng khi còn lượt chờ. Worker chờ snapshot PUT đang chạy trước khi đánh giá thẻ có sẵn.
- Phản hồi batch cập nhật revision, lịch chính thức và gộp các thay đổi local kể từ snapshot cơ sở. Hoạt động học đồng thời trên thiết bị khác được cộng theo phần tăng thêm, không ghi đè cả ngày.
- Backend khóa chủ sở hữu một lần cho batch, áp dụng lượt ôn theo thứ tự, ghi các receipt và snapshot cuối trong cùng transaction. Một batch 20 lượt ghi cập nhật snapshot một lần.
- Batch thất bại được rollback toàn bộ. Retry batch đã commit trả lại receipt mà không tính lịch hai lần.
- Backend dùng thời điểm nhấn đánh giá để tính lịch khi request đến trễ. Thời điểm thiếu, quá xa, ở tương lai hoặc trước lần ôn trước sẽ dùng thời gian server.

## Lỗi

Lỗi mạng, timeout, 5xx, 408 và 429 được thử lại với khoảng chờ tăng dần, tối đa 30 giây. Sự kiện online và nút “Thử lại” cũng kích hoạt worker. Lỗi 4xx khác giữ nguyên hàng đợi và hiển thị thông báo, không tự loại bỏ lượt ôn hay tự ghi đè phiên bản thẻ đã thay đổi trên thiết bị khác.

Lượt chờ chỉ được gửi khi tài khoản tương ứng đã đăng nhập và ứng dụng đang mở. Trình duyệt không chạy worker này sau khi đóng hoàn toàn; lần mở tiếp theo sẽ tiếp tục.

## Kiểm tra

Frontend:

```sh
npm test
npm run build
npm run lint
# Cần Vite đang chạy; mock API trễ 3 giây và làm mất phản hồi sau commit.
npm run test:review-outbox
```

Backend, Java 21:

```sh
bash ./mvnw -Dtest=LearningServiceIntegrationTest,ReviewSchedulingTimeTest,AnkiSchedulerTest,ReviewTimingTest,DeckServiceIntegrationTest test
```

Kiểm thử bao gồm durable enqueue, API chậm, retry giữ nguyên payload, reload, batch đúng thứ tự, bảo vệ tiến độ mới hơn, quota failure, rollback, idempotency và số lần update snapshot.

## Triển khai

Cập nhật backend trước frontend vì frontend dùng endpoint batch mới. Endpoint đánh giá cũ vẫn được giữ để tương thích. Không cần migration DB hoặc thêm Redis/message broker.
