# PRIVATE MEDIA V2 — BÁO CÁO KHẮC PHỤC

**Ngày:** 04/11/2026 (giờ Việt Nam)
**Phạm vi:** `/Applications/du-an/workrank/workrank-realtime`
**Môi trường kiểm thử:** Chromium 148.0.7778.96 (Playwright), backend SQLite in-memory cô lập (`test/fixtures/private-media-listening-live.cjs`, cổng 5119), frontend Vite cổng 5279, YouTube Data API v3 + IFrame Player API thật.

> Mọi kết luận dưới đây đều có bằng chứng máy đọc được trong `docs/audit/2026-11-04/`:
> `baseline/repro.json`, `browser/browser-results.json`, `perf/perf.json`, `migration/`.
> Không có gate nào được đánh PASS mà thiếu bằng chứng chạy thật.

---

## 1. Tóm tắt điều hành

| Hạng mục | Kết quả |
|---|---|
| P0 — video dừng/reset khi chuyển trang | **Đã sửa tận gốc.** Player, socket và volume chuyển lên app shell; iframe không bao giờ bị unmount. Chế độ **chỉ nghe**: không render bề mặt video, iframe chạy ngầm off-screen. |
| P1 — chat nghe chung | **Đã có**, lưu DB, realtime, phân trang, chống trùng, rate limit, authorization server-side. |
| P2 — playlist có sẵn | **Vịt Độ Mixi: 85/85 video** (MixiGaming chính thức). **Conan: 200/200 tập** (POPS Anime chính thức). Tất cả đã kiểm tra public + embeddable. |
| P3 — playlist tự tạo + shuffle | **Đã có**, lưu DB, shuffle bag Fisher–Yates, không lặp trong một vòng. |
| Queue ↔ playlist | Một engine duy nhất; queue thủ công luôn phát trước, sau đó playlist tiếp tục đúng vị trí. |
| Quyền riêng tư | Giữ nguyên: owner bootstrap `tienddph50842@gmail.com`; admin không có quyền mặc định; mọi denial là **404**. |
| Kiểm thử | Backend V2: **17/17 PASS**. Browser: **24/24 PASS**. Frontend check + build: PASS. |

---

## 2. Root cause lỗi dừng/reset video (P0)

### 2.1 Bằng chứng trước khi sửa

`frontend/scripts/pm-baseline-repro.mjs` chạy trên code cũ, ghi tại `baseline/repro.json`:

```json
{ "step": "playing",        "before": { "currentTime": 5.89, "paused": false }, "markerBefore": 1, "iframeCount": 1 }
{ "step": "on /dashboard",  "iframes": 0, "marker": 0 }
{ "step": "on /leaderboard","iframes": 0, "marker": 0 }
{ "step": "on /games",      "iframes": 0, "marker": 0 }
{ "step": "back on media",  "after": { "currentTime": 19.74 }, "marker": 0, "iframeNavigations": 2 }
```

Đọc được ba sự thật:

1. Rời trang Media → **iframe biến mất hoàn toàn** (`iframes: 0`). Âm thanh dừng ngay.
2. Quay lại → **iframe mới** (`marker: 0`, `blob:` src mới). Player bị tạo lại từ đầu.
3. `currentTime` nhảy 5.89 → 19.74 vì server vẫn chạy đồng hồ tham chiếu, nhưng client phải `loadVideoById(startSeconds)` lại — tức là **buffer lại từ đầu**, và mọi trạng thái cục bộ (volume, trạng thái buffer, vị trí seek đang chờ) mất sạch.

### 2.2 Nguyên nhân gốc — hai lớp

**Lớp 1 — player nằm trong page component.**
`YouTubeStage` được render bên trong `pages/PrivateMedia.jsx`. React unmount page khi đổi route, và effect cleanup gọi `playerRef.current?.destroy?.()`:

```js
// YouTubeStage.jsx (code cũ)
return () => {
  cancelled = true;
  try { playerRef.current?.destroy?.(); } catch {}
  playerRef.current = null;
};
```

**Lớp 2 — error boundary được key theo location, làm remount toàn bộ cây.**
Đây là lý do vì sao chỉ “chuyển provider lên App shell” là **không đủ**:

```jsx
// App.jsx (code cũ)
function RouteErrorBoundary({ children }) {
  const location = useLocation();
  const resetKey = `${location.key}:${location.pathname}:${location.search}`;
  return <AppErrorBoundary key={resetKey} resetKey={resetKey}>{children}</AppErrorBoundary>;
}
```

`key` đổi theo từng navigation ⇒ React **unmount và mount lại toàn bộ subtree**, kể cả provider đặt bên trong. Lần kiểm thử đầu tiên sau khi chuyển provider vào `Layout` vẫn FAIL chính vì lý do này (`iframe survives /dashboard: false`).

### 2.3 Các giả thuyết khác đã kiểm tra và loại trừ

| Giả thuyết | Kết quả điều tra |
|---|---|
| `visibilitychange`/`blur` pause player | Không có listener nào trong code cũ. Không phải nguyên nhân. |
| Socket reconnect phát lại `LOAD_VIDEO` | Socket chỉ emit state; không phát lại lệnh. |
| Shared sync dùng `currentTime` cũ | Có guard `revision` + `serverNow`; không gây reset. |
| Nhiều player cùng điều khiển | Trước V2 chỉ có 1 player/tab, nhưng **nhiều tab cùng user** đều tạo player ⇒ có thể chồng tiếng. Đã xử lý bằng lease (mục 3.3). |
| Lỗi chỉ xảy ra khi chuyển browser tab | Không. Chuyển route nội bộ đã đủ gây lỗi. |

