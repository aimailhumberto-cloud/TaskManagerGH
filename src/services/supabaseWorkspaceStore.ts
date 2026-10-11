import type { DatabaseSchema } from './mockData';
import { validateDatabase } from '../lib/localBackup';
import { WorkspaceError } from '../lib/projects';
import {workDataOnly,type OriginalAccounts} from './originalAccounts';

export interface WorkspaceSnapshot { version: 1; revision: number; data: DatabaseSchema }
export interface WorkspaceRpcClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
export class StorageConflict extends WorkspaceError {
  constructor() { super('La base cambió durante la operación. Recarga antes de reintentar; no se sobrescribieron datos.', 409); }
}

/** Server-only, explicit migration required. Never seeds or falls back to legacy tables. */
export class SupabaseWorkspaceStore {
  constructor(private readonly client: WorkspaceRpcClient,private readonly accounts?: OriginalAccounts) {}
  async read(): Promise<WorkspaceSnapshot> {
    const { data, error } = await this.client.rpc('tm_workspace_read_v1');
    if (error) throw new WorkspaceError('Supabase no disponible o migración no verificada. No se modificaron datos.', 503);
    const snapshot = data as WorkspaceSnapshot | null;
    if (!snapshot || snapshot.version !== 1 || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1) {
      throw new WorkspaceError('Snapshot Supabase ausente o incompatible. Se requiere migración explícita; no se inicializó una base vacía.', 503);
    }
    validateDatabase(snapshot.data);
    if(!this.accounts)return snapshot;
    const users=await this.accounts.profiles();
    return {...snapshot,data:{...workDataOnly(snapshot.data),users,smtpConfig:{host:'',port:587,secure:false,user:'',pass:''}}};
  }
  async commit(data: DatabaseSchema, expectedRevision: number): Promise<number> {
    validateDatabase(data);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new Error('Revisión de almacenamiento requerida.');
    const response = await this.client.rpc('tm_workspace_commit_v1', { p_expected_revision: expectedRevision, p_document: workDataOnly(data) });
    if (response.error) throw new WorkspaceError('No se confirmó la escritura Supabase. Recarga y verifica antes de reintentar.', 503);
    const result = response.data as { committed?: boolean; revision?: number } | null;
    if (result?.committed === false) throw new StorageConflict();
    if (result?.committed !== true || result.revision !== expectedRevision + 1) throw new WorkspaceError('Respuesta de escritura Supabase inválida. Verifica antes de reintentar.', 503);
    return result.revision;
  }
}
