# Widget nhóm bộ thẻ — kính trong suốt (Liquid Glass) và bậc kích thước

## Giao diện

- **Lưới ô vuông** như màn hình chính iOS. Số cột lấy theo chiều rộng của chính bảng (container query): 2 cột dưới 480 px, 3 từ 480, 4 từ 720, 6 từ 1024, 8 từ 1400. Khoảng cách 16 px, mỗi ô là hình vuông (`--cell`), hàng cao đúng một ô, `grid-auto-flow: row dense` nên widget nhỏ lấp các chỗ trống.
- **Bốn bậc cố định** (`data-widget-size`): Nhỏ 1×1 · Vừa 2×1 · Lớn 2×2 · Rất lớn 4×2 (2×3 khi bảng ít hơn 4 cột). Nhóm đang mở chiếm cả hàng và cao 3 ô, danh sách cuộn bên trong.
  - **Nhỏ**: biểu tượng (huy hiệu đỏ số thẻ cần ôn ở góc), tên (tối đa 2 dòng), "n bộ · m thẻ". Cả widget là một vùng bấm để mở nhóm, không có nút riêng.
  - **Vừa**: biểu tượng và tên bên trái; bên phải là số thẻ cần ôn lớn và nút "Ôn N thẻ →". Khi không còn thẻ cần ôn chỉ còn dòng nhỏ "✓ Xong hôm nay" và mũi tên báo hiệu bấm được (cả widget là vùng bấm nên không có nút "Mở nhóm" thừa).
  - **Lớn / Rất lớn**: tiêu đề, số cần ôn, nút, và danh sách bộ con. Chỉ hàng nào vừa khung mới hiện (hàng thừa bị ẩn hẳn, không bị cắt nửa); "Xem tất cả n bộ" mở nhóm. Rất lớn (bảng ≥ 720 px) chia hai cột: tóm tắt bên trái, danh sách bên phải.
- **Vật liệu kính** (`widgetGlass.css`): `backdrop-filter: blur(var(--blur)) saturate(...)`; từ trên xuống là điểm sáng theo con trỏ → lớp màu (tint) → hạt nhiễu → nền kính trung tính (`--glass-fill`). Viền phản sáng 1 px (sáng ở mép trên-trái), bóng mềm. Bo góc đồng tâm: bo trong = bo widget − padding.
- **Nền ambient** (`.widget-ambient`): đúng bằng khung lưới, mờ hẳn trước các mép nên không bao giờ có màu lan ra ngoài widget, và không lấy màu của nhóm nào. Giao diện sáng: một dải sáng trung tính nhạt dần xuống dưới cộng một vùng xanh lạnh rất nhẹ ở góc, để ô trống nhìn sạch mà kính vẫn có nền sáng–tối phía sau. Giao diện tối: hai vệt sáng dịu trôi chậm bằng `transform`, chỉ chạy khi bảng đang trong màn hình và tab hiển thị.
- Phần tử bên trong kính (hàng bộ con, nút, biểu tượng) **không** blur lần nữa; chỉ dùng alpha của màu chữ.
- Token màu kính theo từng chủ đề (`--glass-*` trong `index.css`): Sáng, Tối, Đọc sách (kính ấm), Tương phản cao (nền đục, viền 2 px, không blur).
- Dự phòng: `prefers-reduced-transparency: reduce` và trình duyệt không hỗ trợ `backdrop-filter` ⇒ nền đục (`--glass-fill-solid`), bỏ ambient. Reduced motion tắt rung, trôi ambient và ánh sáng theo con trỏ.

### Màu: là định danh, không phải lớp phủ

- Tám tông kiểu Apple: Trong `#e9edf2` (mặc định), Xanh trời, Bạc hà, Xanh lá, Vàng, Cam, Hồng, Tím, kèm màu tùy ý (HEX 6 ký tự). Mặc định: Nhỏ, Trong, độ đậm màu 14%, blur 24 px.
- **Độ đậm màu** 0–70% (lưu là `opacity`), **Độ mờ kính** 8–40 px (lưu là `blur`, giá trị 0–40 được giữ). Cả hai áp dụng tức thì lên widget thật. Màu và giá trị đã lưu trước đây giữ nguyên.
- Màu của nhóm chỉ nhận diện nhóm: chip biểu tượng và một lớp tint nhẹ. Độ đậm lưu được vẽ ở `TINT_STRENGTH` = 0.55 (`--tint-strength` trong CSS) nên màu đã lưu giữ nguyên tông nhưng nhẹ hơn khoảng một nửa; thanh "Độ đậm màu" vẫn 0–70%. Độ bão hòa của nền kính `--glass-sat` chỉ 125–130%. Màu hành động (xanh accent) dành riêng cho "Ôn N thẻ".
- Màu chữ chọn theo độ tương phản AA (4.5:1) trên **mọi nền kính có thể xảy ra**: nền trang, từng lớp ambient của chủ đề, nền kính và tint (`glassBackgrounds` / `widgetInk` trong `lib/deckWidgets.ts`). Vùng chuyển độ sáng dùng halo chữ nhỏ khi cần. `GLASS_FILL`, `TINT_STRENGTH` và `AMBIENT_GLOWS` trong `deckWidgets.ts` phải khớp `--glass-fill`, `--tint-strength` và `.widget-ambient` trong `widgetGlass.css`.

## Sắp xếp và tùy chỉnh

