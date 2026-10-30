# Private Media — Shared Listening

Ngày thực hiện: 30/10/2026, múi giờ Việt Nam.

Đã triển khai và kiểm chứng chế độ nghe chung trên session Private Media hiện có. Bài hát, timeline, play/pause và hàng chờ thuộc server; volume/mute chỉ thuộc player trên thiết bị. Kết quả: **38/38 backend tests**, **18/18 browser checks**, frontend check/build thành công.

## Architecture

Tiếp tục dùng `PrivateMediaSession`, `PrivateMediaCommand`, grant/owner/device/Telegram models và namespace `/private-media`. Session riêng theo tài khoản giữ nguyên key; lựa chọn “Nghe chung” dùng key hiện có `room:shared`. Không tạo một hệ thống phiên thứ hai.

Web, Telegram và helper đều đi qua `session.service.issueCommand`. Mỗi mutation khóa row session trong transaction, kiểm tra command journal, cập nhật session và command cùng transaction rồi mới broadcast. SQLite fixture dùng cơ chế serialize transaction sẵn có; database mạng dùng row lock. Đọc command dedupe cũng dùng locking read để không nhận snapshot cũ dưới isolation của MySQL.

Migration mới: `backend/src/migrations/20261030100000-private-media-shared-listening.js`. Thêm revision, reference clock, current item identity, thông tin lỗi cuối và quyền queue. Migration được kiểm tra chạy hai lần và giữ dữ liệu session cũ. Trước khi triển khai backend mới lên database đã có dữ liệu, chạy `npm run db:migrate` trong `backend/` bằng cấu hình database của môi trường đó. Lượt QA này chỉ áp dụng migration trên SQLite cô lập; không sửa database làm việc/production.

## Shared vs Local State

| State | Nơi lưu | Đồng bộ |
|---|---|---|
| Session ID, current video, metadata | `PrivateMediaSession` | Tất cả participant có quyền |
| Status, position/reference time, revision | `PrivateMediaSession` | Tất cả participant có quyền |
| Queue, current queue item ID | JSON trong session | Tất cả participant có quyền |
| Volume, muted, preferredVolume | localStorage scope theo user trên thiết bị | Chỉ player của thiết bị đó |

Session snapshot, command journal mới và socket events không chứa volume/mute. Action `SET_VOLUME` bị loại khỏi server command contract. Cột volume cũ được để lại như cột không còn sử dụng nhằm giữ khả năng rollback migration; application model không khai báo cột đó và không đọc/ghi/broadcast giá trị đó.

## Shared Listening

UI giữ lựa chọn “Nghe riêng / Nghe chung”, thêm bài đang phát, số người nghe và hàng chờ. Số participant tính theo user ID, nên refresh hoặc nhiều tab của cùng một tài khoản không làm tăng số người. Người chỉ có ACCESS vẫn được đăng ký player và nghe; họ có volume/mute riêng nhưng không điều khiển play/pause chung.

Giữ kiểu giao diện và chế độ audio kín đáo sẵn có. Nút kích hoạt player được đưa ra ngoài host ẩn để người dùng có thể xử lý autoplay policy thật của trình duyệt. Việc autoplay bị chặn chỉ ảnh hưởng renderer đó, không gửi một PAUSE chung.

## Queue

Queue dùng FIFO theo thứ tự server commit. Mỗi item có UUID, video metadata, người yêu cầu, thời gian và status. Các trạng thái nội bộ gồm `QUEUED`, `PLAYING`, `PLAYED`, `REMOVED`, `FAILED`; UI chỉ hiển thị danh sách đang chờ, không in ID/revision/status kỹ thuật.

`QUEUE_ADD` thêm bài vào cuối. Nếu chưa có bài phát, bài đầu tự bắt đầu. Trong chế độ nghe chung, dán link và action chính trên kết quả tìm kiếm mặc định thêm vào hàng chờ. “Phát ngay” là action riêng, cần CONTROL, giữ lại các bài đang chờ. Người điều khiển có thể xóa, đưa bài lên trước, xóa hàng chờ và Next. Giới hạn 50 bài/lần thêm, tối đa 100 bài chờ; lịch sử nội bộ được thu gọn khi thêm bài mới.

Mỗi add có command ID. Retry cùng command của cùng actor/session trả kết quả duplicate mà không thêm item; dùng lại ID của actor/session khác bị chặn. Test concurrent add kiểm tra không mất bài, không trùng item và thứ tự khớp command journal đã commit.

