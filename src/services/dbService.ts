import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { supabase } from './supabaseClient';
import { SupabaseWorkspaceStore } from './supabaseWorkspaceStore';
import { validateDatabase, createBackup } from '@/lib/localBackup';
import { pickPersonalFields, PersonalTaskFields } from '@/lib/personalTasks';
import {
  Company,
  Person,
  Step,
  Attachment,
  LogEntry,
  Comment,
  Task,
  EmailTemplate,
  SMTPConfig,
  AIConfig,
  QueueItem,
  User,
  DatabaseSchema,
} from './mockData';

// Re-export the types as specified in PROJECT.md
export type {
  Company,
  Person,
  Step,
  Attachment,
  LogEntry,
  Comment,
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

export interface MeetingMetadata extends PersonalTaskFields {
  isMeeting?: boolean;
  meetingTime?: string;
  meetingAttendees?: string[];
  meetingConfirmations?: string[];
  meetingLink?: string;
  comments?: Comment[];
  completedDays?: string[];
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
  if (
    Object.keys(pickPersonalFields(metadata)).length > 0 ||
    metadata.isMeeting ||
    metadata.meetingTime ||
    (metadata.meetingAttendees && metadata.meetingAttendees.length > 0) ||
    (metadata.comments && metadata.comments.length > 0) ||
    (metadata.completedDays && metadata.completedDays.length > 0)
  ) {
    const jsonStr = JSON.stringify(metadata);
    return `${cleanDescription}\n\n<!-- HERMES_MEETING_METADATA: ${jsonStr} -->`;
  }
  return cleanDescription;
}

export interface DayPlanBlock {
  id: string;
  title: string;
  start: string;
  end: string;
  type: 'task' | 'meeting' | 'personal';
  taskId?: string;
}

export function extractDayPlan(description: string): DayPlanBlock[] {
  if (!description) {
    return [];
  }
  const match = description.match(/<!-- HERMES_DAY_PLAN: (.*?) -->/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error('Error parsing day plan from description:', e);
    }
  }
  return [];
}

export function injectDayPlan(description: string, plan: DayPlanBlock[]): string {
  const clean = (description || '').replace(/<!-- HERMES_DAY_PLAN: (.*?) -->/g, '').trim();
  const jsonStr = JSON.stringify(plan);
  return `${clean}\n\n<!-- HERMES_DAY_PLAN: ${jsonStr} -->`;
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
  constructor(private lockPath?: string) {}

  async acquire(): Promise<() => void> {
    let release: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const currentPromise = this.promise;
    this.promise = nextPromise;
    await currentPromise;
    if (!this.lockPath) return release!;
    const started = Date.now();
    let descriptor: number;
    try {
      while (true) {
        try { descriptor = fs.openSync(this.lockPath, 'wx', 0o600); break; }
        catch (error: any) {
          if (error.code !== 'EEXIST' || Date.now() - started > 5000) throw new Error('Base ocupada o no disponible. Reintenta; no se modificaron datos.');
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      }
    } catch (error) { release!(); throw error; }
    return () => {
      try { fs.closeSync(descriptor); fs.unlinkSync(this.lockPath!); }
      finally { release!(); }
    };
  }
}

export class DBService implements IDBService {
  private dbPath: string;
  private mutex: AsyncMutex;

  private remote: SupabaseWorkspaceStore | null;
  private remoteRevision = 0;
  private readRevisions = new WeakMap<DatabaseSchema, number>();

  constructor(remote?: SupabaseWorkspaceStore | null) {
    this.remote = remote === undefined ? (supabase ? new SupabaseWorkspaceStore(supabase) : null) : remote;
    this.dbPath = process.env.DATABASE_PATH || 'data/db.json';
    this.mutex = new AsyncMutex(this.remote ? undefined : this.dbPath + '.lock');
  }

  /**
   * Validate existing storage. Initialization and restore are explicit operations.
   */
  private async ensureDatabase(): Promise<void> {
    if (this.remote) return; // Initialization/migrations are never triggered by a read.
    const content = await fs.promises.readFile(this.dbPath, 'utf-8');
    validateDatabase(JSON.parse(content)); // Fail closed; preserve missing/corrupt data.
  }

  async transaction<T>(change: (data: DatabaseSchema) => T | Promise<T>): Promise<T> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
      const original = JSON.stringify(data);
      const result = await change(data);
      if (JSON.stringify(data) !== original) await this.atomicWrite(data);
      return result;
    } finally { release(); }
  }

  private async readStorage(): Promise<DatabaseSchema> {
    if (this.remote) {
      const snapshot = await this.remote.read();
      this.remoteRevision = snapshot.revision;
      this.readRevisions.set(snapshot.data, snapshot.revision);
      return snapshot.data;
    }
    return JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
  }

  private async atomicWrite(data: DatabaseSchema): Promise<void> {
    if (this.remote) {
      this.remoteRevision = await this.remote.commit(data, this.remoteRevision);
      this.readRevisions.set(data, this.remoteRevision);
      return;
    }
    validateDatabase(data);
    if (fs.existsSync(this.dbPath)) await createBackup(this.dbPath);

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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();

      return data;
    } finally {
      release();
    }
  }

  // Raw write operation
  async writeData(data: DatabaseSchema): Promise<void> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      if (this.remote) {
        const revision = this.readRevisions.get(data);
        if (revision === undefined) throw new Error('Escritura sin snapshot de lectura rechazada. Usa transaction.');
        this.remoteRevision = revision;
      }
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Tasks
  async getTasks(): Promise<Task[]> {

    const data = await this.readData();
    return data.tasks || [];
  }

  async getTaskById(id: string): Promise<Task | null> {

    const tasks = await this.getTasks();
    return tasks.find(t => t.id === id) || null;
  }

  async createTask(task: Omit<Task, 'id' | 'activityLog'>): Promise<Task> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();

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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
      data.tasks = [];
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Companies
  async getCompanies(): Promise<Company[]> {

    const data = await this.readData();
    return data.companies || [];
  }

  async createCompany(company: Omit<Company, 'id'>): Promise<Company> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const data = await this.readData();
    return data.people || [];
  }

  async createPerson(person: Omit<Person, 'id'>): Promise<Person> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const data = await this.readData();
    return data.templates || [];
  }

  async updateEmailTemplates(templates: EmailTemplate[]): Promise<void> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
      data.templates = templates;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // SMTP Config
  async getSMTPConfig(): Promise<SMTPConfig> {

    const data = await this.readData();
    return data.smtpConfig;
  }

  async updateSMTPConfig(config: SMTPConfig): Promise<void> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
      data.smtpConfig = config;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // AI Config (Ollama)
  async getAIConfig(): Promise<AIConfig> {

    const data = await this.readData();
    return data.aiConfig || { endpoint: '', apiKey: '', activeModel: '' };
  }

  async updateAIConfig(config: AIConfig): Promise<void> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
      data.aiConfig = config;
      await this.atomicWrite(data);
    } finally {
      release();
    }
  }

  // Agent Queue
  async pushToQueue(item: Omit<QueueItem, 'id' | 'status' | 'timestamp'>): Promise<QueueItem> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();

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

    const data = await this.readData();
    return data.agentQueue || [];
  }

  async processQueueItem(id: string): Promise<boolean> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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

    const data = await this.readData();
    return data.users || [];
  }

  async getUserById(id: string): Promise<User | null> {

    const users = await this.getUsers();
    return users.find(u => u.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {

    const users = await this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async createUser(user: Omit<User, 'id' | 'passwordHash' | 'salt'> & { passwordPlain: string }): Promise<User> {

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();

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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();

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

    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = await this.readStorage();
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
