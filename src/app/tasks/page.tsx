"use client";

import React, { useState, useEffect, useRef } from 'react';
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

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('none');
  const [grouping, setGrouping] = useState<'none' | 'company' | 'assignee' | 'status'>('none');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
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

      setTasks(Array.isArray(tasksData) ? tasksData.map(normalizeTask) : []);
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setPeople(Array.isArray(peopleData) ? peopleData : []);
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

  const formatTypeForTestId = (type: string) => {
    const formatted = type.toLowerCase();
    return formatted === 'one-shot' ? 'oneshot' : formatted;
  };

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

      {/* 4. Task Grid Lists & Dynamic Visual Containers */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
        </div>
      ) : viewMode === 'table' ? (
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
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Priority
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Type
                      </th>
                    )}
                    {visibleColumns.assignee && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Assignee
                      </th>
                    )}
                    {visibleColumns.company && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Company
                      </th>
                    )}
                    {visibleColumns.dueDate && (
                      <th
                        onClick={() => setSortBy(sortBy === 'due-date' ? 'none' : 'due-date')}
                        className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider cursor-pointer hover:bg-gold-50/50 hover:text-gold-700 transition"
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
                              className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-1 rounded border focus:outline-none transition-all cursor-pointer bg-white ${
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={task.priority}
                              onChange={(e) => handleUpdateTaskProperty(task.id, 'priority', e.target.value)}
                              className={`text-[10px] uppercase tracking-wider font-extrabold px-2 py-1 rounded border focus:outline-none transition-all cursor-pointer bg-white ${
                                priorityStyles[task.priority] || priorityStyles['Medium']
                              }`}
                            >
                              <option value="High" className="bg-white text-red-750">High</option>
                              <option value="Medium" className="bg-white text-amber-750">Medium</option>
                              <option value="Low" className="bg-white text-primary-650">Low</option>
                            </select>
                          </td>
                        )}
                        {visibleColumns.type && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={task.type}
                              onChange={(e) => handleUpdateTaskProperty(task.id, 'type', e.target.value)}
                              className="text-[10px] font-bold text-primary-700 bg-primary-50 border border-primary-200 px-2 py-1 rounded focus:outline-none cursor-pointer"
                            >
                              <option value="One-shot">One-shot</option>
                              <option value="Repetitive">Repetitive</option>
                              <option value="Project">Project</option>
                            </select>
                          </td>
                        )}
                        {visibleColumns.assignee && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <HslAvatar
                                name={assignee?.name || 'Unassigned'}
                                avatarUrl={assignee?.avatar || '/avatars/placeholder.png'}
                                size={5}
                              />
                              <select
                                value={task.assigneeId || 'unassigned'}
                                onChange={(e) => handleUpdateTaskProperty(task.id, 'assigneeId', e.target.value === 'unassigned' ? '' : e.target.value)}
                                className="text-xs font-semibold text-primary-700 bg-transparent border-0 border-b border-transparent hover:border-primary-300 focus:border-gold-500 focus:outline-none py-0.5 cursor-pointer max-w-[120px]"
                              >
                                <option value="unassigned">Unassigned</option>
                                {people.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                        )}
                        {visibleColumns.company && (
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-primary-500">
                            {company?.name || 'Unassigned'}
                          </td>
                        )}
                        {visibleColumns.dueDate && (
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-primary-500">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2 sticky right-0 bg-white group-hover:bg-[#fcfbf9] z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                          <button
                            data-testid={`edit-task-${task.id}`}
                            onClick={() => handleOpenDrawer(task.id)}
                            className="text-gold-600 hover:text-gold-700 font-bold transition"
                          >
                            Edit
                          </button>
                          <button
                            data-testid={`delete-task-inline-${task.id}`}
                            onClick={async () => {
                              if (!confirm("Are you sure you want to delete this task?")) return;
                              try {
                                const res = await fetch(`/api/tasks/${task.id}`, {
                                  method: 'DELETE',
                                  headers: { 'x-api-key': 'mock-api-key-12345' }
                                });
                                if (res.ok) {
                                  await loadAllData();
                                  setToastMessage("Task deleted successfully");
                                  setShowToast(true);
                                  setTimeout(() => setShowToast(false), 2500);
                                }
                              } catch (err) {
                                console.error("Error deleting task inline:", err);
                              }
                            }}
                            className="text-red-600 hover:text-red-700 font-bold transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedTasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-sm text-primary-400 font-medium bg-[#faf9f6]/30">
                        No tasks match the active filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : grouping === 'none' ? (
        /* STANDARD UNGROUPED GRID VIEW */
        <div id="tasks-container" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={handleOpenDrawer}
              formatType={formatTypeForTestId}
              getPersonById={getPersonById}
              onUpdateProperty={handleUpdateTaskProperty}
            />
          ))}
          {sortedTasks.length === 0 && (
            <div className="col-span-full text-center py-20 text-sm text-primary-400 font-medium bg-white rounded-2xl border border-primary-200">
              No tasks match the active filters.
            </div>
          )}
        </div>
      ) : (
        /* GROUPED GRID VIEWS */
        <div id="tasks-container" className="space-y-10">
          {resolveGroupContainers().map(([groupName, items]) => (
            <div key={groupName} className="space-y-4" data-testid={`group-container-${groupName.replace(/\s+/g, '-').toLowerCase()}`}>
              <div className="flex items-center gap-3 border-b border-primary-100 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gold-500 shadow-sm shadow-gold-500/30"></span>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-primary-750">{groupName}</h3>
                <span className="bg-primary-100 text-primary-600 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? 'task' : 'tasks'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelect={handleOpenDrawer}
                    formatType={formatTypeForTestId}
                    isGroupedCard
                    getPersonById={getPersonById}
                    onUpdateProperty={handleUpdateTaskProperty}
                  />
                ))}
              </div>
            </div>
          ))}
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

      {/* Toast popup */}
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

