# WorkRank Realtime - Rà Soát Tổng Thể & Kế Hoạch Cải Tiến

Ngày lập: 10/05/2026  
Phạm vi: toàn bộ dự án `workrank-realtime`

---

## 1. Tóm tắt điều hành

`WorkRank Realtime` đang ở giai đoạn ý tưởng/khởi tạo. Repo hiện mới có `README.md`, `backend/package.json`, `package-lock.json`; chưa có source backend, frontend, desktop app, database schema, API, UI hay luồng realtime hoàn chỉnh.

Định hướng sản phẩm rất rõ: hệ thống đo hoạt động làm việc cá nhân theo thời gian thực, gồm desktop app thu thập chỉ số, backend xử lý/lưu trữ, frontend hiển thị dashboard/leaderboard.

Ưu tiên cải tiến nên đi theo 4 lớp:

1. **Nền tảng kỹ thuật**: scaffold backend/frontend/desktop, chuẩn hóa env, DB, auth, socket.
2. **Chức năng lõi**: tracking phiên làm việc, idle detection, realtime stats, leaderboard, báo cáo ngày/tuần/tháng.
3. **Bảo mật & riêng tư**: không lưu nội dung phím, minh bạch trạng thái tracking, mã hóa token, quyền người dùng rõ ràng.
4. **UI/UX sản phẩm**: dashboard dễ hiểu, onboarding nhanh, desktop tray gọn, trạng thái realtime rõ, mobile responsive.

---

## 2. Hiện trạng dự án

### 2.1 Cấu trúc hiện tại

```txt
workrank-realtime/
├── README.md
└── backend/
    ├── package.json
    └── package-lock.json
```

### 2.2 Stack đã định hướng

- Backend: Node.js, Express, Socket.io, MySQL, Sequelize.
- Auth: `bcryptjs`, `jsonwebtoken` đã có dependency.
- Frontend: React, Tailwind, React Router, Axios, Socket.io-client, Recharts.
- Desktop: Electron, global keyboard/mouse listener.

### 2.3 Thiếu hiện tại

- Chưa có `backend/src`.
- Chưa có `.env.example`.
- Chưa có DB schema/migration/seed.
- Chưa có API routes.
- Chưa có Socket.io event contract.
- Chưa có frontend.
- Chưa có desktop app.
- Chưa có test/lint/format.
- Chưa có Docker/dev setup.
- Chưa có tài liệu privacy, permission, data retention.

---

## 3. Mục tiêu sản phẩm nên hướng tới

### 3.1 Người dùng chính

- Cá nhân muốn tự đo hiệu suất làm việc.
- Team leader muốn xem mức độ hoạt động tổng quan của team.
- Công ty nhỏ muốn dashboard realtime nhưng vẫn tôn trọng riêng tư.

### 3.2 Giá trị cốt lõi

- Biết ai đang active, idle, offline theo thời gian thực.
- Biết tổng thời gian làm việc, thời gian tập trung, số lần gián đoạn.
- Biết mức độ tương tác máy tính: phím, click, app active theo danh mục nếu cho phép.
- Không theo dõi nội dung nhạy cảm.
- Cung cấp báo cáo rõ ràng để cải thiện thói quen làm việc.

### 3.3 Nguyên tắc riêng tư

- Không lưu ký tự người dùng gõ.
- Không chụp màn hình mặc định.
- Không lưu nội dung clipboard.
- Không ghi nội dung website/tài liệu.
- Desktop app phải hiển thị rõ đang tracking.
- Người dùng có quyền tạm dừng tracking.
- Admin chỉ xem chỉ số tổng hợp, không xem dữ liệu nhạy cảm.

---

## 4. Kiến trúc đề xuất

### 4.1 Tổng quan

