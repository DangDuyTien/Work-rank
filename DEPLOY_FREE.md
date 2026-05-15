# Deploy free cho 2 tuần test

Hướng gọn nhất cho dự án này là chạy 1 service Render:

- Render Free Web Service: chạy backend Node, Socket.IO và phục vụ luôn frontend `dist`.
- TiDB Cloud Serverless Free: MySQL-compatible database.
- Không cần domain riêng, dùng URL `*.onrender.com`.

## 1. Tạo DB miễn phí trên TiDB Cloud

1. Vào TiDB Cloud và tạo cluster Serverless/Starter miễn phí.
2. Mở SQL Editor/Chat2Query và tạo database riêng cho app:

```sql
CREATE DATABASE workrank_realtime;
```

Không dùng database `sys` vì đó là database hệ thống của TiDB.

3. Mở phần Connect, chọn MySQL/General.
4. Chọn database `workrank_realtime`.
5. Bấm `Generate Password`, lưu password lại một chỗ riêng vì TiDB chỉ hiện một lần.
6. Lấy các thông tin:
   - host
   - port, thường là `4000`
   - database
   - user
   - password
7. Bật SSL bằng env `DB_SSL=true`.

## 2. Đẩy code lên GitHub

```bash
git add .
git commit -m "chore: prepare free deploy"
git push origin main
```

Nếu branch chính không phải `main`, push đúng branch bạn đang dùng.

## 3. Tạo Render Blueprint

1. Vào Render Dashboard.
2. Chọn `New` -> `Blueprint`.
3. Kết nối repo GitHub `DangDuyTien/Work-rank`.
4. Chọn file `render.yaml`.
5. Nhập các env bị đánh dấu `sync: false`:

```env
DB_HOST=...
DB_PORT=4000
DB_NAME=workrank_realtime
DB_USER=...
DB_PASSWORD=...
```

`JWT_SECRET` và `REFRESH_TOKEN_SECRET` sẽ được Render tự sinh.

## 4. Nếu URL Render khác tên mặc định

File `render.yaml` đang đặt:

```env
CLIENT_URL=https://workrank-duy-tien.onrender.com
```

Nếu Render tạo URL khác, vào Environment của service và đổi `CLIENT_URL` theo URL thật, rồi redeploy.

## 5. Sau khi deploy

Mở:

```text
https://workrank-duy-tien.onrender.com
```

Nếu lần đầu mở hơi chậm là bình thường vì Render Free có cold start.

## 6. Mỗi lần sửa code

```bash
npm run build
npm --prefix backend run lint
git add .
git commit -m "fix: ..."
git push
```

Render sẽ tự build lại. Dữ liệu DB giữ nguyên.
