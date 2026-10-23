# ĐUA GÕ THEO NHẠC — Redesign "Đua Gõ Chữ" thành game gõ theo nhạc

**Ngày:** 2026-10-23
**Phạm vi:** `workrank-realtime` — frontend + backend
**Game type nội bộ:** `typing_battle` (giữ nguyên)
**Tên hiển thị:** ĐUA GÕ THEO NHẠC · *Gõ đúng lời · Giữ nhạc tiếp tục*

---

## 0. TL;DR

Đua Gõ Chữ trở thành **Đua Gõ Theo Nhạc**: nhạc chạy liên tục, lời hiện theo từng câu, người chơi gõ đúng câu đang hát. Gõ sai **không** cắt nhạc giữa câu — nhạc chỉ dừng ở **cuối câu hiện tại** nếu câu đó chưa xong, và chạy tiếp ngay khi người chơi gõ xong.

Ba quyết định định hình toàn bộ bản redesign:

1. **Boundary gate, không phải keystroke gate.** Mọi quyết định pause nằm ở `audioTime >= line.endMs`. Không có nhánh nào pause vì một ký tự sai.
2. **Audio do WorkRank sở hữu.** 3 bài được soạn và render ngay trong repo (`scripts/music/build_song_assets.py`), nên pause/resume chính xác tới ms, không quảng cáo, không phụ thuộc bên thứ ba. YouTube chỉ là slot đã đóng có chủ đích.
3. **Server tự tính lại điểm.** Client gửi bằng chứng (lời đã gõ, số lần dừng), server suy ra số câu hoàn thành từ chính lời đó và chặn số lần dừng bằng đồng hồ của server.

Đã kiểm bằng browser thật + audio thật: nhạc dừng đúng **10.000s** ở cuối câu 1, resume lên **10.87s**, và một lượt chơi hết bài đạt **100% liền mạch, 0 lần dừng**.

---

## 1. Existing Typing Architecture

Kiến trúc trước khi sửa, để biết cái gì giữ và cái gì thay:

### Frontend

| Thành phần | Vai trò | Xử lý trong redesign |
| --- | --- | --- |
| `pages/TypingBattle.jsx` (1.173 dòng) | Điều phối solo/room, socket, sync, draft | **Giữ nguyên**, đổi nhãn thành "Văn bản cổ điển" |
| `components/arcade/TypingArcadeView.jsx` | Lobby, HUD, kết quả của chế độ đoạn văn | Giữ, chỉ đổi copy |
| `components/TypingPassage.jsx` | Render đoạn văn theo ký tự, tự cuộn | Không dùng cho mode nhạc |
| `utils/typingSession.js` | So khớp local-first: NFC, grapheme, error map tăng dần | **Tái sử dụng nguyên** cho từng câu hát |
| `utils/typingText.js` | `normalizeText`, `graphemes`, `foldCase`, `sameCharacter` | Tái sử dụng |
| `utils/arcadeSound.js` | Feedback âm thanh ngắn (WebAudio, không asset) | Tái sử dụng cho line complete / resume |
| `services/api.js` → `typingGameApi` | REST phòng, tiến độ, kết quả | Giữ, thêm `musicRaceApi` |

### Backend

| Thành phần | Vai trò | Xử lý |
| --- | --- | --- |
| `services/typingGame.service.js` | Room engine: tạo phòng, join, ready, start, progress, finish, finalize, BXH | **Giữ nguyên**, thêm nhánh `musicSongId` |
| `services/typingEngine.js` | WPM, accuracy, plausibility, xếp hạng, điểm thưởng | Giữ; điểm nhạc dùng module mới |
| `services/typingMetrics.js` | Đo grapheme, `METRIC_VERSION = 3` | Tái sử dụng |
| `services/typingPractice.service.js` | Lượt luyện tập do server cấp | Không dùng cho nhạc (nhạc có luồng attempt riêng) |
| `services/typingVerifiedRecords.js` | Nguồn của BXH WPM | Thêm bộ lọc: bỏ kết quả nhạc |
| `typing_rooms`, `typing_match_results`, `typing_user_stats`, `typing_practice_attempts` | Persistence | Thêm cột, không đổi bảng |
| `ScoreLedger` + season projector | XP, BXH công ty | Tái sử dụng nguyên |

**Kết luận audit:** không có phần nào của typing engine bị xóa. Chế độ đoạn văn vẫn chạy y như trước ở `/games/typing/passage`, và toàn bộ 31 test typing hiện có vẫn pass.

---

## 2. Music Game Architecture

