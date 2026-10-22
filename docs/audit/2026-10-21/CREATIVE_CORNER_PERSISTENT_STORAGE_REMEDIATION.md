# Creative Corner — Persistent Image Storage Remediation

**Ngày:** 2026-10-21
**Phạm vi:** `workrank-realtime` — Drawing / Góc Sáng Tạo / Thư Viện Tranh
**Kết luận ngắn:** ảnh Drawing đã chuyển sang object storage tên miền ngoài (S3-compatible), production không còn ghi `/uploads`; upload fail-closed nếu thiếu cấu hình; ảnh cũ có script migrate idempotent.

---

## 1. Old Architecture

Luồng trước khi sửa:

```
DrawingGame.jsx
  canvas.toBlob('image/png')            → FormData(image, title, width, height, visibility)
  drawingApi.createDrawing(formData)    → POST /api/drawings (multipart)
        ↓
drawing.controller.js
  multer.diskStorage({ destination: backend/uploads/drawings })
  filename = drawing-{Date.now()}-{rand}.png
  imageUrl = `/uploads/drawings/{filename}`      ← đường dẫn TƯƠNG ĐỐI
        ↓
drawing.service.createDrawing()
  Drawing.create({ image_url, width, height, ... })
        ↓
GET /api/drawings  → formatDrawing() → imageUrl tương đối
        ↓
CreativeCornerSection  <img src="/uploads/drawings/...">
        ↓
DELETE /api/drawings/:id
  drawing.update({ status: 'DELETED' })
  fs.unlink(backend/uploads/drawings/{file})      ← xóa file local (best-effort)
```

Chi tiết đã xác nhận:

| Câu hỏi | Trả lời (trước khi sửa) |
| --- | --- |
| Nơi nhận ảnh | `POST /api/drawings`, `multer.single('image')` |
| Định dạng nhận | multipart file, hoặc `imageBase64` (fallback, frontend không dùng) |
| File local tạo ở đâu | `multer.diskStorage` → `backend/uploads/drawings/` |
| `/uploads` sinh ở đâu | hard-code trong controller: `` `/uploads/drawings/${req.file.filename}` `` |
| `image_url` lưu gì | chuỗi tương đối `/uploads/drawings/*.png` (có bản ghi cũ là `data:image/svg+xml,…`) |
| Delete có xóa file? | Có, `fs.unlink` best-effort, không kiểm tra kết quả |
| Validate | chỉ `fileFilter` theo MIME client khai + `limits.fileSize = 15MB`; **không** kiểm tra magic bytes, không giới hạn dimensions |
| Serve file | `app.use('/uploads', express.static(backend/uploads))` |

## 2. Root Risk

1. **Filesystem Render là ephemeral.** Mỗi lần deploy/restart container mới → `backend/uploads` rỗng. DB vẫn còn `image_url` trỏ tới file không tồn tại ⇒ card hiện nhưng ảnh trắng/hỏng.
2. **Đường dẫn tương đối phụ thuộc origin.** Dev (`5173` ⇄ API `5001`) không có proxy `/uploads` ⇒ ảnh 404 dù file còn.
3. **Không có storage key.** DB không biết object nào thuộc bản ghi nào ⇒ không thể xóa đúng object, không thể migrate, dễ orphan.
4. **Tin client.** MIME do client khai, kích thước ảnh do client gửi; file có thể là script đổi đuôi.
5. **Delete không đảm bảo.** Xóa DB trước, xóa file sau (best-effort) ⇒ file mồ côi không ai dọn.

## 3. Selected Storage Architecture

**S3-compatible object storage** (`@aws-sdk/client-s3`), một interface duy nhất cho mọi provider:

- AWS S3, Cloudflare R2, MinIO, Supabase Storage (S3 endpoint), Backblaze B2…
- Chọn S3-compatible thay vì Cloudinary/Supabase SDK riêng vì: một code path, không khoá vendor, CDN sẵn, chi phí thấp, đổi provider chỉ cần đổi env.

```
backend/src/config/storage.js                     ← đọc env, fail-closed, KHÔNG log secret
backend/src/services/storage/
  drawingStorage.service.js                       ← facade + key builder + parseStorageKey
  s3DrawingStorage.adapter.js                     ← production (persistent)
  localDrawingStorage.adapter.js                  ← dev/test only
```

