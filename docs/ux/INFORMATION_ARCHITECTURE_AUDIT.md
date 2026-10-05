# Rà Soát Kiến Trúc Thông Tin WorkRank

Ngày rà soát: 2026-10-05. Phạm vi: route React, layout/sidebar, trang và component đang được mount, luồng điều hướng, API Express, controller/service/model liên quan, quyền truy cập và các tài liệu UX hiện có.

Báo cáo phân biệt ba trạng thái: **đã xử lý trong frontend**, **còn tồn tại**, và **đề xuất cần thay đổi hợp đồng dữ liệu/backend**. Những file đã thay đổi trước lượt rà soát này được giữ nguyên; việc hợp nhất giao diện không bao gồm migration, xóa route API hay thay đổi cách trao điểm.

## 1. Kết Luận Kiến Trúc

WorkRank cần một nơi chính cho mỗi tác vụ, nhưng không cần một trang cho tất cả nghiệp vụ. BXH đầy đủ thuộc `/leaderboard`; số liệu và phân tích YouTube thuộc `/youtube`; tạo/sửa đội, kết nối/gán/đồng bộ kênh thuộc `/admin/teams-youtube`; hồ sơ để xem thuộc `/users/:id`; cài đặt bản thân thuộc `/settings`; nhân sự và trao danh hiệu thuộc `/admin/privileges`.

Dashboard, trang mùa giải, giải năm và trang công khai có thể dùng preview. Preview phải giới hạn số hàng, giữ ngữ cảnh và có CTA tới trang chính với đúng bộ lọc. Việc sidebar, widget và thông báo cùng dẫn tới một trang là nhiều entry point hợp lệ; việc chúng render lại toàn bộ tìm kiếm, bảng hoặc form quản trị mới là trùng chức năng.

Các rủi ro lớn nhất còn nằm ở hợp đồng backend: `all-time` đang lấy điểm mùa hiện tại; API legacy theo ngày/tuần/tháng không thực sự lọc thời gian; self-delete cho phép bỏ mật khẩu; dữ liệu KPI và một số event mutation chưa có ranh giới quyền đủ rõ. Hợp nhất menu không khắc phục các vấn đề đó.

## 2. Nguồn Kiểm Chứng

| Lớp | Nguồn đã đối chiếu | Điều đã kiểm tra |
|---|---|---|
| Hướng dẫn | `AGENTS.md`, `.agents/skills/smooth-motion/SKILL.md` | Tiếng Việt, token chuyển động, component có sẵn, giữ cache, kiểm tra frontend |
| Route và quyền UI | `frontend/src/App.jsx`, `frontend/src/context/AuthContext.jsx` | Route thực sự mount; `ProtectedRoute`; `AdminRoute`; admin là `role === 'admin'`; redirect |
| Điều hướng | `frontend/src/config/navigation.js`, `frontend/src/config/ranking.js`, `frontend/src/components/Sidebar.jsx`, `Layout.jsx`, `ProductTour.jsx`, `FriendsDock.jsx` | Menu chính, header, profile, thông báo, drawer, active state, shortcut và URL params |
| Trang | Các module trong `frontend/src/pages/` | Render thực tế, API được gọi, state/filter, mutation; không suy luận chỉ từ tên file |
| API client | `frontend/src/services/api.js`, `frontend/src/services/cache.js` | URL thực, shape dữ liệu, alias, cache/invalidation |
| API server | `backend/src/routes/index.js`, `ranking.routes.js`, `leaderboard.routes.js`, `competition.routes.js`, `youtube.routes.js`, `kpi.routes.js`, `auth.routes.js`, `users.routes.js`, `groups.routes.js`, các route game | Mount thực, role guard và endpoint trùng nghiệp vụ |
| Tính toán | `ranking/ranking.service.js`, `dashboard.service.js`, `competition/season.service.js`, `competitionDashboard.service.js`, `productionKpiCalculator.service.js`, `kpi.service.js`, `youtubeAggregation.service.js`, `group.service.js`, `userDeletion.service.js` | Điểm, kỳ dữ liệu, summary so với listing, effect mutation và scope |
| Tài liệu | `README.md`, `RANKING_UX_UI_AUDIT.md`, `ADMIN_PANEL_AUDIT.md`, `PROFILE_UX_UI_AUDIT.md`, các báo cáo YouTube và removal tracking | Ý định sản phẩm so với code đang chạy; README đã cập nhật sản phẩm/route/test và removal Desktop Tracker |
| Test đã đọc | Các test ranking, competition, YouTube permissions, KPI, production KPI, account deletion | Phạm vi assertions và khoảng trống; đọc test không đồng nghĩa đã chạy toàn bộ suite |

Các bảng bên dưới mô tả trạng thái code sau cleanup frontend tại thời điểm viết báo cáo. Phần phát hiện nêu rõ hành vi trước cleanup khi cần giải thích lý do thay đổi.

## 3. Bản Đồ Route Và Page

### 3.1. Trang đang mount

`App.jsx` là nguồn route frontend. Có 23 module page đang được mount, thêm 3 mẫu URL phòng game dùng chung module. Modal tạo/sửa nằm trong trang quản trị là trạng thái của trang đó, không được đếm thành page mới.

