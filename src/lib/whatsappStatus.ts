import { readFile, stat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
export type GatewayState = 'connected' | 'disconnected' | 'unavailable' | 'identity_mismatch';
export interface WhatsAppStatus { checkedAt: string; accounts: { id: string; name: string; state: GatewayState; checkedAt: string; lastActivityAt: string | null }[]; tunnel: { state: 'unavailable' | 'historical'; evidenceAt: string | null; lastReportedHealthy: boolean | null }; permissions: { expiresAt: null; renewedAt: null }; }
const aliases = ['personal', 'bee-smart'] as const;
export async function readWhatsAppStatus(root?: string, transport: typeof fetch = fetch): Promise<WhatsAppStatus> {
  const checkedAt = new Date().toISOString();
  const result: WhatsAppStatus = { checkedAt, accounts: aliases.map(id => ({ id, name: id === 'personal' ? 'Personal' : 'BEE SMART', state: 'unavailable', checkedAt, lastActivityAt: null })), tunnel: { state: 'unavailable', evidenceAt: null, lastReportedHealthy: null }, permissions: { expiresAt: null, renewedAt: null } };
  if (!root || !isAbsolute(root)) return result;
  let profiles: Record<string, { tokenFile?: string; sessionUseApproved?: boolean }>;
  try { profiles = JSON.parse(await readFile(join(root, 'profiles.local.json'), 'utf8')); } catch { return result; }
  await Promise.all(result.accounts.map(async account => {
    try {
      const profile = profiles[account.id];
      if (profile?.sessionUseApproved !== true || !profile.tokenFile || !isAbsolute(profile.tokenFile)) return;
      const token = (await readFile(profile.tokenFile, 'utf8')).trim();
      if (!token || /[\r\n]/.test(token)) return;
      // Fixed local endpoints: no caller-supplied URL, redirects, sends, messages, ACK or session files.
      const response = await transport(`http://127.0.0.1:${account.id === 'personal' ? 3012 : 3013}/health`, { headers: { authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (!response.ok) return;
      const raw = await response.text(); if (raw.length > 16384) return;
      const health = JSON.parse(raw);
      if (health.profile !== account.id || health.expectedAccountMatches === false) { account.state = 'identity_mismatch'; return; }
      account.state = health.status === 'connected' && health.expectedAccountMatches === true ? 'connected' : health.status === 'disconnected' ? 'disconnected' : 'unavailable';
      // Existing health contract has no message/activity timestamp. Never substitute request time.
    } catch { /* Return sanitized unknown, never errors/paths/tokens from upstream. */ }
  }));
  try {
    const path = join(root, 'tunnel-validation-status.json'); const info = await stat(path); const raw = JSON.parse(await readFile(path, 'utf8'));
    result.tunnel = { state: 'historical', evidenceAt: info.mtime.toISOString(), lastReportedHealthy: typeof raw.healthy === 'boolean' ? raw.healthy : null };
    // A saved healthy flag is historical, not a live tunnel probe or permission expiry.
  } catch { /* No evidence available. */ }
  return result;
}
