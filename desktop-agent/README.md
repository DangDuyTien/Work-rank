# WorkRank Desktop Companion (Computer Activity Tracker)

Bộ đệm theo dõi hoạt động toàn máy tính (Computer Activity Tracking) cho hệ thống WorkRank.

## 🎯 Nguyên tắc hoạt động
- **Hoạt động toàn máy tính**: Tự động ghi nhận thời gian làm việc và mức độ tập trung trên toàn hệ thống (Adobe Premiere, Photoshop, Chrome, Office Word/Excel, VS Code...).
- **Không cần bật thủ công**: Không cần bấm nút "Bắt đầu" trên web. Khi máy tính hoạt động (chuột/bàn phím tương tác), điểm tự động được tính.
- **Tự động ghép nối (Auto-Pairing)**: Khi bạn đăng nhập vào web WorkRank trên trình duyệt máy tính, web sẽ tự động kết nối với Agent qua cổng nội bộ `http://127.0.0.1:43124`.
- **Tuyệt đối an toàn & Riêng tư**:
  - ❌ **KHÔNG** đọc nội dung văn bản hay lưu phím bấm (No Keylogger).
  - ❌ **KHÔNG** chụp ảnh màn hình, không bật webcam/micro.
  - ❌ **KHÔNG** can thiệp hay hạn chế quyền sử dụng của nhân viên.
  - ❌ **KHÔNG** phạt hay flag gian lận (No Anti-cheat / Anti-hack).

---

## 🖥️ Dành Cho Máy WINDOWS (Nhân Viên Làm Việc)

Thư mục `desktop-agent` đã chuẩn bị sẵn các file bấm đúp chuột (không cần gõ lệnh):

### 1. Khởi động tự động cùng Windows (Khuyên dùng)
- Bấm đúp vào file: **`install-autostart.bat`**
- Hệ thống sẽ tạo shortcut chạy ngầm trong thư mục Startup của Windows. Từ nay, mỗi khi mở máy tính là hệ thống tự động chạy ngầm và tính điểm.

### 2. Chạy ngầm ngay lập tức (Ẩn hoàn toàn không hiện cửa sổ)
- Bấm đúp vào file: **`start-agent-silent.vbs`**

### 3. Chạy có cửa sổ kiểm tra (Dành cho IT / Test)
- Bấm đúp vào file: **`start-agent.bat`**
- Cửa sổ màu đen sẽ hiển thị log nhận sự kiện và gửi batch điểm mỗi 15 giây lên server.

### 4. Gỡ bỏ tự khởi động
- Bấm đúp vào file: **`uninstall-autostart.bat`**

---

## 🍎 Dành Cho Máy macOS (Dev / Thiết Kế)

Mở Terminal và gõ:

### 1. Chạy thử ngay
```bash
npm run agent
```

### 2. Cài chạy ngầm vĩnh viễn (LaunchAgent)
```bash
node desktop-agent/index.js --install-autostart
```

### 3. Kiểm tra trạng thái
```bash
npm run agent:status
```

### 4. Gỡ bỏ tự khởi động
```bash
node desktop-agent/index.js --uninstall-autostart
```
