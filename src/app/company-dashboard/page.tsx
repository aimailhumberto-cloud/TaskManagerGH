'use client';

import React, { useState, useEffect, useMemo } from 'react';
import HslAvatar from '@/components/HslAvatar';
import { Company, Person, Task, Step, Attachment, LogEntry } from '@/services/dbService';

export default function CompanyDashboardPage() {
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
        console.error('Error fetching session in company dashboard:', err);
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
      if (!GLOBAL_ROLES.includes(session.role)) {
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

  // Set default selected company for restricted roles
  useEffect(() => {
    if (session && session.companyId) {
      const GLOBAL_ROLES = ['CEO', 'Coordinador Operativo', 'Admin', 'Developer', 'Agente de IA', 'AIAgent'];
      if (!GLOBAL_ROLES.includes(session.role)) {
        setSelectedCompanyId(session.companyId);
        setIncludeSubcompanies(false);
      }
    }
  }, [session]);

  // States for filtering & search within the active company
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hermes-company-dashboard-active-id');
      if (saved) return saved;
    }
    return 'comp-2'; // Default: Golden Hour (Mother)
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && selectedCompanyId) {
      localStorage.setItem('hermes-company-dashboard-active-id', selectedCompanyId);
    }
  }, [selectedCompanyId]);
  const [includeSubcompanies, setIncludeSubcompanies] = useState<boolean>(true); // Default: true for mother consolidation
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'one-shot' | 'repetitive' | 'project'

  // --- Premium Task Details Drawer states ---
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [drawerTitle, setDrawerTitle] = useState('');
  const [drawerDescription, setDrawerDescription] = useState('');
  const [drawerAssigneeId, setDrawerAssigneeId] = useState('unassigned');
  const [drawerSteps, setDrawerSteps] = useState<Step[]>([]);
  const [drawerAttachments, setDrawerAttachments] = useState<Attachment[]>([]);
  const [drawerActivityLog, setDrawerActivityLog] = useState<LogEntry[]>([]);
  const [drawerStatus, setDrawerStatus] = useState<'Pending' | 'In Progress' | 'Completed' | 'Blocked'>('Pending');
  const [drawerPriority, setDrawerPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [drawerType, setDrawerType] = useState<'One-shot' | 'Repetitive' | 'Project'>('One-shot');
  const [drawerRepeatPattern, setDrawerRepeatPattern] = useState<'Daily' | 'Weekly' | 'Monthly' | ''>('');
  const [drawerCompanyId, setDrawerCompanyId] = useState<string>('comp-1');
  const [drawerDueDate, setDrawerDueDate] = useState<string>('');

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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
      steps: Array.isArray(t.steps) ? t.steps.map((s: any) => ({
        ...s,
        status: s.status ? (s.status.charAt(0).toUpperCase() + s.status.slice(1).toLowerCase()) as any : undefined
      })) : [],
      attachments: Array.isArray(t.attachments) ? t.attachments : [],
      activityLog: Array.isArray(t.activityLog) ? t.activityLog : [],
    };
  };

  const loadData = async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      const [compRes, persRes, taskRes] = await Promise.all([
        fetch('/api/companies', { headers }),
        fetch('/api/persons', { headers }),
        fetch('/api/tasks', { headers })
      ]);
      if (compRes.ok && persRes.ok && taskRes.ok) {
        const compData = await compRes.json();
        const persData = await persRes.json();
        const taskData = await taskRes.json();
        if (Array.isArray(compData)) setRawCompanies(compData);
        if (Array.isArray(persData)) setRawPeople(persData);
        if (Array.isArray(taskData)) setRawTasks(taskData.map(normalizeTask));
      }
    } catch (err) {
      console.error('Failed to load dashboard data from API', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map of companies for easy name lookup
  const companyMap = useMemo(() => {
    return new Map(companies.map((c) => [c.id, c.name]));
  }, [companies]);

  // Map of people for easy lookup
  const peopleMap = useMemo(() => {
    return new Map(people.map((p) => [p.id, p]));
  }, [people]);

  // Is Golden Hour (the Mother company) selected
  const isMotherCompanySelected = useMemo(() => {
    return selectedCompanyId === 'comp-2';
  }, [selectedCompanyId]);

  // Filter tasks for the selected company context
  const companyTasks = useMemo(() => {
    if (isMotherCompanySelected && includeSubcompanies) {
      // Golden Hour consolidated: includes all tasks from all companies
      return tasks;
    }
    // Specific child company or mother isolated
    return tasks.filter(t => t.companyId === selectedCompanyId);
  }, [tasks, selectedCompanyId, isMotherCompanySelected, includeSubcompanies]);

  // Search & Type filtered tasks for display in the main operational table
  const filteredTasksForTable = useMemo(() => {
    return companyTasks.filter(task => {
      // Filter by type
      if (filterType !== 'all') {
        const typeMatch = task.type.toLowerCase() === filterType.toLowerCase();
        if (!typeMatch) return false;
      }

      // Filter by search query
      if (searchQuery.trim() !== '') {
        const titleMatch = (task.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const descMatch = (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [companyTasks, searchQuery, filterType]);

  // Executive Metrics Computations based on company tasks
  const metrics = useMemo(() => {
    const total = companyTasks.length;
    const completed = companyTasks.filter(t => t.status === 'Completed').length;
    const pending = companyTasks.filter(t => t.status === 'Pending').length;
    const inProgress = companyTasks.filter(t => t.status === 'In Progress').length;
    const blocked = companyTasks.filter(t => t.status === 'Blocked').length;
    
    // Sort projects: completed to the bottom
    const activeProjects = companyTasks
      .filter(t => t.type === 'Project')
      .sort((a, b) => {
        const aVal = a.status === 'Completed' ? 1 : 0;
        const bVal = b.status === 'Completed' ? 1 : 0;
        return aVal - bVal;
      });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const ongoingTasksCount = pending + inProgress + blocked;

    // Calculate Bottleneck in the selected context
    const activeTasks = companyTasks.filter(t => t.status !== 'Completed');
    const counts: Record<string, number> = {};
    activeTasks.forEach(t => {
      if (t.assigneeId) {
        counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1;
      }
    });

    let bottleneckId = '';
    let bottleneckMaxCount = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > bottleneckMaxCount) {
        bottleneckMaxCount = count;
        bottleneckId = id;
      }
    });

    const bottleneckPerson = people.find(p => p.id === bottleneckId);

    return {
      total,
      completed,
      pending,
      inProgress,
      blocked,
      completionRate,
      ongoingTasksCount,
      activeProjects,
      bottleneckName: bottleneckMaxCount > 0 && bottleneckPerson ? bottleneckPerson.name : 'N/A',
      bottleneckCount: bottleneckMaxCount,
    };
  }, [companyTasks, people]);

  // Cross-Company Resource Workload Distribution calculation
  const resourceAllocations = useMemo(() => {
    return people.map(person => {
      // Filter active (non-completed) tasks globally for this person
      const personActiveTasks = tasks.filter(t => t.assigneeId === person.id && t.status !== 'Completed');
      const totalActiveTasks = personActiveTasks.length;

      if (totalActiveTasks === 0) {
        return {
          person,
          totalActive: 0,
          allocations: []
        };
      }

      // Group active tasks by company ID
      const companyCounts: Record<string, number> = {};
      personActiveTasks.forEach(t => {
        companyCounts[t.companyId] = (companyCounts[t.companyId] || 0) + 1;
      });

      // Calculate percentage allocation for each company
      const allocations = Object.entries(companyCounts).map(([companyId, count]) => {
        const companyName = companyMap.get(companyId) || 'Unknown';
        const pct = Math.round((count / totalActiveTasks) * 100);

        // Assign a consistent beautiful HSL background color based on company ID hash
        let hash = 0;
        for (let i = 0; i < companyId.length; i++) {
          hash = companyId.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash) % 360;
        const color = `hsl(${h}, 65%, 45%)`;

        return {
          companyId,
          companyName,
          count,
          pct,
          color
        };
      }).sort((a, b) => b.pct - a.pct);

      return {
        person,
        totalActive: totalActiveTasks,
        allocations
      };
    }).sort((a, b) => b.totalActive - a.totalActive);
  }, [people, tasks, companyMap]);

  // --- Task Details Drawer Slide-over Callbacks ---
  const handleOpenDrawer = async (taskId: string | null) => {
    setActiveTaskId(taskId);
    setIsDrawerOpen(true);
    setUploadProgress(null);

    if (taskId) {
      const localTask = tasks.find(t => t.id === taskId);
      if (localTask) {
        setDrawerTitle(localTask.title || '');
        setDrawerDescription(localTask.description || '');
        setDrawerAssigneeId(localTask.assigneeId || 'unassigned');
        setDrawerSteps(localTask.steps || []);
        setDrawerAttachments(localTask.attachments || []);
        setDrawerStatus(localTask.status || 'Pending');
        setDrawerPriority(localTask.priority || 'Medium');
        setDrawerType(localTask.type || 'One-shot');
        setDrawerRepeatPattern(localTask.repeatPattern || '');
        setDrawerCompanyId(localTask.companyId || 'comp-1');
        setDrawerDueDate(localTask.dueDate ? localTask.dueDate.substring(0, 10) : new Date().toISOString().substring(0, 10));
        setDrawerActivityLog(localTask.activityLog || []);
      }

      try {
        const headers = { 'x-api-key': 'mock-api-key-12345' };
        const res = await fetch(`/api/tasks/${taskId}`, { headers });
        if (res.ok) {
          const rawTaskData = await res.json();
          const taskData = normalizeTask(rawTaskData);

          setDrawerTitle(taskData.title || '');
          setDrawerDescription(taskData.description || '');
          setDrawerAssigneeId(taskData.assigneeId || 'unassigned');
          setDrawerSteps(taskData.steps || []);
          setDrawerAttachments(taskData.attachments || []);
          setDrawerStatus(taskData.status || 'Pending');
          setDrawerPriority(taskData.priority || 'Medium');
          setDrawerType(taskData.type || 'One-shot');
          setDrawerRepeatPattern(taskData.repeatPattern || '');
          setDrawerCompanyId(taskData.companyId || 'comp-1');
          setDrawerDueDate(taskData.dueDate ? taskData.dueDate.substring(0, 10) : new Date().toISOString().substring(0, 10));
          setDrawerActivityLog(taskData.activityLog || []);
        }
      } catch (err) {
        console.error("Error fetching task details in company-dashboard:", err);
      }
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
  };

  const handleSaveTask = async () => {
    if (!drawerTitle.trim()) {
      alert("Title is mandatory");
      return;
    }

    const assigneeId = drawerAssigneeId === 'unassigned' ? '' : drawerAssigneeId;

    const updatedData = {
      title: drawerTitle,
      description: drawerDescription,
      assigneeId: assigneeId,
      steps: drawerSteps,
      status: drawerStatus,
      priority: drawerPriority,
      attachments: drawerAttachments,
      type: drawerType,
      repeatPattern: drawerType === 'Repetitive' ? drawerRepeatPattern : null,
      companyId: drawerCompanyId,
      dueDate: drawerDueDate,
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };

      if (activeTaskId) {
        const res = await fetch(`/api/tasks/${activeTaskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updatedData)
        });

        if (res.ok) {
          setToastMessage("Task saved successfully");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
          setIsDrawerOpen(false);
          setActiveTaskId(null);

          loadData();
        }
      }
    } catch (err) {
      console.error("Error saving task in company-dashboard:", err);
    }
  };

  const handleDeleteTask = async () => {
    if (!activeTaskId) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      const res = await fetch(`/api/tasks/${activeTaskId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setToastMessage("Task deleted successfully");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setIsDrawerOpen(false);
        setActiveTaskId(null);

        loadData();
      }
    } catch (err) {
      console.error("Error deleting task in company-dashboard:", err);
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
      console.error("Error updating task status in company-dashboard:", err);
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

  const handlePreviewAttachment = (filename: string) => {
    const baseName = filename.substring(0, filename.lastIndexOf('.')) || filename;
    const previewSrc = `/data/attachments/${baseName}_preview.png`;
    setPreviewAttachmentUrl(previewSrc);
    setIsPreviewModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadProgress("Error: File exceeds maximum allowed size (10MB)");
      return;
    }

    if (file.name.endsWith('.exe')) {
      setUploadProgress("Error: File type not supported");
      return;
    }

    setUploadProgress("100%");
    const newAttachment: Attachment = {
      id: `att-${Date.now()}`,
      filename: file.name,
      filepath: `/data/attachments/${file.name}`,
      uploadedAt: new Date().toISOString()
    };
    setDrawerAttachments(prev => [...prev, newAttachment]);
  };

  const getAvatarForAssignee = (assignee: string) => {
    if (!assignee || assignee === 'unassigned') {
      return '/avatars/placeholder.png';
    }
    const person = people.find(p => p.id === assignee || p.name.toLowerCase().includes(assignee.toLowerCase()));
    if (person) {
      return person.avatar || '/avatars/placeholder.png';
    }
    return '/avatars/placeholder.png';
  };

  if (!sessionLoaded || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
        <p className="text-sm text-primary-400 font-medium mt-4">Loading corporate workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans antialiased text-primary-900">
      
      {/* Page Title & Main Header */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-gold-200/40 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight flex items-center gap-2">
            👑 Dashboard Corporativo
          </h2>
          <p className="text-primary-500 mt-1">
            Consolidado estratégico global de Golden Hour e indicadores de rendimiento específicos de filiales.
          </p>
        </div>
        
        {/* Active Company Selector Dropdown (Premium Glassmorphism Style) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white p-3 rounded-2xl border border-gold-200/50 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-gold-600">Active Organization</span>
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                // Turn on consolidation by default if mother is selected
                if (e.target.value === 'comp-2') {
                  setIncludeSubcompanies(true);
                }
              }}
              className="mt-0.5 bg-transparent border-0 text-sm font-bold text-primary-850 focus:outline-none focus:ring-0 cursor-pointer pr-8"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.id === 'comp-2' ? '(Mother Company)' : ''}
                </option>
              ))}
            </select>
          </div>
          
          {/* Mother Company Consolidation Toggle Control */}
          {isMotherCompanySelected && (
            <div className="flex items-center gap-2 pl-3 border-t sm:border-t-0 sm:border-l border-primary-100 pt-2 sm:pt-0">
              <input
                type="checkbox"
                id="consolidate-subcompanies-toggle"
                checked={includeSubcompanies}
                onChange={(e) => setIncludeSubcompanies(e.target.checked)}
                className="w-4 h-4 rounded text-gold-600 border-gold-300 focus:ring-gold-500 cursor-pointer"
              />
              <label
                htmlFor="consolidate-subcompanies-toggle"
                className="text-xs font-bold text-gold-650 cursor-pointer select-none"
              >
                Consolidated View (All Filials)
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Grouping Status Alert Widget for Mother Consolidation */}
      {isMotherCompanySelected && includeSubcompanies && (
        <div className="mb-8 p-4 bg-gradient-to-r from-gold-50/50 via-amber-50/30 to-[#faf9f6] border border-gold-250/30 rounded-2xl shadow-sm flex items-center gap-3">
          <span className="text-xl">🏆</span>
          <div className="text-left">
            <h4 className="text-xs font-bold text-primary-900 uppercase tracking-wider">
              Vista Global Consolidada Activa
            </h4>
            <p className="text-[11px] text-primary-500 mt-0.5">
              Estás visualizando todos los proyectos, tareas y cargas laborales de <strong>todas las compañías</strong> bajo el paraguas corporativo de <strong>Golden Hour</strong>.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards: General Health Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        
        {/* KPI 1: Dynamic Circular SVG Progress Rate Ring */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 text-left">
            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest block">
              Completion Rate
            </span>
            <span className="text-3xl font-serif font-black text-emerald-600 block">
              {metrics.completionRate}%
            </span>
            <span className="text-[9px] font-medium text-primary-400 block">
              {metrics.completed} / {metrics.total} tasks completed
            </span>
          </div>
          {/* Circular Progress Gauge */}
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-primary-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500 transition-all duration-1000"
                strokeWidth="3.5"
                strokeDasharray={`${metrics.completionRate}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-primary-700">
              📊
            </div>
          </div>
        </div>

        {/* KPI 2: Active Projects count */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest block">
            Active Projects
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-serif font-black text-primary-850">
              {metrics.activeProjects.length}
            </span>
            <span className="text-[9px] font-bold text-gold-600 bg-gold-50 border px-1.5 py-0.5 rounded">
              🏆 Master Projects
            </span>
          </div>
          <span className="text-[9px] font-medium text-primary-400 mt-2 block">
            Coordinated step workflows
          </span>
        </div>

        {/* KPI 3: Ongoing Tasks count */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest block">
            Ongoing Tasks
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-serif font-black text-amber-600">
              {metrics.ongoingTasksCount}
            </span>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              Active Docket
            </span>
          </div>
          <span className="text-[9px] font-medium text-primary-400 mt-2 block">
            Pending, In Progress or Blocked
          </span>
        </div>

        {/* KPI 4: Company Bottleneck Assignee */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest block">
            Company Bottleneck
          </span>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-serif font-black text-red-650 truncate max-w-[150px]">
              {metrics.bottleneckName}
            </span>
            {metrics.bottleneckCount > 0 && (
              <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0">
                {metrics.bottleneckCount} tasks
              </span>
            )}
          </div>
          <span className="text-[9px] font-medium text-primary-400 mt-2 block">
            Highest pending workload load
          </span>
        </div>

      </div>

      {/* Main operational sections (Projects & Resources Workloads) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* PANEL 1: Projects Registry under Company context (1 column wide) */}
        <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
          <div>
            <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4 text-left">
              <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                🏆 Proyectos de la Empresa
              </h3>
              <span className="text-[10px] font-bold text-primary-400 bg-primary-100 px-2 py-0.5 rounded-md">
                {metrics.activeProjects.length} Registered
              </span>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {metrics.activeProjects.map(project => {
                const totalSteps = project.steps.length;
                const completedSteps = project.steps.filter(s => s.completed).length;
                const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                
                // Fetch assignee object
                const assignee = people.find(p => p.id === project.assigneeId);
                const belongsTo = companyMap.get(project.companyId) || 'Unknown';

                return (
                  <div
                    key={project.id}
                    onClick={() => handleOpenDrawer(project.id)}
                    className={`group border border-primary-50 hover:border-gold-300 hover:bg-gold-50/10 p-4 rounded-xl transition-all duration-200 text-left cursor-pointer ${
                      project.status === 'Completed' ? 'opacity-65 bg-primary-50/40' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className={`text-xs font-bold text-primary-850 group-hover:text-gold-700 transition-colors block truncate max-w-[150px] sm:max-w-[200px] ${
                          project.status === 'Completed' ? 'line-through text-primary-400' : ''
                        }`}>
                          {project.title}
                        </span>
                        
                        {/* Mother view rollup badge: show which filial this project belongs to */}
                        {isMotherCompanySelected && includeSubcompanies && (
                          <span className="inline-block text-[8px] font-extrabold uppercase tracking-wide bg-gold-50 text-gold-700 border border-gold-200 px-1 py-0.5 rounded mt-1.5">
                            🏢 {belongsTo}
                          </span>
                        )}
                      </div>
                      
                      {assignee && (
                        <div className="flex items-center gap-2 shrink-0">
                          <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                        </div>
                      )}
                    </div>

                    {/* HSL Gold Project Progress Rate Bar */}
                    <div className="mt-3.5 space-y-1">
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

                    <div className="mt-3.5 flex items-center justify-between text-[9px] font-bold text-primary-400 border-t border-primary-50 pt-2.5">
                      <span>Status:</span>
                      <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider text-[8px] ${
                        project.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : project.status === 'Blocked'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : project.status === 'In Progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-primary-50 text-primary-700 border border-primary-200'
                      }`}>
                        {project.status}
                      </span>
                    </div>

                  </div>
                );
              })}

              {metrics.activeProjects.length === 0 && (
                <div className="text-center py-16 bg-primary-50/30 border border-dashed border-primary-200 rounded-xl p-4 animate-pulse">
                  <span className="text-2xl">🏆</span>
                  <h4 className="text-xs font-bold text-primary-650 mt-2">No active projects.</h4>
                  <p className="text-[10px] text-primary-400 mt-1">Create projects to track step checklists.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANEL 2: Operational Taskboard Scoped to the Selected Company (2 columns wide) */}
        <div className="lg:col-span-2 bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[450px]">
          <div>
            {/* Header with quick filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-primary-100 pb-3 mb-4 gap-3">
              <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
                📋 Bandeja de Tareas de la Empresa
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterType('all')}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    filterType === 'all' ? 'bg-gold-550 text-white shadow-sm' : 'bg-primary-50 text-primary-500 hover:bg-primary-100'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterType('one-shot')}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    filterType === 'one-shot' ? 'bg-gold-550 text-white shadow-sm' : 'bg-primary-50 text-primary-500 hover:bg-primary-100'
                  }`}
                >
                  One-shot
                </button>
                <button
                  onClick={() => setFilterType('repetitive')}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    filterType === 'repetitive' ? 'bg-gold-550 text-white shadow-sm' : 'bg-primary-50 text-primary-500 hover:bg-primary-100'
                  }`}
                >
                  Recurrent
                </button>
                <button
                  onClick={() => setFilterType('project')}
                  className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-all ${
                    filterType === 'project' ? 'bg-gold-550 text-white shadow-sm' : 'bg-primary-50 text-primary-500 hover:bg-primary-100'
                  }`}
                >
                  Projects
                </button>
              </div>
            </div>

            {/* Live search input */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="🔍 Buscar tareas por título o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#faf9f6] border border-gold-200/80 rounded-xl px-4 py-2.5 text-xs text-primary-950 focus:outline-none focus:border-gold-450 focus:ring-1 focus:ring-gold-450"
              />
            </div>

            {/* Operational Table Grid */}
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              <table className="min-w-full divide-y divide-primary-100">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-widest text-primary-400 font-bold">
                    <th className="py-2.5 px-3">Done</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    {isMotherCompanySelected && includeSubcompanies && <th className="py-2.5 px-3">Company</th>}
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-50 text-left">
                  {filteredTasksForTable.map((task) => {
                    const assignee = task.assigneeId ? peopleMap.get(task.assigneeId) : null;
                    const belongsTo = companyMap.get(task.companyId) || 'Unknown';

                    return (
                      <tr
                        key={task.id}
                        onClick={() => handleOpenDrawer(task.id)}
                        className="hover:bg-gold-50/10 group cursor-pointer transition-colors"
                      >
                        {/* Done status toggle check */}
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={task.status === 'Completed'}
                            onChange={() => handleToggleTaskStatus(task)}
                            className="w-4 h-4 rounded text-gold-600 border-gold-300 focus:ring-gold-550 cursor-pointer"
                          />
                        </td>

                        {/* Title with done check styling */}
                        <td className="py-3 px-3 min-w-[150px] max-w-[250px]">
                          <span className={`text-xs font-bold text-primary-850 group-hover:text-gold-650 transition-colors block truncate ${
                            task.status === 'Completed' ? 'line-through text-primary-400' : ''
                          }`}>
                            {cleanMarkdown(task.title)}
                          </span>
                        </td>

                        {/* Task type tag */}
                        <td className="py-3 px-3 text-[9px] uppercase tracking-wider text-primary-500 font-bold">
                          {task.type}
                        </td>

                        {/* Assignee initials HSL avatar */}
                        <td className="py-3 px-3">
                          {assignee ? (
                            <div className="flex items-center gap-1.5">
                              <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={5} />
                              <span className="text-[10px] text-primary-700 truncate max-w-[80px] hidden sm:inline-block">
                                {assignee.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-primary-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Mother consolidated view company label */}
                        {isMotherCompanySelected && includeSubcompanies && (
                          <td className="py-3 px-3 text-[10px] font-bold text-primary-600">
                            {belongsTo}
                          </td>
                        )}

                        {/* Priority tag */}
                        <td className="py-3 px-3">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            task.priority === 'High'
                              ? 'bg-red-50 text-red-700 border border-red-150'
                              : task.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-150'
                              : 'bg-primary-50 text-primary-600 border border-primary-150'
                          }`}>
                            {task.priority}
                          </span>
                        </td>

                        {/* Due Date label */}
                        <td className="py-3 px-3 text-[10px] text-primary-500 font-semibold whitespace-nowrap">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                        </td>

                      </tr>
                    );
                  })}

                  {filteredTasksForTable.length === 0 && (
                    <tr>
                      <td colSpan={isMotherCompanySelected && includeSubcompanies ? 7 : 6} className="text-center py-12 text-xs text-primary-400 italic">
                        No tasks match the filters in this company context.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

      {/* PANEL 3: Shared Resources Multi-company Workload Board */}
      <div className="bg-white border border-gold-200/50 rounded-2xl p-6 shadow-sm mb-10">
        <div className="flex items-center justify-between border-b border-primary-100 pb-3 mb-4 text-left">
          <h3 className="text-sm font-bold text-primary-900 uppercase tracking-wider flex items-center gap-2">
            🎨 Recursos Compartidos y Asignaciones Corporativas
          </h3>
          <span className="text-[10px] font-bold text-primary-400 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md">
            Holding Allocation Board
          </span>
        </div>

        <p className="text-[11px] text-primary-400 text-left mb-6 italic">
          Supervisión ejecutiva de la división porcentual de la carga operativa activa de tu equipo a través de las diferentes empresas. Ideal para dar seguimiento a diseñadores compartidos, agentes de IA y personal operativo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {resourceAllocations.map(({ person, totalActive, allocations }) => (
            <div
              key={person.id}
              className="bg-primary-50/20 border border-primary-100/50 p-4 rounded-xl text-left"
            >
              {/* Profile details */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <HslAvatar
                    name={person.name}
                    avatarUrl={person.avatar}
                    size={8}
                    className="border border-gold-200 shrink-0"
                  />
                  <div className="truncate">
                    <span className="text-xs font-extrabold text-primary-850 block truncate leading-tight">
                      {person.name}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-primary-400 block font-medium mt-0.5">
                      {person.role}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-primary-500 bg-white border border-primary-200 px-2 py-0.5 rounded shrink-0 shadow-sm">
                  {totalActive} tasks
                </span>
              </div>

              {/* Segmented allocation bar */}
              {totalActive > 0 ? (
                <div className="space-y-3">
                  <div className="w-full h-3 bg-primary-100 rounded-full overflow-hidden flex shadow-inner border border-primary-200/40 p-[1px]">
                    {allocations.map((alloc) => (
                      <div
                        key={alloc.companyId}
                        style={{
                          width: `${alloc.pct}%`,
                          backgroundColor: alloc.color
                        }}
                        className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                        title={`${alloc.companyName}: ${alloc.pct}% (${alloc.count} tasks)`}
                      />
                    ))}
                  </div>

                  {/* Percentage tags */}
                  <div className="flex flex-wrap gap-2 text-[8px] font-extrabold uppercase tracking-wide">
                    {allocations.map((alloc) => (
                      <span
                        key={alloc.companyId}
                        className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-primary-150 shadow-sm"
                        style={{ color: alloc.color }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                          style={{ backgroundColor: alloc.color }}
                        />
                        {alloc.companyName}: {alloc.pct}%
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 bg-white/40 border border-dashed border-primary-200 rounded-lg text-[9px] text-primary-400 font-medium italic">
                  No active tasks currently assigned.
                </div>
              )}

            </div>
          ))}
        </div>
      </div>

      {/* --- Task Details Drawer slide-over --- */}
      {isDrawerOpen && (
        <div
          id="task-form-drawer"
          data-testid="task-form-drawer"
          className="fixed inset-y-0 right-0 max-w-full flex pl-10 z-50 animate-slide-in"
        >
          <div
            data-testid="task-detail-pane"
            className="w-screen max-w-md bg-white border-l border-primary-200 shadow-2xl p-6 flex flex-col space-y-6"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-primary-800">
                {activeTaskId ? 'Edit Task Details' : 'Create New Task'}
              </h2>
              <button
                id="close-drawer-btn"
                data-testid="close-drawer-btn"
                onClick={handleCloseDrawer}
                className="p-1 hover:bg-primary-100 rounded-lg text-primary-500 transition"
              >
                Close
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Title</label>
                <input
                  type="text"
                  id="task-title-input"
                  data-testid="task-title-input"
                  value={drawerTitle}
                  onChange={(e) => setDrawerTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-primary-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Description (Markdown)</label>
                <textarea
                  id="task-desc-textarea"
                  data-testid="task-desc-textarea"
                  value={drawerDescription}
                  onChange={(e) => setDrawerDescription(e.target.value)}
                  placeholder="Markdown text..."
                  className="w-full px-3 py-2 border rounded-lg text-sm h-24 text-primary-800"
                ></textarea>
                <div
                  id="markdown-preview"
                  data-testid="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(drawerDescription) }}
                  className="mt-2 p-3 bg-primary-50 border border-dashed rounded-lg text-xs prose prose-sm max-w-none text-primary-800 text-left"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Assignee</label>
                  <select
                    id="assignee-select"
                    data-testid="assignee-select"
                    value={drawerAssigneeId}
                    onChange={(e) => setDrawerAssigneeId(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  >
                    <option value="unassigned">Unassigned</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2 pt-5">
                  <img
                    id="assignee-avatar"
                    data-testid="assignee-avatar"
                    src={getAvatarForAssignee(drawerAssigneeId)}
                    alt="Assignee Avatar"
                    className="w-8 h-8 rounded-full border border-primary-200 object-cover"
                  />
                  <span className="text-xs text-primary-500 font-medium">Assignee profile</span>
                </div>
              </div>

              {/* Status & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Status</label>
                  <select
                    id="task-status-select"
                    data-testid="task-status-select"
                    value={drawerStatus}
                    onChange={(e) => setDrawerStatus(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Priority</label>
                  <select
                    id="task-priority-select"
                    data-testid="task-priority-select"
                    value={drawerPriority}
                    onChange={(e) => setDrawerPriority(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Task Type & Due Date Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Type</label>
                  <select
                    id="task-type-select"
                    data-testid="task-type-select"
                    value={drawerType}
                    onChange={(e) => setDrawerType(e.target.value as any)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  >
                    <option value="One-shot">One-shot</option>
                    <option value="Repetitive">Repetitive</option>
                    <option value="Project">Project</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Due Date</label>
                  <input
                    type="date"
                    id="task-due-date-input"
                    data-testid="task-due-date-input"
                    value={drawerDueDate}
                    onChange={(e) => setDrawerDueDate(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  />
                </div>
              </div>

              {/* Company & Repeat Pattern Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Company</label>
                  <select
                    id="task-company-select"
                    data-testid="task-company-select"
                    value={drawerCompanyId}
                    onChange={(e) => setDrawerCompanyId(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {drawerType === 'Repetitive' && (
                  <div>
                    <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Repeat Pattern</label>
                    <select
                      id="task-repeat-pattern-select"
                      data-testid="task-repeat-pattern-select"
                      value={drawerRepeatPattern}
                      onChange={(e) => setDrawerRepeatPattern(e.target.value as any)}
                      className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
                    >
                      <option value="">None</option>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Checklist Items</label>
                <div id="checklist-container" className="space-y-2 max-h-40 overflow-y-auto text-left">
                  {drawerSteps.length === 0 ? (
                    <div data-testid="no-steps-placeholder" className="text-xs text-primary-400">No steps inside this project</div>
                  ) : (
                    drawerSteps.map((step, index) => (
                      <div key={step.id || index} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`step-${index}`}
                          data-testid={`checklist-item-${index}`}
                          checked={step.completed}
                          onChange={() => {
                            const updatedSteps = [...drawerSteps];
                            const nextCompleted = !updatedSteps[index].completed;
                            updatedSteps[index] = { 
                              ...updatedSteps[index], 
                              completed: nextCompleted,
                              status: nextCompleted ? 'Completed' : 'Pending'
                            };
                            setDrawerSteps(updatedSteps);
                            
                            if (activeTaskId) {
                              setTasks(prevTasks => prevTasks.map(t => t.id === activeTaskId ? { ...t, steps: updatedSteps } : t));
                              if (drawerTitle.trim() !== '') {
                                fetch(`/api/tasks/${activeTaskId}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-key': 'mock-api-key-12345'
                                  },
                                  body: JSON.stringify({ steps: updatedSteps })
                                }).catch(err => console.error("Error updating steps:", err));
                              }
                            }
                          }}
                          className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                        />
                        
                        <select
                          value={step.status || (step.completed ? 'Completed' : 'Pending')}
                          onChange={(e) => {
                            const newStatus = e.target.value as 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
                            const updatedSteps = [...drawerSteps];
                            updatedSteps[index] = {
                              ...updatedSteps[index],
                              status: newStatus,
                              completed: newStatus === 'Completed'
                            };
                            setDrawerSteps(updatedSteps);
                            
                            if (activeTaskId) {
                              setTasks(prevTasks => prevTasks.map(t => t.id === activeTaskId ? { ...t, steps: updatedSteps } : t));
                              if (drawerTitle.trim() !== '') {
                                fetch(`/api/tasks/${activeTaskId}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'x-api-key': 'mock-api-key-12345'
                                  },
                                  body: JSON.stringify({ steps: updatedSteps })
                                }).catch(err => console.error("Error updating steps:", err));
                              }
                            }
                          }}
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${
                            step.status === 'Completed' || step.completed
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : step.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : step.status === 'Blocked'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-primary-50 text-primary-755 border-primary-200'
                          }`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                          <option value="Blocked">Blocked</option>
                        </select>

                        <label 
                          htmlFor={`step-${index}`} 
                          className={`text-xs text-primary-650 cursor-pointer ${step.completed ? 'line-through text-primary-400 font-medium' : 'font-bold'}`}
                        >
                          {step.text}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Attachments</label>
                <input
                  type="file"
                  id="attachment-file-input"
                  data-testid="attachment-file-input"
                  onChange={handleFileChange}
                  className="block w-full text-xs text-primary-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200"
                />
                {uploadProgress && (
                  <div
                    id="upload-progress"
                    data-testid="upload-progress"
                    className={`text-xs font-semibold mt-1 text-left ${uploadProgress.startsWith('Error') ? 'text-red-500' : 'text-gold-600'}`}
                  >
                    {uploadProgress}
                  </div>
                )}

                <div id="attachments-list" className="mt-3 space-y-2">
                  {drawerAttachments.map((att, idx) => (
                    <div
                      key={att.id || idx}
                      data-testid={`attachment-item-${idx}`}
                      className="flex items-center justify-between p-2 bg-primary-50 border border-primary-100 rounded-lg text-xs text-left"
                    >
                      <span data-testid={`attachment-name-${idx}`} className="font-medium text-primary-700 truncate max-w-[150px]">
                        {att.filename}
                      </span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/data/attachments/${att.filename}`}
                          data-testid={`download-attachment-${idx}`}
                          className="text-gold-600 hover:text-gold-700 font-semibold"
                          download
                        >
                          Download
                        </a>
                        <button
                          data-testid={`preview-attachment-${idx}`}
                          onClick={() => handlePreviewAttachment(att.filename)}
                          className="text-primary-600 hover:text-primary-750 font-semibold"
                        >
                          Preview
                        </button>
                        <button
                          data-testid={`delete-attachment-${idx}`}
                          onClick={() => {
                            setDrawerAttachments(prev => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-red-650 hover:text-red-800 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1 text-left">Activity Log</label>
                <div
                  id="activity-log"
                  className="space-y-2 max-h-48 overflow-y-auto border border-primary-200 rounded-lg p-3 bg-primary-50/50 text-left"
                >
                  {drawerActivityLog.map((log, index) => (
                    <div
                      key={index}
                      data-testid={`activity-log-item-${index}`}
                      className="text-xs text-primary-600 border-b border-primary-100 pb-1"
                    >
                      <span className="font-semibold text-primary-750">{log.user}: </span>
                      <span>{log.action}</span>
                      <span className="text-[10px] text-primary-400 block">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {drawerActivityLog.length === 0 && (
                    <div className="text-xs text-primary-400 italic">No activity logs recorded.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-4 flex gap-3">
              {activeTaskId && (
                <button
                  data-testid="delete-task-btn"
                  onClick={handleDeleteTask}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm transition"
                >
                  Delete Task
                </button>
              )}
              <button
                data-testid="save-task-btn"
                onClick={handleSaveTask}
                className="flex-1 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg font-semibold text-sm transition"
              >
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Toast notification --- */}
      {showToast && (
        <div
          id="toast-notification"
          data-testid="toast-notification"
          className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold z-50 animate-bounce"
        >
          {toastMessage}
        </div>
      )}

      {/* --- Attachment Preview Modal --- */}
      {isPreviewModalOpen && (
        <div
          id="attachment-preview-modal"
          data-testid="attachment-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div className="bg-white rounded-xl p-6 max-w-lg w-full relative">
            <h3 className="text-lg font-bold text-primary-800 mb-4 text-left">Attachment Preview</h3>
            {previewAttachmentUrl && (
              previewAttachmentUrl.includes('archive') || previewAttachmentUrl.includes('.zip') ? (
                <span data-testid="no-preview-text" className="text-sm text-red-500 font-medium">
                  Preview not available for .zip files. Download instead.
                </span>
              ) : (
                <img
                  id="attachment-preview-img"
                  data-testid="attachment-preview-img"
                  src={previewAttachmentUrl}
                  alt="Attachment Preview"
                  className="max-h-96 w-auto mx-auto object-contain rounded border border-primary-200"
                />
              )
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-4 py-2 bg-primary-200 hover:bg-primary-300 text-primary-800 font-semibold rounded-lg text-sm transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
