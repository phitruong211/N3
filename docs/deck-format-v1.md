# Định dạng bộ thẻ SỔ NHẬT v1 (`sonhat.deck`)

Trạng thái: **Cả 4 giai đoạn đã triển khai** (xem "Triển khai thực tế" và các mục "Giai đoạn 2", "3", "4" ngay dưới).
Thay thế dần: [anki-import.md](anki-import.md) (cách nhập hiện tại) và phần dữ liệu của [deck-sharing.md](deck-sharing.md).

## Triển khai thực tế của Giai đoạn 1

Những điểm khác hoặc cụ thể hơn so với bản nháp, do quá trình làm:

- **Bốn loại thẻ dựng sẵn dùng chung bộ 7 trường** (`front, frontReading, back, backReading, hanViet, notes, examples`), chỉ khác `id/name/kind`. Mặt sau mặc định hiện `back, backReading, hanViet, notes, examples`. Cách này giữ đúng hành vi cũ, vì trước đây cột nào cũng nhập được vào loại thẻ nào.
- **`show` nhận thêm khóa giả `@kind` và `@deckName`** (thay cho cờ `showDeckName`), để giữ thứ tự hiển thị của template cũ.
- **Cột chưa nhận diện không bị bỏ**: nhập bảng tạo một loại thẻ riêng (`import-1`, …) kế thừa loại thẻ suy đoán, thêm mỗi cột lạ thành một trường kiểu `ruby` (`col4`, …) hiện ở mặt sau. Người dùng đổi trường, đổi loại thẻ hoặc chỉnh trường ngay trong màn xem trước.
- **Không migration dữ liệu hàng loạt.** `cards.note_type` và `cards.field_values` (cột `fields` được đặt tên `field_values` để tránh từ khóa SQL) cho phép null. Thẻ cũ không có `fields` thì client suy ra từ các cột cũ khi đọc, và thẻ chuyển sang định dạng mới khi được sửa. Vì vậy không có bước nào có thể làm mất furigana của dữ liệu thật.
- **`extraData` vẫn được ghi kèm** (`backReading`, `*FuriganaSegments`, `examples`, `hanViet`) như phần chiếu cho hàng đợi ôn và các đường đọc cũ; `fields` là nguồn sự thật. Việc dọn các khóa này thuộc một migration thu hẹp riêng, chưa làm.
- **API:** `CardRequest.front/back` không còn bắt buộc khi có `fields`; máy chủ suy ra mọi cột cũ từ `fields`. `CardResponse` và hàng đợi ôn (`QueueCard`) trả thêm `noteType` và `fields`. Máy chủ kiểm **nghiêm** (trường lạ, style sai bị từ chối 400) trong khi nhập tệp **lỏng** (cảnh báo, bỏ phần sai).
- **Hộp "Tùy chỉnh giao diện" áp dụng cho mọi loại thẻ có cùng danh sách khóa trường** với loại đang sửa, nên bộ thẻ cũ (bốn loại dựng sẵn) vẫn đổi cả bộ như trước.
- **Hợp đồng chung:** `tests/fixtures/deck-format/cases.json` (bản sao ở `japanese-server/src/test/resources/deck-format/`) được chạy bởi `tests/deckFormat.test.mjs` và `DeckFormatContractTest`.
- **Chưa làm:** tách nhỏ `ImportedDecks.tsx` (các phần mới đã nằm ở tệp riêng: `ImportGuide`, `ImportPreviewEditor`, `NoteTypeEditor`, `DeckExportDialog`, `CardFields`), `.apkg`, giao diện chỉnh style sâu, chia sẻ bằng mã.

## Giai đoạn 2: style nhiều tầng, màu, font

