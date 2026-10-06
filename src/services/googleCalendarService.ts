import { credentialVault, CALENDAR_SCOPE, readPrimaryCalendar, type GrantVault } from '@/lib/googleCalendar';
import { importCalendarSnapshot } from './planningService';
import { dbService } from './dbService';

const MIN_INTERVAL = 5 * 60 * 1000;
let running: Promise<any> | null = null;
let attemptedAt = 0;
let failure = '';
export async function calendarConnection(ownerId: string, vault: GrantVault = credentialVault) {
  if (process.env.TASKMANAGER_LOCAL_ONLY !== '1') return { clientConfigured: false, appAuthorized: false, connectionError: 'Conexión habilitada únicamente en la copia local.' };
  try {
    const grant = await vault.read();
    return { clientConfigured: !!grant?.clientId, appAuthorized: !!grant?.refreshToken && grant.scope === CALENDAR_SCOPE && grant.ownerId === ownerId, connectionError: failure };
  } catch { return { clientConfigured: false, appAuthorized: false, connectionError: 'No se pudo consultar el acceso protegido de Windows. Se conserva la lectura anterior.' }; }
}
export async function synchronizeCalendar(ownerId: string, vault: GrantVault = credentialVault, fetcher: typeof fetch = fetch) {
  if (process.env.TASKMANAGER_LOCAL_ONLY !== '1' || !ownerId) throw new Error('La conexión pertenece al espacio local de Humberto.');
  const grant = await vault.read();
  if (grant && grant.ownerId !== ownerId) throw new Error('El acceso pertenece a otra identidad; no se reasigna.');
  if (!grant?.refreshToken || grant.scope !== CALENDAR_SCOPE || grant.ownerId !== ownerId) throw new Error('TaskManager no tiene autorización propia. HB debe preparar un cliente OAuth de escritorio y confirmar el permiso en Google.');
  if (running) return running;
  if (Date.now() - attemptedAt < MIN_INTERVAL) {
    if (failure) throw new Error(failure + ' El próximo intento se permite al terminar cinco minutos.');
    return (await dbService.readData()).calendarSnapshot || null;
  }
  running = (async () => {
    attemptedAt = Date.now();
    try {
      const snapshot = await readPrimaryCalendar(grant, vault, fetcher);
      await importCalendarSnapshot(snapshot); failure = ''; return snapshot;
    } catch (e) { failure = e instanceof Error ? e.message : 'No se pudo sincronizar. Se conserva la lectura anterior.'; throw new Error(failure); }
  })();
  try { return await running; } finally { running = null; }
}
