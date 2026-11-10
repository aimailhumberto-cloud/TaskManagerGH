<#
.SYNOPSIS
    Stops the Obsidian Vault Auto-Sync daemon.
.DESCRIPTION
    Reads the PID from .sync.pid, terminates the daemon process,
    cleans up the PID file, and updates the daemon status to STOPPED.
#>

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptDir ".sync.pid"
$statusFile = Join-Path $scriptDir ".sync-status.json"

$stoppedCount = 0

if (Test-Path $pidFile) {
    $pidRaw = (Get-Content -Path $pidFile -Raw -ErrorAction SilentlyContinue)
    if ($pidRaw) {
        $daemonPid = $pidRaw.Trim()
        if ($daemonPid -match '^\d+$') {
            $proc = Get-Process -Id ([int]$daemonPid) -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "[INFO] Stopping daemon process (PID: $daemonPid)..." -ForegroundColor Cyan
                Stop-Process -Id ([int]$daemonPid) -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 500
                $stoppedCount++
                Write-Host "[OK] Auto-Sync daemon (PID: $daemonPid) stopped successfully." -ForegroundColor Green
            } else {
                Write-Host "[WARN] Process with PID $daemonPid was not running." -ForegroundColor Yellow
            }
        }
    }
    Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
}

# Scan for any remaining orphaned daemon instances
try {
    $orphans = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*vault-sync-daemon.mjs*" }
    foreach ($orphan in $orphans) {
        Write-Host "[INFO] Terminating orphan daemon process (PID: $($orphan.ProcessId))..." -ForegroundColor Cyan
        Stop-Process -Id $orphan.ProcessId -Force -ErrorAction SilentlyContinue
        $stoppedCount++
    }
} catch {
    # Ignore CIM errors on restricted environments
}

if ($stoppedCount -eq 0) {
    Write-Host "[INFO] Auto-Sync daemon was not running. Nothing to stop." -ForegroundColor DarkGray
}

# Update .sync-status.json to reflect STOPPED state
if (Test-Path $statusFile) {
    try {
        $statusJson = Get-Content -Path $statusFile -Raw | ConvertFrom-Json
        $statusJson.status = "STOPPED"
        $statusJson.daemonRunning = $false
        $statusJson.updatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        $statusJson | ConvertTo-Json -Depth 5 | Out-File -FilePath $statusFile -Encoding utf8
    } catch {
        # Non-fatal status update
    }
}
