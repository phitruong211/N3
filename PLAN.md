# Cải tiến chia sẻ deck và nhóm — 2026-10-14

Trạng thái: người dùng đã duyệt, hoàn tất triển khai và kiểm chứng ngày 2026-10-14.

## Summary

Mở rộng chia sẻ hiện tại sang nhóm, chỉ bao gồm deck có sourceType IMPORT theo lựa chọn của người dùng. Tối giản hộp chia sẻ và trang nhận, đưa hành động lưu lên đầu và giữ nút chính dễ tiếp cận trên mobile.

## Context

- Frontend main đã fast-forward đến a6d1cd4, backend main đến 73fa0ed; không có thay đổi local trước khi pull.
- DeckShareDialog hiện kiểm tra trạng thái rồi cho tạo/copy/gửi/thu hồi link. Chia sẻ từng deck chỉ hỗ trợ IMPORT.
- SharedDeckPage cung cấp xem trước không đăng nhập, học thử/danh sách, 50 thẻ/trang trong nửa đầu bộ; nút lưu đang nằm sau phần xem trước.
- DeckShareService sao chép nội dung, template, tags và dictionary provenance; bỏ metadata tệp và tiến độ; chống trùng bằng importKey và khóa tài khoản nhận.
- DeckGroupService quản lý nhóm một cấp và thứ tự. Nhóm có thể chứa IMPORT lẫn MANUAL, việc sửa membership khóa tài khoản chủ nhóm.
- Chưa có link nhóm hoặc deep link mở đúng nhóm trong thư viện.

## Phương án đề xuất

Link nhóm phản ánh danh sách deck import hiện tại của nhóm. Khi lưu, người nhận nhận bản riêng của nhóm tại thời điểm đó; các bản đã nhận không tự đồng bộ. Phương án đóng băng nhóm ngay khi tạo link cần thêm lưu trữ snapshot và cập nhật phiên bản; chưa cần cho phạm vi này.

### Người gửi

- Menu nhóm thêm Chia sẻ nhóm cùng vị trí với Chia sẻ bộ thẻ trên deck.
- Hộp chia sẻ dùng chung bố cục: tên, số deck/thẻ được chia sẻ, một hành động chính, và điều khiển thu hồi ở phần phụ.
- Trước khi bật: nút Tạo liên kết. Mở hộp không tự bật chia sẻ.
- Khi có link: ô link ngắn gọn kèm Sao chép; thiết bị hỗ trợ có Gửi liên kết. Thông báo copy nằm tại chỗ.
- Giải thích ngắn ai có link có thể xem/lưu nội dung, ghi chú và giao diện; tiến độ riêng. Chi tiết ít dùng thu gọn.
- Nhóm lẫn MANUAL: hiển thị rõ “Chia sẻ X bộ import · Y bộ tạo thủ công không được chia sẻ”; tổng thẻ chỉ tính phần được chia sẻ. Nhóm không có IMPORT: không tạo link và giải thích lý do.
- Thu hồi cần xác nhận; bật lại tạo token mới. Thu hồi link nhóm không ảnh hưởng link deck riêng.

### Người nhận

- Trang đầu: tên deck/nhóm, người chia sẻ, số bộ/thẻ và nút chính Lưu bộ thẻ hoặc Lưu cả nhóm.
- Với nhóm: danh sách hàng gọn gồm tên deck, số thẻ và chỉ báo mở xem trước. Chỉ tải thẻ của deck đang mở, không tải toàn bộ nhóm.
- Bấm deck mở học thử ngay trong trang; dùng lại cơ chế giới hạn nửa bộ tại server và phân trang 50 thẻ.
- Giữ Học thử/Danh sách; gom số thứ tự và nút chuyển thẻ thành một hàng, đưa nhảy đến số thẻ vào điều khiển phụ. Bấm thẻ để lật; giảm nút và đoạn hướng dẫn lặp.
- Mobile: thanh hành động lưu cố định ở đáy, có safe-area và khoảng chừa để không che nội dung. Desktop: nút lưu cùng phần tiêu đề. Không bày hai nút lưu trùng nhau trên cùng viewport.
- Khách xem được ngay. Bấm lưu mở đăng nhập tại chỗ; chỉ tự tiếp tục ý định lưu sau khi đăng nhập thành công nếu người dùng vừa bấm lưu. Hủy đăng nhập phải hủy ý định này.
- Sau khi lưu: hành động đổi thành Mở nhóm/Mở bộ để học, dẫn đúng nội dung vừa nhận. Nhấn lưu lại trả về bản đang có, không ghi đè chỉnh sửa của người nhận.
- Lỗi mạng có thử lại đúng thao tác; link đã tắt/nhóm đã giải tán báo rõ và không hiển thị nút lưu còn hiệu lực.

### Deck lẻ — tối ưu rõ cả phía gửi và nhận

