# Tối ưu import, furigana và tùy chỉnh thẻ cá nhân

## Mục tiêu

Đơn giản hóa quá trình tạo bộ thẻ từ file, bảo đảm TXT, CSV, TSV, JSON, XLSX và XLS tạo cùng một kết quả khi chứa cùng dữ liệu, đồng thời cho phép người dùng kiểm tra và sửa dữ liệu trước khi lưu. Thẻ import có thể hiển thị hiragana phía trên Kanji, chọn font và đồng bộ kiểu chữ giữa hai mặt. Khi đang học một bộ import, người dùng có thể sửa trực tiếp nội dung thẻ hiện tại trong màn hình tùy chỉnh.

Phạm vi sửa nội dung chỉ áp dụng cho thẻ thuộc bộ import của tài khoản. Bộ tích hợp N2/N3/N4 tiếp tục chỉ đọc. Bộ tạo thủ công vẫn chỉnh nội dung bằng màn hình quản lý hiện có.

## Nguyên tắc trải nghiệm

Luồng mặc định ưu tiên trường hợp phổ biến và ẩn chi tiết kỹ thuật. Sau khi người dùng nhập tên bộ và chọn file, hệ thống tự nhận dạng định dạng, tiêu đề và ánh xạ cột. Nếu các trường bắt buộc được nhận dạng, giao diện chuyển thẳng đến bản xem trước gọn. Nút **Xem ánh xạ cột** mở cấu hình nâng cao khi người dùng muốn kiểm tra.

Nếu thiếu `front` hoặc `back`, có cột mơ hồ, hoặc toàn bộ dòng không hợp lệ, phần ánh xạ tự mở và nêu rõ việc cần sửa. Không yêu cầu người dùng xác nhận từng sheet hoặc từng cột khi hệ thống đã nhận dạng chắc chắn.

Luồng có ba bước hiển thị rõ:

1. Chọn hoặc kéo thả file.
2. Kiểm tra số thẻ hợp lệ, cảnh báo và một số thẻ mẫu.
3. Nhập bộ thẻ.

Việc đọc file và xem trước vẫn thực hiện tại máy. Đăng nhập chỉ cần khi lưu bộ thẻ lên tài khoản.

## Một schema chung cho mọi định dạng

Schema công khai dùng các trường:

| Trường | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `front` | Có | Mặt trước; có thể chứa cú pháp furigana rõ ràng |
| `back` | Có | Mặt sau |
| `reading` | Không | Cách đọc đầy đủ của mặt trước bằng kana |
| `back_reading` | Không | Cách đọc đầy đủ của mặt sau bằng kana |
| `han_viet` | Không | Âm Hán Việt |
| `note` | Không | Ghi chú |
| `type` | Không | `VOCABULARY`, `KANJI`, `GRAMMAR` hoặc `GENERAL` |
| `tags` | Không | Một hoặc nhiều nhãn |
| `examples` | Không | Danh sách ví dụ; trong bảng dùng chuỗi JSON |

Tên cột cũ như `hanViet`, `notes`, `kind`, `hiragana`, `phien_am`, `nghia` vẫn được chấp nhận để không làm hỏng file hiện có. `reading`, `hiragana` và `phien_am` tiếp tục được hiểu là cách đọc mặt trước; `back_reading`, `back_hiragana` và `mat_sau_reading` là cách đọc mặt sau. Sau khi đọc, mọi định dạng đều được chuyển thành cùng `ImportTable`, rồi qua cùng hàm ánh xạ, kiểm tra giới hạn, chuẩn hóa loại thẻ, phát hiện trùng và tạo `ImportedCard`.

JSON được phép lưu `tags` và `examples` dưới dạng mảng. Trong TXT, CSV, TSV và Excel, `tags` dùng dấu phẩy, chấm phẩy hoặc xuống dòng; `examples` dùng JSON trong một ô. Kết quả cuối phải tương đương với JSON về `front`, `back`, `reading`, `backReading`, `hanViet`, `notes`, `kind`, `tags`, `examples`, nguồn file và nguồn sheet.

TXT hỗ trợ ba cách phổ biến:

- Có dòng tiêu đề, phân cách bằng tab, dấu phẩy hoặc dấu chấm phẩy.
- Không có tiêu đề: cột 1 là `front`, cột 2 là `back`, cột 3 là `reading`.
- Chỉ thị Anki `#separator:Tab`, `#separator:comma` hoặc `#separator:semicolon`.

Parser phải giữ đúng dấu phân cách nằm trong dấu ngoặc kép, ô nhiều dòng, Unicode và BOM. File tối đa 20 MB và 20.000 thẻ như hiện tại.

## Hướng dẫn import duy nhất

Khối **Hướng dẫn cấu trúc file JSON** được thay bằng **Hướng dẫn import thẻ**. Nội dung nằm trong một panel có thể mở từ ô import và gồm:

- Bảng schema chung ở trên.
- Một ví dụ ngắn, có nút chuyển định dạng JSON / TXT-TSV / CSV / Excel mà không thay đổi ý nghĩa dữ liệu.
- Nút tải file mẫu cho JSON, TXT/TSV và CSV.
- Cú pháp furigana và hình xem trước.
- Một prompt có nút **Sao chép prompt** để người dùng chuyển tài liệu thành dữ liệu import.

