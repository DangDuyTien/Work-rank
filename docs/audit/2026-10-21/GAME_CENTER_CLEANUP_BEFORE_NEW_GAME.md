# GAME CENTER CLEANUP BEFORE NEW GAME

**Ngày:** 2026-10-21
**Repo:** `/Applications/du-an/workrank/workrank-realtime`
**Phạm vi:** Dọn hoàn toàn Sâm, UNO, Đoán Hình (Guess Image / Quiz) khỏi Game Center; giữ nguyên Typing Battle và Drawing.
**Trạng thái:** Hoàn tất phần dọn dẹp 3 game bị loại. Không implement game mới.

> **Ghi chú bắt buộc đọc trước:** Trong lúc thực hiện, một phiên làm việc khác đang code song song trong cùng repo và đã tạo hệ thống **Arcade** (`arcade.service.js`, `ArcadeRoom/Player`, `arcade.routes.js`, `frontend/src/games/`, `shared/`, migration `20261021100000-create-arcade-games.js`, 3 bản ghi catalog mới). Theo xác nhận của chủ repo, phase này **tiếp tục và không đụng vào Arcade**. Vì vậy:
> - Kết quả dọn dẹp 3 game cũ là đầy đủ và đã verify.
> - Game Center hiện hiển thị thêm 3 game Arcade do phiên song song tạo, **ngoài phạm vi phase này**.
> - Mục tiêu "Game Center chỉ còn Typing + Drawing" **chưa đạt tuyệt đối** vì lý do trên, không phải vì còn sót Sâm/UNO/Đoán Hình.

---

## 1. Games Before

| Game | Trạng thái trước cleanup | Ghi chú |
|---|---|---|
| Typing Battle | AVAILABLE | Giữ nguyên |
| Drawing (Góc Sáng Tạo) | AVAILABLE | Giữ nguyên |
| Sâm (Sâm Lốc) | AVAILABLE | Xóa toàn bộ |
| UNO | Đã xóa code từ trước, còn di sản | Dọn sạch tàn dư + ledger |
| Đoán Hình / Đoán Nhạc | AVAILABLE (gameKey `quiz`) | Xóa toàn bộ |

Xác định "Đoán Hình": implementation thực tế là **Quiz Game** (`gameKey = quiz`, route `/games/quiz`, tiêu đề "Đoán Hình & Đoán Nhạc", câu hỏi type `IMAGE` / `MUSIC` / `TEXT`). Không có module nào khác tên `guess`; chỉ tồn tại alias route cũ `/games/guess` trỏ về `/games/quiz`.

## 2. Games After

| Game | Trạng thái sau cleanup |
|---|---|
| Typing Battle | AVAILABLE, nguyên vẹn |
| Drawing | AVAILABLE, nguyên vẹn |
| Sâm | Đã xóa (code + DB + socket + test) |
| UNO | Đã xóa (code từ trước + ledger/data nay sạch) |
| Đoán Hình (Quiz) | Đã xóa (code + DB + socket + upload + test) |
| Arcade (3 title) | Do phiên song song tạo, ngoài phạm vi |

## 3. Dependency Map

