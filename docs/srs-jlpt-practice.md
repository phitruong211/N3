# Đặc tả yêu cầu phần mềm (SRS) — Luyện thi JLPT gắn với ôn tập

> Trạng thái: **bản nháp để duyệt** · Ngày: 2026-10-24 · Phạm vi mã nguồn đối chiếu: FE `N3/`, BE `japanese-server/` (Flyway tới V16).
> Các mục ghi **[Xác minh]** là giả định chưa kiểm chứng trong code hoặc nguồn chính thức; phải đóng trước khi triển khai. Các mục ghi **[Quyết định]** là lựa chọn thiết kế đang đề xuất, người duyệt có thể đổi.

## 1. Giới thiệu

### 1.1 Mục đích
Mô tả yêu cầu cho tính năng **luyện thi JLPT có hệ thống** (nghe, từ vựng–chữ, ngữ pháp, đọc hiểu, thi thử) và **nối kết quả thi với kho học sẵn có** (từ vựng, kanji, ngữ pháp) cùng hệ thống ôn ngắt quãng FSRS đang chạy.

### 1.2 Điểm khác biệt cần bảo vệ
Điểm khác biệt của SỔ NHẬT so với ứng dụng luyện thi khác không nằm ở số lượng đề, mà ở vòng khép kín:

> Làm đề → câu sai gắn với đúng mục trong thư viện → mục đó được đưa lên hàng ôn → giải thích tiếng Việt dẫn về mục ngữ pháp/từ vựng.

Mọi yêu cầu bên dưới phải phục vụ vòng này hoặc là điều kiện cho nó.

### 1.3 Phạm vi
**Trong phạm vi (giai đoạn 1):** cấp **N3**; nghe theo 5 dạng bài; trắc nghiệm từ vựng–chữ và ngữ pháp theo dạng đề; đọc hiểu; chế độ thi thử đủ bộ có bấm giờ; lưu lịch sử thi lên tài khoản; liên kết câu hỏi–mục thư viện; đẩy mục câu sai lên hàng ôn; báo điểm yếu theo mục.

**Ngoài phạm vi giai đoạn 1:** N2, N4, N5; lộ trình theo ngày thi; giáo viên giao đề cho lớp; sinh câu luyện thêm tự động; chép chính tả khi nghe; bảng xếp hạng, huy hiệu, chuỗi ngày (loại bỏ có chủ đích theo `DESIGN_RESEARCH.md`).

### 1.4 Thuật ngữ
| Từ | Nghĩa |
|---|---|
| SRS (tài liệu này) | Software Requirements Specification. Không nhầm với *spaced repetition* mà code và docs hiện gọi là "SRS/ôn ngắt quãng" |
| FSRS | Thuật toán lập lịch ôn đang dùng (FE `ts-fsrs`, BE Java) |
| Mục thư viện | Một thẻ từ vựng, kanji hoặc ngữ pháp có sẵn, định danh bằng `note_id` |
| Lượt thi | Một lần làm một đề (luyện hoặc thi thử) từ lúc bắt đầu đến lúc nộp |
| Câu hỏi | Một đơn vị chấm điểm có đáp án đúng, giải thích, nhãn kỹ năng và liên kết mục thư viện |

### 1.5 Tài liệu tham chiếu trong repo
`KIEN_TRUC_HE_THONG.md`, `DESIGN_RESEARCH.md`, `docs/listening.md`, `docs/srs-review-outbox.md`, `docs/learning-sync.md`, `docs/personal-card-notes.md`.

## 2. Mô tả tổng quan

