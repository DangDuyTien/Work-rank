# BÁO CÁO TOÀN DIỆN: UX/UI AUDIT & TÁI THIẾT HỒ SƠ NHÂN VIÊN (PROFILE REDESIGN)

**Mã tài liệu:** `WR-PROFILE-AUDIT-2026-09-29`  
**Phiên bản:** `3.4.0`  
**Ngày hoàn thiện:** `2026-09-29`  
**Phạm vi áp dụng:** Frontend (React/Vite), Backend (Express/Sequelize), User Model, RBAC, Profile UI Design System  

---

## 1. CURRENT PROFILE AUDIT (KIỂM TOÁN HỒ SƠ CŨ)

Trước khi thực hiện cải tiến, trang Hồ sơ cá nhân (`/users/:id`) của WorkRank gặp phải các vấn đề nghiêm trọng:
- **Tư duy game ảo:** Đặt các chỉ số `Level 27`, `EXP 12,450`, `Animal Level` ("Mèo con", "Thỏ đồng", "Sóc nâu", "Khỉ vàng"), `Tier La Mã` ("Đồng I", "Bạc II", "Huyền thoại"), và `XP Progress Bar` làm trung tâm hồ sơ.
- **Thiếu vị trí công việc thực tế:** Không có cấu trúc chức danh nghề nghiệp (`Job Position`), không có thông tin Phòng ban (`Department`) thực tế.
- **Nhầm lẫn giữa Role và Chức danh:** Lấy `role=admin/user` (vốn chỉ là quyền RBAC hệ thống) để hiển thị thay cho chức danh công việc của nhân viên.
- **Rơi rớt tàn dư Tracking/Pomodoro cũ:** Các thuộc tính đếm phím, đếm click, thời gian active/idle cũ vẫn xuất hiện trong code.

---

## 2. LEGACY EXP/LEVEL/ACHIEVEMENT INVENTORY (DANH MỤC GAMEIFICATION ĐÃ LOẠI BỎ)

| Thành Phần Cũ | Đánh Giá | Biện Pháp Xử Lý |
| :--- | :--- | :--- |
| `EXP` / `Next Level EXP` | Điểm kinh nghiệm ảo kiểu game | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |
| `Level` / `Level Progress Bar` | Cấp độ game ảo (Lv.1 - Lv.200) | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |
| `Animal Levels` ("Mèo con", "Thỏ đồng"...) | Tên linh thú game hóa | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |
| `Rank Tiers` ("Đồng I", "Bạc II", "Huyền thoại") | Bậc xếp hạng game ảo | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |
| `Virtual Achievements` ("Reached Lv.10") | Thành tích ảo không gắn liền công việc | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |
| `DailyStat keystroke/clicks/active time` | Tàn dư của tracker cũ | **XÓA HOÀN TOÀN** khỏi Profile nhân viên |

---

## 3. NEW PROFILE INFORMATION ARCHITECTURE (KIẾN TRÚC THÔNG TIN HỒ SƠ MỚI)

Hồ sơ cá nhân mới được chuẩn hóa theo mô hình nhân sự doanh nghiệp hiện đại:

```mermaid
graph TD
    A["👤 HỒ SƠ NHÂN VIÊN THẬT (/users/:id)"] --> B["HERO BANNER NHÂN SỰ"]
    B --> B1["Avatar + Verified Badge + Status làm việc"]
    B --> B2["Tên Nhân Viên · Vị Trí Công Tác · Phòng Ban · Team"]
    B --> B3["Nút Chỉnh Sửa Hồ Sơ + Nút Thả Tim Đồng Nghiệp"]

    A --> C["TAB 1: TỔNG QUAN NHÂN SỰ"]
    C --> C1["Thông tin công tác: Chức danh, Phòng ban, Team, Email, SĐT, ID"]
    C --> C2["Giới thiệu bản thân & Trách nhiệm chuyên môn (Bio)"]
    C --> C3["Đặc quyền & Ghi nhận công tác: Tích xanh, Dev, VIP, Đối tác..."]

    A --> D["TAB 2: THÀNH TÍCH THI ĐẤU THỰC TẾ"]
    D --> D1["⚔️ Mùa giải hiện tại: Hạng #X · Điểm Season"]
    D --> D2["👑 Grand Championship 2026: Hạng Grand · Grand Points (GP)"]
    D --> D3["🏆 Mùa Vô Địch & 🥇 Top 3 Podiums thực tế"]
    D --> D4["⭐ Danh hiệu MVP Mùa Giải & Phong độ thi đấu"]

    A --> E["TAB 3: NGHIỆP VỤ THEO VAI TRÒ"]
    E --> E1["Editor / Sản Xuất: Video hoàn thành, QC Passed, Xuất bản"]
    E --> E2["Quản Lý Kênh: Kênh YouTube Team, Views, Subs, 30d Growth"]
    E --> E3["Trưởng Phòng / Manager: Quản trị đội ngũ & KPI Đội nhóm"]

    A --> F["TAB 4: LỊCH SỬ MÙA GIẢI & ĐỘI NHÓM"]
    F --> F1["Bảo toàn lịch sử đội nhóm tại thời điểm thi đấu khi chuyển Team"]
```

