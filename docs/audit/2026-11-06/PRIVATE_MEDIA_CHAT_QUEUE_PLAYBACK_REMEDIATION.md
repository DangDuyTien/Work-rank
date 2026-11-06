# PRIVATE MEDIA V3 — SỬA CHAT PERSISTENCE + THÔNG BÁO CHROME + GIẬT 1 GIÂY CUỐI + HÀNG CHỜ TỰ CHẠY + PLAYLIST CHO NGHE RIÊNG

**Ngày:** 2026-11-06
**Phạm vi:** `/Applications/du-an/workrank/workrank-realtime` — capability Private Media (Điều khiển media / Nghe chung / Nghe riêng)
**Nguyên tắc bắt buộc:** KHÔNG REDESIGN · KHÔNG LƯỜI · KHÔNG PASS GIẢ

---

## 1. Mục tiêu và ràng buộc

Bốn yêu cầu gốc:

1. Chat không được mất khi đổi route / refresh / mất mạng; có đếm tin chưa đọc trên tiêu đề tab Chrome, ví dụ `(1)`, `(2)`, `(9+)`. **Chủ sở hữu đã chốt lại (06/11): bỏ tiếng — chỉ cần con số trên tab.** Âm báo vẫn còn nhưng **mặc định tắt**, chỉ bật khi tự tay chọn.
2. Video không được phát lại ~1 giây cuối sau khi hết bài.
3. Hàng chờ nghe chung phải tự chuyển bài (A → B → C → IDLE) mà không bấm "Bài tiếp theo".
4. Nghe riêng phải có hàng chờ và lưu được vào playlist (tuần tự / ngẫu nhiên / lặp lại).

Ràng buộc:

- Không viết player thứ hai, không viết engine hàng chờ thứ hai, không viết engine chat thứ hai.
- Không phá: player persistent, nghe chung, đồng bộ timeline, âm lượng riêng từng người, mute cục bộ, Telegram bot, hotkey F8, playlist hiện có, quyền truy cập Private Media, chat realtime, các route khác.
- Chủ sở hữu vẫn là tài khoản được bootstrap từ `tienddph50842@gmail.com`. Admin / super admin **không** mặc định có quyền.
- Không hiển thị số debug trên UI.

---

## 2. Bản đồ kiến trúc hiện có (Phase 0 — đọc trước khi sửa)

| Thành phần | Vị trí | Kết luận |
|---|---|---|
| Player YouTube persistent | `frontend/src/components/privateMedia/PersistentPlayer.jsx`, render bởi `PrivateMediaProvider` | **Một** iframe duy nhất cho toàn app, nằm **trên** router. Không tạo player mới. |
| Provider (socket + player + chat) | `frontend/src/context/PrivateMediaContext.jsx`, gắn trong `App.jsx` dưới `AuthProvider` | Đã ở trên `RouteErrorBoundary` nên đổi route không remount. |
| Nguồn sự thật của playback | `backend/src/services/privateMedia/session.service.js` | Server giữ `video`, `status`, `referenceTime`, `revision`, `currentQueueItemId`. |
| Engine chuyển bài | `session.service.advance()` + `autoAdvance()` | **Một** chỗ duy nhất quyết định bài kế tiếp (queue thủ công → playlist → repeat → IDLE). |
| Sự kiện ENDED | `backend/src/sockets/privateMedia.js` → `sessions.autoAdvance()` | Client báo `ENDED`, server chuyển bài, broadcast state. |
| Chat | `chat.service.js` + `PrivateMediaChatMessage` | Đã lưu DB; thiếu **read marker phía server** và **cursor catch-up**. |
| Nghe riêng / nghe chung | `roomMode` → `private` (session theo tài khoản) vs `shared` (`room:shared`) | Hai session tách biệt, dùng chung engine. |
| Playlist | `playlist.service.js` | CRUD + shuffle bag + repeat đã có sẵn; **chưa có UI lưu từ kết quả tìm kiếm**. |

**Quyết định:** chỉ mở rộng đúng những chỗ trên. Không thêm player/queue/chat mới.

---

## 3. Root cause #1 — Chat "mất" và không có thông báo

**Triệu chứng:** đổi trang hoặc refresh thì không biết có tin mới; không có đếm trên tab; không có âm báo.

**Nguyên nhân thật:**

