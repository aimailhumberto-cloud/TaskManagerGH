import { randomUUID, createHash } from 'crypto';
import {
  isPublicTaskActor,
  publicTaskActor,
  publicTaskWritable,
  assertPublicTaskCommand,
  type PublicTaskActor,
} from '@/lib/publicTaskScope';
import { HB_CANONICAL_COMPANIES, ensureDefaultHbMeetings } from '@/lib/hbCompanies';
type TaskActor = SessionData | PublicTaskActor;
import { dbService } from './dbService';
import type { DatabaseSchema, Task } from './mockData';
import type { SessionData } from '@/lib/session';
import { personalFields, validDate, localDay } from '@/lib/personalTasks';
import { WorkspaceError, Project, ProjectSnapshot, assertNoCycles, nextOccurrence } from '@/lib/projects';
import { executiveCommand } from './executiveCommands';
import { responsiblePeople } from '@/lib/workspaceLayers';
import { layerActions, layerCommand } from './workspaceLayerCommands';
import { canWriteTask } from '@/lib/publicWorkspace';
import { canAdministerLegacyTask } from '@/lib/legacyAdministration';

function text(value: unknown, label: string, required = false, limit = 2000): string {
  if (typeof value !== 'string' || value.length > limit || (required && !value.trim()))
    throw new WorkspaceError(`Revisa ${label}.`);
  return value.trim();
}
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string') || new Set(value).size !== value.length)
    throw new WorkspaceError('Lista de referencias inválida.');
  return value;
}
function date(value: unknown): string {
  const result = text(value, 'fecha');
  if (result && !validDate(result)) throw new WorkspaceError('Fecha inválida.');
  return result;
}
function snapshot(project: Project): ProjectSnapshot {
  const { history: _history, ...current } = project;
  return structuredClone(current);
}
function record(project: Project, actor: { personId: string; access?: string }, action: string, reason: string) {
  project.history.push({
    revision: project.revision,
    at: new Date().toISOString(),
    actorId: actor.access === 'public-hb-tasks' ? 'public-hb:' + actor.personId : actor.personId,
    action,
    reason,
    snapshot: snapshot(project),
  });
}
function projectFor(data: DatabaseSchema, id: unknown): Project {
  const project = data.projects?.find(p => p.id === id);
  if (!project) throw new WorkspaceError('Proyecto no encontrado.', 404);
  return project;
}
function requireRevision(actual: number, requested: unknown) {
  if (actual !== requested)
    throw new WorkspaceError('Otra actualización cambió este registro. Recarga antes de guardar.', 409);
}
function assertTaskLinks(data: DatabaseSchema, task: Task, legacyPrevious?: Task) {
  const preservedEmptyCompany = !!legacyPrevious && !legacyPrevious.companyId && !task.companyId;
  const preservedEmptyAssignee = !!legacyPrevious && !legacyPrevious.assigneeId && !task.assigneeId;
  const preservedOwner = !!legacyPrevious && !legacyPrevious.ownerId && !task.ownerId;
  if (
    (!preservedEmptyCompany && !data.companies.some(c => c.id === task.companyId)) ||
    (!preservedEmptyAssignee && !responsiblePeople(data).some(p => p.id === task.assigneeId)) ||
    (!preservedOwner && !data.people.some(p => p.id === task.ownerId))
  )
    throw new WorkspaceError('Negocio o responsable no disponible.');
  if (task.projectId) {
    const project = projectFor(data, task.projectId);
    if (project.companyId !== task.companyId)
      throw new WorkspaceError('La tarea y el proyecto deben pertenecer al mismo negocio.');
    if (task.deliverableId && !project.deliverables.some(d => d.id === task.deliverableId))
      throw new WorkspaceError('El entregable no pertenece al proyecto.');
  } else if (task.deliverableId) throw new WorkspaceError('Elige un proyecto para vincular el entregable.');
  for (const id of task.dependencyIds || []) {
    const dependency = data.tasks.find(t => t.id === id);
    if (!dependency || dependency.companyId !== task.companyId)
      throw new WorkspaceError('Dependencia de tarea inválida para este negocio.');
  }
  assertNoCycles(data.tasks.map(t => (t.id === task.id ? task : t)));
}