### 2.4 Cách sửa

1. `PrivateMediaProvider` được mount **trên `RouteErrorBoundary`** trong `App.jsx`, tức là trên cả router:

```jsx
<PrivateMediaProvider>
  <RouteErrorBoundary>
    <AppRoutes />
  </RouteErrorBoundary>
</PrivateMediaProvider>
```

2. Player là một **audio host cố định, off-screen** (`position: fixed; left: -10000px; 320×180`) do provider sở hữu. Giữ kích thước thật thay vì `display: none` để Chrome tiếp tục decode âm thanh; trang Media không render bề mặt video.
3. **Không reparent iframe.** Reparent `<iframe>` trong DOM làm nó reload ở Chrome/Firefox, nên node được tạo một lần và không bao giờ di chuyển.
4. Không còn `destroy()` khi đổi route. Player chỉ bị destroy khi mất quyền truy cập hoặc khi tab này không còn giữ lease.

---

## 3. Kiến trúc persistent player sau khi sửa

```
WORK RANK APP SHELL  (App.jsx)
│
├── PrivateMediaProvider            ← sống suốt phiên đăng nhập
│   ├── Socket /private-media       ← 1 kết nối duy nhất
│   ├── Session state + revision    ← server là authority
│   ├── YouTube iframe (PersistentPlayer)
│   ├── Local volume (localStorage) ← không broadcast
│   ├── Chat feed + playlist library
│   └── Player lease (BroadcastChannel)
│
├── RouteErrorBoundary (key theo location — KHÔNG chứa provider)
│
├── Layout (sidebar + outlet)
│   ├── Tổng quan / Bảng xếp hạng / Trò chơi / …
│   └── Điều khiển Media  → chỉ render slot + controls
│
└── PersistentPlayer — audio host (fixed, off-screen 320×180)
    └── iframe YouTube chạy ngầm; KHÔNG render bề mặt video
        Trang Media chỉ hiển thị thẻ "Đang phát" + điều khiển
```

### 3.1 State chung vs state riêng

| State | Nơi lưu | Chia sẻ |
|---|---|---|
| `videoId`, `status`, `positionAtReference`, `serverReferenceTime`, `revision` | `private_media_sessions` | Tất cả participant |
| `queue`, `playlistOrder`, `playlistCursor`, `playlistRepeat` | JSON trên session | Tất cả participant |
| `volume`, `mute`, `preferredVolume` | `localStorage` theo `userId` | **Chỉ thiết bị đó** |
| `localPlayerReady`, lease tab | RAM của tab | Chỉ tab đó |

Snapshot, command journal và socket event **không chứa volume** — test cũ `private_media_shared_listening.test.js` vẫn xanh và tiếp tục khẳng định điều này.

### 3.2 Đồng bộ timeline

- Server lưu `currentTime` tại mốc `referenceTime`; khi `PLAYING`, vị trí hiện tại = `currentTime + (now − referenceTime)`.
- Client chỉ seek khi lệch **> 2.5 giây**, tối đa **1 lần / 4 giây**, và **không seek khi player đang buffering** (`getPlayerState() === 3`) hoặc trong 3 giây đầu sau khi load bài.
- Không có vòng lặp broadcast `currentTime` 60 lần/giây. Progress chỉ gửi mỗi 3 giây và server giới hạn 1.5 giây/lần.

### 3.3 Multi-tab ownership

`components/privateMedia/playerOwnership.js`:

- `BroadcastChannel` tên `workrank:private-media:player-owner`.
- Tab đầu tiên `claim`; tab khác nhận `owner` và **không tạo iframe** — hiển thị “Đang phát ở tab khác” + nút “Phát ở tab này”.
- Heartbeat 2 giây, lease hết hạn sau 7 giây (tab crash không khoá vĩnh viễn).
- `takeover` chuyển quyền ngay; tab cũ `destroy()` player trước khi nhường.

Bằng chứng (`MULTI_TAB_PLAYER_OWNERSHIP`): tab A `{iframe:1, handoff:false}`, tab B `{iframe:0, handoff:true}`; sau takeover `[0, 1]`; sau khi lấy lại `[1]`.

### 3.4 Hành vi theo từng tình huống bắt buộc

| Tình huống | Kết quả đo được |
|---|---|
| **A. Chuyển route nội bộ** (Media → Tổng quan → Bảng xếp hạng → Trò chơi → Media) | Cùng một node iframe ở cả 4 chặng (`sameNode: true`), `paused: false`, `6.7s → 11.4s`, volume 0.4 giữ nguyên. |
| **B. Chuyển browser tab** (mở example.com, quay lại) | `11.4s → 18.9s` (+7.5s), không pause, không reset. Chromium cho phát nền với iframe YouTube. |
| **C. Nghe chung** | A rời trang 5 giây: B vẫn phát (26.4s). A quay lại: lệch A/B **0.4 giây**, B không bị pause. |
| **D. Refresh** | Player mới nhưng load đúng `startSeconds`: `PLAYER_REFRESH_RESTORE` đo `before 28.7s → after 30.6s`, volume 0.4 giữ nguyên, không quay về 0. Chat/playlist khôi phục (`CHAT_PERSISTENCE`, `PLAYLIST_PERSISTENCE`). |
| **E. Nhiều tab cùng user** | Chỉ 1 iframe tồn tại; tab còn lại hiển thị handoff. |
| **Bề mặt video** | Không render. Audio host `x: -10000`, `right <= 0`; `visibleIframes: 0`. |

