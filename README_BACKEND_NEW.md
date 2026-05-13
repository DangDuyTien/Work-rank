# WorkRank Realtime

Hệ thống đo hoạt động làm việc theo thời gian thực, ưu tiên riêng tư: chỉ lưu số lượng tương tác, thời gian active/idle, session và thống kê tổng hợp; không lưu nội dung phím, clipboard hay ảnh màn hình.

## Trạng thái hiện tại

Backend MVP đã có:

- Express API + Socket.io gateway.
- Sequelize + MySQL config, models, migrations, seed admin.
- JWT access token + refresh token hash.
- Auth API: register/login/logout/me/refresh-token.
- Activity API: start/end session, ingest event/batch, stats hôm nay.
- Dashboard/leaderboard/reports API cơ bản.
- Socket rooms theo user/team/dashboard.

Frontend và desktop app sẽ triển khai sau khi backend contract ổn định.

## Cấu trúc

```txt
workrank-realtime/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   ├── migrations/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── seeders/
│   │   ├── services/
│   │   ├── sockets/
│   │   └── utils/
│   ├── .env.example
│   └── package.json
├── frontend/
├── desktop-app/
└── PROJECT_AUDIT_AND_IMPROVEMENT_PLAN.md
```

## Chạy backend

### 1. Chuẩn bị MySQL

Tạo database:

```sql
CREATE DATABASE workrank_realtime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Cài dependencies

```bash
cd backend
npm install
```

### 3. Tạo `.env`

```bash
cp .env.example .env
```

Sửa các biến quan trọng:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
- `CLIENT_URL`

### 4. Chạy migration + seed

```bash
npm run db:migrate
npm run db:seed
```

Tài khoản seed mặc định:

- Email: `admin@workrank.local`
- Password: `Admin@123456`

Đổi trong `.env` trước khi seed nếu cần.

### 5. Khởi động server

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:5001/api/health
```

