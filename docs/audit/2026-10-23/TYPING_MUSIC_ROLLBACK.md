# TYPING MUSIC ROLLBACK — Xóa Đua Gõ Theo Nhạc, trả lại Đua Gõ Chữ

**Ngày:** 2026-10-23
**Phạm vi:** `workrank-realtime`
**Loại thay đổi:** gỡ feature (không revert project, không `git reset`)

---

## Music Feature Removed

Toàn bộ feature "Đua Gõ Theo Nhạc" đã bị xóa khỏi runtime:

| Hạng mục | Trạng thái |
| --- | --- |
| Gameplay gõ theo nhạc (state machine, boundary gate) | Xóa |
| Audio adapter + 3 file MP3 | Xóa |
| Song catalog + timed lyrics + build script | Xóa |
| UI: chọn bài, stage 2D, lyric karaoke, HUD liền mạch, result nhạc | Xóa |
| Route `/games/typing/music` + `/room/:roomId` | Xóa |
| 8 API `/api/games/typing/music/*` | Xóa |
| Music scoring/validation phía server | Xóa |
| BXH nhạc (API + tab UI) | Xóa |
| Cột `music_song_id`, `music_evidence`, `music_*` trong DB | Drop bằng migration mới |
| Test của music | Xóa |

Không còn đường vào nào trong UI, không còn network request nào tới music.

---

## Pre-Music Baseline Identified

Repo đã commit toàn bộ (cả Go Nhanh và music) trong `7f15dbb`. Baseline trước music là **`HEAD~1` (6f79df0)** *cho đúng 15 file mà music đã sửa*.

Trước khi revert, từng file được diff riêng để chắc chắn **100% thay đổi của nó trong HEAD là music**:

```bash
git diff HEAD~1 HEAD -- <file>
```

Kết quả: cả 15 file chỉ chứa hunk music (không có thay đổi nào của Go Nhanh, Room Engine, Drawing, vocabulary hay Việt hóa). Vì vậy `git checkout HEAD~1 -- <file>` an toàn tuyệt đối — không có nguy cơ kéo lùi task khác.

Các file **không** bị chạm: `shared/arcade/*`, `ComputerStation.jsx`, `arcade-polish.css`, `go-nhanh-*`, `drawing*`, `competition*`, `vocabulary*`.

---

## Files Deleted

**37 file** (6.280 dòng bị xóa):

```
backend/src/controllers/musicRace.controller.js
backend/src/models/MusicSong.js
backend/src/seeders/musicSongs.seeder.js
backend/src/services/musicRace.service.js
backend/src/services/musicScoring.js
backend/test/music_race_engine.test.js

frontend/src/games/music/{engine,audioAdapter,catalog,useMusicRace}.js
frontend/src/components/music/{MusicStage,LyricKaraoke,MusicHud,MusicSongPicker,MusicResult,MusicBoard}.jsx
frontend/src/components/music/music-race.css
frontend/src/pages/MusicRace.jsx
frontend/tests/music-engine.test.mjs
frontend/public/audio/music/{duong-ve-nha,pho-chieu,bao-noi}.mp3
frontend/scripts/qa/{music-race-smoke,music-race-full-run,music-race-mobile,_board}.mjs

scripts/music/build_song_assets.py
shared/music/songCatalog.json

docs/audit/2026-10-23/TYPING_MUSIC_RACE_REDESIGN.md
docs/audit/2026-10-23/music-race/*.png   (8 ảnh)
```

Không còn binary/audio rác trong repo. `frontend/scripts/qa/` và `scripts/music/` biến mất cùng feature.

---

## Shared Files Selectively Reverted

**15 file**, chỉ 30 dòng được trả lại (đúng phần music đã thêm):

