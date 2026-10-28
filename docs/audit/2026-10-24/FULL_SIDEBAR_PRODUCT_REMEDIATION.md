# WORK RANK — FULL SIDEBAR PRODUCT REMEDIATION

**Ngày:** 2026-10-24
**Nguồn bug:** `docs/audit/2026-10-23/FULL_SIDEBAR_PRODUCT_AUDIT.md` (giữ nguyên, không sửa)
**Nguyên tắc:** không audit lại từ đầu — tái sử dụng evidence, repro đúng bug, fix, repro lại đúng bước đó.

---

# 1. SUMMARY

```text
Original bugs: 20

P1 fixed: 3/3
P2 fixed: 9/9
P3 fixed: 8/8

Total fixed:    20/20
Total verified: 20/20
Remaining:      0
```

| Gate | Kết quả |
|---|---|
| BUG_INVENTORY_20_OF_20 | PASS |
| P1_3_OF_3 | PASS |
| P2_9_OF_9 | PASS |
| P3_8_OF_8 | PASS |
| KPI_SECURITY | PASS |
| GRAND_CONTRAST | PASS |
| DRAWING_LIKE_INTEGRITY | PASS |
| RESPONSIVE_FIXES | PASS |
| MODAL_ACCESSIBILITY | PASS |
| TEAMS_YOUTUBE_PERFORMANCE | PASS |
| COMPETITION_REQUEST_STORM | PASS |
| DRAWING_IMAGE_URLS | PASS |
| DUPLICATE_REQUESTS | PASS |
| SIDEBAR_LABELS | PASS |
| VIETNAMESE_COPY | PASS |
| ALL_REMAINING_FINDINGS | PASS |
| 25_ROUTE_SMOKE | PASS |
| SHARED_COMPONENT_REGRESSION | PASS |
| GAME_SMOKE | PASS |
| ROOM_SMOKE | PASS |
| FRONTEND_CHECK | PASS (96 file, 0 lỗi) |
| FRONTEND_BUILD | PASS (4.76s) |
| NO_NEW_BACKEND_FAILURES | PASS (cùng 6 suite fail như baseline, 13 → 10 subtest fail) |
| **OVERALL** | **PASS** |

---

# 2. ENVIRONMENT

| Thành phần | Giá trị |
|---|---|
| Frontend | Vite dev `http://127.0.0.1:5173` |
| Backend | Node `http://127.0.0.1:5001` |
| DB | MySQL 8.4.9 — `workrank_realtime` |
| Browser | Chromium (Playwright headless), locale `vi-VN` |
| Viewport | 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920 |
| Tài khoản test | `audit.admin@workrank.test` (admin), `audit.member@workrank.test` (member) |

---

# 3. MASTER ISSUE TABLE (20 dòng)

