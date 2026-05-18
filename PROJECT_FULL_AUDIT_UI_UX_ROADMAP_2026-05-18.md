# WorkRank Realtime - Bao cao ra soat chuc nang va UI/UX

Ngay lap: 2026-05-18  
Pham vi: `frontend`, `backend`, `desktop-app`, API, realtime, performance, UI/UX toi gian.

## Cap nhat P0 - 2026-05-18

Da thuc hien:

- [x] Thay `/performance` placeholder bang trang phan tich hieu suat that.
- [x] Them `/performance` vao navigation chinh.
- [x] Hoan thien API weekly/monthly report bang aggregate tu `DailyStat`.
- [x] Hoan thien group API: update, delete, kick member.
- [x] Cap nhat frontend group service de goi API that, khong con throw pending.
- [x] Them UI owner cho sua/xoa nhom va kick thanh vien.
- [x] Gan nhan beta cuc bo cho cuoc thi nhom vi contest van chua co backend sync.
- [x] Them integration test cho weekly/monthly report va group management.

Con lai sau P0:

- [ ] Lam backend sync that cho group contest neu muon day thanh tinh nang chinh.
- [x] Doi user timeline sang `UserMinuteStat` de giam doc raw event.
- [x] Tach/giam nang `UserDetail.jsx`.

## Cap nhat P1 - 2026-05-18

Da thuc hien:

- [x] Endpoint `/api/reports/users/:id/timeline` doc tu `user_minute_stats`, khong doc raw `activity_events`.
- [x] Them integration test xac nhan timeline tra `source: user_minute_stats`.
- [x] Giam chunk `UserDetail` tu khoang 449.94 kB xuong khoang 47.97 kB sau build.
- [x] Bo bo icon animal Noto/react-icons khoi bundle chinh, dung icon toi gian de giam nang va bot roi mat.
- [x] Gioi han danh sach animal/level hien thi quanh cap hien tai, khong render 201 token cung luc.
- [x] Bang milestone level chi hien cac moc gan hien tai thay vi render toan bo 201 row.
- [x] Gallery khong con load anh stock mac dinh; anh profile gallery chi fetch khi khu vuc gallery sap vao viewport.
- [x] Bieu do activity van tach chunk rieng va chi render khi nguoi dung cuon toi khu vuc bieu do.

Con lai sau P1:

- [ ] Chuyen avatar/gallery sang object storage that su thay vi base64 trong DB.
- [ ] Backend sync that cho group contest.
- [x] Giam tiep chunk `UserActivityChart` bang chart SVG nhe.

## Cap nhat P2 - 2026-05-18

Da thuc hien:

- [x] Thay `recharts` trong `UserActivityChart` bang SVG thuan de giam bundle.
- [x] Go cac dependency frontend khong con dung: `recharts`, `@iconify/react`, `@iconify-icons/noto`, `react-icons`.
- [x] Chunk `UserActivityChart` giam tu khoang 384.35 kB xuong khoang 2.82 kB sau build.
- [x] Tong module frontend build giam tu khoang 2658 xuong 1860 module.

Con lai sau P2:

- [ ] Chuyen avatar/gallery sang object storage that su thay vi base64 trong DB.
- [ ] Backend sync that cho group contest.
- [ ] Them frontend smoke/e2e test cho login, dashboard, leaderboard, profile, groups.

## Cap nhat P3 - 2026-05-18

Da thuc hien:

- [x] Them bo UI primitive dung chung trong `frontend/src/components/ui.jsx`: `PageShell`, `PageHeader`, `Section`, `Button`, `Notice`, `StatCard`, state loading/empty/error.
- [x] Them design token/class chung trong `frontend/src/index.css` cho page layout, card, button, segmented control, notice, stat card, table va responsive.
- [x] Them `@keyframes spin` global de khong can inject keyframe rieng trong component.
- [x] Refactor trang `/performance` sang dung UI primitive, gan nhu chi con inline style cho du lieu dong nhu so cot va chieu cao bar.
- [x] Chunk `Performance` giam tu khoang 8.71 kB xuong khoang 5.20 kB sau build.

Con lai sau P3:

- [ ] Lan luot chuyen `Friends`, `Security`, `Tracker`, `Pomodoro`, `Leaderboard`, `Groups` sang UI primitive de giam inline style.
- [ ] Tao smoke/e2e test cho cac luong chinh sau khi UI on dinh.
- [ ] Kiem tra visual tren mobile/desktop bang Playwright screenshot neu can chot UI.

## Cap nhat P4 - 2026-05-18

Da thuc hien:

- [x] Nang cap retention job cho raw `activity_events`: doc `id` cu theo batch, xoa theo `id IN (...)` de giam lock khi bang lon.
- [x] Them cau hinh retention qua env: `RAW_EVENT_RETENTION_DAYS`, `RAW_EVENT_RETENTION_BATCH_SIZE`, `RAW_EVENT_RETENTION_MAX_BATCHES`, `RAW_EVENT_RETENTION_INTERVAL_HOURS`, `RAW_EVENT_RETENTION_DISABLED`.
- [x] Them integration test xac nhan retention chi xoa raw event cu, giu event moi.
- [x] Them API load-smoke script `npm run test:load` cho dashboard, realtime users, leaderboard, users list, weekly/monthly reports.
- [x] Them Playwright smoke tests cho home, login va protected redirect tren desktop/mobile Chromium.

Ket qua kiem tra P4:

- Backend test: pass 20/20.
- Frontend build: pass.
- Playwright smoke: pass 6/6 sau khi cai Chromium cho Playwright.
- API load-smoke local: 21 requests, 0 failed, p95 cao nhat 37ms tren server dang chay local.

Con lai sau P4:

- [ ] Theo doi slow query tren TiDB Cloud khi co traffic that.
- [ ] Mo rong Playwright test cho luong dang nhap that, dashboard, leaderboard, profile sau khi co account test on dinh.
- [ ] Chay load test voi rounds/concurrency cao hon tren staging, khong chay truc tiep production neu chua gioi han.

## Ra soat production server - 2026-05-18

Da kiem tra public production:

- `https://workrank-duy-tien.onrender.com/api/health`: pass, HTTP 200, database OK, response khoang 0.57s.
- `https://workrank-duy-tien.onrender.com/`: pass, HTTP 200, response khoang 0.75s.
- `https://workrank-duy-tien.onrender.com/api/auth/me` khong token: HTTP 401 `Missing access token`, dung hanh vi bao ve API.
- Cac endpoint can auth nhu dashboard, leaderboard, users, reports deu tra HTTP 401 khi khong co token.
- File Windows installer `/downloads/WorkRank%20Tracker-Setup-1.0.0-x64.exe`: pass, HTTP 200, dung content type installer, size khoang 97.7 MB.
- Playwright smoke tren production URL `workrank-duy-tien`: pass 6/6 cho desktop/mobile Chromium: home, login, protected redirect.

Can luu y:

- `https://workrank.onrender.com` trong `render.yaml` dang timeout 20s khi kiem tra public. URL production dang dung thuc te co ve la `https://workrank-duy-tien.onrender.com`.
- Production asset hien tai co `last-modified` ngay 2026-05-17, nen cac thay doi P0-P4 trong workspace nay chi duoc danh gia full o local/staging neu chua commit + deploy len Render.
- Chua test duoc luong dang nhap that tren production vi khong nen dung tai khoan admin ca nhan cho automation. Can tao account test rieng co role phu hop.
- Chua chay load test manh tren production. Hien chi kiem tra public smoke; load-smoke 21 request da chay local, khong thay the duoc so lieu TiDB Cloud production.

Checklist sau khi deploy ban P0-P4 len Render:

- Chay migration/index neu Render khong tu chay migration.
- Kiem tra env production: `CLIENT_URL`, `DESKTOP_WINDOWS_DOWNLOAD_URL`, `RAW_EVENT_RETENTION_DAYS`, `RAW_EVENT_RETENTION_BATCH_SIZE`, `RAW_EVENT_RETENTION_INTERVAL_HOURS`.
- Chay `E2E_BASE_URL=https://workrank-duy-tien.onrender.com npm --prefix frontend exec playwright test` tu dung thu muc/cau hinh frontend.
- Chay `API_BASE_URL=https://workrank-duy-tien.onrender.com TEST_EMAIL=... TEST_PASSWORD=... npm run test:load` voi account test rieng, bat dau concurrency thap.
- Theo doi Render logs va TiDB slow query/statement history trong 30-60 phut sau deploy.
- Neu co spike loi 500 o dashboard/leaderboard, uu tien rollback hoac giam cache TTL/load test truoc khi tang traffic.