Prompt chuẩn yêu cầu công cụ tạo dữ liệu chỉ xuất JSON hợp lệ, không dùng Markdown, luôn có `front` và `back`, chỉ thêm `reading` hoặc `back_reading` khi biết chắc, giữ `examples` đúng schema và dùng cú pháp `Kanji[hiragana]` khi cần kiểm soát từng cụm ở một trong hai mặt. Prompt có chỗ rõ ràng để người dùng dán nội dung nguồn ở cuối.

## Furigana

Hệ thống không tự phát sinh cách đọc từ Kanji. Người dùng là nguồn dữ liệu chính thông qua `reading`, `back_reading` hoặc cú pháp chi tiết trong `front` và `back`.

Hai cách nhập được hỗ trợ:

```json
{ "front": "勉強する", "reading": "べんきょうする", "back": "Học" }
```

```text
学校[がっこう]へ行[い]く
```

Quy tắc tương tự áp dụng cho mặt sau qua `back_reading`, ví dụ `{ "back": "学校へ行く", "back_reading": "がっこうへいく" }`. Cả `front` và `back` đều chấp nhận cú pháp `Kanji[hiragana]` khi cần kiểm soát từng cụm.

Với cách nhập trường reading, bộ căn furigana dùng các đoạn kana đã có trong mặt tương ứng làm mốc để ghép cách đọc vào các chuỗi Kanji. Trường hợp một từ chỉ có một chuỗi Kanji được xem là chắc chắn. Khi có nhiều cách ghép hợp lệ hoặc cách đọc không khớp kana mốc, hệ thống không đoán; preview hiển thị cảnh báo và giữ cách đọc thành một dòng riêng cho đến khi người dùng sửa bằng cú pháp chi tiết.

Với cú pháp chi tiết, parser tạo các đoạn `{ text, reading? }` và loại bỏ dấu ngoặc khỏi nội dung hiển thị. Danh sách mặt trước được lưu dưới dạng JSON trong `extraData.frontFuriganaSegments`; danh sách mặt sau nằm trong `extraData.backFuriganaSegments`. `reading` đầy đủ vẫn được lưu ở trường API hiện có; `backReading` được lưu trong `extraData` để không cần migration cơ sở dữ liệu.

Component `FuriganaText` nhận mặt đang hiển thị, nội dung sạch và danh sách đoạn tương ứng, rồi render bằng phần tử HTML `ruby`/`rt`. Kích thước `rt` tỷ lệ theo cỡ chữ chính, không bị in đậm hoặc in nghiêng quá mức và không làm tràn thẻ trên màn hình nhỏ. Thiết lập phiên âm mặt trước/mặt sau hiện có quyết định độc lập có render `rt` trên từng mặt hay không.

Preview import phải hiển thị kết quả ruby thật. Dòng có cú pháp ngoặc sai được đánh dấu là lỗi có thể sửa, không được âm thầm lưu chuỗi hỏng.

## Chỉnh nội dung thẻ hiện tại

Khi mở **Tùy chỉnh** trong phiên học của một bộ import, dialog nhận đúng thẻ hiện tại thay vì một thẻ mẫu. Một khu **Nội dung thẻ hiện tại** cho phép sửa:

- Mặt trước, gồm cú pháp furigana tùy chọn.
- Mặt sau.
- Cách đọc mặt trước.
- Cách đọc mặt sau.
- Hán Việt.
- Ghi chú.
- Loại thẻ.
- Tags.

Preview cập nhật ngay khi nhập. Thay đổi `front`, `back`, `reading` hoặc `backReading` chạy lại bộ phân tích furigana của mặt tương ứng và hiển thị cảnh báo tại chỗ. `front` và `back` không được để trống.

Khi lưu, chỉ gửi `updateCard` nếu nội dung đổi và chỉ gửi `updateDeck` nếu template đổi. UI cập nhật thẻ trong `sessionCards` sau khi server xác nhận, giữ nguyên vị trí hiện tại và lịch SRS. Nếu một request thất bại, dialog vẫn mở, nêu rõ phần chưa lưu và tải lại dữ liệu đã được server chấp nhận để tránh trạng thái giả.

Dialog chỉnh nội dung không xuất hiện với bộ tích hợp hoặc bộ thủ công. Bộ thủ công tiếp tục dùng trình quản lý thẻ hiện có.

## Font và đồng bộ kiểu chữ

`CardSideStyle` được mở rộng thêm `fontFamily` với năm giá trị an toàn:

- `default`: font giao diện hiện tại.
- `notoSansJp`: Noto Sans JP.
- `notoSerifJp`: Noto Serif JP.
- `delaGothicOne`: Dela Gothic One.
- `system`: font hệ thống.

Không cho nhập tên font hoặc CSS tùy ý. Các template cũ được chuẩn hóa về `default`. Font áp dụng cho nội dung chính, reading và ruby; nhãn điều khiển vẫn dùng font giao diện.

