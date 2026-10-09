# Đặc tả thiết kế: Đơn giản hóa trải nghiệm bằng phân tầng

Ngày: 2026-10-10. Trạng thái: hướng thiết kế đã chọn; chờ duyệt đặc tả chi tiết. Phạm vi: frontend React 19, routing, persistence và các sửa lỗi tối thiểu cần thiết để dùng đúng hợp đồng backend hiện có. Không bổ sung một hệ thống tài khoản, thuật toán học hoặc API chuyển dữ liệu Guest mới.

## Mục tiêu

Tối ưu toàn bộ hành trình học để người dùng mới nhìn vào là hiểu bước tiếp theo, trong khi người dùng lâu năm vẫn dùng được các chức năng nâng cao. Thiết kế giữ đầy đủ nội dung, dữ liệu, tiến độ, import, SRS và chức năng tài khoản; thay đổi cách nhóm, đặt tên và bộc lộ chúng.

Kết quả mong muốn:

- Mỗi màn hình có một hành động chính dễ nhận ra trong 2–3 giây.
- Cùng một công việc chỉ có một tên và một lối vào chính.
- Mobile chỉ có năm tab dưới cùng và không dùng chữ nhỏ hơn mức dễ đọc.
- Các tùy chọn hiếm dùng nằm trong menu, panel thu gọn hoặc chế độ nâng cao.
- Người dùng có thể hoàn tất học thử, chọn bộ, bắt đầu học, lật thẻ và tiếp tục mà không cần hiểu thuật ngữ “Anki” hoặc “SRS”.
- Mọi dữ liệu và hành vi đồng bộ hiện có tiếp tục tương thích; thay đổi UI không đặt lại tiến độ.

## Nguyên tắc sản phẩm

1. **Một màn hình, một quyết định chính.** CTA chính dùng màu nhấn; hành động phụ là nút viền, link hoặc menu ba chấm.
2. **Dùng ngôn ngữ của người học.** Giao diện dùng “Bộ thẻ”, “Học tự do”, “Ôn theo lịch”, “Thẻ đến hạn”; “Anki/SRS” chỉ xuất hiện trong trợ giúp khi cần.
3. **Bộc lộ dần.** Điều khiển cơ bản hiển thị trước; thiết lập chính xác, quản trị và vùng nguy hiểm mở theo yêu cầu.
4. **Nhất quán trước trang trí.** Cùng hành động dùng cùng nhãn, component, màu, phím tắt và trạng thái trên mọi trang.
5. **Giữ dữ liệu thao tác.** Lỗi mạng, mở dialog, quay lại hoặc xác thực không làm mất bộ thẻ, bản nháp import hay nội dung đang sửa. Sau xác thực, điều hướng về Hôm nay theo yêu cầu sản phẩm và đặt một CTA tiếp tục thao tác đang dở tại đó.
6. **Nội dung Nhật là trọng tâm.** Badge, metadata và khung trang không cạnh tranh với chữ Nhật, nghĩa và hành động học.

## Hướng thị giác

Giữ phong cách “sổ học Nhật yên tĩnh” đã có: nền kem, panel sáng, chữ than, xanh dương làm màu hành động. Màu nội dung chỉ dùng để nhận biết nhanh: xanh cho từ vựng, tím cho Kanji, cam cho ngữ pháp và xanh lá cho nghe. Không phủ màu toàn bộ card, không dùng gradient hoặc bóng dày.

Giảm số lượng đường viền và pill. Một card chỉ cần viền nhẹ, tiêu đề, thông tin cốt lõi và một CTA. Nhãn trạng thái dùng khi nó thay đổi quyết định của người dùng; “Chỉ đọc” được ghi một lần ở tiêu đề khu bộ có sẵn thay vì lặp trên mọi card.

Khoảng cách dùng thang 4/8/12/16/24/32/48 px. Vùng chạm tối thiểu 44 px. Chữ phụ nhỏ nhất 12 px; màu chữ phụ và màu ngữ pháp phải đạt tương phản WCAG AA. Furigana có cỡ hiển thị tối thiểu 9–10 px và dùng phần tử `ruby`/`rt`.

## Kiến trúc thông tin

### Desktop

Sidebar có thể thu gọn và hiển thị các đích chính:

1. Hôm nay
2. Thư viện
3. Bộ thẻ
4. Ôn tập
5. Trắc nghiệm

Nhóm phụ gồm Tiến độ và Đã lưu. Cài đặt, tài khoản, đăng nhập/đăng xuất nằm ở chân sidebar. Sidebar chỉ xuất hiện đầy đủ từ breakpoint desktop lớn; tablet dùng header và sheet điều hướng để giữ đủ chiều rộng nội dung.

`Từ vựng`, `Ngữ pháp`, `Kanji` và `Luyện nghe` là các tab trong **Thư viện**. Component nội dung hiện có được tái sử dụng bên trong shell mới để giữ lazy loading và tương thích; page shell cũ không tiếp tục tồn tại song song. Route cũ chỉ redirect tới tab mới tương ứng.

Mọi chức năng cũ phải truy cập được trong tối đa hai bước từ điều hướng chính. `Ctrl/Cmd + K` tiếp tục mở tìm kiếm toàn cục. Mỗi route cấp cao được lazy-load và có trạng thái đang tải, lỗi tải và thử lại.

### Mobile

Bottom navigation có đúng năm mục:

- Hôm nay
- Thư viện
- Bộ thẻ
- Ôn tập
- Thêm

`Thêm` mở sheet chứa Trắc nghiệm, Tiến độ, Đã lưu, Cài đặt và tài khoản. Mobile header chỉ giữ logo/tên trang, nút quay lại khi cần và tìm kiếm; không lặp lại toàn bộ điều hướng của bottom bar.

### Tên chức năng

- “Thẻ học” đổi thành **Bộ thẻ**.
- “Anki” không còn là trang điều hướng. Với bộ cá nhân, nó trở thành chế độ **Ôn theo lịch**.
- “Ôn tập” là hàng đợi chung gồm nội dung đến hạn, có thể dẫn đến nội dung tích hợp hoặc bộ cá nhân.
- “Học tự do” là phiên không chấm chất lượng ghi nhớ và không báo độ chính xác giả.

Yêu cầu SRS/Anki hiện có vẫn được giữ ở tầng chức năng và API. Việc đổi tên không thay thuật toán hoặc dữ liệu lịch ôn.

## Điều hướng và URL

Mỗi trang cấp cao có URL ổn định để reload, Back/Forward và deep link hoạt động. Dùng `react-router-dom` đã có trong dự án. `PageId` hiện tại được ánh xạ sang route; trạng thái trang cuối vẫn được ghi nhớ nhưng không ghi đè URL người dùng mở trực tiếp. Dialog, tab và bộ lọc quan trọng có thể dùng query parameter khi điều đó giúp quay lại đúng ngữ cảnh, nhưng không đưa trạng thái tạm của từng thao tác nhập liệu vào URL.

`/library` chuyển tới `/library/vocabulary`; các route sâu `/library/vocabulary`, `/library/grammar`, `/library/kanji` và `/library/listening` dùng được trực tiếp. URL luôn thắng giá trị `lastPage`; `lastPage` chỉ dùng khi mở root `/`. Route không biết hiển thị trang 404 gọn với CTA về Hôm nay, không âm thầm tạo vòng redirect.

| `PageId`/đích cũ | Route chuẩn mới |
| --- | --- |
| `dashboard` | `/today` |
| `vocabulary` | `/library/vocabulary` |
| `grammar` | `/library/grammar` |
| `kanji` | `/library/kanji` |
| `listening` | `/library/listening` |
| `flashcards` | `/decks` |
| `anki` | `/decks?mode=scheduled` |
| `srs` | `/review` |
| `quiz` | `/quiz` |
| `progress` | `/progress` |
| `bookmarks` | `/saved` |
| `settings` | `/settings` |
| `search` | Giữ route nền hiện tại và mở dialog tìm kiếm |

Giá trị `lastPage` cũ được migrate theo bảng này. Phiên học dùng route con `/study/:source/:id`; route cũ chỉ redirect tới route chuẩn và không giữ hai page shell hoạt động cùng lúc.

## Hôm nay

Trang Hôm nay ưu tiên duy nhất một bước tiếp theo theo thứ tự:

1. Có thẻ đến hạn: **Ôn ngay**.
2. Không có thẻ đến hạn nhưng có phiên gần nhất: **Tiếp tục học**.
3. Người mới: **Chọn nội dung đầu tiên**.

Ngay dưới CTA là ba hoặc bốn lối vào thư viện và tóm tắt học trong ngày. Biểu đồ chi tiết nằm ở Tiến độ. Banner kỹ thuật về dữ liệu cũ không xuất hiện toàn ứng dụng; chỉ hiện một thông báo gọn trên Hôm nay khi thực sự có dữ liệu cần xem. `Xem dữ liệu` mở Cài đặt → Tài khoản và dữ liệu. `Để sau` lưu trạng thái dismiss theo namespace Guest/tài khoản cho tới khi dấu vết dữ liệu legacy thay đổi; không tự di chuyển hoặc xóa dữ liệu.

Guest tiếp tục thấy rõ dữ liệu học thử được lưu trên thiết bị. Reload không kết thúc phiên Guest. Khi Guest chọn chức năng cần tài khoản, dialog giải thích lợi ích lưu/đồng bộ và cho `Đăng nhập`, `Đăng ký`, `Tiếp tục học thử`; đóng dialog giữ nguyên ngữ cảnh.

## Thư viện

Đầu trang có tab Từ vựng, Ngữ pháp, Kanji và Luyện nghe. Level dùng segmented control N4, N3, N2 khi nguồn dữ liệu hỗ trợ. Bộ lọc chi tiết nằm trong nút **Bộ lọc** trên mobile và hàng gọn trên desktop.

Mỗi tab giữ cách trình bày phù hợp với nội dung, nhưng dùng cùng `PageHeading`, thanh tìm/lọc, trạng thái tải/rỗng/lỗi và cấu trúc hành động. Khi chọn kết quả tìm kiếm hoặc bookmark, nội dung tương ứng được đưa vào vùng nhìn và không bị bộ lọc cũ ẩn.

## Bộ thẻ

### Trang danh sách

Thứ tự nội dung:

1. Tiêu đề và mô tả ngắn.
2. Bộ thẻ cá nhân, gồm ô **Tạo bộ mới**.
3. Bộ có sẵn, lọc và sắp theo lộ trình N4 → N3 → N2.

Mỗi `DeckCard` dùng cùng cấu trúc: loại nội dung, tên bộ, tổng số thẻ hoặc tiến độ phù hợp và một CTA **Học**. Tổng số lấy từ `DeckSummary`, không suy ra từ trang card đang tải. Bộ rỗng dùng CTA **Thêm thẻ** thay cho Học. Kebab chứa Quản lý, Giao diện thẻ, Đổi tên, Di chuyển và Xóa tùy quyền. Bộ có sẵn không có hành động chỉnh sửa. Drag-and-drop là shortcut desktop; menu có Di chuyển lên/xuống cho mobile và bàn phím. Khi lưu thứ tự, frontend gửi toàn bộ tập ID qua hợp đồng `PUT` hiện có để tránh thứ tự một phần.

Thông tin SRS như “mới/đến hạn” chỉ xuất hiện trong bối cảnh Ôn theo lịch. Học tự do hiển thị tổng thẻ và tiến độ đã xem. Bộ ảo Đã lưu giữ hành vi hiện có và không có menu quản lý.

### Tạo bộ

Ô Tạo bộ mới mở inline. Mặc định cho nhập tên và chọn:

- **Tạo thủ công:** tạo thẻ đầu tiên ngay trong cùng luồng; “Tạo bộ trống” là hành động phụ.
- **Import file:** mở luồng ba bước Chọn file → Kiểm tra → Tạo bộ.

Sau khi thành công, bộ mới xuất hiện ngay trong lưới. Không chuyển người dùng sang trang không liên quan.

### Chuẩn bị phiên học

Nhấn Học mở `StudySetupSheet` dùng chung:

- Chế độ: Học tự do hoặc Ôn theo lịch nếu bộ hỗ trợ.
- Học tự do: số thẻ 10, 20, 50 hoặc Tất cả; thứ tự Theo bộ/Xáo trộn; bài học/chủ đề khi có metadata.
- Tất cả chỉ hiện khi bộ có tối đa 200 thẻ. Bộ lớn hơn dùng lựa chọn **200 thẻ mỗi phiên** và tải card theo lô, không đưa 20.000 card vào DOM hoặc state phiên cùng lúc.
- Ôn theo lịch: hàng đợi do scheduler quyết định; chỉ chọn giới hạn thời gian. Không có Xáo trộn, Đến thẻ hoặc tùy chọn làm thay đổi thứ tự due/new.
- Một CTA **Bắt đầu học**.

Các lựa chọn được ghi nhớ theo bộ khi an toàn, nhưng sheet luôn thể hiện rõ lựa chọn hiện tại.

### Quản lý bộ

Header chỉ có tên bộ và CTA Học. Menu chứa đổi tên, giao diện và xóa. `Thêm thẻ` là CTA phụ rõ ràng. Filter nằm trong một hàng; bulk actions chỉ xuất hiện sau khi người dùng chọn thẻ. Mỗi dòng thẻ hiển thị mặt trước, bản rút gọn mặt sau và menu; chi tiết mở khi chọn.

## Phiên học

Phiên học là route toàn màn hình nằm ngoài `MainLayout`. Sidebar, mobile header và bottom navigation không được render trong route này; khi vào phiên, focus chuyển tới heading/tên bộ. Khi thoát, route trước và focus của nút mở phiên được khôi phục. Phiên học không giả làm modal và không dùng focus trap.

Thanh trên gồm Thoát, tên bộ + tiến độ và menu ba chấm. Ở Học tự do, menu chứa Tùy chỉnh, Xáo trộn, Toàn màn hình và Đến thẻ. Ở Ôn theo lịch, menu chỉ chứa các tùy chọn không làm thay đổi hàng đợi như Tùy chỉnh và Toàn màn hình. Phần giữa dành cho card. Thanh dưới luôn có nút thật **Hiện đáp án**; nhấn vào card chỉ là shortcut phụ.

Sau khi hiện đáp án:

- Học tự do: **Thẻ tiếp**.
- Ôn theo lịch: `Quên · Khó · Nhớ · Dễ`, dùng chung thứ tự, màu, interval và phím 1–4 ở mọi phiên.

Card là `article`/`div`, không dùng `role="button"` bao quanh button con. Nút Thoát có accessible name trên mọi breakpoint. Mobile giữ CTA chính luôn nhìn thấy; các điều khiển ít dùng nằm trong menu.

Học tự do chỉ lưu tập thẻ đã xem, vị trí tiếp tục và thời gian học chung. Nó không ghi rating, due date, trạng thái new/learning/review, `newCardsLearned` hoặc accuracy vào SRS. Nếu mô hình thống kê cũ gộp “đã xem” với “đã ôn”, cần bổ sung metric trung tính hoặc chỉ dùng tổng thời gian thay vì ghi sai nghĩa. Kết thúc hiển thị “Đã xem X/Y thẻ” và thời gian, không suy diễn 100% chính xác. Kết thúc Ôn theo lịch mới hiển thị kết quả dựa trên đánh giá thực tế. Thoát giữa chừng không đánh giá thẻ chưa hoàn tất.

## Import

Luồng import và schema giữ theo đặc tả `2026-10-10-import-furigana-card-editor-design.md`. Giao diện được rút gọn:

1. Chọn hoặc kéo file.
2. Xem số hợp lệ, số bỏ qua và tối đa ba thẻ mẫu.
3. Xác nhận tạo bộ.

Ánh xạ cột tự động mở phần nâng cao chỉ khi thiếu `front/back`, cột mơ hồ hoặc người dùng chọn **Xem ánh xạ**. Toàn bộ định dạng TXT, CSV, TSV, JSON, XLSX và XLS đi qua cùng schema chuẩn hóa. Giữ giới hạn 20 MB/20.000 thẻ, thông tin dòng/sheet, chuẩn hóa Unicode, phát hiện trùng, transaction và idempotency khi xác nhận.

Khi có 0 thẻ hợp lệ, trạng thái là lỗi và nút tạo bị khóa. Lỗi được nhóm theo nguyên nhân, hiển thị số lượng và một số dòng mẫu; không render hàng trăm lỗi giống nhau. CTA xác nhận nằm cố định ở đáy khi nội dung dài. Hướng dẫn import có ví dụ ngắn, file mẫu, cú pháp `Kanji[hiragana]` và prompt sao chép; chi tiết nằm trong dialog/tab thay vì luôn chiếm diện tích.

