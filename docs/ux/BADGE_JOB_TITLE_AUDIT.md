# WORKRANK — BADGE, TITLE & RECOGNITION AUDIT AND SPECIFICATION

> **Phiên bản:** 1.0.0 (Production Release)  
> **Phạm vi:** `/settings`, `/users/:id`, `/admin/privileges`, Backend Models, RBAC & Audit Trails  
> **Mục tiêu:** Chuẩn hóa hệ thống định danh nhân sự nội bộ chuyên nghiệp; loại bỏ 100% badge game hóa cũ (Level, XP, Streak, VIP ảo); thiết lập 4 Huy hiệu chính thức và Phân định rõ ràng giữa **Chức danh nghề nghiệp (Job Title)** và **Huy hiệu vinh danh (Recognition Badges)**.

---

## 1. TỔNG QUAN VẤN ĐỀ VÀ ĐỊNH HƯỚNG THIẾT KẾ

### 1.1. Vấn đề của hệ thống cũ
- Hệ thống cũ mang tư duy game hóa không phù hợp với môi trường doanh nghiệp thực tế: các huy hiệu ảo như *Thành viên VIP, Nhà sáng lập, Đối tác WorkRank, Người nổi bật, EXP/Level* gây nhiễu loạn thông tin nhân sự.
- Nhập nhằng giữa **Chức danh công việc** (Job Title: Trưởng phòng, Editor, Quản lý kênh...) và **Huy hiệu/Danh hiệu** (Badges).
- Thiếu cơ chế kiểm soát phân quyền (RBAC): người dùng thường có thể tự sửa chức danh hoặc tự gán quyền đặc quyền.
- Thiếu lịch sử vinh danh bất biến (Audited Recognition History): khi thành viên vô địch nhiều mùa giải hoặc đạt MVP, dữ liệu không được lưu trữ có cấu trúc theo mùa giải.

### 1.2. Định hướng chuẩn hóa WorkRank Enterprise
1. **Chỉ giữ 2 Huy hiệu cơ sở:**
   - `✅ Verified / Đã xác minh`: Xác thực tài khoản nhân sự chính thức và quyền hạn.
   - `🛠 Developer / Dev Team`: Xác nhận thành viên đội ngũ phát triển và kỹ thuật hệ thống.
2. **Thêm 2 Huy hiệu thành tích chính thức:**
   - `🏆 CHAMPION / Vô địch giải đấu`: Cấp tự động khi đóng băng giải đấu (`SeasonFrozenResult` / `GrandFrozenResult`) hoặc Admin trao tặng.
   - `⭐ MVP / Nhân viên xuất sắc`: Trao tặng theo mùa giải/sự kiện bởi Ban Giám Đốc/Admin kèm căn cứ vinh danh.
3. **Chức danh nghề nghiệp (JOB TITLE - NOT A BADGE):**
   - Quản lý độc lập tại trường `jobTitle` & `department`.
   - Phân cấp rõ ràng với RBAC: Member chỉ xem read-only; chỉ Admin/authorized role mới có quyền điều chỉnh kèm ghi nhận Audit Log.

---

## 2. BẢNG MA TRẬN 4 HUY HIỆU CHÍNH THỨC

| Huy hiệu | Mã nhận diện | Biểu tượng | Tiêu chí cấp phát | Phân quyền cấp / Quản lý | Vị trí hiển thị |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Đã xác minh** | `verified` | `BadgeCheck` (Sky Blue `#0284c7`) | Tài khoản nhân sự chính thức đã xác thực danh tính | Admin cấp/thu hồi | Header, Card hồ sơ, Bảng xếp hạng, Settings |
| **Developer** | `dev` | `Code` / `Terminal` (Cyan `#0891b2`) | Kỹ sư kỹ thuật, phát triển và vận hành hệ thống WorkRank | Admin cấp/thu hồi | Hero profile, Settings, Danh sách nhân sự |
| **Vô địch (Champion)** | `champion` | `Trophy` (Gold `#d97706`) | Quán quân cá nhân / đội nhóm mùa giải hoặc Grand Championship | Tự động khi freeze giải đấu hoặc Admin trao | Hero profile (kèm số cúp `xN`), Tab Overview, Settings |
| **Nhân viên xuất sắc (MVP)** | `mvp` | `Star` / `Sparkles` (Purple `#7c3aed`) | Đạt thành tích đóng góp vượt bậc, KPI xuất sắc theo mùa/sự kiện | Admin / Ban Giám Đốc trao thưởng kèm lý do | Hero profile (kèm số lần `xN`), Tab Overview, Settings |

