# Bao cao ra soat realtime va chuc nang WorkRank

Ngay ra soat: 2026-05-13  
Pham vi: `backend/src`, `frontend/src`, `desktop-app/src`, `tracker.js`. Thu muc `backend-legacy` chi duoc xem la ma cu de tham khao, khong dua vao huong sua chinh.

## Tom tat ngan

Realtime hien chua dang tin cay. Co 2 pipeline song song nhung khong khop nhau:

- Web tracker gui `activity:heartbeat` qua Socket.IO, backend socket goi truc tiep `activityService.upsertDailyStat`.
- Desktop app gui `/api/activity/batch`, controller lai emit `dashboard:overview:update` va `leaderboard:update`.
- Frontend dashboard/leaderboard hien chi nghe `activity:user:update` va `user:status:update`.

Ngoai ra, `upsertDailyStat` dang khong duoc export tu `activity.service.js`, nen heartbeat qua socket hien se loi va khong luu DB. Nhieu chuc nang khac nhu nhom, weekly/monthly leaderboard, group leaderboard, heatmap, timeline va reports dang la stub hoac tra du lieu sai ngu nghia.

## Muc do uu tien

- P0: Loi lam realtime hoac du lieu thong ke sai nghiem trong.
- P1: Chuc nang hien thi/luong nghiep vu sai, can sua truoc khi dung that.
- P2: No ky thuat, UX, logging, test, cau hinh, can xu ly sau P0/P1.

## P0 - Loi realtime va du lieu can sua ngay

### 1. Socket heartbeat dang goi ham khong duoc export

Bang chung:

- `backend/src/sockets/index.js:38` goi `activityService.upsertDailyStat(...)`.
- `backend/src/services/activity.service.js:185` chi export `{ startSession, endSession, ingestBatch, todayStats, realtimeUsers }`, khong export `upsertDailyStat`.

Tac dong:

- Moi `activity:heartbeat` tu web tracker se vao `catch` voi loi `activityService.upsertDailyStat is not a function`.
- Backend khong luu `DailyStat`.
- Backend cung khong emit `activity:user:update` vi emit nam sau lenh `await` bi loi.
- Web dashboard khong nhan realtime tu tracker web.

Cach sua:

1. Khong nen chi export them `upsertDailyStat` roi dung tiep, vi socket heartbeat hien bypass anti-cheat. Nen hop nhat ve 1 pipeline ingest duy nhat.
2. Tao service moi, vi du `activityService.ingestRealtimeHeartbeat(userId, payload)`, co validate payload, tinh delta, ghi `ActivityEvent`, cap nhat `DailyStat`, cap nhat `WorkSession`, roi tra ve snapshot/delta chuan.
3. Neu can sua tam thoi de chay demo, export `upsertDailyStat`, nhung phai them validate va gioi han payload truoc khi goi.

### 2. Hai pipeline realtime khong khop event contract

Bang chung:

- Socket backend emit `activity:user:update` o `backend/src/sockets/index.js:46`.
- HTTP batch backend emit `dashboard:overview:update`, `leaderboard:update`, va `activity:user:update` chi vao room user o `backend/src/controllers/activity.controller.js:7-10`.
- Dashboard chi listen `activity:user:update` va `user:status:update` o `frontend/src/pages/Dashboard.jsx:191-196`.
- Leaderboard chi listen `activity:user:update` o `frontend/src/pages/Leaderboard.jsx:160-161`.

Tac dong:

- Desktop app gui batch thanh cong nhung dashboard/leaderboard web gan nhu khong cap nhat live, vi frontend khong nghe `dashboard:overview:update` va `leaderboard:update`.
- `activity:user:update` do batch emit vao `user:${req.user.id}` lai chi co `{ userId }`, khong co delta/totals, nen khong du cho UI.
- Web tracker va desktop tracker co du lieu realtime khac nhau, de gay lech giua DB va UI.

Cach sua:

1. Dinh nghia 1 event contract chung, vi du:

