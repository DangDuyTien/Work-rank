# BÁO CÁO TOÀN DIỆN & KẾ HOẠCH NÂNG CẤP UNO UI/UX (REMEDIATION PHASE)
**Ngày thực hiện:** 2026-10-18  
**Dự án:** WorkRank Multiplayer Platform (`workrank-realtime`)  
**Mục tiêu:** Nâng cấp trải nghiệm UNO từ 6/10 lên 9/10 (Production-Quality Digital Tabletop).  
**Đơn vị thực hiện:** Claude Code Agent Team:
- **Team Lead:** Tổng hợp kiến trúc, quản trị phân quyền file, kiểm duyệt cổng chất lượng.
- **Teammate 1 (UNO Game UX):** Trật tự tương tác, máy trạng thái lượt đi, sảnh chờ, kết thúc trận.
- **Teammate 2 (UNO Visual / Responsive):** Bàn chơi digital tabletop, thiết kế bài, responsive 390px–1920px, chuyển động mượt.
- **Teammate 3 (UNO Accessibility / Interaction):** Điều hướng bàn phím, tương phản WCAG 2.1 AA, mã hóa phi màu, hit targets.
- **Teammate 4 (QA / Adversarial Review):** Kiểm thử phá vỡ logic, phát hiện rò rỉ ID, kịch bản góc chết, nghiệm thu E2E.

---

## 1. Baseline UX & Hiện Trạng Trước Khi Sửa Đổi

### Đánh giá chất lượng khởi điểm: **5.5 / 10**
- **Lobby UX:** 5/10 — Form sảnh chờ dạng bảng thô sơ, thiếu thông tin phòng, không có nút thêm bot trực tiếp trong sảnh chờ.
- **Gameplay UX:** 5.5/10 — Bàn cờ là một khối chữ nhật xám đen phẳng lỳ không có cảm giác bàn bài thật; thiếu hiển thị chiều xoay lượt (Direction Indicator) và màu đang hiệu lực (Active Color) sau lá Wild.
- **Hand Interaction:** 6/10 — Quạt bài nan xòe gây cắt xén, hiệu ứng viền neon cyan `0 0 16px` quá chói và làm mất tập trung; lỗi flexbox `justify-content: center` làm mất các lá bài bên trái khi cuộn trên mobile 390px.
- **End Game Experience:** 2/10 — Lộ ID database (`Người thắng: 32`), không có màn hình vinh danh hay bảng xếp hạng điểm thưởng; rời bàn khi đã kết thúc ván lại bị gán thành "Đầu hàng" (Surrender).
- **Accessibility:** 4/10 — Phụ thuộc 100% vào màu sắc; tương phản màu Vàng/Trắng vi phạm WCAG AA (chỉ đạt 2.18:1); khóa bàn phím khi không phải lượt.

### Bằng chứng trực quan (Baseline Screenshots):
- `docs/audit/2026-10-18/baseline-01-lobby.png`: Sảnh chờ thô sơ.
- `docs/audit/2026-10-18/baseline-02-waiting-room.png`: Phòng chờ xếp dọc danh sách, chữ mờ trên nền trắng.
- `docs/audit/2026-10-18/baseline-03-gameplay-my-turn.png`: Viền neon cyan chói mắt, nút "Bỏ lượt" nằm đè dưới bài.
- `docs/audit/2026-10-18/baseline-04-gameplay-opponent-turn.png`: Lượt đối thủ không có đếm ngược, bàn cờ thiếu chiều quay.
- `docs/audit/2026-10-18/baseline-05-game-finished-results.png`: Lộ chuỗi thô `Người thắng: 88` dưới đáy màn hình.
- `docs/audit/2026-10-18/baseline-06-mobile-gameplay-390px.png`: Vỡ cột đối thủ tại 390px, thanh bài tràn viền.

---

## 2. Bảng Ma Trận Vấn Đề UX (UNO UX Issue Matrix)