- **Năm tầng style hoạt động đầy đủ**, thấp thắng cao từng khóa: `deck.style → noteType.style → mặt (noteType.front|back.style) → trường (field.style) → thẻ (card.style)`. Mặt, loại thẻ và bộ thẻ được gộp trong `resolveTemplate`; tầng trường được giữ ở `fieldStyles`; tầng thẻ được gộp lúc vẽ bằng `mergeSideStyle`.
- **Thẻ lưu style riêng ở `extraData.style`** (không thêm cột). Máy chủ kiểm bằng đúng quy tắc style của template; `.sonhat.json` mang nó ở `cards[].style`; chia sẻ sao chép nó.
- **Màu tự chọn** `colors.bg/fg/accent` (`#rgb`, `#rrggbb`, `#rrggbbaa`). Nền áp lên phần tử thẻ; chữ và màu nhấn thay các màu theo vai trò (nghĩa, Hán Việt, cách đọc) của thẻ học để không còn tông lạc với nền mới.
- **Tương phản:** cặp chữ/nền dưới 4,5:1 chỉ là cảnh báo (`low_contrast` ở mọi tầng khi nhập tệp; thông báo ngay trong trình chỉnh style). Chỉ xét màu đã đặt rõ; chủ đề `blue` và `dark` có bảng màu cố định để so khi chỉ đặt một màu.
- **15 font bundle** (`src/lib/fontRegistry.ts`, id ổn định, ghi trong `font.family`): `default`, `notoSansJp`, `notoSerifJp`, `delaGothicOne` (cũ), `zenMaruGothic`, `mPlusRounded`, `zenKakuGothic`, `bizUdpGothic`, `shipporiMincho`, `kleeOne`, `beVietnamPro`, `newsreader`, `lexend`, `playfairDisplay`, `system`. Font tiếng Nhật có font Việt dự phòng và ngược lại. Font mới nạp theo nhu cầu (`fontLoader.ts`): mỗi font là một chunk CSS riêng, trình duyệt chỉ tải các mảnh unicode-range mà chữ trên thẻ cần; không có yêu cầu mạng ra ngoài. Id lạ (kể cả `custom:<uuid>` của Giai đoạn 3) rơi về `default`.
- **Style áp dụng ngay lúc nhập:** mục "Giao diện bộ thẻ" trong màn xem trước; thẻ mẫu bên dưới đổi tức thì, và style được lưu cùng bộ thẻ khi tạo.
- **Trình chỉnh** (`StyleEditor`, mọi ô có "Kế thừa"): bộ thẻ (màn nhập), loại thẻ, từng mặt và từng trường (trong trình soạn loại thẻ), từng thẻ (trong form sửa thẻ), và hộp "Tùy chỉnh giao diện" của bộ thẻ có sẵn (đủ font, thêm màu).
- **Bundle:** `dist` tăng khoảng 15 MB (25 → 40 MB) nhờ một plugin Vite bỏ bản `woff` trùng của Fontsource; người dùng chỉ tải các mảnh font mình dùng.

## Giai đoạn 3: font tải lên

**Quyết định về chia sẻ: font riêng không đi kèm.** Lý do: font có giấy phép riêng và phần lớn không cho phân phối lại; nếu đi kèm, một đường link chia sẻ sẽ biến máy chủ thành nơi phát tán font cho bất kỳ ai có link. Cách làm:

- Khi người khác lưu một bộ được chia sẻ (bộ đơn lẫn cả nhóm), máy chủ **xóa mọi `font.family` dạng `custom:<id>`** khỏi template và style của từng thẻ trong bản sao; màu, cỡ chữ và các font bundle được giữ nguyên. Bản của chủ bộ không đổi.
- Người nhận không đọc được tệp font của người khác (`GET /fonts/{id}/file` chỉ trả cho chủ, 404 với người khác). Id lạ rơi về font mặc định theo danh sách dự phòng trong CSS, không báo lỗi.
- Hộp chia sẻ, hộp xuất và hộp quản lý font đều nói rõ điều này. Tệp `.sonhat.json` giữ mã font (không có byte font): nhập lại bằng chính tài khoản đó vẫn dùng được, tài khoản khác thấy font mặc định.

**Tải lên và kiểm tra phía máy chủ** (`FontFileValidator`):

- Chỉ `.woff2` hoặc `.ttf`; định dạng quyết định bằng **nội dung nhị phân**, không tin tên tệp hay content-type, và phần mở rộng phải khớp nội dung.
- `.ttf`: bảng-mục hợp lệ (≤ 64 bảng, không lặp, không vượt ngoài tệp), có đủ `cmap, head, hhea, hmtx, maxp` và glyph (`glyf+loca` hoặc `CFF`), `head` đúng chữ ký. `.woff2`: phần đầu 48 byte hợp lệ, độ dài khai báo khớp tệp, kích thước giải nén ≤ 32 MB (chống bom giải nén). Máy chủ không giải nén Brotli; trình duyệt còn kiểm lại bằng bộ lọc font của nó.
- **Hạn mức mỗi tài khoản:** tối đa 5 MB mỗi tệp (413 nếu vượt, kiểm ở cả tầng multipart), 10 font, 25 MB tổng; vượt thì 409 kèm lời nhắc xóa bớt. Tải lại đúng tệp đã có (cùng SHA-256) trả về font cũ thay vì tạo bản trùng. Các lần tải của một tài khoản được tuần tự hóa nên không vượt hạn mức khi gửi song song.
- Lưu: bảng `user_fonts` (metadata) và `user_font_files` (byte) tách nhau, xóa theo tài khoản (`on delete cascade`).

**Dùng font:** id `custom:<uuid>` hợp lệ ở mọi tầng style. Trình duyệt tải byte bằng yêu cầu có đăng nhập, đăng ký bằng `FontFace` (tên họ `sonhat-<uuid>`), nên font không có URL công khai. Phản hồi font luôn `no-store` và `nosniff` (cache theo URL sẽ sống lâu hơn việc xóa font và lẫn giữa các tài khoản trên một máy dùng chung). Xóa font thì bộ thẻ đang dùng hiện font dự phòng. Quản lý font (tải lên, xem thử, xóa, hạn mức) nằm trong hộp "Font của bạn", mở từ ô Font chữ của mọi trình chỉnh style.

## Giai đoạn 4: mã ngắn, QR, thư viện công khai, báo cáo và gỡ bộ