## 1. Tom tat nhanh

Du an hien tai da co nen tang chay duoc: dang nhap, dashboard, tracker, leaderboard, pomodoro, friends, groups co ban, profile user, security admin, admin privileges va desktop app. Backend test dang pass, frontend build duoc.

Sau cap nhat P0/P1/P2/P3/P4, cac phan placeholder/pending lon da duoc xu ly mot phan, profile da nhe hon ro ret, bieu do khong con keo dependency chart nang, da co nen UI primitive va da co retention/test/load-smoke co ban. Van con mot so phan can tiep tuc:

- Cuoc thi nhom dang luu `localStorage`, chua dong bo backend; UI da gan nhan beta cuc bo.
- Profile/gallery dang luu base64 trong DB/API, ve lau dai se nang.
- `UserActivityChart` da doi sang SVG thuan, chi con la chunk nho va van chi load khi nguoi dung cuon toi khu vuc bieu do.
- UI primitive da co sau P3, nhung nhieu trang lon van con inline style va can chuyen dan.
- Can theo doi slow query tren TiDB Cloud voi traffic that vi local smoke khong thay the duoc production load.

## 2. Ket qua kiem tra ky thuat

Da kiem tra:

```bash
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend run test:e2e
npm run test:load
git status --short
```

Ket qua:

- Backend test: pass 20/20 sau P4.
- Frontend build: pass sau P4.
- Playwright smoke: pass 6/6 sau P4.
- API load-smoke: pass 21/21 request local sau P4.
- Git status: co cac file dang sua cua dot P0/P1/P2/P3/P4, can commit khi chot.
- Chunk `UserDetail` da giam con khoang 47.97 kB sau P1; chunk bieu do rieng da giam tu khoang 384.35 kB xuong khoang 2.82 kB sau P2.
- Chunk `Performance` da giam tu khoang 8.71 kB xuong khoang 5.20 kB sau P3.

Y nghia:

- He thong khong bi vo build/test o muc co ban.
- Van can test UI/e2e vi frontend hien chua co test luong nguoi dung ro rang.

## 3. Ma tran trang thai chuc nang

| Chuc nang | Trang thai | Nhan xet |
| --- | --- | --- |
| Auth/login | Tuong doi on | Co protected route, admin route. Can them e2e login/logout. |
| Dashboard | Dang dung duoc | Da co cache/aggregate, nhung can giam panel va lam ro so lieu hien thi. |
| Tracker | Dang dung duoc | Co desktop status/realtime. UI hoi day thong tin. |
| Leaderboard | Kha tot | Da phan trang/backend SQL/cache. Can them test query va lam UI nhe hon. |
| Profile/User detail | Da nhe hon sau P2 | Chunk chinh da giam manh, gallery/chart lazy-load, chart SVG nhe. Van can object storage cho anh. |
| Friends | Co ban on | Can test realtime presence va pagination khi nhieu ban be. |
| Groups | Da sua mot phan P0 | Co create/join/leave/update/delete/kick. Contest van localStorage beta cuc bo. |
| Pomodoro | Nhieu tinh nang | File qua lon, UI nen rut gon thanh focus-first. |
| Reports | Da sua P0/P1 | Weekly/monthly dung `DailyStat`, timeline dung `UserMinuteStat`. |
| Security | Kha tot | Route admin-only, co anomalies/events/devices. Can them UI test. |
| Admin privileges | Co chuc nang | Can kiem tra UX cap huy hieu/dac quyen ro rang hon. |
| Performance page | Da co sau P0 | Trang `/performance` da co tong quan weekly/monthly va nam trong navigation. |
| Desktop app | Co nen tang | Windows can dam bao installer/link va protocol handler. |

## 4. Cac diem chua hoan thien can sua

### P0 - Nen sua truoc

#### 4.1. Trang `/performance` chua co noi dung that - da xu ly P0

File lien quan:

- `frontend/src/App.jsx`

Trang `/performance` ban dau render `ComingSoon`. Sau P0, route nay da duoc thay bang trang phan tich hieu suat that.

Tac dong ban dau:

- Nguoi dung bam vao menu se thay trang tam.
- Lam cam giac san pham chua xong.

