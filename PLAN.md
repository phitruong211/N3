# Kế hoạch triển khai “Sổ học”

## Tóm tắt
Thiết kế lại toàn bộ giao diện theo [đặc tả](docs/superpowers/specs/2026-09-19-japanese-learning-redesign-design.md), giữ JSON, ID, SRS và tiến độ. Dùng một bộ token và thành phần nhỏ, rồi thay từng màn theo thứ tự luồng học.

## Hiện trạng và tác động
- `src/index.css` có token nhưng các trang còn mã màu, radius và bóng riêng; desktop/mobile có hai cấu trúc điều hướng khác nhau.
- `AppProvider` là nguồn trạng thái trong phiên, `localStorage` lưu tiến độ; không đổi định dạng hay lịch ôn. Bộ lọc và mục đang chọn vẫn thuộc từng trang.
- Dữ liệu N3 giàu trường, N4 đơn giản hơn; kanji không có âm đọc riêng. UI chỉ hiện thông tin có thật.
- Home còn biểu đồ và nhiều khối chỉ số; phiên học có ba biến thể flashcard trong file lớn. Tách vỏ/điều khiển chung khi bảo toàn hành vi.

## Thực hiện
1. `src/index.css`, `src/components/ui/*`: bộ màu 4 theme, chữ Nhật/Việt, spacing và các phần chung có nhu cầu lặp lại; dọn CSS cũ tương ứng.
2. `src/components/layout/*`, `src/App.tsx`: điều hướng chính và phụ, tab mobile năm đích, header/tìm kiếm, vỏ phiên học và loading/error cùng ngôn ngữ.
3. `src/components/dashboard/Dashboard.tsx`: Home tập trung CTA ôn và ba thư viện; chuyển phân tích chi tiết sang `ProgressPage.tsx` nếu cần.
4. `src/components/vocabulary/*`, `grammar/*`, `kanji/*`: thứ bậc Nhật → cách đọc/nghĩa, dữ liệu thứ cấp thu gọn, lọc/tìm rõ, bố cục mobile không tràn ngang.
5. `src/components/flashcard/*`, `srs/*`, `quiz/*`: giảm nhiễu khi học, front/back rõ, điều khiển/keyboard/touch ổn định, không thay lịch SRS.
6. `src/components/search/*`, `progress/*`, `bookmarks/*`, `settings/*`: dùng hệ thống chung, tiếng Việt, empty/focus/điều hướng đúng mục.

## Kiểm tra
- `npm run build`, `npm run lint`, `git diff --check`.
- Kiểm tra Home, ba thư viện, Flashcard/SRS/Quiz, Tìm kiếm, Tiến độ, Đã lưu, Cài đặt ở 320/375/768 px và desktop; bốn theme, trường trống, chữ Nhật/nghĩa dài, keyboard/focus, trạng thái rỗng và tải lỗi.
- Xác nhận bookmark, thẻ SRS và cài đặt vẫn giữ sau reload; không thay JSON hoặc xóa các thay đổi trước đây của người dùng.
