# Drawing / Creative Corner — Persistent Storage & UX Final Remediation

Ngày nghiệm thu: **22/10/2026**. Project: `/Applications/du-an/workrank/workrank-realtime`. Base Git: `c52b180`.
Phạm vi: **chỉ Drawing / Creative Corner**. Không sửa gameplay của Typing Battle, Computer Rush, Direction Rush, Memory Flash.

## Kết luận trước khi đọc chi tiết

Luồng publish → object storage → DB → gallery đã được **chạy thật end-to-end** (browser thật, Express thật, MySQL thật, S3-compatible object store thật, không mock API) và sống sót qua: browser khác, xóa toàn bộ storage trình duyệt, restart backend, restart object store, và **xóa thư mục `backend/uploads` + restart** (mô phỏng redeploy).

**Nhưng chưa thể đóng gate production**: tài khoản Cloudflare R2 chưa có credential trong môi trường này. Toàn bộ bằng chứng dưới đây chạy trên **SeaweedFS 4.48 (S3-compatible)**, một process riêng với data dir ngoài thư mục app — chứng minh kiến trúc, adapter, transaction và vòng đời object; **không** thay thế cho việc xác nhận bucket production.

Để đóng gate cuối: điền 6 biến `STORAGE_*` của R2 vào `backend/.env` (hoặc Render env) rồi chạy lại 3 lệnh ở mục *Kiểm tra lại trên bucket thật*. Không có bước nào khác cần sửa code.

---

## Current Architecture

```text
Canvas 1200×700 (backing store cố định)
  → exportArtworkBlob(): PNG lossless; >3.5MB thì thử WebP q=0.92; >8MB báo lỗi rõ
  → FormData(multipart) + publicationId (UUID) + title + visibility + metadata
  → POST /api/drawings  (multer memoryStorage, 8MB, magic-byte check)
  → drawing.controller.create
      ├─ resolveStorageConfig()  → sai/thiếu: 503 STORAGE_UNAVAILABLE (không ghi local)
      ├─ inspectImageBuffer()    → PNG/JPEG/WebP thật, ≤4096×4096, ≤8MB
      ├─ buildDrawingStorageKey()→ drawings/{userId}/{publicationId}-{sha256[0:12]}.{ext}
      └─ drawingService.createDrawing()
            ├─ TX1: lock user row → tìm publicationId cũ → tạo row HIDDEN/PENDING (sở hữu key)
            ├─ storage.upload()  → S3 PutObject
            └─ TX2: row → ACTIVE/CONFIRMED + validatedAt
  → GET /api/drawings/:id   (đọc lại bản ghi)
  → browser tải ảnh từ URL canonical (storageKey + STORAGE_PUBLIC_BASE_URL)
  → chỉ khi ảnh load được mới báo "Đã đăng tranh lên Thư viện"
```

Đọc: `GET /api/drawings` → lọc `status=ACTIVE` + visibility (mặc định PUBLIC) → `formatDrawing()` suy URL từ `storage_key` → gallery.

Xóa: `DELETE /api/drawings/:id` → TX HIDDEN + `deletionPending` → xóa object theo provider → TX DELETED. Lỗi storage giữ intent, worker retry lúc startup và mỗi 60 giây.

## Root Cause

Bản gốc (`git show b2a4d94:backend/src/controllers/drawing.controller.js`) dùng:

```js
const uploadDir = path.resolve(__dirname, '../../uploads/drawings');
const storage = multer.diskStorage({ destination: cb(null, uploadDir), ... });
```

và DB lưu `/uploads/drawings/drawing-<ts>-<rand>.png` trong `drawings.image_url`.

Vì sao "tưởng là lưu được" nhưng production không persistent:

1. **`backend/uploads` là filesystem của container, không phải storage.** Render thay container mỗi lần deploy/restart; file biến mất, row DB vẫn còn → ảnh vỡ. Refresh cùng browser vẫn thấy ảnh vì file còn trong container đang chạy — đây chính là lý do bài test "refresh thấy ảnh" trước đây cho cảm giác PASS giả.
2. **`image_url` là nguồn sự thật duy nhất**, không có `storage_key`. Không thể xóa object (delete chỉ xóa row), không thể đổi domain CDN, không thể migrate vì không biết object nào thuộc row nào.
3. **Không có object storage nào được cấu hình** (`backend/.env` không có `STORAGE_*`). Sau khi thêm adapter, publish ở development/production bị chặn 503 — đúng về mặt fail-closed, nhưng nghĩa là **chưa từng có ảnh nào thực sự lên kho bền vững**.
4. Trước remediation này, `backend/uploads/drawings` **rỗng 0 file**; 4 bản ghi legacy trong DB dev gồm 3 SVG inline và 1 PNG base64 (`storage_provider='database'`). Không còn file local nào để migrate.

