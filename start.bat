@echo off
cd /d "%~dp0"
echo ==========================================
echo       Safe_On 서버를 시작합니다...
echo ==========================================
set "PATH=%PATH%;C:\Users\inspection\AppData\Local\ms-playwright-go\1.57.0"
node server.js
pause
