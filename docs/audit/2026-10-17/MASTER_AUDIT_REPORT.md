# MASTER AUDIT REPORT — WORK RANK

| ID | Area | Page | Bug | Severity | Status |
|---|---|---|---|---|---|
| BUG-001 | Permission / API / Persistence | `/games/2048` | 2048 không kiểm tra chủ sở hữu phiên; bộ nhớ trình duyệt dùng chung giữa tài khoản | **P1** | REPRODUCED |
| BUG-002 | Permission / API / Data | `/api/competition/events/publish; /integration/*` | Tài khoản thường có thể ghi sự kiện sản xuất với danh tính người khác | **P1** | REPRODUCED |
| BUG-003 | Auth / Session | `/settings; /api/auth/refresh-token` | Đổi mật khẩu không thu hồi refresh token đã cấp | **P1** | REPRODUCED |
| BUG-004 | Background process / Logic / Realtime | `Arena / Grand / Admin Operations / backend startup` | Worker xử lý competition và outbox tồn tại nhưng không được khởi động | **P1** | REPRODUCED |
| BUG-005 | Tooling / Data safety | `backend npm test` | Lệnh test backend có thể dùng DB thật và xóa toàn bộ bảng nghiệp vụ | **P1** | CODE CONFIRMED — không chạy phá dữ liệu |
| BUG-006 | Database / API / Core workflow | `/games/sam` | Sâm Lốc không tạo được phòng trên schema MySQL được migrate | **P1** | REPRODUCED |
| BUG-007 | API / SQL / Navigation | `/games/capital-board` | Danh sách phòng Capital Board trả 500 vì ORDER BY mơ hồ | **P1** | REPRODUCED |
| BUG-008 | Persistence / Routing / State | `/games/2048 → /dashboard → /games/2048` | 2048 mất tiến độ khi đi sang trang khác trước kỳ checkpoint | **P1** | REPRODUCED |
| BUG-009 | Realtime / Persistence / Lifecycle | `/games/typing/room/:roomId` | Typing reload không khôi phục bài đang gõ và ghi số 0 đè tiến độ server | **P1** | REPRODUCED |
| BUG-010 | Scoring / Validation / Logic | `Typing RANKED; /api/games/typing/rooms/:id/finish` | Typing vẫn chấm hoàn thành và thưởng điểm khi không gõ; anti-cheat chỉ log | **P1** | REPRODUCED |
| BUG-011 | Session / State synchronization | `Toàn bộ protected routes` | Nhiều tab dùng token tài khoản mới nhưng UI giữ danh tính tài khoản cũ | **P1** | REPRODUCED |
| BUG-012 | Auth / Error handling | `Auth bootstrap; /settings` | Lỗi mạng/500 lúc kiểm tra phiên và xóa tài khoản thất bại đều làm logout | **P1** | REPRODUCED |
| BUG-013 | Data accuracy / Error state / Operations | `/admin/operations` | Giám sát vận hành báo Online/100% khi dữ liệu lỗi hoặc worker không chạy | **P1** | REPRODUCED |
| BUG-014 | State / Routing / UX | `FriendsDock trên toàn bộ Layout` | Chuyển route làm đóng hội thoại và mất bản nháp chat | **P2** | REPRODUCED |
| BUG-015 | Data / Statistics | `/games/2048; my-stats` | 2048 đếm một ván thành hai ván khi có checkpoint trước submit | **P2** | REPRODUCED |
| BUG-016 | Responsive / Layout / UX | `Typing; Admin Operations; Admin Teams YouTube; một số trang competition/KPI` | Nhiều trang tràn ngang bên trong main trên màn hình 390px | **P2** | REPRODUCED |
| BUG-017 | Accessibility / Overlay | `AnimatedModal: Capital rules/create, Quiz và các form dùng chung` | Modal dùng chung chưa quản lý focus bàn phím | **P2** | REPRODUCED |
| BUG-018 | Data mapping / Form / UX | `JobTitleBadge; /admin/privileges` | Chức danh lạ bị hiển thị Editor; giá trị mặc định form khác option đang thấy | **P2** | REPRODUCED |
| BUG-019 | Tooling / Database setup | `backend npm run db:seed` | Lệnh seed toàn bộ dừng ở typingChallenges.seeder vì thiếu up/down | **P2** | REPRODUCED |
| BUG-020 | Persistence / Navigation / UX | `/games/drawing` | Rời trang vẽ làm mất nét chưa lưu mà không có cảnh báo | **P2** | REPRODUCED |
| BUG-021 | Visual / Accessibility / CSS | `/arena và /grand khi có giải ACTIVE` | Tiêu đề mùa giải Arena và Grand gần như chìm vào nền tối | **P2** | REPRODUCED |
| BUG-022 | Testing / Regression / Performance | `backend/test; frontend/tests; frontend scripts` | Test harness chưa đủ tin cậy để làm cổng phát hành | **P2** | OBSERVED + CODE CONFIRMED; log dài cũ không còn |
| BUG-023 | Maintenance / Documentation | `Groups.jsx; StatsCard.jsx; README_BACKEND_NEW.md` | Source không gắn route và tài liệu backend cũ gây hiểu nhầm phạm vi sản phẩm | **P3** | CODE CONFIRMED |

## Kết luận và phạm vi

Audit ngày **16–17/10/2026**, múi giờ Asia/Ho_Chi_Minh. Source commit `cd1523c7bf0b0352ff768a03dbf1b27c99798133`. Phát hiện **23 vấn đề: P0=0, P1=13, P2=9, P3=1**. Đây là danh sách vấn đề xác nhận trong phạm vi đã kiểm tra, không phải chứng nhận không còn lỗi. Chưa nên dùng bản hiện tại làm bản phát hành ổn định khi các P1 còn mở.

Phân loại: BUG là hành vi sai đã có contract/chứng cứ; UX ISSUE là bảo vệ/khả năng dùng của luồng hiện hữu; TECH DEBT là rủi ro bảo trì/kiểm thử. BUG-005 được xếp TECH DEBT P1 vì nguy cơ xóa dữ liệu từ cấu hình test, chưa gây mất dữ liệu thật. Không đếm đề xuất tính năng mới thành BUG. Không phát hiện P0 đã chứng minh làm sập toàn hệ thống hoặc phá dữ liệu production trong lượt này; P0=0 không có nghĩa đã loại trừ mọi rủi ro bảo mật.

Audit có đọc source, chạy backend/frontend, thao tác Chromium thật, hai tài khoản/hai context, API thật, MySQL thật, inject lỗi có chủ đích và đo responsive. Không sửa mã ứng dụng hay redesign. Hai DB kiểm thử riêng được dùng; không chạy hooks xóa bảng trên DB mặc định của người dùng.

