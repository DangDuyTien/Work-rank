# Game / Drawing persistence, Direction queue và UX remediation

Ngày nghiệm thu: **22/10/2026**. Project: `/Applications/du-an/workrank/workrank-realtime`. Base Git: `09d854f`; các sửa đổi trong audit này chưa commit hoặc deploy.

**Mã nguồn và nghiệm thu full-stack dev đã đạt. Production chưa đạt nghiệm thu Drawing image storage vì chủ dự án xác nhận chưa có kho ảnh production.** Không sử dụng dịch vụ S3 QA trên localhost làm bằng chứng đã cấu hình cloud production. Gate OVERALL production ở cuối báo cáo là FAIL cho tới khi bucket thật được cấu hình và kiểm tra.

Đã kiểm tra bằng frontend Vite, Express, Socket.IO, **MySQL 8.4.9** và **SeaweedFS 4.48 S3 thật**, cùng browser Chromium thật. Browser A tạo dữ liệu; đóng browser A; dừng và restart frontend/backend/S3; browser B mới đọc dữ liệu. Sau đó logout, xóa toàn bộ storage của browser và login mới, cả năm trải nghiệm vẫn đọc được dữ liệu permanent. Không mock API, không đưa local result vào response, không dùng object map trong process backend thay cho S3.

## Persistence Regression Root Cause

Audit bắt đầu từ pipeline dữ liệu và DB, trước khi sửa UI. [Ma trận baseline](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/BASELINE_DATA_MATRIX.md) được ghi trước phần queue/UX.

| Lỗi thực tế | Trước → đường hỏng | Sửa và bằng chứng |
|---|---|---|
| P0: Typing TRIO không finalize trên MySQL | Model result cũ hỗ trợ SOLO/1V1/2V2/3V3; bản thêm TRIO cập nhật room/UI nhưng bỏ sót ENUM của `typing_match_results.mode`. Transaction tạo result lỗi và rollback. SQLite không bắt được lỗi ENUM này. | Thêm TRIO vào model và migration idempotent cho cả room/result; chạy MySQL thật, giữ nguyên 100 result cũ. [Trước/sau schema](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/typing-result-enum-upgrade.json). |
| P0: Arcade checkpoint tiếp theo bị từ chối | `JSON.stringify(oldEvent)===JSON.stringify(newEvent)` nhầm thứ tự key với nội dung. MySQL JSON sắp lại key, khiến lịch sử hợp lệ bị xem là sửa dữ liệu. Điểm local vẫn tăng trong khi DB chỉ giữ checkpoint đầu. | So sánh nội dung từng field bằng `sameArcadeEvent`, dùng chung ở client recovery/server. Vẫn từ chối sửa thời gian, đáp án, index hoặc thêm field vào checkpoint đã ghi. MySQL full-stack ghi và finalize được. |
| P1: Schema practice mới có thể không khởi tạo | `LONGTEXT DEFAULT ''` bị MySQL từ chối. | Default là function ở tầng model; DDL thành `LONGTEXT NOT NULL`, không có SQL DEFAULT. [MySQL DDL proof](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/mysql-ddl-proof.json). |
| P1: Ván đã lưu khó tìm sau xóa browser storage | Result đã ở DB nhưng không có history API/UI để tìm lại; biết room URL mới mở được. | Thêm history từ các model hiện có. Typing giữ snapshot độc lập với room được reset; Arcade có link kết quả theo room. |
| P1: Typing replay mất ghế | Effect listener phụ thuộc `challengeText`; reset đổi đoạn văn làm cleanup gửi `typing:leaveRoom`, backend xóa ghế WAITING/STARTING. | Tách vòng đời membership khỏi listener refresh. Browser thử lại Solo/Duo/Trio đều giữ người chơi. Cleanup phục hồi lobby STARTING rỗng. |
| P0: Drawing cũ trỏ kho mock đã tắt | DB làm việc có Drawing #4 trỏ `127.0.0.1:4599`; endpoint không còn chạy. Có adapter S3 trong code không đồng nghĩa đã có kho production. | Tìm lại đúng PNG gốc, sao lưu và khôi phục bytes vào DB của bản ghi legacy; chờ bucket thật để migrate. Không ghi URL QA mới đè lên dữ liệu làm việc. |
| P1: Drawing upload/read-back có thể làm mất bytes đã commit | Upload → tạo row → đọc lại; nếu read-back lỗi, compensation xóa object dù row ACTIVE đã commit. | Ghi upload intent HIDDEN/PENDING trước upload; ACTIVE/CONFIRMED sau thành công. Retry cùng publicationId/checksum vào đúng row/key. Lỗi đọc lại không xóa bytes đã commit. |
| P1: Delete/migration dùng sai giả định về storage | Delete dùng adapter hiện tại bất kể provider gốc; migration bỏ qua mọi row có key, kể cả key local, và làm mất nhánh userId khi lấy basename. | Delete theo provider, lưu durable deletion intent và reconcile. Migration giữ nested path, chuyển local có key, HEAD object trước khi coi là đã migrate. |
| P1: Gallery theo user lộ metadata private | Default query gallery theo user không giới hạn PUBLIC đối với người ngoài/anonymous. | Owner/admin/same-team được kiểm tra; người ngoài chỉ nhận PUBLIC. Test authorization qua API. |