| Game | Frontend | Backend | Socket | DB | Tests | Rewards | Shared code |
|---|---|---|---|---|---|---|---|
| **Sâm** | `pages/SamGame.jsx`, `components/sam/*` (12), `utils/samSound.js`, `utils/samEngineClient.js`, nav item, GameHub card, Settings icon | `samGame.controller`, `samGame.service`, `samRealtime.service`, `utils/samEngine`, `utils/samBotAI`, `samGame.routes`, 5 model `Sam*` | `sam:joinRoom`, `sam:leaveRoom`, `sam:toggleReady`, `sam:roomState`, `sam:playerReady` | `sam_rooms`, `sam_players`, `sam_actions`, `sam_results`, `sam_user_stats` | `sam_*` (6 file), `multiplayer_audit_sam_and_typing`, `typing_sam_socket_state_sync` | Không ghi ScoreLedger | `gameRoomAuth`, `gameCatalog`, `GameComingSoon`, `useGameAvailability` |
| **UNO** | Không còn | Không còn | Không còn | Bảng đã drop ở migration `20261018000000`; còn 2 dòng `score_ledger` | `uno_engine`, `uno_game_integration`, 2 e2e spec | **2 dòng ledger** (100 + 12 XP) | `ScoreLedger` (giữ) |
| **Đoán Hình (Quiz)** | `pages/QuizGame.jsx`, `pages/AdminQuiz.jsx`, `components/quiz/*` (16) | `quizGame.controller`, `quizAdmin.controller`, `quizGame.service`, `quizRealtime.service`, `utils/quizImportParser`, 2 route file, 6 model `Quiz*` | `quiz:joinRoom`, `quiz:leaveRoom` | `quiz_sets`, `quiz_rooms`, `quiz_players`, `quiz_questions`, `quiz_answers`, `quiz_user_stats` | `quiz_*` (2 file), `upload_security` | Không ghi ScoreLedger | `gameRoomAuth`, `gameCatalog`, `gameAvailability` |
| **Typing** | `pages/TypingBattle.jsx`, `components/TypingPassage`, `components/game/VisualKeyboard`, `utils/typing*` | `typingGame.*`, `typingRealtime`, `typingEngine`, `typingMetrics`, `typingPractice`, `typingTransaction`, `typingVerifiedRecords` | `typing:*` (join/leave/ready/start/progress/finish/…) | `typing_*` (6 bảng) | 13 suite typing | `ScoreLedger` (giữ) | Giữ nguyên toàn bộ |
| **Drawing** | `pages/DrawingGame.jsx`, `pages/CreativeGallery.jsx`, `components/CreativeCornerSection` | `drawing.controller`, `drawing.service`, `drawingSchemaCheck`, `drawing.routes` | Không dùng socket | `drawings`, `drawing_likes` | `drawing_authorization` | Không ghi ScoreLedger | Giữ nguyên |

**GAME-SPECIFIC (đã xóa):** toàn bộ file/model/bảng nêu trên của Sâm, Quiz, UNO.
**SHARED INFRASTRUCTURE (giữ):** `gameCatalog.service` (registry), `gameAvailability.middleware`, `gameRoomAuth.service` (room authorization), `GameComingSoon`, `useGameAvailability`, `ScoreLedger`, socket auth/presence/chat, `components/game/VisualKeyboard`.

## 4. Deleted Frontend Files (38)

**Pages (3):** `SamGame.jsx`, `QuizGame.jsx`, `AdminQuiz.jsx`

**Components — Sâm (12):** `SamActionBar`, `SamBotDrawer`, `SamBotTestModal`, `SamCard`, `SamCreateRoomModal`, `SamLobby`, `SamPlayerSeat`, `SamResultModal`, `SamRulesModal`, `SamTable`, `SamWaitingRoom`, `samMotion.css`

**Components — Quiz (16):** `QuizAnswerButtons`, `QuizAnswerPills`, `QuizAnswererSpotlight`, `QuizAudioPlayer`, `QuizAvatar`, `QuizFinalResults`, `QuizLiveLeaderboard`, `QuizLobby`, `QuizMediaBox`, `QuizPlayerStrip`, `QuizQuestionCard`, `QuizRoundResultModal`, `QuizTimerBar`, `QuizTopBar`, `QuizWaitingRoom`, `quizSound.js`

**Components — board game đã nghỉ (5):** `game/DiceRoller.jsx`, `game/EventCardModal.jsx`, `game/PlayerCard.jsx`, `game/PropertyDetailModal.jsx`, `game/GameFullscreenShell.jsx` (consumer cuối cùng là Sâm/Quiz; không còn ai import)

**Utils (2):** `samSound.js`, `samEngineClient.js`

**E2E specs (5):** `sam-game.spec.js`, `doan-hinh-game.spec.js`, `uno-audit-baseline.spec.js`, `uno-game-remediation.spec.js`, `capital-board-game.spec.js`

**Sửa trong file dùng chung:**
- `App.jsx`: bỏ lazy import + route Sâm/Quiz/AdminQuiz; thêm wildcard `/games/*` → `/games` và `/admin/games/*` → `/settings?tab=games`.
- `config/navigation.js`: bỏ 2 mục game + mục admin Quiz, bỏ icon không dùng, bỏ title resolver.
- `components/Sidebar.jsx`: bỏ map route Sâm/Quiz; sửa key typing `typing` → `typing_battle` (bug badge "Sắp ra mắt" không bao giờ hiện).
- `pages/GameHub.jsx`: chỉ còn 2 card mặc định; bỏ icon Sâm/Quiz; cập nhật copy.
- `pages/Settings.jsx`: bỏ nhánh icon Sâm; bỏ import thừa.
- `components/GameComingSoon.jsx`: bỏ icon Sâm/Quiz, thêm Drawing.
- `services/api.js`: xóa `quizGame`, `quizAdmin`, `samGame` (~7.9 KB).
- `index.css`: xóa block `.admin-quiz-page`, media query và toàn bộ `.quiz-game-*` (2.4 KB).
- `scripts/route-smoke-test.cjs`: bỏ `CapitalBoardGame` (file không tồn tại), thêm GameHub/Typing/Drawing/CreativeGallery.
- `e2e/account-ownership.spec.js`: mock catalog đổi từ `quiz` sang `typing_battle`.
- `vite.config.js`: bỏ comment "ảnh quiz".

