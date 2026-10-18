# COVERAGE MATRIX — WORK RANK

Audit16–17/10/2026. **PARTIAL** nghĩa là đã thao tác phạm vi nêu, không có nghĩa feature hoàn toàn PASS. **NOT TESTED** kèm lý do hoặc phạm vi còn thiếu. Không có page nào được tuyên bố kiểm hết mọi nút/trạng thái.

Visual: đã lưu ảnh Chromium1440px và390px của 25 route chính và xem contact sheet/các ảnh lỗi. Responsive: đo ở1920/1440/1280/1024/768/430/390; đây là phép đo hình học cộng kiểm ảnh, không chứng minh mọi control ở7 viewport đều đúng. Login trong crawl có session admin nên có redirect; ảnh login anonymous bổ sung riêng.

| Page | Visual | Function | State | API | Responsive | UX | Result |
|---|---|---|---|---|---|---|---|
| `/` (Home) | Ảnh1440/390; kiểm bố cục | Xem nhận diện/vinh danh/gallery, CTA; đối chiếu dữ liệu public | Normal/empty fixture;500 inject | Public APIs đọc; nhiều expectations E2E cũ cần rà |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — không chứng nhận mọi carousel/media|
| `/login` (Login) | Ảnh anonymous bổ sung + form16/10 | Login thực tế, redirect trang đích; chế độ form đã thao tác16/10 | Invalid login;auth/me500;401refresh lượt 16 | Auth login/me/refresh/password/logout |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-003/011/012; NOT TESTED mọi validation register|
| `/dashboard` (Dashboard) | Ảnh1440/390; kiểm bố cục | Tabs/kỳ dữ liệu; sidebar/back; fixture KPI | Empty+populated;500 inject | dashboard/kpi thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — số liệu fixture hiển thị; không đủ mọi kỳ/timezone|
| `/leaderboard` (Leaderboard) | Ảnh1440/390; kiểm bố cục | Tabs/scope/filter; lỗi và retry đã thao tác16/10 | Empty+populated;500 inject | leaderboard/rankings thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — chưa mọi tổ hợp filter/sort/pagination|
| `/youtube` (YouTubeOverview) | Ảnh1440/390; kiểm bố cục | Chuyển tab/filter; đọc dữ liệu kênh fixture | Empty+populated;500 inject | youtube read thật;sync bên ngoài tắt |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|NOT TESTED đồng bộ YouTube mạng thật/key/OAuth|
| `/arena` (Arena) | Ảnh1440/390; kiểm bố cục | Mùa ACTIVE, tabs đội/cá nhân; refresh/error | Empty+populated;500 inject;slow2.5s thử hẹp16/10 | competition API thật;event pending |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-004/016/021; NOT TESTED mọi lifecycle mùa|
| `/grand` (GrandHub) | Ảnh1440/390; kiểm bố cục | Xem Grand đã tạo/link mùa; tabs | Empty+populated;500 inject | grand/season read thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-004/016; NOT TESTED kết toán năm end-to-end|
| `/friends` (Friends) | Ảnh1440/390; kiểm bố cục | Search/liên hệ; mở chat, kiểm draft mất qua route | Empty/search/500 inject | friends/chats/socket thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-014; NOT TESTED đầy đủ gửi/thu hồi/unread/attachments nhiều phiên|
| `/users/:id` (UserDetail) | Ảnh/user35;404user1 lượt 16 | Profile hợp lệ35, profile lỗi999999; alias link | Normal+404 thật;profile500 NOT TESTED lại17/10 | users API thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — quyền riêng tư/award mọi biến thể chưa kiểm|
| `/settings` (Settings) | Ảnh1440/390; kiểm bố cục | Các tab; password đổi rồi trả lại; delete sai password16/10 | Normal;validation fail;500 inject | auth/password/delete;preferences |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-003/012; NOT TESTED xóa tài khoản thành công (tránh mất fixtures đang dùng)|
| `/games` (GameHub) | Ảnh1440/390; kiểm bố cục | Mở các game bằng link/CTA; availability | Normal;500 inject | catalog API thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — chưa mọi ma trận allowlist/role/schedule|
| `/games/2048` (Game2048) | Ảnh1440/390; kiểm bố cục | Mũi tên/start/checkpoint/route/back;A→B;finalize chéo;stats | Normal;500 inject;navigation;shared browser | Tất cả start/checkpoint/submit/active/my-stats thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-001/008/015; NOT TESTED hoàn thành ô2048 tự nhiên/touch vật lý|
| `/games/capital-board` (CapitalBoardGame) | Ảnh1440/390; kiểm bố cục | Sảnh;create thật16/10;rulesmodal;bot/start phòng5 | Empty/error sảnh;room PLAYING;500 inject | Rooms API thật500;room actions thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-007/017; NOT TESTED toàn ván tới thắng/thua, bankruptcy/trading|
| `/games/quiz` (QuizGame) | Ảnh1440/390; kiểm bố cục | Create thật;room2 start/answer/reload16/10; room2 FINISHED DB | Empty lobby;PLAYING/FINISHED;404;500 inject | Quiz HTTP/socket thật;admin seeded3question |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — chưa mọi vòng/nhạc/ảnh/link ngoài và retry đáp án|
| `/games/sam` (SamGame) | Ảnh1440/390; kiểm bố cục | Rules/tab/create;create phòng thất bại thật | Lobby/error/404;500 inject | POST room500 schema MySQL;mock E2E khác |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-006; NOT TESTED gameplay thật do chặn ở tạo phòng|
| `/games/typing` (TypingBattle) | Ảnh1440/390; kiểm bố cục | Practice/tabs;two-user ready/start/progress/reload/timeout16/10;replay17/10 | Lobby/PLAYING/FINISHED;404;500 inject | Typing HTTP/socket;ScoreLedger/Result fixture |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-009/010/016; NOT TESTED mọi mode/team/tournament|
| `/games/drawing` (DrawingGame) | Ảnh1440/390; kiểm bố cục | Stroke/undo/redo/download16/10;route mất nét;publish17/10 | Empty/drawn/publishsuccess;500 inject | Drawing upload/create thật;canvas client |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-020; NOT TESTED quota/ảnh lớn/mobile stylus/export mọi định dạng|
| `/admin/kpi` (AdminKpi) | Ảnh1440/390; kiểm bố cục | Tabs/forms;fixture department/target10/actual5 qua API | Empty+populated;500 inject | KPI CRUD hẹp API thật;UI đọc populated |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-016; NOT TESTED UI import/export và mọi validation/period lock|
| `/admin/privileges` (AdminPrivileges) | Ảnh1440/390; kiểm bố cục | Tạo nhân sự tên tiếng Việt;filter/form/drawer;job-title | Empty/populated;500 inject;user role redirect | User create201 thật;read profile |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-018; NOT TESTED mọi revoke/award/bulk delete|
| `/admin/teams-youtube` (AdminTeamsYouTube) | Ảnh1440/390; kiểm bố cục | Tạo team/kênh/gán thành viên qua API;UI tabs/modal | Empty+populated;500 inject | Team/YouTube API thật;external sync tắt |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-016; NOT TESTED flow sync external/team ownership toàn bộ|
| `/admin/competition/seasons` (AdminSeasons) | Ảnh1440/390; kiểm bố cục | Tạo mùa thật UI;active qua API;tabs/form | Empty+populated;500 inject | Season create/lifecycle hẹp thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-004/016; NOT TESTED đóng/kết toán/reopen/rollback mùa|
| `/admin/competition/rules` (CompetitionAdmin) | Ảnh1440/390; kiểm bố cục | Tạo rule set thật UI;builder tabs/forms | Empty+populated;500 inject | RuleSet create201/read thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-016; NOT TESTED publish/version/rollback/simulation mọi loại rule|
| `/admin/competition/grand` (AdminGrand) | Ảnh1440/390; kiểm bố cục | Tạo Grand thật UI;link mùa/active qua API | Empty+populated;500 inject | Grand create/link read thật |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-004/016; NOT TESTED award/finalize cả năm|
| `/admin/operations` (AdminOperations) | Ảnh1440/390; kiểm bố cục | Tabs/refresh;error injected;health/pending đối chiếu | Normal+partial error nguồn;all500 | Health/logs/events/projections thật và500 inject |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|BUG-004/013/016; NOT TESTED destructive retry/backfill/rebuild toàn dữ liệu|
| `/admin/quiz` (AdminQuiz) | Ảnh1440/390; kiểm bố cục | Tabs/form;set/questions seed API;UI list dữ liệu | Empty+populated;500 inject | Quiz admin APIs;upload suite16/10 |7 viewport đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|PARTIAL — chưa mọi UI CRUD/import media/Unicode boundary|

