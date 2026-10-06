import type { Task } from '@/services/mockData';
import { validDate } from './personalTasks';
export const PANAMA = 'America/Panama';
export interface CalendarEvent {
  id: string; calendarId: string; title: string; start: string; end: string;
  status: 'confirmed' | 'tentative' | 'cancelled' | 'removed'; url: string; allDay: boolean; observedAt: string;
  location?: string;
}
export interface CalendarSnapshot {
  ownerId?: string; provider: 'google'; calendarId: string; verifiedAt: string; windowStart: string; windowEnd: string;
  connection: 'snapshot-only' | 'oauth-readonly'; events: CalendarEvent[];
}
export interface Reminder {
  id: string; ownerId: string; taskIds: string[]; at: string; timezone: 'America/Panama';
  state: 'Scheduled' | 'Inbox' | 'Acknowledged' | 'Cancelled' | 'ExternalLinked';
  channel: 'in-app' | 'chatgpt'; externalId?: string; verifiedAt?: string; externalEnabled?: boolean;
  flexible?: boolean; deliveredAt?: string; acknowledgedAt?: string; reason?: string;
  createdAt: string; history: { at: string; actorId: string; action: string; reason: string }[];
  workDateAtScheduling?: string;
}
export function activeWork(task: Task): boolean {
  return !task.cancelledAt && task.validationStatus !== 'NeedsConfirmation' && task.status !== 'Completed';
}
export function instant(value: unknown): string {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Indica fecha y hora con zona horaria explícita.');
  return new Date(value).toISOString();
}
export function panamaDate(value: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PANAMA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
export function eventDay(event: CalendarEvent): string { return event.allDay ? event.start.slice(0, 10) : panamaDate(event.start); }
function escapeIcs(text: string) { return text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
function fold(line: string): string {
  let result = ''; let count = 0;
  for (const char of line) { const bytes = Buffer.byteLength(char); if (count + bytes > 73) { result += '\r\n '; count = 1; } result += char; count += bytes; }
  return result;
}
export function taskCalendar(tasks: Task[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TaskManager//Personal Planning//ES', 'CALSCALE:GREGORIAN'];
  for (const task of tasks.filter(t => activeWork(t) && t.workDate && validDate(t.workDate))) {
    const date = task.workDate!.replace(/-/g, '');
    lines.push('BEGIN:VEVENT', `UID:${escapeIcs(task.id)}@taskmanager.local`, `SEQUENCE:${Number.isInteger(task.revision) && (task.revision || 0) >= 0 ? task.revision : 0}`, `DTSTAMP:${stamp}`, `SUMMARY:${escapeIcs(task.title)}`, 'TRANSP:TRANSPARENT');
    if (task.workTime && task.workSlot === 'Exact') {
      const start = new Date(`${task.workDate}T${task.workTime}:00-05:00`);
      lines.push(`DTSTART:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`);
    } else lines.push(`DTSTART;VALUE=DATE:${date}`);
    lines.push(`DESCRIPTION:${escapeIcs(`Plan de trabajo, no cita confirmada. ${task.workSlot === 'Morning' ? 'Mañana, America/Panama.' : task.workSlot === 'Afternoon' ? 'Tarde, America/Panama.' : task.workSlot === 'Evening' ? 'Noche, America/Panama.' : ''} ${task.nextAction || ''} Sin alarma exportada para evitar duplicar recordatorios.`)}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
