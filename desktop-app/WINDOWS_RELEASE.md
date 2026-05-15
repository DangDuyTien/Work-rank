# WorkRank Tracker Windows Release

Quy trình này tạo file Windows `.exe` để phát trực tiếp cho người dùng qua link tải của WorkRank.

## Mục tiêu

- Người dùng tải `WorkRank Tracker Setup.exe` hoặc bản portable `.exe`.
- App đăng ký `workrank://` để web có thể mở tracker.
- File release được ký số và có checksum để người dùng kiểm tra.
- App có màn hình "Dữ liệu WorkRank ghi nhận" để minh bạch dữ liệu.

## Chuẩn bị máy build

Nên build trên Windows x64 để native module `uiohook-napi` khớp môi trường chạy thật.

```powershell
cd workrank-realtime\desktop-app
npm ci
```

## Build bản chưa ký số để test nội bộ

```powershell
npm run dist:win
```

File output nằm trong:

```text
desktop-app\release\
```

Kết quả gồm:

- `WorkRank Tracker-Setup-<version>-x64.exe`: installer theo user, không yêu cầu admin mặc định.
- `WorkRank Tracker-Portable-<version>-x64.exe`: bản portable, người dùng mở trực tiếp.

## Ký số file release

Nên dùng OV hoặc EV Code Signing certificate. Với file `.pfx`, đặt biến môi trường trước khi build:

```powershell
$env:CSC_LINK="C:\secure\workrank-code-signing.pfx"
$env:CSC_KEY_PASSWORD="mat-khau-pfx"
npm run dist:win
```

Sau khi ký, kiểm tra chữ ký:

```powershell
Get-AuthenticodeSignature ".\release\WorkRank Tracker-Setup-1.0.0-x64.exe"
Get-AuthenticodeSignature ".\release\WorkRank Tracker-Portable-1.0.0-x64.exe"
```

`Status` phải là `Valid`. `SignerCertificate.Subject` phải đúng tên tổ chức/cá nhân phát hành.

## Tạo checksum công khai

```powershell
Get-FileHash ".\release\WorkRank Tracker-Setup-1.0.0-x64.exe" -Algorithm SHA256
Get-FileHash ".\release\WorkRank Tracker-Portable-1.0.0-x64.exe" -Algorithm SHA256
```

Đăng checksum cùng file tải xuống để người dùng kiểm tra file không bị thay đổi.

## Kiểm tra trước khi phát hành

1. Cài hoặc mở app trên một máy Windows sạch.
2. Mở màn hình thông tin trong app và kiểm tra API URL đúng server production.
3. Đăng nhập web, bấm `Mở` hoặc `Bắt đầu` ở `/tracker`.
4. Kiểm tra Windows mở `WorkRank Tracker` qua `workrank://`.
5. Click/gõ phím trong app khác, chờ một nhịp gửi dữ liệu rồi kiểm tra số liệu trên web.
6. Dừng tracking, đóng app, mở lại từ web lần nữa.

## Lưu ý cho người dùng

Thông báo ngắn nên đi kèm file tải:

```text
WorkRank Tracker chỉ đếm số lần gõ phím, click chuột, di chuột và thời gian active/idle.
Ứng dụng không đọc nội dung phím, không chụp màn hình, không đọc clipboard và không đọc file cá nhân.
Bạn có thể mở màn hình "Dữ liệu WorkRank ghi nhận" trong app để kiểm tra API, phiên bản và dữ liệu được ghi nhận.
```
