# Typing Battle — Solo Keystroke Smoothness & Room Lifecycle Remediation

**Ngày:** 2026-10-19 · **Phạm vi:** `workrank-realtime` (frontend Typing Battle + backend typing sockets/services)
**Nguyên tắc:** reproduce → profile → root cause → fix → regression. Không sửa trước khi có bằng chứng.
**Môi trường đo:** fixture cô lập `backend/test/fixtures/typing-live-server.cjs` (NODE_ENV=test, SQLite `:memory:`, port 5101) + Vite 5273; macOS, headless Chromium (CDP `Input.insertText` mô phỏng IME).

---

## A. Mục tiêu & tiêu chí nghiệm thu

**Part A — Solo typing phải mượt tuyệt đối (local-first):**
- Không có network op / audio op / storage op nằm giữa `keydown` và render.
- CPU mỗi phím phải thấp và phẳng ở mọi tốc độ (60–210 WPM) và với tiếng Việt (IME).
- Server chậm 0.5–3s hoặc offline không được làm chậm đường gõ.

**Part B — Vòng đời phòng, hết "ghost room":**
- Tạo phòng → rời phòng/đóng tab/navigate đi → phòng biến mất khỏi lobby của mọi người, kể cả khi không reload.
- DB không còn hàng ghế mồ côi; public list không bao giờ trả phòng 0 người.
- Reload/reconnect trong phòng chờ (trong grace) và giữa trận PLAYING phải giữ nguyên ghế (không phá recovery).

---

## B. Reproduction & instrumentation

| Bước | Công cụ | Kết quả |
|---|---|---|
| Profile CPU từng phím | `frontend/scripts/typing-keystroke-profile.mjs` (CDP Profiler 200µs, scenario `cpu-fast-ascii-100`, `cpu-vietnamese-ime-40`) | Phát hiện `getAudioContext` = **10.01 ms/key** (1001ms/100 phím) khi audio context suspended (headless/no audio device) |
| Ghost room | Trace backend + 2 browser context thật (lobby watcher + creator) | Xác nhận: rời phòng bằng navigate/unmount để lại hàng ghế; đóng tab không bao giờ cleanup; lobby chỉ mất card khi reload |

Log 2 phím liên tiếp (CPU profile trước fix): `getAudioContext` 10.01 ms/key ≫ `playKey` 0.112 ms/key — resume() gọi lại trên **mỗi** phím khi context suspended.

---

## C. Root causes

**Part A — sound hot path:**
- `getAudioContext()` gọi `audioCtx.resume()` mỗi lần play. Khi context ở trạng thái `suspended` (chưa có user gesture, không có audio device, hoặc power-suspend), mỗi lần `resume()` là một IPC round-trip tới audio service → ~10ms chặn ngay giữa keypress và render. Đây là chi phí per-key lớn nhất trong toàn bộ hot path.

**Part B — room lifecycle (đã trace frontend → socket → service → DB):**
- **RC-1** Socket `typing:leaveRoom` chỉ `socket.leave(channel)` + xoá spectator, **không xoá membership DB** → route change/unmount để lại player row.
- **RC-2** Socket `disconnect` không cleanup typing membership → đóng tab để ghost vĩnh viễn (room không bao giờ "empty" nên cleanup định kỳ không bắt).
- **RC-3** Các chuyển trạng thái ABANDONED (stale cleanup, dọn ghế cũ khi create/join) không broadcast → lobby stale.
- **RC-4** Lobby không biết WAITING→PLAYING (`startMatch`) và FINISHED (`finalizeMatch`).
- **RC-5** Frontend hiển thị `r.players?.length || 1` → phòng rỗng hiện "1 Người".
- **RC-6** Không refetch lobby khi socket reconnect.
- **RC-7** `listRooms` không allowlist `status` param và không lọc `playerCount = 0`.
- **Race bổ sung (phát hiện khi chạy acceptance):** disconnect của lần navigation trước và lần đóng tab sau có thể đến **lệch thứ tự**; cleanup chỉ arm khi presence "đã trống" nên có thể bị bỏ qua nếu còn socket cũ trong presence → ghost tồn tại >12s.

---

## D. Thay đổi

**Part A — `frontend/src/utils/typingSound.js`:**
- Prewarm `AudioContext` bằng `requestIdleCallback` lúc tải module — constructor (10–100ms, nặng ở môi trường không có audio device) không bao giờ rơi vào giữa keydown→render nữa.
- Hot path chỉ đọc cờ `audioCtxRunning` (cập nhật qua listener `statechange`): hết cross-process getter.
- `resume()` chỉ thử tối đa 1 lần / 1.5s (cooldown) khi context chưa chạy; khi suspended thì **bỏ qua phát âm** thay vì block.

