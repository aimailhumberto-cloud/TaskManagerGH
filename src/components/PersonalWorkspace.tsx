'use client';
import { secureFetch } from '@/lib/secureFetch';
import { Fragment, useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/projects';
import type { Company, Person, Task } from '@/services/mockData';
import { belongsTo, localDay, taskInView, PersonalView } from '@/lib/personalTasks';
import { mapApiToDb } from '@/lib/mappings';

const views: [PersonalView, string][] = [['today', 'Hoy'], ['week', 'Semana'], ['waiting', 'Esperando'], ['approval', 'Por aprobar'], ['confirmation', 'Por confirmar'], ['all', 'Todas']];
const control = 'w-full rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm text-primary-900';
function fromApi(task: Task): Task {
  return { ...task, status: mapApiToDb.status(task.status) || task.status, priority: mapApiToDb.priority(task.priority) || task.priority, type: mapApiToDb.type(task.type) || task.type, origin: mapApiToDb.origin(task.origin) || task.origin };
}
export default function PersonalWorkspace({ initialTasks, people, companies, ownerId: initialOwner, projects: linkedProjects = [], initialBusiness = '', initialTaskId = '', initialProjectId = '', grouped = false, canEdit = true, onSaved }: { initialTasks: Task[]; people: Person[]; companies: Company[]; ownerId: string; projects?: Project[]; initialBusiness?: string; initialTaskId?: string; initialProjectId?: string; grouped?: boolean; canEdit?: boolean; onSaved?: () => Promise<void> }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [ownerId, setOwnerId] = useState(initialOwner);
  const [view, setView] = useState<PersonalView>('today');
  const [business, setBusiness] = useState(initialBusiness);
  const [project, setProject] = useState(initialProjectId);
  const zone = 'America/Panama';
  const [today, setToday] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Task | null>(null);
  const [reason, setReason] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const openedDeepLink = useRef(false);
  useEffect(() => {
    const target = initialTasks.find(t => t.id === initialTaskId);
    if (target && canEdit && !openedDeepLink.current) { setDraft({ ...target }); openedDeepLink.current = true; }
  }, [initialTaskId, initialTasks, canEdit]);
  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => setBusiness(initialBusiness), [initialBusiness]);
  useEffect(() => {
    const timeZone = 'America/Panama';
    const refresh = () => setToday(localDay(new Date(), timeZone));
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  const owner = people.find(person => person.id === ownerId);
  const mine = tasks.filter(task => belongsTo(task, ownerId));
  const selectedProject = linkedProjects.find(p => p.id === project);
  const filtered = mine.filter(task => (!business || task.companyId === business) && (!project || (selectedProject ? task.projectId === selectedProject.id : task.projectName === project)));
  const inView = (task: Task, key: PersonalView) => !!today && taskInView(task, key, today) && (key === 'all' || !linkedProjects.some(p => p.id === task.projectId && p.state === 'Cancelled'));
  const visible = filtered.filter(task => inView(task, view)).sort((a, b) => {
    const date = (task: Task) => [task.workDate, task.dueDate?.slice(0, 10), task.followUpDate].filter(Boolean).sort()[0] || '9999';
    return (grouped ? a.companyId.localeCompare(b.companyId) : 0) || date(a).localeCompare(date(b)) || a.title.localeCompare(b.title);
  });
  const projects = Array.from(new Set(mine.filter(t => !t.projectId).map(task => task.projectName).filter((value): value is string => !!value))).sort();
  async function request(action: string, id: string | undefined, payload: unknown, expectedRevision?: number, changeReason = '') {
    const fingerprint = JSON.stringify({ action, id, fields: payload, expectedRevision, reason: changeReason });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, requestId: crypto.randomUUID() };
    const response = await secureFetch('/api/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...JSON.parse(fingerprint), requestId: pending.current!.requestId }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar.');
    pending.current = null;
    return fromApi(data);
  }
  async function capture(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !ownerId || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const task = await request('createTask', undefined, { title: title.trim(), companyId: selectedProject?.companyId || business || companies[0]?.id, assigneeId: ownerId, ownerId, projectName: selectedProject?.title || project, projectId: selectedProject?.id || '', dueDate: '', workDate: today, approvalStatus: 'NotRequired' });
      setTasks(current => [...current, task]); setTitle(''); setNotice('Tarea capturada para hoy.');
      await onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo capturar.'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const task = await request('updateTask', draft.id, { title: draft.title.trim(), companyId: draft.companyId, assigneeId: draft.assigneeId, ownerId: draft.ownerId || ownerId, projectName: draft.projectName || '', projectId: draft.projectId || '', deliverableId: draft.deliverableId || '', dependencyIds: draft.dependencyIds || [], steps: draft.steps, repeatPattern: draft.repeatPattern || '', isMeeting: !!draft.isMeeting, meetingTime: draft.meetingTime || '', nextAction: draft.nextAction || '', dueDate: draft.dueDate, workDate: draft.workDate || '', waitingOn: draft.waitingOn || '', commitment: draft.commitment || '', followUpDate: draft.followUpDate || '', approvalStatus: draft.approvalStatus || 'NotRequired', status: draft.status, priority: draft.priority, estimatedMinutes: draft.estimatedMinutes ?? null, workSlot: draft.workSlot || '', workTime: draft.workTime || '', validationStatus: draft.validationStatus || 'Confirmed', sourceUrl: draft.sourceUrl || '', contextNotes: draft.contextNotes || '' }, draft.revision || 0, reason);
      setTasks(current => current.map(item => item.id === task.id ? task : item));
      setDraft(null); setNotice('Cambios guardados.');
      await onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  function field(key: keyof Task, value: string) { setDraft(current => current ? { ...current, [key]: value } : current); }
  async function changeLifecycle(action: 'cancel' | 'restore', revision?: number) {
    if (!draft || busy || !reason.trim()) { setError('Escribe el motivo del cambio.'); return; }
    setBusy(true); setError('');
    try {
      const task = await request(action === 'restore' ? 'restoreTask' : 'updateTask', draft.id, action === 'restore' ? { revision } : { cancelled: !draft.cancelledAt }, draft.revision || 0, reason);
      setTasks(current => current.map(t => t.id === task.id ? task : t)); setDraft(null); setNotice('Cambio registrado.'); await onSaved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  return <div data-testid="personal-workspace" className="mx-auto min-w-0 w-full max-w-6xl p-4 md:p-8">
    <header className="mb-6"><p className="text-sm font-semibold text-primary-500">Mi centro de trabajo</p><h1 className="text-3xl font-bold">{owner?.name || 'Selecciona tu perfil'}</h1><p className="mt-2 text-sm text-primary-600">Una tarea, una siguiente acción. Negocios y proyectos para encontrar el contexto.</p><p className="mt-1 text-xs text-primary-500">{today || 'Cargando fecha…'} · {zone} · Semana de lunes a domingo</p></header>
    <section aria-label="Filtros" className="grid gap-3 rounded-xl bg-white p-4 shadow-sm sm:grid-cols-3">
      <label className="text-sm">Responsable central<select className={control} value={ownerId} disabled={busy} onChange={e => { setOwnerId(e.target.value); setProject(''); setDraft(null); }}><option value="">Elegir perfil</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Negocio<select aria-label="Negocio" className={control} value={business} onChange={e => setBusiness(e.target.value)}><option value="">Todos los negocios</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">Proyecto<select aria-label="Proyecto" className={control} value={project} onChange={e => setProject(e.target.value)}><option value="">Todos los proyectos</option>{linkedProjects.filter(p => !business || p.companyId === business).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}{projects.map(p => <option key={p}>{p}</option>)}</select></label>
    </section>
    <form onSubmit={capture} className="my-5 flex flex-wrap gap-2"><label className="min-w-48 flex-1"><span className="sr-only">Captura rápida</span><input className={control} placeholder="¿Qué hay que hacer?" value={title} maxLength={240} required onChange={e => setTitle(e.target.value)} /></label><button disabled={busy || !canEdit || !ownerId || !today || !companies.length} className="rounded-lg bg-primary-900 px-5 py-2 text-white disabled:opacity-50">Capturar para hoy</button><p className="w-full text-xs text-primary-500">{business ? 'Se usará el negocio seleccionado.' : `Negocio inicial: ${companies[0]?.name || 'Sin negocios disponibles'}. Puedes cambiarlo al editar.`} Sin vencimiento automático.</p></form>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{notice && <p role="status" className="mb-4 text-sm text-green-700">{notice}</p>}
    <nav aria-label="Vistas de tareas" className="mb-5 flex flex-wrap gap-2">{views.map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-lg border px-4 py-2 text-sm ${view === key ? 'bg-primary-900 text-white' : 'bg-white'}`}>{label} <span className="ml-1">{filtered.filter(t => inView(t, key)).length}</span></button>)}</nav>
    <p className="mb-3 text-xs text-primary-500">{view === 'today' ? 'Trabajo de hoy, vencidas y seguimientos pendientes.' : view === 'week' ? 'Trabajo, vencimientos y seguimientos de esta semana, más vencidas anteriores.' : view === 'all' ? 'Incluye tareas sin fecha y completadas.' : view === 'confirmation' ? 'Registros por validar: separados de tareas activas, reuniones y seguimientos.' : view === 'approval' ? 'La aprobación se gestiona independientemente del avance.' : 'Compromisos pendientes de otra persona o tareas bloqueadas.'}</p>
    <section aria-label="Lista de tareas" className="space-y-3">{visible.map((task, index) => <Fragment key={task.id}>{grouped && (index === 0 || visible[index - 1].companyId !== task.companyId) && <h2 className="pt-4 text-xl font-bold">{companies.find(c => c.id === task.companyId)?.name || 'Sin negocio'}</h2>}<article className="rounded-xl border border-primary-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-primary-500">{companies.find(c => c.id === task.companyId)?.name || 'Sin negocio'}{task.projectName && ` · ${task.projectName}`}</p><h2 className="mt-1 text-lg font-semibold">{task.title}</h2></div><button disabled={busy || !canEdit} aria-label={`Editar ${task.title}`} className="rounded-lg border px-3 py-2 text-sm" onClick={() => { setDraft({ ...task }); setReason(''); setError(''); }}>Editar</button></div>
      {task.validationStatus === 'NeedsConfirmation' && <p className="mt-2 font-semibold text-amber-800">Por confirmar — no es un compromiso activo</p>}{task.contextNotes && <p className="mt-2 whitespace-pre-wrap text-sm">{task.contextNotes}</p>}{task.sourceUrl && <a href={task.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">Abrir fuente</a>}<p className="mt-2 text-sm"><strong>Siguiente acción:</strong> {task.nextAction || 'Por definir'}</p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-primary-600"><span>Trabajo: {task.workDate || 'Sin programar'}</span><span className={task.dueDate && task.dueDate.slice(0, 10) < today && task.status !== 'Completed' ? 'font-semibold text-red-700' : ''}>Vence: {task.dueDate?.slice(0, 10) || 'Sin límite'}</span><span>Avance: {{ Pending: 'Pendiente', 'In Progress': 'En curso', Completed: 'Completada', Blocked: 'Bloqueada' }[task.status]}</span><span>Ejecuta: {people.find(p => p.id === task.assigneeId)?.name || 'Sin asignar'}</span></div>
      {(task.waitingOn || task.commitment || task.followUpDate) && <p className="mt-2 text-sm text-amber-800">Esperando: {task.waitingOn || 'Por definir'} · {task.commitment || 'Compromiso por definir'} · Seguimiento: {task.followUpDate || 'Sin fecha'}</p>}
      {task.approvalStatus && task.approvalStatus !== 'NotRequired' && <p className="mt-2 text-sm">Aprobación: {{ Pending: 'Pendiente', Approved: 'Aprobada', Rejected: 'Rechazada' }[task.approvalStatus]}</p>}
      {task.cancelledAt && <p className="mt-2 text-sm text-red-700">Cancelada · {task.cancellationReason}</p>}
      {!!task.dependencyIds?.length && <p className="mt-2 text-xs">Depende de: {task.dependencyIds.map(id => tasks.find(t => t.id === id)?.title || id).join(', ')}</p>}
    </article></Fragment>)}{!visible.length && <p className="rounded-xl border border-dashed p-8 text-center text-primary-500">{!ownerId ? 'Elige el perfil responsable para empezar.' : 'No hay tareas en esta vista con estos filtros.'}</p>}</section>
    {draft && <section aria-label="Editar tarea" className="mt-6 rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-bold">Editar tarea</h2><form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Título<input required maxLength={240} className={control} value={draft.title} onChange={e => field('title', e.target.value)} /></label>
      <label className="text-sm">Negocio de la tarea<select className={control} value={draft.companyId} onChange={e => field('companyId', e.target.value)}>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">Prioridad<select aria-label="Prioridad" className={control} value={draft.priority} onChange={e => field('priority', e.target.value)}><option value="High">Alta</option><option value="Medium">Media</option><option value="Low">Baja</option></select></label><label className="text-sm">Estimación de trabajo (minutos)<input aria-label="Estimación de trabajo (minutos)" type="number" min={1} max={1440} className={control} value={draft.estimatedMinutes ?? ''} onChange={e => setDraft(current => current ? { ...current, estimatedMinutes: e.target.value ? Number(e.target.value) : undefined } : current)} /></label><label className="text-sm">Proyecto vinculado<select aria-label="Proyecto vinculado" className={control} value={draft.projectId || ''} onChange={e => setDraft(current => current ? { ...current, projectId: e.target.value, projectName: linkedProjects.find(p => p.id === e.target.value)?.title || '', deliverableId: '' } : current)}><option value="">Sin proyecto</option>{linkedProjects.filter(p => p.companyId === draft.companyId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
      <label className="text-sm">Entregable vinculado<select aria-label="Entregable vinculado" className={control} value={draft.deliverableId || ''} onChange={e => field('deliverableId', e.target.value)}><option value="">Sin entregable</option>{linkedProjects.find(p => p.id === draft.projectId)?.deliverables.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
      <label className="text-sm">Dependencias de tarea<select aria-label="Dependencias de tarea" multiple className={control} value={draft.dependencyIds || []} onChange={e => setDraft(current => current ? { ...current, dependencyIds: Array.from(e.target.selectedOptions, o => o.value) } : current)}>{tasks.filter(t => t.companyId === draft.companyId && t.id !== draft.id).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label className="text-sm">Repetición<select aria-label="Repetición" className={control} value={draft.repeatPattern || ''} onChange={e => field('repeatPattern', e.target.value)}><option value="">Sin repetición</option><option value="Daily">Diaria</option><option value="Weekly">Semanal</option><option value="Monthly">Mensual</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!draft.isMeeting} onChange={e => setDraft(current => current ? { ...current, isMeeting: e.target.checked } : current)} />Es una reunión</label>
      {draft.isMeeting && <label className="text-sm">Hora de reunión en Panamá<input type="time" className={control} value={draft.meetingTime || ''} onChange={e => field('meetingTime', e.target.value)} /></label>}
      {([['projectName', 'Proyecto de la tarea'], ['nextAction', 'Siguiente acción'], ['waitingOn', 'Esperando a'], ['commitment', 'Compromiso esperado']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input className={control} maxLength={1000} value={draft[key] || ''} onChange={e => field(key, e.target.value)} /></label>)}
      {([['workDate', 'Fecha de trabajo'], ['dueDate', 'Vencimiento'], ['followUpDate', 'Próximo seguimiento']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<input type="date" className={control} value={draft[key]?.slice(0, 10) || ''} onChange={e => field(key, e.target.value)} /></label>)}
      <label className="text-sm">Franja de trabajo<select aria-label="Franja de trabajo" className={control} value={draft.workSlot || ''} onChange={e => field('workSlot', e.target.value)}><option value="">Sin franja</option><option value="Morning">Mañana</option><option value="Afternoon">Tarde</option><option value="Evening">Noche</option><option value="Exact">Hora definida</option></select></label>{draft.workSlot === 'Exact' && <label className="text-sm">Hora de trabajo en Panamá<input type="time" className={control} value={draft.workTime || ''} onChange={e => field('workTime', e.target.value)} /></label>}<label className="text-sm">Ejecutor<select aria-label="Ejecutor" className={control} value={draft.assigneeId} onChange={e => field('assigneeId', e.target.value)}><option value="">Sin asignar</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-sm">Avance<select aria-label="Avance" className={control} value={draft.status} onChange={e => field('status', e.target.value)}><option value="Pending">Pendiente</option><option value="In Progress">En curso</option><option value="Blocked">Bloqueada</option><option value="Completed">Completada</option></select></label>
      <label className="text-sm">Aprobación<select aria-label="Aprobación" className={control} value={draft.approvalStatus || 'NotRequired'} onChange={e => field('approvalStatus', e.target.value)}><option value="NotRequired">No requerida</option><option value="Pending">Por aprobar</option><option value="Approved">Aprobada</option><option value="Rejected">Rechazada</option></select></label>
      <label className="text-sm">Validación del registro<select aria-label="Validación del registro" className={control} value={draft.validationStatus || 'Confirmed'} onChange={e => field('validationStatus', e.target.value)}><option value="Confirmed">Confirmado para seguimiento</option><option value="NeedsConfirmation">Por confirmar</option></select></label><label className="text-sm">Fuente<input type="url" className={control} value={draft.sourceUrl || ''} onChange={e => field('sourceUrl', e.target.value)} /></label><label className="text-sm sm:col-span-2">Contexto y límites<textarea maxLength={1000} className={control} value={draft.contextNotes || ''} onChange={e => field('contextNotes', e.target.value)} /></label><label className="text-sm sm:col-span-2">Motivo del cambio<input required className={control} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <div className="space-y-2 sm:col-span-2"><h3 className="font-semibold">Subtareas</h3>{draft.steps.map(step => <label key={step.id} className="flex gap-2 text-sm"><input type="checkbox" checked={step.completed} onChange={e => setDraft(current => current ? { ...current, steps: current.steps.map(s => s.id === step.id ? { ...s, completed: e.target.checked } : s) } : current)} />{step.text}</label>)}<div className="flex gap-2"><input aria-label="Nueva subtarea" className={control} value={stepTitle} onChange={e => setStepTitle(e.target.value)} /><button type="button" className="rounded-lg border px-3" disabled={!stepTitle.trim()} onClick={() => { setDraft(current => current ? { ...current, steps: [...current.steps, { id: crypto.randomUUID(), text: stepTitle.trim(), completed: false }] } : current); setStepTitle(''); }}>Añadir subtarea</button></div></div>
      <p className="text-xs text-primary-500 sm:col-span-2">Para cerrar una espera, vacía “Esperando a”, compromiso y seguimiento, y actualiza el avance. La tarea conserva su responsable central al delegar.</p>
      <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-primary-900 px-5 py-2 text-white disabled:opacity-50">Guardar cambios</button><button type="button" disabled={busy} className="rounded-lg border px-5 py-2" onClick={() => setDraft(null)}>Cancelar</button></div>
    </form><button type="button" disabled={busy || !canEdit} className="mt-4 rounded-lg border px-3 py-2 text-sm" onClick={() => changeLifecycle('cancel')}>{draft.cancelledAt ? 'Reactivar tarea' : 'Cancelar tarea'}</button><details className="mt-4"><summary className="cursor-pointer text-sm">Historial de la tarea</summary><ul className="mt-2 space-y-2 text-xs">{draft.activityLog.map((entry, i) => <li key={i}>{entry.timestamp} · {people.find(p => p.id === entry.user)?.name || entry.user} · {entry.action}{entry.snapshot && entry.revision !== draft.revision && <button type="button" disabled={busy || !canEdit} className="ml-2 underline" onClick={() => changeLifecycle('restore', entry.revision)}>Restaurar revisión {entry.revision}</button>}</li>)}</ul></details></section>}
  </div>;
}