```js
activity:user:update = {
  userId,
  name,
  teamId,
  statDate,
  presence,
  delta: { activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, mouseMoveCount },
  totals: { activeSeconds, idleSeconds, keystrokeCount, mouseClickCount, focusScore },
  sequenceRange,
  lastEventAt
}
```

2. Sau moi batch/heartbeat hop le, backend emit cung payload vao:

- `user:${userId}`
- `team:${teamId}` neu co
- `dashboard` neu user hien tai co quyen xem dashboard toan cuc

3. Frontend Dashboard/Leaderboard chi cap nhat theo event chuan nay, hoac nghe `leaderboard:update` de replace danh sach tu server, khong vua cong local vua fetch roi `Math.max`.

### 3. Web socket heartbeat bypass anti-cheat va co the bi fake so lieu

Bang chung:

- `frontend/src/context/TrackingContext.jsx:80-84` emit `{ keystrokes, clicks, activeSeconds: 2.5 }`.
- `backend/src/sockets/index.js:33-46` nhan payload va ghi thang vao daily stat, khong co Zod validation, device, session, sequence, signature, suspicion score.
- Pipeline `/api/activity/batch` lai co device secret, HMAC, sequence, fraud detection o `backend/src/services/activity.service.js:130-158`.

Tac dong:

- Client co the emit bat ky so `keystrokes/clicks/activeSeconds` nao.
- Du lieu qua socket khong co `ActivityEvent`, khong vao anti-cheat, khong co audit trail.
- `DailyStat` co the bi cong sai hoac gian lan.

Cach sua:

1. Bo ghi DB truc tiep trong socket.
2. Neu web tracker con duoc dung, cho no goi chung `/api/activity/batch` voi device/session/sequence/signature, hoac tao endpoint rieng nhung van di qua `ingestBatch`.
3. Socket chi nen dung de nhan update tu server va gui tin hieu presence nhe, khong lam duong ghi thong ke chinh.

### 4. Web tracker cong active time khi khong co input va mat du lieu khi socket disconnect

Bang chung:

- `frontend/src/context/TrackingContext.jsx:73-85` emit heartbeat moi 2.5 giay ke ca khi `k = 0` va `c = 0`.
- Payload luon co `activeSeconds: 2.5`.
- `frontend/src/context/TrackingContext.jsx:87-96` reset counter va tang score neu co input, bat ke socket co gui thanh cong hay khong.
- `connected` khoi tao `true` va chi set `true`, khong co handler `disconnect/connect_error`.

Tac dong:

- Neu user bat tracking nhung khong thao tac, active time van tang.
- Neu socket mat ket noi, key/click co the bi reset local va mat, vi khong co ack tu server.
- UI van hien connected du socket da mat.

Cach sua:

1. Track `lastFlushAt` va `lastActivityAt`; moi lan flush chi gui delta that su.
2. Chi tinh `activeSeconds` khi co input trong cua so thoi gian, nguoc lai tinh `idleSeconds`.
3. Dung ack cua Socket.IO hoac HTTP response. Chi reset counters sau khi server xac nhan da ghi.
4. Them listener `socket.on('connect')`, `socket.on('disconnect')`, `socket.on('connect_error')` de cap nhat `connected`.
5. Khi offline, dua event vao queue local va retry.

### 5. Desktop app tinh idleSeconds sai, co the cong lap idle time

Bang chung:

- `desktop-app/src/main/main.js:112-116` tinh `elapsed = now - lastActivity`.
- Khi idle, `idleSeconds = Math.min(elapsed, 300)`.
- `lastActivity` khong doi sau moi ping idle.

Tac dong:

Vi du user idle 60 giay, ping moi 5 giay:

- Ping o giay 20 gui idle 20.
- Ping o giay 25 gui idle 25.
- Ping o giay 30 gui idle 30.

Tong idle bi cong lap va lon hon thoi gian thuc.

Cach sua:

1. Them `lastFlushAt`.
2. Moi event gui delta tu `lastFlushAt` den `now`, khong dung tong elapsed tu `lastActivity`.
3. Pseudocode:

