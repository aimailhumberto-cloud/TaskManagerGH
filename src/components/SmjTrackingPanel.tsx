'use client';
import {useEffect,useRef,useState} from 'react';
import {secureFetch} from '@/lib/secureFetch';
import type {SmjTracking,SmjRecord,SmjRecordKind} from '@/lib/smjTracking';
const stateNames:Record<string,string>={NotStarted:'Sin iniciar',InProgress:'En curso',Waiting:'Esperando',Completed:'Completado',NotApplicable:'No aplica'};
const labels:Record<SmjRecordKind,string>={distributor:'Distribuidores registrados',sale:'Ventas acreditadas',score:'Evaluaciones registradas',fee:'Honorarios y reembolsos registrados',evidence:'Evidencia de obligaciones y rutinas'};
export default function SmjTrackingPanel({kind,market,period,canEdit,onTracking,privateAccess=false}:{kind:SmjRecordKind;market:string;period:string;canEdit:boolean;onTracking?:(data:SmjTracking|null)=>void;privateAccess?:boolean}){
 const [data,setData]=useState<SmjTracking|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState<SmjRecord|null>(null),[open,setOpen]=useState(false),[loaded,setLoaded]=useState(false);
 const pending=useRef<{fingerprint:string;requestId:string}|null>(null),lock=useRef(false);
 const [selectedReference,setSelectedReference]=useState('');
 const [selectedCriterion,setSelectedCriterion]=useState('');
 const [evidenceFilter,setEvidenceFilter]=useState<'obligations'|'routines'|'all'>('obligations');
 const [search,setSearch]=useState('');
 const readEndpoint=privateAccess?'/api/workspace':'/api/public/workspace';
 async function reload(){const response=await fetch(readEndpoint,{cache:'no-store'});if(!response.ok)throw new Error('No se pudo leer el seguimiento SMJ.');const value=await response.json();setData(value.smjTracking||null);onTracking?.(value.smjTracking||null);setLoaded(true);return value.smjTracking as SmjTracking|null;}
 useEffect(()=>{let active=true;setLoaded(false);fetch(readEndpoint,{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('No se pudo leer el seguimiento SMJ.');return response.json();}).then(value=>{if(active){setData(value.smjTracking||null);onTracking?.(value.smjTracking||null);setLoaded(true);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[kind,onTracking,readEndpoint]);
 useEffect(()=>{setOpen(false);setEditing(null);setSelectedReference('');setSelectedCriterion('');setError('');},[kind]);
 const records=(data?.records||[]).filter(r=>r.kind===kind&&(!market||r.market===market)&&(!period||r.period===period));
 const refs=data?.references||[];
 const obligations=refs.filter(r=>r.kind==='obligation'||r.kind==='control');
 const routines=refs.filter(r=>r.kind==='routine'&&(!period||r.period===period));
 const visibleEvidence=(evidenceFilter==='obligations'?obligations:evidenceFilter==='routines'?routines:[...obligations,...routines]).filter(r=>!search.trim()||[r.title,r.sourceId,r.nextAction,r.frequency].some(v=>v?.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))));
 async function save(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(lock.current)return;const form=event.currentTarget,values=Object.fromEntries(new FormData(form));const {reason,...raw}=values;const fields={...raw,kind,value:raw.value===''?null:Number(raw.value)};
  const payload={fields,reason,...(editing?{id:editing.id,expectedRevision:editing.revision}:{})};const fingerprint=JSON.stringify(payload);if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,requestId:crypto.randomUUID()};lock.current=true;setBusy(true);setError('');
  try{let response:Response;const encoded=JSON.stringify({...payload,requestId:pending.current.requestId});if(privateAccess){response=await secureFetch('/api/workspace/smj',{method:'POST',headers:{'Content-Type':'application/json'},body:encoded});}else{const csrf=await fetch('/api/public/workspace/csrf',{cache:'no-store'});const proof=await csrf.json();if(!csrf.ok)throw new Error(proof.error||'No se pudo proteger el guardado.');response=await fetch('/api/public/workspace/smj',{method:'POST',headers:{'Content-Type':'application/json','x-public-hb-csrf':proof.token},body:encoded});}const result=await response.json();if(!response.ok)throw new Error(result.error||'No se confirmó el guardado.');await reload();pending.current=null;setOpen(false);setEditing(null);}
  catch(e){setError(e instanceof Error?e.message:'Guardado no confirmado; conserva tu edición.');}finally{lock.current=false;setBusy(false);}
 }
 const saleSubtotals=['sell-in','sell-out'].map(basis=>({basis,records:records.filter(r=>r.basis===basis&&r.value!==null)}));
 return <section className="tm-pane tm-pane-navy tm-smj-section" aria-label={labels[kind]}><div className="tm-heading"><h2>{labels[kind]}</h2><span className="tm-count">{records.length}</span></div>
  {error&&<p role="alert">{error}</p>}{!loaded&&!error&&<p role="status">Leyendo seguimiento…</p>}
  <p className="tm-small">{data?.source?`Fuente cotejada: ${data.source.fileName}, versión ${data.source.version}.`:'Excel aún no cargado ni cotejado en este equipo. Las referencias contractuales se mantienen separadas de resultados reales.'}</p>
  {kind==='evidence'&&<>
   <div className="tm-smj-evidence-toolbar">
    <div className="tm-tabs" role="group" aria-label="Filtrar tipo de obligación">
     <button type="button" aria-pressed={evidenceFilter==='obligations'} onClick={()=>setEvidenceFilter('obligations')}>Obligaciones y Controles ({obligations.length})</button>
     <button type="button" aria-pressed={evidenceFilter==='routines'} onClick={()=>setEvidenceFilter('routines')}>Rutinas Mensuales ({routines.length})</button>
     <button type="button" aria-pressed={evidenceFilter==='all'} onClick={()=>setEvidenceFilter('all')}>Todas ({obligations.length+routines.length})</button>
    </div>
    <input className="tm-smj-search" aria-label="Buscar obligación o rutina" placeholder="Buscar cláusula, código o rutina…" value={search} onChange={e=>setSearch(e.target.value)}/>
   </div>
   <div className="tm-smj-exec-grid">
    {visibleEvidence.map(r=>{const current=data?.records.find(record=>record.kind==='evidence'&&record.referenceId===r.id);return <article className="tm-smj-exec-card" key={r.id}>
     <div className="tm-smj-card-top">
      <span className="tm-status">{r.sourceId||(r.kind==='control'?'CONTROL':r.kind==='routine'?`RUTINA ${r.period||''}`:'OBLIGACIÓN')}</span>
      {r.frequency&&<span className="tm-count">{r.frequency}</span>}
      <span className={`tm-status ${current?.state==='Completed'?'tm-status-teal':''}`}>{current?stateNames[current.state||'NotStarted']:'Sin iniciar'}</span>
     </div>
     <strong>{r.title}</strong>
     {r.nextAction&&<p className="tm-small">{r.nextAction}</p>}
     <details className="tm-smj-card-details"><summary>Criterio y evidencia esperada</summary><p>{r.completionCriterion||'Criterio según cláusula contractual.'}</p><p>{r.expectedEvidence||'Evidencia documental por adjuntar.'}</p><p className="tm-small">Frecuencia: {r.frequency||'No especificada'}</p></details>
     {canEdit&&<div className="tm-smj-card-foot"><button className="tm-soft-button" aria-label={`Registrar avance: ${r.title}`} onClick={()=>{setSelectedReference(r.id);setEditing(current||null);setOpen(true);}}>Registrar avance</button></div>}
    </article>;})}
   </div>
  </>}
  {kind==='score'&&<>
   <p className="tm-small">{refs.filter(r=>r.kind==='criterion').length} criterios contractuales cotejados (100 % ponderado). Las evaluaciones de SMJ y distribuidor se registran por separado.</p>
   <div className="tm-smj-exec-grid">
    {refs.filter(r=>r.kind==='criterion').map(r=>{const evalRecord=records.find(rec=>rec.criterionId===r.id);return <article className="tm-smj-exec-card" key={r.id}>
     <div className="tm-smj-card-top"><span className="tm-status">{r.sourceId||'SC'}</span><span className="tm-count">Peso: {r.weight}%</span></div>
     <strong>{r.title}</strong>
     <progress value={r.weight||0} max={20}/>
     <div className="tm-smj-card-foot">
      <span className={`tm-status ${evalRecord?'tm-status-teal':''}`}>{evalRecord?`${evalRecord.value} ${evalRecord.unit} · ${evalRecord.basis}`:'Sin evaluar'}</span>
      {canEdit&&<button className="tm-soft-button" onClick={()=>{setSelectedCriterion(r.id);setEditing(evalRecord||null);setOpen(true);}}>Evaluar</button>}
     </div>
    </article>;})}
   </div>
  </>}
  {kind==='fee'&&<div className="tm-smj-exec-grid tm-smj-fee-grid">{['Plan','Aprobado','Recibido'].map(basis=>{const list=records.filter(r=>r.basis===basis&&r.value!==null);const total=list.reduce((sum,r)=>sum+(r.value||0),0);return <article className="tm-smj-exec-card" key={basis}><span className="tm-eyebrow">{basis==='Plan'?'Planificado':basis==='Aprobado'?'Aprobado':'Cobrado / Recibido'}</span><strong className="tm-kpi-value">{list.length?new Intl.NumberFormat('es').format(total):'Sin registros'}</strong><small className="tm-small">{list.length} registros en este filtro</small></article>;})}</div>}
  {kind==='sale'&&records.length>0&&<div aria-label="Subtotales de ventas por base">{saleSubtotals.map(group=><p key={group.basis}>{group.basis}: {group.records.length?new Intl.NumberFormat('es').format(group.records.reduce((sum,r)=>sum+r.value!,0))+' cases':'Sin registrar'} en este filtro.</p>)}<p className="tm-small">Cada base se presenta por separado. Estos registros no acreditan automáticamente cumplimiento contractual.</p></div>}
  {!records.length&&loaded&&<p className="tm-empty">Sin resultados registrados en este ámbito. No se interpreta como cero.</p>}
  {records.map(record=><article className="tm-smj-source-card" key={record.id}><strong>{record.title}</strong><p>{record.market} · {record.period||'Sin período'} · {record.value===null?'Sin cifra':record.value+' '+record.unit} · {record.basis}</p><p>{record.notes}</p><p>Avance: {stateNames[record.state||'NotStarted']}{record.referenceId&&' · '+(refs.find(r=>r.id===record.referenceId)?.title||record.referenceId)}</p><p>{record.evidence}</p>{record.sourceUrl&&<a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir evidencia</a>}{canEdit&&<button className="tm-soft-button" onClick={()=>{setEditing(record);setOpen(true);}}>Editar registro</button>}<small> Revisión {record.revision}</small></article>)}
  {canEdit&&!open&&<button className="tm-gold-button" disabled={!loaded||kind==='score'&&!refs.some(r=>r.kind==='criterion')||kind==='evidence'&&!refs.some(r=>['obligation','control','routine'].includes(r.kind))} onClick={()=>{setEditing(null);setSelectedReference('');setSelectedCriterion('');setOpen(true);}}>Añadir registro</button>}
  {canEdit&&open&&<form className="tm-form-grid" key={editing?.id||'new'} aria-label="Registro SMJ" onSubmit={save}>
   <label className="tm-wide">Título<input name="title" defaultValue={editing?.title||refs.find(r=>r.id===(selectedReference||selectedCriterion))?.title||''} required maxLength={240}/></label>
   <label className="tm-wide">Referencia importada<select aria-label="Referencia importada" name="referenceId" defaultValue={editing?.referenceId||selectedReference}><option value="">Sin vincular</option>{refs.filter(r=>kind!=='evidence'||['obligation','control','routine'].includes(r.kind)).map(r=><option key={r.id} value={r.id}>{r.title} · {r.sourceId||`${r.sheet}:${r.row}`}</option>)}</select></label>
   <label>Estado de avance<select aria-label="Estado de avance" name="state" defaultValue={editing?.state||'NotStarted'}>{[['NotStarted','Sin iniciar'],['InProgress','En curso'],['Waiting','Esperando'],['Completed','Completado'],['NotApplicable','No aplica']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label className="tm-wide">Evidencia del avance<textarea name="evidence" defaultValue={editing?.evidence||''} maxLength={2000}/></label>
   <label>Mercado<select aria-label="Mercado" name="market" defaultValue={editing?.market||market}><option value="">Sin mercado</option><option>Canada</option><option>USA</option></select></label>
   <label>Período<input type="month" name="period" defaultValue={editing?.period||period}/></label>
   <label>Valor<input name="value" type="number" step="any" min="0" defaultValue={editing?.value??''}/></label>
   <label>Unidad o escala<input name="unit" defaultValue={editing?.unit||(kind==='sale'?'cases':'')} maxLength={80}/></label>
   <label>Base del registro<select name="basis" defaultValue={editing?.basis||''}><option value="">Sin base</option>{(kind==='sale'?['sell-in','sell-out']:kind==='score'?['SMJ','Distribuidor']:kind==='fee'?['Plan','Aprobado','Recibido']:['Verificación','Evidencia']).map(b=><option key={b}>{b}</option>)}</select></label>
   <label>Distribuidor<select name="distributorId" defaultValue={editing?.distributorId||''}><option value="">Sin vincular</option>{data?.records.filter(r=>r.kind==='distributor').map(r=><option value={r.id} key={r.id}>{r.title}</option>)}</select></label>
   <label>Criterio<select name="criterionId" defaultValue={editing?.criterionId||selectedCriterion||''}><option value="">No aplica</option>{refs.filter(r=>r.kind==='criterion').map(r=><option key={r.id} value={r.id}>{r.title} · {r.weight}%</option>)}</select></label>
   <label className="tm-wide">Fuente de evidencia<input name="sourceUrl" type="url" defaultValue={editing?.sourceUrl||''} maxLength={1500}/></label>
   <label className="tm-wide">Notas<textarea name="notes" defaultValue={editing?.notes||''} maxLength={2000}/></label>
   <label className="tm-wide">Motivo del registro<input name="reason" required maxLength={600}/></label>
   <p className="tm-small tm-wide">El título, notas y fuente serán visibles en el espacio público HB. No incluyas contactos privados, secretos ni documentos sensibles.</p>
   <button className="tm-gold-button" disabled={busy}>Guardar registro</button><button type="button" className="tm-soft-button" disabled={busy} onClick={()=>{setOpen(false);setEditing(null);}}>Cancelar</button>
  </form>}
 </section>;
}
