# WORK RANK — FULL SIDEBAR PRODUCT AUDIT

**Ngày:** 2026-10-23
**Dự án:** `/Applications/du-an/workrank/workrank-realtime`
**Phạm vi:** toàn bộ khu vực xuất hiện trong sidebar + 2 trang public + route phụ/redirect + phòng chơi
**Phương pháp:** browser thật (Chromium/Playwright), click – quan sát – đối chiếu API/DB, không suy luận từ source

---

## 1. EXECUTIVE SUMMARY

```text
P0 Critical : 0
P1 High     : 3
P2 Medium   : 9
P3 Low      : 8
TOTAL       : 20
```

**3 rủi ro lớn nhất**

1. **WR-AUDIT-001 (P1, SECURITY)** — bất kỳ nhân viên đã đăng nhập đều đọc được **toàn bộ kết quả KPI và lịch sử thay đổi KPI của mọi người** qua `GET /api/kpi/results` và `/api/kpi/results/history`. UI chỉ mở ở trang admin, nhưng backend không chặn.
2. **WR-AUDIT-002 (P1, UI/ACCESSIBILITY)** — tiêu đề trang **Giải Vô Địch Năm** gần như vô hình: chữ `rgb(17,17,17)` trên nền `rgb(20,20,20)` (tương phản ~1.02:1), ở **mọi viewport**.
3. **WR-AUDIT-003 (P1, DATA)** — số lượt thích trong **Thư viện tranh** sai lệch với dữ liệu thật: hiển thị `5`, bấm thích thành `1`, bỏ thích thành `0`; DB `drawing_likes = 0`, `drawings.likes_count = 0`.

**Điểm sáng đã kiểm chứng bằng browser**

- 22/22 mục sidebar click đúng route, đúng active state; deep link + refresh + back/forward đều giữ trạng thái.
- 5/5 game solo chạy hết ván → có kết quả → chơi lại → rời phòng, không lỗi console.
- Phòng nhiều người: tạo → thấy trong danh sách → vào → cả 2 sẵn sàng → bắt đầu → cả 2 vào sân → rời phòng, tất cả PASS.
- Cài đặt: lưu bio → reload → dữ liệu còn; đổi mật khẩu sai → toast lỗi đúng nội dung.
- Bản nháp Xưởng Vẽ: vẽ → autosave → reload → khôi phục đúng nét vẽ.

---

## 2. AUDIT COVERAGE

### 2.1 Route inventory

| # | Sidebar | Route | Component | Backend/API chính | Quyền | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | Tổng quan | `/dashboard` | `Dashboard.jsx` | `/api/dashboard/*`, `/api/kpi/my-kpis` | user | PASS |
| 2 | Số liệu YouTube | `/youtube` | `YouTubeOverview.jsx` | `/api/youtube/overview`, `/api/youtube/team/:id` | user (compare: admin) | PASS |
| 3 | Bảng xếp hạng | `/leaderboard` | `Leaderboard.jsx` | `/api/rankings/*` | user | PASS* (network) |
| 4 | Đấu Trường Mùa Giải | `/arena` | `Arena.jsx` | `/api/competition/*` | user | PARTIAL (mobile) |
| 5 | Giải Vô Địch Năm | `/grand` | `GrandHub.jsx` | `/api/competition/grand/*` | user | **FAIL** (P1 title) |
| 6 | Cộng tác → Thành Viên & Đội Nhóm | `/friends` | `Friends.jsx` | `/api/friends`, `/api/groups`, `/api/chats` | user | PASS* (modal a11y) |
| 7 | Trò Chơi → Trung tâm | `/games` | `GameHub.jsx` | `/api/games/catalog` | user | PASS |
| 8 | Trò Chơi → Đua Gõ Chữ (hub) | `/games/typing` | `TypingHub.jsx` | `/api/games/typing/*` | user | PASS |
| 9 | Trò Chơi → Đua Gõ Chữ | `/games/typing/passage` | `TypingBattle.jsx` | `/api/games/typing/practice*` | user | PASS |
| 10 | Trò Chơi → Gõ Nhanh | `/games/typing/words` | `ArcadeGame.jsx` | `/api/games/arcade/*` | user | PASS |
| 11 | Trò Chơi → Phản Xạ Bốn Hướng | `/games/arcade/direction_rush` | `ArcadeGame.jsx` | `/api/games/arcade/*` | user | PASS |
| 12 | Trò Chơi → Trí Nhớ Nhanh | `/games/arcade/memory_flash` | `ArcadeGame.jsx` | `/api/games/arcade/*` | user | PASS |
| 13 | Trò Chơi → Xưởng Vẽ | `/games/drawing` | `DrawingGame.jsx` | `/api/drawings/*` | user | PARTIAL (publish bị chặn bởi storage local) |
| 14 | Trò Chơi → Thư viện tranh | `/creative-corner` | `CreativeGallery.jsx` | `/api/drawings` | user | **FAIL** (P1 like) |
| 15 | Tài Khoản → Hồ sơ cá nhân | `/users/:id` | `UserDetail.jsx` | `/api/users/:id/*` | user | PASS* |
| 16 | Tài Khoản → Cài đặt | `/settings` | `Settings.jsx` | `/api/auth/*`, `/api/users/:id` | user | PASS |
| 17 | Quản trị → KPI & Phòng Ban | `/admin/kpi` | `AdminKpi.jsx` | `/api/kpi/*` | admin | PASS* (dup request) |
| 18 | Quản trị → Nhân Sự & Đặc Quyền | `/admin/privileges` | `AdminPrivileges.jsx` | `/api/users/*` | admin | PASS* (modal a11y) |
| 19 | Quản trị → Đội Nhóm & Kênh YouTube | `/admin/teams-youtube` | `AdminTeamsYouTube.jsx` | `/api/youtube/admin/*`, `/api/groups/*` | admin | PARTIAL (perf) |
| 20 | Quản trị → Mùa Giải | `/admin/competition/seasons` | `AdminSeasons.jsx` | `/api/competition/admin/*` | admin | PARTIAL (perf + mobile) |
| 21 | Quản trị → Rule Builder | `/admin/competition/rules` | `CompetitionAdmin.jsx` | `/api/competition/admin/rules*` | admin | PARTIAL (mobile) |
| 22 | Quản trị → Giải Vô Địch Năm | `/admin/competition/grand` | `AdminGrand.jsx` | `/api/competition/admin/grand*` | admin | PARTIAL (modal + mobile) |
| 23 | Quản trị → Giám Sát & Logs | `/admin/operations` | `AdminOperations.jsx` | `/api/competition/admin/*` | admin | PARTIAL (mobile) |
| 24 | (public) | `/` | `Home.jsx` | public | anonymous | PARTIAL ("Recipients") |
| 25 | (public) | `/login` | `Login.jsx` | `/api/auth/*` | anonymous | PARTIAL ("Recipients") |

**Route phụ / redirect đã mở:** `/kpi`, `/rankings`, `/groups`, `/admin/departments`, `/admin/competition`, `/admin/games/*`, `/games/<retired>` → tất cả redirect đúng (7/7).

**Dynamic room routes đã mở:** `/games/typing/words/room/:id` (solo + 1v1), `/games/arcade/direction_rush/room/:id`, `/games/arcade/memory_flash/room/:id`, `/games/typing/room/128` (tạo phòng 1v1). Chưa chạy trận 2 người cho Đua Gõ Chữ; `/games/typing/spectate/:id` chưa mở.

### 2.2 Coverage counters

```text
EXPECTED ROUTES (static, in scope) = 25
TESTED ROUTES   (desktop + mobile) = 25
REMAINING                          = 0

SIDEBAR ITEMS DISCOVERED = 22
SIDEBAR ITEMS CLICKED    = 22

SUBPAGES/TAB CONTROLS DISCOVERED = 26
SUBPAGES/TAB CONTROLS TESTED     = 26
  (Admin KPI 4, Admin Privileges 5 filter chips, Admin Teams 2, Admin Seasons 2,
   Admin Rules 4, Admin Grand 6 status chips, Admin Operations 3)

GAMES ACTIVE IN REGISTRY = 5
GAMES PLAYED END-TO-END  = 5
MULTIPLAYER SMOKE        = 1 (Gõ Nhanh 1V1, 2 browser context)
```

### 2.3 Những gì chưa test (disclosed)