```
shared/music/songCatalog.json          ← dữ liệu bài hát (nguồn duy nhất)
        │
        ├── frontend/src/games/music/catalog.js      chuẩn hóa + validate + tìm kiếm
        │        └── components/music/MusicSongPicker.jsx
        │
        ├── frontend/src/games/music/audioAdapter.js MusicPlaybackAdapter (HostedAudio)
        │
        ├── frontend/src/games/music/engine.js       state machine + boundary gate + điểm
        │        └── games/music/useMusicRace.js     React binding (rAF, IME, visibility)
        │                 └── pages/MusicRace.jsx    solo + phòng
        │
        └── backend/src/seeders/musicSongs.seeder.js → bảng music_songs
                 └── services/musicScoring.js        validate + chấm lại từ server
                          └── services/musicRace.service.js  attempt, finish, BXH
```

### Module mới

| File | Trách nhiệm |
| --- | --- |
| `scripts/music/build_song_assets.py` | Soạn nhạc + sinh MP3 + sinh `songCatalog.json` từ **cùng một nguồn thời gian** |
| `shared/music/songCatalog.json` | Catalog đã publish (audio, lời có timestamp, license) |
| `frontend/src/games/music/engine.js` | Máy trạng thái thuần JS, không DOM, không React |
| `frontend/src/games/music/audioAdapter.js` | `HostedAudioAdapter` + slot YouTube đóng |
| `frontend/src/games/music/useMusicRace.js` | rAF loop, native input, IME, visibility, cleanup |
| `frontend/src/games/music/catalog.js` | Chuẩn hóa, `validateSong`, `searchSongs`, độ khó |
| `frontend/src/components/music/*` | Stage 2D, lyric karaoke, HUD, picker, result, CSS |
| `frontend/src/pages/MusicRace.jsx` | Trang solo + phòng |
| `backend/src/services/musicScoring.js` | Chấm điểm & chống gian lận phía server |
| `backend/src/services/musicRace.service.js` | Catalog, attempt, finish, stats, BXH nhạc |
| `backend/src/models/MusicSong.js` + migration + seeder | Persistence catalog |

### Luồng một lượt chơi (solo)

```
[BẮT ĐẦU]  (user gesture)
   ├─ audio.play()            ← đồng bộ, không await
   └─ POST /music/attempts    ← cấp attemptId, server bắt đầu đồng hồ
        ↓
rAF: engine.tick(adapter.getCurrentTime())
        ↓
audioTime >= line.endMs ?
   ├─ line xong  → advance, không pause
   └─ line dở   → adapter.pause(), WAITING_AT_BOUNDARY
        ↓
người chơi gõ xong → adapter.play() đúng 1 lần → advance
        ↓
audio kết thúc → engine FINISHED → POST /music/finish (evidence)
        ↓
server chấm lại → result → BXH nhạc
```

---

## 3. Audio Source Strategy

### Quyết định: audio WorkRank sở hữu, host tĩnh trong repo

| Tiêu chí | Hosted licensed (đã chọn) | YouTube embed |
| --- | --- | --- |
| Pause chính xác tới ms | Có | Không ổn định |
| Quảng cáo | Không | Có thể có |
| Buffering ngoài tầm kiểm soát | Không | Có |
| Ranked / multiplayer | Được | Không nên |
| Bản quyền | WorkRank sở hữu 100% | Phụ thuộc điều khoản |

Ba bài được **soạn và render trong repo**, không lấy từ bên ngoài:

| ID | Tên | BPM | Thời lượng | Câu | Ký tự/giây | Độ khó |
| --- | --- | --- | --- | --- | --- | --- |
| `duong-ve-nha` | Đường Về Nhà | 96 | 61.3s | 10 | 3.28 | DỄ |
| `pho-chieu` | Phố Chiều | 100 | 68.5s | 12 | 4.38 | TRUNG BÌNH |
| `bao-noi` | Bão Nổi | 120 | 65.3s | 14 | 5.12 | KHÓ |

Nhạc cụ trong mỗi track: pad hợp âm, bass, arpeggio 1/8, lead melody theo từng câu, kick/snare/hat, crash chuyển đoạn. Tất cả render bằng numpy rồi encode MP3 160kbps qua ffmpeg.

**Vì sao điều này quan trọng:** line boundary được tính bằng **đúng bar của lưới nhạc** mà synth dùng để render. Không có chuyện timestamp lệch khỏi tiếng nhạc, vì cả hai sinh ra từ một object.

```python
line_start = (introBars + i * barsPerLine) * bar_seconds
line_end   = line_start + barsPerLine * bar_seconds
# và synth render đúng lưới bar đó
```

### Adapter

`MusicPlaybackAdapter` (interface thực tế trong `audioAdapter.js`):

```
load() · play() · pause() · seek(ms) · getCurrentTime() · getDuration()
isBuffering() · hasEnded() · destroy()
```

`HostedAudioAdapter` dùng `HTMLAudioElement` (preload auto, volume 0.9, gắn vào DOM ẩn để Safari coi là media element thật). `createYouTubeEmbedAdapter()` **cố tình throw** — xem mục 4.

