'use client';
import { useState } from 'react';
import type { PublicHbView } from '@/lib/publicHbAccess';
import type { Task } from '@/services/mockData';
import type { Entry } from './WorkspaceHub';
import TaskMaster, {type WorkspaceCommand} from './TaskMaster';
import TaskDetail from './TaskDetail';
import CalendarBoard from './CalendarBoard';
import CompanyDashboards from './CompanyDashboards';
import {dailyWork,scheduledWork} from '@/lib/stepWork';
import {todayInPanama,shortDate} from '@/lib/workspaceDisplay';
const noWrite:WorkspaceCommand=async()=>false;
const noDays=()=>{};
export default function PublicHbWorkspace({entry,initial}:{entry:Entry;initial:PublicHbView}){
 const [company,setCompany]=useState(''),[query,setQuery]=useState(''),[task,setTask]=useState<Task|null>(null),[all,setAll]=useState(false);
 const today=todayInPanama();const selected=initial.tasks.filter(t=>!company||t.companyId===company);
 const openTask=(id:string)=>setTask(initial.tasks.find(t=>t.id===id.split('::')[0])||null);
 const props={companies:initial.companies,people:initial.people,canEdit:false,busy:false,command:noWrite,openTask};
 const title=entry==='home'?'Hoy, Humberto':entry==='companies'?'Tus empresas':entry==='agenda'?'Tu tiempo, en perspectiva':'Encuentra tu trabajo';
 return <div className="tm-workspace" data-access="public-hb-readonly"><header className="tm-hero"><span className="tm-eyebrow">TASKMANAGER HB · {shortDate(today)} · PANAMÁ</span><h1>{title}</h1><p>Consulta pública del espacio HB.</p></header><p role="status" className="tm-inline-notice">Solo lectura. La administración de cuentas, las integraciones y los cambios requieren acceso privado.</p><nav className="tm-company-tabs" aria-label="Empresas">{[{id:'',name:'Todas'},...initial.companies].map(c=><button key={c.id} aria-pressed={company===c.id} onClick={()=>setCompany(c.id)}>{c.name}</button>)}</nav>
 {entry==='home'&&<><nav className="tm-tabs"><button onClick={()=>setAll(false)} aria-pressed={!all}>Hoy</button><button onClick={()=>setAll(true)} aria-pressed={all}>Todas las tareas</button></nav><TaskMaster tasks={all?selected:dailyWork(selected,today)} sourceTasks={initial.tasks} companyId={company} variant={all?'table':'today'} {...props}/></>}
 {entry==='companies'&&<><CompanyDashboards tasks={initial.tasks} companies={initial.companies} projects={initial.projects} selected={company} choose={setCompany}/><TaskMaster tasks={selected} companyId={company} {...props}/></>}
 {entry==='agenda'&&<CalendarBoard tasks={scheduledWork(selected)} companies={initial.companies} snapshot={null} companyId={company} selectCompany={setCompany} daysChanged={noDays} openTask={openTask}/>}
 {entry==='search'&&<section className="tm-pane tm-pane-dark"><h2>Buscar trabajo HB</h2><input className="tm-search-input" aria-label="Buscar trabajo HB" value={query} onChange={e=>setQuery(e.target.value)}/>{query.trim()&&selected.filter(t=>[t.title,t.nextAction,t.description,...t.steps.map(s=>s.text)].some(v=>v?.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es')))).map(t=><button key={t.id} className="tm-work-card" onClick={()=>openTask(t.id)}>{t.title}</button>)}</section>}
 {task&&<div className="tm-modal-backdrop"><div className="tm-modal" role="dialog" aria-modal="true" aria-label="Consulta de tarea HB"><button className="tm-close" aria-label="Cerrar detalle" onClick={()=>setTask(null)}>×</button><TaskDetail task={task} tasks={initial.tasks} companies={initial.companies} people={initial.people} canEdit={false} busy={false} command={noWrite}/></div></div>}
 </div>;
}