```js
const windowSeconds = Math.floor((now - lastFlushAt) / 1000);
const idleFor = Math.floor((now - lastActivity) / 1000);
const idleSeconds = idleFor > IDLE_THRESHOLD ? windowSeconds : 0;
const activeSeconds = idleSeconds ? 0 : windowSeconds;
lastFlushAt = now;
```

### 6. Cap nhat `DailyStat` khong atomic, co nguy co lost update

Bang chung:

- `backend/src/services/activity.service.js:68-82` doc row hien tai roi update bang `stat.activeSeconds + delta.activeSeconds`.
- Nhieu batch/heartbeat cung user cung ngay co the chay song song.

Tac dong:

- 2 request dong thoi doc cung gia tri cu, request sau ghi de request truoc.
- Tong ke ngay, leaderboard va report bi thieu du lieu.

Cach sua:

1. Dung transaction voi row lock khi doc/update daily stat.
2. Hoac dung `DailyStat.increment(...)` cho cac counter, sau do tinh lai `totalSeconds/focusScore`.
3. Tot nhat la dung upsert atomic theo DB, vi du MySQL `INSERT ... ON DUPLICATE KEY UPDATE active_seconds = active_seconds + VALUES(active_seconds)`.
4. Them test concurrency cho 20 batch dong thoi cung user/device.

### 7. Sequence chong replay chua an toan khi co request dong thoi

Bang chung:

- `backend/src/services/activity.service.js:134-141` doc `device.lastSequence` truoc transaction.
- Migration chi add index `activity_events(device_id, sequence)`, khong unique o `backend/src/migrations/20260510000200-add-anti-cheat-fields.js`.

Tac dong:

- Hai batch cung sequence co the cung qua check neu chay song song.
- Du lieu replay co the bi ghi thanh event rieng.

Cach sua:

1. Dat unique index `(device_id, sequence)` voi dieu kien sequence not null neu DB ho tro.
2. Dua viec doc/update `Device.lastSequence` vao transaction va lock row device.
3. Neu insert gap duplicate sequence, tra 409 hoac danh dau replay, khong cong vao trusted stats.

## P1 - Chuc nang hien thi va nghiep vu sai

### 8. Weekly/monthly leaderboard dang tra du lieu daily

Bang chung:

- `backend/src/controllers/leaderboard.controller.js:7-12` weekly/monthly deu goi `dashboardService.leaderboard(...)`.
- `dashboardService.leaderboard` luon dung `statDate = today()` o `backend/src/services/dashboard.service.js:43-52`.

Tac dong:

- Nut "Tuan nay" va "Thang nay" tren Dashboard/Leaderboard hien cung du lieu hom nay.
- Nguoi dung tuong dang xem range nhung thuc te khong phai.

Cach sua:

1. Tao service `leaderboardService.get({ range, teamId, limit })`.
2. Voi `today`: filter `statDate = localToday`.
3. Voi `week/month`: aggregate `DailyStat` theo khoang ngay, group by user.
4. Sort theo score tinh lai tren tong active/idle hoac theo cong thuc rank rieng.

### 9. Group leaderboard khong loc theo team/group

Bang chung:

- Frontend goi `leaderboardApi.group(selectedGroupId, range)` o `frontend/src/pages/Leaderboard.jsx:93-95`.
- API client bo qua range o `frontend/src/services/api.js:112-115`.
- Backend `team(req, res)` o `backend/src/controllers/leaderboard.controller.js:15-17` chi goi leaderboard toan cuc va tra them `teamId`, khong filter.

Tac dong:

- Trang xep hang nhom hien top toan cuc, khong phai nhom duoc chon.
- Range cua group cung khong co tac dung.

Cach sua:

1. Them `teamId` vao query service leaderboard.
2. Loc `User.teamId = req.params.teamId` hoac join bang membership neu doi thanh many-to-many.
3. Sua API client: `group: (groupId, range) => /api/leaderboard/team/:groupId?range=...`.
4. Them test: user A team 1, user B team 2, goi team 1 khong duoc co user B.

### 10. Chuc nang Groups dang la UI gia, API stub

Bang chung:

