# WorkRank — Three 2D Arcade Games Implementation

Ngày thực hiện: 21/10/2026, múi giờ Asia/Ho_Chi_Minh.

Đã triển khai Computer Rush, Direction Rush và Memory Flash, mỗi game có Solo/Duo/Trio, phòng chờ, countdown, kết quả, BXH và kỷ lục cá nhân. Kiểm thử trình duyệt thật đã qua cả chín tổ hợp game/chế độ. **Nghiệm thu toàn bộ vẫn FAIL theo gate nghiêm ngặt: chưa xác minh UniKey thật trên Windows hoặc một lượt Telex hệ điều hành có thể kiểm soát được.** Unicode native và vòng đời IME mô phỏng đã PASS; không xem chúng là bằng chứng UniKey thật.

## Existing Game Infrastructure Audit

- Game Center dùng `GameCatalog` và `GameHub.jsx`; tại thời điểm bắt đầu chỉ giữ Typing Battle và Drawing. Có nhiều thay đổi chưa commit của công việc trước và thay đổi đồng thời trong workspace; không reset hoặc phục hồi chúng.
- Typing có phòng đấu đội, input native/local-first, checkpoint/revision, persistence và hạ tầng kiểm thử SQLite. Không đưa luật phòng đấu đội của Typing vào ba game mới.
- Thưởng XP dùng `ScoreLedger`, khóa duy nhất `(idempotency_key, effect_type)`. Arcade dùng lại sổ điểm này; không tạo ví thưởng riêng.
- Chưa có bảng thành tích arcade có các chỉ số phù hợp cho ba game. Dùng một service và một trang BXH chung cho cả ba, đọc kết quả đã xác minh, không tạo ba hệ thống xếp hạng độc lập.
- Catalog phía server chỉ xuất năm game được hỗ trợ. Frontend cũng chỉ merge năm game này. Các route chuyển hướng game cũ không bị khôi phục thành game hoạt động.

## Shared 2D Architecture

- `shared/arcade/engine.mjs`: generator, tiến trình độ khó, normalization, luật thời gian, replay tính điểm và tie-break dùng chung server/client. `words.mjs` là lớp dữ liệu từ vựng riêng.
- `ArcadeRoom`: UUID, game, mode, capacity, host, seed, difficulty, duration, startedAt, revision, status.
- `ArcadePlayer`: UUID riêng của lượt người chơi, user, ready, heartbeat, checkpoint events/revision, result và finishedAt.
- `arcade.service.js`: một vòng đời phòng, progress, finalize và BXH cho ba game.
- `useArcadeSession`: network mỗi 1 giây, nhận socket snapshot, giữ local checkpoint và phục hồi sau reload.
- `ArcadePlay` giữ engine cục bộ; `ComputerInput` giữ state từng ký tự trong component con. Gõ không làm Game Center hoặc toàn trang render lại.
- Route: `/games/arcade/computer_rush`, `/games/arcade/direction_rush`, `/games/arcade/memory_flash`; phòng thêm `/room/:roomId`.
- Không thêm game engine, Canvas, WebGL hoặc thư viện animation.

## Art / Motion System

- Phòng máy xanh lá, sân phản xạ tím nhạt và phòng trí nhớ màu cát, cùng nét bo tròn và nhân vật avatar + thân 2D.
- Sân chơi chiếm toàn bộ bề ngang vùng nội dung. HUD chỉ có thời gian/điểm và dải người chơi gọn phía dưới.
- Avatar có nhãn P1/P2/P3, tên và màu áo riêng. Computer multiplayer đặt đối thủ hai phía; Direction dùng lane; Memory có các nhân vật dưới bảng.
- Correct có hop/dash, ba dấu sao nhỏ; wrong có dấu × và wobble cục bộ; combo thưởng tăng dần; kết quả có bục hạng.
- Dùng `--motion-*`, `--ease-*`, `TabTransition`, `AnimatedNumber`, `FlipTableBody`. Không `transition: all`, không thư viện mới, không animation layout nặng.
- Có nhánh `prefers-reduced-motion` và `data-workrank-reduce-motion`. Timer, pointer state, socket listener và feedback timeout có cleanup.
- Đã loại ngôi sao trang trí khỏi Memory để tránh nhầm với mục tiêu trong bảng.
- Không bổ sung âm thanh trong phiên bản này; đây là phần tùy chọn của yêu cầu.

## Computer Rush Implementation

