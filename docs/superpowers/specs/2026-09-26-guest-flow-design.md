# Thiết kế luồng Guest và chuyển sang tài khoản

Ngày: 26/09/2026

Trạng thái: phạm vi và hướng thiết kế đã được người dùng đồng ý; đặc tả này chờ duyệt trước bước lập kế hoạch triển khai.

## 1. Mục tiêu và giới hạn

Hoàn thiện mục 18 của SRS: người học vào Guest, học nội dung tích hợp và lưu tiến độ trên thiết bị; xem preview import trước khi đăng nhập; sau xác thực trở lại preview để xác nhận tạo bộ. Dữ liệu Guest và từng tài khoản phải tách biệt.

Nguồn yêu cầu: `/Users/vophitruong/Downloads/SRS.md`, đặc biệt mục 3.1, 9, 18, 22 và Phụ lục A; nội dung đính kèm giới hạn thay đổi vào luồng Guest. Tệp thực tế là SRS.md, không phải SRS-2.md được nhắc trong nội dung đính kèm.

Không thay CardView/DeckSummary, thiết kế import hai nút và dấu !, mapping, phân trang, thuật toán SRS hoặc hợp đồng backend. Không xây API đồng bộ P3 và không giả lập chuyển dữ liệu thành công. Backend hiện hữu tiếp tục bảo vệ tài khoản, deck và review bằng JWT.

## 2. Hiện trạng đã đối chiếu

- `src/App.tsx`: AuthGate chỉ mount AppProvider khi có user.
- `src/hooks/useAuth.tsx`: khôi phục phiên, đăng nhập, đăng ký và đăng xuất; chưa có Guest hoặc đích quay lại.
- `src/hooks/useApp.tsx`: đọc localStorage chung và tự tải cài đặt server khi mount; cập nhật cài đặt luôn gửi PATCH.
- `src/lib/storage.ts`: SRS, bookmark, cài đặt và điều hướng chưa có namespace theo chủ thể.
- Hai component nghe đọc/ghi localStorage riêng, bên ngoài storage.ts.
- `ImportedDecks.tsx`: luôn tải deck cá nhân khi mount; preview và tên bộ nằm trong component. Cả Flashcard và Anki tích hợp cùng render component này.
- `src/lib/api.ts`: tự gắn token nếu tìm thấy; refresh dùng chung promise. Đăng nhập/đăng ký cũng đi qua cùng apiRequest.
- `src/lib/ankiStorage.ts`: dữ liệu bộ cá nhân thực sự ở API, không phải IndexedDB; không cần đổi nơi lưu.

## 3. Lựa chọn kiến trúc

Chọn mở rộng AuthProvider và lớp storage hiện có, kết hợp rào quyền theo hành động. Không chặn toàn bộ trang Flashcard/Anki vì các trang chứa cả bộ tích hợp được phép học thử. Không tạo một ứng dụng Guest riêng vì sẽ nhân đôi luồng học.

Ba trạng thái phiên: `unauthenticated`, `guest`, `authenticated`. Trạng thái loading và lỗi khôi phục là trạng thái phụ; lỗi mạng không đồng nghĩa với Guest và không xóa refresh token.

AuthProvider quản lý phiên, lời nhắc đăng nhập và đích quay lại. Dữ liệu học của AppProvider gắn với chủ thể hiện tại. Bản nháp import được giữ riêng ở cấp cao hơn cây dữ liệu học để không mất khi cây đó được thay thế lúc đăng nhập.

## 4. Luồng giao diện

### Vào và học thử

Trang chào thêm “Khám phá với tư cách khách”. Chọn lần đầu vào Hôm nay, không gọi API tài khoản. Ghi nhớ lựa chọn Guest trong phiên tab; reload cùng tab vẫn tiếp tục Guest. Bookmark và tiến độ Guest tồn tại trong localStorage qua các lần mở trình duyệt.

Guest được tìm kiếm, xem thư viện, học flashcard, SRS/Anki tích hợp, quiz và luyện nghe. Khu vực bộ cá nhân không tải deck/progress server. Thay trạng thái rỗng gây hiểu nhầm bằng giải thích cần tài khoản để lưu/quản lý bộ cá nhân; vẫn cho chọn file import.

### Rào đăng nhập

Khi Guest xác nhận tạo bộ hoặc chọn chức năng tài khoản, hiển thị “Đăng nhập để lưu và đồng bộ bộ thẻ của bạn”, với ba hành động Đăng nhập, Đăng ký, Tiếp tục học thử.

Lời nhắc và biểu mẫu xác thực không xóa trang nền. Hủy/Escape quay lại thao tác đang dở, trả focus về nút mở. Đối thoại có tên truy cập, quản lý focus và ngăn tương tác nền khi mở.

