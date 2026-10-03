@echo off
title Push WorkRank to GitHub
echo ========================================================
echo   DANG PUSH CODE WORKRANK LEN GITHUB
echo ========================================================
echo.
cd /d "%~dp0"
git push origin main
echo.
if %ERRORLEVEL% equ 0 (
  echo ========================================================
  echo   [THANH CONG] Da day code len GitHub thanh cong!
  echo ========================================================
) else (
  echo ========================================================
  echo   [LOI] Chua the push. Vui long kiem tra dang nhap GitHub.
  echo ========================================================
)
echo.
pause