## Tùy chỉnh và sửa thẻ

Tách ba nhiệm vụ:

1. **Sửa nội dung thẻ:** chỉ với bộ import có quyền sửa.
2. **Nội dung hiển thị:** chọn trường và thứ tự mặt trước/mặt sau.
3. **Giao diện thẻ:** font, cỡ chữ, căn, đậm/nghiêng và theme.

Dialog mở ở tab **Cơ bản** gồm preset cỡ chữ, font, căn chữ và toggle đồng bộ hai mặt. Template mới mặc định hai mặt dùng cùng style. Template cũ đã có style hai mặt khác nhau được mở với **Chỉnh riêng từng mặt** bật sẵn; hệ thống không tự sao chép hoặc ghi đè style cũ. Cỡ px chính xác, field order và theme riêng nằm trong **Nâng cao**.

Preview luôn cùng viewport với điều khiển trên desktop. Mobile có vùng preview gọn phía trên hoặc bottom sheet **Xem trước**. Thanh Hủy/Lưu sticky ở đáy. Nội dung, template và tiến độ được lưu tách biệt; sửa thẻ không đặt lại lịch ôn.

## Ôn tập

Ôn tập là điểm vào chung cho nội dung đến hạn. Trang hiển thị số thẻ đến hạn, thẻ mới và tổng đang theo dõi, sau đó một CTA **Bắt đầu ôn**. Khi cần chọn nguồn, dùng nhóm gọn theo Thư viện và Bộ thẻ; không nhúng toàn bộ lưới quản lý bộ cá nhân vào trang Ôn tập.

Hàng đợi giữ nguyên quy tắc hiện có: đến hạn trước, thẻ mới sau, thẻ quá hạn lâu hơn đứng trước. Interval 1/10/60 phút và thuật toán hiện tại không thay đổi. Chỉ tính thời gian khi tab ở foreground; khi hết giới hạn, người dùng hoàn tất thẻ hiện tại rồi phiên mới dừng. Kết quả gửi đúng API hoặc storage theo loại phiên và trạng thái Guest/tài khoản.

## Cài đặt

Trang Cài đặt có bốn section:

- Tài khoản
- Giao diện
- Khi học
- Ôn tập

Đổi nhãn “Cỡ chữ” thành **Cỡ chữ giao diện**; trong tùy chỉnh card dùng **Cỡ chữ thẻ**. “Thời gian phiên Anki” đổi thành **Giới hạn thời gian ôn**. Furigana toàn cục đổi thành **Hiện furigana khi có dữ liệu**; tắt thiết lập này ẩn ruby ở cả hai mặt nhưng không xóa dữ liệu. Khi bật, template từng mặt tiếp tục quyết định mặt nào được render ruby. Lựa chọn field trên card dùng **Nội dung có trên mặt thẻ**.

Preview nằm trong section liên quan trên desktop và được thu gọn trên mobile. Các lựa chọn preset có `aria-pressed`. Xóa dữ liệu nằm trong `<details>` **Vùng nguy hiểm** và vẫn cần xác nhận.

## Component và ranh giới mã

Chuẩn hóa các component nhỏ có một trách nhiệm:

- `AppNavigation`: route, sidebar, mobile tabs và More sheet.
- `DeckCard` và `DeckGrid`: trình bày bộ, không chứa logic import/quản lý.
- `StudySetupSheet`: tạo cấu hình phiên học.
- `StudyShell`: focus, header, card viewport và sticky action bar.
- `RatingControls`: một bộ đánh giá dùng chung.
- `Modal`/`Dialog`: focus trap, Escape, scroll lock và trả focus.
- `OverflowMenu` và `SegmentedControl`: hành vi dùng chung, có keyboard support.
- `CardEditor`: sửa nội dung thẻ.
- `DeckAppearanceDialog`: field visibility và style.
- `ImportSummary`: số hợp lệ, lỗi nhóm và preview.

