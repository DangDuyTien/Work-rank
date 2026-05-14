# WorkRank - Audit tối ưu UI/UX toàn bộ web

Ngày rà soát: 14/05/2026  
Phạm vi: `frontend`, các API/backend ảnh hưởng trực tiếp tới trải nghiệm web, realtime tracking, bảo mật/anti-cheat và một phần `desktop-app` liên quan luồng tracker.

## Kết luận nhanh

Web đã có nền tảng tốt: route lazy-load, backend có Helmet/CORS/rate limit, tracking đã chuyển sang nguồn dữ liệu Desktop, màn bảo mật đã có auto-quarantine và thông báo realtime. Điểm yếu chính hiện tại nằm ở UI còn dựng bằng nhiều inline style, thiếu hệ component chung, responsive chưa đủ chắc, vài flow realtime/auth còn có trạng thái dễ gây hiểu nhầm, và nhiều màn thiếu trạng thái lỗi/rỗng/loading rõ ràng.

Ưu tiên nên làm trước là P0: khóa lại flow tracking chỉ tin Desktop, sửa auth/logout/redirect cho mượt, thêm toast/modal dùng chung, chuẩn hóa responsive cho các màn chính, và làm rõ hành động bảo mật nguy hiểm.

## Quy ước ưu tiên

- `P0`: cần sửa trước khi coi là ổn định cho người dùng thật.
- `P1`: cải thiện mạnh UX/chất lượng kỹ thuật, nên làm ngay sau P0.
- `P2`: nâng cấp trải nghiệm, giảm nợ kỹ thuật và tăng khả năng mở rộng.
- `P3`: polish, tối ưu phụ, không chặn luồng chính.

## P0 - Việc cần sửa trước

### P0-01 - Tracking web phải chỉ hiển thị chạy khi Desktop xác nhận

Vị trí: `frontend/src/context/TrackingContext.jsx`, `frontend/src/pages/Tracker.jsx`, `frontend/src/components/Layout.jsx`, `backend/src/routes/activity.routes.js`

Hiện trạng:

- Web đang có trạng thái lạc quan khi bấm bắt đầu, sau đó mới chờ Desktop phản hồi.
- Timer phiên trên web tăng bằng `setInterval` local, nên có thể làm người dùng tưởng đang tracking dù Desktop offline hoặc chưa phản hồi.
- Người dùng đã phản ánh nhiều lần: bấm trên web nhưng Desktop không bật/không nhận.

Cách sửa:

- Tạo state machine rõ ràng: `idle`, `starting`, `active`, `stopping`, `error`.
- Chỉ set `tracking = true` khi nhận được `desktop:status` với `online=true` và `tracking=true`.
- Khi bấm `Bắt đầu`, UI chuyển sang `starting`, disable nút 5-8 giây, hiển thị "Đang chờ Desktop phản hồi".
- Nếu quá timeout không có heartbeat Desktop, rollback về `idle` và hiện CTA mở Desktop/cấp quyền.
- Timer phiên nên lấy từ backend/session hoặc timestamp do Desktop gửi, không tự tin vào timer local khi Desktop offline.

Tiêu chí đạt:

- Tắt Desktop rồi bấm `Bắt đầu` trên web: UI không đếm giả, hiện lỗi rõ.
- Mở Desktop thành công: web tự chuyển active sau heartbeat.
- Dừng ở web: Desktop dừng, web đổi trạng thái sau xác nhận.

### P0-02 - Auth/session cần mượt như app thật, không reload thô

