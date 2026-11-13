# Đặc tả yêu cầu phần mềm (SRS) — SỔ NHẬT

> Phiên bản 1.0 · 14/11/2026 · Phạm vi: FE `N3/` (React SPA) và BE `japanese-server/` (Spring Boot).
> Mục tiêu sản phẩm: một app học tiếng Nhật cho người Việt, **từ N5 đến N1**, gồm nhiều chế độ ôn luyện, nhập thẻ, tra từ và ngữ pháp.
> Cột **Trạng thái** phản ánh mã nguồn ngày 14/11/2026: ✅ đã có · 🟡 một phần · ❌ chưa có.

## 1. Giới thiệu

### 1.1. Mục đích
Tài liệu mô tả các yêu cầu chức năng và phi chức năng của SỔ NHẬT. Tài liệu cũng ghi lại những chỗ còn thiếu so với mục tiêu N5→N1 và những bất cập đang có trên web, làm cơ sở để ưu tiên công việc.

### 1.2. Người dùng mục tiêu
| Nhóm | Nhu cầu chính |
|---|---|
| Người mới (N5–N4) | Học kana, từ và kanji cơ bản, có lộ trình rõ ràng, không bị ngợp |
| Trung cấp (N3–N2) | Ôn ngắt quãng hằng ngày, phân biệt các mẫu ngữ pháp, luyện đề |
| Nâng cao (N1) | Từ vựng và kanji hiếm, đọc hiểu dài, thi thử có tính giờ |
| Người tự soạn thẻ | Nhập từ Anki hoặc Excel, thiết kế mặt thẻ, chia sẻ bộ thẻ |
| Khách (chưa đăng nhập) | Học thử ngay, giữ được tiến độ khi tạo tài khoản sau |

### 1.3. Thuật ngữ
- **SRS / FSRS**: ôn ngắt quãng; FSRS là thuật toán lập lịch (`ts-fsrs` ở FE, `fsrs` 1.0.0 ở BE).
- **Thẻ tích hợp**: thẻ có sẵn từ thư viện (`public/data`). **Thẻ cá nhân**: thẻ người dùng nhập hoặc tự tạo.
- **Outbox**: hàng đợi lượt ôn ở máy, được gửi lên server khi có mạng.

## 2. Mô tả tổng quan

### 2.1. Kiến trúc
- **FE**: React 19, TypeScript, Vite, Tailwind, React Router; triển khai qua Vercel (`vercel.json`).
- **BE**: Java 21, Spring Boot 4.1, JPA và MySQL 8.4, Flyway (19 migration), JWT kèm refresh token, Springdoc.
- **Dữ liệu học**: các file JSON tĩnh trong `public/data`, đề thi trong `public/exams`, bài nghe trong `public/audio` và `listening.json`.
- **Từ điển**: đã gỡ khỏi web ngày 14/11/2026 theo yêu cầu. Link `/dictionary` cũ chuyển về trang Từ vựng. Module từ điển ở BE và dữ liệu JMdict trong MySQL vẫn còn, chưa xóa.

### 2.2. Ràng buộc
- Chạy tốt trên điện thoại (bottom nav, safe-area) và desktop (sidebar).
- Dùng được khi chưa đăng nhập; lượt ôn không được mất khi rớt mạng.
- Nội dung đưa vào app phải có nguồn và giấy phép rõ ràng.

## 3. Yêu cầu chức năng

### 3.1. Tài khoản và đồng bộ
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-AUTH-1 | Đăng ký, đăng nhập, làm mới phiên bằng refresh token | ✅ |
| F-AUTH-2 | Chế độ khách (`?guest=1`), học ngay không cần tài khoản | ✅ |
| F-AUTH-3 | Chuyển dữ liệu khách (tiến độ, ghi chú) sang tài khoản khi đăng nhập | ✅ |
| F-AUTH-4 | Đồng bộ tiến độ nhiều thiết bị, báo đúng khi có xung đột | ✅ mất mạng báo riêng, không còn coi là xung đột |

