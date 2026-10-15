import {WorkspaceError} from './projects';
export type SmjRecordKind='distributor'|'sale'|'score'|'fee'|'evidence';
export interface SmjReferenceRow {id:string;sheet:string;row:number;sourceId?:string;kind:'obligation'|'control'|'target'|'criterion'|'routine'|'reference';title:string;market?:string;period?:string;value?:number|null;valueState?:'Numeric'|'Dash in PDF'|'Blank in PDF'|'No row in table';weight?:number;sourceWeight?:number;nextAction?:string;completionCriterion?:string;expectedEvidence?:string;frequency?:string;}
export interface SmjSource {libraryFileId:string;version:number;sha256:string;fileName:string;}
export interface SmjRecord {id:string;kind:SmjRecordKind;title:string;market:'Canada'|'USA'|'';period:string;value:number|null;unit:string;sourceUrl:string;notes:string;distributorId:string;criterionId:string;referenceId:string;state:'NotStarted'|'InProgress'|'Waiting'|'Completed'|'NotApplicable';evidence:string;basis:string;revision:number;updatedAt:string;history:{revision:number;at:string;reason:string}[];}
export interface SmjTracking {ownerId:string;companyId:'business-sm-jaleel';revision:number;source?:SmjSource;references:SmjReferenceRow[];records:SmjRecord[];}
export const SMJ_LIBRARY_ID='libfile_90898d2ba1a08191927ae57d76f06f3a';
/** Separate explicit response schema; never broadens the general workspace's nested allowlist. */
export function publicSmjTracking(current:SmjTracking):SmjTracking {
 const pick=(value:any,keys:string[])=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
 const safeUrl=(value:string)=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&![...u.searchParams.keys()].some(k=>/token|secret|password|signature|api.?key|authorization/i.test(k))?value:'';}catch{return '';}};
 return {ownerId:current.ownerId,companyId:'business-sm-jaleel',revision:current.revision,...(current.source?{source:pick(current.source,['libraryFileId','version','sha256','fileName']) as unknown as SmjSource}:{}),references:current.references.map(r=>pick(r,['id','sheet','row','sourceId','kind','title','market','period','value','valueState','weight','sourceWeight','nextAction','completionCriterion','expectedEvidence','frequency']) as unknown as SmjReferenceRow),records:current.records.map(r=>({...pick(r,['id','kind','title','market','period','value','unit','notes','distributorId','criterionId','basis','revision','updatedAt']),referenceId:r.referenceId||'',state:r.state||'NotStarted',evidence:r.evidence||'',sourceUrl:safeUrl(r.sourceUrl),history:[]}) as unknown as SmjRecord)};
}
const sheets=new Set(['Dashboard','Tracking','Scorecard','Fees','Routines','Terms','Clarifications','Target source','PortfolioValue','ScenarioAssumptions','RetailEvidence','TaskMapping']);
/** Curated rows only; never imports contacts or the workbook wholesale, creates tasks, or schedules routines. */
export function importSmjReferences(current:SmjTracking|undefined,ownerId:string,source:SmjSource,rows:SmjReferenceRow[]):SmjTracking {
 if(source.libraryFileId!==SMJ_LIBRARY_ID||!Number.isSafeInteger(source.version)||source.version<3||!/^[a-f0-9]{64}$/.test(source.sha256)||source.fileName!=='SMJ_HB_Targets_and_Contract_v2.xlsx')throw new WorkspaceError('Fuente SMJ no verificada.');
 if(current&&current.ownerId!==ownerId)throw new WorkspaceError('Espacio SMJ ajeno.',403);
 const criteriaRows=rows.filter(row=>row.kind==='criterion'),weightTotal=criteriaRows.reduce((n,row)=>n+(row.weight||0),0);
 if(criteriaRows.length&&(criteriaRows.length!==14||Math.abs(weightTotal-1)>0.000001&&Math.abs(weightTotal-100)>0.001))throw new WorkspaceError('Se requieren 14 criterios con pesos que sumen 1 o 100 %.');
 const weightScale=criteriaRows.length&&Math.abs(weightTotal-1)<0.000001?100:1;
 const refs:SmjReferenceRow[]=rows.map(row=>{
  if(!sheets.has(row.sheet)||!Number.isSafeInteger(row.row)||row.row<1||!row.title?.trim()||row.title.length>600||!['obligation','control','target','criterion','routine','reference'].includes(row.kind)||row.value!==undefined&&row.value!==null&&(!Number.isFinite(row.value)||row.value<0)||row.weight!==undefined&&(!Number.isFinite(row.weight)||row.weight<0||row.weight>100)||row.sourceId!==undefined&&!/^[A-Z0-9-]{1,100}$/.test(row.sourceId))throw new WorkspaceError('Fila de referencia inválida.');
  if(row.valueState!==undefined&&!['Numeric','Dash in PDF','Blank in PDF','No row in table'].includes(row.valueState))throw new WorkspaceError('Estado de valor inválido.');
  if(row.valueState==='Numeric'&&(row.value===null||row.value===undefined)||row.valueState&&row.valueState!=='Numeric'&&row.value!==null)throw new WorkspaceError('Una referencia sin cifra debe conservar null, no cero.');
  const details:Pick<SmjReferenceRow,'nextAction'|'completionCriterion'|'expectedEvidence'|'frequency'>={};for(const key of ['nextAction','completionCriterion','expectedEvidence','frequency'] as const){if(row[key]!==undefined){if(typeof row[key]!=='string'||row[key]!.length>2000)throw new WorkspaceError('Detalle de referencia inválido.');details[key]=row[key]!.trim();}}
  return {id:'smj-ref:'+row.sheet+':'+(row.sourceId||row.row),sheet:row.sheet,row:row.row,...(row.sourceId?{sourceId:row.sourceId}:{}),kind:row.kind,title:row.title.trim(),...(row.market?{market:row.market}:{}),...(row.period?{period:row.period}:{}),...(row.value!==undefined?{value:row.value}:{}),...(row.valueState?{valueState:row.valueState}:{}),...(row.weight!==undefined?{weight:row.weight*(row.kind==='criterion'?weightScale:1),sourceWeight:row.weight}:{}),...details};
 });
 if(new Set(refs.map(r=>r.id)).size!==refs.length)throw new WorkspaceError('Filas duplicadas.');
 const criteria=refs.filter(r=>r.kind==='criterion');if(criteria.length&&Math.abs(criteria.reduce((n,r)=>n+(r.weight||0),0)-100)>0.001)throw new WorkspaceError('Los pesos del scorecard deben sumar 100 %.');
 for(const record of current?.records||[]){for(const id of new Set([record.referenceId,record.criterionId].filter(Boolean))){const old=current?.references.find(r=>r.id===id),next=refs.find(r=>r.id===id);if(!next||old&&(old.title!==next.title||old.kind!==next.kind))throw new WorkspaceError('Una referencia con resultados cambió de identidad; requiere reconciliación revisada.',409);}}
 if(current?.source?.sha256===source.sha256&&JSON.stringify(current.references)===JSON.stringify(refs))return current;
 return {ownerId,companyId:'business-sm-jaleel',revision:(current?.revision||0)+1,source:{...source},references:refs,records:current?.records||[]};
}
const text=(value:unknown,max=600)=>{if(typeof value!=='string'||value.length>max)throw new WorkspaceError('Texto inválido.');return value.trim();};
export function validateSmjRecord(input:any,references:SmjReferenceRow[],records:SmjRecord[]):Omit<SmjRecord,'id'|'revision'|'updatedAt'|'history'>{
 const keys=['kind','title','market','period','value','unit','sourceUrl','notes','distributorId','criterionId','referenceId','state','evidence','basis'];if(!input||Object.keys(input).some(k=>!keys.includes(k)))throw new WorkspaceError('Campo fuera del seguimiento SMJ.',403);
 if(!['distributor','sale','score','fee','evidence'].includes(input.kind))throw new WorkspaceError('Tipo de registro inválido.');
 const title=text(input.title,240);if(!title)throw new WorkspaceError('El título es obligatorio.');
 const market=text(input.market||'');if(!['Canada','USA',''].includes(market))throw new WorkspaceError('Mercado inválido.');
 const period=text(input.period||'');if(period&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))throw new WorkspaceError('Período inválido.');
 const value=input.value===null||input.value===undefined?null:input.value;if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0))throw new WorkspaceError('Valor inválido.');
 const unit=text(input.unit||'',80),basis=text(input.basis||'',80),url=text(input.sourceUrl||'',1500),distributorId=text(input.distributorId||'',150),criterionId=text(input.criterionId||'',150);
 if(url){let parsed:URL;try{parsed=new URL(url);}catch{throw new WorkspaceError('Fuente inválida.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||[...parsed.searchParams.keys()].some(k=>/token|secret|password|signature|api.?key|authorization/i.test(k)))throw new WorkspaceError('La fuente contiene un acceso privado o no admitido.');}
 if(distributorId&&!records.some(r=>r.id===distributorId&&r.kind==='distributor'))throw new WorkspaceError('Distribuidor no registrado.');
 const referenceId=text(input.referenceId||'',150),state=text(input.state||'NotStarted',40),evidence=text(input.evidence||'',2000);
 if(referenceId&&!references.some(r=>r.id===referenceId))throw new WorkspaceError('Referencia no importada en este espacio.');
 if(!['NotStarted','InProgress','Waiting','Completed','NotApplicable'].includes(state))throw new WorkspaceError('Estado de avance inválido.');
 if(input.kind==='evidence'&&(!referenceId||!references.some(r=>r.id===referenceId&&['obligation','control','routine'].includes(r.kind))))throw new WorkspaceError('El avance requiere una obligación, control o contenedor de evidencia importado.');
 if(state==='Completed'&&!evidence&&!url)throw new WorkspaceError('Completar requiere evidencia o fuente.');
 if(input.kind==='sale'&&(value===null||!market||!period||unit!=='cases'||!['sell-in','sell-out'].includes(basis)||!url))throw new WorkspaceError('La venta requiere mercado, período, cases, sell-in/sell-out y fuente.');
 if(input.kind==='score'&&(!references.some(r=>r.id===criterionId&&r.kind==='criterion')||!distributorId||!period||value===null||!unit||!url||!['SMJ','Distribuidor'].includes(basis)))throw new WorkspaceError('La evaluación requiere criterio importado, distribuidor, período, escala, evaluador y fuente.');
 if(input.kind==='fee'&&(!period||value===null||!unit||!['Plan','Aprobado','Recibido'].includes(basis)||!url))throw new WorkspaceError('El honorario requiere período, moneda, estado y fuente.');
 return {kind:input.kind,title,market:market as SmjRecord['market'],period,value,unit,sourceUrl:url,notes:text(input.notes||'',2000),distributorId,criterionId,referenceId,state:state as SmjRecord['state'],evidence,basis};
}
