# Kế hoạch tối ưu import, furigana và tùy chỉnh thẻ

## Summary

Chuẩn hóa mọi định dạng import vào một model thẻ duy nhất, thêm furigana có cấu trúc cho cả hai mặt, và mở rộng dialog tùy chỉnh để sửa thẻ import hiện tại cùng typography. Dùng API/`extraData` hiện có, không đổi schema backend hay thuật toán SRS.

## Context

- `src/lib/ankiImport.ts` đang là điểm hội tụ của JSON, TXT/CSV/TSV và Excel, nhưng chỉ có một `reading`, chưa có cảnh báo furigana hoặc font family.
- `src/components/flashcard/ImportedDecks.tsx` đang chứa cả tạo bộ, hướng dẫn JSON, đọc file, lưu API, quản lý và bắt đầu phiên học; hướng dẫn import và editor trường thẻ cần được tách để giảm độ phức tạp.
- `src/components/flashcard/ImportPreviewEditor.tsx` luôn hiển thị toàn bộ ánh xạ cột, làm luồng phổ biến nặng hơn cần thiết.
- `src/components/flashcard/CardPresentation.tsx` lưu style theo từng mặt nhưng chưa chọn font hoặc sao chép style giữa hai mặt. Dialog chỉ nhận một thẻ mẫu và chỉ lưu template.
- `src/components/flashcard/StudySession.tsx` sở hữu `sessionCards`; việc sửa thẻ hiện tại phải cập nhật API trước rồi thay đúng phần tử tại đây để không đổi vị trí hoặc tiến trình.
- Backend đã có `PATCH /cards/{id}`, `PATCH /decks/{id}` và `extraData`; có thể lưu `backReading` và các segment furigana mà không migration database.
- Ba font được cung cấp đều có OFL 1.1: Dela Gothic One, Noto Sans JP và Noto Serif JP. File nguồn là TTF; cần chuyển WOFF2 và giữ giấy phép trong repo.

## System Impact

Nguồn sự thật sau thay đổi vẫn là card/template trên backend. Parser tạo một `ImportedCard` chuẩn có `reading` mặt trước, `backReading` mặt sau và segment furigana trong `extraData`. `CardView` mang các trường này vào phiên học. `FuriganaText` là nơi duy nhất diễn giải và render ruby, tránh lặp thuật toán trong preview, dialog và phiên học.

Template thêm `fontFamily` và tăng version để migration rõ ràng. `normalizeDeckTemplate` là cửa vào duy nhất cho template cũ/mới. Nút đồng bộ style chỉ sao chép snapshot style hiện tại; hai mặt không tạo state liên kết lâu dài.

Import tiếp tục dùng worker và idempotency key. Mọi định dạng đi qua cùng `ImportTable` và `remapImportPreview`; cảnh báo furigana tách khỏi lỗi làm bỏ dòng. Sửa card trong preview thay bản card chuẩn sau mapping; thay mapping sẽ tái tạo preview và thông báo rằng sửa nội dung cần thực hiện lại.

Sửa thẻ trong phiên học chỉ được cấp khi `CardView.source === "IMPORT"`. Lưu card và template là hai mutation độc lập, chỉ gửi phần đã đổi. State local cập nhật sau phản hồi thành công; lỗi giữ dialog mở và hiển thị phần chưa lưu.

## Approach

Chọn giải pháp nhỏ nhất vẫn thống nhất hệ thống:

1. Tách parser/render furigana thành module dùng chung, không thêm thư viện phân tích tiếng Nhật và không tự đoán cách đọc.
2. Mở rộng model frontend và `extraData`, tái sử dụng API hiện tại.
3. Tách hướng dẫn import và form nội dung thẻ thành component dùng lại thay vì tiếp tục mở rộng `ImportedDecks.tsx`/`CardPresentation.tsx`.
4. Dùng self-hosted WOFF2, `font-display: swap`, tải font theo lúc được dùng; không cho CSS/font URL tùy ý.
5. Giữ advanced mapping nhưng mặc định thu gọn khi `front`/`back` đã nhận dạng, giúp luồng chính chỉ còn chọn file, kiểm tra và nhập.

## Changes

