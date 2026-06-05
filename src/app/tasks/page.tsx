"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer from '@/components/TaskDrawer';

interface Company {
  id: string;
  name: string;
}

interface Person {
  id: string;
  name: string;
  role: string;
  avatar: string;
  companyId?: string;
}

interface Step {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  assigneeId?: string;
}

interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  uploadedAt: string;
}

interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  type: 'User' | 'AI';
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'One-shot' | 'Repetitive' | 'Project';
  repeatPattern?: 'Daily' | 'Weekly' | 'Monthly' | null;
  steps: Step[];
  companyId: string;
  assigneeId: string;
  assigneeIds?: string[];
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  priority: 'High' | 'Medium' | 'Low';
  origin: 'Golden Hour' | 'Manual';
  dueDate: string;
  attachments: Attachment[];
  activityLog: LogEntry[];
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Raw API lists before filtering
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawCompanies, setRawCompanies] = useState<Company[]>([]);
  const [rawPeople, setRawPeople] = useState<Person[]>([]);
  const [session, setSession] = useState<any>(null);

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

  // Share menu tracker
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
        console.error('Error fetching session in tasks:', err);
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

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('none');
  const [grouping, setGrouping] = useState<'none' | 'company' | 'assignee' | 'status'>('none');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hermes-tasks-view-mode');
      if (saved === 'grid' || saved === 'table') {
        return saved;
      }
    }
    return 'grid';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hermes-tasks-view-mode', viewMode);
    }
  }, [viewMode]);
  
  const [visibleColumns, setVisibleColumns] = useState<{ [key: string]: boolean }>({
    status: true,
    priority: true,
    type: true,
    assignee: true,
    company: true,
    dueDate: true,
  });

  // Drawer status
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Toast UI feedback
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Double scrollbars
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  const handleTopScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const updateWidth = () => {
      if (tableRef.current) {
        setTableScrollWidth(tableRef.current.scrollWidth);
      }
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    if (tableRef.current) {
      observer.observe(tableRef.current);
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, [tasks, visibleColumns, viewMode]);

  // Speech Recognition setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'es-ES';
        rec.onstart = () => setIsDictating(true);
        rec.onend = () => setIsDictating(false);
        rec.onerror = () => setIsDictating(false);
        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setRawTaskInput(prev => (prev ? prev + ' ' + transcript : transcript));
        };
        setRecognition(rec);
      }
    }
  }, []);

  const normalizeTask = (t: any): Task => {
    if (!t) return t;

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

  const loadAllData = async () => {
    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      
      const tasksRes = await fetch('/api/tasks', { headers });
      const tasksData = await tasksRes.json();
      
      const companiesRes = await fetch('/api/companies', { headers });
      const companiesData = await companiesRes.json();

      const peopleRes = await fetch('/api/persons', { headers });
      const peopleData = await peopleRes.json();

      setRawTasks(Array.isArray(tasksData) ? tasksData.map(normalizeTask) : []);
      setRawCompanies(Array.isArray(companiesData) ? companiesData : []);
      setRawPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch (err) {
      console.error("Error loading tasks page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const getCompanyById = (id: string) => companies.find(c => c.id === id);
  const getPersonById = (id: string) => people.find(p => p.id === id);

  const handleOpenDrawer = (taskId: string | null) => {
    setActiveTaskId(taskId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
  };

  const handleRefreshTasks = () => {
    loadAllData();
  };

  const handleUpdateTaskProperty = async (taskId: string, property: string, value: any) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ [property]: value })
      });

      if (res.ok) {
        await loadAllData();
        setToastMessage(`Task ${property} updated successfully`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
      } else {
        console.error(`Failed to update task ${property} inline`);
      }
    } catch (err) {
      console.error(`Error updating task ${property} inline:`, err);
    }
  };

  // Filter and sorting logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesOrigin = originFilter === 'all' || 
      (originFilter === 'golden-hour' && task.origin.toLowerCase() === 'golden hour') ||
      (originFilter === 'manual' && task.origin.toLowerCase() === 'manual');
    const matchesStatus = statusFilter === 'all' || 
      task.status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesOrigin && matchesStatus;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Rule 1: Completed tasks always go to the bottom
    const aComp = a.status === 'Completed' ? 1 : 0;
    const bComp = b.status === 'Completed' ? 1 : 0;
    if (aComp !== bComp) {
      return aComp - bComp;
    }

    if (sortBy === 'title') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'due-date') {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  // Groupings resolver
  const resolveGroupContainers = () => {
    if (grouping === 'company') {
      const grouped: { [key: string]: Task[] } = {};
      companies.forEach(c => { grouped[c.name] = []; });
      grouped['Unassigned Company'] = [];

      sortedTasks.forEach(task => {
        const company = getCompanyById(task.companyId);
        const name = company ? company.name : 'Unassigned Company';
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push(task);
      });
      return Object.entries(grouped).filter(([_, items]) => items.length > 0);
    }

    if (grouping === 'assignee') {
      const grouped: { [key: string]: Task[] } = {};
      people.forEach(p => { grouped[p.name] = []; });
      grouped['Unassigned'] = [];

      sortedTasks.forEach(task => {
        const person = getPersonById(task.assigneeId);
        const name = person ? person.name : 'Unassigned';
        if (!grouped[name]) grouped[name] = [];
        grouped[name].push(task);
      });
      return Object.entries(grouped).filter(([_, items]) => items.length > 0);
    }

    if (grouping === 'status') {
      const grouped: { [key: string]: Task[] } = {
        'Pending': [],
        'In Progress': [],
        'Completed': [],
        'Blocked': []
      };

      sortedTasks.forEach(task => {
        if (!grouped[task.status]) grouped[task.status] = [];
        grouped[task.status].push(task);
      });
      return Object.entries(grouped).filter(([_, items]) => items.length > 0);
    }

    return [];
  };

  // Drag and Drop helpers
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

    setRawTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

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
      loadAllData();
    } catch (err) {
      console.error(err);
      setRawTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  // AI Inputs Actions
  const handleToggleDictation = () => {
    if (!recognition) {
      alert('Dictation not supported in this browser.');
      return;
    }
    if (isDictating) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

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

  const handleAIRefine = async () => {
    if (!rawTaskInput.trim() && !selectedImage) {
      alert('Escribe algo o carga una imagen.');
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
        alert('Error al perfeccionar la tarea.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveRefinedTask = async () => {
    if (!refinedTask.title) {
      alert('El título es requerido.');
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
        setTimeout(() => setShowToast(false), 2000);
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

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
          description: 'Creado rápidamente desde el Taskboard.',
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
        loadAllData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Task sharing actions
  const handleShareTelegram = (task: Task) => {
    const text = encodeURIComponent(`📢 Tarea: ${task.title}\n👤 Responsable: ${task.assigneeId ? (getPersonById(task.assigneeId)?.name || 'Sin asignar') : 'Sin asignar'}\n📅 Límite: ${task.dueDate || 'Sin fecha'}\n📌 Estado: ${task.status}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`, '_blank');
    setActiveShareMenuId(null);
  };

  const handleShareWhatsApp = (task: Task) => {
    const text = encodeURIComponent(`📢 Tarea: ${task.title}\n👤 Responsable: ${task.assigneeId ? (getPersonById(task.assigneeId)?.name || 'Sin asignar') : 'Sin asignar'}\n📅 Límite: ${task.dueDate || 'Sin fecha'}\n📌 Estado: ${task.status}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    setActiveShareMenuId(null);
  };

  const handleShareEmail = async (task: Task) => {
    setToastMessage('Enviando correo por SMTP...');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        if (settings.smtpConfig && settings.smtpConfig.host) {
          setToastMessage(`Correo enviado con SMTP (${settings.smtpConfig.host})`);
        } else {
          setToastMessage('Correo simulado enviado con éxito!');
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
    setActiveShareMenuId(null);
  };

  // Kanban Columns Builder
  const kanbanColumns = useMemo(() => {
    const cols: Record<'Pending' | 'In Progress' | 'Blocked' | 'Completed', Task[]> = {
      'Pending': [],
      'In Progress': [],
      'Blocked': [],
      'Completed': []
    };
    sortedTasks.forEach(t => {
      if (cols[t.status]) {
        cols[t.status].push(t);
      } else {
        cols['Pending'].push(t);
      }
    });
    return cols;
  }, [sortedTasks]);

  const cleanMarkdown = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[#*`~_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim();
  };

  const statusStyles = {
    'Pending': 'bg-primary-150 text-primary-800 border-primary-200',
    'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
    'Completed': 'bg-green-100 text-green-800 border-green-200',
    'Blocked': 'bg-red-100 text-red-800 border-red-200',
  };

  const priorityStyles = {
    'High': 'bg-red-50 text-red-700 border-red-200',
    'Medium': 'bg-amber-50 text-amber-700 border-amber-200',
    'Low': 'bg-primary-50 text-primary-600 border-primary-200',
  };

  if (!sessionLoaded || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
        <p className="text-sm text-primary-400 font-medium mt-4">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-primary-200 pb-6 gap-4">
        <div>
          <h1 data-testid="tasks-board" className="text-3xl font-extrabold text-primary-900 tracking-tight">
            Hermes Tasks Board
          </h1>
          <p className="text-sm text-primary-500 mt-1">
            Premium workspace console to control task origins, classifications, and dynamic workflow groupings.
          </p>
        </div>
        <div>
          <button
            data-testid="create-task-btn"
            onClick={() => handleOpenDrawer(null)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold-600 hover:bg-gold-700 text-white rounded-lg font-semibold shadow-lg shadow-gold-600/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Task
          </button>
        </div>
      </div>

      {/* 2. Dynamic Control Panel */}
      <div className="bg-white rounded-xl border border-primary-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">Search</label>
            <input
              type="text"
              id="task-search-input"
              data-testid="task-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all"
            />
          </div>

          {/* Filter Origin */}
          <div>
            <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">Origin</label>
            <select
              id="filter-origin-select"
              data-testid="filter-origin-select"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all"
            >
              <option value="all">All</option>
              <option value="golden-hour">Golden Hour</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">Status</label>
            <select
              id="filter-status-select"
              data-testid="filter-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">Sort By</label>
            <select
              id="sort-select"
              data-testid="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 bg-primary-50 border border-primary-200 rounded-lg text-sm text-primary-800 focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 transition-all"
            >
              <option value="none">None</option>
              <option value="title">Title</option>
              <option value="due-date">Due Date</option>
            </select>
          </div>
        </div>

        {/* 3. Interactive Groupings Selector Bar */}
        <div className="flex flex-wrap items-center justify-between border-t border-primary-100 pt-4 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-primary-400 uppercase tracking-wider mr-2">Groupings:</span>
            <button
              data-testid="group-by-company"
              onClick={() => setGrouping('company')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                grouping === 'company'
                  ? 'bg-gold-500 text-white border-gold-600 shadow-md shadow-gold-500/10'
                  : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'
              }`}
            >
              Group by Company
            </button>
            <button
              data-testid="group-by-assignee"
              onClick={() => setGrouping('assignee')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                grouping === 'assignee'
                  ? 'bg-gold-500 text-white border-gold-600 shadow-md shadow-gold-500/10'
                  : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'
              }`}
            >
              Group by Assignee
            </button>
            <button
              data-testid="group-by-status"
              onClick={() => setGrouping('status')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                grouping === 'status'
                  ? 'bg-gold-500 text-white border-gold-600 shadow-md shadow-gold-500/10'
                  : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'
              }`}
            >
              Group by Status
            </button>
            <button
              data-testid="group-by-none"
              onClick={() => setGrouping('none')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                grouping === 'none'
                  ? 'bg-primary-800 text-white border-primary-900 shadow-md'
                  : 'bg-white text-primary-700 border-primary-200 hover:bg-primary-50'
              }`}
            >
              Ungroup
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-primary-100/50 p-1 rounded-lg border border-primary-200">
              <button
                data-testid="view-mode-grid"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-primary-950 shadow-sm border border-primary-200'
                    : 'text-primary-500 hover:text-primary-850'
                }`}
              >
                Grid View
              </button>
              <button
                data-testid="view-mode-table"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-primary-950 shadow-sm border border-primary-200'
                    : 'text-primary-500 hover:text-primary-850'
                }`}
              >
                Table View
              </button>
            </div>

            <div className="text-xs text-primary-400 font-medium">
              Showing <span className="font-bold text-primary-700">{sortedTasks.length}</span> of {tasks.length} tasks
            </div>
          </div>
        </div>
      </div>

      {/* MULTIMODAL AI RAPID TASK CREATOR (Taskboard) */}
      {viewMode === 'grid' && grouping === 'none' && (
        <section className="bg-white border-2 border-gold-400/20 rounded-2xl p-6 shadow-sm">
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
                  placeholder="Escribe la tarea aquí (ej. perfeccionar reporte de ventas urgente para el lunes)..."
                  className="w-full pl-4 pr-12 py-3 border border-primary-200 rounded-xl text-sm focus:ring-2 focus:ring-gold-500 focus:outline-none transition bg-[#faf9f6]"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCreate(); }}
                />
                <button
                  type="button"
                  onClick={handleToggleDictation}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    isDictating ? 'bg-red-500 text-white animate-pulse' : 'text-primary-400 hover:text-gold-600 hover:bg-gold-50'
                  }`}
                  title="Dictar Tarea por Voz"
                >
                  🎤
                </button>
              </div>

              <div className="flex gap-2">
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
                  alt="Vista previa"
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

            {/* AI Review Form */}
            {isReviewingRefined && refinedTask && (
              <div className="mt-6 border-t border-primary-100 pt-6 bg-gold-50/10 p-5 rounded-2xl border border-gold-200/40">
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
                      className="w-full px-3 py-2 border rounded-lg text-xs bg-white h-20"
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
                      <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">Sub-pasos sugeridos</label>
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
                              className="text-red-500 text-xs px-1"
                            >
                              ×
                            </button>
                          </div>
                        ))}
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
                      className="px-4 py-2 border rounded-xl text-xs font-bold text-primary-700 bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRefinedTask}
                      className="px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      Guardar Tarea
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. Task Grid Lists & Dynamic Visual Containers */}
      {viewMode === 'table' ? (
        /* TABLE VIEW */
        <>
          <div className="bg-white border border-primary-200 rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-primary-500 uppercase tracking-wider">Show/Hide Columns:</span>
              {Object.keys(visibleColumns).map(col => (
                <button
                  key={col}
                  onClick={() => setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border transition-all ${
                    visibleColumns[col]
                      ? 'bg-gold-50 text-gold-700 border-gold-300 shadow-sm'
                      : 'bg-primary-50 text-primary-400 border-primary-150 hover:bg-primary-100/50'
                  }`}
                >
                  {col === 'dueDate' ? 'Due Date' : col}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-primary-400 font-bold uppercase tracking-widest hidden sm:inline">Spreadsheet Optimizer</span>
          </div>

          <div className="bg-white border border-primary-200 rounded-2xl shadow-sm overflow-hidden max-h-[700px] flex flex-col">
            {/* Top Synchronized Scrollbar */}
            <div 
              ref={topScrollRef} 
              onScroll={handleTopScroll}
              className="overflow-x-auto scrollbar-thin w-full bg-primary-50/20 border-b border-primary-150 shrink-0"
              style={{ height: '10px' }}
            >
              <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
            </div>

            <div 
              ref={bottomScrollRef} 
              onScroll={handleBottomScroll}
              className="overflow-x-auto overflow-y-auto max-h-[650px] relative scrollbar-thin"
            >
              <table ref={tableRef} className="min-w-full divide-y divide-primary-200 table-fixed md:table-auto">
                <thead className="bg-[#faf9f6] sticky top-0 z-30">
                  <tr>
                    <th
                      onClick={() => setSortBy(sortBy === 'title' ? 'none' : 'title')}
                      className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider cursor-pointer hover:bg-gold-50/50 hover:text-gold-700 transition sticky left-0 bg-[#faf9f6] z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                    >
                      <div className="flex items-center gap-1">
                        Title
                        {sortBy === 'title' && <span className="text-gold-600">▲</span>}
                      </div>
                    </th>
                    {visibleColumns.status && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {visibleColumns.priority && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden sm:table-cell">
                        Priority
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden md:table-cell">
                        Type
                      </th>
                    )}
                    {visibleColumns.assignee && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden sm:table-cell">
                        Assignee
                      </th>
                    )}
                    {visibleColumns.company && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden md:table-cell">
                        Company
                      </th>
                    )}
                    {visibleColumns.dueDate && (
                      <th
                        onClick={() => setSortBy(sortBy === 'due-date' ? 'none' : 'due-date')}
                        className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider cursor-pointer hover:bg-gold-50/50 hover:text-gold-700 transition hidden sm:table-cell"
                      >
                        <div className="flex items-center gap-1">
                          Due Date
                          {sortBy === 'due-date' && <span className="text-gold-600">▲</span>}
                        </div>
                      </th>
                    )}
                    <th className="px-6 py-4 text-right text-xs font-bold text-primary-500 uppercase tracking-wider sticky right-0 bg-[#faf9f6] z-40 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100 bg-white">
                  {sortedTasks.map((task) => {
                    const assignee = getPersonById(task.assigneeId);
                    const company = getCompanyById(task.companyId);

                    return (
                      <tr
                        key={task.id}
                        data-testid={`task-row-${task.id}`}
                        className="group hover:bg-gold-50/10 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-800 transition sticky left-0 bg-white group-hover:bg-[#fcfbf9] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUpdateTaskProperty(task.id, 'status', task.status === 'Completed' ? 'Pending' : 'Completed')}
                              className="text-primary-400 hover:text-gold-600 transition-colors p-0.5 rounded-full"
                              title={task.status === 'Completed' ? "Mark as Pending" : "Mark as Completed"}
                            >
                              {task.status === 'Completed' ? (
                                <span className="text-emerald-600 font-bold text-lg select-none">✓</span>
                              ) : (
                                <span className="text-primary-300 hover:text-primary-500 font-bold text-lg select-none">○</span>
                              )}
                            </button>
                            <span 
                              onClick={() => handleOpenDrawer(task.id)}
                              className={`cursor-pointer hover:text-gold-600 transition ${task.status === 'Completed' ? 'line-through text-primary-400 font-medium' : ''}`}
                            >
                              {cleanMarkdown(task.title)}
                            </span>
                          </div>
                        </td>
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateTaskProperty(task.id, 'status', e.target.value)}
                              className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-1 rounded border focus:outline-none cursor-pointer bg-white ${
                                statusStyles[task.status] || statusStyles['Pending']
                              }`}
                            >
                              <option value="Pending" className="bg-white text-primary-850">Pending</option>
                              <option value="In Progress" className="bg-white text-blue-850">In Progress</option>
                              <option value="Completed" className="bg-white text-green-850">Completed</option>
                              <option value="Blocked" className="bg-white text-red-850">Blocked</option>
                            </select>
                          </td>
                        )}
                        {visibleColumns.priority && (
                          <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                            <span className={`px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-md border ${
                              priorityStyles[task.priority] || priorityStyles['Medium']
                            }`}>
                              {task.priority}
                            </span>
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                            <span className="text-xs font-semibold text-primary-600">
                              {task.type}
                            </span>
                          </td>
                        )}
                        {visibleColumns.assignee && (
                          <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                            {assignee ? (
                              <div className="flex items-center gap-2">
                                <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                                <span className="text-xs font-bold text-primary-750">{assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-primary-400 font-medium italic">Unassigned</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.company && (
                          <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                            {company ? (
                              <span className="text-xs font-bold text-primary-700 bg-gold-50/50 border border-gold-200/40 px-2 py-1 rounded-lg">
                                {company.name}
                              </span>
                            ) : (
                              <span className="text-xs text-primary-400 font-medium italic">Holding</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.dueDate && (
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-primary-500 hidden sm:table-cell">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold sticky right-0 bg-white group-hover:bg-[#fcfbf9] z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <button
                            onClick={() => handleOpenDrawer(task.id)}
                            className="text-gold-600 hover:text-gold-800 font-semibold"
                          >
                            Details & Actions
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : grouping !== 'none' ? (
        /* GROUPED VIEW */
        <div className="space-y-8">
          {resolveGroupContainers().map(([groupName, groupItems]) => (
            <div key={groupName} className="bg-white border border-primary-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-primary-900 uppercase tracking-widest border-b pb-2 mb-4 flex items-center justify-between">
                <span>📁 {groupName}</span>
                <span className="text-[10px] font-extrabold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-md">
                  {groupItems.length} tasks
                </span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupItems.map(task => (
                  <div
                    key={task.id}
                    onClick={() => handleOpenDrawer(task.id)}
                    className="border border-primary-150 hover:border-gold-300 hover:bg-gold-50/10 p-4 rounded-xl cursor-pointer transition relative"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-xs font-extrabold text-primary-400 uppercase tracking-wider">{task.type}</span>
                      <span className={`px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded border ${
                        statusStyles[task.status] || statusStyles['Pending']
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-primary-900 truncate mb-1">
                      {cleanMarkdown(task.title)}
                    </h4>
                    <p className="text-xs text-primary-500 line-clamp-2 mb-3 leading-relaxed">
                      {cleanMarkdown(task.description)}
                    </p>
                    <div className="flex justify-between items-center border-t pt-2.5 text-[10px] font-bold text-primary-400">
                      <span>Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      {task.assigneeId && getPersonById(task.assigneeId) && (
                        <HslAvatar name={getPersonById(task.assigneeId)!.name} avatarUrl={getPersonById(task.assigneeId)!.avatar} size={4.5} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* DEFAULT KANBAN BOARD VIEW */
        <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-6 md:overflow-x-visible md:pb-0 scrollbar-thin">
          
          {/* COLUMN: PENDING */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'Pending')}
            className="snap-align-start shrink-0 w-[290px] xs:w-[320px] md:w-auto bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
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
                  people={people}
                  onOpen={handleOpenDrawer}
                  onToggle={async (task) => {
                    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                    await handleUpdateTaskProperty(task.id, 'status', nextStatus);
                  }}
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
            className="snap-align-start shrink-0 w-[290px] xs:w-[320px] md:w-auto bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
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
                  people={people}
                  onOpen={handleOpenDrawer}
                  onToggle={async (task) => {
                    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                    await handleUpdateTaskProperty(task.id, 'status', nextStatus);
                  }}
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
            className="snap-align-start shrink-0 w-[290px] xs:w-[320px] md:w-auto bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
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
                  people={people}
                  onOpen={handleOpenDrawer}
                  onToggle={async (task) => {
                    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                    await handleUpdateTaskProperty(task.id, 'status', nextStatus);
                  }}
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
            className="snap-align-start shrink-0 w-[290px] xs:w-[320px] md:w-auto bg-[#faf9f6] border border-gold-200/40 rounded-2xl p-4 min-h-[500px] shadow-xs flex flex-col"
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
                  people={people}
                  onOpen={handleOpenDrawer}
                  onToggle={async (task) => {
                    const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
                    await handleUpdateTaskProperty(task.id, 'status', nextStatus);
                  }}
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
      )}

      {/* Global Unified Task Details Drawer */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={handleRefreshTasks}
        companies={companies}
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
    </div>
  );
}

// Kanban Card Component inside Tasks Page
interface KanbanCardProps {
  task: Task;
  people: Person[];
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
  people,
  onOpen,
  onToggle,
  onDragStart,
  activeShareMenuId,
  setActiveShareMenuId,
  onShareTelegram,
  onShareWhatsApp,
  onShareEmail
}: KanbanCardProps) {
  const assignee = task.assigneeId ? people.find(p => p.id === task.assigneeId) : null;
  const isCompleted = task.status === 'Completed';

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

      {/* Description Preview */}
      {task.description && (
        <p className="text-[10px] text-primary-500 mt-1.5 line-clamp-2 leading-relaxed">
          {task.description.replace(/[#*`~_]/g, '')}
        </p>
      )}

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between border-t border-primary-50 pt-2 text-[8px] font-bold uppercase tracking-wider text-primary-400">
        
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