| Hạng mục | Lý do | Ảnh hưởng kết luận |
|---|---|---|
| Đăng tranh lên Thư viện | `GET /api/drawings/settings` trả `publishing.available=false` vì `STORAGE_PROVIDER=local` (thiết kế: chỉ bật khi `s3`) | Xưởng Vẽ = PARTIAL, không kết luận publish |
| Trận Đua Gõ Chữ 2 người | Chỉ tạo phòng + vào lobby, chưa chạy hết trận | Typing multiplayer = chưa đủ kết luận |
| `/games/typing/spectate/:id` | Không có phòng đang chơi để spectate | UNVERIFIED |
| Hành động phá huỷ admin (xóa user, đóng mùa, quyết toán Grand, xóa kênh) | Cố ý không thực thi trên DB dev 1.210 user | Chỉ test mở/đóng modal, không test hậu quả |
| iOS Safari / Firefox / WebKit thật | Chỉ Chromium | Mobile kết luận trong phạm vi Chromium |
| Đồng bộ YouTube thật | Dev không có OAuth channel thật | Chỉ test hiển thị + trạng thái |
| axe-core | Không có trong dependency | A11y dùng heuristic + keyboard + computed contrast |

---

## 3. ENVIRONMENT

| Thành phần | Giá trị |
|---|---|
| Frontend | Vite 5.4.21, React 18, `http://127.0.0.1:5173` |
| Backend | Express 5, Node 22.22.2, `http://127.0.0.1:5001`, health `database: ok` |
| DB | MySQL 8.4.9 `workrank_realtime` (1.210 users, 6 drawings, 128 typing rooms, 102 typing match results, 119 arcade rooms) |
| Browser | Chromium (Playwright), locale `vi-VN`, timezone `Asia/Ho_Chi_Minh` |
| Viewport | 390×844, 430×932, 768×900, 1024×900, 1280×900, 1440×900, 1920×900 |
| Tài khoản audit | `audit.admin@workrank.test` (admin), `audit.member@workrank.test` (user mới, không team) |
| Ghi chú | 2 tài khoản audit được tạo qua API register + set role admin bằng SQL; không sửa dữ liệu sản phẩm khác |

---

## 4. FINDINGS BY SEVERITY

### P0 — CRITICAL

Không phát hiện.

---

### P1 — HIGH

---

#### WR-AUDIT-001 — Member đọc được toàn bộ KPI result & lịch sử KPI của mọi nhân viên

**Severity:** P1
**Page:** Quản Lý KPI & Phòng Ban (dữ liệu), ảnh hưởng mọi user đã đăng nhập
**Route:** `GET /api/kpi/results`, `GET /api/kpi/results/history`
**Type:** SECURITY

**Description**
Hai endpoint trả về kết quả KPI của tất cả nhân viên (userId, target, actual, status, department, tên KPI) và lịch sử thay đổi (actorId, previousValue, newValue) nhưng chỉ yêu cầu `auth`, không yêu cầu `requireRole('admin')`. UI chỉ hiển thị ở `/admin/kpi`, nên đây là lỗ hổng backend thuần.

**Steps to reproduce**
1. Đăng nhập bằng `audit.member@workrank.test` (role `user`).
2. Gọi `GET /api/kpi/results?limit=3` với Bearer token.
3. Gọi `GET /api/kpi/results/history?limit=3`.

**Expected**
`403 Forbidden` với user không phải admin/manager (dữ liệu hiệu suất cá nhân là dữ liệu nhạy cảm).

**Actual**
`200 OK`, trả về bản ghi của user khác:
```json
{"id":13,"userId":10817,"departmentId":1,"kpiId":25,"targetValue":20,"actualValue":15,"status":"IN_PROGRESS"}
```
History trả `actorId: 10816`, `previousValue`, `newValue`.

**Evidence**
`docs/audit/2026-10-23/full-sidebar/security.json`; log curl trong phiên audit.

**Suspected root cause**
`backend/src/routes/kpi.routes.js` khai báo:
```js
router.get('/results', auth, ...)
router.get('/results/history', auth, ...)
```
Controller không tự lọc theo `req.user.id`/role.

**Files/components likely involved**
- `backend/src/routes/kpi.routes.js`
- `backend/src/controllers/kpi.controller.js`

**Recommended fix**
Thêm `requireRole('admin','manager')` cho 2 route; nếu cần member xem KPI của chính mình thì tách endpoint `/api/kpi/my-results` và filter theo `req.user.id` ở tầng service.

**Regression risk**
Trung bình: Dashboard đang dùng `/api/kpi/my-kpis` (khác endpoint), nên thêm guard không ảnh hưởng dashboard. Cần test lại Admin KPI.

---

#### WR-AUDIT-002 — Tiêu đề Giải Vô Địch Năm gần như vô hình (contrast ~1.02:1)

**Severity:** P1
**Page:** Giải Vô Địch Năm
**Route:** `/grand`
**Type:** UI ISSUE / ACCESSIBILITY

**Description**
H1 của hero có màu `rgb(17,17,17)` trong khi nền section là `rgb(20,20,20)`. Chữ đen trên nền đen, chỉ còn icon cúp nhìn thấy. Lỗi xuất hiện ở cả desktop 1440 và mobile 390.

**Steps to reproduce**
1. Mở `/grand` (admin hoặc user).
2. Nhìn hero đầu trang.

**Expected**
Tiêu đề trắng (`var(--surface)`) như các đoạn text khác trong hero, tương phản ≥ 4.5:1.

**Actual**
`getComputedStyle(h1).color = rgb(17, 17, 17)`, `section.backgroundColor = rgb(20, 20, 20)` → contrast ≈ **1.02:1**. Ảnh `shots/grand-hero-desktop.png` chỉ thấy icon, không thấy chữ.

**Evidence**
- `docs/audit/2026-10-23/full-sidebar/shots/grand-hero-desktop.png`
- `docs/audit/2026-10-23/full-sidebar/shots/mobile-_grand.png`
- Số đo computed style trong phiên audit.

**Suspected root cause**
`GrandHub.jsx:203` đặt `<h1 style={{...}}>` **không có `color`**, kỳ vọng kế thừa `color: var(--surface)` từ `<section>`. Nhưng global rule `h1 { color: var(--text-primary) }` trong `frontend/src/index.css:800-808` thắng inheritance.

**Files/components likely involved**
- `frontend/src/pages/GrandHub.jsx` (hero h1, dòng ~203)
- `frontend/src/index.css` (global `h1` rule)

**Recommended fix**
Đặt `color: 'var(--surface)'` trực tiếp cho h1 trong hero (hoặc class `.grand-hero h1 { color: inherit }`).

**Regression risk**
Thấp: chỉ ảnh hưởng hero Grand.

---

#### WR-AUDIT-003 — Số lượt thích tranh sai lệch, bấm thích làm số nhảy từ 5 → 1 → 0

**Severity:** P1
**Page:** Thư viện tranh
**Route:** `/creative-corner`
**Type:** DATA BUG

**Description**
Thẻ tranh hiển thị 5 lượt thích. Bấm thích → hiển thị **1** (đáng lẽ 6). Bỏ thích → **0**. DB tại thời điểm kiểm tra: `drawing_likes = 0` và `drawings.likes_count = 0` cho mọi tranh, tức số 5 ban đầu là **số ảo**.

**Steps to reproduce**
1. Mở `/creative-corner`.
2. Ghi nhận số trên nút tim của thẻ đầu tiên (5).
3. Bấm thích → đọc lại số (1).
4. Bấm bỏ thích → đọc lại số (0).
5. Đối chiếu `SELECT COUNT(*) FROM drawing_likes WHERE drawing_id=2` → 0.

**Expected**
`5 → 6 → 5` và khớp `COUNT(drawing_likes)`.

**Actual**
`5 → 1 → 0`; API trả `likesCount: 1` rồi `0` vì toggle tính lại từ bảng likes.

**Evidence**
- `docs/audit/2026-10-23/full-sidebar/drawing-gallery.json` (step `gallery like toggle`)
- DB: `drawings.likes_count = 0`, `drawing_likes = 0`
- API: `POST /api/drawings/2/like` → `{"hasLiked":true,"likesCount":1}`

**Suspected root cause**
`likes_count` là counter denormalized. `drawing.service.js:129` đọc thẳng `likes_count` khi list; `drawing.service.js:375` khi toggle lại `COUNT` bảng `drawing_likes` rồi ghi đè. Không có job reconcile/backfill, nên counter lệch sẽ tồn tại đến lần like đầu tiên.

