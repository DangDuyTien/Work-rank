@echo off
title Go bo WorkRank Agent tu khoi dong
echo ========================================================
echo   GO BO WORKRANK AGENT TU KHOI DONG
echo ========================================================
echo.

cd /d "%~dp0"
node index.js --uninstall-autostart

echo.
echo ========================================================
echo   Da go bo tu khoi dong.
echo ========================================================
pause
