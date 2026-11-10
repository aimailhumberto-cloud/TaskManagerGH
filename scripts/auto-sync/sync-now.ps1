<#
.SYNOPSIS
    Executes an immediate one-shot sync between Obsidian Vault and GitHub/Render.
.DESCRIPTION
    Bypasses the debounce wait timer, directly reconciling all source and mirror
    files, committing changes to Git, pulling upstream with rebase, and pushing to origin main.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$daemonScript = Join-Path $scriptDir "vault-sync-daemon.mjs"

if (-not (Test-Path $daemonScript)) {
    Write-Host "[ERROR] Daemon script not found at: $daemonScript" -ForegroundColor Red
    exit 1
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         EXECUTING ONE-SHOT VAULT SYNCHRONIZATION           " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[INFO] Initiating immediate vault reconciliation and git sync..." -ForegroundColor Cyan

$process = Start-Process -FilePath "node" -ArgumentList "`"$daemonScript`" --once" -WorkingDirectory $scriptDir -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "[OK] One-shot sync completed successfully with exit code 0." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    exit 0
} else {
    Write-Host ""
    Write-Host "[ERROR] One-shot sync failed with exit code $($process.ExitCode)." -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Cyan
    exit $process.ExitCode
}