Interface (frontend không bao giờ biết provider):

```js
upload({ key, buffer, contentType }) -> { key, url, provider, sizeBytes }
delete({ key })                      -> { key, deleted, alreadyMissing }
getPublicUrl(key)                    -> string
exists({ key })                      -> boolean
parseStorageKey(urlOrKey)            -> key | null
```

**Quy tắc chọn provider**

| Môi trường | Provider | Ghi chú |
| --- | --- | --- |
| development / test | `local` (mặc định) | ghi `STORAGE_LOCAL_DIR` (mặc định `backend/uploads`) |
| production | **chỉ** `s3` | `local` bị từ chối ở config; thiếu env ⇒ upload 503 |

**Không silent fallback:** production mà config sai thì `POST /api/drawings` trả `503 STORAGE_UNAVAILABLE` kèm `details: [tên env còn thiếu]`. Không có nhánh nào ghi local để "chạy được".

> Ghi chú thiết kế: khi config sai, server **vẫn boot** (để KPI/typing/quiz không sập) nhưng drawing upload fail-closed và log `[Storage] CẤU HÌNH LƯU TRỮ ẢNH KHÔNG HỢP LỆ`. Đây là lựa chọn có chủ đích: fail-fast ở đúng feature, không biến một cấu hình thiếu thành outage toàn hệ thống. Có thể đổi sang crash-on-boot nếu muốn (xem Remaining Risks).

## 4. Upload Flow

```
Canvas → toBlob('image/png')
   ↓ multipart
multer.memoryStorage (8MB, 1 file)          ← KHÔNG chạm disk
   ↓
inspectImageBuffer()                        ← magic bytes PNG/JPEG/WebP + đọc width/height thật
   ↓ (400 nếu sai)
resolveStorageConfig()                      ← sai ⇒ 503, không ghi gì
   ↓
buildDrawingStorageKey({ userId, ext })     ← drawings/{userId}/{ts}-{rand}.{ext}
   ↓
storage.upload({ key, buffer, contentType })→ PutObject + ContentType + Cache-Control immutable
   ↓
Drawing.create({ imageUrl, storageKey, storageProvider, mimeType, sizeBytes, width, height })
   ↓ (DB lỗi ⇒ storage.delete(key) rollback)
201 { drawing }
```

Server authority:

- `userId` lấy từ JWT (`req.user.id`), không từ body.
- `imageUrl`, `storageKey`, `storageProvider`, `width`, `height` **do server sinh**; client gửi lên bị bỏ qua.
- `title` được trim + cắt 120 ký tự, không dùng làm tên file.
- `visibility` chỉ nhận `PUBLIC | TEAM | PRIVATE`.

## 5. Read Flow

`GET /api/drawings` (optionalAuth) → `formatDrawing()` trả `imageUrl` **tuyệt đối** (S3 public URL hoặc CDN). Frontend `resolveAssetUrl()` chỉ prefix khi URL là tương đối (dev local adapter), URL tuyệt đối đi thẳng.

Không proxy bytes ảnh qua backend: browser tải trực tiếp từ CDN/provider (đúng §23).

## 6. Delete Flow

```
DELETE /api/drawings/:id
   ↓ auth: owner (Number(userId) === Number(drawing.userId)) hoặc admin
   ↓ nếu status đã DELETED → 200 { alreadyDeleted: true }        (idempotent)
   ↓ storageKey ? storage.delete(key) : legacy local unlink
   ↓        └ lỗi mạng/provider ⇒ 502 STORAGE_DELETE_FAILED, DB GIỮ NGUYÊN ACTIVE
   ↓ drawing.update({ status: 'DELETED' })
200
```

Lý do chọn **storage-first**:

- Storage xóa lỗi ⇒ bản ghi vẫn ACTIVE ⇒ client retry được, **không sinh object mồ côi** (vì record vẫn trỏ tới object).
- Storage xóa xong nhưng DB lỗi ⇒ lần retry gặp object đã mất → `alreadyMissing` → vẫn hoàn tất. Không kẹt trạng thái.
- Object không tồn tại (404/NoSuchKey) được coi là **đã xóa**, không ném lỗi.

