import assert from 'node:assert/strict';
import {workDataOnly} from '../src/services/originalAccounts';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { SupabaseWorkspaceStore, StorageConflict, WorkspaceRpcClient } from '../src/services/supabaseWorkspaceStore';
import { prepareLegacyImport } from '../src/lib/legacySupabaseMigration';

async function main() {
  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pg = new PGlite(); // Real PostgreSQL WASM, memory only; not hosted Supabase/PostgREST.
  try {
    await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE companies(id text PRIMARY KEY, name text); INSERT INTO companies VALUES('original','Preserved');");
    await pg.exec(await readFile('migrations/001_workspace_snapshot.sql', 'utf8'));
    await pg.exec(await readFile('migrations/002_workspace_work_data_only.sql', 'utf8'));
    assert.equal((await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM companies')).rows[0].count, 1);
    assert.equal((await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM tm_workspace_v1')).rows[0].count, 0);
    for (const role of ['anon', 'authenticated']) {
      await pg.exec(`SET ROLE ${role}`);
      await assert.rejects(pg.query('SELECT tm_workspace_read_v1()'), /permission denied/);
      await assert.rejects(pg.query('SELECT * FROM tm_workspace_v1'), /permission denied/);
      await pg.exec('RESET ROLE');
    }
    await pg.exec('SET ROLE service_role');
    const client: WorkspaceRpcClient = { async rpc(name, args = {}) {
      const queries: Record<string, [string, unknown[]]> = {
        tm_workspace_read_v1: ['SELECT tm_workspace_read_v1() AS result', []],
        tm_workspace_commit_v1: ['SELECT tm_workspace_commit_v1($1,$2::jsonb) AS result', [args.p_expected_revision, JSON.stringify(args.p_document)]],
        tm_workspace_restore_v1: ['SELECT tm_workspace_restore_v1($1,$2) AS result', [args.p_expected_revision, args.p_restore_revision]],
      };
      try { const [sql, values] = queries[name]; return { data: (await pg.query<{ result: unknown }>(sql, values)).rows[0].result, error: null }; }
      catch { return { data: null, error: { code: 'ISOLATED_SQL_ERROR' } }; }
    } };
    const remote = new SupabaseWorkspaceStore(client);
    await assert.rejects(remote.read(), /ausente/);
    const seed: any = workDataOnly({ companies: [{ id: 'business', name: 'Fictional' }], people: [{ id: 'owner', name: 'Owner', role: 'Admin', avatar: '' }], tasks: [], users: [{ id: 'user', personId: 'owner', email: 'owner@isolated.test', passwordHash: 'fixture-hash', salt: 'fixture-salt', isActive: true }], templates: [], agentQueue: [], smtpConfig: { host: '', port: 587, secure: false, user: '', pass: '' }, projects: [], reminders: [], automations: [], decisions: [], dayPlans: [], heroPreferences: [], appliedOperations: [] });
    // Explicit fixture import only, never app initialization.
    await pg.query('INSERT INTO tm_workspace_v1(singleton, revision, document) VALUES(true,1,$1::jsonb)', [JSON.stringify(seed)]);
    const { DBService } = await import('../src/services/dbService');
    const db = new DBService(remote), other = new DBService(remote);
    assert.deepEqual(await db.readData(), seed);
    const unchanged = await remote.read(); await db.getCompanies(); await db.getUsers(); assert.deepEqual(await remote.read(), unchanged);
    await db.transaction(data => {
      (data.projects as any[]).push({ id: 'project', stages: [{ id: 'stage' }], deliverables: [{ id: 'deliverable' }], evidence: [{ id: 'evidence' }], history: [{ revision: 1 }] });
      (data.reminders as any[]).push({ id: 'reminder' }); (data.decisions as any[]).push({ id: 'decision' }); (data.dayPlans as any[]).push({ id: 'day' });
      (data.automations as any[]).push({ id: 'automation' }); (data.heroPreferences as any[]).push({ id: 'hero' });
      (data.appliedOperations as any[]).push({ actorId: 'owner', requestId: 'request', fingerprint: 'fixture', result: { id: 'project' } });
      (data as any).calendarSnapshot = { events: [{ id: 'calendar-event' }], verifiedAt: 'fixture' };
    });
    assert.equal((await remote.read()).revision, 2);
    const enriched = await db.readData();
    for (const key of ['projects', 'reminders', 'decisions', 'dayPlans', 'automations', 'heroPreferences', 'appliedOperations']) assert.equal((enriched as any)[key].length, 1);
    const bytesBefore = JSON.stringify(await remote.read());
    await assert.rejects(db.transaction(data => { data.tasks = []; throw new Error('Interrupted'); }), /Interrupted/);
    assert.equal(JSON.stringify(await remote.read()), bytesBefore);
    await db.transaction(() => {}); assert.equal(JSON.stringify(await remote.read()), bytesBefore);
    const stale = await db.readData(); await other.createCompany({ name: 'Concurrent' });
    stale.companies.push({ id: 'lost', name: 'Must reject' }); await assert.rejects(db.writeData(stale), StorageConflict);
    assert(!(await db.getCompanies()).some(c => c.id === 'lost'));
    await assert.rejects(db.writeData(structuredClone(await db.readData())), /sin snapshot/);
    const a = await remote.read(), b = await remote.read();
    a.data.companies.push({ id: 'winner', name: 'Winner' }); b.data.companies.push({ id: 'loser', name: 'Loser' });
    const racing = await Promise.allSettled([remote.commit(a.data, a.revision), remote.commit(b.data, b.revision)]);
    assert.equal(racing.filter(r => r.status === 'fulfilled').length, 1); assert.equal(racing.filter(r => r.status === 'rejected').length, 1);
    const beforeFailure = await remote.read();
    // Deliberately break history insert: SQL must roll back all changes, not partial writes.
    await pg.query('INSERT INTO tm_workspace_history_v1(revision,document) VALUES($1,$2::jsonb)', [beforeFailure.revision, JSON.stringify(beforeFailure.data)]);
    await assert.rejects(remote.commit(beforeFailure.data, beforeFailure.revision), /No se confirmó/);
    assert.deepEqual(await remote.read(), beforeFailure);
    await pg.exec('RESET ROLE'); await pg.query('DELETE FROM tm_workspace_history_v1 WHERE revision=$1', [beforeFailure.revision]); await pg.exec('SET ROLE service_role');
    const restored = await client.rpc('tm_workspace_restore_v1', { p_expected_revision: beforeFailure.revision, p_restore_revision: 1 });
    assert.equal((restored.data as any).committed, true); assert.deepEqual((await remote.read()).data, seed);
    assert.equal((await remote.read()).revision, beforeFailure.revision + 1);
    const staleRestore = await client.rpc('tm_workspace_restore_v1', { p_expected_revision: beforeFailure.revision, p_restore_revision: 2 });
    assert.equal((staleRestore.data as any).committed, false);
    const missingRestore = await client.rpc('tm_workspace_restore_v1', { p_expected_revision: (await remote.read()).revision, p_restore_revision: 9999 }); assert(missingRestore.error);
    await db.createPerson({ name: 'Delegate', role: 'Member', avatar: '', companyId: 'business' });
    const task = await db.createTask({ title: 'Fictional task', description: '', type: 'OneOff', steps: [], companyId: 'business', assigneeId: 'owner', status: 'Pending', priority: 'Medium', origin: 'Manual', dueDate: '', attachments: [] } as any);
    await db.updateTask(task.id, { nextAction: 'Verify isolated persistence', workDate: '2026-10-05' });
    assert.equal((await other.getTaskById(task.id))!.nextAction, 'Verify isolated persistence');
    assert(await db.deleteTask(task.id)); assert.equal(await other.getTaskById(task.id), null);
    const failed = new SupabaseWorkspaceStore({ rpc: async () => ({ data: [], error: { message: 'PRIVATE SECRET NOT DISPLAYED' } }) });
    await assert.rejects(failed.read(), e => e instanceof Error && !e.message.includes('PRIVATE'));
    await pg.exec('RESET ROLE');
    assert.equal((await pg.query<{ name: string }>('SELECT name FROM companies WHERE id=$1', ['original'])).rows[0].name, 'Preserved');

    const tables: any = { companies: [{ id: 'business', name: 'Fictional', extra_column: 'retained' }], people: [{ id: 'owner', name: 'Owner', role: 'Admin', avatar: '' }], tasks: [{ id: 'legacy-task', title: 'Pending validation', company_id: 'business', assignee_id: 'owner', status: 'Pending', type: 'OneOff', priority: 'Medium', origin: 'Manual', description: '<!-- HERMES_MEETING_METADATA: {"ownerId":"owner","workDate":"2026-10-05","id":"spoofed"} -->' }], email_templates: [], smtp_config: [], agent_queue: [], users: [{ id: 'user', person_id: 'owner', email: 'owner@isolated.test', is_active: true }] };
    const source = { format: 'taskmanager-work-export-v2', tables, rowCounts: Object.fromEntries(Object.entries(tables).map(([k,v]) => [k,(v as any[]).length])) };
    const bytes = Buffer.from(JSON.stringify(source)), hash = createHash('sha256').update(bytes).digest('hex');
    const bundle = prepareLegacyImport(bytes, hash);
    assert.deepEqual(bundle.legacySource, source); assert.equal(bundle.data.tasks[0].id, 'legacy-task'); assert.equal(bundle.data.tasks[0].ownerId, 'owner');
    assert.equal(bundle.data.users, undefined); assert.equal((bundle.data.companies[0] as any).extra_column, 'retained'); assert.equal(bundle.readyForProduction, false);
    assert.throws(() => prepareLegacyImport(bytes, '0'.repeat(64)), /no verificado/);
    const incomplete = Buffer.from(JSON.stringify({ ...source, rowCounts: { ...source.rowCounts, tasks: 2 } }));
    assert.throws(() => prepareLegacyImport(incomplete, createHash('sha256').update(incomplete).digest('hex')), /incompleta/);
    console.log('PASS isolated PostgreSQL SQL/ACL/CAS/history/restore; adapter CRUD/all collections/errors; work-only offline migration. NOT production/Supabase HTTP validation.');
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