**Giới hạn lưu vết:** thư mục tạm lượt 16 đã bị dọn khi tiếp tục. Tổng số suite dài trong báo cáo lấy từ kết quả đã quan sát trong phiên trước; log gốc không còn. Bằng chứng tái tạo ngày 17 nằm tại [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [crawl.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/crawl.json), [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json), [typing-recovery.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/typing-recovery.json), [states-navigation.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/states-navigation.json), [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json). Chi tiết nguồn: [SESSION_NOTE.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/SESSION_NOTE.md). Các kết luận không tái tạo đầy đủ được ghi rõ trong issue/coverage.

## Kiến trúc và inventory

| Lớp | Hiện trạng | Vai trò và rủi ro chính |
|---|---|---|
| Frontend | React18, Vite5, React Router6, JS/JSX | Lazy pages; Suspense; ProtectedRoute/AdminRoute; Layout/Sidebar/FriendsDock. Error boundary key theo location remount shell. |
| State | AuthProvider, UiProvider, local useState/ref | User/socket toàn ứng dụng; phần lớn page state cục bộ. Chưa có owner bền cho draft/session UI. |
| API/cache | Axios + TTL memory cache/coalescing | Refresh session qua interceptor; token localStorage. Cache tests kiểm cơ chế cache, không chứng minh mọi caller invalidation đúng. |
| Realtime | Socket.IO client singleton và các realtime service server | User/team/presence/chat/game events. HTTP rehydrate + socket update cùng tác động state. |
| Backend | Express5, controllers/services, Zod ở một số route | JWT middleware/RBAC admin; một số integration thiếu policy resource/actor. |
| DB | Sequelize6 + MySQL; SQLite trong một số tests | 73 model modules + index.js; migration chính thức, một số ensureSchema ở startup. Schema/model mismatch Sâm. |
| Workers | YouTube sync + keepAlive được nối startup | Competition engine + outbox dispatcher có implementation nhưng chưa nối process startup trong repo. |
| Storage | JWT/refresh, avatar prefs/cache và 2048 localStorage; chunk reload flag sessionStorage | Không phát hiện IndexedDB là nguồn authoritative cho game/draft trong mã đã rà. Không có embedded PTY/process manager. |
| UI | index.css tokens, ui.jsx, AnimatedModal, PageState, notices/toasts, riêng một số admin dialogs | Shared motion/modal tồn tại; focus chưa được quản lý; admin dialogs riêng làm coverage/behavior không đồng nhất. |

Inventory tự động: **43 Route declarations**, gồm 25 mẫu trang chính,5 mẫu room/spectate động,12 alias và wildcard. **310 khai báo router HTTP handler** trong source; parser tách 299 path literal (còn lại dùng cú pháp/multiline khác). Đây không phải số endpoint URL duy nhất sau mount, cũng không phải số đã test. **115 file JS/JSX frontend**, 26 page files (25 page đang gắn route và Groups cũ). Xem danh sách từng route/API trong [inventory.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/inventory.json).

Không có terminal nhúng, PTY, Chairman/Executive Office hay agent/task manager trong sản phẩm hiện tại để kiểm theo các mục tùy chọn trong yêu cầu. Các alias tracking/productivity cũ chuyển về Dashboard; không ghi việc thiếu sản phẩm khác thành bug.

### Bản đồ Page → Component → State → API → Data → Action → Expected

| Page / Component | State | API / Data | Action → Expected |
|---|---|---|---|
| Home | recognition/gallery/loading | public recognition, drawings | đổi danh mục/xem vinh danh → dữ liệu public đúng, ảnh/tên nhất quán |
| Login | login/register form + auth user | auth login/register/refresh; User | submit → auth session, redirect trang đích, lỗi giữ input |
| Dashboard / AdminKpi | kỳ KPI, filters, form, loading | dashboard/kpi; KpiTarget/KpiActual/Department | chọn kỳ, tạo target/actual → KPI và BXH cùng nguồn dữ liệu |
| Leaderboard | scope/tab/period/query | leaderboard/rankings/competition read models | đổi cá nhân/đội/kỳ → URL và bảng nhất quán |
| YouTubeOverview / AdminTeamsYouTube | team/channel/filter/sync | youtube APIs, Team/Channel/Snapshot | tạo/gán kênh, đọc số liệu → mapping đúng và sync có trạng thái thật |
| Arena / GrandHub | active season/grand/tab/loading | competition season/grand/rankings/events | đổi tab, xem giải → dữ liệu giải hiện tại, empty/error riêng |
| Friends / FriendsDock | search, selected peer, draft, messages, presence | friends/chats + sockets; User/ChatMessage | tìm, mở chat, gửi → đúng peer và giữ draft qua route |
| UserDetail / Settings | profileId, account/prefs/edit state | users/auth, profile preferences | xem/sửa/password/delete → dữ liệu đúng chủ, lỗi không làm mất session |
| GameHub | catalog/availability | game catalog | mở game → quyền và availability nhất quán client/server |
| Game2048 | tiles/score/moves/session refs + localStorage | start/checkpoint/submit/active-session; Score/UserStat | chơi/route/reload/exit → snapshot không lùi, owner đúng, final một lần |
| CapitalBoardGame | lobby/room/players/turn/modal + socket | /games/rooms/actions; Capital models | tạo/join/bot/start/roll → turn server authoritative |
| QuizGame / AdminQuiz | sets/questions/room/round/answer/timer | quiz/admin quiz APIs + sockets | quản câu hỏi, start, answer → một đáp án/vòng, kết quả hữu hạn |
| SamGame | lobby/room/cards/turn/bots | sam APIs + sockets; SamRoom/Player | create/join/ready/start/play → phòng dùng được trên schema migrate |
| TypingBattle | hub/room/typedText/errors/timer/players/result | typing APIs + sockets; TypingRoom/Player/Result/ScoreLedger | ready/type/reload/finish → tiến độ bền, điểm chỉ cho bài hợp lệ |
| DrawingGame | canvas/undo/redo/tool/preview/form | drawings API; Drawing models/media | vẽ/undo/export/publish → tác phẩm lưu được, không mất draft vô ý |
| AdminPrivileges | users/search/filter/create/edit/modals | users/admin privileges/awards | tạo/sửa/quyền → hiển thị/payload/DB khớp |
| AdminSeasons / CompetitionAdmin / AdminGrand | lists/drafts/rules/actions | competition admin; Season/RuleSet/Version/Grand | tạo/activate/link/publish → lifecycle và quyền đúng |
| AdminOperations | health/log/events/projections/trace | integration health, audit logs, projections, youtube health | refresh/filter/retry/trace → trạng thái đo được, lỗi không giả healthy |

## Kiểm thử và bằng chứng

| Lệnh / Kịch bản | Kết quả | Phạm vi diễn giải |
|---|---|---|
| Frontend check + build, chạy lại 17/10 | PASS;115 files, Vite build khoảng 2.6s | Không phải typecheck; build có warning duplicate keys Friends.jsx. [frontend-build.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/frontend-build.log) |
| npm run test:routes, chạy lại 17/10 |20 pass/0 fail | Smoke kiểm component/import; không test43 route lifecycle. [route-smoke.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/route-smoke.log) |
| test-cache-system.js |10/10 pass ở lượt 16; log lượt 17 kèm theo | Kiểm cache unit; không chứng minh cross-user isolation. [cache-test.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/cache-test.log) |
| Backend lint, chạy lại 17/10 |PASS | Chỉ node --check src/server.js. [backend-lint.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/backend-lint.log) |
| db:migrate MySQL riêng, lượt 16 |PASS | Hai DB audit tồn tại, schema Sâm mismatch vẫn tái hiện. [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json) |
| db:seed, chạy lại 17/10 |FAIL thiếu up | BUG-019. [seed.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/seed.log) |
| Backend MySQL full suite,16/10 |599:553 pass,38 fail,8 cancelled; khoảng 630.7s | Log gốc không còn. Một lỗi schema gây nhiều failures; không đếm38 thành38bug. |
| Backend SQLite memory,16/10 |600:42 pass,283 fail,275 cancelled | Nhiều no such table do chưa boot schema; lỗi harness, không phải283bug. Log gốc không còn. |
| Playwright toàn bộ,16/10 |172:158 pass,14 fail | Có live endpoint chưa sẵn, selector/headings cũ, race. Log gốc không còn. |
| Playwright chạy lại public-recognition+sam,16/10 |36:28 pass,8 fail | Sam scenarios mock qua; remaining public expectation không đồng nhất. Không thay thế game Sâm thật bị500. |
| Performance isolated,16/10 |50 request;P50=74.98ms,P95=332.71ms,P99=586ms;PASS | Fail P95~967.12ms khi chạy đồng thời không đủ kết luận regression. Không có CWV/soak/120Hz benchmark. Log gốc không còn. |
| Browser thực tế + API,17/10 |25 trang,7 viewport,50 ảnh; ownership/auth/session/scoring probes | Crawl và replay có artifact mới. [crawl.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/crawl.json), [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json) |

Các response500 do inject được ghi rõ là mô phỏng để kiểm error UI. Capital/Sâm500 là lỗi backend thật trên schema migrate. Một số test game hiện có dùng mock nên trạng thái xanh không chứng minh gameplay backend tương ứng hoạt động.

## Chi tiết từng vấn đề

### BUG-001 — 2048 không kiểm tra chủ sở hữu phiên; bộ nhớ trình duyệt dùng chung giữa tài khoản

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Permission / API / Persistence

**Location:** `/games/2048`

**Steps to reproduce:**

1. A tạo phiên 2048 và lấy gameSessionId.
2. B đăng nhập riêng, gọi checkpoint và submit với mã phiên của A.
3. Trên cùng trình duyệt, A chơi và chờ checkpoint; đăng xuất rồi đăng nhập B, mở 2048.

**Observed behavior:**

Checkpoint và submit bằng token B đều trả 200 cho phiên A. Phiên đang ACTIVE của A bị sửa/kết thúc. Trình duyệt B hiển thị tên B nhưng tải lại cùng gameSessionId và 252 điểm của A từ localStorage. Khi A có nhiều phiên ACTIVE cũ, active-session sau khi B submit có thể trả phiên cũ khác; điều này không có nghĩa phiên vừa bị can thiệp còn ACTIVE.

**Expected behavior:**

Mọi lần đọc/ghi/kết thúc phiên phải ràng buộc với req.user.id. Dữ liệu lưu ở máy phải thuộc đúng tài khoản và được xác thực với server.

**Root cause:**

checkpointSession và submitScore tìm Game2048Score bằng gameSessionId mà không kèm userId; không kiểm tra ownership trước cập nhật. initSession tin bản ghi wr_2048_active_session chung toàn origin, không lưu/xác thực userId; clearAuth chỉ xóa token và cache API.

**Affected code:**

- [backend/src/services/game2048.service.js:121](/Applications/du-an/workrank/workrank-realtime/backend/src/services/game2048.service.js:121)
- [frontend/src/pages/Game2048.jsx:32](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Game2048.jsx:32)
- [frontend/src/pages/Game2048.jsx:184](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Game2048.jsx:184)
- [frontend/src/services/api.js:21](/Applications/du-an/workrank/workrank-realtime/frontend/src/services/api.js:21)

**Impact:**

Can thiệp kết quả và trạng thái người khác khi biết mã phiên; dùng chung trình duyệt là một đường lộ mã thực tế. ID phiên ngẫu nhiên làm giảm khả năng đoán từ xa, không thay thế quyền sở hữu.

**Recommended fix:**

Lọc và khóa phiên bằng cả gameSessionId + userId; trả 404/403 khi không thuộc người gọi. Không tự tạo bản ghi mới từ mã phiên không hợp lệ. Namespace localStorage theo userId/schemaVersion, kiểm tra server trước phục hồi, xóa dữ liệu tài khoản khi logout.

**Regression risk:**

Phiên đang chơi, đồng bộ nhiều tab, retry checkpoint và dữ liệu lưu phiên bản cũ cần migration nhẹ.

**How to verify after fix:**

A/B trên hai context: B không ghi/submit được phiên A; dữ liệu A nguyên vẹn. Trên cùng origin đổi A→B không phục hồi phiên A. A refresh vẫn tiếp tục phiên của mình.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [reproduce.cjs](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduce.cjs)

---

### BUG-002 — Tài khoản thường có thể ghi sự kiện sản xuất với danh tính người khác

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Permission / API / Data

**Location:** `/api/competition/events/publish; /integration/*`

**Steps to reproduce:**

1. Đăng nhập Alice (role user).
2. POST /api/competition/integration/production/video-action với action=video_approved, actorId=35 (admin), videoId fixture chưa có workflow duyệt thật.
3. Kiểm tra response và trạng thái sự kiện.

**Observed behavior:**

API trả 201, lưu VIDEO_APPROVED actorId=35 dù người gọi là user 36. Các route publish/production/youtube/community chỉ yêu cầu auth. Có thể cung cấp các trường teamId/seasonId/payload từ client; chưa chứng minh tất cả biến thể đều tạo điểm.

**Expected behavior:**

Danh tính actor lấy từ người gọi hoặc integration đáng tin cậy. Người dùng không được tự khai báo một hành động duyệt sản xuất/YouTube đã xảy ra khi không có quyền và tài nguyên tương ứng.

**Root cause:**

Router thiếu policy nghiệp vụ; controller truyền thẳng req.body/params vào ingestion service. Production service nhận actorId từ payload và xây domain event; không xác thực video ownership/workflow ở ranh giới này.

**Affected code:**

- [backend/src/routes/competition.routes.js:104](/Applications/du-an/workrank/workrank-realtime/backend/src/routes/competition.routes.js:104)
- [backend/src/controllers/competition.controller.js:683](/Applications/du-an/workrank/workrank-realtime/backend/src/controllers/competition.controller.js:683)
- [backend/src/controllers/competition.controller.js:719](/Applications/du-an/workrank/workrank-realtime/backend/src/controllers/competition.controller.js:719)
- [backend/src/services/competition/productionIntegration.service.js:21](/Applications/du-an/workrank/workrank-realtime/backend/src/services/competition/productionIntegration.service.js:21)

**Impact:**

Làm giả nhật ký nghiệp vụ và đầu vào chấm điểm. Chưa quan sát phát sinh điểm trái phép vì worker chấm điểm chưa được chạy (BUG-004); không xem worker đang tắt là biện pháp bảo vệ.

**Recommended fix:**

Đóng route ingestion cho integration được xác thực hoặc service nội bộ. Với route người dùng, áp policy theo action/resource, lấy actor từ req.user, xác minh trạng thái sản xuất và idempotency ở server; kiểm tra team/season.

**Regression risk:**

Các integration hợp lệ và replay/import lịch sử có thể cần cơ chế service principal riêng.

**How to verify after fix:**

User thường gửi actorId khác bị từ chối; request không có video hợp lệ không tạo event. Integration hợp lệ vẫn tạo đúng một event và một bộ effects khi retry.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-003 — Đổi mật khẩu không thu hồi refresh token đã cấp

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Auth / Session

**Location:** `/settings; /api/auth/refresh-token`

**Steps to reproduce:**

1. Đăng nhập và giữ refresh token R.
2. Đổi mật khẩu qua PATCH /api/auth/password.
3. Dùng R cũ để POST /api/auth/refresh-token.

**Observed behavior:**

Đổi mật khẩu thành công; token R cũ vẫn refresh trả 200 và user 36. Lượt 16/10 cũng quan sát refresh sau logout vẫn 200. Logout hiện được code mô tả là logout cục bộ; lỗi chính ở đây là đổi mật khẩu không vô hiệu hóa thông tin xác thực cũ.

**Expected behavior:**

Đổi mật khẩu phải thu hồi các refresh session cũ theo chính sách rõ ràng; token bị lộ trước đó không thể tiếp tục cấp access token mới.

**Root cause:**

Refresh chỉ xác minh chữ ký/hạn JWT và trạng thái user. issueTokens không lưu session/token hash hoặc tokenVersion; changePassword chỉ thay passwordHash và lastSeenAt.

**Affected code:**

- [backend/src/services/auth.service.js:20](/Applications/du-an/workrank/workrank-realtime/backend/src/services/auth.service.js:20)
- [backend/src/services/auth.service.js:66](/Applications/du-an/workrank/workrank-realtime/backend/src/services/auth.service.js:66)
- [backend/src/services/auth.service.js:111](/Applications/du-an/workrank/workrank-realtime/backend/src/services/auth.service.js:111)

**Impact:**

Người giữ refresh token cũ có thể tiếp tục truy cập sau khi chủ tài khoản đổi mật khẩu, trong thời hạn refresh token.

**Recommended fix:**

Thêm refresh sessions hoặc tokenVersion/credentialsChangedAt; rotate refresh token và phát hiện reuse. Thu hồi session khi đổi mật khẩu; xác định chính sách giữ phiên hiện tại và logout.

**Regression risk:**

Có thể buộc đăng nhập lại người dùng hiện tại; cần triển khai tương thích token cũ và socket đang mở.

**How to verify after fix:**

R trước đổi mật khẩu trả 401 sau thay đổi; token mới hoạt động; account locked vẫn 403; logout theo policy được kiểm tra riêng.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-004 — Worker xử lý competition và outbox tồn tại nhưng không được khởi động

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Background process / Logic / Realtime

**Location:** `Arena / Grand / Admin Operations / backend startup`

**Steps to reproduce:**

1. Khởi động backend bằng npm start hoặc node src/server.js.
2. Tạo domain event hợp lệ/fixture.
3. Chờ trên 60 giây, đọc event status và integration health.

**Observed behavior:**

Event mới vẫn PENDING sau khoảng 70 giây; event của lượt 16/10 cũng còn PENDING ngày 17/10. Health trả pendingCount=2, processedCount=0, status=HEALTHY. event_outbox đang rỗng trong fixture: bằng chứng runtime này trực tiếp chứng minh competition_events không tiêu thụ; phần dispatcher không được nối xác nhận qua source.

**Expected behavior:**

Deployment có worker consumer rõ ràng, tự khởi động hoặc process riêng được cấu hình. Event tiến tới PROCESSED/FAILED/IGNORED; hệ thống phát hiện consumer chết hoặc pending quá hạn.

**Root cause:**

server.js chỉ khởi động YouTube sync và keepAlive, gắn realtime rồi listen; không import/start competitionEngine.worker hay outboxDispatcher.worker. Package scripts không khai báo worker process riêng. Health chỉ xem số FAILED, không có heartbeat/tuổi pending.

**Affected code:**

- [backend/src/server.js:13](/Applications/du-an/workrank/workrank-realtime/backend/src/server.js:13)
- [backend/src/services/competition/competitionEngine.worker.js:37](/Applications/du-an/workrank/workrank-realtime/backend/src/services/competition/competitionEngine.worker.js:37)
- [backend/src/workers/outboxDispatcher.worker.js:75](/Applications/du-an/workrank/workrank-realtime/backend/src/workers/outboxDispatcher.worker.js:75)
- [backend/src/services/competition/competitionIntegrationMonitor.service.js:68](/Applications/du-an/workrank/workrank-realtime/backend/src/services/competition/competitionIntegrationMonitor.service.js:68)

**Impact:**

Pipeline event-driven không tính effects/điểm và không phát kết quả mong đợi. Một số game/KPI dùng luồng ghi trực tiếp vẫn hoạt động; không kết luận toàn bộ cách tính điểm đều chết.

**Recommended fix:**

Chọn một owner/process cho mỗi consumer, nối start/stop có graceful shutdown; nếu chạy nhiều instance cần claim/lock/idempotency. Bổ sung heartbeat, oldestPendingAge, processing lag và readiness phù hợp.

**Regression risk:**

Bật consumer ngay có thể xử lý backlog cũ, gồm event không hợp lệ của BUG-002; phải khóa ingestion và rà backlog trước.

**How to verify after fix:**

Boot sạch → phát event → chờ tối đa SLA → terminal state, effects đúng và không nhân đôi khi restart. Tắt worker thì operations báo degraded/unknown. Kiểm tra outbox bằng row fixture riêng.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json)

