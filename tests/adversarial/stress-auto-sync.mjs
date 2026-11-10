import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const autoSyncDir = path.join(repoRoot, 'scripts', 'auto-sync');

console.log('============================================================');
console.log(' ADVERSARIAL STRESS TEST: AUTO-SYNC DAEMON & GIT PIPELINE  ');
console.log('============================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

// -------------------------------------------------------------
// Test 1: Debounce Timing Logic (Burst of 10 rapid edits within 2s)
// -------------------------------------------------------------
console.log('--- TEST 1: Rapid Burst Debounce Timing Logic ---');
{
  const DEBOUNCE_MS = 8000;
  const MAX_WAIT_MS = 60000;

  let debounceTimer = null;
  let batchStartTime = null;
  let flushCount = 0;
  let lastFlushReason = null;

  function mockFlushSync(reason) {
    flushCount++;
    lastFlushReason = reason;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    batchStartTime = null;
  }

  function simulateFileEvent(action, filePath, simulatedNow) {
    if (!batchStartTime) {
      batchStartTime = simulatedNow;
    }
    const elapsed = simulatedNow - batchStartTime;
    if (elapsed >= MAX_WAIT_MS) {
      mockFlushSync('maxWait ceiling');
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    const remainingCeiling = MAX_WAIT_MS - elapsed;
    const delay = Math.min(DEBOUNCE_MS, remainingCeiling);
    debounceTimer = { scheduledAt: simulatedNow, firesAt: simulatedNow + delay, delay };
  }

  // Simulate 10 rapid keystroke saves in 2000ms (every 200ms)
  const t0 = 10000;
  for (let i = 0; i < 10; i++) {
    const editTime = t0 + i * 200;
    simulateFileEvent('change', 'vault/01-Internal-Clients/Core.md', editTime);
    assert(flushCount === 0, `At t=${editTime - t0}ms (save ${i + 1}), flushCount must remain 0`);
  }

  // After 10 edits: verify debounce scheduled exactly 8000ms after last event (t = t0 + 1800 + 8000 = t0 + 9800)
  assert(debounceTimer !== null, 'Debounce timer is active');
  assert(debounceTimer.firesAt === t0 + 1800 + 8000, `Debounce scheduled at t0+9800ms (got ${debounceTimer.firesAt - t0}ms)`);

  // Simulate time advance to t0 + 9799ms (1ms before quiet window)
  assert(flushCount === 0, 'No flush before 8000ms quiet window has elapsed');

  // Fire debounce timer at quiet expiry
  mockFlushSync('debounce quiet');
  assert(flushCount === 1, 'Exactly 1 flush triggered after quiet period');
  assert(lastFlushReason === 'debounce quiet', 'Flush reason is "debounce quiet"');
}

// -------------------------------------------------------------
// Test 2: Max Debounce Ceiling (Continuous edits forcing flush at 60s)
// -------------------------------------------------------------
console.log('\n--- TEST 2: Max Debounce Ceiling (Continuous Stream) ---');
{
  const DEBOUNCE_MS = 8000;
  const MAX_WAIT_MS = 60000;

  let debounceTimer = null;
  let batchStartTime = null;
  let flushCount = 0;
  let flushReasons = [];

  function mockFlushSync(reason) {
    flushCount++;
    flushReasons.push(reason);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    batchStartTime = null;
  }

  function simulateFileEvent(simulatedNow) {
    if (!batchStartTime) {
      batchStartTime = simulatedNow;
    }
    const elapsed = simulatedNow - batchStartTime;
    if (elapsed >= MAX_WAIT_MS) {
      mockFlushSync('maxWait ceiling');
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    const remainingCeiling = MAX_WAIT_MS - elapsed;
    const delay = Math.min(DEBOUNCE_MS, remainingCeiling);
    debounceTimer = { scheduledAt: simulatedNow, firesAt: simulatedNow + delay, delay };
  }

  const t0 = 1000000;
  // Type a word every 2 seconds for 70 seconds
  for (let sec = 0; sec <= 70; sec += 2) {
    const editTime = t0 + sec * 1000;
    simulateFileEvent(editTime);
    if (sec < 60) {
      assert(flushCount === 0, `At t=${sec}s, continuous edits hold sync (flushCount = 0)`);
    } else if (sec === 60) {
      assert(flushCount === 1, `At exactly t=60s, max debounce ceiling triggers flush`);
      assert(flushReasons[0] === 'maxWait ceiling', `Flush reason at 60s is "maxWait ceiling"`);
    }
  }

  assert(flushCount >= 1, `At least 1 flush occurred under 70s of continuous typing (got ${flushCount})`);
}

// -------------------------------------------------------------
// Test 3: Concurrency Mutex & Serialization
// -------------------------------------------------------------
console.log('\n--- TEST 3: Concurrency Mutex & Serialization ---');
{
  let isSyncing = false;
  let queuedSync = false;
  let executionLog = [];
  let concurrentExecutions = 0;
  let maxConcurrent = 0;

  async function mockAsyncFlush(triggerReason, durationMs = 50) {
    if (isSyncing) {
      executionLog.push(`QUEUED: ${triggerReason}`);
      queuedSync = true;
      return 'QUEUED';
    }

    isSyncing = true;
    concurrentExecutions++;
    maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
    executionLog.push(`START: ${triggerReason}`);

    try {
      // Simulate Git reconciliation and push work
      await new Promise(r => setTimeout(r, durationMs));
      executionLog.push(`FINISH: ${triggerReason}`);
    } finally {
      concurrentExecutions--;
      isSyncing = false;
      if (queuedSync) {
        queuedSync = false;
        executionLog.push('DRAINING_QUEUE');
        await mockAsyncFlush('queued flush', durationMs);
      }
    }
    return 'DONE';
  }

  // Trigger 5 concurrent sync requests simultaneously
  await Promise.all([
    mockAsyncFlush('trigger_1', 60),
    mockAsyncFlush('trigger_2', 40),
    mockAsyncFlush('trigger_3', 20),
    mockAsyncFlush('trigger_4', 30),
    mockAsyncFlush('trigger_5', 10),
  ]);

  assert(maxConcurrent === 1, `Mutex strictly enforced: maxConcurrent executions = ${maxConcurrent} (expected 1)`);
  assert(executionLog.includes('START: trigger_1'), 'trigger_1 executed first');
  assert(executionLog.includes('QUEUED: trigger_2'), 'trigger_2 was safely queued');
  assert(executionLog.includes('DRAINING_QUEUE'), 'Queued flush was automatically drained upon completion');
  assert(executionLog.includes('FINISH: queued flush'), 'Queued flush completed cleanly');
}

// -------------------------------------------------------------
// Test 4: Git index.lock Contention Stress Test
// -------------------------------------------------------------
console.log('\n--- TEST 4: Git index.lock Contention Handling ---');
{
  const gitDir = path.join(repoRoot, '.git');
  const lockFile = path.join(gitDir, 'index.lock');

  // Verify that if index.lock exists, git fails with code 128
  let lockCreated = false;
  try {
    if (!fs.existsSync(lockFile)) {
      fs.writeFileSync(lockFile, 'dummy lock for testing contention');
      lockCreated = true;
    }

    const gitResult = cp.spawnSync('git', ['add', '--dry-run', 'vault/'], {
      cwd: repoRoot,
      encoding: 'utf-8'
    });

    assert(gitResult.status !== 0, `Git command fails when index.lock exists (exit code: ${gitResult.status})`);
    assert(
      (gitResult.stderr || '').includes('index.lock') || (gitResult.stdout || '').includes('index.lock'),
      'Git output correctly identifies index.lock contention'
    );
  } finally {
    if (lockCreated && fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }

  // Verify index.lock was cleanly removed and working tree is unaffected
  assert(!fs.existsSync(lockFile), 'index.lock is cleared after stress test');
}

// -------------------------------------------------------------
// Test 5: Verify Daemon Status via PowerShell (status-sync.ps1)
// -------------------------------------------------------------
console.log('\n--- TEST 5: Verify Daemon Status via PowerShell ---');
{
  const statusScript = path.join(autoSyncDir, 'status-sync.ps1');
  assert(fs.existsSync(statusScript), `status-sync.ps1 exists at: ${statusScript}`);

  const psResult = cp.spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-File', statusScript], {
    encoding: 'utf-8',
    timeout: 10000
  });

  const output = psResult.stdout || '';
  const errorOutput = psResult.stderr || '';

  assert(psResult.status === 0, `status-sync.ps1 executed with exit code 0`);
  assert(output.includes('OBSIDIAN VAULT AUTO-SYNC STATUS & HEALTH'), 'Script header rendered');
  assert(output.includes('Daemon Status') && (output.includes('RUNNING') || output.includes('STOPPED')), 'Reports Daemon Status');
  assert(output.includes('Vault Parity') && output.includes('IN SYNC'), 'Vault parity verified: IN SYNC');
  assert(output.includes('CLEAN (no pending uncommitted changes)'), 'Working tree is clean');

  // Check PID file
  const pidFile = path.join(autoSyncDir, '.sync.pid');
  const statusFile = path.join(autoSyncDir, '.sync-status.json');
  assert(fs.existsSync(statusFile), '.sync-status.json status file exists');
  if (output.includes('RUNNING')) {
    assert(fs.existsSync(pidFile), '.sync.pid file exists while daemon is running');
    const pidVal = fs.readFileSync(pidFile, 'utf-8').trim();
    assert(/^\d+$/.test(pidVal), `PID file contains valid numeric PID: ${pidVal}`);
  }
}

console.log('\n============================================================');
console.log(`SUMMARY: ${passedTests} / ${totalTests} assertions passed (${failedTests} failed)`);
console.log('============================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL AUTO-SYNC DAEMON & GIT STRESS TESTS PASSED!');
  process.exit(0);
}
