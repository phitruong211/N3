# Đối chiếu SRS 1.1 — 27/09/2026

Nguồn: `/Users/vophitruong/Downloads/SRS.md`. Đã đối chiếu mục hiện trạng 1–16 với mục tiêu 17–22. Các giới hạn “chỉ local” của FR-BOOK-03, FR-SRS-10, FR-PROGRESS-04 và cách đưa sheet vào note tại FR-DECK-04 đã được thay bằng yêu cầu mục tiêu P3/FR-CARD-08. Không thêm các tính năng ngoài phạm vi tại mục 2.2 như thanh toán, admin hay quên mật khẩu.

## Kết quả thực thi

| Kiểm tra | Kết quả / phạm vi |
|---|---|
| `npm test` | 35/35 đạt: parser, namespace Guest/A/B, reset hàng đợi, tránh echo snapshot server, auth refresh/cancel/stale session và hàng đợi SRS |
| `npm run build` | TypeScript + Vite production build đạt, parser chạy trong worker riêng |
| `npm run lint` | Không có lỗi; còn cảnh báo Fast Refresh/regex cũ và các script skill. Một cảnh báo ref-counter trong cleanup là bộ đếm hủy response cũ, không phải DOM ref |
| `npm run test:guest` | Chromium desktop/mobile, API fixture: Guest không gọi API tài khoản, bookmark/reload/search, SRS 10 thẻ, phiên thẻ chung, cài đặt local, preview/hủy/login lỗi/đăng ký/khôi phục draft, lỗi lưu thử lại, A–B và đăng xuất liên tab |
| `npm run test:integration` | Chromium với API + MySQL thật: Guest consent/cleanup, import/dedupe, paging, sửa giữ lịch ôn, học Anki cá nhân bằng UI, settings + bookmark sync, trình duyệt thứ hai, revision conflict giữ backup, offline retry, mobile rules |
| `npm run test:scale` | MySQL thật: 20.000 thẻ + 22 deck. Metadata trang đầu 463 byte, trang card 399 trả 50/20.000; retry cùng khóa cùng deck; tài khoản khác bị từ chối; 20.001 thẻ trả 400; >20 MB trả 413; CORS PUT đạt. Toàn kịch bản khoảng 10,4 giây trên máy local |
| `bash mvnw test` | 14/14 đạt trên Java 21.0.12.1 + MySQL 8.4.11, migrations V1–V4: auth, scheduler, owner/paging, import rollback/idempotency, giữ progress, chặn review bộ đã xóa, queue giới hạn tại DB, learning revision/Guest merge |
| `git diff --check` | Cả hai repository không có lỗi whitespace |

DB thử riêng tại `127.0.0.1:3307/n3_srs_test`; dữ liệu tổng hợp, không dùng dữ liệu tài khoản production. API local kiểm thử chạy cổng 8080; Vite cổng 5173. Script integration/scale tạo tài khoản và deck tổng hợp mới mỗi lần. Không chạy các script này trên DB production.

## Ma trận chức năng