```txt
Desktop App (Electron)
  ├─ Count key/click/movement/idle
  ├─ Detect active/idle/offline
  ├─ Send batch events every 5-15s
  └─ Show tray + pause/resume

Backend API (Express)
  ├─ Auth + users + teams
  ├─ Activity event ingestion
  ├─ Aggregation service
  ├─ Realtime Socket.io gateway
  └─ Reports + leaderboard APIs

MySQL
  ├─ users
  ├─ teams
  ├─ devices
  ├─ work_sessions
  ├─ activity_events
  ├─ daily_stats
  └─ app_settings

Frontend Dashboard (React)
  ├─ Realtime overview
  ├─ Leaderboard
  ├─ User detail
  ├─ Reports
  └─ Admin settings
```

### 4.2 Backend folder đề xuất

```txt
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── env.js
│   │   ├── database.js
│   │   └── socket.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Team.js
│   │   ├── Device.js
│   │   ├── WorkSession.js
│   │   ├── ActivityEvent.js
│   │   └── DailyStat.js
│   ├── migrations/
│   ├── seeders/
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── activity.routes.js
│   │   ├── dashboard.routes.js
│   │   └── reports.routes.js
│   ├── controllers/
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── activity.service.js
│   │   ├── aggregate.service.js
│   │   └── leaderboard.service.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validate.middleware.js
│   ├── sockets/
│   │   ├── index.js
│   │   └── activity.socket.js
│   └── utils/
├── .env.example
└── package.json
```

### 4.3 Frontend folder đề xuất

```txt
frontend/
├── src/
│   ├── app/
│   │   ├── router.jsx
│   │   └── providers.jsx
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   └── charts/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── leaderboard/
│   │   ├── users/
│   │   ├── reports/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   │   ├── api.js
│   │   └── socket.js
│   └── styles/
└── .env.example
```

### 4.4 Desktop app folder đề xuất

```txt
desktop-app/
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── renderer/
│   ├── services/
│   │   ├── tracker.service.js
│   │   ├── idle.service.js
│   │   ├── sync.service.js
│   │   └── auth.service.js
│   ├── store/
│   └── tray/
├── assets/
├── .env.example
└── package.json
```

---

## 5. Database schema đề xuất

### 5.1 `users`

- `id`
- `name`
- `email`
- `password_hash`
- `role`: `admin`, `manager`, `user`
- `team_id`
- `status`: `active`, `inactive`
- `last_seen_at`
- `created_at`, `updated_at`

### 5.2 `teams`

- `id`
- `name`
- `description`
- `created_at`, `updated_at`

### 5.3 `devices`

- `id`
- `user_id`
- `device_uuid`
- `device_name`
- `platform`: `macos`, `windows`, `linux`
- `app_version`
- `last_sync_at`
- `created_at`, `updated_at`

### 5.4 `work_sessions`

- `id`
- `user_id`
- `device_id`
- `started_at`
- `ended_at`
- `duration_seconds`
- `active_seconds`
- `idle_seconds`
- `keystroke_count`
- `mouse_click_count`
- `mouse_move_count`
- `status`: `running`, `ended`, `crashed`
- `created_at`, `updated_at`

### 5.5 `activity_events`

- `id`
- `user_id`
- `device_id`
- `session_id`
- `event_time`
- `active_seconds`
- `idle_seconds`
- `keystroke_count`
- `mouse_click_count`
- `mouse_move_count`
- `metadata_json`
- `created_at`

Lưu ý: bảng này chỉ lưu số lượng, không lưu nội dung phím.

### 5.6 `daily_stats`

- `id`
- `user_id`
- `stat_date`
- `total_seconds`
- `active_seconds`
- `idle_seconds`
- `focus_score`
- `keystroke_count`
- `mouse_click_count`
- `session_count`
- `rank_position`
- `created_at`, `updated_at`

---

## 6. API đề xuất

### 6.1 Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/refresh-token`

### 6.2 Users

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### 6.3 Activity

- `POST /api/activity/events`
- `POST /api/activity/batch`
- `POST /api/activity/session/start`
- `POST /api/activity/session/end`
- `GET /api/activity/me/today`

### 6.4 Dashboard

- `GET /api/dashboard/overview`
- `GET /api/dashboard/realtime-users`
- `GET /api/dashboard/team-summary`
- `GET /api/dashboard/heatmap`

### 6.5 Leaderboard

