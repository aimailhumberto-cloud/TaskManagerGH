import type { DatabaseSchema, Task } from '@/services/mockData';
import type { SessionData } from './session';

export interface LegacyAdministration {
  version: 1;
  userId: string;
  personId: string;
  taskIds: string[];
  sourceSha256: string;
  approvedAt: string;
  approvalReference: string;
}
// A private migration policy, never accepted from task forms or exposed in DTOs.
// Administration does not attribute ownership or grant access to another profile.
export function canAdministerLegacyTask(db: DatabaseSchema, actor: SessionData, task: Task): boolean {
  const policy = db.legacyAdministration;
  if (!policy || policy.version !== 1 || policy.userId !== 'usr-5ry71br' || policy.personId !== 'p1wq05qf'
    || actor.userId !== policy.userId || actor.personId !== policy.personId || task.ownerId
    || !/^[a-f0-9]{64}$/.test(policy.sourceSha256) || !policy.approvalReference
    || !Number.isFinite(Date.parse(policy.approvedAt)) || !Array.isArray(policy.taskIds)
    || policy.taskIds.length !== 74 || policy.taskIds.some(id => typeof id !== 'string' || !id)
    || new Set(policy.taskIds).size !== 74 || !policy.taskIds.includes(task.id)) return false;
  const user = db.users.find(u => u.id === actor.userId && u.personId === actor.personId && u.isActive);
  return !!user && db.people.some(p => p.id === actor.personId && p.role === 'Owner');
}