- `frontend/src/services/api.js:126-134` `groups.list` tra `[]`, cac ham create/join/leave/kick throw `Groups API pending on new backend`.
- `frontend/src/pages/Groups.jsx:40-82` UI goi cac ham nay nhu chuc nang that.
- Backend moi khong co route `/api/groups`.

Tac dong:

- Trang Nhom luon trong hoac bao loi.
- Leaderboard theo group khong co danh sach group de chon.

Cach sua:

1. Quyet dinh model: moi user chi co `teamId` hay can nhieu group.
2. Neu can nhieu group nhu UI hien tai, them bang `groups`, `group_members`, `invite_code`, `role`.
3. Tao route:

- `GET /api/groups`
- `POST /api/groups`
- `POST /api/groups/join`
- `POST /api/groups/:id/leave`
- `PATCH /api/groups/:id`
- `DELETE /api/groups/:id`

4. Sua frontend API client dung route that va hien error tu `message`, khong chi `error`.

### 11. Dashboard tong so dang tinh tren top N, khong phai toan he thong

Bang chung:

- Dashboard fetch `leaderboard.get(selectedRange)` o `frontend/src/pages/Dashboard.jsx:88-92`.
- `backend/src/controllers/leaderboard.controller.js:3-4` default limit 10.
- Dashboard tinh totals bang reduce tren `users` hien co o `frontend/src/pages/Dashboard.jsx:120-124` va `200-207`.

Tac dong:

- Card "Tong so lan go phim/click" co the chi la top 10 user, khong phai tong toan cong ty/nhom.

Cach sua:

1. Dashboard summary nen dung endpoint rieng `GET /api/dashboard/overview?range=...` de aggregate tren toan bo user phu hop.
2. Leaderboard chi phuc vu bang xep hang va co pagination/limit ro rang.
3. Ten field UI nen phan biet "Top 10" va "Tong toan he thong" neu van dung leaderboard.

### 12. Presence/offline logic sai voi nhieu tab/thiet bi

Bang chung:

- Moi socket disconnect emit offline ngay o `backend/src/sockets/index.js:52-54`.
- Moi socket deu join `dashboard` o `backend/src/sockets/index.js:25`.
- Frontend status chi update tren record da co o `frontend/src/pages/Dashboard.jsx:178-188`.

Tac dong:

- User mo 2 tab, dong 1 tab se bi danh offline du tab con lai van online.
- User dung desktop app khong mo web socket co the khong co presence dung.

Cach sua:

1. Backend can quan ly presence theo `userId -> socket count`.
2. Chi emit offline khi socket count ve 0 va qua grace period, vi du 15-30 giay.
3. Presence nen duoc tinh tu `lastEventAt`, socket connection va trang thai tracking, khong tin hoan toan payload client.
4. Dung event rieng `user:presence:update`, payload chi gom status hop le va timestamp server.

### 13. Account status bi tron voi realtime presence

Bang chung:

- Model `User.status` la enum `active/inactive` o `backend/src/models/User.js`.
- Frontend normalize status `row.status || user.status || 'active'` o `frontend/src/services/api.js:31-35`.
- User detail dung `user.status` de hien `Dang hoat dong` o `frontend/src/pages/UserDetail.jsx`.

Tac dong:

- Tai khoan `active` co the bi hien nhu dang hoat dong realtime.
- `inactive` la trang thai tai khoan, khong phai offline.

Cach sua:

1. Doi frontend field thanh `accountStatus` va `presenceStatus`.
2. Backend tra presence rieng: `online/active/idle/offline`.
3. Khong map `User.status` sang UI realtime status.

### 14. UserDetail, heatmap, timeline va session dang dung du lieu rong/gia

Bang chung:

- `frontend/src/services/api.js:94-95` `timeline` va `heatmap` tra `{ data: [] }`.
- `frontend/src/pages/UserDetail.jsx:109-113` recent sessions la fake data.
- `backend/src/controllers/reports.controller.js:8-13` weekly/monthly pending.
- `backend/src/controllers/dashboard.controller.js:16-18` heatmap tra `[]`.

Tac dong:

- Ho so nguoi dung trong nhu co bieu do that nhung thuc te khong co du lieu.
- De gay nham lan khi danh gia nang suat.

