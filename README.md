# Work-rank Realtime

WorkRank Realtime đo hoạt động làm việc theo thời gian thực với backend privacy-first, anti-cheat, desktop tracker và dashboard quản trị.

## Trạng thái hiện tại

- Backend mới đã được merge vào repo app thật.
- Backend chạy mặc định ở `http://localhost:5001`.
- Frontend dùng `VITE_API_URL=http://localhost:5001`.
- Desktop app dùng contract mới: `session/start` → lưu `deviceSecret` bằng Electron `safeStorage` → ký HMAC → gửi `/api/activity/batch`.
- Security dashboard có anomaly summary + device revoke/restore.
- Backend cũ được sao lưu ở `backend-legacy/`.

## Chạy nhanh

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Admin seed mặc định:

- Email: `admin@workrank.local`
- Password: `Admin@123456`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Mở `http://localhost:5173`.

### 3. Desktop app

```bash
cd desktop-app
cp .env.example .env
npm install
npm run dev
```

macOS cần cấp Accessibility để global keyboard/mouse hook hoạt động.

## Env chính

Root `.env.example` có đủ biến cho backend/frontend/desktop.

Backend:

- `PORT=5001`
- `CLIENT_URL=http://localhost:5173`
- `DB_NAME=workrank_realtime`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`

Frontend:

- `VITE_API_URL=http://localhost:5001`
- `VITE_SOCKET_URL=http://localhost:5001`

Desktop:

- `API_URL=http://localhost:5001`
- `WORKRANK_EMAIL=admin@workrank.local`
- `WORKRANK_PASSWORD=Admin@123456`
- `WORKRANK_DEVICE_UUID`
- `WORKRANK_DEVICE_NAME`

## Anti-cheat

Backend không tin số liệu do client gửi lên.

- Device phải pair qua `/api/activity/session/start`.
- Server trả `deviceSecret`, desktop lưu bằng secure storage.
- Batch gửi `/api/activity/batch` phải có HMAC signature.
- `events[].sequence` bắt buộc tăng dần để chống replay.
- Event nghi vấn vẫn lưu audit nhưng không cộng vào stats/ranking.

Các flags chính:

- `untrusted_signature`
- `missing_sequence`
- `replayed_or_old_sequence`
- `high_click_rate`
- `clicks_without_mouse_movement`
- `click_only_streak`
- `robotic_repeated_click_pattern`
- `baseline_click_rate_spike`
- `baseline_key_rate_spike`

## Security APIs

- `GET /api/security/anomalies?days=1`
- `GET /api/security/devices?includeRevoked=true`
- `POST /api/security/devices/:id/revoke`
- `POST /api/security/devices/:id/restore`
- `GET /api/security/users/:userId/baseline?days=7`

Frontend có trang `/security` để xem anomaly và revoke/restore device.

## Tests

```bash
npm test
npm run build
```

Hoặc chạy riêng:

```bash
npm --prefix backend test
npm --prefix backend run test:anti-cheat
npm --prefix frontend run build
```

## Bảo mật & riêng tư

- Không lưu nội dung phím.
- Không chụp màn hình.
- Không lưu clipboard.
- Refresh token lưu hash phía backend.
- Activity endpoint có HMAC, sequence, rate limit.
- Backend dùng Helmet, rate limit, request logging.

## Ghi chú

`backend-legacy/` chỉ để tham khảo/rollback. Không nên chạy song song backend cũ vì `/api/activity/ping` cũ có thể bypass anti-cheat.