---

## 4. Rights / Source Handling

### Nguyên tắc đã áp dụng

- **Không** tải nhạc từ YouTube, không rip MP3, không proxy stream, không bypass quảng cáo, không scrape lời.
- Mọi track trong catalog đều có `audioSource` và `lyricsSource` với `rightsStatus: "OWNED"` và license ghi rõ "WorkRank Original — composed and produced in-house".
- Lời bài hát là **sáng tác gốc** cho WorkRank, không lấy từ bất kỳ bài nào đang tồn tại.

### Metadata bắt buộc mỗi track

```json
{
  "audioSource": {
    "type": "HOSTED_LICENSED",
    "assetKey": "music/duong-ve-nha",
    "url": "/audio/music/duong-ve-nha.mp3",
    "rightsStatus": "OWNED",
    "licence": "WorkRank Original — composed and produced in-house for this game.",
    "attribution": "WorkRank Originals"
  },
  "lyricsSource": {
    "type": "ORIGINAL",
    "rightsStatus": "OWNED",
    "author": "WorkRank",
    "licence": "Original lyrics written for WorkRank. No third-party lyric text."
  },
  "timedLyricsVersion": 1
}
```

### Publish gate (server)

`validateSongForPublish()` chặn publish khi:

- thiếu audio hoặc thiếu `licence`,
- thiếu `lyricsSource.rightsStatus`,
- `audioSource.type` không nằm trong `HOSTED_LICENSED | ROYALTY_FREE`,
- không có câu hát / có câu rỗng,
- thiếu `startMs`/`endMs`, `end <= start`, hoặc câu sau chồng lên câu trước,
- câu cuối vượt quá `durationMs`.

### YouTube

**Không implement.** Lý do ghi ngay trong code để lần sau không phải phát hiện lại:

> Official embedded player có thể phục vụ quảng cáo, buffer theo mạng, và timing không đủ ổn định để làm cổng dừng nhạc. Một adapter nửa vời sẽ âm thầm phá luật "pause đúng cuối câu".

Nếu sau này cần YouTube, nó chỉ được phép ở **casual**, không vào ranked, và phải có QA riêng (autoplay, ads, buffering, pause precision).

---

## 5. Timed Lyrics Contract

### Schema

```ts
Song {
  id: string
  title, artist, language, bpm
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'
  durationMs: number
  timedLyricsVersion: number
  audioSource: { type, url, assetKey, rightsStatus, licence, attribution }
  lyricsSource: { type, rightsStatus, author, licence }
  lines: Array<{
    id: string
    index: number
    startMs: number
    endMs: number
    text: string        // NFC, có dấu, không punctuation
  }>
  metrics: { charCount, charsPerSecond, accentRatio, avgLineChars, lineCount }
}
```

### Luật

1. `lines` sắp theo `startMs`, **liền mạch**: `lines[i].endMs === lines[i+1].startMs`. Có assert ngay trong builder.
2. `text` được normalize NFC khi nạp; so sánh lúc chơi cũng NFC.
3. Không có word-level timing trong v1 — line-level là đủ cho core, và word timing không được phép làm chậm core.
4. `timedLyricsVersion` đi cùng result để sau này đổi timing vẫn phân biệt được kỷ lục cũ/mới.

### Độ khó

Không dựa vào BPM. Công thức đo trong builder:

```
cps   = ký tự / giây của từng câu (trung bình)
accent = tỉ lệ ký tự có dấu
avgLen = số ký tự trung bình mỗi câu
```

Ngưỡng hiện tại: `< 3.4` DỄ · `< 4.5` TRUNG BÌNH · `< 5.6` KHÓ · còn lại SIÊU NHANH. Builder in cảnh báo nếu nhãn tác giả lệch với số đo — nhãn sản phẩm vẫn là nguồn, số đo là kiểm tra.

---

## 6. Boundary Gate

Đây là core engine. Toàn bộ nằm trong `engine.js` → `tick(audioTimeMs)`.

```js
if (audioMs >= line.endMs) {
  const snap = sessions[lineIndex].getSnapshot();
  const lineComplete = snap.charCount === line.chars.length && snap.errorCount === 0;
  if (lineComplete) {
    completeLine(lineIndex, line.endMs);
    advanceLine();               // không pause
  } else {
    pauseAtBoundary(audioMs);    // pause đúng cuối câu
  }
}
```

### Vì sao không pause giữa câu

Không tồn tại nhánh code nào gọi `adapter.pause()` ngoài `pauseAtBoundary()` và `pauseForVisibility()`. `applyInput()` chỉ có thể:

- cập nhật trạng thái ký tự,
- đánh dấu line `COMPLETED` / `LINE_READY`,
- gọi `resumeFromBoundary()` nếu đang ở `WAITING_AT_BOUNDARY`.

