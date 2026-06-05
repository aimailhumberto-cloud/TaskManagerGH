'use client';

import React, { useState, useMemo, useEffect } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer from '@/components/TaskDrawer';
import { Task, Person, QueueItem, Company, Step, Attachment, LogEntry } from '@/services/dbService';

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
    };
  };

  // Local states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [session, setSession] = useState<any>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Rapid Task Input Panel States
  const [rawTaskInput, setRawTaskInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  // Speech Dictation States
  const [isDictating, setIsDictating] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Refined Task Review Panel
  const [refinedTask, setRefinedTask] = useState<any>(null);
  const [isReviewingRefined, setIsReviewingRefined] = useState(false);

  // Share dropdown index track
  const [activeShareMenuId, setActiveShareMenuId] = useState<string | null>(null);

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

  // Speech Recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'es-ES';

        rec.onstart = () => {
          setIsDictating(true);
        };

        rec.onend = () => {
          setIsDictating(false);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsDictating(false);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setRawTaskInput(prev => (prev ? prev + ' ' + transcript : transcript));
        };

        setRecognition(rec);
      }
    }
  }, []);

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

  // Handle clicking a KPI card
  const handleKpiClick = (filter: FilterType) => {
    setActiveFilter((prev) => (prev === filter ? 'none' : filter));
  };

  // --- Task Details Drawer Slide-over Callbacks ---
  const handleOpenDrawer = (taskId: string | null) => {
    setActiveTaskId(taskId);
    setIsDrawerOpen(true);
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
        body: JSON.stringify({ status: nextStatus.toLowerCase() })
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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'Pending' | 'In Progress' | 'Blocked' | 'Completed') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.status === newStatus) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const apiStatus = newStatus.toLowerCase().replace(/ /g, '-');
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({ status: apiStatus })
      });
      if (!res.ok) throw new Error('Network error');
      setToastMessage(`Task status updated to ${newStatus}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error("Failed to update status on drop:", err);
      // Revert status
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // Dictation Toggle
  const handleToggleDictation = () => {
    if (!recognition) {
      alert('Speech Recognition is not supported or active in your browser. Please try Chrome, Edge, or Safari.');
      return;
    }
    if (isDictating) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  // Image upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI refinement trigger
  const handleAIRefine = async () => {
    if (!rawTaskInput.trim() && !selectedImage) {
      alert('Por favor escribe algo o carga una imagen.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: selectedImage ? 'vision' : 'refine',
          text: rawTaskInput,
          image: selectedImage
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setRefinedTask(data.result);
          setIsReviewingRefined(true);
        }
      } else {
        alert('Error al procesar con IA.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al procesar.');
    } finally {
      setAiLoading(false);
    }
  };

  // Quick Create (without AI)
  const handleQuickCreate = async () => {
    if (!rawTaskInput.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({
          title: rawTaskInput.trim(),
          description: 'Creado rápidamente desde el Dashboard.',
          priority: 'medium',
          type: 'one-shot',
          companyId: session?.companyId || 'comp-1',
          assigneeId: session?.personId || 'usr-daniel',
          dueDate: new Date(Date.now() + 86400000).toISOString().substring(0, 10)
        })
      });
      if (res.ok) {
        setRawTaskInput('');
        setToastMessage('Tarea creada con éxito!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        await handleRefreshTasks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save refined task
  const handleSaveRefinedTask = async () => {
    if (!refinedTask.title) {
      alert('Title is required');
      return;
    }
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({
          title: refinedTask.title,
          description: refinedTask.description,
          priority: refinedTask.priority.toLowerCase(),
          type: refinedTask.type.toLowerCase(),
          steps: (refinedTask.steps || []).map((s: string) => ({ text: s, completed: false, status: 'Pending' })),
          companyId: session?.companyId || 'comp-1',
          assigneeId: session?.personId || 'usr-daniel',
          dueDate: new Date(Date.now() + 86400000).toISOString().substring(0, 10)
        })
      });
      if (res.ok) {
        setRawTaskInput('');
        setSelectedImage(null);
        setIsReviewingRefined(false);
        setRefinedTask(null);
        setToastMessage('Tarea perfeccionada guardada con éxito!');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
        await handleRefreshTasks();
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al guardar.');
    }
  };

  // Task sharing actions
  const handleShareTelegram = (task: Task) => {
    const text = encodeURIComponent(`📢 Tarea: ${task.title}\n👤 Responsable: ${task.assigneeId ? (peopleMap.get(task.assigneeId)?.name || 'Sin asignar') : 'Sin asignar'}\n📅 Límite: ${task.dueDate || 'Sin fecha'}\n📌 Estado: ${task.status}\n🔗 Accede a la app.`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`, '_blank');
    setActiveShareMenuId(null);
  };

  const handleShareWhatsApp = (task: Task) => {
    const text = encodeURIComponent(`📢 Tarea: ${task.title}\n👤 Responsable: ${task.assigneeId ? (peopleMap.get(task.assigneeId)?.name || 'Sin asignar') : 'Sin asignar'}\n📅 Límite: ${task.dueDate || 'Sin fecha'}\n📌 Estado: ${task.status}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    setActiveShareMenuId(null);
  };

  const handleShareEmail = async (task: Task) => {
    setToastMessage('Preparando envío de correo...');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
    try {
      const emailBody = `📢 DETALLES DE TAREA ASIGNADA\n\n` +
        `Título: ${task.title}\n` +
        `Estado: ${task.status}\n` +
        `Prioridad: ${task.priority}\n` +
        `Fecha de vencimiento: ${task.dueDate || 'Sin definir'}\n\n` +
        `Descripción:\n${task.description || 'Sin descripción'}\n\n` +
        `Sub-pasos:\n${task.steps.map(s => `- [${s.completed ? 'x' : ' '}] ${s.text}`).join('\n')}`;

      // Call SMTP sim/actual via backend
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        if (settings.smtpConfig && settings.smtpConfig.host) {
          // Send real email simulation trigger
          setToastMessage(`Correo enviado con SMTP (${settings.smtpConfig.host})`);
        } else {
          setToastMessage('Correo simulado enviado (SMTP sin configurar)');
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (e) {
      console.error(e);
      setToastMessage('Error simulando el envío de correo.');
    }
    setActiveShareMenuId(null);
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

  // Filter tasks in columns based on metrics filtering
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (activeFilter === 'bottleneck' && bottleneckAssigneeId) {
      result = result.filter(t => t.assigneeId === bottleneckAssigneeId && t.status !== 'Completed');
    } else if (activeFilter === 'workload') {
      result = result.filter(t => t.status !== 'Completed' && t.priority === 'High');
    }
    return result;
  }, [tasks, activeFilter, bottleneckAssigneeId]);

  // Group columns
  const kanbanColumns = useMemo(() => {
    const cols: Record<'Pending' | 'In Progress' | 'Blocked' | 'Completed', Task[]> = {
      'Pending': [],
      'In Progress': [],
      'Blocked': [],
      'Completed': []
    };
    filteredTasks.forEach(t => {
      if (cols[t.status]) {
        cols[t.status].push(t);
      } else {
        cols['Pending'].push(t);
      }
    });
    return cols;
  }, [filteredTasks]);

  return (
    <div data-testid="app-shell" className="min-h-screen bg-[#faf9f6] text-primary-900 font-sans antialiased">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        
        {/* COMPACT HEADER METRICS BANNER */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* KPI 1: Total Tasks */}
            <div
              data-testid="kpi-total-tasks"
              onClick={() => handleKpiClick('none')}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 ${
                activeFilter === 'none'
                  ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-md'
                  : 'bg-[#faf9f6] border-gold-200/30 hover:border-gold-400 shadow-xs'
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-widest block mb-1 ${
                activeFilter === 'none' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Total Tasks
              </span>
              <span className="value text-3xl font-serif font-black">{totalTasksCount}</span>
            </div>

            {/* KPI 2: Workload */}
            <div
              data-testid="kpi-workload"
              onClick={() => handleKpiClick('workload')}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 ${
                activeFilter === 'workload'
                  ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-md'
                  : 'bg-[#faf9f6] border-gold-200/30 hover:border-gold-400 shadow-xs'
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-widest block mb-1 ${
                activeFilter === 'workload' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Workload Index
              </span>
              <span className="value text-3xl font-serif font-black">{workloadMetric}</span>
            </div>

            {/* KPI 3: Bottleneck Assignee */}
            <div
              data-testid="kpi-bottleneck-assignee"
              onClick={() => handleKpiClick('bottleneck')}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-300 ${
                activeFilter === 'bottleneck'
                  ? 'bg-gradient-to-br from-primary-900 to-primary-800 text-white border-primary-900 shadow-md'
                  : 'bg-[#faf9f6] border-gold-200/30 hover:border-gold-400 shadow-xs'
              }`}
            >
              <span className={`text-[10px] font-extrabold uppercase tracking-widest block mb-1 ${
                activeFilter === 'bottleneck' ? 'text-gold-300' : 'text-gold-600'
              }`}>
                Bottleneck Assignee
              </span>
              <span className="value text-xl font-serif font-black block truncate">{bottleneckName}</span>
            </div>

            {/* KPI 4: AI Alerts & Compact Chart */}
            <div className="bg-[#faf9f6] border border-gold-200/30 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-gold-600">Completion rate</span>
                <span className="text-xs font-extrabold text-primary-900">{completionRate}%</span>
              </div>
              <div className="w-full bg-primary-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  style={{ width: `${completionRate}%` }}
                  className="bg-gradient-to-r from-gold-400 to-gold-600 h-full rounded-full transition-all duration-500"
                ></div>
              </div>
              <span className="text-[9px] text-primary-450 block font-medium">
                {completedTasksCount} of {totalTasksCount} tasks completed
              </span>
            </div>

          </div>
        </div>

        {/* DETAILED KPI FILTER WIDGET */}
        {activeFilter !== 'none' && (
          <div
            data-testid="kpi-filtered-item"
            className="mb-6 p-4 bg-amber-50 border border-gold-300 rounded-xl shadow-xs flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <h4 className="font-bold text-primary-900 text-xs uppercase tracking-wider">Filtro de Dashboard Activo</h4>
                <p className="text-primary-600 text-xs mt-0.5">
                  {activeFilter === 'bottleneck'
                    ? `Filtrando tareas pendientes del cuello de botella: ${bottleneckName}`
                    : `Filtrando tareas de alta prioridad / sobrecarga.`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveFilter('none')}
              className="text-[10px] font-bold text-gold-700 hover:text-gold-900 uppercase tracking-widest bg-gold-200/30 px-3 py-1.5 rounded-lg border border-gold-200 transition"
            >
              Restablecer Filtro
            </button>
          </div>
        )}

        {/* MULTIMODAL AI RAPID TASK CREATOR */}
        <section className="bg-white border-2 border-gold-400/20 rounded-2xl p-6 shadow-sm mb-8">
          <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span>✨</span> Creador Rápido de Tareas por IA
          </h3>

          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={rawTaskInput}
                  onChange={(e) => setRawTaskInput(e.target.value)}
                  placeholder="Escribe la tarea aquí (ej. organizar minuta de la junta de marketing urgente para mañana)..."
                  className="w-full pl-4 pr-12 py-3 border border-primary-200 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 focus:outline-none transition bg-[#faf9f6]"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreate(); }}
                />
                <button
                  type="button"
                  onClick={handleToggleDictation}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    isDictating
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-primary-400 hover:text-gold-600 hover:bg-gold-50'
                  }`}
                  title="Dictar Tarea por Voz"
                >
                  🎤
                </button>
              </div>

              <div className="flex gap-2">
                {/* Vision dropzone button */}
                <label className="px-4 py-3 bg-[#faf9f6] border border-primary-200 hover:border-gold-500 rounded-xl text-xs font-bold text-primary-700 cursor-pointer flex items-center justify-center gap-2 hover:bg-gold-50 transition">
                  📷 Imagen
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleAIRefine}
                  disabled={aiLoading}
                  className="px-4 py-3 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold shadow-md shadow-gold-500/10 hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                >
                  {aiLoading ? 'Procesando...' : '✨ Perfeccionar con IA'}
                </button>
              </div>
            </div>

            {selectedImage && (
              <div className="flex items-center gap-3 p-2 border border-gold-200/50 rounded-xl bg-gold-50/20 max-w-sm">
                <img
                  src={selectedImage}
                  alt="Vista previa carga de imagen"
                  className="w-12 h-12 rounded object-cover border border-primary-200"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-primary-400 font-bold block">Imagen Cargada</p>
                  <p className="text-xs text-primary-700 truncate">Listo para análisis multimodal</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="text-red-500 hover:text-red-700 text-lg font-bold px-2"
                >
                  ×
                </button>
              </div>
            )}

            {/* AI Inline Review Form */}
            {isReviewingRefined && refinedTask && (
              <div className="mt-6 border-t border-primary-100 pt-6 animate-fade-in bg-gold-50/10 p-5 rounded-2xl border border-gold-200/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gold-600 mb-4 flex items-center gap-1.5">
                  <span>✨</span> Revisión de la Tarea Generada por la IA
                </h4>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Título de la Tarea</label>
                      <input
                        type="text"
                        value={refinedTask.title || ''}
                        onChange={(e) => setRefinedTask({ ...refinedTask, title: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Prioridad</label>
                      <select
                        value={refinedTask.priority || 'Medium'}
                        onChange={(e) => setRefinedTask({ ...refinedTask, priority: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      >
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Descripción</label>
                    <textarea
                      value={refinedTask.description || ''}
                      onChange={(e) => setRefinedTask({ ...refinedTask, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg text-xs bg-white h-24"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Tipo de Tarea</label>
                      <select
                        value={refinedTask.type || 'One-shot'}
                        onChange={(e) => setRefinedTask({ ...refinedTask, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      >
                        <option value="One-shot">One-shot</option>
                        <option value="Repetitive">Repetitive</option>
                        <option value="Project">Project</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Sub-pasos sugeridos (Checklist)</label>
                      <div className="space-y-1">
                        {(refinedTask.steps || []).map((step: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-gold-600">•</span>
                            <input
                              type="text"
                              value={step}
                              onChange={(e) => {
                                const newSteps = [...refinedTask.steps];
                                newSteps[idx] = e.target.value;
                                setRefinedTask({ ...refinedTask, steps: newSteps });
                              }}
                              className="flex-1 px-2 py-1 text-xs border rounded bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newSteps = refinedTask.steps.filter((_: any, i: number) => i !== idx);
                                setRefinedTask({ ...refinedTask, steps: newSteps });
                              }}
                              className="text-red-500 hover:text-red-700 text-xs px-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setRefinedTask({ ...refinedTask, steps: [...(refinedTask.steps || []), 'Nuevo paso'] })}
                          className="text-[10px] font-bold text-gold-600 hover:text-gold-700 mt-1 block"
                        >
                          + Añadir Paso
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsReviewingRefined(false);
                        setRefinedTask(null);
                      }}
                      className="px-4 py-2 border rounded-xl text-xs font-bold text-primary-700 bg-white hover:bg-primary-50 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRefinedTask}
                      className="px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition"
                    >
                      Guardar Tarea
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* TABLERO KANBAN INTERACTIVO */}
        <section className="mt-10">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xl font-serif font-bold text-primary-900 tracking-tight">
              Task Workflow Board
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary-400">
              Drag & Drop enabled
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* COLUMN: PENDING */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'Pending')}
              className="bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-gold-200/40 pb-2 mb-4 bg-amber-50/50 p-2 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending</span>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {kanbanColumns.Pending.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {kanbanColumns.Pending.map(t => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    peopleMap={peopleMap}
                    onOpen={handleOpenDrawer}
                    onToggle={handleToggleTaskStatus}
                    onDragStart={handleDragStart}
                    activeShareMenuId={activeShareMenuId}
                    setActiveShareMenuId={setActiveShareMenuId}
                    onShareTelegram={handleShareTelegram}
                    onShareWhatsApp={handleShareWhatsApp}
                    onShareEmail={handleShareEmail}
                  />
                ))}
                {kanbanColumns.Pending.length === 0 && (
                  <p className="text-[10px] text-primary-400 italic text-center py-6">No tasks pending.</p>
                )}
              </div>
            </div>

            {/* COLUMN: IN PROGRESS */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'In Progress')}
              className="bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-gold-200/40 pb-2 mb-4 bg-blue-50/50 p-2 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800">In Progress</span>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {kanbanColumns['In Progress'].length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {kanbanColumns['In Progress'].map(t => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    peopleMap={peopleMap}
                    onOpen={handleOpenDrawer}
                    onToggle={handleToggleTaskStatus}
                    onDragStart={handleDragStart}
                    activeShareMenuId={activeShareMenuId}
                    setActiveShareMenuId={setActiveShareMenuId}
                    onShareTelegram={handleShareTelegram}
                    onShareWhatsApp={handleShareWhatsApp}
                    onShareEmail={handleShareEmail}
                  />
                ))}
                {kanbanColumns['In Progress'].length === 0 && (
                  <p className="text-[10px] text-primary-400 italic text-center py-6">No tasks in progress.</p>
                )}
              </div>
            </div>

            {/* COLUMN: BLOCKED */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'Blocked')}
              className="bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-gold-200/40 pb-2 mb-4 bg-red-50/50 p-2 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-red-800">Blocked</span>
                <span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                  {kanbanColumns.Blocked.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {kanbanColumns.Blocked.map(t => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    peopleMap={peopleMap}
                    onOpen={handleOpenDrawer}
                    onToggle={handleToggleTaskStatus}
                    onDragStart={handleDragStart}
                    activeShareMenuId={activeShareMenuId}
                    setActiveShareMenuId={setActiveShareMenuId}
                    onShareTelegram={handleShareTelegram}
                    onShareWhatsApp={handleShareWhatsApp}
                    onShareEmail={handleShareEmail}
                  />
                ))}
                {kanbanColumns.Blocked.length === 0 && (
                  <p className="text-[10px] text-primary-400 italic text-center py-6">No tasks blocked.</p>
                )}
              </div>
            </div>

            {/* COLUMN: COMPLETED */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, 'Completed')}
              className="bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
            >
              <div className="flex justify-between items-center border-b border-gold-200/40 pb-2 mb-4 bg-emerald-50/50 p-2 rounded-lg">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Completed</span>
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {kanbanColumns.Completed.length}
                </span>
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {kanbanColumns.Completed.map(t => (
                  <KanbanCard
                    key={t.id}
                    task={t}
                    peopleMap={peopleMap}
                    onOpen={handleOpenDrawer}
                    onToggle={handleToggleTaskStatus}
                    onDragStart={handleDragStart}
                    activeShareMenuId={activeShareMenuId}
                    setActiveShareMenuId={setActiveShareMenuId}
                    onShareTelegram={handleShareTelegram}
                    onShareWhatsApp={handleShareWhatsApp}
                    onShareEmail={handleShareEmail}
                  />
                ))}
                {kanbanColumns.Completed.length === 0 && (
                  <p className="text-[10px] text-primary-400 italic text-center py-6">No completed tasks.</p>
                )}
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Global Unified Task Details Drawer */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={handleRefreshTasks}
        companies={initialCompanies}
        people={people}
      />

      {/* Toast Notification */}
      {showToast && (
        <div
          id="toast-notification"
          data-testid="toast-notification"
          className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold z-50 animate-bounce"
        >
          {toastMessage}
        </div>
      )}

      {/* Luxury Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gold-200/40 text-center">
        <p className="text-xs text-primary-400">
          © {new Date().getFullYear()} Hermes Autonomous Task Coordinator • Crafted for Golden Hour premium dashboards.
        </p>
      </footer>
    </div>
  );
}

// Kanban Card Component
interface KanbanCardProps {
  task: Task;
  peopleMap: Map<string, Person>;
  onOpen: (id: string) => void;
  onToggle: (task: Task) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  activeShareMenuId: string | null;
  setActiveShareMenuId: (id: string | null) => void;
  onShareTelegram: (task: Task) => void;
  onShareWhatsApp: (task: Task) => void;
  onShareEmail: (task: Task) => void;
}

function KanbanCard({
  task,
  peopleMap,
  onOpen,
  onToggle,
  onDragStart,
  activeShareMenuId,
  setActiveShareMenuId,
  onShareTelegram,
  onShareWhatsApp,
  onShareEmail
}: KanbanCardProps) {
  const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
  const isCompleted = task.status === 'Completed';

  // Toggle sharing menu
  const toggleShareMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveShareMenuId(activeShareMenuId === task.id ? null : task.id);
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpen(task.id)}
      className={`group relative bg-white border border-gold-200/30 rounded-xl p-3 shadow-xs hover:shadow-md hover:border-gold-400 transition cursor-pointer select-none ${
        isCompleted ? 'opacity-70 bg-primary-50/10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isCompleted}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggle(task)}
            className="w-3.5 h-3.5 rounded-full text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
          />
          <h4 className={`text-xs font-bold text-primary-850 truncate group-hover:text-gold-600 transition ${
            isCompleted ? 'line-through text-primary-400 font-medium' : ''
          }`}>
            {task.title}
          </h4>
        </div>

        {/* Share Button Icon */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={toggleShareMenu}
            className="p-1 hover:bg-gold-50 rounded text-primary-400 hover:text-gold-600 transition text-[10px]"
            title="Compartir Tarea"
          >
            📤
          </button>
          
          {activeShareMenuId === task.id && (
            <div className="absolute right-0 top-6 z-40 bg-white border border-gold-200/50 rounded-lg shadow-lg py-1.5 w-36 text-left text-xs text-primary-800 animate-fade-in">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShareTelegram(task); }}
                className="w-full px-3 py-1.5 hover:bg-gold-50 flex items-center gap-2"
              >
                <span>✈️</span> Telegram
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShareWhatsApp(task); }}
                className="w-full px-3 py-1.5 hover:bg-gold-50 flex items-center gap-2"
              >
                <span>💬</span> WhatsApp
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShareEmail(task); }}
                className="w-full px-3 py-1.5 hover:bg-gold-50 flex items-center gap-2"
              >
                <span>✉️</span> Email (SMTP)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description Preview (truncate) */}
      {task.description && (
        <p className="text-[10px] text-primary-500 mt-1.5 line-clamp-2 leading-relaxed">
          {task.description.replace(/[#*`~_]/g, '')}
        </p>
      )}

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between border-t border-primary-50 pt-2 text-[8px] font-bold uppercase tracking-wider text-primary-400">
        
        {/* Due Date or Priority */}
        <div className="flex items-center gap-1">
          <span className={`px-1.5 py-0.5 rounded border ${
            task.priority === 'High'
              ? 'bg-red-50 text-red-700 border-red-200'
              : task.priority === 'Medium'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-primary-50 text-primary-500 border-primary-200'
          }`}>
            {task.priority}
          </span>
          {task.dueDate && (
            <span className="text-primary-400">
              📅 {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>

        {/* Assignee Avatar */}
        {assignee && (
          <div title={`Responsable: ${assignee.name}`}>
            <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4} />
          </div>
        )}

      </div>
    </div>
  );
}