## 5. Deleted Backend Files (24)

**Controllers (3):** `samGame.controller.js`, `quizGame.controller.js`, `quizAdmin.controller.js`
**Services (4):** `samGame.service.js` (2.090 dòng), `samRealtime.service.js`, `quizGame.service.js` (858), `quizRealtime.service.js`
**Utils (3):** `samEngine.js`, `samBotAI.js`, `quizImportParser.js`
**Routes (3):** `samGame.routes.js`, `quizGame.routes.js`, `quizAdmin.routes.js`
**Models (11):** `SamRoom`, `SamPlayer`, `SamAction`, `SamResult`, `SamUserStat`, `QuizSet`, `QuizRoom`, `QuizPlayer`, `QuizQuestion`, `QuizAnswer`, `QuizUserStat`

**Sửa trong file dùng chung:**
- `models/index.js`: bỏ 11 require + toàn bộ association + export.
- `routes/index.js`: bỏ mount `/games/quiz`, `/admin/quiz`, `/games/sam`, `/admin/games/sam`.
- `sockets/index.js`: bỏ 2 khối handler Quiz/Sâm và `samRealtime`.
- `server.js`: bỏ `quizRealtime.setIo` / `samRealtime.setIo`.
- `services/gameRoomAuth.service.js`: viết lại chỉ còn nhánh typing (bỏ import `SamRoom/SamPlayer/QuizRoom/QuizPlayer` và cả `GameRoom/GamePlayer` không tồn tại).
- `services/gameCatalog.service.js`: bỏ `sam`, `quiz` khỏi DEFAULT_GAMES. **Sau đó phiên song song thêm 3 default Arcade**, nên file hiện có 5 default (3 Arcade + `typing_battle` + `drawing`) — phần Arcade không do phase này tạo.
- `middlewares/gameAvailability.middleware.js`, `app.js`: cập nhật comment.

**Uploads:** xóa `backend/uploads/quiz/` (72 file ảnh/audio, 312 KB) — chỉ phục vụ Quiz.

## 6. Deleted Socket Logic

| Event | Trước | Sau |
|---|---|---|
| `quiz:joinRoom` | Có handler + join room `quiz:<id>` | Không còn |
| `quiz:leaveRoom` | Có handler + lookup `QuizRoom` | Không còn |
| `sam:joinRoom` | Có handler + snapshot `sam:roomState` | Không còn |
| `sam:leaveRoom` | Có handler + `removeSpectator` | Không còn |
| `sam:toggleReady` | Có handler | Không còn |
| `sam:roomState`, `sam:playerReady` | Broadcast từ `samRealtime` | Không còn |
| `typing:*` | 9 event | **Giữ nguyên** |

`gameRoomAuth` giờ trả `INVALID_GAME_TYPE` (400) cho mọi `gameType` không phải typing, nên không còn đường nào join room game cũ kể cả khi client cũ gọi lại.

## 7. Database Cleanup

Migration: `backend/src/migrations/20261021120000-remove-sam-quiz-games.js`

Thứ tự thực thi (idempotent, kiểm tra tồn tại trước mỗi bước):
1. `score_ledger`: xóa record có `reason` khớp reward của game đã xóa (`UNO Match%`, `Sâm%`, `Sam %`, `Sam:%`, `Quiz %`, `Đoán Hình%`, `Đoán Nhạc%`).
2. `game_catalogs`: xóa `game_key IN ('sam','quiz','uno','game_2048','capital_board')`.
3. Drop bảng theo đúng thứ tự FK:
   - Quiz: `quiz_answers` → `quiz_players` → `quiz_rooms` → `quiz_questions` → `quiz_sets` → `quiz_user_stats`
   - Sâm: `sam_actions` → `sam_results` → `sam_players` → `sam_rooms` → `sam_user_stats`
   - `game_leaderboard_profiles` (bảng mồ côi của capital-board, 0 dòng, không model, không code path)