- `GET /api/leaderboard/daily`
- `GET /api/leaderboard/weekly`
- `GET /api/leaderboard/monthly`
- `GET /api/leaderboard/team/:teamId`

### 6.6 Reports

- `GET /api/reports/users/:id/daily`
- `GET /api/reports/users/:id/weekly`
- `GET /api/reports/users/:id/monthly`
- `GET /api/reports/export.csv`

---

## 7. Socket.io event contract

### 7.1 Client gửi lên

- `desktop:heartbeat`
- `desktop:command`
- `user:status`

### 7.2 Server phát xuống

- `dashboard:overview:update`
- `leaderboard:update`
- `user:status:update`
- `activity:user:update`
- `desktop:status`
- `system:notification`

### 7.3 Payload activity đề xuất

```json
{
  "deviceId": "device-uuid",
  "sessionId": "session-id",
  "timestamp": "2026-05-10T10:00:00.000Z",
  "activeSeconds": 10,
  "idleSeconds": 0,
  "keystrokeCount": 25,
  "mouseClickCount": 8,
  "mouseMoveCount": 120
}
```

---

## 8. Chức năng cần xây dựng/cải tiến

### 8.1 Backend

#### Ưu tiên cao

- Scaffold Express server chuẩn.
- Kết nối MySQL bằng Sequelize.
- Tạo model/migration chính.
- Auth JWT + refresh token.
- Middleware phân quyền.
- API ingest activity batch.
- Socket.io realtime gateway.
- Aggregation daily stats.
- Error handler chuẩn.
- Validate request bằng Zod/Joi.

#### Ưu tiên trung bình

- Rate limit API.
- API pagination/filter/sort.
- Export CSV.
- Audit logs cho admin action.
- Background job aggregate lại dữ liệu.
- Health check endpoint.

#### Ưu tiên thấp

- Multi-tenant/company workspace.
- Webhook tích hợp Slack/Discord.
- Notification rule engine.

### 8.2 Frontend

#### Ưu tiên cao

- Login/register UI.
- Dashboard overview realtime.
- Leaderboard daily/weekly/monthly.
- User detail page.
- Reports page.
- Settings/profile page.
- Socket reconnect indicator.

#### Ưu tiên trung bình

- Date range picker.
- Export report.
- Team filter.
- Dark mode.
- Empty/loading/error states.
- Responsive mobile/tablet.

#### Ưu tiên thấp

- Custom dashboard widgets.
- Goal setting.
- Achievement/badge system.
- AI summary productivity insights.

### 8.3 Desktop app

#### Ưu tiên cao

- Login device.
- Start/stop tracking.
- Tray menu.
- Keystroke count only.
- Mouse click count.
- Idle detection.
- Offline queue.
- Sync retry.
- Visible privacy notice.

#### Ưu tiên trung bình

- Auto-start option.
- App update notification.
- Device pairing code.
- Local encrypted storage.
- Network status indicator.

#### Ưu tiên thấp

- Per-app activity category, chỉ khi user bật.
- Pomodoro/focus mode.
- Break reminder.

---

## 9. UI/UX cải tiến chi tiết

### 9.1 Nguyên tắc thiết kế

- Số liệu quan trọng hiển thị trong 5 giây đầu.
- Realtime nhưng không gây rối mắt.
- Màu trạng thái nhất quán: xanh = active, vàng = idle, xám = offline, đỏ = lỗi.
- Ưu tiên biểu đồ dễ hiểu hơn bảng dài.
- Luôn giải thích chỉ số: active time, idle time, focus score.
- Privacy-first: người dùng luôn biết app đang đo gì.

### 9.2 Dashboard overview

#### Thành phần nên có

- Card tổng quan:
  - Active users now.
  - Total active time today.
  - Average focus score.
  - Idle ratio.
- Realtime status list:
  - Avatar/name.
  - Status active/idle/offline.
  - Last seen.
  - Today active time.
- Chart:
  - Activity timeline theo giờ.
  - Active vs idle stacked bar.
  - Team leaderboard mini.
