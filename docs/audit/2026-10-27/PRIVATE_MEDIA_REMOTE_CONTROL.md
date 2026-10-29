# WORK RANK — PRIVATE MEDIA REMOTE CONTROL

**Ngày:** 2026-10-27
**Phạm vi:** `workrank-realtime` (backend + frontend + `mac-helper`)
**Nguyên tắc:** capability riêng tư, **không** dựa trên role. Admin/super admin **không** mặc định có quyền.

---

## 1. TÓM TẮT

```text
Root owner bootstrap : tienddph50842@gmail.com → Work Rank user #10943 (role = user)
Module               : /api/private-media/* + socket namespace /private-media + mac-helper
Backend tests        : 27/27 PASS
Browser QA           : 18/18 PASS
Migration            : applied on dev MySQL (forward, repeatable)
Global F8            : UNVERIFIED  (OS-level key injection bị chặn quyền Accessibility)
Telegram real bot    : BLOCKED_BY_CREDENTIAL (chưa có TELEGRAM_BOT_TOKEN)
YouTube search       : PASS (key đã gắn, search thật trả kết quả)
YouTube player       : PASS (video thật, currentTime > 0)
Mini controller      : PASS (cửa sổ nhỏ 3 nút, không cần ghép nối)
```

Điểm quan trọng nhất — **admin không phải owner** — được chứng minh ở 3 tầng độc lập:

| Tầng | Bằng chứng |
|---|---|
| UI | `ADMIN_HIDDEN_IN_SIDEBAR — entries=0` |
| Route | `ADMIN_DIRECT_ROUTE_CONCEALED — notFound=1 leaked=0` |
| API | `ADMIN_API_DENIED — {"access":404,"status":404,"session":404,"grants":404,"audit":404,"devices":404,"grantPost":404}` |
| Source | test `NO_ROLE_BYPASS` quét toàn bộ module, không có `requireRole` / `isAdmin` / `role === 'admin'` |

---

## 2. ARCHITECTURE

```text
Private Media UI  (React, /private/media)
       │  axios (JWT)
       ▼
Private Media API (/api/private-media/*)  ── requirePrivateMedia(permission)
       │
       ├── access.service      owner resolution + entitlement + grant/revoke
       ├── session.service     single logical session + idempotent command bus
       ├── device.service      Mac helper tokens (hashed, revocable)
       ├── telegram.service    long-polling bot + binding
       ├── youtube.service     official Data API + keyless oEmbed fallback
       ├── audit.service       append-only audit
       └── realtime.service    broadcast + immediate revocation
                  │
                  ▼
     socket.io namespace  /private-media
       rooms: pm:controllers (state) · pm:players (commands)
                  │
                  ▼
        MySQL  private_media_*  (8 tables)

Mac helper (Swift, menu bar)
       F8 / ⇧F8 / F9  →  RegisterEventHotKey  →  POST /device/commands (X-Device-Token)
```

Tách biệt có chủ đích:

* **Namespace socket riêng** (`/private-media`) → không thêm event nào vào socket chính, không ảnh hưởng module khác.
* **Bảng riêng** (`private_media_*`) → không sửa schema lõi.
* **Không đọc `users.role`** ở bất kỳ file nào trong module.

### File map

```text
backend/src/migrations/20261027190000-create-private-media.js
backend/src/models/PrivateMedia{Owner,Grant,Device,TelegramBinding,PairingCode,Session,Command,AuditLog}.js
backend/src/middlewares/privateMedia.middleware.js
backend/src/services/privateMedia/{access,session,device,pairing,telegram,youtube,audit,realtime}.service.js
backend/src/controllers/privateMedia.controller.js
backend/src/routes/privateMedia.routes.js
backend/src/sockets/privateMedia.js
backend/test/private_media_authz.test.js

frontend/src/pages/PrivateMedia.jsx  (+ privateMedia.css)
frontend/src/components/privateMedia/YouTubeStage.jsx
frontend/src/hooks/usePrivateMediaAccess.js
frontend/src/services/privateMediaApi.js
frontend/scripts/private-media-browser-qa.mjs

mac-helper/{Package.swift, Sources/WorkRankPrivateMediaHelper/main.swift, README.md}
```

---

## 3. OWNER MODEL

### Bootstrap một lần, sau đó chỉ dùng user id

```text
PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL
        ↓ (một lần duy nhất)
User.findByEmail()
        ↓
private_media_owners.user_id  ← nguồn sự thật
        ↓
mọi quyết định authorization dựa trên user_id
```

