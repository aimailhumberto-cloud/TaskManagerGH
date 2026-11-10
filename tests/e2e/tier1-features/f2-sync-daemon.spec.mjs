import { describe, it, expect } from '../harness/test-framework.mjs';
import { SyncEngineSimulator, DEBOUNCE_QUIET_MS, HARD_CEILING_MS } from '../helpers/sync-simulator.mjs';

describe('Tier 1 — Feature 2: Background Auto-Sync Daemon', () => {
  it('F2-T1: queues valid markdown file modifications and initiates debounce', () => {
    const sync = new SyncEngineSimulator();
    const result = sync.queueFileChange('vault/01-Internal-Clients/Core - S.M. Jaleel & Co. Ltd..md', 1000);
    expect(result.accepted).toBe(true);
    expect(sync.status).toBe('debouncing');
    expect(sync.pendingFiles.size).toBe(1);
  });

  it('F2-T2: filters out temporary and non-markdown files from sync queue', () => {
    const sync = new SyncEngineSimulator();
    const resTmp = sync.queueFileChange('vault/.sync-status.json.tmp');
    const resGit = sync.queueFileChange('vault/.git/index');
    const resPng = sync.queueFileChange('vault/assets/logo.png');

    expect(resTmp.accepted).toBe(false);
    expect(resGit.accepted).toBe(false);
    expect(resPng.accepted).toBe(false);
    expect(sync.pendingFiles.size).toBe(0);
    expect(sync.status).toBe('idle');
  });

  it('F2-T3: holds sync execution while quiet period (8s) is not reached', () => {
    const sync = new SyncEngineSimulator();
    const startTime = 10000;
    sync.queueFileChange('vault/note1.md', startTime);

    // After 4 seconds: quiet remaining = 4000ms
    const evalMid = sync.evaluateState(startTime + 4000);
    expect(evalMid.shouldSync).toBe(false);
    expect(evalMid.quietRemaining).toBe(4000);

    // After 8 seconds: quiet period reached
    const evalDone = sync.evaluateState(startTime + DEBOUNCE_QUIET_MS);
    expect(evalDone.shouldSync).toBe(true);
    expect(evalDone.reason).toBe('quiet_period_elapsed');
  });

  it('F2-T4: enforces 60s hard ceiling under continuous stream of edits', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 100000;
    sync.queueFileChange('vault/fileA.md', t0);

    // Stream edits every 5 seconds (preventing 8s quiet from ever elapsing)
    for (let offset = 5000; offset <= 55000; offset += 5000) {
      sync.queueFileChange(`vault/file_${offset}.md`, t0 + offset);
      const evalState = sync.evaluateState(t0 + offset);
      expect(evalState.shouldSync).toBe(false); // Still waiting
    }

    // At 60 seconds (hard ceiling)
    const evalCeiling = sync.evaluateState(t0 + HARD_CEILING_MS);
    expect(evalCeiling.shouldSync).toBe(true);
    expect(evalCeiling.reason).toBe('hard_ceiling_reached');
  });

  it('F2-T5: generates formatted git commit message and updates status JSON', () => {
    const sync = new SyncEngineSimulator();
    sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', 1000);
    sync.queueFileChange('vault/01-Internal-Clients/Person - Humberto Bouche.md', 2000);

    const commit = sync.executeSync(11000);
    expect(commit).not.toBeNull();
    expect(commit.message).toContain('sync(vault):');
    expect(commit.message).toContain('2 file(s) updated');
    expect(commit.files.length).toBe(2);

    const status = sync.getStatusJson();
    expect(status.status).toBe('idle');
    expect(status.lastCommit).toBe(commit.hash);
    expect(status.filesCount).toBe(2);
    expect(status.pendingCount).toBe(0);
  });
});