function mutateTask(
  data: DatabaseSchema,
  actor: TaskActor,
  body: any,
  provenance?: Task['activityLog'][number]['provenance']
): unknown {
  const reason = text(body.reason || '', 'motivo');
  const input = body.fields || {};
  if (isPublicTaskActor(actor)) {
    for (const canonical of HB_CANONICAL_COMPANIES) {
      if (!data.companies.some(c => c.id === canonical.id)) {
        data.companies.push({ id: canonical.id, name: canonical.name });
      }
    }
  } else {
    for (const canonical of HB_CANONICAL_COMPANIES) {
      if (input.companyId === canonical.id && !data.companies.some(c => c.id === canonical.id)) {
        data.companies.push({ id: canonical.id, name: canonical.name });
      }
    }
  }
  if (body.action === 'createCompany') {
    const name = text(input.name || input.title, 'nombre de empresa', true, 120);
    const slug =
      'business-' +
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const id = data.companies.some(c => c.id === slug) ? `${slug}-${randomUUID().slice(0, 6)}` : slug;
    data.companies.push({ id, name });
    return { id, revision: 1 };
  }
  if (body.action === 'updateCompany') {
    const name = text(input.name || input.title, 'nombre de empresa', true, 120);
    const existing = data.companies.find(c => c.id === body.id);
    if (existing) existing.name = name;
    else data.companies.push({ id: String(body.id), name });
    return { id: String(body.id), revision: 1 };
  }
  if (body.action === 'deleteCompany') {
    const targetId = String(body.id || '');
    data.companies = data.companies.filter(c => c.id !== targetId);
    return { id: targetId, revision: 1 };
  }
  if (body.action === 'updateTask' && isPublicTaskActor(actor) && !data.tasks.some(t => t.id === body.id)) {
    const seeded = ensureDefaultHbMeetings([], actor.personId).find(t => t.id === body.id);
    if (seeded) {
      for (const canonical of HB_CANONICAL_COMPANIES)
        if (seeded.companyId === canonical.id && !data.companies.some(c => c.id === canonical.id))
          data.companies.push({ id: canonical.id, name: canonical.name });
      data.tasks.push(seeded);
    }
  }
  if (body.action === 'createTask' || body.action === 'updateTask') {
    let task: Task;
    let previous: Task | undefined;
    const personal = personalFields(input);
    if (body.action === 'createTask') {
      task = {
        id: randomUUID(),
        title: text(input.title, 'título', true, 240),
        description: '',
        type: 'One-shot',
        steps: [],
        companyId: input.companyId,
        assigneeId: input.assigneeId || actor.personId,
        ownerId: actor.personId,
        assigneeIds: [input.assigneeId || actor.personId],
        status: 'Pending',
        priority: 'Medium',
        origin: 'Manual',
        dueDate: '',
        attachments: [],
        activityLog: [],
        revision: 1,
        ...personal,
      };
      data.tasks.push(task);
    } else {
      previous = data.tasks.find(t => t.id === body.id);
      if (!previous) throw new WorkspaceError('Tarea no encontrada.', 404);
      if (!(isPublicTaskActor(actor) ? publicTaskWritable(data, actor, previous) : canWriteTask(data, actor, previous)))
        throw new WorkspaceError(
          'La propiedad o administración de esta tarea requiere validación antes de modificarla.',
          403
        );
      if (!isPublicTaskActor(actor)) requireRevision(previous.revision || 0, body.expectedRevision);
      if (isPublicTaskActor(actor)) {
        if (previous.companyId === 'business-ia-para-todos') previous.companyId = 'business-bee-smart';
        if (previous.companyId === 'business-surf-unassigned') previous.companyId = 'business-academia-surf';
      }
      task = structuredClone(previous);
      Object.assign(task, personal);
      task.revision = (previous.revision || 0) + 1;
    }
    if (input.title !== undefined) task.title = text(input.title, 'título', true, 240);
    if (input.description !== undefined) task.description = text(input.description, 'objetivo');
    if (input.category !== undefined) task.category = text(input.category, 'categoría', false, 120);
    if (input.subcategories !== undefined) {
      if (!Array.isArray(input.subcategories) || input.subcategories.length > 12)
        throw new WorkspaceError('Revisa las subcategorías.');
      task.subcategories = input.subcategories.map((v: unknown) => text(v, 'subcategoría', true, 120));
      if (new Set(task.subcategories).size !== task.subcategories!.length)
        throw new WorkspaceError('Subcategorías duplicadas.');
    }
    if (input.type !== undefined) {
      if (!['One-shot', 'Project', 'Repetitive'].includes(input.type))
        throw new WorkspaceError('Tipo de trabajo inválido.');
      if (input.type === 'Project' && task.repeatPattern)
        throw new WorkspaceError('Quita la repetición antes de convertir en proyecto.');
      task.type = input.type;
    }
    if (input.companyId !== undefined)
      task.companyId = text(
        input.companyId,
        'negocio',
        !(
          previous &&
          (isPublicTaskActor(actor)
            ? publicTaskWritable(data, actor, previous)
            : canAdministerLegacyTask(data, actor, previous)) &&
          !previous.companyId &&
          input.companyId === ''
        )
      );
    if (input.assigneeId !== undefined) {
      const nextAssignee = text(
        input.assigneeId,
        'ejecutor',
        !(
          previous &&
          (isPublicTaskActor(actor)
            ? publicTaskWritable(data, actor, previous)
            : canAdministerLegacyTask(data, actor, previous)) &&
          !previous.assigneeId &&
          input.assigneeId === ''
        )
      );
      if (task.assigneeId !== nextAssignee) task.assigneeIds = nextAssignee ? [nextAssignee] : [];
      task.assigneeId = nextAssignee;
    }
    if (input.estimatedMinutes !== undefined) {
      if (
        input.estimatedMinutes !== null &&
        (!Number.isInteger(input.estimatedMinutes) || input.estimatedMinutes < 1 || input.estimatedMinutes > 1440)
      )
        throw new WorkspaceError('Estimación: minutos entre 1 y 1440, o sin definir.');
      task.estimatedMinutes = input.estimatedMinutes === null ? undefined : input.estimatedMinutes;
    }
    if (input.priority !== undefined) {
      if (!['High', 'Medium', 'Low'].includes(input.priority)) throw new WorkspaceError('Prioridad inválida.');
      task.priority = input.priority;
    }
    if (input.projectId !== undefined) task.projectId = text(input.projectId, 'proyecto');
    if (input.deliverableId !== undefined) task.deliverableId = text(input.deliverableId, 'entregable');
    if (input.dependencyIds !== undefined) task.dependencyIds = ids(input.dependencyIds);
    if (input.dueDate !== undefined)
      task.dueDate =
        previous && (input.dueDate === previous.dueDate || input.dueDate === previous.dueDate.slice(0, 10))
          ? previous.dueDate
          : date(input.dueDate);
    if (input.steps !== undefined) {
      if (
        !Array.isArray(input.steps) ||
        input.steps.length > 100 ||
        input.steps.some(
          (s: any) =>
            typeof s.id !== 'string' || typeof s.text !== 'string' || !s.text.trim() || typeof s.completed !== 'boolean'
        ) ||
        new Set(input.steps.map((s: any) => s.id)).size !== input.steps.length
      )
        throw new WorkspaceError('Subtareas inválidas.');
      if (
        !isPublicTaskActor(actor) &&
        previous &&
        input.steps.some((s: any) => !!s.cancelled !== !!previous!.steps.find(p => p.id === s.id)?.cancelled) &&
        !reason
      )
        throw new WorkspaceError('Explica la cancelación o reactivación del paso.');
      task.steps = input.steps.map((s: any) => {
        const oldStep = previous?.steps.find(p => p.id === s.id);
        if (s.status !== undefined && !['Pending', 'In Progress', 'Completed', 'Blocked'].includes(s.status))
          throw new WorkspaceError('Estado de paso inválido.');
        if (s.assigneeId && !responsiblePeople(data).some(p => p.id === s.assigneeId))
          throw new WorkspaceError('Responsable del paso no disponible.');
        if (s.cancelled !== undefined && typeof s.cancelled !== 'boolean')
          throw new WorkspaceError('Cancelación del paso inválida.');
        const url = text(s.sourceUrl || '', 'fuente del paso');
        if (url) {
          try {
            if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error();
          } catch {
            throw new WorkspaceError('Fuente de paso inválida.');
          }
        }
        return {
          ...oldStep,
          id: s.id,
          text: text(s.text, 'paso', true),
          completed: s.completed,
          status:
            s.completed && s.status === 'Blocked'
              ? 'Blocked'
              : s.completed
                ? 'Completed'
                : s.status === 'Completed'
                  ? 'Pending'
                  : s.status || 'Pending',
          assigneeId: s.assigneeId || '',
          workDate: date(s.workDate || ''),
          dueDate:
            oldStep?.dueDate && (s.dueDate === oldStep.dueDate || s.dueDate === oldStep.dueDate.slice(0, 10))
              ? oldStep.dueDate
              : date(s.dueDate || ''),
          nextAction: text(s.nextAction || '', 'siguiente acción de paso'),
          waitingOn: text(s.waitingOn || '', 'espera del paso'),
          dependencyIds: ids(s.dependencyIds || []),
          evidence: text(s.evidence || '', 'evidencia'),
          sourceUrl: url,
          cancelled: s.cancelled || false,
        };
      });
      assertNoCycles(task.steps);
      if (!isPublicTaskActor(actor)) {
        for (const step of task.steps)
          if (
            step.completed &&
            !step.cancelled &&
            (step.status === 'Blocked' ||
              step.waitingOn ||
              step.dependencyIds?.some(id => !task.steps.some(s => s.id === id && s.completed && !s.cancelled)))
          )
            throw new WorkspaceError('Resuelve los bloqueos y dependencias antes de completar el paso.');
      }
    }
    if (input.repeatPattern !== undefined) {
      if (!['', 'Daily', 'Weekly', 'Monthly'].includes(input.repeatPattern))
        throw new WorkspaceError('Repetición inválida.');
      task.repeatPattern = input.repeatPattern || null;
      task.type = input.repeatPattern ? 'Repetitive' : task.type === 'Project' ? 'Project' : 'One-shot';
    }
    if (input.isMeeting !== undefined) {
      if (typeof input.isMeeting !== 'boolean') throw new WorkspaceError('Tipo de reunión inválido.');
      task.isMeeting = input.isMeeting;
    }
    if (input.meetingTime !== undefined) {
      const value = text(input.meetingTime, 'hora de reunión');
      if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new WorkspaceError('Hora inválida.');
      task.meetingTime = value;
    }
    if (input.cancelled !== undefined) {
      const whyCancel = reason || (isPublicTaskActor(actor) ? 'Cambio de estado por HB' : '');
      if (typeof input.cancelled !== 'boolean' || !whyCancel)
        throw new WorkspaceError('Indica el motivo de cancelar o reactivar.');
      task.cancelledAt = input.cancelled ? new Date().toISOString() : '';
      task.cancellationReason = input.cancelled ? whyCancel : '';
    }
    if (input.status !== undefined) {
      if (!['Pending', 'In Progress', 'Completed', 'Blocked'].includes(input.status))
        throw new WorkspaceError('Avance inválido.');
      task.status = input.status;
      if (isPublicTaskActor(actor)) {
        task.validationStatus = 'Confirmed';
        if (input.cancelled !== true && task.cancelledAt) {
          task.cancelledAt = '';
          task.cancellationReason = '';
        }
        if (input.status === 'Completed') {
          task.waitingOn = '';
          task.steps = (task.steps || []).map(s => (s.cancelled ? s : { ...s, completed: true, status: 'Completed' }));
        }
      }
    }
    task.ownerId = previous ? previous.ownerId : actor.personId;
    assertTaskLinks(
      data,
      task,
      previous &&
        (isPublicTaskActor(actor)
          ? publicTaskWritable(data, actor, previous)
          : canAdministerLegacyTask(data, actor, previous))
        ? previous
        : undefined
    );
    if (task.projectId) task.projectName = projectFor(data, task.projectId).title;
    if (input.status === 'Completed' && previous?.status !== 'Completed') {
      if (!isPublicTaskActor(actor)) {
        if (task.projectId && projectFor(data, task.projectId).state !== 'Active')
          throw new WorkspaceError('Reactiva el proyecto antes de completar trabajo.');
        if (task.cancelledAt) throw new WorkspaceError('Reactiva la tarea antes de completarla.');
        if (task.type === 'Project' && !task.steps.length)
          throw new WorkspaceError('Define los pasos del proyecto antes de cerrarlo.');
        if (task.steps.some(s => !s.completed && !s.cancelled))
          throw new WorkspaceError('Quedan subtareas pendientes.');
        if (task.waitingOn || task.status === 'Blocked')
          throw new WorkspaceError('Resuelve la espera antes de completar.');
        if (
          (task.dependencyIds || []).some(
            id =>
              data.tasks.find(t => t.id === id)?.status !== 'Completed' ||
              data.tasks.find(t => t.id === id)?.cancelledAt
          )
        )
          throw new WorkspaceError('Quedan dependencias pendientes.');
      }
      if (task.repeatPattern) {
        const completed = task.workDate || localDay(new Date(), 'America/Panama');
        task.completedDays = [...(task.completedDays || []), completed];
        task.workDate = nextOccurrence(completed, task.repeatPattern);
        if (task.dueDate) task.dueDate = nextOccurrence(task.dueDate.slice(0, 10), task.repeatPattern);
        task.status = 'Pending';
        task.steps = task.steps.map(s => ({ ...s, completed: false }));
      }
    }
    const changed = Object.keys(input).filter(
      key => JSON.stringify((previous as any)?.[key]) !== JSON.stringify((task as any)[key])
    );
    if (body.action === 'createTask' && task.projectId && projectFor(data, task.projectId).state !== 'Active')
      throw new WorkspaceError('Reactiva el proyecto antes de añadir trabajo.');
    const { activityLog: _log, ...saved } = task;
    task.activityLog.push({
      timestamp: new Date().toISOString(),
      user: isPublicTaskActor(actor) ? 'Acceso público · espacio HB' : actor.personId,
      type: 'User',
      revision: task.revision,
      snapshot: structuredClone(saved),
      changes: changed.map(field => ({ field, before: (previous as any)?.[field], after: (task as any)[field] })),
      ...(provenance ? { provenance } : {}),
      action: `${body.action === 'createTask' ? 'Tarea creada' : 'Tarea actualizada'}: ${changed.join(', ')}${
        reason ? ` · ${reason}` : ''
      }`,
    });
    data.tasks = data.tasks.map(t => (t.id === task.id ? task : t));
    reopenLinkedDeliverable(data, task, actor);
    return task;
  }
  throw new WorkspaceError('Acción de tarea no reconocida.');
}