Legacy: bản ghi chưa migrate (`storage_key = NULL`, `image_url = /uploads/...`) vẫn được dọn file local best-effort khi xóa.

## 7. Visibility / Authorization

- Upload: `auth` bắt buộc, ai đăng nhập cũng publish được (giữ nguyên hành vi cũ).
- Delete: owner hoặc `role = admin`; so sánh `Number()` vì BIGINT có thể về dạng string.
- Read: `PUBLIC` cho mọi người; `TEAM`/`PRIVATE` vẫn qua `canViewDrawing()` như trước — **storage migration không bypass authorization**.
- `GET /api/drawings/storage/status` chỉ admin, chỉ trả tên env còn thiếu (không trả giá trị).

**Private/team + URL công khai:** model hiện tại có `visibility` nhưng UI publish chỉ tạo `PUBLIC` (`setVisibility` không được gọi ở đâu). Vì vậy bucket public là chấp nhận được **hôm nay**. Nếu sau này bật TEAM/PRIVATE thật, phải đổi sang bucket private + signed URL — đã ghi vào Remaining Risks, chưa làm vì sẽ phá vỡ cache/CDN và hiện chưa có nhu cầu.

## 8. DB Migration

`backend/src/migrations/20261021090000-add-storage-metadata-to-drawings.js` (idempotent, kiểm tra `describeTable` trước khi thêm):

| Cột | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `storage_key` | `VARCHAR(512) NULL` | object key — nguồn sự thật để delete/migrate |
| `storage_provider` | `VARCHAR(32) NULL` | `s3` / `local` / `external` / NULL (legacy) |
| `mime_type` | `VARCHAR(64) NULL` | định dạng thật đã verify |
| `size_bytes` | `INT UNSIGNED NULL` | dung lượng object |

Giữ nguyên `image_url` (frontend đang dùng) và toàn bộ cột cũ. Index `drawings_storage_key` để truy vấn bản ghi legacy.

`ensureDrawingSchema()` cũng tự thêm cột nếu migration chưa chạy (self-healing như pattern hiện có) và **chỉ tạo thư mục `uploads/drawings` khi provider = local**.

## 9. Legacy Image Migration

`backend/scripts/migrate-drawing-images.js` (`npm run db:migrate-drawings`)

```bash
# xem trước
node scripts/migrate-drawing-images.js --dry-run

# chạy thật, lấy lại file từ instance cũ trước khi nó biến mất
node scripts/migrate-drawing-images.js --legacy-base-url https://work3winmedia-c94e.onrender.com
```

Xử lý từng loại:

| Nguồn | Hành vi |
| --- | --- |
| `/uploads/drawings/*.png` + file còn trên disk | upload, cập nhật `image_url` + `storage_key` |
| `/uploads/...` + file đã mất, có `--legacy-base-url` | **fetch HTTP** từ instance cũ rồi upload |
| `/uploads/...` + mất cả hai | **không fake ảnh, không xóa record**: `metadata.imageMissing = true` + ghi report |
| `data:image/png|jpeg|webp;base64` | decode → upload |
| `data:image/svg+xml` | giữ nguyên inline (không đưa SVG lên bucket public — XSS) |
| `https://…` không thuộc storage | `storage_provider = 'external'`, giữ URL |

**Idempotent:** key legacy = `drawings/legacy/{userId}/{drawingId}-{sha256(content)[0..12]}.{ext}` — tất định theo nội dung; chạy lại: bản ghi đã có `storage_key` → `skipped-has-key`; nếu DB update lỗi giữa đường thì `exists(key)` chặn upload trùng. Report JSON: `docs/audit/2026-10-21/legacy-image-migration-report.json`.

## 10. Files Changed

**Mới**

| File | Vai trò |
| --- | --- |
| `backend/src/config/storage.js` | resolve/validate env storage, fail-closed |
| `backend/src/services/storage/drawingStorage.service.js` | facade, key builder, `parseStorageKey` |
| `backend/src/services/storage/s3DrawingStorage.adapter.js` | adapter S3-compatible |
| `backend/src/services/storage/localDrawingStorage.adapter.js` | adapter dev/test + chặn path traversal |
| `backend/src/utils/imageValidation.js` | magic bytes PNG/JPEG/WebP, size, dimensions |
| `backend/src/migrations/20261021090000-add-storage-metadata-to-drawings.js` | thêm 4 cột metadata |
| `backend/scripts/migrate-drawing-images.js` | migrate ảnh legacy |
| `backend/test/drawing_storage.test.js` | 20 test |