Một ký tự sai **không thể** chạm vào audio.

### Pause tolerance

| Tham số | Giá trị | Lý do |
| --- | --- | --- |
| `BOUNDARY_SNAP_MS` | 320ms | rAF trễ 1–2 frame vẫn kéo audio về đúng mốc cuối câu |
| `RESUME_SETTLE_MS` | 180ms | giữ trạng thái `RESUMING` đủ lâu để UI báo "TIẾP TỤC!" |
| `TIME_PUBLISH_MS` | 90ms | nhịp publish cho meter, không phải 60fps |

Khi pause, nếu audio vượt boundary ≤ 320ms thì `seek(endMs)` để câu sau bắt đầu đúng nơi câu trước kết thúc. Nếu vượt nhiều hơn (tab bị ẩn), vẫn pause nhưng không seek ngược — tránh cắt lặp âm thanh.

**Đo thực tế trong browser:** câu 1 của "Đường Về Nhà" có `start=5000, end=10000`. Sau khi thả cho nhạc chạy với câu dở dang, `audio.currentTime` dừng ở **10.000** (đúng boundary), resume lên **10.87** sau khi gõ xong.

---

## 7. Pause / Resume State Machine

### Audio state

```
PREPARING ──start()──▶ PLAYING_LINE
PLAYING_LINE ──line complete sớm──▶ LINE_READY
LINE_READY ──boundary──▶ PLAYING_LINE (câu kế)
PLAYING_LINE ──boundary + line dở──▶ WAITING_AT_BOUNDARY
WAITING_AT_BOUNDARY ──line complete──▶ RESUMING ──180ms──▶ PLAYING_LINE
PLAYING_LINE / LINE_READY ──audio ended──▶ FINISHED
```

### Line state

```
NOT_STARTED → ACTIVE → COMPLETED
                  ↘ WAITING_CORRECTION → (gõ xong) → COMPLETED
COMPLETED → (backspace) → ACTIVE
```

`COMPLETED → ACTIVE` là chi tiết quan trọng: nếu người chơi xóa lùi sau khi đã gõ xong câu, boundary lại trở thành cổng thật, không được "ăn gian" trạng thái đã xong.

### Resume exactly once

Không dùng boolean rải rác. **Chính transition là guard:**

```js
function resumeFromBoundary(atMs) {
  if (state !== AUDIO_STATE.WAITING_AT_BOUNDARY) return false;
  state = AUDIO_STATE.RESUMING;   // ← chốt nguyên tử
  adapter.play();
  advanceLine();
  return true;
}
```

Input event, `compositionend`, một effect React và một socket update có thể cùng rơi vào một tick — chỉ lần đầu thấy `WAITING_AT_BOUNDARY` và được gọi `play()`. Test `completing the line at the boundary resumes exactly once` gọi `applyInput` ba lần với cùng nội dung và khẳng định `play()` chỉ tăng 1.

Nếu `play()` bị autoplay policy chặn, state quay lại `WAITING_AT_BOUNDARY` để UI mời người chơi bấm lại, không giả vờ là đã chạy.

---

## 8. Vietnamese Input

Giữ nguyên kiến trúc đã remediation cho Gõ Nhanh / Đoạn văn:

```
native <input>  →  NFC  →  grapheme compare  →  session
```

- **Không** parse Telex, **không** append `event.key`.
- `createTypingSession(line.text)` cho từng câu; reset khi sang câu mới.
- So sánh: `foldCase` (lowercase, giữ dấu) → **case-insensitive, accent-sensitive**.
- `nguoi` **không** khớp `người`; `NGÀY HÔM NAY` khớp `Ngày hôm nay`; NFD khớp NFC.
- IME: `compositionstart` bật cờ, `compositionend` đọc lại `input.value` sau khi browser commit (rAF fallback), giữ caret ở cuối.
- `maxLength = số grapheme của câu` → không thể gõ tràn; gõ sai thì phải Backspace.
- `onPaste` / `onDrop` bị chặn: không thể dán lời.
- Backspace ở đầu câu bị `preventDefault` để không rời trang.

Test tương ứng: `Vietnamese: accents are required, case is not`, `Vietnamese: NFD input is normalised to NFC`, và 31 test typing cũ vẫn xanh.

---

## 9. 2D Scene

Sân khấu SVG 680×150 (band ngang, không phải hero image) — vì **lời bài hát mới là game**, sân khấu chỉ là không khí:

- sàn gỗ + tường kem + đèn spotlight,
- ca sĩ (đầu, tóc, thân, tay cầm micro) — nhún nhịp khi nhạc chạy, hạ micro + bubble "chờ" khi pause, burst nhẹ khi resume,
- 2 loa, 24 thanh equalizer, bóng khán giả,
- **flow rail** ở mép sàn: dài đúng bằng % liền mạch của bài.

