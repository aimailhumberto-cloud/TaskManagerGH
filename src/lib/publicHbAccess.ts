import type { DatabaseSchema, Task } from '@/services/mockData';
import { companyDTO, publicValue, taskDTO } from './publicWorkspace';
import { WorkspaceError } from './projects';
export const HB_PUBLIC_EMAIL = 'hb@sexualidad-sagrada.com';
function display(value:any):any {
 const clean=publicValue(value);
 const walk=(item:any):any=>Array.isArray(item)?item.map(walk):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).filter(([key])=>!['history','activityLog','snapshot','comments','attachments','changes'].includes(key)).map(([key,val])=>{
 if(['sourceUrl','url','meetingLink'].includes(key)&&typeof val==='string'&&val){try{const url=new URL(val);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||Array.from(url.searchParams.keys()).some(k=>/(token|secret|password|signature|api.?key|authorization)/i.test(k)))return [key,''];}catch{return [key,''];}}
 return [key,walk(val)];})):item;
 return walk(clean);
}
/** A display scope, never an authenticated session or an administration capability. */
export function publicHbView(db: DatabaseSchema) {
 const accounts = (db.users || []).filter(u => u.email?.trim().toLowerCase() === HB_PUBLIC_EMAIL && u.isActive);
 if (accounts.length !== 1) throw new WorkspaceError('El perfil HB público no está verificado.', 503);
 const account = accounts[0], hb = db.people.find(p => p.id === account.personId);
 if (!hb || hb.role !== 'Owner') throw new WorkspaceError('La asociación del perfil HB requiere revisión.', 503);
 const policy = db.legacyAdministration;
 const legacy = policy && policy.version === 1 && policy.userId === account.id && policy.personId === hb.id && policy.userId === 'usr-5ry71br' && policy.personId === 'p1wq05qf' && /^[a-f0-9]{64}$/.test(policy.sourceSha256) && policy.approvalReference && Number.isFinite(Date.parse(policy.approvedAt)) && policy.taskIds?.length === 74 && new Set(policy.taskIds).size === 74 ? new Set(policy.taskIds) : new Set<string>();
 const visible = db.tasks.filter(t => t.ownerId === hb.id || t.assigneeId === hb.id || t.assigneeIds?.includes(hb.id) || !t.ownerId && legacy.has(t.id));
 const projects = (db.projects || []).filter(p => p.ownerId === hb.id).map(p => ({...display(p), history: []}));
 const projectIds = new Set(projects.map(p => p.id));
 const tasks = visible.map(t => {
  const clean = display(taskDTO(t)) as Task;
  return {...clean, activityLog: [], comments: [], attachments: [], meetingAttendees: [], meetingConfirmations: [], steps: clean.steps.map(s => ({...display(s)})), ...(!projectIds.has(t.projectId) ? {projectId: '',deliverableId: '',projectName: ''} : {})} as Task;
 });
 const companies = new Set([...tasks.map(t => t.companyId),...projects.map(p => p.companyId),hb.companyId].filter(Boolean));
 const people = new Set([hb.id,...tasks.flatMap(t => [t.ownerId,t.assigneeId,...(t.assigneeIds || []),...t.steps.map(s => s.assigneeId)]),...projects.map(p => p.acceptancePersonId)].filter(Boolean));
 return {
  access: 'public-hb-readonly' as const, actorId: hb.id, managedLegacyTaskIds: tasks.filter(t => !t.ownerId && legacy.has(t.id)).map(t => t.id),
  tasks, projects, companies: db.companies.filter(c => companies.has(c.id)).map(companyDTO),
  people: db.people.filter(p => people.has(p.id)).map(p => ({id:p.id,name:p.name,avatar:p.avatar,role:p.role === 'AIAgent' ? 'AIAgent' : 'Member'})),
  decisions:(db.decisions || []).filter(d=>d.ownerId===hb.id).map(d=>({...display(d),history:[]})),
  automations:(db.automations || []).filter(a=>a.ownerId===hb.id).map(a=>({...display(a),history:[]})),
  dayPlans:[],heroPreference:null,
 };
}
export type PublicHbView = ReturnType<typeof publicHbView>;