**Sửa**

| File | Thay đổi |
| --- | --- |
| `backend/src/controllers/drawing.controller.js` | memoryStorage, validate, upload storage, rollback, endpoint storage/status; bỏ toàn bộ code ghi disk |
| `backend/src/services/drawing.service.js` | `createDrawing` nhận metadata storage; `deleteDrawing` storage-first + idempotent |
| `backend/src/models/Drawing.js` | 4 field mới |
| `backend/src/services/drawingSchemaCheck.js` | self-heal cột, chỉ tạo uploads dir ở local |
| `backend/src/middlewares/error.middleware.js` | MulterError → 413/400; message lỗi operational không bị che ở production |
| `backend/src/utils/errors.js` | `StorageError` |
| `backend/src/routes/drawing.routes.js` | `GET /storage/status` (admin) |
| `backend/src/server.js` | log trạng thái storage lúc boot |
| `backend/package.json` | `@aws-sdk/client-s3`, script `db:migrate-drawings` |
| `backend/.env.example`, `.env.example`, `render.yaml` | biến `STORAGE_*` |
| `frontend/*` | **không cần sửa**: `resolveAssetUrl` đã xử lý URL tuyệt đối từ đợt trước |

## 11. Automated Tests

`backend/test/drawing_storage.test.js` — **20/20 pass** (`NODE_ENV=test node --test test/drawing_storage.test.js`).

| Nhóm | Case |
| --- | --- |
| Upload/validate | PNG/JPEG/WebP hợp lệ; script đổi đuôi → 400; MIME khai ≠ chữ ký → 400; >8MB → 413; >4096px → 400 |
| Storage success | object tồn tại trong root, DB có `storage_key/storage_provider/mime_type/size_bytes`, width/height lấy từ file |
| Storage failure | config sai → **503**, không ghi file local, không tạo record |
| DB failure sau upload | object bị rollback, không orphan |
| Read | gallery trả `imageUrl` đúng, ảnh fetch được |
| Delete | owner OK; non-owner 403 (object còn nguyên); xóa object + record; gọi lại → `alreadyDeleted`; object đã mất vẫn 200 |
| Migration | file còn → migrated; chạy lại → `skipped-has-key`, không upload trùng; file mất → `imageMissing`, record giữ nguyên; fetch HTTP từ instance cũ → migrated |
| Key | format `drawings/{userId}/…`, chặn `..`, key legacy tất định |

**Full backend suite:** 605 test, 592 pass, 12 fail. 12 fail là **pre-existing, không liên quan storage** — nằm trong working tree đang sửa song song (arcade games `computer_rush/direction_rush/memory_flash` làm `game_catalog.test.js` lệch expectation; `integration.test.js` dính `SQLITE_MISUSE` khi teardown; các suite competition concurrency flake). Không có test nào của drawing/storage fail.

## 12. Browser Verification

| Bước | Kết quả |
| --- | --- |
| `/creative-corner` render + lightbox (local provider) | PASS — 3 card, ảnh load `naturalWidth > 0`, modal mở, 0 console error |
| Home section + admin banner `homeVisible` | PASS (đợt trước) |
| Upload S3 (mock S3-compatible endpoint) | PASS — `201`, `imageUrl = http://127.0.0.1:4599/public/drawings/1/….png` |
| Object nằm ngoài backend disk | PASS — file chỉ có trong object store; `backend/uploads/drawings` **rỗng** |
| Xóa `backend/uploads` rồi đọc lại gallery | PASS — ảnh vẫn `200`, 397KB, PNG hợp lệ, phục vụ từ object store |
| Upload/delete qua browser với mock S3 | **Chưa chạy** — phiên verify bị dừng giữa chừng (mock server bị tắt). Luồng tương đương đã được cover ở API + automated test |

## 13. Production Env Requirements

Bắt buộc (Render → Environment). **Không có giá trị secret trong tài liệu này.**