Quy tắc chuyển động (theo `smooth-motion`):

- chỉ animate `transform` / `opacity`,
- dùng token `--motion-*`, `--ease-*`, không thêm thư viện,
- **mọi animation dừng khi nhạc dừng** (`[data-mood="waiting"]` pause animation, equalizer về scaleY nhỏ),
- `prefers-reduced-motion` và `html[data-workrank-reduce-motion="true"]` đều tắt sạch.

Lyric:

```
câu trước   (nhỏ, mờ, có ✓ nếu đã xong)
CÂU ĐANG HÁT (lớn, từng grapheme: đã đúng / đang gõ / sai / chưa gõ)
câu tiếp    (nhỏ, mờ)
```

Ký tự đang gõ có caret nhấp nháy; ký tự sai underline đỏ đúng vị trí grapheme, không tô cả câu.

---

## 10. Solo

- `POST /api/games/typing/music/attempts { songId }` → `attemptId`, `challengeText` (lời nối bằng `\n`), `startedAt` do server đặt.
- Audio bắt đầu **ngay trong cú bấm** "BẮT ĐẦU" (user gesture), request attempt chạy song song — không chờ mạng rồi mới phát.
- Kết thúc: `POST /api/games/typing/music/finish` với `typedText` + evidence.
- Không có giới hạn thời gian cứng: `durationSeconds = độ dài bài + 240s` (ngân sách cho các lần dừng).

### Kết quả hiển thị

Điểm · Độ chính xác · Tốc độ · **Độ liền mạch** · **Số lần nhạc phải dừng** · **Chuỗi giữ nhạc tốt nhất** · Câu hoàn thành · Độ khó.

Thành tựu: `KHÔNG NGẮT NHỊP` (0 lần dừng + hết bài), `GIỮ NHỊP 10` (streak ≥ 10), `CHÍNH XÁC` (accuracy ≥ 98%).

---

## 11. Multiplayer

**Không tạo Room Engine mới.** Phòng nhạc là phòng typing hiện có + `musicSongId`:

| Bước | Thay đổi |
| --- | --- |
| `createRoom({ songId })` | `challengeText = lời nối bằng \n`, `durationLimitSeconds = độ dài bài + 240`, `difficulty = độ khó bài`, `musicSongId = song.id` |
| `typing:started` | mang thêm `musicSongId`; client tự phát audio local |
| `typing:progress` | mang thêm `music` (pauseCount, streak, lineIndex) — lưu vào draft để reconnect |
| `typing:finish` | server chấm lại bằng `musicScoring`, ghi đè `performanceScore` bằng điểm nhạc |
| `finalizeMatch` | result row có `flowPct`, `pauseCount`, `linesCompleted`, `musicScore`; `typing_match_results.musicSongId` |

**Audio mỗi người là local.** Người A pause ở câu 5, người B không pause → sau 20 giây hai người ở hai vị trí audio khác nhau. Đây là **hành vi đúng**, không phải bug. Vì vậy:

- race/thanh tiến trình tính theo **số câu đã gõ xong**, không theo `audio.currentTime`,
- kết quả xếp theo điểm nhạc (accuracy + completion + flow + streak), không theo timestamp,
- server không bao giờ giả định hai client cùng đồng hồ.

Giới hạn đã biết: luồng phòng + chấm điểm + finalize đã kiểm end-to-end bằng API (tạo phòng có bài, start, finish, result có `flowPct/pauseCount/musicScore`, BXH cập nhật). **Race 2 người thật với 2 browser chưa chạy trong phiên này** — xem Remaining Risks.

---

## 12. Server Authority

### Điểm

```
flowPct      = (totalLines - pauseCount) / totalLines
completion   = linesCompleted / totalLines
score        = round((accuracy*5 + completion*300 + flow*4 + bestStreak*15) * 6)
```

Cùng một công thức ở `frontend/src/games/music/engine.js` và `backend/src/services/musicScoring.js`. Có test **parity** chạy 400 tổ hợp (accuracy × totalLines × completedLines × pauseCount) và so từng kết quả.

### Server không tin client ở đâu

| Dữ liệu | Client gửi | Server làm gì |
| --- | --- | --- |
| Số câu hoàn thành | có thể gửi | **Bỏ qua**, tự đếm bằng cách tách `typedText` theo `\n` và so từng câu (NFC, case-insensitive) |
| Accuracy | — | Tự đo bằng `measureInput` trên lời gốc |
| `pauseCount` | có | **Chặn trên bằng đồng hồ**: `minPauses = ceil(max(0, elapsed - duration - 4s) / 30s)`; lấy `max(client, minPauses)` |
| `bestNoPauseStreak` | có | Cắt về `≤ linesCompleted - minPauses` |
| Điểm | không nhận | Tự tính lại từ các số đã suy ra |