---

### BUG-005 — Lệnh test backend có thể dùng DB thật và xóa toàn bộ bảng nghiệp vụ

**Severity:** P1 · **Loại:** TECH DEBT · **Status:** CODE CONFIRMED — không chạy phá dữ liệu

**Area:** Tooling / Data safety

**Location:** `backend npm test`

**Steps to reproduce:**

1. Đọc npm test: chỉ đặt NODE_ENV=test.
2. Đối chiếu env.js: dotenv vẫn nạp DB_NAME và DB_DIALECT từ .env.
3. Đọc before/cleanTables của các test có destroy({where:{}}). Không chạy kịch bản này trên DB người dùng.

**Observed behavior:**

Runtime test không chuyển sang DB_NAME_TEST như cấu hình sequelize-cli test. Nếu .env có mysql và DB_NAME của môi trường làm việc, test dùng chính DB đó. Một số suite xóa toàn bộ CompetitionEvent/EventOutbox/QuizRoom/QuizQuestion/QuizSet. Đây là rủi ro xác nhận bằng source, không phải sự cố mất dữ liệu đã gây ra trong audit.

**Expected behavior:**

Lệnh test phải tạo/chọn database cô lập, chặn mọi DB không được phép trước khi import model hoặc chạy hooks phá dữ liệu.

**Root cause:**

Cấu hình test runtime và sequelize-cli không thống nhất; không có guard tên DB/instance, không có schema reset/namespace fixture bắt buộc.

**Affected code:**

- [backend/package.json:13](/Applications/du-an/workrank/workrank-realtime/backend/package.json:13)
- [backend/src/config/env.js:19](/Applications/du-an/workrank/workrank-realtime/backend/src/config/env.js:19)
- [backend/src/config/sequelize-cli.js:30](/Applications/du-an/workrank/workrank-realtime/backend/src/config/sequelize-cli.js:30)
- [backend/test/competition_phase1.test.js:40](/Applications/du-an/workrank/workrank-realtime/backend/test/competition_phase1.test.js:40)
- [backend/test/quiz_admin_management_e2e.test.js:31](/Applications/du-an/workrank/workrank-realtime/backend/test/quiz_admin_management_e2e.test.js:31)

**Impact:**

Developer/CI có thể xóa dữ liệu làm việc chỉ bằng npm test. Audit dùng DB audit riêng nên không quan sát mất dữ liệu gốc.

**Recommended fix:**

Thiết lập test config duy nhất, bắt buộc database kết thúc _test hoặc container riêng, fail-fast trước khi import models; không chỉ dựa NODE_ENV. Kiểm tra whitelist connection và tạo schema trước suite.

**Regression risk:**