## Chosen Storage Provider

**Cloudflare R2** (quyết định của chủ dự án), thông qua adapter **S3-compatible duy nhất** đã có trong repo (`@aws-sdk/client-s3`). Không thêm provider thứ hai.

- Production: chỉ `STORAGE_PROVIDER=s3` được chấp nhận; `local` bị cấm ở production.
- Dev/test/legacy: `LocalDrawingStorageAdapter` chỉ dùng cho unit test và đọc file legacy khi migrate.
- Frontend không biết provider: chỉ gọi `POST /api/drawings` và nhận `imageUrl` tuyệt đối.

Bằng chứng QA dùng **SeaweedFS 4.48** (S3 gateway + filer), data dir `/Users/quynh/.workrank-qa/object-store`, tiến trình tách biệt với app, public URL `http://127.0.0.1:18900/buckets/workrank-drawings/...`.

## Environment Configuration

```dotenv
STORAGE_PROVIDER=s3
STORAGE_BUCKET=<bucket R2>
STORAGE_REGION=auto
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY=<access key>
STORAGE_SECRET_KEY=<secret key>
STORAGE_PUBLIC_BASE_URL=https://<domain ảnh ổn định>   # r2.dev hoặc custom domain
STORAGE_FORCE_PATH_STYLE=true
STORAGE_KEY_PREFIX=                                     # tuỳ chọn
```

`render.yaml` đã khai báo đủ các biến này với `sync: false`. `STORAGE_PUBLIC_BASE_URL` bắt buộc HTTPS ở production, không chứa query/token.

Chẩn đoán: `GET /api/drawings/storage/status` (admin) trả `provider`, `ready`, `missingEnv` — **chỉ tên biến**, không trả giá trị. `GET /api/drawings/settings` trả `publishing.available` để UI hiện đúng trạng thái.

## Storage Abstraction

`backend/src/services/storage/drawingStorage.service.js` (facade) + 2 adapter:

| Hàm | Hành vi |
|---|---|
| `upload({key,buffer,contentType})` | PUT object, trả `{key,url,provider,sizeBytes}` |
| `delete({key})` | idempotent, trả `alreadyMissing` khi object đã mất |
| `exists({key})` | HEAD object — dùng cho verify và migration |
| `getPublicUrl(key)` | suy URL từ key + base URL (đổi CDN không cần update DB) |
| `parseStorageKey(urlOrKey)` | nhận key, `/uploads/...`, URL thuộc kho |
| `buildDrawingStorageKey` | key do **server** sinh, không dùng tên file client |
| `buildLegacyDrawingStorageKey` | key tất định theo `drawingId + checksum` → chạy migration nhiều lần không tạo object trùng |

## Database Contract

Bảng `drawings` (không thêm bảng, không duplicate cột):

| Trường | Ý nghĩa |
|---|---|
| `id`, `user_id`, `title`, `visibility`, `status` | định danh + quyền + vòng đời (`ACTIVE/HIDDEN/DELETED`) |
| `image_url` | URL canonical tại thời điểm tạo (tương thích ngược) |
| `storage_key` | **object key ổn định** — nguồn sự thật để delete/migrate/derive URL |
| `storage_provider` | `s3` \| `local` \| `external` \| `database` (legacy) |
| `mime_type`, `size_bytes`, `width`, `height` | metadata server xác thực, không tin client |
| `metadata` (JSON) | `publicationId`, `checksum`, `uploadState` (PENDING/CONFIRMED), `validatedAt`, `deletionPending`, `imageMissing` |
| `created_at`, `updated_at` | timestamps |

`image_url` **không** lưu signed URL. URL luôn suy ra từ `storage_key` + base URL.

## Publish Flow