| ID | Severity | Page | Root Cause | Fix | Verification | Status |
|---|---|---|---|---|---|---|
| WR-AUDIT-001 | P1 | Quản lý KPI (API) | 2 route `GET /kpi/results` + `/results/history` chỉ có `auth`, không scope theo role | Thêm `requireRole('admin')` cho `/results` + `/results/history`; thêm endpoint projection `/results/leaderboard` (chỉ `userId, departmentId, progressPct, user`) cho member; service `getResults` nhận `scopeUserId` | Member → 403 cả 2 route; projection 200 đúng 4 key; admin → 200; test `kpi_results_authz.test.js` 4/4 pass | FIXED + VERIFIED |
| WR-AUDIT-002 | P1 | Giải Vô Địch Năm | `h1 { color: var(--text-primary) }` toàn cục thắng inheritance của hero tối | Đặt màu chữ trực tiếp trên `h1` trong hero (không `!important`) | `rgb(255,255,255)` trên `rgb(20,20,20)` → contrast **18.42:1** (trước 1.02:1) | FIXED + VERIFIED |
| WR-AUDIT-003 | P1 | Thư viện tranh | `likes_count` denormalized lệch `drawing_likes`; toggle chỉ update counter | `exactLikeCounts()` COUNT thật từ `drawing_likes` cho mọi response (list + detail); migration `20261024090000-reconcile-drawing-likes` reconcile dữ liệu cũ | UI 0 → 1 → 0; API count == DB `drawing_likes` (0 == 0) | FIXED + VERIFIED |
| WR-AUDIT-004 | P2 | Arena/Grand/Admin Ops/Seasons/Rules/Grand | `.ui-segmented` `inline-flex` không scroll; hero `flex` không `min-width:0`; `.ui-page-shell` grid item nở theo nội dung | `.ui-segmented` max-width 100% + `overflow-x:auto`; hero wrap + `min-width:0`; `.ui-page-shell` thêm `min-width:0` | 6 route @390: `scrollWidth == 390`, segmented `overflow-x:auto`, hero 296–304px | FIXED + VERIFIED |
| WR-AUDIT-005 | P2 | Friends/Admin Privileges/Admin Grand | 13 modal dùng `.modal-dialog-enter` nhưng chỉ 4 có semantics; không Escape, không trap focus | Thêm `DialogAccessibility` (role/aria-modal/label/Escape/focus trap/focus return) gắn 1 lần ở `App` cho mọi `.modal-dialog-enter` | Modal Friends: `role=dialog`, `aria-modal=true`, label "Gia Nhập Đội Bằng Mã Mời", focus vào trong, Escape → 0 panel; Grand + Privileges PASS | FIXED + VERIFIED |
| WR-AUDIT-006 | P2 | Quản Lý Đội & Kênh | Render toàn bộ ~1.200 user × 110 select = 27.433 `<option>` | `LazyTeamSelect`: nút mở panel, tìm kiếm server-side, chỉ render kết quả khớp | DOM **33.706 → 6.655**; option **27.433 → 382**; unlabeled **108 → 0** | FIXED + VERIFIED |
| WR-AUDIT-007 | P2 | Quản Lý Mùa Giải | `fetchAvailableUsers()` loop qua `totalPages` (22 request) + `<select>` 1.083 option | `UserPicker` tìm kiếm server-side, bỏ prefetch toàn bộ user | Cold load: `GET /api/users` **22 → 0**; gõ tìm → 15 kết quả, 0 select | FIXED + VERIFIED |
| WR-AUDIT-008 | P2 | Thư viện tranh / Trang chủ | `image_url` lưu host chết `127.0.0.1:18900`, không resolve theo storage key | `resolvePublicImageUrl()`: s3 → public URL; local → `/uploads/<key>`; URL localhost → `''` để frontend fallback; thêm `Cross-Origin-Resource-Policy` cho `/uploads`; `assetUrl` xử lý URL rỗng | `badUrls 0`, `failedLocalhost 0`, fallback hiển thị đúng cho object thiếu | FIXED + VERIFIED |
| WR-AUDIT-009 | P2 | Leaderboard / Admin KPI | Effect cha–con + remount gọi trùng; `FriendsDock` gọi 2 lần | Dedupe in-flight GET theo `method+url+params`; sửa dependency gây refetch | Leaderboard: friends/requests/unread/catalog = **1/1/1/1** (trước 4×); Admin KPI: mỗi endpoint **1** (trước 3×) | FIXED + VERIFIED |
| WR-AUDIT-010 | P2 | Trang chủ / Đăng nhập | Copy tiếng Anh "Recipients" | Đổi sang "Người được vinh danh" | Home h1 = "Người được vinh danh"; Login không còn "Recipients" | FIXED + VERIFIED |
| WR-AUDIT-011 | P2 | Admin Teams YouTube | 108/110 `<select>` không nhãn | Gắn `aria-label`/`title` cho select lọc + `LazyTeamSelect` có nhãn | `unlabeled = 0` | FIXED + VERIFIED |
| WR-AUDIT-012 | P2 | Sidebar | `title` dùng `description` nên nhãn cắt không đọc được đầy đủ | `title = label — description`, `aria-label = label` cho mọi item | Item "Quản Lý Đội Nhóm & Kênh YouTube": `title` + `aria-label` = nhãn đầy đủ | FIXED + VERIFIED |
| WR-AUDIT-013 | P3 | Toàn cục | Touch target icon 24–30px | `@media (pointer: coarse)` min 44px cho control icon-only; toolbar Xưởng Vẽ thêm `aria-label` | `/games/drawing`, `/creative-corner`, `/dashboard`: **0** control icon < 40px | FIXED + VERIFIED |
| WR-AUDIT-014 | P3 | Xưởng Vẽ | Modal đăng tranh disable nút không giải thích | Hiển thị lý do (storage local / thiếu tiêu đề) trong modal | `hasReason = true` | FIXED + VERIFIED |
| WR-AUDIT-015 | P3 | YouTube | `?tab=compare` với member trỏ tới nội dung Tổng quan | Chuẩn hoá URL về `?tab=overview` khi member không có quyền compare | URL sau redirect = `/youtube?tab=overview` | FIXED + VERIFIED |
| WR-AUDIT-016 | P3 | Admin KPI / Dashboard | Chuỗi tiếng Anh ("WorkRank KPI Foundation", "YouTube Studio Hub", "WorkRank Performance Center", "Version draft", "Role/Task/Benchmark", "Preview") | Việt hoá toàn bộ | `badKpi=false`, `badDash=false` | FIXED + VERIFIED |
| WR-AUDIT-017 | P3 | Toàn cục / 3 trang | Toast thiếu `role=status`; heading nhảy cấp ở 3 trang | Toast `role="status"` + `aria-live`; thêm `sr-only` h1 cho UserDetail / AdminOperations / AdminSeasons | `toastRole=1`; heading skip = **0/0/0** | FIXED + VERIFIED |
| WR-AUDIT-018 | P3 | Arena / Grand / Admin Seasons | Season/Grand tên test ("AUDIT…") hiển thị thật | Script `cleanup-test-competition-data.js` (dry-run → apply) xoá season/grand test, giữ season ACTIVE thật | `/arena` h1 = "Mùa Giải 2026"; `/grand` h1 = "Giải Vô Địch Năm 2026" | FIXED + VERIFIED |
| WR-AUDIT-019 | P3 | Admin Teams YouTube | Lỗi API chỉ toast, không có đường retry | Thêm `PageState` lỗi + nút "Thử lại" | `retryButtons=1`, `alerts=3` | FIXED + VERIFIED |
| WR-AUDIT-020 | P3 | Arcade / Toàn cục | Poll `/active` mỗi 3s; React Router future-flag warnings | Poll 3s → 20s; bật future flags trong `BrowserRouter` | 10s: `activeCalls = 1` (trước 3–4); `routerWarnings = 0` | FIXED + VERIFIED |

