# 📊 WorkRank Realtime

WorkRank là một hệ thống giám sát hiệu suất và theo dõi hoạt động làm việc thời gian thực (Real-time Activity Tracking) đa nền tảng. Hệ thống cho phép đo lường số lần gõ phím, click chuột, và thời gian làm việc để đánh giá năng suất của nhân viên một cách minh bạch.

![WorkRank Overview](https://img.shields.io/badge/Status-Active-success)
![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-blue)

---

## 🏗 Kiến trúc Hệ thống

Dự án được chia làm 3 thành phần chính hoạt động đồng bộ với nhau:

1. **🌐 Web Frontend (`/frontend`)**: Giao diện quản lý, Dashboard, Leaderboard và màn hình điều khiển Tracker. Web không tự đếm phím/click để tránh đếm trùng.
2. **🖥️ Desktop App (`/desktop-app`)**: Nguồn tracking duy nhất, theo dõi hoạt động toàn hệ thống (bắt phím/chuột trong cả trình duyệt và app khác). Xây dựng bằng Electron + uIOhook.
3. **⚙️ Backend API (`/backend`)**: Xử lý logic, lưu trữ dữ liệu, và quản lý kết nối Socket.IO. Xây dựng bằng Node.js + Express + Sequelize (MySQL).

---

## ✨ Tính năng Nổi bật

- **⚡ Real-time Sync**: Trạng thái người dùng (Online/Offline/Idle) và dữ liệu hoạt động được cập nhật theo thời gian thực trên toàn hệ thống thông qua Socket.IO.
- **🔄 Desktop-only Tracking**: Web chỉ bật/tắt và hiển thị trạng thái, Desktop Tracker là nguồn duy nhất gửi activity lên backend.
- **🚀 Auto-launch Desktop Tracker**: Web có khả năng nhận diện trạng thái của Desktop App. Khi bật tracking trên Web, Desktop App sẽ tự động khởi chạy và đồng bộ.
- **🛡 Cơ Chế Chống Gian Lận (Anti-cheat)**: Activity batch từ Desktop được ký mã hóa bằng **HMAC SHA-256** để chống giả mạo payload, kết hợp với sequence number chống Replay Attack.
- **🏆 Bảng Xếp Hạng (Leaderboard)**: Xếp hạng năng suất nhân viên theo ngày, tuần, tháng hoặc theo nhóm (Teams).

---

## 🚀 Hướng dẫn Cài đặt & Chạy dự án

### 1. Yêu cầu hệ thống
- Node.js (v18 trở lên)
- MySQL (v8.0 trở lên)
- macOS/Windows/Linux (Để biên dịch Desktop App)

### 2. Thiết lập Backend
```bash
cd backend
npm install

# Đổi tên .env.example thành .env và cấu hình DB
cp .env.example .env

# Chạy Migration và Seed dữ liệu mẫu (Tạo tài khoản Admin)
npx sequelize-cli db:migrate
npm run db:seed

# Khởi động Backend (Chạy tại http://localhost:5001)
npm run dev
```
Tài khoản Admin mặc định sau khi seed:
- **Email:** `admin@workrank.local`
- **Password:** `Admin@123456`

### 3. Thiết lập Frontend
```bash
cd frontend
npm install

# Đổi tên .env.example thành .env
cp .env.example .env

# Khởi động Frontend (Chạy tại http://localhost:5173)
npm run dev
```

### 4. Thiết lập Desktop App (Electron)
```bash
cd desktop-app
npm install

# Đăng ký protocol workrank:// để web có thể mở Desktop App trên macOS
npm run install-protocol:mac

# Chạy thử Desktop App trong môi trường dev
npm start
```
*(Lưu ý: Trên macOS, bạn cần cấp quyền Accessibility cho Terminal hoặc ứng dụng để bắt được sự kiện phím/chuột toàn cầu).*

---

## 🔁 Flow Tracking Hiện Tại

1. Người dùng đăng nhập web và bấm **Bắt đầu** ở `/tracker`.
2. Web mở `workrank://start` kèm access token hiện tại, đồng thời gửi socket command nếu Desktop Tracker đang online.
3. Desktop Tracker nhận token, kết nối Socket.IO với `clientType: desktop`, mở session thiết bị và bắt phím/click toàn hệ thống bằng `uiohook-napi`.
4. Desktop gửi activity qua `POST /api/activity/batch` bằng payload có HMAC + sequence.
5. Backend validate thiết bị, chữ ký, sequence, anti-cheat rồi cộng vào `daily_stats`, `work_sessions`, `activity_events`.
6. Backend phát `activity:user:update`, `desktop:status`, `dashboard:overview:update`, `leaderboard:update`; web chỉ nhận và hiển thị.
7. Nếu một tab/build cũ cố gửi activity từ web (`appVersion: web` hoặc `deviceUuid` dạng `web-*`), backend trả `202 ignored` và không cộng số liệu.

---

## 🔌 Cấu trúc Thư mục

```text
workrank-realtime/
├── backend/                  # REST API & Socket.IO Server
│   ├── src/
│   │   ├── controllers/      # Logic xử lý API
│   │   ├── models/           # Database Schema (User, Activity, Device...)
│   │   ├── routes/           # Định tuyến API
│   │   ├── services/         # Logic nghiệp vụ (Anti-cheat, Desktop Status...)
│   │   └── sockets/          # Socket.IO handlers
│   └── package.json
│
├── frontend/                 # React UI
│   ├── src/
│   │   ├── components/       # Các UI Component dùng chung (Layout, Cards...)
│   │   ├── context/          # State toàn cục (AuthContext, TrackingContext)
│   │   ├── pages/            # Dashboard, Leaderboard, Tracker...
│   │   └── services/         # Axios API & Socket client
│   └── package.json
│
└── desktop-app/              # Electron App
    ├── src/
    │   ├── main/             # Tiến trình chính (lắng nghe phím chuột)
    │   └── renderer/         # UI của Desktop App
    └── package.json
```

---

## 🔒 Bảo mật (Security)

Hệ thống được thiết kế với cơ chế bảo mật cao cấp:
1. **JWT Authentication**: Dùng cho mọi API. Có cơ chế Access Token và Refresh Token.
2. **Device Secret & HMAC**: Mỗi thiết bị khi đăng ký tracking sẽ được cấp một `deviceSecret`. Mọi gói dữ liệu (batch) gửi lên đều phải kèm theo chữ ký HMAC được mã hóa từ payload + secret.
3. **Sequence Validation**: Mỗi gói tin có một số thứ tự (sequence) tăng dần liên tục. Backend sẽ từ chối các gói tin có sequence cũ hoặc bị lặp lại.

---

## 🛠 Công nghệ Sử dụng

- **Backend:** Node.js, Express, Socket.IO, Sequelize ORM, Zod (Validation), JSON Web Token.
- **Frontend:** React, Vite, React Router DOM, Socket.IO-client.
- **Desktop:** Electron, `uiohook-napi` (để lắng nghe phím chuột cấp độ OS).
- **Database:** MySQL.

---

*Dự án được xây dựng với mục tiêu cung cấp giải pháp giám sát hiệu suất ổn định và bảo mật cao.*
