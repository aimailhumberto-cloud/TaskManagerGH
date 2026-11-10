import { describe, it, expect } from '../harness/test-framework.mjs';
import { SyncEngineSimulator, DEBOUNCE_QUIET_MS } from '../helpers/sync-simulator.mjs';
import { parseMarkdownContent } from '../helpers/vault-helpers.mjs';

describe('Tier 4 — Scenario 2: Obsidian Vault Edit & Git Auto-Sync Lifecycle', () => {
  it('Step 1: analyst edits an existing distributor note in Obsidian vault adding Q4 milestone', () => {
    const originalFile = `---
id: dist-medimex
title: "Distributor: MEDIMEX"
milestones:
  - title: "Q3 Review"
    status: "completed"
---
# Distributor: MEDIMEX
Texto existente.`;

    const parsedOriginal = parseMarkdownContent(originalFile);
    expect(parsedOriginal.frontmatter.milestones.length).toBe(1);

    // Analyst appends new milestone
    const updatedFile = `---
id: dist-medimex
title: "Distributor: MEDIMEX"
milestones:
  - title: "Q3 Review"
    status: "completed"
  - title: "Q4 Target Milestone"
    status: "in_progress"
---
# Distributor: MEDIMEX
Texto existente.`;

    const parsedUpdated = parseMarkdownContent(updatedFile);
    expect(parsedUpdated.frontmatter.milestones.length).toBe(2);
    expect(parsedUpdated.frontmatter.milestones[1].title).toBe('Q4 Target Milestone');
  });

  it('Step 2: file watcher detects modification event and activates 8s debounce', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 100000;
    const res = sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', t0);

    expect(res.accepted).toBe(true);
    expect(sync.status).toBe('debouncing');
    expect(sync.pendingFiles.size).toBe(1);
  });

  it('Step 3: analyst continues typing notes for 4 seconds, resetting the quiet debounce window', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 100000;
    sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', t0);

    // Typing continues 4s later
    sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', t0 + 4000);

    // Check at t0 + 8000: only 4s elapsed since last edit
    const evalAt8s = sync.evaluateState(t0 + 8000);
    expect(evalAt8s.shouldSync).toBe(false);
    expect(evalAt8s.quietRemaining).toBe(4000);

    // Check at t0 + 12000 (4s + 8s): quiet period now satisfied
    const evalAt12s = sync.evaluateState(t0 + 12000);
    expect(evalAt12s.shouldSync).toBe(true);
  });

  it('Step 4: daemon executes automated Git pipeline and writes .sync-status.json record', () => {
    const sync = new SyncEngineSimulator();
    const t0 = 100000;
    sync.queueFileChange('vault/02-External-Clients/Distributor - MEDIMEX.md', t0);

    const commit = sync.executeSync(t0 + DEBOUNCE_QUIET_MS);
    expect(commit).not.toBeNull();
    expect(commit.files).toContain('vault/02-External-Clients/Distributor - MEDIMEX.md');
    expect(commit.message).toContain('sync(vault):');

    const status = sync.getStatusJson();
    expect(status.status).toBe('idle');
    expect(status.lastCommit).toBe(commit.hash);
    expect(status.filesCount).toBe(1);
  });
});