Cach sua:

1. Them endpoint:

- `GET /api/reports/users/:id/today`
- `GET /api/reports/users/:id/timeline?date=YYYY-MM-DD`
- `GET /api/reports/users/:id/heatmap?days=365`
- `GET /api/reports/users/:id/sessions?limit=...`

2. Timeline aggregate tu `ActivityEvent` theo gio.
3. Heatmap aggregate tu `DailyStat`.
4. Session lay tu `WorkSession`, khong fake.

### 15. `userStats(id, 'today')` co the lay nham ngay

Bang chung:

- `frontend/src/services/api.js:89-92` lay row dau tien cua `/api/reports/users/:id/daily`.
- `backend/src/controllers/reports.controller.js:3-5` endpoint daily tra 31 ngay gan nhat, khong filter today.

Tac dong:

- Neu hom nay chua co stat, UserDetail co the hien du lieu cua ngay cu nhu la hom nay.

Cach sua:

1. Them query `?date=YYYY-MM-DD` hoac endpoint `/today`.
2. Frontend khong nen tu lay row dau tien neu label UI la hom nay.

### 16. Config port va docs khong dong nhat

Bang chung:

- `backend/src/config/env.js` default `PORT=5000`.
- `backend/.env.example` la `PORT=5000`.
- `backend/.env` hien co `PORT=5001`.
- `frontend/vite.config.js` default proxy `http://localhost:5001`.
- `desktop-app/src/main/main.js:8` default API `http://localhost:5001`.
- `README_BACKEND_NEW.md` noi health o `localhost:5000`, README goc noi `localhost:5001`.

Tac dong:

- Dev moi co the chay backend 5000 trong khi frontend/desktop goi 5001.
- Loi ket noi rat de bi hieu nham la realtime loi.

Cach sua:

1. Chon 1 port mac dinh, de xuat `5001` neu README goc va frontend dang theo port nay.
2. Cap nhat `env.js`, `.env.example`, README, desktop default va Vite proxy dong nhat.
3. Them startup log in ro API URL frontend/desktop dang dung.

## P2 - No ky thuat, bao tri va UX

### 17. Desktop app khong refresh access token

Bang chung:

- `desktop-app/src/main/main.js:79-90` load `accessToken` tu secure state va dung luon neu co.
- Access token backend mac dinh het han sau 15 phut (`backend/src/config/env.js`).
- `refreshToken` duoc luu nhung khong duoc dung.

Tac dong:

- App desktop chay lau se bi 401 va chi emit disconnected.

Cach sua:

1. Khi API tra 401, goi `/api/auth/refresh-token`.
2. Cap nhat secure state voi token moi.
3. Retry request ban dau 1 lan.
4. Neu refresh fail, dung tracking va yeu cau dang nhap lai.

### 18. Desktop logout chi dong cua so, khong logout that

Bang chung:

- `desktop-app/src/main/main.js:257` `logout` chi `mainWindow?.close()`.
- Secure state van con token/device secret.

Tac dong:

- Lan sau mo app co the tiep tuc dung token cu.
- Khong dung nghia logout.

Cach sua:

1. Goi `/api/auth/logout` neu co token.
2. Xoa `secure-state.bin` hoac xoa access/refresh token trong state.
3. Giu device secret neu muon re-pair nhanh, nhung phai co quyet dinh ro.

### 19. Desktop UI co the hien stopped trong khi tracker da auto-start

Bang chung:

- Main process auto start sau 1 giay o `desktop-app/src/main/main.js:251`.
- Renderer goi `getStatus()` ngay khi load o `desktop-app/src/renderer/index.html`, co the nhan `tracking=false` truoc khi auto-start.
- `ping-result` chi update stats/status dot, khong update button tracking.

Tac dong:

- UI co the hien nut START trong khi tracker dang chay.

Cach sua:

1. Main process emit event `status` moi khi tracking doi.
2. Renderer listen `onStatus` va sync button/timer.
3. Hoac bo auto-start, de user bam start ro rang.