| ID | Khu vực | Mô tả vấn đề & Bằng chứng kỹ thuật | Phân loại | Khắc phục đề xuất |
| :--- | :--- | :--- | :---: | :--- |
| **UX-01** | Kết quả trận | **Lộ ID người dùng database (`Người thắng: 32`)**: Không có modal vinh danh, không có tên, avatar, điểm XP WorkRank. | **P1** | Xây dựng `UnoResultModal` vinh danh Quán quân, bảng thành tích 4 người, điểm XP, nút Chơi lại và Về sảnh. |
| **UX-02** | Luật chơi | **Bỏ lượt tùy tiện không cần rút bài (Rules Bypass)**: Cả frontend và backend đều cho phép bấm Bỏ lượt ngay đầu lượt mà không bốc bài. | **P1** | Khóa nút Bỏ lượt khi chưa rút; backend chặn `/pass` nếu `hasDrawnThisTurn === false`. Rút bài xong mới cho phép qua lượt. |
| **UX-03** | Trực quan bài | **Chói sáng Neon Cyan & Thiếu nhận diện phi màu**: Viền cyan `0 0 16px` gây chói; người mù màu không phân biệt được Đỏ/Lá, Vàng/Lá. | **P1** | Đổi sang viền thanh lịch; bổ sung biểu tượng Shape (◆, ▲, ●, ■, ★) và ký tự Suit (Đ, V, L, D, W) ở góc và trung tâm bài. |
| **UX-04** | Bàn phím / A11y | **Khóa bàn phím khi không phải lượt**: `tabIndex={isPlayable ? 0 : undefined}` tước quyền xem bài bằng bàn phím khi tới lượt đối thủ. | **P1** | Chuẩn hóa Roving Tabindex + phím mũi tên Left/Right, giữ toàn bộ bài trong DOM kèm `aria-disabled`. |
| **UX-05** | Chọn màu Wild | **Lồng đè 2 lớp Modal (Double Overlay Nesting)**: `AnimatedModal` bọc ngoài `UnoColorPicker` gây tối đen màn hình và lỗi focus trap. | **P1** | Tách `UnoColorPicker` thành 1 dialog độc lập chuẩn React Portal, hỗ trợ phím tắt R, Y, G, B, 1, 2, 3, 4 và Escape. |
| **UX-06** | Bố cục Mobile | **Mất lá bài đầu tiên khi cuộn ngang trên 390px**: Thuộc tính `justify-content: center` trên `overflow-x: auto` làm mất bài bên trái. | **P2** | Áp dụng `justify-content: flex-start` khi tràn, thẻ bài có độ rộng chạm tối thiểu 48px, nhấc bài 24px khi chạm/chọn. |
| **UX-07** | Bàn cờ & Chiều | **Bỏ quên Direction Indicator & Active Color**: Bàn chơi thiếu vầng hào quang báo màu hiện tại và chiều quay vòng chơi. | **P2** | Tích hợp `UnoDirectionIndicator` vào trung tâm bàn cờ, vòng phát sáng màu trên Discard Pile. |
| **UX-08** | Sảnh & Phòng chờ | **Phòng chờ mờ nhạt, thiếu nút thêm bot của Host**: Không thấy nút 👑 Chủ phòng, chưa có nút "+ Thêm Bot" cho Host. | **P2** | Thiết kế 4 slot vị trí sang trọng, badge 👑 Chủ phòng, trạng thái Sẵn sàng rõ ràng, nút Thêm Bot tức thì. |
| **UX-09** | Phản hồi đánh bài | **Không có thông báo lý do bài không hợp lệ (Dead Clicks)**: Nhấp bài không đánh được thì không có bất kỳ phản hồi nào. | **P2** | Thêm micro-shake kèm tooltip lý do: "Không cùng màu hoặc số", "Chưa đến lượt bạn". |
| **UX-10** | Âm thanh | **Lãng phí 4 hiệu ứng âm thanh Synthesizer**: `turnAlert`, `unoCall`, `penalty`, `victory` có sẵn nhưng chưa kết nối socket. | **P3** | Kết nối đầy đủ hiệu ứng âm thanh với các sự kiện socket tương ứng. |

---

## 3. Định Hướng Thiết Kế Hợp Nhất (Unified Design Direction)

1. **Khái niệm "Digital Tabletop" (Mặt bàn thi đấu chuyên nghiệp):**
   - Loại bỏ giao diện dạng bảng dashboard cứng nhắc. Thay thế bằng mặt bàn nỉ cao cấp với viền bo tròn mềm mại (`border-radius: 36px`), lớp nền sâu lắng `#090d16` kết hợp ánh sáng vòm radial gradient tinh tế.
   - Bố cục 3 hướng đối thủ trực quan: Đối thủ 1 (West), Đối thủ 2 (North), Đối thủ 3 (East).
   - Vùng trung tâm (Center Ring): Chồng bài rút (Draw Pile) có hiệu ứng xếp lớp 3D; Chồng bài đã đánh (Discard Pile) có vòng hào quang theo màu đang có hiệu lực (`activeColor`). Ở giữa là la bàn chiều xoay (Direction Indicator).
