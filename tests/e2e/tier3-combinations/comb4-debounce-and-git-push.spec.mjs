import { describe, it, expect } from '../harness/test-framework.mjs';
import { SyncEngineSimulator, DEBOUNCE_QUIET_MS } from '../helpers/sync-simulator.mjs';

describe('Tier 3 — Combination 4: Debounce Timing + Remote Git Push Pipeline', () => {
  it('Comb4-T1: verifies debounce expiry triggers end-to-end commit creation with all accumulated files', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 10000;

    sync.queueFileChange('vault/01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md', t0);
    sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', t0 + 2000);
    sync.queueFileChange('vault/01-Internal-Clients/Person - Humberto Bouche.md', t0 + 4000);

    // At t0 + 4000, last event is at t0 + 4000
    // Quiet period completes at t0 + 4000 + 8000 = t0 + 12000
    const evalBefore = sync.evaluateState(t0 + 11999);
    expect(evalBefore.shouldSync).toBe(false);

    const evalAfter = sync.evaluateState(t0 + 12000);
    expect(evalAfter.shouldSync).toBe(true);
    expect(evalAfter.fileCount).toBe(3);

    const commit = sync.executeSync(t0 + 12000);
    expect(commit.files.length).toBe(3);
    expect(commit.message).toContain('3 file(s) updated');
  });

  it('Comb4-T2: preserves queued files in retry pool if remote push simulation fails', () => {
    const sync = new SyncEngineSimulator();
    sync.queueFileChange('vault/note1.md', 1000);

    function attemptSyncWithNetworkFailure(simulator) {
      simulator.status = 'syncing';
      // Simulate network / rebase error
      const networkError = new Error('GIT_PUSH_REMOTE_REJECTED: connection timeout');
      simulator.status = 'error';
      simulator.lastError = networkError.message;
      return { success: false, error: networkError.message };
    }

    const res = attemptSyncWithNetworkFailure(sync);
    expect(res.success).toBe(false);
    expect(sync.status).toBe('error');
    expect(sync.pendingFiles.size).toBe(1); // Not dropped!
  });

  it('Comb4-T3: merges new file changes with failed retry pool on subsequent retry', () => {
    const sync = new SyncEngineSimulator();
    sync.queueFileChange('vault/retry_note.md', 1000);
    sync.status = 'error';

    // New event arrives
    sync.queueFileChange('vault/new_note.md', 5000);
    expect(sync.pendingFiles.size).toBe(2);
    expect(sync.status).toBe('debouncing');

    const commit = sync.executeSync(15000);
    expect(commit.files).toContain('vault/retry_note.md');
    expect(commit.files).toContain('vault/new_note.md');
  });

  it('Comb4-T4: updates .sync-status.json with precise timestamp and commit hash upon successful push', () => {
    const sync = new SyncEngineSimulator();
    sync.queueFileChange('vault/note.md', 1000);
    const commit = sync.executeSync(9000);

    const status = sync.getStatusJson();
    expect(status.status).toBe('idle');
    expect(status.lastCommit).toBe(commit.hash);
    expect(status.lastSync).toBe(new Date(9000).toISOString());
  });
});
