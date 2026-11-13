/**
 * Agenda del cerebro: reuniones, viajes y eventos (de una vez o recurrentes) que se fusionan con las tareas
 * y los seguimientos en un solo calendario. Hoy los carga la persona o su agente; cuando haya acceso a
 * Outlook / Microsoft 365 entrarán con source 'outlook' por la misma puerta, sin cambiar el calendario.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getSleepDir } from './dotsSleep';
import { atomicWriteFile } from './vaultFiles';

export const EVENT_KINDS = ['reunion', 'viaje', 'evento'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type Repeat = (typeof REPEATS)[number];
export interface AgendaEvent {
  id: string; kind: EventKind; title: string; date: string; endDate?: string; time?: string; endTime?: string;
  location?: string; notes?: string; repeat: Repeat; weekdays?: number[]; until?: string; cancelled?: string[];
  source: string; externalId?: string; createdBy?: string; createdAt: string; updatedAt: string;
}
export interface Occurrence { id: string; eventId: string; layer: 'reuniones' | 'viajes' | 'tareas' | 'seguimientos'; kind: string; title: string; date: string; endDate?: string; time?: string; endTime?: string; location?: string; recurring: boolean; source: string; overdue?: boolean; taskId?: string; detail?: string }
export class AgendaError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const MAX_EVENTS = 2000;

const DAY = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const file = (vaultPath: string) => path.join(getSleepDir(vaultPath), 'agenda.json');
export const listEvents = (vaultPath: string): AgendaEvent[] => { try { const d = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')); return Array.isArray(d.events) ? d.events : []; } catch { return []; } };
function save(vaultPath: string, events: AgendaEvent[]) { atomicWriteFile(file(vaultPath), JSON.stringify({ version: 1, events }, null, 2)); }
const validDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
export const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(day + 'T12:00:00Z').getUTCDay(); // 0 = domingo

/** Crea un evento o cambia uno que existe (por id, o por externalId + source para las sincronizaciones). */
export function upsertEvent(vaultPath: string, input: Record<string, unknown>, by?: string, now = new Date()): AgendaEvent {
  const events = listEvents(vaultPath);
  const source = typeof input.source === 'string' && input.source ? input.source.slice(0, 20) : 'manual';
  const externalId = typeof input.externalId === 'string' && input.externalId ? input.externalId.slice(0, 200) : undefined;
  let ev = (typeof input.id === 'string' && events.find(e => e.id === input.id)) || (externalId && events.find(e => e.externalId === externalId && e.source === source)) || null;
  // Sin id ni externalId: la misma reunión (tipo, título, día y hora) no se crea dos veces; se actualiza la que hay.
  if (!ev && !input.id && !externalId) {
    const norm = (v: unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const kind = typeof input.kind === 'string' ? input.kind : 'reunion';
    ev = events.find(e => e.kind === kind && norm(e.title) === norm(input.title) && e.date === input.date && (e.time || '') === (typeof input.time === 'string' ? input.time : '')) || null;
  }
  const creating = !ev;
  if (typeof input.id === 'string' && input.id && !ev && !externalId) throw new AgendaError('Ese evento no existe.', 404);
  if (!ev) {
    if (events.length >= MAX_EVENTS) throw new AgendaError('La agenda llegó a su límite de eventos.', 409);
    ev = { id: `ev-${crypto.randomBytes(5).toString('hex')}`, kind: 'reunion', title: '', date: '', repeat: 'none', source, externalId, createdBy: by, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  }
  const has = (k: string) => input[k] !== undefined;
  const str = (k: string, max: number) => (typeof input[k] === 'string' ? (input[k] as string).trim().slice(0, max) : '');
  if (has('kind')) { if (!(EVENT_KINDS as readonly string[]).includes(input.kind as string)) throw new AgendaError('kind debe ser reunion, viaje o evento.'); ev.kind = input.kind as EventKind; }
  if (has('title')) ev.title = str('title', 160);
  if (has('date')) { if (!validDay(input.date)) throw new AgendaError('date debe ser AAAA-MM-DD.'); ev.date = input.date; }
  if (has('endDate')) { if (input.endDate === null || input.endDate === '') delete ev.endDate; else { if (!validDay(input.endDate)) throw new AgendaError('endDate debe ser AAAA-MM-DD.'); ev.endDate = input.endDate; } }
  for (const k of ['time', 'endTime'] as const) if (has(k)) { if (input[k] === null || input[k] === '') delete ev[k]; else { if (typeof input[k] !== 'string' || !TIME.test(input[k] as string)) throw new AgendaError(`${k} debe ser HH:MM (24 horas).`); ev[k] = input[k] as string; } }
  if (has('location')) { const v = str('location', 120); if (v) ev.location = v; else delete ev.location; }
  if (has('notes')) { const v = str('notes', 1000); if (v) ev.notes = v; else delete ev.notes; }
  if (has('repeat')) { if (!(REPEATS as readonly string[]).includes(input.repeat as string)) throw new AgendaError('repeat debe ser none, daily, weekly, monthly o yearly.'); ev.repeat = input.repeat as Repeat; }
  if (has('weekdays')) { const w = Array.isArray(input.weekdays) ? Array.from(new Set((input.weekdays as unknown[]).filter((x): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 6))).sort() : []; if (w.length) ev.weekdays = w; else delete ev.weekdays; }
  if (has('until')) { if (input.until === null || input.until === '') delete ev.until; else { if (!validDay(input.until)) throw new AgendaError('until debe ser AAAA-MM-DD.'); ev.until = input.until; } }
  if (!ev.title || ev.title.length < 2) throw new AgendaError('El evento necesita un título.');
  if (!ev.date) throw new AgendaError('El evento necesita una fecha (date).');
  if (ev.endDate && ev.endDate < ev.date) throw new AgendaError('endDate no puede ser anterior a date.');
  if (ev.endDate && addDays(ev.date, 120) < ev.endDate) throw new AgendaError('Un evento no puede durar más de 120 días.');
  if (ev.until && ev.until < ev.date) throw new AgendaError('until no puede ser anterior a date.');
  if (ev.time && ev.endTime && !ev.endDate && ev.endTime <= ev.time) throw new AgendaError('endTime debe ser posterior a time.');
  ev.updatedAt = now.toISOString();
  save(vaultPath, creating ? [...events, ev] : events);
  return ev;
}
export function deleteEvent(vaultPath: string, id: string, onlyDate?: string): boolean {
  const events = listEvents(vaultPath); const ev = events.find(e => e.id === id);
  if (!ev) return false;
  if (onlyDate && ev.repeat !== 'none') { if (!validDay(onlyDate)) throw new AgendaError('date debe ser AAAA-MM-DD.'); ev.cancelled = Array.from(new Set([...(ev.cancelled || []), onlyDate])).slice(-200); save(vaultPath, events); return true; }
  save(vaultPath, events.filter(e => e.id !== id)); return true;
}

/** Días en que empieza cada repetición de un evento dentro de [from, to]. */
export function startsIn(ev: AgendaEvent, from: string, to: string): string[] {
  const span = ev.endDate ? Math.round((Date.parse(ev.endDate) - Date.parse(ev.date)) / 86400000) : 0;
  const first = addDays(from, -span), last = ev.until && ev.until < to ? ev.until : to;
  const out: string[] = []; const skip = new Set(ev.cancelled || []);
  const push = (d: string) => { if (d >= ev.date && d >= first && d <= last && !skip.has(d)) out.push(d); };
  if (ev.repeat === 'none') { push(ev.date); return out; }
  if (ev.repeat === 'daily' || ev.repeat === 'weekly') {
    const days = ev.repeat === 'weekly' ? (ev.weekdays?.length ? ev.weekdays : [weekday(ev.date)]) : null;
    for (let d = ev.date > first ? ev.date : first, i = 0; d <= last && i < 800; d = addDays(d, 1), i++) if (!days || days.includes(weekday(d))) push(d);
    return out;
  }
  const [y0, m0, d0] = ev.date.split('-').map(Number);
  const fy = Number(first.slice(0, 4)), ly = Number(last.slice(0, 4));
  for (let y = Math.max(y0, fy - 1); y <= ly; y++) for (let m = 1; m <= 12; m++) {
    if (ev.repeat === 'yearly' && m !== m0) continue;
    const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d0 > dim) continue; // el 31 no existe en todos los meses: ese mes no se repite
    push(`${y}-${String(m).padStart(2, '0')}-${String(d0).padStart(2, '0')}`);
  }
  return out;
}

export function expandEvents(events: AgendaEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) for (const start of startsIn(ev, from, to)) {
    const span = ev.endDate ? Math.round((Date.parse(ev.endDate) - Date.parse(ev.date)) / 86400000) : 0;
    out.push({ id: `${ev.id}@${start}`, eventId: ev.id, layer: ev.kind === 'viaje' ? 'viajes' : 'reuniones', kind: ev.kind, title: ev.title, date: start, endDate: span ? addDays(start, span) : undefined, time: ev.time, endTime: ev.endTime, location: ev.location, recurring: ev.repeat !== 'none', source: ev.source, detail: ev.notes });
  }
  return out;
}

