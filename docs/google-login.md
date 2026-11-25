# Đăng nhập & liên kết Google

FE dùng Google Identity Services (nút popup), gửi **ID token** (JWT `credential`) lên backend. Backend phải tự xác minh token.

## Cấu hình
- FE: `VITE_GOOGLE_CLIENT_ID` (OAuth Client ID loại Web). Để trống → ẩn nút Google.
- Google Cloud Console: thêm origin FE vào *Authorized JavaScript origins*.
- BE: cùng Client ID để kiểm tra `aud`.
- CSP (`deploy/nginx.conf`) đã cho phép `accounts.google.com/gsi/*`.

## API backend cần có (repo `japanese-server`)

### `POST /api/v1/auth/google` (public)
Body: `{ "idToken": string, "deviceName": string }` → `AuthResponse` giống `/auth/login`.
1. Xác minh `idToken` (chữ ký JWKS Google, `iss` = `accounts.google.com`/`https://accounts.google.com`, `aud` = Client ID, `exp`, `email_verified = true`).
2. Có user với `google_sub = sub` → đăng nhập.
3. Chưa có, nhưng email đã tồn tại (tài khoản mật khẩu) → **409**, `code: "GOOGLE_NOT_LINKED"`, message: "Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu rồi liên kết Google trong Cài đặt → Tài khoản." (không tự gộp, tránh chiếm tài khoản qua email chưa xác minh).
4. Chưa có gì → tạo user mới (password null, `displayName` = `name`, `avatarUrl` = `picture`, `google_sub = sub`).

### `POST /api/v1/users/me/google` (cần đăng nhập)
Body: `{ "idToken": string }` → `ApiUser`.
- Xác minh như trên; `sub` đã gắn với user khác → **409** "Tài khoản Google này đã liên kết với tài khoản khác.".
- Lưu `google_sub` vào user hiện tại (email Google có thể khác email tài khoản).

### `ApiUser`
Thêm `googleLinked: boolean` (= `google_sub != null`) vào `/auth/me` và các response user.

### DB
`users.google_sub VARCHAR(255) NULL UNIQUE`; `password_hash` cho phép NULL (tài khoản chỉ có Google không đăng nhập bằng mật khẩu).
