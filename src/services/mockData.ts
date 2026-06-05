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
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

export interface AIConfig {
  endpoint: string;
  apiKey: string;
  activeModel: string;
}

export interface QueueItem {
  id: string;
  taskId: string;
  command: string;
  payload: any;
  status: 'Pending' | 'Processed';
  timestamp: string;
}

export interface User {
  id: string;
  personId: string;
  email: string;
  passwordHash: string;
  salt: string;
  isActive: boolean;
}

export interface DatabaseSchema {
  companies: Company[];
  people: Person[];
  tasks: Task[];
  templates: EmailTemplate[];
  smtpConfig: SMTPConfig;
  aiConfig?: AIConfig;
  agentQueue: QueueItem[];
  users: User[];
}

export const initialData: DatabaseSchema = {
  companies: [
    { id: "comp-1", name: "Mahana Casa" },
    { id: "comp-2", name: "Golden Hour" },
    { id: "c1", name: "ACME Corp" },
    { id: "c2", name: "Stark Industries" }
  ],
  people: [
    { id: "usr-1", name: "Tú", role: "Admin", avatar: "/avatars/user.png" },
    { id: "p3", name: "Hermes AI", role: "AIAgent", avatar: "/avatars/hermes.png" },
    { id: "p1", name: "Alice Smith", role: "Admin", avatar: "/avatars/alice.png" },
    { id: "p2", name: "Bob Jones", role: "Member", avatar: "/avatars/bob.png" },
    { id: "usr-daniel", name: "Daniel", role: "CEO", companyId: undefined, avatar: "/avatars/daniel.png" },
    { id: "usr-elena", name: "Elena", role: "Gerente", companyId: "c1", avatar: "/avatars/elena.png" },
    { id: "usr-carlos", name: "Carlos", role: "Tercero / Externo", companyId: "c1", avatar: "/avatars/carlos.png" }
  ],
  tasks: [
    {
      id: "t1",
      title: "Verificar cadena de suministro",
      description: "# Verificar cadena de suministro\nTesting title validation",
      type: "One-shot",
      steps: [],
      companyId: "c1",
      assigneeId: "p2",
      status: "Pending",
      priority: "Medium",
      origin: "Golden Hour",
      dueDate: "2026-06-05",
      attachments: [],
      activityLog: []
    }
  ],
  templates: [
    {
      id: "tpl1",
      name: "Notificación de Asignación",
      subject: "Nueva tarea asignada: {{task_title}}",
      body: "Hola {{assignee_name}},\n\nSe te ha asignado la tarea '{{task_title}}' con fecha límite {{due_date}}.\n\nSaludos,\nEquipo Golden Hour"
    }
  ],
  smtpConfig: {
    "host": "smtp.mailtrap.io",
    "port": 587,
    "secure": false,
    "user": "user_id",
    "pass": "password_id"
  },
  agentQueue: [],
  users: [
    {
      "id": "auth-admin",
      "personId": "usr-daniel",
      "email": "admin@hermes.com",
      "passwordHash": "77049f4b461e4cdc50cabdc6b4d3855f0f0e75ce8d68906c22204865ff0b8c9e7980c429b3d2e24d4369397265e84251216e3a94c694cc62fa55990dfeac59ac",
      "salt": "13397276ec2950ce2da61a7937d13dc8",
      "isActive": true
    }
  ]
};
