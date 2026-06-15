'use client';

import React, { useState, useMemo, useEffect } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer from '@/components/TaskDrawer';
import { Task, Person, QueueItem, Company, Step, Attachment, LogEntry } from '@/services/dbService';
import { useUnreadComments } from '@/hooks/useUnreadComments';

interface DashboardClientProps {
  initialTasks: Task[];
  initialPeople: Person[];
  initialQueue: QueueItem[];
  initialCompanies: Company[];
}

type FilterType = 'none' | 'bottleneck' | 'alerts' | 'workload';

export default function DashboardClient({
  initialTasks,
  initialPeople,
  initialQueue,
  initialCompanies,
}: DashboardClientProps) {
  // Helper to normalize task casings from API/DB into the exact Title Case expected by UI
  const normalizeTask = (t: any): Task => {
    if (!t) return t;

    // Normalize Status
    let status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked' = 'Pending';
    const rawStatus = String(t.status || '').toLowerCase().replace(/_/g, '-');
    if (rawStatus === 'pending' || rawStatus === 'todo' || rawStatus === 'backlog') status = 'Pending';
    else if (rawStatus === 'in-progress' || rawStatus === 'in_progress') status = 'In Progress';
    else if (rawStatus === 'completed' || rawStatus === 'done') status = 'Completed';
    else if (rawStatus === 'blocked') status = 'Blocked';

    // Normalize Priority
    let priority: 'High' | 'Medium' | 'Low' = 'Medium';
    const rawPriority = String(t.priority || '').toLowerCase();
    if (rawPriority === 'high') priority = 'High';
    else if (rawPriority === 'medium') priority = 'Medium';
    else if (rawPriority === 'low') priority = 'Low';

    // Normalize Origin
    let origin: 'Golden Hour' | 'Manual' = 'Manual';
    const rawOrigin = String(t.origin || '').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
    if (rawOrigin === 'golden-hour') origin = 'Golden Hour';
    else if (rawOrigin === 'manual') origin = 'Manual';

    // Normalize Type
    let type: 'One-shot' | 'Repetitive' | 'Project' = 'One-shot';
    const rawType = String(t.type || '').toLowerCase().replace(/_/g, '-');
    if (rawType === 'one-shot' || rawType === 'oneshot') type = 'One-shot';
    else if (rawType === 'repetitive') type = 'Repetitive';
    else if (rawType === 'project') type = 'Project';

    // Normalize RepeatPattern
    let repeatPattern: 'Daily' | 'Weekly' | 'Monthly' | undefined = undefined;
    const rawPattern = String(t.repeatPattern || '').toLowerCase();
    if (rawPattern === 'daily') repeatPattern = 'Daily';
    else if (rawPattern === 'weekly') repeatPattern = 'Weekly';
    else if (rawPattern === 'monthly') repeatPattern = 'Monthly';

    return {
      ...t,
      status,
      priority,
      origin,
      type,
      repeatPattern,
      steps: Array.isArray(t.steps) ? t.steps : [],
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      activityLog: Array.isArray(t.activityLog) ? t.activityLog : [],
      completedDays: Array.isArray(t.completedDays) ? t.completedDays : [],
    };
  };

  // Local state for dynamic real-time dashboard updates
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const { unreadTasks, markAsRead } = useUnreadComments(tasks, session);

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
        console.error('Error fetching session in dashboard:', err);
      } finally {
        setSessionLoaded(true);
      }
    }
    fetchSession();
  }, []);

  // Filter tasks and people based on session and roles
  useEffect(() => {
    let rawTasks = initialTasks.map(normalizeTask);
    let rawPeople = initialPeople;

    if (session) {
      const GLOBAL_ROLES = ['CEO', 'Coordinador Operativo', 'Admin', 'Developer', 'Agente de IA', 'AIAgent'];
      const isGlobalUser = !session.companyId || GLOBAL_ROLES.includes(session.role);
      if (!isGlobalUser) {
        if (session.role === 'Tercero / Externo') {
          rawTasks = rawTasks.filter(t => t.assigneeId === session.personId || (t.assigneeIds && t.assigneeIds.includes(session.personId)));
          rawPeople = rawPeople.filter(p => p.id === session.personId);
        } else {
          rawTasks = rawTasks.filter(t => 
            t.companyId === session.companyId || 
            t.companyId === 'comp-2' || 
            t.companyId === '' || 
            !t.companyId || 
            t.assigneeId === session.personId || 
            (t.assigneeIds && t.assigneeIds.includes(session.personId))
          );
          rawPeople = rawPeople.filter(p => 
            p.companyId === session.companyId || 
            !p.companyId || 
            GLOBAL_ROLES.includes(p.role)
          );
        }
      }
    }

    setTasks(rawTasks);
    setPeople(rawPeople);
  }, [initialTasks, initialPeople, session]);

  // --- Premium Task Details Drawer states ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Map of companies for easy lookup
  const companyMap = useMemo(() => {
    return new Map(initialCompanies.map((c) => [c.id, c.name]));
  }, [initialCompanies]);

  // Map of people for easy lookup
  // Map of people for easy lookup
  const peopleMap = useMemo(() => {
    return new Map(people.map((p) => [p.id, p]));
  }, [people]);

  // 1. Calculate Total Tasks Count
  const totalTasksCount = tasks.length;

  // 2. Calculate Workload Metric ("High" | "Medium" | "Low")
  const { workloadMetric, activeHighPriorityTasksCount, activeTasksCount } = useMemo(() => {
    const active = tasks.filter((t) => t.status !== 'Completed');
    const activeHigh = active.filter((t) => t.priority === 'High');
    
    let metric: 'High' | 'Medium' | 'Low' = 'Low';
    if (active.length > 0) {
      const density = activeHigh.length / active.length;
      if (density >= 0.5) {
        metric = 'High';
      } else if (density >= 0.2) {
        metric = 'Medium';
      } else {
        metric = 'Low';
      }
    }
    return {
      workloadMetric: metric,
      activeHighPriorityTasksCount: activeHigh.length,
      activeTasksCount: active.length,
    };
  }, [tasks]);

  // 3. Calculate Bottleneck Assignee
  const { bottleneckName, bottleneckAssigneeId, maxPendingCount } = useMemo(() => {
    const activeHighPriorityTasks = tasks.filter(
      (t) => t.status !== 'Completed' && t.priority === 'High'
    );

    const counts: Record<string, number> = {};
    activeHighPriorityTasks.forEach((t) => {
      if (t.assigneeId) {
        counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1;
      }
    });

    let maxId = '';
    let maxCount = 0;
    Object.entries(counts).forEach(([assigneeId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxId = assigneeId;
      }
    });

    const person = people.find((p) => p.id === maxId);
    return {
      bottleneckName: maxCount > 0 && person ? person.name : 'N/A',
      bottleneckAssigneeId: maxId,
      maxPendingCount: maxCount,
    };
  }, [tasks, people]);

  // 4. Calculate Active AI Alerts Count (Pending queue items)
  const pendingAlertsCount = useMemo(() => {
    return initialQueue.filter((q) => q.status === 'Pending').length;
  }, [initialQueue]);

  // --- Premium Executive Analytics & Allocation Calculations ---
  const {
    completedTasksCount,
    pendingTasksCount,
    inProgressTasksCount,
    blockedTasksCount,
    completionRate,
    pendingPct,
    inProgressPct,
    completedPct,
    blockedPct
  } = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const inProgress = tasks.filter(t => t.status === 'In Progress').length;
    const blocked = tasks.filter(t => t.status === 'Blocked').length;

    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      completedTasksCount: completed,
      pendingTasksCount: pending,
      inProgressTasksCount: inProgress,
      blockedTasksCount: blocked,
      completionRate: rate,
      pendingPct: total > 0 ? (pending / total) * 100 : 0,
      inProgressPct: total > 0 ? (inProgress / total) * 100 : 0,
      completedPct: total > 0 ? (completed / total) * 100 : 0,
      blockedPct: total > 0 ? (blocked / total) * 100 : 0
    };
  }, [tasks]);

  const teamProductivity = useMemo(() => {
    const allocations = people.map(p => {
      const memberTasks = tasks.filter(t => t.assigneeId === p.id);
      const total = memberTasks.length;
      const completed = memberTasks.filter(t => t.status === 'Completed').length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        total,
        completed,
        pct,
        avatar: p.avatar
      };
    });
    return allocations.sort((a, b) => b.total - a.total);
  }, [tasks, people]);

  const todayStr = useMemo(() => {
    return new Date().toISOString().substring(0, 10);
  }, []);

  const todayMeetings = useMemo(() => {
    return tasks.filter(t => 
      t.isMeeting && 
      t.dueDate && t.dueDate.substring(0, 10) === todayStr
    ).sort((a, b) => (a.meetingTime || '').localeCompare(b.meetingTime || ''));
  }, [tasks, todayStr]);

  const upcomingMeetings = useMemo(() => {
    return tasks.filter(t => 
      t.isMeeting && 
      (!t.dueDate || t.dueDate.substring(0, 10) > todayStr)
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.meetingTime || '').localeCompare(b.meetingTime || ''));
  }, [tasks, todayStr]);

  const pastMeetings = useMemo(() => {
    return tasks.filter(t => 
      t.isMeeting && 
      t.dueDate && t.dueDate.substring(0, 10) < todayStr
    ).sort((a, b) => b.dueDate.localeCompare(a.dueDate) || (b.meetingTime || '').localeCompare(a.meetingTime || ''));
  }, [tasks, todayStr]);

  const overdueOneShotTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'One-shot' && 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) < todayStr
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const todayOneShotTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'One-shot' && 
      t.status !== 'Completed' && 
      (!t.dueDate || t.dueDate.substring(0, 10) === todayStr)
    );
  }, [tasks, todayStr]);

  const upcomingOneShotTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'One-shot' && 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) > todayStr
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const overdueRepetitiveTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Repetitive' && 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) < todayStr
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const todayRepetitiveTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Repetitive' && 
      t.status !== 'Completed' && 
      (!t.dueDate || t.dueDate.substring(0, 10) === todayStr)
    );
  }, [tasks, todayStr]);

  const upcomingRepetitiveTasks = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Repetitive' && 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) > todayStr
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const overdueProjects = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Project' && 
      t.status !== 'Completed' && 
      t.dueDate && t.dueDate.substring(0, 10) < todayStr
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const activeProjects = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Project' && 
      t.status !== 'Completed' && 
      (!t.dueDate || t.dueDate.substring(0, 10) >= todayStr)
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, todayStr]);

  const completedProjects = useMemo(() => {
    return tasks.filter(t => 
      t.type === 'Project' && 
      t.status === 'Completed'
    );
  }, [tasks]);

  // Filtered task list to show below the KPI cards
  const filteredTasks = useMemo(() => {
    if (activeFilter === 'bottleneck' && bottleneckAssigneeId) {
      return tasks.filter(
        (t) => t.assigneeId === bottleneckAssigneeId && t.status !== 'Completed'
      );
    }
    if (activeFilter === 'workload') {
      return tasks.filter((t) => t.status !== 'Completed' && t.priority === 'High');
    }
    return tasks;
  }, [tasks, activeFilter, bottleneckAssigneeId]);

  // Handle clicking a KPI card
  const handleKpiClick = (filter: FilterType) => {
    setActiveFilter((prev) => (prev === filter ? 'none' : filter));
  };

  const handleOpenDrawer = (taskId: string | null) => {
    setActiveTaskId(taskId);
    setIsDrawerOpen(true);
    if (taskId) {
      markAsRead(taskId);
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
  };

  const handleRefreshTasks = async () => {
    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      const tasksRes = await fetch('/api/tasks', { headers });
      const tasksData = await tasksRes.json();
      setTasks(Array.isArray(tasksData) ? tasksData.map(normalizeTask) : []);
    } catch (err) {
      console.error("Error refreshing tasks in dashboard:", err);
    }
  };

  const handleToggleTaskStatus = async (task: Task) => {
    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
        setToastMessage(`Task marked as ${nextStatus}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (err) {
      console.error("Error updating task status:", err);
    }
  };

  const cleanMarkdown = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[#*`~_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim();
  };

  const parseMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    return markdown
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .split('\n')
      .map(line => `<p>${line}</p>`)
      .join('');
  };

  if (!sessionLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf9f6]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-600"></div>
      </div>
    );
  }

  return (
    <div data-testid="app-shell" className="min-h-screen bg-[#faf9f6] text-primary-900 font-sans antialiased">
      {/* Main Dashboard Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Welcome Section */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight">
              Dashboard Overview
            </h2>
            <p className="text-primary-500 mt-1">
              Real-time daily tasks, recurrences, active projects, and executive performance metrics.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/tasks"
              className="px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl font-medium shadow-md shadow-gold-500/10 hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Manage Tasks
            </a>
          </div>
        </div>

        {/* Compact Summary Metrics Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* KPI 1: Total Tasks */}
          <div
            data-testid="kpi-total-tasks"
            onClick={() => handleKpiClick('none')}
            className={`cursor-pointer group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
              activeFilter === 'none'
                ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-lg'
                : 'bg-white border-gold-200/50 shadow-sm hover:shadow-md hover:border-gold-400'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                activeFilter === 'none' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Total Tasks
              </span>
              <span className="value text-2xl font-extrabold tracking-tight">
                {totalTasksCount}
              </span>
            </div>
          </div>

          {/* KPI 2: Workload */}
          <div
            data-testid="kpi-workload"
            onClick={() => handleKpiClick('workload')}
            className={`cursor-pointer group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
              activeFilter === 'workload'
                ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-lg'
                : 'bg-white border-gold-200/50 shadow-sm hover:shadow-md hover:border-gold-400'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                activeFilter === 'workload' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Workload Index
              </span>
              <span className="value text-2xl font-extrabold tracking-tight">
                {workloadMetric}
              </span>
            </div>
          </div>

          {/* KPI 3: Bottleneck Assignee */}
          <div
            data-testid="kpi-bottleneck-assignee"
            onClick={() => handleKpiClick('bottleneck')}
            className={`cursor-pointer group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
              activeFilter === 'bottleneck'
                ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-lg'
                : 'bg-white border-gold-200/50 shadow-sm hover:shadow-md hover:border-gold-400'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold uppercase tracking-wider ${
                activeFilter === 'bottleneck' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Bottleneck Assignee
              </span>
              <span className="value text-sm font-extrabold tracking-tight truncate max-w-[150px]">
                {bottleneckName}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed KPI Filter Alert Widget */}
        {activeFilter === 'bottleneck' && (
          <div
            data-testid="kpi-filtered-item"
            className="mb-8 p-5 bg-gradient-to-r from-amber-50 to-amber-100/50 border-l-4 border-gold-500 rounded-r-2xl shadow-sm flex items-center justify-between gap-4 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gold-100 flex items-center justify-center text-gold-700 animate-pulse">
                ⚠️
              </div>
              <div>
                <h4 className="font-semibold text-primary-900 text-sm md:text-base">
                  Critical Assignee Bottleneck Active
                </h4>
                <p className="text-primary-700 text-xs md:text-sm mt-0.5">
                  {bottleneckName}: {maxPendingCount} tasks pending
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveFilter('none')}
              className="text-xs font-semibold text-gold-700 hover:text-gold-900 uppercase tracking-wider bg-gold-200/40 px-3 py-1.5 rounded-lg transition-all"
            >
              Reset Filter
            </button>
          </div>
        )}

        {/* Four Columns Operational Grid (Control Tower) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-10">
          
          {/* PANEL 1: Tareas del Día (One-shot Tasks) */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  📅 Tareas del Día
                </h3>
                <span className="text-[10px] font-bold text-primary-400 bg-primary-100 px-2 py-0.5 rounded-md">
                  {overdueOneShotTasks.length + todayOneShotTasks.length + upcomingOneShotTasks.length} Active
                </span>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {/* Section A: Atrasadas */}
                {overdueOneShotTasks.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-red-650 mb-2 border-b border-red-100 pb-1 flex items-center justify-between">
                      <span>⚠️ Atrasadas</span>
                      <span className="text-[8px] font-extrabold bg-red-50 text-red-700 border border-red-150 px-1 rounded">Past Due</span>
                    </h4>
                    <div className="space-y-2">
                      {overdueOneShotTasks.map(task => {
                        const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
                        const totalSteps = task.steps.length;
                        const completedSteps = task.steps.filter(s => s.completed).length;
                        const stepPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="group border border-red-100 hover:border-red-300 bg-red-50/10 hover:bg-red-50/20 p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={task.status === 'Completed'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => handleToggleTaskStatus(task)}
                                  className="w-4 h-4 rounded-full text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                                />
                                {task.isMeeting && (
                                  <span className="text-[7.5px] font-black uppercase bg-gold-100 text-gold-800 border border-gold-300 px-1 rounded shrink-0">
                                    Reunión
                                  </span>
                                )}
                                <span className="text-xs font-bold text-red-950 group-hover:text-red-800 transition-colors truncate">
                                  {cleanMarkdown(task.title)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] font-extrabold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 px-1 rounded">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                </span>
                                {assignee && (
                                  <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                                )}
                              </div>
                            </div>

                            {/* Subtask steps progress */}
                            {totalSteps > 0 && (
                              <div className="mt-2 space-y-1">
                                <div className="w-full bg-primary-100 h-1 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-red-400 to-red-650 rounded-full"
                                    style={{ width: `${stepPercentage}%` }}
                                  />
                                </div>
                                <span className="text-[9px] font-bold text-red-700 block text-right">
                                  {completedSteps}/{totalSteps} steps ({stepPercentage}%)
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section B: Hoy toca */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gold-600 mb-2 border-b border-gold-100 pb-1">
                    📍 Hoy toca
                  </h4>
                  <div className="space-y-2">
                    {todayOneShotTasks.map(task => {
                      const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
                      const totalSteps = task.steps.length;
                      const completedSteps = task.steps.filter(s => s.completed).length;
                      const stepPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleOpenDrawer(task.id)}
                          className="group border border-primary-50 hover:border-gold-300 hover:bg-gold-50/20 p-2.5 rounded-xl transition-all duration-200 cursor-pointer relative"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Circular Status Quick-Check Box */}
                              <input
                                type="checkbox"
                                checked={task.status === 'Completed'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleTaskStatus(task)}
                                className="w-4 h-4 rounded-full text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                              />
                              {task.isMeeting && (
                                <span className="text-[7.5px] font-black uppercase bg-gold-100 text-gold-800 border border-gold-300 px-1 rounded shrink-0">
                                  Reunión
                                </span>
                              )}
                              <span className="text-xs font-bold text-primary-800 group-hover:text-gold-700 transition-colors truncate">
                                {cleanMarkdown(task.title)}
                              </span>
                              {unreadTasks[task.id] && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse border border-amber-600 shrink-0" title="Avance nuevo sin leer" />
                              )}
                            </div>
                            {assignee && (
                              <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} className="shrink-0" />
                            )}
                          </div>

                          {/* Subtask steps progress */}
                          {totalSteps > 0 ? (
                            <div className="mt-2 space-y-1">
                              <div className="w-full bg-primary-100 h-1 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
                                  style={{ width: `${stepPercentage}%` }}
                                />
                              </div>
                              <span className="text-[9px] font-bold text-primary-400 block text-right">
                                {completedSteps}/{totalSteps} steps ({stepPercentage}%)
                              </span>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-primary-400">
                              <span>Status:</span>
                              <span className="text-gold-600 bg-gold-50 border border-gold-100/50 px-1.5 py-0.5 rounded">
                                {task.status}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {todayOneShotTasks.length === 0 && (
                      <p className="text-[10px] text-primary-400 italic py-2">No active tasks for today.</p>
                    )}
                  </div>
                </div>

                {/* Section C: Próximos días */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary-400 mb-2 border-b border-primary-100 pb-1">
                    📅 Próximos días
                  </h4>
                  <div className="space-y-2">
                    {upcomingOneShotTasks.map(task => {
                      const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleOpenDrawer(task.id)}
                          className="group border border-transparent hover:border-primary-100 hover:bg-primary-50/40 p-2 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={task.status === 'Completed'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleTaskStatus(task)}
                                className="w-4 h-4 rounded-full text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                              />
                              {task.isMeeting && (
                                <span className="text-[7.5px] font-black uppercase bg-gold-100 text-gold-800 border border-gold-300 px-1 rounded shrink-0">
                                  Reunión
                                </span>
                              )}
                              <span className="text-xs text-primary-650 group-hover:text-primary-800 transition-colors truncate">
                                {cleanMarkdown(task.title)}
                              </span>
                              {unreadTasks[task.id] && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse border border-amber-600 shrink-0" title="Avance nuevo sin leer" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] font-bold text-primary-400">
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) : ''}
                              </span>
                              {assignee && (
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {upcomingOneShotTasks.length === 0 && (
                      <p className="text-[10px] text-primary-400 italic py-2">No upcoming one-shot tasks.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* PANEL 2: Agenda de Reuniones (Upcoming Meetings with live RSVP) */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  👥 Agenda de Reuniones
                </h3>
                <span className="text-[10px] font-bold text-primary-400 bg-primary-100 px-2 py-0.5 rounded-md">
                  {todayMeetings.length + upcomingMeetings.length + pastMeetings.length} Active
                </span>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {/* Section A: Hoy */}
                {todayMeetings.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gold-600 mb-2 border-b border-gold-100 pb-1 flex items-center justify-between">
                      <span>📍 Hoy</span>
                      <span className="text-[8px] font-extrabold bg-gold-50 text-gold-700 border border-gold-200 px-1 rounded">Today</span>
                    </h4>
                    <div className="space-y-2">
                      {todayMeetings.map(task => {
                        const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
                        const attendees = task.meetingAttendees || [];
                        const confirmations = task.meetingConfirmations || [];

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="group border border-gold-100 hover:border-gold-300 bg-gold-50/10 hover:bg-gold-50/20 p-3 rounded-xl transition-all duration-200 cursor-pointer relative"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-primary-800 group-hover:text-gold-700 transition-colors truncate">
                                  {cleanMarkdown(task.title)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {attendees.length > 0 && (
                                  <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${
                                    confirmations.length === attendees.length
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                      : 'bg-amber-50 text-amber-700 border-amber-250'
                                  }`}>
                                    {confirmations.length}/{attendees.length} Confirmados
                                  </span>
                                )}
                                <span className="text-[8px] font-extrabold uppercase tracking-wide bg-gold-50 text-gold-700 border border-gold-200 px-1 rounded">
                                  {task.meetingTime}
                                </span>
                                {assignee && (
                                  <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                                )}
                              </div>
                            </div>

                            {/* Live RSVP Status list */}
                            {attendees.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-primary-50">
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-primary-400 block mb-1">Asistencia en Vivo</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {attendees.map((email, idx) => {
                                    const isConfirmed = confirmations.includes(email);
                                    return (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                          isConfirmed
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                            : 'bg-amber-50 text-amber-700 border-amber-250'
                                        }`}
                                      >
                                        <span>{isConfirmed ? '✓' : '⌛'}</span>
                                        <span>{email}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section B: Próximas */}
                {upcomingMeetings.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary-400 mb-2 border-b border-primary-100 pb-1">
                      📅 Próximas Reuniones
                    </h4>
                    <div className="space-y-2">
                      {upcomingMeetings.map(task => {
                        const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
                        const attendees = task.meetingAttendees || [];
                        const confirmations = task.meetingConfirmations || [];

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="group border border-primary-50 hover:border-gold-300 hover:bg-gold-50/20 p-3 rounded-xl transition-all duration-200 cursor-pointer relative"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-semibold text-primary-800 group-hover:text-gold-700 transition-colors truncate">
                                  {cleanMarkdown(task.title)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {attendees.length > 0 && (
                                  <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded border ${
                                    confirmations.length === attendees.length
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                      : 'bg-amber-50 text-amber-700 border-amber-250'
                                  }`}>
                                    {confirmations.length}/{attendees.length} Confirmados
                                  </span>
                                )}
                                <span className="text-[8px] font-bold text-primary-400">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''} {task.meetingTime || ''}
                                </span>
                                {assignee && (
                                  <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                                )}
                              </div>
                            </div>

                            {/* Live RSVP Status list */}
                            {attendees.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-primary-50">
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-primary-400 block mb-1">Asistencia en Vivo</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {attendees.map((email, idx) => {
                                    const isConfirmed = confirmations.includes(email);
                                    return (
                                      <span
                                        key={idx}
                                        className={`inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                          isConfirmed
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                            : 'bg-amber-50 text-amber-700 border-amber-250'
                                        }`}
                                      >
                                        <span>{isConfirmed ? '✓' : '⌛'}</span>
                                        <span>{email}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section C: Pasadas */}
                {pastMeetings.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary-400 mb-2 border-b border-primary-100 pb-1">
                      🕒 Pasadas / Archivo
                    </h4>
                    <div className="space-y-2">
                      {pastMeetings.map(task => {
                        const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="group border border-transparent hover:border-primary-150 hover:bg-primary-50/40 p-2 rounded-xl transition-all duration-200 cursor-pointer opacity-65"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs text-primary-650 truncate">
                                  {cleanMarkdown(task.title)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] text-primary-400">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                </span>
                                {assignee && (
                                  <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {todayMeetings.length === 0 && upcomingMeetings.length === 0 && pastMeetings.length === 0 && (
                  <p className="text-[10px] text-primary-400 italic py-6 text-center">No hay reuniones programadas.</p>
                )}
              </div>
            </div>
          </div>

          {/* PANEL 3: Tareas Repetitivas (Recurring flow) */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  🔄 Tareas Repetitivas
                </h3>
                <span className="text-[10px] font-bold text-primary-400 bg-primary-100 px-2 py-0.5 rounded-md">
                  {overdueRepetitiveTasks.length + todayRepetitiveTasks.length + upcomingRepetitiveTasks.length} Active
                </span>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {/* Section A: Atrasadas */}
                {overdueRepetitiveTasks.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-red-655 mb-2 border-b border-red-100 pb-1 flex items-center justify-between">
                      <span>⚠️ Atrasadas</span>
                      <span className="text-[8px] font-extrabold bg-red-50 text-red-700 border border-red-150 px-1 rounded">Past Due</span>
                    </h4>
                    <div className="space-y-2">
                      {overdueRepetitiveTasks.map(task => {
                        const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="group border border-red-100 hover:border-red-300 bg-red-50/10 hover:bg-red-50/20 p-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={task.status === 'Completed'}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => handleToggleTaskStatus(task)}
                                  className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                                />
                                <span className="text-xs font-bold text-red-950 group-hover:text-red-800 transition-colors truncate">
                                  {cleanMarkdown(task.title)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] font-extrabold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 px-1 rounded">
                                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                </span>
                                {assignee && (
                                  <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section B: Hoy toca */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gold-600 mb-2 border-b border-gold-100 pb-1">
                    📍 Hoy toca
                  </h4>
                  <div className="space-y-2">
                    {todayRepetitiveTasks.map(task => {
                      const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleOpenDrawer(task.id)}
                          className="group border border-primary-50 hover:border-gold-300 hover:bg-gold-50/20 p-2.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={task.status === 'Completed'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleTaskStatus(task)}
                                className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                              />
                              <span className="text-xs font-bold text-primary-850 group-hover:text-gold-700 transition-colors truncate">
                                {cleanMarkdown(task.title)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[8px] font-extrabold uppercase tracking-wide bg-primary-100 text-primary-700 border border-primary-200 px-1 rounded">
                                {task.repeatPattern || 'Routine'}
                              </span>
                              {assignee && (
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {todayRepetitiveTasks.length === 0 && (
                      <p className="text-[10px] text-primary-400 italic py-2">No repetitive tasks for today.</p>
                    )}
                  </div>
                </div>

                {/* Section C: Próximos días */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary-400 mb-2 border-b border-primary-100 pb-1">
                    📅 Próximos días
                  </h4>
                  <div className="space-y-2">
                    {upcomingRepetitiveTasks.map(task => {
                      const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;

                      return (
                        <div
                          key={task.id}
                          onClick={() => handleOpenDrawer(task.id)}
                          className="group border border-transparent hover:border-primary-100 hover:bg-primary-50/40 p-2 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={task.status === 'Completed'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleToggleTaskStatus(task)}
                                className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
                              />
                              <span className="text-xs text-primary-650 group-hover:text-primary-800 transition-colors truncate">
                                {cleanMarkdown(task.title)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[9px] font-bold text-primary-400">
                                {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                              </span>
                              {assignee && (
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {upcomingRepetitiveTasks.length === 0 && (
                      <p className="text-[10px] text-primary-400 italic py-2">No upcoming routine tasks.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* PANEL 4: Consola de Proyectos (Active Projects) */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  🏆 Consola de Proyectos
                </h3>
                <span className="text-[10px] font-bold text-primary-400 bg-primary-100 px-2 py-0.5 rounded-md">
                  {overdueProjects.length + activeProjects.length + completedProjects.length} Projects
                </span>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
                {/* Section A: Atrasados */}
                {overdueProjects.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-red-650 mb-2 border-b border-red-100 pb-1 flex items-center justify-between">
                      <span>⚠️ Atrasados</span>
                      <span className="text-[8px] font-extrabold bg-red-50 text-red-700 border border-red-150 px-1 rounded">Past Due</span>
                    </h4>
                    <div className="space-y-3">
                      {overdueProjects.map(project => {
                        const assignee = project.assigneeId ? peopleMap.get(project.assigneeId) : null;
                        const totalSteps = project.steps.length;
                        const completedSteps = project.steps.filter(s => s.completed).length;
                        const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                        return (
                          <div
                            key={project.id}
                            onClick={() => handleOpenDrawer(project.id)}
                            className="group border border-red-100 hover:border-red-300 bg-red-50/10 hover:bg-red-50/20 p-3.5 rounded-xl transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-red-950 group-hover:text-red-800 transition-colors truncate">
                                {cleanMarkdown(project.title)}
                              </span>
                              {assignee && (
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                              )}
                            </div>

                            {/* Progress Bar HSL Red */}
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-bold text-red-600">
                                <span>Progress Rate</span>
                                <span className="font-extrabold">{percentage}%</span>
                              </div>
                              <div className="w-full bg-primary-100 h-2 rounded-full overflow-hidden border border-primary-150/40">
                                <div
                                  className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-red-600 border-t border-red-100/50 pt-2">
                              <span>Due Date:</span>
                              <span className="font-extrabold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                Vencido: {new Date(project.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section B: En Curso */}
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-gold-600 mb-2 border-b border-gold-100 pb-1">
                    📍 En Curso
                  </h4>
                  <div className="space-y-3">
                    {activeProjects.map(project => {
                      const assignee = project.assigneeId ? peopleMap.get(project.assigneeId) : null;
                      const totalSteps = project.steps.length;
                      const completedSteps = project.steps.filter(s => s.completed).length;
                      const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                      return (
                        <div
                          key={project.id}
                          onClick={() => handleOpenDrawer(project.id)}
                          className="group border border-primary-50 hover:border-gold-300 hover:bg-gold-50/20 p-3.5 rounded-xl transition-all duration-200 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-primary-855 group-hover:text-gold-700 transition-colors truncate">
                              {cleanMarkdown(project.title)}
                            </span>
                            {assignee && (
                              <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                            )}
                          </div>

                          {/* Progress Bar HSL Gold */}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-bold text-primary-400">
                              <span>Progress Rate</span>
                              <span className="text-gold-600 font-extrabold">{percentage}%</span>
                            </div>
                            <div className="w-full bg-primary-100 h-2 rounded-full overflow-hidden border border-primary-150/40">
                              <div
                                className="h-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-primary-400 border-t border-primary-50 pt-2">
                            <span>Due Date:</span>
                            <span className="text-primary-700 font-extrabold">
                              {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {activeProjects.length === 0 && (
                      <p className="text-[10px] text-primary-400 italic py-2">No active projects currently in course.</p>
                    )}
                  </div>
                </div>

                {/* Section C: Finalizados */}
                {completedProjects.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-primary-400 mb-2 border-b border-primary-100 pb-1 flex items-center justify-between">
                      <span>✓ Finalizados</span>
                      <span className="text-[8px] font-extrabold bg-primary-50 text-primary-500 border border-primary-200 px-1 rounded">Done</span>
                    </h4>
                    <div className="space-y-3">
                      {completedProjects.map(project => {
                        const assignee = project.assigneeId ? peopleMap.get(project.assigneeId) : null;
                        const totalSteps = project.steps.length;
                        const completedSteps = project.steps.filter(s => s.completed).length;
                        const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                        return (
                          <div
                            key={project.id}
                            onClick={() => handleOpenDrawer(project.id)}
                            className="group border border-primary-50 bg-primary-50/40 hover:bg-primary-50/50 hover:border-primary-250 p-3.5 rounded-xl transition-all duration-200 cursor-pointer opacity-65"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-bold text-primary-400 line-through truncate">
                                {cleanMarkdown(project.title)}
                              </span>
                              {assignee && (
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                              )}
                            </div>

                            {/* Progress Bar HSL Grey */}
                            <div className="mt-3 space-y-1">
                              <div className="flex items-center justify-between text-[9px] font-bold text-primary-400">
                                <span>Progress Rate</span>
                                <span className="font-extrabold">{percentage}%</span>
                              </div>
                              <div className="w-full bg-primary-100 h-2 rounded-full overflow-hidden border border-primary-150/40">
                                <div
                                  className="h-full bg-primary-300 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-primary-400 border-t border-primary-50 pt-2">
                              <span>Completed Date:</span>
                              <span className="font-extrabold">
                                {project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '-'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM BUSINESS ANALYTICS WIDGETS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Widget A: Overall Completion & Status Progress */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-6">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  📊 Overall Completion & Status Progress
                </h3>
                <span className="text-2xl font-black text-gold-600 font-serif">
                  {completionRate}%
                </span>
              </div>

              {/* Progress Bar Chart */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-primary-400 mb-1.5 uppercase tracking-wider">
                    <span>Task Completion Rate</span>
                    <span>{completedTasksCount} of {totalTasksCount} tasks finished</span>
                  </div>
                  <div className="w-full bg-primary-100 rounded-full h-3 overflow-hidden border border-primary-200/50 p-0.5">
                    <div
                      style={{ width: `${completionRate}%` }}
                      className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 h-full rounded-full transition-all duration-1000 shadow-sm"
                    ></div>
                  </div>
                </div>

                {/* Segmented Status Progress Bar */}
                <div className="pt-2">
                  <span className="block text-[10px] font-bold text-primary-400 mb-2 uppercase tracking-wider">
                    Status Distribution
                  </span>
                  
                  {totalTasksCount === 0 ? (
                    <div className="text-center py-4 bg-[#faf9f6] border border-dashed rounded-xl text-xs text-primary-450 font-medium">
                      No active tasks in database.
                    </div>
                  ) : (
                    <div className="w-full h-4 bg-primary-100 rounded-full overflow-hidden flex shadow-inner border border-primary-200/40 p-0.5">
                      {completedPct > 0 && (
                        <div
                          style={{ width: `${completedPct}%` }}
                          className="bg-emerald-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                          title={`Completed: ${completedTasksCount} (${Math.round(completedPct)}%)`}
                        />
                      )}
                      {inProgressPct > 0 && (
                        <div
                          style={{ width: `${inProgressPct}%` }}
                          className="bg-blue-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                          title={`In Progress: ${inProgressTasksCount} (${Math.round(inProgressPct)}%)`}
                        />
                      )}
                      {pendingPct > 0 && (
                        <div
                          style={{ width: `${pendingPct}%` }}
                          className="bg-amber-400 h-full first:rounded-l-full last:rounded-r-full transition-all"
                          title={`Pending: ${pendingTasksCount} (${Math.round(pendingPct)}%)`}
                        />
                      )}
                      {blockedPct > 0 && (
                        <div
                          style={{ width: `${blockedPct}%` }}
                          className="bg-red-500 h-full first:rounded-l-full last:rounded-r-full transition-all"
                          title={`Blocked: ${blockedTasksCount} (${Math.round(blockedPct)}%)`}
                        />
                      )}
                    </div>
                  )}

                  {/* Distribution Legend Badges */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 text-[9px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Completed ({completedTasksCount})
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      In Progress ({inProgressTasksCount})
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-150 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Pending ({pendingTasksCount})
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-50 text-red-700 border border-red-150 rounded-lg">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      Blocked ({blockedTasksCount})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Widget B: Team Workload & Productivity Index */}
          <div className="bg-white border border-gold-200/50 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-6">
                <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                  👤 Team Workload & Productivity Index
                </h3>
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest bg-primary-50 border border-primary-150 px-2 py-0.5 rounded-md">
                  {people.length} Members Active
                </span>
              </div>

              {/* Members Workload List */}
              <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                {teamProductivity.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-4 border-b border-primary-50/50 pb-2 last:border-0 last:pb-0 text-left">
                    <div className="flex items-center gap-2 min-w-[120px] max-w-[150px]">
                      <HslAvatar
                        name={member.name}
                        avatarUrl={member.avatar}
                        size={6}
                        className="border border-gold-200"
                      />
                      <div className="truncate">
                        <span className="text-xs font-extrabold text-primary-850 block truncate leading-tight">{member.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-primary-400 block font-medium mt-0.5">{member.role}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[100px]">
                      <div className="flex justify-between text-[9px] font-bold text-primary-400 mb-1 uppercase tracking-wider">
                        <span>Completion Index</span>
                        <span className="text-primary-600">{member.pct}%</span>
                      </div>
                      <div className="w-full bg-primary-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${member.pct}%` }}
                          className="bg-gold-600 h-full rounded-full transition-all"
                        ></div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded-lg shrink-0">
                      {member.total} tasks
                    </span>
                  </div>
                ))}
                
                {teamProductivity.length === 0 && (
                  <p className="text-xs text-primary-450 italic text-center py-6">No members registered in team.</p>
                )}
              </div>
            </div>
          </div>
        </div>

      </main>

      {/* Global Unified Task Details Drawer */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={handleRefreshTasks}
        companies={initialCompanies}
        people={people}
        currentUser={session}
      />

      {/* Luxury Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gold-200/40 text-center">
        <p className="text-xs text-primary-400">
          © {new Date().getFullYear()} Hermes Autonomous Task Coordinator • Crafted for Golden Hour premium dashboards.
        </p>
      </footer>
    </div>
  );
}
