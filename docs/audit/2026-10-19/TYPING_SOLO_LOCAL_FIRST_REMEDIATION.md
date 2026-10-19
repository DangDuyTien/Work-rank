# Typing Battle solo — Local-first remediation (2026-10-19)

Phạm vi: chế độ **Solo/Practice** của Typing Battle (input path, đồng bộ mạng, restore, finish). Room nhiều người được đo lại như hồi quy nhưng không thay đổi kiến trúc trong đợt này.

Mục tiêu: gõ solo phải mượt như editor native — mọi công việc cục bộ (render, scoring, draft) hoàn tất **trước và độc lập với mạng**; mạng chỉ đồng bộ nền theo cadence, kết quả cuối vẫn do server quyết định.

Không dùng `page.route`/socket giả cho acceptance. Toàn bộ số liệu lấy trên Chromium headless với Vite thật (port 5273) + Express thật + Socket.IO thật + SQLite `:memory:` fixture (`backend/test/fixtures/typing-live-server.cjs`, port 5101). Không ghi token/DB sản xuất vào bằng chứng.

## KIẾN TRÚC SAU REMEDIATION

`native input value (source of truth) → TypingSession.applyValue() (diff tăng dần O(tail), không scan toàn đoạn) → React commit cục bộ → draft localStorage throttle 1s → deferred sync queue (practice 1.5s / room 1s, gộp payload, retry khi lỗi) → server verify → pulse/rank`.

- **Session engine tách riêng** `frontend/src/utils/typingSession.js`: giữ `value/charCount/errorCount/currentIndex/currentChar`, chỉ so sánh phần đuôi thay đổi; trả `delta` (`append/delete/replace/composition/reset/none`) để phát âm thanh và quyết định gửi mạng. Không dùng `keydown` để tự dựng chuỗi — UniKey/IME hoạt động native.
- **Telemetry store** `frontend/src/utils/typingTelemetry.js` (`useSyncExternalStore`): chỉ chứa `currentChar`/`keyFeedback` cho `VisualKeyboard`; HUD giữ trong page và chỉ cập nhật theo batch input hoặc theo giây (không tick 250ms vô ích).
- **Deferred sync**: progress không gửi theo từng phím; hàng đợi gộp text + revision, flush nền, lỗi thì retry ở nhịp kế tiếp (không banner lỗi giữa lúc gõ). `pagehide`/`visibilitychange` flush draft + `sendTypingProgressKeepalive()` (fetch keepalive).
- **Restore an toàn**: mọi đường restore (reload, reconnect, room state) đi qua `resetTypingSession()`; không còn closure cũ/selection trễ ghi đè khi đang gõ.
- **Không tạo `TypingHud.jsx`** như đề xuất ban đầu: HUD hiện tại đủ nhẹ sau khi bỏ per-key re-render toàn trang; tách component chỉ tăng phức tạp. Quyết định này thay thế kế hoạch component hóa HUD.

## FILES CHANGED (đợt này)

| File | Thay đổi |
|---|---|
| `frontend/src/utils/typingSession.js` | **Mới** — session engine diff tăng dần; unit-test riêng: 1500 append trên 6320 ký tự ≈ 12ms, 51 replace giữa chuỗi ≈ 79ms |
| `frontend/src/utils/typingTelemetry.js` | **Mới** — external store cho keyboard |
| `frontend/src/pages/TypingBattle.jsx` | Rewire input path: session fast-path, bỏ state chết (`activeKeyCodes`, `practiceChallenges`, `sessionCompleted*`, refs scroll cũ), scheduler flush/retry, HUD theo batch, timer guard theo giây, restore qua `resetTypingSession`, `inputChars` cho passage |
| `frontend/src/components/game/VisualKeyboard.jsx` | `memo` + `Keycap` memo; tự gắn keydown/keyup/blur khi `enabled`; subscribe telemetry; không còn re-render toàn trang theo phím |
| `frontend/src/components/TypingPassage.jsx` | Nhận `inputChars` từ session (fallback `graphemes(typedText)`) |
| `frontend/src/services/api.js` | Thêm `sendTypingProgressKeepalive()` |
| `backend/src/services/typingVerifiedRecords.js` | **Fix bug** — filter `metricVersion !== 2` cứng → dùng `METRIC_VERSION` (xem mục bug bên dưới) |
| `backend/src/services/typingGame.service.js` | **Fix bug** — result trận ghi `metricVersion: 2` cứng → `METRIC_VERSION` |
| `frontend/scripts/typing-local-first-audit.mjs` | **Mới** — acceptance 3s latency/offline/finish chậm |
| `frontend/scripts/typing-solo-profile.mjs` | Profiler before/after (đã có từ đợt trước) |