interface TaskCardProps {
  task: Task;
  onSelect: (id: string) => void;
  formatType: (type: string) => string;
  isGroupedCard?: boolean;
  getPersonById: (id: string) => any;
  onUpdateProperty: (taskId: string, property: string, value: any) => Promise<void>;
}

function TaskCard({ task, onSelect, formatType, isGroupedCard = false, getPersonById, onUpdateProperty }: TaskCardProps) {
  const totalSteps = task.steps.length;
  const completedSteps = task.steps.filter(s => s.completed).length;
  const assignee = getPersonById(task.assigneeId);

  const statusStyles = {
    'Pending': 'bg-primary-50 text-primary-700 border-primary-200',
    'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Blocked': 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      data-testid={isGroupedCard ? `grouped-task-${task.id}` : `task-card-${task.id}`}
      className="task-card group relative bg-white border border-primary-200 rounded-xl p-5 hover:border-gold-300 hover:shadow-xl hover:shadow-gold-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px]"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              data-testid={`task-type-${formatType(task.type)}-${task.id}`}
              className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                task.type === 'Project'
                  ? 'bg-purple-50 text-purple-700 border-purple-100'
                  : task.type === 'Repetitive'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}
            >
              {task.type}
            </span>

            {task.type === 'Repetitive' && task.repeatPattern && (
              <span
                data-testid={`task-recurrence-badge-${task.id}`}
                className="bg-gold-50 text-gold-700 border border-gold-100 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
              >
                {task.repeatPattern}
              </span>
            )}

            {task.type === 'Project' && totalSteps > 0 && (
              <span
                data-testid={`project-steps-completed-${task.id}`}
                className="bg-primary-50 text-primary-600 border border-primary-150 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
              >
                {completedSteps}/{totalSteps} steps
              </span>
            )}
          </div>

          <select
            value={task.status}
            onChange={(e) => onUpdateProperty(task.id, 'status', e.target.value)}
            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer uppercase tracking-wider ${
              statusStyles[task.status] || statusStyles['Pending']
            }`}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={task.status === 'Completed'}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onUpdateProperty(task.id, 'status', task.status === 'Completed' ? 'Pending' : 'Completed')}
            className="w-4 h-4 rounded-full text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer shrink-0"
          />
          <h4 className={`text-sm font-bold text-primary-800 leading-snug group-hover:text-gold-600 transition-colors ${task.status === 'Completed' ? 'line-through text-primary-400 font-medium' : ''}`}>
            {cleanMarkdown(task.title)}
          </h4>
        </div>
        
        <p className="text-xs text-primary-400 line-clamp-2 pl-6">
          {cleanMarkdown(task.description)}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-primary-100 pt-3 mt-4 gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          {task.origin.toLowerCase() === 'golden hour' ? (
            <span
              data-testid={`task-origin-golden-hour-${task.id}`}
              className="bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold text-[8px] py-0.5 px-2 rounded-full border border-gold-400 tracking-wide uppercase"
            >
              Golden Hour
            </span>
          ) : (
            <span
              data-testid={`task-origin-manual-${task.id}`}
              className="bg-primary-100 text-primary-700 border border-primary-200 font-semibold text-[8px] py-0.5 px-2 rounded-full tracking-wide uppercase"
            >
              Manual
            </span>
          )}

          {task.assigneeIds && task.assigneeIds.length > 0 ? (
            <div className="flex items-center -space-x-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {task.assigneeIds.slice(0, 3).map(id => {
                const member = getPersonById(id);
                if (!member) return null;
                return (
                  <div key={id} title={member.name} className="ring-1 ring-white rounded-full">
                    <HslAvatar name={member.name} avatarUrl={member.avatar} size={4.5} className="shrink-0" />
                  </div>
                );
              })}
              {task.assigneeIds.length > 3 && (
                <span className="text-[9px] font-bold text-primary-400 pl-1">+{task.assigneeIds.length - 3}</span>
              )}
            </div>
          ) : assignee ? (
            <div className="flex items-center gap-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={4.5} className="shrink-0" />
              <span className="text-[10px] font-bold text-primary-500 truncate max-w-[65px] hidden xs:inline">{assignee.name}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[9px] font-bold text-primary-450">
            Due: {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-2 h-2 rounded-full ${
              task.priority === 'High' ? 'bg-red-500 animate-pulse' : task.priority === 'Medium' ? 'bg-amber-500' : 'bg-green-500'
            }`}></span>
            <span className="text-[9px] font-extrabold text-primary-400 uppercase tracking-wider">{task.priority}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/[#*`~_]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .trim();
}