| Route/Page | Mục đích | Người dùng | Chức năng chính | Chức năng phụ | Nơi khác cũng có chức năng này | Vấn đề |
|---|---|---|---|---|---|---|
| `/` → `Home` | Static / Overview công khai | Công khai, người đã đăng nhập | Spotlight đội vô địch, MVP và archive năm | Login, profile, Dashboard, Arena, YouTube, game, BXH | `PublicRecognition` ở Login; danh hiệu ở profile | Preview công khai hợp lệ; cấu hình và archive phải ở admin mùa giải |
| `/login` → `Login` | Authentication | Công khai | Đăng nhập và đăng ký trong một form chuyển chế độ | Chọn đội khi đăng ký, spotlight | Auth API; Home có spotlight | Hai chế độ dùng một page là hợp lý; giữ input khi chuyển |
| `/dashboard` → `Dashboard` | Overview / Dashboard | Người đăng nhập | KPI bản thân, vị thế cá nhân/đội, tổng quan công việc | YouTube summary, vinh danh, preview online, CTA | BXH, YouTube, Friends, profile | Đã bỏ full analytics/kênh và bộ lọc thời gian không điều khiển dữ liệu; vẫn cần tránh mở rộng thành trang quản trị |
| `/leaderboard` → `Leaderboard` | Ranking / Listing | Người đăng nhập | BXH KPI, đội, thành viên, YouTube, Hall of Fame | Kỳ mùa/năm/hiện tại, kỳ KPI, search, pagination, drilldown đội, profile | Arena, Grand, Dashboard, YouTube trước cleanup | Canonical full listing; nhãn “Điểm hiện tại” phù hợp source hiện tại nhưng API `all-time` còn sai semantics |
| `/youtube` → `YouTubeOverview` | Report / Overview / Detail | Người đăng nhập; admin so sánh tất cả đội | Tổng quan YouTube, lịch sử 30 ngày, kênh của đội, chi tiết đội | Top 5 preview, freshness, refresh, admin compare | Dashboard summary; BXH YouTube; admin kênh | Đã bỏ full BXH và quản lý kênh; chart chuyển về analytics owner; team analytics phải giữ scope backend |
| `/arena` → `Arena` | Overview / Detail mùa hiện tại | Người đăng nhập | Mùa đang hoạt động, luật, thử thách, tiến độ | Top 5 và hàng của mình, danh hiệu, CTA BXH đúng mùa | `/leaderboard?period=season` | Đã giới hạn preview và bỏ BXH YouTube chung; chưa có page detail lịch sử mùa riêng |
| `/grand` → `GrandHub` | Overview / Report giải năm | Người đăng nhập | Grand Points, timeline mùa, hành trình đội, milestones | Top 5 và hàng của mình, CTA BXH đúng năm/mùa trên timeline | `/leaderboard?period=grand` | GP khác XP mùa; không nên gộp mất ngữ cảnh. Timeline đã dẫn BXH đúng seasonId; chưa có page detail lịch sử mùa riêng |
| `/friends` → `Friends` | Listing / Detail danh bạ và đội | Người đăng nhập; admin có shortcut quản trị | Danh bạ nhân viên, đội của tôi, danh sách đội | Xem profile, gia nhập bằng mã, rời đội, CTA admin/BXH | FriendsDock; admin đội và nhân sự | Đã bỏ full BXH/admin forms. Tên URL Friends vẫn không biểu đạt đầy đủ danh bạ/đội |
| `/users/:id` → `UserDetail` | Profile / Detail | Người đăng nhập; owner/admin sửa gallery | Hồ sơ, thành tích, history, contribution | Like, gallery, lightbox, CTA Settings/HR/YouTube/BXH | Settings trước cleanup; admin nhân sự | Đã bỏ form sửa profile/nhân sự đầy đủ; gallery ở ngữ cảnh profile là hợp lý |
| `/settings` → `Settings` | Settings / Edit bản thân | Người đăng nhập; admin có trạng thái game | Hồ sơ bản thân, email/password, notifications/UI/data preferences, self-delete | Danh hiệu của tôi, CTA admin, quản lý catalog game hiện tại | UserDetail, AdminPrivileges trước cleanup; GameHub shortcut | Đã bỏ full HR/award forms; `?tab=profile\|games` tới đúng section; quản lý game toàn hệ thống còn đặt sai ngữ cảnh |
| `/games` → `GameHub` | Listing / Điều hướng game | Người đăng nhập | Catalog AVAILABLE/COMING_SOON | Mở từng game, admin shortcut trạng thái game | Sidebar có từng game | Catalog và shortcut trực tiếp hợp lệ; không cần một game lobby thứ hai |
| `/games/capital-board` → `CapitalBoardGame` | Other / Lobby / Gameplay | Người đăng nhập | Phòng chơi Cờ Tỷ Phú, trận chơi | Luật, lịch sử, kết quả, BXH game | Component `GameLeaderboard`, `GameHistory` | BXH game có thước đo riêng; không trộn với điểm thi đua công việc |
| `/games/capital-board/room/:roomId` | Other / Detail trận chơi | Người đăng nhập theo quyền phòng | Cùng game, deep-link phòng | Rejoin/socket state, kết quả | URL lobby của cùng module | Cùng module khác state phòng, không phải duplicate nghiệp vụ |
| `/games/2048` → `Game2048` | Other / Gameplay / Ranking game | Người đăng nhập | Ván 2048, nộp kết quả | Best score, BXH 2048, luật | `/api/games/2048/leaderboard` | Điểm ghép số khác XP/GP; giữ theo game |
| `/games/quiz` → `QuizGame` | Other / Lobby / Gameplay | Người đăng nhập | Quiz hình/nhạc theo phòng | Countdown, live standings, kết quả/BXH game | Quiz component và AdminQuiz content | Live standings là trạng thái trận; không dời sang BXH công việc |
| `/games/quiz/room/:roomId` | Other / Detail trận chơi | Người đăng nhập theo quyền phòng | Cùng QuizGame, phòng cụ thể | Rejoin và kết quả | URL lobby cùng module | Route state khác, giữ deep-link |
| `/games/sam` → `SamGame` | Other / Lobby / Gameplay | Người đăng nhập | Sâm Lốc theo phòng | Luật, bot, lịch sử, BXH game | API và admin bot debug | Nghiệp vụ game riêng; việc kiểm chứng luật/engine không thuộc cleanup IA |
| `/games/sam/room/:roomId` | Other / Detail trận chơi | Người đăng nhập theo quyền phòng | Cùng SamGame, phòng cụ thể | Socket/rejoin | URL lobby cùng module | Giữ URL phòng, không gộp về catalog |
| `/admin/kpi` → `AdminKpi` | Management / Create / Edit / Report | Admin UI; một số API calculate cho manager | Phòng ban, định nghĩa, kỳ, ghi kết quả, lịch sử KPI | `ProductionKpiPanel` import/version/activate | Dashboard KPI; BXH KPI; production engine | KPI định nghĩa/kết quả và Production KPI khác nghiệp vụ, cần tab/nhãn rõ |
| `/admin/quiz` → `AdminQuiz` | Management / Create / Edit | Admin | Câu hỏi, media, bộ câu hỏi Quiz | Duplicate, reorder, import/export/share | QuizGame đọc nội dung | Quản trị nội dung khác gameplay, không gộp |
| `/admin/privileges` → `AdminPrivileges` | Management / Listing / Create / Edit | Admin | Nhân sự, role/status/team/job profile, phone/bio/avatar, Verified/Dev | Trao MVP/champion, xóa nhân sự, profile CTA | Friends/Settings/UserDetail trước cleanup; admin roster | Canonical HR/đặc quyền; `userId` fetch đúng target ngoài page list, editor Portal; giữ đầy đủ profile/contact fields, đóng xóa query |
| `/admin/teams-youtube` → `AdminTeamsYouTube` | Management / Listing / Create / Edit | Admin | Team CRUD/roster; channel CRUD/link/unlink/sync | Chuyển trưởng nhóm, CTA HR theo nhân viên, health context | Friends team preview; YouTube trước cleanup; AdminPrivileges | Đã có `?tab=teams\|channels`, bỏ job/award duplicate; field team còn chưa lưu backend |
| `/admin/competition/seasons` → `AdminSeasons` | Management / Create / Edit / Report | Admin | Mùa giải, trạng thái, tham gia đội, thử thách | MVP Cup, spotlight, archive, shortcut rules | CompetitionAdmin trước cleanup; Home preview | Canonical mùa giải và public spotlight/archive; award mùa khác award thủ công nhân sự |
| `/admin/competition/rules` → `CompetitionAdmin` | Management / Report | Admin | Rule sets mặc định, draft/validate/publish, simulator, version diff | Analytics, states, score inspector; shortcut Operations | AdminOperations trước cleanup | Đã bỏ full events/retry/projections/rebuild/live event test; diagnostic đọc theo context vẫn giữ |
| `/admin/competition/grand` → `AdminGrand` | Management / Create / Edit | Admin | Giải năm, liên kết mùa, settle/reconcile GP | Status transitions, xem mùa | GrandHub report | Hành động kết toán khác xem giải; giữ quản trị riêng |
| `/admin/operations` → `AdminOperations` | Management / Report | Admin | Health, audit, event queue, event trace, consistency/rebuild projections | Retry có lý do, detail audit/trace; URL tab | CompetitionAdmin trước cleanup; admin YouTube health | Đã là canonical thao tác retry/rebuild và truy vết sự kiện; trace mở bằng Portal, dùng eventId thật |

`Groups.jsx` còn trong source nhưng không được import/mount bởi `App.jsx`; `/groups` hiện redirect về `/friends`. Đây là module dormant, không phải một trang đang chạy thứ hai. Không xóa module trong đợt này vì việc xóa cần kiểm tra phụ thuộc và phạm vi riêng.

### Phân loại tất cả vai trò page

| Loại page | Route hoặc state tương ứng | Đánh giá vai trò |
|---|---|---|
| Overview / Dashboard | `/dashboard`, `/arena`, `/grand`, overview tab `/youtube`, public `/` | Summary theo domain; Arena/Grand có detail context riêng, không cần biến thành full listing |
| Listing / Danh sách | `/friends`, `/games`, tabs danh sách trên các page admin | Listing có search/filter theo entity; `/games` chủ yếu để điều hướng |
| Detail / Chi tiết | `/users/:id`, YouTube team detail, room game, season/grand context, rule/version/audit dialogs | Giữ entity và quyền của nguồn; modal detail là state, không một page copy mới |
| Create / Tạo mới | Modal/form tại AdminPrivileges, AdminTeamsYouTube, AdminSeasons, AdminGrand, AdminKpi, AdminQuiz, CompetitionAdmin; room creation ở game | Không có route create riêng hiện tại; giữ form ở owner page với validation chung |
| Edit / Chỉnh sửa | Settings self-edit; admin editor tại owner page | Trước có copy nhiều editor; đã bỏ full self/HR form khỏi profile/Friends/Settings admin block |
| Management / Quản trị | Tất cả `/admin/*` canonical; admin game status hiện trong Settings | Một nhóm role đúng; game status trong Settings là misplaced management còn cần chuyển |
| Report / Báo cáo | YouTube, Grand, KPI history, admin analytics/audit/operations | Báo cáo read khác tác vụ mutation; Operations nhận retry/rebuild có quyền admin |
| Ranking / BXH | `/leaderboard`; standings riêng từng game | Preview mùa/năm không được trở thành full ranking thứ hai; game scoring khác công việc |
| Profile / Hồ sơ | `/users/:id`; Settings chỉ section edit và danh hiệu bản thân | Read profile và edit account là hai trách nhiệm, không gộp mù |
| Settings / Cài đặt | `/settings` | Self account/preferences; có deep-link section; admin mutation nên đi owner page |
| Authentication | `/login` với login/register modes | Một form chuyển chế độ, dùng chung fields; auth API bảo vệ account |
| Static / Thông tin | `/` có public recognition và điều hướng | Không có các route static About/Contact riêng trong router hiện tại |
| Other | Game lobby, gameplay, room state, live result/rules; global friend/chat dock | Domain/lifecycle riêng, không gọi duplicate chỉ vì có table/tab |

### 3.2. Alias và route đã nghỉ