| File | Thay đổi được revert |
| --- | --- |
| `backend/src/models/TypingRoom.js` | bỏ `musicSongId` |
| `backend/src/models/TypingMatchResult.js` | bỏ `musicSongId` |
| `backend/src/models/TypingPracticeAttempt.js` | bỏ `musicSongId`, `musicEvidence` |
| `backend/src/models/TypingUserStat.js` | bỏ 4 cột `music*` |
| `backend/src/models/index.js` | bỏ đăng ký `MusicSong` |
| `backend/src/routes/typingGame.routes.js` | bỏ 8 route `/music/*` + import |
| `backend/src/services/typingGame.service.js` | bỏ require `musicScoring`, `MUSIC_EVIDENCE_KEY`, 2 helper, nhánh `songId` trong `createRoom`, `musicSongId` trong `startMatch`, deadline riêng, lưu evidence ở `updateProgress`, chấm điểm nhạc ở `submitFinish`, music stats + field trong `finalizeMatch` |
| `backend/src/services/typingVerifiedRecords.js` | bỏ bộ lọc `songId/music` (không còn kết quả nhạc để lọc) |
| `frontend/src/App.jsx` | bỏ import `MusicRace` + 2 route |
| `frontend/src/pages/TypingHub.jsx` | về lại 2 lối vào: Gõ Nhanh (01) · Đua Gõ Chữ (02) |
| `frontend/src/games/arcade/catalog.js` | về `Đua Gõ Chữ`, `Gõ chính xác · Vượt đối thủ`, route `/games/typing/passage`, theme xanh, modes `SOLO/1V1/2V2/3V3` |
| `frontend/src/components/arcade/TypingArcadeView.jsx` | về nhãn `01 · ĐUA GÕ CHỮ` / `ĐUA GÕ CHỮ · ĐÃ VỀ ĐÍCH` |
| `frontend/src/services/api.js` | bỏ `musicRaceApi` |
| `frontend/src/utils/typingSession.js` | về import không đuôi `.js` |
| `frontend/package.json` | bỏ script `test:music` |

Không file nào bị revert quá phạm vi: `git diff` chỉ ra 6 file "ngoài tên music" và cả 6 đều là điểm gắn của music (route, catalog, api, package.json, models/index, script QA).

---

## Database/Migration Handling

Migration `20261023120000-music-typing-race` **đã apply** trên DB dev → **không xóa file** (sẽ để lại row mồ côi trong `SequelizeMeta` và mất khả năng truy vết schema).

Thay vào đó thêm migration forward:

```
backend/src/migrations/20261023130000-remove-music-typing-race.js
```

- idempotent (kiểm tra `describeTable` trước khi drop),
- drop `music_songs`,
- drop `typing_rooms.music_song_id`, `typing_match_results.music_song_id`,
  `typing_practice_attempts.music_song_id`, `music_evidence`,
- drop 4 cột `typing_user_stats.music_*`,
- `down()` là no-op (feature đã hủy, không có gì để dựng lại).

Đã chạy `npm run db:migrate` trên DB dev và verify trực tiếp:

```
music tables:            (none)
typing_rooms music cols: (none)
typing_match_results:    (none)
typing_practice_attempts:(none)
typing_user_stats:       (none)
typing_rooms rows:       126   (giữ nguyên)
typing_match_results:    101   (giữ nguyên)
```

Dữ liệu typing cũ **không mất**. Trên DB mới, thứ tự migrate là create → drop, kết quả cuối vẫn là schema typing sạch.

---

## Original Typing Restored

Browser thật, tài khoản QA, dev stack:

| Kiểm tra | Kết quả |
| --- | --- |
| `/games/typing` | 2 card: **Gõ Nhanh** · **Đua Gõ Chữ** — tiêu đề "Đua Gõ Chữ" |
| Copy music trong hub | không có (`/Theo Nhạc|Giữ nhạc|liền mạch|Chọn bài hát/` → false) |
| `/games/typing/passage` | heading `ĐUA GÕ CHỮ`, kicker `01 · ĐUA GÕ CHỮ` |
| Đoạn văn | render 2.790 ký tự, con trỏ ở ký tự 1 |
| `<audio>` trong DOM | **không có** |
| Music UI (stage/song card/hud) | **không có** |
| Gõ 24 ký tự tiếng Việt | 24 correct / 0 incorrect, HUD WPM cập nhật, "Ký tự 25 / 2790" |
| Backspace ×2 | còn 22 correct, phần còn lại trở về `remaining` |
| Network request chứa `music|.mp3|song|lyric` | **0** |
| Console error | **0** |

Ảnh: `docs/audit/2026-10-23/rollback/` (hub + màn hình chơi).

---

## Vietnamese Input Regression

Gõ trực tiếp trên game cũ:

```
"mặt trời mọc chim hót ch"  → 24/24 correct, 0 incorrect
```

