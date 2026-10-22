# Báo cáo remediation room system cho ba game mới

Ngày audit: 2026-10-22  
Phạm vi: Computer Rush, Direction Rush, Memory Flash, cùng regression cho Typing Battle.

## Tóm tắt

Đã sửa các lỗi có thể tái hiện trên room path hiện tại của ba game mới và chạy kiểm thử service cùng trình duyệt thật. Computer Rush, Direction Rush và Memory Flash đều dùng chung `ArcadeRoom`/`ArcadePlayer`, `arcade.service`, API `/api/games/arcade` và engine gameplay chung; không tồn tại ba room service riêng theo từng game.

Lượt browser audit mới nhất đạt **26/26 checks**. Backend suite mục tiêu đạt **44/44 tests**. Stress test tạo rồi rời **20 phòng/game (60 lượt)** không để lại membership hoặc room ma. Tuy nhiên, các game mới **chưa dùng room engine Typing Battle** như yêu cầu kiến trúc nêu ra. Typing Battle vẫn có schema, lifecycle service và socket contract riêng. Do đó gate tổng thể dưới đây là **FAIL**, dù các luồng Arcade được kiểm chứng đều chạy.

## Stable Existing Room Architecture

Typing Battle là luồng legacy ổn định được audit. Flow tạo phòng nằm trong `typingGame.service.createRoom`: tạo `TypingRoom` và seat host `TypingPlayer` trong cùng transaction. API và socket gọi các lifecycle method của service này; `typingRealtime.service` phát các sự kiện `typing:*`. `TypingRoom` giữ mã phòng, host, đội/kiểu trận, challenge, seat limit và trạng thái; `TypingPlayer` giữ seat, team, ready, tiến độ và kết quả.

Các đặc tính legacy quan trọng:

- ID phòng là số tự tăng; các mode gồm `SOLO`, `1V1`, `TRIO`, `2V2`, `3V3`.
- State gồm `WAITING`, `STARTING`, `PLAYING`, `FINISHED`, `ABANDONED`; countdown 3,2 giây có thể bị hủy nếu điều kiện ready thay đổi.
- Khi host rời phòng chờ, host được chuyển cho người còn lại; phòng rỗng được đánh dấu `ABANDONED`.
- Socket room dùng `typing:${roomId}` và event có tiền tố `typing:`. Ngắt kết nối có grace window, reconnect hủy cleanup đang chờ; danh sách lọc room rỗng.
- Regression evidence có sẵn: `backend/test/typing_room_lifecycle.test.js` và `docs/audit/2026-10-19/typing/room-lifecycle-results.json`. Các test này nằm trong lần chạy regression mới nhất.

## New Games Previous Architecture

Ba game mới trước và sau lần sửa đều dùng một Arcade room path chung:

| Concern | Typing Battle (legacy) | Computer Rush | Direction Rush | Memory Flash |
|---|---|---|---|---|
| Create/join/leave | `typingGame.service` | `arcade.service` | `arcade.service` | `arcade.service` |
| Persistence | `TypingRoom` / `TypingPlayer` | `ArcadeRoom` / `ArcadePlayer` | `ArcadeRoom` / `ArcadePlayer` | `ArcadeRoom` / `ArcadePlayer` |
| Room ID / mode | số; `1V1`, `TRIO`, team modes | UUID; `SOLO`/`DUO`/`TRIO` | UUID; `SOLO`/`DUO`/`TRIO` | UUID; `SOLO`/`DUO`/`TRIO` |
| Ready/start | service legacy, có `STARTING` countdown | service Arcade | service Arcade | service Arcade |
| Room event contract | `typing:*`, room `typing:<id>` | `arcade:state`, `arcade:roomsChanged` | như Computer | như Computer |
| Reconnect/cleanup | seat grace + stale-room cleanup | heartbeat, sweep 5 giây, active/detail | như Computer | như Computer |
| Gameplay | typing challenge/progress | engine Computer | engine Direction | engine Memory |

Không có `ComputerRoomSystem`, `DirectionRoomSystem` và `MemoryRoomSystem` riêng. Divergence quan trọng là **một Arcade engine mới nhưng tách biệt với engine legacy**, chứ không phải ba bản room service của ba game mới.

## Root Cause

