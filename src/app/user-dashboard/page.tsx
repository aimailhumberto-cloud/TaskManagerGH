"use client";

import React, { useState, useEffect, useMemo } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer, { Task, Person, Company } from '@/components/TaskDrawer';

export default function UserDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Raw API lists before filtering
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawCompanies, setRawCompanies] = useState<Company[]>([]);
  const [rawPeople, setRawPeople] = useState<Person[]>([]);
  const [session, setSession] = useState<any>(null);

  // Fetch session on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setSession(data.user);
          }
        }
      } catch (err) {
        console.error('Error fetching session in user dashboard:', err);
      } finally {
        setSessionLoaded(true);
      }
    }
    fetchSession();
  }, []);

  // Filter lists according to role/company
  useEffect(() => {
    let filteredTasks = rawTasks;
    let filteredPeople = rawPeople;
    let filteredCompanies = rawCompanies;

    if (session) {
      const GLOBAL_ROLES = ['CEO', 'Coordinador Operativo', 'Admin', 'Developer', 'Agente de IA', 'AIAgent'];
      const isGlobalUser = !session.companyId || GLOBAL_ROLES.includes(session.role);
      if (!isGlobalUser) {
        if (session.role === 'Tercero / Externo') {
          filteredTasks = filteredTasks.filter(t => t.assigneeId === session.personId || (t.assigneeIds && t.assigneeIds.includes(session.personId)));
          filteredPeople = filteredPeople.filter(p => p.id === session.personId);
          filteredCompanies = filteredCompanies.filter(c => c.id === session.companyId);
        } else {
          filteredTasks = filteredTasks.filter(t => 
            t.companyId === session.companyId || 
            t.companyId === 'comp-2' || 
            t.companyId === '' || 
            !t.companyId || 
            t.assigneeId === session.personId || 
            (t.assigneeIds && t.assigneeIds.includes(session.personId))
          );
          filteredPeople = filteredPeople.filter(p => 
            p.companyId === session.companyId || 
            !p.companyId || 
            GLOBAL_ROLES.includes(p.role)
          );
          filteredCompanies = filteredCompanies.filter(c => c.id === session.companyId || c.id === 'comp-2');
        }
      }
    }

    setTasks(filteredTasks);
    setPeople(filteredPeople);
    setCompanies(filteredCompanies);
  }, [rawTasks, rawPeople, rawCompanies, session]);

  // Set default selected user to current person when session loads
  useEffect(() => {
    if (session && session.personId) {
      setSelectedUserId(session.personId);
    }
  }, [session]);

  // Selected User State (defaults to first user in list on load)
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'standard' | 'visual'>('standard');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Mobile navigation hook & tab status (Hoy vs Rutinas vs Proyectos)
  const [activeTab, setActiveTab] = useState<'hoy' | 'rutinas' | 'proyectos'>('hoy');
  const [isMobileScreen, setIsMobileScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      
      const tasksRes = await fetch('/api/tasks', { headers });
      const tasksData = await tasksRes.json();
      
      const companiesRes = await fetch('/api/companies', { headers });
      const companiesData = await companiesRes.json();

      const peopleRes = await fetch('/api/persons', { headers });
      const peopleData = await peopleRes.json();

      // Normalize tasks helper inside local fetch
      const normalized = Array.isArray(tasksData) ? tasksData.map((t: any) => {
        let status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' = 'Pending';
        const rawStatus = String(t.status || '').toLowerCase().replace(/_/g, '-');
        if (rawStatus === 'pending' || rawStatus === 'todo' || rawStatus === 'backlog') status = 'Pending';
        else if (rawStatus === 'in-progress' || rawStatus === 'in_progress') status = 'In Progress';
        else if (rawStatus === 'completed' || rawStatus === 'done') status = 'Completed';
        else if (rawStatus === 'blocked') status = 'Blocked';

        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        const rawPriority = String(t.priority || '').toLowerCase();
        if (rawPriority === 'high') priority = 'High';
        else if (rawPriority === 'medium') priority = 'Medium';
        else if (rawPriority === 'low') priority = 'Low';

        let origin: 'Golden Hour' | 'Manual' = 'Manual';
        const rawOrigin = String(t.origin || '').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
        if (rawOrigin === 'golden-hour') origin = 'Golden Hour';
        else if (rawOrigin === 'manual') origin = 'Manual';

        let type: 'One-shot' | 'Repetitive' | 'Project' = 'One-shot';
        const rawType = String(t.type || '').toLowerCase().replace(/_/g, '-');
        if (rawType === 'one-shot' || rawType === 'oneshot') type = 'One-shot';
        else if (rawType === 'repetitive') type = 'Repetitive';
        else if (rawType === 'project') type = 'Project';

        return {
          ...t,
          status,
          priority,
          origin,
          type,
          steps: Array.isArray(t.steps) ? t.steps : [],
          attachments: Array.isArray(t.attachments) ? t.attachments : [],
          activityLog: Array.isArray(t.activityLog) ? t.activityLog : [],
          completedDays: Array.isArray(t.completedDays) ? t.completedDays : [],
        };
      }) : [];

      setRawTasks(normalized);
      setRawCompanies(Array.isArray(companiesData) ? companiesData : []);
      
      const loadedPeople = Array.isArray(peopleData) ? peopleData : [];
      setRawPeople(loadedPeople);
    } catch (err) {
      console.error("Error loading user dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDrawer = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
  };

  const handleRefresh = () => {
    loadData();
  };

  // Selected User Object
  const selectedUser = useMemo(() => {
    return people.find(p => p.id === selectedUserId) || null;
  }, [people, selectedUserId]);

  // Filter tasks where the selected user is primary assignee OR inside assigneeIds (shared task)
  const userTasks = useMemo(() => {
    if (!selectedUserId) return [];
    return tasks.filter(t => 
      t.assigneeId === selectedUserId || 
      (t.assigneeIds && t.assigneeIds.includes(selectedUserId))
    );
  }, [tasks, selectedUserId]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.status === 'Completed').length;
    
    // Overdue calculator
    const todayStr = new Date().toISOString().substring(0, 10);
    const overdue = userTasks.filter(t => 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) < todayStr
    ).length;

    // Stress levels
    const active = userTasks.filter(t => t.status !== 'Completed');
    const activeHigh = active.filter(t => t.priority === 'High');
    
    let stressLevel: 'Relajado' | 'Moderado' | 'Sobrecargado' = 'Relajado';
    let stressColor = 'text-green-600 bg-green-50 border-green-200';
    let stressRecommendation = 'Tu carga operativa es ideal. Disfruta un ritmo saludable hoy.';

    if (active.length > 5 || activeHigh.length >= 3) {
      stressLevel = 'Sobrecargado';
      stressColor = 'text-red-600 bg-red-50 border-red-200 animate-pulse';
      stressRecommendation = '¡Cuidado! Gran número de tareas pendientes de alta prioridad. Te recomendamos pausar y priorizar.';
    } else if (active.length > 2 || activeHigh.length >= 1) {
      stressLevel = 'Moderado';
      stressColor = 'text-amber-600 bg-amber-50 border-amber-200';
      stressRecommendation = 'Tienes un volumen de trabajo regular. Distribuye tus descansos correctamente.';
    }

    return {
      total,
      completed,
      overdue,
      stressLevel,
      stressColor,
      stressRecommendation,
      activeCount: active.length,
    };
  }, [userTasks]);

  // Column Distribution
  const { todayOneShots, repetitiveTasks, projects } = useMemo(() => {
    const todayStr = new Date().toISOString().substring(0, 10);

    const todayOneShots = userTasks.filter(t => 
      t.type === 'One-shot' && 
      t.status !== 'Completed'
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const repetitiveTasks = userTasks.filter(t => 
      t.type === 'Repetitive' && 
      t.status !== 'Completed'
    );

    const projects = userTasks.filter(t => 
      t.type === 'Project' && 
      t.status !== 'Completed'
    );

    return { todayOneShots, repetitiveTasks, projects };
  }, [userTasks]);

  const handleToggleHabitDay = async (task: Task, dateStr: string) => {
    const currentCompleted = task.completedDays || [];
    let updatedCompleted: string[];
    if (currentCompleted.includes(dateStr)) {
      updatedCompleted = currentCompleted.filter((d: string) => d !== dateStr);
    } else {
      updatedCompleted = [...currentCompleted, dateStr];
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          completedDays: updatedCompleted
        })
      });

      if (res.ok) {
        setRawTasks(prevTasks => prevTasks.map(t => {
          if (t.id === task.id) {
            return {
              ...t,
              completedDays: updatedCompleted
            };
          }
          return t;
        }));
        setToastMessage("Rutina actualizada con éxito");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else {
        alert("Error al actualizar la rutina");
      }
    } catch (e) {
      console.error("Error toggling habit day:", e);
      alert("Error de red al actualizar la rutina");
    }
  };

  const renderWeeklyFocusPlanner = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    
    const days = [];
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + mondayDiff + i);
      const dateStr = dayDate.toISOString().substring(0, 10);
      days.push({
        name: dayNames[i],
        date: dateStr,
        label: dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        isToday: dateStr === today.toISOString().substring(0, 10)
      });
    }

    return (
      <div className="bg-white border border-primary-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="border-b border-primary-100 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-primary-900 uppercase tracking-wider flex items-center gap-2">
            📅 Planificador y Enfoque Semanal
          </h3>
          <span className="text-[10px] font-bold text-primary-400">
            Semana del {days[0].label} al {days[4].label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {days.map(day => {
            const dayTasks = userTasks.filter(t => 
              t.dueDate && t.dueDate.substring(0, 10) === day.date
            );

            return (
              <div 
                key={day.date} 
                className={`rounded-xl p-3 flex flex-col space-y-3 min-h-[180px] border ${
                  day.isToday 
                    ? 'bg-gold-50/10 border-gold-400 shadow-sm ring-1 ring-gold-400' 
                    : 'bg-primary-50/30 border-primary-200/60'
                }`}
              >
                <div className="flex items-center justify-between border-b border-primary-100/50 pb-1.5">
                  <span className="text-xs font-black text-primary-850 uppercase tracking-wide">{day.name}</span>
                  <span className="text-[10px] font-extrabold text-primary-400">{day.label}</span>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto max-h-[250px] pr-0.5">
                  {dayTasks.map(task => {
                    const isMeeting = task.isMeeting;
                    const isProject = task.type === 'Project';
                    const isCompleted = task.status === 'Completed';
                    
                    let blockColor = 'bg-[#faf9f6] border-primary-200 text-primary-800 hover:border-primary-300';
                    if (isCompleted) {
                      blockColor = 'bg-emerald-50/20 border-emerald-250/40 text-emerald-800/70 line-through opacity-85';
                    } else if (isMeeting) {
                      blockColor = 'bg-gold-550/10 border-gold-400 text-gold-950 hover:border-gold-500 shadow-xs';
                    } else if (isProject) {
                      blockColor = 'bg-purple-50/20 border-purple-300 text-purple-950 hover:border-purple-400';
                    } else if (task.priority === 'High') {
                      blockColor = 'bg-red-50/25 border-red-300 text-red-950 hover:border-red-400 shadow-2xs';
                    }

                    return (
                      <div
                        key={task.id}
                        onClick={() => handleOpenDrawer(task.id)}
                        className={`p-2.5 rounded-lg border text-[11px] leading-snug font-bold cursor-pointer transition ${blockColor}`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="truncate">{task.title}</span>
                          {isMeeting && task.meetingTime && (
                            <span className="text-[7.5px] font-black bg-gold-100 text-gold-800 px-1 rounded shrink-0 uppercase">
                              {task.meetingTime}
                            </span>
                          )}
                        </div>
                        {isProject && task.steps.length > 0 && (
                          <div className="mt-1.5 flex items-center justify-between text-[8px] font-extrabold text-purple-600">
                            <span>{task.steps.filter(s => s.completed).length}/{task.steps.length} Pasos</span>
                            <div className="w-12 bg-purple-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-600 rounded-full"
                                style={{ width: `${(task.steps.filter(s => s.completed).length / task.steps.length) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {dayTasks.length === 0 && (
                    <div className="text-[10px] text-primary-400 italic text-center py-6">
                      Sin actividades
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHabitTrackerGrid = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    
    const weekDays: { shortName: string; date: string; dayOfMonth: number; isToday: boolean }[] = [];
    const shortDayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + mondayDiff + i);
      const dateStr = dayDate.toISOString().substring(0, 10);
      weekDays.push({
        shortName: shortDayNames[i],
        date: dateStr,
        dayOfMonth: dayDate.getDate(),
        isToday: dateStr === today.toISOString().substring(0, 10)
      });
    }

    const todayStr = today.toISOString().substring(0, 10);

    return (
      <div className="bg-white border border-primary-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="border-b border-primary-100 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-primary-900 uppercase tracking-wider flex items-center gap-2">
            🔥 Matriz de Hábitos y Rutinas Semanales
          </h3>
          <span className="text-[10px] font-bold text-primary-400">
            Frecuencia Semanal (Lunes a Domingo)
          </span>
        </div>

        <div className="space-y-4">
          {repetitiveTasks.map(task => {
            return (
              <div 
                key={task.id} 
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-primary-50/20 border border-primary-150 rounded-xl hover:border-gold-300 transition"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      onClick={() => handleOpenDrawer(task.id)}
                      className="text-xs font-bold text-primary-850 hover:text-gold-600 transition cursor-pointer truncate"
                    >
                      {task.title}
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-gold-50 text-gold-700 border border-gold-150 tracking-wider shrink-0">
                      {task.repeatPattern || 'Rutina'}
                    </span>
                  </div>
                  <p className="text-[10px] text-primary-400 truncate">
                    {task.description ? task.description.replace(/[#*`~]/g, '') : 'Sin descripción'}
                  </p>
                </div>

                {/* 7-Day Completion Bubbles row */}
                <div className="flex items-center gap-2.5 shrink-0 justify-between md:justify-end">
                  {weekDays.map(day => {
                    const isCompleted = task.completedDays && task.completedDays.includes(day.date);
                    const isFuture = day.date > todayStr;
                    
                    return (
                      <div key={day.date} className="flex flex-col items-center space-y-1">
                        <span className="text-[8px] font-black text-primary-400 uppercase tracking-wider">
                          {day.shortName}
                        </span>
                        <button
                          type="button"
                          disabled={isFuture}
                          onClick={() => handleToggleHabitDay(task, day.date)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                              : isFuture
                              ? 'bg-primary-50/50 border-primary-150 text-primary-300 cursor-not-allowed opacity-50'
                              : day.isToday
                              ? 'bg-white border-gold-500 text-gold-650 hover:bg-gold-50/30'
                              : 'bg-white border-primary-200 text-primary-500 hover:border-primary-450 hover:bg-primary-50/50'
                          }`}
                          title={isCompleted ? `Desmarcar ${day.date}` : `Marcar ${day.date}`}
                        >
                          {isCompleted ? '✓' : day.dayOfMonth}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {repetitiveTasks.length === 0 && (
            <p className="text-xs text-primary-400 italic py-8 text-center bg-white border border-dashed rounded-xl">
              No hay tareas de tipo rutina asignadas a este miembro.
            </p>
          )}
        </div>
      </div>
    );
  };

  if (!sessionLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf9f6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Upper Navigation & User Selection Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-primary-200 pb-6 gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-primary-900 tracking-tight flex items-center gap-2">
            👤 Personal User Dashboard
          </h1>
          <p className="text-sm text-primary-500 mt-1">
            Visualizador de carga personal, tareas asignadas y estados compartidos en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode Toggle Switch */}
          <div className="flex bg-primary-100 p-1 rounded-xl border border-primary-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('standard')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'standard'
                  ? 'bg-white text-primary-900 shadow-sm border border-primary-200/50'
                  : 'text-primary-500 hover:text-primary-850'
              }`}
            >
              <span>📋</span> Lista Detallada
            </button>
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'visual'
                  ? 'bg-white text-primary-900 shadow-sm border border-primary-200/50'
                  : 'text-primary-500 hover:text-primary-850'
              }`}
            >
              <span>📊</span> Tablero Visual
            </button>
          </div>

          {/* User Selector Row */}
          <div className="flex items-center gap-3 bg-white p-3 border border-primary-200 rounded-2xl shadow-xs">
            <label className="text-xs font-black uppercase text-primary-400 tracking-wider">Ver Miembro:</label>
            <div className="flex items-center gap-2">
              {selectedUser && (
                <HslAvatar name={selectedUser.name} avatarUrl={selectedUser.avatar} size={7} className="border border-gold-200 shrink-0" />
              )}
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="px-3 py-1.5 border rounded-xl text-xs font-bold text-primary-800 bg-[#faf9f6] focus:outline-none focus:ring-2 focus:ring-gold-500/20"
              >
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stress Banner / Premium Metrics Toggle */}
      {viewMode === 'standard' ? (
        /* Stress & Health Advisor Banner */
        <div className={`p-5 rounded-2xl border ${kpis.stressColor} flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider">Estado de Carga Laboral:</span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full border bg-white shadow-xs">
                {kpis.stressLevel}
              </span>
            </div>
            <p className="text-xs font-medium text-primary-600">{kpis.stressRecommendation}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-3xl font-black">{kpis.activeCount}</span>
            <span className="text-xs font-bold text-primary-400 block uppercase tracking-wider">Tareas Pendientes</span>
          </div>
        </div>
      ) : (
        /* New Premium Metrics Cards Row */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white border border-primary-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold-300">Tasa de Completado</span>
              <h4 className="text-2xl font-black text-white">
                {kpis.total > 0 ? Math.round((kpis.completed / kpis.total) * 100) : 0}%
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-800/50 flex items-center justify-center font-bold text-lg text-gold-400 border border-primary-700">
              📊
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white border border-primary-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold-300">Horas de Enfoque</span>
              <h4 className="text-2xl font-black text-white">
                {userTasks.filter(t => t.status === 'Completed').reduce((acc, t) => acc + (t.steps.length * 1.5 || 2), 0)} hrs
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-800/50 flex items-center justify-center font-bold text-lg text-gold-400 border border-primary-700">
              ⏱️
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white border border-primary-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold-300">Racha de Hábitos</span>
              <h4 className="text-2xl font-black text-white">
                {repetitiveTasks.filter(t => t.completedDays && t.completedDays.length > 0).length} Activos
              </h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-800/50 flex items-center justify-center font-bold text-lg text-gold-400 border border-primary-700">
              🔥
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary-900 to-primary-950 text-white border border-primary-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gold-300">Tareas Pendientes</span>
              <h4 className="text-2xl font-black text-white">{kpis.activeCount}</h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-800/50 flex items-center justify-center font-bold text-lg text-gold-400 border border-primary-700">
              ⌛
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KPI 1 */}
        <div className="bg-white border border-primary-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Total Asignadas</span>
            <h4 className="text-2xl font-black text-primary-850">{kpis.total}</h4>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-100/50 flex items-center justify-center font-bold text-lg text-primary-700">
            📋
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white border border-primary-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Completadas</span>
            <h4 className="text-2xl font-black text-green-600">{kpis.completed}</h4>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center font-bold text-lg text-green-600 border border-green-100">
            ✓
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-primary-200 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Atrasadas / Fuera de Plazo</span>
            <h4 className={`text-2xl font-black ${kpis.overdue > 0 ? 'text-red-500' : 'text-primary-850'}`}>
              {kpis.overdue}
            </h4>
          </div>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border ${kpis.overdue > 0 ? 'bg-red-50 text-red-600 border-red-100 animate-pulse' : 'bg-primary-50 text-primary-400 border-primary-100'}`}>
            ⚠
          </div>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="space-y-8">
          {renderWeeklyFocusPlanner()}
          {renderHabitTrackerGrid()}
        </div>
      ) : (
        <>
      {/* Mobile Tab Selectors (only visible when isMobileScreen is true) */}
      {isMobileScreen && (
        <div className="flex bg-primary-100 p-1 rounded-xl border border-primary-200" data-testid="mobile-tabs-container">
          <button
            type="button"
            onClick={() => setActiveTab('hoy')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'hoy'
                ? 'bg-white text-primary-900 shadow-xs border border-primary-200/50'
                : 'text-primary-500 hover:text-primary-800'
            }`}
          >
            Hoy ({todayOneShots.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rutinas')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'rutinas'
                ? 'bg-white text-primary-900 shadow-xs border border-primary-200/50'
                : 'text-primary-500 hover:text-primary-800'
            }`}
          >
            Rutinas ({repetitiveTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('proyectos')}
            className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'proyectos'
                ? 'bg-white text-primary-900 shadow-xs border border-primary-200/50'
                : 'text-primary-500 hover:text-primary-800'
            }`}
          >
            Proyectos ({projects.length})
          </button>
        </div>
      )}

      {/* Main Multi-Column Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: Hoy / Atrasadas */}
        {(!isMobileScreen || activeTab === 'hoy') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-primary-200 pb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-primary-800">Tareas de Hoy</h3>
              <span className="bg-primary-100 text-primary-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {todayOneShots.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {todayOneShots.map(task => (
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} />
              ))}
              {todayOneShots.length === 0 && (
                <p className="text-xs text-primary-400 italic py-8 text-center bg-white border border-dashed rounded-xl">
                  No hay tareas programadas para hoy.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Column 2: Repetitivas / Rutina */}
        {(!isMobileScreen || activeTab === 'rutinas') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-primary-200 pb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-xs"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-primary-800">Rutinas & Frecuencias</h3>
              <span className="bg-primary-100 text-primary-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {repetitiveTasks.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {repetitiveTasks.map(task => (
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} />
              ))}
              {repetitiveTasks.length === 0 && (
                <p className="text-xs text-primary-400 italic py-8 text-center bg-white border border-dashed rounded-xl">
                  Sin rutinas de frecuencia activas.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Column 3: Proyectos & Sub-tareas */}
        {(!isMobileScreen || activeTab === 'proyectos') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-primary-200 pb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs"></span>
              <h3 className="text-sm font-black uppercase tracking-wider text-primary-800">Proyectos Activos</h3>
              <span className="bg-primary-100 text-primary-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {projects.length}
              </span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {projects.map(task => (
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} />
              ))}
              {projects.length === 0 && (
                <p className="text-xs text-primary-400 italic py-8 text-center bg-white border border-dashed rounded-xl">
                  No hay proyectos pendientes.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

        </>
      )}
      {/* Global Unified Task Drawer details modal */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={handleRefresh}
        companies={companies}
        people={people}
      />
      {showToast && (
        <div
          id="toast-notification"
          data-testid="toast-notification"
          className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold z-50 animate-bounce"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// Internal Mini Card Component for UserDashboard
interface UserTaskCardProps {
  task: Task;
  currentUserId: string;
  people: Person[];
  onSelect: (id: string) => void;
}

function UserTaskCard({ task, currentUserId, people, onSelect }: UserTaskCardProps) {
  // Check if it is a joint/shared task
  const isShared = task.assigneeIds && task.assigneeIds.length > 1;
  
  // Calculate completed steps fraction
  const totalSteps = task.steps.length;
  const completedSteps = task.steps.filter(s => s.completed).length;
  const stepsFraction = totalSteps > 0 ? `${completedSteps}/${totalSteps}` : '';

  // Get other co-assignees
  const coAssignees = useMemo(() => {
    if (!isShared || !task.assigneeIds) return [];
    return task.assigneeIds
      .filter(id => id !== currentUserId)
      .map(id => people.find(p => p.id === id))
      .filter((p): p is Person => !!p);
  }, [task.assigneeIds, isShared, currentUserId, people]);

  const priorityColors = {
    High: 'bg-red-500',
    Medium: 'bg-amber-500',
    Low: 'bg-green-500'
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      className="bg-white border border-primary-200 rounded-2xl p-5 hover:border-gold-300 hover:shadow-lg hover:shadow-gold-550/5 transition-all duration-300 cursor-pointer space-y-3.5 relative"
    >
      {/* Priority Bar Indicator on the left edge */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-lg ${priorityColors[task.priority] || 'bg-primary-300'}`} />

      {/* Header Types & Badges */}
      <div className="flex items-center justify-between gap-2 flex-wrap pl-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-primary-100 text-primary-700 tracking-wider">
            {task.type}
          </span>
          {task.type === 'Repetitive' && task.repeatPattern && (
            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-gold-50 text-gold-700 tracking-wider border border-gold-150">
              {task.repeatPattern}
            </span>
          )}
          {task.type === 'Project' && stepsFraction && (
            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-150 tracking-wider">
              {stepsFraction} Steps
            </span>
          )}
        </div>

        {/* Due Date Indicator */}
        <span className="text-[9px] font-extrabold uppercase text-primary-400">
          Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Title */}
      <div className="pl-1.5">
        <h4 className="text-sm font-black text-primary-850 leading-snug hover:text-gold-600 transition-colors">
          {task.title}
        </h4>
        <p className="text-xs text-primary-400 line-clamp-2 mt-1">
          {task.description.replace(/[#*`~]/g, '')}
        </p>
      </div>

      {/* Project Completion Progress Bar */}
      {task.type === 'Project' && totalSteps > 0 && (
        <div className="w-full pl-1.5">
          <div className="w-full bg-primary-100 h-1.5 rounded-full overflow-hidden">
            <div 
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
              className="bg-gold-550 h-full rounded-full transition-all"
            />
          </div>
        </div>
      )}

      {/* Shared Task details */}
      {isShared && (
        <div className="flex flex-col gap-1.5 bg-[#faf9f6]/80 p-2.5 rounded-xl border border-primary-150/60 pl-3">
          <span className="text-[9px] font-black uppercase text-gold-750 flex items-center gap-1">
            👥 Tarea Compartida
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold text-primary-400 uppercase tracking-wider">Co-asignados:</span>
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {coAssignees.map(p => (
                <div key={p.id} title={p.name} className="ring-1 ring-white rounded-full">
                  <HslAvatar name={p.name} avatarUrl={p.avatar} size={4} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