### 2.1 Hiện trạng (đã xác minh trong mã nguồn)
- `src/lib/quiz.ts` chỉ sinh câu hỏi từ vựng và kanji; đáp án nhiễu lấy ngẫu nhiên từ cùng kho. `QuizType` chưa có ngữ pháp hay đọc hiểu.
- `src/components/listening/examData.ts` có 12 đoạn nghe, 24 câu cho N4/N3/N2; nội dung tự soạn, không phải đề thật. Âm thanh trong `public/audio/jlpt/` dùng một giọng tổng hợp; có chỉnh tốc độ 0,8/1/1,2×.
- Điểm cao nhất lưu ở trình duyệt (`nhat-jlpt-listening-scores-v1`), không lên server.
- Thẻ SRS tích hợp được định danh bằng `SRSCard.cardId` (chuỗi, tối đa 200 ký tự) và `deckType ∈ {vocabulary, kanji, grammar}`. Lượt ôn đi qua outbox bền vững và `POST /users/me/learning/reviews/batch`; BE tính FSRS.
- Dữ liệu N3 hiện có: 677 từ, 249 mẫu ngữ pháp (kèm mục 【Phân biệt】), 246 kanji; mỗi mục có `note_id`.
- Triển khai: FE Vercel, BE Render **[Xác minh]**, MySQL Aiven.

### 2.2 Người dùng
| Nhóm | Nhu cầu chính |
|---|---|
| Người tự học thi N3 (chính) | Biết mình yếu mục nào và được nhắc ôn đúng mục đó |
| Khách chưa đăng nhập | Thử một đề, thấy giá trị trước khi đăng ký |
| Quản trị nội dung (bạn) | Thêm/duyệt câu hỏi mà không phải sửa code |

### 2.3 Ràng buộc
- Không dùng đề thi JLPT thật; toàn bộ câu hỏi và âm thanh là nội dung gốc (bản quyền).
- Giữ mô hình hiện có: nội dung tĩnh trong `public/data`, dữ liệu người dùng trong MySQL qua Flyway.
- FSRS vẫn là nguồn sự thật cho lịch ôn; tính năng này không đổi thuật toán.
- Giao diện theo hướng "Sổ học": không XP, không chuỗi ngày, không bảng xếp hạng.

### 2.4 Giả định
- A1. Người dùng chính học trên điện thoại; mạng có thể chập chờn.
- A2. Gói BE trên Render có thể ngủ nên request đầu chậm **[Xác minh gói]**.
- A3. Điểm số là **ước tính**, không phải điểm JLPT chính thức.

## 3. Yêu cầu chức năng

Ký hiệu ưu tiên: **M** bắt buộc giai đoạn 1 · **S** nên có · **C** có thể để sau.

### 3.1 Ngân hàng câu hỏi (QB)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| QB-1 | Mỗi câu hỏi có `id` ổn định, `level`, `section` (`vocab`, `grammar`, `reading`, `listening`), `format` (xem 3.2–3.4), đề bài, 4 đáp án, đáp án đúng, giải thích tiếng Việt. | M |
| QB-2 | Mỗi câu có ít nhất một liên kết `links[] = {deckType, noteId}` tới mục thư viện được kiểm tra. Câu không có liên kết không được xuất bản. | M |
| QB-3 | Mỗi câu có `skills[]` (ví dụ `listen-number`, `listen-time`, `grammar-contrast`, `kanji-reading`) để báo cáo điểm yếu. | M |
| QB-4 | Mỗi câu có cờ `reviewed` (đã duyệt người thật) và `author` (`manual` hoặc `ai-assisted`). Bản build sản xuất chỉ nạp câu `reviewed = true`. | M |
| QB-5 | Với câu ngữ pháp, đáp án nhiễu ưu tiên lấy từ mục 【Phân biệt】 của mẫu liên quan thay vì ngẫu nhiên. | S |
| QB-6 | Nội dung lưu thành JSON tĩnh có phiên bản, đặt cùng chỗ với `public/data/*.json`; có script kiểm tra tính hợp lệ (id duy nhất, `noteId` tồn tại, đáp án nằm trong khoảng). | M |

**[Quyết định]** Câu hỏi là dữ liệu tĩnh, không nằm trong DB: khớp mô hình hiện tại, rẻ trên Aiven, và sửa nội dung không cần migration. DB chỉ chứa lượt thi.

