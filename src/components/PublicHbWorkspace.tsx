'use client';
import { useEffect, useRef, useState } from 'react';
import SmjCompanyCenter from './SmjCompanyCenter';
import LegacyProjectDetail from './LegacyProjectDetail';
import {SMJ_COMPANY_ID} from '@/lib/smjCenter';
import type { PublicHbView } from '@/lib/publicHbAccess';
import type { Task } from '@/services/mockData';
import type { Entry } from './WorkspaceHub';
import TaskMaster, {type WorkspaceCommand} from './TaskMaster';
import TaskDetail from './TaskDetail';
import CalendarBoard from './CalendarBoard';
import CompanyDashboards from './CompanyDashboards';
import DecisionPanel from './DecisionPanel';
import WorkspaceIcon from './WorkspaceIcon';
import {projectProgress} from '@/lib/projects';
import {boardItems} from '@/lib/calendarBoard';
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
 const [projectId,setProjectId]=useState<string|null>(null);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const id=params.get('company');if(initial.companies.some(c=>c.id===id))setCompany(id!);},[initial.companies]);
 const today=todayInPanama();const selected=view.tasks.filter(t=>!company||t.companyId===company);
 const active=selected.filter(t=>!t.cancelledAt&&t.validationStatus!=='NeedsConfirmation');
 const todays=dailyWork(active,today);
 const pendingToday=todays.filter(t=>t.status!=='Completed');
 const doneToday=todays.length-pendingToday.length;
 const dueOrCarryover=active.filter(t=>t.status!=='Completed'&&((t.workDate&&t.workDate<today)||(t.dueDate&&t.dueDate.slice(0,10)<=today)));
 const activeProjects=view.projects.filter(p=>p.state!=='Cancelled'&&(!company||p.companyId===company));
 const totalDeliverables=activeProjects.reduce((sum,p)=>sum+projectProgress(p).total,0)+active.filter(t=>t.type==='Project').reduce((sum,t)=>sum+t.steps.filter(s=>!s.cancelled).length,0);
 const doneDeliverables=activeProjects.reduce((sum,p)=>sum+projectProgress(p).accepted,0)+active.filter(t=>t.type==='Project').reduce((sum,t)=>sum+t.steps.filter(s=>!s.cancelled&&s.completed).length,0);
 const upcoming=boardItems(selected.filter(t=>t.isMeeting&&!t.cancelledAt&&t.status!=='Completed'),null).filter(i=>i.day>=today&&(!company||i.companyId===company)).sort((a,b)=>a.day.localeCompare(b.day)||(a.minute||0)-(b.minute||0));
 const unconfirmed=selected.filter(t=>t.validationStatus==='NeedsConfirmation'&&!t.cancelledAt);
 const openTask=(id:string)=>setTask(view.tasks.find(t=>t.id===id.split('::')[0])||null);
 const props={companies:view.companies,people:view.people,canEdit:true,editableTaskIds:view.publicEditableTaskIds,busy,command,openTask};
 const title=entry==='home'?'Hoy, Humberto':entry==='companies'?'Tus empresas':entry==='agenda'?'Tu tiempo, en perspectiva':'Encuentra tu trabajo';
 return <div className="tm-workspace" data-access="public-hb-tasks"><header className="tm-hero"><div className="tm-hero-copy"><span className="tm-eyebrow">TASKMANAGER HB · {shortDate(today)} · PANAMÁ</span><h1>{title}</h1><p>{entry==='home'?'Un solo día. Todas tus empresas y contratos en un pantallazo.':entry==='companies'?'Tareas, pasos y seguimiento contractual conectado.':'Tu tiempo, reuniones y fuentes en perspectiva.'}</p></div><span className="tm-connection-pill"><WorkspaceIcon name="source" size={16}/>Espacio Ejecutivo HB · Activo</span></header>{notice&&<p role="status" className="tm-inline-notice">{notice}</p>}<nav className="tm-company-tabs" aria-label="Empresas">{[{id:'',name:'Todas'},...view.companies].map((c,i)=><button key={c.id} aria-pressed={company===c.id} onClick={()=>setCompany(c.id)}><span className={`tm-chip-icon tm-chip-${i%5}`}><WorkspaceIcon name={c.id?'company':'task'} size={18}/></span>{c.name}</button>)}</nav>
 {entry==='home'&&<>
  <section className="tm-executive-kpis" aria-label="Resumen ejecutivo del día">
   <article className="tm-pane tm-pane-dark tm-kpi-card">
    <div className="tm-kpi-top"><span className="tm-eyebrow">Operación Hoy</span><span className="tm-status tm-status-teal">{todays.length?Math.round((doneToday/todays.length)*100):0}%</span></div>
    <strong className="tm-kpi-value">{doneToday} <small>/ {todays.length} ejecutadas</small></strong>
    <span className="tm-small">{pendingToday.length} pendientes para hoy</span>
    <progress value={doneToday} max={todays.length||1}/>
   </article>
   <article className="tm-pane tm-pane-dark tm-kpi-card tm-kpi-gold">
    <div className="tm-kpi-top"><span className="tm-eyebrow">Por Vencer & Alertas</span><span className="tm-status">{dueOrCarryover.length?'Atención':'Al día'}</span></div>
    <strong className="tm-kpi-value">{dueOrCarryover.length} <small>por atender</small></strong>
    <span className="tm-small">{dueOrCarryover.filter(t=>t.workDate&&t.workDate<today).length} arrastradas · {dueOrCarryover.filter(t=>t.dueDate&&t.dueDate.slice(0,10)<=today).length} vencen hoy</span>
   </article>
   <article className="tm-pane tm-pane-dark tm-kpi-card">
    <div className="tm-kpi-top"><span className="tm-eyebrow">Entregables Clave</span><span className="tm-count">{activeProjects.length+active.filter(t=>t.type==='Project').length} proy.</span></div>
    <strong className="tm-kpi-value">{doneDeliverables} <small>/ {totalDeliverables} hitos</small></strong>
    <span className="tm-small">Pasos y entregables completados</span>
    <progress value={doneDeliverables} max={totalDeliverables||1}/>
   </article>
   <article className="tm-pane tm-pane-navy tm-kpi-card">
    <div className="tm-kpi-top"><span className="tm-eyebrow">Próxima Reunión</span><WorkspaceIcon name="calendar" size={16}/></div>
    <strong className="tm-kpi-value">{upcoming[0]?(upcoming[0].minute===null?'Todo el día':`${String(Math.floor(upcoming[0].minute/60)).padStart(2,'0')}:${String(upcoming[0].minute%60).padStart(2,'0')}`):'Sin citas'}</strong>
    <span className="tm-small">{upcoming[0]?`${shortDate(upcoming[0].day)} · ${upcoming[0].title}`:'Agenda despejada hoy'}</span>
   </article>
  </section>
  {company===SMJ_COMPANY_ID?<SmjCompanyCenter initialTracking={view.smjTracking} tasks={view.tasks} projects={view.projects} openProject={setProjectId} {...props}/>:<>
   <div className="tm-day-toolbar"><nav aria-label="Vistas de trabajo"><button onClick={()=>setAll(false)} aria-pressed={!all}>Hoy <span>{pendingToday.length}</span></button><button onClick={()=>setAll(true)} aria-pressed={all}>Todas las tareas <span>{selected.length}</span></button></nav><span className="tm-day-summary">{doneToday} completadas · {pendingToday.length} pendientes</span></div>
   {all?<TaskMaster tasks={selected} sourceTasks={view.tasks} companyId={company} variant="table" {...props}/>:<div className="tm-dashboard-columns">
    <TaskMaster tasks={todays} sourceTasks={view.tasks} companyId={company} variant="today" {...props}/>
    <aside className="tm-dashboard-side">
     <section className="tm-pane tm-pane-navy" aria-label="Próximas reuniones">
      <div className="tm-heading tm-heading-icon"><WorkspaceIcon name="calendar"/><h2>Tu agenda</h2></div>
      <div className="tm-agenda-timeline" tabIndex={0} aria-label="Recorrer próximas reuniones">
       {upcoming.map(i=><div className="tm-agenda-entry" key={i.id}><span className="tm-timeline-dot"/><span className="tm-eyebrow">{shortDate(i.day)} · {i.minute===null?'Todo el día':`${String(Math.floor(i.minute/60)).padStart(2,'0')}:${String(i.minute%60).padStart(2,'0')}`}</span>{i.taskId?<button onClick={()=>openTask(i.taskId!)}>{i.title}</button>:<a href={i.url} target="_blank" rel="noopener noreferrer">{i.title}</a>}<small>{i.source}</small></div>)}
       {!upcoming.length&&<p className="tm-empty">Sin reuniones programadas en este filtro.</p>}
      </div>
      <a className="tm-arrow-link" href="/agenda">Ver calendario <WorkspaceIcon name="arrow" size={17}/></a>
     </section>
     {!!activeProjects.length&&<section className="tm-pane tm-pane-dark" aria-label="Proyectos y entregables"><div className="tm-heading"><h2>Entregables activos</h2><span className="tm-count">{activeProjects.length}</span></div>{activeProjects.map(p=><button className="tm-work-card" key={p.id} onClick={()=>setProjectId(p.id)}><span className="tm-work-copy"><strong>{p.title}</strong><span>{p.objective}</span></span><span className="tm-status">{projectProgress(p).accepted}/{projectProgress(p).total}</span></button>)}</section>}
    </aside>
    {!!unconfirmed.length&&<section className="tm-pane tm-pane-stone tm-confirmation-panel" aria-label="Pendientes por confirmar"><div className="tm-heading"><h2>Registros por verificar</h2><span className="tm-count">{unconfirmed.length}</span></div>{unconfirmed.map(t=><button className="tm-confirmation-item" key={t.id} onClick={()=>openTask(t.id)}>{t.title}<small>{view.companies.find(c=>c.id===t.companyId)?.name}</small></button>)}<p className="tm-small">Verificar vigencia antes de planificar.</p></section>}
   </div>}
   <DecisionPanel decisions={view.decisions||[]} companies={view.companies} projects={view.projects} companyId={company} pendingOnly canEdit={false} busy={busy} command={command}/>
  </>}
  <section className="tm-company-overview" aria-label="Avance por empresa">{view.companies.filter(c=>!company||company===c.id).map(c=>{const work=view.tasks.filter(t=>t.companyId===c.id&&!t.cancelledAt&&t.validationStatus!=='NeedsConfirmation');const done=work.filter(t=>t.status==='Completed').length;const todayPending=todays.filter(t=>t.companyId===c.id&&t.status!=='Completed').length;return <button key={c.id} className="tm-company-progress" onClick={()=>{setCompany(c.id);if(c.id!==SMJ_COMPANY_ID)setAll(true);}}><span className="tm-heading-icon"><WorkspaceIcon name="company" size={20}/><strong>{c.name}</strong></span><span>{c.id===SMJ_COMPANY_ID?`Centro Contractual · 301k cases · ${work.length} tareas`:`${done}/${work.length} tareas completadas${todayPending?` · ${todayPending} hoy`:''}`}</span><progress value={done} max={work.length||1}/></button>;})}</section>
 </>}
 {entry==='companies'&&(company===SMJ_COMPANY_ID?<SmjCompanyCenter initialTracking={view.smjTracking} tasks={view.tasks} projects={view.projects} openProject={setProjectId} {...props}/>:<><CompanyDashboards tasks={view.tasks} companies={view.companies} projects={view.projects} selected={company} choose={setCompany}/><TaskMaster tasks={selected} companyId={company} {...props}/></>)}
 {entry==='agenda'&&<CalendarBoard tasks={scheduledWork(selected)} companies={view.companies} snapshot={null} companyId={company} selectCompany={setCompany} daysChanged={noDays} openTask={openTask}/>}
 {entry==='search'&&<section className="tm-pane tm-pane-dark"><h2>Buscar trabajo HB</h2><input className="tm-search-input" aria-label="Buscar trabajo HB" value={query} onChange={e=>setQuery(e.target.value)}/>{query.trim()&&selected.filter(t=>[t.title,t.nextAction,t.description,...t.steps.map(s=>s.text)].some(v=>v?.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))).map(t=><button key={t.id} className="tm-work-card" onClick={()=>openTask(t.id)}>{t.title}</button>)}</section>}
 {task&&<div className="tm-modal-backdrop"><div className="tm-modal" role="dialog" aria-modal="true" aria-label="Consulta de tarea HB"><button className="tm-close" aria-label="Cerrar detalle" onClick={()=>setTask(null)}>×</button><TaskDetail task={task} tasks={view.tasks} companies={view.companies} people={view.people} canEdit={view.publicEditableTaskIds.includes(task.id)} busy={busy} command={command}/></div></div>}
 {projectId&&view.projects.find(p=>p.id===projectId)&&<div className="tm-modal-backdrop"><div className="tm-modal" role="dialog" aria-modal="true" aria-label="Proyecto HB"><button className="tm-close" aria-label="Cerrar proyecto" onClick={()=>setProjectId(null)}>×</button><LegacyProjectDetail project={view.projects.find(p=>p.id===projectId)!} tasks={view.tasks} people={view.people} actorId={view.actorId} canEdit={false} busy={busy} command={command}/></div></div>}
 </div>;
}
