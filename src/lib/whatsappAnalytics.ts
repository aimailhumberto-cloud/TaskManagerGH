import { publicValue } from './publicWorkspace';
export type WAAccount = 'personal'|'bee-smart';
export interface WAEvent { id:string; account:WAAccount; contactId:string; contactName:string; direction:'incoming'|'outgoing_accepted'|'self'; at:string; capturedAt:string; expiresAt:string; text?:string; media?:'audio'|'document'; private:true }
export interface WACoverage { account:WAAccount; from:string|null; to:string|null; lastSuccessAt:string|null; partial:true; gaps:string[]; mobileOutgoingComplete:false }
export interface WAEnvelope { version:1; ownerId:string; synthetic:boolean; available:boolean; reason:string; permissionExpiresAt:string|null; coverage:WACoverage[]; events:WAEvent[] }
export interface WAReview { id:string; ownerId:string; eventId:string; account:WAAccount; contactId:string; expiresAt:string; state:'pending'|'reviewed'|'dismissed'|'linked'; companyId?:string; projectId?:string; taskId?:string; revision:number; at:string; history:{at:string;state:string}[] }
export interface WASuggestion { kind:'request'|'commitment'|'date'; reason:string; certainty:'explicit'|'confirm'; validatedDue:string|null }
export function eventKey(e:Pick<WAEvent,'account'|'id'>){return `${e.account}:${e.id}`;}
const instant=(v:unknown)=>typeof v==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
export function validEvents(source:WAEnvelope,now=new Date()):WAEvent[]{
 if(source.version!==1||!source.available||(source.permissionExpiresAt&&(!instant(source.permissionExpiresAt)||Date.parse(source.permissionExpiresAt)<=+now)))return [];
 const keys=new Set<string>();return source.events.filter(e=>{
 if(!e||!['personal','bee-smart'].includes(e.account)||typeof e.id!=='string'||!e.id||e.id.length>200||typeof e.contactId!=='string'||!e.contactId||e.contactId.length>200||typeof e.contactName!=='string'||e.contactName.length>200||e.private!==true||!['incoming','outgoing_accepted','self'].includes(e.direction)||!instant(e.at)||!instant(e.capturedAt)||!instant(e.expiresAt)||Date.parse(e.at)>+now||Date.parse(e.expiresAt)<=+now||Date.parse(e.expiresAt)>Date.parse(e.capturedAt)+7*86400000||Date.parse(e.capturedAt)<Date.parse(e.at)||(e.text!==undefined&&(typeof e.text!=='string'||e.text.length>4000))||e.media&&!['audio','document'].includes(e.media))return false;
 const key=eventKey(e);if(keys.has(key))return false;keys.add(key);return true;
 }).map(e=>({id:e.id,account:e.account,contactId:e.contactId,contactName:e.contactName,direction:e.direction,at:e.at,capturedAt:e.capturedAt,expiresAt:e.expiresAt,private:true as const,...(e.text!==undefined?{text:e.text}:{}),...(e.media?{media:e.media}:{})})).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||eventKey(a).localeCompare(eventKey(b)));
}
export function suggestion(e:WAEvent):WASuggestion|null{
 if(e.direction!=='incoming'||!e.text)return null;const t=e.text.toLocaleLowerCase('es');
 if(/^\s*(gracias|muchas gracias|hola|buenos días|buenas tardes)[!.\s]*$/.test(t))return null;
 const request=/\b(puedes|podrías|necesito|por favor|confirma|envíame|revisa)\b/.test(t),commitment=/\b(me comprometo|te enviaré|voy a enviar|quedamos en|acordamos)\b/.test(t);
 const explicit=t.match(/\b(20\d\d-\d\d-\d\d)\b/);let due:string|null=null;if(explicit&&Number.isFinite(Date.parse(explicit[1]+'T00:00:00Z'))&&new Date(explicit[1]+'T00:00:00Z').toISOString().slice(0,10)===explicit[1])due=explicit[1];
 if(!request&&!commitment&&!explicit)return null;
 const ambiguous=/\b(mañana|hoy|lunes|martes|miércoles|jueves|viernes|próxima|a las)\b/.test(t)||!!explicit&&!due;
 return {kind:request?'request':commitment?'commitment':'date',reason:request?'Petición explícita por revisar':commitment?'Posible compromiso por revisar':'Fecha mencionada por revisar',certainty:ambiguous?'confirm':'explicit',validatedDue:due};
}
export function buildWAView(source:WAEnvelope,reviews:WAReview[],filter:{account:'all'|WAAccount;days:1|7;query:string},now=new Date()){
 const available=source.available&&(!source.permissionExpiresAt||Date.parse(source.permissionExpiresAt)>+now);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Panama',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const start=Date.parse(day+'T00:00:00-05:00')-(filter.days-1)*86400000;
 const selected=validEvents(source,now).filter(e=>(filter.account==='all'||e.account===filter.account)&&Date.parse(e.at)>=start);
 const q=filter.query.trim().toLocaleLowerCase('es');const events=selected.filter(e=>!q||[e.contactName,e.text||''].some(v=>v.toLocaleLowerCase('es').includes(q)));
 const visibleKeys=new Set(events.map(eventKey));
 const own=reviews.filter(r=>r.ownerId===source.ownerId&&Date.parse(r.expiresAt)>+now&&visibleKeys.has(r.account+':'+r.eventId)).map(r=>publicValue(r) as WAReview);
 const contacts=new Map<string,{key:string;name:string;account:WAAccount;incoming:number;outgoing:number;latest:string;events:WAEvent[];unansweredObserved:boolean}>();
 for(const e of events){if(e.direction==='self')continue;const key=`${e.account}:${e.contactId}`;const c=contacts.get(key)||{key,name:e.contactName,account:e.account,incoming:0,outgoing:0,latest:e.at,events:[],unansweredObserved:false};if(e.direction==='incoming')c.incoming++;else c.outgoing++;c.events.push(e);contacts.set(key,c);}
 for(const c of contacts.values())c.unansweredObserved=c.events[0]?.direction==='incoming';
 const attention=events.map(event=>({event,suggestion:suggestion(event),review:own.find(r=>r.id===eventKey(event))})).filter(v=>v.suggestion&&(!v.review||v.review.state==='pending')).sort((a,b)=>(a.suggestion!.validatedDue||'9999').localeCompare(b.suggestion!.validatedDue||'9999')||Date.parse(b.event.at)-Date.parse(a.event.at));
 const media=events.filter(e=>e.media&&!own.some(r=>r.id===eventKey(e)&&r.state!=='pending'));
 return {available,synthetic:source.synthetic,reason:available?source.reason:source.available?'Permiso de contenido vencido o no disponible':source.reason,permissionExpiresAt:source.permissionExpiresAt,timezone:'America/Panama',checkedAt:now.toISOString(),coverage:source.coverage.filter(c=>filter.account==='all'||c.account===filter.account).map(c=>({account:c.account,from:c.from,to:c.to,lastSuccessAt:c.lastSuccessAt,partial:c.partial,gaps:c.gaps,mobileOutgoingComplete:c.mobileOutgoingComplete})),metrics:{attention:available?attention.length:null,contacts:available?contacts.size:null,events:available?events.length:null,media:available?media.length:null},attention,contacts:[...contacts.values()].sort((a,b)=>(b.incoming+b.outgoing)-(a.incoming+a.outgoing)||Date.parse(b.latest)-Date.parse(a.latest)),events,media,reviews:own};
}