---

## 3. PHÂN ĐỊNH RÕ: JOB TITLE vs RBAC ROLE vs RECOGNITION

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             NHÂN SỰ WORKRANK                                │
├─────────────────────────┬─────────────────────────┬─────────────────────────┤
│    JOB TITLE (Vị trí)   │    RBAC ROLE (Quyền)    │  RECOGNITION (Huy hiệu) │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Nhân viên             │ • user                  │ • [✅ Verified]         │
│ • Editor                │ • manager               │ • [🛠 Developer]        │
│ • Content Creator       │ • admin                 │ • [🏆 Champion x2]      │
│ • Quản lý kênh YouTube  │                         │ • [⭐ MVP x3]           │
│ • Trưởng phòng          │                         │                         │
│ • Phó giám đốc          │                         │                         │
│ • Giám đốc              │                         │                         │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

- **Job Title (Chức danh công tác):** Phản ánh vai trò chuyên môn và trách nhiệm nghiệp vụ thực tế trong tổ chức.
- **RBAC Role (Phân quyền hệ thống):** Quyết định quyền truy cập dữ liệu và thao tác kỹ thuật (`admin`, `manager`, `user`).
- **Recognition (Huy hiệu & Vinh danh):** Thành tích và đặc quyền được kiểm toán, lưu trữ tại bảng `user_recognitions`.

---

## 4. CẤU TRÚC DỮ LIỆU & KIẾN TRÚC BACKEND

### 4.1. Bảng `users`
- `is_dev` (`BOOLEAN DEFAULT FALSE`): Xác định huy hiệu Developer.
- `is_verified` (`BOOLEAN DEFAULT FALSE`): Xác định huy hiệu Verified.
- `job_title` (`VARCHAR(120)`): Vị trí công tác thực tế.
- `department` (`VARCHAR(120)`): Phòng ban trực thuộc.

### 4.2. Bảng `user_recognitions`
Lưu trữ toàn bộ giải thưởng MVP và Champion lịch sử:
```sql
CREATE TABLE `user_recognitions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `award_type` ENUM('champion', 'mvp') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `season_id` INT NULL,
  `grand_id` INT NULL,
  `reason` TEXT NULL,
  `awarded_by` INT NULL,
  `awarded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `metadata` JSON NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  INDEX `idx_user_recognitions_user_award` (`user_id`, `award_type`),
  INDEX `idx_user_recognitions_season` (`season_id`),
  INDEX `idx_user_recognitions_grand` (`grand_id`)
);
```

### 4.3. Audit Trail (`competition_audit_logs`)
Mọi thao tác quản trị đều được ghi vết với các action chuẩn:
- `JOB_TITLE_CHANGED`: Thay đổi chức danh / phòng ban của nhân viên.
- `VERIFIED_GRANTED` / `VERIFIED_REVOKED`: Cấp hoặc gỡ tích xanh.
- `DEV_BADGE_GRANTED` / `DEV_BADGE_REVOKED`: Cấp hoặc gỡ huy hiệu Developer.
- `MVP_AWARDED` / `MVP_REVOKED`: Trao hoặc thu hồi giải thưởng MVP.
- `CHAMPION_AWARDED`: Trao danh hiệu Vô địch giải đấu.

---

## 5. BẢO MẬT & PHÂN QUYỀN (RBAC ENFORCEMENT)

1. **Member Thường (`role: user`):**
   - Chỉ được cập nhật thông tin cá nhân: `name`, `bio`, `phone`, `avatarData`.
   - Bị từ chối HTTP **403 Forbidden** nếu cố tình can thiệp vào `jobTitle`, `department`, `teamId`, `role`, `isDev`, `isVerified`.