Vị trí: `frontend/src/services/api.js`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/Tracker.jsx`, `frontend/src/components/Layout.jsx`

Hiện trạng:

- API interceptor dùng `window.location.href = '/login'`, gây full reload và mất state.
- Logout trong `Tracker.jsx` đang `localStorage.clear()`, có thể xóa nhầm dữ liệu khác.
- Token đang lưu ở `localStorage`; tiện nhưng rủi ro XSS cao hơn cookie HttpOnly.

Cách sửa:

- Tạo hàm auth logout/clear dùng chung, chỉ xóa `token`, `refreshToken` và key liên quan WorkRank.
- Interceptor không redirect bằng `window.location.href`; phát event `auth:expired` hoặc gọi callback từ `AuthProvider`, sau đó `navigate('/login')`.
- Nếu hướng production: chuyển refresh token sang cookie HttpOnly, access token giữ ngắn hạn trong memory hoặc storage có kiểm soát.
- Thêm màn/session message: "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại".

Tiêu chí đạt:

- Refresh token lỗi thì web chuyển login không trắng màn.
- Logout ở mọi nơi xử lý giống nhau.
- Reload browser vẫn giữ phiên nếu token còn hạn; logout thì xóa phiên thật.

### P0-03 - Responsive còn có nguy cơ vỡ layout ở các màn chính

Vị trí: `frontend/src/components/Layout.jsx`, `frontend/src/pages/Login.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Leaderboard.jsx`, `frontend/src/pages/UserDetail.jsx`, `frontend/src/pages/Groups.jsx`, `frontend/src/pages/Security.jsx`

Hiện trạng:

- Nhiều grid đang cố định như `repeat(3, 1fr)`, `1fr 260px`, `280px 1fr`.
- `Login` có panel trái width `420px`, không có breakpoint rõ.
- Top nav scroll ngang nhưng không có mobile nav/bottom nav, dễ che mất chức năng.
- `UserDetail` có heatmap, level table, chart và card phụ dễ tràn trên màn nhỏ.

Cách sửa:

- Thêm responsive tokens/breakpoints chung: `sm < 640`, `md < 900`, `lg >= 1024`.
- Mobile: stack toàn bộ grid về 1 cột, giảm padding main còn 16px, ẩn bớt footer link.
- Layout nav: dùng menu thu gọn hoặc bottom nav cho 4 mục chính; `Security` chỉ hiện với admin.
- Các bảng dùng wrapper `overflow-x:auto`, có min-width hợp lý và sticky header nếu cần.

Tiêu chí đạt:

- Test được các viewport 390px, 768px, 1440px không overlap text/nút.
- Màn Security không vỡ khi bấm tab.
- UserDetail vẫn đọc được level, chart, sessions trên mobile.

### P0-04 - Hành động bảo mật nguy hiểm cần confirm, pending và lý do rõ

Vị trí: `frontend/src/pages/Security.jsx`, `backend/src/services/security.service.js`

Hiện trạng:

- Khóa/mở khóa thiết bị là hành động nguy hiểm nhưng UI chưa có confirm đủ rõ.
- Khi đang submit có thể bấm lại nhiều lần.
- Người bị khóa có toast realtime, nhưng thiếu hướng dẫn tiếp theo đủ cụ thể.

Cách sửa:

- Thêm confirm modal dùng chung cho `Khóa thiết bị`, `Mở khóa thiết bị`.
- Disable nút trong lúc request đang chạy; hiện trạng thái "Đang xử lý".
- Modal cần ghi rõ thiết bị, user, lý do và hậu quả: Desktop đó không gửi dữ liệu được nữa.
- Với user bị khóa: toast/link về Tracker, hiển thị "Thiết bị bị khóa, cần admin mở khóa hoặc pair lại".

Tiêu chí đạt:

- Không thể double-click tạo request lặp.
- Admin hiểu rõ đang khóa thiết bị nào.
- User bị khóa thấy lý do và bước xử lý tiếp theo.

### P0-05 - Cần hệ toast/modal/error dùng chung, bỏ `alert`/`confirm`

Vị trí: `frontend/src/pages/Groups.jsx`, `frontend/src/components/Layout.jsx`, toàn bộ `frontend/src/pages`

Hiện trạng:

- `Groups.jsx` còn dùng `window.confirm` và `alert`.
- Error phần lớn chỉ `console.error` hoặc text nhỏ trong từng page.
- Không có global toast cho success/error/info.

Cách sửa:

- Tạo `ToastProvider` và `ConfirmDialog` dùng chung.
- Các action tạo nhóm, join nhóm, rời nhóm, security action, desktop launch đều dùng toast.
- Chuẩn hóa message tiếng Việt: lỗi backend, mất mạng, hết phiên, không có quyền, request thành công.

Tiêu chí đạt:

- Không còn `window.alert`/`window.confirm` trong frontend.
- Người dùng luôn biết action vừa thành công hay thất bại.

### P0-06 - Realtime cache có thể giữ dữ liệu cũ khi đổi filter/range

Vị trí: `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Leaderboard.jsx`, `frontend/src/services/api.js`

Hiện trạng:

- `Dashboard` và `Leaderboard` dùng module-level cache (`globalUsersCache`, `globalLeaderboardCache`).
- Khi đổi tab/range/group, code merge user cũ với dữ liệu mới để giữ realtime-only user, nhưng có thể làm user stale vẫn xuất hiện sai ngữ cảnh.
- Dashboard dùng `Math.max` khi merge count, có thể che việc reset ngày/range.

Cách sửa:

- Cache theo key rõ: `range + teamId + search`.
- Khi đổi range/group, reset danh sách trước rồi nạp lại, không merge dữ liệu thuộc context cũ.
- Realtime event phải kiểm tra `teamId`, `range`, `statDate` trước khi apply.
- Nếu backend gửi totals authoritative thì UI nên replace totals, không dùng `Math.max` mặc định.

Tiêu chí đạt:

- Đổi từ `today` sang `week/month` không còn số liệu cũ bị lẫn.
- Đổi nhóm không còn user ngoài nhóm trong leaderboard.
- Reset ngày mới không giữ count ngày cũ trên UI.

### P0-07 - Accessibility cơ bản chưa đủ cho thao tác bằng bàn phím

Vị trí: `frontend/src/pages/Leaderboard.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/Groups.jsx`, `frontend/src/components/Layout.jsx`

Hiện trạng:

- Nhiều hàng table/card clickable bằng `onClick` nhưng không có `role`, `tabIndex`, `onKeyDown`.
- Modal nhóm thiếu focus trap, `aria-modal`, ESC close.
- Nhiều icon button thiếu `aria-label`.

Cách sửa:

- Clickable row/card dùng button/link thật nếu có điều hướng.
- Icon button thêm `aria-label`.
- Modal dùng component chuẩn: focus trap, ESC, click backdrop, restore focus.
- Thêm visible focus ring nhất quán.

Tiêu chí đạt:

- Dùng Tab/Enter có thể vào dashboard, leaderboard, group và security actions.
- Screen reader đọc được nút icon chính.

## P1 - Cải thiện mạnh sau P0

### P1-01 - Tách design system thay vì inline style rải rác

Vị trí: toàn bộ `frontend/src/pages`, `frontend/src/components`

Hiện trạng:

- Hầu hết UI viết bằng object inline style trong từng file.
- Button, card, table, badge, avatar, input, modal bị lặp nhiều.
- Đổi theme/màu/responsive phải sửa từng màn.

Cách sửa:

- Tạo `frontend/src/styles/tokens.css` cho màu, spacing, radius, shadow, font size.
- Tạo component dùng chung: `Button`, `Card`, `Badge`, `Table`, `StatCard`, `Avatar`, `EmptyState`, `Skeleton`, `Modal`, `Toast`.
- Chuyển dần từng page sang class/component, ưu tiên `Layout`, `Dashboard`, `Leaderboard`, `Security`.

Kết quả mong muốn:

- UI đồng bộ hơn, ít lỗi layout, sửa theme nhanh.

### P1-02 - Chuẩn hóa trạng thái loading/error/empty

Vị trí: `Dashboard.jsx`, `Leaderboard.jsx`, `Groups.jsx`, `Security.jsx`, `UserDetail.jsx`

Hiện trạng:

- Có page loading toàn màn, có page loading thô, có page fail chỉ log console.
- Leaderboard/search không có empty state đủ rõ.
- Security refresh đang thay cả màn, chưa có trạng thái "đang làm mới".

Cách sửa:

- Tạo 3 state chuẩn: skeleton loading, empty state, error state có nút thử lại.
- Với realtime page, lần đầu load dùng skeleton; refresh sau đó dùng spinner nhỏ ở góc.
- Empty state cần gợi ý action tiếp theo: tạo nhóm, đổi bộ lọc, mở Desktop Tracker.

### P1-03 - Màn Dashboard cần rõ nghĩa số liệu hơn

Vị trí: `frontend/src/pages/Dashboard.jsx`, `backend/src/services/dashboard.service.js`

Hiện trạng:

- KPI so sánh đang dùng snapshot fetch trước đó, không phải "giờ trước/tuần trước/tháng trước" thật.
- Card realtime có thể nhảy số nhưng không giải thích data source.

Cách sửa:

- Backend trả thêm previous period thật: `previousTotal`, `deltaPercent`, `rangeLabel`.
- UI hiển thị "so với 15 phút trước", "so với hôm qua", hoặc bỏ comparison nếu chưa có dữ liệu đúng.
- Thêm nhãn nhỏ "Nguồn: Desktop Tracker" cho các metric activity.

### P1-04 - Leaderboard cần UX filter/search/pagination chắc hơn

Vị trí: `frontend/src/pages/Leaderboard.jsx`

Hiện trạng:

- Mixed language như `RANKING SYSTEM`, `AVG ACTIVITY SCORE: PTS`.
- Search không debounce, không có empty state.
- Podium/card đầu bảng cố định có thể xấu ở mobile.

Cách sửa:

- Việt hóa toàn bộ copy.
- Debounce search 200-300ms.
- Empty state: "Không có người dùng phù hợp".
- Mobile podium chuyển thành list đứng, không cố ép grid.
- Pagination icon button thêm `aria-label`.

### P1-05 - UserDetail đang nặng và nhiều vùng dễ tràn

Vị trí: `frontend/src/pages/UserDetail.jsx`

Hiện trạng:

- Build hiện tại cho thấy chunk `UserDetail` khoảng `403.30 kB`, gzip `111.63 kB`, chủ yếu do chart/table/logic trong một page.
- Grid level `280px 1fr`, top row `1fr 260px`, chart `1fr 240px` cần breakpoint.
- Loading/error còn tiếng Anh: `Loading profile...`, `User not found`.

Cách sửa:

- Tách `UserLevelPanel`, `ActivityHeatmap`, `ActivityChart`, `RecentSessions`.
- Lazy load chart hoặc dùng dynamic import riêng cho Recharts.
- Thêm breakpoint stack 1 cột.
- Việt hóa loading/error.

### P1-06 - Login cần hoàn thiện UX đăng nhập

Vị trí: `frontend/src/pages/Login.jsx`

Hiện trạng:

- Panel trái cố định 420px; mobile chưa tối ưu.
- "Quên mật khẩu?" là text click nhưng chưa có action rõ.
- Placeholder còn `John Doe`, `user@company.com`.

Cách sửa:

- Mobile ẩn/rút gọn brand panel, form chiếm full width.
- Thêm show/hide password bằng icon thư viện.
- Nếu chưa làm forgot password thì disable/ẩn hoặc dẫn tới page rõ.
- Placeholder tiếng Việt, ví dụ `ten@congty.com`.

### P1-07 - Groups cần hoàn thiện flow cộng tác

Vị trí: `frontend/src/pages/Groups.jsx`, `frontend/src/services/api.js`

Hiện trạng:

- API `groups.update/delete/kick` đang throw `pending`.
- Join/create chưa trim/normalize input.
- Thiếu copy invite code, regenerate invite, quản lý thành viên.

Cách sửa:

- Implement đủ API hoặc ẩn action chưa dùng.
- Trim name/description, invite code uppercase.
- Thêm nút copy invite code dùng icon thư viện và toast.
- Modal quản lý thành viên: owner kick/member role nếu backend hỗ trợ.

### P1-08 - Security cần trang điều tra dễ hiểu hơn

Vị trí: `frontend/src/pages/Security.jsx`, `backend/src/services/security.service.js`

Hiện trạng:

- Đã Việt hóa nhưng người quản trị vẫn cần xem bằng chứng cụ thể hơn.
- Summary có flag count nhưng chưa có drilldown event bằng thời gian/thiết bị/user.

Cách sửa:

- Thêm filter `1 ngày / 7 ngày / 30 ngày`.
- Thêm danh sách event nghi vấn gần đây: thời gian, user, device, flag, suspicion score, action "không cộng điểm/khoá".
- Hiển thị rule auto-quarantine rõ: "5 event nghi vấn cao trong 10 phút".
- Với mỗi thiết bị, hiện `revokedAt`, `lastSyncAt`, platform, app version, user.

## P2 - Nâng cấp nên làm

### P2-01 - Mobile navigation và layout shell

Vị trí: `frontend/src/components/Layout.jsx`

Cách sửa:

- Desktop giữ top nav.
- Mobile dùng bottom nav 4 mục chính: Dashboard, Xếp hạng, Nhóm, Tracker.
- Avatar menu chứa Hồ sơ, Bảo mật nếu admin, Cài đặt, Đăng xuất.

### P2-02 - Chuẩn hóa format thời gian, số và timezone

Vị trí: `frontend/src/pages/*`, `backend/src/services/*`

Cách sửa:

- Tạo helper `formatNumber`, `formatDuration`, `formatDateTime`, `formatCompactNumber`.
- Đảm bảo ngày "hôm nay" dùng timezone thống nhất với user Việt Nam hoặc cấu hình workspace, không lẫn UTC ở UI.
- Các biểu đồ nên ghi timezone hoặc lấy local date từ backend.

### P2-03 - Cài đặt và thông báo chưa thành chức năng thật

Vị trí: `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`

Hiện trạng:

- `Settings` và một số page là `Coming soon`.
- Bell icon chưa có notification center.

Cách sửa:

- Nếu chưa làm, ẩn icon/link để tránh người dùng bấm vào trang trống.
- Hoặc làm tối thiểu Settings: thông tin tài khoản, thiết bị đã pair, đăng xuất, đổi mật khẩu.
- Notification center hiển thị security quarantine, desktop offline, session expired.

### P2-04 - Cải thiện onboarding Desktop Tracker

Vị trí: `frontend/src/pages/Tracker.jsx`, `desktop-app/src/renderer/index.html`

Cách sửa:

- Tracker page có checklist trạng thái: Desktop mở chưa, đã pair chưa, Accessibility ok chưa, đang gửi heartbeat chưa.
- Nút "Mở Desktop" có fallback rõ nếu protocol không hoạt động.
- Desktop renderer cũng nên dùng copy tiếng Việt thống nhất, bỏ inline `onclick`, thêm trạng thái lỗi quyền truy cập dễ hiểu.

### P2-05 - Tối ưu performance dữ liệu bảng lớn

Vị trí: `Dashboard.jsx`, `Leaderboard.jsx`, `Security.jsx`

Cách sửa:

- Nếu user/event nhiều, dùng server-side pagination/filter.
- Virtualize bảng dài hoặc ít nhất limit rõ.
- Socket update nên batch/throttle UI render nếu event dày.

### P2-06 - Bổ sung E2E test cho luồng chính

Vị trí: `frontend`, `backend/test`

Cách sửa:

- Thêm Playwright cho các flow: login, dashboard realtime, tracker desktop offline/online, leaderboard filter, security revoke/restore.
- Test responsive bằng screenshot ở 390/768/1440.
- Test keyboard navigation cho modal và table row.

## P3 - Polish và nợ kỹ thuật phụ

- Thay toàn bộ text tiếng Anh còn sót: `Coming soon — under construction`, `Performance Analytics`, `Settings`, `Loading profile...`, `User not found`, `Avg pace`.
- Dùng icon từ `lucide-react` đồng bộ màu/size qua component, không set lẻ từng nơi.
- Giảm animation không cần thiết, hỗ trợ `prefers-reduced-motion`.
- Thêm focus ring đẹp cho mọi button/link/input.
- Thay `console.log/console.warn` realtime backend bằng logger có level theo môi trường.
- Thêm document ngắn cho flow mới: Web chỉ điều khiển, Desktop là nguồn dữ liệu duy nhất.
- Xem lại footer: các link chính sách/tài liệu hiện chỉ là text click, nên ẩn hoặc làm link thật.

## Rà theo từng màn hình

### Layout/Nav

- Vấn đề: top nav có thể quá dài, mobile phải scroll ngang; icon bell/settings chưa có chức năng thật.
- Cách sửa: mobile bottom nav, dropdown avatar chứa mục phụ, ẩn hoặc làm thật các icon chưa có route.

### Login

- Vấn đề: panel trái cố định, placeholder/copy chưa thuần Việt, forgot password chưa có flow.
- Cách sửa: breakpoint mobile, show/hide password, message lỗi chuẩn, bỏ link chưa hoạt động.

### Dashboard

- Vấn đề: KPI comparison chưa chắc đúng theo kỳ trước, card/grid thiếu responsive, realtime merge dễ giữ số cũ.
- Cách sửa: backend trả previous period thật, cache theo filter, skeleton/empty/error chuẩn.

### Leaderboard

- Vấn đề: filter/search/empty state chưa đủ, vài text tiếng Anh, podium có nguy cơ vỡ mobile.
- Cách sửa: debounce search, empty state, mobile list layout, Việt hóa copy.

### Tracker

- Vấn đề: web có thể hiển thị pending/active trước khi Desktop xác nhận; logout xóa toàn bộ localStorage.
- Cách sửa: state machine Desktop-first, timer từ session/heartbeat, logout dùng auth helper.

### Groups

- Vấn đề: `alert/confirm`, API quản trị nhóm còn pending, modal thiếu accessibility.
- Cách sửa: toast/confirm modal, hoàn thiện API hoặc ẩn action, copy invite code, focus trap.

### UserDetail

- Vấn đề: chunk lớn, nhiều grid cố định, text loading/error còn tiếng Anh.
- Cách sửa: tách component, lazy chart, breakpoint 1 cột, Việt hóa.

### Security

- Vấn đề: hành động khóa/mở khóa thiếu confirm/pending, bằng chứng anti-cheat chưa drilldown đủ.
- Cách sửa: confirm modal, event evidence table, filter ngày, thông báo user bị khóa rõ bước tiếp theo.

## Roadmap triển khai đề xuất

### Giai đoạn 1 - Ổn định P0

1. Sửa tracking state machine Desktop-first.
2. Sửa auth redirect/logout dùng helper chung.
3. Thêm `ToastProvider` và `ConfirmDialog`.
4. Thêm responsive breakpoint cho `Layout`, `Security`, `UserDetail`, `Login`.
5. Sửa realtime cache theo `range/teamId`.

### Giai đoạn 2 - Đồng bộ UI

1. Tạo tokens và component chung.
2. Chuyển `Dashboard`, `Leaderboard`, `Security` sang component chung.
3. Chuẩn hóa loading/empty/error.
4. Việt hóa toàn bộ copy còn sót.

### Giai đoạn 3 - Nâng chất lượng production

1. Lazy load chart/UserDetail để giảm bundle.
2. Thêm E2E Playwright cho flow chính.
3. Thêm notification center và settings tối thiểu.
4. Hoàn thiện security drilldown và audit trail.

## Kiểm tra đã chạy trong lần audit

- `npm --prefix frontend run build`: build thành công.
- Build output đáng chú ý: `UserDetail` khoảng `403.30 kB`, gzip `111.63 kB`; main chunk khoảng `282.73 kB`, gzip `92.90 kB`.
- Đếm nhanh hiện có khoảng 17 file frontend JS/CSS trong `frontend/src` và 57 file JS backend trong `backend/src`.

## Checklist nghiệm thu sau khi sửa

- Viewport 390px, 768px, 1440px không vỡ layout.
- Không còn `window.alert`, `window.confirm`, `window.location.href` trong frontend app flow.
- Không còn logout bằng `localStorage.clear()`.
- Tracker không tự đếm khi Desktop offline.
- Bảng xếp hạng đổi range/group không lẫn dữ liệu cũ.
- Security khóa/mở khóa có confirm, pending state và toast kết quả.
- User bị auto-quarantine nhận thông báo rõ và biết cần xử lý gì.
- `npm --prefix frontend run build` pass.
- `npm --prefix backend test` pass.
- E2E login, tracker, leaderboard, security pass ở desktop và mobile.
