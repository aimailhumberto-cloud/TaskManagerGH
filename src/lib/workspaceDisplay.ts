import type { Task } from '@/services/mockData';
import { localDay } from './personalTasks';

export function taskState(task: Task): string {
  if (task.cancelledAt) return 'Cancelada';
  if (task.validationStatus === 'NeedsConfirmation') return 'Por confirmar';
  if (task.status === 'Completed') return 'Completada';
  if (task.status === 'In Progress') return 'En curso';
  if (task.status === 'Blocked') return 'Bloqueada';
  if (task.waitingOn) return 'Esperando';
  return 'Pendiente';
}

export function taskTime(task: Task): string {
  if (task.isMeeting) return task.meetingTime || 'Hora por definir';
  return task.workSlot === 'Exact'
    ? task.workTime || 'Hora por definir'
    : ({ Morning: 'Mañana', Afternoon: 'Tarde', Evening: 'Noche' }[task.workSlot as string] || 'Sin hora');
}

export function shiftDay(day: string, amount: number) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

export function todayInPanama() {
  return localDay(new Date(), 'America/Panama');
}

export function shortDate(day: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(day + 'T12:00:00Z')
  );
}
