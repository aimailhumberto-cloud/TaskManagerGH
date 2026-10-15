import {createHash,randomUUID} from 'crypto';
import {dbService} from './dbService';
import {publicTaskActor} from '@/lib/publicTaskScope';
import {validateSmjRecord,type SmjTracking,type SmjRecord} from '@/lib/smjTracking';
import {WorkspaceError} from '@/lib/projects';
import type {SessionData} from '@/lib/session';
import {verifiedProfile} from '@/lib/publicWorkspace';
import {hasAdministrationCapability} from '@/lib/capabilities';
export async function saveSmjRecord(body:any,privateSession?:SessionData){
 if(!body||Object.keys(body).some(k=>!['requestId','id','expectedRevision','fields','reason'].includes(k))||typeof body.requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(body.requestId)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>600)throw new WorkspaceError('Solicitud SMJ inválida.');
 const fingerprint=createHash('sha256').update(JSON.stringify(body)).digest('hex');
 return dbService.transaction(data=>{
  if(privateSession&&!hasAdministrationCapability(verifiedProfile(data,privateSession).role))throw new WorkspaceError('La edición privada SMJ requiere el perfil vigente autorizado.',403);
  const actor=privateSession||publicTaskActor(data);if(!data.companies.some(c=>c.id==='business-sm-jaleel')||!data.tasks.some(t=>t.companyId==='business-sm-jaleel'&&t.ownerId===actor.personId))throw new WorkspaceError('SMJ no pertenece al espacio HB.',403);
  const scope=(privateSession?'private-smj:':'public-smj:')+actor.personId;const prior=data.appliedOperations?.find(p=>p.actorId===scope&&p.requestId===body.requestId);if(prior){if(prior.fingerprint!==fingerprint)throw new WorkspaceError('Identificador ya utilizado.',409);return prior.result;}
  const current:SmjTracking=data.smjTracking||{ownerId:actor.personId,companyId:'business-sm-jaleel',revision:0,references:[],records:[]};if(current.ownerId!==actor.personId)throw new WorkspaceError('Seguimiento ajeno.',403);
  const previous=body.id?current.records.find(r=>r.id===body.id):undefined;if(body.id&&!previous)throw new WorkspaceError('Registro SMJ no encontrado.',404);if(previous&&previous.revision!==body.expectedRevision)throw new WorkspaceError('Registro modificado; recarga y compara antes de guardar.',409);
  const fields=validateSmjRecord(body.fields,current.references,current.records);if(previous&&fields.kind!==previous.kind)throw new WorkspaceError('No se puede convertir el tipo de un registro.');
  if(fields.kind==='evidence'&&current.records.some(r=>r.kind==='evidence'&&r.referenceId===fields.referenceId&&r.id!==previous?.id))throw new WorkspaceError('Ya existe avance para esta referencia; edita su revisión actual.',409);
  const at=new Date().toISOString();const record:SmjRecord={...fields,id:previous?.id||randomUUID(),revision:(previous?.revision||0)+1,updatedAt:at,history:[...(previous?.history||[]),{revision:(previous?.revision||0)+1,at,reason:body.reason.trim()}]};
  const next={...current,revision:current.revision+1,records:previous?current.records.map(r=>r.id===previous.id?record:r):[...current.records,record]};data.smjTracking=next;data.appliedOperations||=[];const result={id:record.id,revision:record.revision};data.appliedOperations.push({requestId:body.requestId,actorId:scope,fingerprint,result});return result;
 });
}
