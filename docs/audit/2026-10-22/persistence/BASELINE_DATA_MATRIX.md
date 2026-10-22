# Baseline persistence audit — trước khi sửa UX

Ngày: 22/10/2026. Git baseline: `09d854f`. Audit source + truy vấn chỉ đọc MySQL local, không suy từ local cache.

| Feature | Data | Current source | Persistent? | Expected source | Bug / kết luận ban đầu |
|---|---|---|---|---|---|
| Drawing publish | PNG bytes | multer memory → storage adapter | Local dev: filesystem; production: S3 bắt buộc | Object storage độc lập | Local chưa có bucket; production fail-closed đã tồn tại, chưa có cloud credential |
| Drawing record | URL/key/provider/metadata | Drawing MySQL row | Có | DB + stable object key | 4 ACTIVE: 3 inline DB, 1 provider S3; cần kiểm chứng URL thật |
| Legacy migration | ảnh local có storageKey | migrate-drawing-images.js | Chưa đủ | Migrate tất cả local → S3 | Bỏ qua mọi row có key kể cả provider local; basename mất đường dẫn userId lồng nhau |
| Drawing delete | object/row | current storage adapter → DELETED | DB có | Adapter khớp provider đã lưu | Dùng provider hiện tại cho key cũ có thể xóa nhầm kho, bỏ orphan |
| Drawing UI success | preview | POST success → data URI preview | Chỉ preview local; server có ghi | Read-back server record + remote image | Chưa đọc lại row/ảnh; không có draft recovery sau reload |
| Drawing draft | canvas/history refs | React refs / ImageData | Không | Local recovery được phép, nhãn rõ | Reload mất draft; publish lỗi chỉ giữ tới khi trang còn mở |
| Arcade input | events/provisional metrics | refs + sessionStorage + progress API 1s | Server checkpoint vào ArcadePlayer.events | Local trước, deferred DB checkpoint | Local chỉ là recovery; cần final flush trước rời/unload |
| Arcade result | replay metrics/result JSON | server settle transaction + ArcadePlayer.result | Có trong code | DB | DB local hiện 0 player rows; chưa được phép tuyên bố lost persistence |
| Arcade schema | rules_version/rematch_id | model/migration, startup ensure | DB local thiếu 2 cột | Migration/schema đúng phiên bản | Query current model có thể lỗi trên DB chưa nâng schema |
| Arcade PB/BXH | best per user | DB query Player + Room | Có | DB | Chỉ lọc rulesVersion2 và duration cấu hình hiện tại; phiên bản/thời lượng khác bị ẩn |
| Arcade rewards | XP | ScoreLedger key arcade:playerId | Có, transaction | DB exactly once | Cần verify retry, restart và rollback |
| Arcade result discovery | completed matches | room route known ID | Row có, không có history endpoint | Backend history/read-back | Clear storage không còn lối tìm trận cũ trong UI |
| Typing room result | WPM/accuracy/rank/score | TypingMatchResult + Player finalPayload + Stat + Ledger | Có | DB | MySQL có 100 match result rows; cần replay/reset/read-back QA |
| Typing practice | draft/final | TypingPracticeAttempt DB + local recovery | Có | DB, final history | Active endpoint chỉ trả READY/ACTIVE; sau reload UI không có lối xem final practice |
| Typing PB/BXH | verified records | typingVerifiedRecords + DB | Có | DB | Short practice <120s intentionally not ranked; UI cần nói rõ |
| UI preferences | mute/tutorial | localStorage | Local, hợp lệ | Local | Không phải kết quả vĩnh viễn |
| Auth/cache | token / API cache | browser auth/cache | Local auth/cache, hợp lệ | Login + backend reads | Kiểm tra session B và clear storage bằng login mới |

Không tìm thấy bằng chứng source hiện tại thay final DB bằng localStorage. Hai vấn đề phân biệt rõ: code path có DB, nhưng bằng chứng QA cũ dùng SQLite `:memory:` nên không chứng minh được backend restart; và local MySQL chưa có schema arcade mới. Kết luận regression sẽ được cập nhật sau full-stack persistence test.

## Regression đã tái hiện trên MySQL thật

1. `TypingRoom.mode` có TRIO nhưng `TypingMatchResult.mode` không có; MySQL từ chối final result, SQLite không bắt được enum mismatch. Migration mới nâng cả hai enum; 100 result cũ giữ nguyên.
2. Immutable arcade history so `JSON.stringify` theo thứ tự khóa. MySQL canonicalizes JSON keys nên các checkpoint sau bị 400 dù action không đổi. Backend và recovery phải so nội dung action.
3. Fresh MySQL schema sync lỗi `ER_BLOB_CANT_HAVE_DEFAULT` ở `TypingPracticeAttempt.typed_text`: model có default chuỗi trên LONGTEXT, migration đúng không có. Đã đồng bộ model với migration.
4. Drawing #4 trỏ tới mock S3 localhost4599 đã tắt. Tìm được đúng object PNG397061bytes ở key gốc, sao lưu và khôi phục tạm bytes gốc vào cột DB image_url. Không dùng QA S3 URL để ghi đè dữ liệu làm việc; migration object storage production còn PENDING_BUCKET.