| Route cũ | Đích hiện tại | Cách giữ tương thích | Ghi chú |
|---|---|---|---|
| `/kpi` | `/dashboard` | `CanonicalRedirect`, giữ search/hash/state | KPI cá nhân là section của Tổng quan; sidebar chỉ còn một mục |
| `/rankings` | `/leaderboard` | Chuẩn hóa query rồi redirect `replace` | Frontend canonical là `/leaderboard`; API unified vẫn là `/api/rankings` |
| `/activity-ranking`, `/activity-leaderboard` | `/leaderboard` | Chuẩn hóa query rồi redirect `replace` | Không dựng lại activity leaderboard đã nghỉ |
| `/activity`, `/tracking`, `/productivity` | `/dashboard` | `Navigate replace` | Tracking/Pomodoro đã được loại theo tài liệu cleanup; không hồi sinh nghiệp vụ |
| `/admin/departments` | `/admin/kpi` | `Navigate replace` | Phòng ban là tab trong quản trị KPI |
| `/groups` | `/friends` | `Navigate replace` | Member không cần page đội thứ hai |
| `/games/guess` | `/games/quiz` | `Navigate replace` | Tên chuẩn Quiz; giữ bookmark cũ |
| `/admin/games/quiz` | `/admin/quiz` | `Navigate replace` | Giữ một trang quản trị nội dung quiz |
| `/admin/competition` | `/admin/competition/seasons` | `Navigate replace` | Link quản trị tổng cũ về mùa giải; Rule Builder vẫn có route riêng |
| `/youtube?tab=channel_leaderboard` | `/leaderboard?scope=youtube&view=channels&metric=…` | `Navigate replace`; giữ metric và bộ lọc đội bằng `channelTeam` | Chấp nhận `sortBy` cũ; `unassigned` không bị mất |
| `/youtube?tab=team_leaderboard` | `/leaderboard?scope=youtube&view=teams&metric=…` | `Navigate replace` | Full listing đội chỉ ở BXH |
| `/youtube?tab=admin` | `/admin/teams-youtube` cho admin | Redirect; route đích vẫn có AdminRoute | Member không được nâng quyền bởi query |
| `/admin/competition/rules?tab=integration` | `/admin/operations?tab=events` | Redirect `replace` trong module rules | Legacy bookmark tới canonical event queue |
| `/admin/competition/rules?tab=projections` | `/admin/operations?tab=projections` | Redirect `replace` trong module rules | Legacy bookmark tới consistency/rebuild |
| `*` | `/` | Fallback hiện tại | Đây là UX fallback, không là trang nghiệp vụ; nên cân nhắc 404 rõ ràng ở đợt riêng |

Các alias không giữ query bằng `CanonicalRedirect` cần test bookmark chứa query trước khi loại bỏ. Chỉ xóa alias sau khi đã đo usage; không lấy việc menu không còn link làm bằng chứng URL không còn người dùng.

## 4. Quyền Sở Hữu Chức Năng

| Chức năng | Các nơi hiện đang hoặc trước cleanup xuất hiện | Nơi chính nên giữ | Nơi cần loại bỏ/rút gọn | Cách chuyển hướng | Mức độ ưu tiên |
|---|---|---|---|---|---|
| BXH đầy đủ KPI/thi đua/YouTube/vinh danh | Leaderboard, Friends, Arena, Grand, YouTube, Dashboard | `/leaderboard` với tab/filter | Friends bỏ full BXH; Arena/Grand chỉ Top 5 + own; YouTube Top 5; Dashboard summary | Link canonical có `scope`, `period`, IDs, `view`, `metric` | High, frontend đã xử lý |
| KPI bản thân | Dashboard, menu KPI và Tổng quan | `/dashboard` | Bỏ mục menu KPI riêng | `/kpi` redirect Dashboard | Medium, đã xử lý |
| Phân tích YouTube | Dashboard charts/drilldown, YouTube, Arena/Grand generic tab | `/youtube` | Dashboard giữ 3/4 số summary; Arena/Grand giữ shortcut | `/youtube?tab=team_detail&teamId=…` | High, đã xử lý |
| Quản lý kênh YouTube | YouTube admin tab, AdminTeamsYouTube | `/admin/teams-youtube?tab=channels` | Bỏ full admin tab trên YouTube | Alias query admin + CTA Quản lý kênh | High, đã xử lý |
| Danh bạ và thành viên đội | Friends, Groups dormant, admin roster, online Dashboard | `/friends` | Dashboard chỉ preview online; Groups là alias | Profile CTA `/users/:id`; admin CTA riêng | Medium, đã xử lý phần page |
| Team CRUD/roster | Friends/Groups, AdminTeamsYouTube, HR assignment | `/admin/teams-youtube?tab=teams` | Friends giữ read/join/leave; assignment theo nhân sự chỉ là ngữ cảnh HR | Admin shortcut tới Teams | High, đã xử lý Friends; backend fields còn lỗi |
| Xem hồ sơ/thành tích/gallery | UserDetail, Friends/card, Settings summary | `/users/:id` | Cards chỉ preview; Settings không thành page profile thứ hai | Profile CTA | Medium, đã xử lý |
| Sửa hồ sơ bản thân và tài khoản | UserDetail modal, Settings, auth/users API | `/settings?tab=profile` | UserDetail bỏ duplicate edit form; Settings bỏ HR admin forms | CTA Settings và section hash; email/password section riêng | High, đã xử lý |
| Sửa nhân sự/role/job/verified/dev | Friends, Settings, UserDetail, AdminPrivileges, roster | `/admin/privileges?userId=…` | Bỏ full forms khỏi Friends/Settings/UserDetail/roster | Deep-link fetch đúng nhân sự độc lập pagination; roster CTA | High, đã xử lý |
| Award thủ công nhân sự | Friends/Settings, AdminPrivileges, AdminTeams roster | `/admin/privileges` | Settings/Friends/roster bỏ form, dùng shortcut | Deep-link theo nhân sự | Medium, đã hợp nhất workflow |
| MVP Cup tính theo mùa | AdminSeasons, shared award modal | `/admin/competition/seasons` | Không gộp với award thủ công | Giữ seasonId/preview/eligibility | High, nghiệp vụ khác nên giữ |
| Spotlight/archive công khai | Home, Friends admin, AdminSeasons | `/admin/competition/seasons` | Friends bỏ management; Home chỉ read | Admin shortcut; public preview | High, đã xử lý |
| Luật/mô phỏng/version | CompetitionAdmin, AdminSeasons rule form cũ | `/admin/competition/rules` | Seasons giữ picker/version tham chiếu và shortcut | Rule Builder CTA | High, đã đưa vào menu |
| Health/audit/events/retry/rebuild | CompetitionAdmin, AdminOperations, YouTube health | `/admin/operations` | CompetitionAdmin đã bỏ full events/projections mutations, giữ shortcut/diagnostics | `?tab=health\|audit\|events\|projections`, legacy tabs redirect | Medium, đã hợp nhất thao tác chính |
| Phòng ban/định nghĩa/kỳ/kết quả KPI | AdminKpi, Dashboard, BXH | `/admin/kpi` | Dashboard/BXH read-only; phòng ban là tab | Alias `/admin/departments` | High, ownership hợp lý |
| Production KPI benchmark/version/evaluation | ProductionKpiPanel và backend engine | `/admin/kpi` tab Production KPI | Không gộp form nhập kết quả thủ công với benchmark Excel | Tab riêng, nhãn chỉ rõ benchmark | High, giữ tách nghiệp vụ |
| Trạng thái catalog game | Settings admin block, GameHub shortcut, sidebar read | Đề xuất `/admin/games` | Settings admin block nên chuyển ở đợt sau | Hiện `/settings?tab=games`; giữ alias khi di chuyển | Medium, đề xuất chưa triển khai |
| Gameplay/BXH từng game | Từng game và shared game components | `/games/<game>` | Không đưa standings live trận vào BXH công việc | Catalog và shortcut game | Low, reuse hợp lệ |
| Friendship/chat | FriendsDock global; `/friends` là directory/team | FriendsDock hiện tại; đề xuất tab Kết nối trong Friends | Nhãn mở trang đầy đủ không nên hứa một friends manager chưa có | URL tab phải được implement trước | Medium, còn mismatch |

## 5. Entry Point, Reuse Và Luồng Dữ Liệu

### 5.1. Entry point chính

| Nghiệp vụ | Entry point đang dùng | API / dữ liệu chính | Ranh giới trách nhiệm |
|---|---|---|---|
| BXH | Sidebar, Dashboard cards, Arena/Grand CTA, YouTube preview, Friends shortcut, profile CTA | `rankings.getTeams/getIndividuals/getYouTube/getTopPerformers`, `kpiApi.getResults({ periodId })` | Full listing/search/filter chỉ ở Leaderboard; YouTube listing đã chuyển qua unified client |
| Công việc của tôi | Sidebar Tổng quan, login return, Home CTA | `kpiApi.getMyKpis`, `competition.getDashboard`, `dashboard.overview`, `users.getRecognitions` | Summary/read; không trao điểm hoặc sửa người khác |
| YouTube | Sidebar, Dashboard summary, profile/competition shortcut | `youtube.getOverview/getTeamDetails/compareTeams` | Analytics/read; team khác cần admin ở endpoint detail |
| HR | Sidebar admin, Friends/UserDetail/Settings CTA | `users.list/create/update/delete`, `adminUpdateJobProfile`, recognition APIs | Mutation chỉ ở trang admin; kiểm role tại backend |
| Đội/kênh | Sidebar admin, Friends admin CTA, YouTube Quản lý kênh | `groups.listAll/create/update/*`, `youtube.admin*` | Team/channel mutation theo ownership; member join/leave ở Friends |
| Thi đua | Sidebar Arena/Grand, Dashboard summaries, Home recognition | Competition season/grand/detail/challenges/rules/journey APIs | Mùa và năm giữ detail context; bảng đầy đủ về BXH |
| Game | Sidebar, GameHub, Home shortcut, URL phòng | Catalog + API game riêng + sockets | Catalog để chọn; page game để chơi; quản trị câu hỏi riêng |
| Account | Sidebar/profile footer, header Settings, UserDetail self CTA | `users.update`, `auth.changeEmail/changePassword/deleteAccount`, UI preferences | Self-edit khác HR/admin-edit; destructive action cần re-auth backend |