function mutate(data: DatabaseSchema, actor: SessionData, body: any): unknown {
  data.projects ||= [];
  data.appliedOperations ||= [];
  if (['saveDayPlan', 'createDecision', 'updateDecision', 'restoreDecision'].includes(body.action))
    return executiveCommand(data, actor, body);
  const reason = text(body.reason || '', 'motivo');
  const input = body.fields || {};
  let provenance: Task['activityLog'][number]['provenance'];
  if (body.provenance !== undefined) {
    const p = body.provenance;
    if (
      !p ||
      !['chat', 'voice'].includes(p.channel) ||
      !['UserInstruction', 'Email', 'WhatsApp', 'Calendar', 'Document'].includes(p.sourceKind)
    )
      throw new WorkspaceError('Procedencia inválida.');
    const sourceUrl = text(p.sourceUrl || '', 'fuente de instrucción');
    if (sourceUrl) {
      try {
        if (!['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw new Error();
      } catch {
        throw new WorkspaceError('Fuente de instrucción inválida.');
      }
    }
    const observedAt = text(p.observedAt || '', 'fecha de lectura');
    if (observedAt && (!/(Z|[+-]\d{2}:\d{2})$/.test(observedAt) || !Number.isFinite(Date.parse(observedAt))))
      throw new WorkspaceError('Fecha de lectura inválida.');
    provenance = {
      channel: p.channel,
      instruction: text(p.instruction, 'instrucción de Humberto', true),
      sourceKind: p.sourceKind,
      sourceUrl,
      observedAt,
    };
  }
  if (layerActions.includes(body.action)) return layerCommand(data, actor, body, provenance);
  if (body.action === 'restoreTask') {
    const existing = data.tasks.find(t => t.id === body.id);
    if (!existing) throw new WorkspaceError('Tarea no encontrada.', 404);
    if (!canWriteTask(data, actor, existing))
      throw new WorkspaceError(
        'La propiedad o administración de esta tarea requiere validación antes de modificarla.',
        403
      );
    requireRevision(existing.revision || 0, body.expectedRevision);
    const saved = existing.activityLog.find(log => log.revision === input.revision)?.snapshot;
    if (!saved || !reason) throw new WorkspaceError('Elige una revisión y explica la restauración.');
    const restored: Task = {
      ...structuredClone(saved),
      id: existing.id,
      ownerId: existing.ownerId,
      activityLog: [...existing.activityLog],
      revision: (existing.revision || 0) + 1,
    };
    assertTaskLinks(data, restored, canAdministerLegacyTask(data, actor, existing) ? restored : undefined);
    if (
      restored.status === 'Completed' &&
      (restored.dependencyIds || []).some(id => data.tasks.find(t => t.id === id)?.status !== 'Completed')
    )
      throw new WorkspaceError('La revisión tiene dependencias actualmente pendientes.', 409);
    const { activityLog: _log, ...savedAgain } = restored;
    restored.activityLog.push({
      timestamp: new Date().toISOString(),
      user: actor.personId,
      type: 'User',
      action: `Restaurada revisión ${input.revision} · ${reason}`,
      revision: restored.revision,
      snapshot: savedAgain,
      ...(provenance ? { provenance } : {}),
    });
    data.tasks = data.tasks.map(t => (t.id === restored.id ? restored : t));
    reopenLinkedDeliverable(data, restored, actor);
    return restored;
  }
  if (body.action === 'createProject') {
    if (!data.companies.some(c => c.id === input.companyId)) throw new WorkspaceError('Elige un negocio válido.');
    const project: Project = {
      id: randomUUID(),
      companyId: input.companyId,
      title: text(input.title, 'nombre', true, 240),
      objective: text(input.objective, 'objetivo', true),
      scope: text(input.scope || '', 'alcance'),
      ownerId: actor.personId,
      acceptancePersonId: actor.personId,
      state: 'Active',
      revision: 1,
      stages: [],
      deliverables: [],
      milestones: [],
      evidence: [],
      history: [],
    };
    record(project, actor, 'Proyecto creado', reason);
    data.projects.push(project);
    return project;
  }
  if (['createTask', 'updateTask', 'createCompany', 'updateCompany', 'deleteCompany'].includes(body.action))
    return mutateTask(data, actor, body, provenance);
  const project = projectFor(data, body.id);
  if (!data.people.some(p => p.id === project.ownerId))
    throw new WorkspaceError('La propiedad de este proyecto requiere validación.', 403);
  requireRevision(project.revision, body.expectedRevision);
  if (project.state === 'Cancelled' && !['updateProject', 'restoreProject'].includes(body.action))
    throw new WorkspaceError('Reactiva el proyecto antes de añadir trabajo.');
  if (project.state === 'Completed' && body.action === 'addDeliverable')
    throw new WorkspaceError('Reabre el proyecto antes de ampliar sus entregables.');
  switch (body.action) {
    case 'updateProject':
      if (!reason) throw new WorkspaceError('Explica el motivo de la revisión.');
      for (const key of ['title', 'objective', 'scope'] as const)
        if (input[key] !== undefined) project[key] = text(input[key], key, key !== 'scope');
      if (input.state !== undefined) {
        if (!['Active', 'Paused', 'Completed', 'Cancelled'].includes(input.state))
          throw new WorkspaceError('Estado inválido.');
        if (
          input.state === 'Completed' &&
          (!project.deliverables.some(d => d.state !== 'Cancelled') ||
            project.deliverables.some(d => !['Accepted', 'Cancelled'].includes(d.state)) ||
            data.tasks.some(t => t.projectId === project.id && t.status !== 'Completed' && !t.cancelledAt))
        )
          throw new WorkspaceError('Quedan entregables o tareas por resolver antes de cerrar el proyecto.');
        project.state = input.state;
      }
      break;
    case 'addStage':
      project.stages.push({ id: randomUUID(), title: text(input.title, 'etapa', true, 240) });
      break;
    case 'updateStage': {
      const stage = project.stages.find(s => s.id === input.stageId);
      if (!stage || !reason) throw new WorkspaceError('Elige una etapa y explica el cambio.');
      stage.title = text(input.title, 'etapa', true, 240);
      break;
    }
    case 'addDeliverable':
      if (!project.stages.some(s => s.id === input.stageId)) throw new WorkspaceError('Elige una etapa.');
      project.deliverables.push({
        id: randomUUID(),
        title: text(input.title, 'entregable', true, 240),
        stageId: input.stageId,
        criteria: text(input.criteria, 'criterio de aceptación', true),
        state: 'Draft',
        evidenceIds: [],
        dependencyIds: [],
        dueDate: date(input.dueDate || ''),
      });
      break;
    case 'addMilestone': {
      const linked = ids(input.deliverableIds);
      if (!linked.length || linked.some(id => !project.deliverables.some(d => d.id === id)))
        throw new WorkspaceError('Vincula entregables existentes al hito.');
      project.milestones.push({
        id: randomUUID(),
        title: text(input.title, 'hito', true, 240),
        deliverableIds: linked,
      });
      break;
    }
    case 'updateMilestone': {
      const milestone = project.milestones.find(m => m.id === input.milestoneId);
      const linked = ids(input.deliverableIds);
      if (!milestone || !reason || !linked.length || linked.some(id => !project.deliverables.some(d => d.id === id)))
        throw new WorkspaceError('Revisa el hito, sus entregables y el motivo.');
      milestone.title = text(input.title, 'hito', true, 240);
      milestone.deliverableIds = linked;
      break;
    }
    case 'addEvidence': {
      const url = text(input.url || '', 'enlace');
      const note = text(input.note || '', 'nota');
      if (!url && !note) throw new WorkspaceError('Añade una nota o enlace como evidencia.');
      if (url) {
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
          throw new WorkspaceError('El enlace debe usar http o https.');
        }
      }
      const evidence = {
        id: randomUUID(),
        title: text(input.title, 'evidencia', true, 240),
        note,
        url,
        createdAt: new Date().toISOString(),
        createdBy: actor.personId,
      };
      project.evidence.push(evidence);
      if (input.deliverableId) {
        const deliverable = project.deliverables.find(d => d.id === input.deliverableId);
        if (!deliverable) throw new WorkspaceError('Entregable no encontrado.');
        deliverable.evidenceIds.push(evidence.id);
      }
      break;
    }
    case 'updateDeliverable': {
      const deliverable = project.deliverables.find(d => d.id === input.deliverableId);
      if (!deliverable) throw new WorkspaceError('Entregable no encontrado.', 404);
      if (!reason) throw new WorkspaceError('Indica el motivo de la decisión o cambio.');
      const wasAccepted = deliverable.state === 'Accepted';
      const changedAcceptanceBasis =
        (input.title !== undefined && input.title !== deliverable.title) ||
        (input.criteria !== undefined && input.criteria !== deliverable.criteria) ||
        (input.dependencyIds !== undefined &&
          JSON.stringify(input.dependencyIds) !== JSON.stringify(deliverable.dependencyIds));
      for (const key of ['title', 'criteria'] as const)
        if (input[key] !== undefined) deliverable[key] = text(input[key], key, true);
      if (input.stageId !== undefined) {
        if (!project.stages.some(s => s.id === input.stageId)) throw new WorkspaceError('Elige una etapa válida.');
        deliverable.stageId = input.stageId;
      }
      if (input.dueDate !== undefined) deliverable.dueDate = date(input.dueDate);
      if (input.dependencyIds !== undefined) deliverable.dependencyIds = ids(input.dependencyIds);
      if (deliverable.dependencyIds.some(id => !project.deliverables.some(d => d.id === id)))
        throw new WorkspaceError('Dependencia de entregable no disponible.');
      assertNoCycles(project.deliverables);
      if (input.state !== undefined) {
        if (!['Draft', 'Submitted', 'Accepted', 'ChangesRequested', 'Cancelled'].includes(input.state))
          throw new WorkspaceError('Estado de entregable inválido.');
        if (input.state === 'Accepted') {
          if (actor.personId !== project.acceptancePersonId)
            throw new WorkspaceError('Solo el responsable de aceptación puede aceptar.', 403);
          if (!['Submitted', 'Accepted'].includes(deliverable.state))
            throw new WorkspaceError('Presenta el entregable antes de aceptarlo.');
          if (!deliverable.evidenceIds.length || deliverable.evidenceIds.some(id => !project.evidence.some(e => e.id === id)))
            throw new WorkspaceError('Falta evidencia vinculada.');
          if (deliverable.dependencyIds.some(id => project.deliverables.find(d => d.id === id)?.state !== 'Accepted'))
            throw new WorkspaceError('Quedan entregables previos sin aceptar.');
          if (data.tasks.some(t => t.deliverableId === deliverable.id && t.status !== 'Completed' && !t.cancelledAt))
            throw new WorkspaceError('Quedan tareas vinculadas pendientes.');
          deliverable.acceptedBy = actor.personId;
          deliverable.acceptedAt = new Date().toISOString();
        }
        deliverable.state = input.state;
      }
      if (wasAccepted && changedAcceptanceBasis && deliverable.state !== 'Cancelled') {
        deliverable.state = 'ChangesRequested';
        delete deliverable.acceptedAt;
        delete deliverable.acceptedBy;
      }
      if (deliverable.state !== 'Accepted') {
        delete deliverable.acceptedAt;
        delete deliverable.acceptedBy;
      }
      if (project.state === 'Completed' && deliverable.state !== 'Accepted') project.state = 'Active';
      break;
    }
    case 'restoreProject': {
      if (!reason || actor.personId !== project.acceptancePersonId)
        throw new WorkspaceError('La restauración requiere al responsable de aceptación y un motivo.', 403);
      const target = project.history.find(h => h.revision === input.revision)?.snapshot;
      if (!target) throw new WorkspaceError('Revisión no disponible.');
      if (
        data.tasks.some(
          t => t.projectId === project.id && t.deliverableId && !target.deliverables.some(d => d.id === t.deliverableId)
        )
      )
        throw new WorkspaceError('La revisión dejaría tareas sin entregable. Reasigna esas tareas primero.', 409);
      const currentRevision = project.revision;
      const history = project.history;
      const evidence = project.evidence;
      if (
        target.deliverables.some(
          d =>
            d.state === 'Accepted' &&
            data.tasks.some(t => t.deliverableId === d.id && t.status !== 'Completed' && !t.cancelledAt)
        )
      )
        throw new WorkspaceError('Las tareas actuales no respaldan la aceptación histórica.', 409);
      Object.assign(project, structuredClone(target), { revision: currentRevision, history, evidence });
      break;
    }
    default:
      throw new WorkspaceError('Acción no reconocida.');
  }
  invalidateDependentDeliverables(project);
  project.revision += 1;
  record(project, actor, body.action, reason);
  return project;
}

function invalidateDependentDeliverables(project: Project) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const deliverable of project.deliverables) {
      if (
        deliverable.state === 'Accepted' &&
        deliverable.dependencyIds.some(id => project.deliverables.find(d => d.id === id)?.state !== 'Accepted')
      ) {
        deliverable.state = 'ChangesRequested';
        delete deliverable.acceptedBy;
        delete deliverable.acceptedAt;
        changed = true;
        if (project.state === 'Completed') project.state = 'Active';
      }
    }
  }
}