1. `chatOpenRef` mặc định `false` nhưng **không có component nào đăng ký trạng thái mở/đóng** → hệ thống không biết người dùng có đang nhìn chat hay không, nên không thể quyết định "có nên báo" hay "coi như đã đọc".
2. Trạng thái chưa đọc chỉ nằm trong RAM của tab. Refresh → mất. Không có read marker phía server.
3. Không có cơ chế lấy bù tin nhắn sau khi socket nối lại → tin nhắn rơi trong khoảng mất mạng là mất vĩnh viễn.
4. Không có badge tiêu đề tab, không có âm thanh.

**Cách sửa:**

- Bảng mới `private_media_chat_reads` (unique `session_id + user_id`, `lastReadMessageId`) + migration idempotent `20261106100000-private-media-chat-reads.js`.
- `chat.service.listMessages()` nhận `afterId` (cursor đi lên) và trả `lastReadMessageId`, `unread`, `nextAfterId`; thêm `markRead()` chỉ tiến về trước, `getUnread()` **loại trừ tin của chính mình**.
- Socket: `private-media:chat-read` → broadcast `private-media:chat-read` tới room riêng của user (`userRoom(userId)`) để tab khác của cùng tài khoản cũng xoá badge.
- Client: `chatPush(message, {live})` chỉ báo khi `live && !mine && !isChatOnScreen()`; `chatIdsRef` chống trùng theo `id`; `syncChat()` dùng `after=` để vá đúng phần thiếu khi reconnect.
- `ChatPanel` đăng ký `registerOpen(open)` khi mount/unmount → rời trang là "không nhìn thấy" nên badge tiếp tục đếm.
- **Âm báo mặc định TẮT** (`DEFAULT_NOTIFY_PREFS.sound = false`): badge trên tab là tín hiệu chính, đủ để nhận biết `(1)`/`(2)` mà không làm ồn khi đang nghe nhạc. Prefs cũ (bản trước ghi `sound: true`) được **migrate một lần** qua `PREFS_VERSION = 2`, nên không ai còn bị kêu sau khi cập nhật; bật lại bằng tay thì lưu đúng lựa chọn đó.

**Bằng chứng:** backend test 47–51 (persist/paginate/dedupe/quyền), e2e test 1 và 2.

---

## 4. Root cause #2 — Phát lại ~1 giây cuối

**Triệu chứng:** hết bài, video nhảy về cuối và chạy lại khoảng 1 giây, lặp.

**Nguyên nhân thật (hai lỗi cộng dồn trong cùng một tick):**

```js
// CODE CŨ (rút gọn)
if (status === 'PLAYING' && playerState !== 1) player.playVideo();  // (1)
// …rồi drift correction so playerTime với expectedPosition:
player.seekTo(target);                                             // (2)
```

1. `playVideo()` trên một video đã `ENDED` khiến YouTube **phát lại từ 0**.
2. Ngay sau đó, bộ sửa drift thấy `playerTime ≈ 0` lệch xa `target ≈ duration` nên `seekTo(duration)` → nhảy về cuối và chạy tiếp 1 giây.

Vòng lặp này tự nuôi: mỗi tick lại (1) rồi (2) chừng nào snapshot server còn mô tả bài đã hết.

**Cách sửa:** tách toàn bộ quyết định thành **một hàm thuần** `frontend/src/components/privateMedia/playerSync.js` — `decidePlayerAction()` trả về **đúng một** hành động:

```
NEW_ITEM → ENDED_AWAITING_SERVER → PLAYER_ENDED → NEAR_END guard → DRIFT
```

Quy tắc bất biến: **một item đã báo ENDED là "không được chạm"** — không play, không seek, không pause — cho tới khi server đổi `currentQueueItemId`. Thêm `END_SAFE_MARGIN_S = 3` để không bao giờ seek vào 3 giây cuối. `shouldReportEnded()` chống báo trùng.

**Bằng chứng:** unit test `frontend/test/playerSync.test.js` (9 test, có case "an item that reported ENDED is never played or seeked again"), e2e test 4 và 5 (đếm chính xác số lần `playVideo`/`seekTo` sau ENDED = 0).

---

## 5. Root cause #3 — Hàng chờ không tự chạy

**Triệu chứng:** hết bài nhưng không sang bài kế, phải bấm "Bài tiếp theo".

**Nguyên nhân thật:** trong `session.service.autoAdvance()` có một guard so sánh **đồng hồ server** với `durationSeconds - 3`:

```js
const early = s.status !== 'PLAYING' || (Boolean(s.durationSeconds) && position(s) < s.durationSeconds - 3);
if (!failed && early) return { advanced: false, premature: true };
```