4. Post-condition: nếu còn bảng nào trong danh sách thì migration throw.

`down()` là no-op có chủ đích (xóa dữ liệu không thể hoàn tác); snapshot trước cleanup nằm ở `docs/audit/2026-10-21/db-backup/`.

**Không đụng:** `users`, `teams`, `departments`, `kpi_*`, `score_ledger` (các dòng KPI/YouTube/kudos), `typing_*`, `drawings`, `drawing_likes`, `game_catalogs` của 2 game còn lại.

**Migration bổ sung đã chạy:** `20261019000000-fix-typing-empty-accuracy-default`, `20261019010000-create-typing-practice-attempts`. Hai migration này đang pending sẵn trong dev DB (drift có từ trước), khiến 3 API typing trả 500 (`typing_practice_attempts` không tồn tại). Đã apply để Typing hoạt động đúng.

## 8. Data Counts Before / After

Nguồn: `baseline-before.json`, `baseline-after.json`.

| Bảng | Trước | Sau | Ghi chú |
|---|---:|---:|---|
| `sam_rooms` | 90 | **0 (bảng đã drop)** | |
| `sam_players` | 115 | **0** | |
| `sam_actions` | 39 | **0** | |
| `sam_results` | 2 | **0** | |
| `sam_user_stats` | 0 | **0** | |
| `quiz_rooms` | 0 | **0 (bảng đã drop)** | |
| `quiz_players` | 0 | **0** | |
| `quiz_questions` | 0 | **0** | |
| `quiz_answers` | 0 | **0** | |
| `quiz_sets` | 0 | **0** | |
| `quiz_user_stats` | 58 | **0** | |
| `game_leaderboard_profiles` | 0 | **0 (đã drop)** | |
| `score_ledger` (tổng) | 66 | 64 | Đúng 2 dòng UNO bị xóa |
| `score_ledger` (game cũ) | 2 | **0** | 100 XP + 12 XP của UNO |
| `game_catalogs` | 4 | 5 | 2 game cũ bị xóa; 3 Arcade do phiên song song thêm |
| `game_catalogs` (sam/quiz/uno/2048/capital) | 2 | **0** | |
| `typing_rooms` | 125 | 125 | Không đổi |
| `typing_players` | 146 | 146 | Không đổi |
| `typing_match_results` | 100 | 100 | Không đổi |
| `typing_user_stats` | 96 | 97 | +1 do phiên song song test API |
| `typing_practice_attempts` | (bảng chưa tồn tại) | 1 | Bảng mới từ migration typing; 1 bản ghi test |
| `drawings` | 3 | 4 | +1 bản ghi test storage của phiên song song |
| `drawing_likes` | 0 | 0 | |
| `users` | 1193 | 1193 | Không đổi |
| `teams` | 253 | 253 | Không đổi |
| `kpi_results` | 13 | 13 | Không đổi |
| `seasons` | 11 | 11 | Không đổi |

Số bảng: 67 → 58 (drop 12 bảng game cũ; +1 bảng typing practice; +2 bảng Arcade của phiên song song).

## 9. Shared Infrastructure Preserved

| Thành phần | Vai trò | Trạng thái |
|---|---|---|
| `gameCatalog.service` + `game_catalogs` | Game Registry (gameKey, status, enabled, route) | Giữ; đã bỏ `sam`/`quiz`; hiện có thêm 3 default Arcade từ phiên song song |
| `gameAvailability.middleware` | Chặn non-admin khi COMING_SOON/disabled | Giữ |
| `gameRoomAuth.service` | Authorization phòng theo `gameType` | Giữ, thu gọn còn typing; trả 400 cho type lạ |
| `GameComingSoon` + `useGameAvailability` | UI/status gate | Giữ (Typing dùng) |
| `ScoreLedger` | Ví điểm chung WorkRank | Giữ nguyên, chỉ xóa 2 dòng UNO |
| Socket auth / presence / chat | Hạ tầng realtime chung | Giữ nguyên |
| `components/game/VisualKeyboard` | Bàn phím trực quan của Typing | Giữ |

**Generic contract sẵn cho game mới:** `gameKey` + `status` + `route` trong catalog; `gameType` + `roomId` + `player/spectator` trong `canAccessGameRoom`; vòng đời `WAITING → STARTING → PLAYING → FINISHED` đang dùng cho Typing. Không thêm abstraction mới trong phase này.