2. **Hệ thống thẻ bài UNO WorkRank (Card Identity):**
   - Tỷ lệ chuẩn bài quốc tế: `80px x 120px` (Desktop), `64px x 96px` (Tablet/Mobile).
   - Biểu tượng đa tầng cho người khiếm thị màu:
     - **Đỏ:** Ký hiệu ◆ Diamond, nhãn Đ, mã màu `#ef4444`.
     - **Vàng:** Ký hiệu ▲ Triangle, nhãn V, mã màu `#f59e0b`, chữ đậm tương phản cao.
     - **Xanh Lá:** Ký hiệu ● Circle, nhãn L, mã màu `#10b981`.
     - **Xanh Dương:** Ký hiệu ■ Square, nhãn D, mã màu `#3b82f6`.
     - **Đổi Màu (Wild):** Ký hiệu ★ Star, nhãn W, gradient 4 góc màu sang trọng.
   - Phân biệt số `6̲` và `9̲` bằng gạch chân rõ ràng.
3. **Quy tắc chuyển động & tương tác (Motion & Smooth Transitions):**
   - Tuân thủ nghiêm ngặt `.agents/skills/smooth-motion/SKILL.md`.
   - Chỉ sử dụng các token `--motion-fast` (180ms), `--motion-normal` (260ms), `--ease-standard`, `--ease-spring`.
   - Tuyệt đối không dùng `transition: all`, không animate `width/height/margin`.
   - Bài khi rê chuột/chọn: nhấc bổng mượt mà `translateY(-24px)` và tăng `z-index: 50`.

---

## 4. Phân Quyền Sở Hữu File Độc Quyền (Exclusive File Ownership)

Để tránh xung đột code giữa các thành viên:

| File | Thành viên phụ trách | Nhiệm vụ chính |
| :--- | :--- | :--- |
| `frontend/src/pages/UnoGame.jsx` | **Team Lead & Teammate 1** | Tái cấu trúc State Machine, tích hợp bàn chơi, kết nối âm thanh, socket handlers. |
| `frontend/src/components/uno/UnoCard.jsx` | **Teammate 2 & Teammate 3** | Thiết kế lại quân bài, bổ sung shape/suit chữ, gạch chân 6/9, focus ring, nhấc bài. |
| `frontend/src/components/uno/UnoHand.jsx` | **Teammate 2** | Xử lý bố cục quạt bài, giải quyết triệt để lỗi cuộn mobile 390px, roving tabindex. |
| `frontend/src/components/uno/UnoPlayerSeat.jsx` | **Teammate 2** | Tinh chỉnh vị trí ghế ngồi (North, West, East), badge 👑 Host, nút Bắt lỗi UNO lớn $\ge 44\text{px}$. |
| `frontend/src/components/uno/UnoDrawPile.jsx` | **Teammate 2** | Thiết kế chồng bài rút 3D, trạng thái tương tác hover/press khi tới lượt rút bài. |
| `frontend/src/components/uno/UnoDiscardPile.jsx` | **Teammate 2** | Thêm vòng hào quang Active Color, số đếm bài đã đánh. |
| `frontend/src/components/uno/UnoColorPicker.jsx` | **Teammate 3** | Chuẩn hóa modal độc lập, phím tắt R/Y/G/B, tương phản màu vàng chữ đen. |
| `frontend/src/components/uno/UnoTurnIndicator.jsx` | **Teammate 1** | Hiển thị rõ "LƯỢT CỦA BẠN" và "ĐANG CHỜ [Tên/Bot]", thanh đếm thời gian mượt mà. |
| `frontend/src/components/uno/UnoResultModal.jsx` | **Teammate 1** | Tạo mới modal kết quả vinh danh Quán quân, bảng thứ hạng, XP và nút Chơi lại. |
| `backend/src/services/unoGame.service.js` | **Team Lead** | Sửa quy tắc `passTurn` chỉ cho phép sau khi rút bài; sửa `leaveRoom` khi game đã finished. |

---