### 3.2 Nghe (LS)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| LS-1 | Mỗi câu nghe thuộc một dạng: `task-comprehension` (課題理解), `point-comprehension` (ポイント理解), `summary-comprehension` (概要理解), `verbal-expression` (発話表現), `quick-response` (即時応答). | M |
| LS-2 | **Chế độ thi:** mỗi đoạn âm thanh chỉ phát một lần; không có nút phát lại, tua, đổi tốc độ; transcript và đáp án ẩn đến khi nộp. | M |
| LS-3 | **Chế độ luyện:** cho nghe lại, đổi tốc độ, xem transcript tiếng Nhật và bản dịch Việt sau khi trả lời. | M |
| LS-4 | Hội thoại có hai giọng khác nhau (nam/nữ) khi kịch bản có hai người. | S |
| LS-5 | Mỗi câu hiển thị kết quả theo `skills[]` sau khi nộp. | M |
| LS-6 | Lỗi tải âm thanh hiện thông báo rõ và không tính câu đó vào điểm; không mất bài đã làm. | M |

Ghi chú: việc "chỉ phát một lần" chỉ thực thi ở trình duyệt, người dùng kỹ thuật có thể vượt qua. Chấp nhận được vì đây là công cụ tự học, không phải bài thi có giám sát.

### 3.3 Từ vựng–chữ và ngữ pháp (VG)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| VG-1 | Hỗ trợ các dạng chữ–từ vựng: cách đọc kanji, cách viết, chọn từ theo ngữ cảnh, từ đồng nghĩa, cách dùng. | M |
| VG-2 | Hỗ trợ các dạng ngữ pháp: chọn mẫu đúng, sắp xếp câu có ô ★, điền đoạn văn. | M |
| VG-3 | Sau khi nộp, mỗi câu sai có nút mở **đúng mục** trong Ngữ pháp/Từ vựng/Kanji (deep link theo `noteId`). | M |
| VG-4 | Câu ngữ pháp hiển thị phần 【Phân biệt】 của mẫu liên quan trong lời giải thích khi có. | S |

### 3.4 Đọc hiểu (RD)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| RD-1 | Hỗ trợ đoạn ngắn, đoạn vừa, đoạn dài và dạng tìm thông tin (bảng/thông báo). | M |
| RD-2 | Bật/tắt furigana trên bài đọc; mặc định tắt ở chế độ thi. | M |
| RD-3 | Bấm một từ trong bài đọc mở tra từ điển và cho **thêm vào bộ thẻ** bằng luồng từ điển hiện có. | S |
| RD-4 | Bài đọc dài dùng bố cục hai cột trên máy tính, dọc trên điện thoại, không cuộn ngang. | M |

### 3.5 Thi thử đủ bộ (MX)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| MX-1 | Một đề thi thử gồm 3 phần: chữ–từ vựng, ngữ pháp + đọc hiểu, nghe; mỗi phần có bấm giờ riêng. Thời lượng là hằng số cấu hình theo cấp. **[Xác minh với nguồn chính thức]** | M |
| MX-2 | Hết giờ phần nào thì phần đó tự nộp; không quay lại phần đã nộp. | M |
| MX-3 | Rời trang hoặc tải lại giữa chừng khôi phục được lượt thi và thời gian còn lại. | M |
| MX-4 | Kết quả gồm số câu đúng và **điểm ước tính** từng phần trên thang 60 và tổng trên 180, kèm kết luận đạt/chưa đạt theo ngưỡng cấu hình (N3: tổng 95, mỗi phần tối thiểu 19 **[Xác minh]**). Phải ghi rõ đây là ước tính. | M |
| MX-5 | Lịch sử các lượt thi thử và biểu đồ điểm theo thời gian, tách theo phần. | S |