## Route alias và dynamic route

43 declarations gồm 25 mẫu trang chính ở bảng trên,5 mẫu room/spectate động dưới đây,12 alias và wildcard. Alias không có trang UI riêng. Các chuyển hướng mới17/10 có trong states-navigation.json; tham số query của alias CanonicalRedirect được đối chiếu.

| Route | Kiểm thực tế | Kỳ vọng / ghi chú |
|---|---|---|
| /kpi?x=1 | → /dashboard?x=1 | Giữ query |
| /activity; /tracking; /productivity | → /dashboard | Alias cũ có chủ đích |
| /activity-ranking?tab=members; /activity-leaderboard | → /leaderboard, normalize query | scope=kpi; tab hợp lệ |
| /rankings?tab=teams | → /leaderboard?tab=teams&scope=kpi | Alias BXH |
| /admin/departments | → /admin/kpi | Admin guard ở destination |
| /groups | → /friends | Groups.jsx cũ không mounted |
| /games/guess | → /games/quiz | Alias game cũ |
| /admin/games/quiz | → /admin/quiz | Admin guard ở destination |
| /admin/competition | → /admin/competition/seasons | Landing admin |
| * (không tồn tại) | → / | Fallback có chủ đích; không có404page riêng |
| /games/capital-board/room/:roomId | Phòng5 PLAYING;999999 invalid | Create/addbot/start16/10; đọc lại17/10; toàn ván NOT TESTED |
| /games/quiz/room/:roomId | Phòng2 FINISHED;999999 invalid | Start/answer16/10;DB xác nhận kết thúc; nhạc/ảnh ngoài NOT TESTED |
| /games/sam/room/:roomId |999999 invalid;room thật không tạo được | BLOCKED bởi BUG-006; mock tests không thay real match |
| /games/typing/room/:roomId | Phòng1 kết thúc, room replay;999999 invalid | Reload/timeout regression có chứng cứ; modes còn lại PARTIAL |
| /games/typing/spectate/:roomId |1 và999999 mở URL | Chỉ đọc/redirect hẹp; quyền/real-time spectator đầy đủ NOT TESTED |