Một CTA đọc nên dẫn đúng state, không chỉ đúng page. Ví dụ “BXH mùa đội” phải là `scope=teams&period=season&seasonId=…`; chỉ `/leaderboard` có thể đưa người dùng tới tab KPI mặc định.

### 5.2. Component/module dùng lại

| Component / module | Nơi dùng / vai trò | Đánh giá |
|---|---|---|
| `Layout`, `Sidebar`, `NAVIGATION_CONFIG` | Shell của app, tên page, nhóm menu theo role | Reuse đúng; canonical tên/menu thuộc config này, không copy menu vào page |
| `ui.jsx`, `FlipTableBody.jsx` | Page/tab transition, collapse, modal, skeleton, number, ranking FLIP | Reuse đúng; dùng token motion và ID key ổn định |
| `PublicRecognition`, `RecognitionPortraitFrame` | Home/Login/public spotlight | Preview hợp lệ, không full leaderboard |
| `ProductionKpiPanel` | AdminKpi production tab | Một module quản trị benchmark riêng; không duplicate KPI foundation |
| `MvpCupAwardModal` | AdminSeasons/AdminPrivileges | Component chung hợp lệ; vẫn phải giữ quy tắc eligibility theo nguồn award |
| `FriendsDock` | Layout global: friend requests, add/accept/remove, chat | Tác vụ toàn app hợp lệ; page directory chưa thay thế toàn bộ dock |
| `GameFullscreenShell`, game history/rules/result components, `Quiz*` | Page game/lobby/trận | Reuse theo game; không trùng bảng xếp hạng công việc |
| `VerifiedBadge`, `JobTitleBadge`, avatar helpers, profile preferences | Danh bạ, HR, profile, ranking | Reuse identity đúng; không mỗi page tự suy diễn title/verified |
| `api.js`, `cache.js` | API client chung; coalesce cùng cache key | Chung API không có nghĩa chung UI ownership. Nhiều namespace gọi cùng endpoint còn có thể request trùng |
| `useCachedData`, `CompetitionProgressWidget` | Module có sẵn; chưa thấy consumer/page mount cho widget tại lúc audit | Không tính module dormant thành chức năng đang xuất hiện trên trang |
| `YouTubeTrendChart` | YouTube overview/team detail nhận `overview.history` và `currentTeam.history` tại `YouTubeOverview.jsx`; Dashboard đã gỡ chart | Chart chuyển về canonical analytics owner; reuse existing component, không mất báo cáo lịch sử |
| `TeamComparisonBar`, `ChannelDetailModal` | Dashboard đã gỡ consumers; channel modal chưa thấy active importer trong page | Có thể thành orphan; cần kiểm toàn bộ importer trước khi xóa, không xóa chỉ vì tên giống |

Các form nhân sự trước cleanup không chỉ dùng chung API mà còn copy field/handler với payload khác nhau. Đây là duplication có tác động thực tế. Ngược lại, một profile card và một profile detail cùng dùng avatar helper là reuse cần giữ.

### 5.3. BXH game là nghiệp vụ khác

| Game / nguồn | Thước đo và lifecycle | Vì sao không gộp thành BXH công việc |
|---|---|---|
| 2048 / `game2048.service.js:395`, `:410` | `Game2048Stat.bestScore`, thời điểm đạt điểm; checkpoint/session của ván | Best score trò ghép số khác XP/GP/KPI theo kỳ |
| Cờ Tỷ Phú / `capitalBoardGame.service.js:1233` | `GameLeaderboardProfile.careerMoney`, gamesWon, totalNetWorth; personal history | Career reward của game và tài sản ván không cùng đơn vị điểm thi đua |
| Quiz / `quizGame.service.js:770` | `QuizUserStat.totalScore`, gamesWon, totalCorrect; room live/round/final standings | Career leaderboard và live standings của trận còn là hai lifecycle khác nhau |
| Sâm / `samGame.service.js:1690` | `SamUserStat.totalPoints`, gamesWon, maxWinStreak; play/spectator state | Điểm game riêng; không cộng với KpiResult hay ScoreLedger |

Catalog availability guard ở entry/start và việc cho session đang chơi tiếp tục là workflow game; không suy luận chỉ từ nút sidebar là backend đã thay đổi quyền start/continue. Audit này giữ game engine và contracts hiện tại.

## 6. Phát Hiện Và Rủi Ro

Mức độ: Critical là khả năng gây mất dữ liệu/sai trao điểm nghiêm trọng; High là sai ý nghĩa dữ liệu, sai scope hoặc đi sai luồng; Medium là duplication/misplaced ownership và chi phí bảo trì; Low là naming/entry point nhỏ. Một finding về quyền dựa trên code hiện tại không khẳng định đã có khai thác ngoài thực tế.