### 3.6 Nối với ôn tập (SR) — lõi của tính năng
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| SR-1 | Khi nộp bài (đã đăng nhập), mỗi mục thư viện gắn với câu **trả lời sai** được đưa lên hàng ôn sớm. | M |
| SR-2 | Câu trả lời **đúng** không thay đổi lịch FSRS (trả lời trắc nghiệm có thể do đoán). | M |
| SR-3 | Câu đúng nhưng trả lời chậm hơn ngưỡng cấu hình có thể đánh dấu "nên ôn lại", không đổi lịch. | C |
| SR-4 | Thao tác đẩy lên ôn phải **idempotent** theo mã định danh lượt thi và mục; nộp lại hoặc thử lại sau lỗi mạng không tạo tác động thứ hai. | M |
| SR-5 | Mục chưa có thẻ SRS (chưa từng học) được thêm vào hàng thẻ mới của người dùng, không vượt giới hạn thẻ mới mỗi ngày trong cài đặt. | M |
| SR-6 | Thao tác này không được ghi đè hay làm mất tiến độ FSRS hiện có (stability, difficulty, số lần ôn, lapses). Chỉ thay đổi thời điểm đến hạn. | M |
| SR-7 | Hoàn tác được việc đẩy lên ôn, hoặc đảm bảo hai thiết bị cùng thao tác không gây xung đột `revision`. | S |
| SR-8 | Sau khi nộp, màn kết quả cho biết "N mục đã được đưa vào hàng ôn hôm nay" và nút đi tới ôn. | M |

**[Quyết định]** Không gọi `POST /users/me/learning/reviews` với rating `AGAIN`, vì lượt đó là tự đánh giá trí nhớ và làm tăng `lapses`, sai lệch dữ liệu FSRS. Cần một thao tác máy chủ riêng chỉ chỉnh `dueAt`. Cơ chế cụ thể xem OQ-1.

### 3.7 Báo điểm yếu (WK)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| WK-1 | Trang báo cáo gom lượt thi theo `skills[]` và theo mục thư viện, hiển thị tỉ lệ đúng và số lần sai gần đây. | M |
| WK-2 | Danh sách "mục hay sai" xếp theo số lần sai, mỗi dòng mở được đúng mục thư viện. | M |
| WK-3 | Báo cáo chỉ dùng dữ liệu của chính người dùng; không so sánh với người khác. | M |
| WK-4 | Khi dữ liệu dưới ngưỡng tối thiểu (mặc định 5 lượt trả lời mỗi kỹ năng), hiển thị "chưa đủ dữ liệu" thay vì phần trăm. | M |

### 3.8 Khách và đồng bộ (GS)
| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| GS-1 | Khách làm được toàn bộ chế độ luyện và thi; lượt thi lưu cục bộ theo scope `guest`. | M |
| GS-2 | Khách không có SR-1; kết quả hiển thị lời mời đăng nhập để lưu lịch sử. | M |
| GS-3 | Lượt thi của khách **không** tự chuyển sang tài khoản; dùng cùng cơ chế xác nhận chuyển dữ liệu như hiện tại, người dùng đồng ý mới chuyển. | S |
| GS-4 | Nộp bài khi mất mạng: lưu lượt thi vào hàng đợi bền vững cục bộ, tự gửi lại khi có mạng, người dùng thấy trạng thái "chưa đồng bộ". | M |

## 4. Mô hình dữ liệu (đề xuất)

Migration mới **V17** (V16 là bản mới nhất hiện có).

### 4.1 Bảng `exam_attempts`
| Cột | Ghi chú |
|---|---|
| `id` | UUID |
| `user_id` | FK người dùng, xóa theo tài khoản |
| `client_attempt_id` | UUID do FE tạo; unique `(user_id, client_attempt_id)` để idempotent |
| `level` | `N3` ở giai đoạn 1 |
| `mode` | `practice` hoặc `mock` |
| `content_version` | phiên bản ngân hàng câu hỏi tại thời điểm làm |
| `started_at`, `submitted_at` | thời gian |
| `section_scores` | JSON: câu đúng/tổng và điểm ước tính từng phần |
| `total_estimated` | số nguyên 0–180, rỗng với luyện lẻ |