### 20. File tracker/API cu van goi endpoint da bi bo

Bang chung:

- `tracker.js:3` dung `http://localhost:3001`.
- `tracker.js:32` goi `/api/activity/ping`.
- `desktop-app/src/services/api.js:6-12` cung goi `http://localhost:3001/api/activity/ping`.
- README da canh bao backend legacy co `/api/activity/ping` cu.

Tac dong:

- Nguoi dev co the chay nham tracker cu, khong co auth/anti-cheat.
- Neu backend legacy chay song song, du lieu co the bypass pipeline moi.

Cach sua:

1. Xoa hoac di chuyen file cu vao `legacy/` kem README ro rang.
2. Neu con can CLI tracker, viet lai dung `/api/activity/session/start` va `/api/activity/batch`.
3. Them check trong README: khong chay `tracker.js` cu voi backend moi.

### 21. Nhieu `catch {}` lam mat loi that

Bang chung:

- `frontend/src/pages/Dashboard.jsx:132` swallow loi fetch dashboard.
- `frontend/src/pages/UserDetail.jsx:55` swallow loi fetch profile/stats.
- `backend/src/controllers/activity.controller.js:11` swallow loi emit realtime.
- `desktop-app/src/main/main.js:236` swallow loi stop hook.

Tac dong:

- Loi API/realtime bi an, kho debug.
- UI co the hien rong ma khong thong bao nguyen nhan.

Cach sua:

1. Log co context toi console/dev logger.
2. Frontend set error state de hien thong bao ngan gon.
3. Backend emit failure nen log warning kem `userId` va error message.

### 22. Test backend phu thuoc tai khoan admin co san

Ket qua chay:

- Lenh: `npm test` trong `backend`.
- Ket qua: 3/3 test fail.
- Ly do truc tiep: login `admin@workrank.local` tra `401 Invalid email or password`.

Bang chung:

- `backend/test/integration.test.js` dung email/password mac dinh, khong tu seed user rieng.

Tac dong:

- Test khong repeatable tren may moi/CI.
- Khong phat hien duoc regression realtime/anti-cheat vi fail ngay tu auth.

Cach sua:

1. Test setup nen tao user test rieng trong DB test hoac chay seed truoc test.
2. Dung database rieng cho test.
3. Cleanup du lieu test sau khi chay.
4. Them test realtime contract:

- batch thanh cong emit `activity:user:update` dung payload.
- dashboard listener nhan du lieu desktop batch.
- socket disconnect nhieu tab khong offline som.

### 23. Frontend bundle build duoc nhung bundle lon

Ket qua chay:

- Lenh: `npm run build` trong `frontend`.
- Ket qua: build thanh cong.
- Canh bao: JS chunk `719.16 kB`, lon hon nguong 500 kB.

Tac dong:

- Load app cham hon khi deploy that.

Cach sua:

1. Code split route bang `React.lazy`.
2. Tach `recharts`/trang UserDetail thanh chunk rieng.
3. Cau hinh `manualChunks` neu can.

## De xuat thu tu sua

1. Sua contract realtime truoc: chon 1 ingestion path, 1 payload event chuan, frontend listen dung event.
2. Bo ghi DB truc tiep tu socket hoac dua socket vao chung anti-cheat/batch service.
3. Sua desktop idle delta, token refresh va port config.
4. Lam atomic update cho `DailyStat` va unique sequence.
5. Lam lai presence theo socket count + last activity.
6. Sua leaderboard range/team va dashboard overview aggregate that.
7. Implement Groups API hoac tam thoi an UI Groups neu chua lam.
8. Implement reports/timeline/heatmap/sessions that cho UserDetail.
9. Sua test setup de chay lap lai duoc, sau do them test realtime.

## Checklist sua nhanh theo file

### Backend

- `backend/src/sockets/index.js`
  - Khong goi `upsertDailyStat` truc tiep tu socket.
  - Validate payload socket neu van nhan heartbeat.
  - Them presence manager theo `userId`.
  - Chi cho role phu hop join room `dashboard`.

