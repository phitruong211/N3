# Đặc tả thiết kế: Sổ học N3/N4

Ngày: 2026-09-19. Trạng thái: đề xuất để duyệt. Căn cứ: [DESIGN_RESEARCH.md](../../../DESIGN_RESEARCH.md) và khảo sát mã/JSON trong dự án.

## Mục tiêu và giới hạn

Thiết kế lại toàn bộ giao diện thành một công cụ học tiếng Nhật yên tĩnh, rõ mục tiêu ghi nhớ và dùng được lâu trên điện thoại lẫn desktop. Người học Việt Nam phải nhận ra ngay việc cần làm tiếp, đọc được chữ Nhật trước metadata và ôn bằng tự nhớ trước khi xem đáp án. Giao diện có một hệ thống màu, chữ, khoảng cách và thành phần chung; không sao chép nhận diện của sản phẩm tham chiếu.

Giữ nguyên nội dung các JSON, ID chuẩn hóa, bookmark, thẻ SRS, cài đặt, các phím tắt hữu ích, chức năng tìm kiếm và thuật toán lịch ôn. Không thêm tài khoản, đồng bộ mạng, kho ví dụ hoặc cơ chế XP. Các chức năng đã có tiếp tục hoạt động sau thay đổi giao diện.

## Hướng thị giác và hệ thống thiết kế

“Sổ học” dùng nền trắng ngà, panel trắng, chữ than và viền mảnh. Màu chỉ đánh dấu loại nội dung: xanh cho từ vựng, hổ phách cho ngữ pháp, tím cho kanji; xanh lá và đỏ cho kết quả. Không phủ toàn bộ thẻ bằng màu loại nội dung, dùng gradient hoặc bóng dày. Theme tối dùng nền than `#151816`, panel `#202420`, chữ `#F1F1EB` và màu học sáng hơn. Theme reading/high-contrast vẫn có token đầy đủ; không để mã màu trực tiếp trong trang phá theme.

Token chính ở `src/index.css`: nền, panel, panel phụ, viền, chữ chính/phụ, ba màu học, đúng/sai, focus, khoảng cách và bán kính. Mức khoảng cách: 4/8/12/16/24/32/48 px. Điều khiển cao ít nhất 44 px trên điện thoại; focus nhìn rõ và hỗ trợ giảm chuyển động. Noto Serif JP dành cho mục tiêu chữ Nhật, Noto Sans JP cho cách đọc/ví dụ, Be Vietnam Pro cho giao diện tiếng Việt với font hệ thống dự phòng. Các trường dài phải xuống dòng, không cắt nội dung quan trọng.

Thành phần dùng chung có phạm vi nhỏ: `PageHeading`, `FilterBar`, `ContentBadge`, `EmptyState`, `SectionPanel`, `StudyProgress`, `StudyShell` và các nút/ô nhập cơ bản. Dùng chung token và cấu trúc điều khiển; riêng bố cục nội dung từ vựng, ngữ pháp và kanji vẫn phản ánh cách học khác nhau. Chỉ tách thành phần khỏi file lớn khi nó thực sự được dùng ở nhiều nơi hoặc giúp phiên học nhất quán.

## Kiến trúc, nguồn dữ liệu và trạng thái

`src/lib/data.ts` chuẩn hóa năm nguồn JSON; `AppProvider` giữ mảng học, trang hiện tại, mục tìm kiếm đích, bookmark và SRS. `localStorage` là nguồn bền vững cho tiến độ/cài đặt. Đổi giao diện không đổi ID, cấu trúc lưu hoặc tạo bản sao dữ liệu. Bộ lọc, mục đang chọn và phần mở rộng là trạng thái tạm trong từng trang. Số cần ôn và số đã học được dẫn xuất từ dữ liệu và SRS hiện có.

Phạm vi dữ liệu: N3 từ vựng 677 mục giàu trường, N4 từ vựng 603 mục phẳng, ngữ pháp N3 96 mục, N4 83 mục, kanji 246 mục. Mỗi khung chi tiết phải xử lý trường thiếu. Kanji không có âm On/Kun độc lập; chỉ hiện cách đọc trong từ ghép. Khi tìm kiếm chọn một mục, trang đích phải hiển thị mục đó ngay cả khi bộ lọc trước đó khác; không để chi tiết cũ lệch danh sách.

Đường đi phiên học: chọn bộ/chế độ → tạo hàng đợi từ dữ liệu hoặc SRS hiện có → hiện câu hỏi → lộ đáp án → chấm/đi tiếp → tóm tắt hoặc thoát. Thoát không chấm mục chưa đánh giá; mục đã chấm giữ tiến độ. Nút và phím không được chấm lặp cùng thẻ. Lỗi tải dữ liệu có trạng thái thông báo và thử lại. Trạng thái rỗng phải có hướng đi tiếp hữu ích.

## Cấu trúc trang và tương tác

