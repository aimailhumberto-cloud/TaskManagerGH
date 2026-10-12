'use client';
import { useRef, useState } from 'react';
import type { PublicHbView } from '@/lib/publicHbAccess';
import type { Task } from '@/services/mockData';
import type { Entry } from './WorkspaceHub';
import TaskMaster, {type WorkspaceCommand} from './TaskMaster';
import TaskDetail from './TaskDetail';
import CalendarBoard from './CalendarBoard';
import CompanyDashboards from './CompanyDashboards';
import {dailyWork,scheduledWork} from '@/lib/stepWork';
import {todayInPanama,shortDate} from '@/lib/workspaceDisplay';
const noDays=()=>{};
export default function PublicHbWorkspace({entry,initial}:{entry:Entry;initial:PublicHbView}){
 const [view,setView]=useState(initial),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const pending=useRef<{fingerprint:string;requestId:string}|null>(null),locked=useRef(false);
 const command:WorkspaceCommand=async(action,fields,reason,id,revision)=>{
  if(locked.current)return false;
  locked.current=true;setBusy(true);setNotice('Guardando…');
  const stepKeys=new Set('id text completed status assigneeId workDate dueDate nextAction waitingOn dependencyIds evidence sourceUrl cancelled'.split(' '));
  const payload={action,fields:{...fields,...(Array.isArray(fields.steps)?{steps:fields.steps.map(step=>Object.fromEntries(Object.entries(step as Record<string,unknown>).filter(([key])=>stepKeys.has(key))))}:{})},reason,...(id?{id,expectedRevision:revision}: {})};
  const fingerprint=JSON.stringify(payload);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,requestId:crypto.randomUUID()};
  try{
   const proofResponse=await fetch('/api/public/workspace/csrf',{cache:'no-store',credentials:'same-origin'});
   const proof=await proofResponse.json();if(!proofResponse.ok)throw new Error(proof.error||'No se pudo proteger el guardado.');
   const response=await fetch('/api/public/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-public-hb-csrf':proof.token},body:JSON.stringify({...payload,requestId:pending.current.requestId})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'No se confirmó el guardado.');
   const reload=await fetch('/api/public/workspace',{cache:'no-store'});if(!reload.ok)throw new Error('El cambio se guardó, pero no se pudo recargar. Reintenta para verificarlo.');
   const fresh:PublicHbView=await reload.json();setView(fresh);setTask(current=>current?fresh.tasks.find(t=>t.id===current.id)||null:null);
   pending.current=null;setNotice('Cambio guardado en la base.');return true;
  }catch(error){setNotice(error instanceof Error?error.message:'No se confirmó el guardado. Conserva tu edición y reintenta.');return false;}
  finally{locked.current=false;setBusy(false);}
 };
 const [company,setCompany]=useState(''),[query,setQuery]=useState(''),[task,setTask]=useState<Task|null>(null),[all,setAll]=useState(false);
 const today=todayInPanama();const selected=view.tasks.filter(t=>!company||t.companyId===company);
 const openTask=(id:string)=>setTask(view.tasks.find(t=>t.id===id.split('::')[0])||null);
 const props={companies:view.companies,people:view.people,canEdit:true,editableTaskIds:view.publicEditableTaskIds,busy,command,openTask};
 const title=entry==='home'?'Hoy, Humberto':entry==='companies'?'Tus empresas':entry==='agenda'?'Tu tiempo, en perspectiva':'Encuentra tu trabajo';
 return <div className="tm-workspace" data-access="public-hb-tasks"><header className="tm-hero"><span className="tm-eyebrow">TASKMANAGER HB · {shortDate(today)} · PANAMÁ</span><h1>{title}</h1><p>Trabajo público del espacio HB.</p></header><p role="status" className="tm-inline-notice">Cualquier persona con este enlace puede editar las tareas de HB. Las cuentas e integraciones mantienen acceso privado.</p>{notice&&<p role="status" className="tm-inline-notice">{notice}</p>}<nav className="tm-company-tabs" aria-label="Empresas">{[{id:'',name:'Todas'},...view.companies].map(c=><button key={c.id} aria-pressed={company===c.id} onClick={()=>setCompany(c.id)}>{c.name}</button>)}</nav>
 {entry==='home'&&<><nav className="tm-tabs"><button onClick={()=>setAll(false)} aria-pressed={!all}>Hoy</button><button onClick={()=>setAll(true)} aria-pressed={all}>Todas las tareas</button></nav><TaskMaster tasks={all?selected:dailyWork(selected,today)} sourceTasks={view.tasks} companyId={company} variant={all?'table':'today'} {...props}/></>}
 {entry==='companies'&&<><CompanyDashboards tasks={view.tasks} companies={view.companies} projects={view.projects} selected={company} choose={setCompany}/><TaskMaster tasks={selected} companyId={company} {...props}/></>}
 {entry==='agenda'&&<CalendarBoard tasks={scheduledWork(selected)} companies={view.companies} snapshot={null} companyId={company} selectCompany={setCompany} daysChanged={noDays} openTask={openTask}/>}
 {entry==='search'&&<section className="tm-pane tm-pane-dark"><h2>Buscar trabajo HB</h2><input className="tm-search-input" aria-label="Buscar trabajo HB" value={query} onChange={e=>setQuery(e.target.value)}/>{query.trim()&&selected.filter(t=>[t.title,t.nextAction,t.description,...t.steps.map(s=>s.text)].some(v=>v?.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))).map(t=><button key={t.id} className="tm-work-card" onClick={()=>openTask(t.id)}>{t.title}</button>)}</section>}
 {task&&<div className="tm-modal-backdrop"><div className="tm-modal" role="dialog" aria-modal="true" aria-label="Consulta de tarea HB"><button className="tm-close" aria-label="Cerrar detalle" onClick={()=>setTask(null)}>×</button><TaskDetail task={task} tasks={view.tasks} companies={view.companies} people={view.people} canEdit={view.publicEditableTaskIds.includes(task.id)} busy={busy} command={command}/></div></div>}
 </div>;
}