Bằng chứng (`PRIVATE_MEDIA_OWNER_RESOLVED`):

* owner id = `#10943`, khớp `tienddph50842@gmail.com`;
* đổi email của account → owner **không** đổi theo;
* startup log thật: `[PrivateMedia] Owner resolved to Work Rank user #10943.`

### Owner không thể bị admin thay đổi

| Hành vi | Kết quả |
|---|---|
| Admin gọi `DELETE /grants/:ownerId` | `404` |
| Owner tự thu hồi chính mình | `400 CANNOT_REVOKE_OWNER` |
| API đổi owner | **không tồn tại** — chỉ đổi được bằng DB/ops |
| Owner bị disable/xóa | fail-closed: **không ai** thành owner |

`resolveOwnerUserId` trả `null` nếu owner không còn `status = active` → toàn bộ capability deny (không promote ai).

---

## 4. DELEGATED ACCESS

Bảng `private_media_grants` — 1 row / user, unique `user_id`:

```text
user_id · granted_by_user_id · can_view · can_control · can_telegram · can_hotkey
created_at · revoked_at
```

* Chỉ owner ghi được (mọi endpoint grant/revoke đi qua `requirePrivateMedia('manage_access')` = `isOwner`).
* `control | telegram | hotkey` tự động bật `can_view`.
* Delegated user **không** có `manageAccess` → không thấy section "Quản lý quyền truy cập" và API trả 404.
* Không có `canManageAccess` trong bảng → không thể tự nâng quyền bằng payload.

Bằng chứng: `OWNER_CAN_GRANT`, `DELEGATED_CANNOT_GRANT`, `DELEGATED_ACCESS` (view-only nhận `404` khi POST `/commands`).

---

## 5. ADMIN DENIAL

`requirePrivateMedia` chỉ gọi `accessService.getEntitlement(userId)`:

```js
if (ownerUserId === userId) return fullEntitlement();
const grant = await PrivateMediaGrant.findOne({ where: { userId, revokedAt: null } });
if (!grant || !grant.canView) return null;   // → 404
```

Không có nhánh nào đọc `req.user.role`. Test `NO_ROLE_BYPASS` đọc 10 file nguồn và fail nếu xuất hiện `requireRole(`, `isAdmin`, `role === 'admin'`, `super_admin`.

**Concealment:** mọi denial là `404 {"message":"Not found","code":"NOT_FOUND"}` — không phải `403`, để người không có quyền không phân biệt được với route không tồn tại.

---

## 6. YOUTUBE

### Player — official IFrame API

`YouTubeStage.jsx` load `https://www.youtube.com/iframe_api`, tạo `new YT.Player(...)`, không rip audio / không proxy stream / không bypass ads. CSP được mở đúng mức cần thiết:

```js
scriptSrc: [..., 'https://www.youtube.com', 'https://s.ytimg.com']
frameSrc:  ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com']
```

Bằng chứng thật (browser QA, video `aqz-KE-bpKQ`):

```text
PLAYBACK_PROGRESS — video=aqz-KE-bpKQ t=11.2558s status=PLAYING
```

### Autoplay — không fake

* `autoplay: 0`; `playVideo()` chỉ gọi sau khi backend ra lệnh.
* 2 probe (1.6s, 4.2s) kiểm tra `getPlayerState() === PLAYING` **hoặc** `getCurrentTime() > 0.25`.
* Nếu không → hiện nút **"Kích hoạt trình phát"** (user gesture thật) và ack `AUTOPLAY_BLOCKED` để backend chuyển `PAUSED`.
* **Cue probe 2.5s** sau `loadVideoById`: nếu player dừng ở `CUED`/`UNSTARTED` (một số upload
  không tự chạy dù browser cho phép autoplay) → cũng hiện nút kích hoạt và báo `PAUSED`.
  `CUED` không bao giờ là "user chủ động pause" nên hiện nút ở đây là an toàn.
* Bằng chứng: `SESSION_STATE_HONEST` — không bao giờ báo `PLAYING` khi `currentTime` đứng yên.

### Search

* Official Data API v3 `search.list` + `videos.list` (duration), cache 60s.
* **Đã cấu hình key thật** (`backend/.env`, chỉ server-side). `GET /api/private-media/status`
  trả `youtube: {"search":true,"resolve":true,"reason":null}`.