Ba font người dùng cung cấp đều dùng SIL Open Font License 1.1. Font được self-host trong dự án, chuyển sang WOFF2 với đầy đủ glyph tiếng Nhật, khai báo `font-display: swap` và chỉ tải khi được dùng. Bản quyền/OFL đi kèm được giữ trong thư mục font. Noto Sans JP và Noto Serif JP dùng variable weight; Dela Gothic One chỉ có Regular nên vùng thẻ cho phép CSS tổng hợp weight/style để nút in đậm và in nghiêng vẫn tạo khác biệt nhìn thấy được.

Các tùy chỉnh hiện có gồm theme, cỡ chữ nhanh, cỡ chữ chính xác 12–72 px, in đậm, in nghiêng và căn chữ tiếp tục lưu riêng theo mặt. Nút **Áp dụng kiểu này cho cả hai mặt** sao chép toàn bộ `style` của mặt đang xem sang mặt còn lại. Đây là thao tác một lần; sau đó hai mặt vẫn có thể chỉnh riêng. Nút không sao chép danh sách trường nội dung.

Dialog được tổ chức lại thành ba nhóm theo thứ tự:

1. Nội dung thẻ hiện tại, chỉ khi có quyền sửa.
2. Nội dung hiển thị của mặt trước/mặt sau.
3. Kiểu chữ và giao diện.

Trên desktop, điều khiển ở trái và preview cố định ở phải. Trên mobile, preview xuất hiện trước nhóm kiểu chữ để người dùng thấy kết quả mà không phải cuộn qua toàn bộ form.

## Trạng thái và tương thích

Template cũ thiếu `fontFamily`, `fontSize`, `bold` hoặc `italic` được bổ sung mặc định trong `normalizeDeckTemplate`. Không thay đổi ý nghĩa `fontScale`; nó tiếp tục xác định preset và hỗ trợ dữ liệu cũ.

Thẻ cũ không có các danh sách furigana vẫn hiển thị như hiện tại. Nếu có `reading` hoặc `backReading`, component chỉ tạo đoạn furigana khi phép căn theo kana cho đúng một kết quả; không ghi ngược dữ liệu cho đến khi người dùng lưu thẻ.

Draft import giữ file, mapping, sửa nội dung preview và cảnh báo trong phiên trang. Chuyển giữa hướng dẫn và preview không xóa draft. Chọn file mới thay draft sau khi người dùng xác nhận nếu draft hiện tại đã được sửa.

## Lỗi và khả năng truy cập

Thông báo lỗi phải nêu hành động sửa được, ví dụ “Không tìm thấy cột mặt sau” hoặc “Cú pháp furigana thiếu dấu `]` ở dòng 14”. Danh sách bỏ qua giữ số dòng và sheet. Cảnh báo furigana không làm mất thẻ nếu `front`/`back` vẫn hợp lệ; người dùng có thể nhập nhưng cách đọc sẽ nằm riêng cho đến khi sửa.

Kéo thả file có nút chọn file tương đương. Mọi điều khiển dùng được bằng bàn phím, có nhãn truy cập, trạng thái `aria-pressed` và focus rõ. Ruby dùng nội dung mặt chữ làm văn bản chính nên trình đọc màn hình vẫn đọc được khi không hỗ trợ `rt`.

## Kiểm thử chấp nhận

- Cùng một bộ dữ liệu ở JSON, TXT, CSV, TSV, XLSX và XLS tạo các `ImportedCard` tương đương, bao gồm tags, examples và furigana của cả hai mặt.
- TXT có/không có tiêu đề, chỉ thị Anki, BOM, Unicode, ô trích dẫn và nhiều dòng đều hoạt động.
- Mapping tự động đưa người dùng thẳng đến preview khi chắc chắn; trường hợp mơ hồ tự mở phần sửa mapping.
- Furigana đơn giản tự căn đúng ở cả mặt trước và mặt sau; câu phức tạp dùng cú pháp `Kanji[hiragana]`; cú pháp lỗi được chỉ rõ.
- Tắt phiên âm theo từng mặt chỉ ẩn `rt` của mặt đó và không xóa dữ liệu.
- Dela Gothic One, Noto Sans JP và Noto Serif JP hiển thị đúng nội dung Nhật; font, cỡ chữ, đậm, nghiêng và căn chữ giống trong preview và phiên học sau khi tải lại.
- **Áp dụng kiểu này cho cả hai mặt** chỉ sao chép style.
- Trong phiên học bộ import, sửa thẻ hiện tại cập nhật ngay sau khi lưu và còn đúng sau khi tải lại.
- Bộ tích hợp và bộ thủ công không có trình sửa nội dung trong dialog tùy chỉnh.
- Import, lưu template và cập nhật thẻ có kiểm thử lỗi mạng, retry và không tạo bản sao ngoài ý muốn.

## Ngoài phạm vi

- Tự động suy luận cách đọc Kanji bằng AI hoặc từ điển.
- Cho phép CSS, HTML hoặc font tải từ URL trong dữ liệu import.
- Sửa nội dung bộ tích hợp N2/N3/N4.
- Thay đổi thuật toán SRS hoặc dữ liệu tiến trình khi sửa nội dung thẻ.