Huong sua:

- Neu chua lam performance report that, an menu nay khoi sidebar.
- Neu muon giu, lam dashboard toi gian gom:
  - Tong thoi gian active theo 7 ngay.
  - Keystroke/click trend.
  - Focus score trung binh.
  - Top ngay lam viec tot nhat.

#### 4.2. Weekly/monthly reports dang pending - da xu ly P0

File lien quan:

- `backend/src/controllers/reports.controller.js`
- `backend/src/routes/reports.routes.js`

Trang thai ban dau:

- `userWeekly` tra `{ data: [], message: 'Weekly report aggregation pending' }`.
- `userMonthly` tra `{ data: [], message: 'Monthly report aggregation pending' }`.

Sau P0:

- `userWeekly` va `userMonthly` da aggregate tu `DailyStat`.
- Da them integration test cho hai endpoint nay.

Tac dong:

- UI neu goi weekly/monthly se khong co du lieu that.
- Report dai han khong dung duoc cho nguoi dung.

Huong sua:

- Tinh tu `DailyStat`, group theo tuan/thang bang SQL.
- Tra format thong nhat voi daily:
  - `periodStart`
  - `periodEnd`
  - `activeSeconds`
  - `idleSeconds`
  - `keystrokeCount`
  - `mouseClickCount`
  - `sessionCount`
  - `focusScore`

#### 4.3. Group API chua du CRUD va quan tri thanh vien

File lien quan:

- `frontend/src/services/api.js`
- `backend/src/routes/groups.routes.js`
- `backend/src/controllers/groups.controller.js`
- `backend/src/services/group.service.js`

Hien tai:

- Backend co: list, create, join, leave.
- Frontend service dang throw error cho:
  - update group
  - delete group
  - kick member

Tac dong:

- UI co the hien nut nhung bam se loi.
- Admin/chu nhom khong quan ly duoc nhom.

Huong sua:

- Them role trong group: owner/admin/member hoac toi thieu chi nguoi tao nhom duoc sua/xoa/kick.
- Them API:
  - `PATCH /api/groups/:id`
  - `DELETE /api/groups/:id`
  - `POST /api/groups/:id/kick`
- Them validate va test backend.

#### 4.4. Cuoc thi nhom dang luu localStorage

File lien quan:

- `frontend/src/pages/Groups.jsx`

Hien tai:

- Contest luu trong `localStorage` voi key `workrank:group-contests:v1`.
- Thanh vien nhap theo ma `WRU-xxxx`.
- Diem lay tu API user/activity nhung cau hinh tran dau khong luu backend.

Tac dong:

- May khac/user khac khong thay cung mot contest.
- Reload trinh duyet khac mat du lieu.
- Khong phu hop voi tinh nang nhom realtime.

Huong sua:

- Tao bang backend:
  - `group_contests`
  - `group_contest_members`
  - `group_contest_results`
- API:
  - create contest
  - list contest by group
  - add/remove member
  - close contest
- Tinh score bang snapshot tai thoi diem bat dau va hien tai.

### P1 - Nen sua som

#### 4.5. Timeline user con doc raw events - da xu ly P1

File lien quan:

- `backend/src/controllers/reports.controller.js`

Trang thai ban dau:

- `userTimeline` doc `ActivityEvent.findAll`, sau do bucket trong Node.

Sau P1:

- `userTimeline` doc tu `UserMinuteStat`.
- Response co `source: user_minute_stats`.
- Da them integration test cho endpoint nay.

Tac dong:

- Khi `activity_events` lon, profile/timeline se cham.
- Khong phu hop muc tieu toi uu cho du lieu lon.

Huong tiep tuc:

- Neu can toi uu them, aggregate SQL theo hour/minute thay vi bucket trong Node tren `UserMinuteStat`.
- Raw event chi giu cho debug/security ngan han.

#### 4.6. Profile/gallery luu base64 trong database

File lien quan:

- `backend/src/controllers/users.controller.js`
- `frontend/src/pages/UserDetail.jsx`

Hien tai:

- Avatar max 1.5 MB data URL.
- Profile gallery moi anh max 2.5 MB data URL.
- Gallery co nhieu slot, co the day JSON len rat lon.

Tac dong:

- API profile nang.
- DB phinh nhanh.
- Frontend render cham, dac biet tren mobile.