## Previous Working Path

Typing đã có `TypingPlayer → finalizeMatchOnce → TypingMatchResult + TypingUserStat + ScoreLedger` trong transaction. Các mode trước TRIO phù hợp ENUM. Arcade cũng đã có `ArcadeRoom/ArcadePlayer` và server replay; Drawing đã có facade storage/S3 adapter. Audit sử dụng lại các model và service này, không tạo một hệ thống kết quả song song.

Git ở base `09d854f` chứa đường TRIO mới, phép so sánh JSON theo serialization và các game arcade mới. Model `TypingMatchResult` trước sửa vẫn chỉ có bốn mode cũ. Có bằng chứng MySQL cho lỗi hiện tại; không khẳng định mọi game arcade từng hoạt động đúng trên production chỉ từ những test SQLite trước đó.

## Broken Path

```text
Arcade action → React provisional score tăng
             → checkpoint MySQL đổi thứ tự key
             → request sau bị 400
             → DB/result/BXH thiếu phần input tiếp theo

Typing TRIO → validate → transaction → INSERT result(mode=TRIO)
                                      → MySQL ENUM error → rollback

Drawing legacy → DB URL của kho mock cũ → service đã tắt → ảnh không tải được
```

Các lỗi này giải thích triệu chứng “chỉ thấy local”, dù architecture trước đó đã có backend. Refresh không thể khôi phục các action chưa từng được server chấp nhận.

## Fixed Architecture

```text
Input native / canvas
  → local provisional UI
  → deferred checkpoint / async publish
  → server validates evidence
  → transaction saves result / stats / exactly-once reward
  → commit
  → authoritative response
  → independent GET / DB query
  → reload / new browser / cleared storage → same permanent data
```

Arcade lưu kết quả vào `ArcadePlayer.result`, identity room/player có sẵn; room giữ mode, seed, duration và rulesVersion. Result mới có userId, gameType, mode, startedAt, finishedAt, score, rank, validatedAt, createdAt và metrics hiện có. Rank cuối được lưu khi toàn phòng kết thúc. Typing match/practice bổ sung cùng identity/timestamps/score/rank vào snapshot JSON hiện có, không thêm bảng.

`useArcadeSession` chờ request đang bay rồi flush input mới nhất trước khi rời ván; flush lỗi thì giữ người chơi ở ván để retry. Snapshot sessionStorage được hoãn 1 giây, không stringify/setItem trên mỗi action. Visibility/pagehide có keepalive checkpoint giới hạn 60 KB; final submit vẫn là request được xác nhận, không lấy keepalive làm bằng chứng đã finalize.

## Data Persistence Matrix