## Auto Advance

YouTube ENDED gửi `currentQueueItemId`. Backend khóa session và chỉ xử lý khi ID còn khớp lượt phát hiện tại, status đang PLAYING và clock đã gần thời lượng kết thúc. Sau một transition, các ENDED còn lại mang ID cũ bị bỏ qua. Next lấy item QUEUED đầu, đánh dấu trạng thái, cập nhật video/reference/revision trong cùng transaction. Queue hết thì session trở về IDLE, không tự lặp.

Năm ENDED đồng thời đã được kiểm tra: chỉ một transition được chấp nhận. Test cũng có hai item cùng video ID, nên dedupe dựa vào lượt phát chứ không dựa vào tên video.

Lỗi YouTube không phát được được báo qua `private-media:player-error`; server đánh dấu FAILED, chuyển an toàn và phát state mới. UI dùng toast sẵn có: “Không thể phát bài này, đã chuyển sang bài tiếp theo.” Browser QA đã dùng video không tồn tại để xác minh recovery trên cả A/B. Sau khi nhận lỗi, iframe cũ được cách ly và tái tạo trước khi phát bài recovery; các thông báo lỗi muộn tiếp tục mang identity của lượt hỏng, tránh bỏ qua nhầm bài tốt.

## Sync

Server lưu position tại mốc tham chiếu và timestamp server; khi PLAYING, vị trí hiện tại được suy ra từ thời gian đã trôi qua. PLAY/PAUSE/SEEK chốt lại mốc này, tăng revision. Snapshot mang server time và revision; client loại snapshot cũ và tính tiến độ từ thời điểm nhận.

Heartbeat của browser không được ghi lại status hoặc currentTime vào clock chung. Acknowledgement cũng không thể biến buffering/autoplay/local volume thành intent của cả phiên. Browser có thể báo duration cho đúng current item khi server chưa biết thời lượng.

Player kiểm tra drift mỗi 3 giây; chỉ seek khi lệch hơn 2 giây và có khoảng nghỉ giữa các correction. Join/reconnect tải cùng video và vị trí dự kiến, rồi áp dụng volume/mute từ preference cục bộ.

## Local Volume

Hook `usePrivateMediaVolume` lưu key `workrank:private-media:output:v1:<userId>`. Thiết bị/browser profile tách biệt vốn có localStorage riêng. Giá trị gồm volume, muted và preferredVolume; mặc định 70%. Mute giữ mức âm lượng trước đó và unmute khôi phục mức đó.

Thanh “Âm lượng của bạn” và nút nhỏ/to trong cửa sổ nhỏ gọi cùng local setter. Các setter chỉ gọi `setVolume`/`mute`/`unMute` của iframe trên tab này. Không có REST command hoặc socket volume event. Không ghi thay đổi âm lượng vào audit log chung.

Hard grep trên service/socket/controller production và player/page không có `SET_VOLUME`, `session.volume`, `state.volume` hoặc `session:volume`. Test còn gửi trường volume/muted vào command để xác minh chúng không lọt vào journal/snapshot.

## Telegram Queue

Các lệnh `/search`, `/queue`, `/now`, `/next`, `/pause`, `/play` dùng session chung. Kết quả có “Thêm vào hàng chờ” và “Phát ngay”; callback dùng Telegram callback identity làm command ID để chống retry. `/queue` trả bài đang phát và danh sách FIFO ngắn gọn. `/volume` không còn là shared command.

Telegram binding và grant tiếp tục được kiểm tra. TELEGRAM cho phép dùng bề mặt bot; QUEUE cho phép thêm bài, CONTROL mới cho phép pause/play/next. Test service đã chạy callback add thật qua command/session, retry và permission denial. Không gửi tin nhắn đến tài khoản Telegram thật trong QA; transport/live bot cần credential của môi trường triển khai.

## Global Hotkey

Helper Swift hiện có tiếp tục gửi F8 thành `TOGGLE_PLAY_PAUSE` qua `/device/commands`. Khi tài khoản đang nghe trong shared room, HTTP route chọn session chung; nếu không thì dùng session riêng hiện có. Caller cũng có thể chỉ rõ room qua header đã có.

Device token phải còn hợp lệ và tài khoản phải có HOTKEY cùng CONTROL. Test đã pair token và xác minh lệnh đổi trạng thái của session shared. Phím F8 vật lý trên macOS chưa được bấm trong QA tự động; helper Swift không bị thay đổi. Không có volume toàn phòng qua hotkey.