**Mã ngắn và QR**
- Mỗi liên kết chia sẻ (bộ thẻ và nhóm) có thêm **mã 8 ký tự** dạng `K7QM-3XPD`, bảng ký tự bỏ các chữ dễ nhầm (không có 0 O 1 I L), khoảng 40 bit. Người nhận chọn "Nhập mã chia sẻ" (không phân biệt hoa thường, bỏ qua dấu cách và gạch ngang) hoặc quét QR; QR chứa địa chỉ ngắn `/s/K7QM3XPD`, trang này tra mã rồi mở trang chia sẻ. QR vẽ ngay trên máy (`qrcode-generator`), có nút tải PNG.
- 40 bit đủ để bị dò từng mã, nên **tra mã bị giới hạn 20 lần/phút/máy khách** (`RateLimiter`, trong bộ nhớ, theo `remoteAddr`; chỉ tin `X-Forwarded-For` khi bật `app.rate-limit.trust-forwarded` sau một proxy tin cậy). Duyệt thư viện giới hạn 120 lần/phút. Với nhiều bản máy chủ, hạn mức nhân lên theo số bản.
- **Hạn dùng:** 1, 7 hoặc 30 ngày hoặc không hết hạn; áp dụng cho cả liên kết lẫn mã, kiểm ở xem trước, lưu và tra mã. Hết hạn thì chủ bộ bấm "Gia hạn" để dùng lại đúng liên kết và mã cũ. Bộ đang công khai không hết hạn.
- Tắt chia sẻ xóa liên kết, mã, hạn dùng và gỡ bộ khỏi thư viện. Liên kết tạo trước giai đoạn này được cấp mã khi chủ bộ mở hộp chia sẻ. Mã được tạo kiểm trùng ở cả bảng bộ thẻ lẫn nhóm.

**Thư viện công khai** (chỉ bộ thẻ, không có nhóm)
- "Đăng lên thư viện" = bật liên kết **và** cho hiện trong tìm kiếm; người nhận lưu bằng đúng đường sao chép của liên kết. Điều kiện: bộ tự import, có ít nhất một thẻ, cấp độ N5–N1 hoặc để trống, mô tả ≤ 500 ký tự. **Chống spam:** chỉ tài khoản đăng nhập; tối đa 5 bộ mới/ngày và 50 bộ công khai mỗi tài khoản. Đổi `visibility` qua PATCH bộ thẻ bị từ chối, nên mọi bộ công khai đều đi qua các quy tắc này.
- Trang `/explore` (không cần đăng nhập): tìm theo tên, mô tả hoặc tên người chia sẻ (ký tự `%` và `_` không phải ký tự đại diện), lọc N5–N1, sắp xếp mới nhất hoặc nhiều lượt lưu, phân trang 24. Chỉ hiện tên bộ, mô tả, tên hiển thị, cấp độ, số thẻ, lượt lưu; không bao giờ email hay id nội bộ. **Lượt lưu** đếm mỗi tài khoản một lần, không tính chủ bộ, bằng cập nhật nguyên tử nên không xung đột với việc chủ sửa bộ.

**Báo cáo và gỡ bộ**
- Nút "Báo cáo bộ thẻ này" trên trang chia sẻ (khách được nhắc đăng nhập). Lý do: bản quyền, không phù hợp, spam, khác (bắt buộc mô tả). Mỗi người một báo cáo cho mỗi bộ, tối đa 10 báo cáo/ngày, không báo cáo bộ của mình; chủ bộ không biết ai báo cáo.
- **Ba báo cáo đang chờ tự ẩn bộ khỏi thư viện** (`UNDER_REVIEW`) cho tới khi quản trị viên xử lý; liên kết riêng vẫn chạy. Bỏ qua đủ báo cáo thì bộ tự hiện lại.
- **Quản trị viên** (`app_users.role = 'ADMIN'`, đặt bằng SQL: `update app_users set role='ADMIN' where email='…'`; token cũ cần đăng nhập lại) dùng `/admin/reports`: xem, bỏ qua, **gỡ bộ kèm lý do bắt buộc** hoặc khôi phục. Máy chủ kiểm vai trò ở lớp bảo mật lẫn trong dịch vụ. Gỡ bộ (`REMOVED`) làm liên kết và mã ngừng hoạt động, bộ rời thư viện, chủ bộ thấy lý do trong hộp chia sẻ và không đăng lại được; **bản người khác đã lưu thuộc về họ nên không bị xóa**.
- Lưu ý pháp lý: hệ thống chỉ có cơ chế báo cáo và gỡ, chưa có quy trình DMCA đầy đủ (xác minh bên khiếu nại, phản đối, thông báo cho người đăng). Trước khi mở thư viện cho công chúng cần điều khoản sử dụng và địa chỉ nhận khiếu nại.

## 1. Mục tiêu và ngoài phạm vi

Một định dạng duy nhất mô tả bộ thẻ, dùng cho nhập, xuất, sao lưu, chia sẻ và prompt AI.