1. **Lỗi 500 khi danh sách có phòng.** `arcade.service.list()` dùng `CAPACITY[r.mode]` nhưng chỉ lấy `GAME_TYPES` từ engine. Khi danh sách rỗng, callback `map` không chạy nên test cũ không phát hiện; khi có room, backend ném `ReferenceError: CAPACITY is not defined`. Browser audit đã tái hiện HTTP 500 trước khi sửa.
2. **Lobby không nghe invalidation realtime có sẵn.** Backend đã phát `arcade:roomsChanged`, nhưng trang lobby chỉ polling mỗi 3 giây. Phòng vẫn có thể hiện trễ và UI không phản ánh ngay socket update.
3. **Route game và room có thể lệch `gameType`.** Frontend trước đó dựa vào game type trên URL khi dựng room. URL sai game có thể tạo state/request sai cho room đã thuộc game khác.
4. **Identifier được khai báo lặp ở client/server.** Các canonical ID và alias không có một registry chung, khiến thay đổi tên dễ làm lệch frontend, backend và socket/filter.
5. **Create/rematch lặp thao tác tạo room và host membership.** Hai nhánh tạo room có nguy cơ lệch về việc luôn insert seat của host.
6. **Kiến trúc chưa đáp ứng reuse legacy.** Typing Battle và Arcade có schema, mode, state machine và giao thức socket không tương thích trực tiếp. Ba game mới chưa gọi lifecycle service của Typing Battle. Không có migration an toàn, tối thiểu nào được thực hiện trong lượt này mà vẫn giữ nguyên hành vi các mode/team/challenge của Typing Battle.

## Shared Room Contract

Contract Arcade hiện tại dùng dữ liệu server làm nguồn chuẩn:

```text
ArcadeRoom: id, gameType, mode, capacity, hostId, status, seed,
            difficulty, durationSeconds, startedAt, revision
ArcadePlayer: id, roomId, userId, ready, revision, events,
              heartbeatAt, finishedAt, result
```

`ArcadeRoom` dùng status `WAITING`, `PLAYING`, `FINISHED`, `CLOSED`. Arcade không có state `READY` hoặc `STARTING`: ready là thuộc tính server-authoritative của từng `ArcadePlayer`; khi điều kiện start thỏa, status chuyển thẳng sang `PLAYING` và lưu mốc countdown vào `startedAt`. Đây là khác biệt với state machine Typing Battle, không nên che giấu bằng cách đổi tên state.

Capacity: `SOLO=1`, `DUO=2`, `TRIO=3`. Solo tạo attempt nội bộ với trạng thái chơi, không vào danh sách phòng Duo/Trio.

## Game Registry

Thêm `shared/gameRegistry.mjs` làm nguồn canonical cho `typing_battle`, `computer_rush`, `direction_rush`, `memory_flash`, Drawing và aliases dạng hyphen/legacy. Arcade engine, backend catalog, room authorization và frontend catalog/Game Hub đọc registry này. Registry chuẩn hóa identifier; nó **chưa** hợp nhất hai persistence/lifecycle engine.

## Create

`arcade.service.createRoomWithHost()` hiện được cả `create` và `rematch` dùng. Room và membership host được tạo trong transaction, sau đó phát snapshot/invalidation. Create kiểm tra game/mode/difficulty, active room và capacity. Test kiểm chứng host có mặt ngay sau success cho cả ba game.

## Join

`join` khóa user/room trong transaction, trả canonical room nếu người chơi đã là member, chặn SOLO, room đóng/đã bắt đầu, phòng đầy và user đang có phòng hoạt động khác. Khi thêm người, ready của các thành viên hiện tại được reset. Lỗi trả lý do cụ thể như `Phòng đã đầy`, `Phòng đã bắt đầu` hoặc `Phòng không còn tồn tại`.

## Ready

`ready` ghi trạng thái lên `ArcadePlayer` trong transaction và phát lại room state từ server. Browser audit đã bấm Ready trên từng browser cho các trận DUO/TRIO của cả ba game.

## Start

Chỉ host được start. Service yêu cầu room `WAITING`, đúng số player theo capacity, mọi player ready và heartbeat còn hạn; sau đó cập nhật status, `startedAt` và revision. Browser audit đã bấm Start thật, chơi input trên từng browser và xác minh seed/clock chung cùng kết quả authoritative.

## Leave

Trong room `WAITING`, service xóa seat, chuyển host cho member còn lại khi cần, reset ready; người cuối cùng rời thì room `CLOSED`. Trong room `PLAYING`, leave được ghi nhận như forfeit và kết quả vẫn được finalize. Các test lifecycle bao gồm chuyển host, leave cuối và idempotent finalize.

## Disconnect/Reconnect

