"use client";

import React, { useState, useEffect, useRef } from 'react';
import HslAvatar from '@/components/HslAvatar';

interface Step {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  assigneeId?: string;
}

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

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'One-shot' | 'Repetitive' | 'Project';
  steps: Step[];
  companyId: string;
  assigneeId: string;
  assigneeIds?: string[];
  status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  priority: 'High' | 'Medium' | 'Low';
  origin: 'Golden Hour' | 'Manual';
  dueDate: string;
  attachments: any[];
  activityLog: any[];
}

export default function ProjectsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error('Error fetching session in projects:', err);
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

    setTasks(filteredTasks.filter(t => t.type === 'Project' || String(t.type).toLowerCase() === 'project'));
    setPeople(filteredPeople);
    setCompanies(filteredCompanies);
  }, [rawTasks, rawPeople, rawCompanies, session]);

  // View state: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Expanded project rows in table view
  const [expandedRows, setExpandedRows] = useState<{ [id: string]: boolean }>({});

  // Synchronized Double Scrollbar
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
  }, [tasks, viewMode]);

  // Timeline detail view modal
  const [ganttProject, setGanttProject] = useState<Task | null>(null);
  
  // Weekly navigation offset in days (0 = starting today, 7 = next week, -7 = prev week)
  const [ganttOffset, setGanttOffset] = useState<number>(0);

  // Form states for adding new steps inline
  const [newStepText, setNewStepText] = useState<{ [taskId: string]: string }>({});
  const [newStepDate, setNewStepDate] = useState<{ [taskId: string]: string }>({});

  // Toast states
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const headers = {
    'x-api-key': 'mock-api-key-12345',
    'Content-Type': 'application/json'
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const loadData = async () => {
    try {
      const tasksRes = await fetch('/api/tasks', { headers });
      const tasksData = await tasksRes.json();

      const companiesRes = await fetch('/api/companies', { headers });
      const companiesData = await companiesRes.json();

      const peopleRes = await fetch('/api/persons', { headers });
      const peopleData = await peopleRes.json();

      if (Array.isArray(tasksData)) {
        setRawTasks(tasksData);
      }
      setRawCompanies(Array.isArray(companiesData) ? companiesData : []);
      setRawPeople(Array.isArray(peopleData) ? peopleData : []);
    } catch (err) {
      console.error('Error loading projects data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getCompanyById = (id: string) => companies.find(c => c.id === id);
  const getPersonById = (id: string) => people.find(p => p.id === id);

  // Toggle row expansion in Table View
  const toggleRowExpanded = (projectId: string) => {
    setExpandedRows(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  // Sync steps to backend DB
  const updateProjectSteps = async (taskId: string, updatedSteps: Step[], actionLabel: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ steps: updatedSteps })
      });

      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, steps: updatedSteps } : t));
        if (ganttProject && ganttProject.id === taskId) {
          setGanttProject(prev => prev ? { ...prev, steps: updatedSteps } : null);
        }
        triggerToast(`${actionLabel} successfully`);
      } else {
        console.error("Failed to update project steps on server");
      }
    } catch (err) {
      console.error("Error updating project steps:", err);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, steps: updatedSteps } : t));
      triggerToast(`${actionLabel} locally`);
    }
  };

  // Toggle checklist step completion status (backward compatibility)
  const handleToggleStep = async (taskId: string, stepId: string) => {
    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const updatedSteps = project.steps.map(s => {
      if (s.id === stepId) {
        const nextCompleted = !s.completed;
        return {
          ...s,
          completed: nextCompleted,
          status: nextCompleted ? 'Completed' : 'Pending' as any
        };
      }
      return s;
    });
    await updateProjectSteps(taskId, updatedSteps, "Step updated");
  };

  // Update specific step status inline (supports Pending, In Progress, Completed, Blocked)
  const handleUpdateStepStatus = async (taskId: string, stepId: string, newStatus: 'Pending' | 'In Progress' | 'Completed' | 'Blocked') => {
    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const updatedSteps = project.steps.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          status: newStatus,
          completed: newStatus === 'Completed'
        };
      }
      return s;
    });
    await updateProjectSteps(taskId, updatedSteps, `Step marked ${newStatus}`);
  };

  // Add new step inline
  const handleAddStep = async (taskId: string) => {
    const text = newStepText[taskId]?.trim();
    if (!text) return;

    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const dueDateVal = newStepDate[taskId] || project.dueDate.substring(0, 10);

    const newStep: Step = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      completed: false,
      dueDate: dueDateVal,
      status: 'Pending'
    };

    const updatedSteps = [...project.steps, newStep];
    
    setNewStepText(prev => ({ ...prev, [taskId]: '' }));
    setNewStepDate(prev => ({ ...prev, [taskId]: '' }));

    await updateProjectSteps(taskId, updatedSteps, "Step added");
  };

  // Update specific step due date
  const handleUpdateStepDate = async (taskId: string, stepId: string, newDate: string) => {
    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const updatedSteps = project.steps.map(s => s.id === stepId ? { ...s, dueDate: newDate } : s);
    await updateProjectSteps(taskId, updatedSteps, "Step schedule updated");
  };

  // Update specific step assignee
  const handleUpdateStepAssignee = async (taskId: string, stepId: string, assigneeId: string) => {
    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const updatedSteps = project.steps.map(s => s.id === stepId ? { ...s, assigneeId: assigneeId || undefined } : s);
    await updateProjectSteps(taskId, updatedSteps, "Step assignee updated");
  };

  // Delete step
  const handleDeleteStep = async (taskId: string, stepId: string) => {
    const project = tasks.find(t => t.id === taskId);
    if (!project) return;

    const updatedSteps = project.steps.filter(s => s.id !== stepId);
    await updateProjectSteps(taskId, updatedSteps, "Step deleted");
  };

  // Open Gantt modal
  const handleOpenGanttModal = (project: Task) => {
    setGanttProject(project);
    setGanttOffset(0);
  };

  // Generate 7 consecutive days
  const getGanttTimelineDays = (offsetDays: number) => {
    const days = [];
    const base = new Date();
    base.setDate(base.getDate() + offsetDays);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const ganttTimelineDays = getGanttTimelineDays(ganttOffset);

  // Check if step dueDate lands on a specific Gantt day
  const isStepOnGanttDay = (stepDate: string | undefined, day: Date) => {
    if (!stepDate) return false;
    const sDate = new Date(stepDate);
    return sDate.getFullYear() === day.getFullYear() &&
           sDate.getMonth() === day.getMonth() &&
           sDate.getDate() === day.getDate();
  };

  // Check if step dueDate is out of active Gantt view range
  const isStepOutOfGanttView = (stepDate: string | undefined) => {
    if (!stepDate) return false;
    const sDate = new Date(stepDate).getTime();
    const startDay = ganttTimelineDays[0].getTime() - (24 * 60 * 60 * 1000);
    const endDay = ganttTimelineDays[6].getTime() + (24 * 60 * 60 * 1000);
    return sDate < startDay || sDate > endDay;
  };

  // Highlight today's date column
  const isToday = (day: Date) => {
    const today = new Date();
    return today.getFullYear() === day.getFullYear() &&
           today.getMonth() === day.getMonth() &&
           today.getDate() === day.getDate();
  };

  // Navigate Gantt offset directly to step due date
  const jumpToStepWeek = (stepDate: string | undefined) => {
    if (!stepDate) return;
    const sDate = new Date(stepDate);
    const today = new Date();
    const diffTime = sDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setGanttOffset(diffDays - 2);
    triggerToast("Timeline shifted to subtask schedule");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Panel with View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-primary-200 pb-6 gap-4">
        <div>
          <h1 data-testid="projects-console-header" className="text-3xl font-extrabold text-primary-900 tracking-tight">
            Hermes Projects Console
          </h1>
          <p className="text-sm text-primary-500 mt-1">
            Dedicated workspace to control corporate projects, assign step due dates, and monitor Gantt timelines.
          </p>
        </div>

        {/* View Toggle Bar */}
        <div className="flex items-center gap-1.5 bg-primary-100/50 p-1 rounded-lg border border-primary-200 shrink-0 self-start md:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-primary-950 shadow-sm border border-primary-200'
                : 'text-primary-500 hover:text-primary-850'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              viewMode === 'table'
                ? 'bg-white text-primary-950 shadow-sm border border-primary-200'
                : 'text-primary-500 hover:text-primary-850'
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white border border-primary-200 rounded-2xl p-8 shadow-sm">
          <svg className="w-12 h-12 text-primary-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-sm font-semibold text-primary-700">No active projects found</h3>
          <p className="text-xs text-primary-400 mt-1">Register tasks as type "Project" on the Tasks Board to display them here.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {tasks.map(project => {
            const assignee = getPersonById(project.assigneeId);
            const company = getCompanyById(project.companyId);

            const totalSteps = project.steps.length;
            const completedSteps = project.steps.filter(s => s.completed).length;
            const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            return (
              <div
                key={project.id}
                data-testid={`project-card-${project.id}`}
                className="bg-white border border-primary-200 rounded-2xl shadow-sm p-6 hover:shadow-xl hover:border-gold-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap border-b border-primary-100 pb-3.5">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md uppercase">
                        Project Card
                      </span>
                      <h3
                        onClick={() => handleOpenGanttModal(project)}
                        className="text-lg font-bold text-primary-900 mt-1 leading-snug cursor-pointer hover:text-gold-600 transition-colors"
                        title="Click to enter Gantt timeline studio"
                      >
                        {project.title}
                      </h3>
                    </div>
                    {company && (
                      <span className="text-[10px] font-semibold text-primary-500 bg-primary-50 border border-primary-150 px-2 py-0.5 rounded-md">
                        {company.name}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-primary-500 leading-relaxed font-normal">
                    {project.description.replace(/[#*`]/g, '') || "No description provided."}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-primary-400">Project checklist steps</span>
                      <span className="text-gold-600 bg-gold-50 border border-gold-100/60 px-2 py-0.5 rounded-md text-[10px]">
                        {percentage}% ({completedSteps}/{totalSteps} completed)
                      </span>
                    </div>
                    <div className="w-full bg-primary-100 h-2.5 rounded-full overflow-hidden border border-primary-200/50">
                      <div
                        className="h-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Steps with Dates and Statuses checklist editor */}
                  <div className="bg-primary-50/50 border border-primary-150 rounded-xl p-4 space-y-3 mt-4">
                    <h4 className="text-xs font-bold text-primary-700 tracking-wide uppercase border-b border-primary-200/50 pb-1.5 flex items-center justify-between">
                      <span>Subtask Status & Deadlines</span>
                      <button
                        onClick={() => handleOpenGanttModal(project)}
                        className="text-[10px] font-bold text-gold-600 hover:text-gold-700 transition"
                      >
                        📊 View Gantt Timeline
                      </button>
                    </h4>

                    {totalSteps === 0 ? (
                      <div className="text-xs text-primary-400 italic py-2">No steps listed in this project. Add one below!</div>
                    ) : (
                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {project.steps.map((step, idx) => (
                          <div
                            key={step.id || idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-primary-100"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Bidirectional quick check toggle */}
                              <input
                                type="checkbox"
                                id={`step-${project.id}-${idx}`}
                                checked={step.completed}
                                onChange={() => handleToggleStep(project.id, step.id)}
                                className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                              />
                              
                              {/* Sub-status selector dropdown next to step text */}
                              <select
                                value={step.status || (step.completed ? 'Completed' : 'Pending')}
                                onChange={(e) => handleUpdateStepStatus(project.id, step.id, e.target.value as any)}
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
                                htmlFor={`step-${project.id}-${idx}`}
                                className={`text-xs text-primary-700 cursor-pointer truncate ${step.completed ? 'line-through text-primary-400 font-medium' : 'font-bold'}`}
                              >
                                {step.text}
                              </label>
                            </div>
                            
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <select
                                value={step.assigneeId || ''}
                                onChange={(e) => handleUpdateStepAssignee(project.id, step.id, e.target.value)}
                                className="px-2 py-0.5 bg-primary-100/60 border border-primary-200 rounded text-[10px] font-bold text-primary-700 focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer w-24"
                              >
                                <option value="">No Assigned</option>
                                {people.map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>

                              <input
                                type="date"
                                value={step.dueDate ? step.dueDate.substring(0, 10) : ''}
                                onChange={(e) => handleUpdateStepDate(project.id, step.id, e.target.value)}
                                className="px-2 py-0.5 bg-primary-100/60 border border-primary-200 rounded text-[10px] font-bold text-primary-700 focus:outline-none focus:ring-1 focus:ring-gold-500"
                              />
                              <button
                                onClick={() => handleDeleteStep(project.id, step.id)}
                                className="text-primary-400 hover:text-red-600 p-1 rounded-md transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Step Adder Form */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-primary-200/50 mt-2">
                      <input
                        type="text"
                        placeholder="Add step..."
                        value={newStepText[project.id] || ''}
                        onChange={(e) => setNewStepText(prev => ({ ...prev, [project.id]: e.target.value }))}
                        className="flex-1 px-3 py-1.5 bg-white border border-primary-200 rounded-lg text-xs text-primary-800 focus:outline-none focus:ring-1 focus:ring-gold-500"
                      />
                      <input
                        type="date"
                        value={newStepDate[project.id] || ''}
                        onChange={(e) => setNewStepDate(prev => ({ ...prev, [project.id]: e.target.value }))}
                        className="px-2 py-1.5 bg-white border border-primary-200 rounded-lg text-xs text-primary-700 focus:outline-none"
                      />
                      <button
                        onClick={() => handleAddStep(project.id)}
                        className="px-3.5 py-1.5 bg-gold-600 hover:bg-gold-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all whitespace-nowrap"
                      >
                        Add Step
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer details */}
                <div className="flex items-center justify-between border-t border-primary-100 pt-4 mt-6">
                  {assignee ? (
                    <div className="flex items-center gap-2">
                      <HslAvatar name={assignee.name} avatarUrl={assignee.avatar} size={8} />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-primary-400 font-bold uppercase">Assigned</span>
                        <span className="text-xs font-bold text-primary-850">{assignee.name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-primary-400 font-medium">Unassigned</div>
                  )}
                  <div className="text-right">
                    <span className="text-[10px] text-primary-400 font-bold uppercase block">Due Date</span>
                    <span className="text-xs font-bold text-primary-600">{new Date(project.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Expandable rows) */
        <div className="bg-white border border-primary-200 rounded-2xl shadow-sm overflow-hidden max-h-[750px] flex flex-col">
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
            className="overflow-x-auto overflow-y-auto max-h-[700px] relative scrollbar-thin"
          >
            <table ref={tableRef} className="min-w-full divide-y divide-primary-200 table-fixed md:table-auto">
              <thead className="bg-[#faf9f6] sticky top-0 z-30">
                <tr>
                  <th className="w-12 px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider"></th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider sticky left-0 bg-[#faf9f6] z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Project Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden sm:table-cell">
                    Company
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider">
                    Overall Progress
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-primary-500 uppercase tracking-wider hidden sm:table-cell">
                    Due Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-primary-500 uppercase tracking-wider sticky right-0 bg-[#faf9f6] z-40 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100 bg-white">
                {tasks.map(project => {
                  const company = getCompanyById(project.companyId);
                  const isExpanded = !!expandedRows[project.id];
                  const totalSteps = project.steps.length;
                  const completedSteps = project.steps.filter(s => s.completed).length;
                  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                  return (
                    <React.Fragment key={project.id}>
                      <tr className="group hover:bg-gold-50/10 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold">
                          <button
                            onClick={() => toggleRowExpanded(project.id)}
                            className="text-primary-400 hover:text-gold-600 font-bold transition-all text-sm p-1 rounded hover:bg-primary-100"
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        </td>
                        <td 
                          onClick={() => handleOpenGanttModal(project)}
                          className="px-6 py-4 whitespace-nowrap text-sm font-bold text-primary-800 sticky left-0 bg-white group-hover:bg-[#fcfbf9] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:text-gold-600 transition-colors"
                          title="Click to enter Gantt timeline studio"
                        >
                          {project.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-primary-500 hidden sm:table-cell">
                          {company?.name || 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-primary-100 h-2 rounded-full overflow-hidden border border-primary-200/50 shrink-0">
                              <div
                                className="h-full bg-gradient-to-r from-gold-400 to-gold-600 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-gold-600">{percentage}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-primary-600 hidden sm:table-cell">
                          {new Date(project.dueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2 sticky right-0 bg-white group-hover:bg-[#fcfbf9] z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors">
                          <button
                            onClick={() => handleOpenGanttModal(project)}
                            className="text-gold-600 hover:text-gold-700 font-bold transition"
                          >
                            Timeline
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-primary-50/30 px-8 py-4">
                            <div className="border border-primary-200/80 rounded-xl overflow-hidden shadow-sm bg-white p-4">
                              <h4 className="text-xs font-bold text-primary-600 mb-3 uppercase tracking-wider">
                                Subtask Steps & Due Dates
                              </h4>
                              
                              {totalSteps === 0 ? (
                                <div className="text-xs text-primary-400 italic">No subtask steps created.</div>
                              ) : (
                                <table className="min-w-full divide-y divide-primary-150">
                                  <thead>
                                    <tr className="bg-primary-50/50">
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-primary-500 uppercase">Status Scope</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-primary-500 uppercase">Subtask Title</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-primary-500 uppercase">Assignee</th>
                                      <th className="px-4 py-2 text-left text-[10px] font-bold text-primary-500 uppercase">Sub-Due Date</th>
                                      <th className="w-16 px-4 py-2 text-right text-[10px] font-bold text-primary-500 uppercase">Delete</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-primary-100">
                                    {project.steps.map((step, idx) => (
                                      <tr key={step.id || idx} className="hover:bg-primary-50/20 transition-colors">
                                        <td className="px-4 py-2 whitespace-nowrap w-24">
                                          {/* Sub-status selector dropdown nested inside table cells */}
                                          <select
                                            value={step.status || (step.completed ? 'Completed' : 'Pending')}
                                            onChange={(e) => handleUpdateStepStatus(project.id, step.id, e.target.value as any)}
                                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${
                                              step.status === 'Completed' || step.completed
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : step.status === 'In Progress'
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : step.status === 'Blocked'
                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                : 'bg-primary-50 text-primary-700 border-primary-200'
                                            }`}
                                          >
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Blocked">Blocked</option>
                                          </select>
                                        </td>
                                        <td className={`px-4 py-2 whitespace-nowrap text-xs font-bold text-primary-750 ${step.completed ? 'line-through text-primary-400' : ''}`}>
                                          {step.text}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <select
                                            value={step.assigneeId || ''}
                                            onChange={(e) => handleUpdateStepAssignee(project.id, step.id, e.target.value)}
                                            className="px-2 py-0.5 bg-primary-50 border border-primary-200 rounded text-xs font-bold text-primary-700 cursor-pointer"
                                          >
                                            <option value="">No Assigned</option>
                                            {people.map(p => (
                                              <option key={p.id} value={p.id}>
                                                {p.name}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <input
                                            type="date"
                                            value={step.dueDate ? step.dueDate.substring(0, 10) : ''}
                                            onChange={(e) => handleUpdateStepDate(project.id, step.id, e.target.value)}
                                            className="px-2 py-0.5 bg-primary-50 border border-primary-200 rounded text-xs font-bold text-primary-700"
                                          />
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right">
                                          <button
                                            onClick={() => handleDeleteStep(project.id, step.id)}
                                            className="text-red-500 hover:text-red-700 font-bold text-xs"
                                          >
                                            Delete
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* Inline adder */}
                              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-primary-100 mt-3">
                                <input
                                  type="text"
                                  placeholder="Add subtask text..."
                                  value={newStepText[project.id] || ''}
                                  onChange={(e) => setNewStepText(prev => ({ ...prev, [project.id]: e.target.value }))}
                                  className="flex-1 px-3 py-1 bg-primary-50 border border-primary-200 rounded-lg text-xs"
                                />
                                <input
                                  type="date"
                                  value={newStepDate[project.id] || ''}
                                  onChange={(e) => setNewStepDate(prev => ({ ...prev, [project.id]: e.target.value }))}
                                  className="px-2 py-1 bg-primary-50 border border-primary-200 rounded-lg text-xs"
                                />
                                <button
                                  onClick={() => handleAddStep(project.id)}
                                  className="px-4 py-1 bg-gold-600 hover:bg-gold-700 text-white rounded-lg text-xs font-semibold transition"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MICROSOFT PROJECT GANTT TIMELINE DETAIL MODAL --- */}
      {ganttProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-primary-200">
            {/* Modal Header */}
            <div className="bg-primary-900 px-6 py-4 flex items-center justify-between border-b border-primary-800">
              <div>
                <span className="text-[9px] font-bold text-gold-400 tracking-widest uppercase">Microsoft Project Gantt Studio</span>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {ganttProject.title} — Schedule Timeline
                </h3>
              </div>
              <button
                onClick={() => setGanttProject(null)}
                className="text-primary-300 hover:text-white transition font-bold text-sm bg-primary-800 hover:bg-primary-750 px-3 py-1.5 rounded-lg"
              >
                Close Timeline
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-primary-50/30">
              {/* Project metrics summary row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border p-4 rounded-xl shadow-sm md:col-span-2">
                  <h4 className="text-xs font-bold text-primary-400 uppercase tracking-wider">Project Description</h4>
                  <p className="text-xs text-primary-700 mt-1.5 font-medium whitespace-pre-wrap leading-relaxed">
                    {ganttProject.description.replace(/[#*`]/g, '') || "No details provided."}
                  </p>
                </div>
                <div className="bg-white border p-4 rounded-xl shadow-sm">
                  <h4 className="text-xs font-bold text-primary-400 uppercase tracking-wider">Overall Progress</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-2xl font-extrabold text-gold-600">
                      {ganttProject.steps.length > 0
                        ? Math.round((ganttProject.steps.filter(s => s.completed).length / ganttProject.steps.length) * 100)
                        : 0}%
                    </span>
                    <span className="text-[10px] font-bold text-primary-400">
                      ({ganttProject.steps.filter(s => s.completed).length} of {ganttProject.steps.length} steps)
                    </span>
                  </div>
                </div>
                <div className="bg-white border p-4 rounded-xl shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-primary-400 uppercase tracking-wider">Project Due Date</h4>
                    <span className="text-sm font-extrabold text-primary-800 block mt-1">
                      {new Date(ganttProject.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gantt Calendar Board Chart */}
              <div className="bg-white border border-primary-200 rounded-xl shadow-sm overflow-hidden">
                {/* Weekly Shift Controls */}
                <div className="bg-primary-50 px-4 py-3 border-b border-primary-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h4 className="text-xs font-bold text-primary-700 uppercase tracking-wider">
                    Gantt Schedule Grid 
                  </h4>
                  
                  {/* Shift Navigation buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => setGanttOffset(prev => prev - 7)}
                      className="px-2.5 py-1 bg-white hover:bg-gold-50 border border-primary-200 hover:border-gold-300 text-[10px] font-bold text-primary-700 rounded transition"
                      title="Shift 7 days back"
                    >
                      ◀ Prev Week
                    </button>
                    <button
                      onClick={() => setGanttOffset(0)}
                      className="px-2.5 py-1 bg-white hover:bg-primary-50 border border-primary-200 text-[10px] font-bold text-primary-700 rounded transition"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setGanttOffset(prev => prev + 7)}
                      className="px-2.5 py-1 bg-white hover:bg-gold-50 border border-primary-200 hover:border-gold-300 text-[10px] font-bold text-primary-700 rounded transition"
                      title="Shift 7 days forward"
                    >
                      Next Week ▶
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <div className="min-w-[900px] divide-y divide-primary-100">
                    {/* Header: Date Columns */}
                    <div className="grid grid-cols-12 bg-[#faf9f6] text-center divide-x divide-primary-100 py-3">
                      <div className="col-span-5 text-left pl-4 text-xs font-bold text-primary-500 uppercase tracking-wider">
                        Subtask Step
                      </div>
                      
                      {ganttTimelineDays.map((day, idx) => (
                        <div
                          key={idx}
                          className={`col-span-1 text-[10px] font-bold py-1 ${
                            isToday(day) ? 'bg-gold-50 text-gold-700 font-extrabold border-b-2 border-gold-500' : 'text-primary-600'
                          }`}
                        >
                          <div>{day.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                          <div className={`text-xs font-extrabold mt-0.5 ${isToday(day) ? 'text-gold-700' : 'text-primary-700'}`}>
                            {day.getDate()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Step Schedule Bar Rows */}
                    {ganttProject.steps.length === 0 ? (
                      <div className="text-center py-10 text-xs text-primary-400 italic">No subtask timelines to display. Add steps to generate Gantt chart bars!</div>
                    ) : (
                      ganttProject.steps.map((step, idx) => {
                        const outOfRange = isStepOutOfGanttView(step.dueDate);

                        return (
                          <div key={step.id || idx} className="grid grid-cols-12 items-center divide-x divide-primary-100 py-3.5 hover:bg-gold-50/5 transition-colors">
                            {/* Step Checkbox & Title */}
                            <div className="col-span-5 flex items-center justify-between gap-3 pl-4 pr-3 min-w-0">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Inline sub-status selector directly in Gantt Grid list */}
                                <select
                                  value={step.status || (step.completed ? 'Completed' : 'Pending')}
                                  onChange={(e) => handleUpdateStepStatus(ganttProject.id, step.id, e.target.value as any)}
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer ${
                                    step.status === 'Completed' || step.completed
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : step.status === 'In Progress'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : step.status === 'Blocked'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-primary-50 text-primary-700 border-primary-200'
                                  }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="In Progress">In Progress</option>
                                  <option value="Completed">Completed</option>
                                  <option value="Blocked">Blocked</option>
                                </select>
                                
                                <span className={`text-xs font-bold truncate text-primary-800 ${step.completed ? 'line-through text-primary-400' : ''}`}>
                                  {step.text}
                                </span>
                              </div>
                              
                              {/* Jump to Week trigger if step due date is hidden */}
                              {outOfRange && step.dueDate && (
                                <button
                                  onClick={() => jumpToStepWeek(step.dueDate)}
                                  className="text-[9px] font-bold text-gold-600 hover:text-gold-700 border border-gold-200 bg-gold-50/40 hover:bg-gold-50 px-1.5 py-0.5 rounded shadow-sm shrink-0 transition"
                                  title={`Due date is ${new Date(step.dueDate).toLocaleDateString()}. Click to scroll timeline.`}
                                >
                                  📅 Shift View
                                </button>
                              )}
                            </div>

                            {/* Gantt Bar Columns Grid with dynamic status HSL colors */}
                            {ganttTimelineDays.map((day, dayIdx) => {
                              const matchesDay = isStepOnGanttDay(step.dueDate, day);
                              const highlighted = isToday(day);

                              return (
                                <div
                                  key={dayIdx}
                                  className={`col-span-1 h-8 flex items-center justify-center relative px-1 ${
                                    highlighted ? 'bg-gold-50/10' : ''
                                  }`}
                                >
                                  {matchesDay && (
                                    <div
                                      className={`absolute inset-x-1.5 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white shadow-md border animate-pulse select-none transition-all duration-300 ${
                                        step.status === 'Completed' || step.completed
                                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-400 shadow-emerald-500/10'
                                          : step.status === 'In Progress'
                                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400 shadow-blue-500/10'
                                          : step.status === 'Blocked'
                                          ? 'bg-gradient-to-r from-red-500 to-red-600 border-red-400 shadow-red-500/10'
                                          : 'bg-gradient-to-r from-primary-400 to-primary-500 border-primary-300 shadow-primary-500/10'
                                      }`}
                                      title={`Status: ${step.status || 'Pending'}, Due Date: ${new Date(step.dueDate!).toLocaleDateString()}`}
                                    >
                                      {step.status === 'Completed' || step.completed ? 'Done' : step.status === 'In Progress' ? 'Running' : step.status === 'Blocked' ? 'Stopped' : 'Pending'}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule Editor Inside Modal */}
              <div className="bg-white border p-4 rounded-xl shadow-sm space-y-3">
                <h4 className="text-xs font-bold text-primary-700 uppercase tracking-wider border-b pb-2">Modify Step Schedules & Status</h4>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {ganttProject.steps.map((step, idx) => (
                    <div key={step.id || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-primary-50 rounded-lg text-xs font-semibold">
                      <span className="text-primary-800 truncate max-w-[300px]">{step.text}</span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-primary-400">Status:</span>
                          <select
                            value={step.status || (step.completed ? 'Completed' : 'Pending')}
                            onChange={(e) => handleUpdateStepStatus(ganttProject.id, step.id, e.target.value as any)}
                            className="px-2 py-0.5 bg-white border border-primary-200 rounded text-xs font-bold text-primary-750 focus:outline-none focus:ring-1 focus:ring-gold-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Blocked">Blocked</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-primary-400">Due Date:</span>
                          <input
                            type="date"
                            value={step.dueDate ? step.dueDate.substring(0, 10) : ''}
                            onChange={(e) => handleUpdateStepDate(ganttProject.id, step.id, e.target.value)}
                            className="px-2 py-1 bg-white border border-primary-200 rounded text-[10px] font-bold text-primary-700 focus:outline-none focus:ring-1 focus:ring-gold-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {showToast && (
        <div
          id="projects-toast-notification"
          className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold z-50 animate-bounce"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