- Mọi tệp khác (CSV, TSV, TXT, XLSX, Markdown dán, JSON cũ) chỉ là **bộ chuyển đổi** vào định dạng này.
- Người dùng tự định nghĩa **loại thẻ** (danh sách trường và bố cục hai mặt), như Anki.
- Style có nhiều tầng. Schema mô tả đủ các tầng ngay từ v1 để tệp không phải đổi định dạng ở giai đoạn sau.
- Nhập rồi xuất lại không mất nội dung hay style (round-trip).

Ngoài phạm vi của spec này: lịch học SRS, ghi chú cá nhân, tiến độ (không bao giờ nằm trong tệp bộ thẻ); `.apkg`; Google Sheets; cập nhật tự động cho bản đã chia sẻ.

## 2. Hiện trạng và vấn đề (căn cứ cho thiết kế)

| Vấn đề | Chỗ hiện tại |
| --- | --- |
| Ba nguồn mô tả thẻ lệch nhau | bảng alias `keys` trong `ankiImport.ts`; prompt trong `ImportGuide.tsx` (`note`, `type` viết hoa); `CardRequest` ở backend chỉ có `front/back/reading/notes/kind` |
| `extraData` bị nhồi | `backReading`, `hanViet`, `examples`, `frontFuriganaSegments`, `backFuriganaSegments`, `importFieldLayout`, `importFieldValues` (JSON lồng JSON, trùng giá trị) |
| Cố định bốn loại thẻ | `ImportedKind`, `CardKind` |
| Style cứng | `DeckTemplateConfig` v4: 4 theme, 5 font, một style cho mỗi mặt |
| Server kiểm style sơ sài | `validateTemplateConfig` chỉ kiểm `style.theme/fontScale/alignment` và `study.orientation`; nội dung `front`/`back` không kiểm |
| Không xuất ngược | không có exporter |
| Prompt chép tay danh sách CSS | `ImportGuide.tsx` và `cardFormatting.ts` |

## 3. Cấu trúc tệp `.sonhat.json`

Mã hóa UTF-8. Phần mở rộng khuyến nghị: `.sonhat.json`.

```json
{
  "format": "sonhat.deck",
  "version": 1,
  "deck": {
    "name": "Minna no Nihongo bài 1",
    "description": "",
    "tags": ["N5"],
    "style": { "theme": "paper", "font": { "family": "notoSansJp", "size": 30 } },
    "noteTypes": [
      {
        "id": "vocab",
        "name": "Từ vựng",
        "kind": "VOCABULARY",
        "fields": [
          { "key": "front",        "label": "Từ",            "type": "ruby",  "required": true },
          { "key": "frontReading", "label": "Cách đọc",      "type": "kana",  "for": "front" },
          { "key": "back",         "label": "Nghĩa",         "type": "text",  "required": true },
          { "key": "hanViet",      "label": "Hán Việt",      "type": "text" },
          { "key": "notes",        "label": "Ghi chú",       "type": "text" },
          { "key": "examples",     "label": "Ví dụ",         "type": "examples" }
        ],
        "front": { "show": ["front", "frontReading"], "showDeckName": true },
        "back":  { "show": ["back", "hanViet", "notes", "examples"], "showFront": false }
      }
    ]
  },
  "cards": [
    {
      "uid": "c-0001",
      "type": "vocab",
      "fields": {
        "front": "勉強[べんきょう]する",
        "back": "học, học tập",
        "hanViet": "",
        "notes": "Ôn bài 1",
        "examples": [
          { "japanese": "毎日日本語を勉強します。", "reading": "", "meaning": "Mỗi ngày tôi học tiếng Nhật." }
        ]
      },
      "tags": ["N3", "bài 1"]
    }
  ]
}
```

### 3.1 Trường gốc (envelope)

| Khóa | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `format` | Có | Luôn là `"sonhat.deck"` |
| `version` | Có | Số nguyên. Đọc được mọi version ≤ phiên bản app hỗ trợ; lớn hơn thì từ chối kèm thông báo "cần cập nhật ứng dụng" |
| `deck` | Có | Xem 3.2 |
| `cards` | Có | Mảng thẻ, có thể rỗng (bộ trống) |
| Khóa bắt đầu bằng `x-` | Không | Bỏ qua khi đọc, nhưng giữ nguyên khi xuất lại tệp đã nhập |
| Khóa lạ khác | Không | Bỏ qua, ghi cảnh báo `unknown_key` |

### 3.2 `deck`

| Khóa | Kiểu | Giới hạn |
| --- | --- | --- |
| `name` | chuỗi | bắt buộc, 1–200 ký tự sau khi trim |
| `description` | chuỗi | ≤ 5.000 |
| `tags` | mảng chuỗi | ≤ 100 nhãn, mỗi nhãn ≤ 100 ký tự |
| `style` | đối tượng | Xem mục 5 |
| `noteTypes` | mảng | 1–16 loại thẻ. Nếu thiếu: dùng bốn loại thẻ dựng sẵn (mục 4.3), chỉ giữ loại nào được thẻ dùng |

### 3.3 Thẻ

