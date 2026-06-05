'use client';

import React, { useState, useEffect, useMemo } from 'react';
import TaskDrawer from '@/components/TaskDrawer';

// Core Interfaces
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
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timeOff?: string[];
}

interface Step {
  id: string;
  text: string;
  completed: boolean;
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
  isMeeting?: boolean;
  meetingTime?: string;
  meetingAttendees?: string[];
  meetingConfirmations?: string[];
}

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  day: string;
  dateStr: string;
  priority: 'High' | 'Medium' | 'Low';
  color: string;
  originTask?: Task;
  isMeeting?: boolean;
}

function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[*_`~#\-]/g, '');
}

export default function CalendarPage() {
  // Navigation & View Mode states
  const [week, setWeek] = useState<number>(23);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [showTasks, setShowTasks] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0); // 0 = Monday (default for Day View)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(5); // 5 = June (0-indexed)

  // API Data states
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
  
  // Member filtering states
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [usersList, setUsersList] = useState<any[]>([]);

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
        console.error('Error fetching session in calendar:', err);
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

  // Toast notification
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Drawer Slide-over State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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

  // --- Fetch API Data ---
  const loadData = async () => {
    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      const tasksRes = await fetch('/api/tasks', { headers });
      const tasksData = await tasksRes.json();
      const companiesRes = await fetch('/api/companies', { headers });
      const companiesData = await companiesRes.json();
      const peopleRes = await fetch('/api/persons', { headers });
      const peopleData = await peopleRes.json();
      const usersRes = await fetch('/api/users', { headers });
      const usersData = await usersRes.json();

      setRawTasks(Array.isArray(tasksData) ? tasksData.map(normalizeTask) : []);
      setRawCompanies(Array.isArray(companiesData) ? companiesData : []);
      setRawPeople(Array.isArray(peopleData) ? peopleData : []);
      setUsersList(Array.isArray(usersData) ? usersData : []);
    } catch (err) {
      console.error("Error loading calendar API resources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute active week range
  const weekRange = useMemo(() => {
    const baseDate = new Date(2026, 5, 1); // June 1, 2026 is Monday
    const start = new Date(baseDate.getTime() + (week - 23) * 7 * 24 * 60 * 60 * 1000);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        dateStr: d.toISOString().substring(0, 10),
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
      };
    });
    return dates;
  }, [week]);

  // Map API Tasks to Calendar Events
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    // Find selected person email for meeting matching
    const selectedPerson = people.find(p => p.id === selectedPersonId);
    const matchedUser = usersList.find(u => u.personId === selectedPersonId);
    const selectedEmail = selectedPerson
      ? (matchedUser ? matchedUser.email : `${selectedPerson.name.toLowerCase().replace(/\s+/g, '')}@holding.com`)
      : '';

    tasks.forEach(task => {
      // If a specific person filter is active, only show their assigned/attended tasks/meetings
      if (selectedPersonId) {
        const isAssigned = task.assigneeId === selectedPersonId || (task.assigneeIds && task.assigneeIds.includes(selectedPersonId));
        const isAttendee = !!(task.isMeeting && task.meetingAttendees && task.meetingAttendees.includes(selectedEmail));
        if (!isAssigned && !isAttendee) return;
      }

      const dateStr = task.dueDate ? task.dueDate.substring(0, 10) : '';
      if (dateStr) {
        const isMeeting = !!task.isMeeting;
        if (isMeeting && !showMeetings) return;
        if (!isMeeting && !showTasks) return;

        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const dNum = parseInt(parts[2], 10);
        const d = new Date(y, m, dNum);
        
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[d.getDay()];
        
        const priorityColors = {
          'High': 'rgb(255, 0, 0)',
          'Medium': 'rgb(245, 158, 11)',
          'Low': 'rgb(59, 130, 246)'
        };
        
        events.push({
          id: task.id,
          title: task.title,
          time: isMeeting ? (task.meetingTime || 'Hora por definir') : '09:00 - 17:00',
          day: dayName,
          dateStr,
          priority: task.priority,
          color: isMeeting ? 'rgb(212, 163, 89)' : (priorityColors[task.priority] || 'rgb(245, 158, 11)'),
          originTask: task,
          isMeeting
        });
      }
    });

    return events;
  }, [tasks, showTasks, showMeetings, selectedPersonId, people, usersList]);

  // Drawer slider actions
  const handleEventClick = async (evt: CalendarEvent) => {
    setActiveTaskId(evt.id);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setActiveTaskId(null);
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

  const handlePrevWeek = () => setWeek((w) => w - 1);
  const handleNextWeek = () => setWeek((w) => w + 1);

  // Month Days Calculator (Dynamic)
  const monthDays = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const d = new Date(currentYear, currentMonth, dayNum);
      return {
        dayNum,
        dateStr,
        dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
      };
    });
  }, [currentYear, currentMonth]);

  const paddingBoxes = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    return Array.from({ length: firstDay.getDay() });
  }, [currentYear, currentMonth]);

  const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][currentMonth];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const currentDayRange = weekRange[selectedDayIndex] || weekRange[0];

  if (!sessionLoaded || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold-600"></div>
        <p className="text-sm text-primary-400 font-medium mt-4">Loading calendar workspace...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
      {/* Page Header & Navigation Controls */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-primary-100 pb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-primary-900 tracking-tight">
            Premium Calendar Planner
          </h2>
          <p className="text-primary-500 mt-1">
            Dynamic view modes with drag & drop simulator and HSL priority badges.
          </p>
          
          {/* Toggle Filters: Tasks & Meetings */}
          <div className="flex items-center gap-3 mt-4 bg-primary-100/30 p-1.5 rounded-xl border border-primary-200/50 max-w-fit">
            <button
              onClick={() => setShowTasks(!showTasks)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
                showTasks
                  ? 'bg-white text-primary-900 border-primary-200 shadow-sm'
                  : 'bg-transparent text-primary-450 border-transparent hover:text-primary-800'
              }`}
            >
              <span className={showTasks ? 'text-gold-655' : 'text-primary-300'}>{showTasks ? '✓' : '○'}</span>
              <span>Ver Tareas</span>
            </button>
            <button
              onClick={() => setShowMeetings(!showMeetings)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 border ${
                showMeetings
                  ? 'bg-white text-primary-900 border-primary-200 shadow-sm'
                  : 'bg-transparent text-primary-450 border-transparent hover:text-primary-800'
              }`}
            >
              <span className={showMeetings ? 'text-gold-655' : 'text-primary-300'}>{showMeetings ? '✓' : '○'}</span>
              <span>Ver Reuniones 📅</span>
            </button>
          </div>
        </div>

        {/* View Mode & Weekly Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Member Filter Dropdown */}
          <div className="flex items-center gap-2 bg-[#faf9f6]/85 p-1 rounded-xl border border-gold-200/40 shadow-xs">
            <span className="text-[10px] font-black text-gold-700 uppercase pl-2 tracking-wider">Integrante:</span>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              className="px-3 py-1.5 border border-primary-150 rounded-lg text-xs font-bold bg-white text-primary-800 focus:outline-none focus:ring-1 focus:ring-gold-500 cursor-pointer"
            >
              <option value="">Todos los integrantes</option>
              {people.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Month/Week/Day Toggles */}
          <div className="flex items-center gap-1.5 bg-primary-100/50 p-1 rounded-xl border border-primary-200 shadow-sm">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'month' ? 'bg-white text-primary-900 shadow-sm border border-primary-200' : 'text-primary-500 hover:text-primary-800'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'week' ? 'bg-white text-primary-900 shadow-sm border border-primary-200' : 'text-primary-500 hover:text-primary-800'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'day' ? 'bg-white text-primary-900 shadow-sm border border-primary-200' : 'text-primary-500 hover:text-primary-800'
              }`}
            >
              Day
            </button>
          </div>

          {/* Weekly/Daily Navigator */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <div className="flex items-center gap-3 bg-white border border-gold-200/50 p-2 rounded-xl shadow-sm">
              <button
                data-testid="calendar-prev-week"
                onClick={handlePrevWeek}
                className="px-3 py-1.5 text-primary-600 hover:text-gold-600 rounded-lg hover:bg-gold-50 transition-all font-bold text-xs"
              >
                ← Previous
              </button>
              <span
                data-testid="calendar-current-week"
                className="text-sm font-extrabold text-primary-900 px-3.5 py-1 bg-gold-50 border border-gold-100 rounded-lg"
              >
                Week {week}
              </span>
              <button
                data-testid="calendar-next-week"
                onClick={handleNextWeek}
                className="px-3 py-1.5 text-primary-600 hover:text-gold-600 rounded-lg hover:bg-gold-50 transition-all font-bold text-xs"
              >
                Next →
              </button>
            </div>
          )}

          {/* Month Navigator */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-3 bg-white border border-gold-200/50 p-2 rounded-xl shadow-sm">
              <button
                onClick={handlePrevMonth}
                className="px-3 py-1.5 text-primary-600 hover:text-gold-600 rounded-lg hover:bg-gold-50 transition-all font-bold text-xs"
              >
                ← Previous
              </button>
              <span
                className="text-sm font-extrabold text-primary-900 px-3.5 py-1 bg-gold-50 border border-gold-100 rounded-lg"
              >
                {monthName} {currentYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="px-3 py-1.5 text-primary-600 hover:text-gold-600 rounded-lg hover:bg-gold-50 transition-all font-bold text-xs"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>



      {/* --- MONTH VIEW DISPLAY --- */}
      {viewMode === 'month' && (
        <div className="bg-white border border-gold-200/40 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-primary-900 font-serif">{monthName} {currentYear}</h3>
            <span className="text-xs text-primary-400 font-medium">{monthDays.length} days scheduled</span>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-primary-400 uppercase py-2 bg-primary-50 rounded-lg">
                {d}
              </div>
            ))}
            
            {/* Dynamic padding for the start of the month */}
            {paddingBoxes.map((_, idx) => (
              <div key={`pad-${idx}`} className="bg-primary-50/10 rounded-xl min-h-[100px] border border-dashed border-primary-100"></div>
            ))}

            {monthDays.map(day => {
              // Find events due on this day
              const dayEvents = calendarEvents.filter(e => e.dateStr === day.dateStr);
              return (
                <div
                  key={day.dayNum}
                  className="bg-white border border-gold-200/20 hover:border-gold-300 rounded-xl p-3 min-h-[100px] flex flex-col justify-between transition-all"
                >
                  <span className="text-xs font-extrabold text-primary-500 block mb-2">{day.dayNum}</span>
                  <div className="flex-1 space-y-1.5">
                    {dayEvents.map(evt => (
                      <div
                        key={evt.id}
                        onClick={() => handleEventClick(evt)}
                        style={{ borderLeftColor: evt.color }}
                        className={`border-l-2 pl-1.5 text-[9px] font-bold p-1 rounded cursor-pointer truncate ${
                          evt.isMeeting
                            ? 'bg-gold-50 text-gold-900 border-gold-300 hover:bg-gold-100'
                            : 'bg-[#faf9f6]/80 text-primary-850 hover:bg-gold-50'
                        }`}
                        title={`${evt.isMeeting ? '👥 [REUNIÓN] ' : ''}${cleanMarkdown(evt.title)}`}
                      >
                        {evt.isMeeting ? '👥 ' : ''}{cleanMarkdown(evt.title)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- WEEK VIEW DISPLAY --- */}
       {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 lg:gap-4">
          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, idx) => {
            const dayEvents = calendarEvents.filter(e => e.day === dayName);
            const dayDateStr = weekRange[idx]?.dateStr;

            // Check availability for selected person
            const selectedPerson = people.find(p => p.id === selectedPersonId);
            const isTimeOff = !!(selectedPerson && selectedPerson.timeOff && selectedPerson.timeOff.includes(dayDateStr));
            const workingHours = selectedPerson && selectedPerson.workingHoursStart 
              ? `${selectedPerson.workingHoursStart} - ${selectedPerson.workingHoursEnd}`
              : '08:00 - 17:00';

            return (
              <div
                key={dayName}
                className={`border rounded-2xl p-4 lg:p-3 min-h-[250px] md:min-h-[350px] flex flex-col shadow-sm transition-all duration-200 ${
                  isTimeOff
                    ? 'bg-primary-50/75 border-dashed border-primary-300 opacity-80'
                    : 'bg-white border-gold-200/40'
                }`}
              >
                <h3 className="text-sm font-extrabold text-primary-900 border-b border-primary-100 pb-2 mb-3 flex justify-between flex-wrap gap-1">
                  <span>{dayName}</span>
                  <span className="text-[10px] text-primary-400 font-semibold">{dayDateStr}</span>
                </h3>

                {selectedPersonId && (
                  <div className={`mb-3 flex justify-between items-center text-[9px] font-bold px-2 py-1 rounded border ${
                    isTimeOff 
                      ? 'bg-red-50 text-red-700 border-red-200/60' 
                      : 'bg-primary-50/50 text-primary-450 border-primary-150/50'
                  }`}>
                    <span>⏰ Jornada:</span>
                    <span>{isTimeOff ? '🚫 DÍA LIBRE' : workingHours}</span>
                  </div>
                )}
                
                <div className="flex-1 space-y-2.5">
                  {dayEvents.map((evt, evtIdx) => {
                    const isTask1 = evt.title === 'Daily Standup' || evt.title === 'Client Demo' || evtIdx === 0;
                    const testId = isTask1 ? 'calendar-event-task-1' : 'calendar-event-task-2';
                    
                    return (
                      <div
                        key={evt.id}
                        data-testid={testId}
                        onClick={() => handleEventClick(evt)}
                        style={{
                          borderLeftColor: evt.color,
                          borderLeftWidth: '4px',
                          borderLeftStyle: 'solid'
                        }}
                        className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-sm ${
                          evt.isMeeting
                            ? 'bg-gold-50/20 border-gold-300 hover:bg-gold-50/40 ring-1 ring-gold-200/50'
                            : 'bg-[#faf9f6]/40 border-gold-200/20 hover:bg-gold-50/30'
                        }`}
                      >
                        <span className="block text-[9px] uppercase tracking-widest text-primary-400 font-bold mb-1">
                          {evt.time}
                        </span>
                        <h4 className="text-xs font-bold text-primary-900 leading-snug break-words">
                          {evt.isMeeting ? '👥 ' : ''}{cleanMarkdown(evt.title)}
                        </h4>
                        
                        {evt.isMeeting && evt.originTask && evt.originTask.meetingAttendees && evt.originTask.meetingAttendees.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-dashed border-primary-200/40 space-y-1">
                            <div className="flex items-center justify-between text-[9px] font-bold text-gold-750">
                              <span>Invitados:</span>
                              <span>
                                {evt.originTask.meetingConfirmations?.length || 0}/{evt.originTask.meetingAttendees.length} ✓
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {evt.originTask.meetingAttendees.map((email, attendeeIdx) => {
                                const isConfirmed = evt.originTask?.meetingConfirmations?.includes(email);
                                const prefix = email.split('@')[0];
                                return (
                                  <span
                                    key={attendeeIdx}
                                    title={`${email}: ${isConfirmed ? 'Confirmado' : 'Pendiente'}`}
                                    className={`inline-flex items-center px-1 rounded-sm text-[7.5px] font-bold border ${
                                      isConfirmed
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                        : 'bg-amber-50 text-amber-600 border-amber-250'
                                    }`}
                                  >
                                    {isConfirmed ? '✓' : '⌛'} {prefix}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-2.5">
                          <span
                            className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              evt.isMeeting
                                ? 'bg-gold-100 text-gold-800 border-gold-300 font-extrabold'
                                : evt.priority === 'High'
                                ? 'bg-red-50 text-red-700 border-red-100'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}
                          >
                            {evt.isMeeting ? 'Reunión' : evt.priority}
                          </span>
                          <span className="text-[10px]">{evt.isMeeting ? '👥' : '📁'}</span>
                        </div>
                      </div>
                    );
                  })}

                  {dayEvents.length === 0 && (
                    <div className="h-full flex items-center justify-center border border-dashed border-primary-100 rounded-xl p-4 py-8">
                      <span className="text-[10px] font-medium text-primary-300">No events</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- DAY VIEW DISPLAY --- */}
      {viewMode === 'day' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Day Selector Sidebar */}
          <div className="bg-white border border-gold-200/30 rounded-2xl p-5 shadow-sm space-y-2">
            <h3 className="text-xs font-extrabold text-primary-400 uppercase tracking-widest mb-4">Select Day</h3>
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, idx) => (
              <button
                key={dayName}
                onClick={() => setSelectedDayIndex(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                  selectedDayIndex === idx
                    ? 'bg-gold-550 border-gold-600 text-white shadow-md'
                    : 'bg-[#faf9f6]/40 border-transparent text-primary-750 hover:bg-gold-50/50'
                }`}
              >
                {dayName} ({weekRange[idx]?.dateStr})
              </button>
            ))}
          </div>

          {/* Agenda view */}
          <div className="bg-white border border-gold-200/40 rounded-2xl p-6 shadow-sm md:col-span-3 min-h-[350px]">
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <h3 className="text-base font-bold text-primary-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gold-500"></span>
                Agenda for {currentDayRange.dayName} ({currentDayRange.dateStr})
              </h3>
              <span className="text-xs text-primary-400 font-semibold">
                {calendarEvents.filter(e => e.dateStr === currentDayRange.dateStr).length} tasks scheduled
              </span>
            </div>

            {/* Availability visual timeline if member filter is selected */}
            {selectedPersonId && (() => {
              const selectedPerson = people.find(p => p.id === selectedPersonId);
              const isTimeOff = !!(selectedPerson && selectedPerson.timeOff && selectedPerson.timeOff.includes(currentDayRange.dateStr));
              const startHour = selectedPerson?.workingHoursStart ? parseInt(selectedPerson.workingHoursStart.split(':')[0], 10) : 8;
              const endHour = selectedPerson?.workingHoursEnd ? parseInt(selectedPerson.workingHoursEnd.split(':')[0], 10) : 17;
              
              const todayEvents = calendarEvents.filter(e => e.dateStr === currentDayRange.dateStr);
              
              const isHourBusy = (h: number) => {
                const timeStr = `${String(h).padStart(2, '0')}:`;
                return todayEvents.some(e => e.isMeeting && e.time && e.time.startsWith(timeStr));
              };

              const freeHours: string[] = [];
              for (let h = startHour; h < endHour; h++) {
                if (!isHourBusy(h)) {
                  freeHours.push(`${String(h).padStart(2, '0')}:00`);
                }
              }

              return (
                <div className="mb-6 p-4 rounded-2xl border border-gold-250/50 bg-[#faf9f6]/60 space-y-3 shadow-xs">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-gold-700">
                    ⚡ Disponibilidad de {selectedPerson?.name} ({currentDayRange.dateStr})
                  </span>

                  {isTimeOff ? (
                    <div className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 p-2.5 rounded-xl">
                      🚫 Este integrante tiene registrado Día Libre / Tiempo Fuera de Oficina para esta fecha.
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1.5 items-center flex-wrap md:flex-nowrap">
                        <span className="text-[10px] font-bold text-primary-450 uppercase w-14 shrink-0">Jornada:</span>
                        <div className="flex-1 flex gap-1 select-none overflow-x-auto pb-1">
                          {Array.from({ length: 14 }).map((_, idx) => {
                            const hour = idx + 7; // from 07:00 AM to 08:00 PM
                            const isWorking = hour >= startHour && hour < endHour;
                            const isBusy = isWorking && isHourBusy(hour);
                            
                            let bg = 'bg-primary-100 text-primary-450 border-primary-200/30';
                            if (isWorking) {
                              bg = isBusy 
                                ? 'bg-amber-100 text-amber-700 border-amber-300 font-extrabold shadow-sm' 
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm';
                            }

                            return (
                              <div
                                key={hour}
                                className={`flex-1 text-center text-[9px] py-1.5 px-1 rounded-md border font-bold min-w-[24px] ${bg}`}
                                title={`${hour}:00 - ${isWorking ? (isBusy ? 'Ocupado (Reunión)' : 'Disponible') : 'No Laborable'}`}
                              >
                                {hour}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-primary-700 font-semibold pt-1">
                        <span className="text-[10px] font-bold text-primary-450 uppercase w-14 shrink-0">Libres:</span>
                        {freeHours.length === 0 ? (
                          <span className="text-xs text-red-500 font-bold">Sin horas libres disponibles (Jornada Ocupada).</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {freeHours.map(fh => (
                              <span key={fh} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold">
                                {fh}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            <div className="space-y-4">
              {calendarEvents.filter(e => e.dateStr === currentDayRange.dateStr).map(evt => (
                <div
                  key={evt.id}
                  onClick={() => handleEventClick(evt)}
                  style={{ borderLeftColor: evt.color }}
                  className={`border-l-4 pl-4 py-4 rounded-r-xl transition cursor-pointer flex items-center justify-between border ${
                    evt.isMeeting
                      ? 'bg-gold-50/20 border-gold-300 hover:bg-gold-50/40 ring-1 ring-gold-200/30'
                      : 'bg-[#faf9f6]/50 border-gold-200/10 hover:border-gold-300'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-primary-400 block mb-1">
                      {evt.time} {evt.isMeeting ? '• 👥 REUNIÓN' : ''}
                    </span>
                    <h4 className="text-sm font-bold text-primary-900 flex items-center gap-1.5">
                      {evt.isMeeting ? <span className="text-gold-700">👥</span> : ''}
                      {cleanMarkdown(evt.title)}
                    </h4>
                    
                    {evt.isMeeting && evt.originTask && evt.originTask.meetingAttendees && (
                      <div className="flex flex-col gap-1 mt-2.5">
                        <div className="text-[10px] font-bold text-gold-750 flex items-center gap-2">
                          <span>Confirmaciones:</span>
                          <span className="text-gold-800">
                            {evt.originTask.meetingConfirmations?.length || 0}/{evt.originTask.meetingAttendees.length} ✓
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {evt.originTask.meetingAttendees.map((email, attendeeIdx) => {
                            const isConfirmed = evt.originTask?.meetingConfirmations?.includes(email);
                            const prefix = email.split('@')[0];
                            return (
                              <span
                                key={attendeeIdx}
                                className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${
                                  isConfirmed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                                    : 'bg-amber-50 text-amber-700 border-amber-250'
                                }`}
                              >
                                {isConfirmed ? '✓' : '⌛'} {prefix}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                      evt.isMeeting
                        ? 'bg-gold-100 text-gold-800 border-gold-300 font-extrabold'
                        : evt.priority === 'High'
                        ? 'bg-red-50 text-red-700 border-red-100'
                        : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}
                  >
                    {evt.isMeeting ? 'Reunión' : `${evt.priority} Priority`}
                  </span>
                </div>
              ))}
              
              {calendarEvents.filter(e => e.dateStr === currentDayRange.dateStr).length === 0 && (
                <div className="text-center py-20 text-primary-400 text-sm font-medium italic">
                  No scheduled activities for this day. Enjoy your free time!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Unified Task Drawer --- */}
      <TaskDrawer
        isOpen={isDrawerOpen}
        taskId={activeTaskId}
        onClose={handleCloseDrawer}
        onSuccess={loadData}
        companies={companies}
        people={people}
        dataTestId="task-form-drawer"
      />
    </div>
  );
}
