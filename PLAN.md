# Kế hoạch chỉnh giao diện thư viện bộ thẻ — 2026-10-13

Trạng thái: người dùng đã duyệt; đã triển khai và kiểm chứng ngày 2026-10-13.

## Summary

Gom nút theo phạm vi thao tác, thêm nền hover và rung nhẹ cho deck, kéo deck từ thân thẻ, và kéo góc để đổi chiều rộng/chiều cao từng nhóm. Giữ phong cách hiện tại.

## Context

- ImportedDecks.tsx đặt nút tạo bộ riêng với nút tạo nhóm trong DeckGroups.tsx. Menu deck và thanh chuyển nhóm cũng ở hai nơi.
- DeckGroups.tsx đã có Pointer Events, kéo bằng sáu chấm, giữ trên nhóm để mở, chèn trước/cuối, tự cuộn, hủy Escape và lưu qua API.
- Nhóm hiện chiếm toàn chiều rộng, lưới deck phụ thuộc viewport. Resize cần lưới theo chiều rộng thực tế của nhóm.
- Người dùng đã chọn kéo góc đổi kích thước tự do.

## System Impact

- Backend tiếp tục quản lý nhóm, deck, thứ tự và tiến độ. Dùng lại API hiện tại.
- Đề xuất lưu kích thước bằng useLearningStorage theo group ID: riêng từng tài khoản, dùng chung hai chế độ học trên cùng trình duyệt. Chưa bao gồm đồng bộ kích thước giữa thiết bị.
- Phân biệt idle / pending drag / dragging / resizing. Không drag và resize đồng thời; tắt hover transform khi tương tác.
- Resize cập nhật trực tiếp, chỉ lưu khi thả. Escape/pointercancel khôi phục kích thước trước thao tác; dọn listener khi unmount, loại tùy chọn của nhóm bị xóa.
- Di chuyển deck vẫn qua mutate hiện có; lỗi API hiện thông báo/thử lại và tải lại dữ liệu thật.

## Approach

Mở rộng Pointer Events hiện tại, dùng CSS grid xếp nhóm theo thứ tự và kích thước đã chọn. Nhóm tự xuống hàng khi thiếu chỗ. Không cần thư viện dashboard hoặc hệ thống tọa độ tự do.

### 1. Tối ưu nút theo tần suất sử dụng

- Đầu mục Bộ thẻ của bạn chỉ có một nút `+ Tạo mới ▾`, cùng hàng với tiêu đề. Menu gồm `Tạo bộ thẻ`, `Nhập từ tệp`, `Tạo nhóm`. Nhập từ tệp gọi trực tiếp luồng import sẵn có; không bắt người dùng đi qua màn chọn tạo bộ. Đánh đổi có chủ đích: thao tác tạo thêm một lần mở menu để toolbar gọn và có một nơi tìm chung.
- Mỗi deck chỉ hiện hai điểm thao tác: nút học ở đáy và menu `⋯` ở góc trên phải. Nút học có nền nhấn nhẹ, nhãn Bắt đầu học/Ôn ngay, nằm cùng vị trí và không biến mất khi rời chuột.
- Menu deck giữ thứ tự cố định: Quản lý thẻ → Chuyển đến nhóm… → Tùy chỉnh giao diện. Chuyển nhóm mở hộp chọn có tên nhóm hiện tại và lựa chọn Ngoài nhóm; không dùng submenu nhiều tầng. Các hành động hợp lệ dùng cùng vị trí giữa hai chế độ học.
- Bỏ thanh sáu chấm/dropdown riêng. Nếu cần hiển thị nhóm hiện tại, dùng nhãn văn bản nhỏ; không tạo thêm nút trùng chức năng.
- Nhóm chỉ hiện vùng tiêu đề để mở/thu gọn và menu `⋯` bên phải. Chevron là chỉ báo trong cùng vùng bấm tiêu đề, không thêm một nút độc lập. Menu gồm Đổi tên → Đổi vị trí (lên/xuống) → Đặt lại kích thước → Giải tán nhóm; hành động giải tán tách ở cuối và có xác nhận như hiện tại.
- Tay nắm resize ở góc dưới phải khi nhóm mở; hiện rõ khi hover/focus và luôn nhận biết được trên cảm ứng. Không thêm nút Bật chế độ chỉnh sửa trước khi kéo hoặc resize.
- Menu deck và nhóm dùng chung kiểu dấu ba chấm ngang, kích thước và căn lề. Vùng bấm tối thiểu 44×44 px; có nhãn truy cập, focus rõ, mở bằng bàn phím, Escape đóng và trả focus, click ngoài đóng. Menu không bị cắt bởi vùng cuộn của nhóm và tự đổi hướng khi sát mép màn hình.
- Trạng thái đang xử lý chỉ khóa các thao tác cần thiết, hiện nhãn đang thực hiện; tránh nhảy kích thước nút. Thao tác nguy hiểm giữ trong màn quản lý hoặc cuối menu, tránh sát nút học.
- Hướng dẫn kéo/resize là dòng ngắn dưới toolbar; mobile giữ nút Tạo mới dễ thấy và menu đủ rộng để chạm.

### 2. Hover deck

- Nền sáng nhẹ theo theme, viền rõ hơn, bóng nhẹ; transition 150–200 ms.
- Rung một lần khi rê vào, khoảng 250 ms, góc xoay tối đa khoảng 0,4 độ; không lặp liên tục.
- Chỉ bật hover trên thiết bị phù hợp. Tôn trọng settings.reducedMotion và prefers-reduced-motion; vẫn có đổi màu/viền khi giảm chuyển động.
- Hiệu ứng thống nhất cho deck cá nhân và có sẵn; chỉ deck cá nhân được kéo.

