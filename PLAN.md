# Kế hoạch triển khai import Anki theo trường tùy ý

## Summary

Cho phép mọi file JSON, CSV, TSV, TXT và Excel dùng tên trường riêng. Parser tạo một bố cục trường có version; giao diện cho đặt và sắp xếp trường vào hai mặt, hai nguồn cách đọc, ghi chú hoặc nhãn; preview và phiên học dùng cùng dữ liệu có cấu trúc.

## Context

- `src/lib/ankiImport.ts` hiện đọc được mọi định dạng nhưng chỉ ánh xạ một cột vào mỗi trường cố định.
- `ImportPreviewEditor.tsx` tổ chức UI theo trường đích nên khó hiểu và không cho nhiều trường trên một mặt.
- Card/backend đã có `extraData`, đủ để lưu bố cục và giá trị nguồn mà không đổi schema API.
- `CardFace` là renderer chung của phiên học; mở rộng tại đây giúp preview và lúc học không lệch nhau.
- `resolveFurigana` đã hỗ trợ cú pháp `Kanji[hiragana]` và căn reading an toàn, nên không thêm thư viện hay tự đoán cách đọc.

## System Impact

Nguồn sự thật của file đang import là `ImportTable.sourceFields`. `mapping` vẫn tồn tại để tương thích draft cũ và metadata đã biết. Mỗi card tiếp tục có `front`/`back` dạng text để tìm kiếm và dùng với client cũ, đồng thời lưu `importFieldLayout` và `importFieldValues` trong `extraData` để renderer hiện đúng các block có nhãn và thứ tự.

Không có state bố cục trùng lặp trong component: mọi thao tác cập nhật `ImportTable`, sau đó `remapImportPreview` tạo lại card, cảnh báo và preview. Card cũ không có layout sẽ đi qua renderer hiện tại. Khi người dùng sửa trực tiếp nội dung một card sau import, layout nguồn của riêng card đó được bỏ để nội dung vừa sửa trở thành nguồn sự thật.

## Changes

- [x] `src/lib/ankiImport.ts` — thêm model bố cục trường, mặc định trường đầu tiên ở mặt trước, semantic suggestions, migration mapping cũ, multi-field composition, structured extraData, helpers gán/sắp xếp/đọc block.
- [x] `tests/ankiImport.test.mjs` — thêm test field tùy ý, mặc định một trường mặt trước, nhiều trường mặt sau, reorder, legacy migration, round-trip và furigana hai mặt.
- [x] `src/components/flashcard/ImportPreviewEditor.tsx` — đổi thành danh sách trường nguồn có sample, select vị trí, nút lên/xuống, lỗi thiếu mặt và preview dùng renderer chung.
- [x] `src/components/flashcard/CardPresentation.tsx` — render các block import có cấu trúc; block đầu dùng reading của mặt tương ứng, các block sau giữ markup furigana riêng.
- [x] `src/components/flashcard/CardFields.tsx` — khi sửa trực tiếp front/back thì bỏ layout nguồn cũ để tránh hiển thị dữ liệu stale.
- [x] `src/components/flashcard/ImportGuide.tsx` — nói rõ không cần file mẫu; prompt AI cho phép tên trường tùy ý và hướng dẫn furigana đúng mặt.
- [x] `tests/flexibleAnkiImport.browser.mjs` — kiểm tra UI gán/reorder và preview khớp CardFace.
- [x] Chạy lint, unit tests, browser tests và build; kiểm tra desktop/mobile bằng Playwright.

## Verification

- `node --experimental-strip-types --test tests/ankiImport.test.mjs`
- `npm test`
- `node tests/flexibleAnkiImport.browser.mjs`
- `node tests/importCardCustomization.browser.mjs`
- `npx oxlint src/lib/ankiImport.ts src/components/flashcard/ImportPreviewEditor.tsx src/components/flashcard/CardPresentation.tsx src/components/flashcard/CardFields.tsx src/components/flashcard/ImportGuide.tsx`
- `npm run build`

## Invariants

- Field nguồn đầu tiên là field duy nhất ở mặt trước mặc định.
- Không bỏ field chưa biết trừ khi người dùng chọn `Không dùng`.
- Front/back bắt buộc có ít nhất một field với dữ liệu.
- Reading hai mặt không dùng thay cho nhau.
- Chỉ tạo ruby khi markup rõ ràng hoặc căn reading không mơ hồ.
- Bộ thẻ cũ và built-in không đổi cách render.
- Không đổi schema backend và không thực thi HTML/JS từ file import.
