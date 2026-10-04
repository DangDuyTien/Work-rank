# Hướng dẫn cho AI agent – WorkRank

Áp dụng cho mọi AI (Antigravity, Claude, Codex, Cursor, Copilot…) làm việc trong repo này.

## Animation / chuyển động (BẮT BUỘC)

Trước khi tạo hoặc sửa bất kỳ UI nào ở `frontend/` có chuyển tab, đổi chế độ form, chuyển trang, modal, drawer, dropdown, collapse, list/bảng xếp hạng, số đếm hoặc loading:

1. Đọc và làm đúng theo [.agents/skills/smooth-motion/SKILL.md](.agents/skills/smooth-motion/SKILL.md).
2. Dùng token `--motion-*` / `--ease-*` trong `frontend/src/index.css` và component có sẵn trong `frontend/src/components/ui.jsx`; không tự chế token, không thêm thư viện animation.
3. Mẫu chuẩn là trang Đăng nhập ⇄ Đăng ký (`frontend/src/pages/Login.jsx`): mượt, không nháy, không giật layout, không mất input.
4. Xong việc phải chạy `npm run check` và `npm run build` trong `frontend/`.
