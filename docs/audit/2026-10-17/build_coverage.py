from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[3];OUT=Path(__file__).resolve().parent;E=OUT/'evidence'
rows=[
('/', 'Home','Xem nhận diện/vinh danh/gallery, CTA; đối chiếu dữ liệu public','Public APIs đọc; nhiều expectations E2E cũ cần rà','Normal/empty fixture;500 inject','PARTIAL — không chứng nhận mọi carousel/media'),
('/login','Login','Login thực tế, redirect trang đích; chế độ form đã thao tác16/10','Auth login/me/refresh/password/logout','Invalid login;auth/me500;401refresh lượt16','BUG-003/011/012; NOT TESTED mọi validation register'),
('/dashboard','Dashboard','Tabs/kỳ dữ liệu; sidebar/back; fixture KPI','dashboard/kpi thật','Empty+populated;500 inject','PARTIAL — số liệu fixture hiển thị; không đủ mọi kỳ/timezone'),
('/leaderboard','Leaderboard','Tabs/scope/filter; lỗi và retry đã thao tác16/10','leaderboard/rankings thật','Empty+populated;500 inject','PARTIAL — chưa mọi tổ hợp filter/sort/pagination'),
('/youtube','YouTubeOverview','Chuyển tab/filter; đọc dữ liệu kênh fixture','youtube read thật;sync bên ngoài tắt','Empty+populated;500 inject','NOT TESTED đồng bộ YouTube mạng thật/key/OAuth'),
('/arena','Arena','Mùa ACTIVE, tabs đội/cá nhân; refresh/error','competition API thật;event pending','Empty+populated;500 inject;slow2.5s thử hẹp16/10','BUG-004/016/021; NOT TESTED mọi lifecycle mùa'),
('/grand','GrandHub','Xem Grand đã tạo/link mùa; tabs','grand/season read thật','Empty+populated;500 inject','BUG-004/016; NOT TESTED kết toán năm end-to-end'),
('/friends','Friends','Search/liên hệ; mở chat, kiểm draft mất qua route','friends/chats/socket thật','Empty/search/500 inject','BUG-014; NOT TESTED đầy đủ gửi/thu hồi/unread/attachments nhiều phiên'),
('/users/:id','UserDetail','Profile hợp lệ35, profile lỗi999999; alias link','users API thật','Normal+404 thật;profile500 NOT TESTED lại17/10','PARTIAL — quyền riêng tư/award mọi biến thể chưa kiểm'),
('/settings','Settings','Các tab; password đổi rồi trả lại; delete sai password16/10','auth/password/delete;preferences','Normal;validation fail;500 inject','BUG-003/012; NOT TESTED xóa tài khoản thành công (tránh mất fixtures đang dùng)'),
('/games','GameHub','Mở các game bằng link/CTA; availability','catalog API thật','Normal;500 inject','PARTIAL — chưa mọi ma trận allowlist/role/schedule'),
('/games/2048','Game2048','Mũi tên/start/checkpoint/route/back;A→B;finalize chéo;stats','Tất cả start/checkpoint/submit/active/my-stats thật','Normal;500 inject;navigation;shared browser','BUG-001/008/015; NOT TESTED hoàn thành ô2048 tự nhiên/touch vật lý'),
('/games/capital-board','CapitalBoardGame','Sảnh;create thật16/10;rulesmodal;bot/start phòng5','Rooms API thật500;room actions thật','Empty/error sảnh;room PLAYING;500 inject','BUG-007/017; NOT TESTED toàn ván tới thắng/thua, bankruptcy/trading'),
('/games/quiz','QuizGame','Create thật;room2 start/answer/reload16/10;room2 FINISHED DB','Quiz HTTP/socket thật;admin seeded3question','Empty lobby;PLAYING/FINISHED;404;500 inject','PARTIAL — chưa mọi vòng/nhạc/ảnh/link ngoài và retry đáp án'),
('/games/sam','SamGame','Rules/tab/create;create phòng thất bại thật','POST room500 schema MySQL;mock E2E khác','Lobby/error/404;500 inject','BUG-006; NOT TESTED gameplay thật do chặn ở tạo phòng'),
('/games/typing','TypingBattle','Practice/tabs;two-user ready/start/progress/reload/timeout16/10;replay17/10','Typing HTTP/socket;ScoreLedger/Result fixture','Lobby/PLAYING/FINISHED;404;500 inject','BUG-009/010/016; NOT TESTED mọi mode/team/tournament'),
('/games/drawing','DrawingGame','Stroke/undo/redo/download16/10;route mất nét;publish17/10','Drawing upload/create thật;canvas client','Empty/drawn/publishsuccess;500 inject','BUG-020; NOT TESTED quota/ảnh lớn/mobile stylus/export mọi định dạng'),
('/admin/kpi','AdminKpi','Tabs/forms;fixture department/target10/actual5 qua API','KPI CRUD hẹp API thật;UI đọc populated','Empty+populated;500 inject','BUG-016; NOT TESTED UI import/export và mọi validation/period lock'),
('/admin/privileges','AdminPrivileges','Tạo nhân sự tên tiếng Việt;filter/form/drawer;job-title','User create201 thật;read profile','Empty/populated;500 inject;user role redirect','BUG-018; NOT TESTED mọi revoke/award/bulk delete'),
('/admin/teams-youtube','AdminTeamsYouTube','Tạo team/kênh/gán thành viên qua API;UI tabs/modal','Team/YouTube API thật;external sync tắt','Empty+populated;500 inject','BUG-016; NOT TESTED flow sync external/team ownership toàn bộ'),
('/admin/competition/seasons','AdminSeasons','Tạo mùa thật UI;active qua API;tabs/form','Season create/lifecycle hẹp thật','Empty+populated;500 inject','BUG-004/016; NOT TESTED đóng/kết toán/reopen/rollback mùa'),
('/admin/competition/rules','CompetitionAdmin','Tạo rule set thật UI;builder tabs/forms','RuleSet create201/read thật','Empty+populated;500 inject','BUG-016; NOT TESTED publish/version/rollback/simulation mọi loại rule'),
('/admin/competition/grand','AdminGrand','Tạo Grand thật UI;link mùa/active qua API','Grand create/link read thật','Empty+populated;500 inject','BUG-004/016; NOT TESTED award/finalize cả năm'),
('/admin/operations','AdminOperations','Tabs/refresh;error injected;health/pending đối chiếu','Health/logs/events/projections thật và500 inject','Normal+partial error nguồn;all500','BUG-004/013/016; NOT TESTED destructive retry/backfill/rebuild toàn dữ liệu'),
('/admin/quiz','AdminQuiz','Tabs/form;set/questions seed API;UI list dữ liệu','Quiz admin APIs;upload suite16/10','Empty+populated;500 inject','PARTIAL — chưa mọi UI CRUD/import media/Unicode boundary')]
lines=['# COVERAGE MATRIX — WORK RANK','', 'Audit16–17/10/2026. **PARTIAL** nghĩa là đã thao tác phạm vi nêu, không có nghĩa feature hoàn toàn PASS. **NOT TESTED** kèm lý do hoặc phạm vi còn thiếu. Không có page nào được tuyên bố kiểm hết mọi nút/trạng thái.', '',
'Visual: đã lưu ảnh Chromium1440px và390px của25route chính và xem contact sheet/các ảnh lỗi. Responsive: đo ở1920/1440/1280/1024/768/430/390; đây là phép đo hình học cộng kiểm ảnh, không chứng minh mọi control ở7width đều đúng. Login trong crawl có session admin nên có redirect; ảnh login anonymous bổ sung riêng.', '',
'| Page | Visual | Function | State | API | Responsive | UX | Result |','|---|---|---|---|---|---|---|---|']
for route,component,fn,api,state,result in rows:
 visual='Ảnh1440/390; kiểm bố cục'
 if route=='/login':visual='Ảnh anonymous bổ sung + form16/10'
 if route=='/users/:id':visual='Ảnh/user35;404user1 lượt16'
 lines.append(f'| `{route}` ({component}) | {visual} | {fn} | {state} | {api} |7width đo; thao tác mobile PARTIAL|Feedback/empty/error/keyboard PARTIAL|{result}|')