Ví dụ thực tế trong test: client khai `pauseCount: 0` nhưng chạy 62s cho bài 12s → server suy ra **2 lần dừng**, flow và điểm đều giảm.

### Pause evidence

```json
{
  "songId": "duong-ve-nha",
  "typedText": "Chiều buông phố\nGió qua hàng cây",
  "linesCompleted": 2,
  "totalLines": 10,
  "pauseCount": 1,
  "flowPct": 90,
  "bestNoPauseStreak": 1,
  "accuracy": 100,
  "pauses": [{ "lineIndex": 0, "atMs": 10000, "durationMs": 2140, "reason": "BOUNDARY" }]
}
```

`durationMs` của mỗi pause là **wall-clock** (không phải audio time), nên cộng lại khớp với `elapsed - duration` mà server đo được.

---

## 13. Buffering Handling

Phân biệt rõ hai loại dừng:

| Loại | Nguồn | Có bị phạt? |
| --- | --- | --- |
| Người chơi chưa gõ xong | boundary gate | **Có** — tính là một lần nhạc dừng |
| Mạng đang buffer | `waiting` / `stalled` của audio element | **Không** |

```js
if (adapter.isBuffering()) {
  publish();
  return state;   // cổng bị đóng băng, không chấm boundary
}
```

Audio đã preload (`preload="auto"`) và file ~1.1MB nên buffer gần như không xảy ra với hosted audio; nhánh này chủ yếu bảo vệ khi mạng chậm hoặc file lớn hơn.

Ngoài ra: tab bị ẩn → `pauseForVisibility()` pause và **tính là một lần dừng** (fair, không thể lợi dụng để suy nghĩ). Nếu câu hiện tại đã gõ xong, engine **sang câu kế rồi mới pause** — nếu không, lượt chơi sẽ quay lại với một câu đã `COMPLETED` nhưng đang `WAITING_CORRECTION` và không có cách resume.

---

## 14. Performance

| Biện pháp | Chi tiết |
| --- | --- |
| Không rerender 60fps | `publish()` throttle 90ms cho cập nhật theo thời gian; gõ phím publish ngay |
| Input local-first | Không network trong handler; `createTypingSession` chỉ so phần đuôi vừa gõ |
| rAF một vòng | Một loop duy nhất đọc `adapter.getCurrentTime()`, không timer rải rác |
| Stage tách khỏi lyric | `MusicStage` là `memo`, chỉ phụ thuộc state/flow/streak |
| Animation bằng CSS | Không re-render cho equalizer/ca sĩ |

Đo trong Chromium mobile emulation (390×844) khi đang phát nhạc và gõ:

```
avg frame: 8.3ms · p95: 9.2ms · long frames (>33ms): 0
```

---

## 15. Browser QA

Chạy thật trên dev stack (Vite + Express + MySQL), Chromium, audio thật.

| Kịch bản | Kết quả |
| --- | --- |
| Mở `/games/typing/music` | 3 card bài hát, không tràn ngang (390px) |
| Chọn bài → màn hình sẵn sàng | Đúng tên, độ khó, thời lượng, số câu |
| Bấm BẮT ĐẦU | `audio.paused = false`, `currentTime` chạy, `duration = 61.32s` |
| Gõ dở câu 1 rồi để nhạc tới boundary | `paused = true`, `currentTime = 10.000`, hiện "HOÀN THÀNH CÂU ĐỂ NHẠC CHẠY TIẾP" |
| Gõ nốt câu 1 | `paused = false`, `currentTime = 10.87`, toast "♫ TIẾP TỤC!", flow 90% |
| Chơi hết bài, gõ kịp từng câu | **100% liền mạch, 0 lần dừng, 10/10 câu**, 3 thành tựu, server xác nhận |
| Mobile 390×844 | Lyric nằm trong viewport (top 434, bottom 654), input 16px (không zoom iOS), không tràn ngang |
| Tab "Bảng xếp hạng" | Hiện hạng, điểm, liền mạch, chính xác, bài; dòng của mình được tô |
| FPS khi chơi | 8.3ms/frame, 0 long frame |

Ảnh chụp: `docs/audit/2026-10-23/music-race/` (picker, ready, playing, paused, resumed, result, mobile, leaderboard).

---

## 16. Audio Listening QA

**Đã làm (kỹ thuật):**

- Giải mã lại MP3, kiểm tra: không NaN, không sample lỗi, peak 0.53–0.58, RMS ~0.12 (không clip, không nén nát).
- Nội dung phổ đúng: bass 65Hz, hợp âm 123–247Hz, có transient trống đều theo beat.
- Không khoảng lặng bất thường; độ dài file khớp `composedDuration + tail`.
- Pause/resume nhiều lần trong browser: không double audio, không overlap, không mất sync (10.000 → 10.87 → …).