- `backend/src/services/activity.service.js`
  - Dua cap nhat `DailyStat`, `ActivityEvent`, `WorkSession`, `Device.lastSequence` vao transaction an toan.
  - Lock device row khi check sequence.
  - Them ham tra payload realtime chuan sau ingest.

- `backend/src/controllers/activity.controller.js`
  - Emit cung event contract ma frontend dang nghe.
  - Khong swallow loi emit ma khong log.

- `backend/src/services/dashboard.service.js`
  - Tach overview aggregate va leaderboard.
  - Ho tro `range`, `teamId`, timezone.

- `backend/src/controllers/leaderboard.controller.js`
  - Weekly/monthly khong duoc goi lai daily.
  - Team leaderboard phai filter team/group.

- `backend/src/controllers/reports.controller.js`
  - Them today/timeline/heatmap/sessions.
  - Weekly/monthly can aggregate that hoac tra 501 ro rang neu chua co.

### Frontend

- `frontend/src/services/socket.js`
  - Them `reconnection`, `connect_error`, `disconnect`, auth refresh neu can.
  - Khong reuse socket voi token cu sau logout/login khac user.

- `frontend/src/context/TrackingContext.jsx`
  - Dung delta/idle logic.
  - Chi reset local counter sau server ack.
  - Khong gui activeSeconds khi khong co input.
  - Co offline queue hoac fallback HTTP.

- `frontend/src/pages/Dashboard.jsx`
  - Nghe event contract chuan.
  - Khong tinh tong toan he thong tu top N leaderboard.
  - Tach account status va presence status.
  - Bo global cache hoac scope cache theo user/range.

- `frontend/src/pages/Leaderboard.jsx`
  - Group/range phai goi API that.
  - Khong merge realtime bang `Math.max` neu server da co snapshot chuan.

- `frontend/src/services/api.js`
  - Thay group stubs bang API that hoac an UI.
  - Implement timeline/heatmap thay vi tra mang rong.

### Desktop

- `desktop-app/src/main/main.js`
  - Sua idle delta theo `lastFlushAt`.
  - Them refresh token.
  - Sync status tracking cho renderer.
  - Logout xoa token va goi backend.
  - Dong nhat default `API_URL`.

- `desktop-app/src/services/api.js` va `tracker.js`
  - Xoa/legacy hoa endpoint `/api/activity/ping`.
  - Neu con dung, viet lai theo batch API moi.

## Ket qua kiem tra da chay

- `frontend`: `npm run build` thanh cong, main chunk da tach nho, khong con canh bao >500 kB.
- `backend`: `npm test` pass 3/3.
- `backend/desktop`: `node --check` pass cho cac file JS trong `backend/src`, `backend/test`, `desktop-app/src` va `tracker.js`.

## Cap nhat kiem thu thuc te 2026-05-13

- Da test Desktop Tracker bang TextEdit ngoai trinh duyet. DB tang that cho `user2@workrank.local`.
- Da test `workrank://stop`: dung hook, go tiep ngoai trinh duyet khong tang key.
- Da test `workrank://start`: tao session moi va go ngoai trinh duyet tang key/click.
- Da test leaderboard API: `user2@workrank.local` xuat hien tren daily leaderboard voi activity moi.

### Loi tim thay sau khi tester thu that

- Desktop gui `deviceSecret: null` lam backend tra `Validation failed`.
  - Da sua: desktop chi gui `deviceSecret` khi co secret hop le.
- Desktop co the bi ket `Replayed or old sequence` sau restart/stop vi local sequence thap hon `Device.lastSequence` trong DB.
  - Da sua: `/api/activity/session/start` tra `lastSequence`, web/desktop sync sequence truoc khi gui batch.
- Desktop stop chi go hook, chua end session DB.
  - Da sua: `stopTracking()` goi `/api/activity/session/end`, session chuyen `ended`.
- App restart de lai session `running` cu.
  - Da sua: backend dong session `running` cua cung user/device thanh `crashed` truoc khi tao session moi.
- Neu mo `workrank://stop` khi desktop chua chay, app co the auto-start lai.
  - Da sua: protocol `stop` tat auto-start trong lan khoi dong do.