- Đây là phần bắt buộc cùng đợt cải tiến share nhóm, theo yêu cầu bổ sung của người dùng; phạm vi là hộp chia sẻ và trang mở link deck lẻ.
- Hộp chia sẻ deck lẻ: tên bộ và số thẻ, một dòng giải thích, ô link kèm nút Sao chép. Tạo liên kết là hành động chính khi chưa bật; khi đã bật, Sao chép là hành động chính và Gửi liên kết là phụ trên thiết bị hỗ trợ. Ngừng chia sẻ đặt trong phần tùy chọn, vẫn có xác nhận.
- Trang nhận deck lẻ dùng một bố cục liền mạch thay cho nhiều panel lồng nhau: tên bộ → tác giả/số thẻ → mô tả nếu có → nội dung xem trước. Mô tả dài thu gọn với Xem thêm.
- Một hành động lưu duy nhất theo viewport: ở phần đầu trên desktop, thanh đáy trên mobile. Nhãn Lưu bộ thẻ; khách thấy chú thích Cần đăng nhập thay vì nhãn nút quá dài. Khi đang lưu, khóa nhấn lặp và giữ kích thước nút; thành công đổi thành Mở bộ để học.
- Học thử mặc định: một thẻ trung tâm, bấm thẻ để lật; một hàng điều hướng gồm Trước · 1/N · Tiếp. Số thứ tự mở điều khiển nhảy đến thẻ, không bày ô nhập thường trực. Bỏ nút Hiện nghĩa/Xem mặt trước trùng thao tác bấm thẻ; giữ Space/Enter để lật và phím mũi tên/vuốt để chuyển.
- Học thử/Danh sách là hai lựa chọn nhỏ trên cùng thanh công cụ. Tiến độ, số lượng xem trước và hướng dẫn không lặp ở nhiều vị trí; nói rõ Xem trước X/Y thẻ một lần gần nội dung.
- Danh sách dùng hàng gọn, từ/cách đọc và nghĩa căn rõ; bấm từ mở đúng thẻ học thử. Nội dung dài xuống dòng, không tạo cuộn ngang trên điện thoại.
- Các trạng thái tải, lỗi mạng, bộ trống, đã lưu, link thu hồi dùng cùng khung gọn; giữ thông tin nguồn từ điển ở cuối khi cần.
- Link deck cũ vẫn mở được, giữ giới hạn xem trước phía server và cách sao chép độc lập hiện tại.

## System Impact

- Backend là nguồn sự thật cho token, eligibility, membership, thứ tự và việc sao chép. Frontend không tự lọc để quyết định quyền truy cập.
- Bổ sung shareToken và importKey nguồn cho DeckGroup, migration V12; token duy nhất và nguồn bản nhận duy nhất theo owner.
- API chủ nhóm: GET/PUT/DELETE /deck-groups/{id}/share. Phản hồi trạng thái có số deck được/không được chia sẻ để UI minh bạch.
- API public: GET /shared-deck-groups/{token} trả metadata và danh sách deck import phân trang; GET /shared-deck-groups/{token}/decks/{deckId}?page=... xác minh token, membership và IMPORT tại mỗi request. Không làm lộ hay tự bật token riêng của deck.
- API authenticated: POST /shared-deck-groups/{token}/copy trả groupId, deckIds, alreadySaved. Giữ route /shared/:token cho link deck cũ; thêm /shared/groups/:token cho nhóm và cập nhật giữ route khi đăng nhập.
- Sao chép cả nhóm trong một transaction: giữ tên nhóm, thứ tự, nội dung, template, tags, provenance; tạo ID mới, reset tiến độ; không copy đường dẫn tệp nguồn.
- Tách helper sao chép nội dung dùng chung với share deck. Không gọi copy qua token deck riêng; không kéo bản deck đã nhận trước đây sang nhóm mới. Các deck nhận qua nhóm có khóa nguồn theo nhóm.
- Chống nhấn đúp/retry bằng khóa bản nhận; nếu bản nhóm vẫn tồn tại thì mở bản đó, không tự thêm/bù deck người nhận đã xóa hoặc chuyển đi. Nếu người nhận giải tán nhóm, lần nhận tiếp tạo một nhóm mới hợp lệ với bản deck mới, không di chuyển deck cũ.
- Khóa theo thứ tự nhất quán giữa tài khoản nguồn/nhận; phối hợp với luồng sửa nhóm và share deck để tránh deadlock khi hai người nhận nhóm của nhau. Revalidate token/membership sau khóa.
- Kiểm tra giới hạn trước khi tải nội dung: đề xuất tối đa 100 deck import và 20.000 thẻ cho một lần nhận nhóm; lỗi không để lại nhóm hay bản sao dở dang.
- Public response no-store; không trả email, tiến độ, metadata tệp hay token deck riêng. Giữ attribution nguồn từ điển.

## Changes

