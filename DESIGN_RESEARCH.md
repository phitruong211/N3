# Nghiên cứu thiết kế — ứng dụng học tiếng Nhật N3/N4

Ngày khảo sát: 2026-09-19. Phạm vi: trang sản phẩm, hướng dẫn và ảnh giao diện công khai của chính các sản phẩm; một số màn học yêu cầu đăng nhập nên nhận xét dưới đây giới hạn ở những gì nguồn công khai xác nhận. Đây là nghiên cứu về mẫu tương tác, không phải nguồn tài sản để sao chép.

## 1. Hiện trạng dự án

- Ứng dụng React/Vite có Home, Từ vựng, Ngữ pháp, Kanji, Flashcards, SRS, Quiz, Tiến độ, Đã lưu và Cài đặt. `AppProvider` giữ dữ liệu và điều hướng; tiến độ, bookmark và cài đặt lưu trong `localStorage`. Tìm kiếm toàn cục dùng Fuse và mở mục được chọn.
- Điều hướng desktop liệt kê 10 đích; điện thoại có Home, Từ vựng, Ôn tập, Flashcard, Tìm, Thêm. Ngữ pháp và Kanji bị giấu ở “Thêm” dù là nội dung chính. Tên màn trộn tiếng Anh và tiếng Việt.
- Nhiều trang tự dùng màu, bán kính, bóng và badge khác nhau; `src/index.css` có token nhưng các trang còn nhiều mã màu trực tiếp. Home vẫn mang nhiều chỉ số và biểu đồ; trang chọn flashcard có banner Anki và nhiều bộ thẻ trước khi học. Thông tin hướng dẫn về cơ chế học nằm ngay trong giao diện sản phẩm.
- Từ vựng dùng bảng và khung chi tiết; Ngữ pháp dùng danh sách mở rộng và khung chi tiết; Kanji dùng lưới. Trên điện thoại danh sách và chi tiết xếp dọc nên hành động chọn mục và nội dung học đôi khi cách xa nhau. Flashcard có ba phiên gần giống nhau trong một file hơn 2.000 dòng.
- JSON thực tế: 677 từ N3 giàu thông tin động từ, biến thể và liên quan; 603 từ N4 dạng phẳng; 96 mẫu N3 có công thức, giải thích, so sánh, ví dụ; 83 mẫu N4 đơn giản hơn; 246 kanji có Hán Việt và từ ghép. JSON kanji không có âm On/Kun riêng. Thiết kế phải chấp nhận trường trống và bản dịch dài, giữ ID và tiến độ hiện tại.
- Dự án không có thư mục `styles/` riêng; CSS nền ở `src/index.css`. `.agents/skills/ui-ux-pro-max/SKILL.md` không có trong checkout hiện tại.

## 2. Tham chiếu sản phẩm

