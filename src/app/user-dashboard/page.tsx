"use client";

import React, { useState, useEffect, useMemo } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer, { Task, Person, Company } from '@/components/TaskDrawer';

export default function UserDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected User State (defaults to first user in list on load)
  const [selectedUserId, setSelectedUserId] = useState<string>('');

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
        };
      }) : [];

      setTasks(normalized);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      
      const loadedPeople = Array.isArray(peopleData) ? peopleData : [];
      setPeople(loadedPeople);
      if (loadedPeople.length > 0 && !selectedUserId) {
        setSelectedUserId(loadedPeople[0].id);
      }
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

  if (loading) {
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

      {/* Stress & Health Advisor Banner */}
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

      {/* Main Multi-Column Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Column 1: Hoy / Atrasadas */}
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

        {/* Column 2: Repetitivas / Rutina */}
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

        {/* Column 3: Proyectos & Sub-tareas */}
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
      </div>

      {/* Global Unified Task Drawer details modal */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={handleRefresh}
        companies={companies}
        people={people}
      />
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