| Feature / dữ liệu | Local được phép | Server / DB / storage là nguồn cuối | Kết quả |
|---|---|---|---|
| Game Center / availability / phòng | Cache hiển thị, lựa chọn UI | Game catalog, room API và DB | Đọc backend |
| Mute, tutorial đã xem, giảm chuyển động | Preference | Không phải kết quả game | Local hợp lệ |
| Input đang gõ / action chưa sync | Ref/React + recovery draft | Checkpoint đã xác nhận ở DB | Provisional được gắn trạng thái |
| Typing result/WPM/accuracy/score/rank | Chỉ cache hiển thị | TypingMatchResult hoặc FINISHED TypingPracticeAttempt | PASS dev |
| Typing PB/BXH | Cache | verified records từ DB, metrics version/eligibility | PASS dev |
| Computer/Direction/Memory final result | Chỉ provisional khi đang chơi | ArcadePlayer.result; backend replay | PASS dev |
| Arcade PB/BXH | Cache | Query finished eligible DB rows theo game/mode/duration/rules | PASS dev |
| Match history | Cache | History API query DB hiện có | PASS dev |
| XP/reward/thống kê | Không tạo local reward | ScoreLedger + stats trong transaction | Exactly-once theo eligibility |
| Drawing nháp | IndexedDB Blob + metadata theo user | Chưa phải nội dung published | Nhãn “trên thiết bị” |
| Drawing published metadata | Preview tạm | Drawing row ACTIVE/CONFIRMED | PASS dev |
| Drawing published bytes | Canvas/preview tạm | S3 key + object độc lập backend | PASS dev; production chờ bucket |
| Creative Gallery | Cache UI | Drawing query + GET ảnh từ storage | PASS dev |
| Drawing deletion retry | Không phụ thuộc browser | HIDDEN + deletionPending ở DB; worker retry | PASS dev |

## Typing Persistence

Finalization tiếp tục validate nội dung thật, tính Unicode metrics ở server, lưu result/stat/ledger trong transaction. Retry hoặc finalize đồng thời không ghi reward lần hai. Match snapshot có identity theo room + startedAt; reset phòng không xóa lịch sử trận trước.

PB/BXH đọc `typingVerifiedRecords` từ DB, không lấy `bestWpm` local. Practice dưới 120 giây vẫn có result/history nhưng không ghi BXH hoặc XP theo policy hiện tại. Match đủ điều kiện vẫn có thể nhận 0 XP khi chạm hạn mức ngày; không tạo ledger giả 0 điểm để báo “đã thưởng”.

MySQL QA đầu có ba trận đủ điều kiện, mỗi người có đúng một ledger cho identity từng trận. Vòng cuối đã chạm hạn mức ngày nên 0 XP và 0 ledger mới là đúng policy. [Bằng chứng ledger Typing](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/typing-ledger-proof.json) ghi cả hai trường hợp. Unit/HTTP tests kiểm tra retry không tăng ledger.

Browser thử đủ Solo/Duo/Trio, finish/replay; native test thử composition NFD, Backspace, 620 ký tự, virtual passage, offline/reload và viewport có bàn phím. Không sửa kiến trúc hot input sang controlled input hay đưa race animation vào mỗi keypress.

## Computer Persistence

Native keyboard gõ đúng 14 từ; server replay đối chiếu word/seed/index/thời gian, không nhận client score. Final 60s có score **2730**, correct/accuracy/avgResponse/bestCombo và một ledger cho player attempt. GET result, PB, BXH và history đã xác nhận qua browser B sau restart/clear storage. Bản ghi này không cần sessionStorage để đọc lại.

## Direction Persistence

Ván mới dùng rulesVersion 3; các game khác giữ version 2. Result 60s của vòng nghiệm thu là **59749** điểm, server tính từ input. Wrong không xóa ngược điểm đã kiếm; tác động là combo reset và mất thời gian 450 ms. Hạn chế này được backend replay kiểm tra.

BXH/PB của luật hàng chờ được tách khỏi luật cũ vì scoring/nhịp khác nhau. Result cũ vẫn ở DB và history, không bị chuyển điểm sang luật mới. Browser B đọc đúng v3 result/PB/BXH; bản v2 trước thay đổi cũng đã được kiểm tra persistence ở vòng đầu.

## Memory Persistence