**Part B — backend:**
- `typingRealtime.service.js:135` — `broadcastRoomRemoved(roomId)` phát global `typing:roomRemoved`.
- `typingGame.service.js`:
  - `leaveRoom` (line 598) viết lại: transaction + row lock, idempotent; WAITING/STARTING → xoá ghế, chuyển host nếu cần, phòng rỗng → ABANDONED + `finishedAt` + broadcast `roomRemoved`; PLAYING → SURRENDERED (không xoá membership), người TYPING cuối cùng rời → finalize.
  - `leaveWaitingSeat` (line 682): đường socket/unmount chỉ giải phóng ghế WAITING/STARTING, không bao giờ đụng trận PLAYING.
  - `scheduleDisconnectedSeatCleanup` / `cancelDisconnectedSeatCleanup` (lines 711/745): grace `TYPING_SEAT_GRACE_MS = 5000`; timer **re-check presence tại thời điểm hết hạn** (`presence.socketCount`) thay vì tin trạng thái lúc disconnect → hết race lệch thứ tự.
  - `listRooms` (line 220): allowlist `LISTABLE_ROOM_STATUSES`, lọc `players.length > 0` cho **mọi** status, broadcast `roomRemoved` cho phòng bị dọn.
  - `cleanupStaleTypingRooms` (line 170) trả về danh sách id đã đóng; createRoom/joinRoom/getActiveRoom broadcast sau commit.
  - `startMatch` (line 830): phát global `typing:roomListChanged` khi WAITING→PLAYING; `finalizeMatchOnce`: phát `typing:roomRemoved` khi FINISHED.
- `sockets/index.js`: `typing:joinRoom` → cancel grace (line 245); `typing:leaveRoom` → cancel grace + `leaveWaitingSeat` (lines 287–288); `disconnect` → arm grace cho **mọi** disconnect (line 371, liveness re-check ở expiry).

**Part B — frontend `frontend/src/pages/TypingBattle.jsx`:**
- Listener mới `typing:roomRemoved` → filter `roomList` + `liveMatches` tức thì (không cần reload).
- `handleSocketReconnect` → refetch hub khi socket nối lại (RC-6).
- Card phòng dùng `playerCount` server trả; `visibleRoomList`/`visibleLiveMatches` lọc phòng 0 ghế (RC-5, defensive).
- `handleLeaveRoom` chặn double-submit (`leavingRoom`) + clear state; 3 nút rời phòng `disabled` khi đang rời.

---

## E. Bằng chứng — Part A (smoothness)

Profile CPU per-keystroke sau fix (`typing-keystroke-profile.json`, STATUS: PASS):

| Chỉ số | Trước | Sau |
|---|---|---|
| `getAudioContext` (fast-ascii) | **10.01 ms/key** | **không còn trong top-8 hot list** (<0.07 ms/key) |
| Max latency 1 phím | 135.5 ms | **7.1 ms** |
| p95 latency | 2.7 ms | 3.0 ms |
| CPU/key fast-ascii | — | 18.75 ms, trong đó `(program)` 13.8ms là internals của browser (không cắt được), `jsxDEV` 0.4 dev-only |
| CPU/key tiếng Việt (40 keys, IME) | — | p95 2.7ms, max 3.7ms; phần lớn thời gian là idle giữa các phím scripted |

- `commitsPerKey ≈ 2.7` không đổi so với phase trước — đã xác định là keydown/keyup native listeners của `VisualKeyboard` + input commit (subtree memo, không re-render toàn trang), documented từ phase trước.
- Long task duy nhất 147ms trong cửa sổ profile là cold transform dev-mode (lần chạy 2: ~130ms), đã kết luận nhiễu môi trường từ phase trước.

Acceptance local-first (server chậm/offline) — `typing-local-first-audit.mjs`: **5/5 PASS** (3000ms latency không chậm keystroke path; queue deferred tới server; offline không gián đoạn; reconnect flush; kết quả server-authoritative).

---

## F. Bằng chứng — Part B (room lifecycle)

**Backend suite mới `backend/test/typing_room_lifecycle.test.js` — 13/13 PASS:**
1. leaveRoom xoá đúng ghế người gọi + chuyển host cho người còn lại.
2. Người cuối rời → ABANDONED đúng 1 lần + 1 broadcast `roomRemoved`.
3. Double-leave đồng thời → idempotent.
4. Rời khi STARTING → về WAITING + `startingCancelled`.
5. `leaveWaitingSeat`: nhả ghế WAITING; PLAYING giữ nguyên membership.
6. Grace 5s: giữ ghế trước hạn, cancel thì không nhả, hết grace thì nhả.
7. **Race lệch thứ tự:** socket còn sống tại expiry → giữ ghế; disconnect kế tiếp → nhả.
8. `listRooms` ẩn ghost 0 người + broadcast; status lạ không lọt phòng đóng.
9. Ghost PLAYING (crash) bị loại khỏi live list.
10. Tạo phòng mới → phòng ghế cũ ABANDONED + broadcast.
11. `startMatch` phát invalidation lobby.
12. Rời giữa PLAYING → SURRENDERED; người cuối → FINISHED + `matchFinished` + `roomRemoved`.
13. DB integrity: mọi phòng ABANDONED có 0 hàng ghế; không có ghế mồ côi.

