import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { CalendarSnapshot } from './planning';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.owned.readonly';
export const VAULT_TARGET = 'TaskManagerHB/GoogleCalendar/primary';
export const EXPECTED_GOOGLE_ACCOUNT = 'hebouche@gmail.com';
export interface CalendarGrant {
  clientId: string; clientSecret: string; refreshToken?: string; scope?: string;
  ownerId: string; authorizedAt?: string;
}
export interface GrantVault { read(): Promise<CalendarGrant | null>; write(value: CalendarGrant): Promise<void> }
export async function windowsVault(action: 'read' | 'write' | 'delete', value?: CalendarGrant, target = VAULT_TARGET): Promise<any> {
  if (process.platform !== 'win32') throw new Error('Esta conexión necesita Windows Credential Manager; no se guardan secretos en archivos.');
  // Execute reviewed helper code as a command, without changing Windows execution policy.
  // Only helper code is in the command line; credentials remain on stdin.
  const helper = await readFile(resolve('scripts/windows-calendar-vault.ps1'), 'utf8');
  const encodedHelper = Buffer.from(helper, 'utf16le').toString('base64');
  const vaultTemp = resolve('.local-data/temp'); await mkdir(vaultTemp, { recursive: true });
  return new Promise((done, fail) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedHelper], { windowsHide: true, env: { ...process.env, TMP: vaultTemp, TEMP: vaultTemp }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = ''; let oversized = false;
    const timer = setTimeout(() => { child.kill(); fail(new Error('Windows Credential Manager no respondió.')); }, 15000);
    child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { out += chunk; if (out.length > 8192) { oversized = true; child.kill(); } });
    // PowerShell errors may contain input; never expose its stderr.
    child.stderr.resume(); child.on('error', () => { clearTimeout(timer); fail(new Error('Windows Credential Manager no disponible.')); });
    child.on('close', code => { clearTimeout(timer); if (code || oversized) return fail(new Error('Windows Credential Manager no disponible; no se guardaron credenciales en archivos.')); try { done(JSON.parse(out)); } catch { fail(new Error('No se pudo leer el acceso protegido.')); } });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ action, target, ...(value ? { value: JSON.stringify(value) } : {}) }));
  });
}
export const credentialVault: GrantVault = { read: () => windowsVault('read'), write: async value => { await windowsVault('write', value); } };
export function parseDesktopClient(input: any, ownerId: string): CalendarGrant {
  if (!ownerId?.trim()) throw new Error('Propietario verificado requerido.');
  const c = input?.installed;
  if (!c || typeof c.client_id !== 'string' || !/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(c.client_id) || typeof c.client_secret !== 'string' || !c.client_secret || c.client_secret.length > 500) throw new Error('Descarga un cliente OAuth de tipo Escritorio de Google Cloud. No pegues credenciales en el chat.');
  return { clientId: c.client_id, clientSecret: c.client_secret, ownerId };
}
export function oauthRequest(clientId: string, redirect: string) {
  const uri = new URL(redirect);
  if (uri.protocol !== 'http:' || uri.hostname !== '127.0.0.1' || !uri.port || uri.pathname !== '/' || uri.search || uri.hash) throw new Error('Callback loopback inválido.');
  const verifier = randomBytes(48).toString('base64url'); const state = randomBytes(32).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: CALENDAR_SCOPE, access_type: 'offline', prompt: 'consent select_account', login_hint: EXPECTED_GOOGLE_ACCOUNT, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state, include_granted_scopes: 'false' }).toString();
  return { verifier, state, url: url.toString() };
}
type Fetcher = typeof fetch;
async function googleJson(url: string, init: RequestInit, fetcher: Fetcher) {
  let response: Response;
  try { response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) }); }
  catch { throw new Error('No se pudo contactar a Google. Se conserva la lectura anterior.'); }
  let body: any; try { body = await response.json(); } catch { throw new Error('Respuesta de Google no válida; se conserva la lectura anterior.'); }
  if (!response.ok) {
    if (body?.error === 'invalid_grant' || response.status === 401) throw new Error('Acceso Google caducado o revocado. Vuelve a autorizar; se conserva la lectura anterior.');
    if ([403, 429].includes(response.status)) throw new Error('Google bloqueó la lectura por permisos o cuota. No se amplían permisos ni se activa facturación.');
    throw new Error('Google no completó la lectura. Reintenta más tarde; se conserva la lectura anterior.');
  }
  return body;
}
function exactScope(scope: unknown) { return typeof scope === 'string' && scope.trim() === CALENDAR_SCOPE; }
export async function exchangeCode(grant: CalendarGrant, code: string, verifier: string, redirect: string, vault: GrantVault = credentialVault, fetcher: Fetcher = fetch) {
  const token = await googleJson('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: grant.clientId, client_secret: grant.clientSecret, code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) }, fetcher);
  if (!exactScope(token.scope) || typeof token.refresh_token !== 'string' || !token.refresh_token) throw new Error('Google no concedió exclusivamente la lectura persistente prevista. No se guarda el grant; revisa el cliente y el consentimiento.');
  const saved: CalendarGrant = { ...grant, refreshToken: token.refresh_token, scope: CALENDAR_SCOPE, authorizedAt: new Date().toISOString() };
  await vault.write(saved); return saved;
}
export async function authorizeDesktop(grant: CalendarGrant, onReady: (url: string) => void, vault: GrantVault = credentialVault, fetcher: Fetcher = fetch): Promise<CalendarGrant> {
  return new Promise((done, fail) => {
    let request: ReturnType<typeof oauthRequest>; let redirect = ''; let consumed = false;
    const server = createServer(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      const u = new URL(req.url || '/', redirect);
      if (req.method !== 'GET' || u.pathname !== '/' || req.headers.host !== new URL(redirect).host || u.searchParams.get('state') !== request.state || u.searchParams.getAll('state').length !== 1 || consumed) { res.writeHead(400); res.end('Solicitud no válida.'); return; }
      consumed = true; clearTimeout(timer);
      try {
        if (u.searchParams.has('error')) throw new Error('Consentimiento cancelado en Google. No se cambió el acceso anterior.');
        const code = u.searchParams.get('code'); if (!code || code.length > 4096 || u.searchParams.getAll('code').length !== 1) throw new Error('Código de autorización inválido.');
        const saved = await exchangeCode(grant, code, request.verifier, redirect, vault, fetcher);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Acceso de lectura guardado en Windows. Puedes cerrar esta pestaña y volver a TaskManager en http://127.0.0.1:3011/agenda. La primera sincronización se está verificando.'); server.close(); done(saved);
      } catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('No se completó la autorización. Vuelve a TaskManager; no envíes el código por chat.'); server.close(); fail(e); }
    });
    const timer = setTimeout(() => { server.close(); fail(new Error('El consentimiento no se completó en diez minutos. Repite el comando para iniciar un flujo nuevo.')); }, 10 * 60 * 1000);
    server.on('error', () => { clearTimeout(timer); fail(new Error('No se pudo abrir el callback loopback.')); });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address(); if (!address || typeof address === 'string') return;
      redirect = `http://127.0.0.1:${address.port}/`; request = oauthRequest(grant.clientId, redirect);
      try { onReady(request.url); } catch { clearTimeout(timer); server.close(); fail(new Error('No se pudo abrir el consentimiento de Google.')); }
    });
  });
}
export async function readPrimaryCalendar(grant: CalendarGrant, vault: GrantVault = credentialVault, fetcher: Fetcher = fetch, now = new Date()): Promise<CalendarSnapshot> {
  if (!grant.refreshToken || !exactScope(grant.scope) || !grant.ownerId?.trim()) throw new Error('TaskManager no tiene autorización propia de lectura persistente. Configura el cliente de escritorio y confirma el permiso en Google.');
  const token = await googleJson('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: grant.clientId, client_secret: grant.clientSecret, refresh_token: grant.refreshToken, grant_type: 'refresh_token' }) }, fetcher);
  if (typeof token.access_token !== 'string' || !token.access_token || (token.scope !== undefined && !exactScope(token.scope))) throw new Error('Google devolvió un acceso inesperado. No se lee ningún calendario.');
  if (token.refresh_token && token.refresh_token !== grant.refreshToken) await vault.write({ ...grant, refreshToken: token.refresh_token });
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = new Date(`${day}T00:00:00-05:00`); start.setUTCDate(start.getUTCDate() - 7);
  const end = new Date(`${day}T00:00:00-05:00`); end.setUTCDate(end.getUTCDate() + 30);
  const snapshot: CalendarSnapshot = { ownerId: grant.ownerId, provider: 'google', calendarId: 'primary', connection: 'oauth-readonly', verifiedAt: now.toISOString(), windowStart: start.toISOString(), windowEnd: end.toISOString(), events: [] };
  let page = ''; const pages = new Set<string>();
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.search = new URLSearchParams({ timeMin: snapshot.windowStart, timeMax: snapshot.windowEnd, timeZone: 'America/Panama', singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false', maxResults: '250', fields: 'nextPageToken,items(id,summary,status,htmlLink,start,end)', ...(page ? { pageToken: page } : {}) }).toString();
    const body = await googleJson(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${token.access_token}` } }, fetcher);
    if (!Array.isArray(body.items)) throw new Error('Lectura incompleta. Se conserva la agenda anterior.');
    for (const e of body.items) {
      if (e.status === 'cancelled') continue;
      const allDay = !!e.start?.date;
      snapshot.events.push({ id: e.id, calendarId: 'primary', title: typeof e.summary === 'string' && e.summary ? e.summary.slice(0, 1000) : '(Sin título)', start: allDay ? e.start.date : e.start?.dateTime, end: allDay ? e.end?.date : e.end?.dateTime, status: e.status || 'confirmed', url: e.htmlLink, allDay, observedAt: snapshot.verifiedAt });
    }
    if (snapshot.events.length > 1000) throw new Error('La ventana supera el límite local. Se conserva la lectura anterior.');
    page = body.nextPageToken || ''; if (page && (pages.has(page) || pages.size >= 10)) throw new Error('Paginación incompleta. Se conserva la agenda anterior.'); pages.add(page);
  } while (page);
  return snapshot;
}