`position(s)` là **ước lượng** từ `referenceTime` (lệch do độ trễ mạng, tab nền bị throttle, sai số đồng hồ). Khi ước lượng ra 197.5/200 thì bài thật đã hết nhưng server từ chối, **không có đường tự phục hồi** → kẹt vĩnh viễn.

Đã chứng minh bằng probe thật:

```
pos≈197.5 / dur=200 -> {"advanced":true,"now":"B"}
pos≈199.5 / dur=200 -> {"advanced":false}     ← ENDED thật bị từ chối
```

**Cách sửa:** tin báo cáo ENDED của player cho **đúng** `currentQueueItemId` (chính là khoá idempotency), chỉ từ chối trường hợp **bất khả thi vật lý**:

```js
const impossible = !failed && duration > 30 && at < 1;   // NOT_STARTED
```

Mọi chuyển bài vẫn đi qua đúng một `advance()`, trong transaction, có `revision++`, broadcast một lần. Báo trùng cho item cũ trả `stale`, không tiến thêm.

**Bằng chứng:** backend test 31–32, 44 (5 báo ENDED đồng thời chỉ tiến 1 lần), e2e test 4, 5, 6.

---

## 6. Root cause #4 — Nghe riêng không có hàng chờ, không lưu được playlist

**Nguyên nhân thật:** mỗi kết quả tìm kiếm chỉ có **một** nút "Phát" gọi `loadVideo(video, queue)` — luôn **thay** hàng chờ. Không có đường nào để "thêm vào hàng chờ" hay "lưu vào playlist".

**Cách sửa:**

- `loadVideo(video, queue, { playNow })` tách thành hai lệnh rõ ràng: `LOAD_VIDEO` (phát ngay, thay hàng chờ) và `QUEUE_ADD` (nối vào hàng chờ), với busy key riêng `load:<id>` / `queue:<id>` để không chặn nhầm.
- Mỗi dòng kết quả (và dòng "Đã phát gần đây") có ba hành động: `▶ Phát`, `+ Hàng chờ`, `Playlist` — đều có `aria-label` riêng.
- Modal "Lưu vào playlist": chọn playlist có sẵn (chỉ playlist `editable`) hoặc tạo playlist mới tại chỗ, có toast xác nhận, có `saveBusy` chống double-click.
- `PlaylistPanel` thêm khối "Cách phát": Tuần tự / Ngẫu nhiên / Lặp lại playlist, ghi `playbackMode` + `repeatMode` qua API playlist (không phải state cục bộ).

**Bằng chứng:** e2e test 7 (ba nút → queue +1 → lưu → reload → playlist +1 dòng), backend test 41–45, 55.

---

## 7. Root cause #5 (phát hiện trong QA) — Không mở được cài đặt thông báo trên desktop

**Triệu chứng:** ở viewport 1440px không có nút chuông; chỉ hiện trên màn hình hẹp.

**Nguyên nhân thật:** `.pm-chat__toggle { display: none; }` và chỉ được bật trong `@media` hẹp. Trước đây chat desktop luôn mở nên không cần nút — nhưng cài đặt thông báo thì **luôn** cần.

**Cách sửa:** thêm modifier `.pm-chat__toggle--settings { display: inline-flex; }` cho riêng nút chuông; nút thu gọn vẫn chỉ ở mobile (giữ nguyên hành vi desktop cũ).

**Bằng chứng:** e2e test 3 fail trước khi sửa (`element(s) not found`), pass sau khi sửa.

---

## 8. Root cause #6 (phát hiện trong QA) — Audit ghi ngoài transaction

**Triệu chứng:** không có dòng `AUTO_ADVANCE` nào trong `private_media_audit_logs` dù hàng chờ đã chuyển bài; log server có `[private-media] audit write failed: AUTO_ADVANCE SQLITE_BUSY: database is locked`.

**Nguyên nhân thật:** `audit.record()` ghi bằng connection mặc định trong khi transaction của session đang giữ write lock (SQLite). Lỗi bị `catch` nuốt nên mất dấu vết kiểm toán.

**Cách sửa:** `audit.record({ …, transaction })` nhận transaction tuỳ chọn; `autoAdvance()` truyền `t`. Audit vẫn là best-effort (không làm hỏng lệnh điều khiển) nhưng không còn mất bản ghi.

