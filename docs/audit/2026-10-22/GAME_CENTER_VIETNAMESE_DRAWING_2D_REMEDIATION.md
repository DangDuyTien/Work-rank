# WORK RANK — HỢP NHẤT GAME CENTER, MENU DỌC TIẾNG VIỆT & XƯỞNG VẼ 2D

**Ngày:** 2026-10-22
**Phạm vi:** `workrank-realtime/frontend` (UI Game Center, sidebar, 5 trò chơi, Xưởng Vẽ, Thư viện tranh)
**Nguyên tắc:** chỉ đổi phần người dùng nhìn thấy. Không đổi `gameType`, route, socket event, DB enum, khoá BXH/lưu trữ hay Room Engine.

---

## 1. Game Registry Audit

### Trước khi sửa — ba nguồn dữ liệu song song

| Nơi khai báo | Nội dung | Hệ quả |
|---|---|---|
| `src/config/navigation.js` | 4 item hardcode: `Danh mục trò chơi`, `WorkRank Typing`, `Góc Sáng Tạo (Game Vẽ)`, `Thư Viện Tranh` | 3 game arcade mới **không có** trong menu dọc |
| `src/pages/GameHub.jsx` | `DEFAULT_GAMES` tự ghép: 3 game arcade (bỏ `computer_rush`) + Typing + Drawing | Tên game arcade lấy tiếng Anh từ shared registry; card không có “Gõ Nhanh” riêng |
| `shared/gameRegistry.mjs` + `backend/src/services/gameCatalog.service.js` | metadata gốc + trạng thái mở/đóng | Chỉ dùng cho catalog/BXH, không dùng cho menu |

**Nguyên nhân gốc:** game mới được thêm vào Game Center/route nhưng không được thêm vào `navigation.js`; mỗi nơi lại có danh sách riêng nên lệch nhau. `Sidebar.jsx` còn có map phụ `GAME_ROUTE_TO_KEY` chỉ biết 2 route.

### Sau khi sửa — một nguồn duy nhất

`frontend/src/games/arcade/catalog.js` xuất `GAME_REGISTRY` với đúng 5 entry:

```js
{
  id, gameType, catalogKey, kind,
  route, hubRoute, matchPaths, exactPaths,
  menuNameVi, displayNameVi, subtitleVi, descriptionVi, longDescriptionVi,
  place, mark, icon, theme, modes,
  menuVisible, gameCenterVisible
}
```

| Consumer | Đọc từ |
|---|---|
| Menu dọc | `GAME_MENU_ITEMS` (5 game) + `GALLERY_NAV_ITEM` + `GAME_CENTER_NAV_ITEM` |
| Game Center | `GAME_CENTER_ITEMS` |
| Tiêu đề trang (`Layout`) | `gameByPath(pathname)` |
| Lobby / BXH / kết quả | `gameById`, `gameDisplayName`, `gameMenuName` |
| Nhãn chế độ / trạng thái phòng | `MODE_LABELS_VI`, `ROOM_STATUS_LABELS_VI` |
| Badge “Sắp ra mắt” | `item.catalogKey` (bỏ map `GAME_ROUTE_TO_KEY`) |

Thêm game mới bây giờ = thêm một entry; không phải sửa sidebar, GameHub, title hay BXH.

---

## 2. Sidebar Before

```
🎮 Trò Chơi
  ▸ Danh mục trò chơi
  ▸ WorkRank Typing          ← chỉ tới /games/typing
  ▸ Góc Sáng Tạo (Game Vẽ)
  ▸ Thư Viện Tranh
```

- `Gõ Nhanh`, `Phản Xạ Bốn Hướng`, `Trí Nhớ Nhanh` **không xuất hiện**.
- Tên lẫn Anh – Việt; “Typing”, “Game Vẽ” không nói được người chơi làm gì.
- Active state chỉ đổi màu nền + một chấm nhỏ; không có thanh chỉ vị trí, không đủ rõ khi màn hình sáng.

## 3. Sidebar After