function reopenLinkedDeliverable(data: DatabaseSchema, task: Task, actor: { personId: string; access?: string }) {
  if (task.status === 'Completed' || task.cancelledAt || !task.deliverableId) return;
  const project = data.projects?.find(p => p.id === task.projectId);
  const deliverable = project?.deliverables.find(d => d.id === task.deliverableId);
  if (project && deliverable?.state === 'Accepted') {
    deliverable.state = 'ChangesRequested';
    delete deliverable.acceptedBy;
    delete deliverable.acceptedAt;
    invalidateDependentDeliverables(project);
    if (project.state === 'Completed') project.state = 'Active';
    project.revision++;
    record(project, actor, 'Aceptación reabierta por tarea pendiente', task.title);
  }
}

export async function applyWorkspaceCommand(actor: SessionData, body: any): Promise<unknown> {
  if (!body || typeof body !== 'object') throw new WorkspaceError('Solicitud inválida.');
  const requestId = text(body.requestId, 'identificador de operación', true, 100);
  const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return dbService.transaction(data => {
    const prior = data.appliedOperations?.find(o => o.requestId === requestId && o.actorId === actor.personId);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new WorkspaceError('Este identificador ya se usó para otro cambio.', 409);
      return prior.result;
    }
    const result = mutate(data, actor, body);
    data.appliedOperations!.push({ requestId, actorId: actor.personId, fingerprint, result: structuredClone(result) });
    return result;
  });
}

/** Persisted task-only capability. No authenticated/Owner session is constructed. */
export async function applyPublicTaskCommand(body: any): Promise<unknown> {
  const requestId = text(body?.requestId, 'identificador de operación', true, 100),
    fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return dbService.transaction(data => {
    const actor = publicTaskActor(data);
    assertPublicTaskCommand(data, actor, body);
    const scope = 'public-hb-tasks:' + actor.personId;
    const prior = data.appliedOperations?.find(o => o.requestId === requestId && o.actorId === scope);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new WorkspaceError('El identificador ya se usó para otro cambio.', 409);
      return prior.result;
    }
    data.appliedOperations ||= [];
    const result = mutateTask(data, actor, body);
    data.appliedOperations.push({ requestId, actorId: scope, fingerprint, result: structuredClone(result) });
    return result;
  });
}