## Trạng thái theo phạm vi

| State | Đã làm | Giới hạn / NOT TESTED |
|---|---|---|
| Normal + empty | DB audit ban đầu trống rồi seed fixtures;25 trang mở thật | Không mọi combination hoặc null field trong mọi model |
| Loading | Quan sát khi navigation/lazy/API fetch;ảnh settle sau600–800ms | Không assert mọi spinner,aria-busy hoặc layout shift |
| Slow | Delay2.5s Arena ở16/10;quan sát skeleton | Kết quả settle đầy đủ/timeout mọi page NOT TESTED;không ghi bug chỉ vì skeleton |
|500 | Inject tất cả API trừ auth ở23 route17/10; lỗi Capital/Sâm thật | Profile500 và mọi retry action chưa test lại;500 inject không mô phỏng mọi payload lỗi |
|Partial error|Operations trả từng nguồn null/error;fallback đối chiếu;all500|Không mọi hoán vị của toàn bộ page |
|401|Lượt16 inject lần đầu, refresh đúng1 lần, retry thành công|Log lượt 16 không còn;refresh rotation nhiều tab NOT TESTED đầy đủ |
|403/RBAC|User thường mở admin bị redirect;API permissions/actor probe|Manager role/mọi resource policy/allowlist NOT TESTED toàn diện |
|404|Profile999999 và5 dynamic room không tồn tại|Không mọi ID deleted-during-edit race |
|Offline/reconnect|Typing reload/route recovery,multi-context,mất session500|Network offline vật lý/mọi socket reconnect/backoff/server restart NOT TESTED |
|Rapid/double submit|Suite hiện hữu có anti-double tests;checkpoint/finalization probe|Quiz400vs200 dưới timing còn cần chốt contract;không quy lỗi sản phẩm chưa tái hiện rõ |
|Keyboard/modal|Tab đi nền,ESC đóng;2048 arrows;typing keyboard|Screen reader,contrast toàn site,menu/popover mọi phím NOT TESTED |
|Forms|Tên Việt/tạo user/season/grand/rule;password;delete sai password|Không mọi form với empty/long/space/Unicode/Enter/double/500/retry;không tuyên bố full pass |