Browser chơi native tile qua nhiều level, server kiểm pattern/selection/response; final 60s đạt **7900** điểm trong vòng persistence. Score, correct rounds, accuracy, streak/combo, response và rank được lưu ở result. BXH/PB derive từ DB và vẫn giống sau các lần clear/restart.

UX audit riêng đã chơi tới board 5×5, thử sai và bỏ chọn lại, xác nhận pattern không lộ trong SELECT, nhân vật không đè bảng. Timeout là một attempt sai thật; không bỏ timeout khỏi result để làm đẹp accuracy.

## Drawing Storage

Luồng mới:

```text
Canvas → PNG Blob → publicationId + SHA-256
  → transaction ghi Drawing HIDDEN/PENDING, sở hữu stable key
  → S3 PUT bytes
  → transaction ACTIVE/CONFIRMED + validatedAt
  → GET drawing → browser GET ảnh remote
  → “Đã lưu lên hệ thống” → Creative Gallery
```

DB lưu `image_url`, `storage_key`, `storage_provider`, mime, kích thước, checksum và publicationId. URL canonical không dùng signed query hết hạn. Domain được suy ra từ key/cấu hình CDN ổn định. Lỗi storage không fallback local ở development/production; cấu hình thiếu trả 503, PUT lỗi trả 502. UI báo chưa thể đăng nếu hệ thống chưa cấu hình kho ảnh; người dùng vẫn vẽ, giữ nháp và tải PNG.

Đã thử **dừng dịch vụ S3 thật** khi publish: nhận 502; giữ nguyên pixels và draft, DB có một intent PENDING. Khởi động S3 lại rồi retry cùng publicationId: một row ACTIVE, một stable object; UI tải lại ảnh remote rồi mới báo thành công. Lỗi kích hoạt DB sau upload cũng được regression test: object vẫn có intent sở hữu, retry không sinh row mới; read-back failure không xóa object đã commit.

Delete kiểm owner/admin trước; non-owner 403. DB chuyển HIDDEN/deletionPending trước xóa bytes, gallery ẩn tranh. Storage lỗi giữ intent; worker startup và mỗi 60 giây retry. Khi thành công, object 404, row DELETED, delete lại vẫn thành công. [Evidence](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/drawing-delete-resilience.json). Test phối hợp dừng/khởi động từng service có một lượt hết hạn marker của harness; đã tiếp tục kiểm tra đúng intent đã chụp, không bỏ qua trạng thái lỗi của sản phẩm.

## Drawing Migration

DB làm việc trước sửa có bốn tranh: ba SVG inline trong DB, một PNG trỏ kho mock localhost đã tắt. Đã tìm đúng PNG gốc **397061 bytes, 1200×700**, SHA-256 `b2d48cc40803320dd4bfd70cc3778bb35256de088f3740549542427cc1b495c6`.

Đã sao lưu DB trước schema/data remediation và sao lưu PNG gốc ngoài repository. [Baseline/schema/backup](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/database-baseline-and-schema.json), [recovery PNG](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/legacy-drawing-recovery.json). Bytes PNG gốc hiện ở DB của **bản ghi legacy hiện có**, provider database, chờ object migration; không dựa vào file `/tmp` để gallery tiếp tục xem ảnh. Đây là phục hồi legacy có kiểm checksum, không phải fallback publish mới.

Migration đã sửa: local có key vẫn migrate; nested path không bị basename làm mất userId; HEAD object trước skipped/adopted; missing file/object được báo và exit khác 0; key legacy tất định chống upload trùng. SVG inline giữ nguyên theo policy hiện tại. Chưa chạy chuyển dữ liệu làm việc vào một bucket production chưa tồn tại.

Hướng dẫn cụ thể: [DRAWING_STORAGE_SETUP.md](/Applications/du-an/workrank/workrank-realtime/docs/DRAWING_STORAGE_SETUP.md).

## Direction Queue Design

