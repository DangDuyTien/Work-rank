# Cấu hình kho ảnh Drawing

Ngày kiểm tra: 22/10/2026. Hiện chủ dự án chưa có kho ảnh production. Code hỗ trợ S3-compatible; dịch vụ S3 trên máy kiểm thử chỉ dùng QA, không phải kho production.

> Đã chạy nghiệm thu end-to-end (publish → object → DB → browser khác → clear storage → restart → xóa `uploads` + restart) trên SeaweedFS S3-compatible. Xem [DRAWING_PERSISTENT_STORAGE_FINAL_REMEDIATION.md](audit/2026-10-22/DRAWING_PERSISTENT_STORAGE_FINAL_REMEDIATION.md) và harness `frontend/scripts/drawing-storage-acceptance.mjs` (publish/read/delete) để chạy lại trên bucket thật.

## Hành vi hiện tại

- Vẽ, undo/redo và tải PNG dùng được khi chưa có kho ảnh.
- Bản nháp IndexedDB có nhãn “trên thiết bị”, không được dùng làm dữ liệu gallery.
- Publish mới yêu cầu `STORAGE_PROVIDER=s3` cùng cấu hình hợp lệ. Development và production đều từ chối publish vào local disk. Local adapter chỉ còn phục vụ legacy/tooling và unit test.
- Kho ảnh lỗi trả 502/503; UI giữ nháp để retry. Không có fallback sang `/uploads`.
- Sau upload, backend commit bản ghi; UI fetch lại bản ghi và tải được ảnh từ URL hệ thống rồi mới báo “Đã lưu lên hệ thống”.

## Biến môi trường backend

Tạo bucket lâu dài ở dịch vụ S3-compatible đã chọn. Cấu hình các giá trị dưới đây trong secret/environment settings của backend, không đưa credential vào frontend hoặc Git.

```dotenv
STORAGE_PROVIDER=s3
STORAGE_BUCKET=<bucket-cua-du-an>
STORAGE_REGION=<region-provider-yeu-cau>
STORAGE_ENDPOINT=https://<endpoint-s3-api>
STORAGE_ACCESS_KEY=<access-key>
STORAGE_SECRET_KEY=<secret-key>
STORAGE_PUBLIC_BASE_URL=https://<ten-mien-anh-on-dinh>
STORAGE_FORCE_PATH_STYLE=true
STORAGE_KEY_PREFIX=workrank
```

`STORAGE_ENDPOINT` có thể bỏ trống cho AWS S3. `STORAGE_FORCE_PATH_STYLE` theo endpoint/provider. `STORAGE_PUBLIC_BASE_URL` phải là HTTPS ở production, ánh xạ tới gốc bucket hoặc prefix của CDN, không chứa signed query/token hết hạn. Backend suy ra URL từ `storage_key`, nên có thể đổi domain CDN khi bytes vẫn trỏ đúng bucket/key.

Credential cần PUT/HEAD/DELETE trên prefix ảnh. URL ảnh cần GET được bằng browser theo cấu hình phân phối ảnh của dự án. Adapter hiện dùng URL public ổn định; visibility của gallery được kiểm tra tại API. Đổi bucket cần chuyển bytes trước; chỉ đổi domain không di chuyển object.

`render.yaml` đã khai báo các biến S3, credential dùng `sync: false`. Điền giá trị thực trong môi trường deploy. Không dùng endpoint `127.0.0.1` của QA cho production.

## Kiểm tra trước khi mở publish

1. Khởi động backend mới; kiểm tra `/api/drawings/storage/status` bằng tài khoản admin. Endpoint chỉ trả tên biến còn thiếu, không trả secret. `/api/drawings/settings` trả `publishing.available` để UI hiển thị đúng trạng thái.
2. Publish một PNG thật; kiểm tra DB có `storage_key`, `storage_provider=s3`, `metadata.uploadState=CONFIRMED`, checksum, publicationId. HEAD/GET object phải thành công.
3. Đăng nhập một browser khác, mở Creative Gallery và kiểm tra ảnh. Xóa toàn bộ browser storage rồi login lại; kết quả phải giống nhau.
4. Restart/redeploy backend và frontend. Ảnh và bản ghi vẫn phải còn trong kho độc lập.
5. Xóa một tranh QA bằng owner; object phải mất, DB thành `DELETED`. Khi kho lỗi, DB giữ `HIDDEN + deletionPending`; worker startup và mỗi 60 giây thử lại.

Chỉ đánh dấu production PASS sau các bước này với bucket thật của dự án.

## Chuyển ảnh cũ

Sao lưu DB và files nguồn trước khi chạy. Tại `/Applications/du-an/workrank/workrank-realtime/backend`, sau khi đã cấu hình bucket:

```sh
npm run db:migrate-drawings -- --dry-run --report /tmp/workrank-drawing-migration-preview.json
npm run db:migrate-drawings -- --report /tmp/workrank-drawing-migration-result.json
```

Script chỉ cho migration thực vào object storage. Key legacy được suy ra từ drawingId + checksum nên chạy lại không tạo bản sao. Bản ghi local có sẵn key vẫn được chuyển; bản ghi S3 có key phải HEAD tồn tại mới được coi là đã chuyển. File/object mất được báo trong JSON và exit code khác 0; không tạo ảnh giả.

Ba SVG inline legacy hiện được giữ nguyên trong DB. PNG Drawing #4 ở DB làm việc đã được khôi phục bằng đúng bytes gốc từ kho mock cũ, đang chờ chuyển sang bucket thật. Bản phục hồi này là dữ liệu legacy, không phải fallback cho publish mới. Chi tiết checksum và bản sao an toàn nằm trong báo cáo audit ngày 22/10/2026.
