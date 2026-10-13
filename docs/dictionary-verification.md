# Kết quả kiểm tra MVP — 13/10/2026

## Dữ liệu và môi trường

- Snapshot chính thức: `https://www.edrdg.org/pub/Nihongo/JMdict_e.gz`.
- SHA-256: `5a5ad08af6d85c4cf7eac5ac8fd7a053a998f4eb40359ae223c4ee9cdbd7687b`.
- 218.908 mục từ nhập thành công; XML giải nén 63.171.283 byte. Bộ importer chỉ lấy gloss Anh; ngôn ngữ ở trường nguồn gốc từ mượn không được tính là ngôn ngữ nghĩa.
- Java 21.0.7, MySQL 8.0.44, Windows, Intel i5-12450HX (12 logical processors), JVM heap giới hạn 768 MB.
- Database kiểm tra riêng trên localhost:13307, API riêng localhost:18080. Không dùng database hiện có của người dùng.
- Dung lượng MySQL sau import khoảng 1,05 GiB (entry JSON + forms/tokens/index), theo information_schema; số row ở đó là ước lượng, số mục từ báo cáo dùng kết quả parser. Khi vận hành cần dự trù chỗ cho staging và phiên bản trước, ít nhất khoảng ba lần dung lượng này ngoài dữ liệu học.

## Kết quả

- Backend toàn bộ suite sau rà soát: 42 test được phát hiện, 41 pass, một test chia sẻ chuyên biệt MySQL được skip trong profile H2 như thiết kế sẵn. Cache có test version/TTL/eviction, request đồng thời và retry sau lỗi.
- Dictionary trên MySQL thật: 10/10 pass, bao gồm migration V11, Unicode/cursor, khử chia/POS gắn với sense, owner, retry, concurrent add, move/delete/share, XML external entity, phân trang hết 250 mục và lỗi version có mã.
- Frontend unit suite: 87/87 pass. Production build thành công; lint không có lỗi (còn warning cũ trong các script skill). Warning bundle lớn sẵn có thuộc Three/XLSX.
- Browser fixture Edge: public search, guest đăng nhập giữ từ, chọn deck trang hai/trong nhóm, sửa nghĩa, tạo deck retry, thêm thẻ retry giữ key, deck gần nhất, IME, Back, mobile/dark; hết phiên rồi đăng nhập lại giữ nghĩa đã sửa và idempotency key; chọn sense khớp nghĩa Anh; đổi version giữ phần chỉnh và xác nhận nghĩa mới; cursor cũ tự làm mới; draft hỏng không làm lỗi giao diện.
- Browser API thật: tra `neko` từ toàn corpus → tạo tài khoản → tạo deck → sửa nghĩa Việt → lưu → thêm lại trả đã tồn tại → mở thẻ đã lưu → học tự do và lật đúng đáp án.
- CLI không mở HTTP server: chạy lại snapshot đã READY kích hoạt đúng version rồi thoát thành công, không nhập trùng.
- EXPLAIN đường exact form dùng `ix_dictionary_form_search`, access type `ref`, `Using index`.

## Hiệu năng

Sau tối ưu kiểm tra sense và cache công khai theo version (TTL 60 giây, tối đa 32 truy vấn, ước lượng 16 MB), warmup 13 truy vấn rồi chạy 100 request theo 5 lượt × 20 client đồng thời: p50 **22 ms**, p95 **36 ms**, lớn nhất **39 ms**. Lượt priming/warmup chậm nhất **239 ms**; lượt này có JIT/cache miss và không phải bảo đảm p95 cold. Tập tra gồm Kanji/kana/nửa rộng, nghĩa Anh và `食べました`, `書いて`, `行った`, `高かった`, `勉強しました`.

Đây là số đo localhost với dữ liệu/index đã nóng trên máy trên, không phải cam kết latency production hay mạng di động. Chạy lại `tests/dictionary.benchmark.mjs` trên máy triển khai để so sánh.

## Rà soát giao diện bổ sung

- Chọn nghĩa hiển thị trực tiếp; phần sửa cách đọc/cách viết và nội dung thẻ vẫn có thể mở rộng.
- Hộp thoại giữ tiêu đề và nút thêm cố định; nội dung cuộn riêng. Input trên mobile dùng cỡ chữ 16px. Nút lưu giới hạn hai dòng khi tên deck dài.
- Enter tạo deck, kể cả thử lại sau lỗi mạng; bỏ qua Enter đang composition để không ngắt bộ gõ.
- Browser fixture bổ sung màn hình 320 × 480, cuộn phần chỉnh sửa mà nút lưu vẫn trong viewport, không tràn ngang, Escape đóng và trả focus về nút mở, tên deck dài không làm nút cao quá mức.
- Build production, lint phần sửa và kiểm thử chia sẻ deck được chạy lại. Đây là kiểm tra Edge với viewport giả lập; chưa kiểm tra trên thiết bị iOS/Android thật hoặc nghiên cứu với người dùng thực tế.