### 3.5 Quyết định sản phẩm: chỉ nghe, không xem

Sau bản bàn giao đầu tiên (có dock video hiển thị), chủ sở hữu yêu cầu quay lại đúng cơ chế gốc:
**ẩn màn hình video, chỉ nghe**. Đã đổi như sau:

- Bỏ hoàn toàn dock/khung video và slot 16:9 trên trang.
- Iframe vẫn mounted trong `PersistentPlayer` nhưng đặt **off-screen** (`position: fixed; left: -10000px; width: 320px; height: 180px`), giữ nguyên kích thước thật để Chrome tiếp tục decode âm thanh — không dùng `display: none`.
- Trang Media thay bằng thẻ **“Chỉ phát âm thanh”**: tiêu đề, kênh, trạng thái, seek bar, transport, volume.
- Không còn cửa sổ nổi video; trạng thái “đang phát ở tab khác” hiển thị ngay trong thẻ đó.

Đánh đổi được ghi nhận minh bạch: yêu cầu hiển thị của YouTube không còn được đáp ứng. Đây là lựa chọn có chủ đích của chủ sở hữu cho một capability riêng tư; không có tách stream, không vượt quảng cáo, không proxy nội dung — vẫn là IFrame Player chính thức.

---

## 4. Chat nghe chung (P1)

### 4.1 Backend

`PrivateMediaChatMessage`: `id, sessionId, userId, content, clientMessageId, createdAt, deletedAt`.
Index `(session_id, id)` cho phân trang và unique `(session_id, user_id, client_message_id)` cho chống trùng.

`chat.service.js` đảm bảo:

| Yêu cầu | Cách thực hiện |
|---|---|
| Auth server-side | `requirePrivateMedia('view')` + kiểm tra lại entitlement trên **mỗi** socket event |
| Không nhận `userId` từ client | Hàm chỉ nhận `userId` từ JWT/handshake; field `authorId`/`senderId` trong body bị bỏ qua (có test) |
| Không XSS | Lưu plain text, loại bỏ ký tự điều khiển/zero-width; React render bằng text node, không `dangerouslySetInnerHTML` |
| Rate limit | 20 tin / 15 giây mỗi user (sliding window) + 60 request/phút qua HTTP |
| Giới hạn độ dài | 1000 ký tự, cắt theo code point an toàn |
| Phân trang | `?before=<id>&limit=30`, trả `hasMore` + `nextBeforeId` |
| Không leak | User không có grant nhận **404** ở REST; socket không join room |
| Thu hồi quyền | `revokeUser` đóng socket + REST trả 404 ngay |

### 4.2 UI

- Desktop: cột phải cạnh player, cao `min(46vh, 420px)`, cuộn riêng.
- Mobile: panel thu gọn được, có badge tin chưa đọc; mở/đóng **không** làm player reset (đo được `15.1s → 16.6s` khi toggle).
- Enter gửi, Shift+Enter xuống dòng (có assert).
- Chỉ tự cuộn khi người đọc đang ở cuối; đang đọc tin cũ thì không bị kéo.
- Empty state phân biệt “nghe chung” và “nghe riêng”.

### 4.3 Bằng chứng hai browser

`REALTIME_CHAT` + `CHAT_PERSISTENCE`:

```json
{ "bRealtimeCount": 10, "aAfterReload": 10, "bAfterReload": 10,
  "uniqueA": 10, "hasBReplyOnA": true, "hasBReplyOnB": true }
```

A gửi 10 tin → B nhận đủ 10 theo realtime → B trả lời → A nhận → refresh cả hai → vẫn đúng 10 tin, không trùng.

---

## 5. Playlist có sẵn (P2)

### 5.1 Nguồn và cách xác minh

Catalog được tạo bằng `backend/scripts/sync-private-media-catalog.js` (YouTube Data API v3, phân trang `nextPageToken`), kiểm tra từng video qua `videos.list?part=status,contentDetails`:

- `status.privacyStatus === 'public'`
- `status.embeddable === true`
- `status.uploadStatus === 'processed'`

Kết quả ghi vào `backend/src/data/private-media-catalog.json` (146 KB) và seed vào DB khi khởi động.

### 5.2 Playlist 1 — Vịt Độ Mixi

| Trường | Giá trị |
|---|---|
| Nguồn | Playlist **“Goose Goose Duck”** trên kênh chính thức **MixiGaming** (`UCA_23dkEYToAc37hjSsCnXA`) |
| Playlist ID | `PLio30oCA4I3d9kgQesZx_KfmHfDLeP4az` |
| Số video | **85** |
| Xác minh | 85/85 public + embeddable |
| Thứ tự | Theo ngày đăng tăng dần (tập cũ → mới) |

