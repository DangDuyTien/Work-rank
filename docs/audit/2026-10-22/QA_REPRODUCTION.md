# Tái chạy QA persistence và UX

Các bài browser gọi API, Socket.IO, MySQL và dịch vụ S3 thật trên loopback. Không intercept API hoặc giả response. Unit test dùng SQLite riêng; không dùng unit test đó thay cho nghiệm thu MySQL/S3.

## Môi trường đã dùng

- Mã nguồn: `/Applications/du-an/workrank/workrank-realtime`, base commit `09d854f` cùng thay đổi đang làm việc.
- MySQL 8.4.9, DB riêng `workrank_persistence_20261022_audit`.
- Backend fixture: `backend/test/fixtures/persistence-live-server.cjs`, port 5113.
- Vite: port 5283, cả `VITE_API_URL` và `VITE_SOCKET_URL` trỏ `http://127.0.0.1:5113`.
- SeaweedFS 4.48, S3 ở port 5125, bucket `workrank-audit`. Đây là dịch vụ S3 thật độc lập với app; object/filer data ghi trên disk, không dùng map trong process backend.
- Binary QA: `/tmp/workrank-persistence-bin/weed`; data QA: `/tmp/workrank-persistence-audit/object-store`; cấu hình S3 QA: `/tmp/workrank-persistence-audit/s3.json`.
- Chromium do Playwright cài. Mỗi phase persistence tạo process mới, profile mới.