lines+=['', '## Route alias và dynamic route', '',
'43declarations gồm25mẫu trang chính ở bảng trên,5mẫu room/spectate động dưới đây,12alias và wildcard. Alias không có trang UI riêng. Các chuyển hướng mới17/10 có trong states-navigation.json; tham số query của alias CanonicalRedirect được đối chiếu.', '',
'| Route | Kiểm thực tế | Kỳ vọng / ghi chú |','|---|---|---|',
'| /kpi?x=1 | → /dashboard?x=1 | Giữ query |',
'| /activity; /tracking; /productivity | → /dashboard | Alias cũ có chủ đích |',
'| /activity-ranking?tab=members; /activity-leaderboard | → /leaderboard, normalize query | scope=kpi; tab hợp lệ |',
'| /rankings?tab=teams | → /leaderboard?tab=teams&scope=kpi | Alias BXH |',
'| /admin/departments | → /admin/kpi | Admin guard ở destination |',
'| /groups | → /friends | Groups.jsx cũ không mounted |',
'| /games/guess | → /games/quiz | Alias game cũ |',
'| /admin/games/quiz | → /admin/quiz | Admin guard ở destination |',
'| /admin/competition | → /admin/competition/seasons | Landing admin |',
'| * (không tồn tại) | → / | Fallback có chủ đích; không có404page riêng |',
'| /games/capital-board/room/:roomId | Phòng5 PLAYING;999999 invalid | Create/addbot/start16/10; đọc lại17/10; toàn ván NOT TESTED |',
'| /games/quiz/room/:roomId | Phòng2 FINISHED;999999 invalid | Start/answer16/10;DB xác nhận kết thúc; nhạc/ảnh ngoài NOT TESTED |',
'| /games/sam/room/:roomId |999999 invalid;room thật không tạo được | BLOCKED bởi BUG-006; mock tests không thay real match |',
'| /games/typing/room/:roomId | Phòng1 kết thúc, room replay;999999 invalid | Reload/timeout regression có chứng cứ; modes còn lại PARTIAL |',
'| /games/typing/spectate/:roomId |1 và999999 mở URL | Chỉ đọc/redirect hẹp; quyền/real-time spectator đầy đủ NOT TESTED |',
'', '## Trạng thái theo phạm vi', '',
'| State | Đã làm | Giới hạn / NOT TESTED |','|---|---|---|',
'| Normal + empty | DB audit ban đầu trống rồi seed fixtures;25trang mở thật | Không mọi combination hoặc null field trong mọi model |',
'| Loading | Quan sát khi navigation/lazy/API fetch;ảnh settle sau600–800ms | Không assert mọi spinner,aria-busy hoặc layout shift |',
'| Slow | Delay2.5s Arena ở16/10;quan sát skeleton | Kết quả settle đầy đủ/timeout mọi page NOT TESTED;không ghi bug chỉ vì skeleton |',
'|500 | Inject tất cả API trừ auth ở23route17/10; lỗi Capital/Sâm thật | Profile500 và mọi retry action chưa test lại;500inject không mô phỏng mọi payload lỗi |',
'|Partial error|Operations trả từng nguồn null/error;fallback đối chiếu;all500|Không mọi hoán vị của toàn bộ page |',
'|401|Lượt16 inject lần đầu, refresh đúng1 lần, retry thành công|Log lượt16 không còn;refresh rotation nhiều tab NOT TESTED đầy đủ |',
'|403/RBAC|User thường mở admin bị redirect;API permissions/actor probe|Manager role/mọi resource policy/allowlist NOT TESTED toàn diện |',
'|404|Profile999999 và5dynamicroom không tồn tại|Không mọi ID deleted-during-edit race |',
'|Offline/reconnect|Typing reload/route recovery,multi-context,mất session500|Network offline vật lý/mọi socket reconnect/backoff/server restart NOT TESTED |',
'|Rapid/double submit|Suite hiện hữu có anti-double tests;checkpoint/finalization probe|Quiz400vs200 dưới timing còn cần chốt contract;không quy lỗi sản phẩm chưa tái hiện rõ |',
'|Keyboard/modal|Tab đi nền,ESC đóng;2048 arrows;typing keyboard|Screen reader,contrast toàn site,menu/popover mọi phím NOT TESTED |',
'|Forms|Tên Việt/tạo user/season/grand/rule;password;delete sai password|Không mọi form với empty/long/space/Unicode/Enter/double/500/retry;không tuyên bố full pass |',
'', '## Danh mục chưa kiểm thử và lý do', '',
'| Khu vực | Trạng thái | Lý do / cách đóng coverage |','|---|---|---|',
'|Production deploy/TLS/proxy/recovery|NOT TESTED|Audit chạy local; cần môi trường staging có cấu hình production được phép.|',
'|YouTube sync thực/API quota/OAuth|NOT TESTED|Không dùng key/tài khoản ngoài; NODE_ENV=test tắt worker mạng thật. Kênh fixture dùng để test mapping/UI.|',
'|Sâm gameplay thật|NOT TESTED/BLOCKED|POST room500 trên migrated MySQL; sửa BUG-006 rồi test từ create đến kết quả.|',
'|Competition effects tự động end-to-end|NOT TESTED/BLOCKED|Consumer không khởi động; không tự bật khi ingestion đang cho phép giả actor. Rà backlog sau BUG-002.|',
'|Mọi button/menu/form/API310handler|NOT TESTED đầy đủ|Inventory và crawl có controls nhìn thấy; mới thao tác các flow trọng tâm. Cần checklist theo role/payload cho phần chưa nêu.|',
'|Import Excel/media external/tradingview|NOT TESTED|Chưa có fixture đầy đủ và provider thật; có source/API cần audit tiếp trước phát hành feature.|',
'|Long-running process restart|NOT TESTED|Chưa restart server giữa trận đang chạy. Timers memory là rủi ro cần test, chưa ghi bug kết luận.|',
'|Memory leak/soak/CWV/60–120Hz|NOT TESTED|Không có profile dài, thiết bị/tải chuẩn; build size và read API latency không thay thế.|',
'|Firefox/Safari/mobile vật lý|NOT TESTED|Chỉ Chromium automation viewport; chưa kiểmIME/touch/stylus/backgesture thật.|',
'|Full WCAG/screen reader/contrast toàn bộ|NOT TESTED|Chỉ kiểm focus/keyboard/ảnh/một contrast rõ; không có chứng nhận accessibility.|',
'|Embedded terminal/PTY/ChairmanOffice/agenttask|N/A — không có implementation hiện hành|Không suy diễn yêu cầu chung thành feature missing. Không có process terminal để kiểm lifecycle.|',
'|Groups page/StatsCard legacy|CODE REVIEW ONLY|Không reachable qua AppRoutes; route/groups redirect. Cần quyết định sản phẩm trước dọn source.|',
'', '## Bằng chứng và cách chạy lại', '',
f'- [{E/"inventory.json"}]({E/"inventory.json"}): toàn bộ43route và các khai báo API được parser tìm thấy.',
f'- [crawl.json]({E/"crawl.json"}):text/buttons/network-error/hình học25trang.',
f'- [reproduced.json]({E/"reproduced.json"}):API và state/persistence thật, token không ghi ra artifact.',
f'- [states-navigation.json]({E/"states-navigation.json"}):500theo trang,alias,dynamicroom,RBAC.',
f'- [typing-recovery.json]({E/"typing-recovery.json"}):bài gõ trước/sau reload và kết quả.',
f'- [supplement.json]({E/"supplement.json"}):cross-tab,modal,contrast,publish.Drawing; một selector thử textarea sai được ghi script-error, không phải bug sản phẩm.',
'', 'Chạy các script evidence từ gốc workrank-realtime khi backend đã cấu hình DB audit riêng, frontend5173/backend5001 đang chạy; cung cấp AUDIT_PASSWORD của fixture qua environment. Scripts có ghi/tạo dữ liệu fixture và có bước thử can thiệp chéo phiên; chỉ chạy trên DB audit. Không trỏ vào dữ liệu người dùng thật. Script không tự tạo/migrate DB. Không lưu credential/token vào report.', '']
(OUT/'COVERAGE_MATRIX.md').write_text('\n'.join(lines))
# Include all method declarations, including multiline/nonliteral path forms.
p=E/'inventory.json';data=json.loads(p.read_text());calls=[]
for f in sorted((ROOT/'backend/src/routes').glob('*.js')):
 for n,l in enumerate(f.read_text().splitlines(),1):
  if re.search(r'router\.(get|post|put|patch|delete)\(',l):calls.append({'file':str(f.relative_to(ROOT)),'line':n,'declaration':l.strip()})
data['allHttpMethodDeclarations']=calls;data['apiDeclarationCount']=len(calls);p.write_text(json.dumps(data,ensure_ascii=False,indent=2))
print('Coverage pages',len(rows),'HTTP declarations',len(calls))
