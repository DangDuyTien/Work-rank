# Hướng Dẫn Thiết Lập Keep-Alive Cho Render Free Web Service (WorkRank)

Tài liệu này hướng dẫn chi tiết cách thức duy trì trạng thái hoạt động (giảm thiểu tối đa cold start do spin-down) cho backend WorkRank chạy trên gói **Render Free Web Service**.

---

## 1. Nguyên Lý Hoạt Động & Cơ Chế Của Render Free

- **Quy tắc Spin-Down của Render Free**:
  Sau **15 phút liên tục không có bất kỳ inbound traffic nào** (HTTP requests hoặc WebSocket messages), hệ thống Render sẽ tự động tạm dừng (spin down) container để tiết kiệm tài nguyên máy chủ.
  Khi có request tiếp theo gửi đến, Render sẽ khởi động lại container (cold start), gây độ trễ từ **30 đến 50 giây** cho người dùng đầu tiên.
- **Tại sao KHÔNG THỂ dùng Self-Ping (Node tự ping chính nó)**:
  Nếu Render đã spin down, tiến trình Node.js đã bị dừng hoàn toàn. Khi tiến trình không còn chạy, code nội bộ không thể tự thực thi để đánh thức chính nó.
- **Kiến trúc giải pháp chuẩn**:
  Sử dụng một **External Monitor / Cron bên ngoài** gửi định kỳ HTTP `GET /health` đến URL công khai của Web Service.
  ```
  [External Monitor / Cron Server] 
            │
            │  (Định kỳ 10 phút / lần)
            ▼
  GET https://work3winmedia.onrender.com/health
            │
            ▼
  [Render Edge Proxy (Bỏ qua Cache)]
            │
            ▼
  [WorkRank Express Web Service Process] (Nhận Inbound Traffic → Reset 15m Idle Timer)
  ```

---

## 2. Hạn Mức 750 Giờ Miễn Phí (Instance Hours) / Tháng

> [!IMPORTANT]
> **Quy tắc tính toán 750 Free Hours của Render**:
> - Render cấp **750 Free Instance Hours cho TOÀN BỘ WORKSPACE mỗi tháng dương lịch**, không phải tính riêng cho từng service.
> - Tháng 30 ngày: \(30 \times 24 = 720\) giờ.
> - Tháng 31 ngày: \(31 \times 24 = 744\) giờ.
> - Tháng 2 (28–29 ngày): \(672 - 696\) giờ.
> - **Nếu bạn CHỈ CÓ 1 Web Service Free chạy liên tục 24/7**: Tổng số giờ tiêu thụ là 720–744 giờ, **hoàn toàn NẰM TRONG hạn mức 750 giờ/tháng**.
> - **CẢNH BÁO NẾU CÓ NHIỀU SERVICES**: Nếu workspace có từ 2 Web Services Free trở lên cùng chạy 24/7, tổng giờ sẽ cạn kiệt vào khoảng ngày 15–16 của tháng, khiến Render tạm khóa tất cả các dịch vụ Free trong workspace đó cho đến ngày 01 tháng sau.

---

## 3. Danh Sách Endpoint Kiểm Tra Sức Khỏe (Health Probes)

| Endpoint | Mục đích | Truy vấn DB? | Mã phản hồi | Ghi chú |
| :--- | :--- | :---: | :---: | :--- |
| `GET /health` | **Keep-Alive & Platform Probe chính** | **KHÔNG** | `200 OK` | Siêu nhẹ (<150 bytes), không query DB, có header `Cache-Control: no-cache, no-store`. |
| `GET /api/health` | Alias cho Render `healthCheckPath` | **KHÔNG** | `200 OK` | Đồng bộ với cấu hình `render.yaml`. |
| `GET /health/live` | Liveness Probe cho orchestrators | **KHÔNG** | `200 OK` | Trả về thông tin uptime và pid của process. |
| `GET /health/ready` | Readiness Probe kiểm tra kết nối DB | **CÓ** | `200 OK` / `503` | Chỉ dùng khi cần xác nhận MySQL kết nối thành công. |

Mọi request đến `/health` và `/api/health` đều:
1. Đặt header `Cache-Control: no-cache, no-store, must-revalidate, max-age=0` để Render Edge không cache kết quả.
2. Không bị chặn bởi Express `apiLimiter`.
3. Bỏ qua ghi log truy cập (`morgan`) để tránh làm tràn production log.
4. Tự động cập nhật thời điểm ping gần nhất (`lastHealthPingAt`) và tổng số ping (`healthPingCount`) trong bộ nhớ cho Admin theo dõi.

---

## 4. Các Cách Cấu Hình External Monitor (Định Kỳ 10 Phút/Lần)

Chọn một trong 3 phương pháp bên dưới (chỉ cần chọn **1 phương pháp**, không cần chạy đồng thời cả 3):

### Phương Pháp 1: Dùng Cron-Job.org (Miễn Phí 100%, Khuyên Dùng Nhất)
1. Truy cập [https://cron-job.org](https://cron-job.org) và đăng ký tài khoản miễn phí.
2. Bấm **Create Cronjob**:
   - **Title**: `WorkRank Render Keep-Alive`
   - **URL**: `https://work3winmedia.onrender.com/health`
   - **Execution Schedule**: Chọn **User-defined** → `Every 10 minutes` (hoặc `*/10 * * * *`).
   - **Request Method**: `GET`
   - **Request Headers**:
     - Key: `Cache-Control`, Value: `no-cache`
   - **Request Timeout**: 15 seconds.
3. Bấm **Create** để kích hoạt.

### Phương Pháp 2: Dùng GitHub Actions (Tích Hợp Sẵn Trong Repo)
Trong repository đã có file workflow tại:
`.github/workflows/render-keep-alive.yml`

- Workflow này chạy lịch trình tự động `cron: '*/10 * * * *'` bằng runner Ubuntu của GitHub.
- Mặc định gọi đến `https://work3winmedia.onrender.com/health`.
- Nếu đổi domain, bạn có thể tạo GitHub Repository Variable: `KEEP_ALIVE_URL` với giá trị URL mới.

### Phương Pháp 3: Dùng UptimeRobot / Better Stack
1. Đăng ký tài khoản tại [https://uptimerobot.com](https://uptimerobot.com).
2. Tạo **New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `WorkRank Health Probe`
   - **URL (or IP)**: `https://work3winmedia.onrender.com/health`
   - **Monitoring Interval**: `10 minutes` (hoặc 5 minutes).
3. Lưu monitor.

---

## 5. Giám Sát & Kiểm Tra Vận Hành

Admin hệ thống có thể kiểm tra trạng thái Keep-Alive trực tiếp tại giao diện quản trị:
- Đường dẫn: **Admin Operations** (`/admin/operations` hoặc `/operations`)
- Tab: **Trạng Thái Hệ Thống (Health)**
- Thẻ thông tin: **Web Service & Keep-Alive** hiển thị:
  - Trạng thái dịch vụ: `ONLINE`
  - Thời điểm Keep-alive gần nhất: `hh:mm dd/MM/yyyy`
  - Tổng số lượt Ping nhận được: `N` lượt
  - Tần suất khuyến nghị: `10 phút/lần`.