### 3. Kéo từ thân deck

- Pointer down trên nội dung tĩnh tạo trạng thái chờ; chuột di chuyển quá ngưỡng hiện tại mới kích hoạt kéo.
- Bỏ qua button/link/input/select/summary/menu và vùng tương tác khác. Chặn click phát sinh sau khi kéo thật để tránh mở học nhầm.
- Touch nhấn giữ để kéo; vuốt trước thời gian giữ vẫn cuộn. Không tắt touch-action trên toàn deck.
- Dùng lại preview, vùng nhận, chèn trước/cuối, giữ mở nhóm, Escape và tự cuộn. Bổ sung tự cuộn vùng nội dung nhóm có overflow.

### 4. Kéo góc resize nhóm

- Tay nắm góc dưới bên phải khi nhóm mở; kéo ngang/dọc chỉnh chiều rộng/chiều cao theo pixel, phản hồi trực tiếp.
- Chiều rộng tối thiểu dự kiến 280–320 px, tối đa vùng chứa. Chiều cao tối thiểu dự kiến 240–280 px. Chốt thông số sau khi xem UI thật.
- Deck tự xuống hàng theo chiều rộng nhóm; cuộn bên trong khi nội dung vượt chiều cao. Pagination luôn tiếp cận được.
- Thu gọn chỉ hiển thị tiêu đề; mở lại khôi phục kích thước. Nhóm mới mặc định như bố cục hiện tại.
- Mobile giới hạn chiều rộng trong màn hình, vẫn chỉnh chiều cao. Đổi viewport thì clamp kích thước hiển thị, giữ giá trị mong muốn để khôi phục khi màn hình rộng.
- Tay nắm có nhãn truy cập và hỗ trợ phím mũi tên; menu có Đặt lại kích thước.

## Changes

- src/components/flashcard/ImportedDecks.tsx: menu Tạo mới chung, nối trực tiếp tạo/import/nhóm, hợp nhất menu deck và chuyển nhóm, thống nhất nút học.
- src/components/ui/OverflowMenu.tsx: bổ sung tùy chọn kiểu trigger phù hợp, xử lý focus và vị trí menu trong vùng cuộn; giữ mặc định tương thích với nơi sử dụng khác.
- src/components/flashcard/DeckGroups.tsx: kết nối toolbar tạo nhóm mà không nhân đôi dialog; drag wrapper có lọc target; resize/lưu/hủy/cleanup.
- src/components/flashcard/deckGroups.css: lưới nhóm và lưới con theo vùng chứa, hover, resize handle, cuộn, mobile, reduced motion.
- src/components/flashcard/DeckCard.tsx: lớp hiệu ứng chung cho deck có sẵn.
- Có thể tách hook resize/lưu kích thước nếu cần giữ DeckGroups gọn; một nơi duy nhất sở hữu state kích thước.
- tests/deckGroups.browser.mjs: cập nhật menu/selector và kiểm chứng drag thân deck, loại vùng nút, resize/lưu/hủy, touch scroll.
- tests/deckGroups.integration.browser.mjs: xác nhận chuyển nhóm/thứ tự qua backend và học từ nhóm sau đổi bố cục.

## Verification

- npm run build; npm test; lint các file thay đổi.
- npm run test:deck-groups và npm run test:deck-groups:integration với backend thử nghiệm theo thiết lập hiện có.
- Hai chế độ học; nhóm trống, tên dài, nhiều nhóm, phân trang, đang tải/lưu, API lỗi.
- Menu Tạo mới mở đúng ba luồng; menu deck/nhóm không trùng nút, không bị cắt khi resize/cuộn, dùng được bằng bàn phím và cảm ứng; Escape/click ngoài đóng đúng, focus trở lại trigger.
- Drag vào/ra nhóm, đổi thứ tự, giữ mở nhóm, Escape, không click nhầm sau kéo.
- Resize hai chiều, min/max, cuộn nội dung, thu gọn/mở lại, reload, đổi viewport, đặt lại, riêng tài khoản.
- Touch cuộn/nhấn giữ/resize; desktop/mobile; theme sáng/tối; reduced motion; menu và resize bằng bàn phím.

## Kết quả

- Hoàn tất menu Tạo mới chung, menu deck/nhóm thống nhất, nút học có nền nhấn nhẹ, hover và kéo từ thân deck.
- Hoàn tất resize hai chiều, hủy Escape, điều chỉnh bằng phím mũi tên, reset, lưu theo tài khoản trên trình duyệt và clamp theo màn hình.
- `npm run build` đạt (còn cảnh báo bundle lớn của Vite); lint các file sửa không có cảnh báo. `npm test`: 87/87 đạt.
- `npm run test:deck-groups`: CRUD, di chuyển/lỗi, kéo chuột/cảm ứng, loại trừ nút học khỏi vùng kéo, resize/lưu/reload/hủy/bàn phím, menu portal/focus và mobile đạt.
- `DECK_GROUPS_TEST_URL=http://127.0.0.1:15176 npm run test:deck-groups:integration`: đạt trên API thật và schema MySQL riêng `deck_ui_verify`; đã kiểm tra ba luồng Tạo mới, thứ tự menu, resize qua reload, sáng/tối/mobile, học tự do/SRS, giải tán giữ thẻ.
- Đã xem ảnh giao diện thật tại `artifacts/deck-groups/app-library.png`, `app-library-dark.png`, `app-mobile.png`.
- Kích thước lưu trên trình duyệt theo tài khoản; chưa đồng bộ giữa thiết bị. Nhóm tự xếp theo thứ tự và chỉ resize khi mở. Chế độ ôn chỉ hiện thao tác tạo nhóm; tạo/import bộ ở trang Bộ thẻ.