- Alert/insight:
  - “3 người idle > 30 phút”.
  - “Team đạt 80% mục tiêu hôm nay”.

#### UX cần tránh

- Không dùng quá nhiều số nhỏ khó đọc.
- Không flash realtime liên tục.
- Không biến leaderboard thành áp lực quá mức.
- Không hiển thị dữ liệu gây hiểu nhầm như “số phím cao = làm việc tốt”.

### 9.3 Leaderboard

#### Nên có

- Tab: Daily, Weekly, Monthly.
- Filter team.
- Metric selector:
  - Active time.
  - Focus score.
  - Consistency.
  - Session count.
- Rank change indicator.
- Badge nhẹ: “Most consistent”, “Deep work streak”.

#### Công thức rank đề xuất

Không nên rank chỉ theo phím/click. Nên dùng điểm tổng hợp:

```txt
work_score = active_time_score * 0.45
           + focus_score * 0.35
           + consistency_score * 0.15
           + healthy_break_score * 0.05
```

### 9.4 User detail

#### Nên có

- Profile card.
- Today timeline.
- Active/idle breakdown.
- Session list.
- 7-day trend.
- Personal insights.
- Device info.

#### UX privacy

- Nếu có app/category tracking thì phải có nhãn “Only category, not content”.
- Cho phép user ẩn vài dữ liệu nhạy cảm theo policy.

### 9.5 Reports

#### Nên có

- Date range filter.
- Team/user filter.
- Export CSV.
- Compare period.
- Heatmap theo ngày/giờ.
- Summary cards.

### 9.6 Desktop app UX

#### Tray menu đề xuất

```txt
WorkRank
Status: Tracking
Today: 4h 32m active
Focus score: 82

Pause 15 minutes
Resume tracking
Open Dashboard
Settings
Quit
```

#### Onboarding desktop

1. Welcome + privacy explanation.
2. Login/pair device.
3. Permission request explanation.
4. Test tracking.
5. Start minimized to tray.

#### Trạng thái nên có

- Tracking.
- Paused.
- Offline syncing.
- Permission missing.
- Server disconnected.

---

## 10. Bảo mật & riêng tư

### 10.1 Backend security

- Hash password bằng bcrypt.
- JWT access token ngắn hạn.
- Refresh token lưu hash.
- CORS whitelist theo env.
- Rate limit login/activity endpoints.
- Helmet headers.
- Validate toàn bộ input.
- Không log token/password.
- Soft delete user nếu cần audit.

### 10.2 Desktop security

- Token lưu bằng keychain/secure storage.
- Offline queue mã hóa local.
- Không lưu raw keyboard event.
- Không request permission thừa.
- Auto update ký app nếu build production.

### 10.3 Data governance

- Chính sách retention: activity raw giữ 30-90 ngày.
- Daily summary giữ lâu hơn.
- User có quyền export/delete data nếu là personal app.
- Admin action cần audit log.

---

## 11. Công thức chỉ số đề xuất

### 11.1 Active time

Thời gian có tương tác keyboard/mouse trong cửa sổ thời gian nhất định.

### 11.2 Idle time

Không có input trong ngưỡng, ví dụ 60-180 giây.

### 11.3 Focus score

```txt
focus_score = min(100,
  active_ratio * 60
  + session_continuity * 25
  + healthy_break_score * 15
)
```

### 11.4 Active ratio

```txt
active_ratio = active_seconds / total_tracked_seconds
```

### 11.5 Consistency score

Dựa trên số ngày active đều, không dựa vào cường độ cực đoan.

---

## 12. DevOps & chất lượng code

### 12.1 Nên thêm scripts

Backend:

```json
{
  "dev": "nodemon src/server.js",
  "start": "node src/server.js",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "jest",
  "db:migrate": "sequelize-cli db:migrate",
  "db:seed": "sequelize-cli db:seed:all"
}
```

### 12.2 Nên thêm tooling

- ESLint.
- Prettier.
- Nodemon.
- Jest/Supertest.
- Husky/lint-staged nếu có Git.
- Docker Compose cho MySQL + backend.

### 12.3 Test cần có