Đăng nhập thành công chỉ phục hồi đích và bản nháp; không tự thực thi thao tác ghi server. Người học kiểm tra lại rồi xác nhận. Đăng nhập thất bại giữ bản nháp và cho thử lại hoặc hủy.

### Tạo thủ công và import

Cho mở biểu mẫu tên bộ thủ công tại máy; chặn ở bước xác nhận tạo, thống nhất AC-GUEST-02. Không tạo deck rỗng trong bước đăng nhập.

Import tiếp tục dùng parser hiện hữu và giới hạn hiện có. Chọn file, parse, sửa tên và xem preview đều không gửi nội dung file lên server. Chỉ sau xác thực và xác nhận lại mới gọi API tạo bộ.

Bản nháp gồm preview đã parse, tên bộ, chế độ trang Flashcard/Anki và loại thao tác. Lưu trong bộ nhớ phiên ứng dụng, tồn tại qua việc mở/đóng auth và thay chủ thể. Không ghi tệp lớn vào sessionStorage vì quota có thể nhỏ hơn giới hạn import 20 MB. Hiển thị rõ: “Bản nháp được giữ khi đăng nhập trong trang này. Nếu tải lại hoặc đóng trang, bạn có thể cần chọn lại tệp.”

Hủy lời nhắc đăng nhập giữ preview. Hủy import hoặc tạo thành công xóa bản nháp. Đăng xuất xóa bản nháp thuộc tài khoản cùng state deck, tránh lộ dữ liệu sang Guest/B. Khóa nút khi đang gửi; API lỗi giữ preview. Không tuyên bố retry sau timeout có idempotency server vì đó là P2 ngoài phạm vi.

### Cài đặt và đăng xuất

Guest được chỉnh các tùy chọn giao diện/học cục bộ và xóa dữ liệu Guest sau xác nhận. Khu vực tài khoản có hành động đăng nhập; không tải hoặc PATCH cài đặt server ở Guest. Nhãn phân biệt rõ cài đặt trên thiết bị và cài đặt tài khoản.

Đăng xuất thu hồi phiên theo API hiện có, loại bỏ state deck/progress của tài khoản và về Guest tại Hôm nay. Dữ liệu Guest vẫn giữ nguyên. Dữ liệu cục bộ tài khoản vẫn thuộc namespace của tài khoản đó và không hiện ở Guest.

## 5. Lưu trữ và chuyển chủ thể

Namespace học: `guest:<key>` hoặc `user:<userId>:<key>`. Namespace token: `auth:<key>`. Áp dụng cho bookmark, các bộ SRS, migration marker, study days, cài đặt, trang/chỉ mục/bộ gần nhất, trạng thái podcast và điểm nghe JLPT.

Lớp đọc/ghi phải gắn với chủ thể cụ thể trong suốt vòng đời thao tác. Không để callback cũ dùng một biến namespace toàn cục đã đổi rồi ghi dữ liệu A sang B. Cây state học được tạo lại theo chủ thể; callback bất đồng bộ kiểm tra phiên trước khi cập nhật UI hoặc ghi storage. Cleanup phiên học ghi vào chủ thể ban đầu.

Đổi phiên ở tab khác phải làm mất hiệu lực state và request thuộc phiên cũ; không gửi thao tác của UI tài khoản A bằng token của B. Theo dõi thay đổi token/phiên qua storage event và khôi phục lại chủ thể trước khi cho thao tác được bảo vệ.

Reset chỉ xóa dữ liệu học của namespace hiện tại, gồm dữ liệu nghe; không xóa token, namespace khác hoặc bản lưu dữ liệu cũ.

### Dữ liệu phiên bản cũ

Dữ liệu học không namespace không chứa danh tính chủ sở hữu đáng tin cậy. Không tự gán cho tài khoản đăng nhập đầu tiên hoặc đưa ra Guest. Giữ nguyên các khóa cũ như bản lưu chưa xác định chủ thể; ngừng sử dụng chúng làm fallback cho mọi tài khoản. Hiển thị thông báo nếu phát hiện dữ liệu cũ, giải thích dữ liệu vẫn được giữ trên thiết bị và chưa tự chuyển vào tài khoản. Migration gán/chuyển dữ liệu 1.0 là công việc riêng theo FR-GUEST-09.

Token cũ có thể chuyển một lần sang auth namespace, ưu tiên token mới nếu đã tồn tại; chỉ xóa khóa token cũ sau khi lưu thành công. Khôi phục user bằng API hiện có, không tin việc giải mã JWT cục bộ như xác nhận chủ sở hữu dữ liệu học cũ.

Migration SRS v1 tiếp tục hoạt động bên trong namespace được xác định; không đọc ngầm dữ liệu cũ không namespace. Mọi migration phải có thể chạy lại mà không nhân đôi hoặc ghi đè dữ liệu đích. Storage lỗi/quota không được thông báo lưu thành công.