Test cũ dựa dữ liệu seed hoặc chia sẻ bảng sẽ cần chuẩn hóa fixtures và cleanup theo ownership.

**How to verify after fix:**

Chạy lệnh test với DB_NAME của môi trường làm việc phải fail trước mọi truy vấn ghi; test DB riêng migrate/seed và suite chạy được; bảng sentinel ngoài test DB nguyên vẹn.

**Evidence:** [SESSION_NOTE.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/SESSION_NOTE.md)

---

### BUG-006 — Sâm Lốc không tạo được phòng trên schema MySQL được migrate

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Database / API / Core workflow

**Location:** `/games/sam`

**Steps to reproduce:**

1. Migrate schema MySQL bằng db:migrate.
2. Đăng nhập user, chọn tạo phòng Sâm hoặc POST /api/games/sam/rooms.

**Observed behavior:**

POST trả 500: Column 'has_declared_sam' cannot be null. Không tạo được phòng để chơi thật. Lỗi tái hiện cả 16/10 và 17/10.

**Expected behavior:**

Tạo phòng 201 và thêm host thành công trên schema chính thức.

**Root cause:**

SamPlayer model khai báo hasDeclaredSam allowNull=true/defaultValue=null, trong khi migration has_declared_sam NOT NULL/default=false; createRoom dùng giá trị mặc định model null.

**Affected code:**

- [backend/src/models/SamPlayer.js:49](/Applications/du-an/workrank/workrank-realtime/backend/src/models/SamPlayer.js:49)
- [backend/src/migrations/20261001180000-create-sam-game-tables.js:86](/Applications/du-an/workrank/workrank-realtime/backend/src/migrations/20261001180000-create-sam-game-tables.js:86)
- [backend/src/services/samGame.service.js:245](/Applications/du-an/workrank/workrank-realtime/backend/src/services/samGame.service.js:245)

**Impact:**

Chặn gameplay Sâm trên DB mới; tạo hàng loạt lỗi test phụ thuộc việc tạo người chơi/phòng.

**Recommended fix:**

Chốt tri-state nghiệp vụ (chưa tuyên bố / có / không) rồi đồng bộ model, service và migration bổ sung; không sửa migration cũ đơn độc cho DB đã triển khai.

**Regression risk:**

Các bước khai báo Sâm, reset ván và bot có thể phụ thuộc null/false khác nhau.

**How to verify after fix:**

Fresh migrate và upgrade DB cũ đều tạo/join/reset/start được phòng; test cả null/chưa quyết định, declared true/false theo contract đã chọn.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json)

---

### BUG-007 — Danh sách phòng Capital Board trả 500 vì ORDER BY mơ hồ

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** API / SQL / Navigation

**Location:** `/games/capital-board`

**Steps to reproduce:**

1. Đăng nhập.
2. Mở sảnh Capital Board hoặc GET /api/games/rooms?limit=30.

**Observed behavior:**

Trả 500: Column 'status' in order clause is ambiguous. UI báo lỗi và hiển thị sảnh không có phòng trong khi tạo phòng/deep-link phòng có thể hoạt động.

**Expected behavior:**

Danh sách trả 200 và sắp phòng WAITING lên trước; trạng thái lỗi phân biệt rõ với dữ liệu rỗng.

**Root cause:**

literal CASE WHEN status = WAITING trong query có JOIN dùng tên cột status không định danh bảng; nhiều bảng có cột này.

**Affected code:**

- [backend/src/services/capitalBoardGame.service.js:102](/Applications/du-an/workrank/workrank-realtime/backend/src/services/capitalBoardGame.service.js:102)
- [backend/src/services/capitalBoardGame.service.js:116](/Applications/du-an/workrank/workrank-realtime/backend/src/services/capitalBoardGame.service.js:116)

**Impact:**

Luồng tìm/vào phòng từ sảnh hỏng, gây hiểu nhầm không có phòng.

**Recommended fix:**

Dùng tên alias cột đúng model/bảng trong ORDER BY hoặc biểu thức Sequelize được qualify; kiểm tra query thực tế trên MySQL.

**Regression risk:**

Alias có thể thay đổi theo include; test SQLite không đảm bảo bắt được cùng lỗi.

**How to verify after fix:**

Sảnh có/không có phòng đều 200; WAITING trước PLAYING; giới hạn 30 đúng; loading/error/retry không hiện empty giả.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [_games_capital-board-1440.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_games_capital-board-1440.png)

---

### BUG-008 — 2048 mất tiến độ khi đi sang trang khác trước kỳ checkpoint

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Persistence / Routing / State

**Location:** `/games/2048 → /dashboard → /games/2048`

**Steps to reproduce:**

1. Chơi một số nước và tăng điểm trong chưa đầy 25 giây.
2. Bấm Tổng quan trên sidebar.
3. Quay lại 2048.

**Observed behavior:**

Tái kiểm thử: từ 240 điểm/45 nước về 176 điểm/30 nước. Lượt đầu cũng từ 36 về 0 khi chưa có checkpoint. UI hứa luôn tự động lưu liên tục và an tâm thoát bất kỳ lúc nào.

**Expected behavior:**

Giữ board/score/moves gần nhất khi chuyển route; không phụ thuộc thời điểm timer hoặc điểm có tăng hay không.

**Root cause:**

Checkpoint mỗi 25 giây chỉ chạy nếu score lớn hơn lastPersistedScore. Cleanup interval khi unmount không flush; SPA navigation không phát pagehide/beforeunload. Di chuyển board không cộng điểm cũng bị bỏ qua điều kiện dirty dựa score.

**Affected code:**

- [frontend/src/pages/Game2048.jsx:250](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Game2048.jsx:250)
- [frontend/src/pages/Game2048.jsx:254](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Game2048.jsx:254)
- [frontend/src/App.jsx:152](/Applications/du-an/workrank/workrank-realtime/frontend/src/App.jsx:152)

**Impact:**

Mất tiến độ ván đang chơi và làm sai thông điệp lưu tự động.

**Recommended fix:**

Lưu snapshot cục bộ theo người dùng ngay khi board thay đổi; đồng bộ server có debounce/version và flush route exit. Tách dirty revision khỏi score; một owner cho phiên game, tránh request cũ ghi đè mới.

**Regression risk:**

Concurrent checkpoint, multi-tab và logout cần chính sách revision/ownership cùng BUG-001.

**How to verify after fix:**

Đi route/back/refresh trước và sau 25s, nước đi không tăng điểm, mạng chậm/offline rồi reconnect đều giữ snapshot và không ghi đè phiên người khác.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-009 — Typing reload không khôi phục bài đang gõ và ghi số 0 đè tiến độ server

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Realtime / Persistence / Lifecycle

**Location:** `/games/typing/room/:roomId`

**Steps to reproduce:**

1. Hai user tạo, ready và bắt đầu trận 30 giây.
2. A gõ một đoạn và đợi progress được gửi lên server.
3. Reload hoặc chuyển route/quay lại trước khi hết giờ, chờ trận kết thúc.

**Observed behavior:**

Lượt 16/10 server đã nhận typedChars=56/progress=12.6%; sau reload input rỗng, khi timeout kết quả typedChars/errorCount về 0. Fixture trận đó còn trong DB: cả hai FINISHED, typedChars=0, WPM=0. Lượt 17/10 tái hiện lại: server nhận42 ký tự trước reload; input sau reload rỗng; kết quả FINISHED ghi0 ký tự. Bằng chứng mới đầy đủ trong typing-recovery.json.

**Expected behavior:**

Reload tiếp tục hoặc khôi phục chỉ số đã xác nhận; client mới không được gửi final zero làm giảm tiến độ đã có.

**Root cause:**

typedText/error state thuộc component. fetchRoomDetail và roomState khôi phục room/players/startTime nhưng không khôi phục nội dung đang gõ. Timer finish gửi typedText.length hiện tại; backend submitFinish gán đè typedChars/errorCount mà không revision/monotonic guard.

**Affected code:**

- [frontend/src/pages/TypingBattle.jsx:695](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/TypingBattle.jsx:695)
- [frontend/src/pages/TypingBattle.jsx:870](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/TypingBattle.jsx:870)
- [frontend/src/pages/TypingBattle.jsx:978](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/TypingBattle.jsx:978)
- [backend/src/services/typingGame.service.js:772](/Applications/du-an/workrank/workrank-realtime/backend/src/services/typingGame.service.js:772)

**Impact:**

Người dùng mất kết quả đang thi; kết quả và điểm không phản ánh thao tác trước reconnect.

**Recommended fix:**

Thiết kế checkpoint theo roomId+userId có revision, lưu draft tại client để phục hồi đúng đoạn. Reconcile khi join lại trước cho phép submit. Server không nhận snapshot cũ làm lùi progress; chốt authoritative deadline và chống finalize trùng.

**Regression risk:**

SOLO/1V1/team mode, spectate, reset, kết thúc bằng timeout và người gõ xong sớm phải cùng contract.

**How to verify after fix:**

Hai browser thật: gõ→reload→gõ tiếp, route/back, disconnect/reconnect trước deadline. Chỉ số cuối >= checkpoint hợp lệ trước đó; không duplicate ledger.

**Evidence:** [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json), [typing-recovery.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/typing-recovery.json)

---

### BUG-010 — Typing vẫn chấm hoàn thành và thưởng điểm khi không gõ; anti-cheat chỉ log

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Scoring / Validation / Logic

**Location:** `Typing RANKED; /api/games/typing/rooms/:id/finish`

**Steps to reproduce:**

1. Tạo trận RANKED 1V1 với hai user.
2. Một user không gõ; để hết giờ hoặc gửi finish với typedChars=0.
3. Xem performanceScore, awardedPoints và ledger.

**Observed behavior:**