| ID / Mức độ | Vị trí và hành vi | Vì sao có rủi ro | Giữ / xử lý | Tác động, trạng thái |
|---|---|---|---|---|
| B01 Critical | `backend/src/services/userDeletion.service.js:78`: chỉ verify password khi `isSelfDelete && password`; `auth.controller.js:43`, `users.controller.js:546` nhận password tùy chọn; routes self-delete không validate bắt buộc | Session hợp lệ có thể xóa/anonymize tài khoản mà bỏ bước re-auth; operation gỡ membership/preferences/gallery/friendships/likes và unassign kênh/owner (`userDeletion.service.js:96`) | Canonical self-delete qua auth; bắt buộc password/re-auth trong service dùng chung; giữ alias cùng validation | Còn tồn tại. Không thử xóa tài khoản thực; cần regression test thiếu/rỗng/sai password cho mọi alias |
| B02 Critical | `competition.routes.js:103` đến `:106` event mutation chỉ `auth`; `competition.controller.js:683` chuyển body tới ingestion và `:719` nhận actor/team từ caller; `eventIngestion.service.js:37` validate contract nhưng không nhận authenticated principal; registry `:329` lấy actor từ descriptor/payload | Member có thể tạo sự kiện cho actor/team tùy ý. Nếu rule đang bật và worker xử lý, có thể tác động điểm; idempotency/shape validation không thay thế authorization | Service/internal token hoặc role+team scope; bind actor vào principal; production action cần chứng cứ nguồn | Còn tồn tại. Mức tác động điểm phụ thuộc active rules/worker; cần test giả actor/team và valid scoring payload |
| B03 High | `ranking/ranking.service.js:329` và `:592`: `scope=all-time` sort/return `currentSeasonScore`; overview `:187` và `:204` tương tự | API tên all-time/lifetime có thể bị hiểu là cộng nhiều mùa, trong khi là summary mùa hiện tại | Chọn định nghĩa lifetime và backend aggregation thật, hoặc đổi tên contract. Frontend đã đổi period label thành “Điểm hiện tại” tại `Leaderboard.jsx:1125` và `:1288` | Backend còn tồn tại; không sửa score trong cleanup. Một số field còn tên `lifetimeScore`; cần fixture nhiều mùa chứng minh semantics |
| B04 High | `leaderboard.controller.js:11` nhận daily/weekly/monthly/yearly; `dashboard.service.js:140` normalize range nhưng query chỉ user active và sort summary (`:98`) | Các nhãn thời gian có thể cho cùng một BXH; summary còn fallback `grandPoints` khi season score bằng 0 | Frontend full listing dùng unified ranking; deprecate legacy API sau telemetry; tránh UI gắn nhãn thời gian giả | Còn tồn tại ở API legacy; Dashboard đã bỏ use leaderboard cho online và bỏ time filter không có effect |
| B05 High | `ranking.service.js:399` đọc projection mùa; `competition/season.service.js:240` live compute ledger và `:249` dùng frozen result khi kết thúc | Preview và canonical listing có thể khác lúc projection lag hoặc sau freeze; hai tên giống không đủ đảm bảo cùng snapshot | Thống nhất public read contract/timestamp; khi kết thúc dùng frozen source rõ ràng; preview giới hạn và link đúng mùa | Còn tồn tại backend. Không thay live/frozen endpoint bằng redirect API vì shape/behavior khác |
| B06 High | `kpi.routes.js:29`, `:31`, `:80` read chỉ auth; `kpi.controller.js:104`, `:130`, `:288` nhận `userId` bất kỳ; `kpi.service.js:255`, `:407`, production calculator `:549` không nhận principal | Member đọc KPI result/audit/execution của người khác và metadata email/job/department nếu biết ID; quyền công khai của ranking chưa được tách khỏi audit | Tách projection BXH được phép đọc với results/history private; bind self hoặc admin/manager scope theo policy | Còn tồn tại. Nếu công ty chủ ý công khai results, phải ghi policy và giới hạn audit/PII, không tự coi mọi result là private |
| B07 High | `kpi.routes.js:75` calculate cho admin/manager; `productionKpiCalculator.service.js:78` nhận editor/user/team từ body, chỉ kiểm user active | Manager có thể evaluate/trao điểm ngoài đội phụ trách nếu policy manager cần giới hạn đội | Keep backend permission; thêm target-team authorization và timestamp/source validation | Còn tồn tại; role manager toàn công ty hay theo đội là quyết định nghiệp vụ cần chốt |
| B08 High | `youtube.controller.js:258` cho member compare nếu một đội là đội mình; aggregation `:811` trả views7d/30d/growth/subscriber deltas của cả hai đội | Detail team endpoint từ chối đội khác tại controller `:147`, nhưng compare cho đọc summary analytics của đối thủ | Public DTO chỉ gồm ranking metrics đã cho phép hoặc admin-only compare; giữ team detail scope | UI compare nay chỉ admin, API còn cho member. Không khẳng định compare lộ channel/video detail vì response chỉ team metrics |
| B09 Medium | `youtubeAggregation.service.js:977` channel ranking trả assignedUserId, syncStatus, baseline/status và channel identifiers cho member | Ranking DTO trộn public metrics với thông tin vận hành; có thể vượt policy “public ranking không private analytics” | DTO ranking tối thiểu; private analytics/admin DTO riêng | Còn tồn tại backend. Channel ID/custom URL bản thân thường public; cần quyết định policy cho assignment/sync metadata |
| B10 High | `AdminTeamsYouTube.jsx:196` và `:236` gửi department/color; `groups.routes.js:16`/`:33` schema không có fields; `group.service.js:158`/`:213` không persist chúng | Người dùng thấy form “lưu thành công” nhưng dữ liệu không được lưu; ownership tập trung mà contract chưa đúng vẫn gây mất thao tác | Chỉ hiển thị field persist được, hoặc thêm contract/model/migration/test trước khi bật edit | Còn tồn tại; không tự thêm database fields trong cleanup |
| B11 High | `backend/src/services/auth.service.js:100-123` cập nhật `/api/auth/me` chỉ nhận name/email; email route `:139-205` yêu cầu mật khẩu nhưng basic profile PATCH không đồng bộ contract đầy đủ với `/api/users/:id` | Người dùng có thể đổi email qua hai luồng có payload và re-auth khác nhau; client/API cũ dễ báo thành công một phần hoặc mất profile fields | Giữ `/settings` làm canonical self-edit; gom email/password vào contract yêu cầu re-auth và deprecate alias sau telemetry; giữ profile PATCH cho phone/bio/avatar | Còn tồn tại backend; chưa đổi auth contract trong cleanup. Cần test email sync, duplicate email, password bắt buộc và các alias |
| B12 High | `backend/src/services/competition/excelKpiImporter.service.js:360-413` deactivate rule theo `role` nhưng `seasonId`/`teamId` chỉ lưu ở `ProductionKpiActivation`; `productionKpiCalculator.service.js:110-113` tìm rule active theo role/task, không lọc activation scope | Rule được admin kích hoạt cho mùa/đội có thể áp dụng toàn role/task, làm sai điểm ngoài phạm vi dự định | Resolve active rule qua activation scope (season/team/effective time) hoặc cấm scope khi engine chưa hỗ trợ; thêm fixture nhiều mùa/đội trước khi bật | Còn tồn tại backend; không tự sửa scoring/migration trong cleanup |
| U01 High | Trước cleanup Arena/Grand CTA dùng `scope=season\|grand&ranking=team` nhưng Leaderboard parser mặc định KPI, không map team nhất quán | Click “Xem toàn bộ BXH đội” mở KPI và mất ngữ cảnh mùa/năm | `normalizeRankingParams` map legacy; CTA canonical trực tiếp `scope=teams\|members&period=season\|grand&...Id` | Đã xử lý frontend; cần test bookmark/query/back/reload |
| U02 High | Trước cleanup `Leaderboard.jsx` lấy `kpiApi.getResults()` không kỳ rồi average `progressPct`; AdminKpi lọc period | Một người bị trộn kết quả nhiều kỳ; thứ hạng không cùng phạm vi với trang quản trị | `Leaderboard.jsx:839` tải periods, `:849` results theo selected period; selector tại `:1316` | Đã thêm kỳ KPI. Công thức vẫn average đơn giản và progress backend capped 100%; trọng số/so sánh phòng ban cần policy riêng |
| U03 High | Trước cleanup Arena/Grand có generic YouTube leaderboard; Grand gắn nhãn toàn năm dù request không year filter | Total views/30 ngày bị hiểu là điểm hoặc hiệu suất của mùa/năm | Giữ thi đua XP/GP theo context; generic YouTube chỉ shortcut sang YouTube/BXH | Đã bỏ generic YouTube tab/API ở Arena/Grand |
| U04 Medium | Dashboard trước có charts, comparison, danh sách/filter kênh, drilldown team và channel modal như YouTube | Trang tổng quan thành analytics/listing/management thứ hai; tăng request và nhiều state cạnh tranh | Dashboard giữ summary, `/youtube` sở hữu analytics | Đã rút gọn; online gọi `dashboard.realtimeUsers` và preview tối đa 6 người |
| U05 High | Friends, Settings, UserDetail trước có HR/profile/award forms; payload self-edit/admin-edit không đồng nhất; Settings từng nuốt lỗi role rồi báo thành công | Cùng dữ liệu có nhiều form/quy tắc, dễ hiểu nhầm cập nhật một phần là thành công toàn bộ | UserDetail xem/CTA, Settings self-edit, AdminPrivileges HR/award; `Settings.jsx:122` section deep-link; `AdminPrivileges.jsx:369` fetch target và `:1053` Portal editor | Đã xử lý và có browser regression desktop/mobile. HR giữ đầy đủ profile fields, đọc accountStatus, gửi đúng enum role/status backend |
| U06 Medium | Trước cleanup CompetitionAdmin có integration/projections/retry/rebuild trùng AdminOperations; hiện `CompetitionAdmin.jsx:76` mặc định rules và `:435` chỉ rules/analytics/states/inspector | Route luật từng đồng thời thao tác vận hành, không rõ nơi xử lý incident/rebuild | Operations nhận queue/trace/retry/rebuild; rules giữ pure-memory simulator và diagnostics liên quan; legacy tabs redirect | Đã bỏ duplicate full events/projections/live production test UI; trace vẫn xem được ở Operations. Không thay đổi các API mutation auth-only ở B02 |
| U07 Medium | Trước cleanup AdminTeamsYouTube có job profile/award handler và form trùng AdminPrivileges | Full HR mutation từ roster tạo phiên bản form thứ hai | Roster giữ member management/chuyển trưởng nhóm theo đội; `AdminTeamsYouTube.jsx:1637` chuyển HR tới `/admin/privileges?userId=…` | Đã bỏ duplicate HR/award state/handlers/modal; chuyển trưởng nhóm vẫn thuộc teams |
| U08 Medium | `Settings.jsx:1070` admin game catalog section; `GameHub.jsx:120` CTA `/settings?tab=games` | Quản lý toàn hệ thống nằm trong cài đặt cá nhân | Đề xuất `/admin/games`; shortcut + alias khi có route/parser | Chưa di chuyển. `Settings.jsx:122` đã hỗ trợ `?tab=games` và reload/back/mount scroll đúng section |
| U09 Medium | `/friends` gọi users/groups, không gọi friends API; `FriendsDock.jsx:143`, `:396`, `:409`, `:422` mới quản lý friendships; `:698` mở `/friends` | “Trang đầy đủ” của dock không thực sự có friends-request management; URL/tên chức năng lệch | Đổi nhãn phù hợp directory hoặc thêm tab Kết nối dùng API friendship | Còn tồn tại; không đồng nhất danh bạ nhân viên và bạn đã kết nối |
| U10 Low | Trước cleanup timeline Grand link `/arena` cho mùa khác/đã kết thúc | Người dùng tới mùa hiện tại thay vì mùa trên timeline | `GrandHub.jsx:596` đã link `/leaderboard?scope=teams&period=season&seasonId=…`; top action Vào Đấu Trường tại `:522` giữ mùa hiện tại | Đã sửa CTA từng mùa; detail route lịch sử mùa là đề xuất riêng |
| U11 Low | Tài liệu cũ mô tả Overview tab và lifetime records; consumer widget chưa mount; actual mount API `/rankings` ở `routes/index.js:19` | Dễ triển khai thêm trang/widget trùng theo tài liệu thay vì theo app thực | Báo cáo này ghi thực tế; cập nhật docs cũ khi contract và route được quyết định | Không coi URL frontend `/leaderboard` và API `/api/rankings` là duplicate page |
| U12 Medium | App trước giữ `displayLocation` cũ qua timer khi chuyển public/game; khác quy tắc commit điều hướng ngay | Click/back nhanh có thể giữ route cũ và state không đúng URL trong khoảng transition | `App.jsx:160` dùng AppRoutes/Routes trực tiếp; Layout giữ PageTransition có sẵn | Đã bỏ delay route commit; animation dùng chuẩn hiện có |
| U13 High | Canonical ranking trước không có pagination đầy đủ và drilldown tải cả members lẫn channels; có thể chỉ hiện phần đầu dữ liệu hoặc gọi API ngoài scope cần thiết | Người dùng hiểu thiếu hàng là thiếu thành viên/kênh; request không cần có thể 403 hoặc làm stale state | `Leaderboard.jsx:747` fetch đúng subview; `:753`, `:786`, `:801`, `:816` dùng page/limit 100; cache key có page/subview | Đã thêm pagination cho datasets thi đua/YouTube và drilldown, sửa stale team title/numeric channelTeam option/table overflow |
| U14 Low | Quiz `QuizGame.jsx:365`/`:391` thoát tới Dashboard; Capital Board `CapitalBoardGame.jsx:568`/`:573` tới Arena; 2048 shell `Game2048.jsx:572` tới Games nhưng nhánh save/error `:652`/`:674` tới Arena | Sau cùng một lệnh thoát, người dùng về các domain khác nhau; khó dự đoán tiếp tục chọn game | Chuẩn hóa thoát lobby về `/games`, rời phòng về lobby của game; giữ xử lý save/rejoin/leave riêng | Còn tồn tại; thay exit phải kiểm session checkpoint/room lifecycle, không chỉ sửa label |
| U15 High | `RecognitionPortraitFrame.jsx` trước đây gọi `usersApi.gallery(record.userId)` khi public spotlight thiếu gallery; `/api/users/:id/gallery` là endpoint auth-only và 401 interceptor chuyển sang login | Home/Login công khai có thể bị đẩy sang `/login` chỉ vì ảnh riêng tư không sẵn sàng; public DTO bị trộn với dữ liệu private | Chỉ dùng `avatarData/avatarUrl/galleryImages/images` từ public spotlight DTO và initials fallback; thêm regression anonymous Home/Login với gallery 401 | Đã xử lý frontend; không mở quyền gallery backend. Regression `public-data-ownership.spec.js` không gọi private gallery và giữ URL/auth usable |
| U16 Medium | Khi Integration tab bị rút khỏi `CompetitionAdmin`, UI gọi `competition.getEventTrace()` và event trace detail bị mất khỏi mọi trang; Operations chỉ còn bảng/retry | Admin không thể kiểm tra payload, rule evaluation, ledger và processing error từ event queue; retry thiếu ngữ cảnh | Đưa trace vào `/admin/operations?tab=events`, đọc DTO `eventId/eventType`, modal Portal có error/ledger/payload/projection và retry cùng UUID | Đã xử lý frontend; regression `operations-ownership.spec.js` kiểm trace điểm âm, Portal/Escape, 403 và retry payload |
| U17 High | Sau khi bỏ form trùng ở `UserDetail/Friends/Settings`, editor HR ban đầu chỉ còn name/email/role/job/team/status; phone/bio/avatar mutation đã tồn tại ở users controller nhưng không còn entry point cho admin | Admin tưởng quản lý nhân sự đầy đủ nhưng không thể cập nhật contact/profile người khác; dữ liệu cũ bị bỏ sót | Bổ sung phone, bio, avatar upload/remove, manager/inactive enum và custom job/department vào `/admin/privileges?userId=…`; giữ self-edit ở Settings | Đã xử lý frontend; regression account ownership kiểm target ngoài trang đầu, payload contact/avatar, role/status contract và responsive editor. Persistence DB/ảnh lớn vẫn cần test backend |
| U18 High | `YouTubeOverview.jsx` trước xử lý URL `teamId` không nhất quán với đội của member; cache và refresh response có thể còn dữ liệu của context trước. Refresh compare gọi `setComparison` vô điều kiện sau khi admin đã đổi cặp đội | Deep-link có thể mở sai đội; dữ liệu private cần được chặn trước cache/API, còn response cũ có thể làm mất bảng mới | Giữ `selectedTeamId` từ URL, guard `canViewSelectedTeam` ở cache/effect/render/refresh; context guard cho refresh detail và compare; tab member quay đúng đội mình | Đã xử lý frontend. Test member own/other-team, admin đổi đội, response refresh cũ và chart desktop/mobile; member đội khác giữ URL và hiện thiếu quyền, không gọi private API. Quyền backend vẫn được đánh giá riêng ở B08/B09 |