## 10. Typing Regression

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Solo | PASS | Trang `/games/typing` render, API `my-stats`/`leaderboard` 200 |
| Room | PASS | `POST /api/games/typing/rooms` 201; test socket sync pass |
| Input / UniKey | PASS | Không sửa `typingText`, `TypingPassage`, `typingSound`, engine |
| Metrics | PASS | `typing_engine_authority`, `typing_unicode_metrics`, `typing_reaudit_invariants` pass |
| Result | PASS | `typing_match_results` 100 dòng giữ nguyên |
| Room cleanup | PASS | `typing_room_lifecycle`, `typing_realtime_isolation` pass |
| Socket late-join/reconnect | PASS | `typing_socket_state_sync.test.js` (viết lại từ file sam+typing) |
| API smoke | PASS | `my-stats`, `leaderboard`, `practice/active`, `rooms` đều 200 |

Sự cố phát hiện & xử lý: 3 API typing trả 500 do bảng `typing_practice_attempts` chưa được migrate trong dev DB. Đã apply 2 migration typing đang pending; sau đó tất cả 200.

## 11. Drawing Regression

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Create/Join (canvas) | PASS | `/games/drawing` render, `GET /api/drawings` 200 |
| Authorization | PASS | `drawing_authorization.test.js` pass |
| Drawing state | PASS | Không sửa `DrawingGame.jsx`, `drawing.service.js` |
| Room lifecycle | N/A | Drawing là canvas đơn, không có room |
| Realtime | N/A | Không dùng socket |
| Result/gallery | PASS | `GET /api/drawings` 200; gallery 4 tác phẩm |

**Cảnh báo ngoài phạm vi:** bản ghi `drawings.id = 4` do phiên song song tạo lúc 14:32 trỏ tới `http://127.0.0.1:4599/public/drawings/...` (storage server cục bộ không chạy), gây 1 lỗi console `ERR_CONNECTION_REFUSED` khi mở trang Vẽ. Không phải regression từ cleanup và không xóa vì thuộc phiên khác.

## 12. Old Route Verification

| URL cũ | HTTP | Kết quả | Crash |
|---|---:|---|---|
| `/games/sam` | 200 | redirect → `/games` | Không |
| `/games/sam/room/1` | 200 | redirect → `/games` | Không |
| `/games/quiz` | 200 | redirect → `/games` | Không |
| `/games/quiz/room/1` | 200 | redirect → `/games` | Không |
| `/games/guess` | 200 | redirect → `/games` | Không |
| `/admin/quiz` | 200 | redirect → `/` (fallback `*`) | Không |

API cũ: `/api/games/sam/rooms`, `/api/games/quiz/rooms`, `/api/admin/quiz/questions`, `/api/admin/games/sam/leaderboard` đều **404** (không 500).

## 13. Real Browser Verification

Công cụ: Playwright Chromium 1.60, viewport 1440×900, session admin thật, backend + Vite dev server thật.
Ảnh: `docs/audit/2026-10-21/browser/`; dữ liệu: `browser-results.json`.

| Kiểm tra | Kết quả |
|---|---|
| Game Center render | PASS — card: `Computer Rush`, `Direction Rush`, `Memory Flash`, `WorkRank Typing Battle`, `Góc Sáng Tạo (Game Vẽ)` |
| Có card Sâm / Đoán Hình | **Không** (`hasRetiredGames = false`) |
| Click Typing | PASS → `/games/typing`, nội dung game render |
| Click Drawing | PASS → `/games/drawing`, canvas render |
| Console error | 1 lỗi — `ERR_CONNECTION_REFUSED` tới ảnh storage của phiên song song (mục 11), không liên quan cleanup |
| Crash boundary | Không xuất hiện |

## 14. Remaining Legacy References