Trận fixture 16/10: hai user typedChars=0, WPM=0, accuracy=100, performanceScore=69; người thắng được 32 điểm, người thua 17 điểm. Có giới hạn ngày 5 trận/150 điểm nên không kết luận farm vô hạn. Lượt 17/10 xác nhận lại người thắng0 ký tự vẫn scoreDelta=32; Bob không gõ và không mở client lúc timeout vẫn được4 điểm. Code nhánh plausibility.valid=false ghi warning có chữ rejected nhưng vẫn tiếp tục lưu và chấm.

**Expected behavior:**

Điểm hoàn thành/thi đấu cần điều kiện tham gia hợp lệ. Submission bị anti-cheat reject không được tiếp tục nhận điểm.

**Root cause:**

submitFinish luôn truyền completed=true vào performance score, không có ngưỡng tiến độ tối thiểu; calculateAwardedPoints có effort/win/completion bonus dù typedChars=0. Kết quả validateSubmissionPlausibility không chặn luồng.

**Affected code:**

- [backend/src/services/typingGame.service.js:803](/Applications/du-an/workrank/workrank-realtime/backend/src/services/typingGame.service.js:803)
- [backend/src/services/typingGame.service.js:825](/Applications/du-an/workrank/workrank-realtime/backend/src/services/typingGame.service.js:825)
- [backend/src/services/typingEngine.js:149](/Applications/du-an/workrank/workrank-realtime/backend/src/services/typingEngine.js:149)

**Impact:**

Điểm WorkRank/competition phản ánh sai đóng góp và có thể bị khai thác trong hạn mức ngày.

**Recommended fix:**

Chốt policy minimum typed/progress, completion ratio và timeout. Reject/quarantine invalid submission trước effects; accuracy cho zero input không coi như hoàn thành hoàn hảo; server tính thời gian và chốt điểm idempotent.

**Regression risk:**

Phải phân biệt người dùng mạng yếu/reload với gian lận; tránh phạt hồi phục hợp lệ do BUG-009.

**How to verify after fix:**

Idle, zero, negative, vượt challenge length, duration giả và tốc độ bất khả thi không nhận điểm; bài hợp lệ được điểm đúng; timeout dở dang có policy minh bạch.

**Evidence:** [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json), [typing-recovery.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/typing-recovery.json)

---

### BUG-011 — Nhiều tab dùng token tài khoản mới nhưng UI giữ danh tính tài khoản cũ

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Session / State synchronization

**Location:** `Toàn bộ protected routes`

**Steps to reproduce:**

1. Tab A đăng nhập Alice và mở Dashboard.
2. Tab B cùng origin đăng nhập Bob.
3. Ở tab A đọc UI và gọi /api/auth/me hoặc thao tác ghi.

**Observed behavior:**

Tab A vẫn hiển thị Alice, nhưng request /auth/me dùng token trong localStorage mới và trả Bob. Lượt đầu logout ở một tab cũng để tab kia giữ Dashboard cũ khi storage đã hết token.

**Expected behavior:**

Identity của UI, API và Socket phải đồng nhất. Đổi tài khoản/logout ở một tab khiến tab khác reconcile hoặc buộc xác nhận phiên mới.

**Root cause:**

AuthContext chỉ lắng CustomEvent workrank:auth-updated trong cùng window; không nghe storage/BroadcastChannel. user nằm trong memory mỗi tab, Axios đọc token dùng chung từ localStorage; socket có thể giữ identity cũ.

**Affected code:**

- [frontend/src/context/AuthContext.jsx:60](/Applications/du-an/workrank/workrank-realtime/frontend/src/context/AuthContext.jsx:60)
- [frontend/src/services/api.js:21](/Applications/du-an/workrank/workrank-realtime/frontend/src/services/api.js:21)
- [frontend/src/services/api.js:170](/Applications/du-an/workrank/workrank-realtime/frontend/src/services/api.js:170)

**Impact:**

Người dùng có thể thực hiện thao tác dưới tài khoản khác với danh tính đang thấy; dữ liệu và realtime sai chủ thể.

**Recommended fix:**

Dùng một protocol session change qua storage/BroadcastChannel, reconcile user+token+socket như một transaction. Hủy request/cache theo session generation khi chuyển identity.

**Regression risk:**

Refresh rotation và logout trên nhiều tab có thể tạo vòng refresh; cần leader/lock hoặc retry có kiểm soát.

**How to verify after fix:**

A/B login/logout/refresh ở hai tab; trước mọi action UI và /me/socket cùng userId; request của generation cũ bị hủy/không commit.

**Evidence:** [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json)

---

### BUG-012 — Lỗi mạng/500 lúc kiểm tra phiên và xóa tài khoản thất bại đều làm logout

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Auth / Error handling

**Location:** `Auth bootstrap; /settings`

**Steps to reproduce:**

1. Đăng nhập hợp lệ, chặn /api/auth/me trả 500 rồi reload Dashboard.
2. Độc lập: nhập sai password trong form xóa tài khoản.

**Observed behavior:**

auth/me 500 khiến token và refreshToken bị xóa, chuyển /login. Lượt 16/10 delete account trả 400 sai mật khẩu nhưng vẫn clearAuth và logout. Đây là hai đường clear session không phân loại lỗi.

**Expected behavior:**

Lỗi tạm thời có màn hình lỗi/retry và giữ credential hợp lệ. Delete thất bại không đăng xuất; chỉ xóa phiên sau thành công hoặc xác thực bị thu hồi thật.

**Root cause:**

fetchMe catch mọi exception đều clearLocalSession. auth.deleteAccount dùng finally clearAuth bất kể kết quả server.

**Affected code:**

- [frontend/src/context/AuthContext.jsx:30](/Applications/du-an/workrank/workrank-realtime/frontend/src/context/AuthContext.jsx:30)
- [frontend/src/services/api.js:245](/Applications/du-an/workrank/workrank-realtime/frontend/src/services/api.js:245)

**Impact:**

Sự cố API ngắn hạn buộc đăng nhập lại; validation sai ở hành động nguy hiểm gây mất ngữ cảnh và khó hiểu.

**Recommended fix:**

Tách unauthorized/revoked khỏi network/5xx/validation. Bootstrap có trạng thái unavailable/retry. Move clearAuth của deleteAccount sang nhánh success; giữ refresh logic 401 chỉ chạy một lần.

**Regression risk:**

Không được giữ UI có quyền truy cập khi token thật sự vô hiệu; phân biệt credential presence với authenticated user.

**How to verify after fix:**

500/timeout/offline không xóa token; retry thành công vào lại; 401 refresh fail và revoked logout; delete sai password vẫn ở Settings với lỗi rõ, đúng password mới logout.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-013 — Giám sát vận hành báo Online/100% khi dữ liệu lỗi hoặc worker không chạy

**Severity:** P1 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Data accuracy / Error state / Operations

**Location:** `/admin/operations`

**Steps to reproduce:**

1. Chặn các API monitoring trả 500, giữ auth/me hoạt động.
2. Mở tab Sức Khỏe Hệ Thống và đọc từng card.
3. So sánh với pending events không được xử lý ở BUG-004.

**Observed behavior:**

Header có Cần Chú Ý nhưng các card vẫn ghi HOẠT ĐỘNG, worker Sẵn sàng (Online), queue TỐT, YouTube KẾT NỐI, thành công 100%, đồng bộ Vừa xong và drift 0% — Đồng bộ 100%. Khi API thật trả summary.pendingCount, UI còn đọc integrationHealth.outbox.pendingCount không khớp contract.

**Expected behavior:**

Không có dữ liệu hoặc request lỗi phải hiển thị Unknown/Không tải được; Online/100% cần bằng chứng đo. Pending lâu và worker chết phải bị phát hiện.

**Root cause:**

Promise.all biến từng lỗi thành null/[] và mất error metadata. Nhiều nhãn hard-code/fallback thành công, dùng || cho số 0 hợp lệ. Contract frontend/backend health không thống nhất; backend health chỉ nhìn failedCount.

**Affected code:**

- [frontend/src/pages/AdminOperations.jsx:125](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminOperations.jsx:125)
- [frontend/src/pages/AdminOperations.jsx:362](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminOperations.jsx:362)
- [frontend/src/pages/AdminOperations.jsx:429](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminOperations.jsx:429)
- [frontend/src/pages/AdminOperations.jsx:507](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminOperations.jsx:507)
- [backend/src/services/competition/competitionIntegrationMonitor.service.js:69](/Applications/du-an/workrank/workrank-realtime/backend/src/services/competition/competitionIntegrationMonitor.service.js:69)

**Impact:**

Người vận hành bị trấn an sai, bỏ qua consumer chết và dữ liệu chưa đồng bộ; trở ngại xử lý sự cố cốt lõi.

**Recommended fix:**

Giữ loading/error/unknown cho từng nguồn; schema health chung, fallback nullish đúng nghĩa; chỉ hiển thị drift sau đo. Backend cung cấp heartbeat, age/lag và trạng thái worker thực.

**Regression risk:**

Màn hình có thể chuyển nhiều card sang Unknown thay vì xanh; đó là dữ liệu đúng. Cần kiểm tra lỗi từng phần và quyền admin.

**How to verify after fix:**

Tất cả API 500 → không card xanh giả; successRate=0 hiển thị 0%; không lastSyncedAt → Chưa có dữ liệu; worker chết/pending quá SLA → degraded.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [operations-500.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/operations-500.png)

---

### BUG-014 — Chuyển route làm đóng hội thoại và mất bản nháp chat

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** State / Routing / UX

**Location:** `FriendsDock trên toàn bộ Layout`

**Steps to reproduce:**

1. Mở danh bạ, chọn Nhắn tin với Bob.
2. Nhập bản nháp chưa gửi.
3. Bấm Số liệu YouTube hoặc đổi query route rồi mở lại hội thoại.

**Observed behavior:**

Chat quay về danh bạ; giá trị input trở thành chuỗi rỗng. Tin đã gửi trong DB không bị xóa; phần mất là hội thoại đang mở và nội dung chưa gửi.