Arcade lưu `heartbeatAt`, áp dụng grace window 30 giây và chạy sweep mỗi 5 giây. Người chơi refresh qua route active/detail cập nhật heartbeat; khi hết grace, seat chờ stale bị xóa và host có thể được chuyển. Backend test có reconnect heartbeat và disconnect expiry. Browser evidence reconnect/offline/reload gần nhất có từ `docs/audit/2026-10-21/arcade/network-results.json`; kịch bản mạng này không được chạy lại trong lượt 2026-10-22.

## Ghost Cleanup

`sweep()` xóa member stale trong room chờ, chuyển host nếu cần, đóng room khi không còn player và finalize room chơi quá thời lượng cộng delivery window. `list()` chỉ lấy room `WAITING` có association player bắt buộc. Test stress mới tạo/rời 20 vòng cho từng game, sau đó xác nhận không còn membership hay room công khai ma.

## Socket Events

Room update phát `arcade:state` tới `user:<userId>` và `arcade:roomsChanged` tới dashboard, kèm `gameType`. Lobby lọc event theo game đang mở, tải ngay khi mount/reconnect và giữ polling dự phòng 15 giây. Typing Battle tiếp tục dùng `typing:<roomId>` và các event `typing:*`.

Browser audit xác minh lobby browser khác nhìn thấy phòng sau **60–115 ms** trong lượt chạy này. Cross-game isolation được kiểm tra qua các room list/filter đồng thời và route canonicalization. Namespace typing/arcade khác nhau trong code; chưa có packet-capture test tạo đồng thời phòng Typing và ba loại Arcade để chứng minh không có broadcast chéo ở mức socket runtime.

## Routes

- Arcade API dùng chung: `/api/games/arcade/rooms` và `/api/games/arcade/rooms/:id/{join,ready,start,leave,progress,finish}`.
- Frontend room route sau sửa điều hướng về canonical `room.gameType` khi URL mang game type khác.
- Typing Battle vẫn dùng route/controller riêng và identifier legacy được `gameRoomAuth.service` chuẩn hóa qua registry.

## Removed Duplicate Code

Trong ba game mới không có service riêng để xóa. Phần lặp create-host giữa Arcade create/rematch được gom vào `createRoomWithHost`. Ba UI catalog riêng được thay bằng dữ liệu lấy từ registry chung. **Room service/model/socket path của Typing Battle chưa bị thay hoặc xóa**, nên gate loại bỏ các room path trùng giữa legacy và Arcade không đạt.

## Computer E2E

Browser thật: SOLO, DUO (2 browser) và TRIO (3 browser); lobby discovery, ready/start, input thật, cùng seed/clock, rank/score nhất quán giữa client, leaderboard/personal best. Computer DUO cũng kiểm tra URL game sai được chuyển về canonical route. Kết quả: PASS. Bằng chứng chi tiết: `docs/audit/2026-10-22/arcade-room-remediation/browser-results.json`.

## Direction E2E

Browser thật: SOLO/DUO/TRIO; các client nhập hướng trên cùng round, kiểm tra challenge seed/clock chung, kết quả cuối/rank authoritative và leaderboard. Kết quả: PASS. Có kiểm tra tối thiểu 50 input đúng cho player được dùng làm mốc trong browser script.

## Memory E2E

Browser thật: SOLO/DUO/TRIO; từng client quan sát board, nhập cell qua UI, xác minh kết quả cuối đồng nhất và leaderboard/personal best. Kết quả: PASS.

## Existing Game Regression

Lệnh backend đã chạy:

```text
node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 test/arcade_service.test.js test/arcade_http.test.js test/game_catalog.test.js test/typing_room_lifecycle.test.js test/socket_room_auth.test.js
```

Kết quả **44 pass / 0 fail**, gồm lifecycle regression Typing Battle. `npm run check` đạt 100% (89 files); `npm run build` thành công. Build vẫn in cảnh báo sẵn có về duplicate object key trong `Friends.jsx` và CSS minify trong arcade stylesheet.

## Stress Tests

- **20 create/leave mỗi game:** 60 chu kỳ, không room công khai/member ma.
- **Concurrent create:** chỉ một room thành công cho cùng user; create còn lại bị chặn bởi active-room rule.
- **Duplicate join:** trả cùng membership thay vì tạo player thứ hai.
- **Tranh slot TRIO cuối:** hai join đồng thời không thể vượt capacity.
- **Host leave:** host được chuyển; ready được reset; leave cuối đóng room.
- **Browser 2/3 context:** DUO và TRIO thực sự dùng 2/3 browser context riêng cho mỗi game.
- **Realtime room discovery:** 60–115 ms trong lượt browser này.