- Current 100%; NEXT 3 hướng có opacity/scale lần lượt 72%, 52%, 32%.
- Raw stimulus sinh từ seed/index; NEXT1 trở thành current, phần còn lại trượt bằng FlipList 180 ms. Mũi tên mới có enter 180 ms; animation không khóa gameplay.
- Một ô buffer nhận phím trong ranh giới phản hồi tối thiểu 60 ms; đọc state qua ref đồng bộ để phím liên tiếp không dùng props cũ. Phím chờ được tiêu thụ đúng index; không giữ cả chuỗi spam, không nhận keyboard auto-repeat.
- Test gửi current, next và bốn phím spam liên tiếp: chỉ tăng đúng hai attempts; current tiếp theo đúng bằng NEXT2 đã nhìn thấy.
- Position/color/entrance/opposite/final cùng giữ raw queue. Opposite có banner rõ; expected là hướng đảo, preview vẫn là stimulus, không hiển thị sẵn đáp án.
- Queue được memo riêng để FLIP không đo layout lại theo mỗi clock tick. Timer/RAF/buffer được cleanup, giảm chuyển động có fallback tĩnh.

## Direction Stumble Design

Chọn và giữ **450 ms** sau playtest: đủ nhận biết lỗi và đối thủ có cơ hội vượt trong vài nhịp đúng, vẫn tiếp tục nhanh sau một nhịp khựng. Browser quan sát freeze thực, feedback KHỰNG/CẦN/BẠN BẤM và input sau đó hoạt động lại; đo bao gồm overhead automation cho khoảng quan sát dưới 700 ms. Đây là đánh giá qua playtest nội bộ, chưa phải nghiên cứu người dùng rộng.

Trong stumble không nhận phím và không mang phím spam sang cue tiếp theo. Hết 450 ms mới cho một phím buffer ở ranh giới 60 ms; lần ghi đáp án sớm nhất sau lỗi là 510 ms. Server trừ stumble khỏi response window, không ép người chơi vừa bị khóa vừa hết hạn cue.

HTTP regression gửi wrong ở 300 ms rồi giả next ở 600 ms: **400**, revision vẫn giữ checkpoint hợp lệ. Next ở 810 ms: được nhận. DUO và TRIO browser chơi thực: người A đúng rồi sai, người B giữ pace và vượt điểm/hạng. Không có boost người sau. Live opponent/rank nhận theo checkpoint khoảng 1 giây, không cam kết update mạng theo mỗi phím.

## 5-Experience UX Improvements

| Trải nghiệm | Quan sát → cải tiến → thử lại |
|---|---|
| Typing | Giữ race/input native; thêm history DB, thông báo result đã lưu cùng rank/score/XP, sửa nút BXH quay đúng tab và replay không rơi ghế. Chơi lại Solo/Duo/Trio; IME, offline, current line và keyboard viewport đều qua. |
| Computer | Giữ word transition/monitor/combo, thêm ngôn ngữ của từ hiện tại, result có nhãn hệ thống và history. Gõ sai/sửa, 20 từ liên tiếp dưới CPU 4x, input và target cùng nhìn thấy ở 390×430, một chạm replay. |
| Direction | Current+3, slide, atomic logical state + tiny buffer, stumble/feedback, lane rank/runner displacement, podium/history. Kiểm ba mode và đủ trick stages, keyboard/WASD/buttons; test mới không đợi animation xong mới nhận phím. |
| Memory | Feedback REVIEW có số ô đúng/sai/bỏ sót, tile phản hồi nhanh bằng token motion-instant, history/result persisted. Chơi tới 5×5 và kiểm sai/chọn lại trên nhiều viewport. |
| Drawing | Avatar/arcade HUD, bản nháp tách published, undo/redo, fit canvas trên mobile và khi resize, loading/upload progress, remote preview xác nhận, giữ tranh khi lỗi và tải PNG. Không biến canvas thành race/dashboard. |

Điểm sau playtest, **tự đánh giá trong môi trường dev đã cấu hình S3**, không phải số đo người dùng hoặc điểm production readiness:

| Category /10 | Typing | Computer | Direction | Memory | Drawing |
|---|---:|---:|---:|---:|---:|
| Visual clarity | 9.1 | 9.1 | 9.3 | 9.1 | 9.0 |
| Motion smoothness | 9.2 | 9.1 | 9.2 | 9.1 | 9.0 |
| Correct/wrong feedback | 9.0 | 9.1 | 9.4 | 9.2 | 9.1 |
| Responsiveness | 9.3 | 9.2 | 9.3 | 9.2 | 9.2 |
| Game feel | 9.0 | 9.1 | 9.3 | 9.1 | 9.0 |
| Multiplayer/social feel | 9.1 | 9.0 | 9.2 | 8.8 | 8.8 |
| Persistence confidence, dev | 9.5 | 9.5 | 9.5 | 9.5 | 9.4 |
| Mobile | 9.0 | 9.0 | 9.0 | 9.0 | 9.0 |
| Replay/use-again | 9.0 | 9.1 | 9.2 | 9.0 | 9.0 |
| **Trung bình** | **9.13** | **9.13** | **9.27** | **9.11** | **9.06** |

Drawing không phải đua multiplayer; cột social đánh giá gallery/author/visibility/reactions. Production persistence của Drawing không được chấm 9+ khi chưa có bucket; tình trạng đó được phản ánh ở gates riêng.

## Database Verification

Fixture bind MySQL audit DB riêng, không force-sync/drop dữ liệu làm việc. Truy vấn DB qua model thật sau từng write. [DB sau writes](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/database-after-writes.json) và [DB sau restart/clear](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/database-after-restart.json).

| Nội dung nghiệm thu cuối | Identity / dữ liệu |
|---|---|
| Computer 60s | room `7d954605-7ba8-48bd-aa9e-a7b935265ee4`, score 2730 |
| Direction 60s, v3 | room `fc6aa076-6c88-41c7-9730-292f07bb9a09`, score 59749 |
| Memory 60s | room `f1b58248-9870-4ec5-89f2-7a950003a486`, score 7900 |
| Typing TRIO 30s | room 10, ba result trong snapshot, rank 1/2/3 |
| Drawing | row 7 của **DB QA**, PNG S3, SHA-256 `25c0d80c5248f567aaac3004ad16d7fa178a614b4fa0428bb1773761e87a20eb` |
| Ledger | 35 entries trước restart = 35 sau browser B và toàn bộ clear/login; mỗi arcade attempt được thưởng có đúng một ledger |

Identity Drawing #4 của DB làm việc và Drawing #4 của DB QA là hai bản ghi trong hai database riêng. Bài delete chỉ xóa artwork QA, không xóa tranh phục hồi của người dùng.

## Cross-Browser Verification

[Create results: 6 PASS, 0 errors](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/create-browser-results.json). [Read results: 11 PASS, 0 errors](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-browser-results.json).

Browser A chơi/publish qua giao diện và input native. Finalize retry hai lần rồi GET độc lập. Đóng toàn bộ contexts/process A. SIGTERM backend/Vite/S3, chờ flush filer và port trống, khởi động lại với cùng MySQL và S3 data directory. Browser B là process/profile mới, không có localStorage/sessionStorage/IndexedDB của A; login cùng user rồi đọc result, PB, BXH, history và ảnh có cùng checksum.

Hai browser đều là Chromium của Playwright; đây là kiểm độc lập process/profile, không phải chứng nhận Safari/Firefox hay thiết bị vật lý. Login fixture dùng password API thật vì UI sản phẩm hiện có Google OAuth; không giả giao diện email/password, không coi bài này là kiểm production Google OAuth.

## Clear-Local-Storage Verification

Mỗi trải nghiệm được kiểm hai lần ở B: sau restart, rồi sau logout + clear cookie + `Network.clearBrowserCache` + `Storage.clearDataForOrigin(all)` + clear localStorage/sessionStorage/IndexedDB + reload về login + login mới. Không có token reinjection bằng init script trong bài persistence. Dữ liệu kỳ vọng từ file memento chỉ phục vụ assertion, không được đưa vào React/API.

**Kết quả: cả năm dữ liệu permanent còn nguyên, ảnh GET 200 đúng SHA-256, ledger không tăng.** Bản nháp local được phép mất khi clear; không dùng nó làm tiêu chí gallery/result tồn tại.

## Performance

Đo trên máy local với CPU throttling 4x, Vite development. Chỉ số là input/event tới RAF kế tiếp trong browser, không phải đo độ trễ photon/thiết bị vật lý. [Dữ liệu tổng hợp](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/validation/performance-summary.json).

