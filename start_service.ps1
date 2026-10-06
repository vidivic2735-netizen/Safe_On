param()

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         Safe_On 통합 서비스(서버 + Cloudflare) 시작        " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Add node to PATH if needed
$env:PATH = "$env:PATH;C:\Users\inspection\AppData\Local\ms-playwright-go\1.57.0;$scriptDir\scratch\node-v20.11.1-win-x64"

# 1. Check if server is already running on port 3000
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if (-not $port3000) {
    Write-Host "[1/3] Safe_On 백엔드 서버를 시작합니다..." -ForegroundColor Green
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c title Safe_On_Server && node server.js" -WindowStyle Minimized
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/3] Safe_On 백엔드 서버가 이미 실행 중입니다 (포트 3000)." -ForegroundColor Green
}

# 2. Check if cloudflared is already running
$cfProc = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($cfProc) {
    Write-Host "[2/3] 기존 Cloudflare Tunnel 프로세스를 정리합니다..." -ForegroundColor Yellow
    Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "[2/3] Cloudflare Tunnel을 연결하는 중입니다..." -ForegroundColor Green
$scratchDir = "$scriptDir\scratch"
if (-not (Test-Path $scratchDir)) { New-Item -ItemType Directory -Path $scratchDir | Out-Null }
$cfLog = "$scratchDir\tunnel.log"
if (Test-Path $cfLog) { Remove-Item $cfLog -Force }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$scriptDir\cloudflared.exe"
$psi.Arguments = "tunnel --url http://localhost:3000"
$psi.RedirectStandardError = $true
$psi.RedirectStandardOutput = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)

$tunnelUrl = $null
$timeout = 30
$timer = [System.Diagnostics.Stopwatch]::StartNew()

while ($timer.Elapsed.TotalSeconds -lt $timeout -and -not $tunnelUrl) {
    $line = $process.StandardError.ReadLine()
    if ($line) {
        Add-Content -Path $cfLog -Value $line
        if ($line -match "https://[a-zA-Z0-9-]+\.trycloudflare\.com") {
            $tunnelUrl = $matches[0]
            break
        }
    }
    Start-Sleep -Milliseconds 100
}

if ($tunnelUrl) {
    Write-Host "`n==========================================================" -ForegroundColor Cyan
    Write-Host " [접속 성공] Cloudflare 서비스 주소가 생성되었습니다!" -ForegroundColor Green
    Write-Host " 주소: $tunnelUrl" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan

    try {
        Set-Clipboard -Value $tunnelUrl
        Write-Host " -> 접속 주소가 클립보드에 복사되었습니다. (Ctrl+V로 붙여넣기 가능)" -ForegroundColor Gray
    } catch {}

    Write-Host "`n[3/3] 브라우저를 실행합니다..." -ForegroundColor Green
    Start-Process "$tunnelUrl/login.html"

    Write-Host "`n서비스가 정상 가동 중입니다." -ForegroundColor Cyan
    Write-Host "이 창을 닫으면 Cloudflare 외부 접속 터널이 종료됩니다." -ForegroundColor Yellow
    Write-Host "터널을 유지하려면 이 창을 띄워 두세요. (종료하려면 아무 키나 누르세요)" -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "`n[오류] Cloudflare Tunnel 주소를 가져오지 못했습니다. scratch\tunnel.log 를 확인해 주세요." -ForegroundColor Red
    pause
}
