/**
 * Chokidar File Watcher, Debounce Logic & Git Sync Engine Simulator.
 * Simulates event queuing, quiet period debounce, hard ceiling timer, and commit generation.
 */

export const DEBOUNCE_QUIET_MS = 8000;
export const HARD_CEILING_MS = 60000;

export class SyncEngineSimulator {
  constructor(options = {}) {
    this.quietMs = options.quietMs || DEBOUNCE_QUIET_MS;
    this.hardCeilingMs = options.hardCeilingMs || HARD_CEILING_MS;
    this.status = 'idle'; // 'idle' | 'debouncing' | 'syncing' | 'error'
    this.pendingFiles = new Set();
    this.firstEventTime = null;
    this.lastEventTime = null;
    this.commitHistory = [];
    this.lastSync = null;
    this.lastCommit = null;
  }

  isSyncableFile(filepath) {
    if (!filepath || typeof filepath !== 'string') return false;
    const normalized = filepath.replace(/\\/g, '/').toLowerCase();
    if (!normalized.endsWith('.md')) return false;
    if (normalized.includes('.git') || normalized.includes('node_modules') || normalized.includes('.tmp')) return false;
    return true;
  }

  queueFileChange(filepath, timestamp = Date.now()) {
    if (!this.isSyncableFile(filepath)) {
      return { accepted: false, reason: 'ignored_extension_or_path' };
    }

    if (this.status === 'idle' || this.status === 'error') {
      this.status = 'debouncing';
      this.firstEventTime = timestamp;
    }

    this.pendingFiles.add(filepath);
    this.lastEventTime = timestamp;

    return {
      accepted: true,
      pendingCount: this.pendingFiles.size,
      firstEventTime: this.firstEventTime,
      lastEventTime: this.lastEventTime,
    };
  }

  evaluateState(currentTime) {
    if (this.status !== 'debouncing') {
      return { shouldSync: false, status: this.status };
    }

    const quietElapsed = currentTime - this.lastEventTime;
    const totalElapsed = currentTime - this.firstEventTime;

    const hitQuiet = quietElapsed >= this.quietMs;
    const hitHardCeiling = totalElapsed >= this.hardCeilingMs;

    if (hitQuiet || hitHardCeiling) {
      return {
        shouldSync: true,
        reason: hitHardCeiling ? 'hard_ceiling_reached' : 'quiet_period_elapsed',
        fileCount: this.pendingFiles.size,
      };
    }

    return {
      shouldSync: false,
      quietRemaining: Math.max(0, this.quietMs - quietElapsed),
      hardCeilingRemaining: Math.max(0, this.hardCeilingMs - totalElapsed),
    };
  }

  executeSync(currentTime = Date.now()) {
    if (this.pendingFiles.size === 0) {
      this.status = 'idle';
      return null;
    }

    this.status = 'syncing';
    const committedFiles = Array.from(this.pendingFiles);
    const hash = 'c' + Math.random().toString(16).substring(2, 9);
    const commitMessage = `sync(vault): ${new Date(currentTime).toISOString()} - ${committedFiles.length} file(s) updated`;

    const commitRecord = {
      hash,
      message: commitMessage,
      files: committedFiles,
      timestamp: currentTime,
    };

    this.commitHistory.push(commitRecord);
    this.lastSync = new Date(currentTime).toISOString();
    this.lastCommit = hash;
    this.pendingFiles.clear();
    this.firstEventTime = null;
    this.lastEventTime = null;
    this.status = 'idle';

    return commitRecord;
  }

  getStatusJson() {
    return {
      status: this.status,
      lastSync: this.lastSync,
      lastCommit: this.lastCommit,
      filesCount: this.commitHistory.reduce((acc, c) => acc + c.files.length, 0),
      pendingCount: this.pendingFiles.size,
    };
  }
}
