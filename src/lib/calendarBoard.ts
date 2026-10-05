import type { Task } from '@/services/mockData';
import type { CalendarSnapshot } from './planning';
import { shiftDay } from './workspaceDisplay';
export type CalendarMode = 'day' | 'three' | 'week' | 'month';
export interface BoardItem { id: string; title: string; day: string; minute: number | null; endMinute: number | null; taskId?: string; url?: string; source: string; companyId?: string; state: string; location?: string; observedAt?: string }
export function calendarDays(date: string, mode: CalendarMode): string[] {
  let start = date; let count = mode === 'day' ? 1 : mode === 'three' ? 3 : 7;
  const d = new Date(date + 'T12:00:00Z');
  if (mode === 'week') start = shiftDay(date, -(d.getUTCDay() + 6) % 7);
  if (mode === 'month') { const first = date.slice(0, 8) + '01'; const weekday = new Date(first + 'T12:00:00Z').getUTCDay(); start = shiftDay(first, -(weekday + 6) % 7); count = 42; }
  return Array.from({ length: count }, (_, i) => shiftDay(start, i));
}
function minuteOf(time: string) { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; }
function instantParts(at: string) { const p = new Intl.DateTimeFormat('en', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at)); const part = (name: string) => p.find(v => v.type === name)!.value; return { day: `${part('year')}-${part('month')}-${part('day')}`, minute: minuteOf(`${part('hour')}:${part('minute')}`) }; }
export function boardItems(tasks: Task[], snapshot: CalendarSnapshot | null): BoardItem[] {
  const items: BoardItem[] = tasks.filter(t => !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation' && (t.workDate || t.isMeeting && t.dueDate)).map(t => { const time = t.isMeeting ? t.meetingTime : t.workSlot === 'Exact' ? t.workTime : ''; const minute = time ? minuteOf(time) : null; return { id: t.id, taskId: t.id, title: t.title, day: t.workDate || t.dueDate.slice(0, 10), minute, endMinute: minute !== null && t.estimatedMinutes ? Math.min(1440, minute + t.estimatedMinutes) : null, companyId: t.companyId, source: t.isMeeting ? 'Reunión local' : 'Tarea', state: t.status }; });
  for (const event of snapshot?.events || []) {
    if (['cancelled', 'removed'].includes(event.status)) continue;
    const start = event.allDay ? { day: event.start.slice(0, 10), minute: null } : instantParts(event.start);
    const end = event.allDay ? { day: event.end.slice(0, 10), minute: null } : instantParts(event.end);
    // Google all-day end is exclusive. Split multi-day events without fabricating another source event.
    for (let day = start.day, n = 0; n < 370 && (event.allDay ? day < end.day : day <= end.day); day = shiftDay(day, 1), n++) {
      if (!event.allDay && day === end.day && end.minute === 0 && day !== start.day) continue;
      items.push({ id: `google:${event.id}:${day}`, title: event.title, day, minute: event.allDay ? null : day === start.day ? start.minute : 0, endMinute: event.allDay ? null : day === end.day ? end.minute : 1440, url: event.url, source: snapshot?.connection === 'oauth-readonly' ? 'Google · lectura propia' : 'Google · lectura anterior', state: event.status, location: event.location, observedAt: event.observedAt });
    }
  }
  return items;
}
export function positionedItems(items: BoardItem[]) {
  const sorted = items.filter(i => i.minute !== null).sort((a, b) => a.minute! - b.minute!); const ends: number[] = [];
  return sorted.map(item => { const start = item.minute!; const end = Math.max(start + 30, item.endMinute || start + 30); let lane = ends.findIndex(v => v <= start); if (lane < 0) lane = ends.length; ends[lane] = end; return { ...item, lane, visualEnd: Math.min(1440, end) }; }).map(item => ({ ...item, lanes: Math.max(1, ends.length) }));
}