**Bằng chứng:** log server trước/sau; sau khi sửa, bản ghi `AUTO_ADVANCE` xuất hiện với `positionAtEnd`, `fromRevision`, `toRevision`, `eventId`.

---

## 9. Root cause #7 (phát hiện trong QA) — Mất gói ENDED thì hàng chờ treo vĩnh viễn

**Triệu chứng:** đứt mạng đúng lúc hết bài → nối lại → bài vẫn đứng ở bài cũ, không tự chuyển.

**Nguyên nhân thật:** `socket.emit('private-media:player-ended', …)` là **fire-and-forget**. Nếu gói tin rơi (hoặc socket "tưởng còn sống" nhưng transport đã chết), server không bao giờ biết bài đã hết. `shouldReportEnded()` lại giới hạn 2 lần thử nên sau đó không còn cơ hội nào.

**Cách sửa (hai lớp, đều tất định, không phải "chữa bằng timeout"):**

1. **Ack có hạn**: `socket.timeout(6000).emit(…, (err, ack) => …)`. Không có ack nghĩa là server **chưa** nhận → `onUndelivered()` cho phép gửi lại (tối đa theo `shouldReportEnded`). Server idempotent theo `currentQueueItemId` nên gửi lại không thể nhảy bài.
2. **Reconnect epoch**: provider tăng `connectionEpoch` mỗi lần socket `connect`; player thấy epoch đổi, nếu item hiện tại vẫn đang `ENDED` trong player thì re-arm và báo lại.

**Bằng chứng:** e2e test 5 (offline 7s → ENDED → online → tự sang B, đúng 1 lần load B, 0 replay, 0 seek).

---

## 10. Danh mục thay đổi

**Backend**

| File | Thay đổi |
|---|---|
| `src/services/privateMedia/session.service.js` | Guard ENDED chỉ từ chối `NOT_STARTED`; audit trong transaction |
| `src/services/privateMedia/audit.service.js` | `record()` nhận `transaction` |
| `src/services/privateMedia/chat.service.js` | `afterId`, `unread`, `markRead`, `getUnread`, `loadUsers`, `readMarker` |
| `src/models/PrivateMediaChatRead.js` *(mới)* | Read marker theo `(session, user)` |
| `src/migrations/20261106100000-private-media-chat-reads.js` *(mới)* | Tạo bảng + unique index, idempotent |
| `src/models/index.js` | Đăng ký model + 2 `belongsTo` |
| `src/services/privateMedia/realtime.service.js` | `userRoom()`, `broadcastToUser()` |
| `src/sockets/privateMedia.js` | `player-ended` có ack + `eventId`; join user room; `private-media:chat-read` |
| `src/controllers/privateMedia.controller.js` | `afterId`, `getChatUnread`, `markChatRead` |
| `src/routes/privateMedia.routes.js` | `GET /chat/unread`, `POST /chat/read` |

**Frontend**

| File | Thay đổi |
|---|---|
| `src/components/privateMedia/playerSync.js` *(mới)* | Quyết định player thuần, một hành động/tick |
| `src/components/privateMedia/PersistentPlayer.jsx` | Dùng `decidePlayerAction`; guard ended; ack + retry; reconnect epoch |
| `src/utils/mediaNotifications.js` *(mới)* | Ting tổng hợp Web Audio, badge tiêu đề/favicon, prefs, Notification API |
| `src/context/PrivateMediaContext.jsx` | Chat trên router; cursor sync; unread; prefs; `connectionEpoch`; ack emit |
| `src/components/privateMedia/ChatPanel.jsx` | Popover cài đặt (Bật/Tắt, Âm báo, Âm lượng), đăng ký open/unmount |
| `src/pages/PrivateMedia.jsx` | Ba hành động mỗi kết quả; modal lưu playlist; trạng thái "đang chuyển bài" |
| `src/components/privateMedia/PlaylistPanel.jsx` | Khối "Cách phát"; nút Phát tôn trọng `playbackMode` |
| `src/pages/privateMedia.css` | Chỉ **thêm** style (không sửa layout cũ), gồm fix nút chuông desktop |
| `src/services/privateMediaApi.js` | `listChat({after})`, `getChatUnread`, `markChatRead` |
| `package.json` | `test:unit` (node --test) |

**Test mới**

