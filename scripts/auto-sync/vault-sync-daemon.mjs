#!/usr/bin/env node

/**
 * vault-sync-daemon.mjs
 * 
 * Production Two-Way Auto-Sync Daemon for Obsidian Vault ↔ GitHub / Render.
 * Single Source of Truth (SSOT): local Obsidian vault (C:\Users\Usuario\Downloads\SMJaleel\vault).
 * Mirror Target: Next.js dashboard repo (C:\Users\Usuario\.gemini\antigravity\scratch\hermes-task-dashboard\vault).
 * 
 * Features:
 * - 8000ms debounce quiet period with 60000ms hard ceiling.
 * - Filters .obsidian/**, .trash/**, .git/**, **\/*.tmp, dotfiles.
 * - Windows file lock retry logic (EBUSY / EPERM).
 * - Git transaction: stage, timestamped commit, pull --rebase, push origin main.
 * - Mutex flag to prevent concurrent git executions.
 * - Rolling logs (auto-sync.log, sync-error.log) and status file (.sync-status.json).
 * - One-shot execution mode with `--once` flag.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const chokidar = require('chokidar');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const CONFIG = {
  sourceVault: process.env.SMJ_SOURCE_VAULT || 'C:\\Users\\Usuario\\Downloads\\SMJaleel\\vault',
  targetVault: process.env.SMJ_TARGET_VAULT || path.resolve(__dirname, '..', '..', 'vault'),
  repoRoot: process.env.SMJ_REPO_ROOT || path.resolve(__dirname, '..', '..'),
  remoteName: 'origin',
  remoteBranch: 'main',
  debounceMs: 8000,           // 8s quiet window
  maxWaitMs: 60000,          // 60s hard ceiling
  maxLockRetries: 3,         // 3 retries (4 attempts total)
  lockRetryDelayMs: 200,     // 200ms delay between retries
  maxLogSizeBytes: 5 * 1024 * 1024, // 5MB max log file
  pidFile: path.join(__dirname, '.sync.pid'),
  statusFile: path.join(__dirname, '.sync-status.json'),
  logFile: path.join(__dirname, 'auto-sync.log'),
  errorFile: path.join(__dirname, 'sync-error.log')
};

// --- State ---
let debounceTimer = null;
let batchStartTime = null;
let isSyncing = false;
let queuedSync = false;
let watcher = null;
const pendingChanges = new Map();

// --- Sleep helper ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Logging ---
function rotateLogIfNeeded(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > CONFIG.maxLogSizeBytes) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const retained = lines.slice(-2000).join('\n');
        fs.writeFileSync(filePath, retained, 'utf-8');
      }
    }
  } catch (_) {
    // Non-fatal if log rotation fails
  }
}

function log(message) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [INFO] ${message}\n`;
  process.stdout.write(line);
  try {
    rotateLogIfNeeded(CONFIG.logFile);
    fs.appendFileSync(CONFIG.logFile, line, 'utf-8');
  } catch (err) {
    process.stderr.write(`Failed to write to logFile: ${err.message}\n`);
  }
}

function logError(message, details = null) {
  const ts = new Date().toISOString();
  const detailStr = details ? ` - ${details instanceof Error ? details.stack : String(details)}` : '';
  const line = `[${ts}] [ERROR] ${message}${detailStr}\n`;
  process.stderr.write(line);
  try {
    rotateLogIfNeeded(CONFIG.logFile);
    rotateLogIfNeeded(CONFIG.errorFile);
    fs.appendFileSync(CONFIG.logFile, line, 'utf-8');
    fs.appendFileSync(CONFIG.errorFile, line, 'utf-8');
  } catch (err) {
    process.stderr.write(`Failed to write to errorFile: ${err.message}\n`);
  }
}

// --- Status Management ---
function countVaultFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      const relPath = path.relative(dir, fullPath);
      if (isIgnored(relPath)) continue;
      if (ent.isDirectory()) {
        walk(fullPath);
      } else if (ent.isFile() && ent.name.endsWith('.md')) {
        count++;
      }
    }
  }
  try {
    walk(dir);
  } catch (_) {
    return count;
  }
  return count;
}

async function updateStatus(fields = {}) {
  try {
    let existing = {};
    if (fs.existsSync(CONFIG.statusFile)) {
      try {
        existing = JSON.parse(fs.readFileSync(CONFIG.statusFile, 'utf-8'));
      } catch (_) {}
    }

    const sourceCount = countVaultFiles(CONFIG.sourceVault);
    const targetCount = countVaultFiles(CONFIG.targetVault);

    const updated = {
      ...existing,
      ...fields,
      pid: process.pid,
      daemonRunning: fields.status === 'STOPPED' ? false : true,
      sourceFilesCount: sourceCount,
      targetFilesCount: targetCount,
      updatedAt: new Date().toISOString()
    };

    fs.writeFileSync(CONFIG.statusFile, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    logError('Failed to write .sync-status.json', err.message);
  }
}

// --- Filter / Ignore Check ---
function isIgnored(relPath) {
  if (!relPath) return true;
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg.startsWith('.')) return true;
    if (seg === '.obsidian' || seg === '.trash' || seg === '.git') return true;
  }
  if (normalized.endsWith('.tmp') || normalized.endsWith('.tmp.md')) return true;
  const lower = normalized.toLowerCase();
  if (lower.endsWith('desktop.ini') || lower.endsWith('thumbs.db')) return true;
  return false;
}

// --- File Operations with Windows Lock Retry ---
async function copyFileWithRetry(src, dest, retries = CONFIG.maxLockRetries, delay = CONFIG.lockRetryDelayMs) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      return true;
    } catch (err) {
      const isLockError = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES';
      if (isLockError && attempt <= retries) {
        log(`File lock detected copying ${path.basename(src)} (attempt ${attempt}/${retries + 1}). Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function unlinkFileWithRetry(dest, retries = CONFIG.maxLockRetries, delay = CONFIG.lockRetryDelayMs) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      if (fs.existsSync(dest)) {
        await fs.promises.unlink(dest);
        cleanEmptyDirs(path.dirname(dest), CONFIG.targetVault);
      }
      return true;
    } catch (err) {
      const isLockError = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES';
      if (isLockError && attempt <= retries) {
        log(`File lock detected unlinking ${path.basename(dest)} (attempt ${attempt}/${retries + 1}). Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

function cleanEmptyDirs(dir, stopDir) {
  try {
    const resolvedDir = path.resolve(dir);
    const resolvedStop = path.resolve(stopDir);
    if (!resolvedDir.startsWith(resolvedStop) || resolvedDir === resolvedStop) return;
    const entries = fs.readdirSync(resolvedDir);
    if (entries.length === 0) {
      fs.rmdirSync(resolvedDir);
      cleanEmptyDirs(path.dirname(resolvedDir), resolvedStop);
    }
  } catch (_) {
    // Non-fatal directory cleanup
  }
}

function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

// --- Full Vault Reconciliation ---
async function fullReconcile() {
  const result = { added: [], updated: [], deleted: [] };

  if (!fs.existsSync(CONFIG.sourceVault)) {
    throw new Error(`Source vault does not exist at: ${CONFIG.sourceVault}`);
  }
  if (!fs.existsSync(CONFIG.targetVault)) {
    fs.mkdirSync(CONFIG.targetVault, { recursive: true });
  }

  // 1. Scan source vault
  const sourceFiles = new Map();
  function walkSource(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      const relPath = path.relative(CONFIG.sourceVault, fullPath);
      if (isIgnored(relPath)) continue;
      if (ent.isDirectory()) {
        walkSource(fullPath);
      } else if (ent.isFile()) {
        sourceFiles.set(relPath, fullPath);
      }
    }
  }
  walkSource(CONFIG.sourceVault);

  // 2. Scan target vault
  const targetFiles = new Map();
  function walkTarget(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(current, ent.name);
      const relPath = path.relative(CONFIG.targetVault, fullPath);
      if (isIgnored(relPath)) continue;
      if (ent.isDirectory()) {
        walkTarget(fullPath);
      } else if (ent.isFile()) {
        targetFiles.set(relPath, fullPath);
      }
    }
  }
  walkTarget(CONFIG.targetVault);

  // 3. Mirror source -> target
  for (const [relPath, srcPath] of sourceFiles.entries()) {
    const destPath = path.join(CONFIG.targetVault, relPath);
    if (!targetFiles.has(relPath)) {
      await copyFileWithRetry(srcPath, destPath);
      result.added.push(relPath);
    } else {
      const srcHash = getFileHash(srcPath);
      const destHash = getFileHash(destPath);
      if (srcHash !== destHash) {
        await copyFileWithRetry(srcPath, destPath);
        result.updated.push(relPath);
      }
    }
  }

  // 4. Remove orphan files in target
  for (const [relPath, destPath] of targetFiles.entries()) {
    if (!sourceFiles.has(relPath)) {
      await unlinkFileWithRetry(destPath);
      result.deleted.push(relPath);
    }
  }

  return result;
}

// --- Git Command Wrapper ---
function execGit(args, options = {}) {
  return new Promise((resolve, reject) => {
    cp.execFile('git', args, {
      cwd: CONFIG.repoRoot,
      encoding: 'utf-8',
      maxBuffer: 25 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      ...options
    }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`Git error (git ${args.join(' ')}): ${stderr || error.message}`);
        err.code = error.code;
        err.stdout = stdout;
        err.stderr = stderr;
        return reject(err);
      }
      resolve({ stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
    });
  });
}

// --- Git Transaction Pipeline ---
async function executeGitSync(reconcileResult) {
  // Stage vault/
  log('Executing git add vault/...');
  await execGit(['add', 'vault/']);

  // Check staged diff
  const { stdout: stagedDiff } = await execGit(['diff', '--cached', '--name-only']);
  let committed = false;
  let commitMsg = '';
  let count = 0;

  if (stagedDiff) {
    const stagedFiles = stagedDiff.split(/\r?\n/).filter(Boolean);
    count = stagedFiles.length;
    const sampleNames = stagedFiles.slice(0, 3).map(f => path.basename(f)).join(', ');
    const moreText = count > 3 ? ` (+${count - 3} more)` : '';
    const timestamp = new Date().toISOString();
    commitMsg = `sync(vault): ${timestamp} auto-sync (${count} file${count === 1 ? '' : 's'}: ${sampleNames}${moreText})`;

    log(`Staged ${count} file(s). Committing: ${commitMsg}`);
    await execGit(['commit', '-m', commitMsg]);
    committed = true;
  }

  // Check for any unpushed commits to origin/main
  let unpushedCount = 0;
  try {
    const { stdout: unpushed } = await execGit(['rev-list', `${CONFIG.remoteName}/${CONFIG.remoteBranch}..HEAD`, '--count']);
    unpushedCount = parseInt(unpushed || '0', 10);
  } catch (_) {}

  if (!committed && unpushedCount === 0) {
    log('No changes staged in git working tree and no unpushed commits. Working tree is clean.');
    const { stdout: currentHead } = await execGit(['rev-parse', '--short', 'HEAD']);
    await updateStatus({
      status: 'IDLE',
      lastCommit: currentHead,
      lastError: null
    });
    return { committed: false };
  }

  // Pull with rebase to sync upstream changes using --autostash
  log(`Rebasing against ${CONFIG.remoteName}/${CONFIG.remoteBranch}...`);
  try {
    await execGit(['pull', '--rebase', '--autostash', CONFIG.remoteName, CONFIG.remoteBranch]);
  } catch (pullErr) {
    logError('Git pull --rebase failed. Checking for merge conflict...', pullErr.message);
    try {
      await execGit(['rebase', '--abort']);
      log('Aborted rebase successfully. Preserved local SSOT vault.');
    } catch (_) {}
    throw pullErr;
  }

  // Push to remote
  log(`Pushing to ${CONFIG.remoteName} ${CONFIG.remoteBranch}...`);
  await execGit(['push', CONFIG.remoteName, CONFIG.remoteBranch]);

  // Get current commit hash
  const { stdout: commitHash } = await execGit(['rev-parse', '--short', 'HEAD']);
  log(`Successfully pushed commit ${commitHash} to GitHub (${CONFIG.remoteName}/${CONFIG.remoteBranch})`);

  await updateStatus({
    status: 'IDLE',
    lastSyncTime: new Date().toISOString(),
    lastCommit: commitHash,
    lastCommitMessage: commitMsg || `Pushed ${unpushedCount} pending commit(s)`,
    lastError: null
  });

  return { committed: true, commit: commitHash, count: committed ? count : unpushedCount };
}

// --- Synchronize Flush Routine ---
async function flushSync(triggerReason = 'debounce') {
  if (isSyncing) {
    log(`Sync currently in progress. Queued subsequent sync cycle (trigger: ${triggerReason}).`);
    queuedSync = true;
    return;
  }

  isSyncing = true;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  batchStartTime = null;

  try {
    await updateStatus({ status: 'SYNCING' });
    log(`Sync triggered (${triggerReason}). Reconciling vault...`);

    const reconcileResult = await fullReconcile();
    log(`Reconciliation completed: +${reconcileResult.added.length} added, ~${reconcileResult.updated.length} updated, -${reconcileResult.deleted.length} deleted.`);

    const gitResult = await executeGitSync(reconcileResult);
    if (!gitResult.committed) {
      log('Sync cycle completed: no git modifications required.');
    } else {
      log(`Sync cycle completed successfully: commit ${gitResult.commit} pushed.`);
    }
  } catch (err) {
    logError(`Sync cycle encountered error: ${err.message}`, err);
    await updateStatus({
      status: 'ERROR',
      lastError: err.message
    });
  } finally {
    isSyncing = false;
    if (queuedSync) {
      queuedSync = false;
      log('Triggering queued sync cycle now...');
      setTimeout(() => flushSync('queued flush'), 500);
    }
  }
}

// --- File Watcher Event Handler ---
function onFileEvent(action, filePath) {
  const relPath = path.relative(CONFIG.sourceVault, filePath);
  if (isIgnored(relPath)) return;

  log(`Vault event detected [${action}]: ${relPath}`);
  pendingChanges.set(relPath, { action, time: Date.now() });

  const now = Date.now();
  if (!batchStartTime) {
    batchStartTime = now;
  }

  const elapsed = now - batchStartTime;
  if (elapsed >= CONFIG.maxWaitMs) {
    log(`Max debounce ceiling reached (${CONFIG.maxWaitMs}ms elapsed). Triggering immediate flush.`);
    flushSync('maxWait ceiling');
    return;
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  const remainingCeiling = CONFIG.maxWaitMs - elapsed;
  const delay = Math.min(CONFIG.debounceMs, remainingCeiling);
  log(`Debounce scheduled in ${delay}ms (ceiling remaining: ${remainingCeiling}ms)`);
  debounceTimer = setTimeout(() => {
    flushSync('debounce quiet');
  }, delay);
}

// --- Lifecycle & PID Management ---
function writePid() {
  try {
    fs.writeFileSync(CONFIG.pidFile, String(process.pid), 'ascii');
  } catch (err) {
    logError('Failed to write .sync.pid file', err.message);
  }
}

function removePid() {
  try {
    if (fs.existsSync(CONFIG.pidFile)) {
      const pidStr = fs.readFileSync(CONFIG.pidFile, 'ascii').trim();
      if (pidStr === String(process.pid)) {
        fs.unlinkSync(CONFIG.pidFile);
      }
    }
  } catch (_) {}
}

async function handleShutdown(signal) {
  log(`Received shutdown signal (${signal}). Terminating auto-sync daemon gracefully...`);
  if (debounceTimer) clearTimeout(debounceTimer);
  if (watcher) {
    try {
      await watcher.close();
    } catch (_) {}
  }
  removePid();
  await updateStatus({ status: 'STOPPED' });
  log('Daemon stopped. Exiting.');
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logError('Uncaught exception in daemon:', err);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled rejection in daemon:', reason);
});

process.on('exit', (code) => {
  log(`Process exit event fired with code: ${code}`);
});

// Periodic heartbeat to guarantee event loop never drains
let heartbeatTimer = null;

// --- Main Entrypoint ---
async function main() {
  const args = process.argv.slice(2);
  const isOnce = args.includes('--once') || args.includes('-1');

  log(`Initializing Vault Sync Daemon (pid: ${process.pid}, mode: ${isOnce ? 'ONE-SHOT' : 'DAEMON'})...`);
  log(`Source Vault: ${CONFIG.sourceVault}`);
  log(`Target Vault: ${CONFIG.targetVault}`);
  log(`Repo Root:    ${CONFIG.repoRoot}`);

  if (isOnce) {
    try {
      await updateStatus({ status: 'SYNCING' });
      log('Running one-shot reconciliation...');
      const diff = await fullReconcile();
      log(`Reconcile summary: +${diff.added.length} added, ~${diff.updated.length} updated, -${diff.deleted.length} deleted.`);
      const gitResult = await executeGitSync(diff);
      log(`One-shot sync complete: ${gitResult.committed ? `Commit ${gitResult.commit} pushed.` : 'Working tree clean.'}`);
      process.exit(0);
    } catch (err) {
      logError('One-shot sync failed:', err);
      process.exit(1);
    }
  }

  // Daemon mode
  writePid();
  await updateStatus({ status: 'RUNNING' });

  // Initial alignment on startup
  log('Performing initial vault alignment...');
  try {
    const diff = await fullReconcile();
    log(`Initial alignment summary: +${diff.added.length} added, ~${diff.updated.length} updated, -${diff.deleted.length} deleted.`);
    await executeGitSync(diff);
  } catch (err) {
    logError('Initial alignment failed (will continue watching for changes):', err.message);
  }

  // Initialize chokidar watcher
  log(`Starting chokidar watcher on: ${CONFIG.sourceVault}`);
  watcher = chokidar.watch(CONFIG.sourceVault, {
    ignored: [
      /(^|[\/\\])\../,            // dotfiles and hidden folders (.obsidian, .trash, .git)
      /\.tmp($|\.md$)/,           // tmp files
      /desktop\.ini$/i,
      /thumbs\.db$/i
    ],
    persistent: true,
    ignoreInitial: true,          // Initial alignment already handled
    awaitWriteFinish: {
      stabilityThreshold: 1000,   // Wait 1s for file size stability
      pollInterval: 100
    }
  });

  // Keep event loop alive continuously in daemon mode
  heartbeatTimer = setInterval(() => {
    // Heartbeat touch
  }, 10000);

  watcher
    .on('add', filePath => onFileEvent('add', filePath))
    .on('change', filePath => onFileEvent('change', filePath))
    .on('unlink', filePath => onFileEvent('unlink', filePath))
    .on('error', error => logError('Chokidar watcher error:', error))
    .on('ready', () => {
      log('Chokidar watcher ready and actively listening for vault modifications.');
      updateStatus({ status: 'IDLE' });
    });
}

main().catch(err => {
  logError('Fatal daemon error:', err);
  removePid();
  process.exit(1);
});
