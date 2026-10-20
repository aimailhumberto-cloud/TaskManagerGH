'use client';
import { useEffect, useState } from 'react';
import type { Task, Company, Person } from '@/services/mockData';
import { taskState, taskTime, todayInPanama } from '@/lib/workspaceDisplay';
import WorkspaceIcon from './WorkspaceIcon';
import QuickWorkActions from './QuickWorkActions';

export type WorkspaceCommand = (
  action: string,
  fields: Record<string, unknown>,
  reason?: string,
  id?: string,
  revision?: number
) => Promise<boolean>;

function Cell({
  task,
  field,
  value,
  label,
  type = 'text',
  busy,
  canEdit,
  command,
}: {
  task: Task;
  field: string;
  value: string;
  label: string;
  type?: string;
  busy: boolean;
  canEdit: boolean;
  command: WorkspaceCommand;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  async function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    const ok = await command(
      'updateTask',
      { [field]: field === 'subcategories' ? draft.split(',').map(s => s.trim()).filter(Boolean) : draft },
      `Edición de ${label} en el maestro.`,
      task.id,
      task.revision || 0
    );
    if (ok) setEditing(false);
  }
  if (!editing)
    return (
      <button
        disabled={!canEdit || busy}
        className="tm-cell"
        aria-label={`Editar ${label} de ${task.title}`}
        onClick={() => setEditing(true)}
      >
        {value || <span className="tm-placeholder">—</span>}
      </button>
    );
  return (
    <span className="tm-cell-editor">
      <input
        autoFocus
        type={type}
        aria-label={`${label} de ${task.title}`}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        disabled={busy}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
        }}
      />
      <button disabled={busy} aria-label={`Guardar ${label} de ${task.title}`} onClick={save}>
        <WorkspaceIcon name="check" size={17} />
      </button>
      <button
        disabled={busy}
        aria-label={`Cancelar edición de ${label}`}
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
      >
        ×
      </button>
    </span>
  );
}

function carryover(task: Task | undefined) {
  return !!task?.workDate && task.workDate < todayInPanama() && task.status !== 'Completed';
}

