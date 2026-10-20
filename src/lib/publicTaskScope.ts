import type { DatabaseSchema, Task } from '@/services/mockData';
import { publicHbView } from './publicHbAccess';
import { WorkspaceError } from './projects';

export interface PublicTaskActor {
  access: 'public-hb-tasks';
  personId: string;
  accountId: string;
}

export const PUBLIC_TASK_ACTIONS = [
  'createTask',
  'updateTask',
  'createCompany',
  'updateCompany',
  'deleteCompany',
] as const;

const fields = new Set(
  'title description type steps companyId assigneeId status priority dueDate category subcategories estimatedMinutes workSlot workTime validationStatus sourceUrl contextNotes nextAction workDate waitingOn commitment followUpDate approvalStatus repeatPattern isMeeting meetingTime dependencyIds cancelled name'.split(
    ' '
  )
);
const stepFields = new Set(
  'id text completed status assigneeId workDate dueDate nextAction waitingOn dependencyIds evidence sourceUrl cancelled'.split(
    ' '
  )
);

export const isPublicTaskActor = (actor: unknown): actor is PublicTaskActor =>
  !!actor && typeof actor === 'object' && (actor as PublicTaskActor).access === 'public-hb-tasks';

export function publicTaskActor(data: DatabaseSchema): PublicTaskActor {
  const view = publicHbView(data),
    account = data.users.find(
      u => u.personId === view.actorId && u.isActive && u.email.trim().toLowerCase() === 'hb@sexualidad-sagrada.com'
    )!;
  return { access: 'public-hb-tasks', personId: view.actorId, accountId: account.id };
}

export function publicTaskWritable(data: DatabaseSchema, actor: PublicTaskActor, task: Task) {
  const current = publicTaskActor(data);
  return (
    current.accountId === actor.accountId &&
    current.personId === actor.personId &&
    publicHbView(data).publicEditableTaskIds.includes(task.id)
  );
}

export function assertPublicTaskCommand(data: DatabaseSchema, actor: PublicTaskActor, body: any) {
  const current = publicTaskActor(data),
    view = publicHbView(data);
  if (current.accountId !== actor.accountId || current.personId !== actor.personId)
    throw new WorkspaceError('El perfil HB cambió; recarga antes de guardar.', 403);
  if (
    !body ||
    !PUBLIC_TASK_ACTIONS.includes(body.action) ||
    Object.keys(body).some(k => !['action', 'fields', 'reason', 'id', 'expectedRevision', 'requestId'].includes(k))
  )
    throw new WorkspaceError('Acción fuera del alcance público de tareas.', 403);
  if (typeof body.requestId !== 'string' || !/^[-a-zA-Z0-9]{8,100}$/.test(body.requestId))
    throw new WorkspaceError('Identificador de operación inválido.');
  const input = body.fields;
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !fields.has(k)))
    throw new WorkspaceError('Campo fuera del alcance público de tareas.', 403);

  if (['createCompany', 'updateCompany', 'deleteCompany'].includes(body.action)) {
    return;
  }

  const previous =
    body.action === 'updateTask'
      ? data.tasks.find(t => t.id === body.id) || view.tasks.find(t => t.id === body.id)
      : undefined;
  if (body.action === 'updateTask' && (!previous || !publicTaskWritable(data, actor, previous)))
    throw new WorkspaceError('Esta tarea no pertenece al alcance público HB.', 403);
  if (body.action === 'updateTask' && (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0))
    throw new WorkspaceError('La revisión de la tarea es obligatoria.');
  if (body.action === 'createTask' && body.id !== undefined)
    throw new WorkspaceError('El identificador de una tarea nueva lo asigna el servidor.');
  const companyIds = new Set(view.companies.map(c => c.id)),
    peopleIds = new Set(view.people.map(p => p.id)),
    editableIds = new Set(view.publicEditableTaskIds);
  if (
    input.companyId !== undefined &&
    !companyIds.has(input.companyId) &&
    !(previous && !previous.companyId && input.companyId === '')
  )
    throw new WorkspaceError('Empresa fuera del espacio HB.', 403);
  if (input.assigneeId !== undefined && !peopleIds.has(input.assigneeId) && input.assigneeId !== previous?.assigneeId)
    throw new WorkspaceError('Responsable fuera del espacio HB.', 403);
  if (
    input.dependencyIds !== undefined &&
    (!Array.isArray(input.dependencyIds) || input.dependencyIds.some((id: string) => !editableIds.has(id)))
  )
    throw new WorkspaceError('Dependencia fuera del espacio HB.', 403);
  if (previous?.projectId && !data.projects?.some(p => p.id === previous.projectId && p.ownerId === actor.personId))
    throw new WorkspaceError('El proyecto vinculado requiere acceso privado.', 403);
  if (input.steps !== undefined) {
    if (!Array.isArray(input.steps)) throw new WorkspaceError('Pasos inválidos.');
    const ids = new Set(input.steps.map((s: any) => s?.id));
    if (previous?.steps.some(s => !ids.has(s.id)))
      throw new WorkspaceError('Conserva los pasos existentes; cancélalos con un motivo.');
    for (const step of input.steps) {
      if (
        !step ||
        typeof step !== 'object' ||
        Array.isArray(step) ||
        Object.keys(step).some(k => !stepFields.has(k))
      )
        throw new WorkspaceError('Campo de paso fuera del alcance público.', 403);
      if (
        step.assigneeId &&
        !peopleIds.has(step.assigneeId) &&
        step.assigneeId !== previous?.steps.find(s => s.id === step.id)?.assigneeId
      )
        throw new WorkspaceError('Responsable de paso fuera del espacio HB.', 403);
      if (
        step.dependencyIds !== undefined &&
        (!Array.isArray(step.dependencyIds) || step.dependencyIds.some((id: string) => !ids.has(id)))
      )
        throw new WorkspaceError('Dependencia de paso fuera de esta tarea.', 403);
    }
  }
}