**Files/components likely involved**
- `backend/src/services/drawing.service.js` (list + toggleLike)
- `backend/src/models/Drawing.js`
- seed/test data ghi `likes_count` mà không tạo `drawing_likes`

**Recommended fix**
Một nguồn sự thật: list bằng `COUNT(drawing_likes)` (subquery) hoặc thêm job reconcile + backfill migration; cấm seed ghi counter trực tiếp.

**Regression risk**
Trung bình: ảnh hưởng query gallery và sắp xếp "Nhiều tim nhất"; cần test hiệu năng list.

---

### P2 — MEDIUM

---

#### WR-AUDIT-004 — Nội dung bị cắt trên mobile ở 6 trang, filter không thể bấm

**Severity:** P2
**Page:** Đấu Trường Mùa Giải, Giải Vô Địch Năm, Giám Sát & Logs, Quản Lý Mùa Giải, Rule Builder, Quản Lý Grand
**Route:** `/arena`, `/grand`, `/admin/operations`, `/admin/competition/seasons`, `/admin/competition/rules`, `/admin/competition/grand`
**Type:** RESPONSIVE

**Description**
Ở 390/430px, hero và các dải filter/segmented vượt viewport nhưng bị ancestor `overflow: hidden` cắt, không có scroll ngang. Người dùng mobile không thấy và không bấm được các mục cuối.

**Steps to reproduce**
1. Mở `/arena` ở 390×844 → dải tab `BXH Đội / BXH Cá Nhân / Thử Thách / Luật Chơi` bị cắt ở "Luật Chơi"; thẻ hero cắt mép phải.
2. Mở `/grand` → `.grand-hero-body` rộng **473.7px** trong viewport 390 → cắt 84px; mô tả và progress bar bị cắt.
3. Mở `/admin/operations` → section rộng **710px**; thẻ "NHẬT KÝ K…" và tab "Hàng…" bị cắt.
4. Mở `/admin/competition/seasons` → `.ui-segmented` rộng 575px; "Đã hoàn thành"/"Bản nháp" không truy cập được.
5. Tương tự `/admin/competition/rules` (510px) và `/admin/competition/grand` (515px).

**Expected**
Nội dung wrap hoặc container `overflow-x: auto` có scroll affordance; mọi filter bấm được.

**Actual**
`document.scrollWidth === 390` (không có scroll trang) nhưng element `right` vượt 390–710px và bị cắt; filter cuối không thể bấm.

**Evidence**
- `shots/mobile-_arena.png`, `shots/mobile-_grand.png`, `shots/mobile-_admin_operations.png`, `shots/mobile-_admin_competition_seasons.png`
- `responsive-a11y.json` (clipped elements + width)

**Suspected root cause**
- `.ui-segmented { display: inline-flex }` không `flex-wrap`, không `overflow-x: auto`; mobile set `width: 100%` nhưng item `white-space: nowrap`.
- Hero Grand dùng `flex` với nội dung `min-width` lớn, không có `max-width: 100%` cho khối chữ.
- Page shell có `overflow: hidden` nên nội dung tràn bị cắt thay vì scroll.

**Files/components likely involved**
- `frontend/src/index.css` (`.ui-segmented`)
- `frontend/src/pages/GrandHub.jsx` (hero)
- `frontend/src/pages/Arena.jsx` (hero/tabs)
- `frontend/src/pages/AdminOperations.jsx`, `AdminSeasons.jsx`, `CompetitionAdmin.jsx`, `AdminGrand.jsx`

**Recommended fix**
Cho `.ui-segmented` `overflow-x:auto; max-width:100%` + scrollbar ẩn có affordance; hero dùng `min-width:0`, `overflow-wrap:anywhere`; bỏ `overflow:hidden` ở shell hoặc đặt `overflow-x:clip` đúng chỗ.

**Regression risk**
Trung bình: đụng layout nhiều trang; cần chụp lại 6 width.

---

#### WR-AUDIT-005 — Modal thiếu semantics, không đóng bằng Escape, không giữ focus

**Severity:** P2
**Page:** Cộng tác, Quản Lý Nhân Sự, Quản Lý Grand (và 9 file modal khác)
**Route:** `/friends`, `/admin/privileges`, `/admin/competition/grand`
**Type:** ACCESSIBILITY

**Description**
Phần lớn modal dùng `.modal-dialog-enter` nhưng không có `role="dialog"`, `aria-modal`, `aria-labelledby`; Escape không đóng; Tab đi xuyên ra sau modal.

**Steps to reproduce**
1. `/friends` → bấm "Nhập mã mời".
2. Kiểm tra panel: `role=null`, `aria-modal=null`, `aria-labelledby=null`.
3. Bấm Escape → modal vẫn mở.
4. Tab 10 lần → focus nhảy ra `Danh Bạ Đồng Nghiệp`, `Đội Nhóm Của Tôi`, input tìm kiếm phía sau.
5. `/admin/competition/grand` → "Tạo Grand Championship" → Escape → modal vẫn mở.

**Expected**
`role="dialog" aria-modal="true"`, focus trap, Escape đóng, focus trả về trigger.

**Actual**
Không có semantics; Escape không xử lý; focus thoát ra ngoài.

**Evidence**
`docs/audit/2026-10-23/full-sidebar/navigation.json` (mobile), log debug modal; đối chiếu source: **13 file** dùng `modal-dialog-enter`, chỉ **4 file** có `role="dialog"` (`UiContext`, `ui.jsx`, `ProductTour`, `Groups`).

**Suspected root cause**
Không có component `Modal` dùng chung bắt buộc; mỗi trang tự dựng panel bằng inline style.

**Files/components likely involved**
`Friends.jsx`, `AdminGrand.jsx`, `AdminPrivileges.jsx`, `AdminKpi.jsx`, `AdminSeasons.jsx`, `AdminTeamsYouTube.jsx`, `AdminOperations.jsx`, `UserDetail.jsx`, `ChannelDetailModal.jsx`, `MvpCupAwardModal.jsx`

**Recommended fix**
Tạo `Modal` primitive (portal + role + aria-modal + focus trap + Escape + scroll lock) và thay dần.

**Regression risk**
Trung bình: nhiều modal, cần test từng flow mở/đóng.

---

#### WR-AUDIT-006 — Trang Quản Lý Đội Nhóm & Kênh YouTube render 33.706 DOM node, 27.433 option

**Severity:** P2
**Page:** Quản Lý Đội Nhóm & Kênh YouTube
**Route:** `/admin/teams-youtube`
**Type:** PERFORMANCE

**Description**
Mỗi hàng kênh render một `<select>` đội với ~255 option. 107 kênh → 108 select, **27.433 option**, **33.706 DOM node**, **854.948 ký tự text**, load 3.7s.

**Steps to reproduce**
1. Mở `/admin/teams-youtube`.
2. Đo `document.querySelectorAll('*').length` và tổng `select.options.length`.

**Expected**
DOM gọn (virtualized list hoặc select searchable), load < 1.5s.

**Actual**
```json
{"selects":108,"totalOptions":27433,"domNodes":33706,"rows":107,"maxOptions":255}
```
Text body 854.948 ký tự (gấp ~400 lần trang thường).

**Evidence**
`docs/audit/2026-10-23/full-sidebar/admin-pages.json` + log đo DOM.

**Suspected root cause**
Render toàn bộ option của tất cả team cho từng row select; không virtualize bảng.

**Files/components likely involved**
`frontend/src/pages/AdminTeamsYouTube.jsx`

**Recommended fix**
Dùng một danh sách team load 1 lần và select nhẹ (hoặc combobox search), virtualize/paginate bảng 107 kênh.

**Regression risk**
Trung bình: đụng logic gán team.

---

#### WR-AUDIT-007 — Quản Lý Mùa Giải bắn 22 request `/api/users` khi mở trang và render select 1.083 option

**Severity:** P2
**Page:** Quản Lý Mùa Giải
**Route:** `/admin/competition/seasons`
**Type:** PERFORMANCE / UX

**Description**
`fetchAvailableUsers()` tải **toàn bộ 1.210 nhân sự** bằng cách gọi 100 user/trang song song; crawl ghi nhận **22 request** `GET /api/users` ngay khi load. Dropdown chọn thành viên có **1.083 option** dạng native select, không search.