---

## 4. JOB POSITION MODEL (MÔ HÌNH VỊ TRÍ CÔNG TÁC)

Bổ sung trường `job_title` (`jobTitle`) vào bảng cơ sở dữ liệu `users`:
- **Kiểu dữ liệu:** `VARCHAR(120)`, `defaultValue: 'Nhân viên'`, `allowNull: true`.
- **Các vị trí tiêu biểu hỗ trợ:**
  - `Nhân viên` (General Staff)
  - `Editor` (Biên tập & Dựng video)
  - `Content Creator` (Sáng tạo nội dung)
  - `Quản lý kênh` (Channel Manager)
  - `Trưởng phòng` (Department / Team Manager)
  - `Phó phòng` (Deputy Manager)
  - `Phó giám đốc` (Vice Director)
  - `Giám đốc` (Director / Executive)

---

## 5. DEPARTMENT (PHÒNG BAN)

Bổ sung trường `department` vào bảng cơ sở dữ liệu `users`:
- **Kiểu dữ liệu:** `VARCHAR(120)`, `defaultValue: 'Media & Content'`, `allowNull: true`.
- **Các phòng ban chức năng:**
  - `Media & Content`
  - `Engineering Core`
  - `Community & Growth`
  - `Phòng Sản Xuất Video`
  - `Phòng Truyền Thông`
  - `Phòng Kỹ Thuật`
  - `Ban Giám Đốc`

---

## 6. TEAM (ĐỘI THI ĐẤU & PHÒNG BAN)

- Liên kết thực thể `User.belongsTo(Team, { foreignKey: 'teamId' })`.
- Hiển thị rõ tên Team hiện tại của nhân viên (ví dụ: `Phoenix Squad`, `Dragon Squad`).
- Hiển thị thứ hạng thi đấu của Team trên Bảng Xếp Hạng.

---

## 7. RBAC & PHÂN QUYỀN CHỈNH SỬA (ROLE-BASED ACCESS CONTROL)

Tách biệt hoàn toàn giữa **Quyền hệ thống (System Role)** và **Chức danh công việc (Job Position)**:

| Phân Quyền | Xem Hồ Sơ | Tự Sửa Hồ Sơ Bản Thân | Sửa Hồ Sơ Nhân Viên Khác |
| :--- | :--- | :--- | :--- |
| **Member** | Xem hồ sơ mình & đồng nghiệp (public info) | Chỉ sửa: `name`, `bio`, `phone`, `avatar` | **BỊ CHẶN (403)** |
| **Manager** | Xem hồ sơ mình, đồng nghiệp & đội nhóm | Chỉ sửa: `name`, `bio`, `phone`, `avatar` | **BỊ CHẶN (403)** (trừ quyền xem nâng cao) |
| **Admin** | Xem toàn thể công ty | Sửa toàn bộ | **SỬA TOÀN BỘ:** `jobTitle`, `department`, `teamId`, `role`, `status`, `isVerified`, `name`, `bio`, `phone` |

*Quy tắc an ninh:* Nhân viên thường tuyệt đối không thể tự nâng `role=admin`, tự đổi `jobTitle=Giám đốc`, tự chuyển `teamId` hay tự cấp `isVerified=true`. Mọi hành vi cố tình can thiệp đều bị backend chặn đứng với mã lỗi `403 Forbidden`.

