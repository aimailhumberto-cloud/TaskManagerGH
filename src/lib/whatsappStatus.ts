import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
export type GatewayState = 'connected' | 'disconnected' | 'unavailable' | 'identity_mismatch';
interface Permission { enabled: boolean | null; expiresAt: string | null; renewedAt: string | null; mode: string | null }
export interface IntegrationStatus {
 schemaVersion: 1; checkedAt: string; available: true;
 activity: { available: boolean; lastIncomingAt: string | null; lastOutgoingAcceptedAt: string | null; lastObservedAt: string | null };
 permissions: { attachments: Permission; voice: Permission; events: Permission & { autoRenewEnabled: boolean | null; activeSubscriptions: number | null; subscriptionExpiresAt: string | null; scope: string | null }; send: { mode: string | null; automaticReplies: boolean | null } };
 tunnel: { state: 'polling_verified' | 'local_healthy' | 'local_unhealthy' | 'unknown'; checkedAt: string | null; lastSuccessfulPollAt: string | null; pollEvidenceAt: string | null; pollEvidenceFresh: boolean; evidenceFresh: boolean; source: string | null; remotePollVerified: boolean };
}
export interface WhatsAppStatus { checkedAt: string; accounts: { id: string; name: string; state: GatewayState; checkedAt: string; integration: IntegrationStatus | null }[]; }
const date = (v: unknown): string | null => typeof v === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
const bool = (v: unknown): boolean | null => typeof v === 'boolean' ? v : null;
const known = (v: unknown, allowed: string[]) => typeof v === 'string' && allowed.includes(v) ? v : null;
import { freshEvidence } from './whatsappFreshness';
const permission = (p: any): Permission => ({ enabled: bool(p?.enabled), expiresAt: date(p?.expiresAt), renewedAt: date(p?.renewedAt), mode: known(p?.mode, ['on_user_request', 'local_on_user_request']) });
export function sanitizeIntegration(raw: any, now = Date.now()): IntegrationStatus | null {
 const checkedAt = date(raw?.checkedAt);
 if (raw?.schemaVersion !== 1 || raw.available !== true || !checkedAt || !freshEvidence(checkedAt, now)) return null;
 const activity = raw.activity, p = raw.permissions, t = raw.tunnel;
 const tunnelChecked = date(t?.checkedAt), poll = date(t?.lastSuccessfulPollAt), pollEvidenceAt = date(t?.pollEvidenceAt);
 const evidenceFresh = t?.evidenceFresh === true && freshEvidence(tunnelChecked, now);
 const pollEvidenceFresh = t?.pollEvidenceFresh === true && freshEvidence(pollEvidenceAt, now) && freshEvidence(poll, now);
 const remotePollVerified = t?.remotePollVerified === true && evidenceFresh && pollEvidenceFresh;
 const state = remotePollVerified && t?.state === 'polling_verified' ? 'polling_verified' : evidenceFresh && ['local_healthy', 'local_unhealthy'].includes(t?.state) ? t.state : 'unknown';
 return { schemaVersion: 1, checkedAt, available: true, activity: { available: activity?.available === true, lastIncomingAt: activity?.available === true ? date(activity.lastIncomingAt) : null, lastOutgoingAcceptedAt: activity?.available === true ? date(activity.lastOutgoingAcceptedAt) : null, lastObservedAt: activity?.available === true ? date(activity.lastObservedAt) : null }, permissions: { attachments: permission(p?.attachments), voice: permission(p?.voice), events: { ...permission(p?.events), autoRenewEnabled: bool(p?.events?.autoRenewEnabled), activeSubscriptions: Number.isSafeInteger(p?.events?.activeSubscriptions) && p.events.activeSubscriptions >= 0 ? p.events.activeSubscriptions : null, subscriptionExpiresAt: date(p?.events?.subscriptionExpiresAt), scope: known(p?.events?.scope, ['new_private_text_metadata_only']) }, send: { mode: known(p?.send?.mode, ['exact_single_order_approval']), automaticReplies: bool(p?.send?.automaticReplies) } }, tunnel: { state, checkedAt: tunnelChecked, lastSuccessfulPollAt: poll, pollEvidenceAt, pollEvidenceFresh, evidenceFresh, source: known(t?.source, ['native_poll_check','watchdog']), remotePollVerified } };
}
export async function readWhatsAppStatus(root?: string, transport: typeof fetch = fetch): Promise<WhatsAppStatus> {
 const checkedAt = new Date().toISOString(); const result: WhatsAppStatus = { checkedAt, accounts: ['personal','bee-smart'].map(id => ({ id, name: id === 'personal' ? 'Personal' : 'BEE SMART', state: 'unavailable', checkedAt, integration: null })) };
 if (!root || !isAbsolute(root)) return result;
 let profiles: Record<string, { tokenFile?: string; sessionUseApproved?: boolean }>;
 try { profiles = JSON.parse(await readFile(join(root, 'profiles.local.json'), 'utf8')); } catch { return result; }
 await Promise.all(result.accounts.map(async account => {
  try {
   const profile = profiles[account.id]; if (profile?.sessionUseApproved !== true || !profile.tokenFile || !isAbsolute(profile.tokenFile)) return;
   const token = (await readFile(profile.tokenFile, 'utf8')).trim(); if (!token || /[\r\n]/.test(token)) return;
   const response = await transport(`http://127.0.0.1:${account.id === 'personal' ? 3012 : 3013}/health`, { headers: { authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(3000) });
   if (!response.ok) return; const raw = await response.text(); if (raw.length > 16384) return; const health = JSON.parse(raw);
   if (health.profile !== account.id || health.expectedAccountMatches === false) { account.state = 'identity_mismatch'; return; }
   account.state = health.status === 'connected' && health.expectedAccountMatches === true ? 'connected' : health.status === 'disconnected' ? 'disconnected' : 'unavailable';
   if (health.expectedAccountMatches === true) account.integration = sanitizeIntegration(health.integrationStatus);
  } catch { /* Fail closed without upstream errors, paths or secrets. */ }
 })); return result;
}