| File | Nội dung |
|---|---|
| `backend/test/private_media_v3_chat_queue_playback.test.js` | 15 test (ENDED thật, ENDED giả, trùng, 2 browser, A→B→C→IDLE, solo/shared, chat cursor/unread, REST, playlist, shuffle, admin 404, thu hồi quyền) |
| `frontend/test/playerSync.test.js` | 9 test quyết định player |
| `frontend/test/mediaNotifications.test.js` | 7 test prefs/migrate prefs cũ/tiêu đề/ting/autoplay/Notification |
| `frontend/e2e/private-media-v3.spec.js` | 10 kịch bản browser thật, 2 context |

---

## 11. Bằng chứng test tự động

```
backend  NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 \
         test/private_media_v3_chat_queue_playback.test.js
         → # tests 15  # pass 15  # fail 0

backend  … test/private_media_authz.test.js test/private_media_shared_listening.test.js test/private_media_v2.test.js
         → # tests 55  # pass 55  # fail 0

backend  … test/persistence_regressions.test.js test/socket_room_auth.test.js
         → # tests 9   # pass 9   # fail 0

frontend npm run test:unit
         → # tests 16  # pass 16  # fail 0        (9 playerSync + 7 notifications)

frontend npm run check
         → 112 files, 0 errors

frontend npm run build
         → ✓ built in 14.69s   (PrivateMedia-BTl3R4fS.js 61.12 kB)
```

---

## 12. Bằng chứng browser thật (Playwright, 2 context, headed)

**Môi trường QA** (SQLite riêng, không đụng DB thật):

```
backend  NODE_ENV=development DB_DIALECT=sqlite DB_STORAGE=/tmp/wr-qa/qa.sqlite \
         JWT_SECRET=qa-secret PORT=5099 CLIENT_URL=http://127.0.0.1:5199 node src/server.js
frontend VITE_API_URL=http://127.0.0.1:5099 VITE_SOCKET_URL=http://127.0.0.1:5099 (vite :5199)
seed     owner tienddph50842@gmail.com · friend minh.qa@workrank.local (view+queue+control)
         · admin admin.qa@workrank.local (KHÔNG được cấp quyền) · playlist "QA Playlist" [A, B]
run      E2E_BASE_URL=http://127.0.0.1:5199 npx playwright test e2e/private-media-v3.spec.js \
         --project=chromium --workers=1 --headed
```

| # | Kịch bản | Kết quả | Bằng chứng cụ thể |
|---|---|---|---|
| 1 | Chat sống qua đổi route; đếm `(3)` trên tab; **hoàn toàn im lặng** | **PASS** | title `(3) Tin nhắn mới — 3WIN MEDIA`; burst 3 tin ⇒ **0** oscillator (không tiếng); 4 dòng không trùng; rời trang ⇒ `(1)`, vẫn 0 tiếng |
| 2 | Refresh giữ nguyên lịch sử, không nhân đôi | **PASS** | số dòng trước = sau khi `reload()` |
| 3 | Cài đặt thông báo chỉ sau nút bấm; **mặc định im lặng**; bật/tắt lưu qua reload; quyền báo trung thực | **PASS** | `aria-expanded=false` lúc đầu; mặc định `Thông báo=on`, **`Âm báo=off`**, `Âm lượng=55%`; bật Âm báo + 20% ⇒ `localStorage` `"sound":true,"volume":20` ⇒ reload vẫn giữ; tắt lại ⇒ reload vẫn tắt; permission `granted` (headed) ⇒ hiện "Thông báo hệ thống đã bật." |
| 4 | Nghe riêng: hết A tự sang B, không replay | **PASS** | `loadVideoById(B)` đúng **1** lần; `playVideo` sau ENDED = **0**; `seekTo(≥197)` sau ENDED = **0** |
| 5 | Mất mạng đúng lúc hết bài: không replay, nối lại tự sang B | **PASS** | offline 7s: `playVideo`=0, `seekTo`=0, `loadVideoById`=0; online: hiện QA B, load B đúng 1 lần |
| 6 | Nghe chung 2 browser: A → B → C không bấm Next | **PASS** | cả hai tab hiện B rồi C; `Đang chờ · 0` sau khi hết |
| 7 | Nghe riêng: mỗi dòng có Phát / Hàng chờ / Playlist; lưu playlist sống qua reload | **PASS** | queue +1; dialog "Lưu vào playlist" → toast `Đã lưu…`; reload ⇒ playlist +1 dòng |
| 8 | Admin không được cấp quyền bị che | **PASS** | trang "Không tìm thấy trang"; `GET /api/private-media/chat` = **404** |
| 9 | Autoplay bị chặn: hiện "Kích hoạt trình phát trên thiết bị này", không giả vờ đang phát | **PASS** | player state = 5 (CUED), không phải 1; bấm nút ⇒ state = 1, nút biến mất |
| 10 | Tab ẩn nhận thông báo hệ thống thật; click quay về trang media | **PASS** | `Notification` thật được khởi tạo, `body` chứa nội dung tin; `onclick()` ⇒ URL `/private/media` |