## BẰNG CHỨNG ĐO LƯỜNG (profiler solo, Chromium headless)

Nguồn: `/var/folders/.../T/opencode/typing-solo-profile.json` (BEFORE) và `typing-solo-profile-after2.json` (AFTER, run sạch — run đầu có 1 outlier môi trường, xem ghi chú).

| Scenario | API | Storage writes | Bytes | Socket | Commits | p50 | p95 |
|---|---|---|---|---|---|---|---|
| fast-ascii-100 | 5 → **2** | 100 → **2** | 12 842 → **301** | – | 263 → 273* | 4.4 → **1.9** | 5.7 → **2.2** |
| human-120wpm-50 | 39 → **4** | 50 → **5** | 10 225 → **1 025** | – | 189 → 170 | 4.5 → **1.8** | 4.8 → **2.2** |
| vietnamese-ime-40 | 40 → **3** | 40 → **5** | 9 980 → **1 250** | – | 80 → 81 | 4.7 → **1.9** | 5.2 → **2.2** |
| backspace-fast-30 | 1 → 1 | 30 → **0** | 7 605 → **0** | – | 92 → 92 | 4.7 → **2.0** | 5.0 → **2.4** |
| long-500-20ms | 164 → **13** | 500 → **20** | 244 750 → **9 608** | – | 1 746 → 1 604 | 5.1 → **1.7** | 5.9 → **2.0** |
| solo-room-60@100ms | 0 | 60 → **7** | 7 821 → **927** | 48 → **9** | 275 → 220 | 10.5 → **7.5** | 11.6 → **8.1** |

\* Commits of fast-100 không giảm vì profiler đếm **mọi** commit của root, gồm keydown/keyup do `VisualKeyboard` tự xử lý (~2 commit/phím). Trước đây các commit này re-render **toàn trang 4 600 dòng**; nay chỉ chạm subtree keyboard đã memo — chi phí mỗi commit giảm, thể hiện ở p95 (5.7 → 2.2ms). Tắt bàn phím ảo (không mount) sẽ giảm tiếp số commit.

Ghi chú cold-start: scenario đầu tiên sau reload có 1 long task ~130–190ms (cả BEFORE 187ms lẫn AFTER) do Vite dev render passage lớn lần đầu; run AFTER đầu tiên ghi nhận 1 565ms — không tái hiện ở run 2 (130ms), kết luận là nhiễu môi trường/quá trình transform, không phải code path gõ. Production build không có dev transform.

## ACCEPTANCE

### 1. Local-first audit (`typing-local-first-audit.mjs`) — PASS 5/5

| Check | Kết quả |
|---|---|
| 3 000ms latency không ảnh hưởng nhịp gõ | p50 2.0 / p95 2.9ms cho 40 ký tự; input khớp tuyệt đối; 0 banner lỗi |
| Progress vẫn tới server dưới latency 3 000ms | server `inputRevision` = 40 |
| Offline gõ tiếp không gián đoạn | p50 1.8 / p95 2.1ms cho 25 ký tự; 0 banner lỗi |
| Reconnect flush hàng đợi | server `inputRevision` = 65 |
| Finish chậm (3 000ms) vẫn server-authoritative | accuracy 100, wpm 72.9 server tính; `recorded=false` + `ATTEMPT_ENDED_EARLY` (đúng luật ≥120s) |