| Khóa | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `type` | Có | `id` của một loại thẻ trong `deck.noteTypes` |
| `fields` | Có | Đối tượng `key → giá trị`. Chuỗi, trừ trường `examples` là mảng |
| `uid` | Không | Mã ổn định do tác giả đặt (≤ 64 ký tự). Dùng để khớp thẻ khi nhập lại. Bỏ trống thì app tự sinh khi xuất |
| `tags` | Không | Giống `deck.tags` |
| `style` | Không | Ghi đè style cho riêng thẻ (mục 5) |

Thẻ thiếu trường `required` bị loại và liệt kê trong báo cáo lỗi (giữ hành vi "bỏ qua dòng lỗi" hiện nay). Trường không thuộc loại thẻ bị bỏ kèm cảnh báo `unknown_field`.

## 4. Loại thẻ (note type)

### 4.1 Định nghĩa

| Khóa | Ghi chú |
| --- | --- |
| `id` | `[a-z][a-z0-9-]{0,31}`, duy nhất trong bộ |
| `name` | 1–60 ký tự |
| `kind` | `VOCABULARY \| KANJI \| GRAMMAR \| GENERAL`. Dùng để lọc, thống kê và chọn cách hiển thị đặc biệt (ngữ pháp mặt sau). Mặc định `GENERAL` |
| `fields` | 2–24 trường, mỗi trường: `key`, `label`, `type`, `required?`, `for?`, `style?` |
| `front` / `back` | `show`: danh sách `key` trường hiện ở mặt đó, theo thứ tự; `showDeckName?` (mặt trước); `showFront?` (mặt sau); `style?` |
| `style` | Style của cả loại thẻ |

Quy tắc: `key` khớp `[a-z][A-Za-z0-9]{0,31}` và duy nhất; phải có đúng một trường `front` và một trường `back` (hai trường bắt buộc mang nghĩa mặt trước/mặt sau, giữ tên này để backend, tìm kiếm và xem trước chia sẻ dùng được ngay). Mỗi mặt hiện ≥ 1 trường.

### 4.2 Kiểu trường

| `type` | Nội dung | Ghi chú |
| --- | --- | --- |
| `text` | văn bản nhiều dòng | Cho phép tập thẻ HTML/CSS đã whitelist (mục 5.4). Tối đa 20.000 ký tự |
| `ruby` | như `text`, cộng cú pháp furigana `漢字[かんじ]` | Dùng cho trường có chữ Hán. Tối đa 20.000 |
| `kana` | cách đọc thuần kana | Không HTML. Thuộc tính `for` trỏ tới một trường `ruby` ở cùng loại thẻ để dùng làm cách đọc dự phòng cho trường đó. Tối đa 10.000 |
| `examples` | mảng `{japanese, reading?, meaning}` | ≤ 100 ví dụ. Giữ đúng ràng buộc hiện nay của `parseCardExamples` |

Furigana: nguồn sự thật là **chuỗi đánh dấu** `漢字[かんじ]` nằm trong trường. Không lưu riêng `frontFuriganaSegments`/`backFuriganaSegments` nữa; bộ hiển thị phân tích lại từ chuỗi (đã có `resolveFurigana`). Trường `kana` với `for` chỉ là phương án dự phòng khi chuỗi không có đánh dấu.

### 4.3 Bốn loại thẻ dựng sẵn

Tương ứng bốn loại hiện tại. Dùng khi tệp không khai báo `noteTypes` và làm mẫu khi người dùng tạo loại thẻ mới.

| id | kind | Trường (`key`: kiểu) | Mặt trước | Mặt sau |
| --- | --- | --- | --- | --- |
| `vocab` | VOCABULARY | `front`: ruby*, `frontReading`: kana, `back`: ruby*, `backReading`: kana, `hanViet`: text, `notes`: text, `examples` | front, frontReading | back, backReading, hanViet, notes, examples |
| `kanji` | KANJI | như `vocab` | như `vocab` | như `vocab` |
| `grammar` | GRAMMAR | như `vocab` | như `vocab` | như `vocab` |
| `general` | GENERAL | như `vocab` | như `vocab` | như `vocab` |

(* = bắt buộc.) Người dùng nhân bản một loại dựng sẵn rồi thêm/bớt/đổi tên trường.

## 5. Style

Schema đầy đủ có từ v1. Giai đoạn 1 chỉ **đọc, ghi và giữ nguyên** các khóa dưới đây; giao diện chỉnh sâu và vẽ theo từng tầng là Giai đoạn 2.

### 5.1 Đối tượng style (mọi tầng dùng chung, mọi khóa tùy chọn)

```json
{
  "theme": "paper",
  "colors": { "bg": "#fffaf0", "fg": "#1f2937", "accent": "#b45309" },
  "font":   { "family": "notoSerifJp", "size": 30, "bold": false, "italic": false },
  "align": "center",
  "autoFit": true
}
```

| Khóa | Giá trị |
| --- | --- |
| `theme` | `paper \| blue \| dark \| system`. Chọn bảng màu dựng sẵn |
| `colors` | `bg`, `fg`, `accent`: `#rgb`, `#rrggbb` hoặc `#rrggbbaa`. Ghi đè theme. Không nhận tên màu, `rgb()`, `var()` |
| `font.family` | id font: `default \| notoSansJp \| notoSerifJp \| delaGothicOne \| system` hiện có, cộng các id mới khi bundle thêm (GĐ2). `custom:<uuid>` dành cho font người dùng tải lên (GĐ3). Id không nhận ra thì rơi về `default`, không lỗi |
| `font.size` | số nguyên 12–72 (px) |
| `font.bold`, `font.italic`, `autoFit` | boolean |
| `align` | `left \| center` |