## Remaining Risks

1. **Chưa đạt yêu cầu kiến trúc chính:** Typing Battle là engine ổn định được nhận diện nhưng ba game mới vẫn dùng Arcade service/schema riêng. Không thể đánh dấu overall pass khi chưa có adapter/shared lifecycle thật sự hoặc quyết định sản phẩm chính thức giữ hai engine.
2. State machine Typing và Arcade khác nhau (`STARTING` có ở Typing, không có ở Arcade); mode và schema cũng khác. Việc chuyển room mới sang Typing trực tiếp sẽ làm mất contract seed/evidence hoặc đòi hỏi mở rộng engine legacy và cần migration/regression riêng.
3. Browser reconnect/network suite chỉ có evidence từ 2026-10-21, không được lặp lại lần này; server restart/recovery cũng chưa được kiểm tra trong lượt này.
4. Cross-game test mới xác minh filter/API và route Arcade. Socket event Arcade được filter theo `gameType`, nhưng chưa chạy packet-capture cho một Typing room đồng thời với ba Arcade room.
5. Browser/backend acceptance chạy trên fixture SQLite và round ngắn; không xác nhận tải đồng thời hoặc behavior của production database/socket cluster.

## Final Gates

| Gate | Kết quả | Căn cứ |
|---|---|---|
| `SHARED_ROOM_ENGINE_IDENTIFIED` | PASS | Typing Battle được audit qua model/service/socket/tests. |
| `DUPLICATE_ROOM_PATHS_REMOVED` | FAIL | Arcade và Typing vẫn có service/schema/socket lifecycle riêng. |
| `CANONICAL_GAME_TYPE_REGISTRY` | PASS | Shared registry dùng chung frontend/backend. |
| `COMPUTER_DUO_CREATE_JOIN` | PASS | Browser 2 context + backend tests. |
| `COMPUTER_TRIO_CREATE_JOIN` | PASS | Browser 3 context + backend tests. |
| `COMPUTER_READY_START` | PASS | UI Ready/Start thật và gameplay đến kết quả. |
| `DIRECTION_DUO_CREATE_JOIN` | PASS | Browser 2 context + backend tests. |
| `DIRECTION_TRIO_CREATE_JOIN` | PASS | Browser 3 context + backend tests. |
| `DIRECTION_READY_START` | PASS | UI Ready/Start thật và gameplay đến kết quả. |
| `MEMORY_DUO_CREATE_JOIN` | PASS | Browser 2 context + backend tests. |
| `MEMORY_TRIO_CREATE_JOIN` | PASS | Browser 3 context + backend tests. |
| `MEMORY_READY_START` | PASS | UI Ready/Start thật và gameplay đến kết quả. |
| `ROOM_LIST_REALTIME` | PASS | Event invalidation + browser thấy phòng trong 60–115 ms. |
| `HOST_LIFECYCLE` | PASS | Transfer host, reset ready, close cuối có backend coverage. |
| `LEAVE_CLEANUP` | PASS | Lifecycle test và 60 chu kỳ stress. |
| `GHOST_ROOM_PREVENTION` | PASS | Sweep/list filter + stress không còn membership/room ma. |
| `RECONNECT` | PASS | Backend heartbeat/grace tests và browser evidence 2026-10-21; chưa chạy lại browser network suite hôm nay. |
| `DUPLICATE_CREATE_PROTECTION` | PASS | Concurrent create test: một room duy nhất được tạo. |
| `DUPLICATE_JOIN_PROTECTION` | PASS | Duplicate membership test. |
| `CAPACITY_RACE_PROTECTION` | PASS | Concurrent join slot cuối TRIO test. |
| `SOCKET_ISOLATION` | FAIL | Code dùng namespace/channel riêng và Arcade filter theo gameType, nhưng chưa chạy cross-game runtime test có Typing room cùng ba Arcade room. |
| `EXISTING_WORKING_GAME_REGRESSION` | PASS | Backend suite 44/44, có Typing lifecycle regression. |
| `20X_CREATE_LEAVE_STRESS` | PASS | 20 chu kỳ cho mỗi game, 60 tổng. |
| `REAL_2_BROWSER_DUO` | PASS | Browser audit dùng hai context cho DUO. |
| `REAL_3_BROWSER_TRIO` | PASS | Browser audit dùng ba context cho TRIO. |
| `OVERALL_SHARED_ROOM_SYSTEM` | FAIL | Ba game mới chạy tốt trên Arcade chung, nhưng chưa được chuyển sang engine Typing Battle theo yêu cầu. |