Huong sua:

- Chuyen anh sang object storage: S3, R2, Cloudinary hoac Supabase Storage.
- DB chi luu:
  - `image_url`
  - `thumbnail_url`
  - `width`
  - `height`
  - `size`
  - `mime_type`
- Profile list khong tra anh goc.
- Gallery lazy-load khi mo tab anh.

#### 4.7. `UserDetail.jsx` qua lon - da giam P1

File lien quan:

- `frontend/src/pages/UserDetail.jsx`

Van de ban dau:

- File gan 2000 dong.
- Import nhieu icon `@iconify-icons/noto`.
- Build tao chunk rieng lon khoang 449.90 kB.

Tac dong:

- Trang profile load cham hon can thiet.
- Kho bao tri, de sinh bug UI.
- Icon/hieu ung nhieu co the gay roi mat.

Sau P1:

- Bo icon animal Noto/react-icons khoi chunk chinh.
- Giam `UserDetail` tu khoang 449.94 kB xuong khoang 47.97 kB.
- Gallery va chart chi load khi sap vao viewport.
- Animal collection va milestone table chi render phan gan hien tai.

Huong sua tiep:

- Tach component:
  - `UserProfileHeader`
  - `UserStatsOverview`
  - `UserActivityTimeline`
  - `UserBadges`
  - `UserGallery`
  - `UserLevelRoadmap`
- Lazy-load:
  - Gallery
  - Animal level collection
  - Chart/timeline nang
- Chi hien 3-5 thong tin quan trong tren first viewport.

#### 4.8. Windows desktop installer can cau hinh ro

File lien quan:

- `backend/src/app.js`
- `render.yaml`
- `desktop-app/package.json`

Hien tai:

- Backend co fallback khi khong tim thay installer.
- Can set `DESKTOP_WINDOWS_DOWNLOAD_URL` hoac upload file vao `DESKTOP_DOWNLOAD_DIR`.

Tac dong:

- User Windows bam tai app co the khong tai duoc.
- Anh huong truc tiep den tracking desktop.

Huong sua:

- Build release Windows bang `npm run dist:win`.
- Upload `.exe` len GitHub Release/R2/S3.
- Set env:
  - `DESKTOP_WINDOWS_DOWNLOAD_URL`
  - `VITE_DESKTOP_WINDOWS_DOWNLOAD_URL`
- Test tu Windows that:
  - install
  - login
  - connect socket
  - send activity batch

### P2 - Cai thien chat luong

#### 4.9. UI dung nhieu inline style va panel day

Cap nhat P2:

- Da xu ly rieng phan bieu do nang bang SVG thuan trong `UserActivityChart`.
- Viec nay giam chi phi load profile, nhung chua thay the nhu cau lam design token va don UI toan app.

File lien quan:

- `frontend/src/pages/UserDetail.jsx`
- `frontend/src/pages/Pomodoro.jsx`
- `frontend/src/pages/Tracker.jsx`
- `frontend/src/pages/Leaderboard.jsx`
- `frontend/src/pages/Groups.jsx`
- `frontend/src/components/Layout.jsx`

Van de:

- Nhieu style nam truc tiep trong component.
- Nhieu card/panel canh nhau.
- Nhieu mau/hieu ung trong cung mot man hinh.

Tac dong:

- Kho dong bo giao dien.
- Nguoi dung de moi mat khi dung lau.
- Sua UI ton cong vi khong co design token chung.

Huong sua:

- Tao design tokens:
  - background: `#f8fafc`
  - surface: `#ffffff`
  - text strong: `#0f172a`
  - text muted: `#64748b`
  - border: `rgba(15,23,42,0.08)`
  - primary: `#0f172a`
  - accent: `#38bdf8`
- Giam gradient, shadow va animation.
- Dung card chi cho item lap lai, modal, tool surface.
- Moi trang chi nen co 1 hanh dong chinh noi bat.

#### 4.10. Thieu frontend/e2e test

Hien tai:

- Backend co test integration va fraud detection.
- Frontend chua thay test e2e/smoke.

Tac dong:

- De vo luong UI khi sua component lon.
- Kho phat hien loi Windows/browser khac nhau.

Huong sua:

- Them Playwright smoke test:
  - login
  - dashboard load
  - tracker load
  - leaderboard pagination/search
  - user detail load
  - groups create/join
