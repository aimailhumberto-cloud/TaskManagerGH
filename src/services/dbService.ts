import * as fs from 'fs';
import * as path from 'path';
import {
  Company,
  Person,
  Step,
  Attachment,
  LogEntry,
  Task,
  EmailTemplate,
  SMTPConfig,
  QueueItem,
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
  QueueItem,
  DatabaseSchema,
};

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
  pushToQueue(item: Omit<QueueItem, 'id' | 'status' | 'timestamp'>): Promise<QueueItem>;
  getQueue(): Promise<QueueItem[]>;
  processQueueItem(id: string): Promise<boolean>;
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
   * This is internal, but must be called within any operations or during readData.
   */
  private async ensureDatabase(): Promise<void> {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    if (!fs.existsSync(this.dbPath)) {
      // Seed initial data
      await this.atomicWrite(initialData);
      return;
    }

    // Try parsing
    try {
      const content = await fs.promises.readFile(this.dbPath, 'utf-8');
      JSON.parse(content);
    } catch (e) {
      // Database corrupted! Backup and re-seed.
      const timestamp = Date.now();
      const corruptPath = `${this.dbPath}.corrupt_${timestamp}`;
      try {
        await fs.promises.rename(this.dbPath, corruptPath);
      } catch (renameErr) {
        // Fallback: copy and write
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
    
    // Windows friendly retry loop for rename
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
      const content = await fs.promises.readFile(this.dbPath, 'utf-8');
      return JSON.parse(content) as DatabaseSchema;
    } finally {
      release();
    }
  }

  // Raw write operation
  async writeData(data: DatabaseSchema): Promise<void> {
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
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      
      // Validate relational integrity
      const companyExists = data.companies.some(c => c.id === task.companyId);
      if (!companyExists) {
        throw new Error(`Foreign key constraint failed: Company with id "${task.companyId}" does not exist.`);
      }

      const assigneeExists = task.assigneeId ? data.people.some(p => p.id === task.assigneeId) : true;
      if (!assigneeExists) {
        throw new Error(`Foreign key constraint failed: Person with id "${task.assigneeId}" does not exist.`);
      }

      // Generate incremental/unique ID
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
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.tasks.findIndex(t => t.id === id);
      if (index === -1) {
        throw new Error(`Task with id "${id}" not found.`);
      }

      const existingTask = data.tasks[index];

      // Validate relational integrity
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

      // Prepare updated task
      const updatedTask: Task = {
        ...existingTask,
        ...taskUpdates,
        id, // secure ID is unchanged
      };

      // Recurrence Auto-Rescheduler for Repetitive tasks or Projects with repeatPattern
      if (
        (updatedTask.type === 'Repetitive' || (updatedTask.type === 'Project' && updatedTask.repeatPattern)) &&
        taskUpdates.status === 'Completed'
      ) {
        const todayStr = new Date().toISOString().substring(0, 10);
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
          nextDueDate.setDate(currentDueDate.getDate() + 7); // Default to weekly
        }

        const nextDueDateStr = nextDueDate.toISOString().substring(0, 10);
        updatedTask.dueDate = nextDueDateStr;
        updatedTask.status = 'Pending'; // Reset to pending for the next cycle

        // If it is a Project with steps, reset all steps to Pending / uncompleted
        if (updatedTask.type === 'Project' && Array.isArray(updatedTask.steps)) {
          updatedTask.steps = updatedTask.steps.map(step => ({
            ...step,
            completed: false,
            status: 'Pending'
          }));
        }

        // Add System log for auto-rescheduling
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
        // Append standard log entry if any significant update occurs
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
    const data = await this.readData();
    return data.companies || [];
  }

  async createCompany(company: Omit<Company, 'id'>): Promise<Company> {
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
    const data = await this.readData();
    return data.people || [];
  }

  async createPerson(person: Omit<Person, 'id'>): Promise<Person> {
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
    const release = await this.mutex.acquire();
    try {
      await this.ensureDatabase();
      const data = JSON.parse(await fs.promises.readFile(this.dbPath, 'utf-8')) as DatabaseSchema;
      const index = data.people.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error(`Person with id "${id}" not found.`);
      }

      const existingPerson = data.people[index];

      // Prepare updated person
      const updatedPerson: Person = {
        ...existingPerson,
        ...personUpdates,
        id, // secure ID is unchanged
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
    const data = await this.readData();
    return data.templates || [];
  }

  async updateEmailTemplates(templates: EmailTemplate[]): Promise<void> {
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
    const data = await this.readData();
    return data.smtpConfig;
  }

  async updateSMTPConfig(config: SMTPConfig): Promise<void> {
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

  // Agent Queue
  async pushToQueue(item: Omit<QueueItem, 'id' | 'status' | 'timestamp'>): Promise<QueueItem> {
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
    const data = await this.readData();
    return data.agentQueue || [];
  }

  async processQueueItem(id: string): Promise<boolean> {
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
}

// Export singleton instance as default
export const dbService = new DBService();
export default dbService;