| Khu vực | Thiết kế và nội dung ưu tiên |
| --- | --- |
| Vỏ ứng dụng/điều hướng | Desktop: Home, Từ vựng, Ngữ pháp, Kanji, Ôn tập là đích rõ; Quiz, Tiến độ, Đã lưu, Cài đặt nằm nhóm phụ. Điện thoại: năm tab Home, Từ vựng, Ngữ pháp, Kanji, Ôn tập; Tìm ở đầu trang, Flashcards/Quiz mở từ Home hoặc Ôn tập. Giữ `PageId` hiện có và các lối vào cũ; đổi vị trí/nhãn, không xóa màn. |
| Home | Một CTA theo trạng thái: ôn thẻ đến hạn nếu có, nếu không thì bắt đầu bộ N3. Ngay dưới là ba lối vào thư viện và tóm tắt hôm nay (đã học/còn ôn). Chuyển biểu đồ và thống kê chi tiết sang Tiến độ. |
| Từ vựng | Danh sách hiển thị từ Nhật, cách đọc và nghĩa ngắn, cùng tìm/lọc N3/N4/đã lưu. Khung đọc: từ Nhật lớn → cách đọc → nghĩa Việt → Hán Việt/loại từ. Động từ, biến thể, từ liên quan, ghi chú ở phần mở. Mobile dùng danh sách cuộn gọn và khung đọc rõ ngay sau vùng chọn; không có bảng tràn ngang. |
| Ngữ pháp | Danh sách có mẫu và nghĩa cốt lõi. Chi tiết có mẫu → nghĩa → công thức; giải thích, ví dụ, so sánh N4/N5, cảnh báo mở dần. Phân cấp không phụ thuộc vào màu. |
| Kanji | Lưới tra cứu ít nhiễu; chi tiết một chữ lớn, Hán Việt và ba từ ghép đại diện. Từ còn lại mở theo yêu cầu. Cách đọc luôn gắn với từ. |
| Flashcards | Trang chọn bộ N3 đứng trước N4, tùy chọn Anki/thứ tự nằm ngoài phiên. Trong phiên ẩn thanh điều hướng; mặt trước gần như chỉ có chữ/mẫu cần nhớ; mặt sau có đáp án xếp đúng thứ bậc. Điều khiển ở cạnh dưới, rõ nhãn và phím. |
| Ôn tập SRS | Số thẻ đến hạn, số từ mới, CTA ôn/học mới; liên kết sang Flashcards/Quiz. Phiên SRS dùng cùng `StudyShell`, chỉ hiện nút đánh giá sau khi lộ đáp án. |
| Quiz | Chọn loại câu hỏi bằng nhãn ngắn. Khi làm: một câu, bốn đáp án, phản hồi chính xác bằng chữ và màu, tiến độ mỏng; cuối phiên có tóm tắt và làm lại. Bỏ các đoạn giải thích UX ở màn chọn. |
| Tiến độ | Báo cáo ngày học, thẻ đã nhớ, phần yếu và biểu đồ theo một nhịp trung tính; không biến Home thành màn phân tích. Không suy diễn mức thành thạo ngoài dữ liệu SRS. |
| Đã lưu | Danh sách phân loại nhẹ theo từ/ngữ pháp/kanji, mỗi mục mở đúng trang và đúng mục. Trạng thái rỗng giải thích cách lưu. |
| Cài đặt | Nhóm theme, cỡ chữ, âm thanh/hiển thị và dữ liệu theo các panel giống hệ thống chung. Xóa tiến độ vẫn cần xác nhận rõ ràng. |
| Tìm kiếm | Dialog có ô nhập, kết quả nhóm theo loại, chữ Nhật/mẫu nổi bật, nghĩa phụ; bàn phím lên/xuống/Enter/Escape và focus đúng. |

Nhãn giao diện dùng tiếng Việt nhất quán; từ chuyên môn như SRS/Anki có thể giữ khi giúp nhận diện chức năng, kèm mô tả ngắn ngoài màn học.

## Responsive và tiếp cận

320–767 px: một cột, bottom nav năm đích, nội dung học tận dụng viewport, nút ở vùng dễ chạm, safe area; panel chi tiết không đè danh sách hoặc thanh dưới. 768–1023 px: điều hướng gọn, vùng đọc ưu tiên chiều rộng. Từ 1024 px: danh sách và khung đọc hai cột khi hữu ích; phiên học vẫn lấy trung tâm. Không cuộn ngang ở 320 px; chuỗi Nhật dài và bản dịch dài xuống dòng. Dialog có tên truy cập, focus được quản lý khi mở/đóng; nút có nhãn; trạng thái không truyền bằng màu đơn độc. Theme tối, reading, high-contrast phải giữ phân cấp và tương phản.

## Phạm vi refactor và triển khai

Đổi token và primitives trước, sau đó vỏ/điều hướng, rồi Home và ba thư viện, phiên học, các trang phụ. `FlashcardPage.tsx` rất lớn nên tách vỏ phiên học và điều khiển chung trước khi làm lại ba mặt thẻ; không thay lịch SRS. `Dashboard.tsx` bỏ phụ thuộc biểu đồ khỏi tuyến tải Home nếu biểu đồ chỉ còn ở Tiến độ. Các trang dùng dữ liệu chuẩn hóa sẵn; không thay JSON. Dọn lớp CSS cũ khi màn tương ứng chuyển sang hệ mới để tránh hai hệ màu chạy song song.

## Tiêu chí hoàn thành

Tất cả 10 màn và các phiên học dùng cùng token/thành phần, không còn nhãn tiếng Anh không cần thiết hoặc màu trang riêng tùy ý. Người học thấy mục cần nhớ trước dữ liệu phụ, gọi được hành động chính trong 2–3 giây, và dùng điện thoại 320/375 px không tràn ngang hay bị thanh điều hướng che nội dung. Kiểm tra desktop, tablet, bốn theme, bàn phím/focus, empty/loading/error, N4 thiếu trường, chữ Nhật và nghĩa Việt dài. Kiểm thử luồng tìm → mục, bookmark, flashcard/SRS/Quiz, thoát/hoàn tất và giữ tiến độ sau tải lại. Chạy `npm run build`, kiểm tra TypeScript từ build, `npm run lint` và rà soát diff; sửa lỗi mới trước khi hoàn tất.
