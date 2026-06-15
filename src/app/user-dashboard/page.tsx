"use client";

import React, { useState, useEffect, useMemo } from 'react';
import HslAvatar from '@/components/HslAvatar';
import TaskDrawer, { Task, Person, Company } from '@/components/TaskDrawer';
import { useUnreadComments } from '@/hooks/useUnreadComments';

export interface DayPlanBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'task' | 'meeting' | 'personal';
  taskId?: string;
}

function extractDayPlanClient(description: string): DayPlanBlock[] {
  if (!description) return [];
  const match = description.match(/<!-- HERMES_DAY_PLAN: (.*?) -->/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('Error parsing day plan:', e);
    }
  }
  return [];
}

function injectDayPlanClient(description: string, plan: DayPlanBlock[]): string {
  const clean = (description || '').replace(/<!-- HERMES_DAY_PLAN: (.*?) -->/g, '').trim();
  const jsonStr = JSON.stringify(plan);
  return `${clean}\n\n<!-- HERMES_DAY_PLAN: ${jsonStr} -->`;
}

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
  const selectedUser = useMemo(() => {
    return people.find(p => p.id === selectedUserId) || null;
  }, [people, selectedUserId]);
  const [viewMode, setViewMode] = useState<'standard' | 'visual'>('standard');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [agendaViewMode, setAgendaViewMode] = useState<'timeline' | 'list' | 'board'>('timeline');

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [dayPlanBlocks, setDayPlanBlocks] = useState<DayPlanBlock[]>([]);
  const [dayPlanTask, setDayPlanTask] = useState<Task | null>(null);
  const [draftBlocks, setDraftBlocks] = useState<DayPlanBlock[] | null>(null);

  // Chat planner states
  const [plannerMessages, setPlannerMessages] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    {
      sender: 'ai',
      text: 'Hola, soy Hermes Asistente. ¿Cómo te gustaría estructurar tu día hoy? Cuéntame sobre tus prioridades o reuniones y te ayudaré a planificarlo.'
    }
  ]);
  const [plannerInput, setPlannerInput] = useState('');
  const [aiPlannerLoading, setAiPlannerLoading] = useState(false);
  const [isEditingBlock, setIsEditingBlock] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<DayPlanBlock | null>(null);
  const [showAddBlockInline, setShowAddBlockInline] = useState<string | null>(null); // Start hour for inline adding
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockType, setNewBlockType] = useState<'task' | 'meeting' | 'personal'>('task');
  const [newBlockEnd, setNewBlockEnd] = useState('');

  // Sync / Load Daily Plan Task
  useEffect(() => {
    if (!selectedUserId || !selectedDate) return;
    const planTitle = `Plan de Trabajo - ${selectedUser?.name || ''} - ${selectedDate}`;
    const foundTask = rawTasks.find(t => 
      t.assigneeId === selectedUserId && 
      t.title === planTitle
    );
    if (foundTask) {
      setDayPlanTask(foundTask);
      setDayPlanBlocks(extractDayPlanClient(foundTask.description));
    } else {
      setDayPlanTask(null);
      setDayPlanBlocks([]);
    }
    setDraftBlocks(null);
  }, [selectedUserId, selectedDate, rawTasks, selectedUser]);

  const handleSaveDayPlan = async (blocks: DayPlanBlock[]) => {
    if (!selectedUserId || !selectedDate) return;
    const planTitle = `Plan de Trabajo - ${selectedUser?.name || ''} - ${selectedDate}`;
    const updatedDescription = injectDayPlanClient(
      dayPlanTask?.description || `Plan de Trabajo para ${selectedUser?.name || 'Usuario'} el ${selectedDate}`,
      blocks
    );

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };

      if (dayPlanTask) {
        const res = await fetch(`/api/tasks/${dayPlanTask.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            description: updatedDescription
          })
        });
        if (res.ok) {
          const updatedTask = await res.json();
          setRawTasks(prev => prev.map(t => t.id === updatedTask.id ? { ...t, description: updatedTask.description } : t));
          setToastMessage("Agenda diaria guardada");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: planTitle,
            description: updatedDescription,
            type: 'One-shot',
            assigneeId: selectedUserId,
            status: 'Pending',
            priority: 'Medium',
            origin: 'Manual',
            dueDate: `${selectedDate}T23:59:59Z`,
            companyId: selectedUser?.companyId || ''
          })
        });
        if (res.ok) {
          const newTask = await res.json();
          setRawTasks(prev => [...prev, {
            ...newTask,
            steps: [],
            attachments: [],
            activityLog: [],
            completedDays: []
          }]);
          setToastMessage("Agenda diaria creada");
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }
      }
    } catch (err) {
      console.error("Error saving day plan:", err);
    }
  };

  const handleAddBlock = (startHour: string) => {
    if (!newBlockTitle.trim()) return;
    const startNum = parseInt(startHour.split(':')[0]);
    const endHour = newBlockEnd || `${String(startNum + 1).padStart(2, '0')}:00`;

    const newBlock: DayPlanBlock = {
      id: 'block_' + Math.random().toString(36).substring(2, 9),
      title: newBlockTitle,
      start: startHour,
      end: endHour,
      type: newBlockType
    };

    const currentList = draftBlocks !== null ? draftBlocks : dayPlanBlocks;
    const updatedBlocks = [...currentList, newBlock].sort((a, b) => a.start.localeCompare(b.start));
    
    if (draftBlocks !== null) {
      setDraftBlocks(updatedBlocks);
    } else {
      setDayPlanBlocks(updatedBlocks);
      handleSaveDayPlan(updatedBlocks);
    }

    setNewBlockTitle('');
    setNewBlockType('task');
    setNewBlockEnd('');
    setShowAddBlockInline(null);
  };

  const handleDeleteBlock = (blockId: string) => {
    const currentList = draftBlocks !== null ? draftBlocks : dayPlanBlocks;
    const updatedBlocks = currentList.filter(b => b.id !== blockId);
    
    if (draftBlocks !== null) {
      setDraftBlocks(updatedBlocks);
    } else {
      setDayPlanBlocks(updatedBlocks);
      handleSaveDayPlan(updatedBlocks);
    }
  };

  const handleUpdateBlock = (updated: DayPlanBlock) => {
    const currentList = draftBlocks !== null ? draftBlocks : dayPlanBlocks;
    const exists = currentList.some(b => b.id === updated.id);
    let updatedBlocks;
    if (exists) {
      updatedBlocks = currentList.map(b => b.id === updated.id ? updated : b);
    } else {
      const cleanBlock = {
        ...updated,
        id: updated.id.startsWith('new_') ? 'block_' + Math.random().toString(36).substring(2, 9) : updated.id
      };
      updatedBlocks = [...currentList, cleanBlock];
    }
    updatedBlocks.sort((a, b) => a.start.localeCompare(b.start));
    
    if (draftBlocks !== null) {
      setDraftBlocks(updatedBlocks);
    } else {
      setDayPlanBlocks(updatedBlocks);
      handleSaveDayPlan(updatedBlocks);
    }
    setIsEditingBlock(false);
    setEditingBlock(null);
  };

  const handleAutoplanWithAI = async () => {
    setAiPlannerLoading(true);
    const todayTasks = userTasks.filter(t => 
      t.dueDate && t.dueDate.substring(0, 10) === selectedDate && !t.isMeeting
    ).map(t => ({ id: t.id, title: t.title }));

    const todayMeetings = userTasks.filter(t => 
      t.dueDate && t.dueDate.substring(0, 10) === selectedDate && t.isMeeting
    ).map(t => ({ id: t.id, title: t.title, meetingTime: t.meetingTime }));

    const userPrompt = plannerInput || "Por favor organízame el día de la mejor manera.";

    const updatedHistory = [
      ...plannerMessages,
      { sender: 'user' as const, text: userPrompt }
    ];

    setPlannerMessages(updatedHistory);
    setPlannerInput('');

    try {
      const res = await fetch('/api/ai/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({
          action: 'day_plan',
          text: userPrompt,
          tasks: todayTasks,
          meetings: todayMeetings,
          currentBlocks: dayPlanBlocks,
          history: updatedHistory
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result && data.result.plan) {
          const suggestedBlocks = data.result.plan;
          const aiMessage = data.result.message || `He preparado una propuesta de agenda con ${suggestedBlocks.length} bloques. Por favor, revisa la vista previa sombreada en tu calendario y confirma si deseas aplicarla.`;
          setPlannerMessages(prev => [
            ...prev,
            { sender: 'ai', text: aiMessage }
          ]);
          setDraftBlocks(suggestedBlocks);
        } else {
          setPlannerMessages(prev => [
            ...prev,
            { sender: 'ai', text: 'Lo siento, no pude procesar la propuesta de agenda en este momento. Inténtalo de nuevo.' }
          ]);
        }
      } else {
        setPlannerMessages(prev => [
          ...prev,
          { sender: 'ai', text: 'El servidor no pudo procesar tu solicitud. Revisa la consola para más detalles.' }
        ]);
      }
    } catch (err) {
      console.error("Error auto planning with AI:", err);
      setPlannerMessages(prev => [
        ...prev,
        { sender: 'ai', text: 'Error de red al intentar conectar con la inteligencia artificial.' }
      ]);
    } finally {
      setAiPlannerLoading(false);
    }
  };

  const handleConfirmProposal = () => {
    if (!draftBlocks) return;
    setDayPlanBlocks(draftBlocks);
    handleSaveDayPlan(draftBlocks);
    setDraftBlocks(null);
    setPlannerMessages(prev => [
      ...prev,
      { sender: 'ai', text: '¡Agenda del día confirmada y guardada con éxito!' }
    ]);
  };

  const handleRejectProposal = () => {
    setDraftBlocks(null);
    setPlannerMessages(prev => [
      ...prev,
      { sender: 'ai', text: 'Propuesta de agenda descartada.' }
    ]);
  };

  const { unreadTasks, markAsRead } = useUnreadComments(tasks, session);

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
    markAsRead(taskId);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
  };

  const handleRefresh = () => {
    loadData();
  };



  // Filter tasks where the selected user is primary assignee OR inside assigneeIds (shared task)
  const userTasks = useMemo(() => {
    if (!selectedUserId) return [];
    return tasks.filter(t => 
      (t.assigneeId === selectedUserId || 
      (t.assigneeIds && t.assigneeIds.includes(selectedUserId))) &&
      !t.title.startsWith('Plan de Trabajo -')
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

  const renderDailyPlannerAndAI = () => {
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const blocksToRender = draftBlocks !== null ? draftBlocks : dayPlanBlocks;
    const isDraftActive = draftBlocks !== null;

    const renderBoardCard = (block: DayPlanBlock) => {
      let styleClasses = 'bg-blue-50/40 border-blue-200 text-blue-950 hover:border-blue-300';
      if (block.type === 'meeting') {
        styleClasses = 'bg-gold-600/10 border-gold-400 text-gold-950 hover:border-gold-500';
      } else if (block.type === 'personal') {
        styleClasses = 'bg-emerald-50/45 border-emerald-250 text-emerald-950 hover:border-emerald-350';
      }

      if (isDraftActive) {
        styleClasses += ' border-dashed border-amber-400 bg-amber-50/20 shadow-inner';
      }

      return (
        <div
          key={block.id}
          onClick={() => {
            if (block.taskId) handleOpenDrawer(block.taskId);
            else { setEditingBlock({ ...block }); setIsEditingBlock(true); }
          }}
          className={`p-3 rounded-xl border flex flex-col gap-2 shadow-2xs hover:shadow-xs transition duration-205 cursor-pointer ${styleClasses}`}
        >
          <div className="flex justify-between items-start gap-2">
            <span className="text-[11px] font-black leading-snug break-words flex-1">{block.title}</span>
            <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/70 border shrink-0">
              {block.start} - {block.end}
            </span>
          </div>
          
          <div className="flex justify-between items-center mt-1 border-t border-primary-200/40 pt-1.5">
            {block.taskId ? (
              <span className="text-[7.5px] font-black uppercase text-primary-750">Ver Tarea ↗</span>
            ) : (
              <span className="text-[7.5px] font-bold text-primary-400">Manual</span>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingBlock({ ...block });
                  setIsEditingBlock(true);
                }}
                className="text-[10px] hover:text-gold-600 transition"
                title="Editar Horas"
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBlock(block.id);
                }}
                className="text-[10px] text-red-500 hover:text-red-655 transition"
                title="Eliminar"
              >
                ❌
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="bg-[#faf9f6]/30 border border-primary-200 rounded-3xl p-6 shadow-xs backdrop-blur-xs">
        {/* Timeline Planner (full width) */}
        <div className="w-full flex flex-col h-[600px] bg-white border border-primary-150 rounded-2xl shadow-sm overflow-hidden">
          {/* Header with Sub-view switcher */}
          <div className="p-4 border-b border-primary-100 flex items-center justify-between bg-primary-50/10 flex-wrap gap-3 shrink-0">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary-900">
                📅 Agenda del Día
              </h3>
              <p className="text-[10px] text-primary-400 font-bold">
                {selectedDate === new Date().toISOString().substring(0, 10) ? 'Hoy' : selectedDate}
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                data-testid="create-new-block-btn"
                onClick={() => {
                  setEditingBlock({
                    id: 'new_' + Math.random().toString(36).substring(2, 9),
                    title: '',
                    start: '09:00',
                    end: '10:00',
                    type: 'task'
                  });
                  setIsEditingBlock(true);
                }}
                className="px-2.5 py-1 text-[10px] font-black uppercase text-white bg-gold-600 hover:bg-gold-700 rounded-md transition flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <span>➕</span> Nuevo Bloque
              </button>

              {/* Change Views Selector */}
              <div className="flex bg-primary-100 p-0.5 rounded-lg border border-primary-200">
                <button
                  type="button"
                  onClick={() => setAgendaViewMode('timeline')}
                  className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition ${
                    agendaViewMode === 'timeline'
                      ? 'bg-white text-primary-950 shadow-2xs border border-primary-200/50'
                      : 'text-primary-500 hover:text-primary-850'
                  }`}
                >
                  Cronología
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaViewMode('list')}
                  className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition ${
                    agendaViewMode === 'list'
                      ? 'bg-white text-primary-950 shadow-2xs border border-primary-200/50'
                      : 'text-primary-500 hover:text-primary-850'
                  }`}
                >
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaViewMode('board')}
                  className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md transition ${
                    agendaViewMode === 'board'
                      ? 'bg-white text-primary-950 shadow-2xs border border-primary-200/50'
                      : 'text-primary-500 hover:text-primary-850'
                  }`}
                >
                  Tablero
                </button>
              </div>
              
              <span className="hidden sm:inline-block text-[10px] font-black uppercase text-gold-650 bg-gold-50 px-2 py-1 rounded-md border border-gold-150">
                {selectedUser?.name || 'Miembro'}
              </span>
            </div>
          </div>

          {/* Proposal Evaluation Banner */}
          {isDraftActive && (
            <div className="bg-amber-50 border-b border-amber-250/60 px-4 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-2xs">
              <span className="text-[10px] font-black text-amber-905 flex items-center gap-1.5 animate-pulse">
                ⚠️ Propuesta de Agenda de Hermes AI
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRejectProposal}
                  className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-850 rounded border border-amber-300 text-[9px] font-black tracking-wide transition shadow-2xs"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProposal}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9px] font-black tracking-wide transition shadow-sm"
                >
                  Aplicar Agenda
                </button>
              </div>
            </div>
          )}

          {/* Timeline Scroll Container based on View Mode */}
          <div className="flex-1 overflow-y-auto p-4">
            {agendaViewMode === 'timeline' ? (
              <div className="space-y-3">
                {hours.map((hour) => {
                  const matchingBlocks = blocksToRender.filter(b => b.start.startsWith(hour.substring(0, 3)));

                  return (
                    <div key={hour} className="flex gap-4 items-start min-h-[50px]">
                      {/* Hour indicator label */}
                      <span className="w-12 text-[10px] font-black text-primary-400 tracking-wider pt-1 shrink-0">
                        {hour}
                      </span>

                      {/* Slot content */}
                      <div className="flex-1">
                        {matchingBlocks.length > 0 ? (
                          <div className="space-y-2">
                            {matchingBlocks.map((block) => {
                              let styleClasses = 'bg-blue-50/40 border-blue-200 text-blue-950 hover:border-blue-300';
                              let typeBadge = 'Tarea';
                              if (block.type === 'meeting') {
                                styleClasses = 'bg-gold-600/10 border-gold-400 text-gold-950 hover:border-gold-500';
                                typeBadge = 'Reunión';
                              } else if (block.type === 'personal') {
                                styleClasses = 'bg-emerald-50/45 border-emerald-250 text-emerald-950 hover:border-emerald-350';
                                typeBadge = 'Personal';
                              }

                              if (isDraftActive) {
                                styleClasses += ' border-dashed border-amber-400 bg-amber-50/20 shadow-inner';
                              }

                              return (
                                <div
                                  key={block.id}
                                  onClick={() => {
                                    if (block.taskId) handleOpenDrawer(block.taskId);
                                    else { setEditingBlock({ ...block }); setIsEditingBlock(true); }
                                  }}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs group/item hover:shadow-xs transition duration-200 cursor-pointer ${styleClasses}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black truncate">{block.title}</span>
                                      {block.taskId ? (
                                        <span className="text-[7.5px] font-black uppercase px-1 py-0.5 rounded bg-white text-primary-700 border tracking-wider">
                                          Ver Tarea ↗
                                        </span>
                                      ) : (
                                        <span className="text-[7.5px] font-black uppercase px-1 py-0.5 rounded bg-white text-primary-400 border tracking-wider">
                                          {typeBadge}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-bold opacity-75 mt-0.5 block">
                                      {block.start} - {block.end}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingBlock({ ...block });
                                        setIsEditingBlock(true);
                                      }}
                                      className="w-7 h-7 bg-white hover:bg-primary-50 rounded-lg border border-primary-200 flex items-center justify-center text-xs shadow-2xs"
                                      title="Editar Horas"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteBlock(block.id);
                                      }}
                                      className="w-7 h-7 bg-white hover:bg-red-50 hover:border-red-200 rounded-lg border border-primary-200 flex items-center justify-center text-xs text-red-500 shadow-2xs"
                                      title="Eliminar"
                                    >
                                      ❌
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : showAddBlockInline === hour ? (
                          /* Inline add form */
                          <div className="bg-primary-50/40 border border-primary-200/80 rounded-xl p-3 space-y-3 shadow-2xs">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Título del bloque..."
                                value={newBlockTitle}
                                onChange={(e) => setNewBlockTitle(e.target.value)}
                                className="flex-1 px-3 py-1.5 border border-primary-200 rounded-lg text-xs font-bold text-primary-850 focus:outline-none focus:ring-1 focus:ring-gold-500/20 bg-white"
                              />
                              <select
                                value={newBlockType}
                                onChange={(e) => setNewBlockType(e.target.value as any)}
                                className="px-2.5 py-1.5 border border-primary-200 rounded-lg text-xs font-bold text-primary-800 bg-white"
                              >
                                <option value="task">Tarea</option>
                                <option value="meeting">Reunión</option>
                                <option value="personal">Personal</option>
                              </select>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-primary-400">Termina:</span>
                                <input
                                  type="text"
                                  placeholder="09:00"
                                  value={newBlockEnd}
                                  onChange={(e) => setNewBlockEnd(e.target.value)}
                                  className="w-16 px-2 py-1 border border-primary-200 rounded-lg text-xs font-bold text-primary-800 text-center bg-white"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setShowAddBlockInline(null)}
                                  className="px-2.5 py-1 border border-primary-250 rounded-lg text-[10px] font-extrabold text-primary-500 hover:bg-primary-50"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddBlock(hour)}
                                  className="px-3 py-1 bg-gold-600 text-white rounded-lg text-[10px] font-extrabold hover:bg-gold-700 transition"
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Dotted line indicator instead of empty dotted card */
                          <div
                            onClick={() => {
                              const startNum = parseInt(hour.split(':')[0]);
                              setNewBlockEnd(`${String(startNum + 1).padStart(2, '0')}:00`);
                              setNewBlockType('task');
                              setNewBlockTitle('');
                              setShowAddBlockInline(hour);
                            }}
                            className="group relative flex items-center h-8 cursor-pointer"
                          >
                            <div className="w-full border-t border-primary-100 group-hover:border-gold-300 transition-colors duration-200" />
                            <span className="absolute right-4 text-[9px] font-black text-primary-400 opacity-0 group-hover:opacity-100 bg-white px-2 transition-opacity duration-200">
                              + Agregar Bloque
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : agendaViewMode === 'list' ? (
              <div className="space-y-3">
                {blocksToRender.length > 0 ? (
                  blocksToRender.map((block) => {
                    let styleClasses = 'bg-blue-50/40 border-blue-200 text-blue-950 hover:border-blue-300';
                    let typeBadge = 'Tarea';
                    if (block.type === 'meeting') {
                      styleClasses = 'bg-gold-600/10 border-gold-400 text-gold-950 hover:border-gold-500';
                      typeBadge = 'Reunión';
                    } else if (block.type === 'personal') {
                      styleClasses = 'bg-emerald-50/45 border-emerald-250 text-emerald-950 hover:border-emerald-350';
                      typeBadge = 'Personal';
                    }

                    if (isDraftActive) {
                      styleClasses += ' border-dashed border-amber-400 bg-amber-50/20 shadow-inner';
                    }

                    return (
                      <div
                        key={block.id}
                        onClick={() => {
                          if (block.taskId) handleOpenDrawer(block.taskId);
                          else { setEditingBlock({ ...block }); setIsEditingBlock(true); }
                        }}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 shadow-2xs hover:shadow-xs transition duration-200 cursor-pointer ${styleClasses}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-[9.5px] font-black bg-white/70 px-2 py-0.5 rounded border uppercase tracking-wider">
                              {block.start} - {block.end}
                            </span>
                            <span className="text-xs font-black truncate">{block.title}</span>
                            {block.taskId && (
                              <span className="text-[7.5px] font-black uppercase px-1 py-0.5 rounded bg-white text-primary-700 border tracking-wider">
                                Ver Tarea ↗
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBlock({ ...block });
                              setIsEditingBlock(true);
                            }}
                            className="w-7 h-7 bg-white hover:bg-primary-50 rounded-lg border border-primary-200 flex items-center justify-center text-xs shadow-2xs"
                            title="Editar Horas"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBlock(block.id);
                            }}
                            className="w-7 h-7 bg-white hover:bg-red-50 hover:border-red-200 rounded-lg border border-primary-200 flex items-center justify-center text-xs text-red-500 shadow-2xs"
                            title="Eliminar"
                          >
                            ❌
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-primary-400 font-bold italic text-xs">
                    Sin bloques planificados para este día.
                  </div>
                )}
              </div>
            ) : (
              /* Board View */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                {/* Column 1: Tareas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-primary-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-primary-500 tracking-wider">📋 Tareas</span>
                    <span className="bg-primary-100 text-primary-750 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {blocksToRender.filter(b => b.type === 'task').length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {blocksToRender.filter(b => b.type === 'task').map(block => renderBoardCard(block))}
                    {blocksToRender.filter(b => b.type === 'task').length === 0 && (
                      <div className="text-[10px] text-primary-400 italic text-center py-8 border border-dashed rounded-xl">Sin tareas asignadas</div>
                    )}
                  </div>
                </div>

                {/* Column 2: Reuniones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-primary-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-gold-700 tracking-wider">📅 Reuniones</span>
                    <span className="bg-gold-55 text-gold-750 border border-gold-150 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {blocksToRender.filter(b => b.type === 'meeting').length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {blocksToRender.filter(b => b.type === 'meeting').map(block => renderBoardCard(block))}
                    {blocksToRender.filter(b => b.type === 'meeting').length === 0 && (
                      <div className="text-[10px] text-primary-400 italic text-center py-8 border border-dashed rounded-xl">Sin reuniones</div>
                    )}
                  </div>
                </div>

                {/* Column 3: Personal */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-primary-100 pb-2">
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">🌿 Personal</span>
                    <span className="bg-emerald-55 text-emerald-750 border border-emerald-150 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {blocksToRender.filter(b => b.type === 'personal').length}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {blocksToRender.filter(b => b.type === 'personal').map(block => renderBoardCard(block))}
                    {blocksToRender.filter(b => b.type === 'personal').length === 0 && (
                      <div className="text-[10px] text-primary-400 italic text-center py-8 border border-dashed rounded-xl">Sin eventos personales</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
                onClick={() => setSelectedDate(day.date)}
                className={`rounded-xl p-3 flex flex-col space-y-3 min-h-[180px] border cursor-pointer transition ${
                  day.date === selectedDate 
                    ? 'bg-gold-50/25 border-gold-500 shadow-sm ring-2 ring-gold-400' 
                    : day.isToday 
                    ? 'bg-gold-50/10 border-gold-400 shadow-sm ring-1 ring-gold-400' 
                    : 'bg-primary-50/30 border-primary-200/60 hover:border-primary-350'
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
                      blockColor = 'bg-gold-600/10 border-gold-400 text-gold-950 hover:border-gold-500 shadow-xs';
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
          {renderDailyPlannerAndAI()}
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
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} isUnread={unreadTasks[task.id]} />
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
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} isUnread={unreadTasks[task.id]} />
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
                <UserTaskCard key={task.id} task={task} currentUserId={selectedUserId} people={people} onSelect={handleOpenDrawer} isUnread={unreadTasks[task.id]} />
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
        currentUser={session}
      />
      {isEditingBlock && editingBlock && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white border border-primary-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-primary-900 uppercase tracking-wider">
              {editingBlock.id?.startsWith('new_') ? 'Crear Nuevo Bloque' : 'Editar Bloque Horario'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-primary-400">Título</label>
                <input
                  type="text"
                  placeholder="Título del bloque..."
                  value={editingBlock.title}
                  onChange={(e) => setEditingBlock({ ...editingBlock, title: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-primary-200 rounded-xl text-xs font-bold text-primary-800 bg-[#faf9f6] focus:ring-2 focus:ring-gold-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-primary-400">Hora Inicio</label>
                  <input
                    type="text"
                    placeholder="08:00"
                    value={editingBlock.start}
                    onChange={(e) => setEditingBlock({ ...editingBlock, start: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-primary-200 rounded-xl text-xs font-bold text-primary-800 bg-[#faf9f6] focus:ring-2 focus:ring-gold-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-primary-400">Hora Fin</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    value={editingBlock.end}
                    onChange={(e) => setEditingBlock({ ...editingBlock, end: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-primary-200 rounded-xl text-xs font-bold text-primary-800 bg-[#faf9f6] focus:ring-2 focus:ring-gold-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-primary-400">Categoría</label>
                <select
                  value={editingBlock.type}
                  onChange={(e) => setEditingBlock({ ...editingBlock, type: e.target.value as any })}
                  className="w-full mt-1 px-3 py-2 border border-primary-200 rounded-xl text-xs font-bold text-primary-800 bg-[#faf9f6] focus:ring-2 focus:ring-gold-500/20"
                >
                  <option value="task">Tarea</option>
                  <option value="meeting">Reunión</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsEditingBlock(false); setEditingBlock(null); }}
                className="px-3 py-1.5 border border-primary-200 rounded-xl text-xs font-extrabold text-primary-500 hover:bg-primary-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingBlock.title.trim()) {
                    alert('El título es requerido');
                    return;
                  }
                  handleUpdateBlock(editingBlock);
                }}
                className="px-4 py-1.5 bg-gold-600 text-white rounded-xl text-xs font-extrabold hover:bg-gold-700 transition"
              >
                {editingBlock.id?.startsWith('new_') ? 'Crear Bloque' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  isUnread?: boolean;
}

function UserTaskCard({ task, currentUserId, people, onSelect, isUnread }: UserTaskCardProps) {
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
      className="bg-white border border-primary-200 rounded-2xl p-5 hover:border-gold-300 hover:shadow-lg hover:shadow-gold-600/5 transition-all duration-300 cursor-pointer space-y-3.5 relative"
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
        <div className="flex items-start justify-between gap-1.5">
          <h4 className="text-sm font-black text-primary-850 leading-snug hover:text-gold-600 transition-colors">
            {task.title}
          </h4>
          {isUnread && (
            <span 
              className="w-2 h-2 rounded-full bg-amber-500 animate-pulse border border-amber-600 shrink-0 mt-1" 
              title="Nuevos avances sin leer"
            />
          )}
        </div>
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
              className="bg-gold-600 h-full rounded-full transition-all"
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