**Expected behavior:**

Trong workspace, điều hướng trang vẫn giữ hội thoại và draft theo tài khoản/người nhận.

**Root cause:**

RouteErrorBoundary có key gồm location.key/path/search bao toàn bộ AppRoutes, làm remount Layout/FriendsDock cho mỗi history entry. activeChatUser/chatInput nằm trong local useState; openChat cũng setChatInput rỗng.

**Affected code:**

- [frontend/src/App.jsx:152](/Applications/du-an/workrank/workrank-realtime/frontend/src/App.jsx:152)
- [frontend/src/components/FriendsDock.jsx:118](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/FriendsDock.jsx:118)
- [frontend/src/components/FriendsDock.jsx:121](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/FriendsDock.jsx:121)

**Impact:**

Mất nội dung đang soạn và phải mở lại liên hệ sau mỗi lần xem dữ liệu khác.

**Recommended fix:**

Giữ Layout/shell mounted qua route; reset error boundary bằng resetKey/state thay vì key toàn subtree. Lưu draft theo userId+recipientId ở owner bền hơn page và chỉ xóa khi gửi thành công/chủ động bỏ.

**Regression risk:**

Thay boundary có thể ảnh hưởng recovery từ lỗi render/chunk; cần test cả fallback và route khác sau crash.

**How to verify after fix:**

Soạn→đổi route/query→Back→đổi liên hệ→quay lại giữ đúng draft; logout không lộ draft cho user kế tiếp; lỗi route không làm app mắc kẹt.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-015 — 2048 đếm một ván thành hai ván khi có checkpoint trước submit

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Data / Statistics

**Location:** `/games/2048; my-stats`

**Steps to reproduce:**

1. Tạo user fixture mới chưa có Game2048UserStat.
2. Start một phiên, checkpoint score=4/moves=1.
3. Submit kết thúc đúng phiên đó, đọc my-stats.

**Observed behavior:**

Sau checkpoint totalGames=1/totalMoves=1; sau submit thành totalGames=2/totalMoves=2 dù chỉ một ván và một nước được báo.

**Expected behavior:**

Một phiên kết thúc chỉ cộng một lần; checkpoint chỉ cập nhật tiến độ/best hoặc có delta thống kê được quản lý nhất quán.

**Root cause:**

checkpoint findOrCreate stat có defaults totalGames=1,totalMoves=numMoves; submit tìm stat đã có và cộng thêm cùng game/moves khi chưa finalized.

**Affected code:**

- [backend/src/services/game2048.service.js:105](/Applications/du-an/workrank/workrank-realtime/backend/src/services/game2048.service.js:105)
- [backend/src/services/game2048.service.js:167](/Applications/du-an/workrank/workrank-realtime/backend/src/services/game2048.service.js:167)
- [backend/src/services/game2048.service.js:300](/Applications/du-an/workrank/workrank-realtime/backend/src/services/game2048.service.js:300)

**Impact:**

Hồ sơ và bảng xếp hạng thống kê sai, nhất là ván đầu tiên; audit không kết luận mọi ván đều bị nhân đôi.

**Recommended fix:**

Chọn thời điểm duy nhất chốt aggregate ở finalization transaction; khi tạo stat bởi checkpoint khởi tạo counter 0. Bảo vệ idempotency/race cho submit.

**Regression risk:**

Dữ liệu lịch sử đã sai không thể sửa bằng đổi code đơn giản; cần kế hoạch backfill từ sessions nếu muốn.

**How to verify after fix:**

User mới start/checkpoint/submit →1 ván; submit lại không tăng; nhiều checkpoint không tăng; user cũ có counters đúng và parallel submit không nhân đôi.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json)

---

### BUG-016 — Nhiều trang tràn ngang bên trong main trên màn hình 390px

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Responsive / Layout / UX

**Location:** `Typing; Admin Operations; Admin Teams YouTube; một số trang competition/KPI`

**Steps to reproduce:**

1. Mở trang ở viewport 390px.
2. Đo document và main riêng, quan sát nội dung bên phải.
3. Kiểm tra thao tác cuộn ngang và khả năng tới CTA.

**Observed behavior:**

documentWidth vẫn 390 nhưng main của Typing scrollWidth=515, Teams YouTube=433, Operations=696. Ảnh cho thấy title/card bên phải bị cắt. Dữ liệu có mùa giải làm Grand/KPI/Seasons/Rules/AdminGrand cũng vượt main. Arena từng cho scrollWidth rất lớn trong lúc resize, nhưng lượt đo DOM bổ sung không tái hiện phần tử vượt 600px; không dùng phép đo thoáng qua này làm kết luận bug hoặc benchmark hiệu năng.

**Expected behavior:**

Khung trang/card/form reflow theo chiều rộng; chỉ bảng/tab thật sự cần cuộn ngang có container riêng và chỉ báo phù hợp.

**Root cause:**

Các grid/flex con có min-content/min-width và layout chưa thu nhỏ; Operations dùng minmax(280px,1fr) kết hợp card rộng/nội dung nowrap. Shell/main overflow giữ documentWidth bình thường nên kiểm tra toàn document bỏ sót.

**Affected code:**

- [frontend/src/pages/AdminOperations.jsx:353](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminOperations.jsx:353)
- [frontend/src/pages/TypingBattle.jsx:427](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/TypingBattle.jsx:427)
- [frontend/src/pages/AdminTeamsYouTube.jsx:73](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminTeamsYouTube.jsx:73)
- [frontend/src/components/Layout.jsx:682](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/Layout.jsx:682)

**Impact:**

Mobile phải kéo ngang cả vùng trang để đọc và thao tác; tiêu đề/card/CTA không hiện trọn. Không đánh đồng bảng có scroll chủ ý với lỗi.

**Recommended fix:**

Sửa từng container đã chứng minh: min-width:0, wrap nội dung/toolbar, breakpoint cột, max-width:100%; chỉ giữ horizontal scroll cục bộ cho bảng/tabs. Kiểm tra cả dữ liệu dài và dữ liệu có thật.

**Regression risk:**

CSS global có thể phá desktop/table overflow; giới hạn selector và dùng quy chuẩn motion khi có transition.

**How to verify after fix:**

Cả 7 viewport đã dùng trong audit: document và shell không tràn; cards/CTA không bị cắt; bảng/tab cục bộ cuộn được; kiểm tra empty và populated.

**Evidence:** [crawl.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/crawl.json), [_admin_operations-390.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_admin_operations-390.png), [_games_typing-390.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_games_typing-390.png), [_admin_teams-youtube-390.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_admin_teams-youtube-390.png)

---

### BUG-017 — Modal dùng chung chưa quản lý focus bàn phím

**Severity:** P2 · **Loại:** UX ISSUE · **Status:** REPRODUCED

**Area:** Accessibility / Overlay

**Location:** `AnimatedModal: Capital rules/create, Quiz và các form dùng chung`

**Steps to reproduce:**

1. Dùng bàn phím mở modal từ nút ở trang.
2. Nhấn Tab/Shift+Tab và kiểm tra document.activeElement.
3. Đóng modal, kiểm tra focus trở lại trigger.

**Observed behavior:**

Lượt đầu các dialog không đưa focus vào; Tab có thể đi tới phần tử nền. Component chỉ nghe ESC; không có initial focus, focus trap, restore focus hoặc inert background. ESC đóng sau thời gian animation bình thường; không ghi ESC là lỗi.

**Expected behavior:**

Focus vào dialog khi mở, giới hạn trong dialog trong khi mở, trả về trigger khi đóng; dialog có accessible name.

**Root cause:**

AnimatedModal portal/aria-modal không tự quản lý focus. role=dialog đặt trên overlay nhưng heading chưa liên kết aria-labelledby; aria-modal một mình không tạo focus trap.

**Affected code:**

- [frontend/src/components/ui.jsx:277](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/ui.jsx:277)
- [frontend/src/components/ui.jsx:325](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/ui.jsx:325)

**Impact:**

Người dùng bàn phím/screen reader khó biết modal mở và có thể thao tác nền bị che.

**Recommended fix:**

Tập trung sửa shared component: lưu trigger, chọn focus target, trap Tab/Shift+Tab, restore sau close, inert nền, gắn id title và aria-labelledby. Giữ exit animation và cleanup đúng.

**Regression risk:**

Autofocus form con, nhiều overlay và modal thoát bằng ESC/click ngoài cần phối hợp; không trap focus vào phần tử disabled/ẩn.

**How to verify after fix:**

Kiểm tra mở bằng Enter, Tab vòng trong, Shift+Tab, ESC/đóng, restore trigger; modal không có input vẫn focus được; tên được đọc đúng.

**Evidence:** [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json)

---

### BUG-018 — Chức danh lạ bị hiển thị Editor; giá trị mặc định form khác option đang thấy

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Data mapping / Form / UX

**Location:** `JobTitleBadge; /admin/privileges`

**Steps to reproduce:**

1. Xem badge user có jobTitle=Nhân viên/System Administrator hoặc chuỗi chưa map.
2. Mở tạo nhân sự, không đổi select chức danh.
3. Submit và đối chiếu payload/DB với option hiển thị.

**Observed behavior:**

Badge mặc định Editor cho mọi giá trị không nhận diện. createForm.jobTitle=Nhân viên nhưng options là danh sách vai trò bắt đầu Editor, không có Nhân viên; trình duyệt hiển thị option đầu trong khi state/payload vẫn Nhân viên. Fixture nhân sự tiếng Việt tạo thành công nhưng chức danh gây hiểu sai.

**Expected behavior:**

UI thể hiện đúng dữ liệu; giá trị select và payload thống nhất. Giá trị chưa biết hiển thị nguyên bản hoặc chưa xác định.

**Root cause:**

resolveJobTitleConfig trả JOB_TITLE_CONFIG.editor ở fallback; create/edit default dùng chuỗi không thuộc JOB_TITLE_OPTIONS.