`FlashcardPage.tsx`, `ImportedDecks.tsx` và `CardPresentation.tsx` được tách theo các ranh giới trên khi chạm vào luồng tương ứng. Xóa session legacy chỉ sau khi xác nhận không còn import. Không refactor các module dữ liệu/thuật toán không liên quan.

## Trạng thái và lỗi

Mọi trang có loading, empty, error và retry rõ ràng. Toast chỉ dùng cho kết quả thao tác ngắn; lỗi cần sửa nằm cạnh điều khiển. Nút gửi có trạng thái đang xử lý và chống bấm lặp. Cập nhật lạc quan phải rollback khi server từ chối.

Lỗi mạng không làm mất bản nháp import, nội dung thẻ đang sửa hoặc lựa chọn phiên học. Khi frontend và backend chưa hỗ trợ một khả năng đồng bộ, giao diện ghi đúng “lưu trên thiết bị” thay vì hứa đồng bộ tài khoản.

## Guest, xác thực và đồng bộ

Trang xác thực hiện tại được giữ phong cách và cấu trúc chính, gồm ba lối rõ ràng: Đăng nhập, Đăng ký và Học thử. Trên mobile có thể rút gọn khối khẩu hiệu để form xuất hiện sớm. Sau khi đăng nhập hoặc đăng ký thành công, ứng dụng về **Hôm nay** theo yêu cầu hiện tại. Nếu xác thực bắt đầu từ import/tạo bộ đang dở, Hôm nay hiển thị CTA **Tiếp tục tạo bộ**; ứng dụng không tự xác nhận hoặc tạo deck.

Nút đăng nhập ở sidebar mở trực tiếp form đăng nhập. Dialog lựa chọn Đăng nhập/Đăng ký/Tiếp tục học thử chỉ dùng khi Guest chạm chức năng bị khóa. Guest học nội dung tích hợp, tìm kiếm, bookmark, SRS cục bộ của nội dung tích hợp, quiz và nghe mà không phát request tới API tài khoản. Lưu/CRUD deck và review Ôn theo lịch của bộ cá nhân server-backed mới yêu cầu tài khoản. Namespace `guest:*` không bị xóa khi reload hoặc do kiểm tra token thất bại và luôn tách khỏi `user:<id>:*` cùng `auth:*`. Dữ liệu tài khoản A không được hiển thị khi đăng nhập tài khoản B.

Chuyển dữ liệu Guest sang tài khoản vẫn là khả năng tương lai theo SRS và không thuộc lần đơn giản hóa UX này khi API chưa tồn tại. Nếu capability API đã có, UI chỉ chạy sau khi người dùng đồng ý, giữ tiến độ tài khoản khi trùng và chỉ xóa nguồn sau ACK server; nếu chưa có, giao diện nói rõ dữ liệu Guest vẫn nằm trên thiết bị.

## Responsive và accessibility

- 320–767 px: một cột, năm bottom tab, không cuộn ngang ở 320/375 px, sticky CTA không che nội dung và hỗ trợ safe area.
- 768–1023 px: dùng mobile/tablet navigation; không ép sidebar 240 px vào màn hình hẹp.
- Từ 1024 px: sidebar và bố cục nhiều cột khi có lợi cho đọc/preview.
- Dialog quản lý focus, Escape, tên truy cập và trả focus.
- Mọi thao tác drag có phương án menu/bàn phím.
- Không lồng button trong phần tử button giả.
- Trạng thái không truyền bằng màu duy nhất; focus ring rõ; hỗ trợ `prefers-reduced-motion`.
- Tertiary text, grammar pill và mọi chữ nhỏ đạt WCAG AA.
- Bốn theme, ba cỡ chữ giao diện và các font Nhật hiện có tiếp tục hoạt động; trạng thái chọn dùng `aria-current`, `aria-pressed` hoặc `aria-expanded` phù hợp.

## Tương thích và di chuyển

Không đổi ID nội dung, deck/card schema, thuật toán SRS hoặc ý nghĩa dữ liệu đã lưu chỉ để phục vụ UI. Route cũ có redirect. Khóa localStorage hiện có được đọc và chuẩn hóa; chỉ thêm version/migration khi thật sự đổi shape. Tùy chỉnh template cũ thiếu field tiếp tục nhận mặc định an toàn.