- NFC/NFD, dấu tiếng Việt, `đ` — đều đúng như trước (không đụng vào `typingText`, `typingSession` logic, chỉ trả lại đuôi import).
- Không có false error, không mất ký tự, không double completion.
- Backspace sửa đúng vị trí.
- 31 test typing cũ + 4 test room lifecycle: **35/35 pass** (bao gồm `typing Unicode semantics`).

---

## Room Regression

- `POST /rooms` (không có `songId`) → 201, `WAITING`, `durationLimitSeconds = 60` đúng như request.
- Response **không có** field `musicSongId`; `challengeText` là đoạn văn, không phải lời bài hát.
- `POST /rooms/:id/start` → `PLAYING`.
- `POST /rooms/:id/finish` → `FINISHED`, result row **không có** `flowPct/pauseCount/linesCompleted/musicScore`.
- `typing_room_lifecycle.test.js`: create/join/ready/start/leave/finalize/cleanup — pass.
- Không tạo room engine mới; `typing_battle` vẫn dùng đúng engine cũ.

---

## Persistence Regression

- Result row được ghi như trước (`wpm`, `accuracy`, `performanceScore`, `individualRank`).
- `/api/games/typing/history` → 6 attempts.
- `/api/games/typing/my-stats` → **không còn key `music*`**, `bestWpm` vẫn trả.
- `/api/games/typing/leaderboard` → 200, có hạng và WPM.
- `/api/games/typing/challenges` → 68 đề.

---

## Build/Test

```
frontend: npm run check   → PASS (93 file, 0 lỗi)
frontend: npm run build   → PASS (4.37s)
backend:  typing_engine_authority + typing_practice_authority
          + typing_unicode_metrics + typing_room_lifecycle → 35/35 PASS
browser:  solo flow + Vietnamese input + backspace + network audit → PASS
```

Không chạy lại full backend suite (các fail competition/sqlite là pre-existing, không liên quan).

---

## Remaining Music References

Chỉ còn **2 file migration** — là lịch sử schema, không phải runtime:

```
backend/src/migrations/20261023120000-music-typing-race.js   (đã apply, giữ để không mồ côi SequelizeMeta)
backend/src/migrations/20261023130000-remove-music-typing-race.js  (cleanup)
```

Ngoài ra **0** match cho:

```
music · musicSongId · musicRace · MusicRace · musicScoring
song · lyrics · lyric · flowPct · pauseCount
Đua Gõ Theo Nhạc · Giữ nhạc · Độ liền mạch · Nhạc phải dừng
WAITING_AT_BOUNDARY · Chọn bài hát · Câu đang hát
```

---

## Final Status

| Gate | Kết quả |
| --- | --- |
| MUSIC_GAME_REMOVED | **PASS** |
| MUSIC_AUDIO_ASSETS_REMOVED | **PASS** (3 MP3 + thư mục) |
| MUSIC_ENGINE_REMOVED | **PASS** |
| MUSIC_ROUTES_REMOVED | **PASS** |
| MUSIC_API_REMOVED | **PASS** (8 route) |
| MUSIC_BXH_REMOVED | **PASS** (API + tab UI) |
| MUSIC_SCORING_REMOVED | **PASS** |
| MUSIC_DEAD_CODE_ZERO | **PASS** (chỉ còn trong migration history) |
| OLD_TYPING_GAME_RESTORED | **PASS** |
| OLD_TYPING_ROUTE_RESTORED | **PASS** (`/games/typing/passage` là route chính, hub 2 lối vào) |
| VIETNAMESE_UI_PRESERVED | **PASS** |
| VIETNAMESE_INPUT_PRESERVED | **PASS** |
| FAST_TYPING_PRESERVED | **PASS** (24 ký tự, 0 lỗi, WPM live) |
| SHARED_ROOM_ENGINE_PRESERVED | **PASS** |
| MULTIPLAYER_PRESERVED | **PASS** (create/start/finish + lifecycle tests) |
| TYPING_RESULT_PERSISTENCE | **PASS** |
| TYPING_BXH_PRESERVED | **PASS** |
| OTHER_GAMES_UNCHANGED | **PASS** (không chạm arcade/drawing/shared/Go Nhanh) |
| FRONTEND_BUILD | **PASS** |
| OVERALL_ROLLBACK | **PASS** |

**Definition of Done:** bấm "Đua Gõ Chữ" → đoạn văn hiện ra → gõ → đúng/sai → WPM → độ chính xác → đua → kết quả → BXH. Không nhạc, không bài hát, không lyrics, không audio, không pause/resume, không flow %.