export default function TaskMaster({
  tasks,
  companies,
  people,
  companyId = '',
  canEdit,
  busy,
  command,
  openTask,
  variant = 'table',
  sourceTasks = tasks,
  editableTaskIds,
}: {
  tasks: Task[];
  companies: Company[];
  people: Person[];
  companyId?: string;
  canEdit: boolean;
  busy: boolean;
  command: WorkspaceCommand;
  openTask: (id: string) => void;
  variant?: 'table' | 'today';
  sourceTasks?: Task[];
  editableTaskIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [sub, setSub] = useState('');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('workDate');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [captureCompany, setCaptureCompany] = useState(companyId || companies[0]?.id || '');
  const [kind, setKind] = useState('One-shot');

  useEffect(() => {
    setCaptureCompany(companyId || companies[0]?.id || '');
  }, [companyId, companies]);

  const base = tasks.filter(t => !companyId || t.companyId === companyId);

  const matchStatusFilter = (t: Task, filter: string) => {
    if (!filter) return true;
    if (filter === 'Cancelada' || filter === 'Cerrada') return Boolean(t.cancelledAt);
    if (filter === 'Completada') return !t.cancelledAt && t.status === 'Completed';
    if (filter === 'En curso') return !t.cancelledAt && t.status === 'In Progress';
    if (filter === 'Bloqueada') return !t.cancelledAt && t.status === 'Blocked';
    if (filter === 'Pendiente')
      return !t.cancelledAt && (t.status === 'Pending' || taskState(t) === 'Pendiente' || taskState(t) === 'Esperando');
    return taskState(t) === filter;
  };

  const filtered = base
    .filter(
      t =>
        (!category || t.category === category) &&
        (!sub || t.subcategories?.includes(sub)) &&
        matchStatusFilter(t, state) &&
        (!query ||
          [t.title, t.nextAction, t.category, ...(t.subcategories || []), ...t.steps.map(s => s.text)].some(v =>
            v?.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'))
          ))
    )
    .sort(
      (a, b) =>
        (variant === 'today'
          ? Number(!(a.workDate && a.workDate < todayInPanama() && a.status !== 'Completed')) -
            Number(!(b.workDate && b.workDate < todayInPanama() && b.status !== 'Completed'))
          : 0) ||
        (sort === 'company' || variant === 'today'
          ? (companies.find(c => c.id === a.companyId)?.name || '').localeCompare(
              companies.find(c => c.id === b.companyId)?.name || ''
            )
          : sort === 'title'
            ? a.title.localeCompare(b.title)
            : (a.workDate || '9999').localeCompare(b.workDate || '9999')) ||
        a.title.localeCompare(b.title)
    );

  async function capture(e: React.FormEvent) {
    e.preventDefault();
    if (
      await command(
        'createTask',
        {
          title: title.trim(),
          companyId: captureCompany,
          type: kind,
          workDate: variant === 'today' ? todayInPanama() : '',
          dueDate: '',
          steps: [],
        },
        'Captura solicitada por Humberto.'
      )
    )
      setTitle('');
  }

  const editable = (task: Task) =>
    canEdit && (!editableTaskIds || editableTaskIds.includes((task as Task & { parentTaskId?: string }).parentTaskId || task.id));

  const selector = (task: Task, field: string, value: string, label: string, options: { id: string; label: string }[]) => (
    <select
      aria-label={`${label} de ${task.title}`}
      className="tm-cell-select"
      value={value}
      disabled={busy || !editable(task)}
      onChange={e => {
        const nextVal = e.target.value;
        if (field === 'status' && nextVal === 'Cancelled') {
          command('updateTask', { cancelled: true }, 'Cerrada desde el maestro.', task.id, task.revision || 0);
        } else if (field === 'status') {
          command(
            'updateTask',
            {
              status: nextVal,
              ...(task.cancelledAt ? { cancelled: false } : {}),
              validationStatus: 'Confirmed',
            },
            `Edición de ${label} en el maestro.`,
            task.id,
            task.revision || 0
          );
        } else {
          command('updateTask', { [field]: nextVal }, `Edición de ${label} en el maestro.`, task.id, task.revision || 0);
        }
      }}
    >
      {!value && !options.some(o => !o.id) && <option value="">Sin asignar</option>}
      {options.map(o => (
        <option value={o.id} key={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );

  const countPending = base.filter(t => matchStatusFilter(t, 'Pendiente')).length;
  const countInProgress = base.filter(t => matchStatusFilter(t, 'En curso')).length;
  const countCompleted = base.filter(t => matchStatusFilter(t, 'Completada')).length;
  const countBlocked = base.filter(t => matchStatusFilter(t, 'Bloqueada')).length;
  const countClosed = base.filter(t => matchStatusFilter(t, 'Cancelada')).length;

  return (
    <section
      className={`tm-pane ${variant === 'today' ? 'tm-pane-dark' : 'tm-master'}`}
      aria-label={variant === 'today' ? 'Tareas de hoy' : 'Maestro de tareas'}
    >
      <div className="tm-heading">
        <div className="tm-heading-icon">
          <WorkspaceIcon name="task" />
          <h2>{variant === 'today' ? 'Tu trabajo' : 'Todas las tareas'}</h2>
        </div>
        <span className="tm-count">{filtered.length}</span>
      </div>

      {canEdit && (
        <form className="tm-capture" aria-label="Captura de trabajo" onSubmit={capture}>
          <input
            aria-label="Nueva tarea"
            placeholder="¿Qué hay que hacer?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            maxLength={240}
          />
          <select
            aria-label="Empresa de nueva tarea"
            value={captureCompany}
            onChange={e => setCaptureCompany(e.target.value)}
            disabled={!!companyId}
          >
            {companies.map(c => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Tipo de nueva tarea" value={kind} onChange={e => setKind(e.target.value)}>
            <option value="One-shot">Tarea</option>
            <option value="Project">Proyecto con pasos</option>
          </select>
          <button className="tm-gold-button" disabled={busy || !title.trim() || !captureCompany}>
            <span>+ Añadir</span>
          </button>
        </form>
      )}

      {/* QUICK STATUS FILTER PILLS FOR ALL STATUSES */}
      <div className="tm-status-filter-pills" role="group" aria-label="Filtrar por estatus">
        <button type="button" aria-pressed={state === ''} onClick={() => setState('')}>
          Todas ({base.length})
        </button>
        <button type="button" aria-pressed={state === 'Pendiente'} onClick={() => setState('Pendiente')}>
          ⏳ Pendientes ({countPending})
        </button>
        <button type="button" aria-pressed={state === 'En curso'} onClick={() => setState('En curso')}>
          ⚡ En proceso ({countInProgress})
        </button>
        <button type="button" aria-pressed={state === 'Completada'} onClick={() => setState('Completada')}>
          ✅ Completadas ({countCompleted})
        </button>
        {countBlocked > 0 && (
          <button type="button" aria-pressed={state === 'Bloqueada'} onClick={() => setState('Bloqueada')}>
            🛑 Bloqueadas ({countBlocked})
          </button>
        )}
        {countClosed > 0 && (
          <button type="button" aria-pressed={state === 'Cancelada'} onClick={() => setState('Cancelada')}>
            🔒 Cerradas ({countClosed})
          </button>
        )}
      </div>

      {variant === 'table' && (
        <>
          <div className="tm-table-tools">
            <label>
              <span className="sr-only">Buscar en maestro</span>
              <input
                aria-label="Buscar en maestro"
                placeholder="Buscar tarea o paso…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar categoría"
              value={category}
              onChange={e => {
                setCategory(e.target.value);
                setSub('');
              }}
            >
              <option value="">Todas las categorías</option>
              {Array.from(new Set(base.map(t => t.category).filter(Boolean)))
                .sort()
                .map(c => (
                  <option key={c}>{c}</option>
                ))}
            </select>
            <select aria-label="Filtrar subcategoría" value={sub} onChange={e => setSub(e.target.value)}>
              <option value="">Todas las subcategorías</option>
              {Array.from(new Set(base.filter(t => !category || t.category === category).flatMap(t => t.subcategories || [])))
                .sort()
                .map(s => (
                  <option key={s}>{s}</option>
                ))}
            </select>
            <select aria-label="Filtrar estado" value={state} onChange={e => setState(e.target.value)}>
              <option value="">Todos los estados</option>
              {['Pendiente', 'En curso', 'Esperando', 'Bloqueada', 'Completada', 'Por confirmar', 'Cancelada'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select aria-label="Ordenar tareas" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="workDate">Fecha de trabajo</option>
              <option value="company">Empresa</option>
              <option value="title">Tarea</option>
            </select>
          </div>
          <p className="tm-table-help">
            Selecciona una celda para editar o cambia el estado directamente. Enter guarda; Esc cancela.
          </p>
          <div className="tm-table-scroll" tabIndex={0} aria-label="Tabla editable de todas las tareas">
            <table>
              <thead>
                <tr>
                  {[
                    'Tarea / proyecto',
                    'Empresa',
                    'Categoría',
                    'Subcategorías',
                    'Responsable',
                    'Estado',
                    'Siguiente acción',
                    'Trabajo',
                    'Vencimiento',
                    'Seguimiento',
                  ].map(h => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <TaskRows
                    key={t.id}
                    task={t}
                    expanded={expanded.includes(t.id)}
                    toggle={() => setExpanded(v => (v.includes(t.id) ? v.filter(id => id !== t.id) : [...v, t.id]))}
                    open={() => openTask(t.id)}
                    cells={
                      <>
                        <td>
                          {selector(
                            t,
                            'companyId',
                            t.companyId,
                            'Empresa',
                            companies.map(c => ({ id: c.id, label: c.name }))
                          )}
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="category"
                            label="Categoría"
                            value={t.category || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="subcategories"
                            label="Subcategorías"
                            value={t.subcategories?.join(', ') || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                        <td>
                          {selector(
                            t,
                            'assigneeId',
                            t.assigneeId,
                            'Responsable',
                            people.map(p => ({ id: p.id, label: p.name }))
                          )}
                        </td>
                        <td>
                          {selector(t, 'status', t.cancelledAt ? 'Cancelled' : t.status, 'Estado', [
                            { id: 'Pending', label: 'Pendiente' },
                            { id: 'In Progress', label: 'En curso' },
                            { id: 'Completed', label: 'Completada' },
                            { id: 'Blocked', label: 'Bloqueada' },
                            { id: 'Cancelled', label: 'Cerrada' },
                          ])}
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="nextAction"
                            label="Siguiente acción"
                            value={t.nextAction || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="workDate"
                            label="Fecha de trabajo"
                            type="date"
                            value={t.workDate || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="dueDate"
                            label="Vencimiento"
                            type="date"
                            value={t.dueDate?.slice(0, 10) || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                        <td>
                          <Cell
                            task={t}
                            field="followUpDate"
                            label="Seguimiento"
                            type="date"
                            value={t.followUpDate || ''}
                            {...{ command, busy, canEdit: editable(t) }}
                          />
                        </td>
                      </>
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {variant === 'today' && (
        <div className="tm-today-list">
          {filtered.map((t, i) => (
            <div key={t.id}>
              {(i === 0 || carryover(filtered[i - 1]) !== carryover(t)) && (
                <h3 className="tm-work-group">
                  {t.workDate && t.workDate < todayInPanama() && t.status !== 'Completed'
                    ? 'Pendientes anteriores'
                    : 'Operación y Tareas'}
                </h3>
              )}
              {(i === 0 || filtered[i - 1].companyId !== t.companyId || carryover(filtered[i - 1]) !== carryover(t)) && (
                <h3 className="tm-company-heading">{companies.find(c => c.id === t.companyId)?.name}</h3>
              )}
              <button className="tm-work-card" onClick={() => openTask(t.id)}>
                <span className="tm-company-avatar">
                  <WorkspaceIcon
                    name={t.type === 'Project' ? 'steps' : t.isMeeting ? 'calendar' : 'task'}
                    size={25}
                  />
                </span>
                <span className="tm-work-copy">
                  <strong>{t.title}</strong>
                  <span>
                    {t.nextAction ||
                      (t.type === 'Project'
                        ? `${t.steps.filter(s => s.completed && !s.cancelled).length}/${
                            t.steps.filter(s => !s.cancelled).length
                          } pasos completados`
                        : 'Siguiente acción por definir')}
                  </span>
                  <small>
                    {t.category ? `📂 ${t.category} · ` : ''}
                    {taskTime(t)} · {people.find(p => p.id === t.assigneeId)?.name || 'Responsable por definir'}
                    {t.dueDate && ` · Vence ${t.dueDate.slice(0, 10)}`}
                  </small>
                </span>
                <span className={`tm-status ${t.status === 'Completed' ? 'tm-status-teal' : ''}`}>{taskState(t)}</span>
                <WorkspaceIcon name="arrow" size={18} />
              </button>
              {t.workDate && t.workDate < todayInPanama() && t.status !== 'Completed' && (
                <span className="tm-carryover">Pendiente anterior · Trabajo {t.workDate}</span>
              )}
              <QuickWorkActions task={t} tasks={sourceTasks} {...{ canEdit: editable(t), busy, command }} />
            </div>
          ))}
        </div>
      )}

      {!filtered.length && (
        <p className="tm-empty">
          {base.length
            ? 'Sin resultados para este filtro de estatus. Haz clic en "Todas" arriba para verlas todas.'
            : variant === 'today'
              ? 'Sin tareas en esta vista.'
              : 'Aún no hay tareas en esta empresa.'}
        </p>
      )}
    </section>
  );
}

function TaskRows({
  task,
  expanded,
  toggle,
  open,
  cells,
}: {
  task: Task;
  expanded: boolean;
  toggle: () => void;
  open: () => void;
  cells: React.ReactNode;
}) {
  return (
    <>
      <tr data-testid={`task-row-${task.id}`}>
        <th scope="row">
          <div className="tm-row-title">
            {!!task.steps.length && (
              <button aria-label={`Desplegar pasos de ${task.title}`} aria-expanded={expanded} onClick={toggle}>
                {expanded ? '−' : '+'}
              </button>
            )}
            <button onClick={open}>
              <strong>{task.title}</strong>
              <small>
                {task.type === 'Project' ? 'Proyecto' : 'Tarea'}
                {task.steps.length
                  ? ` · ${task.steps.filter(s => s.completed && !s.cancelled).length}/${
                      task.steps.filter(s => !s.cancelled).length
                    } pasos`
                  : ''}
              </small>
            </button>
          </div>
        </th>
        {cells}
      </tr>
      {expanded &&
        task.steps.map(s => (
          <tr className="tm-step-row" key={s.id}>
            <td colSpan={10}>
              <button onClick={open}>
                <span>
                  {s.cancelled
                    ? 'Cancelado'
                    : s.completed
                      ? '✓ Completado'
                      : s.waitingOn
                        ? 'Esperando'
                        : s.status === 'Blocked'
                          ? 'Bloqueado'
                          : s.status === 'In Progress'
                            ? 'En curso'
                            : 'Pendiente'}{' '}
                  ·{' '}
                </span>
                {s.text}
                {s.workDate && ` · Trabajo ${s.workDate}`}
                {s.nextAction && ` · ${s.nextAction}`}
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}