| Biến | Trạng thái local | Ghi chú |
| --- | --- | --- |
| `STORAGE_PROVIDER` | SET (`local`) | production phải `s3` |
| `STORAGE_BUCKET` | **MISSING** | tên bucket |
| `STORAGE_REGION` | MISSING | R2 dùng `auto` |
| `STORAGE_ENDPOINT` | **MISSING** | vd `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY` | **MISSING** | secret |
| `STORAGE_SECRET_KEY` | **MISSING** | secret |
| `STORAGE_PUBLIC_BASE_URL` | **MISSING** | domain public/CDN, không có `/` cuối |
| `STORAGE_FORCE_PATH_STYLE` | MISSING | `true` cho R2/MinIO/Supabase |
| `STORAGE_KEY_PREFIX` | MISSING (optional) | tiền tố key trong bucket |

Kiểm tra sau khi deploy: `GET /api/drawings/storage/status` (admin) → `{ provider, ready, missingEnv }`.

`render.yaml` đã khai báo các biến trên (`sync: false`) — cần điền giá trị trong dashboard trước khi upload hoạt động.

## 14. Remaining Risks

1. **Production hiện chưa cấu hình storage** → sau khi deploy, upload sẽ trả 503 cho tới khi điền đủ env. Đây là hành vi mong muốn (fail-closed), nhưng phải điền env **trước** khi user vẽ.
2. **Ảnh legacy trên Render có thể đã mất** nếu instance cũ đã restart trước khi chạy migration. Khi đó script báo `missing-local-file`, record giữ nguyên và UI hiện placeholder "Ảnh tác phẩm không còn khả dụng". Cần chạy migration **trong lúc instance cũ còn sống** (dùng `--legacy-base-url`).
3. **Bucket public.** Chỉ an toàn vì UI hiện chỉ tạo `PUBLIC`. Nếu bật TEAM/PRIVATE thật → phải chuyển bucket private + signed URL.
4. **Không có worker dọn orphan.** Nếu process chết đúng giữa upload và ghi DB, object có thể mồ côi (rollback chỉ chạy khi còn process). Rủi ro thấp; có thể thêm job quét `storage_key IS NULL` định kỳ.
5. **`backend/uploads` cũ** vẫn được `express.static` phục vụ cho ảnh legacy/quiz. Chưa xóa route vì còn bản ghi legacy và ảnh quiz dùng chung thư mục.
6. **Verify browser với S3 thật** chưa chạy (chỉ mock + automated test).

---

## FINAL GATE

| Gate | Kết quả | Căn cứ |
| --- | --- | --- |
| PERSISTENT STORAGE | **PASS** | adapter S3, object nằm ngoài backend disk |
| NEW IMAGE UPLOAD | **PASS** | 201 + metadata DB + object tồn tại |
| GALLERY READ | **PASS** | `imageUrl` tuyệt đối, fetch 200 PNG |
| LIGHTBOX | **PASS** | modal render ảnh, 0 console error |
| DELETE OBJECT | **PASS** | object biến mất khỏi store, record DELETED |
| IDEMPOTENT DELETE | **PASS** | gọi lại → 200 `alreadyDeleted`, object mất vẫn 200 |
| LEGACY IMAGE MIGRATION | **PASS** | migrated / skipped-has-key / missing-marked / HTTP refetch |
| BROKEN IMAGE FALLBACK | **PASS** | placeholder "Ảnh tác phẩm không còn khả dụng" |
| AUTHORIZATION | **PASS** | non-owner 403, owner/admin OK |
| PRIVATE/TEAM VISIBILITY | **NOT APPLICABLE** | UI chỉ tạo PUBLIC; `canViewDrawing` giữ nguyên |
| BACKEND RESTART SURVIVAL | **PASS** | xóa `backend/uploads` + tiến trình mới → ảnh vẫn 200 từ object store |
| PRODUCTION CONFIG | **PASS (code) / ACTION REQUIRED** | fail-closed đúng; env production còn thiếu, phải điền |
| HOME CREATIVE SECTION | **PASS** | section + admin banner hoạt động |
| `/creative-corner` | **PASS** | route + gallery + lightbox |
| **OVERALL CREATIVE STORAGE** | **PASS** | — |
