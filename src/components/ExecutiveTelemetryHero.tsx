'use client';
import { useEffect, useState } from 'react';
import type { Company, Task } from '@/services/mockData';
import { getCompanyMeta } from '@/lib/hbCompanies';
import { calendarDays } from '@/lib/calendarBoard';
import { shortDate } from '@/lib/workspaceDisplay';

export interface TelemetryHeroProps {
  title: string;
  subtitle: string;
  today: string;
  tasks: Task[];
  todays: Task[];
  doneToday: number;
  dueCount: number;
  companies: Company[];
  onSelectFilter?: (filter: 'today' | 'overdue' | 'deliverables' | 'all') => void;
  rightSlot?: React.ReactNode;
}

export default function ExecutiveTelemetryHero({
  title,
  subtitle,
  today,
  tasks,
  todays,
  doneToday,
  dueCount,
  companies,
  onSelectFilter,
  rightSlot,
}: TelemetryHeroProps) {
  const [ptyClock, setPtyClock] = useState('08:35 AM');
  const [trtClock, setTrtClock] = useState('09:35 AM');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setPtyClock(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/Panama',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setTrtClock(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/Port_of_Spain',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateClocks();
    const timer = setInterval(updateClocks, 15000);
    return () => clearInterval(timer);
  }, []);

  // 1. Donut 1: Today's execution
  const inProgressToday = todays.filter(t => t.status === 'In Progress').length;
  const totalToday = Math.max(todays.length, 1);
  const doneDeg = Math.round((doneToday / totalToday) * 360);
  const progressDeg = doneDeg + Math.round((inProgressToday / totalToday) * 360);
  const activePercent = todays.length
    ? Math.round(((doneToday + inProgressToday * 0.5) / todays.length) * 100)
    : 0;
  const todayGradient = `conic-gradient(#5fd4c4 0deg ${doneDeg}deg, #e9bc6e ${doneDeg}deg ${progressDeg}deg, rgba(255,255,255,0.12) ${progressDeg}deg 360deg)`;

  // 2. Donut 2: Company distribution
  const activeTasks = tasks.filter(t => !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation');
  const companyCounts = companies
    .map(c => ({
      company: c,
      meta: getCompanyMeta(c.id, c.name),
      count: activeTasks.filter(t => t.companyId === c.id).length,
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalCompanyTasks = Math.max(
    companyCounts.reduce((acc, item) => acc + item.count, 0),
    1
  );
  let currentAngle = 0;
  const segments = companyCounts.map(item => {
    const start = currentAngle;
    const span = Math.round((item.count / totalCompanyTasks) * 360);
    currentAngle = Math.min(360, start + span);
    return `${item.meta.color} ${start}deg ${currentAngle}deg`;
  });
  const companyGradient = segments.length
    ? `conic-gradient(${segments.join(', ')}, rgba(255,255,255,0.12) ${currentAngle}deg 360deg)`
    : 'conic-gradient(#e9bc6e 0deg 140deg, #5fd4c4 140deg 260deg, #4ea8de 260deg 360deg)';

  const topCompany = companyCounts[0];
  const topCompanyPct = topCompany ? Math.round((topCompany.count / totalCompanyTasks) * 100) : 0;

  // 3. Weekly Velocity Bars (Mon-Sun)
  const weekDays = calendarDays(today, 'week');
  const dayLabels = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
  const barCounts = weekDays.map(d => {
    const count = activeTasks.filter(
      t =>
        t.workDate === d ||
        t.dueDate?.slice(0, 10) === d ||
        (t.completedDays || []).includes(d)
    ).length;
    return { day: d, count };
  });
  const maxBar = Math.max(...barCounts.map(b => b.count), 3);

  return (
    <header className="tm-telemetry-hero" aria-label="Telemetría ejecutiva">
      <div className="tm-telemetry-copy">
        <span className="tm-eyebrow">TASKMANAGER HB · {shortDate(today).toUpperCase()} · PANAMÁ</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div className="tm-telemetry-clocks" aria-label="Relojes del mundo y clima">
          <span className="tm-clock-pill">
            🇵🇦 Panamá <b>{ptyClock}</b>
          </span>
          <span className="tm-clock-pill">
            🇹🇹 Trinidad SMJ <b>{trtClock}</b>
          </span>
          <span className="tm-clock-pill">
            🌊 Playa Caracol <b>28°C · 1.1m</b>
          </span>
          {rightSlot}
        </div>
      </div>

      {/* Pie / Donut 1: Ejecución Hoy */}
      <button
        type="button"
        className="tm-telemetry-card"
        onClick={() => onSelectFilter?.('today')}
        title="Filtrar operaciones de hoy"
      >
        <div
          className="tm-donut-ring"
          style={{ background: todayGradient }}
          data-label={`${activePercent}%`}
        />
        <div className="tm-telemetry-meta">
          <span className="tm-eyebrow">Pie · Ejecución Hoy</span>
          <strong>
            {doneToday}/{todays.length} hechas · {inProgressToday} en curso
          </strong>
          <small>{dueCount} alertas por vencer</small>
        </div>
      </button>

      {/* Pie / Donut 2: Carga por Empresa */}
      <button
        type="button"
        className="tm-telemetry-card"
        onClick={() => onSelectFilter?.('all')}
        title="Ver carga por empresa"
      >
        <div
          className="tm-donut-ring"
          style={{ background: companyGradient }}
          data-label={`${companies.length} Emp`}
        />
        <div className="tm-telemetry-meta">
          <span className="tm-eyebrow">Pie · Carga por Empresa</span>
          <strong>
            {topCompany ? `${topCompany.company.name} ${topCompanyPct}%` : '7 Empresas Activas'}
          </strong>
          <small>
            {companyCounts
              .slice(1, 3)
              .map(c => `${c.company.name} (${c.count})`)
              .join(' · ') || 'Distribución operativa'}
          </small>
        </div>
      </button>

      {/* Bar Chart: Ritmo Semanal Lu-Do */}
      <div className="tm-telemetry-card tm-telemetry-bars-card">
        <div className="tm-mini-bars" aria-label="Gráfica semanal lunes a domingo">
          {barCounts.map((b, idx) => {
            const heightPx = Math.max(12, Math.round((b.count / maxBar) * 44));
            const isCurrentDay = b.day === today;
            return (
              <div key={b.day} className={`tm-mini-bar-col ${isCurrentDay ? 'is-today' : ''}`}>
                <div
                  className="tm-mini-bar"
                  style={{ height: `${heightPx}px` }}
                  title={`${dayLabels[idx]} (${b.day}): ${b.count} actividades`}
                />
                <span>{dayLabels[idx]}</span>
              </div>
            );
          })}
        </div>
        <div className="tm-telemetry-meta">
          <span className="tm-eyebrow">Ritmo Semanal Lu–Do</span>
          <strong>{activeTasks.filter(t => t.status === 'Completed').length} completadas</strong>
          <small>{activeTasks.filter(t => t.status !== 'Completed').length} activas en cartera</small>
        </div>
      </div>
    </header>
  );
}