- Them visual smoke cho viewport desktop/mobile.

## 5. UI/UX toi gian nhung van day du

Muc tieu: nguoi dung nhin vao biet ngay viec can lam, nhung khong bi ngop boi panel, animation va mau sac.

### Nguyen tac chung

- Mot man hinh chi co mot hanh dong chinh.
- So lieu quan trong len dau, chi tiet dua xuong duoi hoac vao tab.
- Dung mau trung tinh lam nen, mau nhan chi cho trang thai/huy hieu/action.
- Giam animation lap vo han, chi de animation nhe cho realtime/update.
- Khong hien qua 5-7 khoi thong tin tren first viewport.
- Table/list can scan nhanh: label ngan, spacing deu, font size on dinh.
- Empty state phai ro viec can lam tiep theo.
- Loading state nen skeleton gon, khong nhay layout.

### Dashboard

Nen giu:

- Active time hom nay.
- Keystroke/click hom nay.
- Focus score.
- Desktop status.
- Bang top user hoac activity gan day.

Nen giam:

- Qua nhieu card phu.
- Nhieu icon mau cung luc.
- Animation nen.

De xuat layout:

1. Header nho: ten user + desktop status.
2. 4 metric cards.
3. Realtime activity table.
4. Leaderboard mini.
5. Advanced analytics collapse.

### Leaderboard

Nen giu:

- Filter range: hom nay, tuan, thang, nam.
- Search.
- Group/friends filter.
- Bang xep hang co pagination.
- Huy hieu dac quyen trong khung user.

Nen giam:

- Podium qua lon neu lam nguoi dung phai scroll moi thay bang.
- Nhieu animation tren tung row.

De xuat:

- Top 3 compact.
- Table la noi dung chinh.
- Huy hieu dev/partner/founder chi co vien nhe, animation cham.

### User Detail

Nen chia thanh tab:

- Tong quan
- Hoat dong
- Huy hieu
- Anh

First viewport chi nen co:

- Avatar + ten + verified.
- Huy hieu dac quyen.
- 3 metric chinh.
- CTA ket ban / xem leaderboard / nhan tin neu co.

Anh/gallery:

- Lazy-load.
- Hien thumbnail.
- Chi load anh goc khi click xem.

Level animals:

- Chi hien level hien tai + level ke tiep.
- Danh sach 200 level dua vao modal hoac tab rieng.

### Tracker

Nen tap trung vao:

- Trang thai desktop da ket noi hay chua.
- Nut bat/dung tracking neu co.
- So lieu realtime hom nay.
- Huong dan cap quyen desktop neu loi.

Nen giam:

- Nhieu panel giai thich ky thuat.
- Nhieu trang thai phu tren cung man hinh.

### Pomodoro

Nen tap trung vao:

- Timer lon.
- Task hien tai.
- Start/pause/reset.
- 3 thong so: focus sessions, focus time, streak.

Nen dua xuong duoi:

- History.
- Friends focus.
- Settings nang cao.

### Groups

Cho toi khi backend contest xong:

- Hien create/join/leave group.
- An hoac gan nhan beta cho contest.
- Khong nen lam contest thanh tinh nang chinh neu du lieu chua sync.

Sau khi backend contest xong:

- Tab `Tong quan`
- Tab `Thanh vien`
- Tab `Cuoc thi`
- Tab `Leaderboard nhom`

## 6. Huong toi uu du lieu lon

He thong da co mot so nen tang dung:

- `/api/users` phan trang.
- Leaderboard query SQL va cache.
- Redis cache co fallback memory.
- Socket batch update.
- `UserMinuteStat` va `DailyStat` cho aggregate.

Can lam tiep:

### 6.1. Khong load du lieu lon truc tiep len UI

- Moi list deu phai co `page`, `limit`, `search`.
- Khong tra base64 trong list.
- Khong tra raw event trong trang user.
- Dung cursor pagination neu du lieu cuc lon.

### 6.2. Tach raw event va aggregate

- Raw `activity_events`: giu ngan han cho debug/security.
- `user_minute_stats`: dung cho realtime/timeline ngan.
- `daily_stats`: dung cho dashboard, leaderboard, report.
- Snapshot leaderboard neu luu luong rat lon.

### 6.3. Cache theo muc do thay doi