## API chính

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh-token`

### Activity

- `POST /api/activity/session/start`
- `POST /api/activity/session/end`
- `POST /api/activity/events`
- `POST /api/activity/batch`
- `GET /api/activity/me/today`

Payload batch ví dụ:

```json
{
  "deviceUuid": "device-uuid",
  "deviceName": "Quynh MacBook",
  "platform": "macos",
  "sessionId": 1,
  "events": [
    {
      "timestamp": "2026-05-10T10:00:00.000Z",
      "activeSeconds": 10,
      "idleSeconds": 0,
      "keystrokeCount": 25,
      "mouseClickCount": 8,
      "mouseMoveCount": 120
    }
  ]
}
```

### Dashboard/leaderboard/reports

- `GET /api/dashboard/overview`
- `GET /api/dashboard/realtime-users`
- `GET /api/leaderboard/daily`
- `GET /api/leaderboard/weekly`
- `GET /api/leaderboard/monthly`
- `GET /api/reports/export.csv`

## Socket.io

Client gửi token qua `auth.token` khi connect.

Server phát:

- `dashboard:overview:update`
- `leaderboard:update`
- `user:status:update`
- `activity:user:update`
- `system:notification`

Client có thể gửi:

- `activity:heartbeat`
- `user:status`

## Riêng tư & bảo mật

- Không lưu ký tự người dùng gõ.
- Không chụp màn hình mặc định.
- Không lưu clipboard hoặc nội dung tài liệu/website.
- Token refresh chỉ lưu dạng hash trong DB.
- Activity endpoint validate input, giới hạn batch tối đa 500 events.

## Anti-cheat / fraud detection

Backend không tin số liệu do frontend/desktop gửi lên một cách tuyệt đối.

### Device secret

Khi gọi `POST /api/activity/session/start` lần đầu với `deviceUuid` mới, server trả thêm `deviceSecret`. Desktop app phải lưu secret này trong secure storage/keychain. Server chỉ lưu hash tại `devices.device_secret_hash`.

### Ký HMAC cho batch

`POST /api/activity/batch` hỗ trợ các field chống giả mạo:

- `deviceSecret`: secret của thiết bị, chỉ gửi qua HTTPS.
- `signature`: HMAC-SHA256 của payload canonical sau khi bỏ `deviceSecret` và `signature`.
- `events[].sequence`: số tăng dần để chống replay/lặp batch.

Nếu `signature` sai, thiếu hoặc sequence cũ, event bị tăng `suspicion_score`. Event có `suspicion_score >= 60` không được cộng vào active/click/key stats.

### Rule phát hiện auto-click

Backend gắn flags vào `activity_events.flags_json` khi thấy dấu hiệu bất thường:

- `untrusted_signature`
- `clock_skew`
- `replayed_or_old_sequence`
- `high_click_rate`
- `high_key_rate`
- `high_mouse_move_rate`
- `clicks_without_mouse_movement`
- `active_without_input`

Dashboard overview trả thêm `suspiciousEventsToday` để admin theo dõi số event nghi vấn trong ngày.

### Lưu ý bảo mật

Không thể chống gian lận 100% nếu người dùng kiểm soát máy client. Thiết kế hiện tại tập trung vào: verify nguồn gửi, chống replay, phát hiện pattern auto-click, loại event nghi vấn khỏi thống kê/ranking, và không dùng click/phím làm chỉ số chính.

### Auto-click chậm / đều

Ngoài tốc độ cao, backend còn theo dõi state theo thiết bị để bắt bot click chậm nhưng đều:

- `devices.last_event_at`
- `devices.last_click_count`
- `devices.last_active_seconds`
- `devices.repeated_click_pattern_count`
- `devices.click_only_streak_count`

Nếu nhiều batch liên tiếp chỉ có click, không có key/mouse move, hoặc lặp cùng số click/cùng duration theo interval ổn định, event sẽ bị flag:

- `click_only_event`
- `robotic_repeated_click_pattern`
- `repeated_click_pattern_streak`
- `click_only_streak`

Ví dụ auto-click chậm `3 clicks / 10s` nhưng lặp liên tục sẽ bị tăng `suspicion_score` và bị loại khỏi thống kê sau vài batch.

### Siết kiểm tra device/sequence

- `/api/activity/batch` chỉ nhận dữ liệu từ device đã pair qua `/api/activity/session/start`; batch từ device chưa pair trả `403 Device not paired`.
- `events[].sequence` là bắt buộc và phải tăng dần theo từng device.
- Sequence cũ, lặp hoặc đảo thứ tự trong cùng batch bị flag `replayed_or_old_sequence` và không được cộng vào stats/ranking.

## Security admin APIs

Các API này dành cho admin/manager để xử lý gian lận và thiết bị rủi ro.

- `GET /api/security/devices?includeRevoked=true` — danh sách thiết bị, trạng thái revoked, user sở hữu.
- `POST /api/security/devices/:id/revoke` — revoke device; mọi batch sau đó bị chặn `403 Device revoked`.
- `POST /api/security/devices/:id/restore` — khôi phục device bị revoke.
- `GET /api/security/anomalies?days=1` — tổng hợp anomaly theo thời gian, flag counts, top devices nghi vấn.
- `GET /api/security/users/:userId/baseline?days=7` — baseline 7 ngày/user.

### Baseline 7 ngày

Backend tính baseline từ `daily_stats` 7 ngày gần nhất:

- active days
- avg active/idle seconds
- avg keystrokes/clicks
- avg key/click rate theo active second

Khi đủ tối thiểu 3 ngày baseline, batch có key/click rate tăng bất thường nhiều lần so với baseline sẽ bị flag:

- `baseline_click_rate_spike`
- `baseline_key_rate_spike`

### Secure storage desktop

Desktop app không được lưu `deviceSecret` trong localStorage/plain JSON. Khi nối desktop với backend mới, lưu secret bằng secure storage/keychain theo OS:

- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service/libsecret

Nếu nghi ngờ `deviceSecret` lộ, admin gọi `POST /api/security/devices/:id/revoke` để chặn thiết bị đó ngay.