**Chưa làm:** nghe thủ công bằng tai người trên tai nghe/loa. Đây là bước không thể thay bằng số liệu — xem Remaining Risks.

---

## 17. Remaining Risks

| # | Rủi ro | Mức | Ghi chú |
| --- | --- | --- | --- |
| 1 | **Chưa nghe thủ công 3 track** | Trung bình | Nhạc hợp lệ về kỹ thuật nhưng chất lượng cảm nhận (hoà âm, mix) cần một người nghe trước khi phát hành rộng. |
| 2 | **Race 2 người thật chưa chạy** | Trung bình | Luồng phòng + scoring đã kiểm bằng API; cần một buổi 2 browser/2 máy để xác nhận cảm giác race và đồng bộ countdown. |
| 3 | **Mobile mới kiểm bằng emulation** | Trung bình | Chưa thử iOS Safari thật (autoplay, keyboard đè lyric, media session). Đã xử lý `font-size: 16px` và `visualViewport` nhưng cần máy thật. |
| 4 | Catalog mới có 3 bài | Thấp | Đủ để chơi và đo, chưa đủ để giữ chân lâu dài. Pipeline thêm bài đã có (script + admin API). |
| 5 | Admin UI chưa có | Thấp | `POST /music/songs` đã có và validate; hiện phải gọi API/seed, chưa có form trong Admin. |
| 6 | Pause budget 240s | Thấp | Người chơi dừng quá lâu sẽ bị cắt lượt. Có thể tăng nhưng sẽ làm phòng chờ lâu hơn khi AFK. |
| 7 | Word-level karaoke | Thấp | Chưa làm, đúng như spec (không bắt buộc cho core). |
| 8 | Điểm nhạc không vào BXH WPM | Thấp (có chủ đích) | `typingVerifiedRecords` bỏ qua kết quả nhạc để không trộn hai game khác luật. BXH nhạc là bảng riêng. |
| 9 | Legacy passage vẫn dùng engine cũ | Thấp | Giữ có chủ đích; nếu sau này bỏ cần migrate kỷ lục WPM. |

---

## 18. Final Gates