1. Bấm **Sắp xếp**: widget rung nhẹ (±0.45°, qua thuộc tính `rotate`), hiện tay nắm sáu chấm, nút tùy chỉnh và tay nắm đổi cỡ ở góc dưới phải. Bậc Nhỏ/Vừa tạm ẩn biểu tượng và nút để nhường chỗ cho điều khiển.
2. Kéo tay nắm sang nửa trái/phải widget khác để đặt trước/sau (chuột/cảm ứng; mũi tên là phương án bàn phím; Esc hoặc mất focus hủy).
3. **Đổi cỡ**: kéo góc dưới phải. Kích thước kéo được quy ra số ô và **hít vào bậc gần nhất** (`snapWidgetSize`); widget đổi bậc ngay khi kéo (chính nó là bản xem trước), nhả chuột mới lưu, Esc hoàn tác. Phím mũi tên → / ↓ lên một bậc, ← / ↑ xuống một bậc.
4. Bảng tùy chỉnh: desktop là bảng kính cố định bên phải (300 px), điện thoại là bottom sheet tối đa 62vh. Gồm 4 nút bậc có hình lưới mini, 8 swatch + màu riêng, hai thanh trượt. Esc hoặc nút đóng trả focus về nút mở. Bảng không chặn thao tác trên lưới.
5. **Đặt lại** trả về mặc định; **Xong** trên thanh sắp xếp khóa bố cục. Tải lại trang luôn bắt đầu ở trạng thái khóa. Đổi bậc sẽ thu gọn nhóm đang mở để thấy đúng bậc.

Mở nhóm vẫn dùng dữ liệu/phân trang cũ. Các hàng bộ con gọi cùng hàm học/ôn và giữ menu quản lý/chuyển nhóm/chia sẻ; kéo thả bộ thẻ giữa các nhóm hoạt động trên cả hàng xem trước. Nút ôn của nhóm mở đường `/review?group=<id>` đã có.

## Nhóm trình độ (bộ có sẵn)

Trang Bộ thẻ và Ôn ngắt quãng hiển thị bộ có sẵn theo trình độ thay cho bốn danh sách xếp dọc (`LevelDecks.tsx`, `levelDecks.css`, logic thuần ở `lib/levelDecks.ts`):

- Tiêu đề "Theo trình độ" và một **tablist** N5 · N4 · N3 · N2 (chỉ trình độ có bộ thẻ). Mỗi tab có một dòng phụ: ở chế độ ôn là "N cần ôn" (nếu có), còn lại là "% đã học". Bàn phím: ←/→ (vòng tròn), Home/End; chọn là kích hoạt ngay.
- Trình độ mở đầu: trình độ đã chọn lần trước (key `deck-level-v1`) → ở chế độ ôn là trình độ có nhiều thẻ chờ nhất → N5.
- Mỗi bộ là một hàng trong một danh sách gộp: chip biểu tượng theo loại (Từ vựng `--color-accent`, Kanji `--color-kanji`, Ngữ pháp `--color-grammar`, cùng icon với trang Hôm nay), tên loại (không lặp trình độ), "đã học/tổng" và thanh tiến độ mảnh; bên phải là "N cần ôn" (chế độ ôn), động từ "Chọn bài/Bắt đầu" (học tự do), "✓ Xong hôm nay" hoặc "Sắp có" (không bấm được). Cả hàng là một nút; `aria-label` có đủ loại, trình độ, số thẻ, số đã học và số cần ôn.
- "Đã học" là số thẻ đã học ít nhất một lần (`learnedCount` của `buildScheduledDeckQueue`); "cần ôn" là số thẻ phiên ôn hôm nay sẽ đưa ra (`remainingTodayCount`, gồm cả thẻ mới trong giới hạn ngày). Lịch của từng bộ được tính một lần mỗi thay đổi (`useMemo`).
- Bề mặt hàng là surface trầm, không dùng kính: màu chỉ nằm ở chip, thanh tiến độ và nút "cần ôn".

## Lưu trữ

- Thứ tự dùng `PUT /api/v1/deck-groups/order` hiện có. Di chuyển widget không đổi membership, thẻ hoặc tiến độ.
- Tùy chọn (gồm cả bậc `size`) nằm ở key `deck-group-widgets-v1` qua learning storage có namespace từng tài khoản; chưa đồng bộ thiết bị. Đọc/ghi được bọc try/catch; dữ liệu không hợp lệ về mặc định.
- **Di trú một lần**: kích thước pixel cũ ở `deck-group-sizes-v1` được đổi thành bậc gần nhất (`sizeFromPixels`) ngay sau khi lưới đo xong, rồi key cũ được làm rỗng (`{}`).
- Alpha chỉ áp dụng nền, không đặt opacity lên toàn widget.
- Trình độ đang chọn ở trang Bộ thẻ nằm ở key `deck-level-v1` (cùng learning storage; lỗi đọc/ghi được bỏ qua).

## Kiểm tra

`tests/deckWidgets.test.mjs`: dữ liệu lưu, bậc/hít bậc/di trú pixel, tint `TINT_STRENGTH` và ambient trung tính, tương phản AA trên mọi tông × độ đậm × sáng/tối, thứ tự bất biến. `tests/levelDecks.test.mjs`: % đã học, tổng hợp trình độ, nhãn tab, trình độ mở đầu, phím tab. `tests/n5Decks.browser.mjs`: các hàng N5 mở đúng luồng học/ôn, chuyển trình độ, ghi nhớ sau khi tải lại, bàn phím. `tests/deckGroups.browser.mjs`: khóa/mở bố cục, rung và reduced motion, bảng tùy chỉnh (8 màu, 4 bậc, blur thật), kéo/cancel/bàn phím/cảm ứng, hít bậc + di trú, ambient nằm gọn trong lưới và chỉ trôi khi trong màn hình, tint nhẹ, "xong" gọn, dự phòng giảm trong suốt và tương phản cao, không cuộn ngang ở 360 px, luồng nhóm cũ. Đặt `PLAYWRIGHT_CHANNEL=msedge` để dùng Edge cài sẵn. Ảnh kiểm tra ở `artifacts/deck-groups/`.
