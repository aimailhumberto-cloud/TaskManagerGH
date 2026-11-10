<#
.SYNOPSIS
    Starts the Obsidian Vault Auto-Sync daemon in the background.
.DESCRIPTION
    Launches vault-sync-daemon.mjs as a detached, hidden background process,
    verifies process liveness, and records the process ID to .sync.pid.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$daemonScript = Join-Path $scriptDir "vault-sync-daemon.mjs"
$pidFile = Join-Path $scriptDir ".sync.pid"
$errorLog = Join-Path $scriptDir "sync-error.log"

if (-not (Test-Path $daemonScript)) {
    Write-Host "[ERROR] Daemon script not found at: $daemonScript" -ForegroundColor Red
    exit 1
}

# Check if already running via PID file
if (Test-Path $pidFile) {
    $existingPidRaw = (Get-Content -Path $pidFile -Raw -ErrorAction SilentlyContinue)
    if ($existingPidRaw) {
        $existingPid = $existingPidRaw.Trim()
        if ($existingPid -match '^\d+$') {
            $existingProc = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
            if ($existingProc) {
                Write-Host "[WARN] Auto-Sync daemon is already running (PID: $existingPid)." -ForegroundColor Yellow
                exit 0
            }
        }
    }
    # Clean up stale PID file
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

# Check if node process is running vault-sync-daemon.mjs via WMI/CIM
try {
    $orphan = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vault-sync-daemon.mjs*" }
    if ($orphan) {
        $firstOrphan = $orphan[0]
        $firstOrphan.ProcessId | Out-File -FilePath $pidFile -Encoding ascii
        Write-Host "[WARN] Found already running daemon instance (PID: $($firstOrphan.ProcessId)). Registered PID." -ForegroundColor Yellow
        exit 0
    }
} catch {
    # Ignore CIM errors on restricted environments
}

Write-Host "[INFO] Starting Vault Auto-Sync daemon in background..." -ForegroundColor Cyan

$cmd = "node `"$daemonScript`""
$res = ([wmiclass]'win32_process').Create($cmd, $scriptDir)

if ($res.ReturnValue -ne 0 -or -not $res.ProcessId) {
    # Fallback to Start-Process with hidden window
    $proc = Start-Process -FilePath "node" -ArgumentList "`"$daemonScript`"" -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
    $pidToUse = $proc.Id
} else {
    $pidToUse = $res.ProcessId
}

$pidToUse | Out-File -FilePath $pidFile -Encoding ascii

Start-Sleep -Milliseconds 1500

$verifiedProc = Get-Process -Id $pidToUse -ErrorAction SilentlyContinue
if ($verifiedProc) {
    Write-Host "[OK] Auto-Sync daemon started successfully (PID: $pidToUse)." -ForegroundColor Green
    Write-Host "     Source Vault : C:\Users\Usuario\Downloads\SMJaleel\vault" -ForegroundColor DarkGray
    Write-Host "     Mirror Target: C:\Users\Usuario\.gemini\antigravity\scratch\hermes-task-dashboard\vault" -ForegroundColor DarkGray
    Write-Host "     Status check : powershell -File scripts\auto-sync\status-sync.ps1" -ForegroundColor DarkGray
} else {
    Write-Host "[ERROR] Auto-Sync daemon failed to start or terminated immediately." -ForegroundColor Red
    if (Test-Path $errorLog) {
        Write-Host "Recent error log output:" -ForegroundColor Yellow
        Get-Content -Path $errorLog -Tail 10
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    exit 1
}