1. `publicationId` sinh mới mỗi khi pixel thay đổi; giữ nguyên khi retry cùng một bức tranh.
2. TX1 ghi row `HIDDEN` + `uploadState=PENDING` **trước khi** chạm object storage → key đã thuộc về một row, không có object mồ côi không chủ.
3. Upload S3. Lỗi → 502 `STORAGE_UPLOAD_FAILED`, row vẫn PENDING; retry cùng `publicationId` dùng lại đúng row/key.
4. TX2 chuyển `ACTIVE/CONFIRMED`. Nếu TX2 lỗi, object vẫn được row PENDING sở hữu; retry upload đè cùng key rồi activate — không mất bytes đã commit.
5. Controller đọc lại `GET /api/drawings/:id`, browser tải ảnh từ URL canonical; chỉ khi `<img>` load xong mới báo thành công.

Chống double-click: `publishingRef` chặn ngay từ tick đầu (state `isPublishing` chỉ có hiệu lực sau khi React commit). Test thật: 2 click trong cùng một tick → **1 tác phẩm**.

## Failure / Rollback

| Tình huống | Hành vi đã kiểm |
|---|---|
| Storage chưa cấu hình | 503 `STORAGE_UNAVAILABLE` + danh sách env thiếu; **không** ghi file local, không tạo row |
| Production đặt `STORAGE_PROVIDER=local` | Startup log lỗi rõ; `publishing.available=false`; publish 503 |
| S3 PUT lỗi | 502; canvas + draft còn nguyên; retry cùng publicationId |
| DB insert lỗi trước upload | Không upload → không orphan (test: số file trong storage root không đổi) |
| DB activate lỗi sau upload | Row PENDING sở hữu key; retry không sinh row/object mới |
| Read-back ảnh lỗi | Không xóa object đã commit; báo lỗi, giữ draft |

## Read Flow

`GET /api/drawings` → `status=ACTIVE` + visibility (mặc định **PUBLIC**, fail-closed) → `formatDrawing()`:

- `storage_provider='s3'` + config hợp lệ → URL = `getPublicUrl(storage_key)` (đổi domain CDN không cần update DB).
- Legacy `data:` / `/uploads/...` → giữ `image_url` như cũ.
- Ảnh lỗi → placeholder "Ảnh tác phẩm không còn khả dụng" + `onError`; placeholder **không** được tính là đã sửa storage.

Creative Corner đọc 100% từ API/DB, không dựng gallery từ local drawings.

## Delete Flow

```text
authorize (owner | admin)
→ TX: status=HIDDEN + metadata.deletionPending=true   (gallery ẩn ngay)
→ storage.delete(key) theo đúng provider của row
→ TX: status=DELETED + deletionPending=false
```

- Storage lỗi → 502 `STORAGE_DELETE_FAILED`, intent còn trong DB, worker retry lúc startup + mỗi 60s.
- Xóa lại: `alreadyDeleted=true`, HTTP 200, không crash.
- Object đã mất trước khi xóa: vẫn hoàn tất DB cleanup.
- Row không tồn tại: 404, không crash.

## Security

- **Owner/admin** kiểm tra server-side cho delete; non-owner → 403 (test HTTP thật).
- **Visibility** kiểm tra server-side: `getGallery` mặc định chỉ PUBLIC; `ALL/TEAM/PRIVATE` chỉ mở rộng theo danh tính đã đăng nhập. Đã sửa lỗi cũ: gọi `GET /api/drawings` **không kèm `visibility`** trả về mọi bản ghi ACTIVE, kể cả PRIVATE của người khác.
- **Upload**: chỉ PNG/JPEG/WebP theo magic bytes (không tin `Content-Type`/filename), ≤8MB, ≤4096×4096, `files:1`.
- **Storage key** do server sinh từ `userId` + `publicationId` + checksum; `sanitizeSegment` loại ký tự lạ; local adapter chặn path traversal (`..`).
- Client không thể gửi `imageUrl`/`storageKey`.

## Legacy Migration

Phân loại trên **DB QA clone** (`workrank_drawing_qa`, 7 bản ghi) để không đụng dữ liệu làm việc:

| # | Loại | Kết quả |
|---|---|---|
| 1–3 | SVG inline | `skipped-inline-svg` (giữ trong DB, không đưa SVG lên bucket public) |
| 4 | PNG base64, 397.061 bytes | `migrated` → `drawings/legacy/1/4-b2d48cc40803.png`, object 200, sha256 khớp `b2d48cc4…` |
| 5 | Có key nhưng object đã bị xóa (bài test delete) | `missing-object` → `metadata.imageMissing=true`, **không** tạo ảnh giả, không xóa row |
| 6 | Có key, object tồn tại | `skipped-has-key` |
| 7 | `/uploads/...` không còn file | `missing-local-file` → đánh dấu `imageMissing`, giữ row |