- Màn hình máy tính, bàn, bàn phím và nhân vật; từ/cụm từ lần lượt xuất hiện. Đúng từ tự chuyển ngay; Enter cho phép bỏ qua từ chưa đúng và ghi nhận một lượt sai.
- Kho dễ/vừa/khó/tiếng Việt hoặc tăng dần. Mixed đi từ dễ tới vừa, khó rồi tiếng Việt.
- **Case policy:** normalize NFC, gộp whitespace, bỏ khoảng trắng đầu/cuối, không phân biệt hoa/thường; **có phân biệt dấu tiếng Việt**.
- Input native nhận giá trị sau OS/IME; không ghép `event.key`, không parser Telex. Không submit khi đang composition; compositionend xử lý giá trị native cuối cùng. Chặn paste/drop.
- Sai ký tự có cảnh báo và viền input; Backspace hoạt động như input bình thường. Lỗi đã sửa vẫn ảnh hưởng accuracy.
- Thời lượng mặc định 60 giây. Khi viewport co do bàn phím mobile, input đang focus được đưa lại vào vùng nhìn thấy.
- Đã kiểm tra bàn phím Chromium, chữ thường, NFD/NFC tiếng Việt, Backspace, input trước GO, composition mô phỏng, offline và reload. Chưa xác minh UniKey thật.

## Direction Rush Implementation

- Mũi tên lớn, sân có lane, avatar dash tối đa 18px và trở về vị trí cũ.
- Arrow keys và WASD; listener chỉ nằm trên sân có focus. Sau hết giờ hoặc ở menu không chặn phím trình duyệt.
- Pointer swipe bốn hướng, ngưỡng 28px, pointer capture và `touch-action: none` trong sân; bốn nút hướng là fallback có nhãn.
- Bỏ qua key repeat. Input dưới ngưỡng hợp lệ 80ms không tạo lượt chấm điểm mới.
- Cửa sổ phản ứng giảm 100ms mỗi 8 challenge, từ 1800ms xuống tối thiểu 550ms. Sai hoặc hết cửa sổ thì sang challenge kế tiếp.
- Không đảo điều khiển và không thêm sequence mode.
- Đã chơi 55 hướng/trận bằng mũi tên/WASD; đã kiểm tra touch thật qua CDP và native key repeat.

## Memory Flash Implementation

- Các pha PREPARE 300ms → FLASH 1000–1800ms tùy level → HIDE 150ms → SELECT → phản hồi/đệm 400ms → vòng tiếp.
- Level tăng sau mỗi ba vòng. Level 1–3: 3×3; 4–7: 4×4; từ 8: 5×5. Số mục tiêu tăng một sau mỗi hai level, reveal giảm 100ms theo mỗi hai level, tối thiểu 1000ms.
- Chỉ chọn sau HIDE. Bấm lại để bỏ chọn; đủ mục tiêu thì tự chấm sau 220ms, có thể sửa lựa chọn trước khi timeout này chạy.
- Không gửi từng tile click; không phát lựa chọn của đối thủ. DOM không giữ class mục tiêu sáng khi hết FLASH.
- Máy chủ tự so tập cell với generator; không nhận `correct=true` làm bằng chứng.
- Đã chơi 22 vòng đúng liên tiếp trên viewport 390px, qua cả 3×3, 4×4 và 5×5. Tile đo được >=44px và không tràn ngang.

## Solo

- Tạo internal attempt với capacity 1, countdown ngay; không xuất hiện trong danh sách phòng công khai và không cho người khác join.
- Có kết quả xác minh, thưởng, kỷ lục cá nhân, hạng, best combo/streak, BXH theo thời gian và nút chơi lại.
- Không cho một người mở nhiều lượt đang hoạt động. Menu có liên kết tiếp tục/rời lượt trước.

## Duo

- Capacity đúng 2, cùng seed/difficulty/duration/startedAt. Cần đủ người và tất cả ready, chủ phòng mới được bắt đầu.
- Đã chơi cả ba game bằng hai browser context độc lập và đối chiếu thứ hạng/điểm cuối.

## Trio

- Capacity đúng 3, cùng challenge contract. Kết quả có #1/#2/#3 và bục hạng.
- Đã chơi cả ba game bằng ba context độc lập; mọi client có cùng thứ hạng cuối.
- Thử thêm Direction Trio: một client offline vẫn nhập cục bộ, hai client khác tiếp tục, reconnect flush, một client khác reload; cuối trận cả ba có 19 lượt đúng và thống nhất thứ hạng.

## Challenge Seeds