* Kết quả thật qua HTTP: `?q=nhac%20lofi&limit=3` → 3 video, title sạch, duration đúng.
* Không scrape, không giả lập kết quả.
* Gắn/đổi key: `cd backend && npm run youtube:key -- AIza...` — script **verify key với Google
  trước khi ghi** và phân biệt `API_KEY_INVALID` với `SERVICE_DISABLED` (key đúng nhưng chưa
  Enable API), nên không bao giờ ghi key sai vào `.env`.

#### Chuẩn hoá dữ liệu YouTube

Data API trả snippet đã escape HTML (`90&#39;s`, `&quot;…&quot;`). Đã thêm `decodeHtmlEntities`
+ `trim()` ở biên (`search` và `resolveVideo`) và có test `YOUTUBE_NORMALIZATION`.

#### Lỗi trình phát

| Mã | Thông điệp hiển thị |
|---|---|
| 101 / 150 | "Video này không cho phép nhúng. Chọn video khác." |
| 100 | "Video không tồn tại hoặc đã bị xoá." |
| 2 | "Mã video không hợp lệ." |
| 5 | "Trình phát gặp lỗi. Thử tải lại trang." |

Trước đây các mã này chỉ đẩy `status: ERROR` xuống backend còn UI vẫn là khung đen —
nay có overlay giải thích.

### Đường không cần key (vẫn giữ, dùng khi chưa có key hoặc YouTube lỗi)
| Cách | Hành vi |
|---|---|
| Dán 1 link | resolve → phát ngay |
| Dán nhiều link (cách nhau bởi dấu cách / xuống dòng, tối đa 20) | resolve tất cả → tạo `queue` → phát video đầu, ⏭ / ⏮ chuyển bài |
| **Đã phát gần đây** (`GET /api/private-media/recent`) | suy ra từ command journal (`LOAD_VIDEO`), dedupe theo `videoId`, phát lại 1 click |

UI tự đổi theo capability: khi `youtube.search = false`, placeholder là
"Dán link YouTube — nhiều link cách nhau bởi dấu cách…", nút submit là **Phát** (không phải "Tìm"),
và có ghi chú giải thích thiếu `YOUTUBE_API_KEY`.

Kiểm chứng thật trên browser (2 link, 1 lần dán):

```text
placeholder: Dán link YouTube — nhiều link cách nhau bởi dấu cách…
submit label: Phát
queue len: 2 | index: 0 | now: aqz-KE-bpKQ | status: PLAYING | t: 2s
after NEXT: jNQXAC9IVRw | index: 1
recent items: 2
```

### Trạng thái key (cập nhật 2026-10-28)

Trước đây project **chưa từng có** key YouTube: `youtubeSync.service.js` đọc
`process.env.YOUTUBE_API_KEY`, khi trống thì `return null` và rơi vào
*mock/deterministic adapter* — số liệu YouTube analytics khi đó là mô phỏng.

Key đã được gắn và verify thật (`npm run youtube:key`), nên **cả** analytics sync **lẫn**
search của Private Media giờ dùng dữ liệu thật. Key chỉ nằm trong `backend/.env`
(đã gitignore — `git check-ignore backend/.env` → khớp) và trong dashboard Render
(`render.yaml` khai báo `sync: false`), không bao giờ trả về client.

---

## 7. TELEGRAM

Long polling (`getUpdates`), không mở inbound webhook.

```text
Telegram user id → private_media_telegram_bindings (revoked_at IS NULL)
                 → Work Rank user id
                 → getEntitlement()  (canTelegram && canControl)
                 → ALLOW / DENY
```

* `/start` là lệnh duy nhất chấp nhận chat chưa bind — đó chính là đường bind.
* Mã bind: 8 ký tự, **hash SHA-256** khi lưu, TTL 10 phút, one-time (`UPDATE ... WHERE used_at IS NULL` đảm bảo chỉ 1 caller thắng).
* Lệnh: `/now /play /pause /toggle /stop /volume /search` + inline buttons `▶ ⏸ ⏹`.
* `/now` trả "Trình phát đang offline" khi `playerOnline = false`.

Trạng thái: **BLOCKED_BY_CREDENTIAL** — chưa có `TELEGRAM_BOT_TOKEN`.

```text
TELEGRAM_BINDING       PASS (service-level, có test)
TELEGRAM_AUTHZ         PASS (unbound → NOT_BOUND; revoked → NO_ACCESS)
TELEGRAM_REMOTE_CONTROL BLOCKED_BY_CREDENTIAL
```

Endpoint `POST /telegram/code` trả `503 TELEGRAM_DISABLED` thay vì giả vờ bot đang chạy — UI hiển thị đúng "Bot chưa được cấu hình".