export interface TaskLike { id: string; title: string; dueDate?: string; isCompleted: boolean; isOverdue: boolean; sourceNodeTitle?: string; sourceType?: string }
export const isFollowup = (t: TaskLike) => /^fu-/.test(t.id);
/** Calendario fusionado: eventos + tareas + seguimientos entre dos fechas, ordenado por día y hora. */
export function mergedAgenda(events: AgendaEvent[], tasks: TaskLike[], from: string, to: string): Occurrence[] {
  const occ = expandEvents(events, from, to);
  for (const t of tasks) {
    const d = (t.dueDate || '').slice(0, 10);
    if (t.isCompleted || !DAY.test(d) || d < from || d > to) continue;
    occ.push({ id: `task@${t.id}`, eventId: t.id, taskId: t.id, layer: isFollowup(t) ? 'seguimientos' : 'tareas', kind: isFollowup(t) ? 'seguimiento' : 'tarea', title: t.title, date: d, recurring: false, source: 'cerebro', overdue: t.isOverdue, detail: t.sourceNodeTitle });
  }
  return occ.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '99').localeCompare(b.time || '99') || a.title.localeCompare(b.title));
}
/** Carga de cada día: cuántas cosas lo tocan (un viaje cuenta en todos sus días). */
export function dayLoads(occ: Occurrence[], from: string, to: string): Record<string, { total: number; reuniones: number; viajes: number; tareas: number; seguimientos: number }> {
  const out: Record<string, { total: number; reuniones: number; viajes: number; tareas: number; seguimientos: number }> = {};
  for (const o of occ) for (let d = o.date > from ? o.date : from, i = 0; d <= (o.endDate || o.date) && d <= to && i < 130; d = addDays(d, 1), i++) {
    const x = (out[d] ||= { total: 0, reuniones: 0, viajes: 0, tareas: 0, seguimientos: 0 }); x.total++; x[o.layer]++;
  }
  return out;
}
