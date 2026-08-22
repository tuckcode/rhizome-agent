# Start prime-agent daemon detached and print status.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/windows-prime-daemon.ps1

$ErrorActionPreference = "Stop"

if (-not (Get-Command prime-agent -ErrorAction SilentlyContinue)) {
    Write-Host "prime-agent not found. Install: npm i -g prime-agent" -ForegroundColor Red
    exit 1
}

$existing = Get-Process -Name "prime-agent" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "prime-agent process already running (pid $($existing.Id -join ', '))"
} else {
    Write-Host "Starting prime-agent daemon..."
    Start-Process prime-agent -ArgumentList "--mode", "daemon" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Write-Host ""
prime-agent status