**Steps to reproduce**
1. Mở `/admin/competition/seasons` → theo dõi Network.
2. Đếm request `/api/users` (22).
3. Mở tab "Vinh Danh Trang Chủ & Lịch Sử" → đếm option của select người dùng (1.083).

**Expected**
1 request có search/pagination; dropdown searchable.

**Actual**
22 request song song; select 1.083 option; tab Vinh Danh render 40.020 ký tự.

**Evidence**
`crawl.json` (`duplicateRequests: GET /api/users 22`), `responsive-a11y.json`, source `AdminSeasons.jsx:106-117`.

**Suspected root cause**
Eager-load toàn bộ user để fill dropdown, không debounce/search server-side.

**Files/components likely involved**
`frontend/src/pages/AdminSeasons.jsx`

**Recommended fix**
Chuyển sang user picker search server-side (`?search=&limit=20`), chỉ fetch khi mở dropdown.

**Regression risk**
Thấp–trung bình: đụng flow trao MVP/chọn thành viên.

---

#### WR-AUDIT-008 — Ảnh tranh trỏ tới host chết `127.0.0.1:18900`, gallery và trang chủ hiện ảnh lỗi

**Severity:** P2
**Page:** Thư viện tranh, Trang chủ
**Route:** `/creative-corner`, `/`
**Type:** DATA BUG

**Description**
Một tác phẩm ACTIVE lưu URL tuyệt đối `http://127.0.0.1:18900/buckets/workrank-drawings/...png`. Host không tồn tại → `ERR_CONNECTION_REFUSED`; card hiển thị fallback "Ảnh tác phẩm không còn khả dụng".

**Steps to reproduce**
1. Mở `/creative-corner` → console có `Failed to load resource: net::ERR_CONNECTION_REFUSED`.
2. Đếm `.public-artwork-img-fallback` → 1.
3. Mở `/` → cùng lỗi.

**Expected**
Ảnh load được, hoặc URL được rewrite sang storage hiện tại, hoặc có job phát hiện ảnh chết.

**Actual**
1 ảnh hỏng; DB: 2/6 drawing có URL `127.0.0.1:18900`, 0 ảnh dùng `/uploads/`.

**Evidence**
`crawl.json` (gallery/home failedRequests), `shots/gallery-1440.png`, DB `SELECT image_url FROM drawings`.

**Suspected root cause**
Lưu absolute URL thay vì storage key; đổi `STORAGE_PUBLIC_BASE_URL`/provider không migrate dữ liệu cũ; FE không có `onError` để thử URL thay thế.

**Files/components likely involved**
`backend/src/services/drawing.service.js`, `backend/src/services/storage*`, `frontend/src/components/CreativeCornerSection.jsx`

**Recommended fix**
Lưu `storage_key` là nguồn sự thật, sinh URL khi đọc; migration backfill; FE `onError` → fallback placeholder có chủ đích.

**Regression risk**
Trung bình: ảnh hưởng hiển thị toàn bộ gallery/home.

---

#### WR-AUDIT-009 — Request trùng lặp 3–4 lần mỗi endpoint khi mở trang

**Severity:** P2
**Page:** Bảng xếp hạng, Quản Lý KPI
**Route:** `/leaderboard`, `/admin/kpi`
**Type:** PERFORMANCE

**Description**
Một lần load trang gọi lặp cùng API: Leaderboard gọi 4× `friends`, `friends/requests`, `chats/unread-counts`, `games/catalog`; Admin KPI gọi 3× `departments`, `definitions`, `periods`, `users`.

**Steps to reproduce**
1. Mở `/leaderboard` → Network: 4 request mỗi endpoint trên.
2. Mở `/admin/kpi` → 3 request mỗi endpoint.

**Expected**
1 request/endpoint (dedupe/cache), hoặc request có lý do rõ ràng.

**Actual**
4×/3× trong ~2.5s; tổng request 23 (leaderboard) và 22 (admin KPI).

**Evidence**
`crawl.json` `duplicateRequests`.

**Suspected root cause**
Layout/Sidebar/FriendsDock và page cùng fetch; cache helper không dedupe in-flight request; effect chạy lại do dependency không ổn định.

**Files/components likely involved**
`frontend/src/components/Layout.jsx`, `Sidebar.jsx`, `FriendsDock.jsx`, `pages/Leaderboard.jsx`, `pages/AdminKpi.jsx`, `services/cache.js`

**Recommended fix**
Dedupe in-flight theo cache key; tách provider dữ liệu dùng chung (catalog/unread/friends) khỏi page.

**Regression risk**
Thấp: chỉ tối ưu mạng, cần test realtime badge.

---

#### WR-AUDIT-010 — "Recipients" là tiêu đề tiếng Anh trên Trang chủ và Đăng nhập

**Severity:** P2
**Page:** Trang chủ, Đăng nhập
**Route:** `/`, `/login`
**Type:** UX ISSUE

**Description**
H1 trang chủ public và H2 panel trái trang đăng nhập hiển thị chữ **"Recipients"** — tiếng Anh, không có nghĩa với người dùng Việt, trông như placeholder chưa thay.

**Steps to reproduce**
1. Mở `/` (chưa đăng nhập) → H1 = "Recipients".
2. Mở `/login` → panel trái có heading "Recipients".

**Expected**
Tiêu đề tiếng Việt đúng nội dung (ví dụ "Vinh danh", "Người được vinh danh").

**Actual**
`Home.jsx:259` hardcode `text="Recipients"`; `Login.jsx:34` hardcode `<h2>Recipients</h2>`.

**Evidence**
`shots/home-1440.png`, `shots/login-1440.png`, `crawl.json` h1/h2.

**Suspected root cause**
Copy placeholder chưa được thay khi Việt hoá.

**Files/components likely involved**
`frontend/src/pages/Home.jsx`, `frontend/src/pages/Login.jsx`

**Recommended fix**
Đổi sang copy tiếng Việt; nếu là section vinh danh động thì lấy tên người/tháng.

**Regression risk**
Rất thấp.

---

#### WR-AUDIT-011 — 108/110 ô select ở Quản Lý Đội Nhóm & Kênh YouTube không có nhãn

**Severity:** P2
**Page:** Quản Lý Đội Nhóm & Kênh YouTube (và Friends, Admin KPI)
**Route:** `/admin/teams-youtube`
**Type:** ACCESSIBILITY

**Description**
Mỗi row có select gán đội nhưng không có `<label>`, `aria-label`, `title`. Screen reader chỉ đọc "combobox" mà không biết đang gán đội cho kênh nào.

**Steps to reproduce**
1. Mở `/admin/teams-youtube`.
2. Đếm input/select visible không có label/aria-label/placeholder.

**Expected**
Mỗi select có `aria-label="Đội phụ trách cho kênh <tên>"`.

**Actual**
`inputsUnlabeled = 108/110`; Friends `2/4`; Admin KPI `1/3`.

**Evidence**
`responsive-a11y.json`.

**Suspected root cause**
Select đặt trong `<td>` không có label; không dùng `aria-labelledby` trỏ tới tên kênh.

**Files/components likely involved**
`frontend/src/pages/AdminTeamsYouTube.jsx`, `Friends.jsx`, `AdminKpi.jsx`

**Recommended fix**
Thêm `aria-label` động theo tên kênh/row.

**Regression risk**
Rất thấp.

---

#### WR-AUDIT-012 — 7 nhãn sidebar bị cắt, tooltip không chứa nhãn đầy đủ

**Severity:** P2
**Page:** Sidebar toàn cục
**Route:** mọi route
**Type:** UX ISSUE

**Description**
Sidebar rộng 240px; 7 nhãn bị ellipsis, nặng nhất "Quản Lý Đội Nhóm & Kênh YouTube" (149/215px). `title` của link là **description**, không phải label, nên hover không giúp biết tên đầy đủ.

**Steps to reproduce**
1. Mở bất kỳ route, nhìn sidebar.
2. Hover "Quản Lý Đội Nhóm & Kênh YouTube" → tooltip "Cấu hình teams, phân bổ phòng ban, kết nối & đồng bộ kênh YouTube".

**Expected**
Tooltip chứa label đầy đủ (hoặc `aria-label` + tooltip), hoặc sidebar rộng hơn/wrap.

**Actual**
7 nhãn truncate; `title = item.description || item.label`.

**Evidence**
`navigation.json` → `truncation` (7 mục, clientWidth 111–149 vs scrollWidth 152–215).