---

## 8. ROLE-SPECIFIC SECTIONS (PHÂN MỤC NGHIỆP VỤ THEO VAI TRÒ)

Tab **"Nghiệp Vụ & Đóng Góp"** tự động điều chỉnh hiển thị theo chức danh và quyền hạn của nhân viên:
- **Editor / Content Creator:** Hiển thị khu vực làm việc sản xuất video, quy trình duyệt kịch bản, dựng và QC passed.
- **Quản lý kênh (Channel Manager):** Hiển thị bảng tổng hợp kênh YouTube của Team (Lượt xem, Đăng ký, Tăng trưởng 30 ngày, Video nổi bật).
- **Trưởng phòng / Manager:** Hiển thị khối quản trị đội nhóm, phân bổ nhiệm vụ và thành tích tập thể.
- **Giám đốc / Admin:** Hiển thị tổng quan vận hành doanh nghiệp.

---

## 9. COMPETITION SUMMARY (TỔNG HỢP THÀNH TÍCH THI ĐẤU THẬT)

Thay vì Level/EXP ảo, hồ sơ hiển thị số liệu từ `CompetitionUserSummary`:
- **Current Season Rank & Points:** Điểm thi đấu mùa giải thực tế.
- **Grand Rank & Grand Points (GP):** Điểm tích lũy vô địch năm.
- **Season Wins:** Số mùa giải giành cúp vô địch.
- **Podium Count:** Số lần lọt vào Top 3 mùa giải.
- **MVP Count:** Số lần đạt danh hiệu cá nhân xuất sắc nhất mùa.
- **Current Streak:** Chuỗi phong độ thi đấu ổn định.

---

## 10. YOUTUBE CONTEXT & TEAM ISOLATION

- Khi nhân viên hoặc quản lý xem hồ sơ của chính mình hoặc đồng đội cùng Team: Trả về số liệu YouTube của Team (`TeamYouTubeSummary`).
- Khi nhân viên xem hồ sơ của nhân viên thuộc **Team khác (Cross-Team)**: Backend **loại bỏ dữ liệu YouTube nội bộ** (`youtubeSummary: null`), đảm bảo tính bảo mật số liệu giữa các phòng ban.
- Khi **Admin** xem hồ sơ: Được quyền xem đầy đủ số liệu YouTube của bất kỳ nhân viên nào.

---

## 11. PRODUCTION CONTEXT (NGHIỆP VỤ SẢN XUẤT)

- Ghi nhận đóng góp vào pipeline nội dung thông qua các Domain Events (`VIDEO_APPROVED`, `SCRIPT_APPROVED`, `VIDEO_QC_PASSED`).
- Không sử dụng các chỉ số theo dõi thời gian hay activity rác cũ.

---

## 12. ACHIEVEMENT MIGRATION (CHUYỂN ĐỔI DANH HIỆU THẬT)

- Xóa bỏ toàn bộ các achievement ảo kiểu game ("Gõ 100 phím", "Đạt Level 5").
- Giữ lại và vinh danh các thành tích công việc thực tế:
  - 🏆 **Season Champion:** Vô địch mùa giải.
  - 👑 **Grand Champion:** Vô địch năm.
  - ⭐ **Top Performer / MVP:** Cá nhân xuất sắc.
  - 🥇 **Podium Top 3:** Top 3 chung cuộc.

---

## 13. REMOVED LEGACY GAMEIFICATION (DANH SÁCH THÀNH PHẦN ĐÃ XÓA)

- Đã xóa toàn bộ logic tính toán `Animal levels`, `ROMAN tiers`, `EXP Progress bar`, `Next level thresholds`.
- Đã dọn dẹp các hằng số màu sắc linh thú và bảng cấp bậc giả trong frontend.

---

## 14. TRACKING/POMODORO VERIFICATION (XÁC MINH KHÔNG TÁI TẠO TRACKER)

- Hồ sơ nhân viên mới tuyệt đối **KHÔNG chứa**:
  - Keyboard tracking / Clicks counter
  - Active time / Idle time tracking
  - Pomodoro focus session / Work sessions
  - Anti-cheat tracking logs

---

## 15. FILES MODIFIED (CÁC TẬP TIN ĐÃ THAY ĐỔI)

