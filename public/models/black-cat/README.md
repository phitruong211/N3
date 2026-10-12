# Dashboard black cat

Model nguồn: `cat_hq2.glb`, do người dùng cung cấp ngày 2026-10-12.
File gốc được sao chép nguyên vẹn, khoảng 5.1 MB. Thông tin tác giả và giấy phép không nằm trong metadata được kiểm tra.

- Một glTF mesh với ba primitives, material `body`, `eye`, `pupil`.
- Màu nằm trong `COLOR_0`; giữ nguyên tên material và vertex color.
- Bản mới `cat_blink.glb` có morph `Blink`, tạo bằng `scripts/create_cat_blink.py`. Không có skeleton. Chớp mắt tự động mỗi 3–6 giây và khi chạm.
- File Blender chỉnh sửa được: `artifacts/cat-blink/cat_blink.blend`. Ảnh QA mở/nửa nhắm/nhắm kín nằm cùng thư mục.
- Cấu hình: `src/components/dashboard/catConfig.ts`, object `CONFIG`.
- Phản chiếu softbox dùng RoomEnvironment/PMREM cục bộ, không tải HDR từ bên ngoài.