2. **Admin (`role: admin`):**
   - Được phép gán và điều chỉnh chức danh, phòng ban.
   - Cấp/thu hồi tích xanh và huy hiệu Dev.
   - Trao giải thưởng MVP và Champion trực tiếp từ Settings hoặc trang Quản trị định danh (`/admin/privileges`).
3. **Competition Engine Integration:**
   - Khi gọi hàm `freezeSeasonResult(seasonId)`, hệ thống tự động kích hoạt `syncSeasonChampionRecognitions(seasonId)` để vinh danh Quán quân cá nhân và Quán quân đội nhóm vào bảng `user_recognitions`.

---

## 6. GIAO DIỆN NGƯỜI DÙNG (UX/UI REDESIGN)

### 6.1. Cài Đặt (`/settings`)
- **Hero Banner:** Hiển thị tên, avatar, chức danh, phòng ban, vai trò RBAC và hàng huy hiệu chính thức.
- **Khối 1: Thông tin cá nhân:** Chỉnh sửa họ tên, email, số điện thoại, tiểu sử trách nhiệm công việc.
- **Khối 2: Chức danh & Tổ chức:** Hiển thị vị trí công tác, phòng ban, đội nhóm (Read-only cho Member, Admin có bộ công cụ điều chỉnh nhanh).
- **Khối 3: Huy hiệu & Lịch sử vinh danh:** Hiển thị 4 thẻ huy hiệu chính thức (Verified, Dev, Champion, MVP) kèm timeline các giải thưởng đã đạt được. Admin có nút "Trao giải MVP / Champion" nhanh.
- **Khối 4: Bảo mật & Đổi mật khẩu:** Cập nhật mật khẩu bảo mật tài khoản.
- **Khối 5-7: Tùy chọn:** Thông báo thi đấu, âm thanh, giao diện (thoáng/gọn, giảm chuyển động, tăng tương phản), dữ liệu trình duyệt và liên kết nhanh.

### 6.2. Hồ Sơ Cá Nhân (`/users/:id`)
- **Hero Profile:** Hiển thị 6 khung ảnh hoạt động rộng rãi gốc, ảnh đại diện, tích xanh và các tag `[🛠 DEV]`, `[🏆 CHAMPION (xN)]`, `[⭐ MVP (xN)]`.
- **Tab 1 (Tổng quan nhân sự):** Hiển thị thẻ 4 huy hiệu chính thức kèm danh sách chi tiết các mùa giải/sự kiện đã được vinh danh.
- **Modal Chỉnh Sửa:** Phân quyền rõ ràng giữa chỉnh sửa cá nhân và quyền quản trị Admin (Role, Status, Verified, Dev).

### 6.3. Quản Trị Định Danh (`/admin/privileges`)
- Bảng quản trị tập trung hiển thị danh sách nhân sự.
- Lọc theo: Tất cả, Có tích xanh, Developer, Chưa định danh.
- Nút thao tác một chạm: Cấp/Gỡ Tích Xanh, Cấp/Gỡ Dev, Trao MVP (kèm form modal), Trao Cúp Vô Địch, Sửa chức danh & phòng ban.

---

## 7. KẾT QUẢ KIỂM THỬ (VERIFICATION)

- **E2E Test Suite (`backend/test/badge_job_title_recognition_e2e.test.js`):** **10/10 PASS (100%)**
  - Member 403 rejection on unauthorized privilege modification.
  - Member personal info update (name, bio, phone).
  - Admin Job Profile update + audit log `JOB_TITLE_CHANGED`.
  - Admin Verified & Dev badge toggles + audit logs.
  - Admin MVP award + audit log `MVP_AWARDED`.
  - Admin Champion award + audit log `CHAMPION_AWARDED`.
  - `GET /api/users/:id/recognitions` returns standardized 4-badge response + awards history.
  - Admin MVP revoke + audit log `MVP_REVOKED`.
  - Automated Champion granting upon season freeze.
- **Frontend Build (`npm --prefix frontend run build`):** **0 errors, build thành công trong 1.84s.**