### 5.2 Chồng tầng

Thấp thắng cao, từng khóa riêng lẻ:

```
mặc định app → deck.style → noteType.style → noteType.front|back.style → field.style → card.style
```

`field.style` chỉ nhận `colors`, `font`, `align`. `card.style` áp lên cả thẻ (cả hai mặt).

### 5.3 Độ tương phản

Cặp `bg`/`fg` hiệu lực dưới 4,5:1 là **cảnh báo** `low_contrast` trong preview, không phải lỗi. Người dùng vẫn lưu được.

### 5.4 HTML nội tuyến trong trường

Không đổi so với hiện nay: bộ hiển thị chuyển HTML thành phần tử React theo whitelist trong `cardFormatting.ts`, không bao giờ đưa HTML vào DOM. Whitelist (thẻ và thuộc tính CSS) được tách thành **một bảng dữ liệu** để cả bộ lọc lẫn prompt đọc chung (mục 8).

### 5.5 Quan hệ với `DeckTemplateConfig` v4

`decks.template_config` nâng lên **version 5** và chứa đúng `deck.style` + `deck.noteTypes`:

```json
{ "version": 5, "style": { }, "noteTypes": [ ] }
```

Bản v4 đọc bằng bộ chuyển: `front.fields`/`back.fields` thành `show` của bốn loại dựng sẵn (ánh xạ `reading`→`frontReading`, `hanViet`, `notes`, `kind`/`deckName` bỏ khỏi `fields` và thành cờ `showDeckName` hoặc bỏ), `front.style`/`back.style` thành `noteType.front.style`/`back.style`. Không cần cột mới cho loại thẻ.

## 6. Bộ chuyển đổi nhập

Mọi đường nhập đều đi: `đọc tệp → bảng/bản ghi trung gian → gán sang trường của loại thẻ → validate → preview → lưu`.

### 6.1 JSON

1. Có `format: "sonhat.deck"` → đọc trực tiếp, validate theo mục 7.
2. Không có (mảng thẻ hoặc đối tượng chứa `cards/data/items/vocabulary/kanji/grammar`) → **bộ chuyển JSON cũ**: dùng bảng alias hiện hành (`front/back/reading/back_reading/han_viet/note(s)/type(kind)/tags/examples`) để tạo thẻ loại `vocab`/`kanji`/`grammar`/`general` theo `type`. Bảng alias là dữ liệu duy nhất (`legacyAliases`), không lặp ở nơi khác.

### 6.2 CSV, TSV, TXT, XLSX, XLS

- Giữ quy tắc hiện có: `#separator:` kiểu Anki, ngoặc kép CSV, 20 MB, 20.000 thẻ, mỗi sheet Excel là một bảng.
- Bước **gán cột**: mỗi cột chọn một trường của loại thẻ đích hoặc "Không nhập". Tự nhận diện theo tên cột (alias) với nhãn "Đã nhận diện". Một cột có thể tạo **trường mới** trong loại thẻ tùy chỉnh.
- Mỗi bảng/sheet chọn riêng loại thẻ đích; mặc định theo suy đoán từ tên cột (như `inferredKind` hiện nay).
- Thay thế khái niệm "cột vào mặt trước/mặt sau + `importFieldLayout`" bằng "cột vào trường" + `front.show`/`back.show` của loại thẻ. Thứ tự các trường trên một mặt chỉnh ở bố cục loại thẻ, không chỉnh theo từng lần nhập.

### 6.3 Markdown / văn bản dán

Dán hoặc gõ vào ô văn bản, không cần tệp. Hai dạng, tự nhận diện:

**Dạng dòng** (mỗi dòng có ` :: `): `front :: back [:: reading]`

```
勉強[べんきょう]する :: học, học tập :: べんきょうする
先生[せんせい] :: giáo viên
```

**Dạng khối** (các dòng `khóa: giá trị` ngăn bằng dòng trống hoặc `---`; `khóa` là `key` hoặc nhãn trường):

```
type: vocab
front: きっかけ
back: cơ duyên
tags: N3, bài 1
example: 日本語を勉強し始めたきっかけは映画です。 | | Cơ duyên khiến tôi học tiếng Nhật là phim.
```

Dòng đầu `# Tên bộ` đặt `deck.name`. Dòng lệnh `type: <id>` đặt loại thẻ cho khối đó và các khối sau.
`example:` nhận `japanese | reading | meaning`, lặp được nhiều dòng.

### 6.4 Chính sách trùng

Khóa trùng = cặp (`front`, `back`) đã chuẩn hóa khoảng trắng (giữ hành vi hiện nay). Nếu thẻ có `uid`, `uid` trùng cũng tính là trùng. Thẻ trùng bị bỏ kèm lý do.

