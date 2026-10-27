'use client';
import { useEffect, useRef, useState } from 'react';
import SmjCompanyCenter from './SmjCompanyCenter';
import LegacyProjectDetail from './LegacyProjectDetail';
import ExecutiveTelemetryHero from './ExecutiveTelemetryHero';
import SupervisionModule from './supervision/SupervisionModule';
import { SMJ_COMPANY_ID } from '@/lib/smjCenter';
import { getCompanyMeta } from '@/lib/hbCompanies';
import type { PublicHbView } from '@/lib/publicHbAccess';
import type { Task } from '@/services/mockData';
import type { Entry } from './WorkspaceHub';
import TaskMaster, { type WorkspaceCommand } from './TaskMaster';
import TaskDetail from './TaskDetail';
import CalendarBoard from './CalendarBoard';
import CompanyDashboards from './CompanyDashboards';
import DecisionPanel from './DecisionPanel';
import WorkspaceIcon from './WorkspaceIcon';
import { projectProgress } from '@/lib/projects';
import { boardItems } from '@/lib/calendarBoard';
import { dailyWork, scheduledWork } from '@/lib/stepWork';
import { todayInPanama, shortDate } from '@/lib/workspaceDisplay';

const noDays = () => {};
type KpiFilter = 'today' | 'overdue' | 'deliverables' | 'in_progress' | 'completed_closed' | 'all';

