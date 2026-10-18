# Nguồn bằng chứng

Audit bắt đầu ngày 16/10/2026 và tiếp tục ngày 17/10/2026 (Asia/Ho_Chi_Minh). Thư mục `/tmp/workrank-full-audit-20261016` của lượt đầu không còn ở thời điểm tiếp tục. Các tổng số test lịch sử trong báo cáo lấy từ kết quả đã quan sát trong phiên làm việc; log gốc của lượt đó không còn để đối chiếu. Các tệp trong thư mục evidence này được tạo lại ngày 17/10 và có thể kiểm tra trực tiếp. Không chứa access token, refresh token, password người dùng thật hoặc bản sao DB thật.

DB dùng riêng: `workrank_audit_20261016` (test suite) và `workrank_audit_ui_20261016` (UI/fixtures). Không chạy test xóa bảng trên DB cấu hình mặc định.

Cuối audit đã dừng đúng hai process tự khởi động trên cổng5001 và5173. Ba upload fixture đã chuyển vào evidence/fixtures; chỉ dùng cho DB audit, không tác động DB chính. Nếu muốn xem lại media fixture khi chạy lại DB audit, chép file về đúng thư mục uploads/quiz hoặc uploads/drawings theo loại.