- UUID và seed 128-bit do server tạo, không dùng seed client đề xuất.
- Generator độc lập theo `(seed, index)` nên người chơi chậm không làm lệch chuỗi. Difficulty nằm trong room, không do từng client chọn sau khi bắt đầu.
- Tất cả clock tính từ startedAt chung sau countdown khoảng 3,2 giây. Handler kiểm tra thời gian thực khi nhận input, không phụ thuộc snapshot trạng thái PLAYING đến sớm hay muộn.

## Scoring Contracts

Mỗi event chứa index tăng liên tục, timestamp tính từ startedAt và bằng chứng phù hợp. Client không được đặt điểm cuối.

| Game | Bằng chứng | Điểm nền | Bonus | Chặn thời gian không hợp lý |
| --- | --- | --- | --- | --- |
| Computer | final value + số lỗi local | 100/từ đúng | speed 0–40 + combo tối đa 96 | >=140ms và >=35ms/ký tự với từ đúng |
| Direction | hướng hoặc timeout null | 100/hướng đúng | speed 0–40 + combo tối đa 96 | >=80ms; input đúng trong response window |
| Memory | tập cell duy nhất | 200 + 30×level/vòng đúng | speed 0–40 + streak tối đa 96 | sau prepare/reveal/hide và >=120ms để chọn |

- Combo/streak vẫn được thống kê đầy đủ; **bonus** bị chặn ở chuỗi 12.
- Accuracy = correct/attempts; Computer còn tính lỗi gõ đã sửa vào mẫu số với trọng số 0,15/lỗi. Điểm tổng = raw points × accuracy², làm tròn. Correctness quan trọng hơn speed.
- Avg response chỉ tính các challenge đúng; Memory trừ toàn bộ pha reveal/prepare trước khi tính response.
- Tie-break chung: score giảm dần → correct giảm dần → accuracy giảm dần → average response tăng dần → UUID ổn định.

## Leaderboards

- Một giao diện chung, lọc Game, Solo/Duo/Trio, Today/Week/Month/All Time. Computer thêm kho từ để không trộn dễ/khó/tiếng Việt/mixed.
- Chỉ lấy lượt eligible, lấy lượt tốt nhất của mỗi user trong bộ lọc; trả top 100 và vị trí cá nhân kể cả ngoài top 100.
- Có cột riêng tên đúng: từ đúng/hướng đúng/vòng đúng, accuracy, combo/streak, phản xạ/phản hồi TB.
- Period theo lịch Asia/Ho_Chi_Minh, tuần bắt đầu thứ Hai.
- Lưu mode và duration trong room. BXH chỉ so duration hiện đang cấu hình trên server, tránh trộn thành tích 15/60/90 giây khi cấu hình thay đổi.
- Không cập nhật BXH trên mỗi input; bảng dùng kết quả đã xác minh sau finalize.

## Server Authority

- Mỗi mutation lock room trong transaction; create/join còn lock user để tránh cùng người chiếm nhiều lượt qua request đồng thời.
- Chặn room/player không sở hữu, mode không hợp lệ, seed/attempt giả, index trùng/nhảy, timestamp trước GO hoặc ngoài duration, completion quá nhanh, cell trùng/sai phạm vi và reaction không hợp lệ.
- Snapshot cũ không ghi đè state mới; checkpoint đã ghi không được sửa prefix. Revision bằng số event đã hoàn thành, tăng đơn điệu.
- Payload progress được gom, tối đa 1500 event và 256KB ở route; không gửi từng phím/tile.
- Đây là basic anti-cheat. Public seed cho phép client tạo trước challenge; thời gian và dấu vết vẫn do client cung cấp rồi server kiểm tra giới hạn. Không khẳng định chống bot/esports.

## Rewards

- Tính lại score trên server; chỉ lượt không surrender, có ít nhất một challenge đúng và accuracy >=50% mới eligible.
- XP = floor(score/200), tối đa 30 XP/lượt; điểm thấp có thể eligible BXH nhưng nhận 0 XP.
- Result, finishedAt và `ScoreLedger` được ghi trong cùng transaction. Khóa `arcade:<playerAttemptId>` + `INDIVIDUAL_XP` ngăn ghi thưởng hai lần.
- Đã kiểm tra duplicate finalize, hai finalize đồng thời, retry và đọc lại sau refresh. Test kiểm tra **đúng một** ledger row với lượt đủ XP, không dùng điều kiện <=1 dễ bỏ sót thưởng.