Chạy **2 lần liên tiếp trên DB mới** đều `10 passed` (59.8s và 55.6s) — sau khi đổi sang chế độ im lặng mặc định.

**Ghi chú trung thực về QA:** trong headless Chromium, `Notification.permission` luôn là `denied` (giới hạn của headless), nên bài test được thiết kế để **chấp nhận cả hai trạng thái** và kiểm tra nhánh UI tương ứng; bằng chứng `granted` ở trên lấy từ cửa sổ Chromium **headed**. Player YouTube trong e2e được thay bằng một fake tất định (`window.__yt`) vì headless không giải mã video thật được — lỗi đang sửa nằm ở code của chúng ta, không nằm ở YouTube; mọi thứ còn lại (React, socket, server, DB) là thật. Ở kịch bản 10, trạng thái "tab ẩn" được **mô phỏng** (`visibilityState = 'hidden'`) vì Playwright mở mỗi page trong một cửa sổ riêng nên không thể làm tab kia thật sự bị ẩn; `Notification` và handler click vẫn là thật.

---

## 13. Hồi quy & cổng chất lượng

- `private_media_authz` (bao gồm `NO_ROLE_BYPASS`), `private_media_shared_listening`, `private_media_v2`: **55/55 PASS**.
- `persistence_regressions` + `socket_room_auth`: **9/9 PASS**.
- `npm run check`: 112 file, **0 lỗi**.
- `npm run build`: **thành công**.
- Không đổi schema cũ; chỉ **thêm** bảng `private_media_chat_reads`.

---

## 14. Rủi ro còn lại và việc cần làm khi triển khai

