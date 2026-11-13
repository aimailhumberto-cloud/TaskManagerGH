"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { UnifiedBrainTask, DistributorSummary } from '@/lib/smjBrainService';
import TaskDotsModal from '@/components/TaskDotsModal';
import TaskDossierModal from '@/components/TaskDossierModal';
import NewBrainTaskModal from '@/components/NewBrainTaskModal';
import { useTasksT } from '@/lib/tasksI18n';

type ActiveTab = 'radar' | 'distributors' | 'markets' | 'universe' | 'calendar';

function panamaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default function TasksPage() {
  const T = useTasksT();
  const [tasks, setTasks] = useState<UnifiedBrainTask[]>([]);
  const [distributors, setDistributors] = useState<DistributorSummary[]>([]);
  const [summary, setSummary] = useState<{
    totalTasks: number;
    overdueTasks: number;
    todayTasks: number;
    next48hTasks: number;
    completedTasks: number;
    dotsAssignedTasks: number;
    distributorsCount: number;
    atRiskDistributors: number;
    panamaTimestamp?: string;
  }>({
    totalTasks: 0,
    overdueTasks: 0,
    todayTasks: 0,
    next48hTasks: 0,
    completedTasks: 0,
    dotsAssignedTasks: 0,
    distributorsCount: 0,
    atRiskDistributors: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('radar');

  // Search & Filters for Universe Table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedSourceType, setSelectedSourceType] = useState('all');

  // Modals state
  const [dotsModalTask, setDotsModalTask] = useState<UnifiedBrainTask | null>(null);
  const [dossierModalTask, setDossierModalTask] = useState<UnifiedBrainTask | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reagenda dropdown tracker
  const [activeRescheduleId, setActiveRescheduleId] = useState<string | null>(null);

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/agent/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error(T('No se pudieron cargar las tareas.'));
      const data = await res.json();
      if (data.ok) {
        setTasks(data.tasks || []);
        setDistributors(data.distributors || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      console.error('Error fetching unified tasks:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Mark task completed
  const handleComplete = async (task: UnifiedBrainTask) => {
    // Optimistic UI update
    setTasks(prev =>
      prev.map(t => (t.id === task.id ? { ...t, isCompleted: true, status: 'Completed' as const } : t))
    );
    showToast(`${T('Tarea resuelta en el Cerebro:')} "${task.title.slice(0, 35)}..."`);

    try {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          taskId: task.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(`${T('No se pudo guardar')}: ${data?.error || data?.message || T('error del servidor')}`);
        fetchTasks(true);
      }
    } catch {
      showToast(T('No se pudo guardar: sin conexión con el servidor'));
      fetchTasks(true);
    }
  };

  // 2. Reschedule task (+1d, +3d, +1w)
  const handleReschedule = async (task: UnifiedBrainTask, daysToAdd: number) => {
    setActiveRescheduleId(null);
    const baseDay = task.dueDate ? String(task.dueDate).slice(0, 10) : panamaToday();
    const curr = new Date(`${baseDay}T12:00:00Z`);
    const nextDate = new Date(curr.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const newDueDate = nextDate.toISOString().slice(0, 10);

    setTasks(prev =>
      prev.map(t => (t.id === task.id ? { ...t, dueDate: newDueDate, isOverdue: false } : t))
    );
    showToast(`${T('Tarea reagendada al')} ${newDueDate}`);

    try {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          taskId: task.id,
          newDueDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showToast(`${T('No se pudo reagendar')}: ${data?.error || data?.message || T('error del servidor')}`);
        fetchTasks(true);
      }
    } catch {
      showToast(T('No se pudo reagendar: sin conexión con el servidor'));
      fetchTasks(true);
    }
  };

  // 3. Callback when DOTS dispatch completes
  const handleDotsDispatched = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'In Review DOTS' as const, dotsStatus: 'in_progress' as const }
          : t
      )
    );
    showToast(T('Instrucción enviada a tu agente y registrada en la ficha.'));
  };

  // Filtered lists for the 5 views
  const overdueTasks = useMemo(() => tasks.filter(t => t.isOverdue && !t.isCompleted), [tasks]);
  const todayTasks = useMemo(() => tasks.filter(t => t.isToday && !t.isCompleted), [tasks]);
  const next48hTasks = useMemo(() => tasks.filter(t => t.isNext48h && !t.isCompleted), [tasks]);
  const completedTasks = useMemo(() => tasks.filter(t => t.isCompleted), [tasks]);

  // Universo filter
  const universeFilteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchSearch =
        !searchQuery.trim() ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.sourceNodeTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.country || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchMarket =
        selectedMarket === 'all' ||
        (t.countryCode || '').toLowerCase() === selectedMarket.toLowerCase();

      const matchPriority =
        selectedPriority === 'all' ||
        t.priority.toLowerCase() === selectedPriority.toLowerCase();

      const matchSource =
        selectedSourceType === 'all' ||
        t.sourceType === selectedSourceType;

      return matchSearch && matchMarket && matchPriority && matchSource;
    });
  }, [tasks, searchQuery, selectedMarket, selectedPriority, selectedSourceType]);

  // Unique markets for filter pills
  const availableMarkets = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => {
      if (t.countryCode) set.add(t.countryCode);
    });
    return Array.from(set);
  }, [tasks]);

  // Bloques del calendario: semana actual (lunes a domingo), la siguiente y el resto del mes.
  const calWeek = (() => {
    const add = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const today = panamaToday(); const dow = (new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7;
    const mon = add(today, -dow), sun = add(mon, 6);
    const [y, m] = today.split('-').map(Number); const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const restFrom = add(sun, 8), restTo = monthEnd >= restFrom ? monthEnd : add(restFrom, 13);
    const label = (a: string, b: string) => `${Number(a.slice(8))}/${Number(a.slice(5, 7))} – ${Number(b.slice(8))}/${Number(b.slice(5, 7))}`;
    return { w1: [mon, sun], w2: [add(mon, 7), add(sun, 7)], rest: [restFrom, restTo], label };
  })();

  return (
    <div className="min-h-screen bg-[#f2f6fd] text-[#0b1f4d] antialiased pb-24" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-white border border-[#bcd0f5] rounded-xl shadow-[0_24px_60px_-24px_rgba(11,31,77,0.35)] text-[#0a3fbf] text-xs font-medium flex items-center gap-2.5 animate-bounce">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Franja de marca */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid overflow-hidden rounded-[28px] lg:grid-cols-[1.2fr_1fr] bg-[#0a3fbf]">
          <div className="p-6 sm:p-8">
            <p className="text-[13px] font-semibold tracking-[0.08em] text-[#9fdcff]">{T('SEGUNDO CEREBRO · S.M. JALEEL')}</p>
            <h1 className="mt-1.5 text-3xl sm:text-[36px] font-bold text-white">{T('Tareas')}</h1>
            <p className="mt-1 text-[15px] text-[#dbeafe]">{T('Tu día, tus distribuidores y todo tu universo de tareas en un solo lugar.')}</p>
            {summary.panamaTimestamp && (
              <span className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs text-white">{T('Sincronizado:')} {summary.panamaTimestamp} (Panamá)</span>
            )}
          </div>
          <div className="relative hidden lg:block min-h-[180px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/smj-bebidas-hero.jpg" alt={T('Bebidas de S.M. Jaleel')} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 72%' }} />
            <div aria-hidden className="absolute inset-y-0 left-0 w-28" style={{ background: 'linear-gradient(90deg, #0a3fbf, rgba(10,63,191,0))' }} />
          </div>
        </div>
      </div>

      {/* Barra de acciones, cifras y pestañas */}
      <header className="sticky top-0 z-40 mt-4 border-y border-[#dbe4f3] bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              <Link
                href="/cerebro"
                className="px-3 py-1.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-50 text-xs text-sky-700 flex items-center gap-1.5 transition-colors"
                title={T('Abrir el Cerebro')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a9 9 0 019 9c0 3.87-2.69 7.1-6.4 8.48l-.6.22V22h-4v-2.3l-.6-.22A9.002 9.002 0 013 11a9 9 0 019-9z" />
                </svg>
                <span className="hidden sm:inline">{T('Cerebro')}</span>
              </Link>

              <button
                onClick={() => fetchTasks(true)}
                disabled={refreshing}
                className="px-3 py-1.5 rounded-lg border border-[#dbe4f3] bg-white hover:bg-[#eef3fb] text-xs text-slate-700 flex items-center gap-1.5 transition-colors"
                title={T('Sincronizar con el Cerebro')}
              >
                <svg
                  className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 21h5v-5" />
                </svg>
                <span className="hidden sm:inline">{T('Sincronizar')}</span>
              </button>

              <button
                onClick={() => setIsNewTaskOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#0a3fbf] hover:bg-[#08318f] text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{T('Nueva Tarea')}</span>
              </button>
            </div>
          </div>

          {/* Telemetry Hero Chips (Zero Emojis) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-3 border-t border-[#dbe4f3]">
            <div className="p-2.5 rounded-lg bg-white border border-[#dbe4f3]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">{T('Universo Tareas')}</span>
              <strong className="text-lg font-mono text-[#0b1f4d]">{summary.totalTasks}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-[#dbe4f3]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">{T('Vencidas')}</span>
              <strong className={`text-lg font-mono ${summary.overdueTasks > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                {summary.overdueTasks}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-[#dbe4f3]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">{T('Hoy & Próx 48h')}</span>
              <strong className="text-lg font-mono text-[#0a3fbf]">
                {summary.todayTasks + summary.next48hTasks}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-[#dbe4f3]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">{T('Con mi agente')}</span>
              <strong className="text-lg font-mono text-[#0a3fbf]">{summary.dotsAssignedTasks}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-[#dbe4f3] col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block tracking-wider">{T('Cuotas Monitoreadas')}</span>
              <strong className="text-lg font-mono text-emerald-700">{distributors.length} dist.</strong>
            </div>
          </div>

          {/* 5 Executive Tabs */}
          <nav className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none" aria-label={T('Vistas')}>
            {[
              { id: 'radar', label: T('Mi Día (Radar Diario)'), count: summary.todayTasks + summary.next48hTasks + summary.overdueTasks },
              { id: 'distributors', label: T('Distribuidores & Cuotas'), count: distributors.length },
              { id: 'markets', label: T('Por Mercado'), count: availableMarkets.length },
              { id: 'universe', label: T('Universo Completo'), count: summary.totalTasks },
              { id: 'calendar', label: T('Calendario Sincronizado'), count: null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[#0a3fbf] text-white font-semibold shadow'
                    : 'bg-white text-slate-700 hover:bg-[#eef3fb] border border-[#dbe4f3]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeTab === tab.id
                        ? 'bg-white text-[#0a3fbf] font-bold'
                        : 'bg-[#eef3fb] text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <svg className="animate-spin w-8 h-8 text-[#0a3fbf] mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <p className="text-xs text-slate-500 font-mono">{T('Cargando tus tareas...')}</p>
          </div>
        ) : (
          <>
            {/* VIEW 1: MI DÍA (RADAR DIARIO) */}
            {activeTab === 'radar' && (
              <div className="space-y-6">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <h2 className="text-sm font-semibold tracking-wider uppercase">
                        Vencidas / Atención Inmediata ({overdueTasks.length})
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      {overdueTasks.map(t => (
                        <TaskExecutiveCard
                          key={t.id}
                          task={t}
                          onComplete={() => handleComplete(t)}
                          onAskDots={() => setDotsModalTask(t)}
                          onOpenDossier={() => setDossierModalTask(t)}
                          onReschedule={(days) => handleReschedule(t, days)}
                          activeRescheduleId={activeRescheduleId}
                          setActiveRescheduleId={setActiveRescheduleId}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Today Section */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#0a3fbf]">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <h2 className="text-sm font-semibold tracking-wider uppercase">
                        Para Hoy ({todayTasks.length})
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{panamaToday()}</span>
                  </div>
                  {todayTasks.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] text-center text-xs text-slate-500">
                      {T('No hay tareas venciendo hoy en el Cerebro.')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {todayTasks.map(t => (
                        <TaskExecutiveCard
                          key={t.id}
                          task={t}
                          onComplete={() => handleComplete(t)}
                          onAskDots={() => setDotsModalTask(t)}
                          onOpenDossier={() => setDossierModalTask(t)}
                          onReschedule={(days) => handleReschedule(t, days)}
                          activeRescheduleId={activeRescheduleId}
                          setActiveRescheduleId={setActiveRescheduleId}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Next 48h Section */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <h2 className="text-sm font-semibold tracking-wider uppercase">
                      Próximas 48 Horas ({next48hTasks.length})
                    </h2>
                  </div>
                  {next48hTasks.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] text-center text-xs text-slate-500">
                      {T('Sin tareas programadas para las próximas 48 horas.')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {next48hTasks.map(t => (
                        <TaskExecutiveCard
                          key={t.id}
                          task={t}
                          onComplete={() => handleComplete(t)}
                          onAskDots={() => setDotsModalTask(t)}
                          onOpenDossier={() => setDossierModalTask(t)}
                          onReschedule={(days) => handleReschedule(t, days)}
                          activeRescheduleId={activeRescheduleId}
                          setActiveRescheduleId={setActiveRescheduleId}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Completed Recently */}
                {completedTasks.length > 0 && (
                  <section className="space-y-3 pt-4 border-t border-[#dbe4f3]">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <h2 className="text-sm font-semibold tracking-wider uppercase">
                        Resueltas Recientemente ({completedTasks.length})
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {completedTasks.map(t => (
                        <div
                          key={t.id}
                          className="p-3 rounded-lg border border-[#dbe4f3] bg-white opacity-70 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-700">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span className="line-through text-slate-500">{t.title}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">{t.sourceNodeTitle}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* VIEW 2: DISTRIBUIDORES & CUOTAS */}
            {activeTab === 'distributors' && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0b1f4d]">
                      {T('Monitoreo de Cuotas & Seguimientos Comerciales')}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {T('Alineación directa entre el volumen despachado (YTD), las órdenes de compra (POs) y las tareas activas.')}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#0a3fbf] font-semibold px-2.5 py-1 rounded bg-[#e8f1ff] border border-[#bcd0f5]">
                    S&OP Rolling
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {distributors.map(dist => {
                    const distTasks = tasks.filter(t => t.sourceNodeId === dist.id && !t.isCompleted);
                    return (
                      <div
                        key={dist.id}
                        className="rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] overflow-hidden flex flex-col justify-between p-5 space-y-4 hover:border-[#bcd0f5] transition-all shadow-[0_12px_28px_-18px_rgba(11,31,77,0.3)]"
                      >
                        {/* Top distributor info */}
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#eef3fb] text-[#0b1f4d] border border-[#dbe4f3]">
                                [{dist.countryCode}]
                              </span>
                              <span className="text-xs font-medium text-slate-500">{dist.country}</span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                                dist.status === 'At Risk'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : dist.status === 'Ahead'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : dist.status === 'On Track'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-white text-slate-500 border-[#dbe4f3]'
                              }`}
                            >
                              {dist.status === 'At Risk'
                                ? T('En Riesgo')
                                : dist.status === 'Ahead'
                                ? T('Superando Meta')
                                : dist.status === 'On Track'
                                ? T('En Meta')
                                : T('Sin cuota formal')}
                            </span>
                          </div>

                          <h3 className="text-base font-semibold text-[#0b1f4d] mt-2">{dist.name}</h3>

                          {/* Quota Progress Bar */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-500">
                                {dist.actualCasesYTD !== undefined && dist.targetCasesYear !== undefined
                                  ? `${dist.actualCasesYTD.toLocaleString()} / ${dist.targetCasesYear.toLocaleString()} cjs`
                                  : T('Sin dato registrado')}
                              </span>
                              <span className={dist.complianceRate !== undefined ? (dist.complianceRate < 70 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold') : 'text-slate-500'}>
                                {dist.complianceRate !== undefined ? `${dist.complianceRate}% cuota` : '—'}
                              </span>
                            </div>
                            {dist.complianceRate !== undefined ? (
                              <div className="w-full h-2 rounded-full bg-[#eef3fb] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    dist.complianceRate < 70 ? 'bg-rose-600' : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${Math.min(dist.complianceRate, 100)}%` }}
                                />
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-mono py-0.5">
                                {T('Cuota anual no registrada en ficha oficial')}
                              </div>
                            )}
                          </div>

                          {/* Next Follow-up Banner */}
                          <div className="mt-3.5 p-2.5 rounded-lg bg-white border border-[#dbe4f3] text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-[#0a3fbf] font-medium">
                              <span>{T('Próximo Hito / Seguimiento:')}</span>
                              <span className="font-mono text-slate-500">{dist.nextFollowupDate}</span>
                            </div>
                            <p className="text-[#0b1f4d]">{dist.nextFollowupAction}</p>
                          </div>
                        </div>

                        {/* Pending tasks under this distributor */}
                        <div className="space-y-2 pt-2 border-t border-[#dbe4f3]">
                          <span className="text-[11px] uppercase font-semibold text-slate-500 block tracking-wider">
                            Tareas Pendientes ({distTasks.length})
                          </span>
                          {distTasks.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">{T('No hay tareas pendientes para este distribuidor.')}</p>
                          ) : (
                            <div className="space-y-2">
                              {distTasks.map(t => (
                                <TaskExecutiveCard
                                  key={t.id}
                                  task={t}
                                  onComplete={() => handleComplete(t)}
                                  onAskDots={() => setDotsModalTask(t)}
                                  onOpenDossier={() => setDossierModalTask(t)}
                                  onReschedule={(days) => handleReschedule(t, days)}
                                  activeRescheduleId={activeRescheduleId}
                                  setActiveRescheduleId={setActiveRescheduleId}
                                  compact
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VIEW 3: POR MERCADO / TERRITORIO */}
            {activeTab === 'markets' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setSelectedMarket('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedMarket === 'all'
                        ? 'bg-[#0a3fbf] text-white font-semibold'
                        : 'bg-white text-slate-700 hover:bg-[#eef3fb] border border-[#dbe4f3]'
                    }`}
                  >
                    Todos los Territorios ({tasks.length})
                  </button>
                  {availableMarkets.map(mkt => {
                    const count = tasks.filter(t => t.countryCode === mkt).length;
                    return (
                      <button
                        key={mkt}
                        onClick={() => setSelectedMarket(mkt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                          selectedMarket === mkt
                            ? 'bg-[#0a3fbf] text-white font-semibold'
                            : 'bg-white text-slate-700 hover:bg-[#eef3fb] border border-[#dbe4f3]'
                        }`}
                      >
                        <span className="font-mono">[{mkt}]</span>
                        <span>({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {tasks
                    .filter(t => selectedMarket === 'all' || t.countryCode === selectedMarket)
                    .map(t => (
                      <TaskExecutiveCard
                        key={t.id}
                        task={t}
                        onComplete={() => handleComplete(t)}
                        onAskDots={() => setDotsModalTask(t)}
                        onOpenDossier={() => setDossierModalTask(t)}
                        onReschedule={(days) => handleReschedule(t, days)}
                        activeRescheduleId={activeRescheduleId}
                        setActiveRescheduleId={setActiveRescheduleId}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* VIEW 4: UNIVERSO COMPLETO (MATRIZ / DATA TABLE) */}
            {activeTab === 'universe' && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="p-4 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={T('Buscar en el universo por título, distribuidor o mercado...')}
                        className="w-full pl-9 pr-3.5 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-xs text-[#0b1f4d] placeholder-slate-500 focus:outline-none focus:border-[#0a3fbf]"
                      />
                      <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </div>

                    <div>
                      <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-xs text-[#0b1f4d]"
                      >
                        <option value="all">{T('Prioridad (Todas)')}</option>
                        <option value="high">{T('Alta')}</option>
                        <option value="medium">{T('Media')}</option>
                        <option value="low">{T('Baja')}</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={selectedSourceType}
                        onChange={(e) => setSelectedSourceType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f2f6fd] border border-[#dbe4f3] rounded-lg text-xs text-[#0b1f4d]"
                      >
                        <option value="all">{T('Origen (Todos)')}</option>
                        <option value="distributor">{T('Distribuidores')}</option>
                        <option value="routine">{T('Rutinas S&OP')}</option>
                        <option value="project">{T('Proyectos')}</option>
                        <option value="working_memory">{T('Memoria de trabajo')}</option>
                        <option value="market">{T('Mercados')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center justify-between">
                    <span>Mostrando {universeFilteredTasks.length} de {tasks.length} tareas</span>
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-[#0a3fbf] hover:underline">
                        {T('Limpiar búsqueda')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]">
                  <table className="w-full text-left text-xs text-[#0b1f4d]">
                    <thead className="bg-white text-slate-500 uppercase tracking-wider font-semibold border-b border-[#dbe4f3]">
                      <tr>
                        <th className="px-4 py-3">{T('Estado')}</th>
                        <th className="px-4 py-3">{T('Tarea / Compromiso')}</th>
                        <th className="px-4 py-3">{T('Ficha de origen')}</th>
                        <th className="px-4 py-3">{T('Mercado')}</th>
                        <th className="px-4 py-3">{T('Prioridad')}</th>
                        <th className="px-4 py-3">{T('Vencimiento')}</th>
                        <th className="px-4 py-3 text-right">{T('Acciones')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dbe4f3]">
                      {universeFilteredTasks.map(task => (
                        <tr key={task.id} className="hover:bg-white transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.isCompleted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : task.status === 'In Review DOTS'
                                  ? 'bg-[#e8f1ff] text-[#0a3fbf] border border-[#bcd0f5]'
                                  : task.isOverdue
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-[#eef3fb] text-slate-700 border border-[#dbe4f3]'
                              }`}
                            >
                              {task.isCompleted ? T('Resuelta') : task.status === 'In Review DOTS' ? T('Con mi agente') : task.isOverdue ? T('Vencida') : T('Pendiente')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 max-w-sm">
                            <span className={`font-medium ${task.isCompleted ? 'line-through text-slate-500' : 'text-[#0b1f4d]'}`}>
                              {task.title}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setDossierModalTask(task)}
                              className="text-[#0a3fbf] hover:underline font-medium text-xs flex items-center gap-1"
                            >
                              <span>{task.sourceNodeTitle}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </button>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#eef3fb] text-slate-700 border border-[#dbe4f3]">
                              [{task.countryCode || 'GL'}]
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                task.priority === 'High'
                                  ? 'text-rose-700 bg-rose-50 border border-rose-200'
                                  : 'text-amber-700 bg-amber-50 border border-amber-200'
                              }`}
                            >
                              {task.priority === 'High' ? T('Alta') : T('Media')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                            <span className={task.isOverdue && !task.isCompleted ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                              {task.dueDate}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {!task.isCompleted && (
                                <button
                                  onClick={() => handleComplete(task)}
                                  className="px-2.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-50 text-emerald-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                                  title={T('Marcar como resuelta')}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>{T('Resolver')}</span>
                                </button>
                              )}
                              <button
                                onClick={() => setDotsModalTask(task)}
                                className="px-2.5 py-1 rounded border border-[#bcd0f5] bg-[#e8f1ff] hover:bg-[#e8f1ff] text-[#0a3fbf] text-[11px] font-medium flex items-center gap-1 transition-colors"
                                title={T('Pedir a mi agente que haga algo')}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect width="16" height="12" x="4" y="8" rx="2" />
                                  <path d="M12 8V4H8" />
                                </svg>
                                <span>{T('Pedir a mi agente')}</span>
                              </button>
                              <button
                                onClick={() => setDossierModalTask(task)}
                                className="px-2 py-1 rounded border border-[#dbe4f3] hover:bg-[#eef3fb] text-slate-700 text-[11px] transition-colors"
                                title={T('Ver ficha en el Cerebro')}
                              >
                                {T('Ficha')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile / Condensed Card View for Universe */}
                <div className="block lg:hidden space-y-2.5">
                  {universeFilteredTasks.map(t => (
                    <TaskExecutiveCard
                      key={t.id}
                      task={t}
                      onComplete={() => handleComplete(t)}
                      onAskDots={() => setDotsModalTask(t)}
                      onOpenDossier={() => setDossierModalTask(t)}
                      onReschedule={(days) => handleReschedule(t, days)}
                      activeRescheduleId={activeRescheduleId}
                      setActiveRescheduleId={setActiveRescheduleId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 5: CALENDARIO SINCRONIZADO */}
            {activeTab === 'calendar' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#0b1f4d]">
                      {T('Calendario sincronizado con el Cerebro')}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {T('Todos los vencimientos, arribos de contenedores y cierres S&OP alineados al calendario maestro.')}
                    </p>
                  </div>
                  <a
                    href="/mi-agenda"
                    className="px-3.5 py-1.5 rounded-lg bg-[#0a3fbf] hover:bg-[#08318f] text-white font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto shadow"
                  >
                    <span>{T('Abrir Calendario Completo')}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </div>

                {/* Calendar Days Strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: `${T('Semana actual')} (${calWeek.label(calWeek.w1[0], calWeek.w1[1])})`, filter: (d?: string) => !!d && d >= calWeek.w1[0] && d <= calWeek.w1[1] },
                    { label: `${T('Próxima semana')} (${calWeek.label(calWeek.w2[0], calWeek.w2[1])})`, filter: (d?: string) => !!d && d >= calWeek.w2[0] && d <= calWeek.w2[1] },
                    { label: `${T('Resto del mes')} (${calWeek.label(calWeek.rest[0], calWeek.rest[1])})`, filter: (d?: string) => !!d && d >= calWeek.rest[0] && d <= calWeek.rest[1] },
                    { label: T('Sin Plazo Fijado / Continuas'), filter: (d?: string) => !d },
                  ].map((block, idx) => {
                    const blockTasks = tasks.filter(t => block.filter(t.dueDate) && !t.isCompleted);
                    return (
                      <div key={idx} className="p-4 rounded-2xl border border-[#dbe4f3] bg-white shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)] space-y-3">
                        <div className="flex items-center justify-between border-b border-[#dbe4f3] pb-2">
                          <span className="text-xs font-semibold text-[#0a3fbf] uppercase tracking-wide">
                            {block.label}
                          </span>
                          <span className="text-xs font-mono text-slate-500">({blockTasks.length})</span>
                        </div>
                        {blockTasks.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">{T('Sin hitos en este bloque')}</p>
                        ) : (
                          <div className="space-y-2">
                            {blockTasks.map(t => (
                              <div
                                key={t.id}
                                className="p-2.5 rounded-lg bg-white border border-[#dbe4f3] text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#eef3fb] text-slate-700 border border-[#dbe4f3]">
                                    [{t.countryCode || 'GL'}]
                                  </span>
                                  <span className="text-xs font-mono text-slate-500">{t.dueDate}</span>
                                </div>
                                <p className="font-medium text-[#0b1f4d]">{t.title}</p>
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                  <span className="text-[#0a3fbf] font-medium">{t.sourceNodeTitle}</span>
                                  <button
                                    onClick={() => setDotsModalTask(t)}
                                    className="text-[#0a3fbf] hover:text-[#0a3fbf] font-medium"
                                  >
                                    {T('Pedir a mi agente')}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/Brands-you-Love_2-copy-scaled.jpg" alt="" className="w-full rounded-[20px]" />
      </div>

      <TaskDotsModal
        task={dotsModalTask}
        isOpen={!!dotsModalTask}
        onClose={() => setDotsModalTask(null)}
        onDispatched={handleDotsDispatched}
      />

      <TaskDossierModal
        task={dossierModalTask}
        isOpen={!!dossierModalTask}
        onClose={() => setDossierModalTask(null)}
        onAskDots={(task) => setDotsModalTask(task)}
      />

      <NewBrainTaskModal
        distributors={distributors}
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onCreated={() => {
          showToast(T('Tarea agregada a tu cerebro.'));
          fetchTasks(true);
        }}
      />
    </div>
  );
}

// -------------------------------------------------------------
// Component: TaskExecutiveCard (Executive Style, Zero Emojis)
// -------------------------------------------------------------
function TaskExecutiveCard({
  task,
  onComplete,
  onAskDots,
  onOpenDossier,
  onReschedule,
  activeRescheduleId,
  setActiveRescheduleId,
  compact = false,
}: {
  task: UnifiedBrainTask;
  onComplete: () => void;
  onAskDots: () => void;
  onOpenDossier: () => void;
  onReschedule: (days: number) => void;
  activeRescheduleId: string | null;
  setActiveRescheduleId: (id: string | null) => void;
  compact?: boolean;
}) {
  const T = useTasksT();
  const isRescheduleOpen = activeRescheduleId === task.id;

  return (
    <div
      className={`rounded-xl border transition-all ${
        task.isCompleted
          ? 'border-[#dbe4f3] bg-white opacity-60'
          : task.status === 'In Review DOTS'
          ? 'border-[#bcd0f5] bg-white'
          : task.isOverdue
          ? 'border-rose-200 bg-white'
          : task.isToday
          ? 'border-[#bcd0f5] bg-white'
          : 'border-[#dbe4f3] bg-white hover:border-[#dbe4f3]'
      } p-3.5 sm:p-4 shadow flex flex-col justify-between gap-3`}
    >
      {/* Top Meta Line */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Monospace Country Badge */}
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#eef3fb] text-slate-700 border border-[#dbe4f3]">
            [{task.countryCode || 'GL'}]
          </span>

          {/* Source Node Link */}
          <button
            onClick={onOpenDossier}
            className="text-xs font-semibold text-[#0a3fbf] hover:text-[#0a3fbf] hover:underline flex items-center gap-1"
          >
            <span>{task.sourceNodeTitle}</span>
          </button>

          {/* DOTS active status pulse & stage (Point 7) */}
          {task.dotsStatus !== 'idle' && (
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                task.dotsStage === 'borrador_listo'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : task.dotsStage === 'en_analisis'
                  ? 'bg-[#e8f1ff] text-[#0a3fbf] border-[#bcd0f5]'
                  : task.dotsStage === 'recibido'
                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>
                {task.dotsStage === 'borrador_listo'
                  ? '[DOTS: Borrador listo]'
                  : task.dotsStage === 'en_analisis'
                  ? '[DOTS: En análisis]'
                  : task.dotsStage === 'recibido'
                  ? '[DOTS: Recibido]'
                  : '[DOTS: Solicitado]'}
              </span>
            </span>
          )}

          {/* Quota Compliance status if applicable (Point 1) */}
          {task.distributorQuota && (
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                task.distributorQuota.status === 'At Risk'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : task.distributorQuota.status === 'Ahead'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : task.distributorQuota.status === 'On Track'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-white text-slate-500 border-[#dbe4f3]'
              }`}
            >
              {task.distributorQuota.complianceRate !== undefined
                ? `Cuota: ${task.distributorQuota.complianceRate}%`
                : T('Cuota: Sin dato registrado')}
            </span>
          )}
        </div>

        {/* Due Date (Point 2) */}
        <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
          <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span
            className={
              task.isOverdue && !task.isCompleted
                ? 'text-rose-700 font-bold'
                : task.isToday
                ? 'text-[#0a3fbf] font-bold'
                : task.dueDate
                ? 'text-slate-500'
                : 'text-slate-500 italic'
            }
          >
            {task.dueDate || T('Sin fecha fijada')}
          </span>
        </div>
      </div>

      {/* Task Title */}
      <div>
        <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-slate-500' : 'text-[#0b1f4d]'} leading-snug`}>
          {task.title}
        </p>
        {!compact && task.description && task.description !== task.title && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Desktop / Mobile Action Bar */}
      <div className="pt-2 border-t border-[#dbe4f3] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Action 1: Marcar Resuelto */}
          {!task.isCompleted && (
            <button
              onClick={onComplete}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-50 text-emerald-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{T('Resolver')}</span>
            </button>
          )}

          {/* Action 2: Pedir a mi agente */}
          <button
            onClick={onAskDots}
            className="px-2.5 py-1.5 rounded-lg border border-[#bcd0f5] bg-[#e8f1ff] hover:bg-[#e8f1ff] text-[#0a3fbf] text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M12 8V4H8" />
              <line x1="2" y1="14" x2="4" y2="14" />
              <line x1="20" y1="14" x2="22" y2="14" />
            </svg>
            <span>{T('Pedir a mi agente')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Action 3: Reagendar Dropdown */}
          {!task.isCompleted && (
            <div className="relative">
              <button
                onClick={() => setActiveRescheduleId(isRescheduleOpen ? null : task.id)}
                className="px-2.5 py-1.5 rounded-lg border border-[#dbe4f3] bg-white hover:bg-[#eef3fb] text-slate-700 text-xs flex items-center gap-1 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
                <span>{T('Reagendar')}</span>
              </button>

              {isRescheduleOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-36 bg-white border border-[#dbe4f3] rounded-lg shadow-[0_24px_60px_-24px_rgba(11,31,77,0.35)] py-1 z-30 animate-fadeIn">
                  <button
                    onClick={() => onReschedule(1)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#0b1f4d] hover:bg-[#eef3fb]"
                  >
                    {T('+1 Día')}
                  </button>
                  <button
                    onClick={() => onReschedule(3)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#0b1f4d] hover:bg-[#eef3fb]"
                  >
                    {T('+3 Días')}
                  </button>
                  <button
                    onClick={() => onReschedule(7)}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#0b1f4d] hover:bg-[#eef3fb]"
                  >
                    {T('+1 Semana')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action 4: Ver en Cerebro */}
          <button
            onClick={onOpenDossier}
            className="px-2.5 py-1.5 rounded-lg border border-[#dbe4f3] bg-white hover:bg-[#eef3fb] text-[#0a3fbf] text-xs flex items-center gap-1 transition-colors"
            title={T('Ver ficha en el Cerebro')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            </svg>
            <span className="hidden sm:inline">{T('Ver en Cerebro')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
