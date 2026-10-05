// Authorized local-only administration adapter. Reads by default; writes require
// a confirmed user instruction and a stable requestId. No external app calls.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const raw = readFileSync(0, 'utf8').trim();
const input = raw ? JSON.parse(raw) : { operation: 'read' };
const url = new URL(process.env.TASKMANAGER_LOCAL_URL || 'http://127.0.0.1:3011');
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw new Error('Only a loopback local preview is supported.');
const origin = url.origin;
const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ email: 'humberto@local.test', password: 'preview-local-only' }) });
if (!login.ok) throw new Error('Existing local preview access unavailable. No accounts or credentials were changed.');
const cookie = login.headers.getSetCookie().find(v => v.startsWith('hermes_session='))?.split(';')[0];
if (!cookie) throw new Error('Local signed session unavailable.');
const headers = { Cookie: cookie };
const response = await fetch(origin + '/api/workspace' + (input.day ? '?day=' + encodeURIComponent(input.day) : ''), { headers });
if (!response.ok) throw new Error('Workspace read failed.');
const data = await response.json();
if (data.localOnly !== true) throw new Error('The server is not marked as an isolated local preview.');
if (input.operation === 'read') {
  const q = String(input.query || '').toLocaleLowerCase('es');
  console.log(JSON.stringify({ observedAt: data.observedAt, day: data.day, dayWork: (data.dayWork || []).filter(t => (!input.companyId || t.companyId === input.companyId) && (!input.assigneeId || t.assigneeId === input.assigneeId)), tasks: data.tasks.filter(t => (!input.companyId || input.companyId === t.companyId) && (!q || [t.title, t.nextAction, t.category, ...(t.subcategories || []), ...t.steps.map(s => s.text)].some(v => v?.toLocaleLowerCase('es').includes(q)))), companies: data.companies, projects: data.projects, people: data.people, automations: data.automations || [], heroPreference: data.heroPreference ? { id: data.heroPreference.id, revision: data.heroPreference.revision, background: data.heroPreference.background, locationLabel: data.heroPreference.locationLabel, widgetsEnabled: data.heroPreference.widgetsEnabled } : null, source: 'TaskManager local', externalSourcesFetched: false }, null, 2));
} else {
  if (input.operation !== 'write') throw new Error('Use read or write explicitly.');
  if (input.confirmed !== true || !input.instruction?.trim()) throw new Error('A clear confirmed user instruction is required.');
  if (!['createTask', 'updateTask', 'restoreTask', 'createAgent', 'saveAutomation', 'restoreAutomation', 'saveHero', 'restoreHero'].includes(input.action)) throw new Error('Only task administration is supported; no sending or external writes.');
  if (typeof input.requestId !== 'string' || !input.requestId.trim()) throw new Error('A stable requestId is required for safe retries.');
  if (!['createTask', 'createAgent'].includes(input.action) && !(input.action === 'saveAutomation' && !input.id) && !(input.action === 'saveHero' && input.expectedRevision === 0) && (!input.id || !Number.isInteger(input.expectedRevision))) throw new Error('The current task ID and revision are required.');
  const csrf = await (await fetch(origin + '/api/auth/csrf', { headers })).json();
  const fields = { ...(input.fields || {}) };
  if (input.source?.url && fields.sourceUrl === undefined) fields.sourceUrl = input.source.url;
  const result = await fetch(origin + '/api/workspace', { method: 'POST', headers: { ...headers, Origin: origin, 'Content-Type': 'application/json', 'x-csrf-token': csrf.token }, body: JSON.stringify({ action: input.action, id: input.id, expectedRevision: input.expectedRevision, requestId: input.requestId, fields, reason: input.reason || input.instruction, provenance: { channel: input.channel || 'chat', instruction: input.instruction, sourceKind: input.source?.kind || 'UserInstruction', sourceUrl: input.source?.url || '', observedAt: input.source?.observedAt || '' } }) });
  const output = await result.json();
  if (!result.ok) throw new Error(output.error || 'Change rejected. The result may already be saved after a connection failure; retry with the same requestId.');
  console.log(JSON.stringify({ success: true, record: output, externalActionsPerformed: false }, null, 2));
}