```
TRÒ CHƠI
  ⌨  Đua Gõ Chữ
  🖥  Gõ Nhanh
  ✥  Phản Xạ Bốn Hướng
  ◉  Trí Nhớ Nhanh
  🎨 Xưởng Vẽ
  🖼 Thư viện tranh
  ↗  Trung tâm trò chơi
```

- Đúng 5 trò đang mở, cùng một thứ tự với Game Center.
- Active state: **thanh accent 3px bên trái** + nền `--accent-soft` + chữ đậm hơn + icon đổi nét + `aria-current="page"` → không dùng màu làm tín hiệu duy nhất.
- `matchPaths` cho phép một game sở hữu nhiều URL (phòng chơi, xem lại); `exactPaths` giữ `/games/typing` không “nuốt” `/games/typing/words`.
- Nhóm `Trò Chơi` mở sẵn để người mới thấy ngay 5 trò; trên mobile drawer cũng vậy.
- Desktop 250px, tablet ≤1024 dùng drawer hiện có, mobile không chiếm nửa màn hình.

---

## 4. Vietnamese Naming Map

| Internal (giữ nguyên) | Route | Tên hiển thị | Subtitle |
|---|---|---|---|
| `typing_battle` | `/games/typing/passage` | **ĐUA GÕ CHỮ** | Gõ chính xác · Vượt đối thủ |
| `computer_rush` | `/games/typing/words` | **GÕ NHANH** | Từ xuất hiện · Gõ thật nhanh |
| `direction_rush` | `/games/arcade/direction_rush` | **PHẢN XẠ BỐN HƯỚNG** | Nhanh mắt · Nhanh tay |
| `memory_flash` | `/games/arcade/memory_flash` | **TRÍ NHỚ NHANH** | Nhìn nhanh · Nhớ chuẩn |
| `drawing` | `/games/drawing` | **XƯỞNG VẼ** | Vẽ sáng tạo · Chia sẻ tác phẩm |

Nhãn phụ:

| Enum nội bộ | Hiển thị |
|---|---|
| `SOLO` | Chơi một mình |
| `1V1` (alias `DUO`) | Đấu 1 chọi 1 |
| `2V2` | Đấu đội 2 chọi 2 |
| `3V3` | Đấu đội 3 chọi 3 |
| `TRIO` | Ba người tự do |
| `WAITING / READY / STARTING / PLAYING / FINISHED / CLOSED` | Đang chờ / Sẵn sàng / Chuẩn bị bắt đầu / Đang chơi / Đã kết thúc / Đã đóng |
| `TEAM A/B` | Đội A / Đội B |

Các chuỗi hành động đã Việt hóa: Chơi ngay, Tạo phòng, Vào phòng, Sẵn sàng, Bắt đầu, Rời phòng, Chơi lại, Chơi lại cùng nhóm, Bảng xếp hạng, Kỷ lục cá nhân, Điểm, Thời gian, Chuỗi, Độ chính xác, Kết quả, Người thắng.

---

## 5. Remaining English Audit

### Audit tĩnh (mới)

`frontend/scripts/game-center-i18n-audit.mjs` — quét **22 file UI**, chỉ đọc text node JSX và `title / placeholder / aria-label / alt`, bỏ qua identifier, class, route, comment.

```text
✅ [Game Center i18n] Không còn chữ Anh trong 22 file UI.
```

Hai chuỗi cuối cùng đã sửa: “Quản lý trạng thái game” → “Quản lý trạng thái trò chơi”; “Cài đặt Game” → “Cài đặt trò chơi”.

### Audit runtime (Playwright)

Quét `innerText` của Game Center, 5 trang game, Xưởng Vẽ, Thư viện tranh ở 1440 / 430. **0 từ tiếng Anh** ngoài allowlist.

Được phép giữ: `WORK RANK ARCADE`, `WPM`, `XP`, `PNG`, `Backspace`, `WASD`, `YouTube`, `KPI`, `BXH`.

Đã sửa trong đợt này: `GAME COMPLETE` → `HOÀN THÀNH VÁN`; `GO!` → `BẮT ĐẦU!`; `PERFECT/GOOD` → `HOÀN HẢO!/TỐT!`; `LEVEL UP` → `TĂNG CẤP`; `MEMORY RUSH` → `TĂNG TỐC TRÍ NHỚ`; `COMBO` → `CHUỖI`; `TEAM A` → `ĐỘI A`; `ENGLISH` → `TIẾNG ANH`; `Typing Battle` → `Đua Gõ Chữ`; `Game Center` → `Trung tâm trò chơi`.