**Suspected root cause**
`Sidebar.jsx:322` đặt `title={item.description || item.label}`; label span `text-overflow: ellipsis`.

**Files/components likely involved**
`frontend/src/components/Sidebar.jsx`, `frontend/src/config/navigation.js`

**Recommended fix**
`title={`${item.label} — ${item.description}`}` hoặc tooltip riêng; cân nhắc sidebar 260px.

**Regression risk**
Thấp.

---

### P3 — LOW

---

#### WR-AUDIT-013 — Touch target 24–30px dưới ngưỡng 44px trên mobile

**Severity:** P3
**Page:** Toàn cục (brand mark, sidebar "Thu gọn", Xưởng Vẽ zoom, Thư viện tranh nút xóa)
**Route:** nhiều route
**Type:** ACCESSIBILITY

**Description**
Nhiều nút icon chỉ 24×24 / 28×28 / 30×30px, khó bấm trên mobile.

**Steps to reproduce**
Mở `/games/drawing` @390 → "Thu nhỏ"/"Phóng to" 28×28; `/creative-corner` → "Xóa tác phẩm" 28×28; header brand 24×24.

**Expected**
≥ 44×44 vùng chạm (có thể padding trong suốt).

**Actual**
24–30px.

**Evidence**
`responsive-a11y.json` → `smallTargets`.

**Suspected root cause**
Icon button không có padding tối thiểu.

**Files/components likely involved**
`frontend/src/components/Layout.jsx`, `DrawingGame.jsx`, `CreativeCornerSection.jsx`

**Recommended fix**
Tăng hit area bằng padding/pseudo-element.

**Regression risk**
Thấp.

---

#### WR-AUDIT-014 — Modal đăng tranh disable nút gửi nhưng không nói lý do bên trong modal

**Severity:** P3
**Page:** Xưởng Vẽ
**Route:** `/games/drawing`
**Type:** UX ISSUE

**Description**
Trang có banner "Hiện chưa thể đăng tranh…" nhưng khi mở modal "Đăng tranh lên Thư viện", nút "Đăng tranh lên Thư viện" bị disable, modal không nhắc lại lý do.

**Steps to reproduce**
1. Mở `/games/drawing` (STORAGE_PROVIDER=local).
2. Bấm "Đăng tranh" → nhập tên → nút submit disabled.

**Expected**
Trong modal hiển thị lý do + hướng dẫn (tải PNG/lưu nháp), hoặc không cho mở modal.

**Actual**
Nút disabled, modal chỉ có "Tiếp tục chỉnh sửa".

**Evidence**
`drawing-gallery.json` → `publish submit enabled: false`, modal text.

**Suspected root cause**
Notice đặt ngoài modal; modal không đọc `publishingAvailable`.

**Files/components likely involved**
`frontend/src/pages/DrawingGame.jsx` (modal ~1400-1460)

**Recommended fix**
Truyền lý do vào modal hoặc disable nút "Đăng tranh" từ đầu kèm tooltip.

**Regression risk**
Thấp.

---

#### WR-AUDIT-015 — `/youtube?tab=compare` với non-admin giữ URL compare nhưng render Tổng quan

**Severity:** P3
**Page:** Số liệu YouTube
**Route:** `/youtube?tab=compare`
**Type:** UX ISSUE

**Description**
`activeTab` fallback về `overview` nếu không phải admin, nhưng URL không được chuẩn hoá; refresh/share link vẫn là `?tab=compare` trong khi nội dung là Tổng quan.

**Steps to reproduce**
1. Đăng nhập user thường.
2. Mở `/youtube?tab=compare`.
3. URL vẫn `?tab=compare`, H1 = "YouTube", nội dung Tổng quan.

**Expected**
Redirect `?tab=overview` hoặc ẩn tab So sánh và giữ URL nhất quán.

**Actual**
URL và nội dung lệch nhau.

**Evidence**
Source `YouTubeOverview.jsx:64-66`; test deep link.

**Suspected root cause**
Fallback chỉ ở biến `activeTab`, không `setSearchParams`.

**Files/components likely involved**
`frontend/src/pages/YouTubeOverview.jsx`

**Recommended fix**
Effect chuẩn hoá URL khi tab không hợp lệ/không đủ quyền.

**Regression risk**
Thấp.

---

#### WR-AUDIT-016 — English strings còn sót trong Admin KPI và Dashboard

**Severity:** P3
**Page:** Quản Lý KPI, Tổng quan
**Route:** `/admin/kpi`, `/dashboard`
**Type:** UX ISSUE

**Description**
- `ProductionKpiPanel`: header "Role", "Task", "Benchmark", "Version draft", "Status", "User".
- `AdminKpi`: "WorkRank KPI Foundation", "YouTube Studio Hub".
- `Dashboard`: eyebrow "WorkRank Performance Center".

**Steps to reproduce**
Mở `/admin/kpi` → tab KPI → bảng production; mở `/dashboard` → eyebrow.

**Expected**
Tiếng Việt (trừ thuật ngữ kỹ thuật/brand được chấp nhận).

**Actual**
Chuỗi tiếng Anh hiển thị trực tiếp.

**Evidence**
Scan JSX + text page.

**Suspected root cause**
Việt hoá chưa hết.

**Files/components likely involved**
`frontend/src/components/ProductionKpiPanel.jsx`, `pages/AdminKpi.jsx`, `pages/Dashboard.jsx`

**Recommended fix**
Dịch nhãn; giữ "KPI", "YouTube" nếu là thuật ngữ.

**Regression risk**
Rất thấp.

---

#### WR-AUDIT-017 — Toast lỗi dùng `role="status"`; 3 trang nhảy bậc heading

**Severity:** P3
**Page:** Toàn cục; Hồ sơ, Quản Lý Mùa Giải, Giám Sát & Logs
**Route:** nhiều route
**Type:** ACCESSIBILITY

**Description**
Toast lỗi (`toast.error`) render `role="status"` (polite) thay vì `role="alert"`; heading skip 1 bậc ở `/users/1`, `/admin/competition/seasons`, `/admin/operations`.

**Steps to reproduce**
1. Gây lỗi đổi mật khẩu → toast `role="status"`.
2. Kiểm heading order ở 3 trang trên.

**Expected**
Lỗi dùng `role="alert"`; heading tuần tự h1→h2→h3.

**Actual**
`role="status"`; `headingSkips=1`.

**Evidence**
`UiContext.jsx:107`; `responsive-a11y.json`.

**Suspected root cause**
Một component toast dùng chung cho mọi loại; heading do page tự đặt.

**Files/components likely involved**
`frontend/src/context/UiContext.jsx`, `UserDetail.jsx`, `AdminSeasons.jsx`, `AdminOperations.jsx`

**Recommended fix**
`role={type==='error'?'alert':'status'}`; sửa cấp heading.

**Regression risk**
Rất thấp.

---

#### WR-AUDIT-018 — Mùa giải/Grand test hiển thị như dữ liệu thật trên trang người dùng

**Severity:** P3
**Page:** Đấu Trường Mùa Giải, Giải Vô Địch Năm, Quản Lý Mùa Giải
**Route:** `/arena`, `/grand`, `/admin/competition/seasons`
**Type:** DATA BUG

**Description**
Trang người dùng đang hiển thị mùa đang hoạt động tên `Sec Season 1792203291661` và `Perf Grand Championship 1791772700125` — tên sinh tự động từ test. Admin Seasons liệt kê 11 mùa, phần lớn là "Season Product Integration 1792203322706", "Season UAT Championship…", "Perf Season…".

**Steps to reproduce**
Mở `/arena`, `/grand`, `/admin/competition/seasons`.

**Expected**
Mùa thật có tên người đọc được; test data không được activate.

**Actual**
Tên máy sinh hiển thị công khai.

**Evidence**
`crawl.json` h1; `shots/_arena-1440.png`, `shots/_grand-1440.png`.

**Suspected root cause**
Dữ liệu test trong DB dev được set ACTIVE; không có cờ `is_test`/guard khi activate.

**Files/components likely involved**
Dữ liệu/migration/seeder; `AdminSeasons.jsx`

**Recommended fix**
Không phải bug code thuần — cần dọn dữ liệu dev hoặc thêm cột `is_test` + filter. Ghi nhận để tránh demo nhầm.

**Regression risk**
Thấp (nếu chỉ dọn dữ liệu).