## Room Lifecycle

- WAITING → PLAYING (gồm countdown) → FINISHED; phòng chờ hết người → CLOSED và xóa các seat chờ.
- Chủ phòng rời có chủ mới; ready của các thành viên còn lại được reset. Đang chơi mà rời chủ động thì surrender, không hưởng thưởng/BXH.
- Leave phòng chờ là idempotent khi seat đã được gỡ.
- Background sweep mỗi 5 giây; waiting seat không heartbeat quá 30 giây bị gỡ. Public list chỉ có DUO/TRIO WAITING với ít nhất một player.
- Đã kiểm tra bằng API và UI việc chuyển host, reset ready, last leave và loại ghost room khi mất heartbeat.

## Reconnect

- Progress HTTP và socket snapshot không chặn local input. Offline vẫn ghi event vào bộ nhớ và sessionStorage.
- Reconnect/reload ưu tiên checkpoint local có prefix khớp checkpoint server; không thay bằng snapshot thấp hơn.
- Có 10 giây delivery grace sau deadline. Sau grace, server finalize bằng checkpoint đã lưu, không nhận lịch sử mới gửi quá muộn.
- Đã thử offline + reconnect + reload ở Solo Computer và Trio Direction. Các game dùng chung cơ chế này.
- Đóng hẳn tab có thể mất tối đa các event chưa sync nếu trình duyệt không giữ sessionStorage; server vẫn chốt phần evidence đã lưu.

## Performance

- Không network roundtrip ở đường input → validate → feedback → next challenge. Chu kỳ sync 1000ms; cập nhật phòng chờ 3000ms.
- Native input có component riêng, không đẩy từng ký tự lên page state. Game clock render nhẹ ở 20Hz; animation do CSS/compositor thực hiện.
- Trong mẫu Direction Trio 2 giây ở Chromium trên máy này: 239 frame, khoảng **119 FPS**, p95 khoảng **9ms/frame**. Đây là mẫu ngắn theo màn hình/máy kiểm thử, không bảo đảm cho mọi thiết bị.
- CPU throttle 4×, 22 hướng đúng, input đến khung hình kế tiếp: median **8,1ms**, p95 **29,3ms**. Đo frame sau input, không coi là đo toàn bộ display latency.
- Build: ArcadeGame ~10,74KB gzip; shared arcade JS ~1,98KB gzip; CSS chung ~6,13KB gzip. Không asset ảnh hoặc thư viện game nặng.

## Responsive

- Menu **và sân chơi thực tế** của cả ba đã kiểm tra 1920, 1440, 1280, 1024, 768, 430 và 390px; không tràn ngang.
- Game Center 390px có ba poster phân biệt rõ, giữ Typing/Drawing, không có card game đã loại.
- Memory 5×5 đã đo target tối thiểu 44px trên 390px. Direction đã vuốt bằng CDP touch events và bấm nút fallback.
- Chưa có thiết bị điện thoại vật lý để xác nhận bàn phím phần mềm và browser chrome của iOS/Android.

## Accessibility

- Player nhận diện bằng P-number, tên, avatar và màu, không chỉ màu.
- Native input có label/aria-invalid; các nút memory có hàng/cột và aria-pressed; giai đoạn board dùng status; input hướng có tên nhóm/focus ring.
- Bốn nút hướng >=44px. Memory có thể chọn bằng Tab/Enter/Space; có giảm chuyển động.
- Không thêm handler phím toàn document cho gameplay. Trong trận, tạm khóa nút BXH để tránh tháo gameplay và làm mất input đang nhập.
- Chưa chạy screen reader hoặc audit WCAG đầy đủ; nhịp độ game giới hạn khả năng chơi hoàn toàn bằng screen reader.

## Automated Tests

Lệnh backend cuối cùng:

```sh
cd backend
NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 \
  test/arcade_engine.test.js test/arcade_service.test.js test/arcade_http.test.js \
  test/game_catalog.test.js test/typing_room_lifecycle.test.js \
  test/typing_socket_state_sync.test.js test/typing_practice_authority.test.js \
  test/socket_room_auth.test.js
```

Kết quả: **51 PASS, 0 FAIL**. Bao gồm generator, Unicode, timing, score, forgery, chín game/mode, prefix/revision, room lifecycle, timeout, reward đồng thời, HTTP ownership, migration up/down/up và hồi quy Typing/socket.

Frontend: `npm run check`, `npm run build`, `npm run test:routes`: PASS, 24 route checks. `git diff --check`: PASS.

