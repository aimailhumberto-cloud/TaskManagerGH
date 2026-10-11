import { createHash } from 'node:crypto';
import { validateDatabase } from './localBackup';
import { auditUpgradeDatabase } from './deploymentPreparation';
import type { DatabaseSchema } from '../services/mockData';
import {workDataOnly} from '../services/originalAccounts';

const requiredTables = ['companies', 'people', 'tasks', 'email_templates', 'agent_queue', 'users'] as const;
type Row = Record<string, any>;
export interface VerifiedLegacyExport {
  format: 'taskmanager-work-export-v2';
  tables: Record<string, Row[]>;
  rowCounts: Record<string, number>;
}

/** Offline transformation only. Requires complete export + independently verified byte hash. */
export function prepareLegacyImport(bytes: Buffer, verifiedSha256: string) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (!/^[a-f0-9]{64}$/.test(verifiedSha256) || sha256 !== verifiedSha256) throw new Error('Respaldo no verificado; importación rechazada.');
  const source = JSON.parse(bytes.toString('utf8')) as VerifiedLegacyExport;
  if (source.format !== 'taskmanager-work-export-v2' || !source.tables || !source.rowCounts) throw new Error('Exportación exclusiva de datos de trabajo requerida.');
  if((source.tables.smtp_config?.length||0)>0||source.tables.email_templates?.some(row=>row.id==='ollama_ai_config'))throw new Error('La configuración debe permanecer en sus tablas originales.');
  if(JSON.stringify(source)!==JSON.stringify(workDataOnly({work:source}).work))throw new Error('El export contiene campos protegidos; no se preparó ninguna copia.');
  for (const table of requiredTables) {
    const rows = source.tables[table];
    if (!Array.isArray(rows) || !Number.isSafeInteger(source.rowCounts[table]) || rows.length !== source.rowCounts[table]) throw new Error(`Exportación incompleta: ${table}.`);
    if (rows.some(row => !row || typeof row.id !== 'string' || !row.id) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error(`Identificadores inválidos: ${table}.`);
  }
  const metadata = (description: string) => {
    const match = description.match(/<!-- HERMES_MEETING_METADATA: (.*?) -->/);
    if (!match) return { cleanDescription: description, metadata: {} };
    const value = JSON.parse(match[1]);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Metadata de tarea inválida.');
    // Never allow metadata to override identity/company/status from the source row.
    return { cleanDescription: description.replace(match[0], '').trim(), metadata: value };
  };
  const data: DatabaseSchema = {
    companies: source.tables.companies.map(row => ({ ...row, id: row.id, name: row.name })),
    people: source.tables.people.map(row => ({ ...row, id: row.id, name: row.name, role: row.role, avatar: row.avatar, companyId: row.company_id || undefined })),
    tasks: source.tables.tasks.map(row => {
      const parsed = metadata(row.description || '');
      return { ...row, ...parsed.metadata, id: row.id, title: row.title, description: parsed.cleanDescription,
        type: row.type, repeatPattern: row.repeat_pattern || undefined, steps: row.steps || [],
        companyId: row.company_id || '', assigneeId: row.assignee_id || '', assigneeIds: row.assignee_ids || [],
        status: row.status, priority: row.priority, origin: row.origin, dueDate: row.due_date || '',
        attachments: row.attachments || [], activityLog: row.activity_log || [] };
    }),
    users: source.tables.users.map(row => ({id:row.id,personId:row.person_id,email:row.email,passwordHash:'',salt:'',isActive:row.is_active})),
    templates: source.tables.email_templates.filter(row => row.id !== 'ollama_ai_config').map(row => ({ ...row, id: row.id, name: row.name, subject: row.subject, body: row.body })),
    smtpConfig: {host:'',port:587,secure:false,user:'',pass:''},
    agentQueue: source.tables.agent_queue.map(row => ({ ...row, id: row.id, taskId: row.task_id, command: row.command, payload: row.payload, status: row.status, timestamp: row.timestamp })),
    projects: [], reminders: [], decisions: [], dayPlans: [], automations: [], heroPreferences: [], appliedOperations: [],
  };
  validateDatabase(data);
  const audit = auditUpgradeDatabase(data);
  return { format: 'taskmanager-workspace-import-v1', migrationVersion: 1, sourceSha256: sha256,
    sourceRowCounts: source.rowCounts, data:workDataOnly(data), legacySource: source, audit,
    readyForProduction: false, requires: ['Real schema and complete backup validation', 'Explicit owner/user mapping', 'Isolated restore rehearsal', 'Freeze legacy writers before cutover'], externalActions: false };
}
