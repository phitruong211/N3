# Nhóm bộ thẻ

## Mục tiêu và phạm vi đã thống nhất

Người dùng gom các deck tự tạo hoặc import vào nhóm một cấp. Bấm nhóm để mở danh sách deck con, rồi chọn Học hoặc Ôn ngay. Cấu trúc nhóm dùng chung cho Bộ thẻ và Ôn ngắt quãng, được lưu theo tài khoản trên máy chủ. Bộ có sẵn và bộ Đã lưu giữ vị trí riêng.

Nhóm là nơi tổ chức deck, không chứa thẻ trực tiếp. Không sao chép thẻ, đổi ID thẻ hoặc đặt lại tiến độ. Chưa hỗ trợ nhóm lồng nhau, học trộn cả nhóm hoặc kéo nhiều deck cùng lúc.

## Trải nghiệm

- Nút Tạo nhóm cạnh các thao tác tạo/import deck; nhập tên tối đa 200 ký tự, bỏ khoảng trắng đầu/cuối và không chấp nhận tên rỗng.
- Nhóm có biểu tượng thư mục, tên, số deck, tổng số thẻ; trang ôn thêm tổng số thẻ cần ôn. Bấm tiêu đề để mở/đóng ngay tại chỗ, với aria-expanded và hỗ trợ bàn phím.
- Deck con giữ nút học, ôn và quản lý hiện có. Nhóm rỗng có lời nhắc kéo deck vào.
- Menu nhóm cho phép đổi tên, giải tán nhóm. Giải tán đưa deck về danh sách ngoài; không xóa deck hoặc thẻ.
- Menu deck có Chuyển vào nhóm và Đưa ra ngoài. Các thao tác này tương đương kéo thả, dùng được trên điện thoại và bằng bàn phím.
- Tạo/import deck mới đặt ngoài nhóm; người dùng có thể chuyển sau đó.

## Kéo thả và chuyển động

- Kéo từ tay nắm riêng để không cản bấm học hoặc cuộn trang. Chỉ bắt đầu sau ngưỡng di chuyển; cảm ứng dùng giữ tay trước khi kéo.
- Deck nổi theo con trỏ với bóng nhẹ; vị trí nguồn có chỗ giữ. Nhóm hợp lệ sáng viền và có nhãn Thả để chuyển vào nhóm.
- Giữ deck trên nhóm đang đóng khoảng 600 ms sẽ mở nhóm. Thả vào vùng Ngoài nhóm để tách ra; Escape hoặc thả ngoài đích hợp lệ hủy thao tác.
- Kéo giữa các deck để đổi thứ tự trong cùng nơi chứa. Vùng nhận nhóm và vùng chèn thứ tự được phân biệt rõ để tránh chuyển nhầm. Thứ tự nhóm cũng có thể sắp xếp.
- Chuyển động ngắn khoảng 160–220 ms, ưu tiên transform/opacity; giảm hoặc bỏ chuyển động khi prefers-reduced-motion. Cuộn tự động khi kéo gần mép vùng cuộn.
- Chỉ cho sắp xếp thứ tự khi đang xem thứ tự tùy chỉnh. Các chế độ sắp xếp khác vẫn cho chuyển nhóm; kết quả hiển thị theo chế độ đang chọn.

## Kiến trúc và dữ liệu

Frontend hiện dùng UnifiedDeckPage cho cả hai chế độ; ImportedDecks đang có phân trang và kéo đổi thứ tự. Tách phần trình bày cây một cấp và xử lý kéo thả thành thành phần dùng chung, giữ luồng học và sửa thẻ hiện có.

Backend bổ sung bảng deck_groups: id, owner_id, name, position, created_at, updated_at, version; thêm group_id nullable vào decks với khóa ngoại và chỉ mục theo chủ sở hữu/nhóm/thứ tự. Dữ liệu cũ có group_id null. Không dùng templateConfig để lưu quan hệ nhóm.

API nhóm hỗ trợ liệt kê kèm thống kê, tạo, đổi tên, giải tán và sắp xếp. API chuyển deck nhận đích groupId nullable và vị trí chèn; cập nhật quan hệ và thứ tự trong một giao dịch. Các API danh sách/metadata deck trả thêm groupId. Endpoint danh sách phân trang hỗ trợ lọc theo nhóm hoặc ngoài nhóm; client không tải tất cả thẻ để dựng nhóm.

Mọi thao tác kiểm tra quyền sở hữu deck và nhóm. Không cho gán deck vào nhóm của tài khoản khác. Giải tán và chuyển deck cập nhật nguyên tử; xung đột phiên bản trả lỗi để client tải lại. API reorder hiện có phải kiểm tra đầy đủ phạm vi, không làm thay đổi thành viên nhóm ngoài ý muốn.

## Phân trang, thống kê và lỗi

Tải metadata nhóm cùng trang deck ngoài nhóm. Chỉ tải trang deck con khi mở nhóm; phân trang riêng từng nhóm để không mất deck nằm ngoài trang hiện tại. Tổng số và số cần ôn do máy chủ tính trên toàn nhóm, dùng cùng quy tắc lịch ôn hiện tại; không cộng thêm hạn mức thẻ mới ở cấp nhóm.

Sau thao tác, giao diện phản hồi ngay và khóa thao tác trùng trên đối tượng đang lưu. Khi thất bại, khôi phục trạng thái trước đó, hiển thị lỗi dễ hiểu và cho thử lại. Khi thành công, làm mới metadata/thống kê các nhóm liên quan. Dùng ID ổn định để tránh mất trạng thái mở khi đổi tên hoặc sắp xếp. Không để phản hồi của tài khoản cũ cập nhật tài khoản mới sau đăng xuất.

## Kiểm chứng hoàn thành

- Backend: migration dữ liệu cũ, CRUD nhóm, kiểm tra quyền sở hữu, di chuyển/giải tán nguyên tử, phân trang, thứ tự và thống kê đầy đủ.
- Frontend: tạo/đổi tên/giải tán, mở nhóm và học deck con ở cả hai chế độ, chuyển bằng menu và kéo thả, hủy kéo và phục hồi khi lưu lỗi.
- Kiểm tra tải lại trang và chuyển giữa Bộ thẻ/Ôn ngắt quãng giữ cùng cấu trúc; ID thẻ và tiến độ ôn không thay đổi.
- Kiểm tra desktop, màn hình nhỏ, bàn phím và reduced motion; không tải toàn bộ thẻ chỉ để mở danh sách nhóm.
- Chạy build, bộ test liên quan và kiểm thử trình duyệt. Backend cần triển khai migration/API trước frontend sử dụng nhóm.

## Phương án đã cân nhắc

Gộp vật lý các thẻ vào một deck làm mất cách chọn deck con mong muốn. Chỉ lưu nhóm trong trình duyệt đơn giản hơn nhưng không đồng bộ tài khoản. Chọn nhóm lưu trên máy chủ để hai trang và các thiết bị sử dụng cùng cấu trúc.