Build vẫn có warning ở `Friends.jsx` về key trùng và CSS toàn cục có `Unexpected @media`. Các file này đã có thay đổi ngoài phạm vi arcade; không sửa vào công việc khác. Một số suite cũ log `SQLITE_MISUSE: Database is closed` khi teardown hai lần nhưng assertions đều qua.

Trong lúc viết test HTTP/migration có một lần HTTP 401 không tái hiện; sau đó ba lần chạy lặp HTTP đều PASS và toàn bộ suite cuối cùng PASS. Không coi lần chạy lỗi trước là kết quả nghiệm thu.

## Real Browser QA

- `frontend/scripts/arcade-browser-audit.mjs`: **18 checks PASS**, chín trận thật (3 game × 3 mode), keyboard/mouse, seed/clock chung, thứ hạng trùng và BXH.
- `frontend/scripts/arcade-device-audit.mjs`: **13 checks PASS**, responsive menu, Unicode/IME mô phỏng, offline/reload, mobile swipe, CPU 4×, 22 vòng Memory, ghost expiry và giảm chuyển động.
- `frontend/scripts/arcade-surface-audit.mjs`: **22 checks PASS**, bảy kích thước của ba sân chơi và native key repeat.
- `frontend/scripts/arcade-network-audit.mjs`: **2 checks PASS**, Trio offline/reconnect/reload và UI leave/host transfer.
- `frontend/scripts/arcade-default-round-audit.mjs`: **3 checks PASS**, cả ba game chơi đủ thời lượng mặc định 60 giây và nhận kết quả máy chủ.
- Tổng **58 checks trình duyệt PASS**, không có uncaught page error trong các báo cáo cuối.
- Fixture ở `backend/test/fixtures/arcade-live-server.cjs` buộc `NODE_ENV=test`, SQLite `:memory:` và bind loopback. Không dùng DB làm việc. Có trang bootstrap đăng nhập chỉ trong fixture để hỗ trợ test desktop khi UI thật dùng Google login.
- Đợt chín trận dùng duration 15s để rút ngắn QA. Bài tiến trình Memory dùng 90s do cần đủ thời gian thao tác 22 vòng. Đã chạy riêng cả ba game đủ 60s mặc định trong browser với fixture 5109/Vite 5279.
- Native keyboard Chromium không đồng nghĩa bộ gõ hệ điều hành. Máy có macOS VietnameseSimpleTelex; thử desktop không lấy được một phiên nhập có thể kiểm soát và xác minh. **Không đánh PASS UniKey thật.**

Chạy lại QA bằng ba cặp server riêng:

```sh
# Terminal 1, backend/
NODE_ENV=test PORT=5107 ARCADE_ROUND_SECONDS=15 node test/fixtures/arcade-live-server.cjs
# Terminal 2, frontend/
VITE_API_URL=http://127.0.0.1:5107 npm run dev -- --host 127.0.0.1 --port 5277
# Sau đó, frontend/
node scripts/arcade-browser-audit.mjs
node scripts/arcade-surface-audit.mjs
node scripts/arcade-network-audit.mjs

# Device audit dùng fixture thứ hai PORT=5108 ARCADE_ROUND_SECONDS=90,
# Vite 5278 với VITE_API_URL=http://127.0.0.1:5108
node scripts/arcade-device-audit.mjs

# Default-round audit: fixture PORT=5109, không đặt ARCADE_ROUND_SECONDS;
# Vite 5279 với VITE_API_URL=http://127.0.0.1:5109
node scripts/arcade-default-round-audit.mjs
```

Evidence: [arcade/](arcade/) chứa JSON, log và screenshots. Các file JSON là kết quả cuối, không gộp lượt chạy thất bại trước khi hoàn thiện harness.

## Files Changed

Các file thêm bởi hạng mục này:

- `shared/arcade/engine.mjs`, `shared/arcade/words.mjs`.
- `backend/src/models/ArcadeRoom.js`, `ArcadePlayer.js`.
- `backend/src/migrations/20261021100000-create-arcade-games.js`.
- `backend/src/services/arcade.service.js`, `backend/src/routes/arcade.routes.js`.
- `backend/test/arcade_engine.test.js`, `arcade_service.test.js`, `arcade_http.test.js`, `fixtures/arcade-live-server.cjs`.
- `frontend/src/games/arcade/catalog.js`, `useArcadeSession.js`.
- `frontend/src/components/arcade/ArcadeArt.jsx`, `ArcadePlay.jsx`, `DirectionArena.jsx`, `MemoryBoard.jsx`, `arcade.css`.
- `frontend/src/pages/ArcadeGame.jsx`.
- Năm script QA `frontend/scripts/arcade-*.mjs` và evidence/báo cáo này.