---

## 8. GLOBAL HOTKEY (tùy chọn)

> **Không bắt buộc.** Cách đơn giản nhất để điều khiển khi đang làm việc ở app khác là
> **cửa sổ nhỏ** (mục 9) — bấm nút, không cần ghép nối, không cần token. Phần dưới chỉ dành
> cho ai muốn dùng phím cứng.

`mac-helper` — Swift menu bar, **không** Electron, **không** Tauri.

* `RegisterEventHotKey` (Carbon) → không cần Accessibility permission, hoạt động khi app khác đang focus.
* `F8` → `TOGGLE_PLAY_PAUSE`, `⇧F8` → `STOP`, `F9` → `NEXT`.
* **Không có HTTP server cục bộ** → không tồn tại endpoint `localhost/control` cho process lạ.
* Token thiết bị: `~/Library/Application Support/WorkRankPrivateMedia/config.json`, mode `0600` (đã kiểm: `-rw-------`).
* Mỗi lần bấm: `POST /api/private-media/device/commands` với `X-Device-Token`; backend re-check entitlement **mỗi request** → revoke có hiệu lực ngay lần bấm kế tiếp.

Bằng chứng đã chạy thật:

```text
swift build --disable-sandbox          → Build complete! (25.20s)
./WorkRankPrivateMediaHelper --pair CVSDZ32P --server http://127.0.0.1:5001
  → Đã ghép nối: MacBook QA
./WorkRankPrivateMediaHelper --self-test
  → OK — trạng thái phiên: PAUSED        (token + quyền + command bus OK)
GUI mode
  → [helper] đã đăng ký 3/3 phím tắt toàn hệ thống (F8, ⇧F8, F9)
```

**Chưa verify được:** việc **nhấn phím vật lý** F8. Máy này không cấp quyền Accessibility/Automation cho tiến trình test:

```text
osascript -e 'tell application "System Events" to key code 100'
→ System Events gặp lỗi: Đã xảy ra lỗi vi phạm đặc quyền. (-10004)
```

Vì vậy, đúng theo yêu cầu, ghi nhận:

```text
GLOBAL_HOTKEY_REAL_MACOS = UNVERIFIED
```

Quy trình verify thủ công (2 phút):

1. `cd workrank-realtime/mac-helper && swift run WorkRankPrivateMediaHelper`
2. Work Rank → Điều khiển media → tạo mã ghép nối → `--pair <MÃ>`
3. Phát một video, chuyển sang VS Code / Terminal
4. Bấm `F8` → video phải pause, vẫn ở VS Code
5. Bấm `F8` lần nữa → video resume

Lưu ý thực tế: trên Mac để hàng phím mặc định là media key, `F8` gửi "play/pause media"; cần `fn + F8` hoặc bật *Use F1, F2… as standard function keys*. Helper cố ý đăng ký F8 chuẩn để **không** chiếm media key của hệ thống.

---

## 9. TRANG WEB: CHỈ TÌM, KHÔNG HIỆN VIDEO

Bản web **không còn khung xem video**. Trang chỉ có: ô tìm/dán link, danh sách kết quả
(chỉ tên), cột phải (kết nối, màu cửa sổ nhỏ, Telegram, phím tắt, quyền, nhật ký).

| Trước | Giờ |
|---|---|
| Khung 16:9 + tấm che + thanh điều khiển + âm lượng | **không có gì** — chỉ tên video trong danh sách |
| Ảnh thumbnail trong kết quả | số thứ tự + tên + kênh · thời lượng |

### Vẫn phát tiếng bằng cách nào

Iframe YouTube **vẫn mounted** trong `.pm-audio-host` — một khung 320×180 đặt **ngoài viewport**
(`left: -10000px`), `pointer-events: none`, `aria-hidden`. Không dùng `display:none` /
`visibility:hidden` / kích thước 0 vì những cách đó khiến Chrome **dừng phát**.

Bằng chứng: `NAMES_ONLY_UI — thumbnails=0 visiblePlayer=0 audioIframe=1`, và session
`PLAYING t=20 → t=26` trong 5 giây khi iframe nằm ở `x = -9716`.

---

## 10. CỬA SỔ NHỎ (3 nút, luôn nổi)

### Nội dung

**5 nút, không chữ** — thanh 186×40, cửa sổ PiP 190×44:

| Nút | Kích thước | Hành vi |
|---|---|---|
| loa nhỏ | 24×26 | `SET_VOLUME` −10 (dừng ở 0) |
| phát / tạm dừng | 36×26 | `TOGGLE_PLAY_PAUSE` |
| dừng | 30×26 | `STOP` |
| chuyển tiếp | 30×26 | `NEXT` |
| loa to | 24×26 | `SET_VOLUME` +10 (dừng ở 100) |

Không tên video, không đồng hồ, không thanh tiến trình. Nút âm lượng tự disable khi đã ở
0% / 100% để có phản hồi mà không cần hiện số.

### Vì sao trước đây nó "chỉ hiện trong trang 3WIN, không sang tab khác"

`requestWindow()` **bắt buộc phải gọi trong user gesture**. Bản cũ gọi nó trong `useEffect`
(một nhịp sau cú click) → Chrome từ chối → code rơi về **thanh nổi trong trang**, mà thanh đó
là một phần của trang nên đổi tab là mất.

Đã sửa: `openMini()` gọi `requestWindow()` **ngay trong handler click** (trước mọi `await`),
rồi truyền `window` xuống `MiniPlayer` qua prop `pipWindow`.

```js
const win = await window.documentPictureInPicture.requestWindow({ width: 132, height: 44 });
setMiniWindow(win);
```

Khi mở được cửa sổ thật, nó là **cửa sổ OS** nên vẫn nổi khi bạn chuyển tab hoặc chuyển app —
trên cả macOS và Windows (cùng một API `documentPictureInPicture`, Chrome/Edge 116+).

### Fallback có thông báo

Nếu trình duyệt không hỗ trợ hoặc bị chặn, trang hiện Notice nói rõ lý do và dùng thanh nổi
trong trang (vẫn đủ 3 nút). Không im lặng nữa.

### Màu

| Lựa chọn | Ý nghĩa |
|---|---|
| **Tự động** (mặc định) | Cửa sổ PiP theo **giao diện sáng/tối của macOS** — đúng thứ thanh tab Chrome theo. Thanh trong trang thì theo theme của trang. |
| **Sáng** / **Tối** | Cố định palette |

Lưu ở `localStorage['workrank:private-media:mini-theme']`.

### Vì sao không "khớp màu tab Chrome đang mở" được

```text
window.open('https://example.com') → đọc w.location.href
→ SecurityError: Blocked a frame with origin "http://localhost:5173"
   from accessing a cross-origin frame
```

Mỗi tab là một origin riêng; Chrome cũng không có API trả về màu tab đang active. Nên giải pháp
là **theo OS** + **cho chọn tay**.

### Bằng chứng (browser QA, cửa sổ PiP thật)

```text
MINI_PIP_WINDOW        buttons=5 text=""
MINI_CONTROLLER_THEME  bg=rgb(255,255,255)
MINI_PALETTE_OVERRIDE  auto=white dark=rgba(18,18,18,.94) back=white
MINI_COMMAND_WORKS     PLAYING → PAUSED      (bấm trong cửa sổ điều khiển được video)
MINI_VOLUME            90 → 80 → 90          (hai nút âm lượng, bước 10%)
MINI_CLOSE             window closed=true
```

---

## 11. SECURITY

| Hạng mục | Cách làm |
|---|---|
| Server là authority | Mọi route `/api/private-media/*` qua middleware; frontend chỉ quyết định *hiển thị* |
| Không client-only | Ẩn UI + 404 backend; ép `entitled:true` trong DevTools vẫn 404 |
| Fail closed | `getEntitlement` catch mọi lỗi → `null` → deny |
| Không self-grant | `manage_access` = `isOwner`; không có cột `canManageAccess` |
| Secrets | `TELEGRAM_BOT_TOKEN`, `YOUTUBE_API_KEY` chỉ trong env backend; không có trong bundle/response |
| Token at rest | device token & pairing code: **chỉ SHA-256 hash**; plaintext trả đúng 1 lần |
| Audit redaction | `sanitizeMetadata` thay `token/secret/code/hash/password` bằng `[redacted]` |
| Idempotency | `private_media_commands.command_id` UNIQUE; replay trả `duplicate: true`, không đổi state |
| Session ownership | 1 session/key `primary`; command chỉ tác động session đó |
| Revoke tức thời | grant → revoke → device + telegram binding revoke + socket disconnect |

Kiểm chứng secret (test `SECRETS_NOT_EXPOSED`): response `/status` và `/audit` không chứa `pmd_`, không chứa bot token, không có `tokenHash`/`botToken`.