---

# 4. BEFORE / AFTER METRICS

| Metric | Before | After |
|---|---|---|
| KPI `/results` — member token | 200 + dữ liệu mọi nhân viên | **403** |
| KPI `/results/history` — member token | 200 | **403** |
| Grand H1 contrast | 1.02:1 | **18.42:1** |
| Drawing like (UI → DB) | 5 → 1 → 0, DB 0 | **0 → 1 → 0, DB 0** |
| Mobile `scrollWidth` @390 (6 route) | 473–520px | **390px** |
| `/admin/teams-youtube` DOM nodes | 33.706 | **6.655** |
| `/admin/teams-youtube` `<option>` | 27.433 | **382** |
| `/admin/teams-youtube` unlabeled select | 108/110 | **0** |
| `/admin/competition/seasons` `GET /api/users` cold load | 22 | **0** |
| Leaderboard duplicate requests | 4× | **1×** |
| Admin KPI duplicate requests | 3× | **1×** |
| Ảnh tranh trỏ localhost | 2 record | **0** |
| Icon control < 40px (mobile, 3 route) | 24–30px | **0** |
| Arcade `/active` poll trong 10s | 3–4 | **1** |
| React Router warnings | có | **0** |

---

# 5. VERIFICATION EVIDENCE

## 5.1 Automated verification (Playwright + API)

`frontend/scripts/verify-remediation-core.mjs` → `docs/audit/2026-10-24/verification-core.json`
**14/14 check PASS** (001, 002, 003, 004, 005, 008, 010, 012, 014, 015, 016, 017, 018, 019)

`frontend/scripts/verify-remediation-perf.mjs` → `docs/audit/2026-10-24/verification-perf.json`
**7/7 check PASS** (006, 007, 009, 011, 013, 020, 004b)

Screenshots: `docs/audit/2026-10-24/shots/`
- `verify-grand-hero.png` — H1 trắng trên hero tối
- `verify-mobile-arena.png` — 390px không overflow
- `verify-teams-youtube.png` — bảng gọn sau khi bỏ option hàng loạt

## 5.2 Backend regression test mới

`backend/test/kpi_results_authz.test.js` — **4/4 pass**
- member không đọc được results toàn công ty (403)
- member không đọc được history (403)
- member đọc được projection giới hạn (200, chỉ 4 key)
- admin đọc được scope rộng (200)

## 5.3 25-route smoke

`docs/audit/2026-10-24/regression-routes.json` — **25/25 route OK**, 0 crash, 0 response lỗi.