## 7. Kiểm tra và báo lỗi

Một hàm `validateDeckFile` trả danh sách vấn đề:

```json
{ "severity": "error", "path": "cards[12].fields.back", "code": "required", "message": "Thiếu nội dung mặt sau" }
```

Mã: `required`, `too_long`, `bad_type`, `bad_value`, `unknown_type`, `unknown_field`, `unknown_key`, `duplicate`, `limit_exceeded`, `low_contrast` (cảnh báo), `bad_version`, `bad_markup`.

- Lỗi cấp thẻ → bỏ thẻ đó, giữ phần còn lại. Lỗi cấp `deck`/`noteTypes`/`version` → từ chối cả tệp.
- Giao diện gộp theo `code` + tên sheet, cho xem chi tiết và đường dẫn dòng/thẻ (như `importSummary` hiện nay).
- **Hợp đồng chung:** một tệp `deck-format-v1.schema.json` (JSON Schema) mô tả cấu trúc, cùng thư mục `fixtures/deck-format/` gồm tệp hợp lệ và không hợp lệ kèm danh sách mã lỗi mong đợi. Frontend (`validateDeckFile`) và backend (`DeckFormatValidator`) cùng chạy bộ fixture này trong test. Không thêm thư viện JSON Schema; schema là tài liệu và dữ liệu cho test, hai bộ kiểm viết tay bám theo.
- Backend **luôn kiểm lại** toàn bộ, kể cả cây style và `noteTypes`, không tin client.

### Giới hạn

| Mục | Giới hạn |
| --- | --- |
| Kích thước tệp / request | 20 MB |
| Thẻ mỗi bộ | 20.000 |
| Loại thẻ mỗi bộ | 16 |
| Trường mỗi loại thẻ | 24 |
| `text`/`ruby` | 20.000 ký tự; `kana` 10.000 |
| Ví dụ mỗi thẻ | 100 |
| Nhãn | 100 nhãn × 100 ký tự |
| Tổng dung lượng `fields` của một thẻ | 100.000 ký tự |

## 8. Prompt hướng dẫn tạo tệp

Không còn prompt chép tay. `buildStructurePrompt(noteType)` sinh từ chính định nghĩa loại thẻ:

- liệt kê từng trường: `key`, nhãn, kiểu, bắt buộc hay không, giới hạn;
- kèm ví dụ JSON được sinh từ schema (không viết tay);
- chọn loại thẻ trong giao diện thì prompt đổi theo (từ vựng, kanji, ngữ pháp, tổng hợp, hoặc loại tự tạo);
- `buildFormattingPrompt()` đọc bảng whitelist CSS ở mục 5.4, nên đổi whitelist thì prompt tự đổi.

Cạnh prompt có ô **"Dán JSON để kiểm tra"**: chạy `validateDeckFile` và hiện lỗi/cảnh báo theo đường dẫn, không cần lưu bộ thẻ. Có nút tải tệp mẫu `.sonhat.json`, CSV và Markdown cho loại thẻ đang chọn.

## 9. Xuất

Xuất được mọi bộ thẻ có thẻ do người dùng sở hữu, cả bộ tạo thủ công. Không bao giờ xuất: tiến độ/lịch ôn, ghi chú cá nhân, id máy chủ, tên người sở hữu.

| Định dạng | Nội dung |
| --- | --- |
| `.sonhat.json` | Đầy đủ: deck, loại thẻ, style, thẻ, `uid` (sinh nếu chưa có) |
| `.csv` | Một loại thẻ mỗi tệp: cột theo `key` trường, `tags` ngăn bằng `;`, `examples` là chuỗi JSON |
| `.xlsx` | Mỗi loại thẻ một sheet; cùng quy tắc cột như CSV |

CSV/XLSX mất style và bố cục loại thẻ; giao diện nói rõ điều này trước khi xuất. Quy tắc round-trip chỉ bảo đảm cho `.sonhat.json`.

## 10. Lưu trữ phía máy chủ

Thay đổi theo kiểu **mở rộng trước, thu hẹp sau** để không phá dữ liệu đang có:

- Thêm `cards.note_type varchar(32)` và `cards.fields json` (migration mới, tiếp sau `V16`). Cho phép null trong lúc chuyển.
- `cards.front/back/reading/notes/kind` **giữ nguyên làm cột chiếu** (projection): máy chủ tự ghi từ `fields` mỗi lần tạo/sửa thẻ. Tìm kiếm, xem trước chia sẻ, SRS, từ điển tiếp tục dùng các cột này, nên không phải viết lại. `front` ← trường `front`, `back` ← trường `back`, `reading` ← `frontReading`, `notes` ← `notes`, `kind` ← `noteType.kind`.
- `decks.template_config` thành version 5 (mục 5.5). Không thêm cột.
- `extraData` giữ lại cho dữ liệu ngoài schema (ví dụ `dictionaryRef`, `kanjiVocabulary` của bộ dựng sẵn). Các khóa import cũ (`backReading`, `hanViet`, `examples`, `*FuriganaSegments`, `importFieldLayout`, `importFieldValues`) chuyển vào `fields` bằng migration dữ liệu.
- **Chưa xóa gì** ở Giai đoạn 1. Đường đọc ưu tiên `fields`, thiếu thì rơi về `extraData` cũ. Chỉ khi Giai đoạn 1 đã chạy ổn mới có migration thu hẹp riêng (xóa khóa cũ), do bạn duyệt.
- API: `POST /decks/import` nhận thêm `noteTypes` (trong `templateConfig`) và `cards[].noteType/fields`; vẫn nhận dạng cũ trong một thời gian để client cũ chưa cập nhật không hỏng. `GET` thẻ trả cả `fields` và các cột cũ.