| Trải nghiệm | Samples | Input → frame p95 | Frame p95 | Long tasks | CLS |
|---|---:|---:|---:|---:|---:|
| Typing Solo | 102 | 16.6 ms | 16.8 ms | 0 | 0.000019 |
| Typing Duo | 102 | 16.1 ms | 17.0 ms | 0 | 0.000018 |
| Typing Trio | 102 | 21.4 ms | 24.9 ms | 0 | 0.000018 |
| Computer | 315 | 15.9 ms | 9.3 ms | 1, max 71 ms | 0 |
| Direction | 40 | 17.1 ms | 16.1 ms | 0 | 0 |
| Memory | 53 | 6.8 ms | 9.2 ms | 2, max 159 ms | 0.0665 |
| Drawing stroke | 28 | 4.8 ms | 9.4 ms | 0 | 0 |

Direction lượt đo đầu trộn viewport resize/chụp PNG với gameplay cho p95 20.5/23.3 ms và long tasks. Đã tách queue khỏi clock render và đo riêng đoạn chơi ổn định, để responsive/screenshot ở ngoài đoạn đo. Hai phép đo khác điều kiện nên không quy toàn bộ mức giảm cho memo. Artifact lượt đầu được giữ để minh bạch.

Typing không gọi DB/network/storage mỗi key. Arcade checkpoint khoảng 1 giây và final flush ở finish; local snapshot cũng hoãn. Drawing toBlob/IndexedDB chạy sau stroke/metadata debounce hoặc trước publish, không theo pointermove; upload bất đồng bộ có progress. Drawing đoạn stroke chỉ có một React commit; Typing số commit khoảng 156–162 cho 102 inputs cùng clock/telemetry, không phải toàn bộ scene render cho từng ký tự.

Backend **111 tests PASS, 0 fail**, gồm authority/Unicode/room lifecycle/rewards/ENUM/JSON ordering/intent/reconciliation; sau dọn helper cũ, Drawing/persistence chạy xác nhận **27/27**. Frontend check **89 files, 0 errors**, build PASS. [Backend log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/validation/backend-tests.txt), [build log](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/validation/frontend-build.txt). `git diff --check` sạch.

## Screenshots

| Nội dung | Ảnh thực từ browser |
|---|---|
| Direction current+3 trên mobile | [390 px](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-queue-390.png), [430 px](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-queue-430.png), [768 px](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-queue-768.png) |
| Stumble / đảo chiều / đối thủ vượt | [KHỰNG](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-stumble.png), [opposite](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-opposite.png), [DUO](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-duo-overtake.png), [TRIO](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/direction-trio-overtake.png) |
| Typing native / finish / replay | [620 chars](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/native/typing-deep-window-390.png), [Trio finish](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/typing/typing-TRIO-finish.png), [replay](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/typing/typing-TRIO-replay.png) |
| Computer / Memory | [Computer mobile](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/computer/computer_rush-gameplay-390.png), [Memory 5×5](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/memory/memory_flash-deep-correct-5x5.png) |
| Drawing lỗi / retry thành công | [Storage failure](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/drawing-storage-failure.png), [confirmed remote publish](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/ux/drawing-confirmed-publish.png) |
| Sau restart và clear toàn bộ storage | [Computer](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-computer_rush-storage-cleared.png), [Direction](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-direction_rush-storage-cleared.png), [Memory](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-memory_flash-storage-cleared.png), [Typing](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-typing_battle-storage-cleared.png), [Drawing](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/persistence/read-drawing-storage-cleared.png) |

## Remaining Risks