### 3.2. Lộ trình và nội dung theo cấp
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-LV-1 | Người dùng chọn cấp mục tiêu (N5…N1); Thư viện và Trắc nghiệm mở sẵn ở cấp đó | 🟡 chọn trong Cài đặt › Học tập, lưu trên thiết bị (chưa theo tài khoản); Hôm nay chưa đổi theo cấp |
| F-LV-2 | Kana: bảng chữ, phát âm, thứ tự nét, trò chơi | ✅ (5 trò chơi) |
| F-LV-3 | Từ vựng N5–N1 có nghĩa tiếng Việt, Hán Việt, ví dụ | 🟡 N5 (601), N4 (603), N3 (677); thiếu N2, N1 |
| F-LV-4 | Kanji N5–N1: âm On/Kun, Hán Việt, từ liên quan | 🟡 N5 (112), N4 (170), N3 (246), N2–N1 gộp chung (375) |
| F-LV-5 | Ngữ pháp N5–N1: cấu trúc, cách dùng, ví dụ | 🟡 N5 (107), N4 (132), N3 (249), N2 (274); thiếu N1 |
| F-LV-6 | Nghe theo dạng đề JLPT cho từng cấp | 🟡 4 bài mỗi cấp cho N4, N3, N2; thiếu N5, N1 |
| F-LV-7 | Đọc hiểu (読解) theo cấp | ❌ |
| F-LV-8 | Đề thi thật kèm đáp án, script và audio | 🟡 chỉ có N3 (11 đề) |

### 3.3. Chế độ ôn luyện
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-ST-1 | Ôn ngắt quãng FSRS, có chọn tỉ lệ nhớ mong muốn | ✅ |
| F-ST-2 | Giới hạn thẻ mới mỗi ngày, hoàn tác lượt vừa chấm | ✅ |
| F-ST-3 | Học tự do theo bài, nhớ vị trí đang học | ✅ |
| F-ST-4 | Trắc nghiệm: từ → nghĩa, từ → cách đọc, kanji → Hán Việt, lọc theo cấp | ✅ |
| F-ST-5 | Trắc nghiệm kanji → cách đọc | ❌ đã bỏ khỏi `QuizType`; N3 chưa có dữ liệu âm On/Kun |
| F-ST-6 | Gõ đáp án (kana hoặc romaji) | ✅ |
| F-ST-7 | Đọc câu ví dụ, chọn mẫu ngữ pháp được dùng | ✅ (điền chỗ trống trong câu thì chưa có) |
| F-ST-8 | Trắc nghiệm ngữ pháp, phân biệt các mẫu dễ nhầm | 🟡 có mẫu → nghĩa; chưa có bài phân biệt mẫu gần nghĩa |
| F-ST-9 | Ôn ngược chiều (nghĩa → từ), nghe → chọn từ | 🟡 có nghĩa → từ; chưa có nghe → chọn từ |
| F-ST-10 | Thi thử theo cấp, tính giờ, quy điểm theo thang JLPT | 🟡 có làm đề N3 và chấm đáp án; chưa quy điểm theo thang |
| F-ST-11 | Ôn lại các câu đã làm sai | ❌ |

### 3.4. Bộ thẻ và nhập thẻ
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-DK-1 | Nhập Anki `.apkg`, Excel, định dạng bộ thẻ v1 (`docs/deck-format-v1.md`) | ✅ |
| F-DK-2 | Prompt mẫu để AI sinh bộ thẻ đúng định dạng | ✅ |
| F-DK-3 | Xem trước và sửa trước khi nhập | ✅ |
| F-DK-4 | Thiết kế mặt thẻ, loại ghi chú, style, font riêng | ✅ |
| F-DK-5 | Nhóm bộ thẻ; chia sẻ bộ lẻ hoặc nhóm qua link, mã, QR; trang cộng đồng | ✅ |
| F-DK-6 | Xuất bộ thẻ | ✅ |
| F-DK-7 | Gắn cấp JLPT khi nhập để bộ thẻ vào đúng lộ trình | ❌ |
| F-DK-8 | Báo cáo bộ thẻ vi phạm, có trang duyệt cho admin | ✅ |

### 3.5. Tra cứu
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-SR-1 | Tìm nhanh trong thư viện (kanji, kana, romaji, tiếng Việt không dấu) | ✅ gồm cả N5 |
| F-SR-2 | Từ điển công khai, có URL riêng | ⛔ đã gỡ 14/11 |
| F-SR-3 | Nghĩa tiếng Việt trong từ điển | ⛔ không còn áp dụng (đã gỡ từ điển) |
| F-SR-4 | Thêm thẻ từ kết quả tra từ điển | ⛔ đã gỡ 14/11 |
| F-SR-5 | Lọc kết quả theo cấp JLPT | ❌ |
| F-SR-6 | Tra ngữ pháp theo mẫu (`〜ばかり`) và gợi ý các mẫu gần nghĩa | 🟡 tìm theo chữ được, chưa gợi ý mẫu liên quan |