1. `backend/src/migrations/20260929150000-add-user-job-profile-fields.js`: Migration thêm `job_title`, `department`, `bio`, `phone`.
2. `backend/src/models/User.js`: Cập nhật schema model User với các trường mới.
3. `backend/src/controllers/users.controller.js`: Cập nhật `getById` (thêm corporate context, team, competition, youtube summary, historical seasons) và `update` (RBAC security).
4. `backend/src/routes/users.routes.js`: Hỗ trợ `PATCH /:id` và `PATCH /:id/profile` với RBAC an toàn.
5. `frontend/src/services/api.js`: Nâng cấp `users.get` và `users.updateProfile`.
6. `frontend/src/pages/UserDetail.jsx`: Viết lại 100% trang hồ sơ nhân sự theo Corporate Profile Design.
7. `backend/test/user_profile_redesign_e2e.test.js`: Bộ test E2E kiểm thử toàn diện Profile mới.

---

## 16. TESTS & VERIFICATION

- Đã khởi tạo và thực thi thành công bộ test suite: `backend/test/user_profile_redesign_e2e.test.js`.
- **Kết quả: 10 / 10 tests PASS (100%)**.

---

## 17. E2E SCENARIOS (KỊCH BẢN KIỂM THỬ ĐẦU CUỐI)

1. **Kịch bản Editor:** Nhân viên Editor thuộc Team Phoenix xem profile $\rightarrow$ Thấy đúng chức danh Editor, Phòng ban Media & Content, Team Phoenix, số điểm Competition thực tế.
2. **Kịch bản Quản lý kênh:** Quản lý kênh thuộc Team Dragon $\rightarrow$ Thấy đúng chức danh Quản lý kênh và phân hệ YouTube phù hợp.
3. **Kịch bản Trưởng phòng:** Trưởng phòng xem profile $\rightarrow$ Thấy đúng chức danh Trưởng phòng và thông tin quản lý Đội.
4. **Kịch bản Bảo vệ Leo thang đặc quyền:** Member cố tình gửi payload đổi `role=admin` hoặc `jobTitle=Giám đốc` $\rightarrow$ Bị chặn ngay với mã `403 Forbidden`.
5. **Kịch bản Chuyển Đội (Team Transfer):** Khi Admin chuyển User từ Phoenix sang Dragon $\rightarrow$ Current team là Dragon nhưng lịch sử Season 1 trong quá khứ vẫn giữ nguyên Phoenix.
6. **Kịch bản Cách ly YouTube (Cross-Team):** Member Team Dragon xem profile của Member Team Phoenix $\rightarrow$ Dữ liệu YouTube nội bộ của Phoenix được ẩn (`null`).

---

## 18. REGRESSION BASELINE

- Toàn bộ các test suite trước đó (283 tests) kết hợp cùng 10 test mới của Profile $\rightarrow$ **293 / 293 tests PASS (100%)**.

---

## 19. BUILD VERIFICATION

- Lệnh thực thi: `npm --prefix frontend run build`
- **Kết quả: ✓ 1864 modules transformed, 0 errors, 0 warnings**.
- Bundle `UserDetail` giảm kích thước từ 53.33 kB xuống 34.72 kB.

---

## 20. REMAINING GAPS

- Không có lỗi tồn đọng. Toàn bộ logic doanh nghiệp và hiển thị nhân sự đều hoạt động trơn tru.

---

## 21. FINAL PROFILE VERDICT

```text
===================================================================
PROFILE UX/UI:                     PASS (Corporate Profile Standard)
LEGACY GAMEIFICATION REMOVED:      PASS (No EXP/Level/Animal Tiers)
JOB POSITION MODEL:                PASS (job_title, department added)
ROLE-BASED PROFILE:                PASS (Editor/Channel Mgr/Manager)
RBAC & SECURITY:                   PASS (Anti-Privilege Escalation)
COMPETITION INTEGRATION:           PASS (Season/Grand Real Metrics)
YOUTUBE INTEGRATION:               PASS (Team Scoped & Protected)
REGRESSION:                        PASS (293/293 tests pass)
BUILD:                             PASS (0 errors, 0 warnings)
===================================================================
```

---
*Báo cáo được lập và xác thực tự động bởi WorkRank AI Engineering System.*