### Revocation propagation — test live (không chỉ unit test)

```text
owner grant admin (view+control+hotkey)        → 200
admin socket connect /private-media            → connected
owner DELETE /grants/1                          → 200 {"revoked":true}
admin socket nhận private-media:access-revoked  → {"reason":"access-revoked"} + disconnected
admin GET /api/private-media/access             → 404
```

---

## 12. BROWSER QA

Script: `frontend/scripts/private-media-browser-qa.mjs` (Playwright, chạy trên build production + backend thật).

```text
PASS  OWNER_SEES_NAV                    entries=1
PASS  OWNER_OPENS_PAGE                  h1=1
PASS  YOUTUBE_PLAYER_EMBEDDED           iframes=1
PASS  TRANSPORT_RENDERED                controls=5
PASS  SESSION_STATE_HONEST              status=LOADING t=19s
PASS  AUTOPLAY_GESTURE_OFFERED_OR_ALLOWED  browser allowed autoplay
PASS  YOUTUBE_SEARCH                    results=12
PASS  NAMES_ONLY_UI                     thumbnails=0 visiblePlayer=0 audioIframe=1
PASS  PLAYBACK_PROGRESS                 video=aqz-KE-bpKQ t=18.7s
PASS  OWNER_API_ACCESS                  status=200
PASS  MINI_PIP_WINDOW                   buttons=5 text=""
PASS  MINI_CONTROLLER_THEME             bg=rgb(255,255,255)
PASS  MINI_PALETTE_OVERRIDE             auto=white dark=rgba(18,18,18,.94) back=white
PASS  MINI_COMMAND_WORKS                PLAYING → PAUSED
PASS  MINI_VOLUME                       90 → 80 → 90
PASS  MINI_CLOSE                        window closed=true
PASS  ADMIN_HIDDEN_IN_SIDEBAR           entries=0
PASS  ADMIN_DIRECT_ROUTE_CONCEALED      notFound=1 leaked=0
PASS  ADMIN_API_DENIED                  {"access":404,...,"grantPost":404}
```

`SESSION_STATE_HONEST` thay cho check "NO_FAKE_PLAYBACK" cũ: bất biến đúng là
**không bao giờ báo `PLAYING` khi đồng hồ đứng yên** (một UI giả lập phát sẽ vi phạm ngay).
`YOUTUBE_SEARCH` tự động `SKIP` (không tính pass/fail) khi server không có key.

Screenshots: `docs/audit/2026-10-27/shots/`

| File | Nội dung |
|---|---|
| `owner-sidebar.png` | sidebar owner có nhóm "Riêng tư" |
| `owner-private-media.png` | trang đầy đủ (search, player, rail) |
| `owner-search-results.png` | search thật: 12 kết quả, title sạch, có thumbnail + thời lượng |
| `owner-mini-bar.png` | trang web không còn khung video, chỉ tên + nút mở cửa sổ nhỏ |
| `owner-web-no-player.png` | trang web: chỉ ô tìm + danh sách tên, không có player |
| `owner-web-keyless.png` | trạng thái dùng được **không cần key**: dán link + "Đã phát gần đây" |
| `owner-player-playing.png` | video thật đang phát 0:11 / 10:35 |
| `admin-sidebar.png` | sidebar admin **không** có mục nào |
| `admin-direct-url.png` | admin vào thẳng URL → "Không tìm thấy trang" |
| `browser-qa.json` | dữ liệu thô của lần chạy |

---

## 13. API AUTHORIZATION

```text
POST /device/commands        device token (X-Device-Token)   → hotkey path
POST /devices/pair           pairing code (one-time, hashed) → trả token 1 lần
GET  /access                 view        (probe cho UI)
GET  /status | /session      view
GET  /youtube/search         view
POST /youtube/resolve        view
POST /commands               control     (+ rate limit 240/phút)
GET  /commands/recent        view
GET  /recent                 view        (danh sách phát lại nhanh, không cần key)
GET  /grants                 manage_access  (owner only)
POST /grants                 manage_access  (owner only)
DELETE /grants/:userId       manage_access  (owner only)
GET  /users/search           manage_access  (owner only)
GET  /telegram               view
POST /telegram/code          telegram
DELETE /telegram             telegram
GET  /devices                hotkey
POST /devices/code           hotkey
DELETE /devices/:id          hotkey
GET  /audit                  manage_access  (owner only)
```

Ma trận quyền:

| Actor | access | commands | grants | audit | devices | telegram |
|---|---|---|---|---|---|---|
| Anonymous | 401 | 401 | 401 | 401 | 401 | 401 |
| Member | 404 | 404 | 404 | 404 | 404 | 404 |
| Admin | 404 | 404 | 404 | 404 | 404 | 404 |
| Admin + isDev (super) | 404 | 404 | 404 | 404 | 404 | 404 |
| Delegated (view) | 200 | 404 | 404 | 404 | 404 | 404 |
| Delegated (control) | 200 | 200 | 404 | 404 | 404 | 404 |
| Owner | 200 | 200 | 200 | 200 | 200 | 200 |

---

## 14. TESTS

### Backend — `backend/test/private_media_authz.test.js`

```text
# tests 27
# pass 27
# fail 0
```

| # | Test | Gate |
|---|---|---|
| 1 | PRIVATE_MEDIA_OWNER_RESOLVED | OWNER_RESOLVED |
| 2 | OWNER_ACCESS | OWNER_ACCESS |
| 3 | ADMIN_HIDDEN (18 endpoint) | ADMIN_HIDDEN |
| 4 | SUPER_ADMIN_HIDDEN | SUPER_ADMIN_HIDDEN |
| 5 | NORMAL_MEMBER_HIDDEN | NORMAL_MEMBER_HIDDEN |
| 6 | API_AUTHZ (anonymous) | API_AUTHZ |
| 7 | OWNER_CAN_GRANT | OWNER_CAN_GRANT |
| 8 | DELEGATED_CANNOT_GRANT | DELEGATED_CANNOT_GRANT |
| 9 | DELEGATED_ACCESS | DELEGATED_ACCESS |
| 10 | ADMIN_CANNOT_SELF_GRANT | ADMIN_CANNOT_SELF_GRANT |
| 11 | OWNER_CANNOT_BE_REMOVED | OWNER_CANNOT_BE_REMOVED |
| 12 | NO_ACTIVE_MEDIA_SESSION | NO_VIDEO_SAFE |
| 13 | YOUTUBE_PLAYER (load + play) | YOUTUBE_PLAYER |
| 14 | IDEMPOTENCY | IDEMPOTENCY |
| 15 | MULTI_CONTROLLER_CONSISTENCY | WEBSOCKET_REALTIME |
| 16 | RECENT_VIDEOS (owner 200 / admin 404 / dedupe) | API_AUTHZ |
| 17 | YOUTUBE_NORMALIZATION (HTML entity, ISO duration, video id) | YOUTUBE_SEARCH |
| 18 | PROGRESS_QUIET_WINDOW (tick cũ không đảo được lệnh) | WEBSOCKET_REALTIME |
| 19 | DEVICE_AUTHZ (pair → use → revoke) | DEVICE_AUTHZ |
| 20 | DEVICE_AUTHZ (member cannot mint) | DEVICE_AUTHZ |
| 21 | TELEGRAM_AUTHZ (unbound/one-time/revoked) | TELEGRAM_AUTHZ |
| 22 | SECRETS_NOT_EXPOSED (gồm cả YouTube key) | SECRETS_NOT_EXPOSED |
| 23 | AUDIT_LOG | AUDIT_LOG |
| 24 | MIGRATION (repeatable + unique) | MIGRATION |
| 25 | NO_ROLE_BYPASS (static scan) | ADMIN_CANNOT_BYPASS |
| 26 | OTHER_WORKRANK_PERMISSIONS_UNCHANGED | ISOLATION |
| 27 | WEBSOCKET_REALTIME (namespace riêng) | WEBSOCKET_REALTIME |

### Frontend

```text
npm run check   → 100% integrity across all 100 files, 0 errors
npm run build   → ✓ built (PrivateMedia chunk 27.8 kB)
npm test        → 25 passed, 0 failed  (route smoke, đã thêm PrivateMedia)
```

### Full backend suite (không hồi quy)

```text
# tests 696   # pass 685   # fail 10   # skipped 1   # suites 146   (~7 phút)
```

10 subtest fail nằm trong **6 suite có sẵn từ trước**, không liên quan Private Media:

```text
competition_phase3            Phase 3 — Stateful Competition
competition_phase5_hardening  Phase 5 Final Hardening Audit
competition_phase9_performance Phase 9 Concurrency Stress & Performance
competition_phase9_security   Phase 9 Security & Broken Access Control (BAC)
integration.test.js
mvp_cup_comprehensive_e2e     MVP Cup Comprehensive E2E
```