| Vị trí | Nội dung | Lý do được phép |
|---|---|---|
| `backend/src/migrations/20260930190000-create-quiz-game-tables.js` | Tạo bảng quiz | Lịch sử migration, bắt buộc để replay DB |
| `backend/src/migrations/20261001210000`, `20261001235000`, `20261002000000` | Cột/index quiz | Lịch sử migration |
| `backend/src/migrations/20261001180000`, `20261001200000`, `20261002010000`, `20261017030000` | Bảng/cột Sâm | Lịch sử migration |
| `backend/src/migrations/20261002030000-create-activity-events-and-game-catalog.js` | Seed `sam`, `quiz` | Lịch sử migration; dữ liệu đã bị migration cleanup xóa |
| `backend/src/migrations/20261018000000-remove-retired-games.js` | Drop UNO/2048/capital | Lịch sử migration |
| `backend/src/migrations/20261021120000-remove-sam-quiz-games.js` | Tên bảng game cũ | Chính là migration cleanup |
| `backend/src/migrations/20260930235900-cleanup-auto-generated-demo-data.js` | `quiz_game_user_stats` | Lịch sử migration (bảng cũ hơn cả Quiz V1) |
| `docs/audit/**` | Báo cáo cũ, ảnh, JSON | Tài liệu audit bất biến |

**Không còn** reference nào trong: `backend/src` (ngoài migrations), `backend/test`, `frontend/src`, `frontend/e2e`, `frontend/scripts`, `contracts`, `scripts`.

## 15. Final Gate

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| SÂM FRONTEND REMOVED | **PASS** | 0 file, 0 route, 0 nav item, 0 CSS |
| SÂM BACKEND REMOVED | **PASS** | 0 controller/service/route/model/socket |
| SÂM DATA REMOVED | **PASS** | 5 bảng drop, 0 dòng |
| UNO FRONTEND REMOVED | **PASS** | Không còn code; đã xóa 2 e2e spec |
| UNO BACKEND REMOVED | **PASS** | Không còn code; đã xóa 2 test |
| UNO DATA REMOVED | **PASS** | Bảng đã drop trước đó; 2 dòng ledger đã xóa |
| GUESS IMAGE REMOVED | **PASS** | 0 page/component/controller/service/route/model/socket |
| GUESS IMAGE DATA REMOVED | **PASS** | 6 bảng drop + 72 file upload xóa |
| STALE ROOMS | **PASS** | Bảng room game cũ không còn; server restart sạch; room list chỉ typing |
| DEAD ROUTES | **PASS** | URL cũ redirect `/games`, không crash, API cũ 404 |
| DEAD SOCKET EVENTS | **PASS** | 5 event Sâm/Quiz đã bỏ; typing giữ nguyên |
| DEAD IMPORTS | **PASS** | `npm run check`: 80 file, 0 lỗi |
| TYPING PRESERVED | **PASS** | 10 suite + API + browser |
| DRAWING PRESERVED | **PASS** | API + authorization + browser (1 ảnh lỗi do phiên khác) |
| DATABASE INTEGRITY | **PASS** | 0 bảng game cũ, 0 orphan, counts shared không đổi |
| FRONTEND BUILD | **PASS** | `vite build` thành công (1905 modules) |
| BACKEND TESTS | **PASS (game scope)** | 602/620 pass; 17 fail còn lại đều thuộc competition/KPI/auth/integration, không tham chiếu Game Center, có từ baseline (baseline: 38 fail) |
| REAL BROWSER | **PASS** | Game Center + 2 game + URL cũ |
| **OVERALL GAME CLEANUP** | **PASS** | Cho phạm vi 3 game bị loại |
| **TARGET STATE "chỉ Typing + Drawing"** | **CHƯA ĐẠT** | Game Center còn 3 title Arcade do phiên song song tạo — ngoài phạm vi theo chỉ đạo |

### 17 lỗi backend còn lại (không liên quan Game Center)

`competition_phase3` (2), `competition_phase5_hardening` (2), `competition_phase9_performance` (1), `competition_phase9_security` (4), `historical_archives_spotlight` (2), `integration` (3 — auth lockout 404, group socket hang up, SQLITE_MISUSE), `mvp_cup_comprehensive` (1), `production_kpi_e2e` (2). Tất cả là lỗi concurrency/teardown hoặc hành vi auth có sẵn, không đi qua module game.

## 16. Kết luận

- 3 game bị loại đã được gỡ ở cả 5 tầng: UI, API, socket, database, test — không còn đường nào để chúng chạy lại.
- Typing Battle và Drawing không bị ảnh hưởng; toàn bộ dữ liệu và test của hai game còn nguyên.
- Repo đã sẵn sàng cho game mới ở tầng contract (catalog + availability + room auth), **không** chứa code game mới do phase này tạo.
- Việc Game Center còn 3 title Arcade là do phiên làm việc song song, cần chủ repo quyết định giữ hay tách trước khi coi "target state" là hoàn tất.

**Dừng tại đây theo yêu cầu. Không implement game mới.**
