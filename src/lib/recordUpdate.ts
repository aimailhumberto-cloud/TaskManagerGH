/**
 * Registrar una novedad (fase 1): UNA llamada deja al día todo lo que toca una novedad.
 *   ficha  → entrada en la bitácora del cuerpo + recent_actions + campos (próximo paso, último correo, otros)
 *            + «Estado actual» si se envía
 *   agenda → crea o MUEVE la reunión (misma reunión por id, externalId o mismo título en ±45 días)
 *   tarea  → crea la tarea en la ficha
 * Todo o nada: si una parte falla, lo ya escrito se devuelve a como estaba.
 */
import * as path from 'path';
import { getPanamaDate, getVaultPath, resolveNodeFile, createBrainTask, loadBrainGraph } from './smjBrainService';
import { updateNoteFile, pushRecentAction, readNoteStrict } from './vaultFiles';
import { appendLog, logLine, setState } from './noteLog';
import { listEvents, upsertEvent, AgendaError, addDays } from './agenda';
import { rollbackCurrent } from './journal';
import { actorLabel } from './actor';
import { tr, tw } from './reqLang';

export interface RecordInput {
  nodeId: string;
  summary: string;
  date?: string;
  type?: string;
  source?: string;
  state?: string;
  followup?: { date?: string; action?: string };
  lastEmail?: { subject?: string; date?: string; sender?: string };
  fields?: Record<string, unknown>;
  event?: Record<string, unknown> & { title?: string; date?: string; time?: string; id?: string; externalId?: string; kind?: string };
  task?: { title?: string; dueDate?: string; priority?: 'High' | 'Medium' | 'Low'; description?: string };
}
export type RecordResult = { ok: true; message: string; nodeId: string; file: string; done: string[]; taskId?: string; eventId?: string } | { ok: false; status: number; error: string };

/** Campos que una novedad nunca cambia: identidad, permisos y verificación (eso lo decide una persona). */
const PROTECTED = new Set(['id', 'title', 'type', 'brain_id', 'brain_owner', 'owner', 'visibility', 'shared_with', 'verification_status', 'verified_at', 'verified_by', 'memory_tier', 'relations', 'recent_actions', 'pending_tasks', 'updated_at', 'last_updated_at']);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const fail = (status: number, error: string): RecordResult => ({ ok: false, status, error });

