import type { DatabaseSchema, Task } from '@/services/mockData';
import type { CalendarSnapshot } from '@/lib/planning';
import { companyDTO, publicValue, taskDTO } from './publicWorkspace';
import { WorkspaceError } from './projects';
import { ensureSmjTracking, publicSmjTracking } from './smjTracking';
import {
  ensureDefaultHbMeetings,
  normalizeHbCompanies,
  normalizeHbProjects,
  normalizeHbTask,
} from './hbCompanies';

export const HB_PUBLIC_EMAIL = 'hb@sexualidad-sagrada.com';

function display(value: any): any {
  const clean = publicValue(value);
  const walk = (item: any): any =>
    Array.isArray(item)
      ? item.map(walk)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .filter(([key]) => !['history', 'activityLog', 'snapshot', 'comments', 'attachments', 'changes'].includes(key))
              .map(([key, val]) => {
                if (['sourceUrl', 'url', 'meetingLink'].includes(key) && typeof val === 'string' && val) {
                  try {
                    const url = new URL(val);
                    if (
                      !['http:', 'https:'].includes(url.protocol) ||
                      url.username ||
                      url.password ||
                      Array.from(url.searchParams.keys()).some(k =>
                        /(token|secret|password|signature|api.?key|authorization)/i.test(k)
                      )
                    )
                      return [key, ''];
                  } catch {
                    return [key, ''];
                  }
                }
                return [key, walk(val)];
              })
          )
        : item;
  return walk(clean);
}

/** A display scope, never an authenticated session or an administration capability. */
export function publicHbView(db: DatabaseSchema) {
  const accounts = (db.users || []).filter(u => u.email?.trim().toLowerCase() === HB_PUBLIC_EMAIL && u.isActive);
  if (accounts.length !== 1) throw new WorkspaceError('El perfil HB público no está verificado.', 503);
  const account = accounts[0],
    hb = db.people.find(p => p.id === account.personId);
  if (!hb || hb.role !== 'Owner') throw new WorkspaceError('La asociación del perfil HB requiere revisión.', 503);

  const legacy = new Set<string>();
  const visible = db.tasks.filter(
    t => !!t.ownerId && (t.ownerId === hb.id || t.assigneeId === hb.id || t.assigneeIds?.includes(hb.id))
  );
  const rawProjects = (db.projects || []).filter(p => p.ownerId === hb.id).map(p => ({ ...display(p), history: [] }));
  const projects = normalizeHbProjects(rawProjects);
  const projectIds = new Set(projects.map(p => p.id));

  const normalizedTasks = visible
    .map(t => {
      const clean = display(taskDTO(t)) as Task;
      const mapped = normalizeHbTask({
        ...clean,
        activityLog: [],
        comments: [],
        attachments: [],
        meetingAttendees: [],
        meetingConfirmations: [],
        steps: clean.steps.map(s => ({ ...display(s) })),
        ...(!projectIds.has(t.projectId || '') ? { projectId: '', deliverableId: '', projectName: '' } : {}),
      } as Task);
      return mapped;
    })
    .filter((t): t is Task => t !== null);

  const tasks = ensureDefaultHbMeetings(normalizedTasks, hb.id);
  const companies = normalizeHbCompanies((db.companies || []).map(companyDTO));

  const people = new Set(
    [
      hb.id,
      ...tasks.flatMap(t => [t.ownerId, t.assigneeId, ...(t.assigneeIds || []), ...t.steps.map(s => s.assigneeId)]),
      ...projects.map(p => p.acceptancePersonId),
    ].filter(Boolean)
  );

  const calendarSnapshot: CalendarSnapshot | null = db.calendarSnapshot
    ? (display(db.calendarSnapshot) as CalendarSnapshot)
    : null;

  return {
    access: 'public-hb-tasks' as const,
    actorId: hb.id,
    publicEditableTaskIds: tasks.filter(t => t.ownerId === hb.id || (!t.ownerId && legacy.has(t.id))).map(t => t.id),
    managedLegacyTaskIds: tasks.filter(t => !t.ownerId && legacy.has(t.id)).map(t => t.id),
    tasks,
    projects,
    companies,
    calendarSnapshot,
    smjTracking: companies.some(c => c.id === 'business-sm-jaleel')
      ? publicSmjTracking(ensureSmjTracking(db.smjTracking?.ownerId === hb.id ? db.smjTracking : null, hb.id))
      : null,
    people: db.people
      .filter(p => people.has(p.id))
      .map(p => ({ id: p.id, name: p.name, avatar: p.avatar, role: p.role === 'AIAgent' ? 'AIAgent' : 'Member' })),
    decisions: (db.decisions || []).filter(d => d.ownerId === hb.id).map(d => ({ ...display(d), history: [] })),
    automations: (db.automations || []).filter(a => a.ownerId === hb.id).map(a => ({ ...display(a), history: [] })),
    dayPlans: [],
    heroPreference: null,
  };
}

export type PublicHbView = ReturnType<typeof publicHbView>;