---

#### WR-AUDIT-019 — Trang Quản Lý Kênh khi API lỗi không có nút thử lại

**Severity:** P3
**Page:** Quản Lý Đội Nhóm & Kênh YouTube
**Route:** `/admin/teams-youtube`
**Type:** UX ISSUE

**Description**
Khi toàn bộ `/api/youtube/admin/*` trả 500, trang hiển thị thông báo lỗi nhưng không có action "Thử lại" tại chỗ; người dùng phải reload trình duyệt.

**Steps to reproduce**
1. Chặn `**/api/youtube/admin/**` → 500.
2. Mở `/admin/teams-youtube`.

**Expected**
Nút "Thử lại" gọi lại fetch.

**Actual**
Có error copy, `hasRetryButton=false`.

**Evidence**
`states.json` → error case.

**Suspected root cause**
Error render là text, không dùng `PageState` có `onRetry`.

**Files/components likely involved**
`frontend/src/pages/AdminTeamsYouTube.jsx`

**Recommended fix**
Dùng `PageState type="error" onRetry`.

**Regression risk**
Thấp.

---

#### WR-AUDIT-020 — Arcade menu poll 2 API mỗi 3 giây; cảnh báo React Router lặp trên mọi route

**Severity:** P3
**Page:** Trò Chơi (menu), toàn cục
**Route:** `/games/typing/words`, `/games/arcade/*`
**Type:** PERFORMANCE / TECH DEBT

**Description**
Ở menu game (không có phòng), `/api/games/arcade/active` và `/leaderboard` được gọi mỗi 3s → 5 lần/10s (~40 request/phút/user nhàn rỗi). Đồng thời mỗi route log 2 warning React Router future flag.

**Steps to reproduce**
1. Mở `/games/typing/words`, đứng yên 10s → 5 request mỗi endpoint.
2. Mở bất kỳ route → console 2 warning `v7_startTransition`, `v7_relativeSplatPath`.

**Expected**
Poll thưa hơn/khi tab visible/chỉ khi có phòng; bật future flag để hết warning.

**Actual**
Poll 3s; warning lặp 50 lần trong 25 route.

**Evidence**
Log đo polling; `crawl.json` console.

**Suspected root cause**
`ArcadeGame.jsx:139` `setInterval(refresh, 3000)` không phụ thuộc trạng thái phòng/tab; BrowserRouter thiếu future flags.

**Files/components likely involved**
`frontend/src/pages/ArcadeGame.jsx`, `frontend/src/App.jsx`

**Recommended fix**
Chỉ poll khi `document.visibilityState==='visible'` và khi có phòng/đối thủ; bật future flags.

**Regression risk**
Thấp.

---

## 5. FINDINGS BY PAGE

> Số trong bảng là **số lần xuất hiện trên trang**, không phải số bug duy nhất — một bug cross-page (004, 005, 008, 009, 011, 017) được tính ở mọi trang bị ảnh hưởng.

| Page | P1 | P2 | P3 | Ghi chú |
|---|---:|---:|---:|---|
| Tổng quan | 0 | 0 | 2 | Dup request không có; anchor/CTA/refresh OK; eyebrow English (016) |
| Số liệu YouTube | 0 | 0 | 1 | 3 tab + deep link + refresh + toast OK; URL compare non-admin (015) |
| Bảng xếp hạng | 0 | 1 | 0 | 5 scope × 3 period, search, pagination OK; 4× dup request (009) |
| Đấu Trường Mùa Giải | 0 | 1 | 1 | 4 tab OK, empty state rõ; mobile cắt tab/hero (004); tên season test (018) |
| Giải Vô Địch Năm | 1 | 1 | 1 | Title vô hình (002); mobile cắt hero (004); tên Grand test (018) |
| Cộng tác — Thành Viên & Đội Nhóm | 0 | 1 | 1 | 2 tab, search, filter, invite modal OK; modal a11y (005); input thiếu nhãn (011) |
| Trung tâm trò chơi | 0 | 0 | 1 | 5 card → đúng route; "Sắp ra mắt" đúng; catalog gọi 4× (009) |
| Đua Gõ Chữ (hub) | 0 | 0 | 0 | 2 card đúng |
| Đua Gõ Chữ | 0 | 0 | 1 | Solo 30s: 121 ký tự, 100%, result + Bài mới OK; phòng 1v1 tạo được |
| Gõ Nhanh | 0 | 0 | 1 | 375 từ, 33.839 điểm, result/replay/leave OK; poll 3s (020) |
| Phản Xạ Bốn Hướng | 0 | 0 | 1 | 169 lần bấm, 3.292 điểm, result/replay/leave OK |
| Trí Nhớ Nhanh | 0 | 0 | 1 | 23 vòng, 10.166 điểm, result/replay/leave OK |
| Xưởng Vẽ | 0 | 0 | 1 | Vẽ + autosave + restore OK; publish disabled bởi storage local (014) |
| Thư viện tranh | 1 | 1 | 0 | Like sai (003); 1 ảnh chết (008); lightbox/download/sort OK |
| Hồ sơ cá nhân | 0 | 0 | 1 | 30 nút, gallery slot, tim OK; heading skip (017); tab cắt @430 (004) |
| Cài đặt tài khoản | 0 | 0 | 0 | Lưu bio → reload còn; sai mật khẩu → toast đúng; modal xóa mở/đóng OK |
| Quản Lý KPI | 0 | 1 | 1 | 4 tab OK; 3× dup request (009); 1 input thiếu nhãn (011) |
| Quản Lý Nhân Sự | 0 | 1 | 1 | 5 filter OK; 371 nút; modal thêm mở/đóng OK nhưng thiếu a11y (005) |
| Quản Lý Đội & Kênh | 0 | 2 | 1 | 33.7k DOM (006), 108 select thiếu nhãn (011), không retry (019) |
| Quản Lý Mùa Giải | 0 | 2 | 1 | 22 request + 1.083 option (007); mobile filter cắt (004) |
| Rule Builder | 0 | 1 | 0 | 4 tab OK; mobile segmented cắt (004) |
| Quản Lý Grand | 0 | 2 | 0 | Modal Escape (005); mobile filter cắt (004) |
| Giám Sát & Logs | 0 | 1 | 1 | 3 tab OK, 32 log/83 event; mobile cắt (004); heading skip (017) |
| Trang chủ (public) | 0 | 1 | 0 | "Recipients" (010); 1 ảnh chết (008) |
| Đăng nhập (public) | 0 | 1 | 0 | "Recipients" (010); login/logout OK |

**Legend:** FAIL = có P1; PARTIAL = có P2 nhưng flow chính chạy; PASS* = chỉ P3.

---

## 6. CROSS-PAGE UX PROBLEMS

1. **Hai hệ modal song song**: `ui.jsx`/`UiContext` có dialog đúng chuẩn, nhưng 9 trang tự dựng panel `modal-dialog-enter` không role/Escape/focus trap. Người dùng keyboard gặp trải nghiệm khác nhau tùy trang.
2. **Ba kiểu filter**: segmented (`ui-segmented`), chip tròn (Admin Privileges), select native (YouTube, Admin Teams). Cùng chức năng lọc nhưng hình thức và hành vi khác nhau; segmented không scroll được trên mobile.
3. **Empty state không đồng nhất**: Arena/Grand có copy rõ; Leaderboard kỳ mùa giải chỉ 1 dòng; Admin Teams lỗi API chỉ có text đỏ, không retry.
4. **Tiêu đề trang**: 4 trang dùng `PageShell` + h1 chuẩn, Admin KPI/Privileges/Teams dùng hero riêng; khoảng cách và cỡ chữ khác nhau.
5. **Nhãn tiếng Anh rải rác**: "Recipients", "WorkRank Performance Center", "Role/Task/Benchmark", "Version draft" — không có quy ước dịch.
6. **Sidebar truncate không có tooltip đầy đủ** — 7 mục, gồm các mục admin quan trọng.

---

## 7. DATA / LOGIC PROBLEMS

