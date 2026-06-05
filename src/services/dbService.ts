import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { supabase } from './supabaseClient';
import {
  Company,
  Person,
  Step,
  Attachment,
  LogEntry,
  Task,
  EmailTemplate,
  SMTPConfig,
  AIConfig,
  QueueItem,
  User,
  DatabaseSchema,
  initialData,
} from './mockData';

// Re-export the types as specified in PROJECT.md
export type {
  Company,
  Person,
  Step,
  Attachment,
  LogEntry,
  Task,
  EmailTemplate,
  SMTPConfig,
  AIConfig,
  QueueItem,
  User,
  DatabaseSchema,
};

// Password hashing helpers
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export interface MeetingMetadata {
  isMeeting?: boolean;
  meetingTime?: string;
  meetingAttendees?: string[];
  meetingConfirmations?: string[];
  meetingLink?: string;
}

export function extractMeetingMetadata(description: string): { cleanDescription: string; metadata: MeetingMetadata } {
  if (!description) {
    return { cleanDescription: '', metadata: {} };
  }
  const match = description.match(/<!-- HERMES_MEETING_METADATA: (.*?) -->/);
  if (match) {
    try {
      const metadata = JSON.parse(match[1]);
      const cleanDescription = description.replace(match[0], '').trim();
      return { cleanDescription, metadata };
    } catch (e) {
      console.error('Error parsing meeting metadata from description:', e);
    }
  }
  return { cleanDescription: description, metadata: {} };
}

export function injectMeetingMetadata(description: string, metadata: MeetingMetadata): string {
  const { cleanDescription } = extractMeetingMetadata(description);
  if (metadata.isMeeting || metadata.meetingTime || (metadata.meetingAttendees && metadata.meetingAttendees.length > 0)) {
    const jsonStr = JSON.stringify(metadata);
    return `${cleanDescription}\n\n<!-- HERMES_MEETING_METADATA: ${jsonStr} -->`;
  }
  return cleanDescription;
}

export interface IDBService {
  readData(): Promise<DatabaseSchema>;
  writeData(data: DatabaseSchema): Promise<void>;
  getTasks(): Promise<Task[]>;
  getTaskById(id: string): Promise<Task | null>;
  createTask(task: Omit<Task, 'id' | 'activityLog'>): Promise<Task>;
  updateTask(id: string, taskUpdates: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<boolean>;
  clearAllTasks(): Promise<void>;
  getCompanies(): Promise<Company[]>;
  createCompany(company: Omit<Company, 'id'>): Promise<Company>;
  deleteCompany(id: string): Promise<boolean>;
  getPeople(): Promise<Person[]>;
  createPerson(person: Omit<Person, 'id'>): Promise<Person>;
  updatePerson(id: string, personUpdates: Partial<Person>): Promise<Person>;
  deletePerson(id: string): Promise<boolean>;
  getEmailTemplates(): Promise<EmailTemplate[]>;
  updateEmailTemplates(templates: EmailTemplate[]): Promise<void>;
  getSMTPConfig(): Promise<SMTPConfig>;
  updateSMTPConfig(config: SMTPConfig): Promise<void>;
  getAIConfig(): Promise<AIConfig>;
  updateAIConfig(config: AIConfig): Promise<void>;
  pushToQueue(item: Omit<QueueItem, 'id' | 'status' | 'timestamp'>): Promise<QueueItem>;
  getQueue(): Promise<QueueItem[]>;
  processQueueItem(id: string): Promise<boolean>;
  
  // User Management
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: Omit<User, 'id' | 'passwordHash' | 'salt'> & { passwordPlain: string }): Promise<User>;
  updateUser(id: string, userUpdates: Partial<User> & { passwordPlain?: string }): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
}

export class AsyncMutex {
  private promise: Promise<void> = Promise.resolve();
  
  async acquire(): Promise<() => void> {
    let release: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = nextPromise;
    await currentPromise;
    return release!;
  }
}

export class DBService implements IDBService {
  private dbPath: string;
  private mutex: AsyncMutex;

  constructor() {
    this.dbPath = process.env.DATABASE_PATH || 'data/db.json';
    this.mutex = new AsyncMutex();
  }