- Dashboard today: TTL 5-10 giay.
- Leaderboard today: TTL 5-10 giay.
- Leaderboard week/month/year: TTL 30-120 giay.
- Online users: TTL 5 giay.
- Profile public: TTL 30-60 giay, invalidate khi user update.

### 6.4. Socket

Da co batch 1 giay. Nen tiep tuc:

- Merge update theo user.
- Chi push room can thiet: `user`, `team`, `dashboard`.
- Khong push full leaderboard moi event.
- Client tu refresh leaderboard theo interval/cache.

### 6.5. Database/index

Nen dam bao cac bang lon co index:

- `activity_events(event_time)`
- `activity_events(event_time, user_id)`
- `activity_events(device_id, created_at, suspicion_score)`
- `daily_stats(stat_date, user_id)`
- `daily_stats(stat_date, rank_position)`
- `user_minute_stats(user_id, bucket_start_at)`
- `user_minute_stats(stat_date, user_id)`
- `devices(user_id, last_sync_at)`
- `work_sessions(user_id, status, started_at)`
- `users(status, team_id)`

## 7. Roadmap de hoan thien

### Phase 1 - Sua cac diem lo ro trong UI/API

Muc tieu: nguoi dung khong bam vao tinh nang rong hoac loi.

Checklist:

- [x] An hoac lam that trang `/performance`.
- [x] Hoan thien weekly/monthly report.
- [x] Hoan thien group update/delete/kick.
- [ ] Gan nhan beta hoac an contest nhom neu chua co backend.
- [ ] Dam bao Windows download URL hoat dong.

### Phase 2 - Giam nang va toi uu profile

Muc tieu: profile load nhanh, giao dien gon.

Checklist:

- [x] Tach/giam nang phan icon trong `UserDetail.jsx`.
- [x] Lazy-load gallery theo viewport.
- [x] Giam render level/animal collection.
- [x] Thay `recharts` bang SVG thuan cho `UserActivityChart`.
- [ ] Chuyen gallery/avatar sang URL/thumbnail.
- [ ] Rut gon first viewport cua profile.

### Phase 3 - UI/UX toi gian dong bo

Muc tieu: app nhin gon, it moi mat, van day du chuc nang.

Checklist:

- [x] Tao design tokens chung.
- [ ] Giam inline style o cac page lon. Da lam cho `/performance`, can lam tiep cac page con lai.
- [x] Dong bo card/button/input/table o muc primitive dung chung.
- [x] Giam animation lap vo han o muc nen bang reduced-motion va spin global; can tiep tuc quet tung page.
- [x] Them empty/loading/error state dong bo o muc primitive dung chung.
- [ ] Kiem tra mobile/desktop viewport.

### Phase 4 - Scale va test

Muc tieu: chiu duoc nhieu user va han che regression.

Checklist:

- [x] Doi timeline sang `UserMinuteStat`.
- [x] Them retention job cho raw `activity_events`.
- [x] Them Playwright smoke tests.
- [x] Them API tests cho groups/reports.
- [x] Load test endpoint chinh: dashboard, leaderboard, users, reports.
- [ ] Theo doi query cham tren TiDB Cloud.

## 8. Danh sach viec nen lam ngay

Neu muon di theo thu tu it rui ro, nen lam:

1. Hoan thien weekly/monthly report. Da xong trong P0.
2. Hoan thien group API update/delete/kick. Da xong trong P0.
3. An hoac lam that `/performance`. Da xong trong P0.
4. Tach/giam nang `UserDetail.jsx` va lazy-load gallery/icon. Da xong phan giam nang trong P1.
5. Doi timeline sang aggregate. Da xong trong P1.
6. Them Playwright smoke test.

## 9. Ket luan

WorkRank hien da co khung san pham tot va nhieu tinh nang that. Van de lon nhat khong phai "thieu giao dien", ma la mot so tinh nang dang hien ra truoc nguoi dung khi backend chua dong bo hoan chinh, cong voi mot vai man hinh qua day thong tin.

Huong dung nen la:

- Giu app toi gian hon.
- Chi hien tinh nang da co du lieu that.
- Dua thong tin nang vao tab/collapse/lazy-load.
- Dung aggregate/cache cho moi du lieu lon.
- Them test UI de tranh loi khi tiep tuc refactor.
