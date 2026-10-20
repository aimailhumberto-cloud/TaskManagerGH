'use client';
import { useEffect, useRef, useState } from 'react';
import type { Task, Company } from '@/services/mockData';
import type { CalendarSnapshot } from '@/lib/planning';
import { calendarDays, boardItems, positionedItems, type CalendarMode, type BoardItem } from '@/lib/calendarBoard';
import { shiftDay, shortDate, todayInPanama } from '@/lib/workspaceDisplay';
import WorkspaceIcon from './WorkspaceIcon';
import type { WorkspaceCommand } from './TaskMaster';

export default function CalendarBoard({
  tasks,
  companies,
  snapshot,
  openTask,
  companyId = '',
  selectCompany,
  daysChanged,
  busy = false,
  command,
}: {
  tasks: Task[];
  companies: Company[];
  snapshot: CalendarSnapshot | null;
  openTask: (id: string) => void;
  companyId?: string;
  selectCompany: (id: string) => void;
  daysChanged: (days: string[]) => void;
  busy?: boolean;
  command?: WorkspaceCommand;
}) {
  const [date, setDate] = useState(todayInPanama());
  const [mode, setMode] = useState<CalendarMode>('week');
  const [compactList, setCompactList] = useState(false);
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [mTitle, setMTitle] = useState('');
  const [mDate, setMDate] = useState(todayInPanama());
  const [mTime, setMTime] = useState('10:00');
  const [mCompany, setMCompany] = useState(companyId || 'business-bee-smart');
  const [mCategory, setMCategory] = useState('');

  const ref = useRef<HTMLDivElement>(null);
  const days = calendarDays(date, mode);
  const items = boardItems(tasks.filter(t => !companyId || t.companyId === companyId), snapshot).filter(
    i => !companyId || i.companyId === companyId
  );
  const today = todayInPanama();
  const timedMinutes = items.filter(i => days.includes(i.day) && i.minute !== null).map(i => i.minute!);
  const firstTimedMinute = timedMinutes.length ? Math.min(...timedMinutes) : 480;

  useEffect(() => {
    daysChanged(calendarDays(date, mode));
    if (ref.current) ref.current.scrollTop = Math.max(0, firstTimedMinute - 60);
  }, [date, mode, daysChanged, firstTimedMinute]);

  const navigate = (direction: number) =>
    setDate(
      mode === 'month'
        ? (() => {
            const d = new Date(date.slice(0, 8) + '01T12:00:00Z');
            d.setUTCMonth(d.getUTCMonth() + direction);
            return d.toISOString().slice(0, 10);
          })()
        : shiftDay(date, direction * (mode === 'week' ? 7 : mode === 'three' ? 3 : 1))
    );

  const itemButton = (item: BoardItem, className: string, style?: React.CSSProperties) =>
    item.taskId ? (
      <button key={item.id} className={className} style={style} onClick={() => openTask(item.taskId!)}>
        <strong>{item.title}</strong>
        <small>
          {item.minute === null
            ? 'Sin hora'
            : `${String(Math.floor(item.minute / 60)).padStart(2, '0')}:${String(item.minute % 60).padStart(2, '0')}`}{' '}
          · {item.source}
          {item.state === 'Completed' ? ' · Completada' : ''}
        </small>
      </button>
    ) : (
      <a
        key={item.id}
        className={`${className} tm-cal-external`}
        style={style}
        title={[
          item.title,
          item.location,
          item.observedAt
            ? `Observación: ${new Date(item.observedAt).toLocaleString('es', { timeZone: 'America/Panama' })}`
            : '',
        ]
          .filter(Boolean)
          .join(' · ')}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <strong>{item.title}</strong>
        <small>
          {item.minute === null
            ? 'Todo el día'
            : `${String(Math.floor(item.minute / 60)).padStart(2, '0')}:${String(item.minute % 60).padStart(2, '0')}`}{' '}
          · {item.source}
        </small>
        {item.location && <small>{item.location}</small>}
      </a>
    );

  return (
    <section className="tm-pane tm-calendar" aria-label="Calendario visual">
      <div className="tm-heading">
        <div className="tm-heading-icon">
          <WorkspaceIcon name="calendar" />
          <div>
            <h2>Agenda Ejecutiva · Vista Semanal</h2>
            <span className="tm-small">Reuniones y bloques de trabajo sincronizados (America/Panama)</span>
          </div>
        </div>
        <div className="tm-toolbar">
          <button
            type="button"
            className="tm-soft-button"
            aria-pressed={compactList}
            onClick={() => setCompactList(v => !v)}
          >
            {compactList ? '📅 Ver Cuadrícula Semanal' : '📋 Ver en Cronología / Lista'}
          </button>
          {command && (
            <button
              type="button"
              className="tm-gold-button"
              onClick={() => setNewMeetingOpen(v => !v)}
            >
              {newMeetingOpen ? 'Cerrar formulario' : '+ Agendar Reunión / Cita'}
            </button>
          )}
        </div>
      </div>

      {newMeetingOpen && command && (
        <form
          className="tm-pane tm-pane-stone tm-meeting-quickform"
          onSubmit={async e => {
            e.preventDefault();
            if (!mTitle.trim()) return;
            const ok = await command(
              'createTask',
              {
                title: mTitle.trim(),
                companyId: mCompany || companies[0]?.id || 'business-bee-smart',
                category: mCategory.trim(),
                workDate: mDate,
                dueDate: mDate,
                isMeeting: true,
                meetingTime: mTime,
                priority: 'High',
              },
              'Reunión agendada desde calendario'
            );
            if (ok) {
              setMTitle('');
              setMCategory('');
              setNewMeetingOpen(false);
            }
          }}
        >
          <h3>📅 Agendar Nueva Reunión o Cita</h3>
          <div className="tm-form-grid">
            <label>
              Título de la reunión
              <input
                placeholder="Ej. Reunión con Armando · IA para Todos"
                value={mTitle}
                onChange={e => setMTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Empresa
              <select value={mCompany} onChange={e => setMCompany(e.target.value)}>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sub-marca / Proyecto (opcional)
              <input
                placeholder="Ej. IA para Todos, Ingredienta…"
                value={mCategory}
                onChange={e => setMCategory(e.target.value)}
              />
            </label>
            <label>
              Fecha
              <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} required />
            </label>
            <label>
              Hora (Panamá)
              <input type="time" value={mTime} onChange={e => setMTime(e.target.value)} required />
            </label>
          </div>
          <div className="tm-toolbar">
            <button className="tm-gold-button" disabled={busy}>
              Guardar Reunión en Agenda
            </button>
            <button type="button" className="tm-soft-button" onClick={() => setNewMeetingOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="tm-calendar-toolbar">
        <div className="tm-calendar-navigation">
          <button aria-label="Período anterior" onClick={() => navigate(-1)}>
            ‹
          </button>
          <button onClick={() => setDate(today)}>Hoy</button>
          <button aria-label="Período siguiente" onClick={() => navigate(1)}>
            ›
          </button>
          <label>
            <span className="sr-only">Fecha de agenda</span>
            <input
              aria-label="Fecha de agenda"
              type="date"
              value={date}
              onChange={e => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>
        <nav aria-label="Vistas de calendario">
          {[
            ['week', 'Semana'],
            ['three', '3 días'],
            ['day', 'Día'],
            ['month', 'Mes'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={mode === key && !compactList}
              onClick={() => {
                setCompactList(false);
                setMode(key as CalendarMode);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <select aria-label="Empresa de agenda" value={companyId} onChange={e => selectCompany(e.target.value)}>
          <option value="">Todas las empresas</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {compactList ? (
        <div className="tm-agenda-list-view" aria-label="Cronología compacta de la semana">
          {days.map(day => {
            const dayItems = items
              .filter(i => i.day === day)
              .sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));
            return (
              <div key={day} className={`tm-agenda-day-group ${day === today ? 'is-today' : ''}`}>
                <div className="tm-agenda-day-header">
                  <strong>
                    {new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: 'UTC' }).format(
                      new Date(day + 'T12:00:00Z')
                    )}{' '}
                    · {shortDate(day)}
                  </strong>
                  <span>{dayItems.length} bloques</span>
                </div>
                {dayItems.length ? (
                  <div className="tm-agenda-day-items">
                    {dayItems.map(i => itemButton(i, 'tm-all-day-event'))}
                  </div>
                ) : (
                  <p className="tm-small">Sin bloques programados este día.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : mode === 'month' ? (
        <div className="tm-month-grid">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
            <strong className="tm-weekday" key={d}>
              {d}
            </strong>
          ))}
          {days.map(day => (
            <section
              key={day}
              className={`tm-month-day ${day === today ? 'is-today' : ''} ${
                day.slice(0, 7) !== date.slice(0, 7) ? 'is-outside' : ''
              }`}
              aria-label={`Día ${day}`}
            >
              <button
                className="tm-day-number"
                onClick={() => {
                  setDate(day);
                  setMode('day');
                }}
              >
                {Number(day.slice(-2))}
              </button>
              {items.filter(i => i.day === day).map(i => itemButton(i, 'tm-month-event'))}
            </section>
          ))}
        </div>
      ) : (
        <div className="tm-calendar-scroll-x">
          <div className="tm-cal-days" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
            <span />
            <>
              {days.map(day => (
                <div key={day} className={day === today ? 'is-today' : ''}>
                  <strong>
                    {new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: 'UTC' }).format(
                      new Date(day + 'T12:00:00Z')
                    )}
                  </strong>
                  <span>{shortDate(day)}</span>
                </div>
              ))}
            </>
          </div>
          <div
            className="tm-cal-unscheduled"
            style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}
          >
            <span>Día</span>
            {days.map(day => (
              <div key={day}>{items.filter(i => i.day === day && i.minute === null).map(i => itemButton(i, 'tm-all-day-event'))}</div>
            ))}
          </div>
          <div className="tm-time-scroll" ref={ref}>
            <div className="tm-time-grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="tm-hour-labels">
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h}>{String(h).padStart(2, '0')}:00</span>
                ))}
              </div>
              {days.map(day => (
                <div className="tm-time-column" key={day} aria-label={`Horas ${day}`}>
                  {positionedItems(items.filter(i => i.day === day)).map(i =>
                    itemButton(i, 'tm-timed-event', {
                      top: i.minute! + 'px',
                      height: Math.max(28, i.visualEnd - i.minute!) + 'px',
                      left: `calc(${(i.lane / i.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / i.lanes}% - 4px)`,
                    })
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="tm-calendar-legend">
        <span>● Reunión / Tarea programada</span>
        <span>● Google Calendar sincronizado</span>
      </div>
      <details className="tm-detail-more">
        <summary>
          Tareas pendientes de asignar fecha ·{' '}
          {
            tasks.filter(
              t =>
                !t.workDate &&
                !t.isMeeting &&
                !t.cancelledAt &&
                t.status !== 'Completed' &&
                t.validationStatus !== 'NeedsConfirmation' &&
                (!companyId || t.companyId === companyId)
            ).length
          }
        </summary>
        {tasks
          .filter(
            t =>
              !t.workDate &&
              !t.isMeeting &&
              !t.cancelledAt &&
              t.status !== 'Completed' &&
              t.validationStatus !== 'NeedsConfirmation' &&
              (!companyId || t.companyId === companyId)
          )
          .map(t => (
            <button className="tm-soft-button" key={t.id} onClick={() => openTask(t.id)}>
              {t.title}
            </button>
          ))}
      </details>
    </section>
  );
}