1. **Còn thiếu bucket production và cấu hình thật.** Cần provider/bucket/credentials trong môi trường backend, public image domain, chạy legacy dry-run/migration rồi nghiệm thu publish/read/delete sau redeploy thật. Local QA S3 chỉ chứng minh code/lifecycle. Không tự tạo tài khoản cloud hoặc chi phí.
2. PNG legacy đã phục hồi ở DB, ba SVG cũ giữ inline. Chưa hoàn tất object migration production; ảnh không được báo là đã lên cloud.
3. Chưa kiểm Safari/Firefox/thiết bị cảm ứng vật lý hay UniKey của OS. Composition ở Chromium, native keyboard/pointer và mô phỏng viewport bàn phím đã kiểm.
4. History/verified records Typing hiện đọc các snapshot DB rồi lọc theo user; ở tập dữ liệu lớn cần read-model/index phù hợp thay vì tăng cache browser. Không làm giả đây là kiểm thử tải production.
5. Canonical S3 URL hiện là public/CDN URL; quyền gallery được kiểm tại API. Nếu cần bytes riêng tư theo từng người xem, phải thêm authenticated delivery hoặc URL đọc sinh lúc request, vẫn giữ key làm canonical. Chưa có bucket production để xác nhận policy delivery đó.
6. Rubric UX là đánh giá nội bộ có bằng chứng browser/performance, không thay thế phản hồi người chơi. Motion dùng token/component của dự án, không thêm thư viện animation.

## Final Gates

Các PASS dưới đây có phạm vi **dev full-stack MySQL + S3 độc lập đã cấu hình**. Gate production và OVERALL không được nâng lên PASS khi chưa có bucket thật.

| Gate | Dev | Production / giới hạn |
|---|---|---|
| TYPING RESULT PERSISTENCE | PASS | Chưa deploy bản sửa |
| TYPING PERSONAL BEST | PASS | DB-backed verified records |
| COMPUTER RESULT PERSISTENCE | PASS | Chưa deploy |
| COMPUTER BXH | PASS | DB-backed |
| DIRECTION RESULT PERSISTENCE | PASS | V3, history giữ V2 |
| DIRECTION QUEUE | PASS | Current +3, 180 ms |
| DIRECTION RAPID INPUT | PASS | Một ô buffer, không drop chuỗi hợp lệ |
| DIRECTION STUMBLE PENALTY | PASS | 450 ms server-enforced |
| DIRECTION MULTIPLAYER RACE FEEL | PASS | Browser DUO/TRIO vượt hạng thực |
| MEMORY RESULT PERSISTENCE | PASS | DB-backed |
| MEMORY BXH | PASS | DB-backed |
| DRAWING DB PERSISTENCE | PASS | Transaction + durable intents |
| DRAWING IMAGE STORAGE | PASS | **FAIL production: chưa có bucket** |
| DRAWING CROSS-BROWSER | PASS | Chromium process/profile độc lập |
| DRAWING BACKEND RESTART SURVIVAL | PASS | Restart cả S3, không chỉ backend |
| DRAWING DELETE LIFECYCLE | PASS | Non-owner, outage, reconcile, idempotency |
| CLEAR LOCAL STORAGE TEST | PASS | Cả năm trải nghiệm |
| LOGOUT/LOGIN TEST | PASS | Login API thật của fixture |
| CROSS-BROWSER TEST | PASS | Không claim cross-engine |
| REWARD IDEMPOTENCY | PASS | Đúng ledger khi có XP, 0 row khi policy 0 XP |
| DATABASE INTEGRITY | PASS | Schema idempotent, result/history không mất |
| 5-EXPERIENCE UX | PASS | Tự chấm dev ≥9.0, không mục <8.5 |
| PERFORMANCE | PASS | Các ngưỡng input/CLS đạt; long tasks ghi rõ |
| REAL FULL-STACK QA | PASS | Browser/frontend/backend/socket/MySQL/S3 thật |
| **OVERALL** | **PASS dev** | **FAIL nghiệm thu production tới khi hoàn tất bucket/migration/deploy** |

Hướng dẫn tái chạy: [QA_REPRODUCTION.md](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-22/QA_REPRODUCTION.md). Artifact `before-ux-v2/` giữ vòng persistence đầu; `validation/source-sha256.json` đối chiếu mã nguồn app đã kiểm. Các lỗi timeout/eligibility trong harness khi chuyển bài QA từ 24 sang 60 giây đã được sửa bằng việc chờ đúng thời lượng và chơi Direction suốt ván, không thay policy thưởng để ép test PASS.
