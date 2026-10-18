# Cấu hình đăng nhập Google cho WorkRank

WorkRank dùng OAuth 2.0 authorization code flow ở backend. Google chuyển trình duyệt về backend; backend đổi authorization code, xác minh ID token bằng thư viện Google Auth, rồi phát hành JWT phiên WorkRank hiện tại. `GOOGLE_CLIENT_SECRET` chỉ được đặt trong môi trường backend.

## Tạo OAuth client

1. Mở [Google Cloud Console — APIs & Services — Credentials](https://console.cloud.google.com/apis/credentials), chọn hoặc tạo Google Cloud project.
2. Cấu hình OAuth consent screen/Google Auth Platform, điền tên ứng dụng và email hỗ trợ. Khi ứng dụng còn ở chế độ Testing, thêm các tài khoản Google dùng để thử vào danh sách test users.
3. Tạo OAuth client ID loại **Web application**.
4. Thêm **Authorized JavaScript origins** cho origin giao diện WorkRank. Khi chạy local dùng `http://localhost:5173`; production dùng origin giao diện thật, ví dụ `https://workrank.example.com`. OAuth code flow phía backend không nhúng client ID vào JavaScript; origin này vẫn hữu ích khi cấu hình ứng dụng web và nếu sau này bật GIS.
5. Thêm **Authorized redirect URI** chính xác trùng với `GOOGLE_REDIRECT_URI` của backend. Google yêu cầu khớp tuyệt đối scheme, hostname, port và path.

Tài liệu Google hướng dẫn tạo URL authorization với `state` và đổi authorization code ở backend ([OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)). WorkRank bổ sung cookie `HttpOnly` `SameSite=Lax` để kiểm tra `state`, `nonce` gắn với ID token và vé đăng nhập dùng một lần trước khi tạo phiên nội bộ. Backend dùng [Google Auth Library for Node.js](https://github.com/googleapis/google-auth-library-nodejs) để kiểm tra ID token theo audience ứng dụng.

## Local

Trong `backend/.env` (hoặc môi trường chạy backend), đặt các giá trị lấy từ OAuth client:

```dotenv
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=<Client ID của Web application>
GOOGLE_CLIENT_SECRET=<Client secret của Web application>
GOOGLE_REDIRECT_URI=http://localhost:5001/api/auth/google/callback
```

Đảm bảo redirect URI trên trùng tuyệt đối với URI đã đăng ký ở Google Cloud. Khởi chạy backend ở `http://localhost:5001` và frontend Vite ở `http://localhost:5173`. Vite proxy `/api` đến backend theo `VITE_API_URL` (mặc định `http://localhost:5001`). Không đặt `GOOGLE_CLIENT_SECRET` trong `frontend/.env` hay biến `VITE_*`.

## Production

Đặt ba biến Google trên dịch vụ backend đang chạy WorkRank. Ví dụ khi backend cũng phục vụ frontend cùng hostname:

```dotenv
CLIENT_URL=https://workrank.example.com
GOOGLE_CLIENT_ID=<Client ID của Web application>
GOOGLE_CLIENT_SECRET=<Client secret của Web application>
GOOGLE_REDIRECT_URI=https://workrank.example.com/api/auth/google/callback
```

Nếu frontend và backend có hostname riêng, `CLIENT_URL` là origin frontend còn `GOOGLE_REDIRECT_URI` dùng hostname backend, ví dụ `https://api.example.com/api/auth/google/callback`. Thêm đúng hai origin frontend/backend cần thiết vào cấu hình Cloud Console nếu cấu hình ứng dụng yêu cầu, và chỉ đăng ký redirect URI backend thực sự sử dụng. Production cần HTTPS để cookie `Secure` được gửi trong callback.

Sau khi đặt biến môi trường, chạy migration tại thư mục dự án:

```sh
npm run db:migrate
```

Migration thêm `users.google_sub` có unique index để tránh tạo liên kết Google trùng, `users.avatar_url` và bảng `google_auth_tickets` lưu hash vé ngắn hạn. Migration không đổi hoặc xóa mật khẩu, tài khoản, vai trò hay dữ liệu hiện có.

## Thử đăng nhập

1. Mở `/login`, bấm **Tiếp tục với Google** và chọn tài khoản Google có trong test users nếu consent screen đang ở chế độ Testing.
2. Tài khoản email mới sẽ được tạo với quyền `user`. Đăng xuất rồi đăng nhập lại để kiểm tra liên kết theo Google subject ổn định.
3. Với email đã tồn tại trên WorkRank nhưng chưa liên kết Google, nhập mật khẩu WorkRank cũ ở màn hình xác minh. Mật khẩu sai không liên kết tài khoản; thành công giữ nguyên ID, quyền, tên, avatar và dữ liệu hiện hữu.
4. Tài khoản WorkRank bị khóa vẫn bị chặn theo kiểm tra trạng thái hiện tại. JWT mới được lưu/refresh theo cơ chế phiên hiện có; nút đăng xuất hiện có tiếp tục thu hồi phiên và ngắt socket.

Nếu thiếu bất kỳ biến Google nào, nút sẽ đưa người dùng về WorkRank với thông báo cấu hình còn thiếu và không giả lập đăng nhập.
