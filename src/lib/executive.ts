import type { Task } from '@/services/mockData';
import { belongsTo } from './personalTasks';
export type DecisionState = 'Preparing' | 'Ready' | 'Decided';
export interface DecisionSnapshot {
  id: string; ownerId: string; companyId: string; projectId: string; question: string;
  alternatives: string[]; evidence: string; sourceUrl: string; missing: string;
  recommendation: string; state: DecisionState; outcome: string; revision: number;
}
export interface Decision extends DecisionSnapshot {
  history: { at: string; actorId: string; reason: string; snapshot: DecisionSnapshot }[];
}
export interface DayPlan {
  id: string; ownerId: string; date: string; availableMinutes: number | null; focusTaskIds: string[]; revision: number;
  history: { at: string; actorId: string; reason: string; availableMinutes: number | null; focusTaskIds: string[]; revision: number }[];
}
export function isActionable(task: Task, tasks: Task[]) {
  return task.validationStatus !== 'NeedsConfirmation' && !task.cancelledAt && task.status !== 'Completed' && task.status !== 'Blocked' && !task.waitingOn && !(task.dependencyIds || []).some(id => { const dependency = tasks.find(t => t.id === id); return !dependency || dependency.cancelledAt || dependency.status !== 'Completed'; });
}
export function capacity(tasks: Task[], ownerId: string, date: string, plan?: DayPlan) {
  const work = tasks.filter(t => belongsTo(t, ownerId) && t.workDate === date && !t.isMeeting && isActionable(t, tasks));
  const known = work.filter(t => typeof t.estimatedMinutes === 'number');
  const planned = known.reduce((sum, t) => sum + t.estimatedMinutes!, 0);
  const available = plan?.availableMinutes ?? null;
  return { planned, unknown: work.length - known.length, available, remaining: available === null ? null : available - planned };
}
export const decisionLabels: Record<DecisionState, string> = { Preparing: 'Por preparar', Ready: 'Lista para revisar', Decided: 'Decidida' };
