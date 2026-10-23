# WorkRank Typing — gộp 2 game thành 2 chế độ

Ngày: **22/10/2026**. Project: `/Applications/du-an/workrank/workrank-realtime`.

## Vì sao có thay đổi này

Chủ dự án phản hồi: *"sao chưa thấy bộ từ vài nghìn từ"* và yêu cầu **gộp game gõ chữ với Computer Rush thành 2 chế độ**.

Kiểm tra trước khi sửa:

| Câu hỏi | Kết quả |
|---|---|
| Kho từ 2.817 có thật trong code? | Có — `shared/arcade/vocabulary/` |
| Production có ship kho từ đó? | **Có** — tải `https://work3winmedia-c94e.onrender.com/assets/arcade-polish-7KoyxoYT.js`, tìm thấy nguyên chuỗi `meeting, agenda, minutes` và `công việc, cuộc họp` |
| Vì sao người dùng không thấy? | Không có chỗ nào hiển thị số lượng từ; và Computer Rush nằm lẫn trong danh mục 3 game arcade nên không rõ đây là "game gõ" |

→ Sửa bằng cách **hiển thị rõ kho từ** và **gộp 2 game gõ thành một cửa vào 2 chế độ**.

## Cấu trúc sau khi gộp

```text
Danh mục trò chơi
├── WorkRank Typing        → /games/typing            (chọn chế độ)
│   ├── Gõ từ   (Computer Rush) → /games/typing/words
│   └── Gõ đoạn (Typing Battle) → /games/typing/passage
├── Direction Rush
├── Memory Flash
└── Góc Sáng Tạo (Game Vẽ)
```

Trước đây danh mục có **5 thẻ** (Computer Rush, Direction Rush, Memory Flash, WorkRank Typing Battle, Drawing); nay còn **4 thẻ**.

| Route | Nội dung |
|---|---|
| `/games/typing` | Màn chọn chế độ (mới) |
| `/games/typing/words` | Lobby chế độ Gõ từ (Computer Rush) |
| `/games/typing/words/room/:roomId` | Phòng chơi Gõ từ |
| `/games/typing/passage` | Lobby chế độ Gõ đoạn (Typing Battle) |
| `/games/typing/room/:roomId` | Phòng Gõ đoạn (giữ nguyên) |
| `/games/typing/spectate/:roomId` | Xem trận Gõ đoạn (giữ nguyên) |
| `/games/arcade/computer_rush` | Vẫn hoạt động (deep link cũ, script QA, lịch sử) |

Điểm quan trọng: **không đụng gameplay**. Mỗi chế độ giữ nguyên phòng, luật, điểm, BXH, persistence và server authority của nó. Đây là gộp ở tầng điều hướng, không phải viết lại engine.

## Hiển thị kho từ

Màn chọn chế độ đọc trực tiếp `VOCAB_STATS` từ module dữ liệu (không hard-code số):

- Thẻ "Gõ từ": `2.817 từ · 13 chủ đề · 60 giây`
- Dòng ghi chú: `Kho từ gõ nhanh: 2.817 mục · 1.767 tiếng Anh · 1.050 tiếng Việt · 13 nhóm chủ đề. Không lặp từ trong cùng một trận.`

Vì lấy từ `VOCAB_STATS`, nếu sau này thêm/bớt từ thì con số tự đúng — không có nguy cơ lệch như số viết tay.

## Điều hướng đã sửa

| Trước | Sau |
|---|---|
| Back trong Computer Rush → `/games` | → `/games/typing` (về đúng cửa game) |
| Rời phòng Gõ từ → `/games/arcade/computer_rush` | → `/games/typing/words` |
| URL phòng Gõ từ: `/games/arcade/computer_rush/room/:id` | `/games/typing/words/room/:id` (deep link arcade cũ vẫn mở được) |
| Lobby Gõ đoạn → `/games/typing` | `/games/typing/passage` |
| Nhãn "Game Center" ở topbar | "WorkRank Typing" |
| Sidebar "WorkRank Typing Battle" | "WorkRank Typing" |

## Bằng chứng chạy thật (Chromium + Vite + Express + MySQL)

| Bước | Kết quả |
|---|---|
| Danh mục có thẻ "WorkRank Typing" | PASS |
| Danh mục **không** còn thẻ "Computer Rush" riêng | PASS (0 kết quả) |
| Bấm thẻ → `/games/typing` | PASS |
| Màn chọn chế độ hiện `2.817` | PASS |
| Bấm "Gõ từ" → `/games/typing/words` | PASS |
| "Vào chơi ngay" → `/games/typing/words/room/…` | PASS |
| Từ hiển thị lấy từ kho mới (`CACHE`, `CARD`) + nhãn `ENGLISH` | PASS |
| Rời phòng → về `/games/typing/words` | PASS |
| Back ở lobby → `/games/typing` | PASS |
| "Gõ đoạn" → `/games/typing/passage` tải được | PASS |
| 390×844: 2 thẻ xếp dọc, không tràn ngang | PASS |

Ảnh: `hub-d.png`, `hub-m.png`, `words-room.png`, `passage-d.png`.

## Kiểm tra tự động

| Bộ | Kết quả |
|---|---|
| `game_catalog` + `arcade_service` + `arcade_vocabulary` | **29/29 PASS** |
| Frontend `npm run check` | 90 files, 0 errors |
| Frontend `npm run build` | ✓ 5.02s |

## Rủi ro còn lại

1. **Kho đoạn văn của "Gõ đoạn" chỉ có 68 đoạn** (`typing_challenges`). Đây là điểm nghèo nội dung tiếp theo nếu người chơi để ý — chưa mở rộng trong task này vì yêu cầu là gộp và kiểm kho từ.
2. **Bookmark cũ `/games/typing`** giờ mở màn chọn chế độ thay vì vào thẳng Typing Battle. Phòng và spectate vẫn giữ URL cũ nên link đang chơi không gãy.
3. **Trạng thái bật/tắt trong admin** vẫn quản lý theo 2 khoá riêng (`typing_battle`, `computer_rush`). Tắt `computer_rush` sẽ chặn tạo phòng Gõ từ (backend trả lỗi rõ), nhưng thẻ "Gõ từ" vẫn hiện — chưa ẩn theo trạng thái.
4. Tên game trong DB được cập nhật idempotent khi backend khởi động (`ensureDefaultCatalog`), nên môi trường chưa restart sẽ còn thấy tên cũ trong trang admin.