**Real-browser acceptance `frontend/scripts/typing-room-lifecycle-audit.mjs` (2 context thật) — 8/8 PASS (chạy 2 lần liên tiếp, không flake):**

| # | Kịch bản | Kết quả đo |
|---|---|---|
| 1 | B tạo phòng → card hiện trong lobby A không reload | card "• 1 Người" đúng playerCount |
| 2 | B bấm Rời phòng → card A biến mất | **412ms** < 1.5s; API list + DB = ABANDONED, 0 ghế |
| 3 | B đóng tab → ghost cleanup | card mất lúc **5056ms** (đúng trong grace 5s + broadcast) |
| 4 | B reload trong phòng chờ | ghế giữ nguyên sau >7s; card A không hề biến mất |
| 5 | Guest join rồi rời bằng UI | chỉ ghế guest nhả; card B cập nhật "1 Người" live |
| 6 | B start trận | card chuyển sang "Trận Đấu Đang Diễn Ra"; B reload giữa trận → vẫn 2 ghế, không SURRENDERED |
| 7 | Kết thúc trận | live card biến mất khỏi mọi lobby; API list sạch; DB FINISHED |
| 8 | Integrity cuối | 0 phòng 0 người; status param lạ không trả phòng đóng |

Evidence: `docs/audit/2026-10-19/typing/room-lifecycle-results.json` (status: PASS, errors: []).

---

## G. Regression (không được hồi quy)

| Gate | Kết quả |
|---|---|
| Backend typing suites (`test/typing_*.test.js` + `multiplayer_audit_sam_and_typing`) | **64/64 PASS** |
| `typing-real-audit.mjs` (18 checks, server thật) | **18/18 PASS**, 0 page error |
| `typing-local-first-audit.mjs` | **5/5 PASS** |
| `frontend npm run check` | **108 files, 0 errors** |
| `frontend npm run build` | PASS (TypingBattle 139.96 kB / gzip 35.76 kB) |
| Full backend `npm test` | 660 pass / 38 fail — **toàn bộ 38 fail thuộc suite không liên quan** (uno, 2048, capital_board, competition phase 3/5/9, socket_room_auth…); đã verify pre-existing bằng cách stash thay đổi của phase này và chạy lại (`socket_room_auth`, `uno_engine`: 0 pass trên cả code gốc) |

---

## H. Trade-offs & follow-ups

1. **Âm thanh có thể "im" tối đa 1.5s** sau khi context bị suspend giữa chừng (power-suspend) cho tới lần thử resume kế tiếp — đổi lấy việc không bao giờ chặn keypress. Chấp nhận.
2. **Grace 5s**: đóng tab rồi mở lại trong 5s vẫn có thể reclaim ghế (chủ đích — bảo vệ reload). Phòng biến mất khỏi lobby trễ tối đa ~5s trong kịch bản đóng tab; leave có chủ đích thì tức thì.
3. **`commitsPerKey ~2.7`** vẫn giữ nguyên — đã chứng minh không phải chi phí render toàn trang; không refactor thêm để tránh rủi ro.
4. **`(program)` ~14ms/key** là browser internals (style/layout/paint), không phải code dự án; cắt sâu hơn cần giảm DOM (ngoài scope).
5. Pre-existing test failures ở các game khác không thuộc phase này; không sửa để giữ diff tập trung.

---

## FINAL GATE — **PASS**

- Part A: `getAudioContext` 10.01 → ngoài hot list; max latency 135.5→7.1ms; 5/5 local-first; 18/18 real audit.
- Part B: 13/13 backend lifecycle tests; 8/8 real-browser acceptance (2 lần liên tiếp): leave tức thì (412ms), tab close trong grace (5056ms), reload giữ ghế cả khi PLAYING, finish dọn sạch mọi lobby, không ghost trong DB/public list.
- Regression: 64/64 typing suites, check 108 files 0 errors, build PASS; các fail còn lại của `npm test` là pre-existing ngoài scope (đã chứng minh bằng stash).

**Artifacts:**
- `docs/audit/2026-10-19/typing/room-lifecycle-results.json`
- `docs/audit/2026-10-19/typing/real-browser-results.json` (18/18)
- `docs/audit/2026-10-19/typing/local-first-results.json` (5/5)
- `$TMP/opencode/typing-keystroke-profile.json` (CPU per-key)
- `backend/test/typing_room_lifecycle.test.js` (13 tests)
- `frontend/scripts/typing-room-lifecycle-audit.mjs` (acceptance script)