| Vấn đề | Bằng chứng | Ảnh hưởng |
|---|---|---|
| `likes_count` lệch `drawing_likes` | UI 5 → 1 → 0; DB 0 | Số like sai, sập về 0 sau tương tác |
| URL ảnh tuyệt đối chết | `127.0.0.1:18900` × 2 bản ghi | Ảnh hỏng ở gallery + home |
| KPI results/history không phân quyền | member nhận 200 + dữ liệu người khác | Lộ dữ liệu hiệu suất |
| Tên season/grand test | `Sec Season 1792203291661`, `Perf Grand Championship 1791772700125` | Người dùng thấy dữ liệu máy sinh |
| Leaderboard kỳ "Mùa Giải" chỉ 1 dòng | `rows=1`, bodyLen 1683 | Có thể đúng do mùa ít người, nhưng UI không giải thích "mùa nào/bao nhiêu người" |
| Số liệu YouTube 0 toàn bộ | KPI cards 0, chart "Chưa đủ dữ liệu" | Đúng với DB dev (không có snapshot), nhưng không phân biệt "chưa kết nối" vs "0 thật" |

**Đối chiếu số UI ↔ API đã làm:** Dashboard totals/KPI, Leaderboard rows (100/trang), Arena/Grand counts, Admin KPI (26 KPI, 2 phòng), Admin Operations (32 log, 83 event), Admin Teams (107 kênh, 253 đội). Không phát hiện lệch số UI/API ngoài like count.

---

## 8. RESPONSIVE PROBLEMS

| Route | 390 | 430 | 768 | 1024+ | Chi tiết |
|---|---|---|---|---|---|
| `/arena` | FAIL | OK* | OK | OK | Hero + tab strip cắt phải; "Luật Chơi" không bấm được |
| `/grand` | FAIL | FAIL | OK | OK | `.grand-hero-body` 473.7px; title vô hình |
| `/admin/operations` | FAIL | FAIL | OK | OK | Section 710px; thẻ thứ 3 và tab cuối bị cắt |
| `/admin/competition/seasons` | FAIL | FAIL | OK | OK | Segmented 575px; 2 filter cuối không thấy |
| `/admin/competition/rules` | FAIL | FAIL | OK | OK | Segmented 510px |
| `/admin/competition/grand` | FAIL | FAIL | OK | OK | Segmented 515px |
| `/users/1` | OK | FAIL | FAIL | OK | Tab "Nghiệp Vụ & Đóng Góp" cắt @430; "Lịch Sử Mùa Giải" cắt @768 |
| `/dashboard` | OK | OK | OK | OK | Bảng KPI scroll ngang trong container (`overflow-x:auto`) — chấp nhận |
| `/leaderboard` | OK | OK | OK | OK | Tab strip có `overflowX:auto` — scroll được |
| `/admin/teams-youtube` | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Bảng rộng 1128px trong wrapper; cần xác nhận scroll affordance |

Không có trang nào tạo **horizontal page scroll** (scrollWidth = viewport) — lỗi là **clipping bên trong container**, khó phát hiện hơn.

---

## 9. CONSOLE / NETWORK PROBLEMS

### Console
- 2 warning React Router future flag trên **25/25 route** (50 lần) — P3 tech debt.
- 1 error `ERR_CONNECTION_REFUSED` cho ảnh tranh chết trên `/creative-corner` và `/` — P2 data.
- **0 pageerror / 0 uncaught exception** trên toàn bộ 25 route desktop + mobile.
- Không có warning duplicate key / hydration.

### Network
| Endpoint | Số lần / lần load | Trang |
|---|---:|---|
| `/api/users` | 22 | Admin Seasons |
| `/api/friends` | 4 | Leaderboard |
| `/api/friends/requests` | 4 | Leaderboard |
| `/api/chats/unread-counts` | 4 | Leaderboard |
| `/api/games/catalog` | 4 | Leaderboard, Games, Settings |
| `/api/kpi/departments|definitions|periods|users` | 3 mỗi loại | Admin KPI |
| `/api/games/arcade/active` | 5 / 10s | Arcade menu |
| `/api/games/arcade/leaderboard` | 5 / 10s | Arcade menu |

Không có 4xx/5xx ngoài các case cố ý mô phỏng. Không có request loop vô hạn.

---

## 10. ACCESSIBILITY

**Đã kiểm:** semantics button, accessible name, label input, alt ảnh, heading order, keyboard focus, modal focus trap/Escape, contrast tiêu đề, touch target.

| Kết quả | Chi tiết |
|---|---|
| Tốt | 25/25 route có đúng 1 `h1`; 0 button không tên (trừ 1 ở Admin Seasons); 0 ảnh thiếu `alt`; focus ring 2px solid rõ; tab order vào sidebar OK; gallery lightbox có `role="dialog"` + `aria-modal` + Escape |
| Kém | 108/110 select không nhãn (Admin Teams); 9 file modal thiếu role/aria-modal; Escape không đóng modal; không trap focus; toast lỗi `role=status`; 3 trang heading skip; touch target 24–30px; contrast H1 Grand 1.02:1 |

**Không dùng axe** (không có trong dependency) — không kết luận "a11y PASS"; chỉ kết luận các điểm đã đo.

---

## 11. SECURITY / PERMISSION

| Test | Kết quả |
|---|---|
| Member mở 7 route `/admin/*` | Redirect `/dashboard` (7/7) |
| Member sửa hồ sơ người khác | 403 |
| Member tự nâng `role=admin` | 403 |
| Member tự cấp `isDev` | 403 |
| Member tự đổi `teamId` | 403 |
| Member xóa user khác | 403 |
| Member xóa tranh người khác | 403 |
| Member đọc audit log | 403 |
| Member đổi settings drawing | 403 |
| Member tạo nhân sự | 403 |
| Member xem storage status | 403 |
| **Member đọc `/api/kpi/results` + history** | **200 — FAIL (WR-AUDIT-001)** |
| Member đọc `/api/kpi/departments` | 200 — chấp nhận (dashboard cần) |

**IDOR:** không phát hiện ngoài KPI read. `PATCH /api/users/:id` kiểm tra `isSelf/isAdmin`; `DELETE /api/drawings/:id` kiểm tra owner/admin.

**Lưu ý:** test `isVerified` ban đầu trả 200 do tài khoản audit đã có `isVerified=true` từ setup — **không phải lỗ hổng**; test lại với `isDev` cho 403.

---

## 12. PERFORMANCE

| Vấn đề | Số đo | Mức |
|---|---|---|
| Admin Teams YouTube DOM | 33.706 nodes, 27.433 options, 855k chars, 3.7s | P2 |
| Admin Seasons load | 22 request user + select 1.083 option, 2.5s | P2 |
| Duplicate requests | 4× (leaderboard), 3× (admin KPI) | P2 |
| Arcade idle polling | 2 API / 3s / user | P3 |
| Bundle | index 397KB (gzip 125KB), Leaderboard 62KB, AdminKpi 53KB | Chấp nhận |
| Route load (desktop, networkidle) | 1.8–5.4s; trung vị ~2.5s | Chấp nhận |
| Refresh | 1.4–2.3s | Chấp nhận |
| Layout shift | Không quan sát thấy; skeleton dashboard 20 phần tử | Tốt |

Không có rerender storm đo được; không có long task > 200ms trên các trang thường (không đo bằng PerformanceObserver — chỉ quan sát tương tác).

---

## 13. EXISTING TESTS

**Frontend**
```text
npm run check  → 93 files, 0 errors
npm run build  → PASS (4.61s)
```
Bundle lớn nhất: `index-DHJQqHjX.js` 397.35 kB (gzip 125.30 kB).

**Backend**
```text
tests 668 | pass 654 | fail 13 | skipped 1 | duration 458s
```

Phân loại 13 fail:
- **Concurrency / optimistic lock** (4 nhóm: Phase 3 stateful, Phase 5 hardening, Phase 9 concurrency, MVP concurrent award) — `SQLITE_MISUSE`/lock conflict trên sqlite, khớp ghi chú pre-existing.
- **Phase 9 Security fuzz** (3 test): kỳ vọng `400` nhưng nhận `403` ở `POST /api/competition/events/publish` — test dùng token không đủ quyền, validation không chạy tới; là test-fixture debt, không phải lỗ hổng mới.
- **`integration.test.js`**: hook teardown `SQLITE_MISUSE: Database is closed`.

**Kết luận:** test pass **không** phủ các lỗi UI/UX/data ở trên; ngược lại, 3 lỗi P1 đều không có test tương ứng.

---

## 14. SCREENSHOTS / EVIDENCE

Thư mục: `docs/audit/2026-10-23/full-sidebar/`

