"use client";

import React, { useState, useEffect, useRef } from 'react';
import HslAvatar from './HslAvatar';

export interface Company {
  id: string;
  name: string;
}

export interface Person {
  id: string;
  name: string;
  role: string;
  avatar: string;
  companyId?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  timeOff?: string[];
  recurringDaysOff?: number[];
  lunchStart?: string;
  lunchEnd?: string;
}

export interface Step {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  status?: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  assigneeId?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  filepath: string;
  uploadedAt: string;
}

export interface Comment {
  id: string;
  timestamp: string;
  user: string;
  personId: string;
  avatar?: string;
  text: string;
}

export interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  type: 'User' | 'AI';
}

export interface Task {
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
  meetingLink?: string;
  comments?: Comment[];
  completedDays?: string[];
}

interface TaskDrawerProps {
  isOpen: boolean;
  taskId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  companies: Company[];
  people: Person[];
  dataTestId?: string;
  preloadedAiData?: any;
  currentUser?: any;
}

export default function TaskDrawer({
  isOpen,
  taskId,
  onClose,
  onSuccess,
  companies,
  people,
  dataTestId,
  preloadedAiData,
  currentUser: currentUserProp,
}: TaskDrawerProps) {
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('unassigned');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [status, setStatus] = useState<'Pending' | 'In Progress' | 'Completed' | 'Blocked'>('Pending');
  const [priority, setPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [type, setType] = useState<'One-shot' | 'Repetitive' | 'Project'>('One-shot');
  const [repeatPattern, setRepeatPattern] = useState<'Daily' | 'Weekly' | 'Monthly' | ''>('');
  const [companyId, setCompanyId] = useState('comp-1');
  const [dueDate, setDueDate] = useState('');

  // UI States
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [newStepText, setNewStepText] = useState('');
  const [drawerTab, setDrawerTab] = useState<'view' | 'edit' | 'steps' | 'meeting' | 'attachments' | 'activity'>('view');
  const [newCommentText, setNewCommentText] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasUnreadDrawer, setHasUnreadDrawer] = useState(false);

  useEffect(() => {
    if (currentUserProp) {
      setCurrentUser(currentUserProp);
    }
  }, [currentUserProp]);

  useEffect(() => {
    if (!isOpen || !taskId || comments.length === 0) {
      setHasUnreadDrawer(false);
      return;
    }
    
    const latestComment = comments.reduce((latest, c) => {
      return !latest || new Date(c.timestamp) > new Date(latest.timestamp) ? c : latest;
    }, comments[0]);
    
    if (!latestComment) {
      setHasUnreadDrawer(false);
      return;
    }
    
    const isLatestByMe = 
      (currentUser && (latestComment.personId === currentUser.personId || latestComment.user === currentUser.name)) ||
      latestComment.user === 'Tú' || 
      latestComment.user === 'Usuario';
      
    if (isLatestByMe) {
      setHasUnreadDrawer(false);
      return;
    }
    
    if (drawerTab === 'view') {
      localStorage.setItem(`hermes_task_viewed_${taskId}`, new Date().toISOString());
      window.dispatchEvent(new Event('unread-update'));
      setHasUnreadDrawer(false);
    } else {
      const lastViewed = localStorage.getItem(`hermes_task_viewed_${taskId}`);
      if (!lastViewed) {
        setHasUnreadDrawer(true);
      } else {
        setHasUnreadDrawer(new Date(latestComment.timestamp) > new Date(lastViewed));
      }
    }
  }, [isOpen, taskId, comments, drawerTab, currentUser]);

  // AI & Sharing States
  const [isDictating, setIsDictating] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const [meetingTime, setMeetingTime] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [meetingConfirmations, setMeetingConfirmations] = useState<string[]>([]);
  const [meetingLink, setMeetingLink] = useState('');
  const [activeTab, setActiveTab] = useState<'meeting' | 'task'>('meeting');
  const [isMeeting, setIsMeeting] = useState(false);
  const [selectedAttachmentNames, setSelectedAttachmentNames] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [sendingMeeting, setSendingMeeting] = useState(false);

  // Email Sharing States
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSelectedAttachments, setEmailSelectedAttachments] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);

  // SMTP Settings check states
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');

  // Dictation speech setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'es-ES';
        rec.onstart = () => setIsDictating(true);
        rec.onend = () => setIsDictating(false);
        rec.onerror = () => setIsDictating(false);
        rec.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setDescription(prev => (prev ? prev + '\n' + transcript.trim() : transcript.trim()));
          }
        };
        setRecognition(rec);
      }
    }
  }, []);

  const handleToggleDictation = () => {
    if (!recognition) {
      alert('Speech Recognition is not supported or active in this browser.');
      return;
    }
    if (isDictating) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleAIRefineInDrawer = async () => {
    if (!description.trim() && !selectedImage && !title.trim()) {
      alert('Por favor escribe título, descripción o carga una imagen.');
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
          text: description || title,
          image: selectedImage
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.result) {
          setTitle(data.result.title || title);
          setDescription(data.result.description || description);
          setPriority(data.result.priority || priority);
          setType(data.result.type || type);
          if (data.result.steps && data.result.steps.length > 0) {
            setSteps(data.result.steps.map((s: string) => ({ id: `step-${Date.now()}-${Math.random()}`, text: s, completed: false, status: 'Pending' })));
          }
          setToastMessage('Tarea perfeccionada por la IA!');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
        }
      } else {
        alert('Error al procesar con IA.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al conectar con IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUploadInDrawer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShareTelegram = () => {
    const pName = people.find(p => p.id === assigneeId)?.name || 'Sin asignar';
    const text = encodeURIComponent(`📢 Tarea: ${title}\n👤 Responsable: ${pName}\n📅 Límite: ${dueDate}\n📌 Estado: ${status}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${text}`, '_blank');
    setShareMenuOpen(false);
  };

  const handleShareWhatsApp = () => {
    const pName = people.find(p => p.id === assigneeId)?.name || 'Sin asignar';
    const text = encodeURIComponent(`📢 Tarea: ${title}\n👤 Responsable: ${pName}\n📅 Límite: ${dueDate}\n📌 Estado: ${status}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    setShareMenuOpen(false);
  };

  const handleShareEmail = () => {
    const p = people.find(person => person.id === assigneeId);
    const matchedUser = users.find(u => u.personId === p?.id);
    const defaultEmail = matchedUser ? matchedUser.email : (p ? `${p.name.toLowerCase().replace(/\s+/g, '')}@holding.com` : '');

    setEmailTo(defaultEmail);
    setEmailSubject(`[Holding] Compartir Tarea: ${title}`);
    
    const stepsText = steps.map((s) => `- [${s.completed ? 'x' : ' '}] ${s.text}`).join('\n');
    const defaultBody = `Hola,

Te comparto los detalles de la siguiente tarea del Hermes Task Hub:

📌 Tarea: ${title}
👤 Responsable: ${p ? p.name : 'Sin asignar'}
📅 Fecha límite: ${dueDate}
🚩 Prioridad: ${priority}
📊 Estado: ${status}

📝 Descripción:
${description || 'Sin descripción'}

${stepsText ? `\n✅ Pasos / Subtareas:\n${stepsText}` : ''}

Atentamente,
Hermes Task Hub`;

    setEmailBody(defaultBody);
    setEmailSelectedAttachments(attachments.map(att => att.filename));
    setEmailModalOpen(true);
    setShareMenuOpen(false);
  };

  const handleSubmitShareEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailTo.trim()) {
      alert('Por favor ingresa un correo de destino.');
      return;
    }
    if (!emailSubject.trim()) {
      alert('Por favor ingresa un asunto.');
      return;
    }
    if (!emailBody.trim()) {
      alert('Por favor ingresa el cuerpo del correo.');
      return;
    }

    setSendingEmail(true);
    setToastMessage('Enviando correo por SMTP...');
    setShowToast(true);

    try {
      const res = await fetch('/api/tasks/share-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({
          taskId,
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          selectedAttachments: emailSelectedAttachments
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sentReal) {
          setToastMessage(`¡Correo enviado con SMTP con éxito!`);
        } else {
          setToastMessage('¡Correo simulado guardado con éxito!');
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setEmailModalOpen(false);

        // Refresh task to get new activity log
        onSuccess();
        const headers = { 'x-api-key': 'mock-api-key-12345' };
        const refreshRes = await fetch(`/api/tasks/${taskId}`, { headers });
        if (refreshRes.ok) {
          const rawTaskData = await refreshRes.json();
          const taskData = normalizeTask(rawTaskData);
          setActivityLog(taskData.activityLog || []);
        }
      } else {
        const errorData = await res.json();
        alert(`Error al enviar correo: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al enviar el correo.');
    } finally {
      setSendingEmail(false);
    }
  };

  // Fetch users, SMTP settings and all tasks for conflict checking
  useEffect(() => {
    async function fetchUsersAndSmtp() {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }

        const tasksRes = await fetch('/api/tasks', { headers: { 'x-api-key': 'mock-api-key-12345' } });
        if (tasksRes.ok) {
          const tasksData = await tasksRes.json();
          setAllTasks(Array.isArray(tasksData) ? tasksData : []);
        }

        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (settingsData.smtpConfig && settingsData.smtpConfig.host && settingsData.smtpConfig.port) {
            setIsSmtpConfigured(true);
            setSmtpHost(settingsData.smtpConfig.host);
          } else {
            setIsSmtpConfigured(false);
            setSmtpHost('');
          }
        }

        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated) {
            setCurrentUser(meData.user);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (isOpen) {
      fetchUsersAndSmtp();
    }
  }, [isOpen]);

  const checkAttendeeConflicts = (): string[] => {
    const conflicts: string[] = [];
    if (!dueDate) return conflicts;

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    selectedAttendees.forEach(email => {
      // Find the Person object for this email
      const person = people.find(p => {
        const matchedUser = users.find(u => u.personId === p.id);
        const pEmail = matchedUser ? matchedUser.email : `${p.name.toLowerCase().replace(/\s+/g, '')}@holding.com`;
        return pEmail === email;
      });

      if (!person) return;

      const cleanDate = dueDate.substring(0, 10);
      
      // 1. Time off conflict (specific date)
      if (person.timeOff && person.timeOff.includes(cleanDate)) {
        conflicts.push(`${person.name} tiene registrado día libre / vacaciones el ${cleanDate}.`);
      }

      // 1b. Recurring weekly day off conflict
      const localDateObj = new Date(cleanDate + 'T12:00:00');
      const dayOfWeek = localDateObj.getDay();
      if (person.recurringDaysOff && person.recurringDaysOff.includes(dayOfWeek)) {
        conflicts.push(`${person.name} tiene el día ${dayNames[dayOfWeek]} libre recurrentemente.`);
      }

      // 2. Working hours & Lunch conflicts
      if (meetingTime) {
        const mHour = parseInt(meetingTime.split(':')[0], 10);
        const mMin = parseInt(meetingTime.split(':')[1], 10);
        const startH = person.workingHoursStart ? parseInt(person.workingHoursStart.split(':')[0], 10) : 8;
        const startM = person.workingHoursStart ? parseInt(person.workingHoursStart.split(':')[1], 10) : 0;
        const endH = person.workingHoursEnd ? parseInt(person.workingHoursEnd.split(':')[0], 10) : 17;
        const endM = person.workingHoursEnd ? parseInt(person.workingHoursEnd.split(':')[1], 10) : 0;

        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        const mTotal = mHour * 60 + mMin;

        // Working hours validation
        if (mTotal < startTotal || mTotal >= endTotal) {
          conflicts.push(`${person.name} está fuera de su jornada laboral (${person.workingHoursStart || '08:00'} - ${person.workingHoursEnd || '17:00'}).`);
        }

        // Lunch validation
        if (person.lunchStart && person.lunchEnd) {
          const lStartHour = parseInt(person.lunchStart.split(':')[0], 10);
          const lStartMin = parseInt(person.lunchStart.split(':')[1], 10);
          const lEndHour = parseInt(person.lunchEnd.split(':')[0], 10);
          const lEndMin = parseInt(person.lunchEnd.split(':')[1], 10);

          const lStartTotal = lStartHour * 60 + lStartMin;
          const lEndTotal = lEndHour * 60 + lEndMin;

          if (mTotal >= lStartTotal && mTotal < lEndTotal) {
            conflicts.push(`${person.name} está en su horario de almuerzo / descanso (${person.lunchStart} - ${person.lunchEnd}).`);
          }
        }

        // 3. Double booking conflict
        const doubleBooking = allTasks.find(t => {
          if (t.id === taskId) return false;
          if (!t.isMeeting || !t.dueDate || !t.meetingTime) return false;
          const tDate = t.dueDate.substring(0, 10);
          if (tDate !== cleanDate) return false;
          if (t.meetingTime !== meetingTime) return false;
          return t.meetingAttendees && t.meetingAttendees.includes(email);
        });

        if (doubleBooking) {
          conflicts.push(`${person.name} ya está ocupado(a) en la reunión "${doubleBooking.title}" a la misma hora.`);
        }
      }
    });

    return conflicts;
  };

  const handleSendMeetingInvite = async () => {
    if (!meetingTime) {
      alert('Por favor selecciona una hora para la reunión.');
      return;
    }
    if (selectedAttendees.length === 0) {
      alert('Por favor selecciona al menos un invitado.');
      return;
    }

    setSendingMeeting(true);
    setToastMessage('Enviando invitación de calendario...');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);

    try {
      const res = await fetch('/api/meetings/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        },
        body: JSON.stringify({
          taskId,
          attendees: selectedAttendees,
          meetingTime,
          dueDate,
          selectedAttachments: selectedAttachmentNames
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sentReal) {
          setToastMessage('¡Invitación de reunión enviada por SMTP!');
        } else {
          setToastMessage('¡Invitación enviada con éxito! (Simulado)');
          console.log('Simulated Emails:', data.simulatedEmails);
        }
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        
        onSuccess();
        // re-fetch activity logs and confirmations
        const headers = { 'x-api-key': 'mock-api-key-12345' };
        const refreshRes = await fetch(`/api/tasks/${taskId}`, { headers });
        if (refreshRes.ok) {
          const rawTaskData = await refreshRes.json();
          const taskData = normalizeTask(rawTaskData);
          setActivityLog(taskData.activityLog || []);
          setMeetingConfirmations(taskData.meetingConfirmations || []);
        }
      } else {
        const errorData = await res.json();
        alert(`Error al enviar invitación: ${errorData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al enviar la invitación.');
    } finally {
      setSendingMeeting(false);
    }
  };

  // Normalize single task helper
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
      comments: Array.isArray(t.comments) ? t.comments : [],
      completedDays: Array.isArray(t.completedDays) ? t.completedDays : [],
    };
  };

  // Sync main single assignee with multi assignee array
  useEffect(() => {
    if (assigneeIds.length > 0) {
      const firstId = assigneeIds[0];
      const backCompatibleVal = firstId === 'p2' ? 'bob' : firstId === 'p1' ? 'alice' : firstId;
      setAssigneeId(backCompatibleVal);
    } else {
      setAssigneeId('unassigned');
    }
  }, [assigneeIds]);

  // Load task details when drawer is opened/taskId changes
  useEffect(() => {
    if (!isOpen) return;
    setUploadProgress(null);

    async function fetchTask() {
      if (taskId) {
        try {
          const headers = { 'x-api-key': 'mock-api-key-12345' };
          const res = await fetch(`/api/tasks/${taskId}`, { headers });
          if (res.ok) {
            const rawTaskData = await res.json();
            const taskData = normalizeTask(rawTaskData);

            setTitle(taskData.title || '');
            setDescription(taskData.description || '');
            setAssigneeId(taskData.assigneeId || 'unassigned');
            setSteps(taskData.steps || []);
            setAttachments(taskData.attachments || []);
            setStatus(taskData.status || 'Pending');
            setPriority(taskData.priority || 'Medium');
            setType(taskData.type || 'One-shot');
            setRepeatPattern(taskData.repeatPattern || '');
            setCompanyId(taskData.companyId || 'comp-1');
            setDueDate(taskData.dueDate ? taskData.dueDate.substring(0, 10) : new Date().toISOString().substring(0, 10));

            const initialAssignees = taskData.assigneeIds && taskData.assigneeIds.length > 0
              ? taskData.assigneeIds
              : (taskData.assigneeId ? [taskData.assigneeId] : []);
            setAssigneeIds(initialAssignees);
            setActivityLog(taskData.activityLog || []);

            setMeetingTime(taskData.meetingTime || '');
            setSelectedAttendees(taskData.meetingAttendees || []);
            setMeetingConfirmations(taskData.meetingConfirmations || []);
            setMeetingLink(taskData.meetingLink || '');
            setIsMeeting(taskData.isMeeting || false);
            setActiveTab(taskData.isMeeting ? 'meeting' : 'task');
            setSelectedAttachmentNames([]);
            setComments(taskData.comments || []);
            setDrawerTab('view');
          }
        } catch (err) {
          console.error("Error fetching task details inside TaskDrawer:", err);
        }
      } else {
        // Reset to default new task state or load preloadedAiData
        if (preloadedAiData) {
          setTitle(preloadedAiData.title || '');
          setDescription(preloadedAiData.description || '');
          setAssigneeId('unassigned');
          setAssigneeIds([]);
          if (preloadedAiData.steps && preloadedAiData.steps.length > 0) {
            setSteps(preloadedAiData.steps.map((s: string) => ({
              id: `step-${Date.now()}-${Math.random()}`,
              text: s,
              completed: false,
              status: 'Pending'
            })));
          } else {
            setSteps([]);
          }
          setAttachments([]);
          setActivityLog([]);
          setStatus('Pending');
          
          let prio: 'High' | 'Medium' | 'Low' = 'Medium';
          const rawPrio = String(preloadedAiData.priority || '').toLowerCase();
          if (rawPrio === 'high') prio = 'High';
          else if (rawPrio === 'low') prio = 'Low';
          setPriority(prio);

          let tType: 'One-shot' | 'Repetitive' | 'Project' = 'One-shot';
          const rawType = String(preloadedAiData.type || '').toLowerCase();
          if (rawType === 'repetitive') tType = 'Repetitive';
          else if (rawType === 'project') tType = 'Project';
          setType(tType);

          setRepeatPattern('');
          setCompanyId('comp-1');
          setDueDate(new Date().toISOString().substring(0, 10));
          setMeetingTime('');
          setSelectedAttendees([]);
          setMeetingConfirmations([]);
          setSelectedAttachmentNames([]);
          setMeetingLink('');
          setIsMeeting(false);
          setActiveTab('task');
          setComments([]);
          setDrawerTab('edit');
        } else {
          setTitle('');
          setDescription('');
          setAssigneeId('unassigned');
          setAssigneeIds([]);
          setSteps([]);
          setAttachments([]);
          setActivityLog([]);
          setStatus('Pending');
          setPriority('Medium');
          setType('One-shot');
          setRepeatPattern('');
          setCompanyId('comp-1');
          setDueDate(new Date().toISOString().substring(0, 10));
          setMeetingTime('');
          setSelectedAttendees([]);
          setMeetingConfirmations([]);
          setSelectedAttachmentNames([]);
          setMeetingLink('');
          setIsMeeting(false);
          setActiveTab('task');
          setComments([]);
          setDrawerTab('edit');
        }
      }
    }

    fetchTask();
  }, [isOpen, taskId, preloadedAiData]);

  const handleSingleAssigneeChange = (val: string) => {
    setAssigneeId(val);
    if (val === 'unassigned' || !val) {
      setAssigneeIds([]);
    } else {
      const mappedId = val === 'bob' ? 'p2' : val === 'alice' ? 'p1' : val;
      setAssigneeIds([mappedId]);
    }
  };

  const getAvatarForAssignee = (assignee: string) => {
    if (!assignee || assignee === 'unassigned') {
      return '/avatars/placeholder.png';
    }
    const person = people.find(p => p.id === assignee || p.name.toLowerCase().includes(assignee.toLowerCase()));
    if (person) {
      const firstName = person.name.split(' ')[0].toLowerCase();
      return `/avatars/${firstName}.png`;
    }
    if (assignee.toLowerCase() === 'bob') return '/avatars/bob.png';
    if (assignee.toLowerCase() === 'alice') return '/avatars/alice.png';
    return '/avatars/placeholder.png';
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

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }

    setUploadProgress("100%");
    const newAttachment: Attachment = {
      id: `att-${Date.now()}`,
      filename: file.name,
      filepath: `/data/attachments/${file.name}`,
      uploadedAt: new Date().toISOString()
    };
    setAttachments(prev => [...prev, newAttachment]);
  };

  const handleAddStep = () => {
    if (!newStepText.trim()) return;
    const newStep: Step = {
      id: `step-${Date.now()}`,
      text: newStepText.trim(),
      completed: false,
      status: 'Pending'
    };
    setSteps(prev => [...prev, newStep]);
    setNewStepText('');
  };

  const handleCancelMeeting = async (mode: 'convert' | 'delete') => {
    if (mode === 'delete') {
      if (!confirm("¿Estás seguro de que deseas eliminar esta reunión por completo?")) return;
      await handleDeleteTask();
    } else {
      if (!confirm("¿Deseas desvincular la reunión y conservar esta actividad como una tarea normal?")) return;
      try {
        const headers = {
          'Content-Type': 'application/json',
          'x-api-key': 'mock-api-key-12345'
        };
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            isMeeting: false,
            meetingTime: null,
            meetingAttendees: [],
            meetingConfirmations: [],
            meetingLink: '',
          })
        });
        if (res.ok) {
          setToastMessage("Reunión cancelada. Convertida a tarea normal.");
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            onSuccess();
            onClose();
          }, 1500);
        }
      } catch (err) {
        console.error("Error canceling/converting meeting:", err);
      }
    }
  };

  const handleSaveTask = async () => {
    if (!title.trim()) {
      alert("Title is mandatory");
      return;
    }

    const resolvedAssigneeId = assigneeId === 'bob' ? 'p2' : assigneeId === 'alice' ? 'p1' : assigneeId === 'unassigned' ? '' : assigneeId;

    const updatedData = {
      title,
      description,
      assigneeId: resolvedAssigneeId,
      assigneeIds,
      steps,
      status,
      priority,
      attachments,
      type,
      repeatPattern: type === 'Repetitive' ? repeatPattern : null,
      companyId,
      dueDate,
      isMeeting: isMeeting,
      meetingTime: meetingTime || null,
      meetingAttendees: selectedAttendees,
      meetingConfirmations: meetingConfirmations,
      meetingLink: meetingLink || '',
      comments,
    };

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };

      if (taskId) {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updatedData)
        });

        if (res.ok) {
          setToastMessage("Task saved successfully");
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            onSuccess();
            onClose();
          }, 1500);
        } else {
          console.error("Failed to save task updates");
        }
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers,
          body: JSON.stringify(updatedData)
        });

        if (res.ok) {
          setToastMessage("Task created successfully");
          setShowToast(true);
          setTimeout(() => {
            setShowToast(false);
            onSuccess();
            onClose();
          }, 1500);
        }
      }
    } catch (err) {
      console.error("Error saving task details in TaskDrawer:", err);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const headers = { 'x-api-key': 'mock-api-key-12345' };
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        setToastMessage("Task deleted successfully");
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error("Error deleting task in TaskDrawer:", err);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !taskId) return;
    setSubmittingComment(true);

    const userName = currentUser?.name || 'Usuario';
    const userPersonId = currentUser?.personId || 'usr-1';
    const userAvatar = currentUser?.avatar || '/avatars/user.png';

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: userName,
      personId: userPersonId,
      avatar: userAvatar,
      text: newCommentText.trim()
    };

    const updatedComments = [...comments, newComment];
    const firstChars = newCommentText.trim().substring(0, 30);
    const logAction = `Avance registrado: "${firstChars}${newCommentText.trim().length > 30 ? '...' : ''}"`;
    const updatedActivityLog = [
      ...activityLog,
      {
        timestamp: new Date().toISOString(),
        user: userName,
        action: logAction,
        type: 'User' as const
      }
    ];

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          comments: updatedComments,
          activityLog: updatedActivityLog
        })
      });

      if (res.ok) {
        setComments(updatedComments);
        setActivityLog(updatedActivityLog);
        setNewCommentText('');
        setToastMessage("Avance registrado con éxito");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        onSuccess();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Error al guardar el avance: ${errorData.error || res.statusText || res.status}`);
      }
    } catch (err) {
      console.error("Error sending comment:", err);
      alert("Error de red al guardar el avance");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Ping Hermes simulator queue trigger
  const handlePingHermes = async () => {
    if (!taskId) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': 'mock-api-key-12345'
      };
      
      const payload = {
        taskId: taskId,
        command: "Ping Hermes",
        payload: {}
      };

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          activityLog: [
            ...activityLog,
            {
              timestamp: new Date().toISOString(),
              user: "System",
              action: "Notificación enviada al Agente (Comando: Ping Hermes)",
              type: "AI"
            }
          ]
        })
      });

      if (res.ok) {
        setToastMessage("Ping sent to Hermes AI");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
        // Refresh local activity logs
        setActivityLog(prev => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            user: "System",
            action: "Notificación enviada al Agente (Comando: Ping Hermes)",
            type: "AI"
          }
        ]);
      }
    } catch (err) {
      console.error("Error sending Ping to Hermes:", err);
    }
  };

  // Simple Markdown Parser
  const parseMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    const lines = markdown.split('\n');
    const resultLines: string[] = [];
    let inList = false;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        if (!inList) {
          resultLines.push('<ul class="list-disc pl-5 my-2">');
          inList = true;
        }
        const content = line.trim().replace(/^[-*]\s+/, '');
        resultLines.push(`<li>${content}</li>`);
        continue;
      } else {
        if (inList) {
          resultLines.push('</ul>');
          inList = false;
        }
      }
      
      if (line.startsWith('# ')) {
        resultLines.push(`<h1 class="text-lg font-bold mt-2 text-primary-900 border-b pb-1">${line.substring(2)}</h1>`);
      } else if (line.startsWith('## ')) {
        resultLines.push(`<h2 class="text-base font-bold mt-2 text-primary-800">${line.substring(3)}</h2>`);
      } else if (line.startsWith('### ')) {
        resultLines.push(`<h3 class="text-sm font-bold mt-1 text-primary-750">${line.substring(4)}</h3>`);
      } else if (line.trim() === '') {
        resultLines.push('<br/>');
      } else {
        let parsedLine = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        resultLines.push(`<p class="my-1">${parsedLine}</p>`);
      }
    }
    
    if (inList) {
      resultLines.push('</ul>');
    }
    return resultLines.join('');
  };

  const renderTabsBar = () => {
    return (
      <div className="flex overflow-x-auto gap-2 border-b border-primary-100 mb-4 pb-2 scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setDrawerTab('view')}
          className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 flex items-center gap-1.5 ${
            drawerTab === 'view'
              ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
              : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
          }`}
        >
          <span>💬 Avances</span>
          {hasUnreadDrawer && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse border border-amber-600"></span>
          )}
        </button>
        
        <button
          type="button"
          onClick={() => setDrawerTab('edit')}
          className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 ${
            drawerTab === 'edit'
              ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
              : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
          }`}
        >
          ⚙️ Editar
        </button>

        {type === 'Project' && (
          <button
            type="button"
            onClick={() => setDrawerTab('steps')}
            className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 ${
              drawerTab === 'steps'
                ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
                : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
            }`}
          >
            📋 Pasos
          </button>
        )}

        {isMeeting && (
          <button
            type="button"
            onClick={() => setDrawerTab('meeting')}
            className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 ${
              drawerTab === 'meeting'
                ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
                : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
            }`}
          >
            📅 Cita
          </button>
        )}

        <button
          type="button"
          onClick={() => setDrawerTab('attachments')}
          className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 ${
            drawerTab === 'attachments'
              ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
              : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
          }`}
        >
          📎 Adjuntos ({attachments.length})
        </button>

        <button
          type="button"
          onClick={() => setDrawerTab('activity')}
          className={`px-3 py-1.5 text-xs font-bold border-b-2 rounded-t-lg transition-all shrink-0 ${
            drawerTab === 'activity'
              ? 'border-gold-500 text-gold-600 font-extrabold bg-gold-50/10'
              : 'border-transparent text-primary-500 hover:text-primary-750 hover:bg-primary-50'
          }`}
        >
          📜 Historial
        </button>
      </div>
    );
  };

  const renderViewTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-1 md:pr-2 pb-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs ${
              priority === 'High' 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : priority === 'Low'
                ? 'bg-primary-50 text-primary-500 border-primary-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              Prioridad {priority}
            </span>

            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-xs ${
              status === 'Completed'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                : status === 'In Progress'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : status === 'Blocked'
                ? 'bg-rose-50 text-rose-700 border-rose-250'
                : 'bg-primary-50 text-primary-600 border-primary-200'
            }`}>
              Estado: {status}
            </span>
          </div>

          <div>
            <h4 className="text-lg font-black text-primary-900 tracking-tight leading-snug">
              {title}
            </h4>
            <div className="text-[10px] text-primary-400 font-semibold mt-1">
              Due date: <span className="text-primary-700 font-bold">{dueDate}</span>
            </div>
          </div>

          <div className="bg-primary-50/40 border border-primary-100 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HslAvatar
                name={people.find(p => p.id === assigneeId)?.name || 'Unassigned'}
                avatarUrl={people.find(p => p.id === assigneeId)?.avatar || (assigneeId ? getAvatarForAssignee(assigneeId) : '/avatars/placeholder.png')}
                size={10}
              />
              <div className="flex flex-col">
                <span className="text-[10px] text-primary-400 uppercase font-black tracking-wider">Responsable</span>
                <span className="text-xs font-bold text-primary-850">
                  {people.find(p => p.id === assigneeId)?.name || 'Sin asignar'}
                </span>
                <span className="text-[10px] text-primary-400 font-medium">
                  {people.find(p => p.id === assigneeId)?.role || 'Miembro'}
                </span>
              </div>
            </div>

            {assigneeIds.length > 1 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-primary-400 uppercase font-black tracking-wider mb-1">Colaboradores</span>
                <div className="flex -space-x-2">
                  {assigneeIds.map(id => {
                    const p = people.find(person => person.id === id);
                    if (!p || p.id === assigneeId) return null;
                    return (
                      <div key={p.id} title={p.name} className="ring-2 ring-white rounded-full">
                        <HslAvatar name={p.name} avatarUrl={p.avatar} size={6} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[9px] text-primary-400 uppercase font-black tracking-wider block">Descripción</span>
            <div
              id="task-view-description"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(description) || '<p class="italic text-primary-400 text-xs">Sin descripción de tarea.</p>' }}
              className="p-4 bg-white border border-primary-150 rounded-xl text-xs prose prose-sm max-w-none text-primary-800 leading-relaxed shadow-2xs max-h-60 overflow-y-auto"
            />
          </div>

          <div className="space-y-2 border-t border-primary-100 pt-4">
            <span className="text-[10px] text-primary-400 uppercase font-black tracking-wider block">
              💬 Avances y Comentarios ({comments.length})
            </span>
            
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <div className="text-xs text-primary-400 italic bg-primary-50/20 p-4 border border-dashed rounded-xl text-center">
                  No hay avances registrados para esta tarea.
                </div>
              ) : (
                comments.map((comment, index) => {
                  const isMe = comment.personId === (currentUser?.personId || 'usr-1');
                  return (
                    <div
                      key={comment.id || index}
                      className={`flex items-start gap-2.5 max-w-[90%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      <HslAvatar
                        name={comment.user}
                        avatarUrl={comment.avatar}
                        size={7.5}
                      />
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary-400">
                          <span>{comment.user}</span>
                          <span>•</span>
                          <span>{new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`mt-1 p-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                          isMe
                            ? 'bg-gold-600 text-white rounded-tr-none font-medium'
                            : 'bg-primary-100/70 text-primary-850 rounded-tl-none font-bold'
                        }`}>
                          {comment.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSendComment} className="border-t pt-4 mt-2 flex gap-2 shrink-0">
          <input
            type="text"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Escribe un avance o actualización..."
            className="flex-1 px-3 py-2 border rounded-lg text-xs text-primary-855 bg-white"
            disabled={submittingComment}
          />
          <button
            type="submit"
            disabled={submittingComment || !newCommentText.trim()}
            className="px-4 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            {submittingComment ? 'Guardando...' : 'Avance'}
          </button>
        </form>
      </div>
    );
  };


  const renderEditTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1 md:pr-2 pb-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-primary-500 mb-1">Task Title</label>
            <input
              type="text"
              id="task-title-input"
              data-testid="task-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Coordinar inventarios..."
              className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-primary-850 bg-white"
            />
          </div>

          {/* Description Markdown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-primary-500">Description (Markdown)</label>
              <span className="text-[10px] text-gold-600 font-extrabold uppercase">Live Editor</span>
            </div>
            <textarea
              id="task-desc-textarea"
              data-testid="task-desc-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Markdown text..."
              className="w-full px-3 py-2 border rounded-lg text-sm h-24 text-primary-800"
            ></textarea>
            <div
              id="markdown-preview"
              data-testid="markdown-preview"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(description) }}
              className="mt-2 p-3 bg-primary-50 border border-dashed rounded-lg text-xs prose prose-sm max-w-none text-primary-800 max-h-36 overflow-y-auto"
            />

            <div className="flex items-center justify-between mt-3 gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleDictation}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
                    isDictating ? 'bg-red-500 text-white animate-pulse border-red-500' : 'text-primary-600 border-primary-200 hover:bg-gold-50'
                  }`}
                  title="Dictar por voz"
                >
                  🎤 Dictar
                </button>
                <label className="px-2.5 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-gold-50 transition cursor-pointer text-xs font-bold flex items-center gap-1">
                  📷 Imagen
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUploadInDrawer}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleAIRefineInDrawer}
                disabled={aiLoading}
                className="px-3 py-1.5 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-lg text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {aiLoading ? 'Procesando...' : '✨ Perfeccionar con IA'}
              </button>
            </div>

            {selectedImage && (
              <div className="mt-2 flex items-center justify-between p-2 border border-gold-200/50 rounded-lg bg-gold-50/20 text-xs">
                <span className="truncate max-w-[150px] font-medium text-primary-700">Imagen de referencia lista</span>
                <button type="button" onClick={() => setSelectedImage(null)} className="text-red-500 font-bold px-1 hover:text-red-700">×</button>
              </div>
            )}
          </div>

          {/* Assignees (Multiselect Stack) */}
          <div className="space-y-3 bg-primary-50/30 p-3.5 border border-primary-200/60 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-primary-500 mb-2">Asignados (Multiselección)</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto p-1.5 bg-white border border-primary-150 rounded-xl">
                {people.map(p => {
                  const isAssigned = assigneeIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        if (isAssigned) {
                          setAssigneeIds(prev => prev.filter(id => id !== p.id));
                        } else {
                          setAssigneeIds(prev => [...prev, p.id]);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-[10px] font-bold ${
                        isAssigned
                          ? 'bg-gold-50 text-gold-700 border-gold-400 shadow-sm ring-1 ring-gold-400'
                          : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-100/50'
                      }`}
                    >
                      <HslAvatar name={p.name} avatarUrl={p.avatar} size={4.5} />
                      <span>{p.name}</span>
                      {isAssigned && <span className="text-[9px] font-black text-gold-600">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-primary-150/50 pt-2.5">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wide text-primary-400 mb-1">Responsable Principal</label>
                <select
                  id="assignee-select"
                  data-testid="assignee-select"
                  value={assigneeId}
                  onChange={(e) => handleSingleAssigneeChange(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850 bg-white"
                >
                  <option value="unassigned">Unassigned</option>
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="alice">Alice Smith</option>
                  <option value="bob">Bob Jones</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2 pt-4">
                <HslAvatar
                  id="assignee-avatar"
                  data-testid="assignee-avatar"
                  name={people.find(p => p.id === assigneeId)?.name || (assigneeId === 'alice' ? 'Alice Smith' : assigneeId === 'bob' ? 'Bob Jones' : 'Unassigned')}
                  avatarUrl={people.find(p => p.id === assigneeId)?.avatar || (assigneeId ? getAvatarForAssignee(assigneeId) : '/avatars/placeholder.png')}
                  size={7}
                />
                <span className="text-xs text-primary-500 font-medium">Assignee profile</span>
              </div>
            </div>
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-primary-500 mb-1">Status</label>
              <select
                id="task-status-select"
                data-testid="task-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Blocked">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-primary-500 mb-1">Priority</label>
              <select
                id="task-priority-select"
                data-testid="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
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
              <label className="block text-xs font-bold text-primary-500 mb-1">Type</label>
              <select
                id="task-type-select"
                data-testid="task-type-select"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
              >
                <option value="One-shot">One-shot</option>
                <option value="Repetitive">Repetitive</option>
                <option value="Project">Project</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-primary-500 mb-1">Due Date</label>
              <input
                type="date"
                id="task-due-date-input"
                data-testid="task-due-date-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
              />
            </div>
          </div>

          {/* Company & Repeat Pattern Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-primary-500 mb-1">Company</label>
              <select
                id="task-company-select"
                data-testid="task-company-select"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-2 py-1.5 border rounded-lg text-xs text-primary-850"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {type === 'Repetitive' && (
              <div>
                <label className="block text-xs font-bold text-primary-500 mb-1">Repeat Pattern</label>
                <select
                  id="task-repeat-pattern-select"
                  data-testid="task-repeat-pattern-select"
                  value={repeatPattern}
                  onChange={(e) => setRepeatPattern(e.target.value as any)}
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
        </div>

        {/* Footer actions */}
        <div className="border-t pt-4 mt-6 space-y-3 shrink-0">
          {taskId && (
            <button
              type="button"
              onClick={handlePingHermes}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs transition uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ping Hermes AI
            </button>
          )}
          {taskId && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShareMenuOpen(!shareMenuOpen)}
                className="w-full py-2 bg-[#faf9f6] border border-primary-200 hover:border-gold-500 text-primary-700 rounded-lg font-bold text-xs transition uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>📤</span> Compartir Tarea
              </button>
              {shareMenuOpen && (
                <div className="absolute left-0 right-0 bottom-10 z-50 bg-white border border-gold-200/55 rounded-lg shadow-lg py-1.5 text-xs text-primary-800 animate-fade-in flex flex-col">
                  <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="w-full text-left px-4 py-2 hover:bg-gold-50 flex items-center gap-2"
                  >
                    <span>✈️</span> Compartir en Telegram
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full text-left px-4 py-2 hover:bg-gold-50 flex items-center gap-2"
                  >
                    <span>💬</span> Compartir en WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleShareEmail}
                    className="w-full text-left px-4 py-2 hover:bg-gold-50 flex items-center gap-2"
                  >
                    <span>✉️</span> Enviar por Correo (SMTP)
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {taskId && (
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
    );
  };

  const renderStepsTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1 md:pr-2 pb-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-primary-500">Checklist Items (Proyectos)</label>
              <span className="text-[9px] text-primary-400 font-extrabold uppercase">Step Coordinator</span>
            </div>
            
            {/* Steps Add Box */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="Añadir paso al proyecto..."
                className="flex-1 px-2.5 py-1.5 border rounded-lg text-xs text-primary-850 bg-white"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddStep(); }}
              />
              <button
                type="button"
                onClick={handleAddStep}
                className="px-3 py-1.5 bg-primary-800 text-white rounded-lg text-xs font-bold hover:bg-primary-950 transition"
              >
                Add
              </button>
            </div>

            <div id="checklist-container" className="space-y-2.5 max-h-80 overflow-y-auto border p-3 rounded-xl bg-primary-50/20">
              {steps.length === 0 ? (
                <div data-testid="no-steps-placeholder" className="text-xs text-primary-400 italic">
                  No steps inside this project checklist yet.
                </div>
              ) : (
                steps.map((step, index) => (
                  <div key={step.id || index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-primary-100 shadow-xs">
                    <input
                      type="checkbox"
                      id={`step-${index}`}
                      data-testid={`checklist-item-${index}`}
                      checked={step.completed}
                      onChange={() => {
                        const updatedSteps = [...steps];
                        const nextCompleted = !updatedSteps[index].completed;
                        updatedSteps[index] = { 
                          ...updatedSteps[index], 
                          completed: nextCompleted,
                          status: nextCompleted ? 'Completed' : 'Pending'
                        };
                        setSteps(updatedSteps);
                      }}
                      className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                    />
                    
                    <select
                      value={step.status || (step.completed ? 'Completed' : 'Pending')}
                      onChange={(e) => {
                        const newStatus = e.target.value as 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
                        const updatedSteps = [...steps];
                        updatedSteps[index] = {
                          ...updatedSteps[index],
                          status: newStatus,
                          completed: newStatus === 'Completed'
                        };
                        setSteps(updatedSteps);
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

                    {/* Subtask Assignee selector */}
                    <select
                      value={step.assigneeId || ''}
                      onChange={(e) => {
                        const newAssigneeId = e.target.value;
                        const updatedSteps = [...steps];
                        updatedSteps[index] = {
                          ...updatedSteps[index],
                          assigneeId: newAssigneeId || undefined
                        };
                        setSteps(updatedSteps);
                      }}
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded border focus:outline-none cursor-pointer bg-white border-primary-200 text-primary-600 w-24"
                    >
                      <option value="">No Assigned</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>

                    <label 
                      htmlFor={`step-${index}`} 
                      className={`text-xs text-primary-600 cursor-pointer flex-1 truncate ${step.completed ? 'line-through text-primary-400 font-medium' : 'font-bold'}`}
                    >
                      {step.text}
                    </label>

                    {/* Remove step button */}
                    <button
                      type="button"
                      onClick={() => setSteps(prev => prev.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700 text-xs font-bold px-1"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        {/* Footer for saving steps */}
        <div className="border-t pt-4 mt-6 shrink-0">
          <button
            data-testid="save-task-btn"
            onClick={handleSaveTask}
            className="w-full py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg font-semibold text-sm transition"
          >
            Save Task
          </button>
        </div>
      </div>
    );
  };

  const renderMeetingTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1 md:pr-2 pb-4">
          {/* Meeting Info Block */}
          <div className="bg-gold-50/10 border border-gold-200/50 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-start gap-2">
              <h4 className="text-sm font-bold text-primary-900 leading-snug">
                👥 {title || 'Reunión sin título'}
              </h4>
              <span className="text-[9px] font-black uppercase tracking-wider bg-gold-100 text-gold-800 border border-gold-300 px-2 py-0.5 rounded">
                Reunión
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-primary-755 border-t border-gold-100/50 pt-2.5">
              <div>
                <span className="text-[9px] text-primary-400 uppercase block font-bold">Fecha:</span>
                <span className="text-primary-850 font-extrabold">{dueDate}</span>
              </div>
              <div>
                <span className="text-[9px] text-primary-400 uppercase block font-bold">Hora:</span>
                <span className="text-primary-850 font-extrabold">{meetingTime || 'No definida'}</span>
              </div>
            </div>
          </div>

          {/* Meeting Link input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-primary-500">🔗 Enlace de la Reunión (Google Meet / Zoom / Teams)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
                className="flex-1 px-3 py-2 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 font-bold"
              />
              {meetingLink && (
                <a
                  href={meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center shrink-0 uppercase tracking-wider"
                >
                  Unirse
                </a>
              )}
            </div>
          </div>

          {/* Reschedule scheduler segment */}
          <div className="bg-primary-50/20 p-4 border border-primary-200/50 rounded-xl space-y-4">
            <span className="block text-xs font-bold text-primary-500 uppercase tracking-wider">
              📅 Modificar Programación
            </span>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-primary-450 uppercase mb-1">Fecha de Reunión</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-primary-450 uppercase mb-1">Hora (Intervalos AM/PM)</label>
                <select
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                  className="w-full px-3 py-1.5 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 font-bold"
                >
                  <option value="">Selecciona hora</option>
                  {Array.from({ length: 16 }).flatMap((_, idx) => {
                    const h = idx + 7;
                    const hour24Str = String(h).padStart(2, '0');
                    const ampm = h >= 12 ? 'PM' : 'AM';
                    const displayHour = h % 12 === 0 ? 12 : h % 12;
                    return [
                      { val: `${hour24Str}:00`, label: `${displayHour}:00 ${ampm}` },
                      { val: `${hour24Str}:30`, label: `${displayHour}:30 ${ampm}` }
                    ];
                  }).map(({ val, label }) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selection of Attendees */}
            <div>
              <label className="block text-[9px] font-bold text-primary-450 uppercase mb-1.5">
                Seleccionar Invitados (Miembros del Equipo)
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto border border-primary-150 rounded-lg p-2 bg-white">
                {people.map(p => {
                  const matchedUser = users.find(u => u.personId === p.id);
                  const email = matchedUser ? matchedUser.email : `${p.name.toLowerCase().replace(/\s+/g, '')}@holding.com`;
                  const isChecked = selectedAttendees.includes(email);
                  return (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAttendees(prev => prev.filter(e => e !== email));
                          } else {
                            setSelectedAttendees(prev => [...prev, email]);
                          }
                        }}
                        className="w-4.5 h-4.5 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                      />
                      <div className="flex items-center gap-1.5">
                        <HslAvatar name={p.name} avatarUrl={p.avatar} size={4} />
                        <span className="font-bold text-primary-800">{p.name}</span>
                        <span className="text-[10px] text-primary-400">({email})</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selection of attachments to include in email */}
          {attachments.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1.5">
                Seleccionar Archivos Adjuntos a Enviar
              </label>
              <div className="space-y-1.5 border border-primary-150 rounded-lg p-2 bg-white max-h-24 overflow-y-auto">
                {attachments.map((att) => {
                  const isChecked = selectedAttachmentNames.includes(att.filename);
                  return (
                    <label key={att.id} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedAttachmentNames(prev => prev.filter(f => f !== att.filename));
                          } else {
                            setSelectedAttachmentNames(prev => [...prev, att.filename]);
                          }
                        }}
                        className="w-4.5 h-4.5 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                      />
                      <span className="text-primary-700 truncate font-semibold">{att.filename}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* RSVP Status / Confirmations List */}
          {selectedAttendees.length > 0 && (
            <div className="bg-[#faf9f6] border border-gold-200/40 rounded-xl p-3 space-y-2 border-dashed">
              <span className="block text-[10px] font-extrabold text-gold-700 uppercase tracking-wider">
                Confirmaciones de Invitados (RSVP)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedAttendees.map((email, idx) => {
                  const isConfirmed = meetingConfirmations.includes(email);
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                        isConfirmed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                          : 'bg-amber-50 text-amber-700 border-amber-250'
                      }`}
                    >
                      <span>{isConfirmed ? '✓' : '⌛'}</span>
                      <span>{email}</span>
                      <span className="text-[7.5px] font-black uppercase opacity-75">
                        ({isConfirmed ? 'Confirmado' : 'Pendiente'})
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Availability Conflicts Banner */}
          {selectedAttendees.length > 0 && (() => {
            const conflicts = checkAttendeeConflicts();
            if (conflicts.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-800 space-y-1 shadow-xs my-3">
                <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                  <span>⚠️</span> Conflicto de Disponibilidad:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 font-semibold">
                  {conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>

        {/* Meeting actions footer */}
        <div className="border-t pt-4 mt-6 space-y-3 shrink-0">
          <button
            type="button"
            onClick={handleSendMeetingInvite}
            disabled={sendingMeeting || !meetingTime || selectedAttendees.length === 0}
            className="w-full py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-lg font-bold text-xs transition uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sendingMeeting ? 'Actualizando Invitaciones...' : '✉️ Enviar/Actualizar Invitaciones (SMTP)'}
          </button>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleCancelMeeting('convert')}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition"
            >
              🔓 Quitar Reunión
            </button>
            <button
              type="button"
              onClick={() => handleCancelMeeting('delete')}
              className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition"
            >
              🗑️ Borrar Reunión
            </button>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveTask}
              className="flex-1 py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg font-semibold text-xs uppercase tracking-wider transition"
            >
              💾 Guardar
            </button>
            <button
              type="button"
              onClick={() => setDrawerTab('view')}
              className="flex-1 py-2 bg-primary-100 hover:bg-primary-200 text-primary-750 rounded-lg font-semibold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5"
            >
              💬 Ver Tarea
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAttachmentsTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1 md:pr-2 pb-4">
          <div>
            <label className="block text-xs font-bold text-primary-500 mb-1">Attachments</label>
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
                className={`text-xs font-semibold mt-1 ${uploadProgress.startsWith('Error') ? 'text-red-500' : 'text-gold-600'}`}
              >
                {uploadProgress}
              </div>
            )}

            <div id="attachments-list" className="mt-3 space-y-2">
              {attachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  data-testid={`attachment-item-${idx}`}
                  className="flex items-center justify-between p-2 bg-primary-50 border border-primary-100 rounded-lg text-xs"
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
                      type="button"
                      data-testid={`preview-attachment-${idx}`}
                      onClick={() => handlePreviewAttachment(att.filename)}
                      className="text-primary-600 hover:text-primary-755 font-semibold"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      data-testid={`delete-attachment-${idx}`}
                      onClick={() => {
                        setAttachments(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-red-600 hover:text-red-700 font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer for saving attachments */}
        <div className="border-t pt-4 mt-6 shrink-0">
          <button
            data-testid="save-task-btn"
            onClick={handleSaveTask}
            className="w-full py-2 bg-gold-600 hover:bg-gold-700 text-white rounded-lg font-semibold text-sm transition"
          >
            Save Task
          </button>
        </div>
      </div>
    );
  };

  const renderActivityTab = () => {
    return (
      <div className="flex-1 flex flex-col justify-between overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto pr-1 md:pr-2 pb-4">
          <div>
            <label className="block text-xs font-bold text-primary-500 mb-1">Activity Log</label>
            <div
              id="activity-log"
              className="space-y-2 max-h-96 overflow-y-auto border border-primary-200 rounded-lg p-3 bg-primary-50/50"
            >
              {activityLog.map((log, index) => (
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
              {activityLog.length === 0 && (
                <div className="text-xs text-primary-400 italic">No activity logs recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      id="task-details-drawer"
      data-testid={dataTestId || "task-details-drawer"}
      className="fixed inset-0 z-50 overflow-hidden flex flex-col justify-end md:flex-row md:justify-end bg-primary-950/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        data-testid="task-detail-pane"
        className="w-full md:max-w-lg bg-white h-[92vh] md:h-full rounded-t-2xl md:rounded-t-none shadow-2xl flex flex-col justify-between p-6 md:p-8 transform transition-all duration-300 translate-y-0 md:translate-y-0 cursor-default overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-4 shrink-0">
          <div>
            <h3 className="text-xl font-black text-primary-900 tracking-tight">
              {taskId ? 'Edit Task Details' : 'Create New Task'}
            </h3>
            <p className="text-xs text-primary-400 font-medium">
              {taskId ? `Task Reference ID: ${taskId}` : 'Setup task workflow values'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 transition p-1 rounded-full hover:bg-primary-100"
            title="Close Drawer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Selection */}
        {renderTabsBar()}

        {/* Render Active Tab Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {drawerTab === 'view' && renderViewTab()}
          {drawerTab === 'edit' && renderEditTab()}
          {drawerTab === 'steps' && renderStepsTab()}
          {drawerTab === 'meeting' && renderMeetingTab()}
          {drawerTab === 'attachments' && renderAttachmentsTab()}
          {drawerTab === 'activity' && renderActivityTab()}
        </div>
      </div>

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

      {/* Attachment Preview Modal */}
      {isPreviewModalOpen && (
        <div
          id="attachment-preview-modal"
          data-testid="attachment-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div className="bg-white rounded-xl p-6 max-w-lg w-full relative" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-primary-800 mb-4">Attachment Preview</h3>
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

      {/* Email Sharing Modal */}
      {emailModalOpen && (
        <div
          id="email-share-modal"
          data-testid="email-share-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto"
          onClick={() => setEmailModalOpen(false)}
        >
          <div
            className="bg-[#faf9f6] border border-gold-200 rounded-xl p-6 max-w-xl w-full relative shadow-2xl flex flex-col gap-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gold-200/50 pb-3">
              <h3 className="text-sm font-extrabold text-primary-800 uppercase tracking-wider flex items-center gap-2">
                <span>✉️</span> Compartir Tarea por Correo (SMTP)
              </h3>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="text-primary-400 hover:text-primary-650 text-lg font-bold transition"
              >
                &times;
              </button>
            </div>

            {!isSmtpConfigured && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-[11px] leading-relaxed font-semibold">
                ⚠️ Servidor SMTP no configurado. El correo se simulará localmente. Configúralo en Settings para enviar correos reales.
              </div>
            )}

            <form onSubmit={handleSubmitShareEmail} className="space-y-4">
              {/* Recipient Field */}
              <div>
                <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">
                  Destinatario (Email)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ejemplo@holding.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 focus:outline-none focus:border-gold-500 transition font-medium"
                />
                
                {/* Quick select buttons */}
                <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] font-bold text-primary-400 uppercase tracking-wider mr-1">Sugerencias:</span>
                  {people.map(p => {
                    const matchedUser = users.find(u => u.personId === p.id);
                    const email = matchedUser ? matchedUser.email : `${p.name.toLowerCase().replace(/\s+/g, '')}@holding.com`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEmailTo(email)}
                        className="px-2 py-0.5 bg-primary-100 hover:bg-gold-100 text-primary-755 hover:text-gold-800 rounded text-[10px] font-bold transition border border-transparent hover:border-gold-300"
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Asunto del correo"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 focus:outline-none focus:border-gold-500 transition font-bold"
                />
              </div>

              {/* Body Field */}
              <div>
                <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1">
                  Mensaje / Cuerpo
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Detalles de la tarea..."
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full px-3 py-2 border border-primary-200 rounded-lg text-xs bg-white text-primary-800 focus:outline-none focus:border-gold-500 transition font-mono whitespace-pre-wrap leading-relaxed"
                />
              </div>

              {/* Selectable Attachments */}
              {attachments.length > 0 && (
                <div>
                  <label className="block text-[10px] font-bold text-primary-500 uppercase tracking-wider mb-1.5">
                    Adjuntos de la Tarea a Incluir
                  </label>
                  <div className="space-y-1.5 border border-primary-150 rounded-lg p-2.5 bg-white max-h-24 overflow-y-auto">
                    {attachments.map((att) => {
                      const isChecked = emailSelectedAttachments.includes(att.filename);
                      return (
                        <label key={att.id} className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEmailSelectedAttachments(prev => prev.filter(f => f !== att.filename));
                              } else {
                                setEmailSelectedAttachments(prev => [...prev, att.filename]);
                              }
                            }}
                            className="w-4 h-4 rounded text-gold-600 border-primary-300 focus:ring-gold-500 cursor-pointer"
                          />
                          <span className="text-primary-700 truncate font-semibold">{att.filename}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="flex-1 py-2 bg-primary-200 hover:bg-primary-300 text-primary-800 rounded-lg font-bold text-xs transition uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingEmail || !emailTo.trim() || !emailSubject.trim() || !emailBody.trim()}
                  className="flex-1 py-2 bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white rounded-lg font-bold text-xs transition uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sendingEmail ? 'Enviando...' : '✉️ Enviar Correo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
