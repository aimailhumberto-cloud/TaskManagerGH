import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { belongsTo, localDay, personalFields, taskInView } from '../src/lib/personalTasks';
import type { Task } from '../src/services/mockData';

async function main() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  await mkdir('.local-data', { recursive: true });
  const directory = await mkdtemp(join('.local-data', 'taskmanager-personal-'));
  process.env.DATABASE_PATH = join(directory, 'db.json');
  const { dbService, extractMeetingMetadata, injectMeetingMetadata } = await import('../src/services/dbService');
  await writeFile(process.env.DATABASE_PATH, JSON.stringify({ companies: [{ id: 'business', name: 'Isolated' }], people: [{ id: 'central', name: 'Test', role: 'Admin', avatar: '' }, { id: 'delegate', name: 'Delegate', role: 'Member', avatar: '' }], tasks: [], users: [], templates: [], agentQueue: [], smtpConfig: { host: '', port: 0, secure: false, user: '', pass: '' } }));
  const task = await dbService.createTask({ title: 'Round trip', description: 'Original description', companyId: 'business', assigneeId: 'central', ownerId: 'central', type: 'One-shot', steps: [], status: 'Pending', priority: 'Medium', origin: 'Manual', dueDate: '', attachments: [], workDate: '2026-09-30', nextAction: 'Call', projectName: 'Pilot', approvalStatus: 'Pending', waitingOn: 'Delegate', commitment: 'Send proposal', followUpDate: '2026-10-01' });
  const delegated = await dbService.updateTask(task.id, { assigneeId: 'delegate', assigneeIds: ['delegate'], workDate: '2026-10-02', dueDate: '2026-10-05', approvalStatus: 'Approved' });
  assert(belongsTo(delegated, 'central'));
  assert.equal(delegated.status, 'Pending');
  const read = await dbService.getTaskById(task.id);
  assert.equal(read?.nextAction, 'Call'); assert.equal(read?.workDate, '2026-10-02'); assert.equal(read?.dueDate, '2026-10-05');
  const serialized = injectMeetingMetadata('Original description', { ...personalFields(delegated as unknown as Record<string, unknown>), meetingLink: 'local-meeting' });
  assert.equal(extractMeetingMetadata(serialized).metadata.projectName, 'Pilot');
  assert.equal(extractMeetingMetadata(serialized).cleanDescription, 'Original description');
  assert.equal(extractMeetingMetadata(injectMeetingMetadata(serialized, { approvalStatus: 'NotRequired', waitingOn: '' })).metadata.waitingOn, '');
  assert.equal(localDay(new Date('2026-10-01T01:00:00Z'), 'America/Lima'), '2026-09-30');
  assert.equal(localDay(new Date('2026-03-08T07:00:00Z'), 'America/New_York'), '2026-03-08');
  const sample = { ...task, dueDate: '2026-09-29', workDate: '2026-10-02' } as Task;
  assert(taskInView(sample, 'today', '2026-09-30')); assert(taskInView(sample, 'week', '2026-09-30'));
  assert(taskInView({ ...sample, dueDate: '', workDate: '2027-01-03' }, 'week', '2026-12-31'));
  assert(!taskInView({ ...sample, dueDate: '', workDate: '2027-01-04', followUpDate: '' }, 'week', '2026-12-31'));
  assert(taskInView({ ...sample, status: 'Completed' }, 'approval', '2026-09-30'));
  assert(!taskInView({ ...sample, status: 'Completed' }, 'today', '2026-09-30'));
  assert.throws(() => personalFields({ workDate: '2026-02-30' }));
  assert.throws(() => personalFields({ approvalStatus: 'done' }));
  const disk = JSON.parse(await readFile(process.env.DATABASE_PATH, 'utf8'));
  assert.equal(disk.tasks.length, 1); assert.equal(disk.tasks[0].ownerId, 'central');
  console.log('PASS: isolated persistence, delegation, dates, approval and metadata compatibility.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
