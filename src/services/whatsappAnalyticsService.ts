import {whatsappOwnerAllowed} from '@/lib/whatsappOwner';
import {workspaceDTO} from '@/lib/publicWorkspace';
import {applyWorkspaceCommand} from './workspaceService';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {dbService} from './dbService';
import type {WAEnvelope,WAReview} from '@/lib/whatsappAnalytics';
import {validEvents,eventKey,buildWAView} from '@/lib/whatsappAnalytics';
import type {SessionData} from '@/lib/session';
import {WorkspaceError} from '@/lib/projects';
// Real content transport remains unconfigured: UI approval is not a content grant.
export async function analyticsSource(ownerId:string):Promise<WAEnvelope>{
 const fixture=resolve('.local-data/whatsapp-analytics-fixture.json');
 if(process.env.TASKMANAGER_LOCAL_ONLY==='1'&&process.env.TASKMANAGER_WHATSAPP_ANALYTICS_FIXTURE===fixture&&resolve(process.env.DATABASE_PATH||'')===resolve('.local-data/ui-test.json')){
 const data=JSON.parse(await readFile(fixture,'utf8'));if(data.synthetic!==true||data.ownerId!==ownerId)throw new WorkspaceError('Ensayo no disponible para esta identidad.',403);return data;
 }
 return {version:1,ownerId,synthetic:false,available:false,reason:'Pendiente de autorizar lectura y análisis de contenido en este entorno. La conexión de metadatos sigue disponible.',permissionExpiresAt:null,coverage:[],events:[]};
}
export async function analyticsView(actor:SessionData,account:'all'|'personal'|'bee-smart',days:1|7,query:string){const db=await dbService.readData();if(!whatsappOwnerAllowed(actor,db))throw new WorkspaceError('Contenido reservado al propietario verificado.',403);const source=await analyticsSource(actor.personId);return {...buildWAView(source,db.whatsappReviews||[],{account,days,query}),companies:workspaceDTO(db,actor).companies,projects:workspaceDTO(db,actor).projects.filter(p=>p.ownerId===actor.personId),tasks:db.tasks.filter(t=>t.ownerId===actor.personId&&!t.cancelledAt).map(t=>({id:t.id,title:t.title,companyId:t.companyId,isMeeting:t.isMeeting}))};}
export async function reviewAnalytics(actor:SessionData,body:any){
 if(!whatsappOwnerAllowed(actor,await dbService.readData()))throw new WorkspaceError('Contenido reservado al propietario verificado.',403);
 const source=await analyticsSource(actor.personId);if(!source.available)throw new WorkspaceError('Lectura de contenido no autorizada; no se guardó nada.',403);
 if(!body||!['pending','reviewed','dismissed','linked','create_task'].includes(body.state)||typeof body.eventKey!=='string'||typeof body.requestId!=='string'||!body.requestId.length||body.requestId.length>100)throw new WorkspaceError('Revisión inválida.');
 const event=validEvents(source).find(e=>eventKey(e)===body.eventKey);if(!event)throw new WorkspaceError('La fuente venció o no está disponible; no se guardó nada.',410);
 if(body.state==='create_task'){
  if(body.retentionAcknowledged!==true)throw new WorkspaceError('Confirma que el contenido revisado se conservará como tarea.');
  const fields=body.fields; if(!fields||typeof fields.title!=='string'||typeof fields.companyId!=='string')throw new WorkspaceError('Revisa la tarea propuesta.');
  return applyWorkspaceCommand(actor,{requestId:body.requestId,action:'createTask',fields:{title:fields.title,companyId:fields.companyId,nextAction:fields.nextAction||'',workDate:fields.workDate||'',dueDate:fields.dueDate||'',validationStatus:'Confirmed',contextNotes:'Origen WhatsApp '+event.account+' · evento '+event.id+' · revisado y conservado expresamente por el propietario.'},reason:'Propuesta WhatsApp revisada · conservación como tarea confirmada'});
 }
 return dbService.transaction(db=>{
 const now=new Date().toISOString();db.whatsappReviews=(db.whatsappReviews||[]).filter(r=>Date.parse(r.expiresAt)>Date.now());
 const prior=db.whatsappReviews.find(r=>r.id===body.eventKey&&r.ownerId===actor.personId);
 const companyId=body.state==='linked'?(body.companyId||undefined):prior?.companyId, projectId=body.state==='linked'?(body.projectId||undefined):prior?.projectId, taskId=body.state==='linked'?(body.taskId||undefined):prior?.taskId;
 // Repeating the exact same decision is idempotent; never retries different content as the same revision.
 if(prior&&prior.state===body.state&&prior.companyId===companyId&&prior.taskId===taskId&&prior.projectId===projectId)return prior;
 if((prior?.revision||0)!==body.expectedRevision)throw new WorkspaceError('La revisión cambió; recarga antes de confirmar.',409);
 if(body.companyId&&!db.companies.some(c=>c.id===body.companyId)||body.projectId&&!db.projects?.some(p=>p.id===body.projectId&&p.ownerId===actor.personId&&p.companyId===body.companyId)||body.taskId&&!db.tasks.some(t=>t.id===body.taskId&&t.ownerId===actor.personId&&!t.cancelledAt&&(!body.companyId||t.companyId===body.companyId)))throw new WorkspaceError('Vínculo no disponible para esta identidad.');
 const review:WAReview={id:body.eventKey,ownerId:actor.personId,eventId:event.id,account:event.account,contactId:event.contactId,expiresAt:event.expiresAt,state:body.state,revision:(prior?.revision||0)+1,at:now,history:[...(prior?.history||[]),{at:now,state:body.state}],...(companyId?{companyId}:{}),...(projectId?{projectId}:{}),...(taskId?{taskId}:{})};
 if(prior)db.whatsappReviews[db.whatsappReviews.indexOf(prior)]=review;else db.whatsappReviews.push(review);return review;
 });
}