  /**
   * Helper to ensure the parent folder exists and the database file is seeded/recovered.
   * Also seeds Supabase dynamically if the connection is active and Supabase is empty.
   */
  private async ensureDatabase(): Promise<void> {
    if (supabase) {
      try {
        // Query companies to check if data is seeded in Supabase
        const { count, error } = await supabase
          .from('companies')
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.error("Error checking Supabase companies:", error);
          return;
        }

        if (count === 0) {
          console.log("Supabase database is empty. Initiating automatic seeding from data/db.json...");
          
          let localData: DatabaseSchema;
          try {
            const content = await fs.promises.readFile(path.resolve('data/db.json'), 'utf-8');
            localData = JSON.parse(content);
          } catch (readErr) {
            console.warn("Could not load local data/db.json for seeding, using fallback initialData:", readErr);
            localData = initialData;
          }

          // 1. Seed companies
          if (localData.companies && localData.companies.length > 0) {
            const { error: err } = await supabase.from('companies').insert(localData.companies);
            if (err) console.error("Error seeding companies:", err);
          }

          // 2. Seed people
          if (localData.people && localData.people.length > 0) {
            const records = localData.people.map(p => ({
              id: p.id,
              name: p.name,
              role: p.role,
              avatar: p.avatar,
              company_id: p.companyId || null
            }));
            const { error: err } = await supabase.from('people').insert(records);
            if (err) console.error("Error seeding people:", err);
          }

          // 3. Seed tasks
          if (localData.tasks && localData.tasks.length > 0) {
            const records = localData.tasks.map(t => {
              const finalDescription = injectMeetingMetadata(t.description || '', {
                isMeeting: t.isMeeting,
                meetingTime: t.meetingTime,
                meetingAttendees: t.meetingAttendees,
                meetingConfirmations: t.meetingConfirmations
              });
              return {
                id: t.id,
                title: t.title,
                description: finalDescription,
                type: t.type,
                repeat_pattern: t.repeatPattern || null,
                steps: t.steps || [],
                company_id: t.companyId || null,
                assignee_id: t.assigneeId || null,
                assignee_ids: t.assigneeIds || [],
                status: t.status,
                priority: t.priority,
                origin: t.origin,
                due_date: t.dueDate,
                attachments: t.attachments || [],
                activity_log: t.activityLog || []
              };
            });
            const { error: err } = await supabase.from('tasks').insert(records);
            if (err) console.error("Error seeding tasks:", err);
          }

          // 4. Seed users
          if (localData.users && localData.users.length > 0) {
            const records = localData.users.map(u => ({
              id: u.id,
              person_id: u.personId,
              email: u.email,
              password_hash: u.passwordHash,
              salt: u.salt,
              is_active: u.isActive
            }));
            const { error: err } = await supabase.from('users').insert(records);
            if (err) console.error("Error seeding users:", err);
          }

          // 5. Seed templates
          if (localData.templates && localData.templates.length > 0) {
            const records = localData.templates.map(temp => ({
              id: temp.id,
              name: temp.name,
              subject: temp.subject,
              body: temp.body
            }));
            const { error: err } = await supabase.from('email_templates').insert(records);
            if (err) console.error("Error seeding email templates:", err);
          }

          // 6. Seed smtp config
          if (localData.smtpConfig) {
            const record = {
              id: 'default',
              host: localData.smtpConfig.host,
              port: localData.smtpConfig.port,
              secure: localData.smtpConfig.secure,
              auth_user: localData.smtpConfig.user,
              auth_pass: localData.smtpConfig.pass
            };
            const { error: err } = await supabase.from('smtp_config').insert(record);
            if (err) console.error("Error seeding SMTP configuration:", err);
          }

          // 7. Seed agent queue
          if (localData.agentQueue && localData.agentQueue.length > 0) {
            const records = localData.agentQueue.map(q => ({
              id: q.id,
              task_id: q.taskId,
              command: q.command,
              payload: q.payload,
              status: q.status,
              timestamp: q.timestamp
            }));
            const { error: err } = await supabase.from('agent_queue').insert(records);
            if (err) console.error("Error seeding agent queue:", err);
          }

          console.log("Supabase seeding completed successfully!");
        }
      } catch (seedErr) {
        console.error("Auto-seeding check failed for Supabase:", seedErr);
      }
      return;
    }

    // Fallback: Local file system implementation
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    if (!fs.existsSync(this.dbPath)) {
      await this.atomicWrite(initialData);
      return;
    }