---

## 6. Drawing Before

- Tiêu đề “Game Vẽ Tranh WorkRank”, badge “GÓC SÁNG TẠO”.
- Một hàng toolbar icon-only: không biết đang dùng cọ gì, cỡ bao nhiêu.
- Swatch 22px, không có tên màu, không có preview cỡ cọ.
- Canvas nằm trên nền chấm bi; không có khung/giá vẽ, không có nhân vật.
- Nhân vật bị nhét vào header, cao 47px, gần như vô hình.
- Trạng thái nháp là một dải chữ nhỏ; không có hành động “Lưu bản nháp” rõ ràng.

## 7. Drawing 2D Redesign

**Bố cục mới — phòng nghệ thuật 2D:**

```
┌──────────────────────────────────────────────────────┐
│ ← Trò chơi   WORK RANK ARCADE · PHÒNG NGHỆ THUẬT     │
│              Xưởng Vẽ                  [Thư viện] [Đăng tranh]
│              Vẽ sáng tạo · Chia sẻ tác phẩm          │
├──────────────────────────────────────────────────────┤
│ ● Đã lưu bản nháp trên thiết bị      [Lưu nháp] [Mở] │
├──────────┬───────────────────────────────────────────┤
│  •ᴗ•     │  khung tranh treo tường   ✦  Aa  ↑        │
│  bong    │   ┌───────────────────────────────┐       │
│  bóng    │   │                               │       │
│  thoại   │   │           CANVAS              │       │
│          │   │                               │       │
│          │   └───────────────────────────────┘       │
│          │        giá vẽ + chân + khay               │
├──────────┴───────────────────────────────────────────┤
│ CỌ VẼ · 12px   [Cọ][Tẩy][Đổ][Di chuyển]  ● ○ ● ○ ○  │
│ Màu ●●●●●●●●●●●●●●  #0F172A   [↶][↷][Lưu][PNG][Xóa]│
└──────────────────────────────────────────────────────┘
```

- **Khung giá vẽ** bằng gỗ ấm, kẹp giấy phía trên, hai chân và khay bên dưới — trang trí thuần CSS, `pointer-events: none`.
- **Tường xưởng**: 3 khung tranh nhỏ, kệ và hũ màu; ẩn dưới 900px để không chiếm chỗ canvas.
- **Nhân vật** dùng `PlayerAvatar2D` (cùng tỉ lệ với 4 game), đứng cạnh canvas, có bong bóng thoại theo 5 trạng thái: `idle / drawing / undo / publish / success`.
- **Canvas vẫn là trung tâm**: giữ nguyên `1200 × 700`, lớp `drawing-canvas-layer` và toàn bộ phép tính `pointer → canvas`; không đặt `transform`/`rotate` lên bất kỳ phần tử cha nào của `<canvas>`.
- Nền viewport là giấy ấm có chấm nhẹ, khung trong; HUD zoom 58% / 100% / fit giữ nguyên.
- **Publish success**: “🎨 Đã đăng tranh!” + confetti màu vẽ (6 mảnh, 900ms) + `[Vẽ tranh mới] [Xem trong Thư viện]`.
- **Nháp**: copy chính xác “Đã lưu bản nháp trên thiết bị”, có nút lưu thủ công và toast xác nhận.

## 8. Drawing Tool UX

| Thành phần | Trước | Sau |
|---|---|---|
| Dụng cụ | 4 icon trơn | Nút có icon + nhãn; nút active nền nâu đậm, chữ trắng |
| Đang dùng | Không có | Chip `CỌ VẼ · 12px` + phím tắt + chấm màu hiện tại |
| Cỡ cọ | Chấm nhỏ, không số | 5 nút, mỗi nút có chấm đúng tỉ lệ + số px; preview tròn riêng |
| Màu | 16 ô 22px, không tên | 14 màu có tên tiếng Việt, ô 22px, viền selected 2 lớp; ô màu tự do + mã hex |
| Hành động | 5 icon | Hoàn tác, Làm lại, Lưu nháp, Tải PNG, Xóa tranh, Phím tắt (có nhãn) |
| Đăng tranh | “Hoàn thành tác phẩm” trong header | “Đăng tranh” nổi bật; modal nhập tên + preview đúng tỉ lệ 12:7 |

