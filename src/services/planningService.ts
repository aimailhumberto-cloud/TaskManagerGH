import { dbService } from './dbService';
import { activeWork, instant, type Reminder, type CalendarSnapshot } from '@/lib/planning';
import type { SessionData } from '@/lib/session';
import { validDate } from '@/lib/personalTasks';
export async function reminderCommand(actor: SessionData, input: any, now = new Date()): Promise<Reminder[]> {
  return dbService.transaction(data => {
    const reminders = data.reminders || [];
    const log = (r: Reminder, action: string, reason: string) => r.history.push({ at: now.toISOString(), actorId: actor.personId, action, reason });
    if (input.action === 'schedule') {
      if (typeof input.id !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(input.id)) throw new Error('Identificador de recordatorio inválido.');
      const at = instant(input.at);
      const task = data.tasks.find(t => t.id === input.taskId && t.ownerId === actor.personId);
      if (!task || !activeWork(task)) throw new Error('Elige una tarea propia confirmada y pendiente.');
      const prior = reminders.find(r => r.id === input.id);
      if (prior) { if (prior.ownerId !== actor.personId || prior.at !== at || prior.taskIds[0] !== task.id || prior.channel !== 'in-app') throw new Error('Identificador usado para otra operación.'); return reminders.filter(r => r.ownerId === actor.personId); }
      if (Date.parse(at) <= now.getTime()) throw new Error('Programa una hora futura.');
      if (reminders.some(r => r.taskIds.includes(task.id) && ['Scheduled', 'Inbox', 'ExternalLinked'].includes(r.state))) throw new Error('La tarea ya tiene un aviso activo o vinculado. Cancela el aviso local anterior; los externos se gestionan en ChatGPT.');
      const reminder: Reminder = { id: input.id, ownerId: actor.personId, taskIds: [task.id], at, timezone: 'America/Panama', channel: 'in-app', state: 'Scheduled', createdAt: now.toISOString(), workDateAtScheduling: task.workDate || '', history: [] };
      log(reminder, 'Programado', 'Aviso dentro de TaskManager; no envío externo.'); reminders.push(reminder); data.reminders = reminders;
    } else if (input.action === 'acknowledge' || input.action === 'cancel') {
      const r = reminders.find(r => r.id === input.id && r.ownerId === actor.personId);
      if (!r || r.channel !== 'in-app') throw new Error('Este aviso se gestiona en su servicio original.');
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!reason || reason.length > 1000) throw new Error('Indica un motivo.');
      const target = input.action === 'cancel' ? 'Cancelled' : 'Acknowledged';
      if (r.state === target) return reminders.filter(r => r.ownerId === actor.personId);
      if (input.action === 'acknowledge' && r.state !== 'Inbox') throw new Error('No hay aviso recibido por reconocer.');
      if (r.state === 'Cancelled' || r.state === 'Acknowledged') throw new Error('El aviso ya está cerrado.');
      r.state = target; r.reason = reason; if (target === 'Acknowledged') r.acknowledgedAt = now.toISOString(); log(r, target, reason);
    } else if (input.action === 'check') {
      for (const r of reminders.filter(r => r.ownerId === actor.personId && r.state === 'Scheduled' && r.channel === 'in-app')) {
        const task = data.tasks.find(t => t.id === r.taskIds[0]);
        if (!task || !activeWork(task) || (task.workDate || '') !== r.workDateAtScheduling) { r.state = 'Cancelled'; log(r, 'Cancelado por cambio de tarea', 'Tarea resuelta, cancelada, no confirmada o reprogramada.'); }
        else if (Date.parse(r.at) <= now.getTime()) { r.state = 'Inbox'; r.deliveredAt = now.toISOString(); log(r, 'Disponible en bandeja', 'Se conserva hasta reconocimiento; no hubo envío externo.'); }
      }
    } else throw new Error('Acción de recordatorio inválida.');
    return reminders.filter(r => r.ownerId === actor.personId);
  });
}
export async function importCalendarSnapshot(snapshot: CalendarSnapshot) {
  if (snapshot.provider !== 'google' || !['snapshot-only', 'oauth-readonly'].includes(snapshot.connection) || snapshot.calendarId !== 'primary' || snapshot.events.length > 1000) throw new Error('Lectura de calendario inválida.');
  instant(snapshot.verifiedAt); instant(snapshot.windowStart); instant(snapshot.windowEnd);
  if (Date.parse(snapshot.windowStart) >= Date.parse(snapshot.windowEnd)) throw new Error('Ventana inválida.');
  if (new Set(snapshot.events.map(e => e.id)).size !== snapshot.events.length) throw new Error('Eventos duplicados.');
  for (const event of snapshot.events) {
    if (event.calendarId !== snapshot.calendarId || typeof event.id !== 'string' || !event.id || typeof event.title !== 'string' || !event.title || typeof event.url !== 'string' || typeof event.allDay !== 'boolean' || !['confirmed', 'tentative', 'cancelled'].includes(event.status)) throw new Error('Evento inválido.');
    if (!event.allDay) { instant(event.start); instant(event.end); }
    else if (!validDate(event.start.slice(0, 10)) || !validDate(event.end.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}(T00:00:00)?$/.test(event.start) || !/^\d{4}-\d{2}-\d{2}(T00:00:00)?$/.test(event.end)) throw new Error('Fecha de evento de día completo inválida.');
    if ((event.allDay && event.start >= event.end) || (!event.allDay && Date.parse(event.start) >= Date.parse(event.end))) throw new Error('Intervalo de evento inválido.');
    if (!/^https:\/\/(www\.|calendar\.)?google\.com\/calendar\//.test(event.url)) throw new Error('Fuente de evento inválida.');
  }
  await dbService.transaction(data => {
    if (data.calendarSnapshot && Date.parse(snapshot.verifiedAt) < Date.parse(data.calendarSnapshot.verifiedAt)) throw new Error('La lectura es anterior a la conservada.');
    data.calendarSnapshot = structuredClone(snapshot);
  });
}