### 10.1 Chia sẻ

`SharedDeckContent.copy` sao chép `fields`, `note_type` và `template_config` v5 cùng nội dung hiện nay. Xem trước công khai tiếp tục dùng cột chiếu. Không đổi gì ở cơ chế token trong Giai đoạn 1.

### 10.2 Thẻ từ điển

Thẻ có `dictionary_identity` thuộc loại `vocab`. Migration gán `note_type = 'vocab'` và giữ nguyên `dictionaryRef`.

## 11. Giai đoạn 1: phạm vi bàn giao

Làm:

1. `deckFormat.ts`: kiểu, `validateDeckFile`, bộ chuyển v4→v5 của template, bốn loại dựng sẵn.
2. Bộ chuyển nhập: JSON cũ, JSON v1, CSV/TSV/TXT, XLSX, Markdown dán; màn gán cột→trường theo mục 6.2.
3. Exporter `.sonhat.json`, CSV, XLSX.
4. `buildStructurePrompt`, `buildFormattingPrompt`, ô kiểm tra JSON, tệp mẫu.
5. Trình soạn **loại thẻ** (thêm/xóa/đổi tên trường, chọn trường hiện ở mỗi mặt). Nhân bản từ loại dựng sẵn.
6. Backend: migration cột mới, `DeckFormatValidator`, ghi cột chiếu, migration dữ liệu từ `extraData`, cập nhật `validateTemplateConfig` cho v5.
7. Hiển thị: `CardFace`/`CardFields` đọc theo `fields` và `show`. Bộ hiển thị cũ vẫn chạy cho thẻ chưa có `fields`.
8. Tách `ImportedDecks.tsx` (1185 dòng) thành các màn nhỏ.
9. Cập nhật `anki-import.md` và `deck-sharing.md` trỏ về spec này.

Không làm: giao diện chỉnh style sâu, màu tự chọn, font mới, font tải lên, mã ngắn/QR, thư viện công khai.

### Kiểm thử

- Hợp đồng: bộ fixture dùng chung chạy ở cả `node --test` và JUnit.
- Round-trip: `export → import` giữ nguyên nội dung, loại thẻ, style (so sánh sâu).
- Tương thích: các tệp JSON/CSV/XLSX mẫu hiện có (`public/data/import-formatting-sample.json`, `tests/ankiImport.test.mjs`) vẫn cho ra cùng số thẻ và nội dung hiển thị.
- Migration: chạy trên bản sao dữ liệu có thẻ cũ đủ các khóa `extraData`; chạy hai lần cho cùng kết quả (idempotent); bộ chia sẻ cũ vẫn mở và lưu được.
- Giữ nguyên các kiểm thử hiện có: `npm test`, `test:sharing`, `test:deck-groups`, `mvnw test`.

### Hoàn tác

Vì chưa xóa cột/khóa cũ, quay lại bản trước chỉ cần triển khai lại bản cũ: các cột chiếu vẫn đúng và `extraData` còn nguyên.

## 12. Điểm cần bạn quyết khi duyệt

1. **Furigana:** lưu chuỗi đánh dấu `漢字[かんじ]` làm nguồn duy nhất (spec chọn cách này, bỏ `*FuriganaSegments`). Hay vẫn lưu thêm đoạn có cấu trúc để hiển thị nhanh?
2. **Cột chiếu:** giữ `front/back/reading/notes/kind` làm cột suy ra từ `fields` (spec chọn cách này, rủi ro thấp). Hay chuyển hết sang `fields` và viết lại tìm kiếm/chia sẻ?
3. **Loại thẻ nằm trong `template_config` v5** (không thêm bảng). Phù hợp khi mỗi bộ có tối đa 16 loại; nếu sau này muốn dùng chung loại thẻ giữa nhiều bộ thì phải tách bảng.
4. **Tên trường bắt buộc `front`/`back`:** đơn giản và tương thích, nhưng người dùng không thể đặt khóa tùy ý cho hai trường này (nhãn hiển thị vẫn tự đặt).
5. **Thẻ trùng:** hiện bỏ cả thẻ trùng. Muốn thêm chế độ "cập nhật thẻ cũ theo `uid`" khi nhập lại tệp đã xuất không? Spec hiện chưa làm (cần quyết cách giữ lịch SRS).
6. **Xuất bộ do người khác chia sẻ:** cho xuất bản đã lưu của mình (spec cho phép, vì đã là thẻ của người nhận). Cần chặn khi sau này có thư viện công khai và tác giả không cho tải?