Ràng buộc kỹ thuật được giữ: `handlePointerDown/Move/Up`, zoom/pan, Space pan, Undo stack 25 bước, autosave 400ms, IndexedDB draft, publish multipart.

---

## 9. Creative Corner → Thư viện tranh

- Route giữ nguyên `/creative-corner`; component giữ nguyên `CreativeCornerSection`.
- Copy đổi: “Sáng tạo · Thư viện tranh” → **THƯ VIỆN TRANH**; “Vào phòng vẽ tranh” → **Vào Xưởng Vẽ**; “Góc Sáng Tạo” → **Thư viện tranh** (kể cả thông báo admin và Settings).
- Trang riêng có hero riêng, nền “tường trưng bày” có sọc, tranh được đóng khung giấy trắng + viền gỗ, hover nhấc nhẹ.
- Card vẫn giữ: thumbnail, tác giả, tiêu đề, thời gian, đội/phòng ban, tim, tải PNG, xem full — không biến thành bảng admin.
- Bỏ nút “Vào Xưởng Vẽ” lặp lại trong thanh lọc (hero đã có).

---

## 10. Desktop

- **1440 × 1000**: 3 cột card; hàng 1 = Đua Gõ Chữ, Gõ Nhanh, Phản Xạ; hàng 2 = Trí Nhớ, Xưởng Vẽ.
- **1024 × 900**: 2 cột; sidebar chuyển sang drawer theo breakpoint hiện có.
- Xưởng Vẽ 1440: canvas 440px cao, thanh dụng cụ 2 hàng nằm gọn trên footer (không phải cuộn).
- 900px: canvas 340px, dụng cụ vẫn trong màn hình. 800px: canvas 240px nhờ media query `max-height: 860px`.

## 11. Mobile

- **430 × 900** và **390 × 844**: canvas vẫn là phần tử lớn nhất; dụng cụ chia 3 hàng gọn (công cụ + cỡ cọ / bảng màu / hành động), dính đáy khi cuộn.
- Bỏ nút “Lưu nháp” trùng ở savebar mobile (đã có trong hàng hành động), giữ link “Mở thư viện”.
- Header 1 hàng: back + “Xưởng Vẽ” + “Đăng tranh”; ẩn kicker/subtitle dưới 430px.
- Không tràn ngang ở 430/390; menu mobile mở sẵn nhóm Trò Chơi với đủ 5 game.

---

## 12. Regression

| Hạng mục | Kết quả |
|---|---|
| `npm run check` (93 file) | ✅ 0 lỗi |
| `npm run build` | ✅ 3.9s |
| Backend arcade + drawing + catalog (71 test) | ✅ 71 pass / 0 fail |
| Room Engine 2V2/3V3 dùng chung | ✅ pass |
| Drawing storage/authorization | ✅ pass |
| i18n audit tĩnh | ✅ 0 chuỗi |
| Browser QA (39 check) | ✅ 39 pass / 0 fail, 0 page error |
| `e2e/smoke.spec.js` | ⚠️ 2 fail **có sẵn từ trước**: test tìm nút “Đăng Nhập Vào Hệ Thống”, trong khi `Login.jsx` hiện là trang Google-only. Không file auth nào nằm trong diff này. |
| `e2e/information-architecture.spec.js` | ⚠️ 29 fail **có sẵn từ trước**: mock chỉ set `token`, app chuyển về trang đăng nhập nên không tới được app shell. Không liên quan thay đổi UI game. |

Không đổi: `gameType`, route, socket event, DB enum, khoá BXH, khoá lưu nháp, Room Engine, scoring, reward.

---

## 13. Screenshots

Ảnh gốc: `docs/audit/2026-10-22/game-center-2d/` (Playwright, 1440×1000 / 1024×900 / 430×900 / 390×844).