### 4.2 Bảng `exam_attempt_answers`
| Cột | Ghi chú |
|---|---|
| `attempt_id` | FK |
| `question_id` | id câu hỏi tĩnh (chuỗi) |
| `chosen` | 0–3 hoặc rỗng nếu bỏ qua |
| `correct` | boolean do **server** tính lại từ đáp án, không tin giá trị client |
| `response_ms` | thời gian trả lời |
| `skills` | JSON mảng nhãn kỹ năng |
| `links` | JSON mảng `{deckType, noteId}` |

Index: `(user_id, submitted_at)`; `(attempt_id)`; để báo điểm yếu có thể cần bảng tổng hợp hoặc truy vấn gộp **[Xác minh khi đo hiệu năng]**.

### 4.3 Chấm điểm phía server
Server là nguồn xác nhận `correct`. Vì câu hỏi là dữ liệu tĩnh ở FE, BE cần bản đáp án tương ứng với `content_version` **[Quyết định cần chọn: nhúng bản đáp án vào BE khi build, hoặc BE nạp từ cùng JSON]** — xem OQ-2.

## 5. Giao diện API (đề xuất)

Tiền tố `/api/v1`, xác thực JWT, theo cách đặt tên hiện có.

| Phương thức | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/users/me/exams/attempts` | Nộp lượt thi: `clientAttemptId`, `level`, `mode`, `contentVersion`, danh sách câu trả lời. Idempotent. Trả điểm, danh sách mục đã đưa lên ôn. |
| GET | `/users/me/exams/attempts?page=` | Lịch sử phân trang. |
| GET | `/users/me/exams/attempts/{id}` | Chi tiết một lượt. |
| GET | `/users/me/exams/weakness?level=` | Tổng hợp theo kỹ năng và theo mục hay sai. |
| POST | `/users/me/learning/boost` *(tên tạm)* | Đưa danh sách `{deckType, cardId}` lên hàng ôn; chỉnh `dueAt`; idempotent theo `requestId`. Chi tiết OQ-1. |

Quy tắc chung: giới hạn kích thước body, giới hạn số câu mỗi lượt, `429` và `409` xử lý như các endpoint học hiện có; FE thử lại theo cùng chính sách của review outbox.

## 6. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NF-1 Hiệu năng | Nộp bài và trả kết quả trong 2 giây ở điều kiện bình thường. Khi BE đang khởi động lại, FE hiển thị trạng thái chờ và tự thử lại, không báo lỗi ngay. |
| NF-2 Độ bền | Mất mạng, đóng tab hoặc tải lại không làm mất bài đã làm (MX-3, GS-4). Gửi lại không tạo bản ghi trùng (SR-4). |
| NF-3 Bảo mật | Chỉ chủ lượt thi đọc được lượt thi của mình; `correct` do server tính; validate `questionId` thuộc `content_version`. |
| NF-4 Riêng tư | Xóa tài khoản xóa toàn bộ lượt thi. Không chia sẻ lượt thi hay điểm với người khác ở giai đoạn 1. |
| NF-5 Dung lượng tải | Không kéo thêm thư viện nặng; câu hỏi và âm thanh tải theo bài. Âm thanh có thể cache; lưu ý giới hạn băng thông gói Vercel **[Xác minh]**. |
| NF-6 Khả dụng | Không cuộn ngang ở 320/375/768 px; vùng chạm ≥ 44 px; điều khiển bằng bàn phím; chữ Nhật đủ lớn; tương phản đạt theo token hiện có. |
| NF-7 Nhất quán giao diện | Dùng token, `AppDialog`, `PageHeading` và phong cách hiện có; nhãn giao diện tiếng Việt thống nhất. |
| NF-8 Bản quyền | Mọi câu hỏi, đoạn đọc, kịch bản nghe do bạn tạo hoặc có giấy phép; ghi nguồn trong metadata. Giọng đọc tổng hợp phải có điều khoản cho phép dùng thương mại **[Xác minh nhà cung cấp]**. |
| NF-9 Kiểm thử | Xem mục 8. |

## 7. Chất lượng nội dung (CQ)

| ID | Yêu cầu |
|---|---|
| CQ-1 | Câu do AI hỗ trợ phải được người thạo tiếng Nhật duyệt trước khi `reviewed = true`. |
| CQ-2 | Mỗi file âm thanh được nghe lại toàn bộ trước khi đưa lên (cách đọc kanji, trọng âm, tốc độ). |
| CQ-3 | Tối thiểu cho giai đoạn 1: **3 đề thi thử N3 đầy đủ** và kho luyện lẻ đủ phủ 5 dạng nghe, 5 dạng từ vựng–chữ, 3 dạng ngữ pháp, 4 dạng đọc. Số lượng này là mục tiêu đề xuất, chưa dựa trên khảo sát người dùng. |
| CQ-4 | Mục tiêu đề xuất: tối thiểu 80% mẫu ngữ pháp N3 (249) và 60% từ vựng N3 (677) xuất hiện trong ít nhất một câu hỏi. Các ngưỡng này do mình đặt, chưa có cơ sở khảo sát; người duyệt chỉnh theo năng lực soạn nội dung. Đo bằng script, không đo bằng cảm giác. |

## 8. Tiêu chí chấp nhận và kiểm thử

| Yêu cầu | Cách kiểm chứng |
|---|---|
| QB-1…6 | Script kiểm tra ngân hàng câu hỏi chạy trong `npm test`; fail nếu id trùng, `noteId` không tồn tại hoặc thiếu liên kết. |
| LS-2 | Test trình duyệt: đoạn thi chỉ phát một lần, không có điều khiển phát lại/đổi tốc độ. |
| MX-2, MX-3 | Test trình duyệt: hết giờ tự nộp; tải lại giữa chừng còn đúng thời gian. |
| MX-4 | Unit test hàm quy đổi điểm với bảng ví dụ do người duyệt cung cấp; kiểm tra điểm liệt từng phần. |
| SR-1, SR-2 | Integration test BE: nộp lượt thi có câu sai và đúng → chỉ mục của câu sai bị đổi `dueAt`. |
| SR-4 | Gửi cùng `clientAttemptId` hai lần → một bản ghi, tác động ôn một lần. |
| SR-6 | Test: stability, difficulty, reps, lapses không đổi sau khi đẩy lên ôn. |
| SR-5 | Test: mục chưa có thẻ vào hàng mới và tôn trọng giới hạn thẻ mới. |
| NF-3 | Test: client gửi `correct = true` cho câu sai vẫn bị tính sai; người dùng khác nhận 404 với lượt thi không phải của mình. |
| GS-4 | Test trình duyệt: ngắt mạng khi nộp, bật lại → bản ghi tới server đúng một lần. |
| NF-6 | Kiểm tra bằng Playwright + axe tại các độ rộng đã nêu, theme sáng/tối. |

Môi trường: BE test chạy trên H2 như hiện tại; hành vi khóa và collation cần thêm một lượt thử trên MySQL thật trước khi phát hành, vì test H2 không thay thế được **[Xác minh trên MySQL/Aiven]**.

## 9. Phân kỳ triển khai

| Giai đoạn | Nội dung | Điều kiện hoàn thành |
|---|---|---|
| 0. Nền | QB-1…6, kiểm tra ngân hàng câu hỏi, gắn `noteId` cho 12 đoạn nghe hiện có | Script kiểm tra pass; câu nghe cũ có liên kết |
| 1. Vòng khép kín | V17, nộp lượt thi, SR-1…8, WK-1…4, luyện lẻ N3 (nghe + ngữ pháp + từ vựng) | Sai một câu → mục đó xuất hiện trong ôn hôm nay |
| 2. Thi thử | MX-1…5, đọc hiểu RD-1…4 | Làm trọn một đề 3 phần có bấm giờ và điểm ước tính |
| 3. Mở rộng | Lộ trình theo ngày thi, N2/N4, chép chính tả, luyện câu cùng mẫu | Tách SRS bổ sung riêng |

## 10. Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Đẩy mục lên ôn làm xung đột `revision` với đồng bộ snapshot | Mất hoặc ghi đè tiến độ | Thao tác phía server có khóa chủ sở hữu như batch review (OQ-1); test hai thiết bị |
| Câu hỏi do AI sinh sai ngữ pháp hoặc đáp án nhiễu cũng đúng | Người học bị dạy sai, mất uy tín | CQ-1 bắt buộc có người duyệt; cờ `reviewed` |
| Điểm ước tính bị hiểu là điểm chính thức | Kỳ vọng sai | Nhãn "ước tính" ở mọi nơi hiện điểm; MX-4 |
| Giọng tổng hợp đọc sai | Học sai cách nghe | CQ-2; ưu tiên sửa kịch bản hơn là chấp nhận |
| BE ngủ trên Render | Nộp bài chậm, người dùng bỏ | NF-1, GS-4 |
| Dung lượng và băng thông âm thanh tăng | Chậm, tốn phí | Tải theo bài; chuyển sang kho riêng có CDN khi có hàng trăm file |
| Điều kiện đạt/thời lượng JLPT nhớ sai | Báo kết quả sai | Đưa vào hằng số cấu hình, đối chiếu nguồn chính thức trước phát hành |

## 11. Câu hỏi mở

| ID | Câu hỏi | Cần để |
|---|---|---|
| OQ-1 | Cơ chế đẩy lên ôn: chỉ sửa `dueAt` trong `learning_states` qua endpoint riêng, hay thêm trạng thái "boost" độc lập với lịch FSRS? Cần đọc `LearningService` và `BuiltInSchedulerAdapter` để chọn. | SR-1…7 |
| OQ-2 | BE lấy đáp án đúng từ đâu: sao chép JSON câu hỏi vào resource của BE khi build, hay BE nhận từ FE rồi kiểm tra chữ ký? | NF-3, 4.3 |
| OQ-3 | `cardId` của thẻ ngữ pháp và kanji trong snapshot được sinh theo quy tắc nào, và có ánh xạ ổn định sang `note_id` không? | QB-2, SR-1 |
| OQ-4 | Có cho khách đẩy mục lên ôn ở scope `guest` không (thẻ khách lưu cục bộ)? | GS-2 |
| OQ-5 | Thời lượng và ngưỡng đạt chính thức của N3 theo nguồn JLPT hiện hành? | MX-1, MX-4 |
| OQ-6 | Nguồn giọng đọc nhiều giọng, điều khoản thương mại và chi phí? | LS-4, NF-8 |
| OQ-7 | Gói Render/Aiven đang dùng có giới hạn ngủ, sao lưu, kết nối đồng thời nào ảnh hưởng NF-1? | NF-1 |

## 12. Truy vết tới mã hiện có

| Khu vực | File/điểm bám |
|---|---|
| Câu hỏi nghe hiện có | `src/components/listening/examData.ts`, `JlptListeningPractice.tsx` |
| Quiz hiện có | `src/lib/quiz.ts`, `src/components/quiz/QuizPage.tsx`, `QuizType` trong `src/types/index.ts` |
| Thẻ SRS và đồng bộ | `src/lib/srs.ts`, `src/lib/fsrsProgress.ts`, `src/lib/learningSync.ts`, `src/hooks/useReviewOutbox.ts` |
| Hàng đợi bền vững để tái dùng cho nộp bài | `docs/srs-review-outbox.md` |
| BE học và lịch | `learning/LearningController.java`, `LearningService`, `BuiltInSchedulerAdapter.java`, `AnkiScheduler.java` |
| Từ điển, tra từ trong bài đọc | `src/lib/dictionary/api.ts`, `AddDictionaryCardDialog.tsx` |
| Dữ liệu thư viện | `public/data/vocabN3.json`, `grammarN3.json`, `kanjiN3_vocab_full.json` |
