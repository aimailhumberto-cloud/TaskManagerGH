import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { canAdministerLegacyTask } from '../src/lib/legacyAdministration';
import { canReadTask, canWriteTask, workspaceDTO, publicValue } from '../src/lib/publicWorkspace';
import type { SessionData } from '../src/lib/session';

async function main() {
  const preview = readFileSync('.local-data/preview.json'); mkdirSync('.local-data/legacy-administration-qa', { recursive: true });
  const root = mkdtempSync(resolve('.local-data/legacy-administration-qa/run-')); const database = resolve(root, 'database.json');
  const actor: SessionData = { userId: 'usr-5ry71br', personId: 'p1wq05qf', email: 'synthetic-owner@legacy.test', role: 'Owner', createdAt: new Date().toISOString() };
  const manager: SessionData = { ...actor, userId: 'synthetic-manager-user', personId: 'synthetic-manager', role: 'Owner' };
  const otherOwner: SessionData = { ...actor, userId: 'synthetic-other-owner-user', personId: 'synthetic-other-owner', role: 'Owner' };
  const ids = Array.from({ length: 74 }, (_, i) => 'synthetic-legacy-' + i);
  const data: any = { companies: [{ id: 'synthetic-business', name: 'Synthetic business' }], people: [{ id: actor.personId, name: 'Synthetic HB', role: 'Owner', avatar: '' }, { id: manager.personId, name: 'Synthetic manager', role: 'Gerente', avatar: '' }, { id: otherOwner.personId, name: 'Synthetic other Owner', role: 'Owner', avatar: '' }], users: [{ id: actor.userId, personId: actor.personId, isActive: true }, { id: manager.userId, personId: manager.personId, isActive: true }, { id: otherOwner.userId, personId: otherOwner.personId, isActive: true }], tasks: [], templates: [], agentQueue: [], projects: [], smtpConfig: { host: '', port: 587, secure: false, user: '', pass: '' }, legacyAdministration: { version: 1, userId: actor.userId, personId: actor.personId, taskIds: ids, sourceSha256: 'a'.repeat(64), approvedAt: '2026-10-09T12:38:00Z', approvalReference: 'SYNTHETIC approval only' } };
  for (const id of ids) {
    const task: any = { id, title: 'Synthetic legacy task ' + id, description: '', companyId: 'synthetic-business', assigneeId: manager.personId, assigneeIds: [manager.personId, actor.personId], type: 'One-shot', status: 'Pending', priority: 'Medium', origin: 'Manual', dueDate: '2026-10-14T15:00:00+00:00', steps: [], attachments: [], activityLog: [{ timestamp: '2026-06-01T12:00:00Z', user: 'System', type: 'User', action: 'Synthetic legacy origin' }], revision: 0 };
    const snapshot = structuredClone(task); delete snapshot.activityLog;
    task.activityLog.push({ timestamp: new Date().toISOString(), user: actor.personId, type: 'User', action: 'Synthetic import snapshot', revision: 0, snapshot }); data.tasks.push(task);
  }
  data.tasks[1].companyId = ''; data.tasks[1].assigneeId = ''; data.tasks[1].assigneeIds = [];
  data.tasks[2].type = 'Project'; data.tasks[2].steps = [{ id: 'synthetic-legacy-step', text: 'Legacy step', completed: false, dueDate: '2026-10-14T15:00:00+00:00', legacyField: 'Synthetic preserved metadata' }];
  data.tasks.push({ ...structuredClone(data.tasks[0]), id: 'synthetic-not-imported' });
  const original = structuredClone(data); const write = () => writeFileSync(database, JSON.stringify(data)); write();
  for (const key of Object.keys(process.env)) if (/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE|GOOGLE|WHATSAPP/.test(key)) delete process.env[key];
  process.env.DATABASE_PATH = database; process.env.TASKMANAGER_LOCAL_ONLY = '0'; process.env.TASKMANAGER_EXTERNAL_ACTIONS_ENABLED = '0';
  const { applyWorkspaceCommand } = await import('../src/services/workspaceService');
  assert(canAdministerLegacyTask(data, actor, data.tasks[0])); assert(canWriteTask(data, actor, data.tasks[0]));
  assert(!canWriteTask(data, manager, data.tasks[0])); assert(!canWriteTask(data, otherOwner, data.tasks[0])); assert(!canWriteTask(data, actor, data.tasks.at(-1)));
  const readScopeBefore = [actor, manager, otherOwner].map(a => data.tasks.filter((t: any) => canReadTask(data, a, t)).map((t: any) => t.id));
  const operation = { action: 'updateTask', id: ids[0], requestId: 'synthetic-legacy-operation-1', expectedRevision: 0, reason: 'Synthetic legacy compatibility edit', fields: { title: 'Synthetic updated title', companyId: 'synthetic-business', assigneeId: manager.personId, dueDate: '2026-10-14', ownerId: otherOwner.personId, legacyAdministration: { userId: otherOwner.userId } } };
  await applyWorkspaceCommand(actor, operation); let saved = JSON.parse(readFileSync(database, 'utf8')); const edited = saved.tasks.find((t: any) => t.id === ids[0]);
  assert.equal(edited.ownerId, undefined); assert.equal(edited.dueDate, original.tasks[0].dueDate); assert.deepEqual(edited.assigneeIds, original.tasks[0].assigneeIds); assert.equal(edited.activityLog[0].user, 'System'); assert.equal(edited.activityLog.at(-1).user, actor.personId); assert.deepEqual(saved.legacyAdministration, original.legacyAdministration);
  await applyWorkspaceCommand(actor, operation); saved = JSON.parse(readFileSync(database, 'utf8')); assert.equal(saved.tasks[0].revision, 1); assert.equal(saved.tasks[0].activityLog.length, edited.activityLog.length);
  await assert.rejects(applyWorkspaceCommand(actor, { ...operation, requestId: 'synthetic-stale', fields: { title: 'Stale' } }), /Otra actualización/);
  for (const denied of [manager, otherOwner]) await assert.rejects(applyWorkspaceCommand(denied, { ...operation, requestId: 'synthetic-denied-' + denied.personId, expectedRevision: 1 }), /validación/);
  await applyWorkspaceCommand(actor, { action: 'restoreTask', id: ids[0], requestId: 'synthetic-restore-original', expectedRevision: 1, reason: 'Synthetic rollback to imported state', fields: { revision: 0 } });
  saved = JSON.parse(readFileSync(database, 'utf8')); assert.equal(saved.tasks[0].ownerId, undefined); assert.equal(saved.tasks[0].title, original.tasks[0].title); assert.equal(saved.tasks[0].dueDate, original.tasks[0].dueDate); assert.deepEqual(saved.tasks[0].assigneeIds, original.tasks[0].assigneeIds);
  await applyWorkspaceCommand(actor, { action: 'updateTask', id: ids[1], requestId: 'synthetic-empty-fields', expectedRevision: 0, reason: 'Synthetic preserve unassigned fields', fields: { title: 'Unassigned task edited', companyId: '', assigneeId: '', dueDate: '2026-10-14' } });
  saved = JSON.parse(readFileSync(database, 'utf8')); assert.equal(saved.tasks[1].companyId, ''); assert.equal(saved.tasks[1].assigneeId, ''); assert.equal(saved.tasks[1].ownerId, undefined);
  await applyWorkspaceCommand(actor, { action: 'updateTask', id: ids[2], requestId: 'synthetic-legacy-step-edit', expectedRevision: 0, reason: 'Synthetic edit of original step', fields: { steps: [{ ...original.tasks[2].steps[0], text: 'Updated legacy step' }] } });
  saved = JSON.parse(readFileSync(database, 'utf8')); assert.equal(saved.tasks[2].steps[0].dueDate, original.tasks[2].steps[0].dueDate); assert.equal(saved.tasks[2].steps[0].legacyField, original.tasks[2].steps[0].legacyField);
  assert.deepEqual([actor, manager, otherOwner].map(a => saved.tasks.filter((t: any) => canReadTask(saved, a, t)).map((t: any) => t.id)), readScopeBefore);
  assert.equal(workspaceDTO(saved, actor).managedLegacyTaskIds.length, 74); assert.equal(workspaceDTO(saved, manager).managedLegacyTaskIds.length, 0); assert(!JSON.stringify(workspaceDTO(saved, actor)).includes('sourceSha256')); assert(!JSON.stringify(publicValue(saved.tasks[0])).includes('legacyAdministration'));
  data.users[0].isActive = false; write(); assert(!canAdministerLegacyTask(data, actor, data.tasks[0])); await assert.rejects(applyWorkspaceCommand(actor, { ...operation, requestId: 'synthetic-revoked' }), /Sesión revocada/);
  data.users[0].isActive = true; data.people[0].role = 'Gerente'; write(); assert(!canAdministerLegacyTask(data, actor, data.tasks[0])); await assert.rejects(applyWorkspaceCommand(actor, { ...operation, requestId: 'synthetic-role-changed' }), /validación/);
  data.people[0].role = 'Owner'; data.legacyAdministration.taskIds[73] = ids[0]; assert(!canAdministerLegacyTask(data, actor, data.tasks[0]), 'Malformed allowlist fails closed');
  assert.deepEqual(readFileSync('.local-data/preview.json'), preview);
  console.log(JSON.stringify({ syntheticOnly: true, approvedCustodianOnly: true, otherOwnerAndForgedRoleDenied: true, missingOwnerPreserved: true, multiAssigneesAndTimestampPreserved: true, originalHistoryPreserved: true, restoreOriginalRevision: true, unassignedFieldsPreserved: true, retriesAndConflicts: true, readScopeUnchanged: true, policyNotInPublicDTO: true, policyNotChangedByTaskFields: true, revocationAndRoleChangeDenied: true, malformedPolicyDenied: true, actualPreviewUnchanged: true, productionTouched: false }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
