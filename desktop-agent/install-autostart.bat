@echo off
title Cai dat WorkRank Agent tu khoi dong cung Windows
echo ========================================================
echo   CAI DAT WORKRANK AGENT TU KHOI DONG CUNG WINDOWS
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [LOI] May tinh cua ban chua cai dat Node.js!
  echo Vui long tai va cai dat Node.js tai: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"
node index.js --install-autostart

echo.
echo ========================================================
echo   Hoan tat! WorkRank Agent se tu dong chay ngam moi khi
echo   ban mo may tinh Windows.
echo ========================================================
pause