| Gate | Kết quả | Bằng chứng |
| --- | --- | --- |
| TIMED_LYRICS | **PASS** | 36 câu / 3 bài, liền mạch, validate publish |
| LINE_BOUNDARY_DETECTION | **PASS** | pause tại `10.000s` đúng `endMs` |
| NO_MID_LINE_PAUSE | **PASS** | không nhánh nào pause ngoài boundary; test "does not pause mid-line" |
| PAUSE_WHEN_BEHIND | **PASS** | câu dở → `WAITING_AT_BOUNDARY` + UI "HOÀN THÀNH CÂU…" |
| RESUME_AFTER_CORRECTION | **PASS** | `10.000 → 10.87`, toast "TIẾP TỤC!" |
| RESUME_EXACTLY_ONCE | **PASS** | 3 lần `applyInput` cùng nội dung → `play()` +1 |
| FAST_TYPING_FLOW | **PASS** | hết bài 100% flow, 0 lần dừng |
| VIETNAMESE_INPUT | **PASS** | NFC/NFD, case-insensitive, accent-sensitive, IME |
| AUDIO_BUFFERING_NOT_PENALIZED | **PASS** | cổng đóng băng khi `isBuffering()`; unit test |
| 2D_MUSIC_SCENE | **PASS** | stage SVG + animation dừng theo nhạc |
| SOLO | **PASS** | attempt → finish → result → BXH |
| MULTIPLAYER | **PASS** (luồng phòng + scoring) | phòng có `musicSongId`, result có `flowPct/pauseCount/musicScore`; race 2 browser chưa chạy — xem risk #2 |
| SERVER_AUTHORITATIVE_RESULT | **PASS** | server tự đếm câu, chặn pause bằng đồng hồ, tự tính điểm; parity test |
| PERSISTENCE | **PASS** | `music_songs`, `typing_practice_attempts.music_*`, `typing_match_results.music_song_id` |
| BXH | **PASS** | tab "Bảng xếp hạng" trong game + `/music/leaderboard`; BXH WPM cũ không bị trộn |
| HOSTED_LICENSED_AUDIO | **PASS** | 3 MP3 WorkRank Original, `rightsStatus: OWNED` |
| YOUTUBE_OFFICIAL_EMBED | **NOT_USED** | adapter đóng có chủ đích |
| NO_YOUTUBE_RIPPING_OR_AD_BYPASS | **PASS** | không có code tải/rip/proxy |
| AUDIO_LISTENING_QA | **PASS (kỹ thuật)** | phân tích tín hiệu + pause/resume; **nghe thủ công còn thiếu** (risk #1) |
| MOBILE | **PASS (emulation)** | 390×844, không tràn, lyric trong viewport, input 16px |
| PERFORMANCE | **PASS** | 8.3ms/frame, p95 9.2ms, 0 long frame |
| OVERALL_MUSIC_TYPING_RACE | **PASS** | vòng chơi đầy đủ chạy thật trong browser |

---

## 19. Definition of Done — đối chiếu

```
♫ nhạc đang chạy
        ↓
người chơi gõ theo câu
        ↓
gõ kịp  →  ♫ nhạc tiếp tục liền mạch
        ↓
gõ không kịp / còn lỗi
        ↓
♫ hết câu hiện tại  →  ⏸ DỪNG  →  gõ xong  →  ♫ TIẾP TỤC
```

Đúng như yêu cầu, và **không** có nhánh "gõ sai 1 chữ → cắt nhạc giữa câu".

Cảm giác trung tâm của game — *giữ cho bài hát không bao giờ phải dừng* — được đo bằng **Độ liền mạch** và thể hiện ngay trên sàn diễn bằng một đường sáng dài đúng bằng % đó.

---

## 20. Danh sách file

### Thêm mới

```
scripts/music/build_song_assets.py
shared/music/songCatalog.json
frontend/public/audio/music/{duong-ve-nha,pho-chieu,bao-noi}.mp3
frontend/src/games/music/{engine,audioAdapter,catalog,useMusicRace}.js
frontend/src/components/music/{MusicStage,LyricKaraoke,MusicHud,MusicSongPicker,MusicResult,MusicBoard}.jsx
frontend/src/components/music/music-race.css
frontend/src/pages/MusicRace.jsx
frontend/tests/music-engine.test.mjs
frontend/scripts/qa/{music-race-smoke,music-race-full-run,music-race-mobile}.mjs
backend/src/models/MusicSong.js
backend/src/migrations/20261023120000-music-typing-race.js
backend/src/seeders/musicSongs.seeder.js
backend/src/services/{musicScoring,musicRace.service}.js
backend/src/controllers/musicRace.controller.js
backend/test/music_race_engine.test.js
docs/audit/2026-10-23/TYPING_MUSIC_RACE_REDESIGN.md
```

### Chỉnh sửa

```
frontend/src/App.jsx                     thêm route /games/typing/music (+ /room/:roomId)
frontend/src/games/arcade/catalog.js     đổi tên hiển thị + route, giữ id typing_battle
frontend/src/pages/TypingHub.jsx         3 lối vào: Theo nhạc / Gõ Nhanh / Văn bản cổ điển
frontend/src/components/arcade/TypingArcadeView.jsx   nhãn "Văn bản cổ điển"
frontend/src/services/api.js             musicRaceApi
frontend/src/utils/typingSession.js      import extension (chạy được bằng node --test)
frontend/package.json                    script test:music
backend/src/models/{TypingRoom,TypingMatchResult,TypingPracticeAttempt,TypingUserStat,index}.js
backend/src/routes/typingGame.routes.js  8 route /music/*
backend/src/services/typingGame.service.js   nhánh musicSongId cho room/start/progress/finish/finalize
backend/src/services/typingVerifiedRecords.js  bỏ kết quả nhạc khỏi BXH WPM
```

### Test

```
frontend: 16/16  node --test tests/music-engine.test.mjs
backend:  10/10  node --test test/music_race_engine.test.js   (gồm parity client↔server)
backend:  31/31  typing_engine_authority + typing_practice_authority + typing_unicode_metrics
frontend: npm run check + npm run build  → pass
backend:  full suite — 140 test / 134 pass / 6 fail (đều thuộc competition + harness, xem dưới)
```

### 6 test fail của full suite (không liên quan nhạc)

| Suite | Lỗi | Kết luận |
| --- | --- | --- |
| `competition_phase3` (Optimistic Lock) | "Final count 1 must equal succeeded mutations 0" | sqlite không có row lock → test đòi conflict nhưng sqlite serialize |
| `competition_phase5_hardening` | concurrent settlement | cùng nguyên nhân |
| `competition_phase9` (concurrency stress) | concurrent settlement | cùng nguyên nhân |
| `competition_phase9_security` | 1 subtest | suite competition, không đụng route nhạc |
| `mvp_cup_comprehensive_e2e` | "Exactly one request must succeed (201) and one rejected (409)" | cùng nguyên nhân sqlite |
| `integration.test.js` | `SQLITE_MISUSE: Database is closed` trong hook | lỗi teardown harness đã ghi chú sẵn trong `test/setup/teardown-db.mjs` |

Đã chạy lại `arcade_http` và `admin_panel_e2e` khi **không** có dev server giữ cổng 5001: pass toàn bộ.
Nhóm typing + music + arcade: pass 100%.