| Sản phẩm và nguồn chính thức | Điều làm tốt và lý do | Mẫu phù hợp với dự án | Không sao chép | Phù hợp tiếng Nhật? |
| --- | --- | --- | --- | --- |
| [WaniKani](https://knowledge.wanikani.com/getting-started/unlocking-vocabulary/) | Bài học tách cấu tạo, nghĩa, cách đọc và ngữ cảnh; từng bước giảm lượng thông tin phải xử lý. | Từ/kanji lớn, lớp thông tin thứ cấp mở sau khi nhận diện. | Màu thương hiệu và cơ chế khóa bài theo cấp. | Có, nhất là từ ghép và kanji. |
| [Bunpro](https://community.bunpro.jp/t/grammar-library-beta-feedback-thread/167619) | Thư viện ngữ pháp phân tầng có thể thu gọn theo bài/cấp, hỗ trợ tra cứu và học. | Danh sách ngữ pháp rõ mẫu, nghĩa, mức; chi tiết chia công thức, ví dụ, so sánh. | Ghost review và toàn bộ độ phức tạp SRS riêng. | Có, dữ liệu N3 có sẵn so sánh và ví dụ. |
| [Renshuu](https://app.renshuu.org/) | Kết nối từ, kanji, ngữ pháp quanh việc học và tra cứu; giảm chuyển ngữ cảnh. | Dẫn từ mục học sang nội dung liên quan khi dữ liệu có thật. | Mật độ tính năng và gamification rộng. | Có, nhưng chỉ với các quan hệ JSON cung cấp. |
| [MaruMori](https://marumori.io/) | Bài học ngữ pháp đi tới bài ôn; kanji được đặt trong từ vựng. | Chuyển mềm giữa “hiểu” và “tự nhớ”, ba từ đại diện cho kanji. | Bản đồ phiêu lưu, nhân vật và phần thưởng. | Có; đặc biệt hữu ích khi kanji thiếu âm riêng. |
| [JPDB](https://jpdb.io/) | Gắn từ vựng với ngữ cảnh và theo dõi tiến độ giữa các bộ thẻ. | Hiện ví dụ/ngữ cảnh sau đáp án, dùng trạng thái SRS sẵn có để ưu tiên ôn. | Thuật toán độc quyền và kho câu ví dụ không tồn tại trong dự án. | Có nếu giới hạn ở dữ liệu thật. |
| [Duolingo](https://blog.duolingo.com/guide-to-duolingo-practice-hub/) | Vùng Practice tập trung vào từ, lỗi và kỹ năng cần ôn; người học nhận ra hành động tiếp theo ngay. | Home có một CTA “Ôn hôm nay”, kế đó mới là học mới và đường vào thư viện. | XP, linh vật, sắc màu dày và áp lực chuỗi ngày. | Một phần; hướng hành động phù hợp, thị giác cần yên tĩnh hơn. |
| [Busuu](https://help.busuu.com/hc/en-us/articles/16941990776593-How-can-I-review-my-vocabulary) | Thẻ ẩn bản dịch cho tự nhớ, hỗ trợ âm thanh và xem lại từ yếu/trung bình/mạnh. | Mặt trước ít tín hiệu, lật mới xem nghĩa; tra từ đã học theo sức nhớ. | Phân loại sức nhớ mới nếu không khớp dữ liệu SRS hiện có. | Có, nhất là học từ và âm đọc. |
| [LingQ](https://www.lingq.com/en/learn-japanese-online/) | Từ được học trong ngữ cảnh đọc, trạng thái đã biết/đang học dễ nhận diện. | Đặt ví dụ và từ liên quan sau nghĩa, ưu tiên đọc tiếng Nhật. | Trình đọc và nhập nội dung mới ngoài phạm vi. | Có với ví dụ hiện có; không bịa câu. |
| [Anki](https://docs.ankiweb.net/studying.html) | Câu hỏi hiện trước; đáp án và các mức nhớ chỉ xuất hiện sau tự nhớ, phím tắt rõ. | Màn học toàn viewport, chỉ một mục, tiến độ mỏng, nút chấm điểm sau lật. | Giao diện cấu hình bộ thẻ dày và thuật ngữ thuật toán trong luồng học. | Rất phù hợp cho SRS hiện có. |
| [Quizlet](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) | Lật bằng chạm, điều hướng bằng mũi tên, xáo thẻ và tách “đang học/đã biết”. | Chạm/lật, phím tắt và tùy chọn thứ tự trước phiên; thao tác trên điện thoại dễ chạm. | Biến mọi thao tác thành nhiều chế độ và tùy chọn trên màn học. | Có cho flashcard tự học. |

## 3. Mẫu chấp nhận, nguyên tắc và mẫu loại bỏ

- **Chấp nhận:** một hành động học chính mỗi màn; tách tra cứu khỏi tự kiểm tra; hỏi trước rồi mới lộ đáp án; thông tin Nhật → cách đọc → nghĩa Việt theo trật tự; chi tiết ngữ pháp/biến thể chỉ mở khi cần; dùng trạng thái SRS hiện có cho “cần ôn”. Đây là suy luận thiết kế từ các nguồn trên, không phải tuyên bố mọi sản phẩm đều dùng cùng bố cục.
- **Nguyên tắc:** giảm tải nhận thức bằng chia lớp; luyện nhớ chủ động trước khi xem nghĩa; nhóm phần gần nhau theo chức năng; chữ Nhật có tương phản và kích thước cao hơn metadata; màu dùng để định vị loại nội dung và phản hồi, không phủ toàn thẻ.
- **Loại bỏ:** luồng bản đồ tuyến tính, streak/XP nổi bật, ma trận nhiều thẻ màu, hiệu ứng lật gây chóng mặt, lịch ôn giả lập hoặc nội dung ví dụ tự tạo. Chúng gây nhiễu hoặc cần dữ liệu và trạng thái mà dự án chưa có.

## 4. Hướng thiết kế duy nhất: “Sổ học”

Một mặt giấy đọc hiện đại: nền trắng ngà, bề mặt trắng, chữ than; đường kẻ mảnh và khoảng trắng làm nhịp. Dấu nhấn xanh cho Từ vựng, hổ phách cho Ngữ pháp, tím trầm cho Kanji; xanh lá/đỏ chỉ dành cho phản hồi đúng/sai. Cảm giác đến từ chữ Nhật lớn, căn lề chặt chẽ và một chi tiết định vị theo loại nội dung, không từ gradient hoặc nhiều bóng đổ.

### Hệ thống đề xuất

- Token sáng: nền `#F7F6F2`, mặt `#FFFFFF`, chữ `#222521`, chữ phụ `#606760`, viền `#DDDCD5`; màu học `#285FA8`, `#A86113`, `#7452A2`; phản hồi `#23764B`, `#B3433A`. Token tối: nền `#151816`, mặt `#202420`, chữ `#F1F1EB`, viền `#3A403B`; ba màu học sáng hơn để giữ tương phản. Xác nhận tương phản trong trình duyệt khi triển khai.
- Chữ Nhật mục tiêu: Noto Serif JP; cách đọc/ví dụ: Noto Sans JP; tiếng Việt và giao diện: Be Vietnam Pro với font hệ thống dự phòng. Dùng ít mức đậm, cỡ chữ linh hoạt cho chuỗi Nhật dài.
- Thang khoảng cách 4/8/12/16/24/32/48; bán kính 8 cho điều khiển, 12 cho panel, 16 cho thẻ học. Bóng chỉ cho dialog; focus rõ, trạng thái hover/active/disabled và giảm chuyển động.
- Thành phần dùng chung ở mức vừa đủ: tiêu đề trang, thanh tìm/lọc, nút, badge mức/loại, panel chi tiết, vùng rỗng, tiến độ mỏng, dialog và vỏ phiên học. Dữ liệu tiếp tục đi qua `AppProvider`; không tạo bản sao trạng thái học.

### Cấu trúc trang

- **Điều hướng:** desktop giữ Home/Học (Từ vựng, Ngữ pháp, Kanji)/Ôn tập, Quiz; Tiến độ, Đã lưu, Cài đặt, Tìm kiếm ở vùng phụ. Mobile ưu tiên Home, Từ vựng, Ngữ pháp, Kanji, Ôn tập; Flashcard và Quiz nằm trong Ôn tập, Tìm ở đầu trang. Chuyển chỗ liên kết nhưng giữ `PageId` và shortcut hiện có.
- **Home:** CTA ôn số thẻ đến hạn, học tiếp một bộ N3, ba lối vào thư viện. Hôm nay chỉ hiện đã học/còn ôn; phân tích chi tiết sang Tiến độ.
- **Từ vựng:** danh sách súc tích với chữ Nhật và nghĩa ngắn; khung đọc đặt từ lớn, cách đọc, nghĩa, Hán Việt/loại từ; thông tin động từ, từ liên quan và ghi chú thu gọn. Mobile đưa chi tiết mục được chọn vào vùng đọc rõ ràng, không ép bảng ngang.
- **Ngữ pháp:** mẫu và nghĩa cốt lõi trước; công thức ngay dưới; giải thích, ví dụ, so sánh, cảnh báo thành các phần mở theo nhu cầu. Không để bản romanized lấn chữ Nhật.
- **Kanji:** một chữ lớn và Hán Việt; tối đa ba từ ghép đại diện trước, phần còn lại mở rộng. Cách đọc được gắn với từng từ, vì JSON không cung cấp âm đọc độc lập.
- **Ôn tập/Flashcards/Quiz:** chọn bộ và chế độ ngoài phiên. Trong phiên, ẩn điều hướng toàn app; mặt trước chỉ mục tiêu, mặt sau xếp cách đọc → nghĩa → thông tin bổ sung. Nút lật và chấm điểm nằm vùng ngón tay cái; phím Space/1–4 và Escape có nhãn. Không đổi thuật toán hoặc ID SRS.
- **Trang phụ:** Tiến độ, Đã lưu, Cài đặt và Tìm kiếm dùng cùng token/điều khiển/trạng thái rỗng. Mọi trang dùng tiếng Việt nhất quán cho nhãn giao diện.

### Điện thoại và kiểm thử

Không cuộn ngang; vùng chạm tối thiểu khoảng 44 px; thanh dưới không che hành động; nội dung Nhật và bản dịch dài xuống dòng; dialog nằm trong viewport. Kiểm tra 320/375/768 px, desktop, bốn theme hiện có, bàn phím, focus, trạng thái rỗng, dữ liệu N4 thiếu trường, phiên học và lưu tiến độ. Chỉ thêm tính năng khi dữ liệu hiện có hỗ trợ rõ ràng.