Đây là nội dung thật khớp với tên người dùng yêu cầu: series chơi *Goose Goose Duck* (“vịt/ngỗng”) của Độ Mixi, do chính kênh MixiGaming phát hành. Không có video nào được tự đặt vào playlist.

### 5.3 Playlist 2 — Thám Tử Lừng Danh Conan, tập 1–200

| Trường | Giá trị |
|---|---|
| Nguồn | Playlist **“Trọn Bộ Thám Tử Lừng Danh Conan Lồng Tiếng Hay Nhất”**, kênh chính thức **POPS Anime** (`UCkgdDBHO7zl3tWIjldQeK7g`) |
| Playlist ID | `PLKvoOwlacRoLbAmCd_0HsADRTCD4oo0Mv` (1.310 mục) |
| Số tập xác minh | **200/200** |
| Tập thiếu | **0** |
| Trùng tập | 0 (unique 200 `videoId`) |
| Tập 1 | `p90V7QNJuX8` — “Vụ Án Mạng Trên Tàu Lượn Siêu Tốc” |
| Tập 200 | `mGWdWl2_60U` |
| Khả năng embed | 200/200 public + embeddable |

**Về đánh số tập:** tiêu đề dùng “Tập N” theo cách đánh số bản lồng tiếng Việt của POPS Anime. Với Conan, số tập lồng tiếng Việt nhìn chung bám sát số phát sóng tại Nhật nhưng **không đảm bảo trùng tuyệt đối** ở các tập đặc biệt. Catalog lưu `episodeNumber` đúng như tiêu đề nguồn và `position` theo thứ tự playlist; báo cáo này không tuyên bố đó là số tập Nhật.

Playlist **không** hard-code trong code. Muốn bổ sung/hoàn thiện sau này:

```bash
cd backend
npm run private-media:catalog          # chỉ ghi JSON
npm run private-media:catalog:apply    # ghi JSON + upsert DB
```

Script tự phân trang, tự đánh dấu video `available: false` kèm lý do (`NOT_FOUND`, `NOT_PUBLIC`, `NOT_EMBEDDABLE`) thay vì lặng lẽ bỏ đi. Nếu sau này chỉ còn 70/200 tập, UI sẽ hiển thị “còn thiếu 130” và engine bỏ qua các tập không phát được — **không tạo record giả**.

### 5.4 Hành vi phát

- Mặc định **tuần tự** (`playbackMode: 'sequential'`), đúng thứ tự tập.
- “Phát từ đầu” bắt đầu từ tập 1; “Tiếp tục từ Tập N” dùng bookmark (mục 6.3).
- Chỉ shuffle khi người dùng bấm “Ngẫu nhiên”.
- Có ô tìm trong playlist (với Conan gợi ý “Tìm tập, ví dụ: 42”).
- 200 item render một lần trong khung cuộn 360px; danh sách chỉ hiển thị số tập + tên + thời lượng, **không tải thumbnail**, nên không có 200 request ảnh.

---

## 6. Playlist tự tạo (P3)

### 6.1 Mô hình dữ liệu

`PrivateMediaPlaylist`: `id, ownerUserId, slug, title, description, kind, visibility, playbackMode, repeatMode, sourceType, sourcePlaylistId, coverUrl, itemCount, expectedCount, verifiedAt`.

`PrivateMediaPlaylistItem`: `id, playlistId, videoId, title, channelTitle, thumbnailUrl, durationSeconds, episodeNumber, position, available, unavailableReason, addedByUserId`.

`PrivateMediaPlaylistProgress`: `playlistId, userId, itemId, videoId, episodeNumber, updatedAt` (unique theo cặp playlist+user).

### 6.2 Chức năng đã có

| # | Yêu cầu | Trạng thái |
|---|---|---|
| 1 | Tạo playlist | Có (UI + API) |
| 2 | Đặt tên | Có, chuẩn hoá khoảng trắng, tối đa 120 ký tự |
| 3 | Thêm video từ tìm kiếm | Có — nút “+” trên mỗi kết quả khi đang mở playlist của mình |
| 4 | Dán link YouTube | Có — ô “Dán link YouTube để thêm…” trong playlist |
| 5 | Thêm nhiều video liên tiếp | Có — API nhận mảng tới 50 item/lần; UI thêm từng link |
| 6 | Xóa video khỏi playlist | Có, có re-index `position` |
| 7 | Sắp xếp thứ tự | Có (nút lên/xuống, lưu `position`) |
| 8 | Đổi tên playlist | Có (API `PATCH`) |
| 9 | Xóa playlist | Có (xóa item + playlist) |
| 10 | Chọn chế độ phát | Có (`sequential` / `shuffle`, `repeat off/all`) |

Nhập playlist YouTube: `POST /playlists/import` với URL/ID, phân trang đầy đủ, kiểm tra video thiếu/riêng tư/không embed, báo lại `imported / declaredCount / unavailable`.

### 6.3 Persistence & resume

- Lưu DB, không localStorage. Refresh hoặc mở browser khác vẫn thấy đúng playlist (test `PLAYLIST_PERSISTENCE`: sau reload vẫn 1 card).
- Bookmark tiến độ ghi sau mỗi lần chuyển bài trong playlist, **ngoài transaction** của session.
- UI hiện “Tiếp tục từ Tập 2” khi có bookmark (test `PLAYLIST_RESUME`: label đúng, phát đúng `9mbGOrXLMhE`).