### 3.6. Tiến độ và cá nhân hóa
| ID | Yêu cầu | Trạng thái |
|---|---|---|
| F-PG-1 | Màn Hôm nay: việc cần làm, mục tiêu ngày, chuỗi ngày học | ✅ |
| F-PG-2 | Trang tiến độ, thẻ đã lưu, ghi chú cá nhân trên thẻ | ✅ |
| F-PG-3 | 4 giao diện màu, cỡ chữ, giảm chuyển động, furigana, tự phát âm | ✅ |
| F-PG-4 | Thống kê theo cấp và theo kỹ năng (từ, kanji, ngữ pháp, nghe) | ❌ |

## 4. Yêu cầu phi chức năng
| ID | Yêu cầu | Hiện trạng |
|---|---|---|
| NF-1 | Độ tương phản đạt WCAG AA ở mọi giao diện màu | ✅ có test tự động |
| NF-2 | Tải chậm theo trang (lazy load); dữ liệu thư viện chỉ tải khi mở | ✅ |
| NF-3 | Không mất lượt ôn khi offline (outbox, hoàn tác) | ✅ có test browser |
| NF-4 | Tải lần đầu nhanh trên mạng di động | 🟡 các file JSON lớn (`listening.json` 1,4 MB, `kanjiN2.json` 0,7 MB) được tải nguyên file |
| NF-5 | Bảo mật: BCrypt, JWT, khóa tài khoản LOCKED/DISABLED | 🟡 xem B-7 |
| NF-6 | Kiểm thử: FE 255 unit test pass, có test browser; BE có integration test | ✅ (chưa chạy lại test browser và BE trong phiên này) |
| NF-7 | Nguồn và giấy phép nội dung được ghi lại | 🟡 kanji N2–N1 trích từ sách *Kanji Look and Learn*; cần xác minh quyền sử dụng |

## 5. Bất cập trong web hiện tại

### 5.1. Lỗi và sai lệch (nên sửa trước)
| ID | Bất cập | Bằng chứng | Hướng xử lý |
|---|---|---|---|
| ~~B-1~~ đã sửa 14/11 | Thư viện, tìm kiếm và trắc nghiệm không có N5, dù dữ liệu đã có | `src/lib/data.ts` chỉ tải `vocabN3/N4`, `kanjiN3/N4/N2`, `grammarN2/N3/N4` | Tải thêm `*N5.json` |
| ~~B-2~~ đã sửa 14/11 | Kiểu cấp bị giới hạn ở N2/N3/N4 | `src/types/index.ts:123` | Mở rộng thành `'N5'…'N1'` |
| ~~B-3~~ đã sửa 14/11 | Trắc nghiệm khai báo 6 kiểu nhưng chỉ chạy được 3 | `QuizType` so với `src/lib/quiz.ts` và `QuizPage.tsx` | Viết tiếp các kiểu còn lại hoặc bỏ khỏi type |
| ~~B-4~~ đã sửa 14/11 (đổi nhãn thành "Học thêm X thẻ", vì mục tiêu ngày đếm mọi thẻ đã ôn) | "Học thêm X thẻ mới" tính bằng `mục tiêu − số thẻ đã ôn`, tức là lấy số thẻ ôn lại trừ vào số thẻ mới | `Dashboard.tsx` (`remaining`) | Tính theo giới hạn thẻ mới còn lại trong ngày |
| ~~B-5~~ đã sửa 14/11 | Hai khái niệm mục tiêu dễ nhầm | `SettingsPage.tsx` | Đã ghi rõ: mục tiêu ngày tính mọi thẻ đã học hoặc ôn; số thẻ mới chỉnh ở tab Ôn ngắt quãng |
| ~~B-6~~ đã sửa 14/11 | Mọi lỗi đồng bộ đều bị báo là "xung đột", kể cả khi chỉ mất mạng | `useLearningSync.ts:104`, `:147` | Chỉ đặt `conflict` khi server trả HTTP 409 |
| ~~B-7~~ đã sửa 14/11 (server chỉ nhận mỗi refresh token một lần; các tab xếp hàng làm mới bằng Web Locks) | Hai tab cùng refresh token có thể cùng tạo token mới | `RefreshTokenRepository.findByTokenHash` không khóa | Khóa bi quan hoặc CAS khi tiêu thụ token |
| B-8 | Kanji N2 và N1 bị gộp chung dưới nhãn N2 | `kanjiN2.json` (nguồn *Look and Learn N2–N1*) | Tách theo danh sách cấp chuẩn |
| B-9 (chấp nhận) | Cài đặt sửa ở nhiều máy: lần ghi sau đè lần trước | `user_settings` PATCH | PATCH chỉ gửi trường vừa đổi, nên chỉ đè khi hai máy sửa cùng một mục. Đây là hành vi bình thường của cài đặt; chưa cần revision |