**Affected code:**

- [frontend/src/components/JobTitleBadge.jsx:204](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/JobTitleBadge.jsx:204)
- [frontend/src/pages/AdminPrivileges.jsx:153](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminPrivileges.jsx:153)
- [frontend/src/pages/AdminPrivileges.jsx:996](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/AdminPrivileges.jsx:996)

**Impact:**

Hiển thị sai vai trò nghề nghiệp, admin có thể tạo chức danh khác với thứ họ nghĩ đã chọn. Không phải lỗi quyền RBAC role.

**Recommended fix:**

Một nguồn enum/contract thống nhất; default thuộc options hoặc placeholder rỗng cần chọn. Unknown badge neutral và giữ nhãn thật; xử lý dữ liệu legacy.

**Regression risk:**

Không map jobTitle sang role hoặc thay quyền của người dùng; test các alias Việt/Anh có sẵn.

**How to verify after fix:**

Mọi option submit đúng value đang thấy; unknown/null/legacy không trở thành Editor; tạo/sửa/đọc lại user khớp.

**Evidence:** [crawl.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/crawl.json), [db-snapshot.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/db-snapshot.json)

---

### BUG-019 — Lệnh seed toàn bộ dừng ở typingChallenges.seeder vì thiếu up/down

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Tooling / Database setup

**Location:** `backend npm run db:seed`

**Steps to reproduce:**

1. Trên DB audit, migrate schema.
2. Chạy DB_NAME=workrank_audit_20261016 DB_DIALECT=mysql npm run db:seed.

**Observed behavior:**

Admin seed chạy trước, sau đó CLI dừng: Could not find migration method: up ở typingChallenges.seeder. Không thể coi seed command thành công chỉ vì runtime tự seed challenge.

**Expected behavior:**

Lệnh setup chính thức chạy hết và có kết quả rõ ràng/idempotent theo thiết kế.

**Root cause:**

Thư mục sequelize-cli seeders chứa module helper exports DEFAULT_CHALLENGES/seedTypingChallenges thay vì contract up/down mà CLI khám phá tự động.

**Affected code:**

- [backend/src/seeders/typingChallenges.seeder.js:358](/Applications/du-an/workrank/workrank-realtime/backend/src/seeders/typingChallenges.seeder.js:358)
- [backend/package.json:15](/Applications/du-an/workrank/workrank-realtime/backend/package.json:15)

**Impact:**

Onboarding/deploy/test setup bị dừng giữa chừng, DB có một phần seed khó đoán.

**Recommended fix:**

Đưa helper ra thư mục service/fixtures hoặc thêm seeder adapter up/down đúng chuẩn; không xóa dữ liệu challenge đã dùng khi rollback mù quáng.

**Regression risk:**

Startup vẫn import đường dẫn cũ; cần cập nhật consumer và kiểm tra seed lặp.

**How to verify after fix:**

Fresh migrate→seed exit 0; chạy lại theo policy không duplicate; typing service vẫn lấy challenge; rollback seed không phá room history.

**Evidence:** [seed.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/seed.log)

---

### BUG-020 — Rời trang vẽ làm mất nét chưa lưu mà không có cảnh báo

**Severity:** P2 · **Loại:** UX ISSUE · **Status:** REPRODUCED

**Area:** Persistence / Navigation / UX

**Location:** `/games/drawing`

**Steps to reproduce:**

1. Vẽ một nét lên canvas.
2. Bấm Tổng quan trên sidebar.
3. Browser Back về trang vẽ.

**Observed behavior:**

Đếm pixel mực: canvas rỗng 0 → vẽ 1077 → trở lại 0; không có xác nhận bỏ thay đổi. Undo/redo và export hoạt động ở lượt trước; hoàn thành/publish là luồng lưu riêng.

**Expected behavior:**

Bảo vệ thao tác chưa lưu bằng draft recovery hoặc cảnh báo trước khi rời. Đây là bảo vệ công việc hiện có, không yêu cầu thêm trình biên tập mới.

**Root cause:**

Canvas và undo stack nằm ở refs/state của page; effect mount tạo bề mặt mới. Không có dirty guard hoặc snapshot draft bền qua route.

**Affected code:**

- [frontend/src/pages/DrawingGame.jsx:63](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/DrawingGame.jsx:63)
- [frontend/src/pages/DrawingGame.jsx:179](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/DrawingGame.jsx:179)

**Impact:**

Người dùng vô tình mất tác phẩm đang vẽ khi xem trang khác.

**Recommended fix:**

Ưu tiên local draft theo userId có debounce/giới hạn kích thước hoặc navigation guard theo dirty state. Xóa draft chỉ sau publish thành công/chủ động bỏ.

**Regression risk:**

Canvas lớn có thể làm localStorage đầy/chặn main thread; dùng cơ chế storage phù hợp và hiển thị trạng thái lưu thật.

**How to verify after fix:**

Vẽ→route/back/refresh khôi phục hoặc có xác nhận; hủy rời trang giữ nét; publish thành công có thể đọc lại; đổi tài khoản không lộ draft.

**Evidence:** [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json), [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json)

---

### BUG-021 — Tiêu đề mùa giải Arena và Grand gần như chìm vào nền tối

**Severity:** P2 · **Loại:** BUG · **Status:** REPRODUCED

**Area:** Visual / Accessibility / CSS

**Location:** `/arena và /grand khi có giải ACTIVE`

**Steps to reproduce:**

1. Tạo/active một mùa giải rồi mở Arena.
2. Quan sát tên mùa trên hero tối ở desktop/mobile.
3. Đọc computed color của h1 và background hero.

**Observed behavior:**

Tên mùa Mùa Audit Tháng 10 và tên Grand Audit Grand 2026 hiện rất tối trên nền gần đen, khó đọc; screenshot 390 xác nhận. Computed color h1=rgb(17,17,17), nền hero=rgb(20,20,20). H1 không khai báo color, bị rule typography global áp text-primary.

**Expected behavior:**

Tên mùa có độ tương phản đọc được trên hero tối ở mọi theme.

**Root cause:**

Hero đặt color var(--surface) để kế thừa nhưng h1 global tự đặt color var(--text-primary), thắng inheritance. Việc chỉ đặt màu trên parent không bảo đảm con heading nhận đúng màu.

**Affected code:**

- [frontend/src/pages/Arena.jsx:212](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Arena.jsx:212)
- [frontend/src/pages/GrandHub.jsx:203](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/GrandHub.jsx:203)
- [frontend/src/index.css:741](/Applications/du-an/workrank/workrank-realtime/frontend/src/index.css:741)

**Impact:**

Ẩn thông tin định danh mùa giải ngay vùng quan trọng nhất; ảnh hưởng người thị lực yếu.

**Recommended fix:**

Đặt semantic foreground cho dark hero và áp rõ cho heading; rà các hero tương tự theo contrast, không đổi toàn bộ typography global.

**Regression risk:**

Theme sáng/tối và hero ở Grand/Home có thể dùng token khác; cần giới hạn phạm vi.

**How to verify after fix:**

Tên mùa đọc rõ trên mọi viewport/theme; đo contrast foreground/background và kiểm tra screenshot có dữ liệu ACTIVE, không chỉ empty state.

**Evidence:** [_arena-390.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_arena-390.png), [_grand-390.png](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/_grand-390.png), [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json)

---

### BUG-022 — Test harness chưa đủ tin cậy để làm cổng phát hành

**Severity:** P2 · **Loại:** TECH DEBT · **Status:** OBSERVED + CODE CONFIRMED; log dài cũ không còn

**Area:** Testing / Regression / Performance

**Location:** `backend/test; frontend/tests; frontend scripts`

**Steps to reproduce:**

1. Đọc và chạy bộ test trong DB cô lập.
2. Đối chiếu failures với hành vi UI/API thật và chạy lại nhóm liên quan.
3. Đọc verify-frontend/route smoke/backend lint để xác định chúng thực sự kiểm gì.

**Observed behavior:**

Lượt 16/10: MySQL 599 tests:553 pass/38 fail/8 cancelled; SQLite chưa boot schema:600 tests:42 pass/283 fail/275 cancelled. Playwright172:158 pass/14 fail; chạy lại public-recognition+sam36:28 pass/8 fail. Nhiều lỗi là selector/headings cũ, dữ liệu suite trước còn sót, phụ thuộc timing. Performance P95 967ms khi chạy đồng thời giảm còn332.71ms ở lượt cô lập và pass. Log gốc các lượt dài đã mất; không dùng tổng failure để đếm bug sản phẩm. Lượt17 build vẫn warning duplicate object keys Friends.jsx; script check báo0 errors vì phạm vi kiểm hẹp.

**Expected behavior:**

Harness boot schema, fixture tách biệt và assertion theo contract; phân biệt test failure với bug thật. Lint/typecheck báo đúng phạm vi.

**Root cause:**

Tests dùng bảng chung/cleanup chưa đồng nhất, startup và fixed wait dễ race; expectations chưa đồng bộ UI. backend lint chỉ node --check src/server.js; frontend check là script integrity JS/JSX, không phải TypeScript typecheck.

**Affected code:**

- [backend/package.json:12](/Applications/du-an/workrank/workrank-realtime/backend/package.json:12)
- [frontend/scripts/verify-frontend.js:1](/Applications/du-an/workrank/workrank-realtime/frontend/scripts/verify-frontend.js:1)
- [frontend/scripts/route-smoke-test.cjs:1](/Applications/du-an/workrank/workrank-realtime/frontend/scripts/route-smoke-test.cjs:1)
- [backend/test/competition_phase9_performance.test.js:1](/Applications/du-an/workrank/workrank-realtime/backend/test/competition_phase9_performance.test.js:1)
- [frontend/src/pages/Friends.jsx:89](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Friends.jsx:89)

**Impact:**