export function recordUpdate(input: RecordInput): RecordResult {
  const summary = String(input.summary || '').trim();
  if (!input.nodeId) return fail(400, tr('nodeId es requerido (id o nombre exacto de la ficha).', 'nodeId is required (id or exact name of the note).'));
  if (summary.length < 3) return fail(400, tr('summary es requerido: qué pasó, en una o dos frases.', 'summary is required: what happened, in one or two sentences.'));
  const today = getPanamaDate().dateStr;
  const date = input.date && DAY.test(input.date) ? input.date : today;
  if (input.followup?.date && !DAY.test(input.followup.date)) return fail(400, tr('followup.date debe ser AAAA-MM-DD.', 'followup.date must be YYYY-MM-DD.'));
  if (input.task && !String(input.task.title || '').trim()) return fail(400, tr('task.title es requerido si envías task.', 'task.title is required when you send task.'));
  const bad = Object.keys(input.fields || {}).filter(k => PROTECTED.has(k) || !/^[a-z][a-z0-9_]{1,60}$/.test(k));
  if (bad.length) return fail(400, tr(`Estos campos no se cambian con una novedad: ${bad.join(', ')}.`, `These fields cannot be changed with an update: ${bad.join(', ')}.`));

  const r = resolveNodeFile(input.nodeId);
  if (!r.ok) return fail(404, r.message);
  const peek = readNoteStrict(r.filePath);
  if (!peek.ok) return fail(409, tr(`La ficha no se puede leer: ${peek.error}`, `The note cannot be read: ${peek.error}`));
  const nodeId = String(peek.frontmatter.id || path.basename(r.filePath, '.md'));
  const title = String(peek.frontmatter.title || path.basename(r.filePath, '.md'));
  const by = actorLabel('Agente');
  const done: string[] = [];

  try {
    // 1. La ficha
    const upd = updateNoteFile(r.filePath, (fm, body) => {
      pushRecentAction(fm, { date, type: input.type || 'nota', summary: summary.slice(0, 500), ...(input.source ? { source: String(input.source).slice(0, 200) } : {}) });
      if (input.followup?.date || input.followup?.action) {
        fm.next_followup_completed = false;
        if (input.followup.date) fm.next_followup_date = input.followup.date;
        if (input.followup.action) fm.next_followup_action = String(input.followup.action).slice(0, 300);
      }
      if (input.lastEmail?.subject) fm.last_email_subject = String(input.lastEmail.subject).slice(0, 300);
      if (input.lastEmail?.date) fm.last_email_date = String(input.lastEmail.date).slice(0, 25);
      if (input.lastEmail?.sender) fm.last_email_sender = String(input.lastEmail.sender).slice(0, 200);
      for (const [k, v] of Object.entries(input.fields || {})) fm[k] = v;
      fm.last_updated_by = by;
      let b = appendLog(body, logLine({ date, type: input.type, summary, source: input.source, by }));
      if (input.state && String(input.state).trim()) b = setState(b, String(input.state).slice(0, 2000));
      return { body: b };
    });
    if (!upd.ok) throw new Error(upd.error);
    done.push(tr(`Ficha «${title}»: novedad en la bitácora${input.followup ? ', próximo paso' : ''}${input.lastEmail ? ', último correo' : ''}${input.state ? ', estado actual' : ''}${input.fields && Object.keys(input.fields).length ? `, ${Object.keys(input.fields).join(', ')}` : ''}`, `Note “${title}”: update in the log${input.followup ? ', next step' : ''}${input.lastEmail ? ', last email' : ''}${input.state ? ', current state' : ''}${input.fields && Object.keys(input.fields).length ? `, ${Object.keys(input.fields).join(', ')}` : ''}`));

    // 2. La agenda (crear o mover)
    let eventId: string | undefined;
    if (input.event) {
      const ev = { kind: 'reunion', ...input.event } as Record<string, any>;
      if (!ev.title || !ev.date) throw new AgendaError('event necesita title y date.');
      if (!ev.notes) ev.notes = `${summary.slice(0, 600)} · ${tw('Ficha', 'Note')}: ${title}`;
      let moved = '';
      if (!ev.id && !ev.externalId) {
        const norm = (v: unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const same = listEvents(getVaultPath()).filter(e => e.repeat === 'none' && e.kind === ev.kind && norm(e.title) === norm(ev.title) && e.date >= addDays(ev.date, -45) && e.date <= addDays(ev.date, 45));
        const target = same.find(e => e.date === ev.date && (e.time || '') === (ev.time || '')) || same.sort((a, b) => Math.abs(Date.parse(a.date) - Date.parse(ev.date)) - Math.abs(Date.parse(b.date) - Date.parse(ev.date)))[0];
        if (target) { ev.id = target.id; if (target.date !== ev.date || (target.time || '') !== (ev.time || '')) moved = `${target.date}${target.time ? ' ' + target.time : ''}`; }
      }
      const saved = upsertEvent(getVaultPath(), ev, by);
      eventId = saved.id;
      done.push(moved ? tr(`Agenda: «${saved.title}» movida de ${moved} a ${saved.date}${saved.time ? ' ' + saved.time : ''}`, `Agenda: “${saved.title}” moved from ${moved} to ${saved.date}${saved.time ? ' ' + saved.time : ''}`) : tr(`Agenda: «${saved.title}» el ${saved.date}${saved.time ? ' a las ' + saved.time : ''}`, `Agenda: “${saved.title}” on ${saved.date}${saved.time ? ' at ' + saved.time : ''}`));
    }

    // 3. La tarea
    let taskId: string | undefined;
    if (input.task) {
      const t = createBrainTask({ title: String(input.task.title).trim(), dueDate: input.task.dueDate, priority: input.task.priority, description: input.task.description || summary, targetNodeId: nodeId });
      if (!t.ok) throw new Error(t.message);
      taskId = t.taskId;
      done.push(tr(`Tarea: «${String(input.task.title).trim()}»${input.task.dueDate ? ' para el ' + input.task.dueDate : ''}`, `Task: “${String(input.task.title).trim()}”${input.task.dueDate ? ' due ' + input.task.dueDate : ''}`));
    }
    loadBrainGraph(); // refresca el índice para la siguiente lectura
    return { ok: true, message: tr(`Novedad registrada en «${title}».`, `Update recorded in “${title}”.`), nodeId, file: path.relative(getVaultPath(), r.filePath).split(path.sep).join('/'), done, taskId, eventId };
  } catch (e: any) {
    const undone = rollbackCurrent();
    return fail(e instanceof AgendaError ? e.status : 409, `${e?.message || tr('No se pudo registrar.', 'Could not record it.')}${undone ? tr(' No se guardó nada: se devolvieron los cambios.', ' Nothing was saved: the changes were rolled back.') : ''}`);
  }
}