Đây đúng là bộ 6 suite đã được ghi nhận là fail ở baseline trong
`docs/audit/2026-10-24/FULL_SIDEBAR_PRODUCT_REMEDIATION.md`
("cùng 6 suite fail như baseline"). Không có suite nào trong danh sách trên bị sửa bởi thay đổi này.

Phạm vi thay đổi thực tế (không tính file mới):

```text
.env.example                  |  6 ++++++
backend/.env.example          | 12 ++++++++++++
backend/src/app.js            |  9 ++++++++-     (CSP: youtube frame/script)
backend/src/config/env.js     | 10 ++++++++++    (privateMedia config block)
backend/src/routes/index.js   |  3 +++          (mount /private-media)
backend/src/server.js         | 23 +++++++++++++ (namespace + bot + shutdown)
6 files changed, 62 insertions(+), 1 deletion(-)
```

Không chạm vào: KPI, Games, Competition, YouTube analytics, Drawing, Room Engine, Accounts, Collaboration.

---

## 15. REMAINING CREDENTIALS

| Biến | Trạng thái | Ảnh hưởng |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **thiếu** | Không có bot. Bind/authorize đã test ở service-level; `POST /telegram/code` → `503 TELEGRAM_DISABLED` |
| `YOUTUBE_API_KEY` | **đã cấu hình** (2026-10-28) | Search thật hoạt động; key chỉ ở server, đã gitignore, có test chống lộ |
| `PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL` | có (default) | Owner đã resolve → user #10943 |

Cách bật Telegram (không cần sửa code):

```bash
# backend/.env
TELEGRAM_BOT_TOKEN=123456:ABC...
```

Restart backend → bot bắt đầu polling. Không cần migrate lại.
Trên production: dán giá trị vào dashboard Render (biến đã khai báo trong `render.yaml`).

---

## 16. FINAL VERDICT

```text
PRIVATE_MEDIA_OWNER_RESOLVED:        PASS
OWNER_ACCESS:                        PASS
NORMAL_MEMBER_HIDDEN:                PASS
ADMIN_HIDDEN:                        PASS
SUPER_ADMIN_HIDDEN:                  PASS
DIRECT_ROUTE_AUTHZ:                  PASS
API_AUTHZ:                           PASS
ADMIN_CANNOT_SELF_GRANT:             PASS
OWNER_CAN_GRANT:                     PASS
OWNER_CAN_REVOKE:                    PASS
DELEGATED_ACCESS:                    PASS
DELEGATED_CANNOT_GRANT:              PASS
YOUTUBE_SEARCH:                      PASS
YOUTUBE_PLAYER:                      PASS
PLAY_PAUSE:                          PASS
TELEGRAM_BINDING:                    PASS
TELEGRAM_AUTHZ:                      PASS
TELEGRAM_REMOTE_CONTROL:             BLOCKED_BY_CREDENTIAL
MAC_HELPER:                          PASS (tùy chọn — không bắt buộc)
MINI_CONTROLLER:                     PASS (cửa sổ PiP thật, 5 nút, 186×40)
WEB_NAMES_ONLY:                      PASS (không khung video, vẫn phát tiếng)
GLOBAL_F8_HOTKEY:                    UNVERIFIED (tùy chọn)
DEVICE_AUTHZ:                        PASS
REVOKE_PROPAGATION:                  PASS
WEBSOCKET_REALTIME:                  PASS
AUDIT_LOG:                           PASS
SECRETS_NOT_EXPOSED:                 PASS
OTHER_WORKRANK_PERMISSIONS_UNCHANGED: PASS
FRONTEND_CHECK:                      PASS
FRONTEND_BUILD:                      PASS
BACKEND_TESTS:                       PASS (module 27/27; full suite 685/696 —
                                          10 fail thuộc 6 suite competition/integration
                                          có sẵn từ baseline, không file nào bị sửa)
OVERALL:                             PASS (1 mục BLOCKED do thiếu Telegram token
                                           và 1 mục UNVERIFIED do quyền OS)
```

Không có mục nào được đánh PASS bằng cách bỏ qua bước kiểm tra.

### Điều kiện để chuyển 2 mục còn lại sang PASS

1. Thêm `TELEGRAM_BOT_TOKEN` → `TELEGRAM_REMOTE_CONTROL` = PASS (bind + `/now` + inline ⏸).
2. Cấp Accessibility cho Terminal/app chạy helper, hoặc bấm F8 thật → `GLOBAL_F8_HOTKEY` = PASS.