- Auth login/register.
- Activity batch ingestion.
- Daily aggregation.
- Leaderboard calculation.
- Socket auth.
- Permission/role middleware.

---

## 13. Roadmap triển khai đề xuất

### Phase 1 - Backend MVP

Mục tiêu: backend chạy được, có auth, DB, nhận activity.

- Tạo `backend/src`.
- Tạo `.env.example`.
- Setup Express + Socket.io.
- Setup Sequelize + MySQL.
- Tạo migrations/models.
- Tạo auth APIs.
- Tạo activity batch API.
- Tạo realtime dashboard events.

Kết quả: desktop/frontend có thể kết nối backend thật.

### Phase 2 - Frontend MVP

Mục tiêu: dashboard xem được dữ liệu realtime.

- Tạo React + Vite + Tailwind.
- Login page.
- Dashboard layout.
- Realtime overview cards.
- Leaderboard.
- User detail.
- Reports basic.

Kết quả: admin/user xem được hoạt động realtime.

### Phase 3 - Desktop MVP

Mục tiêu: app desktop thu thập count và sync.

- Tạo Electron app.
- Login/pair device.
- Global key/click counter.
- Idle detection.
- Offline queue.
- Tray controls.
- Sync batch lên backend.

Kết quả: dữ liệu thật đi từ desktop → backend → dashboard.

### Phase 4 - UX polish & privacy

Mục tiêu: dùng mượt, tin cậy, rõ ràng.

- Onboarding privacy.
- Empty/loading/error states.
- Dark mode.
- Export CSV.
- Role management.
- Settings data retention.
- Desktop permission guide.

### Phase 5 - Nâng cao

- Team/workspace.
- Goal & achievement.
- AI summary.
- Slack/Discord notification.
- Advanced analytics.

---

## 14. Backlog ưu tiên

### P0 - Bắt buộc

- Backend scaffold.
- DB schema.
- Auth.
- Activity ingest.
- Socket realtime.
- Frontend dashboard base.
- Desktop tracker base.
- Privacy-safe tracking.

### P1 - Nên có sớm

- Leaderboard.
- Reports.
- User detail.
- Offline queue.
- Export CSV.
- Rate limit.
- Responsive UI.

### P2 - Sau MVP

- Dark mode.
- Team management.
- Notification.
- Goals.
- Insights.
- Docker.
- Tests đầy đủ.

---

## 15. Rủi ro & cách xử lý

### 15.1 Rủi ro riêng tư

Rủi ro: người dùng sợ bị theo dõi.  
Cách xử lý: minh bạch dữ liệu thu thập, không lưu nội dung phím, có pause/resume, có privacy page.

### 15.2 Rủi ro hiểu sai hiệu suất

Rủi ro: số phím/click bị hiểu là năng suất.  
Cách xử lý: dùng focus score tổng hợp, không rank theo phím/click đơn thuần.

### 15.3 Rủi ro dữ liệu realtime quá nhiều

Rủi ro: DB phình nhanh.  
Cách xử lý: gửi batch 5-15 giây, aggregate daily, retention raw events.

### 15.4 Rủi ro app desktop quyền cao

Rủi ro: OS permission khó cấp, user lo ngại.  
Cách xử lý: onboarding rõ, chỉ request quyền cần thiết, không dùng screenshot/key content.

---

## 16. Đề xuất bước tiếp theo

Bước nên làm ngay: **xây Backend MVP**.

Checklist cụ thể:

1. Tạo `backend/src/server.js` + Express app.
2. Tạo `.env.example`.
3. Setup Sequelize config.
4. Tạo models/migrations: `User`, `Device`, `WorkSession`, `ActivityEvent`, `DailyStat`.
5. Tạo auth register/login/me.
6. Tạo activity batch endpoint.
7. Tạo Socket.io auth + room theo user/team.
8. Tạo dashboard overview endpoint.
9. Tạo seed admin user.
10. Cập nhật README hướng dẫn chạy thật.

Sau khi xong backend, mới dựng frontend + desktop sẽ nhanh và ít phải sửa lại contract.