SeaweedFS có [release chính thức](https://github.com/seaweedfs/seaweedfs/releases) và [hướng dẫn dự án](https://github.com/seaweedfs/seaweedfs). Dịch vụ trên máy QA không được dùng làm storage production.

## Khởi động fixture

Đảm bảo database QA riêng đã tồn tại và tài khoản MySQL trong backend env truy cập được. Fixture yêu cầu đồng thời `NODE_ENV=test`, `DB_DIALECT=mysql`, `DB_NAME_TEST=workrank_persistence_20261022_audit`; không force-sync/drop DB. Nó seed tài khoản QA bằng `findOrCreate`.

Khởi động S3 với cùng thư mục data giữa các lần restart:

```sh
/tmp/workrank-persistence-bin/weed mini -dir=/tmp/workrank-persistence-audit/object-store -ip=127.0.0.1 -ip.bind=127.0.0.1 -master.port=9335 -volume.port=18085 -filer.port=18885 -s3.port=5125 -s3.config=/tmp/workrank-persistence-audit/s3.json -admin.ui=false -admin.port=23649 -master.telemetry=false -master.volumeSizeLimitMB=16 -volume.max=4 -webdav=false -s3.port.iceberg=0 -s3.port.lance=0 -bucket=workrank-audit
```

Backend tại `/Applications/du-an/workrank/workrank-realtime/backend`:

```sh
NODE_ENV=test DB_DIALECT=mysql DB_NAME_TEST=workrank_persistence_20261022_audit PORT=5113 STORAGE_PROVIDER=s3 STORAGE_ENDPOINT=http://127.0.0.1:5125 STORAGE_REGION=us-east-1 STORAGE_BUCKET=workrank-audit STORAGE_ACCESS_KEY=workrank-audit-access STORAGE_SECRET_KEY=workrank-audit-secret-test-only STORAGE_PUBLIC_BASE_URL=http://127.0.0.1:5125/workrank-audit STORAGE_FORCE_PATH_STYLE=true node test/fixtures/persistence-live-server.cjs
```

Các credential `workrank-audit-*` là giá trị fixture công khai cho localhost, không phải secret production. Config S3 QA cần identity có quyền Admin/Read/List/Write cho bucket và anonymous GET/Read ảnh public. Không cấu hình anonymous Write.

Frontend tại `/Applications/du-an/workrank/workrank-realtime/frontend`:

```sh
VITE_API_URL=http://127.0.0.1:5113 VITE_SOCKET_URL=http://127.0.0.1:5113 npm run dev -- --host 127.0.0.1 --port 5283 --strictPort
```

## Persistence

Tại frontend:

```sh
PERSIST_PHASE=create node scripts/persistence-browser-audit.mjs
```

Đóng process browser A; dừng đúng backend/frontend/S3 fixture của QA, chờ các port được giải phóng rồi khởi động lại cả ba bằng cùng DB/data directory. SeaweedFS cần thời gian flush filer khi SIGTERM; không chạy instance thứ hai trên cùng thư mục khi instance trước chưa thoát.

```sh
PERSIST_PHASE=read node scripts/persistence-browser-audit.mjs
```

Phase read khởi chạy browser B mới, login bằng API thật của tài khoản fixture, đọc kết quả/PB/BXH/history/gallery; logout; xóa localStorage/sessionStorage/IndexedDB/cookie/cache qua CDP; reload về login; login mới và đọc lại. File `attempt-mementos.json` chỉ chứa dữ liệu kỳ vọng để so sánh, không bơm kết quả vào ứng dụng. Không có token reinjection bằng `addInitScript` trong bài persistence.

Endpoint `/api/__persistence-audit` chỉ có trong wrapper fixture test, bind loopback, trả truy vấn model DB thật. Không được thêm endpoint này vào app production.

## UX, performance, input

```sh
UX_ONLY=direction node scripts/persistence-ux-audit.mjs
UX_ONLY=drawing node scripts/persistence-ux-audit.mjs
```

Direction kiểm tra current+3, một ô buffer, giới hạn spam, wrong freeze, raw stimulus trong trick/opposite, responsive, rank DUO/TRIO và CPU 4x. Performance đo riêng khi gameplay ở viewport ổn định; chụp PNG/đổi kích thước ở ngoài đoạn đo.

Các script `arcade-ux-final-audit.mjs`, `four-games-typing-audit.mjs`, `four-games-native-audit.mjs` nhận `UX_WEB`, `UX_API`, `UX_OUTPUT`, `UX_ACCOUNT_PREFIX=persistence`, `UX_PASSWORD=PersistenceAuditTest123!`. Chạy các lượt đo CPU lần lượt để tránh nhiễu do nhiều browser cùng bị throttle.

Ví dụ Computer (đổi `UX_GAME=memory_flash` để thử Memory):

```sh
UX_WEB=http://127.0.0.1:5283 UX_API=http://127.0.0.1:5113 UX_ACCOUNT_PREFIX=persistence UX_PASSWORD=PersistenceAuditTest123! UX_GAME=computer_rush UX_OUTPUT=../docs/audit/2026-10-22/ux/computer node scripts/arcade-ux-final-audit.mjs
```

Typing: cùng các biến trên, dùng `UX_PHASE=final`, `UX_OUTPUT=../docs/audit/2026-10-22/ux/typing`, chạy `node scripts/four-games-typing-audit.mjs`. Native: `UX_OUTPUT=../docs/audit/2026-10-22/ux/native node scripts/four-games-native-audit.mjs`.

## Thử ngắt storage

`DRAWING_OUTAGE=1 UX_ONLY=drawing node scripts/persistence-ux-audit.mjs` dùng các marker `/tmp/workrank-drawing-outage-*` để phối hợp dừng/khởi động S3. Xóa marker của lượt QA cũ trước khi chạy. Khi script in `READY FOR STORAGE OUTAGE`, dừng S3 và tạo marker `stopped`. Khi in `READY FOR STORAGE RESTART`, khởi động S3 lại, xác nhận port phục vụ rồi tạo marker `restored`.

`node scripts/drawing-delete-resilience-audit.mjs` kiểm tra non-owner 403 rồi dùng marker `/tmp/workrank-drawing-delete-*`. Sau lỗi DELETE, restart S3 và backend; startup worker phải hoàn tất intent rồi tạo `restored`. Nếu chỉ cần tiếp tục xác minh intent đã được chụp ở bước trước, dùng `DELETE_PHASE=verify`. Script đọc đúng artwork QA từ `ux/drawing-recovery-result.json`; không dùng id 4 của DB làm việc.

## Kiểm tra mã nguồn

Backend:

```sh
NODE_ENV=test node --import ./test/setup/teardown-db.mjs --test --test-concurrency=1 test/arcade_engine.test.js test/arcade_http.test.js test/arcade_service.test.js test/typing*.test.js test/drawing_authorization.test.js test/drawing_storage.test.js test/persistence_regressions.test.js
```

Frontend: `npm run check`, `npm run build`. Log kiểm thử và checksum nguồn nằm trong thư mục `validation/` của audit này. Chưa commit hoặc deploy trong phiên làm việc này.
