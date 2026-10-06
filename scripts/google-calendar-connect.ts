import { hasAdministrationCapability } from '../src/lib/capabilities';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { credentialVault, parseDesktopClient, authorizeDesktop, readPrimaryCalendar, windowsVault } from '../src/lib/googleCalendar';
import { createBackup } from '../src/lib/localBackup';

async function main() {
  if (process.platform !== 'win32' || ['.env', '.env.local'].some(existsSync)) throw new Error('Ejecuta solo en la copia local aislada de Windows.');
  for (const key of Object.keys(process.env)) if (/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE/i.test(key)) delete process.env[key];
  process.env.DATABASE_PATH = resolve('.local-data/preview.json'); process.env.TASKMANAGER_LOCAL_ONLY = '1';
  // Removing this exact application credential does not revoke the Google grant.
  if (process.argv.includes('--forget-local-access')) { await windowsVault('delete'); console.log('Acceso local eliminado. Revoca además TaskManager HB en tu cuenta Google si deseas cerrar el grant. Tareas y avisos intactos.'); return; }
  const { dbService } = await import('../src/services/dbService');
  const before = await dbService.readData();
  const ownerIndex = process.argv.indexOf('--owner');
  const requestedOwner = ownerIndex >= 0 ? process.argv[ownerIndex + 1] : undefined;
  const admins = before.users.filter(u => u.isActive && before.people.some(p => p.id === u.personId && hasAdministrationCapability(p.role)));
  const ownerId = requestedOwner || (admins.length === 1 ? admins[0].personId : undefined);
  if (!ownerId || !admins.some(u => u.personId === ownerId)) throw new Error('Indica --owner con el identificador de un administrador activo verificado.');
  let grant = await credentialVault.read();
  if (grant && grant.ownerId !== ownerId) throw new Error('El acceso existente pertenece a otra identidad; no se reasigna.');
  const clientIndex = process.argv.indexOf('--client');
  if (clientIndex >= 0) {
    const filename = process.argv[clientIndex + 1]; if (!filename) throw new Error('Indica el archivo JSON descargado de Google; no pegues su contenido en chat.');
    const bytes = await readFile(resolve(filename)); if (bytes.length > 64000) throw new Error('Archivo de cliente inesperadamente grande.');
    let payload: unknown; try { payload = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('El archivo de cliente no es JSON válido. No se muestra su contenido.'); }
    const configured = parseDesktopClient(payload, ownerId);
    if (grant?.refreshToken && grant.clientId !== configured.clientId) throw new Error('Ya existe otro cliente autorizado. No se reemplaza automáticamente.');
    if (!grant?.refreshToken) { grant = configured; await credentialVault.write(grant); }
    console.log('Cliente de escritorio preparado en Windows Credential Manager. No se muestra ni copia ningún secreto al repositorio.');
  }
  if (!grant) throw new Error('BLOQUEO: falta cliente OAuth propio. HB: crea/selecciona TaskManager HB (local), tipo Escritorio, en tu proyecto Google Cloud sin facturación; descarga su JSON en esta computadora y ejecuta este comando con --client y la ruta. No envíes el JSON por chat.');
  if (process.argv.includes('--configure-only')) { console.log('Configuración local preparada; no se inició consentimiento ni se leyó el calendario.'); return; }
  const { importCalendarSnapshot } = await import('../src/services/planningService');
  if (!grant.refreshToken || process.argv.includes('--reauthorize')) {
    if (process.argv.includes('--sync-only')) throw new Error('Falta consentimiento persistente. Ejecuta el comando sin --sync-only y confirma en Google.');
    grant = await authorizeDesktop(grant, url => {
      console.log('Confirma en el navegador la cuenta hebouche@gmail.com, TaskManager HB y solo lectura de eventos propios. Si muestra más permisos o otra identidad, cancela.');
      // The URL contains a one-time state but no token/client secret; not saved in logs.
      const encoded = Buffer.from("Start-Process -FilePath '" + url.replace(/'/g, "''") + "'", 'utf16le').toString('base64');
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true, stdio: 'ignore' });
      child.on('error', () => console.log('No se pudo abrir el navegador. Repite desde una sesión Windows interactiva.'));
    });
  }
  const backup = await createBackup(process.env.DATABASE_PATH);
  const snapshot = await readPrimaryCalendar(grant); await importCalendarSnapshot(snapshot);
  const after = await dbService.readData();
  if (JSON.stringify(before.tasks) !== JSON.stringify(after.tasks) || JSON.stringify(before.projects) !== JSON.stringify(after.projects) || JSON.stringify(before.reminders) !== JSON.stringify(after.reminders)) throw new Error('Verificación de conservación fallida. Revisa el respaldo antes de continuar.');
  const reread = await credentialVault.read();
  if (!reread?.refreshToken || reread.clientId !== grant.clientId) throw new Error('No se verificó la persistencia protegida.');
  const report = { operation: 'own-oauth-primary-readonly', verifiedAt: snapshot.verifiedAt, events: snapshot.events.length, taskCount: after.tasks.length, reminderCount: after.reminders?.length || 0, persistedInWindows: true, backup, calendarId: 'primary', scope: grant.scope, backgroundDelivery: false };
  await writeFile('.local-data/google-calendar-operation-report.json', JSON.stringify(report, null, 2));
  console.log(`LECTURA REAL VERIFICADA: ${snapshot.events.length} eventos de primary; acceso persistente protegido; tareas y único aviso conservados. Abre http://127.0.0.1:3011/agenda. Repite --sync-only en una nueva consola para verificar tras reinicio.`);
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'No se completó la conexión.'); process.exitCode = 1; });
