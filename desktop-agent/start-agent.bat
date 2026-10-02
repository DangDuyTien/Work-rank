@echo off
title WorkRank Desktop Companion
echo ========================================================
echo   WORKRANK COMPUTER ACTIVITY COMPANION (WINDOWS)
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

echo   Dang khoi dong theo doi hoat dong toan may tinh...
echo   (Nhan Ctrl+C de dung lai bat ky luc nao)
echo.

cd /d "%~dp0"
node index.js

pause
