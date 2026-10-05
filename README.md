# WorkRank Realtime

WorkRank quản lý KPI công việc, thi đua theo mùa và giải năm, số liệu YouTube, đội nhóm, hồ sơ nhân viên và trò chơi nội bộ. React/Vite cung cấp giao diện web; Express, Sequelize và Socket.IO xử lý API, dữ liệu và cập nhật thời gian thực.

Activity Tracking, Desktop Tracker và Pomodoro đã được gỡ khỏi hệ thống. Các route tương thích còn lại chỉ chuyển hướng về các trang hiện hành. Không cần cài Electron hay phần mềm đếm phím/chuột để chạy dự án.

## Kiến Trúc Và Trang Chính

| Nghiệp vụ | Trang sở hữu |
|---|---|
| KPI bản thân và tổng quan công việc | `/dashboard` |
| BXH KPI, cá nhân, đội, YouTube và vinh danh | `/leaderboard` |
| Phân tích YouTube, chi tiết đội và so sánh đội | `/youtube` |
| Mùa giải: luật, thử thách, tiến độ | `/arena` |
| Giải năm: Grand Points, timeline, hành trình đội | `/grand` |
| Danh bạ và đội nhóm | `/friends` |
| Hồ sơ, thành tích và gallery | `/users/:id` |
| Hồ sơ bản thân, email, mật khẩu và tùy chọn | `/settings` |
| Nhân sự, quyền và vinh danh thủ công | `/admin/privileges` |
| Đội, thành viên đội và kênh YouTube | `/admin/teams-youtube` |
| Phòng ban, kỳ, định nghĩa/kết quả và benchmark Production KPI | `/admin/kpi` |
| Mùa giải, spotlight và archive | `/admin/competition/seasons` |
| Quy tắc, phiên bản và mô phỏng tính điểm | `/admin/competition/rules` |
| Quản trị giải năm | `/admin/competition/grand` |
| Health, audit, sự kiện và dựng lại projections | `/admin/operations` |
| Catalog và game nội bộ | `/games` và `/games/<game>` |

Dashboard và trang giải chỉ giữ summary/preview và CTA tới trang sở hữu. BXH game và kết quả trận chơi có thước đo riêng, không phải BXH KPI hoặc điểm thi đua.

Đọc [báo cáo kiến trúc thông tin](docs/ux/INFORMATION_ARCHITECTURE_AUDIT.md) để xem toàn bộ route/alias, phân loại page, ownership, bằng chứng code, cấu trúc menu và các rủi ro dữ liệu/quyền còn cần xử lý. Trước khi sửa UI, tuân theo [AGENTS.md](AGENTS.md) và [smooth-motion](.agents/skills/smooth-motion/SKILL.md).

## Chạy Cục Bộ

Yêu cầu Node.js 20 đến 25 và MySQL 8. Backend hỗ trợ SQLite trong các test được cấu hình cho SQLite.

Backend:

```bash
cd backend
npm install
cp .env.example .env
# Điền thông tin DB và thay các secret mặc định trong .env.
npm run db:migrate
# Tùy chọn: tạo dữ liệu mẫu và admin theo SEED_ADMIN_* trong .env.
npm run db:seed
npm run dev
```

Backend mặc định ở `http://localhost:5001`. Thông tin tài khoản seed lấy từ `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`; không coi ví dụ trong `.env.example` là cấu hình production.

Frontend, trong terminal khác:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend mặc định ở `http://localhost:5173`. `VITE_API_URL` để trống sẽ dùng proxy Vite tới backend cục bộ; deployment tách frontend/backend cần cấu hình URL và CORS tương ứng.

## Kiểm Tra

```bash
cd frontend
npm run check
npm run build
npm run test:routes
npm run test:e2e
```

Playwright kiểm Chromium desktop và Pixel 5. Các test `information-architecture.spec.js`, `account-ownership.spec.js`, `operations-ownership.spec.js` và `public-data-ownership.spec.js` mock auth/API để xác minh route, query, ownership và bố cục mà không tạo/xóa dữ liệu thật. Có thể dùng `E2E_BASE_URL=http://127.0.0.1:5173` khi dev server đang chạy. Dùng `--output` ở ngoài repository để tránh ghi đè ảnh test đã được theo dõi trong Git.

```bash
cd backend
npm test
```

Đọc cấu hình từng test trước khi chạy với DB thực. Các test giao diện mock API không chứng minh công thức tính điểm hoặc quyền backend đã đúng; các vấn đề đó được ghi riêng trong báo cáo kiến trúc thông tin.

## Cấu Trúc

```text
workrank-realtime/
├── backend/
│   ├── src/controllers, routes, services, models, sockets
│   ├── migrations/
│   └── test/
├── frontend/
│   ├── src/config/       # Navigation và query canonical
│   ├── src/components/   # Layout và UI dùng chung
│   ├── src/context/      # Auth và UI state
│   ├── src/pages/        # Trang đang mount trong App.jsx
│   ├── src/services/     # API, cache và Socket.IO
│   └── e2e/
└── docs/                 # Audit, cleanup và vận hành
```

Tài liệu vận hành nằm trong `backend/docs/ops/`. Các tài liệu audit cũ phản ánh thời điểm viết; đối chiếu route đang mount và service hiện tại trước khi dùng chúng để thiết kế thêm chức năng.