| Mã SRS | Triển khai / bằng chứng |
|---|---|
| FR-AUTH-01…11, NFR-SEC-01…03 | Auth hiện có; refresh single-flight, fencing phiên, hủy đăng nhập, access/refresh namespace riêng. Auth unit + Spring integration + Guest browser |
| FR-NAV-01…05, FR-DASH-01…03 | Giữ router/lazy pages, search và mobile menu; Dashboard thêm mục tiêu/ngày. Guest browser duyệt các màn hình; build kiểm tra imports |
| FR-LIB-01…08, FR-SEARCH-01…03, FR-BOOK-01…02 | Giữ thư viện/search/chi tiết theo stable ID; bookmark typed theo loại+ID. Browser kiểm tra tìm kiếm/bookmark; saved deck ánh xạ cả từ vựng/Kanji/ngữ pháp |
| FR-FLASH-01…06 | `UnifiedDeckPage` + `StudySession`: bảy bộ tích hợp, bộ ảo, nguồn cá nhân; lật/hướng/thứ tự/range/fullscreen/jump. Anki đến hạn cũ trước rồi thẻ mới, rating sau lật. Browser phiên chung và Anki cá nhân; queue unit |
| FR-SRS-01…09, FR-ANKI-01…05 | Giữ hai scheduler hiện có; ghi activity từng review và thời gian foreground; không mất hoạt động đã hoàn thành khi dừng sớm. Java scheduler + browser SRS; giới hạn Anki 200 và timer hiện có |
| FR-DECK-01…03,05…12 | REST/MySQL; CRUD nội dung riêng progress, reorder/move và quyền sở hữu, soft delete/config, metadata/card pages. BE integration + real browser + 20k test |
| FR-QUIZ-01…03 | Giữ quiz từ/nghĩa/cách đọc và Kanji/Hán Việt, kết quả/làm lại; kiểm tra mã và browser mở trang |
| FR-LISTEN-01…08 | Giữ podcast/JLPT và local namespace; sửa tải catalogue đóng gói trước, rồi thử bản remote. Guest browser mở trang; audio bên thứ ba không được coi là đã kiểm chứng toàn bộ |
| FR-PROGRESS-01…04 | Số thẻ, thẻ mới, accuracy, foreground, streak/heatmap; tài khoản đồng bộ API thay local-only. Bỏ hằng số 5 phút/thẻ; tiến độ đọc lại khi nhận snapshot. Browser SRS + learning sync |
| FR-SET-01…06 | Settings giữ cục bộ ngay, queue PATCH tuần tự, trạng thái/retry; dailyGoal/autoPlay có UI và sử dụng; reset chỉ thiết bị và dọn queue. Unit reset + browser setting/server restore |
| FR-GUEST-01…06 | Guest thực, không token giả; chỉ chặn lúc lưu/CRUD; draft giữ trong lúc login, dữ liệu theo scope. Guest/auth tests |
| FR-GUEST-07…09 | P3 đã triển khai: consent liệt kê dữ liệu, giữ server SRS khi trùng, receipt idempotent, chỉ dọn nguồn sau ACK. Hỗ trợ nguồn legacy với xác nhận ownership. Spring merge tests + browser Guest transfer |
| FR-CARD-01…03 | CardView adapters cho nguồn tích hợp/cá nhân và Summary metadata; progress riêng nội dung; chỉ tải card page khi mở/học. TypeScript build + paging/scale |
| FR-CARD-04…06 | Nhóm nguồn/read-only, bộ trống có hướng dẫn và không start, saved ảo không CRUD; nội dung sửa không reset progress; delete/move xác nhận. UI code + API ownership/progress tests |
| FR-CARD-07…08 | Search front/back/reading/note, lọc kind/state, sort deck, reorder; lỗi/retry. Metadata file/sheet tách note. Parser + BE tests, real UI import giữ note |
| FR-DECK-UX-01…04 | Hai nút + `!` mặc định đóng, native button ARIA/keyboard; samples, rules; manual >=1 cặp hoặc chọn rõ deck rỗng. Guest browser và mobile screenshot |
| FR-IMPORT-01…05 | Worker parse, chọn sheet/header/mapping, duyệt extra columns; 10 mẫu, lý do theo dòng, NFC/whitespace pair dedupe. 12 parser tests + browser import |
| FR-IMPORT-06…09 | Client/server limits, cancel parser, giữ preview khi lỗi, timeout có thông báo; transaction/idempotency; result theo lý do; React escape nội dung. Parser + Guest retry + BE rollback + real scale |
| Mục 21 / API mục tiêu | Metadata/card paging, filters, import Idempotency-Key, GET/PUT learning và POST guest. V3/V4, Java integration, API browser/scale |
| AC-GUEST-01…03 | Guest browser + auth/storage tests + Spring Guest receipt/conflict tests |
| AC-DECK-01…03 | Rules/empty/read-only code + mobile + metadata scale 20k/22 decks |
| AC-IMPORT-01…03 | Parser corpus, BE import atomic/retry, real import/edit/Anki |

## Phi chức năng và giới hạn xác nhận

- NFR-PERF/REL/MAINT: lazy chunks, worker, 20 MB/20k, paging, transaction và Flyway V3/V4 được build/test với DB thật. Giữ OpenAPI và cấu hình môi trường hiện có.
- NFR-UX: giữ theme/font/reduced-motion, thông báo tiếng Việt, focus/native dialog. Đã sửa grid bị cắt ngang trên mobile 375px và kiểm tra screenshot `/tmp/n3-srs-verification/mobile.png`. Chưa chạy ma trận Safari/Firefox hoặc thiết bị vật lý.
- NFR-SEC-04…07: cấu hình JWT/CORS, non-root Docker và `.dockerignore` hiện có đã kiểm tra bằng mã. Đã thêm mẫu CSP trong `deploy/nginx.conf`; chưa triển khai TLS/secret/CSP lên production hoặc chạy container trên máy này.
- Token vẫn dùng localStorage theo hợp đồng hiện tại. Khuyến nghị cookie HttpOnly tại mục 16 chưa chuyển kiến trúc; không tuyên bố đã loại bỏ rủi ro XSS.
- Chưa kiểm thử phát toàn bộ 2.624 audio bên ngoài hoặc chất lượng giọng Web Speech. Các tính năng này phụ thuộc trình duyệt/nhà phát hành như SRS nêu.
- Đây là kết quả triển khai và kiểm chứng local, không phải xác nhận đã deploy production. Không push/merge các thay đổi trong lượt làm này.

Hướng dẫn vận hành: [learning-sync.md](learning-sync.md). Hướng dẫn import được cập nhật: [anki-import.md](anki-import.md).