### 6.4 Riêng tư vs chia sẻ

| Loại | Ai xem | Ai sửa |
|---|---|---|
| `kind='curated'` | Mọi tài khoản có quyền | Không ai qua HTTP (chỉ script sync) |
| `visibility='private'` | Chỉ owner | Chỉ owner |
| `visibility='shared'` | Mọi tài khoản có quyền | Chỉ owner |

Playlist private của người khác trả **404**, không phải 403 — không tiết lộ sự tồn tại. Test `playlist CRUD persists and is scoped to its owner` kiểm tra cả 3 trường hợp.

---

## 7. Shuffle engine

### 7.1 Thuật toán

- Fisher–Yates trên danh sách item **còn phát được** tại thời điểm bấm.
- Toàn bộ thứ tự được **chốt một lần** và lưu vào `playlistOrder` của session ⇒ reconnect/refresh **không** xáo lại.
- Nếu phần tử đầu trùng video vừa phát và còn lựa chọn khác → hoán đổi với phần tử khác ⇒ **không lặp ngay**.
- Hết vòng: `repeat='off'` → dừng (IDLE); `repeat='all'` → tạo bag mới, tránh lặp bài vừa kết thúc.
- Thêm video giữa chừng: item mới được **append** vào cuối vòng đang chạy (vẫn phát trong vòng này).
- Xóa video đang chờ: entry bị đánh `skipped`, phần còn lại của bag không đổi.
- Một video duy nhất: bag có 1 phần tử, phát bình thường, repeat xử lý riêng.

### 7.2 Kết quả kiểm thử

`PLAYLIST_SHUFFLE_NO_PREMATURE_REPEAT` — playlist 10 video, phát 10 lượt:

```json
{ "order": ["CevxZvSJLk8","RgKAFK5djSk","9bZkp7q19f0","JGwWNGJdvx8","M7lc1UVf-VE",
            "aqz-KE-bpKQ","hT_nvWreIhg","jNQXAC9IVRw","kJQP7kiw5Fk","OPf0YbXqDm0"],
  "unique": 10, "plays": 10 }
```

Backend test bổ sung: 12 bài × 12 lượt, `Set.size === 12`, không phần tử nào trùng phần tử liền trước, và mỗi lần đọc lại session (mô phỏng reconnect) `currentQueueItemId` + `playlist.next` không đổi.

---

## 8. Queue precedence và auto-advance

### 8.1 Một engine duy nhất

`advance()` trong `session.service.js` là **con đường duy nhất** để chuyển bài:

```
advance(session)
 ├─ 1. item QUEUED thủ công (source='manual')  → phát ngay
 ├─ 2. playlistOrder[playlistCursor]            → tập kế tiếp
 ├─ 3. repeat='all' → bag mới                   → tiếp tục
 └─ 4. hết → IDLE, clear playlist
```

`NEXT`, `player-ended`, `player-error`, Telegram `/next`, hotkey F8 đều đi qua hàm này. Không có hệ thống phát thứ hai.

### 8.2 Bằng chứng

`QUEUE_PRIORITY`:

```
Đang phát: p90V7QNJuX8 (Conan tập 1)
B thêm tay: jNQXAC9IVRw
→ NEXT: jNQXAC9IVRw (queue thủ công được ưu tiên)
→ NEXT: 9mbGOrXLMhE (playlist tiếp tục đúng vị trí đã hoạch định)
```

`AUTO_ADVANCE` + `DOUBLE_ENDED_IDEMPOTENCY`: video 19 giây được seek tới giây 16; cả A và B cùng nhận ENDED:

```json
{ "before": "jNQXAC9IVRw", "after": "M7lc1UVf-VE", "queueAfter": 0 }
```

Chỉ **một** bước tiến, item thủ công không bị bỏ qua. Backend test còn bắn 4 `autoAdvance` đồng thời và khẳng định `advanced === 1`.

### 8.3 Chống hai browser cùng ENDED

`autoAdvance` khoá row session trong transaction, so `currentQueueItemId` với item vừa kết thúc; sau transition, các ENDED còn lại mang ID cũ nên bị coi là `stale`. Không cần thêm lock phân tán.

---

## 9. Permission / security

### 9.1 Nguyên tắc giữ nguyên

- `users.role` **không được đọc** trong bất kỳ file nào của Private Media. Test `NO_ROLE_BYPASS` vẫn chạy trong suite.
- Owner bootstrap một chiều từ `PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL` (mặc định `tienddph50842@gmail.com`), resolve thành `user_id` và không bao giờ chuyển nhượng.
- Mọi denial là **404** (`NOT_FOUND`), kể cả khi đã đăng nhập.

### 9.2 Bề mặt mới

| Bề mặt | Kiểm soát |
|---|---|
| `GET/POST /playlists*` | `requirePrivateMedia('view')`; ghi chỉ owner của playlist (kiểm trong service) |
| `GET/POST /chat` | `requirePrivateMedia('view')` + rate limit riêng |
| Socket `private-media:chat-send` | `authorized()` lại entitlement mỗi event; danh tính lấy từ handshake |
| `PLAYLIST_PLAY/SHUFFLE` | `CONTROL` |
| `PLAYLIST_QUEUE` | `QUEUE` |
| `PLAYLIST_STOP` | `CONTROL` |

### 9.3 Bằng chứng

