import type { Task } from '@/services/mockData';

export interface PersonalTaskFields {
  category?: string;
  subcategories?: string[];
  estimatedMinutes?: number;
  workSlot?: 'Morning' | 'Afternoon' | 'Evening' | 'Exact' | '';
  workTime?: string;
  validationStatus?: 'Confirmed' | 'NeedsConfirmation';
  sourceUrl?: string;
  contextNotes?: string;
  projectId?: string;
  deliverableId?: string;
  dependencyIds?: string[];
  cancelledAt?: string;
  revision?: number;
  cancellationReason?: string;
  ownerId?: string;
  projectName?: string;
  nextAction?: string;
  workDate?: string;
  waitingOn?: string;
  commitment?: string;
  followUpDate?: string;
  approvalStatus?: 'NotRequired' | 'Pending' | 'Approved' | 'Rejected';
}
export const personalKeys = ['ownerId', 'projectName', 'nextAction', 'workDate', 'waitingOn', 'commitment', 'followUpDate', 'approvalStatus', 'validationStatus', 'sourceUrl', 'contextNotes', 'workSlot', 'workTime'] as const;
export function pickPersonalFields(source: PersonalTaskFields): PersonalTaskFields {
  return Object.fromEntries(personalKeys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
}

export function personalFields(body: Record<string, unknown>): PersonalTaskFields {
  const result: Record<string, string> = {};
  for (const key of personalKeys) {
    if (body[key] === undefined) continue;
    const value = body[key];
    if (typeof value !== 'string' || value.length > 1000) throw new Error(`Invalid ${key}`);
    if (key === 'approvalStatus' && !['NotRequired', 'Pending', 'Approved', 'Rejected'].includes(value)) throw new Error('Invalid approvalStatus');
    if (key === 'validationStatus' && !['Confirmed', 'NeedsConfirmation'].includes(value)) throw new Error('Invalid validationStatus');
    if (key === 'workSlot' && !['', 'Morning', 'Afternoon', 'Evening', 'Exact'].includes(value)) throw new Error('Invalid workSlot');
    if (key === 'workTime' && value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Invalid workTime');
    if (key === 'sourceUrl' && value) { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid sourceUrl'); }
    if ((key === 'workDate' || key === 'followUpDate') && value && !validDate(value)) throw new Error(`Invalid ${key}`);
    result[key] = value.trim();
  }
  return result as PersonalTaskFields;
}
export function validDate(value: string): boolean {
  const date = new Date(value + 'T12:00:00Z');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function localDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)!.value).join('-');
}
export type PersonalView = 'today' | 'week' | 'waiting' | 'approval' | 'confirmation' | 'all';
export function taskInView(task: Task, view: PersonalView, today: string): boolean {
  if (view === 'all') return true;
  if (view === 'confirmation') return task.validationStatus === 'NeedsConfirmation';
  if (task.validationStatus === 'NeedsConfirmation') return false;
  if (task.cancelledAt) return false;
  if (view === 'approval') return task.approvalStatus === 'Pending';
  if (task.status === 'Completed') return false;
  if (view === 'waiting') return task.status === 'Blocked' || !!task.waitingOn;
  const due = task.dueDate?.slice(0, 10);
  if (view === 'today') return task.workDate === today || (!!due && due <= today) || (!!task.followUpDate && task.followUpDate <= today);
  const day = new Date(today + 'T12:00:00Z');
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  const start = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  const end = day.toISOString().slice(0, 10);
  return [task.workDate, due, task.followUpDate].some(date => !!date && date >= start && date <= end) || (!!due && due < start);
}
export function belongsTo(task: Task, personId: string): boolean {
  return !!personId && (task.ownerId === personId || task.assigneeId === personId || !!task.assigneeIds?.includes(personId));
}
