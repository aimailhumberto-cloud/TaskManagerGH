import { describe, it, expect } from '../harness/test-framework.mjs';
import { SyncEngineSimulator } from '../helpers/sync-simulator.mjs';

describe('Tier 4 — Scenario 5: Emergency Manual Sync Trigger During High-Frequency Edits', () => {
  it('Step 1: simulates concurrent active typing across 8 vault files resetting the debounce timer', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 1000;

    // Changes arrive every 2 seconds, keeping debounce active
    for (let i = 0; i < 8; i++) {
      sync.queueFileChange(`vault/meeting_note_${i}.md`, t0 + i * 2000);
    }

    // At t0 + 14000 (after 8th file), last event was at t0 + 14000
    // At t0 + 18000 (4s later), quiet period has not elapsed
    const checkState = sync.evaluateState(t0 + 18000);
    expect(checkState.shouldSync).toBe(false);
    expect(checkState.quietRemaining).toBe(4000);
    expect(sync.pendingFiles.size).toBe(8);
  });

  it('Step 2: administrator executes sync-now to bypass debounce countdown immediately', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 1000;
    for (let i = 0; i < 8; i++) {
      sync.queueFileChange(`vault/meeting_note_${i}.md`, t0 + i * 2000);
    }

    // Simulated sync-now trigger at t0 + 18000
    function executeSyncNow(engine, currentTime) {
      // Bypasses evaluation and forces immediate execution
      return engine.executeSync(currentTime);
    }

    const forcedCommit = executeSyncNow(sync, t0 + 18000);
    expect(forcedCommit).not.toBeNull();
    expect(forcedCommit.files.length).toBe(8);
    expect(forcedCommit.message).toContain('8 file(s) updated');
    expect(sync.status).toBe('idle');
    expect(sync.pendingFiles.size).toBe(0);
  });

  it('Step 3: verifies system status JSON is instantly refreshed with new commit hash', () => {
    const sync = new SyncEngineSimulator();
    sync.queueFileChange('vault/urgent_memo.md', 1000);
    const commit = sync.executeSync(2000);

    const status = sync.getStatusJson();
    expect(status.status).toBe('idle');
    expect(status.lastCommit).toBe(commit.hash);
    expect(status.lastSync).toBe(new Date(2000).toISOString());
    expect(status.filesCount).toBe(1);
    expect(status.pendingCount).toBe(0);
  });
});
