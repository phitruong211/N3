# Kế hoạch code từ điển Nhật–Việt cho SỔ NHẬT

Ngày lập và rà soát: 13/10/2026. Trạng thái: đã triển khai MVP tra bằng gõ chữ và thêm vào deck; các phần vẽ Kanji/dữ liệu Việt vẫn theo giai đoạn sau. Chi tiết vận hành và phạm vi hiện có trong `docs/dictionary.md`.

Điều chỉnh khi triển khai: schema MVP gộp ở V11; provenance/danh tính từ điển nằm trong cột server-owned của Card thay cho hai bảng liên kết, phối hợp khóa owner với các luồng add/edit/move/delete hiện có. Endpoint tạo deck từ từ điển có wrapper idempotent riêng để giữ tương thích API tạo deck cũ. Sense dùng hash nội dung + hạn chế + từ loại, không dùng ordinal; nghĩa thay đổi được coi là danh tính mới. Chưa có tác vụ xóa version/request tự động. Nhập nguồn Nhật–Anh JMdict trước; không công bố hỗ trợ corpus Việt.

Ưu tiên sản phẩm: người dùng tra được từ, chọn đúng nghĩa và thêm vào deck cá nhân trong một hộp thoại. Bản đầu phải hoàn thành luồng này từ đầu đến cuối; nhận dạng chữ viết có tiêu chí phát hành riêng.

## 1. Quyết định kiến trúc

- Frontend hiện có: React 19, TypeScript, Vite, Tailwind, React Router.
- Backend hiện có: Java 21, Spring Boot, JPA, MySQL, Flyway, JWT.
- Giữ MySQL cho bản đầu. Tra cứu bằng API Spring Boot; không đưa toàn bộ từ điển vào `AppProvider` hoặc gói JavaScript ban đầu.
- Nhận dạng nét chạy trong Web Worker trên trình duyệt. Chỉ tải bộ mẫu khi mở bảng vẽ; bản đầu nhắm phạm vi Jōyō, thông báo rõ phạm vi thực sự có dữ liệu.
- Hoạt ảnh nét dùng path KanjiVG và SVG/CSS trực tiếp.
- Cài thêm WanaKana cho chuyển đổi truy vấn romaji. Chưa thêm search server, thư viện canvas lớn, mô hình cloud hoặc Service Worker vào bản đầu.
- Định nghĩa `DictionarySearchEngine` ở backend để có thể thay MySQL bằng Meilisearch/Typesense nếu benchmark yêu cầu.

## 2. Nguồn dữ liệu và những điều cần xác minh

| Nguồn | Dùng cho | Quyết định |
| --- | --- | --- |
| JMdict | Mục từ, cách viết/đọc, nghĩa, từ loại, nhãn phổ biến | Nguồn nền; thống kê ngôn ngữ của snapshot thật trước khi công bố độ phủ tiếng Việt |
| KANJIDIC2 | On/Kun, số nét, bộ thủ và metadata Kanji | Giữ nguyên nguồn của từng trường; không suy diễn JLPT hiện hành từ metadata lịch sử |
| KanjiVG | Path nét, bộ phận chữ, thứ tự nét; mẫu cho thử nghiệm nhận dạng | Dữ liệu nét, không phải mô hình nhận dạng đã huấn luyện |
| Unihan | Âm Hán–Việt nếu trường tương ứng tồn tại | Cho phép thiếu/nhiều cách đọc; ghi nguồn, không coi là nghĩa tiếng Việt |
| Tatoeba | Câu Nhật và bản dịch được liên kết | Giai đoạn sau; giữ ID, tác giả và license của từng câu; chỉ gắn từ khi có liên kết đủ tin cậy |
| Dữ liệu tiếng Việt đang có | Nghĩa đã biên soạn trong thư viện | Xác minh quyền sử dụng trước khi nhập; ghép theo từ + cách đọc + nghĩa tương ứng, không ghép chỉ theo Kanji |

Khi chưa có nguồn Việt đủ rộng: giao diện ưu tiên nghĩa Việt đã xác minh, còn lại hiện nghĩa Anh với nhãn ngôn ngữ. Bản dịch máy phải có trạng thái riêng và không thay thế âm thầm bản đã duyệt. Không cam kết từ điển Nhật–Việt đầy đủ trước khi có báo cáo độ phủ.

Nguồn đã đối chiếu:

- [EDRDG](https://www.edrdg.org/edrdg/licence.html): phần dữ liệu thuộc tuyên bố này dùng CC BY-SA 4.0; cần ghi công, liên kết tài liệu và có quy trình cập nhật thường xuyên. Các thành phần ngôn ngữ khác có thể có chủ bản quyền riêng. Điều kiện dữ liệu không tự động yêu cầu toàn bộ mã app phải mở nguồn.
- [KanjiVG](https://kanjivg.tagaini.net/): CC BY-SA 3.0. Giữ thông tin nguồn và license riêng với JMdict.
- [Tatoeba](https://tatoeba.org/en/terms_of_use): kiểm tra license và tác giả theo từng bản ghi; không áp một license duy nhất cho mọi câu/audio.
- [Unicode](https://www.unicode.org/license.txt): giữ notice cho dữ liệu Unicode/Unihan được phân phối.
- [Yomitan](https://github.com/yomidevs/yomitan): repository GPL-3.0. Không chép mã/rule data sang app trước khi đánh giá nghĩa vụ phân phối; bản đầu tự xây quy tắc và kiểm thử từ tài liệu ngữ pháp.
- [WanaKana](https://wanakana.com/): chuyển romaji/kana; không phải bộ khử chia động từ hay từ điển.
- [Hanzi Writer](https://github.com/chanind/hanzi-writer): dữ liệu mặc định hướng tới chữ Trung Quốc; không dùng thay trực tiếp thứ tự nét tiếng Nhật.
- [ML Kit Digital Ink](https://developers.google.com/ml-kit/vision/digital-ink-recognition): tài liệu cung cấp tích hợp Android/iOS, không phải Web SDK.

## 3. Trải nghiệm người dùng

Route mới:

- `/dictionary?q=...`: ô tra cứu và hai chế độ **Gõ chữ / Vẽ Kanji**.
- `/dictionary/words/:entryKey`: từ, cách đọc, nghĩa theo sense, từ loại, ví dụ có nguồn, nút thêm vào bộ thẻ.
- `/dictionary/kanji/:character`: âm đọc, Hán–Việt nếu có, số nét, bộ thủ, hoạt ảnh nét, từ chứa chữ đó.
- `/dictionary/sources`: nguồn, phiên bản dữ liệu, ghi công và license.

Desktop dùng danh sách kết quả và khung chi tiết; mobile mở chi tiết bằng route để nút Back khôi phục truy vấn. Mỗi kết quả từ có nút **Thêm vào bộ thẻ**, thao tác trực tiếp mà không cần mở chi tiết. Cho phép xem/tra ở trạng thái chưa đăng nhập; đăng nhập khi lưu vào tài khoản hoặc thêm thẻ. Route từ điển phải được đặt trước `AuthGate`, hoặc có public layout riêng; không ép mọi người vào đăng nhập trước khi tra.

Thêm **Từ điển** ở sidebar và mục **Thêm** trên mobile, giữ bốn mục mobile chính hiện tại. `Ctrl+K` vẫn tìm nội dung học; thêm hành động “Tra trong từ điển” để chuyển truy vấn sang route mới.

Luồng vẽ: mở bảng → vẽ một chữ → nhận 8–12 ứng viên → bấm chữ → xem Kanji hoặc từ chứa chữ. Có hoàn tác, xóa hết, bàn phím thay thế và nút thử lại khi bộ mẫu chưa tải được.

## 4. Thiết kế dữ liệu và import

Các migration tiếp theo dự kiến `V11__dictionary_core.sql` và `V12__dictionary_saved_entries.sql`; kiểm tra lại số migration tại thời điểm code.

| Bảng/nhóm | Nội dung chính |
| --- | --- |
| `dictionary_sources` | Tên nguồn, URL, tác giả/license, yêu cầu attribution |
| `dictionary_dataset_versions` | Nguồn, version, checksum, thời điểm tải, trạng thái import, số bản ghi |
| `dictionary_catalog` | Con trỏ tới version đang phục vụ của từng nguồn |
| `dictionary_entries` | ID mục từ gốc, version, nhãn phổ biến và metadata |
| `dictionary_terms`, `dictionary_readings` | Chuỗi gốc, chuỗi chuẩn hóa, thứ tự, thông tin và hạn chế cách đọc |
| `dictionary_senses`, `dictionary_glosses` | Sense, từ loại, hạn chế cách viết/đọc, ngôn ngữ, nội dung, nguồn/trạng thái duyệt |
| `dictionary_search_tokens` | Token nghĩa Việt/Anh đã chuẩn hóa, liên kết sense, index để tìm kiếm |
| `dictionary_kanji` | Code point, âm đọc, bộ thủ, số nét, Hán–Việt và provenance theo trường |
| `dictionary_entry_kanji` | Liên kết chữ với mục từ để tìm “từ chứa Kanji” bằng index |
| `dictionary_examples` | Câu, bản dịch, ID/tác giả/license; thêm khi triển khai ví dụ |
| `dictionary_saved_entries` | Tài khoản + khóa mục từ ổn định, unique chống lưu trùng |

Khóa URL ổn định có dạng `jmdict:1234560`; không dùng ID tự tăng của mỗi lần import. Sense phải giữ quan hệ hạn chế cách viết/cách đọc; không flatten thành một chuỗi nghĩa gây ghép nhầm.

Importer chạy bằng CLI/profile quản trị có quyền riêng, không tạo API upload/import công khai:

1. Tải từ nguồn xác định, ghi manifest/checksum và giữ notice.
2. Parse streaming, giới hạn dung lượng; chặn external entity/XXE. Xử lý các entity nội bộ của JMdict bằng mapping/DTD tin cậy, không tắt DTD mù quáng làm hỏng dữ liệu.
3. Ghi version staging theo batch, tạo index, kiểm tra số lượng, ngôn ngữ, hạn chế sense và mẫu truy vấn.
4. Chuyển con trỏ catalog trong transaction sau khi mọi kiểm tra đạt; giữ version trước để rollback.
5. Cache key chứa version; không xóa snapshot nghĩa trong những flashcard người dùng đã lưu.
6. Có tác vụ cập nhật dữ liệu định kỳ và báo lỗi import; triển khai lịch chạy sau khi pipeline ổn định.

Không commit toàn bộ dump vào Git hoặc import hàng trăm nghìn mục bằng migration khởi động ứng dụng.

## 5. Tìm kiếm bằng gõ chữ

- Chuẩn hóa NFKC, khoảng trắng, hiragana/katakana để tìm, nhưng giữ chuỗi gốc để hiển thị. Tiếng Việt có biến thể không dấu và xử lý `đ`.
- Không tự đổi toàn bộ chữ Latin đang nhập sang kana: `an`, `ban`, `to` có thể là tiếng Việt/Anh hoặc romaji. Giữ truy vấn gốc, tìm thêm biến thể kana khi hợp lệ; cho phép chọn ngôn ngữ nếu cần.
- Tôn trọng IME composition: chỉ gửi truy vấn sau `compositionend`; debounce khoảng 200 ms, hủy request cũ, chống response tới chậm ghi đè kết quả mới.
- Ưu tiên kết quả: khớp chính xác cách viết → cách đọc → dạng gốc hợp lệ → prefix → nghĩa Việt/Anh. Nhãn phổ biến là tiêu chí phụ, có khóa phụ ổn định để phân trang không trùng.
- Tra Nhật bằng index exact/prefix. Tra nghĩa bằng token index; chưa hứa sửa lỗi gõ hoặc substring tùy ý. Không quét toàn bảng bằng `LIKE '%q%'` cho đường tìm kiếm chính.
- MySQL có [ngram parser cho CJK](https://dev.mysql.com/doc/refman/8.4/en/fulltext-search-ngram.html), nhưng chỉ bật sau benchmark; phải kiểm thử từ một chữ, token size và stopword.
- Khử chia ở backend để mọi client cùng kết quả. Rule theo nhóm động từ/tính từ; giới hạn độ sâu/số ứng viên, loại vòng lặp; chỉ trả dạng gốc có mục từ và từ loại tương thích.
- Hiển thị “食べました → 食べる” và lý do biến đổi; không kết luận mọi chuỗi kết thúc giống nhau là cùng từ.

API đọc công khai, namespace riêng tránh đụng `/api/v1/decks`:

| API | Hợp đồng |
| --- | --- |
| `GET /api/v1/dictionary/search?q=...&cursor=...&limit=20` | Tối đa 50 kết quả/lần; cursor gắn query + dataset version; trả matchType, matchedForm, glossLanguage, nguồn |
| `GET /api/v1/dictionary/words/{entryKey}` | Mục từ và sense đầy đủ từ version đang active |
| `GET /api/v1/dictionary/kanji/{character}` | Một code point hợp lệ; metadata và thông tin tài nguyên nét |
| `GET /api/v1/dictionary/kanji/{character}/words` | Từ liên quan, phân trang |
| `GET /api/v1/dictionary/sources` | Attribution và version dữ liệu |
| `GET /api/v1/dictionary/handwriting/manifest` | Version, phạm vi mẫu, URL/checksum các shard |

Validation: độ dài query tối đa 100 code point, limit giới hạn, SQL parameterized, rate limit ở proxy/API gateway. Không mở public toàn bộ `/api/v1/dictionary/**` vì sẽ có endpoint ghi.

## 6. Nhận dạng chữ viết: làm thử sớm

Canvas dùng Pointer Events cho chuột/bút/ngón tay, pointer capture, `pointercancel`, tọa độ độc lập DPR. Chỉ chặn cuộn bên trong vùng vẽ; giới hạn số nét và số điểm, giữ nét gốc để undo.

Pipeline đề xuất:

1. Chuẩn hóa toàn chữ về cùng hệ tọa độ, giữ tỉ lệ và vị trí tương đối các nét.
2. Loại điểm nhiễu, resample mỗi nét theo độ dài đường đi.
3. Lọc mẫu theo số nét với ngưỡng sai lệch nhỏ; có fallback nếu thiếu/thừa nét.
4. Chấm theo hình học, hướng nét, vị trí và thứ tự; thử DTW hoặc so khớp điểm chuẩn hóa. Thêm chế độ dung sai thứ tự khi benchmark cần.
5. Worker trả top 8–12 và request ID; bỏ kết quả của lần vẽ cũ, không hiển thị điểm khoảng cách như xác suất chính xác.

Tạo bộ test viết tay độc lập từ nhiều người và thiết bị, tách khỏi bộ mẫu chuẩn. Mục tiêu thử nghiệm: top-10 đúng >=85% trên tập đánh giá được công bố, thời gian worker p95 <=200 ms sau khi tải mẫu trên thiết bị tham chiếu. Đây là tiêu chí nghiệm thu dự kiến, không phải độ chính xác đã đạt.

Nếu chưa đạt: tinh chỉnh và đo lại; đánh giá recognizer/model khác có license phù hợp. API trả phí là phương án sau, cần quyết định chi phí và việc gửi dữ liệu ra ngoài. Không công bố “nhận dạng mọi Kanji” chỉ vì đã tải KanjiVG.

## 7. Chi tiết Kanji và lưu vào bộ thẻ

- Build tool trích path đã kiểm tra từ KanjiVG; chỉ dựng SVG từ geometry whitelist. Không render SVG/XML bên ngoài trực tiếp bằng `dangerouslySetInnerHTML`.
- Hoạt ảnh có phát/dừng, từng nét, làm lại và reduced-motion; tải path theo từng chữ, cache bằng version/hash.
- Hiển thị thiếu dữ liệu rõ ràng. Nhãn JLPT chỉ hiện với nguồn xác định, có phân biệt danh sách lịch sử và danh sách tham khảo hiện hành.
- Đây là tính năng thuộc bản tra cứu đầu tiên, không đợi hoàn thiện nhận dạng chữ viết.
- Luồng nhanh: tra từ → **Thêm vào bộ thẻ** ngay tại kết quả → một hộp thoại chọn deck và xem nội dung thẻ → **Thêm thẻ**. Giữ nguyên truy vấn, vị trí danh sách và trang kết quả sau khi lưu.
- Hộp thoại chọn deck có tìm theo tên, hiển thị nhóm, hỗ trợ tất cả trang dữ liệu, không chỉ 20 deck đầu tiên. Chỉ liệt kê bộ cá nhân được phép sửa; không liệt kê bộ thư viện chỉ đọc.
- Nhớ deck vừa thêm thành công trong namespace tài khoản để gợi ý cho lần tiếp theo; hiển thị rõ tên deck trước khi xác nhận, không lưu lựa chọn của tài khoản A sang tài khoản B.
- Nếu chưa có bộ phù hợp, cho phép **Tạo bộ mới** ngay trong hộp thoại và chọn bộ vừa tạo; dùng API tạo deck hiện có, giữ bản nháp từ đang thêm nếu thao tác lỗi.
- Mặt trước mặc định là từ Nhật; cách đọc lưu vào trường reading; mặt sau là nghĩa được chọn. Ưu tiên nghĩa Việt đã duyệt, có nhãn khi dùng nghĩa Anh. Hiện preview ngay; cho chọn cách đọc, sense/nghĩa và chỉnh nội dung trước khi lưu. Không gom mọi nghĩa khác nhau thành một thẻ quá dài.
- API dự kiến `POST /api/v1/dictionary/words/{entryKey}/cards`, có `targetDeckId`, sense/cách đọc đã chọn, nội dung đã chỉnh trong giới hạn, `Idempotency-Key`; backend kiểm tra owner, bộ chưa bị xóa và nội dung hợp lệ, tạo snapshot thẻ trong transaction. Không để frontend tự nhận là chủ bộ.
- Response trả `cardId`, `deckId`, kết quả `added` hoặc `alreadyExists`. Retry dùng cùng idempotency key; thêm cùng mục từ + cách đọc + tập nghĩa vào cùng deck kiểm tra bản đang tồn tại, kể cả từ tab khác. Khóa/transaction bảo vệ check-and-insert; không tự ghi đè thẻ đã chỉnh sửa. Nếu thẻ đã bị xóa/chuyển khỏi deck thì có thể thêm lại. Vẫn cho phép thêm từ vào một deck khác hoặc thêm nghĩa khác.
- Thành công báo **Đã thêm [từ] vào [tên deck]**, có lối mở bộ thẻ và cập nhật số thẻ. Nút đang lưu bị khóa để tránh bấm lặp; lỗi mạng giữ toàn bộ bản nháp để thử lại.
- Guest bấm thêm sẽ được mời đăng nhập/đăng ký. Giữ từ, nghĩa đã chọn và truy vấn xuyên bước đăng nhập; sau đó mở lại hộp chọn deck để người dùng xác nhận, không tự thêm vào tài khoản vừa đăng nhập. Bỏ kết quả request từ phiên tài khoản cũ.
- `sourceType` thuộc Deck, không thuộc Card. Khi tạo deck mới dùng `MANUAL` và `PRIVATE`; khi thêm vào deck IMPORT giữ nguyên loại deck. Card dùng `kind=VOCABULARY` đã có trong `DomainTypes.CardKind`, các trường front/back/reading và metadata từ điển do server sinh. Không gán enum mới hoặc đổi loại deck đích. Giữ `dictionaryRef`, version, nguồn và attribution trong `extraData`; danh tính chống trùng lưu riêng phía server, không phụ thuộc JSON người dùng có thể sửa.
- Snapshot không đổi theo lần cập nhật từ điển. Thẻ mới chưa có lịch ôn; chỉ nhận trạng thái FSRS khi người học bắt đầu ôn.
- Guest lưu lịch sử/yêu thích theo namespace riêng, có giới hạn; tài khoản đồng bộ bằng endpoint dictionary riêng. Không ép ID từ điển vào bookmark vocabulary/kanji cũ hoặc tự cộng vào dữ liệu học cũ.

## 8. Các đầu việc code và thứ tự nghiệm thu

| Bước | Việc code | Kết quả phải có |
| --- | --- | --- |
| 0A | Manifest nguồn, thống kê độ phủ Việt, fixture nhỏ có license | Chốt dữ liệu nào được dùng; không có dữ liệu mượn không rõ nguồn |
| 0B | Prototype canvas + worker + template matcher | Báo cáo top-k/độ trễ và phạm vi hỗ trợ, quyết định hướng nhận dạng |
| 1 | Schema, importer staging, version active/rollback | Import/re-import được; không làm gián đoạn bản đang phục vụ |
| 2 | SearchEngine MySQL, API đọc, normalization, WanaKana | Tra kanji/kana/romaji/Việt/Anh; exact/prefix đúng, hủy request cũ |
| 3 | Rule deinflection, fixtures và POS validation | Tra `食べました`, `書いて`, `高かった`, `行った`, `勉強しました`; loại kết quả biến đổi sai |
| 4 | Route/layout dictionary, word detail, nguồn; thêm từ vào deck ngay từ kết quả tìm kiếm | Guest tra được; chọn deck/tạo deck ngay trong hộp thoại, lưu thẻ chống trùng; responsive và IME hoạt động |
| 5 | Tích hợp nhận dạng đã đạt 0B, Kanji detail/animation | Vẽ → chọn chữ → tra; undo/clear/mobile; không block luồng chính |
| 6 | Yêu thích, lịch sử, hoàn thiện lối thêm thẻ từ trang Kanji/luồng vẽ | Đồng bộ đúng tài khoản, không sửa lịch ôn đang có |
| 7 | Tatoeba, mở rộng tiếng Việt, tác vụ cập nhật và vận hành | Nguồn theo bản ghi, rollback và theo dõi độ phủ/chất lượng |

0A là điều kiện cho nhánh tra cứu. 0B là thử nghiệm độc lập có giới hạn thời gian đề xuất hai ngày làm việc để đo khả thi ban đầu; thu thập bộ đánh giá đại diện có thể cần thêm thời gian. Nếu chưa đạt, giữ tính năng vẽ sau flag và tiếp tục phát hành tra cứu + thêm deck. Thứ tự phát hành: 0A → 1–2 → 4; bước 3 bổ sung trước khi công bố hỗ trợ từ đã chia, không chặn bản exact/prefix đầu tiên. Bước 5 phụ thuộc kết quả 0B; bước 6–7 triển khai sau.

## 9. File dự kiến

Frontend mới:

```text
src/components/dictionary/
  DictionaryLayout.tsx
  DictionaryPage.tsx
  DictionarySearchBox.tsx
  DictionaryResults.tsx
  WordDetailPage.tsx
  KanjiDetailPage.tsx
  HandwritingPanel.tsx
  StrokeOrderPlayer.tsx
  AddDictionaryCardDialog.tsx
  DictionarySourcesPage.tsx
src/lib/dictionary/
  api.ts
  types.ts
  normalizeQuery.ts
  handwriting.worker.ts
  strokeMatching.ts
  historyStorage.ts
scripts/dictionary/build-kanjivg.mjs
tests/dictionarySearch.test.mjs
tests/handwritingGeometry.test.mjs
tests/dictionary.browser.mjs
```

File hiện có cần sửa: `App.tsx`, `types/index.ts`, `lib/navigation.ts`, `layout/navigationItems.ts`, `search/SearchModal.tsx`. Tái dùng `AppLoading`, `AppDialog`, kiểu button và theme hiện tại.

Backend mới dưới `com.japaneselearning.japanese_learning_api.dictionary`:

```text
DictionaryController.java
DictionaryService.java
DictionaryDtos.java
DictionarySearchEngine.java
MysqlDictionarySearchEngine.java
DictionaryNormalizer.java
JapaneseDeinflector.java
DictionaryImportCommand.java
DictionaryImportService.java
DictionaryCardService.java
DictionarySavedController.java
DictionarySavedService.java
model/*, repository/*
```

Importer quản trị, endpoint đọc công khai và endpoint ghi tài khoản có quyền riêng. Các migration/test nằm đúng thư mục hiện có của backend.

## 10. Tiêu chí kiểm thử và triển khai

- Search fixture: Kanji, kana, katakana nửa rộng, romaji, Việt có/không dấu, nhiều sense/reading, từ một chữ, truy vấn không có kết quả, chuỗi đặc biệt, deinflection mơ hồ.
- Dữ liệu: internal entity JMdict parse đúng, external entity bị chặn, import lỗi không đổi version active, cập nhật không đổi khóa URL, sense restriction không mất.
- MySQL thật: index/EXPLAIN, migration, truy vấn Unicode/collation, phân trang ổn định và benchmark dữ liệu đủ lớn; H2 không thay thế kiểm thử search MySQL.
- Browser: IME, abort/race, Back/URL, thêm từ ngay từ kết quả mà không mất truy vấn; chọn deck ngoài trang đầu/ở trong nhóm; tạo deck mới; nhớ deck theo tài khoản; Guest→đăng nhập giữ draft; chọn nghĩa; bấm lặp/retry/thêm đồng thời ở hai tab; đổi tài khoản khi request đang chạy; dark/mobile/reduced-motion, canvas pointercancel/DPR và mẫu tải lỗi.
- Quyền: public chỉ GET được cho phép; mọi ghi dữ liệu kiểm tra owner; retry idempotent.
- Mục tiêu hiệu năng ban đầu: search API p95 <=200 ms trên máy tham chiếu khi cache nóng; UI phản hồi sau debounce và mạng được đo riêng. Ghi lại số bản ghi, cấu hình máy và độ phủ ngôn ngữ khi báo cáo.
- Bật bằng feature flag sau khi dữ liệu/index/manifest sẵn sàng. Deploy schema/backend trước, import và smoke-test, rồi bật frontend. Có thể tắt feature mà không đụng dữ liệu học cũ.
- Bản đầu không bao gồm tải toàn bộ từ điển offline. Worker nhận dạng có thể chạy offline sau khi mẫu đã cache; tra từ vẫn cần API. PWA/offline package là giai đoạn riêng.

## 11. Phạm vi chốt cho lần code đầu

Làm 0A rồi triển khai lát cắt hoàn chỉnh: import fixture có nguồn → API exact/prefix → trang tra cứu → đăng nhập → chọn/tạo deck → lưu → mở và học được thẻ. Sau khi kiểm thử lát cắt đạt, nhập dữ liệu đầy đủ và đo hiệu năng trước khi phát hành. Thử nghiệm 0B độc lập; hoàn thiện bước 3 và 5–6 theo tiêu chí riêng. Giữ việc thêm search server, cloud OCR và dịch máy hàng loạt thành quyết định riêng dựa trên số liệu.

## 12. Điểm tích hợp đã đối chiếu với code

| Code hiện có | Điều chỉnh cần đưa vào implementation |
| --- | --- |
| `DeckController.list` có cả API danh sách toàn bộ và phân trang; chưa có tìm theo tên | Thêm `GET /api/v1/decks/options?q=...&cursor=...&limit=20` có xác thực, chỉ trả id/name/groupId/sourceType và quyền thêm. Tìm tên ở server, sort tên + id ổn định, không tải toàn bộ thẻ hoặc tính lịch ôn cho từng deck. Thêm API client ở `lib/deckApi.ts`. |
| `DeckService.addCard` lấy vị trí từ cardCount; các luồng move/delete/reorder sửa cùng dữ liệu | Trích thao tác ghi thẻ dùng chung, xác định vị trí từ dữ liệu thẻ hoạt động. Áp dụng cùng giao thức khóa deck cho mọi đường ghi liên quan; move khóa các deck theo UUID tăng dần. Kiểm thử xung đột với add thường, move, delete, reorder và xóa deck, không chỉ hai lần thêm từ điển. |
| `Card.extraData` có thể bị thay toàn bộ qua updateCard | Lưu provenance tối thiểu và khóa nhận diện ở bảng server riêng; JSON chỉ là bản sao để hiển thị/xuất. Khi edit không làm mất danh tính từ điển. |
| `CardPresentation` sử dụng template của deck và dữ liệu nhập riêng | Preview dùng renderer/template thật của deck đích. Thẻ từ điển không giả lập importFieldLayout/importFieldValues. Với template thiếu trường cần thiết, hiển thị rõ preview và cho đổi deck; không âm thầm sửa template toàn bộ deck. |
| Trang deck và trang public từ điển có vòng đời dữ liệu khác nhau | Mutation trả summary deck mới; làm mới metadata/list/count khi quay lại deck, và phát tín hiệu thay đổi theo tài khoản giữa các tab. Không gọi hàm lưu lại toàn bộ deck để thêm một thẻ. |

## 13. Hợp đồng thêm thẻ, chống trùng và cập nhật nguồn

- Request gồm `entryKey`, `datasetVersion`, `writtenForm`, `reading`, `senseIds`, `targetDeckId`, nội dung đã chỉnh và idempotency key. Server kiểm tra tổ hợp cách viết/cách đọc/sense hợp lệ. Nguồn, attribution và dấu đã duyệt do server xác định; client không tự cung cấp giá trị tin cậy.
- Sense ordinal không phải danh tính ổn định qua các snapshot. Importer tạo khóa sense nội bộ và ánh xạ qua phiên bản khi nội dung/hạn chế khớp chắc chắn; thay đổi mơ hồ không tự hợp nhất. Khóa chống trùng gồm entry + cách viết + cách đọc + tập khóa sense đã sắp xếp. Không dùng số thứ tự sense hay văn bản mặt sau người dùng sửa làm khóa.
- Bổ sung bảng `dictionary_card_links` liên kết card với khóa nguồn/sense và snapshot provenance; bảng `dictionary_active_card_keys` có unique `(deck_id, identity_hash)` trỏ tới thẻ còn hoạt động. Lưu/kiểm tra canonical identity bên cạnh hash. Delete/move/copy phải xử lý liên kết trong cùng transaction; khi move gặp khóa trùng ở đích trả lỗi có thể hiểu được và không di chuyển một phần. Dữ liệu snapshot của thẻ vẫn còn khi version cũ bị dọn.
- Bổ sung `dictionary_write_requests`: unique `(user_id, operation, idempotency_key)`, request hash và kết quả đã commit. Cùng key/cùng payload trả lại kết quả; cùng key/payload khác trả `409 IDEMPOTENCY_CONFLICT`. Lưu kết quả cùng transaction tạo thẻ. Đề xuất giữ tối thiểu 7 ngày, công bố thời hạn trong hợp đồng; semantic dedup vẫn hoạt động sau khi key hết hạn.
- Retry sau timeout giữ key và payload cũ. Khi người dùng sửa nội dung hoặc đổi deck, đó là thao tác mới với key mới. Replay không tạo lại thẻ đã xóa: trả kết quả thao tác cũ kèm trạng thái hiện tại; chủ động thêm lại dùng key mới.
- Tạo deck ngay trong dialog cũng cần chống retry tạo nhiều deck: mở rộng `POST /decks` với idempotency key tùy chọn và request hash, giữ tương thích client cũ. Nếu deck đã tạo nhưng lưu thẻ lỗi, giữ deck đó được chọn để thử lại.
- Import version thay trong lúc dialog mở: đọc đúng version đã chọn nếu còn được giữ; nếu đã hết hạn, trả `409 DICTIONARY_VERSION_EXPIRED`, giữ phần người dùng sửa và mời tải lại nghĩa để xác nhận. Không lấy sense ordinal cũ áp vào version mới. Entry bị rút khỏi nguồn không làm mất thẻ đã lưu.
- Lỗi chuẩn: `401` giữ draft và yêu cầu đăng nhập; `404` deck không còn truy cập được, giữ draft để chọn lại; `409` theo mã ở trên; `429` theo Retry-After; `503 DICTIONARY_NOT_READY` khi chưa có dữ liệu. Không hiển thị lỗi server chi tiết cho người dùng.
- Các bảng phục vụ thêm thẻ phải có trong migration MVP, trước migration yêu thích. Chốt số V mới theo repository lúc triển khai; bảng favorites/examples không cần tạo sớm.

## 14. Trạng thái giao diện và điều kiện phát hành

- Dialog mở với nghĩa phù hợp kết quả đang chọn; nghĩa khác nằm trong mục chỉnh sửa mở rộng. Tự chọn deck gần nhất nếu vẫn hợp lệ; nếu chỉ có một deck thì chọn sẵn. Nút xác nhận ghi rõ “Thêm vào [tên deck]”. Người dùng không cần chọn lại các thông tin mặc định đúng.
- Khi từ đã tồn tại, báo “Đã có trong bộ thẻ” và cho mở thẻ; không chỉ báo thành công chung chung. Không gọi một API kiểm tra cho từng dòng kết quả: kiểm tra tại thao tác lưu, chỉ thêm batch lookup nếu trải nghiệm thực tế cần.
- Phân biệt đang tải, không tìm thấy từ, chưa có dataset và mất kết nối. Kết quả cũ được giữ khi tải truy vấn mới nhưng ghi rõ trạng thái; không để nút thêm gắn nhầm từ với truy vấn mới. Bộ vẽ chỉ hiện khi flag và manifest sẵn sàng.
- URL giữ query và bộ lọc; Back khôi phục vị trí. Cursor gắn query/filter/version, version hết hạn thì làm mới từ trang đầu có thông báo thay vì nối hai dataset. Mỗi request search/detail lấy một snapshot catalog nhất quán.
- Bàn phím dùng được toàn bộ: focus dialog, Escape/đóng trả focus về nút mở, tên nút dễ đọc với screen reader, thông báo lưu qua aria-live. Trên mobile bàn phím không che nút xác nhận; lỗi nằm cạnh trường tương ứng.
- Draft đăng nhập chỉ giữ dữ liệu cần thiết trong sessionStorage có thời hạn đề xuất 30 phút; không lưu token vào draft. Hủy hoặc hoàn tất thì xóa; đổi tài khoản phải xác nhận lại deck và bỏ request cũ.
- Báo cáo nghiệm thu gồm: bộ truy vấn có expected top-k; MySQL thật với số bản ghi và concurrency công bố (đề xuất 20 client); p50/p95 lỗi/độ trễ; chi phí lưu staging + hai version; kế hoạch dọn version không còn phục vụ cursor/draft. Tránh giới hạn chỉ benchmark cache nóng đơn luồng.
- Đo tỷ lệ tìm kiếm → mở dialog → thêm thành công, lỗi thêm và truy vấn không có kết quả dưới dạng số tổng hợp; không ghi mặc định raw query, nội dung thẻ hay chữ viết tay. Mục tiêu UX: người đã có deck gần nhất thêm được từ mặc định bằng hai lần bấm từ kết quả.
- Điều kiện phát hành MVP: guest tra được; người đăng nhập thêm vào deck MANUAL lẫn IMPORT và học được; mất mạng/retry không tạo trùng; tạo deck không trùng; nhiều tab và các đường ghi deck không sai count/position; snapshot/version cũ không gán sai nghĩa; attribution được giữ khi share/copy/export. Build/lint, integration MySQL và browser flow phải đạt.
- Tách flag đọc từ điển, thêm thẻ và nhận dạng. Pipeline cập nhật/rollback có trước phát hành; lịch cập nhật và người vận hành được chốt ngay khi đưa dữ liệu lên thật, không trì hoãn toàn bộ sang giai đoạn 7.