- [ ] `src/lib/furigana.ts` — thêm parser cú pháp `Kanji[hiragana]`, căn reading theo kana khi chỉ có một kết quả, serialize/parse segment an toàn và trả cảnh báo có vị trí.
- [ ] `src/lib/ankiImport.ts` — thêm `backReading`, mapping alias hai mặt, warning riêng, segment furigana hai mặt, font family/version migration và chuẩn hóa giống nhau cho mọi định dạng.
- [ ] `src/lib/deckApi.ts` và `src/lib/cards.ts` — chuyển đổi `backReading`/segments qua `extraData`, bảo toàn tags/metadata khi đổi giữa `ImportedCard`, API card và `CardView`.
- [ ] `src/components/flashcard/FuriganaText.tsx` — render `ruby`/`rt`, fallback reading riêng khi alignment không chắc chắn, tuân theo bật/tắt phiên âm của từng mặt.
- [ ] `src/components/flashcard/CardFields.tsx` — form nội dung thẻ dùng chung cho quản lý, preview và dialog; hỗ trợ front/back markup, reading hai mặt, Hán Việt, note, type, tags và cảnh báo trực tiếp.
- [ ] `src/components/flashcard/ImportGuide.tsx` — một hướng dẫn import chung, ví dụ chuyển đổi giữa định dạng, file mẫu và prompt có nút sao chép.
- [ ] `src/components/flashcard/ImportPreviewEditor.tsx` — preview gọn mặc định, mapping nâng cao mở theo nhu cầu/lỗi, hiển thị ruby thật và cho sửa card trước khi import.
- [ ] `src/components/flashcard/ImportedDecks.tsx` — dùng component mới, đơn giản hóa ba bước import, thêm mẫu TXT/TSV, chuyển callback sửa card import vào phiên học và giữ draft/idempotency hiện tại.
- [ ] `src/components/flashcard/CardPresentation.tsx` — chọn năm font, nút áp dụng style sang cả hai mặt, preview furigana hai mặt, và vùng sửa thẻ hiện tại chỉ khi được truyền quyền sửa.
- [ ] `src/components/flashcard/StudySession.tsx` — truyền thẻ import hiện tại vào dialog, lưu card/template theo phần thay đổi và thay card đã xác nhận trong `sessionCards`.
- [ ] `src/index.css`, `public/fonts/**` — khai báo ba font self-hosted, giữ OFL, thêm style ruby responsive và cho phép synthetic weight/oblique với Dela Gothic One.
- [ ] `tests/furigana.test.mjs` — kiểm thử explicit markup, auto alignment chắc chắn, trường hợp mơ hồ, lỗi ngoặc và round-trip segments.
- [ ] `tests/ankiImport.test.mjs` — fixture tương đương JSON/TXT/CSV/TSV/XLSX/XLS, reading hai mặt, tags/examples, warnings, migration font/template.
- [ ] `tests/importCustomization.browser.mjs` — kiểm tra ruby hai mặt, font/style đồng bộ, chỉnh thẻ import hiện tại, reload và giới hạn quyền của bộ built-in/manual.
- [ ] `docs/anki-import.md` — cập nhật schema chung, cú pháp furigana hai mặt và prompt giống UI.

## Verification

- Chạy `npm test` và xác nhận toàn bộ unit/contract tests đạt.
- Chạy `npm run build` để kiểm tra TypeScript, worker import và bundle font/CSS.
- Chạy `npm run lint`; không tạo warning mới trong các file sửa.
- Chạy browser test với local Vite/API cho luồng: import từng định dạng, sửa preview, lưu bộ, học, sửa thẻ hiện tại, đổi font, đồng bộ style, tải lại.
- Kiểm tra thủ công desktop/mobile: drag-drop và file picker, mapping tự động/nâng cao, focus keyboard, overflow với cỡ 72 px, ruby ở hai mặt và font fallback trong lúc WOFF2 tải.
- Kiểm tra backend không đổi schema: card reload giữ `backReading`, segment hai mặt, tags và SRS hiện tại.

## Invariants

- Không tự tạo cách đọc nếu người dùng không cung cấp.
- Không cho sửa nội dung bộ built-in hoặc nội dung bộ manual trong dialog tùy chỉnh.
- Không xóa tiến trình SRS khi sửa nội dung.
- Không lưu markup ngoặc vào `front`/`back` hiển thị; lưu text sạch và segment có cấu trúc.
- Không để lỗi furigana làm mất thẻ có `front`/`back` hợp lệ.
- Không tải hoặc thực thi HTML/CSS/font URL từ file import.