### 6.1. Route API trùng và route tương tự nhưng khác nghiệp vụ

| Family / URL | Quan hệ thực tế | Hướng xử lý |
|---|---|---|
| `/api/rankings/*` và `/api/leaderboard/*` | Unified hub projection/summary so với legacy user range leaderboard; data semantics khác | Frontend canonical dùng unified theo scope; giữ legacy API tới khi client cũ chuyển; không redirect HTTP mù giữa response shapes |
| `/api/competition/seasons/:id/leaderboard?scope=individual` và `/individual-leaderboard` | `competition.controller.js:247` rẽ nhánh vào cùng individual service | Chọn endpoint explicit individual cho contract nội bộ; giữ alias có deprecation |
| `/api/competition/grand/:id/standings?scope=individual` và `/individual-standings` | Cùng pattern ở controller `:419` | Giữ tương thích; có test team/individual; không thêm UI thứ hai |
| `/api/competition/projections/*`, competition dashboard/company-overview, `/api/rankings/overview` | Cùng domain ranking nhưng read-model/admin diagnostics và summary khác full listing | Summary/diagnostics là API hợp lệ; phải đồng nhất scope/timestamp thay vì chỉ gộp tên |
| `/api/youtube/leaderboard?view=channels\|teams` và `/api/rankings/youtube` | `ranking.service.js:841` và YouTube controller cùng delegate team/channel aggregation service, tạo hai API entry cùng listing | Frontend hub hiện dùng `/api/rankings/youtube` cho cả hai view; giữ YouTube legacy endpoint cho client cũ; dữ liệu/baseline/DTO vẫn cần scope policy rõ |
| `/api/kpi/*` và `/api/kpi/production/*` | Foundation: Department/Kpi/Period/Result/Event; Production: Excel rules/version/activation/execution snapshot + ScoreLedger | Giữ hai tab nghiệp vụ; không gộp results form với Excel benchmark |
| `PATCH /api/auth/me` và `PATCH /api/users/:id(/profile)` | Auth basic name/email; Users còn bio/phone/avatar và admin role/team/job/badges | Canonical UI self-edit một nơi; chọn contract profile đầy đủ trước khi deprecate alias; không coi payload tương đương |
| `PATCH/POST /api/auth/email`, `POST /change-email` | Cùng controller và schema xác nhận password | Client mới giữ PATCH; alias cũ cùng validation; deprecate sau usage audit |
| `PATCH/PUT/POST /api/users/:id/profile-preferences` | Cùng controller preferences | PATCH canonical; giữ alias cho client cũ; gallery/profile identity giữ checks owner/admin |
| `DELETE /api/auth/me/account`, `POST /api/auth/me/delete`, `DELETE /api/users/me/account` | Cùng service self-delete nhưng entry routes khác | Một service bắt buộc re-auth cho tất cả alias, client canonical auth delete |
| `DELETE /api/users/:id`, `/api/users/admin/users/:id`, `/api/admin/users/:id` | Admin delete cùng controller/service | Chọn `/api/users/:id`; giữ guard admin ở mọi alias, không dùng cho self-delete |
| Competition admin `/rules` và `/rule-sets`, version/publish aliases | Cùng handlers với tên route khác | Một API vocabulary trong client; backend compatibility alias; không tạo menu riêng cho từng tên |
| `/api/games/catalog` và `/api/admin/games`, `/status/:gameKey` và `/:gameKey` | Router catalog mount hai nơi, status mutation cùng controller có admin guard | GET catalog cho gameplay; admin PATCH cho management; chọn đường chuẩn, giữ guards |
| `/api/admin/games/sam` và `/api/games/sam` | Cùng router mount; gameplay và admin debug không cùng tác vụ | Giữ endpoint-specific role guards; không suy luận mọi URL admin chỉ dành admin từ prefix |

## 7. Đánh Giá Information Architecture

### Menu và sidebar

Menu sau cleanup gom sáu nhóm: Công việc, Thi đua, Cộng tác, Trò chơi, Quản trị, Tài khoản. Công việc chỉ có Tổng quan, Số liệu YouTube và Bảng xếp hạng. Điều này loại hai mục KPI/Tổng quan cùng mở Dashboard. Rule Builder có menu riêng dưới Quản trị nên không bị giấu sau một route Competition admin mặc định.

Sidebar dùng một `NAVIGATION_CONFIG`; header lấy `resolveCurrentTitle`; profile động theo user. Admin visibility không thay role guard backend. Manager hiện được backend cho calculate Production KPI nhưng không có AdminRoute trong UI: đây là khoảng trống giữa quyền API và workflow sản phẩm cần định nghĩa, không tự mở toàn bộ admin cho manager.

Sidebar có GameHub và shortcut mỗi game là nhiều entry point hợp lệ cho tác vụ chơi thường xuyên. Không cần thêm một grid shortcut đầy đủ nữa trên mọi dashboard. Các nút Settings ở header/sidebar/profile đều dẫn cùng page và không mang phiên bản form riêng.

### Breadcrumb, tab và filter

Breadcrumb nên biểu đạt parent của nội dung: BXH → Đội → Thành viên/kênh; YouTube → Đội; Quản trị → Nhân sự/đội/mùa. Không dùng breadcrumb thay tab và không link tên mùa lịch sử về mùa hiện tại.

