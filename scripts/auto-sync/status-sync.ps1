<#
.SYNOPSIS
    Reports status and health of the Obsidian Vault Auto-Sync daemon.
.DESCRIPTION
    Checks daemon process liveness, file counts in source and mirror vaults,
    git synchronization state, last commit, and recent logs.
#>

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..\..")
$sourceVault = "C:\Users\Usuario\Downloads\SMJaleel\vault"
$targetVault = Join-Path $repoRoot "vault"
$pidFile = Join-Path $scriptDir ".sync.pid"
$statusFile = Join-Path $scriptDir ".sync-status.json"
$logFile = Join-Path $scriptDir "auto-sync.log"
$errorLog = Join-Path $scriptDir "sync-error.log"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "        OBSIDIAN VAULT AUTO-SYNC STATUS & HEALTH            " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Daemon Liveness
$daemonStatus = "STOPPED"
$daemonPid = $null

if (Test-Path $pidFile) {
    $pidRaw = (Get-Content -Path $pidFile -Raw -ErrorAction SilentlyContinue)
    if ($pidRaw) {
        $daemonPid = $pidRaw.Trim()
        if ($daemonPid -match '^\d+$') {
            $proc = Get-Process -Id ([int]$daemonPid) -ErrorAction SilentlyContinue
            if ($proc) {
                $daemonStatus = "RUNNING"
            }
        }
    }
}

if ($daemonStatus -eq "RUNNING") {
    Write-Host "Daemon Status       : " -NoNewline
    Write-Host "RUNNING" -ForegroundColor Green -NoNewline
    Write-Host " (PID: $daemonPid)"
} else {
    Write-Host "Daemon Status       : " -NoNewline
    Write-Host "STOPPED" -ForegroundColor Red
}

# 2. Vault File Counts
$sourceCount = 0
if (Test-Path $sourceVault) {
    $sourceCount = (Get-ChildItem -Path $sourceVault -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/]\.(obsidian|trash|git)[\\/]' }).Count
}

$targetCount = 0
if (Test-Path $targetVault) {
    $targetCount = (Get-ChildItem -Path $targetVault -Recurse -File -Filter "*.md" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/]\.(obsidian|trash|git)[\\/]' }).Count
}

Write-Host "Source Vault (SSOT) : $sourceVault"
Write-Host "  -> Total Files    : $sourceCount markdown files"
Write-Host "Target Vault Mirror : $targetVault"
Write-Host "  -> Total Files    : $targetCount markdown files"

if ($sourceCount -eq $targetCount -and $sourceCount -gt 0) {
    Write-Host "Vault Parity        : " -NoNewline
    Write-Host "IN SYNC (100% matched: $sourceCount files)" -ForegroundColor Green
} else {
    Write-Host "Vault Parity        : " -NoNewline
    Write-Host "DISCREPANCY (Source: $sourceCount vs Target: $targetCount)" -ForegroundColor Yellow
}

# 3. Git Status
$gitBranch = (git -C $repoRoot rev-parse --abbrev-ref HEAD 2>$null)
$gitLastCommit = (git -C $repoRoot log -1 --pretty=format:"%h - %s (%ci)" 2>$null)
$gitPorcelain = (git -C $repoRoot status --porcelain vault/ 2>$null)

Write-Host "Git Branch          : $gitBranch"
Write-Host "Last Git Commit     : $gitLastCommit"
if (-not $gitPorcelain) {
    Write-Host "Working Tree (vault): " -NoNewline
    Write-Host "CLEAN (no pending uncommitted changes)" -ForegroundColor Green
} else {
    Write-Host "Working Tree (vault): " -NoNewline
    Write-Host "MODIFIED (uncommitted changes in mirror)" -ForegroundColor Yellow
}

# 4. Status File Details
if (Test-Path $statusFile) {
    try {
        $status = Get-Content -Path $statusFile -Raw | ConvertFrom-Json
        Write-Host "Last Sync Cycle     : $($status.lastSyncTime)"
        Write-Host "Last Synced Commit  : $($status.lastCommit)"
        if ($status.lastError) {
            Write-Host "Last Recorded Error : $($status.lastError)" -ForegroundColor Red
        }
    } catch {}
}

# 5. Recent Logs
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "Recent Activity Log (auto-sync.log):" -ForegroundColor Cyan
if (Test-Path $logFile) {
    $recentLogs = Get-Content -Path $logFile -Tail 5 -ErrorAction SilentlyContinue
    if ($recentLogs) {
        $recentLogs | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "  (log is empty)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  (no log file created yet)" -ForegroundColor DarkGray
}

if (Test-Path $errorLog) {
    $errorLines = Get-Content -Path $errorLog -Tail 3 -ErrorAction SilentlyContinue
    if ($errorLines) {
        Write-Host "Recent Errors (sync-error.log):" -ForegroundColor Red
        $errorLines | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    }
}

Write-Host "============================================================" -ForegroundColor Cyan