    try {
      const content = await fs.promises.readFile(this.dbPath, 'utf-8');
      JSON.parse(content);
    } catch (e) {
      const timestamp = Date.now();
      const corruptPath = `${this.dbPath}.corrupt_${timestamp}`;
      try {
        await fs.promises.rename(this.dbPath, corruptPath);
      } catch (renameErr) {
        await fs.promises.writeFile(corruptPath, await fs.promises.readFile(this.dbPath, 'utf-8'));
      }
      await this.atomicWrite(initialData);
    }
  }

  private async atomicWrite(data: DatabaseSchema): Promise<void> {
    const uniqueId = Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    const tempPath = `${this.dbPath}.${uniqueId}.tmp`;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
    await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    
    let retries = 5;
    while (retries > 0) {
      try {
        await fs.promises.rename(tempPath, this.dbPath);
        break;
      } catch (err) {
        retries--;
        if (retries === 0) {
          try {
            await fs.promises.unlink(tempPath);
          } catch (_) {}
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  // Raw read operation
  async readData(): Promise<DatabaseSchema> {
    if (supabase) {
      await this.ensureDatabase();
      const [companiesRes, peopleRes, tasksRes, templatesRes, smtpRes, queueRes, usersRes] = await Promise.all([
        supabase.from('companies').select('*'),
        supabase.from('people').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('email_templates').select('*'),
        supabase.from('smtp_config').select('*'),
        supabase.from('agent_queue').select('*'),
        supabase.from('users').select('*')
      ]);

      const companies: Company[] = (companiesRes.data || []).map(c => ({ id: c.id, name: c.name }));
      const people: Person[] = (peopleRes.data || []).map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
        avatar: p.avatar,
        companyId: p.company_id || undefined
      }));
      const tasks: Task[] = (tasksRes.data || []).map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        type: t.type as any,
        repeatPattern: t.repeat_pattern as any,
        steps: t.steps || [],
        companyId: t.company_id || '',
        assigneeId: t.assignee_id || '',
        assigneeIds: t.assignee_ids || [],
        status: t.status as any,
        priority: t.priority as any,
        origin: t.origin as any,
        dueDate: t.due_date,
        attachments: t.attachments || [],
        activityLog: t.activity_log || []
      }));
      const templates: EmailTemplate[] = (templatesRes.data || []).map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body
      }));
      const smtpConfig: SMTPConfig = smtpRes.data && smtpRes.data.length > 0 
        ? {
            host: smtpRes.data[0].host,
            port: smtpRes.data[0].port,
            secure: smtpRes.data[0].secure,
            user: smtpRes.data[0].auth_user,
            pass: smtpRes.data[0].auth_pass
          }
        : { host: '', port: 587, secure: false, user: '', pass: '' };
      const agentQueue: QueueItem[] = (queueRes.data || []).map(q => ({
        id: q.id,
        taskId: q.task_id,
        command: q.command,
        payload: q.payload,
        status: q.status as any,
        timestamp: q.timestamp
      }));
      const users: User[] = (usersRes.data || []).map(u => ({
        id: u.id,
        personId: u.person_id,
        email: u.email,
        passwordHash: u.password_hash,
        salt: u.salt,
        isActive: u.is_active
      }));

      return { companies, people, tasks, templates, smtpConfig, agentQueue, users };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const content = await fs.promises.readFile(this.dbPath, 'utf-8');
      const data = JSON.parse(content) as DatabaseSchema;
      
      let changed = false;
      if (!data.users) {
        data.users = [
          {
            "id": "auth-admin",
            "personId": "usr-daniel",
            "email": "admin@hermes.com",
            "passwordHash": "77049f4b461e4cdc50cabdc6b4d3855f0f0e75ce8d68906c22204865ff0b8c9e7980c429b3d2e24d4369397265e84251216e3a94c694cc62fa55990dfeac59ac",
            "salt": "13397276ec2950ce2da61a7937d13dc8",
            "isActive": true
          }
        ];
        changed = true;
      }

      const hasDaniel = data.people.some(p => p.id === 'usr-daniel');
      if (!hasDaniel) {
        data.people.push({
          id: 'usr-daniel',
          name: 'Daniel',
          role: 'CEO',
          avatar: '/avatars/daniel.png'
        });
        changed = true;
      }

      if (changed) {
        const uniqueId = Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        const tempPath = `${this.dbPath}.${uniqueId}.tmp`;
        await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
        
        let retries = 5;
        while (retries > 0) {
          try {
            await fs.promises.rename(tempPath, this.dbPath);
            break;
          } catch (err) {
            retries--;
            if (retries === 0) {
              try {
                await fs.promises.unlink(tempPath);
              } catch (_) {}
              throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }
      }
      
      return data;
    } finally {
      release();
    }
  }

  // Raw write operation
  async writeData(data: DatabaseSchema): Promise<void> {
    if (supabase) {
      await this.ensureDatabase();
      if (data.companies && data.companies.length > 0) {
        await supabase.from('companies').upsert(data.companies);
      }
      if (data.people && data.people.length > 0) {
        const records = data.people.map(p => ({
          id: p.id,
          name: p.name,
          role: p.role,
          avatar: p.avatar,
          company_id: p.companyId || null
        }));
        await supabase.from('people').upsert(records);
      }
      if (data.tasks && data.tasks.length > 0) {
        const records = data.tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          type: t.type,
          repeat_pattern: t.repeatPattern || null,
          steps: t.steps || [],
          company_id: t.companyId || null,
          assignee_id: t.assigneeId || null,
          assignee_ids: t.assigneeIds || [],
          status: t.status,
          priority: t.priority,
          origin: t.origin,
          due_date: t.dueDate,
          attachments: t.attachments || [],
          activity_log: t.activityLog || []
        }));
        await supabase.from('tasks').upsert(records);
      }
      if (data.users && data.users.length > 0) {
        const records = data.users.map(u => ({
          id: u.id,
          person_id: u.personId,
          email: u.email,
          password_hash: u.passwordHash,
          salt: u.salt,
          is_active: u.isActive
        }));
        await supabase.from('users').upsert(records);
      }
      if (data.templates && data.templates.length > 0) {
        const records = data.templates.map(temp => ({
          id: temp.id,
          name: temp.name,
          subject: temp.subject,
          body: temp.body
        }));
        await supabase.from('email_templates').upsert(records);
      }
      if (data.smtpConfig) {
        const record = {
          id: 'default',
          host: data.smtpConfig.host,
          port: data.smtpConfig.port,
          secure: data.smtpConfig.secure,
          auth_user: data.smtpConfig.user,
          auth_pass: data.smtpConfig.pass
        };
        await supabase.from('smtp_config').upsert(record);
      }
      if (data.agentQueue && data.agentQueue.length > 0) {
        const records = data.agentQueue.map(q => ({
          id: q.id,
          task_id: q.taskId,
          command: q.command,
          payload: q.payload,
          status: q.status,
          timestamp: q.timestamp
        }));
        await supabase.from('agent_queue').upsert(records);
      }
      return;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Tasks
  async getTasks(): Promise<Task[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('tasks').select('*');
      if (error) throw error;
      return (data || []).map(t => {
        const { cleanDescription, metadata } = extractMeetingMetadata(t.description || '');
        return {
          id: t.id,
          title: t.title,
          description: cleanDescription,
          type: t.type as any,
          repeatPattern: t.repeat_pattern as any,
          steps: t.steps || [],
          companyId: t.company_id || '',
          assigneeId: t.assignee_id || '',
          assigneeIds: t.assignee_ids || [],
          status: t.status as any,
          priority: t.priority as any,
          origin: t.origin as any,
          dueDate: t.due_date,
          attachments: t.attachments || [],
          activityLog: t.activity_log || [],
          isMeeting: metadata.isMeeting || false,
          meetingTime: metadata.meetingTime || '',
          meetingAttendees: metadata.meetingAttendees || [],
          meetingConfirmations: metadata.meetingConfirmations || [],
          meetingLink: metadata.meetingLink || ''
        };
      });
    }

    const data = await this.readData();
    return data.tasks || [];
  }

  async getTaskById(id: string): Promise<Task | null> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { cleanDescription, metadata } = extractMeetingMetadata(data.description || '');
      return {
        id: data.id,
        title: data.title,
        description: cleanDescription,
        type: data.type as any,
        repeatPattern: data.repeat_pattern as any,
        steps: data.steps || [],
        companyId: data.company_id || '',
        assigneeId: data.assignee_id || '',
        assigneeIds: data.assignee_ids || [],
        status: data.status as any,
        priority: data.priority as any,
        origin: data.origin as any,
        dueDate: data.due_date,
        attachments: data.attachments || [],
        activityLog: data.activity_log || [],
        isMeeting: metadata.isMeeting || false,
        meetingTime: metadata.meetingTime || '',
        meetingAttendees: metadata.meetingAttendees || [],
        meetingConfirmations: metadata.meetingConfirmations || [],
        meetingLink: metadata.meetingLink || ''
      };
    }

    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async createTask(task: Omit<Task, 'id' | 'activityLog'>): Promise<Task> {
    if (supabase) {
      await this.ensureDatabase();
      const id = 't' + Math.random().toString(36).substring(2, 9);
      const activityLog = [{
        timestamp: new Date().toISOString(),
        user: 'System',
        action: 'Tarea creada',
        type: 'User' as const
      }];
      const finalDescription = injectMeetingMetadata(task.description, {
        isMeeting: task.isMeeting,
        meetingTime: task.meetingTime,
        meetingAttendees: task.meetingAttendees,
        meetingConfirmations: task.meetingConfirmations,
        meetingLink: task.meetingLink
      });
      const record = {
        id,
        title: task.title,
        description: finalDescription,
        type: task.type,
        repeat_pattern: task.repeatPattern || null,
        steps: task.steps || [],
        company_id: task.companyId || null,
        assignee_id: task.assigneeId || null,
        assignee_ids: task.assigneeIds || [],
        status: task.status,
        priority: task.priority,
        origin: task.origin,
        due_date: task.dueDate,
        attachments: task.attachments || [],
        activity_log: activityLog
      };
      const { error } = await supabase.from('tasks').insert(record);
      if (error) throw error;
      return { ...task, id, activityLog };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      
      const companyExists = data.companies.some(c => c.id === task.companyId);
      if (!companyExists) {
        throw new Error(`Foreign key constraint failed: Company with id "${task.companyId}" does not exist.`);
      }

      const assigneeExists = task.assigneeId ? data.people.some(p => p.id === task.assigneeId) : true;
      if (!assigneeExists) {
        throw new Error(`Foreign key constraint failed: Person with id "${task.assigneeId}" does not exist.`);
      }

      let maxIdNum = 0;
      data.tasks.forEach(t => {
        const matches = t.id.match(/^t(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const newId = `t${maxIdNum + 1}`;

      const newTask: Task = {
        ...task,
        id: newId,
        activityLog: [
          {
            timestamp: new Date().toISOString(),
            user: 'System',
            action: 'Tarea creada',
            type: 'User',
          }
        ]
      };

      data.tasks.push(newTask);
      await this.atomicWrite(data);
      return newTask;
    } finally {
      release();
    }
  }

  async updateTask(id: string, taskUpdates: Partial<Task>): Promise<Task> {
    if (supabase) {
      await this.ensureDatabase();
      const existing = await this.getTaskById(id);
      if (!existing) throw new Error(`Task with id ${id} not found`);

      const activityLog = [...(existing.activityLog || [])];
      
      let wasStatusRescheduled = false;
      const isCompleted = taskUpdates.status === 'Completed';
      const isRepetitive = existing.type === 'Repetitive' || (existing.type === 'Project' && existing.repeatPattern);

      if (isRepetitive && isCompleted) {
        wasStatusRescheduled = true;
        const currentDueDate = new Date(taskUpdates.dueDate || existing.dueDate || new Date());
        let nextDueDate = new Date(currentDueDate);

        const pattern = String(taskUpdates.repeatPattern || existing.repeatPattern || '').toLowerCase();
        if (pattern === 'daily') {
          const today = new Date();
          nextDueDate = new Date(today);
          nextDueDate.setDate(today.getDate() + 1);
        } else if (pattern === 'weekly') {
          nextDueDate.setDate(currentDueDate.getDate() + 7);
        } else if (pattern === 'monthly') {
          nextDueDate.setMonth(currentDueDate.getMonth() + 1);
        } else {
          nextDueDate.setDate(currentDueDate.getDate() + 7);
        }

        const nextDueDateStr = nextDueDate.toISOString().substring(0, 10);
        taskUpdates.dueDate = nextDueDateStr;
        taskUpdates.status = 'Pending';

        if (existing.type === 'Project' && Array.isArray(taskUpdates.steps || existing.steps)) {
          taskUpdates.steps = (taskUpdates.steps || existing.steps).map(step => ({
            ...step,
            completed: false,
            status: 'Pending'
          }));
        }

        activityLog.push({
          timestamp: new Date().toISOString(),
          user: 'System',
          action: `Ciclo completado. Programada automáticamente para el ${nextDueDateStr}${existing.type === 'Project' ? ' y checklist de pasos reiniciado.' : '.'}`,
          type: 'User',
        });
      } else {
        activityLog.push({
          timestamp: new Date().toISOString(),
          user: 'System',
          action: 'Tarea actualizada',
          type: 'User',
        });
      }

      // Merge meeting metadata
      const currentMetadata: MeetingMetadata = {
        isMeeting: taskUpdates.isMeeting !== undefined ? taskUpdates.isMeeting : existing.isMeeting,
        meetingTime: taskUpdates.meetingTime !== undefined ? taskUpdates.meetingTime : existing.meetingTime,
        meetingAttendees: taskUpdates.meetingAttendees !== undefined ? taskUpdates.meetingAttendees : existing.meetingAttendees,
        meetingConfirmations: taskUpdates.meetingConfirmations !== undefined ? taskUpdates.meetingConfirmations : existing.meetingConfirmations,
        meetingLink: taskUpdates.meetingLink !== undefined ? taskUpdates.meetingLink : existing.meetingLink,
      };

      const finalDescription = injectMeetingMetadata(
        taskUpdates.description !== undefined ? taskUpdates.description : existing.description,
        currentMetadata
      );

      const record: any = {
        activity_log: activityLog,
        description: finalDescription
      };
      if (taskUpdates.title !== undefined) record.title = taskUpdates.title;
      if (taskUpdates.type !== undefined) record.type = taskUpdates.type;
      if (taskUpdates.repeatPattern !== undefined) record.repeat_pattern = taskUpdates.repeatPattern;
      if (taskUpdates.steps !== undefined) record.steps = taskUpdates.steps;
      if (taskUpdates.companyId !== undefined) record.company_id = taskUpdates.companyId || null;
      if (taskUpdates.assigneeId !== undefined) record.assignee_id = taskUpdates.assigneeId || null;
      if (taskUpdates.assigneeIds !== undefined) record.assignee_ids = taskUpdates.assigneeIds;
      if (taskUpdates.status !== undefined) record.status = taskUpdates.status;
      if (taskUpdates.priority !== undefined) record.priority = taskUpdates.priority;
      if (taskUpdates.origin !== undefined) record.origin = taskUpdates.origin;
      if (taskUpdates.dueDate !== undefined) record.due_date = taskUpdates.dueDate;
      if (taskUpdates.attachments !== undefined) record.attachments = taskUpdates.attachments;

      const { error } = await supabase.from('tasks').update(record).eq('id', id);
      if (error) throw error;

      return {
        ...existing,
        ...taskUpdates,
        description: extractMeetingMetadata(finalDescription).cleanDescription,
        activityLog
      };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.tasks.findIndex(t => t.id === id);
      if (index === -1) {
        throw new Error(`Task with id "${id}" not found.`);
      }

      const existingTask = data.tasks[index];

      if (taskUpdates.companyId !== undefined) {
        const companyExists = data.companies.some(c => c.id === taskUpdates.companyId);
        if (!companyExists) {
          throw new Error(`Foreign key constraint failed: Company with id "${taskUpdates.companyId}" does not exist.`);
        }
      }

      if (taskUpdates.assigneeId !== undefined) {
        const assigneeExists = taskUpdates.assigneeId ? data.people.some(p => p.id === taskUpdates.assigneeId) : true;
        if (!assigneeExists) {
          throw new Error(`Foreign key constraint failed: Person with id "${taskUpdates.assigneeId}" does not exist.`);
        }
      }

      const updatedTask: Task = {
        ...existingTask,
        ...taskUpdates,
        id,
      };

      if (
        (updatedTask.type === 'Repetitive' || (updatedTask.type === 'Project' && updatedTask.repeatPattern)) &&
        taskUpdates.status === 'Completed'
      ) {
        const currentDueDate = new Date(updatedTask.dueDate || new Date());
        let nextDueDate = new Date(currentDueDate);

        const pattern = String(updatedTask.repeatPattern || '').toLowerCase();
        if (pattern === 'daily') {
          const today = new Date();
          nextDueDate = new Date(today);
          nextDueDate.setDate(today.getDate() + 1);
        } else if (pattern === 'weekly') {
          nextDueDate.setDate(currentDueDate.getDate() + 7);
        } else if (pattern === 'monthly') {
          nextDueDate.setMonth(currentDueDate.getMonth() + 1);
        } else {
          nextDueDate.setDate(currentDueDate.getDate() + 7);
        }

        const nextDueDateStr = nextDueDate.toISOString().substring(0, 10);
        updatedTask.dueDate = nextDueDateStr;
        updatedTask.status = 'Pending';

        if (updatedTask.type === 'Project' && Array.isArray(updatedTask.steps)) {
          updatedTask.steps = updatedTask.steps.map(step => ({
            ...step,
            completed: false,
            status: 'Pending'
          }));
        }

        if (!updatedTask.activityLog) {
          updatedTask.activityLog = [];
        }
        updatedTask.activityLog.push({
          timestamp: new Date().toISOString(),
          user: 'System',
          action: `Ciclo completado. Programada automáticamente para el ${nextDueDateStr}${updatedTask.type === 'Project' ? ' y checklist de pasos reiniciado.' : '.'}`,
          type: 'User',
        });
      } else {
        if (taskUpdates.activityLog === undefined) {
          if (!updatedTask.activityLog) {
            updatedTask.activityLog = [];
          }
          updatedTask.activityLog.push({
            timestamp: new Date().toISOString(),
            user: 'System',
            action: 'Tarea actualizada',
            type: 'User',
          });
        }
      }

      data.tasks[index] = updatedTask;
      await this.atomicWrite(data);
      return updatedTask;
    } finally {
      release();
    }
  }

  async deleteTask(id: string): Promise<boolean> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) return false;
      return true;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.tasks.findIndex(t => t.id === id);
      if (index === -1) {
        return false;
      }
      data.tasks.splice(index, 1);
      await this.atomicWrite(data);
      return true;
    } finally {
      release();
    }
  }

  async clearAllTasks(): Promise<void> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('tasks').delete().neq('id', '');
      if (error) throw error;
      return;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      data.tasks = [];
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('companies').select('*');
      if (error) throw error;
      return (data || []).map(c => ({ id: c.id, name: c.name }));
    }

    const data = await this.readData();
    return data.companies || [];
  }

  async createCompany(company: Omit<Company, 'id'>): Promise<Company> {
    if (supabase) {
      await this.ensureDatabase();
      const id = 'comp-' + Math.random().toString(36).substring(2, 9);
      const { error } = await supabase.from('companies').insert({ id, name: company.name });
      if (error) throw error;
      return { id, name: company.name };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const existing = data.companies.find(c => c.name.toLowerCase() === company.name.toLowerCase());
      if (existing) {
        return existing;
      }
      let maxIdNum = 0;
      data.companies.forEach(c => {
        const matches = c.id.match(/^(?:comp-|c)(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const newId = `comp-${maxIdNum + 1}`;
      const newCompany: Company = {
        id: newId,
        name: company.name
      };
      data.companies.push(newCompany);
      await this.atomicWrite(data);
      return newCompany;
    } finally {
      release();
    }
  }

  async deleteCompany(id: string): Promise<boolean> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) return false;
      return true;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.companies.findIndex(c => c.id === id);
      if (index === -1) {
        return false;
      }
      data.companies.splice(index, 1);
      await this.atomicWrite(data);
      return true;
    } finally {
      release();
    }
  }

  // People
  async getPeople(): Promise<Person[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('people').select('*');
      if (error) throw error;

      // Fetch availability templates
      const { data: availData, error: availError } = await supabase
        .from('email_templates')
        .select('*')
        .like('id', 'person_availability_%');

      const availMap: Record<string, any> = {};
      if (!availError && availData) {
        availData.forEach(t => {
          try {
            const pId = t.id.replace('person_availability_', '');
            availMap[pId] = JSON.parse(t.body);
          } catch (e) {
            console.error('Error parsing availability payload for template ' + t.id, e);
          }
        });
      }

      return (data || []).map(p => {
        const avail = availMap[p.id] || {};
        const getAvailField = (camelKey: string, snakeKey: string) => {
          if (avail[camelKey] !== undefined) return avail[camelKey];
          if (avail[snakeKey] !== undefined) return avail[snakeKey];
          if (p[camelKey] !== undefined) return p[camelKey];
          if (p[snakeKey] !== undefined) return p[snakeKey];
          return undefined;
        };

        return {
          id: p.id,
          name: p.name,
          role: p.role,
          avatar: p.avatar,
          companyId: p.company_id || undefined,
          workingHoursStart: getAvailField('workingHoursStart', 'working_hours_start'),
          workingHoursEnd: getAvailField('workingHoursEnd', 'working_hours_end'),
          timeOff: getAvailField('timeOff', 'time_off'),
          recurringDaysOff: getAvailField('recurringDaysOff', 'recurring_days_off'),
          lunchStart: getAvailField('lunchStart', 'lunch_start'),
          lunchEnd: getAvailField('lunchEnd', 'lunch_end')
        };
      });
    }

    const data = await this.readData();
    return data.people || [];
  }

  async createPerson(person: Omit<Person, 'id'>): Promise<Person> {
    if (supabase) {
      await this.ensureDatabase();
      const id = 'p' + Math.random().toString(36).substring(2, 9);
      const record = {
        id,
        name: person.name,
        role: person.role,
        avatar: person.avatar,
        company_id: person.companyId || null
      };
      const { error } = await supabase.from('people').insert(record);
      if (error) throw error;
      return { ...person, id };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const existing = data.people.find(p => p.name.toLowerCase() === person.name.toLowerCase());
      if (existing) {
        return existing;
      }
      let maxIdNum = 0;
      data.people.forEach(p => {
        const matches = p.id.match(/^(?:usr-|p)(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const newId = `usr-${maxIdNum + 1}`;
      const newPerson: Person = {
        id: newId,
        name: person.name,
        role: person.role || 'Member',
        avatar: person.avatar || '/avatars/user.png',
        companyId: person.companyId
      };
      data.people.push(newPerson);
      await this.atomicWrite(data);
      return newPerson;
    } finally {
      release();
    }
  }

  async updatePerson(id: string, personUpdates: Partial<Person>): Promise<Person> {
    if (supabase) {
      await this.ensureDatabase();
      const existing = await supabase.from('people').select('*').eq('id', id).maybeSingle();
      if (!existing.data) throw new Error(`Person with id ${id} not found`);
      
      const record: any = {};
      if (personUpdates.name !== undefined) record.name = personUpdates.name;
      if (personUpdates.role !== undefined) record.role = personUpdates.role;
      if (personUpdates.avatar !== undefined) record.avatar = personUpdates.avatar;
      if (personUpdates.companyId !== undefined) record.company_id = personUpdates.companyId || null;

      // Only write standard columns to the 'people' table in Supabase
      if (Object.keys(record).length > 0) {
        const { error } = await supabase.from('people').update(record).eq('id', id);
        if (error) throw error;
      }

      // Fetch existing availability metadata from email_templates to merge
      const { data: templateData } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', 'person_availability_' + id)
        .maybeSingle();

      let currentAvail: any = {};
      if (templateData && templateData.body) {
        try {
          currentAvail = JSON.parse(templateData.body);
        } catch {}
      }

      // Merge availability updates with casing normalization support
      const getUpdateField = (camelKey: string, snakeKey: string) => {
        if ((personUpdates as any)[camelKey] !== undefined) return (personUpdates as any)[camelKey];
        if ((personUpdates as any)[snakeKey] !== undefined) return (personUpdates as any)[snakeKey];
        return undefined;
      };

      const wStart = getUpdateField('workingHoursStart', 'working_hours_start');
      if (wStart !== undefined) currentAvail.workingHoursStart = wStart;

      const wEnd = getUpdateField('workingHoursEnd', 'working_hours_end');
      if (wEnd !== undefined) currentAvail.workingHoursEnd = wEnd;

      const tOff = getUpdateField('timeOff', 'time_off');
      if (tOff !== undefined) currentAvail.timeOff = tOff;

      const recOff = getUpdateField('recurringDaysOff', 'recurring_days_off');
      if (recOff !== undefined) currentAvail.recurringDaysOff = recOff;

      const lStart = getUpdateField('lunchStart', 'lunch_start');
      if (lStart !== undefined) currentAvail.lunchStart = lStart;

      const lEnd = getUpdateField('lunchEnd', 'lunch_end');
      if (lEnd !== undefined) currentAvail.lunchEnd = lEnd;

      // Save merged availability to email_templates
      const availRecord = {
        id: 'person_availability_' + id,
        name: 'Person Availability ' + id,
        subject: 'availability',
        body: JSON.stringify(currentAvail)
      };

      const { error: upsertError } = await supabase.from('email_templates').upsert(availRecord);
      if (upsertError) throw upsertError;

      return {
        id,
        name: personUpdates.name ?? existing.data.name,
        role: personUpdates.role ?? existing.data.role,
        avatar: personUpdates.avatar ?? existing.data.avatar,
        companyId: personUpdates.companyId !== undefined ? personUpdates.companyId : (existing.data.company_id || undefined),
        workingHoursStart: currentAvail.workingHoursStart,
        workingHoursEnd: currentAvail.workingHoursEnd,
        timeOff: currentAvail.timeOff,
        recurringDaysOff: currentAvail.recurringDaysOff,
        lunchStart: currentAvail.lunchStart,
        lunchEnd: currentAvail.lunchEnd
      };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.people.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error(`Person with id "${id}" not found.`);
      }

      const existingPerson = data.people[index];

      // Normalize snake_case updates to camelCase for the JSON DB as well
      const getUpdateField = (camelKey: string, snakeKey: string) => {
        if ((personUpdates as any)[camelKey] !== undefined) return (personUpdates as any)[camelKey];
        if ((personUpdates as any)[snakeKey] !== undefined) return (personUpdates as any)[snakeKey];
        return undefined;
      };

      const normalizedUpdates: any = {};
      const fields = [
        ['workingHoursStart', 'working_hours_start'],
        ['workingHoursEnd', 'working_hours_end'],
        ['timeOff', 'time_off'],
        ['recurringDaysOff', 'recurring_days_off'],
        ['lunchStart', 'lunch_start'],
        ['lunchEnd', 'lunch_end'],
        ['name', 'name'],
        ['role', 'role'],
        ['avatar', 'avatar'],
        ['companyId', 'company_id']
      ];

      fields.forEach(([camelKey, snakeKey]) => {
        const val = getUpdateField(camelKey, snakeKey);
        if (val !== undefined) {
          normalizedUpdates[camelKey] = val;
        }
      });

      const updatedPerson: Person = {
        ...existingPerson,
        ...normalizedUpdates,
        id,
      };

      data.people[index] = updatedPerson;
      await this.atomicWrite(data);
      return updatedPerson;
    } finally {
      release();
    }
  }

  async deletePerson(id: string): Promise<boolean> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('people').delete().eq('id', id);
      if (error) return false;
      return true;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.people.findIndex(p => p.id === id);
      if (index === -1) {
        return false;
      }
      data.people.splice(index, 1);
      await this.atomicWrite(data);
      return true;
    } finally {
      release();
    }
  }

  // Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('email_templates').select('*');
      if (error) throw error;
      return (data || []).map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body
      }));
    }

    const data = await this.readData();
    return data.templates || [];
  }

  async updateEmailTemplates(templates: EmailTemplate[]): Promise<void> {
    if (supabase) {
      await this.ensureDatabase();
      const records = templates.map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        body: t.body
      }));
      const { error } = await supabase.from('email_templates').upsert(records);
      if (error) throw error;
      return;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      data.templates = templates;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // SMTP Config
  async getSMTPConfig(): Promise<SMTPConfig> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('smtp_config').select('*').eq('id', 'default').maybeSingle();
      if (error) throw error;
      if (!data) return { host: '', port: 587, secure: false, user: '', pass: '' };
      return {
        host: data.host,
        port: data.port,
        secure: data.secure,
        user: data.auth_user,
        pass: data.auth_pass
      };
    }

    const data = await this.readData();
    return data.smtpConfig;
  }

  async updateSMTPConfig(config: SMTPConfig): Promise<void> {
    if (supabase) {
      await this.ensureDatabase();
      const record = {
        id: 'default',
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth_user: config.user,
        auth_pass: config.pass
      };
      const { error } = await supabase.from('smtp_config').upsert(record);
      if (error) throw error;
      return;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      data.smtpConfig = config;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // AI Config (Ollama)
  async getAIConfig(): Promise<AIConfig> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('email_templates').select('*').eq('id', 'ollama_ai_config').maybeSingle();
      if (error) throw error;
      if (!data) return { endpoint: '', apiKey: '', activeModel: '' };
      try {
        const payload = JSON.parse(data.body);
        return {
          endpoint: data.subject || '',
          apiKey: payload.apiKey || '',
          activeModel: payload.activeModel || ''
        };
      } catch {
        return { endpoint: data.subject || '', apiKey: '', activeModel: '' };
      }
    }

    const data = await this.readData();
    return data.aiConfig || { endpoint: '', apiKey: '', activeModel: '' };
  }

  async updateAIConfig(config: AIConfig): Promise<void> {
    if (supabase) {
      await this.ensureDatabase();
      const record = {
        id: 'ollama_ai_config',
        name: 'Ollama AI Config',
        subject: config.endpoint,
        body: JSON.stringify({
          apiKey: config.apiKey,
          activeModel: config.activeModel
        })
      };
      const { error } = await supabase.from('email_templates').upsert(record);
      if (error) throw error;
      return;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      data.aiConfig = config;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Agent Queue
  async pushToQueue(item: Omit<QueueItem, 'id' | 'status' | 'timestamp'>): Promise<QueueItem> {
    if (supabase) {
      await this.ensureDatabase();
      const id = 'q' + Math.random().toString(36).substring(2, 9);
      const timestamp = new Date().toISOString();
      const record = {
        id,
        task_id: item.taskId,
        command: item.command,
        payload: item.payload,
        status: 'Pending',
        timestamp
      };
      const { error } = await supabase.from('agent_queue').insert(record);
      if (error) throw error;
      return {
        id,
        taskId: item.taskId,
        command: item.command,
        payload: item.payload,
        status: 'Pending',
        timestamp
      };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      
      let maxIdNum = 0;
      data.agentQueue.forEach(q => {
        const matches = q.id.match(/^q(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const newId = `q${maxIdNum + 1}`;

      const newQueueItem: QueueItem = {
        ...item,
        id: newId,
        status: 'Pending',
        timestamp: new Date().toISOString(),
      };

      data.agentQueue.push(newQueueItem);
      await this.atomicWrite(data);
      return newQueueItem;
    } finally {
      release();
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('agent_queue').select('*');
      if (error) throw error;
      return (data || []).map(q => ({
        id: q.id,
        taskId: q.task_id,
        command: q.command,
        payload: q.payload,
        status: q.status as any,
        timestamp: q.timestamp
      }));
    }

    const data = await this.readData();
    return data.agentQueue || [];
  }

  async processQueueItem(id: string): Promise<boolean> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('agent_queue').update({ status: 'Processed' }).eq('id', id);
      if (error) return false;
      return true;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.agentQueue.findIndex(q => q.id === id);
      if (index === -1) {
        return false;
      }
      data.agentQueue[index].status = 'Processed';
      await this.atomicWrite(data);
      return true;
    } finally {
      release();
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        personId: u.person_id,
        email: u.email,
        passwordHash: u.password_hash,
        salt: u.salt,
        isActive: u.is_active
      }));
    }

    const data = await this.readData();
    return data.users || [];
  }

  async getUserById(id: string): Promise<User | null> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        personId: data.person_id,
        email: data.email,
        passwordHash: data.password_hash,
        salt: data.salt,
        isActive: data.is_active
      };
    }

    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    if (supabase) {
      await this.ensureDatabase();
      const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        personId: data.person_id,
        email: data.email,
        passwordHash: data.password_hash,
        salt: data.salt,
        isActive: data.is_active
      };
    }

    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(user: Omit<User, 'id' | 'passwordHash' | 'salt'> & { passwordPlain: string }): Promise<User> {
    if (supabase) {
      await this.ensureDatabase();
      const id = 'usr-' + Math.random().toString(36).substring(2, 9);
      const salt = generateSalt();
      const passwordHash = hashPassword(user.passwordPlain, salt);
      const record = {
        id,
        person_id: user.personId,
        email: user.email,
        password_hash: passwordHash,
        salt,
        is_active: user.isActive
      };
      const { error } = await supabase.from('users').insert(record);
      if (error) throw error;
      return {
        id,
        personId: user.personId,
        email: user.email,
        passwordHash,
        salt,
        isActive: user.isActive
      };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      
      if (!data.users) data.users = [];

      const emailExists = data.users.some(u => u.email.toLowerCase() === user.email.toLowerCase());
      if (emailExists) {
        throw new Error(`Email "${user.email}" is already registered.`);
      }

      const personExists = data.people.some(p => p.id === user.personId);
      if (!personExists) {
        throw new Error(`Foreign key constraint failed: Person with id "${user.personId}" does not exist.`);
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(user.passwordPlain, salt);

      let maxIdNum = 0;
      data.users.forEach(u => {
        const matches = u.id.match(/^auth-(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1], 10);
          if (num > maxIdNum) maxIdNum = num;
        }
      });
      const newId = `auth-${maxIdNum + 1}`;

      const newUser: User = {
        id: newId,
        personId: user.personId,
        email: user.email,
        passwordHash,
        salt,
        isActive: user.isActive !== undefined ? user.isActive : true
      };

      data.users.push(newUser);
      await this.atomicWrite(data);
      return newUser;
    } finally {
      release();
    }
  }

  async updateUser(id: string, userUpdates: Partial<User> & { passwordPlain?: string }): Promise<User> {
    if (supabase) {
      await this.ensureDatabase();
      const existing = await this.getUserById(id);
      if (!existing) throw new Error(`User with id ${id} not found`);

      const record: any = {};
      if (userUpdates.personId !== undefined) record.person_id = userUpdates.personId;
      if (userUpdates.email !== undefined) record.email = userUpdates.email;
      if (userUpdates.isActive !== undefined) record.is_active = userUpdates.isActive;
      
      let passwordHash = existing.passwordHash;
      let salt = existing.salt;
      if (userUpdates.passwordPlain !== undefined) {
        salt = generateSalt();
        passwordHash = hashPassword(userUpdates.passwordPlain, salt);
        record.password_hash = passwordHash;
        record.salt = salt;
      }

      const { error } = await supabase.from('users').update(record).eq('id', id);
      if (error) throw error;

      return {
        id,
        personId: userUpdates.personId ?? existing.personId,
        email: userUpdates.email ?? existing.email,
        passwordHash,
        salt,
        isActive: userUpdates.isActive ?? existing.isActive
      };
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      
      if (!data.users) data.users = [];
      const index = data.users.findIndex(u => u.id === id);
      if (index === -1) {
        throw new Error(`User credential record with id "${id}" not found.`);
      }

      const existingUser = data.users[index];

      if (userUpdates.email !== undefined && userUpdates.email.toLowerCase() !== existingUser.email.toLowerCase()) {
        const emailExists = data.users.some(u => u.email.toLowerCase() === userUpdates.email!.toLowerCase());
        if (emailExists) {
          throw new Error(`Email "${userUpdates.email}" is already registered.`);
        }
      }

      if (userUpdates.personId !== undefined) {
        const personExists = data.people.some(p => p.id === userUpdates.personId);
        if (!personExists) {
          throw new Error(`Foreign key constraint failed: Person with id "${userUpdates.personId}" does not exist.`);
        }
      }

      let passwordHash = existingUser.passwordHash;
      let salt = existingUser.salt;

      if (userUpdates.passwordPlain !== undefined) {
        salt = generateSalt();
        passwordHash = hashPassword(userUpdates.passwordPlain, salt);
      }

      const updatedUser: User = {
        ...existingUser,
        personId: userUpdates.personId !== undefined ? userUpdates.personId : existingUser.personId,
        email: userUpdates.email !== undefined ? userUpdates.email : existingUser.email,
        passwordHash,
        salt,
        isActive: userUpdates.isActive !== undefined ? userUpdates.isActive : existingUser.isActive,
        id 
      };

      data.users[index] = updatedUser;
      await this.atomicWrite(data);
      return updatedUser;
    } finally {
      release();
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    if (supabase) {
      await this.ensureDatabase();
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) return false;
      return true;
    }

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      if (!data.users) return false;
      const index = data.users.findIndex(u => u.id === id);
      if (index === -1) {
        return false;
      }
      data.users.splice(index, 1);
      await this.atomicWrite(data);
      return true;
    } finally {
      release();
    }
  }
}

// Export singleton instance as default
export const dbService = new DBService();
export default dbService;