Tab phân loại đối tượng/loại báo cáo; filter chỉ điều chỉnh dataset trong tab. `scope=kpi|teams|members|youtube|hall-of-fame` là loại BXH; `period=season|grand|all-time` là phạm vi thi đua; `periodId` là kỳ KPI; YouTube `view=channels|teams` và `metric=views|subscribers|growth` không phải mùa giải. Không dùng một filter “Hôm nay/Tuần/Tháng” cho nhiều nguồn dữ liệu mà API không nhận cùng semantics.

Các trạng thái phải có deep-link ổn định và normalize tập trung; refresh/reload/back không đổi meaning. Team details của YouTube là analytics scope riêng; drilldown đội trong BXH là public ranking context và không được dùng để bỏ qua permission detail.

### Phân tách overview, detail và action

Dashboard chỉ trả lời “tôi và đội đang ở đâu, việc nào cần chú ý”. Listing trả lời “ai/đội/kênh nào, theo tiêu chí nào”. Detail giữ lịch sử/ngữ cảnh của một entity. Management sở hữu mutation và audit. Profile thể hiện identity/achievement; Settings sửa dữ liệu của chủ tài khoản. Việc nhúng các form HR/award/channel CRUD trong overview/profile phá các ranh giới này.

Arena và Grand có nội dung khác: XP/score theo mùa, luật/thử thách so với GP cả năm, timeline/settlement. Không gộp hai trang thành một bảng vì tên đều là thi đua. Similarly, benchmark Production KPI và chỉ tiêu/kết quả Foundation KPI chỉ chung nhóm navigation, không chung form.

### Tìm chức năng trong 2-3 bước

| Mục tiêu | Luồng chuẩn | Số bước từ app shell |
|---|---|---|
| Xem BXH mùa đội | Bảng xếp hạng → Đội → Chọn mùa nếu cần | 2-3 |
| Xem BXH cá nhân mùa đang xem | Arena → Xem toàn bộ BXH cá nhân | 2, seasonId được giữ |
| Xem kênh chưa gán đội | Số liệu YouTube → Xem các kênh chưa gán | 2, `channelTeam=unassigned` |
| Xem analytics đội của mình | Số liệu YouTube → Kênh đội bạn | 2 |
| Gán hoặc đồng bộ kênh | Quản trị → Đội & Kênh → Kênh | 2-3 |
| Sửa hồ sơ bản thân | Cài đặt hoặc Hồ sơ → Chỉnh hồ sơ | 1-2 |
| Sửa nhân sự từ profile | Hồ sơ nhân viên → Quản lý nhân sự | 2, cần `userId` deep-link |
| Tạo luật mới | Quản trị → Luật & Mô phỏng → Tạo rule set | 3 |
| Retry sự kiện lỗi | Quản trị → Giám sát & Logs → Hàng đợi sự kiện | 3, URL tab của Operations đã hỗ trợ |
| Chơi game | Trò chơi → Chọn game; hoặc shortcut game sidebar | 1-2 |

Các bước là đường đi dự kiến theo UI, không phải kết quả usability test với người dùng thật. Hiệu quả phụ thuộc nhãn rõ ràng, trạng thái menu active và deep-link đúng dữ liệu.

## 8. Cấu Trúc Website Đề Xuất

```text
Công khai
├── WorkRank / Vinh danh                      /
└── Đăng nhập / Đăng ký                       /login

Công việc
├── Tổng quan                                /dashboard
│   ├── KPI của tôi theo kỳ
│   ├── Vị thế cá nhân và đội trong mùa
│   ├── YouTube summary
│   └── Online/recognition preview
├── Số liệu YouTube                          /youtube
│   ├── Tổng quan và Top 5 preview
│   ├── Kênh đội của tôi / chi tiết đội        ?tab=team_detail&teamId=…
│   └── So sánh đội [admin]                   ?tab=compare
└── Bảng xếp hạng                            /leaderboard
    ├── KPI                                  ?scope=kpi&periodId=…
    ├── Đội                                  ?scope=teams&period=season|grand|all-time
    ├── Thành viên                           ?scope=members&period=season|grand|all-time
    ├── YouTube                              ?scope=youtube&view=teams|channels&metric=…
    └── Vinh danh                            ?scope=hall-of-fame

Thi đua
├── Mùa giải: luật, thử thách, preview         /arena
└── Giải năm: hành trình, timeline, preview   /grand

Cộng tác
├── Thành viên & Đội nhóm                    /friends
│   ├── Danh bạ, đội của tôi, danh sách đội
│   └── Kết nối [đề xuất, chưa có tab]
└── Hồ sơ nhân viên                          /users/:id

Trò chơi
├── Catalog                                 /games
├── Cờ Tỷ Phú                                /games/capital-board[/room/:roomId]
├── 2048                                    /games/2048
├── Đoán Hình & Nhạc                         /games/quiz[/room/:roomId]
└── Sâm                                     /games/sam[/room/:roomId]

Quản trị [admin]
├── Nhân sự & Đặc quyền                     /admin/privileges
├── Đội & Kênh YouTube                       /admin/teams-youtube
│   ├── Đội / roster                         ?tab=teams
│   └── Kênh / assignment / sync             ?tab=channels
├── KPI & Phòng ban                          /admin/kpi
│   ├── Định nghĩa, kỳ, kết quả, history
│   └── Production KPI: benchmark/version
├── Mùa giải / spotlight / archive           /admin/competition/seasons
├── Luật & Mô phỏng                         /admin/competition/rules
│   └── Version/simulator; diagnostics đọc theo context
├── Giải năm / kết toán GP                   /admin/competition/grand
├── Giám sát & Logs                         /admin/operations
│   └── Health, audit, events, projections
├── Nội dung Quiz                           /admin/quiz
└── Trạng thái game [đề xuất]                /admin/games

Tài khoản
├── Hồ sơ của tôi                            /users/:myId
└── Cài đặt                                  /settings
    ├── Hồ sơ bản thân                       ?tab=profile
    ├── Email / mật khẩu / notifications / UI
    └── Xóa tài khoản
```

Không thêm page Overview BXH riêng chỉ để chứa một bộ preview khác. `/leaderboard` hiện bắt đầu ở KPI; người dùng chuyển tab hoặc dùng contextual deep-link. Một overview BXH trong tương lai chỉ hợp lý khi có nhu cầu rõ và không nhân bản dashboard.

`period=all-time` hiện được giữ như compatibility token của backend; cây trên không khẳng định đây là lifetime đúng. Nhãn hiển thị cần phản ánh dữ liệu hiện tại cho tới khi backend định nghĩa và tính lifetime thật.

### Quy tắc Dashboard

Giữ KPI bản thân theo kỳ, điểm/vị trí có nguồn thi đua, summary YouTube 3 số cho member/4 số cho admin, recognition, online preview tối đa 6, và CTA có ngữ cảnh. Không hiển thị full ranking/search/pagination; không quản lý kênh/nhân sự/mùa; không chạy compare/drilldown analytics; không gắn filter thời gian không có effect; không fallback rank 1 khi chưa được xếp hạng.

Preview ngoài Dashboard giới hạn Top 5; Arena/Grand có thể thêm hàng của chính người dùng/đội để không mất ngữ cảnh. Không có search/sort/advanced filter trong preview. Full dataset và các controls ở canonical listing.

## 9. Quy Tắc Đặt Tên Và Ngăn Trùng Lặp

1. Mỗi feature mới phải ghi canonical page, entity, nguồn dữ liệu, scope/kỳ, role và action trước khi thêm menu. Page thứ hai cho cùng action phải có lý do sản phẩm cụ thể.
2. Tên menu thể hiện tác vụ: “Số liệu YouTube” để phân tích, “Bảng xếp hạng” để so sánh thứ tự, “Quản lý đội & kênh” để mutation. Không dùng cùng tên “Tổng quan” cho nhiều page không có domain.
3. Page title, sidebar active/title và entry point dùng config navigation chung. URL params của ranking đi qua `normalizeRankingParams`; không mỗi CTA tự định nghĩa `scope` mới.
4. Tạo/sửa dùng modal/drawer tại management page khi cùng entity. Profile/summary dùng CTA tới management; không copy toàn bộ form vào page đọc.
5. Dùng câu lệnh rõ cho CTA: “Xem toàn bộ BXH”, “Xem số liệu”, “Quản lý kênh”, “Chỉnh hồ sơ”, “Quản lý nhân sự”. Nhãn khác nhau chỉ khi đích/action thực sự khác.
6. Query phải bảo toàn bộ lọc quan trọng khi redirect: scope, period, seasonId/grandId, periodId, teamId/teamView, view/metric/channelTeam. Tham số invalid normalize về state hợp lệ; tab khác không được kế thừa filter vô nghĩa.
7. Summary và full listing cùng domain phải dùng cùng score semantics và snapshot/freshness; không gọi một con số hiện tại là lifetime hoặc năm nếu API không lọc năm.
8. Phân quyền nằm tại API/service theo principal và target, không dựa vào ẩn button. Preview/ranking dùng DTO được phép công khai; admin/debug/audit dùng DTO riêng.
9. Alias cũ không có menu chính, chỉ redirect/deprecate. Giữ backward compatibility cho bookmark/client/API cho tới khi có telemetry và migration plan.
10. Dùng component/animation tokens hiện có. Cache key gồm scope/kỳ/entity; tránh skeleton khi có cache; không thêm timer chờ animation để điều hướng.
11. Review feature mới phải kiểm cả route, sidebar, dashboard, shortcut và API consumer. Tìm importer/mount thực trước khi gọi một file là duplicate hay xóa orphan.
12. Các bảng game, live standings và result modal chỉ được hợp nhất với ranking công việc nếu có contract quy đổi điểm được sản phẩm chấp thuận; hiện tại chúng là nghiệp vụ khác.