export default function PublicHbWorkspace({ entry, initial }: { entry: Entry; initial: PublicHbView }) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const locked = useRef(false);

  const command: WorkspaceCommand = async (action, fields, reason, id, revision) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setNotice('Guardando…');
    const stepKeys = new Set(
      'id text completed status assigneeId workDate dueDate nextAction waitingOn dependencyIds evidence sourceUrl cancelled'.split(
        ' '
      )
    );
    const payload = {
      action,
      fields: {
        ...fields,
        ...(Array.isArray(fields.steps)
          ? {
              steps: fields.steps.map(step =>
                Object.fromEntries(
                  Object.entries(step as Record<string, unknown>).filter(([key]) => stepKeys.has(key))
                )
              ),
            }
          : {}),
      },
      reason,
      ...(id ? { id, expectedRevision: revision } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    }
    try {
      const proofResponse = await fetch('/api/public/workspace/csrf', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const proof = await proofResponse.json();
      if (!proofResponse.ok) throw new Error(proof.error || 'No se pudo proteger el guardado.');
      const response = await fetch('/api/public/workspace', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-public-hb-csrf': proof.token },
        body: JSON.stringify({ ...payload, requestId: pending.current.requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se confirmó el guardado.');
      const reload = await fetch('/api/public/workspace', { cache: 'no-store' });
      if (!reload.ok)
        throw new Error('El cambio se guardó, pero no se pudo recargar. Reintenta para verificarlo.');
      const fresh: PublicHbView = await reload.json();
      setView(fresh);
      setTask(current => (current ? fresh.tasks.find(t => t.id === current.id) || null : null));
      pending.current = null;
      setNotice('Cambio guardado en la base.');
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'No se confirmó el guardado. Conserva tu edición y reintenta.'
      );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const [company, setCompany] = useState('');
  const [query, setQuery] = useState('');
  const [task, setTask] = useState<Task | null>(null);
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [manageCompaniesOpen, setManageCompaniesOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [quickMeetingOpen, setQuickMeetingOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState(todayInPanama());
  const [mTime, setMTime] = useState('10:00');
  const [mCompany, setMCompany] = useState('business-bee-smart');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('company');
    if (initial.companies.some(c => c.id === id)) setCompany(id!);
  }, [initial.companies]);

  const today = todayInPanama();
  const selected = view.tasks.filter(t => !company || t.companyId === company);
  const active = selected.filter(t => !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation');
  const rawTodays = dailyWork(active, today);
  const todaysIds = new Set(rawTodays.map(t => t.id));
  const todays = [
    ...rawTodays,
    ...active.filter(
      t =>
        !todaysIds.has(t.id) &&
        (t.status === 'In Progress' || (t.status === 'Completed' && (!t.workDate || t.workDate <= today)))
    ),
  ];
  const pendingToday = todays.filter(t => t.status !== 'Completed');
  const doneToday = todays.length - pendingToday.length;
  const inProgressTasks = selected.filter(t => !t.cancelledAt && t.status === 'In Progress');
  const completedOrClosedTasks = selected.filter(t => t.status === 'Completed' || Boolean(t.cancelledAt));

  const dueOrCarryover = active.filter(
    t =>
      t.status !== 'Completed' &&
      ((t.workDate && t.workDate < today) || (t.dueDate && t.dueDate.slice(0, 10) <= today))
  );

  // Key Deliverables & Initiatives (tasks with steps, Project tasks, or strategic deliverables)
  const deliverableTasks = active.filter(
    t =>
      !t.isMeeting &&
      (t.type === 'Project' ||
        t.steps.some(s => !s.cancelled) ||
        Boolean(t.category) ||
        t.companyId === 'business-sm-jaleel' ||
        t.companyId === 'business-bee-smart')
  );
  const activeProjects = view.projects.filter(
    p => p.state !== 'Cancelled' && (!company || p.companyId === company)
  );
  const totalDeliverables = Math.max(
    deliverableTasks.length,
    activeProjects.reduce((sum, p) => sum + projectProgress(p).total, 0) +
      active.filter(t => t.type === 'Project').reduce((sum, t) => sum + t.steps.filter(s => !s.cancelled).length, 0)
  );
  const doneDeliverables =
    deliverableTasks.filter(t => t.status === 'Completed').length +
    activeProjects.reduce((sum, p) => sum + projectProgress(p).accepted, 0);

  const upcoming = boardItems(
    selected.filter(t => t.isMeeting && !t.cancelledAt && t.status !== 'Completed'),
    view.calendarSnapshot || null
  )
    .filter(i => i.day >= today && (!company || i.companyId === company))
    .sort((a, b) => a.day.localeCompare(b.day) || (a.minute || 0) - (b.minute || 0));

  const unconfirmed = selected.filter(t => t.validationStatus === 'NeedsConfirmation' && !t.cancelledAt);
  const openTask = (id: string) => setTask(view.tasks.find(t => t.id === id.split('::')[0]) || null);
  const props = {
    companies: view.companies,
    people: view.people,
    canEdit: true,
    editableTaskIds: view.publicEditableTaskIds,
    busy,
    command,
    openTask,
  };

  const title =
    entry === 'home'
      ? 'Hoy, Humberto'
      : entry === 'companies'
        ? 'Tus empresas'
        : entry === 'agenda'
          ? 'Tu tiempo, en perspectiva'
          : entry === 'supervision'
            ? 'Supervisión · Lumen AGI'
            : 'Encuentra tu trabajo';
  const subtitle =
    entry === 'home'
      ? 'Centro de mando ejecutivo · Relojes, métricas en vivo, empresas y agenda semanal.'
      : entry === 'companies'
        ? 'Tus 7 negocios reales con sub-marcas anidadas y tareas organizadas hacia abajo.'
        : entry === 'supervision'
          ? 'Módulo de supervisión v1 · Proyección sintética desacoplada y modo sin conexión.'
          : 'Vista semanal por defecto con tus reuniones y bloques de trabajo.';

  // Filtered task list based on which KPI card or status tab was clicked
  const displayedTasks =
    kpiFilter === 'today'
      ? todays
      : kpiFilter === 'overdue'
        ? dueOrCarryover
        : kpiFilter === 'deliverables'
          ? deliverableTasks
          : kpiFilter === 'in_progress'
            ? inProgressTasks
            : kpiFilter === 'completed_closed'
              ? completedOrClosedTasks
              : selected;

  const listHeading =
    kpiFilter === 'today'
      ? `🎯 Operación de Hoy (${todays.length})`
      : kpiFilter === 'overdue'
        ? `⚠️ Por Vencer y Alertas (${dueOrCarryover.length})`
        : kpiFilter === 'deliverables'
          ? `📦 Entregables e Iniciativas Clave (${deliverableTasks.length})`
          : kpiFilter === 'in_progress'
            ? `⚡ En Proceso (${inProgressTasks.length})`
            : kpiFilter === 'completed_closed'
              ? `✅ Completadas y Cerradas (${completedOrClosedTasks.length})`
              : `📋 Todas las tareas (${selected.length} · incluye pendientes, en proceso, completadas y cerradas)`;

  return (
    <div className="tm-workspace" data-access="public-hb-tasks">
      <ExecutiveTelemetryHero
        title={title}
        subtitle={subtitle}
        today={today}
        tasks={view.tasks}
        todays={todays}
        doneToday={doneToday}
        dueCount={dueOrCarryover.length}
        companies={view.companies}
        onSelectFilter={f => setKpiFilter(f)}
      />

      {notice && (
        <p role="status" className="tm-inline-notice">
          {notice}
        </p>
      )}

      {/* REAL BUSINESSES FILTER BAR + COMPANY MANAGER BUTTON */}
      <nav className="tm-company-tabs" aria-label="Empresas">
        <button
          aria-pressed={company === ''}
          onClick={() => {
            setCompany('');
          }}
        >
          <span className="tm-chip-icon tm-chip-0">
            <WorkspaceIcon name="task" size={18} />
          </span>
          Todas ({view.tasks.filter(t => !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation').length})
        </button>
        {view.companies.map((c, i) => {
          const meta = getCompanyMeta(c.id, c.name);
          const count = view.tasks.filter(
            t => t.companyId === c.id && !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation'
          ).length;
          return (
            <button
              key={c.id}
              aria-pressed={company === c.id}
              onClick={() => {
                setCompany(c.id);
                if (c.id !== SMJ_COMPANY_ID && count > 0 && kpiFilter === 'today') {
                  const hasToday = todays.some(t => t.companyId === c.id);
                  if (!hasToday) setKpiFilter('all');
                }
              }}
            >
              <span className={`tm-chip-icon tm-chip-${(i + 1) % 5}`} aria-hidden="true">
                {meta.icon}
              </span>
              <span>{c.name}</span>
              {c.id === 'business-bee-smart' && (
                <small className="tm-chip-subbrand">incl. IA para Todos</small>
              )}
              {count > 0 && <small className="tm-chip-count">{count}</small>}
            </button>
          );
        })}
        <button
          type="button"
          className="tm-manage-companies-chip"
          aria-expanded={manageCompaniesOpen}
          onClick={() => setManageCompaniesOpen(v => !v)}
        >
          + ⚙️ Empresas
        </button>
      </nav>

      {/* INLINE COMPANY MANAGER DRAWER */}
      {manageCompaniesOpen && (
        <section className="tm-pane tm-pane-stone tm-company-manager" aria-label="Administrador de empresas">
          <div className="tm-heading">
            <div>
              <h2>⚙️ Administrar Mis Empresas y Sub-marcas</h2>
              <p className="tm-small">
                Tus 7 negocios principales están configurados. &ldquo;IA para Todos&rdquo; pertenece a Bee Smart como sub-marca/proyecto.
              </p>
            </div>
            <button type="button" className="tm-soft-button" onClick={() => setManageCompaniesOpen(false)}>
              Cerrar
            </button>
          </div>
          <form
            className="tm-inline-form"
            onSubmit={async e => {
              e.preventDefault();
              if (!newCompanyName.trim()) return;
              if (await command('createCompany', { name: newCompanyName.trim() }, 'Empresa agregada por HB')) {
                setNewCompanyName('');
              }
            }}
          >
            <input
              placeholder="Agregar nueva empresa o unidad de negocio…"
              value={newCompanyName}
              onChange={e => setNewCompanyName(e.target.value)}
              required
            />
            <button className="tm-gold-button" disabled={busy}>
              + Crear Empresa
            </button>
          </form>
          <div className="tm-company-manager-list">
            {view.companies.map(c => {
              const meta = getCompanyMeta(c.id, c.name);
              return (
                <div key={c.id} className="tm-company-manager-row">
                  <span>
                    <strong>
                      {meta.icon} {c.name}
                    </strong>{' '}
                    {!!meta.subBrands.length && <small>· Sub-marcas: {meta.subBrands.join(', ')}</small>}
                  </span>
                  <div className="tm-inline-actions">
                    <button
                      type="button"
                      className="tm-soft-button"
                      disabled={busy}
                      onClick={async () => {
                        const next = window.prompt('Renombrar empresa:', c.name);
                        if (next && next.trim() && next.trim() !== c.name) {
                          await command('updateCompany', { name: next.trim() }, 'Renombrada por HB', c.id, 1);
                        }
                      }}
                    >
                      ✏️ Renombrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {entry === 'home' && (
        <>
          {/* 4 INTERACTIVE KPI FILTER CARDS */}
          <section className="tm-executive-kpis" aria-label="Resumen ejecutivo del día">
            <button
              type="button"
              className={`tm-pane tm-pane-dark tm-kpi-card tm-kpi-interactive ${
                kpiFilter === 'today' ? 'is-active-filter' : ''
              }`}
              onClick={() => setKpiFilter('today')}
            >
              <div className="tm-kpi-top">
                <span className="tm-eyebrow">Operación Hoy</span>
                <span className="tm-status tm-status-teal">
                  {todays.length ? Math.round((doneToday / todays.length) * 100) : 0}%
                </span>
              </div>
              <strong className="tm-kpi-value">
                {doneToday} <small>/ {todays.length} ejecutadas</small>
              </strong>
              <span className="tm-small">
                {pendingToday.length} pendientes para hoy ·{' '}
                {todays.filter(t => t.status === 'In Progress').length} en curso
              </span>
              <progress value={doneToday} max={todays.length || 1} />
              <span className="tm-kpi-filter-hint">
                {kpiFilter === 'today' ? '👇 Mostrando estas abajo' : '👆 Clic para ver las de hoy →'}
              </span>
            </button>

            <button
              type="button"
              className={`tm-pane tm-pane-dark tm-kpi-card tm-kpi-gold tm-kpi-interactive ${
                kpiFilter === 'overdue' ? 'is-active-filter' : ''
              }`}
              onClick={() => setKpiFilter('overdue')}
            >
              <div className="tm-kpi-top">
                <span className="tm-eyebrow">Por Vencer & Alertas</span>
                <span className="tm-status">{dueOrCarryover.length ? 'Atención' : 'Al día'}</span>
              </div>
              <strong className="tm-kpi-value">
                {dueOrCarryover.length} <small>por atender</small>
              </strong>
              <span className="tm-small">
                {dueOrCarryover.filter(t => t.workDate && t.workDate < today).length} arrastradas ·{' '}
                {dueOrCarryover.filter(t => t.dueDate && t.dueDate.slice(0, 10) <= today).length} vencen hoy
              </span>
              <span className="tm-kpi-filter-hint">
                {kpiFilter === 'overdue'
                  ? `👇 Mostrando las ${dueOrCarryover.length} alertas abajo`
                  : `👆 Clic para ver las ${dueOrCarryover.length} alertas →`}
              </span>
            </button>

            <button
              type="button"
              className={`tm-pane tm-pane-dark tm-kpi-card tm-kpi-interactive ${
                kpiFilter === 'deliverables' ? 'is-active-filter' : ''
              }`}
              onClick={() => setKpiFilter('deliverables')}
            >
              <div className="tm-kpi-top">
                <span className="tm-eyebrow">Entregables & Proyectos</span>
                <span className="tm-count">{totalDeliverables} activos</span>
              </div>
              <strong className="tm-kpi-value">
                {doneDeliverables} <small>/ {totalDeliverables} hitos</small>
              </strong>
              <span className="tm-small">IA para Todos · Ingredienta · S.M. Jaleel</span>
              <progress value={doneDeliverables} max={totalDeliverables || 1} />
              <span className="tm-kpi-filter-hint">
                {kpiFilter === 'deliverables'
                  ? '👇 Mostrando entregables abajo'
                  : '👆 Clic para ver los entregables →'}
              </span>
            </button>

            <button
              type="button"
              className="tm-pane tm-pane-navy tm-kpi-card tm-kpi-interactive"
              onClick={() => {
                if (upcoming[0]?.taskId) openTask(upcoming[0].taskId);
                else window.location.href = '/agenda';
              }}
            >
              <div className="tm-kpi-top">
                <span className="tm-eyebrow">Próxima Reunión</span>
                <WorkspaceIcon name="calendar" size={16} />
              </div>
              <strong className="tm-kpi-value">
                {upcoming[0]
                  ? upcoming[0].minute === null
                    ? 'Todo el día'
                    : `${String(Math.floor(upcoming[0].minute / 60)).padStart(2, '0')}:${String(
                        upcoming[0].minute % 60
                      ).padStart(2, '0')}`
                  : 'Sin citas'}
              </strong>
              <span className="tm-small">
                {upcoming[0]
                  ? `${shortDate(upcoming[0].day)} · ${upcoming[0].title}`
                  : 'Agenda despejada hoy'}
              </span>
              <span className="tm-kpi-filter-hint">
                {upcoming[1]
                  ? `Sigue: ${shortDate(upcoming[1].day)} · ${upcoming[1].title.slice(0, 24)}…`
                  : '📅 Clic para abrir detalle / Agenda →'}
              </span>
            </button>
          </section>

          {company === SMJ_COMPANY_ID ? (
            <SmjCompanyCenter
              initialTracking={view.smjTracking}
              tasks={view.tasks}
              projects={view.projects}
              openProject={setProjectId}
              {...props}
            />
          ) : (
            <>
              <div className="tm-day-toolbar">
                <nav aria-label="Vistas de trabajo">
                  <button onClick={() => setKpiFilter('all')} aria-pressed={kpiFilter === 'all'}>
                    Todas las tareas <span>{selected.length}</span>
                  </button>
                  <button onClick={() => setKpiFilter('today')} aria-pressed={kpiFilter === 'today'}>
                    Operación Hoy <span>{todays.length}</span>
                  </button>
                  <button onClick={() => setKpiFilter('in_progress')} aria-pressed={kpiFilter === 'in_progress'}>
                    En Proceso <span>{inProgressTasks.length}</span>
                  </button>
                  <button onClick={() => setKpiFilter('overdue')} aria-pressed={kpiFilter === 'overdue'}>
                    Por Vencer & Alertas <span>{dueOrCarryover.length}</span>
                  </button>
                  <button
                    onClick={() => setKpiFilter('deliverables')}
                    aria-pressed={kpiFilter === 'deliverables'}
                  >
                    Entregables Clave <span>{deliverableTasks.length}</span>
                  </button>
                  <button
                    onClick={() => setKpiFilter('completed_closed')}
                    aria-pressed={kpiFilter === 'completed_closed'}
                  >
                    Completadas & Cerradas <span>{completedOrClosedTasks.length}</span>
                  </button>
                </nav>
                <span className="tm-day-summary">{listHeading}</span>
              </div>

              <div className="tm-dashboard-columns">
                <div className="tm-dashboard-main-list">
                  {kpiFilter === 'overdue' && dueOrCarryover.length > 0 && (
                    <div className="tm-pane tm-pane-stone tm-filter-banner">
                      <div>
                        <strong>⚠️ Viendo las {dueOrCarryover.length} tareas arrastradas o por vencer</strong>
                        <p className="tm-small">
                          Puedes marcarlas como hechas (`✓ Hecho`), reprogramarlas (`📅 +1 día`) o traerlas a tu día de hoy.
                        </p>
                      </div>
                      <button type="button" className="tm-soft-button" onClick={() => setKpiFilter('today')}>
                        Volver a Hoy ({todays.length})
                      </button>
                    </div>
                  )}
                  {kpiFilter === 'deliverables' && (
                    <div className="tm-pane tm-pane-stone tm-filter-banner">
                      <div>
                        <strong>📦 Viendo los {deliverableTasks.length} Entregables e Iniciativas Clave</strong>
                        <p className="tm-small">
                          Incluye las iniciativas de Bee Smart (IA para Todos, Ingredienta), Surf Shack y S.M. Jaleel.
                        </p>
                      </div>
                      <button type="button" className="tm-soft-button" onClick={() => setKpiFilter('today')}>
                        Volver a Hoy ({todays.length})
                      </button>
                    </div>
                  )}
                  <TaskMaster
                    tasks={displayedTasks}
                    sourceTasks={view.tasks}
                    companyId={company}
                    variant="today"
                    {...props}
                  />
                </div>

                <aside className="tm-dashboard-side">
                  {/* AGENDA CON REUNIÓN DE ARMANDO + CITA DEL JUEVES + BOTÓN NUEVA REUNIÓN */}
                  <section className="tm-pane tm-pane-navy" aria-label="Próximas reuniones">
                    <div className="tm-heading">
                      <div className="tm-heading-icon">
                        <WorkspaceIcon name="calendar" />
                        <h2>Tu Agenda</h2>
                      </div>
                      <button
                        type="button"
                        className="tm-gold-button tm-btn-xs"
                        onClick={() => setQuickMeetingOpen(v => !v)}
                      >
                        {quickMeetingOpen ? 'Cerrar' : '+ Nueva Reunión'}
                      </button>
                    </div>

                    {quickMeetingOpen && (
                      <form
                        className="tm-quick-meeting-box"
                        onSubmit={async e => {
                          e.preventDefault();
                          if (!mTitle.trim()) return;
                          const ok = await command(
                            'createTask',
                            {
                              title: mTitle.trim(),
                              companyId: mCompany,
                              workDate: mDate,
                              dueDate: mDate,
                              isMeeting: true,
                              meetingTime: mTime,
                              priority: 'High',
                            },
                            'Reunión agendada desde Inicio'
                          );
                          if (ok) {
                            setMTitle('');
                            setQuickMeetingOpen(false);
                          }
                        }}
                      >
                        <input
                          placeholder="Título (ej. Reunión con Armando)…"
                          value={mTitle}
                          onChange={e => setMTitle(e.target.value)}
                          required
                        />
                        <div className="tm-quick-meeting-row">
                          <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} required />
                          <input type="time" value={mTime} onChange={e => setMTime(e.target.value)} required />
                        </div>
                        <select value={mCompany} onChange={e => setMCompany(e.target.value)}>
                          {view.companies.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button className="tm-gold-button" disabled={busy}>
                          Guardar Cita
                        </button>
                      </form>
                    )}

                    <div className="tm-agenda-timeline" tabIndex={0} aria-label="Recorrer próximas reuniones">
                      {upcoming.map(i => {
                        const cName = view.companies.find(c => c.id === i.companyId)?.name;
                        return (
                          <div className="tm-agenda-entry" key={i.id}>
                            <span className="tm-timeline-dot" />
                            <span className="tm-eyebrow">
                              {shortDate(i.day)} ·{' '}
                              {i.minute === null
                                ? 'Todo el día'
                                : `${String(Math.floor(i.minute / 60)).padStart(2, '0')}:${String(
                                    i.minute % 60
                                  ).padStart(2, '0')}`}
                            </span>
                            {i.taskId ? (
                              <button onClick={() => openTask(i.taskId!)}>{i.title}</button>
                            ) : (
                              <a href={i.url} target="_blank" rel="noopener noreferrer">
                                {i.title}
                              </a>
                            )}
                            <small>{cName ? `${cName} · ${i.source}` : i.source}</small>
                          </div>
                        );
                      })}
                      {!upcoming.length && (
                        <p className="tm-empty">Sin reuniones programadas en este filtro.</p>
                      )}
                    </div>
                    <a className="tm-arrow-link" href="/agenda">
                      Abrir Calendario Semanal <WorkspaceIcon name="arrow" size={17} />
                    </a>
                  </section>

                  {/* BANDEJA POR VALIDAR (REEMPLAZO LIMPIO Y ACCIONABLE DE "REGISTROS POR VERIFICAR") */}
                  {!!unconfirmed.length && (
                    <section
                      className="tm-pane tm-pane-dark tm-inbox-validation"
                      aria-label="Bandeja de tareas por validar"
                    >
                      <div className="tm-heading">
                        <div>
                          <span className="tm-eyebrow">BANDEJA DE ENTRADA</span>
                          <h2>Por Validar ({unconfirmed.length})</h2>
                        </div>
                        <span className="tm-count">{unconfirmed.length}</span>
                      </div>
                      <p className="tm-small">
                        Activa con un clic las tareas capturadas para pasarlas a tu lista operativa o descártalas:
                      </p>
                      <div className="tm-inbox-list">
                        {unconfirmed.map(t => {
                          const c = view.companies.find(comp => comp.id === t.companyId);
                          const meta = getCompanyMeta(t.companyId, c?.name);
                          return (
                            <div className="tm-inbox-item" key={t.id}>
                              <div className="tm-inbox-copy" onClick={() => openTask(t.id)}>
                                <strong>{t.title}</strong>
                                <small>
                                  {meta.icon} {c?.name || 'Empresa'}
                                  {t.category ? ` · 📂 ${t.category}` : ''}
                                </small>
                              </div>
                              <div className="tm-inbox-actions">
                                <button
                                  type="button"
                                  className="tm-gold-button tm-btn-xs"
                                  disabled={busy}
                                  title="Confirmar y activar para hoy"
                                  onClick={() =>
                                    command(
                                      'updateTask',
                                      { validationStatus: 'Confirmed', workDate: today },
                                      'Validada y activada desde bandeja',
                                      t.id,
                                      t.revision || 0
                                    )
                                  }
                                >
                                  ✓ Activar
                                </button>
                                <button
                                  type="button"
                                  className="tm-soft-button tm-btn-xs"
                                  disabled={busy}
                                  title="Descartar registro"
                                  onClick={() =>
                                    command(
                                      'updateTask',
                                      { cancelled: true },
                                      'Descartado desde bandeja de validación',
                                      t.id,
                                      t.revision || 0
                                    )
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </aside>
              </div>
              <DecisionPanel
                decisions={view.decisions || []}
                companies={view.companies}
                projects={view.projects}
                companyId={company}
                pendingOnly
                canEdit={false}
                busy={busy}
                command={command}
              />
            </>
          )}

          {/* TARJETAS RESUMEN DE AVANCE POR EMPRESA */}
          <section className="tm-company-overview" aria-label="Avance por empresa">
            {view.companies
              .filter(c => !company || company === c.id)
              .map(c => {
                const meta = getCompanyMeta(c.id, c.name);
                const work = view.tasks.filter(
                  t => t.companyId === c.id && !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation'
                );
                const done = work.filter(t => t.status === 'Completed').length;
                const todayPending = todays.filter(t => t.companyId === c.id && t.status !== 'Completed').length;
                return (
                  <button
                    key={c.id}
                    className="tm-company-progress"
                    onClick={() => {
                      setCompany(c.id);
                      if (c.id !== SMJ_COMPANY_ID) setKpiFilter('all');
                    }}
                  >
                    <span className="tm-heading-icon">
                      <span aria-hidden="true">{meta.icon}</span>
                      <strong>{c.name}</strong>
                    </span>
                    <span className="tm-small">{meta.subtitle}</span>
                    <span>
                      {c.id === SMJ_COMPANY_ID
                        ? `Centro Contractual · 301k cases · ${work.length} tareas`
                        : `${done}/${work.length} tareas completadas${
                            todayPending ? ` · ${todayPending} hoy` : ''
                          }`}
                    </span>
                    <progress value={done} max={work.length || 1} />
                  </button>
                );
              })}
          </section>
        </>
      )}

      {entry === 'companies' &&
        (company === SMJ_COMPANY_ID ? (
          <SmjCompanyCenter
            initialTracking={view.smjTracking}
            tasks={view.tasks}
            projects={view.projects}
            openProject={setProjectId}
            {...props}
          />
        ) : (
          <>
            <CompanyDashboards
              tasks={view.tasks}
              companies={view.companies}
              projects={view.projects}
              selected={company}
              choose={setCompany}
              busy={busy}
              command={command}
            />
            <TaskMaster tasks={selected} sourceTasks={view.tasks} companyId={company} {...props} />
          </>
        ))}

      {entry === 'agenda' && (
        <CalendarBoard
          tasks={scheduledWork(selected)}
          companies={view.companies}
          snapshot={view.calendarSnapshot || null}
          companyId={company}
          selectCompany={setCompany}
          daysChanged={noDays}
          openTask={openTask}
          busy={busy}
          command={command}
        />
      )}

      {entry === 'search' && (
        <section className="tm-pane tm-pane-dark">
          <h2>Buscar trabajo HB</h2>
          <input
            className="tm-search-input"
            aria-label="Buscar trabajo HB"
            placeholder="Tarea, empresa, sub-marca (ej. IA para Todos, Ingredienta)…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query.trim() &&
            selected
              .filter(t =>
                [t.title, t.nextAction, t.description, t.category, ...t.steps.map(s => s.text)].some(v =>
                  v?.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
                )
              )
              .map(t => (
                <button key={t.id} className="tm-work-card" onClick={() => openTask(t.id)}>
                  {t.title}
                </button>
              ))}
        </section>
      )}

      {entry === 'supervision' && <SupervisionModule />}

      {task && (
        <div className="tm-modal-backdrop">
          <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Consulta de tarea HB">
            <button className="tm-close" aria-label="Cerrar detalle" onClick={() => setTask(null)}>
              ×
            </button>
            <TaskDetail
              task={task}
              tasks={view.tasks}
              companies={view.companies}
              people={view.people}
              canEdit={view.publicEditableTaskIds.includes(task.id)}
              busy={busy}
              command={command}
            />
          </div>
        </div>
      )}

      {projectId && view.projects.find(p => p.id === projectId) && (
        <div className="tm-modal-backdrop">
          <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Proyecto HB">
            <button className="tm-close" aria-label="Cerrar proyecto" onClick={() => setProjectId(null)}>
              ×
            </button>
            <LegacyProjectDetail
              project={view.projects.find(p => p.id === projectId)!}
              tasks={view.tasks}
              people={view.people}
              actorId={view.actorId}
              canEdit={false}
              busy={busy}
              command={command}
            />
          </div>
        </div>
      )}
    </div>
  );
}
