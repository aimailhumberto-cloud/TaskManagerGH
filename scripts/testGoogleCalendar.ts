import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CALENDAR_SCOPE, windowsVault, oauthRequest, exchangeCode, authorizeDesktop, readPrimaryCalendar, parseDesktopClient, type CalendarGrant, type GrantVault } from '../src/lib/googleCalendar';

const client = { installed: { client_id: 'test.apps.googleusercontent.com', client_secret: 'FAKE-CLIENT-NO-REAL-SECRET' } };
const configured = parseDesktopClient(client, 'local-humberto');
const grant: CalendarGrant = { ...configured, scope: CALENDAR_SCOPE, refreshToken: 'FAKE-REFRESH-NO-REAL-SECRET' };
let stored: CalendarGrant | null = grant;
const vault: GrantVault = { read: async () => structuredClone(stored), write: async value => { stored = structuredClone(value); } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const event = (id: string) => ({ id, summary: 'Evento ficticio', status: 'confirmed', htmlLink: 'https://www.google.com/calendar/event?eid=fake', start: { dateTime: '2026-10-05T10:00:00-05:00' }, end: { dateTime: '2026-10-05T11:00:00-05:00' }, description: 'DO-NOT-COPY', attendees: [{ email: 'DO-NOT-COPY' }] });
async function main() {
  for (const key of Object.keys(process.env)) if (/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE/i.test(key)) delete process.env[key];
  process.env.TASKMANAGER_LOCAL_ONLY = '1';
  await mkdir('.local-data', { recursive: true }); const dir = await mkdtemp(join('.local-data', 'google-test-'));
  process.env.DATABASE_PATH = join(dir, 'db.json');
  await writeFile(process.env.DATABASE_PATH, JSON.stringify({ companies: [{ id: 'personal', name: 'Test' }], people: [{ id: 'local-humberto', name: 'Test', role: 'Admin' }], users: [], tasks: [{ id: 'fake-task', title: 'Untouched task' }], projects: [], templates: [], agentQueue: [], reminders: [{ id: 'fake-linked', externalId: 'FAKE-CHATGPT', channel: 'chatgpt', state: 'ExternalLinked' }] }));
  const before = JSON.parse(await readFile(process.env.DATABASE_PATH, 'utf8'));
  assert.throws(() => parseDesktopClient({ web: client.installed }, 'local-humberto'), /Escritorio/);
  assert.throws(() => oauthRequest(configured.clientId, 'http://example.org:3011/'), /loopback/);
  const auth = oauthRequest(configured.clientId, 'http://127.0.0.1:43821/'); const authUrl = new URL(auth.url);
  assert.equal(authUrl.searchParams.get('scope'), CALENDAR_SCOPE);
  assert.equal(authUrl.searchParams.get('include_granted_scopes'), 'false');
  assert.equal(authUrl.searchParams.get('code_challenge'), createHash('sha256').update(auth.verifier).digest('base64url'));
  let writes = 0;
  const guarded: GrantVault = { read: vault.read, write: async g => { writes++; await vault.write(g); } };
  await assert.rejects(exchangeCode(configured, 'fake-code', auth.verifier, 'http://127.0.0.1:43821/', guarded, (async () => json({ refresh_token: 'FAKE', scope: CALENDAR_SCOPE + ' https://www.googleapis.com/auth/calendar' })) as typeof fetch), /exclusivamente/); assert.equal(writes, 0);
  await assert.rejects(exchangeCode(configured, 'fake-code', auth.verifier, 'http://127.0.0.1:43821/', guarded, (async () => json({ scope: CALENDAR_SCOPE })) as typeof fetch), /persistente/); assert.equal(writes, 0);
  await authorizeDesktop(configured, url => {
    const u = new URL(url); const callback = new URL(u.searchParams.get('redirect_uri')!);
    void (async () => {
      callback.search = '?state=wrong&code=fake'; assert.equal((await fetch(callback)).status, 400);
      callback.search = new URLSearchParams({ state: u.searchParams.get('state')!, code: 'fake-code' }).toString(); assert.equal((await fetch(callback)).status, 200);
    })().catch(e => { console.error(e); process.exitCode = 1; });
  }, guarded, (async (_url, init) => { const fields = new URLSearchParams(String(init?.body)); assert(fields.has('code_verifier')); assert.equal(fields.get('grant_type'), 'authorization_code'); return json({ refresh_token: 'FAKE-REFRESH-NO-REAL-SECRET', scope: CALENDAR_SCOPE }); }) as typeof fetch);
  assert.equal(writes, 1);
  await assert.rejects(authorizeDesktop(configured, url => { const u = new URL(url); const callback = new URL(u.searchParams.get('redirect_uri')!); callback.search = new URLSearchParams({ state: u.searchParams.get('state')!, error: 'access_denied' }).toString(); void fetch(callback); }, guarded), /cancelado/); assert.equal(writes, 1);
  let calls = 0;
  const remote = (async (url: any, init?: RequestInit) => {
    calls++; const u = new URL(String(url));
    if (u.hostname === 'oauth2.googleapis.com') { assert.equal(init?.method, 'POST'); assert.equal(new URLSearchParams(String(init?.body)).get('grant_type'), 'refresh_token'); return json({ access_token: 'FAKE-ACCESS', scope: CALENDAR_SCOPE }); }
    assert.equal(u.pathname, '/calendar/v3/calendars/primary/events'); assert.equal(init?.method, 'GET');
    assert.equal(u.searchParams.get('singleEvents'), 'true'); assert(!u.searchParams.has('calendarId')); assert(!u.searchParams.get('fields')!.includes('description')); assert(!u.searchParams.get('fields')!.includes('attendees'));
    if (!u.searchParams.get('pageToken')) return json({ items: [event('one')], nextPageToken: 'second' });
    return json({ items: [{ ...event('two'), start: { date: '2026-10-06' }, end: { date: '2026-10-07' } }] });
  }) as typeof fetch;
  const snapshot = await readPrimaryCalendar(grant, vault, remote, new Date('2026-10-03T12:00:00Z'));
  assert.equal(calls, 3); assert.equal(snapshot.events.length, 2); assert.equal(snapshot.events[1].allDay, true); assert(!JSON.stringify(snapshot).includes('DO-NOT-COPY'));
  await assert.rejects(readPrimaryCalendar({ ...grant, scope: CALENDAR_SCOPE + ' other' }, vault, remote), /autorización/);
  await assert.rejects(readPrimaryCalendar(grant, vault, (async () => json({ error: 'invalid_grant' }, 400)) as typeof fetch), /revocado/);
  await assert.rejects(readPrimaryCalendar(grant, vault, (async () => { throw new Error('FAKE-SECRET-NETWORK-ERROR'); }) as typeof fetch), /contactar/);
  let partialCalls = 0;
  await assert.rejects(readPrimaryCalendar(grant, vault, (async () => ++partialCalls === 1 ? json({ access_token: 'FAKE' }) : partialCalls === 2 ? json({ items: [event('one')], nextPageToken: 'second' }) : json({}, 429)) as typeof fetch), /cuota/);
  const { importCalendarSnapshot } = await import('../src/services/planningService');
  const { synchronizeCalendar } = await import('../src/services/googleCalendarService');
  await importCalendarSnapshot(snapshot);
  const previous = await readFile(process.env.DATABASE_PATH, 'utf8');
  await assert.rejects(importCalendarSnapshot({ ...snapshot, calendarId: 'other' }), /inválida/); assert.equal(await readFile(process.env.DATABASE_PATH, 'utf8'), previous);
  await assert.rejects(synchronizeCalendar('someone-else', vault, remote), /otra identidad/);
  const first = calls; await Promise.all([synchronizeCalendar('local-humberto', vault, remote), synchronizeCalendar('local-humberto', vault, remote)]); assert.equal(calls - first, 3);
  const afterSuccess = await readFile(process.env.DATABASE_PATH, 'utf8'); await synchronizeCalendar('local-humberto', vault, remote); assert.equal(await readFile(process.env.DATABASE_PATH, 'utf8'), afterSuccess);
  stored = null; await assert.rejects(synchronizeCalendar('local-humberto', vault, remote), /no tiene autorización/); stored = grant;
  const after = JSON.parse(afterSuccess); assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.projects, before.projects); assert.deepEqual(after.reminders, before.reminders);
  const target = 'TaskManagerHB/GoogleCalendar/test-' + randomUUID();
  try {
    console.log('Testing Windows vault: read missing synthetic record.');
    assert.equal(await windowsVault('read', undefined, target), null);
    console.log('Testing Windows vault: write synthetic record.');
    await windowsVault('write', grant, target);
    // Each invocation launches a fresh process: read verifies OS persistence, not memory.
    assert.deepEqual(await windowsVault('read', undefined, target), grant);
    console.log('Testing Windows vault: persistence verified, deleting synthetic record.');
    await windowsVault('delete', undefined, target); assert.equal(await windowsVault('read', undefined, target), null);
  } finally { await windowsVault('delete', undefined, target); }
  console.log('PASS isolated OAuth: exact readonly scope, PKCE/state/rejection/cancel, no grant escalation, refresh, primary-only GET, pagination/all-day/minimal fields, revoke/offline/quota errors, coalescing/throttle, unchanged tasks/reminder, Windows Credential Manager fake-record persistence and deletion. No real Google grant or calendar API calls.');
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Test failed'); process.exitCode = 1; });
