import { randomUUID } from 'node:crypto';
import type { DatabaseSchema } from './mockData';
import type { SessionData } from '@/lib/session';
import { isActionable, type Decision, type DecisionSnapshot } from '@/lib/executive';
import { belongsTo, validDate } from '@/lib/personalTasks';
import { WorkspaceError } from '@/lib/projects';
function text(value: unknown, label: string, required = false, limit = 3000): string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new WorkspaceError(`Revisa ${label}.`);
  return value.trim();
}
function revision(actual: number, expected: unknown) { if (actual !== expected) throw new WorkspaceError('Otra actualización cambió este registro. Recarga antes de guardar.', 409); }
export function executiveCommand(data: DatabaseSchema, actor: SessionData, body: any): unknown {
  const input = body.fields || {}; const reason = text(body.reason || '', 'motivo', true);
  if (body.action === 'saveDayPlan') {
    if (!validDate(input.date)) throw new WorkspaceError('Fecha de trabajo inválida.');
    if (input.availableMinutes !== null && (!Number.isInteger(input.availableMinutes) || input.availableMinutes < 0 || input.availableMinutes > 1440)) throw new WorkspaceError('Capacidad inválida: minutos entre 0 y 1440, o sin definir.');
    const focuses = input.focusTaskIds;
    if (!Array.isArray(focuses) || focuses.length > 3 || new Set(focuses).size !== focuses.length || focuses.some(id => typeof id !== 'string')) throw new WorkspaceError('Elige hasta tres focos distintos.');
    for (const id of focuses) {
      const task = data.tasks.find(t => t.id === id);
      if (!task || !belongsTo(task, actor.personId) || !isActionable(task, data.tasks) || data.projects?.some(p => p.id === task.projectId && p.state !== 'Active')) throw new WorkspaceError('El foco debe ser propio, confirmado, pendiente y sin bloqueos.');
    }
    data.dayPlans ||= [];
    let plan = data.dayPlans.find(p => p.ownerId === actor.personId && p.date === input.date);
    revision(plan?.revision || 0, body.expectedRevision);
    if (!plan) { plan = { id: randomUUID(), ownerId: actor.personId, date: input.date, availableMinutes: null, focusTaskIds: [], revision: 0, history: [] }; data.dayPlans.push(plan); }
    plan.availableMinutes = input.availableMinutes; plan.focusTaskIds = [...focuses]; plan.revision++;
    plan.history.push({ at: new Date().toISOString(), actorId: actor.personId, reason, availableMinutes: plan.availableMinutes, focusTaskIds: [...focuses], revision: plan.revision });
    return plan;
  }
  data.decisions ||= [];
  if (body.action === 'restoreDecision') {
    const current = data.decisions.find(d => d.id === body.id && d.ownerId === actor.personId);
    if (!current) throw new WorkspaceError('Decisión no encontrada.', 404);
    revision(current.revision, body.expectedRevision);
    const old = current.history.find(h => h.snapshot.revision === input.revision)?.snapshot;
    if (!old) throw new WorkspaceError('Revisión no disponible.');
    const restored: Decision = { ...structuredClone(old), revision: current.revision + 1, history: [...current.history] };
    const { history: _history, ...snapshot } = restored;
    restored.history.push({ at: new Date().toISOString(), actorId: actor.personId, reason: 'Restauración: ' + reason, snapshot });
    data.decisions = data.decisions.map(d => d.id === current.id ? restored : d); return restored;
  }
  const current = body.action === 'updateDecision' ? data.decisions.find(d => d.id === body.id && d.ownerId === actor.personId) : undefined;
  if (body.action !== 'createDecision' && !current) throw new WorkspaceError('Decisión no encontrada.', 404);
  if (current) revision(current.revision, body.expectedRevision);
  if (!data.companies.some(c => c.id === input.companyId)) throw new WorkspaceError('Elige una empresa.');
  const projectId = text(input.projectId || '', 'proyecto');
  if (projectId && !data.projects?.some(p => p.id === projectId && p.companyId === input.companyId)) throw new WorkspaceError('El proyecto pertenece a otra empresa.');
  if (!Array.isArray(input.alternatives) || input.alternatives.length > 6) throw new WorkspaceError('Revisa las alternativas.');
  const alternatives = input.alternatives.map((v: unknown) => text(v, 'alternativa', true, 500));
  if (new Set(alternatives).size !== alternatives.length) throw new WorkspaceError('Alternativas duplicadas.');
  const sourceUrl = text(input.sourceUrl || '', 'fuente', false, 1000);
  if (sourceUrl) { let u: URL; try { u = new URL(sourceUrl); } catch { throw new WorkspaceError('Fuente inválida.'); } if (!['https:', 'http:'].includes(u.protocol)) throw new WorkspaceError('Fuente inválida.'); }
  if (!['Preparing', 'Ready', 'Decided'].includes(input.state)) throw new WorkspaceError('Estado de decisión inválido.');
  const record: DecisionSnapshot = { id: current?.id || randomUUID(), ownerId: actor.personId, companyId: input.companyId, projectId, question: text(input.question, 'pregunta', true, 240), alternatives, evidence: text(input.evidence || '', 'evidencia'), sourceUrl, missing: text(input.missing || '', 'información faltante'), recommendation: text(input.recommendation || '', 'recomendación'), outcome: text(input.outcome || '', 'resultado'), state: input.state, revision: (current?.revision || 0) + 1 };
  if (record.state !== 'Preparing' && (alternatives.length < 2 || !record.evidence || record.missing)) throw new WorkspaceError('Para revisar o decidir: dos alternativas, evidencia y ningún faltante pendiente.');
  if (record.state === 'Decided' && !record.outcome) throw new WorkspaceError('Registra el resultado de la decisión.');
  if (record.state !== 'Decided') record.outcome = '';
  const decision: Decision = { ...record, history: [...(current?.history || []), { at: new Date().toISOString(), actorId: actor.personId, reason, snapshot: structuredClone(record) }] };
  if (current) data.decisions = data.decisions.map(d => d.id === current.id ? decision : d); else data.decisions.push(decision);
  return decision;
}
