# Widget nhóm bộ thẻ — giao diện kính mờ

## Giao diện

- Lưới 6 cột, khoảng cách 16 px. Nhỏ chiếm 2 cột (3 trên vùng hẹp/điện thoại), Vừa chiếm 3 cột (6 trên điện thoại), Lớn chiếm 6 cột.
- Nhỏ: biểu tượng, tên, số bộ/thẻ và nút mở nhóm. Vừa thêm vòng tiến độ và số thẻ cần ôn. Lớn tải danh sách bộ con và trình bày thành các hàng tên/số thẻ gọn, nhiều cột khi đủ rộng.
- Tông tối/sáng theo hệ điều hành, tôn trọng lựa chọn light/dark rõ ràng của ứng dụng. Nền có hai vệt sáng mờ; widget dùng một lớp kính có blur/saturation, viền mảnh và mép sáng phía trên.
- Sáu tông gợi ý: Sương, Xanh trời, Bạc hà, Mơ vàng, Hồng đào, Lavender. Có bảng chọn màu tùy ý và hiển thị mã HEX; màu đã lưu được giữ nguyên. Mặc định Sương, độ đậm nền 30%, blur 24 px. Khoảng chỉnh 5–70% và 0–40 px. Widget thật cập nhật ngay; không có thẻ xem trước riêng.

## Sắp xếp và tùy chỉnh

1. Bấm **Sắp xếp**: widget hiện tay nắm sáu chấm và nút tùy chỉnh tròn. Nội dung mờ 55%, nền giữ nguyên alpha. Khi đang kéo, widget nổi nhẹ 1.03 lần; reduced motion tắt animation.
2. Kéo tay nắm sang nửa trái/phải widget khác để đặt trước/sau. Pointer events hỗ trợ chuột/cảm ứng; phím mũi tên là phương án bàn phím. Esc hoặc mất focus hủy kéo.
3. Kéo góc dưới phải để chỉnh chiều rộng/cao theo logic pixel hiện có; phím mũi tên chỉnh 10 px, Shift + mũi tên chỉnh 40 px. Pixel width được quy đổi thành số ô lưới cần chiếm để không chồng widget.
4. Mở tùy chỉnh: desktop dành một cột 320 px, bảng cố định bên phải; điện thoại dùng bottom sheet tối đa 62vh. Widget được chọn có outline accent và là bản xem trước thật.
5. Chọn kích thước/màu/slider áp dụng tức thì. Chọn preset kích thước bỏ pixel size cũ. Esc hoặc nút đóng đóng bảng và trả focus về nút mở. Bảng không chặn thao tác trên lưới hoặc khóa cuộn trang.
6. **Đặt lại** trả về mặc định. **Xong** trên bảng đóng bảng; **Xong** trên thanh sắp xếp khóa bố cục. Tải lại trang luôn bắt đầu ở trạng thái khóa.

Mở nhóm vẫn dùng dữ liệu/phân trang cũ. Các hàng bộ con gọi cùng hàm học/ôn và giữ menu quản lý/chuyển nhóm/chia sẻ cũ. Nút ôn của nhóm mở đường `/review?group=<id>` đã có; không tạo thuật toán hoặc phiên ôn nhóm mới.

## Lưu trữ

- Thứ tự dùng `PUT /api/v1/deck-groups/order` hiện có. Di chuyển widget không đổi membership, thẻ hoặc tiến độ.
- Tùy chọn dùng key `deck-group-widgets-v1` qua learning storage có namespace từng tài khoản; kích thước pixel tiếp tục dùng `deck-group-sizes-v1`. Các tùy chọn này chưa đồng bộ thiết bị.
- Đọc/ghi tùy chọn được bọc try/catch. Dữ liệu không hợp lệ về mặc định; màu HEX 6 ký tự hợp lệ được giữ nguyên (kể cả màu tùy chọn), giá trị được chặn trong giới hạn mới.
- Alpha chỉ áp dụng nền, không đặt opacity lên toàn widget. Chế độ sắp xếp chỉ làm mờ nội dung theo đặc tả.
- Màu chữ được chọn để giữ tương phản trên nền kính; vùng chuyển tiếp độ sáng dùng halo chữ nhỏ khi cần. Nút và tâm vòng tiến độ có nền đục riêng.

## Kiểm tra

`tests/deckWidgets.test.mjs` kiểm tra dữ liệu lưu không hợp lệ, màu cũ, giới hạn, độ tương phản và thứ tự bất biến. `tests/deckGroups.browser.mjs` kiểm tra ba kích thước, sáu màu gợi ý và bảng chọn màu tùy ý, bảng không modal/không phủ lưới, focus/Esc, reload, kéo/resize/cancel/bàn phím/cảm ứng, luồng nhóm cũ và 360 px ở sáng/tối. Có thể đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge cài sẵn. Ảnh kiểm tra nằm tại `artifacts/deck-groups/glass-*.png`.

Vệt sáng được giới hạn trong vùng bộ thẻ, không phủ sidebar. Bề mặt kính có lớp phản sáng chéo và viền sáng mảnh; nền tối được nâng lên màu than xanh #151b1e. Màu đã lưu vẫn giữ nguyên; chọn màu gợi ý để áp dụng bảng màu mới.

Widget kế thừa bảng màu trong Cài đặt (Sáng, Tối, Đọc sách, Tương phản cao) từ các biến --color-* chung; không ghi đè nền trang hoặc tự chọn theo màu hệ điều hành.

Bảng tùy chỉnh dùng một thanh “Độ trong suốt của thẻ” (30–95%, mặc định 70%). Giá trị tăng làm nền trong hơn, lưu dưới dạng opacity = 100 − độ trong suốt để tương thích dữ liệu cũ. Bỏ thanh chỉnh blur; blur đã lưu được giữ nguyên. Chữ và nút không đổi độ đục.

Đã bỏ hoàn toàn lớp vệt sáng phía sau lưới để không loang màu ngoài thẻ. Màu và phản sáng dùng background của chính thẻ, cắt theo góc bo; khoảng trống giữ nền từ Cài đặt.