`ADMIN_ACCESS_DENIED`:

```json
{ "status": 404, "session": 404, "chat": 404, "playlists": 404,
  "sidebarEntry": 0, "concealed": true }
```

Admin (role `admin`, không có grant) không thấy mục sidebar, mở route thấy trang “Không tìm thấy trang”, và mọi API đều 404.

Test bổ sung: thu hồi grant → `GET /chat` trả 404 ngay; playlist private của người khác không đọc/sửa/xóa được; Telegram chưa liên kết không tạo được side effect.

---

## 10. Hiệu năng

Đo bằng `frontend/scripts/pm-perf-check.mjs`, kết quả `perf/perf.json`:

| Chỉ số | Trước (kiến trúc cũ) | Sau (V2) |
|---|---|---|
| Số iframe YouTube | 1, nhưng **bị destroy mỗi lần đổi route** | **1**, tồn tại suốt phiên |
| Số kết nối socket | 1 (page-level) | **1** (shell-level) |
| Player khởi tạo lại khi đổi route | Có (mỗi navigation) | **Không** |
| Request playlist khi chat 15 tin | — | **0** |
| Request session/status khi chat | — | **0** |
| Long task (>50ms) trong 15 tin chat + video đang phát | — | **0** |
| iframe trên `/dashboard` | 0 (mất player) | **1**, audio-only, off-screen (`visibleIframes: 0`) |

Các biện pháp đã áp dụng:

- Không có ticker toàn cục 1 giây. Chỉ `TransportBar` và `SeekBar` dùng `useMediaClock`.
- Chat lưu trong state riêng; tin mới không trigger fetch playlist.
- `setSession` bỏ qua snapshot cũ theo `revision` + `serverNow`.
- Progress gửi tối đa mỗi 3 giây; server throttle 1.5 giây.
- Danh sách playlist tải theo nhu cầu (`select` mới fetch item), không tải 200 item khi mở tab.
- Ảnh thumbnail dùng URL `i.ytimg.com` trực tiếp, không proxy qua backend.

---

## 11. Mobile QA

Đo ở 390px và 430px (`MOBILE_390`):

```json
{ "width": 390, "overflow": 0,
  "audioHost": { "x": -10000, "w": 320, "h": 180, "offscreen": true },
  "nowCard": { "w": 362 }, "chatToggleVisible": true,
  "chatCollapsed": true, "mediaBefore": 15.0, "mediaAfter": 16.7, "paused": false }
```

- Không tràn ngang (`scrollWidth === innerWidth`).
- Không có bề mặt video; audio host off-screen, thẻ “Đang phát” rộng 362px.
- Toggle chat không làm player reset (thời gian vẫn tiến, không pause).
- Chat nằm dưới player, thu gọn được, có badge.
- Ảnh: `browser/mobile-390-top.png`, `browser/mobile-390.png`, `browser/mobile-430*.png`.

---

## 12. Regression và giới hạn browser/YouTube

### 12.1 Frontend

```
npm run check  → ✅ 110 files, 0 errors
npm run build  → ✅ built in 11.68s
```

### 12.2 Backend

- `test/private_media_v2.test.js`: **17/17 PASS**.
- `test/private_media_authz.test.js` + `test/private_media_shared_listening.test.js`: **38/38 PASS** (không hồi quy).
- Toàn bộ suite: xem mục 13.

### 12.3 Toàn bộ suite và các test đỏ có sẵn

```
# tests 727 · # pass 713 · # fail 13 · # skipped 1
```

13 test đỏ thuộc **9 suite**, tất cả đều nằm ngoài Private Media:

| Nhóm | Suite | Nguyên nhân |
|---|---|---|
| Competition Engine (11 test) | Phase 3, Phase 4 E2E, Phase 5 Hardening, Phase 9 Performance, Phase 9 Security, `integration.test.js`, MVP Cup | Test concurrency chạy trên SQLite (lock / optimistic concurrency) |
| YouTube Analytics (2 test) | `youtube_integration.test.js`, `youtube_e2e.test.js` | Xem giải thích bên dưới |

**Chứng minh không phải hồi quy:** tạo worktree tại `HEAD` (51ec342) — không có thay đổi nào — rồi chạy đúng các file đang đỏ.

*Competition (7 file):*

| | Baseline HEAD | Sau thay đổi |
|---|---|---|
| tests | 72 | 72 |
| pass | 61 | 61 |
| fail | 11 | 11 |
| tên test fail | Phase 3/4/5/9, integration, MVP Cup | **giống hệt** |

*YouTube (2 file):* trên baseline **không có** `backend/.env` → 20/20 PASS. Khi copy nguyên `backend/.env` (có `YOUTUBE_API_KEY` thật) vào worktree baseline → **18/20, đúng 2 test đỏ như trên**. Nguyên nhân nằm trong code có sẵn: `youtubeSync.service.js` chỉ dùng mock adapter khi `!process.env.YOUTUBE_API_KEY`; có key thật thì nó gọi API thật và test fail. Đây là vấn đề môi trường của test, không liên quan thay đổi lần này.

**Private Media: 55/55 PASS** (38 test cũ + 17 test V2).

### 12.4 Giới hạn thật của browser/YouTube

