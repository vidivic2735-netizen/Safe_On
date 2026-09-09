@echo off
cd /d "%~dp0"
echo ==========================================
echo    Cloudflare Tunnel을 시작합니다...
echo ==========================================
cloudflared.exe tunnel --url http://localhost:3000
pause