Chạy lần 2: **0 upload mới**, #4 thành `skipped-has-key` → idempotent. Dry-run có `--dry-run`, report JSON, exit code ≠ 0 khi còn missing.

## UX Changes

| Trước | Sau |
|---|---|
| Nút "Lưu & Hoàn thành tác phẩm" | "Đăng tranh lên Thư viện" |
| "Đã lưu lên hệ thống" (mơ hồ) | "Đã đăng tranh lên Thư viện!" + `Tác phẩm #id · Đã đọc lại bản ghi và tải ảnh thật từ kho lưu trữ` |
| "Nháp trên thiết bị" | "Đã lưu bản nháp trên thiết bị · Chưa đăng lên Thư viện" |
| Không phân biệt trạng thái publish | Chuỗi trạng thái thật: giữ nháp → chuẩn bị ảnh → tải ảnh → xác minh → đăng |
| Double-click tạo 2 tranh | `publishingRef` chặn, idempotent theo `publicationId` |
| PNG luôn full size | PNG lossless; >3.5MB thử WebP q=0.92; >8MB báo lỗi rõ (không để backend 413) |
| Rời trang mất nét cuối | `beforeunload` chỉ khi draft đang trong 400ms debounce |
| Success card thiếu bối cảnh | Thêm chế độ "Công khai" + nút "Xem trong Thư Viện Tranh" |

Giữ nguyên: undo/redo (25 bước, Ctrl/Cmd+Z, Shift+Z / Ctrl+Y), brush size preview, eraser/fill/pan, zoom/pan, tải PNG, avatar arcade HUD.

## Mobile

Sửa lỗi layout thật: viewport canvas cao `min(720px, calc(100vh-240px))` đẩy **toàn bộ toolbar xuống dưới màn hình 900px** (toolbar top = 933px), người dùng phải cuộn mới đổi được cọ/màu.

Sau sửa: `clamp(320px, calc(100vh-430px), 640px)`; mobile ≤700px dùng toolbar icon-only, swatch 18px, size-btn 26px.

| Viewport | Canvas | Toolbar bottom | Trong màn hình | Touch vẽ đúng | Scroll khi vẽ | Backing/device |
|---|---|---:|---|---|---|---:|
| 390×844 DPR3 | 312×182 | 837 / 844 | ✓ 0 control offscreen | ✓ pixel `[15,23,42,255]` | 0px | 1.28 |
| 430×932 DPR3 | 348×203 | 768 / 932 | ✓ | ✓ | 0px | 1.15 |
| 768×1024 DPR2 | 660×385 | 1022 / 1024 | ✓ | ✓ | 0px | 0.91 |
| 1440×900 DPR1 | 756×441 | 856 / 900 | ✓ | n/a | 0px | 1.59 |

Ảnh: `drawing-persistence-final/ux/drawing-{390,430,768,1440}.png`, `drawing-390-touch.png`.

## Cross-Browser Evidence

`read-evidence.json` — browser B là context Playwright mới, không có storage của A:

- `browserB`: ảnh load `naturalWidth=1200, naturalHeight=700`.
- `anonymousApi`: `GET /api/drawings?visibility=PUBLIC` → 200, có drawing #5 (Creative Corner nằm trong khu vực cần đăng nhập nên UI redirect `/login` — đúng thiết kế hiện có).
- `browserABeforeClear`: 1200×700 → `afterClearStorage`: 1200×700 (đã `localStorage.clear`, `sessionStorage.clear`, xóa toàn bộ IndexedDB, xóa Cache Storage, `clearCookies`, `Network.clearBrowserCache`, rồi đăng nhập lại).

Ảnh: `read-browser-b.png`, `read-after-clear-storage.png`.

## Restart Evidence

| Bước | Kết quả |
|---|---|
| Restart backend (SIGTERM → start lại, cùng MySQL/S3) | `after-backend-restart/read-evidence.json`: browserB + afterClear đều 1200×700 |
| Restart object store (SIGTERM → start lại, cùng data dir) | `after-storage-restart/read-evidence.json`: object 200, gallery 1200×700 |

## Redeploy Evidence

