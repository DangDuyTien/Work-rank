# WorkRank Motion / Interaction / Performance Audit

Ngày audit: 2026-10-04

## Phạm vi

Đã rà route public, auth, dashboard shell, ranking, YouTube, competition, profile/friends/settings, admin pages, game hub và các component quiz/game/realtime. Các đường đi chính được trace từ `App.jsx` → `Layout.jsx` → page transition → page/component; socket singleton, cache SWR, FLIP list/table, timer và chart cũng được kiểm tra.

## Issue inventory

| ID | Khu vực | Triệu chứng/root cause | Mức độ | Trạng thái |
| --- | --- | --- | --- | --- |
| MOT-01 | Route transition | Route cũ bị giữ trong lúc lazy chunk chờ, có thể tạo blank frame/flash | P1 | Đã sửa: commit route ngay, chỉ animate enter bằng opacity/transform |
| MOT-02 | Ranking / list | FLIP transition cũ còn tồn tại khi event reorder mới đến, gây chồng transform | P1 | Đã sửa: hủy cleanup/transition trước khi chạy FLIP mới |
| MOT-03 | Quiz timer | `setState` ba lần mỗi RAF frame, khiến cả quiz surface render liên tục | P1 | Đã sửa: progress transform và text cập nhật trực tiếp DOM; React chỉ đổi trạng thái urgent/expired |
| MOT-04 | Quiz score | RAF cũ không bị hủy; target mới bắt đầu từ target cũ thay vì giá trị đang hiển thị | P2 | Đã sửa: giữ display ref và cancel frame trước khi tween mới |
| MOT-05 | Quiz result | score roll RAF tiếp tục sau khi modal đổi/unmount | P2 | Đã sửa: lưu/cancel RAF trong cleanup |
| MOT-06 | Dashboard/competition socket | `off(event)` không truyền callback, có thể tháo listener của component khác | P1 | Đã sửa: callback named và cleanup đúng callback |
| MOT-07 | YouTube initial load | `loadAll()` đồng thời với effect filter/search/sort, tạo request trùng khi mount | P2 | Đã sửa: chặn effect phụ cho tới khi batch đầu hoàn tất |
| MOT-08 | Chart | chart wrapper có `key` theo metric/period, buộc SVG remount và mất trạng thái hover | P2 | Đã sửa: bỏ key remount; SVG cập nhật theo props hiện tại |
| MOT-09 | Quiz spotlight | wildcard `transition: all` và `backdrop-filter` trên overlay realtime | P2 | Đã sửa: chỉ transition opacity/transform, bỏ blur nặng |

## Các thay đổi nền tảng đã có

- Chuyển route state sang `useLayoutEffect`, bỏ delay giữ trang cũ và giữ app shell ổn định.
- Scroll container reset đúng khi đi route mới, khôi phục khi Back/Forward.
- Page/modal/drawer motion dùng token hiện có, ưu tiên opacity/transform, có reduced-motion.
- `AnimatedNumber` tránh setState trùng trong RAF.
- FLIP ranking giữ DOM row, hủy animation cũ và cleanup khi unmount.
- Bỏ các `transition: all` còn sót và hạn chế một số `backdrop-filter` ở lớp global/overlay.
- Thêm [.agents/skills/smooth-motion/SKILL.md](.agents/skills/smooth-motion/SKILL.md) làm quy ước audit và triển khai motion.

## Kiểm chứng

- `npm run check`: pass, integrity 93 file, 0 lỗi.
- `npm run build`: pass, Vite build thành công.
- `npm run test:routes`: 20/20 route/component smoke pass.
- `git diff --check`: pass.
- Static scan: không còn `transition: all`; không còn cleanup `socket.off(event)` không có callback.
- Browser smoke trên `http://127.0.0.1:5173/`: Home và Login render được; route bảo vệ chuyển về `/login` đúng; image có kích thước thực tế; không có console error. Có 2 cảnh báo React Router future flag, không phải lỗi runtime.

## Giới hạn đo

Browser tích hợp hiện không cung cấp `window.performance`/Performance DevTools cho tab này, nên không ghi FPS hoặc long-task giả định. Các route cần đăng nhập, socket realtime thật, game lobby/gameplay và mobile thiết bị thật cần được kiểm tra thêm trong môi trường có tài khoản/backend đang phát event. Không kết luận tuyệt đối 60 FPS cho các luồng đó khi chưa có trace thiết bị.
