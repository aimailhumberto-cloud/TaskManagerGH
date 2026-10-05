import type { Task } from '@/services/mockData';
import { taskInView } from './personalTasks';
/** Views of the original step, never another persisted task. */
export type WorkItem = Task & { parentTaskId?: string; stepId?: string };
export function scheduledWork(tasks: Task[]): WorkItem[] {
  return tasks.flatMap(task => {
    if (task.cancelledAt || task.validationStatus === 'NeedsConfirmation') return [task];
    const steps = task.steps.filter(s => s.workDate && !s.cancelled);
    const parent = steps.some(s => s.workDate === task.workDate) ? [] : [task];
    return [...parent, ...steps.map(step => ({ ...task, id: `${task.id}::${step.id}`, parentTaskId: task.id, stepId: step.id, title: step.text, description: `Proyecto: ${task.title}`, type: 'One-shot' as const, steps: [], assigneeId: step.assigneeId || task.assigneeId, status: step.completed ? 'Completed' as const : step.status || 'Pending' as const, workDate: step.workDate, dueDate: step.dueDate || '', nextAction: step.nextAction || `Proyecto: ${task.title}`, waitingOn: step.waitingOn || '', sourceUrl: step.sourceUrl || task.sourceUrl, dependencyIds: [], estimatedMinutes: undefined, workSlot: '' as const, workTime: '', isMeeting: false }))];
  });
}
export function dailyWork(tasks: Task[], day: string): WorkItem[] {
  return scheduledWork(tasks).filter(t => !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation' && (taskInView(t, 'today', day) || t.status === 'Completed' && t.workDate === day));
}