## 10. Trình Tự Triển Khai Và Xác Minh

| Giai đoạn | Phạm vi | Trạng thái tại lúc viết |
|---|---|---|
| 1. Canonical frontend | Route/query redirect; một menu Tổng quan; Rule Builder có mục riêng; CTA BXH đúng scope/kỳ; commit route ngay; Grand timeline đúng mùa | Đã triển khai; kiểm E2E route/menu/query và preview |
| 2. Rút gọn overview | Dashboard analytics → summary; Arena/Grand full listing → preview; YouTube bỏ listing/CRUD admin | Đã chỉnh; không thay backend scoring |
| 3. Ownership quản trị | Friends bỏ CRUD/award/spotlight/full ranking; UserDetail bỏ edit form; Settings/roster chuyển HR/award; HR deep-link đúng target; events/projections về Operations | Đã chỉnh; có browser regression desktop/mobile, deep-link người ngoài trang đầu list |
| 4. Kiểm frontend | `npm run check`, `npm run build`; desktop/mobile; deep-link/back/reload; tab nhanh/reduced motion | Kết quả command và E2E trên snapshot cuối ghi bên dưới |
| 5. Data/security follow-up | Re-auth self-delete; event scope; lifetime/range semantics; KPI audit scope; channel DTO; team fields | Chưa triển khai backend/migration trong cleanup IA |
| 6. Cải thiện còn lại | Game status admin route; Friends connection naming; detail mùa lịch sử; game exit consistency | Còn tồn tại hoặc đề xuất; HR roster và full operational actions đã hợp nhất |

Kết quả tích hợp cuối ngày 2026-10-05, sau bản sửa scoped YouTube, stale refresh compare và nền sticky tabs:

| Kiểm tra | Kết quả | Giới hạn bằng chứng |
|---|---|---|
| `npm run check` | 94 file trong `src/`, 0 lỗi | Kiểm tra integrity source; không chứng minh runtime/API permission |
| `npm run build` | Thành công; 1.911 module được build | Build production thành công; browser suite bên dưới chạy trên dev server |
| `npm run test:routes` | 20/20 đạt | Kiểm tra file/export của core pages, không chứng minh route đang mount hoặc quyền mutation |
| Browser regression tích hợp | 82/82 đạt trong 20,9 giây, Chromium desktop và Pixel 5 | 58 IA + 6 account + 8 public-data + 4 operations + 6 smoke; API phần regression được mock |
| YouTube targeted regression | 12/12 đạt desktop/mobile | Kiểm deep-link đội mình/đội khác, admin switch, stale refresh detail/compare và chart |
| Compare race trước/sau sửa | Trước sửa 2/2 thất bại đúng lỗi; sau sửa 2/2 đạt | Chờ refresh cặp cũ, đổi cặp đội, nhận dữ liệu mới rồi trả response cũ; bảng mới vẫn giữ đúng đội |
| Visual QA | Đã xem ảnh desktop/mobile của chart, HR editor, event trace và public recognition | Kiểm text/viewport/Portal; không thay thế usability study trên thiết bị thực |
| `git diff --check` | Sạch | Không có lỗi whitespace; generated test artifacts nằm ngoài repository |

Lệnh browser tích hợp chạy trong `frontend/`:

```bash
E2E_BASE_URL=http://127.0.0.1:5173 npx playwright test \
  e2e/information-architecture.spec.js e2e/account-ownership.spec.js \
  e2e/public-data-ownership.spec.js e2e/operations-ownership.spec.js \
  e2e/smoke.spec.js --workers=4 --output=/tmp/workrank-ia-final4
```

Server cục bộ đã có sẵn tại `http://127.0.0.1:5173` và được giữ chạy. Ảnh/log lượt tích hợp ở `/tmp/workrank-ia-final4`, ảnh chart sau sửa tab ở `/tmp/workrank-ia-youtube-final`. Không chạy toàn bộ backend suite hoặc thử các mutation trên tài khoản/dữ liệu thật trong đợt này. Chưa commit/deploy.

### Kiểm tra cần giữ trong đợt tích hợp

| Luồng | Kết quả cần chứng minh |
|---|---|
| `/rankings?scope=season&seasonId=…&ranking=team` và `ranking=individual` | Đúng tab đội/cá nhân, đúng mùa; URL canonical; không rơi về KPI |
| Grand CTA có grandId, team drilldown có teamId/teamView | Không mất năm/đối tượng khi quay lại hoặc reload |
| `/youtube?tab=channel_leaderboard&teamId=unassigned&sortBy=growth` | Chuyển BXH channels growth và `channelTeam=unassigned` |
| `/youtube?tab=admin` admin/member | Admin tới management; member không thấy CRUD và không được mở admin route |
| `/youtube?tab=team_detail&teamId=…` | Admin xem mọi đội; member đội khác giữ URL, hiện thiếu quyền từ guard UI và không gọi API private; không render cached analytics của đội khác |
| YouTube refresh rồi đổi đội/cặp so sánh | Response cũ không ghi đè hoặc làm mất dữ liệu của context vừa chọn |
| KPI selector | Results chỉ selected period; kỳ trống không bị trộn sang kỳ khác; Dashboard và AdminKpi đối chiếu cùng kỳ |
| Profile/Settings/HR | Self CTA tới Settings section; admin CTA deep-link đúng target user, kể cả không ở trang đầu list |
| Danh bạ/đội | Membership join/leave vẫn hoạt động; shortcut admin đúng tab; không còn duplicate HR/award forms ở Friends |
| Desktop/mobile và reduced motion | Text không chồng/tràn, tab/CTA usable, không white flash/skeleton khi có cache; reload/back và đổi nhanh không stale scope |

Các test frontend liên quan: `frontend/e2e/information-architecture.spec.js` kiểm route/menu/query/pagination/ownership, YouTube scope và stale refresh; `frontend/e2e/account-ownership.spec.js` kiểm editor target ngoài page đầu, account status khác presence, contact/avatar payload, Portal, Hủy/Esc, Settings deep-link/reload/back/reduced motion và không gọi admin HR/award mutations từ Settings; `frontend/e2e/public-data-ownership.spec.js` kiểm Home/Login chỉ đọc public DTO; `frontend/e2e/operations-ownership.spec.js` kiểm event trace/retry/403. Các test browser này dùng mock API; chúng không chứng minh live database/API permission hay cách tính điểm đúng. `frontend/e2e/smoke.spec.js` kiểm entry công khai và anonymous redirect trên server cục bộ.

Các test backend liên quan đã có: `ranking_consolidation_e2e.test.js`, `competition_leaderboard_individual.test.js`, `competition_phase6_read_model.test.js`, `competition_phase9_security.test.js`, `competition_youtube_permissions.test.js`, `youtube_team_scope.test.js`, `youtube_ranking_scope.test.js`, `youtube_admin_analytics.test.js`, `youtube_e2e.test.js`, `kpi_foundation.test.js`, `production_kpi_e2e.test.js`, `auth_change_email_and_self_delete.test.js`, `account_deletion_security.test.js`.

Không coi assertions HTTP 200/scope/array shape là bằng chứng điểm lifetime đúng. Không coi test wrong-password là bằng chứng missing-password bị chặn. Không coi input fuzzing event là test permission giả actor/team. Những khoảng trống này cần fixture và assertion hành vi tương ứng khi sửa backend.

Test `backend/test/integration.test.js:64` có tên “group owner sửa, kick thành viên và xóa nhóm”, nhưng token được tạo bằng admin ở `:28`/`:32`; test đó chưa chứng minh quyền leader/member. Smoke test export/route existence cũng không chứng minh route đang mount hoặc mutation có permission đúng.

## 11. Giới Hạn Và Quyết Định Còn Mở

Rà soát theo dõi các route/page đang mount và luồng dịch vụ liên quan. Không audit đầy đủ engine/physics/AI game, mọi migration hoặc mọi dòng của các thư viện phụ thuộc. Không truy cập hay sửa dữ liệu production; không thử thao tác account delete, event award hay settlement trên tài khoản thật. Báo cáo không thay thế usability study hoặc security penetration test.

Cần chốt policy: KPI results nào được toàn công ty xem, audit/history nào private; manager được quản lý toàn công ty hay theo đội; lifetime tính XP/score như thế nào qua nhiều mùa; metrics YouTube nào public và metadata nào admin; “màu/phòng ban đội” có cần model/contract thật; game publishing thuộc management route nào. Những lựa chọn này thay đổi dữ liệu và quyền nên phải có contract/test/migration rõ trước khi triển khai.

Đợt cleanup giữ alias API và route cũ; không xóa endpoint chỉ vì không còn nút trên UI. Mọi mục “đề xuất” trong báo cáo phải được triển khai cùng route/parser/permission trước khi menu hoặc CTA trỏ tới đó.