## Danh mục chưa kiểm thử và lý do

| Khu vực | Trạng thái | Lý do / cách đóng coverage |
|---|---|---|
|Production deploy/TLS/proxy/recovery|NOT TESTED|Audit chạy local; cần môi trường staging có cấu hình production được phép.|
|YouTube sync thực/API quota/OAuth|NOT TESTED|Không dùng key/tài khoản ngoài; NODE_ENV=test tắt worker mạng thật. Kênh fixture dùng để test mapping/UI.|
|Sâm gameplay thật|NOT TESTED/BLOCKED|POST room500 trên migrated MySQL; sửa BUG-006 rồi test từ create đến kết quả.|
|Competition effects tự động end-to-end|NOT TESTED/BLOCKED|Consumer không khởi động; không tự bật khi ingestion đang cho phép giả actor. Rà backlog sau BUG-002.|
|Mọi button/menu/form/API310 handler|NOT TESTED đầy đủ|Inventory và crawl có controls nhìn thấy; mới thao tác các flow trọng tâm. Cần checklist theo role/payload cho phần chưa nêu.|
|Import Excel/media external/tradingview|NOT TESTED|Chưa có fixture đầy đủ và provider thật; có source/API cần audit tiếp trước phát hành feature.|
|Long-running process restart|NOT TESTED|Chưa restart server giữa trận đang chạy. Timers memory là rủi ro cần test, chưa ghi bug kết luận.|
|Memory leak/soak/CWV/60–120Hz|NOT TESTED|Không có profile dài, thiết bị/tải chuẩn; build size và read API latency không thay thế.|
|Firefox/Safari/mobile vật lý|NOT TESTED|Chỉ Chromium automation viewport; chưa kiểmIME/touch/stylus/backgesture thật.|
|Full WCAG/screen reader/contrast toàn bộ|NOT TESTED|Chỉ kiểm focus/keyboard/ảnh/một contrast rõ; không có chứng nhận accessibility.|
|Embedded terminal/PTY/ChairmanOffice/agenttask|N/A — không có implementation hiện hành|Không suy diễn yêu cầu chung thành feature missing. Không có process terminal để kiểm lifecycle.|
|Groups page/StatsCard legacy|CODE REVIEW ONLY|Không reachable qua AppRoutes; route/groups redirect. Cần quyết định sản phẩm trước dọn source.|

## Bằng chứng và cách chạy lại

- [/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/inventory.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/inventory.json): toàn bộ43 route và các khai báo API được parser tìm thấy.
- [crawl.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/crawl.json):text/buttons/network-error/hình học25 trang.
- [reproduced.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/reproduced.json):API và state/persistence thật, token không ghi ra artifact.
- [states-navigation.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/states-navigation.json):500 theo trang,alias,dynamicroom,RBAC.
- [typing-recovery.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/typing-recovery.json):bài gõ trước/sau reload và kết quả.
- [supplement.json](/Applications/du-an/workrank/workrank-realtime/docs/audit/2026-10-17/evidence/supplement.json):cross-tab,modal,contrast,publish.Drawing; một selector thử textarea sai được ghi script-error, không phải bug sản phẩm.

Chạy các script evidence từ gốc workrank-realtime khi backend đã cấu hình DB audit riêng, frontend5173/backend5001 đang chạy; cung cấp AUDIT_PASSWORD của fixture qua environment. Scripts có ghi/tạo dữ liệu fixture và có bước thử can thiệp chéo phiên; chỉ chạy trên DB audit. Không trỏ vào dữ liệu người dùng thật. Script không tự tạo/migrate DB. Không lưu credential/token vào report.