Frontend chỉ gọi các hợp đồng backend hiện có trong phạm vi này. Nếu phát hiện lỗi bắt buộc phải sửa ở endpoint hiện có, thay đổi phải tương thích ngược và có contract/integration test; không đổi response đột ngột. Tiến độ bộ có sẵn chỉ được gọi là đồng bộ đa thiết bị khi API tương ứng tồn tại và đã kiểm thử.

## Trình tự triển khai

1. Token, component nền và route mapping.
2. Sidebar, bottom navigation, More sheet và Guest session persistence.
3. Hôm nay và Thư viện.
4. Danh sách Bộ thẻ, `DeckCard` và `StudySetupSheet`.
5. Hợp nhất session shell, CTA mobile, rating và accessibility.
6. Quản lý bộ, import summary và dialog tùy chỉnh phân tầng.
7. Ôn tập, Settings và thông báo dữ liệu.
8. Dọn legacy, kiểm thử hồi quy và visual QA ở các breakpoint/theme.

Mỗi bước phải có thể build và kiểm thử độc lập. Không giữ hai lối UI mới/cũ cùng hoạt động lâu hơn giai đoạn chuyển màn tương ứng.

## Kiểm thử chấp nhận

- Người mới từ trang chào có thể vào học thử và bắt đầu một phiên học trong tối đa ba quyết định chính; mọi chức năng cũ truy cập được trong tối đa hai bước từ navigation chính.
- Reload trong Guest giữ trạng thái Guest, trang gần nhất, bookmark và tiến độ cục bộ.
- Desktop không cần cuộn sidebar ở viewport cao 720 px; tablet không bị sidebar ép hẹp.
- Mobile 320/375/390 px có đúng năm tab, vùng chạm tối thiểu 44 px và không tràn ngang.
- Back, Forward, reload và deep link mở đúng trang; route cũ cùng các giá trị `flashcards`/`anki`/`srs` chuyển đúng đích.
- Từ Bộ thẻ, người dùng chọn bộ, cấu hình 10/20/50 hoặc tất cả với bộ tối đa 200 thẻ và bắt đầu học mà không phải hiểu Anki; bộ lớn tải theo lô tối đa 200 thẻ mỗi phiên.
- Học tự do không báo accuracy giả; Ôn theo lịch dùng đúng một bộ Quên/Khó/Nhớ/Dễ và giữ tiến độ sau reload.
- CTA Hiện đáp án/Thẻ tiếp hoặc nút đánh giá luôn thấy trên mobile.
- Screen reader không truy cập sidebar hoặc bottom nav phía sau phiên học/dialog.
- Bộ cá nhân hiển thị trước bộ có sẵn; bộ tích hợp không kéo thả hoặc có menu chỉnh sửa.
- Import 0 thẻ hợp lệ không thể xác nhận; lỗi lặp được nhóm; bản nháp/mapping không mất khi đăng nhập hoặc lỗi mạng; retry không tạo bộ trùng.
- Template mới đồng bộ style mặt trước/sau mặc định; template cũ có style khác nhau tự bật chỉnh riêng và không bị ghi đè; preview giống phiên học sau tải lại.
- Settings dùng nhãn dễ hiểu, phần nâng cao và vùng nguy hiểm được thu gọn.
- Dữ liệu, bookmark, deck/card, template và lịch ôn cũ không bị mất hoặc đặt lại.
- `npm run build`, `npm run lint`, `npm test`, `npm run test:guest` và các browser test Guest/SRS liên quan đều qua; nếu sửa endpoint hiện có thì chạy thêm integration/scale backend tương ứng; visual QA bao phủ desktop, tablet, mobile, bốn theme và nội dung dài.

## Ngoài phạm vi

- Thay thuật toán SRS hoặc mô hình cơ sở dữ liệu chỉ để đổi giao diện.
- Tự sinh furigana bằng AI/từ điển.
- Viết lại toàn bộ ứng dụng hoặc thay framework.
- Thêm game hóa, XP, streak mới hoặc mạng xã hội.
- Xóa chức năng hiện có; các chức năng ít dùng được chuyển vào tầng phù hợp.
- Xây API chuyển dữ liệu Guest mới; UI chỉ dùng capability này khi backend đã cung cấp.