## Permissions

Bootstrap owner vẫn là tài khoản được resolve từ `tienddph50842@gmail.com` theo owner registry hiện có. Không thêm bypass dựa trên admin/super admin/role. Chỉ owner quản lý grant.

| Quyền | Hành vi |
|---|---|
| VIEW / ACCESS | Đọc state, subscribe, tham gia nghe |
| QUEUE | Thêm bài; CONTROL cũng có quyền này để tương thích grant cũ |
| CONTROL | Play/pause/seek/next/remove/reorder/clear/Phát ngay |
| TELEGRAM | Dùng bot theo quyền hành động tương ứng |
| HOTKEY + CONTROL | Dùng token helper điều khiển playback |
| MANAGE_ACCESS | Chỉ owner |

REST command endpoint nhận user có VIEW rồi service kiểm tra quyền theo action; việc này cho phép queue-only user thêm bài và vẫn chặn pause/next. Namespace kiểm tra entitlement khi handshake và mỗi event subscribe/player/progress/ended/ack/command. Grant revoke hoặc sửa quyền evict các socket đang mở; revoke tiếp tục hủy device và Telegram binding. Test admin không grant bị chặn cả REST/socket, viewer có quyền nghe, queue-only user không pause, và viewer bị thu hồi lập tức mất socket lẫn quyền đọc.

Audit có JOIN/LEAVE_LISTENING_SESSION, QUEUE_ADD/REMOVE/REORDER/CLEAR, AUTO_ADVANCE, NEXT, PLAY, PAUSE cùng các sự kiện hiện có.

## Browser A/B Evidence

Script: `frontend/scripts/private-media-listening-qa.mjs`. Hai Chromium context riêng, hai user riêng, backend HTTP/socket thật trên fixture SQLite, iframe/media YouTube thật. Không mock player, không fake ENDED. Để rút ngắn thời gian, QA tua tới gần cuối bài rồi chờ ENDED tự nhiên.

Kịch bản đã hoàn thành:

1. A phát Big Buck Bunny; B join tại khoảng 01:30. Mẫu đo cuối: A 94.333261 giây, B 94.415493 giây, chênh khoảng 0,082 giây trong môi trường QA.
2. A volume 25%, B 100%; A chuyển 40% thì B vẫn 100%.
3. B mute; media A vẫn PLAYING, unmuted. Unmute B trả lại 100%.
4. Pause controller làm cả hai media pause; Play làm cả hai tiếp tục.
5. B thêm Me at the zoo, A thêm YouTube IFrame API demo; current A không bị cắt, queue là B → C.
6. Refresh A giữ volume 40%; refresh B giữ mute/volume 100%; cùng video/timeline/queue được khôi phục.
7. ENDED thật chuyển A → B → C; ở từng bước, cả hai media có readyState 4, currentTime đang tăng và không paused.
8. Dán link từ UI của B thêm vào hàng chờ, không ngắt C; nút Next từ UI chuyển cả hai sang bài đó.
9. Video không tồn tại được skip một lần sang bài recovery và hiển thị toast.
10. Thu hồi quyền B khiến browser rời player, trở về dashboard và sidebar ẩn mục Private Media ngay; cache entitlement cũ không được khôi phục bởi request đến muộn.
11. Viewport 390×844 không tràn ngang; thứ tự nội dung là bài hiện tại → controls → volume riêng → queue. Số participant sau refresh vẫn là hai.

Bằng chứng:

- [browser-results.json](private-media-listening/browser-results.json)
- [Desktop A](private-media-listening/desktop-a.png), [Desktop B](private-media-listening/desktop-b.png)
- [Mobile](private-media-listening/mobile.png), [Mobile controls](private-media-listening/mobile-controls.png)

## Performance

Không stream currentTime mỗi frame. Player gửi heartbeat mỗi 3 giây; socket giới hạn tiếp nhận progress theo khoảng thời gian và chỉ trả snapshot về renderer đó. Queue/commands dùng event khi có thay đổi. Clock trên UI cập nhật 1 Hz; drift correction dùng khoảng cách 2 giây, không seek liên tục. Timer/listener được cleanup; queue dùng UUID key và motion component/token sẵn có.

## Tests

Backend:

```sh
node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 test/private_media_authz.test.js test/private_media_shared_listening.test.js
```