False alarm làm tốn thời gian, false confidence cho regression thật; không thể tuyên bố hệ thống ổn chỉ dựa build/check xanh.

**Recommended fix:**

Sau sửa bug cốt lõi: test DB guard/schema, fixtures per suite, poll condition thay fixed sleep, chỉnh selector semantic và expectations theo UI được duyệt; test tích hợp MySQL thật, không chỉ SQLite/mocks. Thêm static lint phù hợp JS; chỉ thêm typecheck nếu có mục tiêu rõ.

**Regression risk:**

Không cập nhật expectation chỉ để xanh khi UI thật sai; không tăng timeout/budget để giấu regression.

**How to verify after fix:**

Các suite ổn định qua nhiều run cô lập; failures có artifact/trace; performance đo ở tải định nghĩa trước; script tên và output phản ánh đúng coverage.

**Evidence:** [SESSION_NOTE.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/SESSION_NOTE.md), [frontend-build.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/frontend-build.log), [route-smoke.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/route-smoke.log), [cache-test.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/cache-test.log), [backend-lint.log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/backend-lint.log)

---

### BUG-023 — Source không gắn route và tài liệu backend cũ gây hiểu nhầm phạm vi sản phẩm

**Severity:** P3 · **Loại:** TECH DEBT · **Status:** CODE CONFIRMED

**Area:** Maintenance / Documentation

**Location:** `Groups.jsx; StatsCard.jsx; README_BACKEND_NEW.md`

**Steps to reproduce:**

1. Đối chiếu imports và Route trong App.jsx.
2. Tìm consumer của Groups/StatsCard và so README_BACKEND_NEW với routes hiện tại.

**Observed behavior:**

Groups.jsx còn tồn tại nhưng /groups redirect /friends; không thấy import/render page Groups trong App. StatsCard không thấy consumer trực tiếp trong source hiện tại. README_BACKEND_NEW mô tả tracking/desktop activity cũ và frontend chưa có, trái sản phẩm hiện tại.

**Expected behavior:**

Tài liệu phản ánh kiến trúc đang chạy; code legacy có trạng thái rõ ràng. Redirect có chủ đích không tự động là feature missing.

**Root cause:**

Sau dọn tính năng/đổi IA, các file cũ chưa được archive hoặc cập nhật tài liệu.

**Affected code:**

- [frontend/src/App.jsx:191](/Applications/du-an/workrank/workrank-realtime/frontend/src/App.jsx:191)
- [frontend/src/pages/Groups.jsx:1](/Applications/du-an/workrank/workrank-realtime/frontend/src/pages/Groups.jsx:1)
- [frontend/src/components/StatsCard.jsx:1](/Applications/du-an/workrank/workrank-realtime/frontend/src/components/StatsCard.jsx:1)
- [README_BACKEND_NEW.md:1](/Applications/du-an/workrank/workrank-realtime/README_BACKEND_NEW.md:1)

**Impact:**

Người bảo trì dễ audit/sửa sai implementation hoặc tưởng tính năng cũ còn đang hoạt động.

**Recommended fix:**

Xác nhận chủ đích với owner sản phẩm qua lịch sử thay đổi, cập nhật tài liệu và đánh dấu/archive legacy sau khi kiểm tra consumer; không xóa tự động chỉ vì chưa có route.

**Regression risk:**

Một module có thể được dùng ngoài bundle chính hoặc kế hoạch migration; cần kiểm tra trước cleanup.

**How to verify after fix:**

Inventory/docs thống nhất; rg consumer và build/routes pass sau cleanup được duyệt; alias cũ vẫn chuyển đúng.

**Evidence:** [inventory.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/inventory.json)

---

## TOP 10 cần sửa đầu tiên

| Thứ tự | Issue | Lý do và thứ tự phụ thuộc |
|---|---|---|
|1|BUG-005|Chặn test vào DB thật trước khi bất kỳ developer/CI chạy regression.|
|2|BUG-001|Khóa ownership phiên 2048 và cache theo user; đã có đường can thiệp chéo tài khoản.|
|3|BUG-002|Đóng lỗ ingestion/actor spoof trước khi bật consumer.|
|4|BUG-003|Đổi mật khẩu phải thu hồi refresh credential cũ.|
|5|BUG-011|Đồng nhất identity nhiều tab để ngăn action dưới sai tài khoản.|
|6|BUG-006|Sửa schema/model Sâm để flow tạo phòng dùng được trên MySQL.|
|7|BUG-007|Sửa query sảnh Capital để khôi phục tìm/vào phòng.|
|8|BUG-008|Giữ snapshot 2048 qua route, board không tăng score và refresh.|
|9|BUG-009|Khôi phục bài Typing và chặn snapshot cũ ghi số 0 đè tiến độ đã nhận.|
|10|BUG-004|Rà backlog và nối consumer với process owner rõ ràng sau khi khóa ingestion.|

BUG-010, BUG-012 và BUG-013 cũng thuộc P1 và cần xử lý cùng các batch chấm điểm, auth và vận hành; TOP10 chỉ là thứ tự bắt đầu. Thứ tự trên ưu tiên chặn ghi sai/xóa dữ liệu trước khi bật xử lý tự động.

## Nhóm root cause và kế hoạch fix

| Batch | Root cause chung | Issues | Thay đổi có mục đích | Tiêu chí ra khỏi batch |
|---|---|---|---|---|
|1 — Ranh giới dữ liệu/quyền|Thiếu DB guard, ownership và actor authority|005,001,002|Cô lập test; policy resource/actor; cache theo tài khoản|Không ghi chéo user; test từ chối DB thật; ingestion trái phép bị chặn.|
|2 — Auth/session|Credential và user/socket/cache không có session generation chung|003,011,012|Refresh session revocation, cross-tab reconcile, phân loại error|Đổi password vô hiệu token cũ; nhiều tab thống nhất;500 không logout.|
|3 — Schema/API cốt lõi|Model khác migration; SQL thiếu qualify; aggregate đếm hai lần|006,007,015,019|Migration nâng cấp Sâm; query MySQL; finalization counter; seeder adapter|Fresh/upgrade DB cùng hoạt động; sảnh200; một phiên=một ván; seed0.|
|4 — State/lifecycle|Trạng thái công việc nằm trong page/shell bị remount; snapshot không có revision|008,009,014,020|Owner phiên/draft bền qua route; snapshot+reconcile; boundary reset không remount shell|Route/back/reload/reconnect không mất công việc; không lộ draft qua user.|
|5 — Chấm điểm/background/health|Client payload được tin; consumer không nối runtime; fallback giả dữ liệu|010,004,013|Server validation và settle idempotent; rà backlog; worker startup/heartbeat; health contract|Idle/invalid không có điểm; event terminal state; worker chết thì degraded.|
|6 — UI dùng chung và responsive|Min-content/wrap; typography kế thừa sai; thiếu focus owner; enum không thống nhất|016,017,018,021|Sửa container có chứng cứ; modal focus; semantic dark hero; job-title contract|7 viewports không cắt CTA; keyboard modal đầy đủ; chức danh/payload đúng.|
|7 — Regression/polish/cleanup|Harness phụ thuộc dữ liệu/timing; source/docs legacy|022,023|Fixtures riêng, semantic selectors, script phạm vi rõ; docs thống nhất|CI lặp ổn định với artifact; inventory/docs khớp; không xóa feature ngoài phạm vi.|

Trong mỗi batch: viết regression tập trung vào bug đã chứng minh → sửa root cause tối thiểu → kiểm API thật/MySQL và UI thật → chạy suite liên quan → check/build khi sửa frontend. Không sửa hàng loạt CSS hoặc đổi kiến trúc khi chưa có case chứng minh. Batch4/5 phải phối hợp cho Typing; Batch1 phải xong trước bật worker ở Batch5.

## Coverage và phần chưa kiểm thử

Ma trận từng trang, alias/dynamic routes và trạng thái nằm tại [COVERAGE_MATRIX.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/COVERAGE_MATRIX.md); danh mục nhãn nút ở [UI_CONTROL_INVENTORY.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/UI_CONTROL_INVENTORY.md). Không có tuyên bố đã kiểm mọi nút, mọi payload và mọi trạng thái của từng chức năng.

**NOT TESTED:** production/deploy thật; YouTube OAuth/API key và sync mạng thật; Safari/Firefox/thiết bị vật lý; screen reader và audit WCAG đầy đủ; soak/memory/frame-time120Hz/CWV; mọi tổ hợp310 handler; đầy đủ UAT manager role; import Excel/media/provider bên ngoài; recovery sau restart process với trận đang chạy. Một số API500/loading/empty được kiểm bằng inject/fixture, không đủ thay mọi trạng thái backend thật. Mục cụ thể và lý do được ghi trong coverage.

**Thứ đã xác nhận hoạt động trong phạm vi hẹp:** frontend build, refresh401 một lần rồi retry, admin route chặn user thường, alias/query redirect, tạo nhân sự tên tiếng Việt, tạo mùa/Grand/rule set, API target/actual KPI, room Capital tạo/add bot/start qua deep-link, quiz có đáp án và kết thúc FINISHED, thao tác canvas undo/redo/export. Những mục này không phải chứng nhận toàn bộ feature pass. Sâm thật bị chặn ở tạo phòng. Các test mock không dùng để che lỗi backend này.

## Trạng thái bàn giao

Chỉ thêm tài liệu audit, inventory, script tái hiện và bằng chứng. Mã ứng dụng chưa được sửa. Dữ liệu fixture nằm trong hai database audit riêng; backend/frontend được khởi động lại để tái kiểm thử. Các file upload do test cũ tạo đã được đối chiếu và dọn đúng tên, không xóa upload người dùng. Các server phục vụ audit sẽ được dừng khi hoàn tất bàn giao để không chiếm cổng. Không tự bật worker xử lý backlog khi lỗ ingestion còn mở.