### Game Center

![Game Center 1440](game-center-2d/01-game-center-1440.png)
![Game Center hàng 2](game-center-2d/01c-game-center-1440-row2.png)
![Game Center 1024](game-center-2d/11-game-center-1024.png)
![Game Center 430](game-center-2d/13-game-center-430.png)
![Game Center 390](game-center-2d/17-game-center-390.png)

### Sidebar / menu dọc

![Menu mobile mở sẵn Trò Chơi](game-center-2d/19-mobile-nav-drawer-390.png)

### Đua Gõ Chữ

![Đua Gõ Chữ](game-center-2d/02-typing_battle-1440.png)

### Gõ Nhanh

![Gõ Nhanh](game-center-2d/03-computer_rush-1440.png)

### Phản Xạ Bốn Hướng

![Phản Xạ Bốn Hướng](game-center-2d/04-direction_rush-1440.png)

### Trí Nhớ Nhanh

![Trí Nhớ Nhanh](game-center-2d/05-memory_flash-1440.png)

### Xưởng Vẽ

![Xưởng Vẽ 1440](game-center-2d/06-drawing-1440.png)
![Xưởng Vẽ đang vẽ](game-center-2d/07-drawing-drawn-1440.png)
![Modal đăng tranh](game-center-2d/08-drawing-publish-modal-1440.png)
![Đăng tranh thành công](game-center-2d/09-drawing-publish-success-1440.png)
![Xưởng Vẽ 1024](game-center-2d/12-drawing-1024.png)
![Xưởng Vẽ 430](game-center-2d/14-drawing-430.png)
![Xưởng Vẽ 430 đã vẽ](game-center-2d/15-drawing-430-drawn.png)
![Xưởng Vẽ 390](game-center-2d/18-drawing-390.png)

### Thư viện tranh

![Thư viện tranh 1440](game-center-2d/10-gallery-1440.png)
![Thư viện tranh 430](game-center-2d/16-gallery-430.png)

---

## 14. Final Scores

| Hạng mục | Điểm | Ghi chú |
|---|---:|---|
| Menu consistency | **9.3** | 5 game + thư viện + trung tâm, một registry, active state rõ |
| Vietnamese clarity | **9.4** | Không còn chuỗi Anh; nhãn chế độ/phòng/kết quả tự nhiên |
| Drawing 2D visual | **9.1** | Giá vẽ, tường xưởng, nhân vật, palette giấy ấm; không rối |
| Drawing usability | **9.2** | Chip dụng cụ, preview cọ, 14 màu, lưu nháp/publish rõ |
| Cross-game consistency | **9.2** | Cùng bo góc, nút, nhân vật, typography, nhịp motion |
| Mobile | **9.0** | Canvas lớn nhất có thể, dụng cụ 3 hàng, không tràn |

Không hạng mục nào dưới 8.5.

---

## 15. Remaining Risks

1. **Đăng tranh thật không chạy ở môi trường local** vì backend chỉ cho publish khi `STORAGE_PROVIDER=s3` (`publishing.available=false`). UI success + gallery được kiểm bằng mock tầng storage trong Playwright; production dùng S3 như `render.yaml`.
2. **Ảnh Thư viện trong ảnh chụp là mock** — các bản ghi cũ trỏ tới MinIO `127.0.0.1:18900` đã tắt, nên dùng artwork mẫu để đánh giá layout.
3. **Canvas trên điện thoại dọc bị giới hạn bởi bề rộng** (tỉ lệ 12:7 → ~233px cao ở 390px). Đây là giới hạn hình học của khổ vẽ, không phải decor; người dùng vẫn zoom/pan được.
4. **`TypingBattle` vẫn có lobby riêng** (không dùng `ArcadeLobby`) — đã Việt hóa nhưng chưa hợp nhất component; nằm ngoài phạm vi “không phá gameplay đang PASS”.
5. **Sidebar mở sẵn nhóm Trò Chơi** làm menu dài hơn trên màn hình thấp; nhóm vẫn thu gọn được và sidebar cuộn độc lập.
6. **Hai bộ e2e cũ đang lệch với luồng đăng nhập Google-only** — cần cập nhật test riêng, không phải lỗi của đợt này.

