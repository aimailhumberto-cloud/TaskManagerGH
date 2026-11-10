"use client";

import React, { useState, useEffect, useMemo } from 'react';
import type { UnifiedBrainTask, DistributorSummary } from '@/lib/smjBrainService';
import TaskDotsModal from '@/components/TaskDotsModal';
import TaskDossierModal from '@/components/TaskDossierModal';
import NewBrainTaskModal from '@/components/NewBrainTaskModal';

type ActiveTab = 'radar' | 'distributors' | 'markets' | 'universe' | 'calendar';

export default function TasksPage() {
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
      if (!res.ok) throw new Error('Error al consultar tareas del cerebro');
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
      prev.map(t => (t.id === task.id ? { ...t, isCompleted: true, status: 'Completed' } : t))
    );
    showToast(`Tarea resuelta en el Cerebro: "${task.title.slice(0, 35)}..."`);

    try {
      const res = await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          taskId: task.id,
          completedBy: 'Chairman / Executive Office',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        fetchTasks(true);
      }
    } catch {
      fetchTasks(true);
    }
  };

  // 2. Reschedule task (+1d, +3d, +1w)
  const handleReschedule = async (task: UnifiedBrainTask, daysToAdd: number) => {
    setActiveRescheduleId(null);
    const curr = new Date(task.dueDate || new Date());
    const nextDate = new Date(curr.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const newDueDate = nextDate.toISOString().slice(0, 10);

    setTasks(prev =>
      prev.map(t => (t.id === task.id ? { ...t, dueDate: newDueDate, isOverdue: false } : t))
    );
    showToast(`Tarea reagendada al ${newDueDate}`);

    try {
      await fetch('/api/agent/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          taskId: task.id,
          newDueDate,
        }),
      });
    } catch {
      fetchTasks(true);
    }
  };

  // 3. Callback when DOTS dispatch completes
  const handleDotsDispatched = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'In Review DOTS', dotsStatus: 'in_progress' }
          : t
      )
    );
    showToast('Instrucción enviada a DOTS y registrada en expediente.');
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

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased pb-24">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-[#111c2e] border border-amber-500/60 rounded-xl shadow-2xl text-amber-200 text-xs font-medium flex items-center gap-2.5 animate-bounce">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation & Executive Header */}
      <header className="border-b border-[#1b263b] bg-[#0c1322]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  SM JALEEL & CO. LTD.
                </span>
                <span className="text-xs text-slate-500">|</span>
                <span className="text-xs text-slate-400 font-mono">SEGUNDO CEREBRO (SSOT)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-100 tracking-tight mt-1 flex items-center gap-3">
                <span>Executive Task Manager</span>
                {summary.panamaTimestamp && (
                  <span className="text-[11px] font-mono font-normal text-slate-400 bg-slate-900/90 px-2.5 py-0.5 rounded border border-slate-700/80">
                    Sincronizado: {summary.panamaTimestamp} (Panamá)
                  </span>
                )}
              </h1>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchTasks(true)}
                disabled={refreshing}
                className="px-3 py-1.5 rounded-lg border border-[#2b3a4f] bg-[#111c2e] hover:bg-[#1a2b45] text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
                title="Sincronizar con el Cerebro"
              >
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`}
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
                <span className="hidden sm:inline">Sincronizar</span>
              </button>

              <button
                onClick={() => setIsNewTaskOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Nueva Tarea</span>
              </button>
            </div>
          </div>

          {/* Telemetry Hero Chips (Zero Emojis) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-3 border-t border-[#182337]">
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-[#1d2b42]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Universo Tareas</span>
              <strong className="text-lg font-mono text-slate-100">{summary.totalTasks}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-[#1d2b42]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Vencidas</span>
              <strong className={`text-lg font-mono ${summary.overdueTasks > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {summary.overdueTasks}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-[#1d2b42]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Hoy & Próx 48h</span>
              <strong className="text-lg font-mono text-amber-300">
                {summary.todayTasks + summary.next48hTasks}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-[#1d2b42]">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">En Trámite DOTS</span>
              <strong className="text-lg font-mono text-indigo-400">{summary.dotsAssignedTasks}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0e1626] border border-[#1d2b42] col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">Cuotas Monitoreadas</span>
              <strong className="text-lg font-mono text-emerald-400">{distributors.length} dist.</strong>
            </div>
          </div>

          {/* 5 Executive Tabs */}
          <nav className="flex items-center gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none" aria-label="Vistas Ejecutivas">
            {[
              { id: 'radar', label: 'Mi Día (Radar Diario)', count: summary.todayTasks + summary.next48hTasks + summary.overdueTasks },
              { id: 'distributors', label: 'Distribuidores & Cuotas', count: distributors.length },
              { id: 'markets', label: 'Por Mercado', count: availableMarkets.length },
              { id: 'universe', label: 'Universo Completo', count: summary.totalTasks },
              { id: 'calendar', label: 'Calendario Sincronizado', count: null },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow'
                    : 'bg-[#101a2b] text-slate-300 hover:bg-[#16253d] border border-[#1e2d44]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      activeTab === tab.id
                        ? 'bg-slate-950/20 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400'
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
            <svg className="animate-spin w-8 h-8 text-amber-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <p className="text-xs text-slate-400 font-mono">Cargando tareas unificadas del Segundo Cerebro...</p>
          </div>
        ) : (
          <>
            {/* VIEW 1: MI DÍA (RADAR DIARIO) */}
            {activeTab === 'radar' && (
              <div className="space-y-6">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 text-rose-400">
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
                    <div className="flex items-center gap-2 text-amber-300">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <h2 className="text-sm font-semibold tracking-wider uppercase">
                        Para Hoy ({todayTasks.length})
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-slate-500">{new Date().toISOString().slice(0, 10)}</span>
                  </div>
                  {todayTasks.length === 0 ? (
                    <div className="p-6 rounded-xl border border-[#1b273d] bg-[#0c1424] text-center text-xs text-slate-400">
                      No hay tareas venciendo hoy en el Cerebro.
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
                  <div className="flex items-center gap-2 text-slate-300">
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
                    <div className="p-6 rounded-xl border border-[#1b273d] bg-[#0c1424] text-center text-xs text-slate-400">
                      Sin tareas programadas para las próximas 48 horas.
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
                  <section className="space-y-3 pt-4 border-t border-[#182337]">
                    <div className="flex items-center gap-2 text-emerald-400">
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
                          className="p-3 rounded-lg border border-[#1a2c3a] bg-[#0a1522] opacity-70 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                            <span className="line-through text-slate-400">{t.title}</span>
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
                <div className="p-4 rounded-xl border border-[#23354e] bg-[#0d1728] flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      Monitoreo de Cuotas & Seguimientos Comerciales
                    </h2>
                    <p className="text-xs text-slate-400">
                      Alineación directa entre el volumen despachado (YTD), las órdenes de compra (POs) y las tareas activas.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-semibold px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30">
                    S&OP Rolling
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {distributors.map(dist => {
                    const distTasks = tasks.filter(t => t.sourceNodeId === dist.id && !t.isCompleted);
                    return (
                      <div
                        key={dist.id}
                        className="rounded-xl border border-[#1e2f47] bg-[#0c1424] overflow-hidden flex flex-col justify-between p-5 space-y-4 hover:border-amber-500/40 transition-all shadow-lg"
                      >
                        {/* Top distributor info */}
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                                [{dist.countryCode}]
                              </span>
                              <span className="text-xs font-medium text-slate-400">{dist.country}</span>
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                                dist.status === 'At Risk'
                                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                                  : dist.status === 'Ahead'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                  : dist.status === 'On Track'
                                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                  : 'bg-slate-900/60 text-slate-400 border-slate-700/60'
                              }`}
                            >
                              {dist.status === 'At Risk'
                                ? 'En Riesgo'
                                : dist.status === 'Ahead'
                                ? 'Superando Meta'
                                : dist.status === 'On Track'
                                ? 'En Meta'
                                : 'Sin cuota formal'}
                            </span>
                          </div>

                          <h3 className="text-base font-semibold text-slate-100 mt-2">{dist.name}</h3>

                          {/* Quota Progress Bar */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-400">
                                {dist.actualCasesYTD !== undefined && dist.targetCasesYear !== undefined
                                  ? `${dist.actualCasesYTD.toLocaleString()} / ${dist.targetCasesYear.toLocaleString()} cjs`
                                  : 'Sin dato registrado'}
                              </span>
                              <span className={dist.complianceRate !== undefined ? (dist.complianceRate < 70 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold') : 'text-slate-500'}>
                                {dist.complianceRate !== undefined ? `${dist.complianceRate}% cuota` : '—'}
                              </span>
                            </div>
                            {dist.complianceRate !== undefined ? (
                              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    dist.complianceRate < 70 ? 'bg-rose-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.min(dist.complianceRate, 100)}%` }}
                                />
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-mono py-0.5">
                                Cuota anual no registrada en ficha oficial
                              </div>
                            )}
                          </div>

                          {/* Next Follow-up Banner */}
                          <div className="mt-3.5 p-2.5 rounded-lg bg-[#111c2e] border border-[#1b2b42] text-xs space-y-1">
                            <div className="flex items-center justify-between text-[11px] text-amber-300 font-medium">
                              <span>Próximo Hito / Seguimiento:</span>
                              <span className="font-mono text-slate-400">{dist.nextFollowupDate}</span>
                            </div>
                            <p className="text-slate-200">{dist.nextFollowupAction}</p>
                          </div>
                        </div>

                        {/* Pending tasks under this distributor */}
                        <div className="space-y-2 pt-2 border-t border-[#18253a]">
                          <span className="text-[11px] uppercase font-semibold text-slate-400 block tracking-wider">
                            Tareas Pendientes ({distTasks.length})
                          </span>
                          {distTasks.length === 0 ? (
                            <p className="text-xs text-slate-500 italic">No hay tareas pendientes para este distribuidor.</p>
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
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-[#111c2e] text-slate-300 hover:bg-[#1a2b45] border border-[#1e2d44]'
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
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-[#111c2e] text-slate-300 hover:bg-[#1a2b45] border border-[#1e2d44]'
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
                <div className="p-4 rounded-xl border border-[#1e2f47] bg-[#0c1424] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2 relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar en el universo por título, distribuidor o mercado..."
                        className="w-full pl-9 pr-3.5 py-2 bg-[#080d18] border border-[#23354e] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
                        className="w-full px-3 py-2 bg-[#080d18] border border-[#23354e] rounded-lg text-xs text-slate-200"
                      >
                        <option value="all">Prioridad (Todas)</option>
                        <option value="high">Alta</option>
                        <option value="medium">Media</option>
                        <option value="low">Baja</option>
                      </select>
                    </div>

                    <div>
                      <select
                        value={selectedSourceType}
                        onChange={(e) => setSelectedSourceType(e.target.value)}
                        className="w-full px-3 py-2 bg-[#080d18] border border-[#23354e] rounded-lg text-xs text-slate-200"
                      >
                        <option value="all">Origen (Todos)</option>
                        <option value="distributor">Distribuidores</option>
                        <option value="routine">Rutinas S&OP</option>
                        <option value="project">Proyectos</option>
                        <option value="working_memory">Memoria Activa (DOTS)</option>
                        <option value="market">Mercados</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Mostrando {universeFilteredTasks.length} de {tasks.length} tareas</span>
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-amber-400 hover:underline">
                        Limpiar búsqueda
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#1e2f47] bg-[#0c1424]">
                  <table className="w-full text-left text-xs text-slate-200">
                    <thead className="bg-[#101b2d] text-slate-400 uppercase tracking-wider font-semibold border-b border-[#1b2b42]">
                      <tr>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Tarea / Compromiso</th>
                        <th className="px-4 py-3">Nodo Fuente</th>
                        <th className="px-4 py-3">Mercado</th>
                        <th className="px-4 py-3">Prioridad</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3 text-right">Acciones Ejecutivas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#162337]">
                      {universeFilteredTasks.map(task => (
                        <tr key={task.id} className="hover:bg-[#111e33] transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                task.isCompleted
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                  : task.status === 'In Review DOTS'
                                  ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                                  : task.isOverdue
                                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {task.isCompleted ? 'Resuelta' : task.status === 'In Review DOTS' ? 'DOTS' : task.isOverdue ? 'Vencida' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 max-w-sm">
                            <span className={`font-medium ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                              {task.title}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => setDossierModalTask(task)}
                              className="text-amber-400 hover:underline font-medium text-xs flex items-center gap-1"
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
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              [{task.countryCode || 'GL'}]
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                task.priority === 'High'
                                  ? 'text-rose-300 bg-rose-950/40 border border-rose-800/40'
                                  : 'text-amber-300 bg-amber-950/40 border border-amber-800/40'
                              }`}
                            >
                              {task.priority === 'High' ? 'Alta' : 'Media'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs">
                            <span className={task.isOverdue && !task.isCompleted ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                              {task.dueDate}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {!task.isCompleted && (
                                <button
                                  onClick={() => handleComplete(task)}
                                  className="px-2.5 py-1 rounded border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                                  title="Marcar Resuelto en Cerebro"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  <span>Resolver</span>
                                </button>
                              )}
                              <button
                                onClick={() => setDotsModalTask(task)}
                                className="px-2.5 py-1 rounded border border-indigo-700/60 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                                title="Pedir a DOTS que ejecute una acción"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect width="16" height="12" x="4" y="8" rx="2" />
                                  <path d="M12 8V4H8" />
                                </svg>
                                <span>Pedir a DOTS</span>
                              </button>
                              <button
                                onClick={() => setDossierModalTask(task)}
                                className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800 text-slate-300 text-[11px] transition-colors"
                                title="Ver Ficha en Cerebro"
                              >
                                Ficha
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
                <div className="p-4 rounded-xl border border-[#23354e] bg-[#0d1728] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">
                      Agenda Ejecutiva Sincronizada 1:1 con el Cerebro
                    </h2>
                    <p className="text-xs text-slate-400">
                      Todos los vencimientos, arribos de contenedores y cierres S&OP alineados al calendario maestro.
                    </p>
                  </div>
                  <a
                    href="/calendar"
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto shadow"
                  >
                    <span>Abrir Calendario Completo</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </div>

                {/* Calendar Days Strip */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Semana Actual (Nov 9 - 15)', filter: (d?: string) => !!d && d >= '2026-11-09' && d <= '2026-11-15' },
                    { label: 'Próxima Semana (Nov 16 - 22)', filter: (d?: string) => !!d && d >= '2026-11-16' && d <= '2026-11-22' },
                    { label: 'Cierre de Mes (Nov 23 - 30)', filter: (d?: string) => !!d && d >= '2026-11-23' && d <= '2026-11-30' },
                    { label: 'Sin Plazo Fijado / Continuas', filter: (d?: string) => !d },
                  ].map((block, idx) => {
                    const blockTasks = tasks.filter(t => block.filter(t.dueDate) && !t.isCompleted);
                    return (
                      <div key={idx} className="p-4 rounded-xl border border-[#1e2f47] bg-[#0c1424] space-y-3">
                        <div className="flex items-center justify-between border-b border-[#1b2b42] pb-2">
                          <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                            {block.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">({blockTasks.length})</span>
                        </div>
                        {blockTasks.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">Sin hitos en este bloque</p>
                        ) : (
                          <div className="space-y-2">
                            {blockTasks.map(t => (
                              <div
                                key={t.id}
                                className="p-2.5 rounded-lg bg-[#111c2e] border border-[#1f3049] text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                    [{t.countryCode || 'GL'}]
                                  </span>
                                  <span className="text-xs font-mono text-slate-400">{t.dueDate}</span>
                                </div>
                                <p className="font-medium text-slate-200">{t.title}</p>
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                  <span className="text-amber-400 font-medium">{t.sourceNodeTitle}</span>
                                  <button
                                    onClick={() => setDotsModalTask(t)}
                                    className="text-indigo-400 hover:text-indigo-300 font-medium"
                                  >
                                    Pedir a DOTS
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
          showToast('Tarea agregada exitosamente al Cerebro.');
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
  const isRescheduleOpen = activeRescheduleId === task.id;

  return (
    <div
      className={`rounded-xl border transition-all ${
        task.isCompleted
          ? 'border-[#172535] bg-[#09111c] opacity-60'
          : task.status === 'In Review DOTS'
          ? 'border-indigo-800/60 bg-[#0d162a]'
          : task.isOverdue
          ? 'border-rose-900/60 bg-[#160d14]'
          : task.isToday
          ? 'border-amber-500/40 bg-[#141824]'
          : 'border-[#1b2b42] bg-[#0c1424] hover:border-[#273d5e]'
      } p-3.5 sm:p-4 shadow flex flex-col justify-between gap-3`}
    >
      {/* Top Meta Line */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Monospace Country Badge */}
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            [{task.countryCode || 'GL'}]
          </span>

          {/* Source Node Link */}
          <button
            onClick={onOpenDossier}
            className="text-xs font-semibold text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1"
          >
            <span>{task.sourceNodeTitle}</span>
          </button>

          {/* DOTS active status pulse & stage (Point 7) */}
          {task.dotsStatus !== 'idle' && (
            <span
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                task.dotsStage === 'borrador_listo'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  : task.dotsStage === 'en_analisis'
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                  : task.dotsStage === 'recibido'
                  ? 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
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
                  ? 'bg-rose-950/50 text-rose-300 border-rose-800/50'
                  : task.distributorQuota.status === 'Ahead'
                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                  : task.distributorQuota.status === 'On Track'
                  ? 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                  : 'bg-slate-900/50 text-slate-400 border-slate-700/50'
              }`}
            >
              {task.distributorQuota.complianceRate !== undefined
                ? `Cuota: ${task.distributorQuota.complianceRate}%`
                : 'Cuota: Sin dato registrado'}
            </span>
          )}
        </div>

        {/* Due Date (Point 2) */}
        <div className="flex items-center gap-1.5 text-xs font-mono shrink-0">
          <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span
            className={
              task.isOverdue && !task.isCompleted
                ? 'text-rose-400 font-bold'
                : task.isToday
                ? 'text-amber-300 font-bold'
                : task.dueDate
                ? 'text-slate-400'
                : 'text-slate-500 italic'
            }
          >
            {task.dueDate || 'Sin fecha fijada'}
          </span>
        </div>
      </div>

      {/* Task Title */}
      <div>
        <p className={`text-sm font-medium ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'} leading-snug`}>
          {task.title}
        </p>
        {!compact && task.description && task.description !== task.title && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Desktop / Mobile Action Bar */}
      <div className="pt-2 border-t border-[#162337] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Action 1: Marcar Resuelto */}
          {!task.isCompleted && (
            <button
              onClick={onComplete}
              className="px-2.5 py-1.5 rounded-lg border border-emerald-700/60 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Resolver</span>
            </button>
          )}

          {/* Action 2: Pedir a DOTS */}
          <button
            onClick={onAskDots}
            className="px-2.5 py-1.5 rounded-lg border border-indigo-700/60 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M12 8V4H8" />
              <line x1="2" y1="14" x2="4" y2="14" />
              <line x1="20" y1="14" x2="22" y2="14" />
            </svg>
            <span>Pedir a DOTS</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Action 3: Reagendar Dropdown */}
          {!task.isCompleted && (
            <div className="relative">
              <button
                onClick={() => setActiveRescheduleId(isRescheduleOpen ? null : task.id)}
                className="px-2.5 py-1.5 rounded-lg border border-[#2b3a4f] bg-[#101b2e] hover:bg-[#182740] text-slate-300 text-xs flex items-center gap-1 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
                <span>Reagendar</span>
              </button>

              {isRescheduleOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-36 bg-[#0e1726] border border-[#26384f] rounded-lg shadow-2xl py-1 z-30 animate-fadeIn">
                  <button
                    onClick={() => onReschedule(1)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    +1 Día
                  </button>
                  <button
                    onClick={() => onReschedule(3)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    +3 Días
                  </button>
                  <button
                    onClick={() => onReschedule(7)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    +1 Semana
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action 4: Ver en Cerebro */}
          <button
            onClick={onOpenDossier}
            className="px-2.5 py-1.5 rounded-lg border border-[#2b3a4f] bg-[#101b2e] hover:bg-[#182740] text-amber-300 text-xs flex items-center gap-1 transition-colors"
            title="Ver expediente en Cerebro"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            </svg>
            <span className="hidden sm:inline">Ver en Cerebro</span>
          </button>
        </div>
      </div>
    </div>
  );
}