### 5.2. Giao diện bị nhiễu
| ID | Bất cập | Hướng xử lý |
|---|---|---|
| ~~U-1~~ đã sửa 14/11 | Menu quá nhiều mục chồng chéo | Còn 5 mục (Hôm nay, Thư viện, Bộ thẻ, Ôn, Trắc nghiệm) cộng Cài đặt. Tiến độ mở từ Hôm nay; Thẻ đã lưu nằm trong Bộ thẻ, bộ lọc Thư viện và menu tài khoản trên điện thoại |
| ~~U-2~~ đã sửa 14/11 | Hôm nay lặp thông tin | Một nút chính, hai link phụ, một dải mục tiêu · tuần · chuỗi ngày. Phần tranh và lời chào giữ nguyên |
| U-3 | Thiết kế thẻ, loại ghi chú, style, font và widget đều nằm trong menu chính của bộ thẻ | Gom vào mục "Nâng cao" |
| ~~U-4~~ đã sửa 14/11 | Cài đặt SRS bày các ô nhập số phút | Đã gom vào "Tùy chỉnh nâng cao" |
| ~~U-5~~ đã sửa 14/11 | Trên mobile, Trắc nghiệm bị đẩy vào mục "Thêm" | Thanh dưới có đủ 5 mục, bỏ nút "Thêm" |
| U-6 | Thư viện ghi "Sáu chặng" nhưng không có chỗ chọn cấp; người học N1 vẫn thấy N4/N3 trước | Thêm chọn cấp (F-LV-1) |

### 5.3. Nợ kỹ thuật
- `ImportedDecks.tsx` dài 1171 dòng, `StudySession.tsx` 818 dòng; khó sửa và dễ sinh lỗi khi thêm chế độ học.
- `ink-ridges.tsx` dài 965 dòng nhưng chỉ dùng làm hình trang trí trên Hôm nay.
- `ankiStorage.ts` và các endpoint tải trọn bộ deck vẫn còn; sẽ chậm khi bộ thẻ lớn.

## 6. Cần cải thiện để đạt mục tiêu N5→N1
1. **Nội dung**: từ vựng N2/N1 (mỗi cấp khoảng 1.500–2.500 từ), ngữ pháp N1 (khoảng 200 mẫu), kanji N1 tách riêng, đọc hiểu cho mọi cấp, đề thi N5/N4/N2/N1, thêm bài nghe (hiện mỗi cấp chỉ 4 bài).
2. **Chế độ ôn**: gõ đáp án, điền câu, ngữ pháp, phân biệt mẫu, ngược chiều, nghe → chọn từ, ôn câu sai, thi thử có quy điểm JLPT.
3. **Tra cứu**: lọc theo cấp trong hộp tìm kiếm, gợi ý mẫu ngữ pháp liên quan. (Từ điển đã gỡ.)
4. **Lộ trình**: chọn cấp khi bắt đầu, có bài kiểm tra đầu vào, Hôm nay gợi ý việc theo cấp.
5. **Import**: gắn cấp JLPT cho bộ thẻ nhập vào.
6. **Hiệu năng**: chia nhỏ `listening.json` và `kanjiN2.json` theo cấp hoặc theo trang.
7. **Thống kê**: tiến độ theo cấp và theo kỹ năng.

## 7. Lộ trình đề xuất
| Giai đoạn | Nội dung | Mục liên quan |
|---|---|---|
| 1 — Sửa nền | N5 vào Thư viện, tìm kiếm và trắc nghiệm; mở rộng kiểu cấp; sửa số thẻ mới; tách lỗi mạng khỏi xung đột | B-1, B-2, B-4, B-6 |
| 2 — Ôn luyện | Gõ đáp án, điền câu, trắc nghiệm ngữ pháp, ôn câu sai; gọn Hôm nay và menu | B-3, F-ST-5…11, U-1, U-2 |
| 3 — Theo cấp | Chọn cấp, tách kanji N2/N1, gắn cấp cho bộ thẻ nhập | F-LV-1, B-8, F-DK-7 |
| 4 — Nội dung N2/N1 | Từ vựng, ngữ pháp, đọc hiểu, đề thi (cần nguồn có giấy phép) | F-LV-3…8 |
| 5 — Dọn BE | Quyết định giữ hay xóa module từ điển và bảng JMdict ở server | F-SR-2 |