## 6. Rào API và lỗi phiên

Chặn ở UI trước khi tạo request deck, cài đặt tài khoản hoặc review server. Lớp API bổ sung kiểm tra để request được bảo vệ từ Guest bị từ chối cục bộ, không đến fetch. Request đăng nhập/đăng ký/refresh không mang Authorization cũ.

Giữ refresh đơn luồng và retry tối đa một lần. Refresh 401 vô hiệu hóa phiên; lỗi mạng/5xx giữ khả năng retry, không xóa refresh token. Phản hồi refresh đến sau logout/đổi phiên không được hồi sinh token cũ. Không retry mutation bằng token của chủ thể khác.

Tải cài đặt và deck gắn với phiên gọi: khi logout, thay tài khoản hoặc unmount, phản hồi cũ không được cập nhật state/storage hiện tại. Backend vẫn là nơi quyết định quyền sở hữu.

## 7. Guest sau đăng nhập và P3

Khi có dữ liệu học thử, hiển thị giải thích: bookmark, SRS và tiến độ học thử chỉ nằm trên thiết bị và chưa được chuyển vào tài khoản. Chỉ cung cấp “Giữ dữ liệu học thử trên thiết bị”. Không gộp, xóa hoặc sao chép dữ liệu Guest sang tài khoản.

Đặt TODO rõ tại điểm sau xác thực cho FR-GUEST-07/08: khi API P3 có thật mới thêm thống kê dữ liệu chuyển, đồng ý chuyển, gộp idempotent, ưu tiên tiến độ tài khoản và xóa Guest sau xác nhận server. Bản hiện tại chỉ đáp ứng FR-GUEST-09.

## 8. Phạm vi file

- Phiên/routing: `src/hooks/useAuth.tsx`, `src/App.tsx`, `src/components/auth/AuthPage.tsx`; thêm component đối thoại và module phiên/bản nháp nếu cần để tránh dồn vào component lớn.
- Storage/API: `src/lib/storage.ts`, `src/lib/api.ts`, module storage theo chủ thể nếu cần; giữ chữ ký nghiệp vụ đang dùng khi có thể.
- State học/cài đặt: `src/hooks/useApp.tsx`, `src/components/settings/SettingsPage.tsx`.
- Bộ thẻ: `src/components/flashcard/ImportedDecks.tsx`; chỉ chỉnh FlashcardPage/ankiStorage nếu cần truyền ngữ cảnh phiên, không đổi hợp đồng thẻ.
- Nghe: `src/components/listening/ListeningPage.tsx`, `src/components/listening/JlptListeningPractice.tsx`.
- Tests: bổ sung test phiên, storage và rào API; kiểm thử UI luồng import/auth bằng trình duyệt.

## 9. Tiêu chí kiểm chứng

1. AC-GUEST-01: trình duyệt sạch → Guest → Hôm nay → tìm kiếm/học/lưu bookmark → reload giữ bookmark. Network không có API tài khoản/deck/settings/review hoặc JWT từ luồng học thử.
2. AC-GUEST-02: chọn file → preview/sửa tên → Tạo bộ → lời nhắc auth; hủy vẫn còn preview và bookmark, không POST deck. Đăng nhập/đăng ký thành công trở lại preview; chỉ xác nhận tiếp theo mới tạo bộ. Kiểm tra thủ công tương tự.
3. AC-GUEST-03: A lưu tiến độ → logout → Guest → B. Không nhìn thấy bookmark, SRS, settings, nghe hoặc deck của A; Guest không bị xóa hay nhân đôi. Không kiểm thử chuyển dữ liệu P3 như tính năng đã tồn tại.
4. Unit: đọc/ghi/reset giữa các namespace; dữ liệu cũ được giữ và không lộ; token migration chạy lại an toàn; chặn request Guest; auth công khai không gắn JWT; refresh concurrent/401/offline; phản hồi muộn sau logout và đổi tài khoản.
5. UI bổ sung: Escape/focus/cancel đối thoại; đăng nhập lỗi; reload khi có draft với thông báo giới hạn; lỗi API giữ preview; bộ tích hợp trong cả Flashcard và Anki vẫn dùng được; tài khoản đổi ở tab khác vô hiệu hóa thao tác cũ.
6. Chạy `npm test`, `npm run build` và lint phù hợp. Báo rõ kiểm chứng tự động, kiểm chứng bằng trình duyệt và phần chưa thể xác nhận nếu backend không sẵn sàng. Không suy ra test backend đạt từ test frontend.

## 10. Trình tự sau khi duyệt

Lập kế hoạch triển khai từ đặc tả đã duyệt, rồi triển khai lần lượt storage/phiên, rào UI/API, giữ draft và quay lại, nhãn giới hạn và kiểm chứng. Không cần thay backend cho phạm vi này.