**38 pass, 0 fail.** Gồm baseline authz, private session isolation, shared FIFO, reference clock, concurrent add, retries, năm ENDED đồng thời, same-video repeat, shared controls, unavailable skip, WebSocket authorization/revoke, Telegram callback, hotkey token và migration idempotency/data preservation.

Browser: **18 pass, 0 fail, không page error**. Frontend `npm run check`: 104 files, 0 errors. `npm run build`: thành công. `git diff --check` và syntax check các file JS/script mục tiêu: thành công. Script QA cũ cũng được cập nhật để đọc volume từ preference địa phương thay vì server session.

## Remaining Limits

- Cần chạy migration mới trong quy trình deploy trước khi backend mới phục vụ database hiện có; không deploy hoặc thay database production trong lượt này.
- Real YouTube/browser QA chạy trên máy này, không chứng minh đồng bộ hoàn hảo ở mọi mạng, tab nền, quảng cáo hoặc chính sách autoplay. Khi cần gesture, từng người có nút kích hoạt player riêng.
- Live Telegram delivery và F8 vật lý chưa được thao tác; command/authorization/session paths đã có integration test. Search bằng API cần `YOUTUBE_API_KEY`; dán link đã được kiểm chứng không cần key.
- Khi không có browser renderer trực tuyến, không có YouTube ENDED để đẩy queue; session giữ clock/state và renderer khi quay lại tiếp tục reconcile. Chưa bổ sung worker phát media nền.
- Presence dùng bộ nhớ của process hiện có. Muốn chạy nhiều backend process cần Socket.IO adapter/presence chia sẻ tương ứng; row lock vẫn bảo vệ queue trên database mạng, nhưng lượt QA concurrency dùng SQLite cô lập.

## Final Gates

| Gate | Kết quả | Bằng chứng |
|---|---|---|
| SHARED_LISTENING_MODE | PASS | Reuse `room:shared`, UI opt-in |
| TWO_USER_SHARED_VIDEO | PASS | Hai context, media YouTube thật |
| JOIN_MID_TRACK_SYNC | PASS | Join tại 01:30, mẫu lệch khoảng 0,082 giây |
| SHARED_PLAY_PAUSE | PASS | Hai HTML media cùng pause/resume |
| SHARED_NEXT | PASS | Next từ UI, cùng bài kế tiếp |
| SHARED_QUEUE | PASS | Queue state và UI A/B |
| QUEUE_FIFO | PASS | A → B → C thực tế và backend journal |
| QUEUE_AUTO_ADVANCE | PASS | YouTube ENDED tự nhiên |
| QUEUE_CONCURRENCY | PASS | Concurrent add không mất bài |
| QUEUE_IDEMPOTENCY | PASS | Cùng command ID không thêm lặp |
| DOUBLE_ENDED_PROTECTION | PASS | Năm report, một transition |
| LOCAL_VOLUME_A_INDEPENDENT | PASS | A25 → A40, B100 |
| LOCAL_VOLUME_B_INDEPENDENT | PASS | B100 độc lập A |
| LOCAL_MUTE_INDEPENDENT | PASS | B mute, A vẫn phát/unmuted |
| LOCAL_VOLUME_PERSISTENCE | PASS | Reload A40, B100/muted |
| NO_SHARED_VOLUME_STATE | PASS | Model/contract/journal/socket đã tách output |
| RECONNECT_SYNC | PASS | Refresh hai context, restore timeline/queue/local output |
| UNAVAILABLE_VIDEO_SKIP | PASS | YouTube lỗi thật → recovery + toast |
| TELEGRAM_QUEUE_CONTROL | PASS | Service/callback integration; live transport chưa gửi |
| HOTKEY_SHARED_PLAY_PAUSE | PASS | Device token HTTP integration; chưa bấm F8 vật lý |
| PRIVATE_MEDIA_AUTHZ | PASS | Baseline và queue/control split |
| ADMIN_STILL_DENIED_BY_DEFAULT | PASS | REST/socket denial, không role bypass |
| WEBSOCKET_AUTHZ | PASS | Authorized listener, unauthorized admin, revoke eviction |
| MOBILE | PASS | 390×844, no overflow, ảnh controls |
| FRONTEND_CHECK | PASS | 104 files, 0 errors |
| FRONTEND_BUILD | PASS | Vite build thành công |
| OVERALL | PASS | Implementation và acceptance QA hoàn tất; giới hạn deploy/transport nêu trên |