| Giới hạn | Thực tế đo được |
|---|---|
| Phát nền khi chuyển browser tab | Chromium 148 **tiếp tục phát** (đo +7.5s). Firefox/Safari chưa kiểm thử; một số cấu hình tiết kiệm pin có thể tạm dừng iframe. Không có thủ thuật vượt chính sách. |
| Autoplay | Nếu browser chặn, player hiện nút “Kích hoạt trình phát”; **không** gửi PAUSE cho cả phòng. |
| Document Picture-in-Picture | Chỉ Chrome/Edge 116+, cần HTTPS hoặc localhost. Thiếu hỗ trợ → dùng thanh điều khiển trong trang. |
| YouTube ToS | Player **được ẩn có chủ đích** theo yêu cầu chủ sở hữu (chỉ nghe). Vẫn dùng IFrame Player chính thức, không tách stream, không vượt quảng cáo, không tải nội dung. Đánh đổi: không đáp ứng yêu cầu hiển thị của YouTube. |
| Video không embed được | Player báo lỗi → server đánh dấu FAILED, chuyển bài, toast “Không thể phát bài này…”. |

---

## 13. Bug chưa xử lý / nợ kỹ thuật

1. **Telegram bot thật chưa được chạy trong QA** — không có `TELEGRAM_BOT_TOKEN` trong môi trường kiểm thử. Đã test ở tầng service (bind → `/playlist` → `/shuffle` → `/queue` → `/now`, chặn chat chưa liên kết) với transport giả. Cần một lần chạy thật trên môi trường có token.
2. **Phím F8 vật lý chưa được bấm** — giới hạn của máy QA (chặn inject sự kiện hệ thống). Đường `/device/commands` đã được test end-to-end bằng device token.
3. **Đánh số tập Conan** theo bản lồng tiếng Việt của POPS, không phải số phát sóng Nhật. Không thể xác minh mapping 1–1 cho các tập đặc biệt chỉ bằng metadata YouTube.
4. **`pm-audio-host` / `.pm-stage*` CSS cũ** còn trong `privateMedia.css` nhưng không còn được dùng. Không gây lỗi; nên dọn ở lần refactor CSS kế tiếp.
5. **Playlist “Vịt Độ Mixi”** hiện là 85 tập Goose Goose Duck mới nhất từ playlist chính thức. Nếu người dùng muốn một tập cụ thể khác (ví dụ video meme “vịt” đơn lẻ), cần bổ sung thủ công vào catalog — script hỗ trợ sẵn.
6. **Giới hạn 500 item/playlist** (import và thủ công). Conan 200 nằm trong ngưỡng; playlist lớn hơn sẽ bị cắt và có thông báo.

---

## 14. Final gates

| Gate | Trạng thái | Bằng chứng |
|---|---|---|
| `PLAYER_ROUTE_PERSISTENCE` | **PASS** | Cùng node iframe qua 3 route, `paused:false`, `offscreen:true`, `visibleVideo:false` |
| `PLAYER_NO_RESET_TO_ZERO` | **PASS** | 6.7s → 11.4s sau khi quay lại |
| `PLAYER_REFRESH_RESTORE` | **PASS** | Refresh: 28.7s → 30.6s, volume 0.4 giữ nguyên |
| `BROWSER_TAB_BEHAVIOR_VERIFIED` | **PASS** | 11.4s → 18.9s khi tab khác được focus |
| `SHARED_LISTENING_STABLE` | **PASS** | A rời trang, B vẫn phát; lệch cuối 0.4s |
| `MULTI_TAB_PLAYER_OWNERSHIP` | **PASS** | 1 iframe; takeover `[0,1]`; khôi phục `[1]` |
| `LOCAL_VOLUME_INDEPENDENT` | **PASS** | Volume 0.4 giữ nguyên qua route; backend test khẳng định không có volume trong state |
| `REALTIME_CHAT` | **PASS** | B nhận 10/10 tin realtime |
| `CHAT_PERSISTENCE` | **PASS** | Sau refresh: 10 tin, 10 unique, có trả lời của B |
| `CHAT_AUTHORIZATION` | **PASS** | Admin 404; revoked 404; spoofed author bị bỏ qua; rate limit |
| `DO_MIXI_PLAYLIST_VERIFIED` | **PASS** | 85 video, MixiGaming chính thức, 85/85 embeddable |
| `CONAN_EPISODE_CATALOG_VERIFIED` | **PASS** | 200/200 tập, 0 thiếu, 200 unique, POPS Anime |
| `CONAN_SEQUENTIAL_PLAYBACK` | **PASS** | Tập 1 → Tập 2, mode `sequential`, 200 item render |
| `PLAYLIST_CREATE` | **PASS** | API + UI |
| `PLAYLIST_ADD_VIDEO` | **PASS** | 10 item, giữ thứ tự |
| `PLAYLIST_DELETE_VIDEO` | **PASS** | 10 → 9, re-index |
| `PLAYLIST_PERSISTENCE` | **PASS** | Sau reload vẫn còn |
| `PLAYLIST_SHUFFLE_NO_PREMATURE_REPEAT` | **PASS** | 10 lượt, 10 unique |
| `QUEUE_PRIORITY` | **PASS** | Manual chen trước, playlist tiếp đúng vị trí |
| `AUTO_ADVANCE` | **PASS** | ENDED thật từ YouTube |
| `DOUBLE_ENDED_IDEMPOTENCY` | **PASS** | 2 player cùng ENDED → 1 bước tiến |
| `TELEGRAM_REGRESSION` | **PASS** | 38 test cũ + test `/playlist`, `/shuffle` mới |
| `GLOBAL_HOTKEY_REGRESSION` | **PASS** | `device/commands` + entitlement HOTKEY/CONTROL |
| `ADMIN_ACCESS_DENIED` | **PASS** | 4 endpoint 404, sidebar 0, trang che giấu |
| `MOBILE_390` | **PASS** | 390/430, overflow 0, player không reset |
| `FRONTEND_CHECK` | **PASS** | 110 files, 0 errors |
| `FRONTEND_BUILD` | **PASS** | Vite build thành công |
| `BACKEND_TESTS` | **PASS** | Private Media **55/55**. Toàn suite 713/727; 13 fail đều có sẵn, đã đối chứng baseline ở mục 12.3 |
| `BROWSER_MULTIPLAYER_TEST` | **PASS** | A + B + admin, 3 context riêng |

