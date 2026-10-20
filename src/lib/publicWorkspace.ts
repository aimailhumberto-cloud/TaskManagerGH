import type {DatabaseSchema,Task} from '@/services/mockData';
import type {SessionData} from './session';
import {hasAdministrationCapability} from './capabilities';
import {WorkspaceError} from './projects';
import {canAdministerLegacyTask} from './legacyAdministration';
import {ensureSmjTracking,publicSmjTracking} from './smjTracking';

const taskKeys='id title description type repeatPattern steps companyId assigneeId assigneeIds ownerId status priority origin dueDate attachments activityLog isMeeting meetingTime meetingAttendees meetingConfirmations meetingLink comments completedDays category subcategories estimatedMinutes workSlot workTime validationStatus sourceUrl contextNotes projectId deliverableId dependencyIds cancelledAt revision cancellationReason projectName nextAction workDate waitingOn commitment followUpDate approvalStatus'.split(' ');
const projectKeys='id companyId title objective scope ownerId acceptancePersonId state revision stages deliverables milestones evidence history'.split(' ');
const personKeys='id name role avatar companyId workingHoursStart workingHoursEnd timeOff recurringDaysOff lunchStart lunchEnd'.split(' ');
const heroKeys='id ownerId revision background image locationLabel latitude longitude widgetsEnabled homeMarine history'.split(' ');
const automationKeys='id ownerId title purpose companyId assigneeId provider externalId sourceUrl configuration verifiedAt evidence lastRunAt lastOutcome outcomeEvidence nextRunAt blockedBy revision history'.split(' ');
const decisionKeys='id ownerId companyId projectId question alternatives evidence sourceUrl missing recommendation state outcome revision history'.split(' ');
const dayKeys='id ownerId date availableMinutes focusTaskIds revision history'.split(' ');
const reminderKeys='id ownerId taskIds at timezone channel state createdAt workDateAtScheduling history reason deliveredAt acknowledgedAt externalId sourceUrl provider verifiedAt externalEnabled flexible'.split(' ');
// Public nested record schema. Unknown fields (including service configuration,
// password hashes/salts, raw legacy columns and import bundles) never cross this boundary.
const allowed=new Set([...taskKeys,...projectKeys,...personKeys,...heroKeys,...automationKeys,...decisionKeys,...dayKeys,...reminderKeys,...'text cancelled personId eventId account contactId expiresAt taskId completed evidence url createdAt createdBy stageId criteria evidenceIds acceptedBy acceptedAt deliverableIds note filename filepath uploadedAt timestamp user action snapshot changes field before after provenance channel instruction sourceKind observedAt at actorId reason label latitude longitude'.split(' ')]);
export function publicValue(value:any,depth=0):any{
 if(depth>12)return undefined;
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number')return Number.isFinite(value)?value:undefined;
 if(Array.isArray(value))return value.map(v=>publicValue(v,depth+1)).filter(v=>v!==undefined);
 if(!value||typeof value!=='object')return undefined;
 if(typeof value.field==='string'&&!allowed.has(value.field))return undefined;
 return Object.fromEntries(Object.entries(value).filter(([key])=>allowed.has(key)).map(([key,v])=>[key,publicValue(v,depth+1)]).filter(([,v])=>v!==undefined));
}
function pick(value:any,keys:string[]):any{return Object.fromEntries(keys.filter(k=>Object.prototype.hasOwnProperty.call(value,k)).map(k=>[k,publicValue(value[k])]));}
export const taskDTO=(task:Task):Task=>pick(task,taskKeys);
export const personDTO=(person:any)=>pick(person,personKeys);
export const companyDTO=(company:any)=>pick(company,['id','name']);
export function verifiedProfile(db:DatabaseSchema,actor:SessionData){
 const user=db.users?.find(u=>u.id===actor.userId&&u.isActive&&u.personId===actor.personId);
 const person=db.people.find(p=>p.id===actor.personId);
 if(!user||!person)throw new WorkspaceError('Sesión revocada o perfil no disponible.',401);
 return person;
}
export function isWorkspaceAdministrator(db:DatabaseSchema,actor:SessionData){return hasAdministrationCapability(verifiedProfile(db,actor).role);}
export function canReadTask(db:DatabaseSchema,actor:SessionData,task:Task):boolean{
 const admin=isWorkspaceAdministrator(db,actor);
 return admin||task.ownerId===actor.personId||task.assigneeId===actor.personId||Array.isArray(task.assigneeIds)&&task.assigneeIds.includes(actor.personId);
}
export function canWriteTask(db:DatabaseSchema,actor:SessionData,task:Task):boolean{return isWorkspaceAdministrator(db,actor)&&(db.people.some(p=>p.id===task.ownerId)||canAdministerLegacyTask(db,actor,task));}
export function workspaceDTO(db:DatabaseSchema,actor:SessionData){
 const profile=verifiedProfile(db,actor),admin=hasAdministrationCapability(profile.role);
 const tasks=db.tasks.filter(t=>canReadTask(db,actor,t));
 const projects=(db.projects||[]).filter(p=>admin||p.ownerId===actor.personId||db.people.some(person=>person.id===p.ownerId)&&tasks.some(t=>t.projectId===p.id&&t.companyId===p.companyId));
 const companyIds=new Set([...tasks.map(t=>t.companyId),...projects.map(p=>p.companyId),profile.companyId].filter(Boolean));
 const peopleIds=new Set([actor.personId,...tasks.flatMap(t=>[t.ownerId,t.assigneeId,...(t.assigneeIds||[]),...(t.steps||[]).map(s=>s.assigneeId)]),...projects.flatMap(p=>[p.ownerId,p.acceptancePersonId])].filter(Boolean));
 return {
 managedLegacyTaskIds:tasks.filter(t=>canAdministerLegacyTask(db,actor,t)).map(t=>t.id),
 tasks:tasks.map(taskDTO),projects:projects.map(p=>pick(p,projectKeys)),
 smjTracking:db.smjTracking?.ownerId===actor.personId?publicSmjTracking(ensureSmjTracking(db.smjTracking,actor.personId)):(admin&&companyIds.has('business-sm-jaleel')?publicSmjTracking(ensureSmjTracking(null,actor.personId)):null),
 companies:db.companies.filter(c=>admin||companyIds.has(c.id)).map(companyDTO),
 people:db.people.filter(p=>admin||peopleIds.has(p.id)).map(personDTO),
 automations:(db.automations||[]).filter(a=>a.ownerId===actor.personId).map(a=>pick(a,automationKeys)),
 heroPreference:db.heroPreferences?.find(p=>p.ownerId===actor.personId)?pick(db.heroPreferences.find(p=>p.ownerId===actor.personId),heroKeys):null,
 decisions:(db.decisions||[]).filter(d=>d.ownerId===actor.personId).map(d=>pick(d,decisionKeys)),
 dayPlans:(db.dayPlans||[]).filter(p=>p.ownerId===actor.personId).map(p=>pick(p,dayKeys)),
 };
}
export const reminderDTO=(reminder:any)=>pick(reminder,reminderKeys);

export function calendarDTO(value:any){if(!value)return null;return {...pick(value,'ownerId provider calendarId verifiedAt windowStart windowEnd connection'.split(' ')),events:(value.events||[]).map((e:any)=>Object.fromEntries('id calendarId title start end status url allDay observedAt location'.split(' ').filter(k=>Object.prototype.hasOwnProperty.call(e,k)).map(k=>[k,publicValue(e[k])])))};}