Mô phỏng đúng rủi ro production: **xóa toàn bộ `backend/uploads`** (`ls` → *No such file or directory*), restart backend, đọc lại.

`after-redeploy/read-evidence.json`: browserB 1200×700, afterClear 1200×700, anonymous API 200. Ảnh không đến từ filesystem của app.

## DB Evidence

`db-evidence.json` (query MySQL thật, không tin API response):

| id | provider | storage_key | mime | bytes | status | uploadState |
|---|---|---|---|---:|---|---|
| 5 | s3 | `drawings/10985/18072296-…-218cb8ae3d51.png` | image/png | 35.552 | ACTIVE → **DELETED** sau bài delete | CONFIRMED |
| 6 | s3 | `drawings/10985/9e81ee22-…-218cb8ae3d51.png` | image/png | 35.552 | ACTIVE | CONFIRMED |

QA migration DB: #4 `s3` + key `drawings/legacy/1/4-b2d48cc40803.png`; #5 `imageMissing=true`; #7 `imageMissing=true`; #1–3 giữ NULL (SVG inline).

## Storage Object Evidence

`publish-evidence.json`:

```json
"object": { "status": 200, "contentType": "image/png",
            "contentLength": 35552,
            "sha256": "218cb8ae3d51459e5868edba4358d9217fef1dfcfad19b00cc03edee8e37816a" }
```

- `storage.exists(key)` ngầm định qua HEAD/GET 200 từ URL canonical, không chỉ chuỗi trong DB.
- Sau delete: object 404, DB `DELETED`, `deletionPending=false` (`delete-evidence.json`).
- Legacy #4: object 397.061 bytes, sha256 `b2d48cc40803…` khớp bytes gốc.

## Tests

| Bộ | Kết quả |
|---|---|
| `drawing_storage.test.js` + `drawing_authorization.test.js` | **25/25 PASS** (thêm: fail-closed visibility, publish trùng publicationId) |
| Arcade + shared code (`arcade_engine`, `arcade_http`, `arcade_service`, `game_catalog`, `persistence_regressions`) | **30/30 PASS** |
| Toàn bộ backend | 638 tests, **627 pass / 10 fail / 1 skip**. 10 fail nằm ở competition phase 3/5/9, integration, MVP cup — **không liên quan Drawing**. Đã chứng minh pre-existing: `git stash` bỏ thay đổi của tôi rồi chạy `competition_phase3.test.js` → vẫn fail y hệt (SQLite `cannot rollback - no transaction is active`) |
| Frontend `npm run check` | 89 files, **0 errors** |
| Frontend `npm run build` | ✓ built in 3.95s |

## Files Changed

| File | Thay đổi |
|---|---|
| `backend/src/services/drawing.service.js` | `getGallery` fail-closed theo visibility (mặc định PUBLIC) |
| `backend/test/drawing_authorization.test.js` | +6 assertion cho default/không hợp lệ/TEAM/PRIVATE |
| `backend/test/drawing_storage.test.js` | +test publish trùng `publicationId` → 1 row |
| `frontend/src/pages/DrawingGame.jsx` | `publishingRef`, `exportArtworkBlob` (PNG/WebP + trần 8MB), copy publish/draft, success card, `beforeunload` |
| `frontend/src/components/arcade/drawing-arcade.css` | viewport vừa màn hình, toolbar mobile icon-only |
| `frontend/scripts/drawing-storage-acceptance.mjs` | harness publish/read/duplicate/delete (dùng lại được cho R2) |
| `frontend/scripts/drawing-mobile-audit.mjs` | đo layout + touch ở 390/430/768/1440 |
| `docs/audit/2026-10-22/drawing-persistence-final/` | toàn bộ evidence |

## Remaining Risks