Không có gate nào ở trạng thái `BLOCKED` hoặc `UNVERIFIED`. Các giới hạn môi trường (Telegram token thật, phím F8 vật lý) được ghi rõ ở mục 13 và **không** được tính là PASS.

---

## 15. Phụ lục

### 15.1 File thay đổi

**Backend — mới**

```
src/models/PrivateMediaPlaylist.js
src/models/PrivateMediaPlaylistItem.js
src/models/PrivateMediaChatMessage.js
src/models/PrivateMediaPlaylistProgress.js
src/migrations/20261104100000-private-media-v2-playlists-chat.js
src/migrations/20261104110000-private-media-playlist-progress.js
src/services/privateMedia/playlist.service.js
src/services/privateMedia/chat.service.js
src/data/private-media-catalog.json
scripts/sync-private-media-catalog.js
test/private_media_v2.test.js
```

**Backend — sửa**

```
src/models/index.js
src/models/PrivateMediaSession.js
src/services/privateMedia/session.service.js
src/services/privateMedia/youtube.service.js
src/services/privateMedia/realtime.service.js
src/services/privateMedia/telegram.service.js
src/controllers/privateMedia.controller.js
src/routes/privateMedia.routes.js
src/sockets/privateMedia.js
src/middlewares/privateMedia.middleware.js
src/server.js
test/fixtures/private-media-listening-live.cjs
package.json
```

**Frontend — mới**

```
src/context/PrivateMediaContext.jsx
src/components/privateMedia/PersistentPlayer.jsx  (audio host, off-screen)
src/components/privateMedia/playerOwnership.js
src/components/privateMedia/ChatPanel.jsx
src/components/privateMedia/PlaylistPanel.jsx
src/components/privateMedia/mediaTime.js
src/hooks/useMediaClock.js
scripts/private-media-v2-qa.mjs
scripts/pm-perf-check.mjs
scripts/pm-baseline-repro.mjs
```

**Frontend — sửa / xóa**

```
src/App.jsx
src/pages/PrivateMedia.jsx        (viết lại)
src/pages/privateMedia.css        (+~800 dòng V2)
src/services/privateMediaApi.js
src/components/privateMedia/YouTubeStage.jsx   (xóa — thay bằng PersistentPlayer)
```

### 15.2 Migration

Đã áp dụng trên database dev `workrank_realtime` (MySQL), có backup trước ở `migration/before-private-media.sql`:

```
up 20261030100000-private-media-shared-listening.js
up 20261104100000-private-media-v2-playlists-chat.js
up 20261104110000-private-media-playlist-progress.js
```

Chạy lại `db:migrate` là no-op (idempotent). Bảng mới: `private_media_playlists`, `private_media_playlist_items`, `private_media_chat_messages`, `private_media_playlist_progress`. Cột mới trên `private_media_sessions`: `active_playlist_id`, `playlist_title`, `playlist_mode`, `playlist_repeat`, `playlist_order`, `playlist_cursor`, `playlist_history`.

### 15.3 Lệnh tái lập

```bash
# Backend QA cô lập (SQLite in-memory, có catalog thật)
cd backend
NODE_ENV=test DB_DIALECT=sqlite DB_STORAGE=:memory: PORT=5119 \
  node test/fixtures/private-media-listening-live.cjs

# Frontend QA
cd frontend
VITE_API_URL=http://127.0.0.1:5119 npm run dev -- --host 127.0.0.1 --port 5279

# Kiểm thử
cd backend && NODE_ENV=test node --import ./test/setup/teardown-db.mjs \
  --test --test-concurrency=1 test/private_media_v2.test.js
cd frontend && node scripts/private-media-v2-qa.mjs
cd frontend && node scripts/pm-perf-check.mjs
```

### 15.4 Bằng chứng kèm theo

```
docs/audit/2026-11-04/
├── PRIVATE_MEDIA_V2_REMEDIATION.md   (báo cáo này)
├── baseline/repro.json               (lỗi trước khi sửa)
├── browser/browser-results.json      (24/24 PASS)
├── browser/desktop-final.png
├── browser/playlist-conan.png
├── browser/mobile-390-top.png
├── browser/mobile-390.png
├── browser/mobile-430-top.png
├── browser/desktop-listener.png
├── perf/perf.json
├── perf/audio-only-dashboard.png
└── migration/before-private-media.sql
```