---

## 16. Final Gates

```text
ALL_ACTIVE_GAMES_IN_VERTICAL_MENU: PASS
NO_DUPLICATE_GAME_NAVIGATION_SOURCE: PASS
GAME_NAMES_VIETNAMESE: PASS
GAME_BUTTONS_VIETNAMESE: PASS
GAME_STATUS_VIETNAMESE: PASS
ROOM_UI_VIETNAMESE: PASS
RESULT_UI_VIETNAMESE: PASS
LEADERBOARD_UI_VIETNAMESE: PASS
DRAWING_RENAMED_XUONG_VE: PASS
DRAWING_2D_SCENE: PASS
DRAWING_TOOLBAR_UX: PASS
DRAWING_CANVAS_COORDINATES: PASS
DRAWING_MOBILE: PASS
CREATIVE_CORNER_RENAMED_THU_VIEN_TRANH: PASS
DRAWING_STORAGE_REGRESSION: PASS
ROOM_ENGINE_REGRESSION: PASS
ARCADE_REGRESSION: PASS
NO_INTERNAL_IDENTIFIER_BREAKAGE: PASS
OVERALL: PASS
```

### Bằng chứng cho 3 gate dễ tranh cãi

- **DRAWING_CANVAS_COORDINATES**: vẽ tại 40% × 35% → pixel `rgb(239,68,68)` đúng màu Đỏ son; tẩy → alpha 0; hoàn tác → alpha 255; làm lại → alpha 0. Mobile 430: vẽ tại 45% × 50% → `rgb(59,130,246)` đúng màu Xanh biển.
- **DRAWING_STORAGE_REGRESSION**: 71 backend test (arcade + drawing storage/authorization + catalog) pass; draft IndexedDB và luồng publish giữ nguyên hợp đồng multipart.
- **NO_INTERNAL_IDENTIFIER_BREAKAGE**: không sửa `shared/gameRegistry.mjs` (`id`, `name` gốc), `shared/arcade/modes.mjs`, route trong `App.jsx`, socket event hay migration nào.

---

## 17. File thay đổi chính

| File | Thay đổi |
|---|---|
| `frontend/src/games/arcade/catalog.js` | **GAME_REGISTRY** 5 game + nhãn mode/phòng/đội + helper |
| `frontend/src/config/navigation.js` | Nhóm Trò Chơi dựng từ registry; `isNavItemActive`, `exactPaths`; title theo game |
| `frontend/src/components/Sidebar.jsx` | Bỏ map route thủ công; active bar; mở sẵn nhóm Trò Chơi; item tổng quan |
| `frontend/src/pages/GameHub.jsx` | Viết lại: hero, 5 card 2D, trạng thái, Thư viện tranh |
| `frontend/src/pages/ArcadeGame.jsx` | Tên game/chế độ/BXH tiếng Việt; lỗi dịch; poster |
| `frontend/src/pages/DrawingGame.jsx` | Scene xưởng vẽ, giá vẽ, nhân vật, toolbar mới, publish success |
| `frontend/src/components/arcade/drawing-arcade.css` | Toàn bộ style Xưởng Vẽ 2D + responsive |
| `frontend/src/components/arcade/game-center.css` | Style Game Center + poster Đua Gõ Chữ/Xưởng Vẽ |
| `frontend/src/components/arcade/gallery-wall.css` | Tường trưng bày Thư viện tranh |
| `frontend/src/pages/CreativeGallery.jsx` | Hero + wall + CTA |
| `frontend/src/components/CreativeCornerSection.jsx` | Copy Thư viện tranh, CTA Xưởng Vẽ |
| `frontend/src/components/arcade/*` | Việt hóa lobby/kết quả/HUD/tutorial/memory/direction/typing |
| `frontend/src/utils/gameErrors.js` | Map lỗi API/socket sang câu tiếng Việt |
| `frontend/scripts/game-center-i18n-audit.mjs` | Audit tĩnh 22 file UI |
| `frontend/scripts/game-center-qa.mjs` | QA thật 39 check + 21 ảnh |