1. **Chưa có bucket production.** Không có credential R2 trong môi trường này; mọi PASS dưới đây là trên object store QA. Cần điền `STORAGE_*` rồi chạy lại harness trước khi tuyên bố production.
2. **Object PRIVATE vẫn public-read ở tầng CDN.** API chặn metadata và gallery, nhưng URL object (nếu đoán được key) không yêu cầu auth. Key có UUID + checksum nên khó đoán, nhưng đây không phải access control thật. Nếu cần private thật: bucket private + signed URL sinh lúc request (vẫn giữ `storage_key` làm canonical).
3. **SVG legacy (3 bản ghi) giữ inline trong DB** theo policy không đưa SVG lên bucket public. Chúng tồn tại vĩnh viễn trong DB nhưng không nằm trong object storage.
4. **Migration chưa chạy trên dữ liệu production** — mới chạy trên DB QA clone. Lệnh đã sẵn: `npm run db:migrate-drawings -- --dry-run` rồi bỏ `--dry-run`.
5. **Chỉ kiểm Chromium** (Playwright). Chưa kiểm Safari/Firefox; `canvas.toBlob('image/webp')` trên Safari trả PNG — code đã xử lý (chỉ nhận WebP khi `blob.type` đúng), nhưng chưa test thực tế.
6. **Provider QA là SeaweedFS**, không phải R2: cùng SDK/protocol nhưng khác hành vi CORS, cache và public domain của R2.
7. **10 test backend fail sẵn** (competition/integration) — không do thay đổi này, nhưng vẫn là nợ kỹ thuật của repo.
8. Đã xóa thư mục rỗng `backend/uploads` khỏi working tree để chứng minh redeploy; `ensureDrawingSchema` tạo lại khi chạy dev với provider `local`.

## Final Gates

| Gate | Kết quả | Phạm vi |
|---|---|---|
| DRAWING LOCAL DRAFT | **PASS** | IndexedDB theo user, nhãn "trên thiết bị" |
| DRAWING SERVER PUBLISH | **PASS** | UI thật → API thật → S3 PUT |
| DRAWING DB RECORD | **PASS** | Row ACTIVE/CONFIRMED, đúng user/key/metadata |
| DRAWING STORAGE OBJECT | **PASS** | Object 200, 35.552 bytes, sha256 khớp |
| DRAWING PERSISTENT URL/READ | **PASS** | URL suy từ storage_key, load 1200×700 |
| DRAWING CROSS-BROWSER | **PASS** | Context B độc lập |
| DRAWING CLEAR-LOCAL-STORAGE | **PASS** | localStorage/sessionStorage/IndexedDB/cache/cookie |
| DRAWING BACKEND RESTART | **PASS** | Restart thật, ảnh còn |
| DRAWING REDEPLOY SURVIVAL | **PASS** | Xóa `backend/uploads` + restart, ảnh còn |
| DRAWING DUPLICATE-PUBLISH PROTECTION | **PASS** | 2 click cùng tick → 1 tác phẩm |
| DRAWING DELETE DB | **PASS** | DELETED, idempotent, non-owner 403 |
| DRAWING DELETE STORAGE OBJECT | **PASS** | Object 404 sau delete |
| DRAWING VISIBILITY AUTH | **PASS** | Default PUBLIC; PRIVATE không lộ qua API (xem risk #2 cho object-level) |
| DRAWING LEGACY MIGRATION | **PASS** (QA DB) | Phân loại A/B/C đúng, idempotent, không tạo ảnh giả |
| DRAWING MOBILE UX | **PASS** | 390/430/768: touch đúng, không scroll, toolbar trong màn hình |
| DRAWING PUBLISH UX | **PASS** | Trạng thái thật, lỗi giữ tranh, retry |
| CREATIVE CORNER READ PATH | **PASS** | 100% API/DB |
| ARCADE REGRESSION SMOKE | **PASS** | 30/30 test shared/arcade; không sửa gameplay |
| **OVERALL DRAWING STORAGE (QA object store)** | **PASS** | Toàn bộ chuỗi publish → object → DB → browser B → clear → restart → redeploy |
| **OVERALL DRAWING STORAGE (production R2)** | **FAIL — chưa có credential** | Cần bucket thật để đóng |

### Kiểm tra lại trên bucket thật

Sau khi điền `STORAGE_*` vào `backend/.env` (và `STORAGE_PUBLIC_BASE_URL` là domain HTTPS thật):

```sh
cd backend && npm run db:migrate-drawings -- --dry-run --report /tmp/r2-dryrun.json

cd ../frontend
node scripts/drawing-storage-acceptance.mjs publish --out /tmp/r2-accept
node scripts/drawing-storage-acceptance.mjs read    --out /tmp/r2-accept
node scripts/drawing-storage-acceptance.mjs delete  --out /tmp/r2-accept
```

`publish` in ra `drawingId`, `imageUrl`, `sha256`, `bytes`; `read` kiểm browser B + clear storage; `delete` kiểm DB + object 404. Nếu cả ba trả `ok:true`, gate production chuyển PASS mà không cần sửa code.
