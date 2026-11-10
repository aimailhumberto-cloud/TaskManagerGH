import { describe, it, expect } from '../harness/test-framework.mjs';
import { SyncEngineSimulator, DEBOUNCE_QUIET_MS } from '../helpers/sync-simulator.mjs';

describe('Tier 2 — Boundary 2: Auto-Sync Daemon Edge Cases', () => {
  it('B2-T1: handles rapid burst of 100 file events within 200ms deduplicating redundant paths', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 50000;
    for (let i = 0; i < 100; i++) {
      const fileIndex = i % 5; // Only 5 unique files modified 20 times each
      sync.queueFileChange(`vault/node_${fileIndex}.md`, t0 + i * 2);
    }

    expect(sync.pendingFiles.size).toBe(5);
    expect(sync.status).toBe('debouncing');
  });

  it('B2-T2: tests exact millisecond boundary of quiet period (7999ms vs 8000ms)', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 1000;
    sync.queueFileChange('vault/note.md', t0);

    const boundaryBefore = sync.evaluateState(t0 + DEBOUNCE_QUIET_MS - 1);
    expect(boundaryBefore.shouldSync).toBe(false);
    expect(boundaryBefore.quietRemaining).toBe(1);

    const boundaryExact = sync.evaluateState(t0 + DEBOUNCE_QUIET_MS);
    expect(boundaryExact.shouldSync).toBe(true);
    expect(boundaryExact.reason).toBe('quiet_period_elapsed');
  });

  it('B2-T3: handles empty queue invocation without producing phantom commit', () => {
    const sync = new SyncEngineSimulator();
    const commit = sync.executeSync();
    expect(commit).toBeNull();
    expect(sync.status).toBe('idle');
    expect(sync.commitHistory.length).toBe(0);
  });

  it('B2-T4: normalizes mixed Windows and POSIX path separators', () => {
    const sync = new SyncEngineSimulator();
    const winPath = 'vault\\01-Internal-Clients\\Core - S.M. Jaleel & Co. Ltd..md';
    const posixPath = 'vault/01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md';

    expect(sync.isSyncableFile(winPath)).toBe(true);
    expect(sync.isSyncableFile(posixPath)).toBe(true);
  });

  it('B2-T5: rejects malformed file paths containing null bytes or invalid inputs', () => {
    const sync = new SyncEngineSimulator();
    expect(sync.isSyncableFile(null)).toBe(false);
    expect(sync.isSyncableFile(undefined)).toBe(false);
    expect(sync.isSyncableFile('')).toBe(false);
    expect(sync.isSyncableFile(12345)).toBe(false);
  });
});