### 2. Real browser audit (`typing-real-audit.mjs`) — PASS 18/18

Bao gồm: vị trí gõ + Backspace sửa lỗi, 60/100/150/210 WPM **dropped 0** (p95 commit 2.2–2.5ms), Vietnamese native composition qua CDP, scroll dòng, reload practice, responsive 390/430/768, room không hijack tab practice, live rank, **room offline/reconnect/reload giữ nguyên text**, spectator, timeout settle, practice 120s thật chống fake metrics + duplicate finish, chống kéo dài deadline, burst/Backspace/paste, finish tức thời không rewardable, legacy metric-only bị từ chối.

### 3. Backend typing suite — PASS 51/51

`NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 test/typing_*.test.js test/multiplayer_audit_sam_and_typing.test.js` → 51/51.

### 4. Gate build

- `npm run check` (frontend): 108 files, 0 errors.
- `npm run build` (frontend): pass, TypingBattle chunk 139.05 kB (gzip 35.42).
- Backend `node --check` trên 2 file sửa: OK.

## BUG PHÁT HIỆN TRONG ĐỢT NÀY

**Verification sai version metric (P1, backend).** `typingMetrics.METRIC_VERSION = 3` nhưng `typingVerifiedRecords.js` lọc cứng `metricVersion !== 2`, còn `typingGame.service.js` ghi result trận với `metricVersion: 2` cứng. Hệ quả: kết quả practice (metric v3) **không bao giờ** vào BXH verified — `bestWpm` verified luôn 0, `hasUnverifiableHistory` luôn true sau khi bump metric. Test `typing_practice_authority.test.js` bắt được (subtest "old cached fake record…" fail `0 !== 10`) — đã fix cả hai chỗ dùng `METRIC_VERSION`, suite xanh lại.

Lưu ý triển khai: theo chính sách TB-005, sau deploy các result cũ `metricVersion=2` trong DB thật sẽ không còn được coi là verified (hiển thị "lịch sử chưa xác minh") cho tới khi tích lũy result v3 mới. Cần thông báo product trước khi release.

## GHI CHÚ & CÒN LẠI

- Số liệu p95 ~2ms là trên **Vite dev + Chromium headless**; production build còn nhanh hơn. Chưa đo thiết bị thật/iOS Safari/IME hệ điều hành.
- `TypingPassage` vẫn render block 32 từ memo hóa; đây là đóng góp chính của p95 đỉnh điểm.
- Room dùng chung input path mới nhưng HUD/arena còn to hơn practice; p95 room 8.1ms là chấp nhận được nhưng có thể tối ưu tiếp bằng cách memo hóa standings (đã có) và giảm commit từ keydown/keyup nếu cần.
- Chưa backfill dữ liệu sản xuất (XP/Best cũ) — ngoài phạm vi đợt này.

## CÁCH TÁI LẬP

```bash
# Fixture stack (backend fixed code)
cd workrank-realtime/backend
NODE_ENV=test PORT=5101 node test/fixtures/typing-live-server.cjs
# Vite
cd ../frontend && VITE_API_URL=http://127.0.0.1:5101 npx vite --host 127.0.0.1 --port 5273

# Profiler before/after
PROFILE_WEB=http://127.0.0.1:5273 PROFILE_API=http://127.0.0.1:5101 \
PROFILE_OUT=/tmp/typing-solo-profile.json node scripts/typing-solo-profile.mjs

# Acceptance
TYPING_AUDIT_WEB=http://127.0.0.1:5273 TYPING_AUDIT_API=http://127.0.0.1:5101 node scripts/typing-real-audit.mjs
node scripts/typing-local-first-audit.mjs
```

Artifacts: `docs/audit/2026-10-19/typing/real-browser-results.json`, `docs/audit/2026-10-19/typing/local-first-results.json`.