Các file hiện có được bổ sung kết nối: `backend/src/models/index.js`, `routes/index.js`, `services/gameCatalog.service.js`, `sockets/index.js`, `server.js`, `backend/test/game_catalog.test.js`, `frontend/src/App.jsx`, `pages/GameHub.jsx`, `scripts/route-smoke-test.cjs`.

Danh sách này không nhận các thay đổi của công việc trước hoặc công việc đồng thời làm thay đổi của arcade.

## Remaining Risks

1. **UniKey thật trên Windows và Telex hệ điều hành chưa được xác minh.** Cần chạy Computer với các từ có dấu bằng UniKey/Telex thực, gồm đặt dấu muộn, sửa dấu, Backspace và hoàn thành sát GO.
2. Browser QA dùng fixture SQLite; migration đã thử SQLite, chưa chạy migration và tải đồng thời trên MySQL triển khai thực tế.
3. Chưa thử iPhone/Android vật lý, screen reader hoặc bài soak/performance dài. Số đo FPS/latency chỉ áp dụng máy và Chromium hiện tại.
4. Seed public và client timestamps chỉ đủ basic anti-cheat; không chống bot biết generator.
5. BXH lọc kết quả rồi lấy lượt tốt nhất trong service; với lịch sử lớn cần thêm projection/query aggregation phù hợp, không tải toàn bộ lịch sử về service mãi.

## Final Acceptance Gate

| Gate | Kết quả | Bằng chứng / giới hạn |
| --- | --- | --- |
| COMPUTER 2D VISUAL | PASS | Phòng máy, bàn, avatar/đối thủ, feedback; screenshot Trio |
| COMPUTER SOLO | PASS | Browser + API |
| COMPUTER DUO | PASS | Hai context thật, cùng kết quả |
| COMPUTER TRIO | PASS | Ba context thật, cùng kết quả |
| COMPUTER UNIKEY | **FAIL** | Chưa xác minh bộ gõ OS/UniKey thật; native Unicode/IME mô phỏng đã PASS |
| COMPUTER BXH | PASS | Ba mode, kỷ lục cá nhân, kho từ |
| DIRECTION 2D VISUAL | PASS | Sân lane và dash |
| DIRECTION SOLO | PASS | Browser, >50 hướng |
| DIRECTION DUO | PASS | Hai context |
| DIRECTION TRIO | PASS | Ba context và bài reconnect |
| DIRECTION INPUT LATENCY | PASS | Local-first, CPU 4× p95 đến frame kế tiếp 29,3ms |
| DIRECTION BXH | PASS | Ba mode |
| MEMORY 2D VISUAL | PASS | Bảng game, ánh sao, nhân vật |
| MEMORY SOLO | PASS | Browser |
| MEMORY DUO | PASS | Hai context |
| MEMORY TRIO | PASS | Ba context |
| MEMORY DIFFICULTY | PASS | 22 vòng thật qua 3×3/4×4/5×5 |
| MEMORY BXH | PASS | Ba mode |
| SHARED ROOM SYSTEM | PASS | Ready/capacity/start/transfer/leave |
| GHOST ROOM PREVENTION | PASS | Last leave và heartbeat expiry |
| RECONNECT | PASS | Offline local inputs + reconnect flush + reload |
| SERVER AUTHORITY | PASS | Server replay, ownership, timing và evidence |
| REWARD IDEMPOTENCY | PASS | Unique ledger + transaction, concurrent finalize |
| MULTIPLAYER FAIRNESS | PASS | Cùng seed/startedAt, rank đồng nhất |
| MOBILE | PASS | Chromium emulation + CDP touch; chưa có thiết bị thật |
| PERFORMANCE | PASS | Mẫu ngắn 119 FPS; CPU 4× vẫn usable; không bảo đảm mọi máy |
| REAL 2-PLAYER BROWSER TEST | PASS | Ba game |
| REAL 3-PLAYER BROWSER TEST | PASS | Ba game |
| NO LEGACY GAME RESURRECTION | PASS | Catalog/API/cards không có game cũ |
| OVERALL 3-GAME 2D PHASE | **FAIL** | Cần xác minh UniKey/Telex thật trước nghiệm thu đầy đủ |