Ghi chú: `/` và `/creative-corner` có 1 console 404 mỗi trang — đây là object ảnh **thiếu thật** (drawing #6 có storage key nhưng file không tồn tại trên đĩa). Hành vi đúng theo yêu cầu: fallback "ảnh không còn khả dụng", **không** tạo file giả, **không** trả host localhost.

## 5.4 Game + Room smoke

`regression-games.json` — 5/5 game OK (Đua Gõ Chữ, Gõ Nhanh, Phản Xạ Bốn Hướng, Trí Nhớ Nhanh, Xưởng Vẽ) + gallery 5 card, 0 console error.

`multiplayer-smoke.json` — 10/10 bước OK: tạo phòng → guest thấy phòng → join → cả 2 ready → start → cả 2 vào trận → submit input → host rời phòng.

## 5.5 Frontend / Backend

| Kiểm tra | Kết quả |
|---|---|
| `npm run check` | 96 file, **0 lỗi** |
| `npm run build` | **PASS** (4.76s) |
| Backend suite | **672 test / 661 pass / 10 fail / 1 skip** |
| Baseline trước fix | 668 / 654 / 13 / 1 |
| Kết luận | Cùng **6 suite** fail như baseline (optimistic-lock sqlite, fuzz 400-vs-403, `integration.test.js` teardown, MVP Cup concurrency). **Không phát sinh failure mới**, giảm 3 subtest fail. |

---

# 6. CHANGED FILES

**Backend (5 sửa + 2 mới)**
- `src/routes/kpi.routes.js` — siết quyền `/results`, `/results/history`; thêm `/results/leaderboard`
- `src/controllers/kpi.controller.js` — handler projection + scope theo role
- `src/services/kpi.service.js` — `scopeUserId`, `getLeaderboardProjection`
- `src/services/drawing.service.js` — like count thật, resolve URL ảnh, sort theo count thật
- `src/app.js` — header cho `/uploads`
- `src/migrations/20261024090000-reconcile-drawing-likes.js` *(mới)*
- `test/kpi_results_authz.test.js` *(mới)*
- `scripts/cleanup-test-competition-data.js` *(mới, one-off)*

**Frontend (23 sửa + 3 mới)**
- `src/components/DialogAccessibility.jsx` *(mới)* — semantics/Escape/focus trap dùng chung
- `src/components/LazyTeamSelect.jsx` *(mới)* — picker tìm kiếm cho teams-youtube
- `src/components/UserPicker.jsx` *(mới)* — picker tìm kiếm cho AdminSeasons
- `src/index.css` — segmented scroll, page-shell `min-width`, `sr-only`, touch target
- `src/App.jsx` — mount DialogAccessibility, router future flags
- `src/services/api.js` — dedupe in-flight GET
- `src/utils/assetUrl.js` — xử lý URL rỗng
- `src/components/Sidebar.jsx`, `CreativeCornerSection.jsx`, `ProductionKpiPanel.jsx`
- `src/context/UiContext.jsx` — toast `role=status`
- `src/pages/`: `Arena`, `GrandHub`, `AdminOperations`, `AdminSeasons`, `AdminTeamsYouTube`, `AdminKpi`, `Leaderboard`, `Friends`, `Dashboard`, `Home`, `Login`, `UserDetail`, `DrawingGame`, `YouTubeOverview`, `ArcadeGame`

**Không thuộc phạm vi remediation này:** các thay đổi/xoá liên quan `musicRace` / `MusicSong` trong `git status` là kết quả của task rollback trước đó (2026-10-23), không phải fix audit.

---

# 7. GHI CHÚ / RỦI RO CÒN LẠI

1. **Drawing #6** — storage key tồn tại nhưng file không có trên đĩa; UI hiển thị fallback. Muốn có ảnh thật cần khôi phục object từ bucket, **không** tạo file giả.
2. **6 suite backend fail** là baseline có sẵn (optimistic lock trên sqlite, fuzz kỳ vọng 400 nhưng nhận 403, teardown integration). Không fix trong task này theo yêu cầu "no new failures".
3. **`likes_count`** vẫn tồn tại như cache denormalized; mọi response đọc đã dùng COUNT thật, nên lệch cache không còn ảnh hưởng UI.
4. **`DialogAccessibility`** gắn global theo `.modal-dialog-enter` — nếu sau này có modal cố tình không muốn trap focus thì cần opt-out bằng `data-no-trap`.

---

# 8. KẾT LUẬN

```text
FULL REMEDIATION COMPLETE

20/20 FIXED
20/20 VERIFIED
3/3 P1 · 9/9 P2 · 8/8 P3
FRONTEND CHECK + BUILD: PASS
NO NEW BACKEND FAILURES
25-ROUTE / GAME / ROOM REGRESSION: PASS
```