Frontend:
- src/lib/deckSharing.ts: typed target deck/group, API public nhóm và lưu nhóm, URL tương thích link cũ.
- src/components/flashcard/DeckShareDialog.tsx: bố cục tối giản dùng chung cho deck/nhóm, counts và copy/native share/revoke/error.
- src/components/flashcard/DeckGroups.tsx, ImportedDecks.tsx: mở hộp share nhóm và deep link /decks?group=... để mở đúng nhóm.
- src/components/flashcard/SharedDeckPage.tsx, SharedDeckContent.tsx: CTA dễ tiếp cận, giảm controls trùng, giữ phân trang và hỗ trợ bàn phím.
- Thêm trang SharedGroupPage và CSS chia sẻ dùng chung; tách phần lưu/auth dùng chung khi cần tránh nhân đôi state flow.
- src/App.tsx, src/components/auth/AuthPage.tsx, src/hooks/useAuth.tsx nếu cần: public route nhóm và ý định lưu sau đăng nhập/hủy.
- tests/deckSharing.browser.mjs, docs/deck-sharing.md: test/ tài liệu luồng mới và tương thích.

Backend japanese-server:
- model/DeckGroup.java, repository/DeckGroupRepository.java, DeckRepository.java, CardRepository.java: token, nguồn bản nhận, truy vấn count/metadata và khóa cần thiết.
- db/migration/V12__deck_group_sharing.sql.
- deck/DeckGroupShareController.java, DeckGroupShareService.java: API share nhóm, membership, limits, atomic copy/idempotency.
- deck/DeckShareService.java và helper sao chép nội dung: tái sử dụng bảo toàn dữ liệu, thứ tự khóa thống nhất.
- security/SecurityConfig.java: chỉ cho anonymous GET các route preview cụ thể, copy vẫn yêu cầu auth.
- deck/DeckGroupShareIntegrationTest.java và DeckShareIntegrationTest.java: quyền, dữ liệu, thu hồi và concurrency.

## Verification

- Frontend build, unit tests, lint file thay đổi; test:sharing và test:deck-groups.
- Backend test share deck/nhóm với H2; kiểm tra migration, idempotency/concurrency trên MySQL thử riêng.
- Nhóm trộn IMPORT/MANUAL chỉ hiển thị/sao chép IMPORT; nhóm rỗng/không import, link bị tắt/giải tán, deck rời nhóm hoặc soft-delete, giới hạn tổng dữ liệu.
- Một giao dịch nhận cả nhóm, đúng thứ tự/template/tags/provenance, ID mới, không tiến độ hoặc metadata tệp, không đụng bản deck riêng có sẵn.
- Khách mở link → học thử → lưu → đăng nhập → hoàn tất → mở đúng nhóm. Hủy auth, mạng lỗi/retry, nhấn đúp, đổi tài khoản và link giữa chừng.
- Desktop/mobile và sáng/tối, bàn phím/focus, tên dài, nhiều deck, thanh CTA không che nội dung, link deck cũ vẫn hoạt động.
- Deck lẻ: một CTA lưu nhìn thấy theo viewport; bấm/Space/Enter lật thẻ; điều hướng/nhảy thẻ không mất vị trí khi đổi Học thử/Danh sách; mô tả dài, bộ trống và trạng thái đã lưu; hộp gửi link rõ một hành động chính.

## Kết quả triển khai

- Hoàn tất API chia sẻ nhóm chỉ IMPORT, migration V12, copy nhóm nguyên tử/chống trùng và bảo toàn template/tags/notes/provenance với tiến độ độc lập. Link deck cũ tương thích.
- Hoàn tất hộp gửi link tối giản dùng chung, trang nhận nhóm lazy preview và giao diện deck lẻ, thanh lưu mobile, tự tiếp tục ý định lưu sau đăng nhập/hủy đúng, deep link mở đúng bộ/nhóm.
- Build frontend đạt; lint các file thay đổi không cảnh báo; 87 unit test frontend đạt. Vite vẫn báo chunk three lớn như trước.
- `npm run test:sharing`: đạt các luồng deck/nhóm, auth cancel/auto save, bàn phím/swipe/jump, phân trang/lazy preview, counts và mobile CTA.
- Backend toàn bộ H2: 50 test tổng, 48 đạt và 2 test chỉ MySQL bỏ qua. MySQL 8.4 thử riêng: 15/15 test share deck/nhóm đạt; migration V1–V12/schema validate đạt; sau bổ sung assertions provenance/progress, nhóm MySQL 8/8 đạt.
- `npm run test:sharing:integration`: đạt trên backend thật + MySQL thử riêng group_share_test, gồm nhận IMPORT-only, giữ template/tags/notes/reset progress, không di chuyển bản deck đã có, retry, deep link nhóm, thu hồi và link deck cũ.
- Đã xem screenshot desktop và mobile. Ảnh ở artifacts/deck-sharing (ignored bởi repository). Tài liệu API/triển khai tại docs/deck-sharing.md.
- Backend có V12 cần phát hành trước frontend; chưa xác nhận triển khai production.