1. **Bắt buộc chạy migration** trước khi deploy backend: `cd backend && npm run db:migrate` (bảng `private_media_chat_reads`). Thiếu bước này, `GET /chat` sẽ lỗi khi tính unread.
2. **Âm báo mặc định tắt.** Nếu người dùng tự bật, âm thanh dùng Web Audio và AudioContext khởi đầu `suspended` cho tới khi có tương tác thật — tab chưa từng được bấm sẽ **im lặng** (không lỗi), đúng chính sách autoplay.
3. **Thông báo desktop** chỉ hoạt động khi tab còn mở; không có service worker/push (đúng phạm vi yêu cầu). Khi tab đóng hẳn, chỉ còn cách mở lại trang.
4. **Thông báo hệ thống**: handler click đã được kiểm chứng bằng `Notification` thật (e2e #10). Phần **không** automation được là cú bấm vào bong bóng của hệ điều hành (macOS/Windows sở hữu hành vi đó), và hộp thoại xin quyền của trình duyệt.
5. **Telegram bot**: luồng lệnh dùng chung engine đã test (36, 54) nhưng bot thật không chạy trong QA vì thiếu `TELEGRAM_BOT_TOKEN` — xem G51.
6. **Hotkey F8**: đường lệnh đã test (37) — G52; bấm phím vật lý không automation được trên máy này — G39.
7. `frontend/.env.local` chỉ là file tạm của QA (trỏ về :5099) và **đã được xoá** sau khi kiểm thử.

---

## FINAL GATES

`PASS` = có bằng chứng chạy được (test/browser log). `UNVERIFIED` = chưa có bằng chứng, không tuyên bố. `BLOCKED` = không thể kiểm chứng trong môi trường này.

### A. Chat & thông báo

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G1 Chat không mất khi đổi route | **PASS** | e2e #1 (rời trang → quay lại, lịch sử còn) |
| G2 Chat không mất khi refresh | **PASS** | e2e #2 (số dòng không đổi) |
| G3 Không nhân đôi tin khi reconnect/socket giao trùng | **PASS** | e2e #1/#2 + backend 47 (dedupe `clientMessageId`), `chatIdsRef` theo id |
| G4 Đếm chưa đọc trên `document.title` | **PASS** | e2e #1 `(3) Tin nhắn mới — 3WIN MEDIA`, `(1)` sau đó |
| G5 Favicon badge | **PASS** | `setFaviconBadge()` + unit test title/favicon path |
| G6 Unread chỉ reset khi thực sự đọc | **PASS** | e2e #1: ở lại trang ⇒ `(0)`; rời trang ⇒ tăng lại |
| G7 Tin của chính mình không tăng unread | **PASS** | `chatPush` bỏ qua `mine`; backend `unreadCount` loại `user_id` (test 47) |
| G8 Giao trùng không tăng đúp | **PASS** | dedupe theo `message.id` trước khi tăng |
| G9 Ting tự tạo, không dùng audio của Telegram | **PASS** | 2 dao động sin E6→B6 tổng hợp; **tắt mặc định**, chỉ dùng khi tự bật (e2e #3) |
| G10 Bật/Tắt thông báo + Âm báo + Âm lượng 0–100, lưu theo user/device | **PASS** | e2e #3: mặc định `Âm báo=off`; bật + 20% ⇒ `"sound":true,"volume":20`; tắt lại ⇒ reload vẫn tắt |
| G11 Badge là tín hiệu chính: không kêu dù nhiều tin | **PASS** | e2e #1: 3 tin ⇒ **0** oscillator, title vẫn `(3)`; tin lẻ ⇒ `(1)`, vẫn 0 tiếng |
| G12 Không đổi/không tạm dừng âm lượng video | **PASS** | module thông báo có **0** tham chiếu `setVolume`, đồ thị audio riêng |
| G13 Xử lý autoplay trung thực | **PASS** | `playNotificationTing` trả `blocked/unsupported`, không ném lỗi; unit test "suspended context" |
| G14 Desktop notification chỉ sau nút bấm | **PASS** | e2e #3: popover đóng lúc đầu, `aria-expanded=false`, chỉ `requestPermission` trong `askPermission` |
| G15 Click thông báo quay về đúng trang | **PASS** | e2e #10: `Notification` thật, `onclick()` ⇒ URL `/private/media` (bong bóng OS do người dùng bấm là phần trình duyệt, không automation được) |
| G16 Không thêm service worker/push | **PASS** | không file SW nào được thêm; `git status` không có `sw.js`/manifest mới |

### B. Phát lại cuối bài

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G17 Không replay 1 giây cuối (nghe riêng) | **PASS** | e2e #4: `playVideo` sau ENDED = 0, `seekTo(≥197)` = 0 |
| G18 Không replay khi mất mạng | **PASS** | e2e #5: offline 7s, 0 play/seek/load sau ENDED |
| G19 Một chuyển bài nguyên tử, idempotent | **PASS** | backend 32/44 (5 báo đồng thời ⇒ tiến 1 lần), `revision++` trong transaction |
| G20 Không seek vào vùng cuối | **PASS** | `END_SAFE_MARGIN_S=3` + unit test "drift near end" |
| G21 Log chẩn đoán có `currentVideoId/playerState/currentTime/duration/eventType/revision/commandId`, không hiện trên UI | **PASS** | `AUTO_ADVANCE` metadata + fact `duration` có `position/playerState`; UI không có số debug |

### C. Hàng chờ nghe chung

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G22 Tự chuyển A→B→C→IDLE không bấm Next | **PASS** | e2e #6 + backend 31 |
| G23 Server quyết định khi mọi browser báo ENDED, chỉ tiến 1 lần | **PASS** | backend 32/44 |
| G24 Không nhảy bài, không nhân đôi item | **PASS** | `stale` khi `currentQueueItemId` đã đổi; backend 33 |
| G25 Lỗi phát (unavailable/private/embed-disabled) chuyển bài, không "PASS giả" | **PASS** | `errorCode` → `failed` → `advance(s, true)` + `lastFailure`; backend 34 |
| G26 Autoplay bị chặn ⇒ "Cần bấm để tiếp tục", không giả vờ phát | **PASS** | e2e #9: player kẹt ở CUED, UI hiện "Kích hoạt trình phát trên thiết bị này"; bấm ⇒ phát thật (state 1) |
| G27 Âm lượng/mute riêng từng người | **PASS** | `setVolume/mute` cục bộ theo tab; backend 34 (volume không vào snapshot) |
| G28 Đổi tab không làm video restart | **PASS** | player nằm trên router; e2e #1 (rời trang, player vẫn giữ bài) |

### D. Nghe riêng & playlist

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G29 Mỗi kết quả có Phát / Thêm vào hàng chờ / Lưu vào playlist | **PASS** | e2e #7 (3 nút với aria-label riêng) |
| G30 Lưu playlist có persist DB, không chỉ state | **PASS** | e2e #7 reload ⇒ +1 dòng; backend 45 |
| G31 Không nhân đôi khi double-click/retry | **PASS** | `saveBusy` chặn submit; backend 33 (retry scoped) |
| G32 Playlist sống qua refresh/logout/login/trình duyệt khác | **PASS** | e2e #7 (refresh); backend 45 (theo owner), 55 (progress theo tài khoản) |
| G33 Tuần tự / ngẫu nhiên / lặp lại, không lặp sớm | **PASS** | backend 41 (bag: mỗi video 1 lần/chu kỳ, không lặp liền kề), 42 (repeat=all) |
| G34 Thêm bài khi đang phát không reset bài hiện tại / không xáo lại | **PASS** | `syncActiveCycle` nối vào chu kỳ đang chạy; backend 43 |
| G35 SOLO và SHARED là hai phiên riêng, cùng một engine | **PASS** | backend 31 (`room:shared` vs phiên tài khoản) |

### E. Không phá chức năng cũ

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G36 Player persistent không bị remount khi đổi route | **PASS** | `PrivateMediaProvider` dưới `AuthProvider`; e2e #1 |
| G37 Đồng bộ timeline vẫn đúng | **PASS** | `expectedPosition` + drift guard; e2e #4 (không seek sai) |
| G38 Telegram dùng chung engine + đúng quyền (đường lệnh) | **PASS** | backend 36 (`/queue` qua binding), 54 (`/playlist`, `/shuffle`) |
| G39 Hotkey F8: bấm phím vật lý | **UNVERIFIED** | automation không bấm được phím toàn hệ thống trên máy này |
| G40 Playlist hiện có không bị đổi | **PASS** | chỉ thêm `playbackMode/repeatMode`; backend 45, 55 |
| G41 Quyền Private Media đúng: admin không mặc định | **PASS** | e2e #8 (trang che + API 404); `private_media_authz` 30 test |
| G42 Chat realtime vẫn chạy | **PASS** | e2e #1/#2 |
| G43 Các route khác không hỏng | **PASS** | e2e #1 điều hướng `/dashboard` → `/private/media`; `npm run build` OK |
| G44 Không redesign, không số debug trên UI | **PASS** | chỉ thêm chuông/badge/nút hàng chờ/playlist/trạng thái chuyển bài |

### F. Chất lượng

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| G45 `npm run check` | **PASS** | 112 file, 0 lỗi |
| G46 Build frontend | **PASS** | `✓ built in 14.69s` |
| G47 Backend regression liên quan | **PASS** | 55/55 + 15/15 + 9/9 |
| G48 Frontend unit | **PASS** | 16/16 |
| G49 QA browser ≥ 2 context được cấp quyền | **PASS** | 10/10 headed, 2 lần liên tiếp trên DB mới |
| G50 Report có bằng chứng, không PASS giả | **PASS** | tài liệu này; các mục `UNVERIFIED` được nêu rõ |
| G51 Bot Telegram thật (gửi/nhận trên Telegram) | **UNVERIFIED** | QA không có `TELEGRAM_BOT_TOKEN`; chỉ kiểm chứng đường lệnh |
| G52 Hotkey: đường lệnh thiết bị đúng quyền | **PASS** | backend 37 (thiết bị dùng chung phiên, vẫn cần CONTROL) |

---

## Kết luận

Bốn yêu cầu gốc đã được xử lý ở đúng tầng của chúng (server cho chuyển bài, một hàm thuần cho quyết định player, server cho read marker, API playlist có sẵn cho lưu trữ) — không có player/queue/chat thứ hai, không có redesign.

Ba lỗi chỉ lộ ra khi chạy browser thật (nút chuông bị ẩn trên desktop, audit ghi ngoài transaction, mất gói ENDED gây treo hàng chờ) đã được sửa và có test hồi quy. Hai lỗi nữa lộ ra ngay trong lúc viết test (đếm dòng chat lấy mốc quá sớm, và phụ thuộc vào việc làm mới danh sách "gần đây" theo thời gian thực) đã được sửa ở phía test, không phải bằng cách nới lỏng assertion.

Điều **chưa** kiểm chứng được trong môi trường này — cú bấm vào bong bóng thông báo của hệ điều hành, phím F8 vật lý, bot Telegram thật (thiếu token) — được đánh dấu `UNVERIFIED` thay vì tô hồng.