| File | Nội dung |
|---|---|
| `crawl.json` | 25 route × desktop/mobile: console, network, overflow, refresh, history |
| `navigation.json` | 22 sidebar item click/active, group expand, mobile drawer, truncation |
| `controls.json` | Inventory control từng route |
| `interactions.json` | YouTube/Leaderboard/Arena/Grand/Dashboard/Friends/Settings actions |
| `games-*.json` | 5 game solo end-to-end |
| `multiplayer-smoke.json` | create → join → ready → start → leave |
| `drawing-gallery.json` | vẽ, autosave, restore, publish state, like, lightbox, download |
| `admin-pages.json` | 7 admin page, 20 tab, filter, modal |
| `states.json` | empty (user mới), error (API 500), loading (delay 3s) |
| `security.json` | 13 kiểm tra permission/IDOR + route guard |
| `responsive-a11y.json` | 22 route × 6 width + a11y heuristics |
| `shots/grand-hero-desktop.png` | **Bằng chứng H1 vô hình** |
| `shots/mobile-_arena.png` | Tab/hero cắt mobile |
| `shots/mobile-_grand.png` | Hero cắt + title vô hình |
| `shots/mobile-_admin_operations.png` | Card/tab cắt |
| `shots/mobile-_admin_competition_seasons.png` | Filter cắt |
| `shots/gallery-lightbox.png` | Lightbox đúng chuẩn dialog |
| `shots/typing-room-lobby.png` | Phòng Đua Gõ Chữ tạo được |
| `shots/game-*-result.png` | Kết quả 5 game |

---

## 15. RECOMMENDED REMEDIATION ORDER

### PHASE A — P0/P1 (làm ngay, chặn release)

1. **WR-AUDIT-001** — thêm `requireRole('admin','manager')` cho `/api/kpi/results` + `/results/history`; viết test 403 cho member.
2. **WR-AUDIT-002** — set `color: var(--surface)` cho h1 hero Grand; thêm screenshot test/contrast check.
3. **WR-AUDIT-003** — bỏ counter denormalized hoặc reconcile; migration backfill `likes_count` từ `drawing_likes`; test like 5→6→5.

### PHASE B — P2 functional/logic/data

4. **WR-AUDIT-008** — migrate URL ảnh sang storage key; backfill; fallback ảnh.
5. **WR-AUDIT-004** — sửa `.ui-segmented` scroll + hero `min-width:0`; test 390/430.
6. **WR-AUDIT-005** — Modal primitive dùng chung (role, aria-modal, Escape, focus trap).
7. **WR-AUDIT-006/007/009** — virtualize bảng Teams; user picker search; dedupe request.
8. **WR-AUDIT-010/011/012** — copy "Recipients"; aria-label select; tooltip sidebar.

### PHASE C — UX/responsive còn lại

9. WR-AUDIT-013/014/015/016/017/019.
10. Dọn dữ liệu test season/grand (018) trước demo.

### PHASE D — polish

11. WR-AUDIT-020: future flags + polling theo visibility.
12. Rà soát toàn bộ copy tiếng Anh còn lại.

---

## MASTER BUG TABLE

| ID | Severity | Page | Type | Summary | Reproducible | Fix Priority |
|---|---|---|---|---|---|---|
| WR-AUDIT-001 | P1 | Quản Lý KPI (API) | SECURITY | Member đọc toàn bộ KPI results + history | Yes | 1 |
| WR-AUDIT-002 | P1 | Giải Vô Địch Năm | UI / A11Y | H1 đen trên nền đen, contrast 1.02:1 | Yes | 2 |
| WR-AUDIT-003 | P1 | Thư viện tranh | DATA | Like 5 → 1 → 0, lệch DB | Yes | 3 |
| WR-AUDIT-004 | P2 | Arena/Grand/Admin Ops/Seasons/Rules/Grand | RESPONSIVE | Mobile cắt hero + filter không bấm được | Yes | 4 |
| WR-AUDIT-005 | P2 | Friends/Admin Privileges/Admin Grand | ACCESSIBILITY | Modal thiếu role, Escape, focus trap | Yes | 6 |
| WR-AUDIT-006 | P2 | Quản Lý Đội & Kênh | PERFORMANCE | 33.7k DOM, 27.4k option | Yes | 7 |
| WR-AUDIT-007 | P2 | Quản Lý Mùa Giải | PERFORMANCE | 22 request user + select 1.083 option | Yes | 7 |
| WR-AUDIT-008 | P2 | Thư viện tranh / Trang chủ | DATA | Ảnh trỏ host chết 127.0.0.1:18900 | Yes | 4 |
| WR-AUDIT-009 | P2 | Leaderboard / Admin KPI | PERFORMANCE | Request trùng 3–4× | Yes | 7 |
| WR-AUDIT-010 | P2 | Trang chủ / Đăng nhập | UX | "Recipients" tiếng Anh | Yes | 8 |
| WR-AUDIT-011 | P2 | Admin Teams YouTube | ACCESSIBILITY | 108/110 select không nhãn | Yes | 8 |
| WR-AUDIT-012 | P2 | Sidebar | UX | 7 nhãn cắt, tooltip không đủ | Yes | 8 |
| WR-AUDIT-013 | P3 | Toàn cục | ACCESSIBILITY | Touch target 24–30px | Yes | 9 |
| WR-AUDIT-014 | P3 | Xưởng Vẽ | UX | Modal publish disable không lý do | Yes | 9 |
| WR-AUDIT-015 | P3 | YouTube | UX | URL compare không chuẩn hoá cho member | Yes | 9 |
| WR-AUDIT-016 | P3 | Admin KPI / Dashboard | UX | English strings | Yes | 11 |
| WR-AUDIT-017 | P3 | Toàn cục / 3 trang | ACCESSIBILITY | Toast role=status; heading skip | Yes | 9 |
| WR-AUDIT-018 | P3 | Arena / Grand / Admin Seasons | DATA | Tên season/grand test hiển thị thật | Yes | 10 |
| WR-AUDIT-019 | P3 | Admin Teams YouTube | UX | Lỗi API không có retry | Yes | 9 |
| WR-AUDIT-020 | P3 | Arcade / Toàn cục | PERF/TECH DEBT | Poll 3s; React Router warnings | Yes | 11 |

---

## FINAL GATES

```text
ROUTE_INVENTORY_COMPLETE:      PASS  (25 static + 5 dynamic room routes)
ALL_SIDEBAR_PAGES_OPENED:      PASS  (22/22)
ALL_SUBMENUS_AUDITED:          PASS  (20/20 tab/filter controls)
DESKTOP_AUDIT:                 PASS  (25/25 @1440)
MOBILE_AUDIT:                  PASS  (25/25 @390 + 6 widths cho 22 route)
NAVIGATION_AUDIT:              PASS  (click/active/deep link/refresh/back-forward)
FUNCTIONAL_AUDIT:              PASS  (5 game solo, 1 multiplayer smoke, settings save, gallery, admin tabs)
DATA_AUDIT:                    PASS  (đối chiếu DB/API; phát hiện 3 lỗi data)
NETWORK_AUDIT:                 PASS  (25 route + đo polling/dup)
CONSOLE_AUDIT:                 PASS  (0 pageerror; warning phân loại)
EMPTY_STATE_AUDIT:             PASS  (7 route với user mới)
ERROR_STATE_AUDIT:             PASS  (5 route với API 500)
LOADING_STATE_AUDIT:           PASS  (dashboard skeleton; youtube delay)
PERMISSION_AUDIT:              PASS  (13 API + 7 route guard)
PERSISTENCE_AUDIT:             PASS  (bio reload, draft reload, room/result DB)
ACCESSIBILITY_AUDIT:           PASS  (heuristic + keyboard + contrast; KHÔNG dùng axe)
RESPONSIVE_AUDIT:              PASS  (6 width × 22 route)
CROSS_PAGE_UX_AUDIT:           PASS
GAME_CENTER_SMOKE:             PASS
REPORT_COMPLETE:               PASS
```

**AUDIT COMPLETE** — với các mục UNVERIFIED đã liệt kê ở §2.3 (publish tranh do storage local, trận Đua Gõ Chữ 2 người, spectate, iOS/Safari thật, hành động phá huỷ admin).

---

*Hết báo cáo. Không có thay đổi source sản phẩm nào được thực hiện trong phase audit này; chỉ tạo script audit dưới `frontend/scripts/audit-*.mjs` và artifact trong `docs/audit/2026-10-23/full-sidebar/`.*
