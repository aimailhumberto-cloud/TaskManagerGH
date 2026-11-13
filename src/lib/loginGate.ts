/**
 * Interruptor de login. Apagado por defecto: sin LOGIN_REQUIRED=1 nada cambia.
 * Para volver atrás basta quitar la variable en Render (no hace falta entrar a la app).
 * Edge-safe: sin imports de datos ni de módulos de Node.
 */
export type GateDecision = 'allow' | 'login' | 'deny';

export interface GateInput {
  path: string;
  loginRequired: boolean;
  sessionValid: boolean;
  /** Llave de servicio válida (AGENT_API_KEY) para procesos automáticos. */
  serviceKeyValid: boolean;
  /** La petición trae una llave con forma de llave por agente (tmk_…). Su validez la decide el servidor. */
  agentKeyPresented?: boolean;
}

export const loginRequiredFrom = (value?: string) => value === '1' || value === 'true';

/** Rutas que nunca piden sesión: el propio login, el webhook de Telegram (se asegura aparte). */
const ALWAYS_OPEN = [/^\/(login|setup)(\/|$)/, /^\/api\/auth\/(login|logout|csrf|setup)(\/|$)/, /^\/api\/telegram(\/|$)/];

export function gateDecision(i: GateInput): GateDecision {
  if (!i.loginRequired) return 'allow';
  if (ALWAYS_OPEN.some(r => r.test(i.path))) return 'allow';
  if (i.sessionValid) return 'allow';
  const isApi = i.path.startsWith('/api/');
  if (isApi && i.serviceKeyValid && /^\/api\/(agent|public)(\/|$)/.test(i.path)) return 'allow';
  // Llaves por agente: el borde no puede leer el archivo de llaves; deja pasar SOLO a rutas que el servidor valida con withBrain.
  if (isApi && i.agentKeyPresented && /^\/api\/agent\/(brain|tasks|dots-sleep|vault-sync|shared|dashboard)(\/|$)/.test(i.path)) return 'allow';
  return isApi ? 'deny' : 'login';
}

export function serviceKeyMatches(headers: { get(name: string): string | null }, configured?: string): boolean {
  const key = configured?.trim();
  if (!key) return false;
  const auth = headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const header = headers.get('x-agent-key')?.trim() || '';
  return bearer === key || header === key;
}

/**
 * Cuentas con cerebro propio (no el principal): solo pueden usar su Cerebro, Usuarios y su cuenta.
 * El resto de la app todavía pertenece al espacio de trabajo del cerebro principal. Denegar por defecto.
 */
const OWN_BRAIN_ALLOWED = [
  /^\/(inicio|cerebro|mi-agenda|mis-tareas|mi-agente|compania|usuarios|cambiar-clave|login|setup)(\/|$)/,
  /^\/api\/auth(\/|$)/, /^\/api\/admin(\/|$)/, /^\/api\/people(\/|$)/, /^\/api\/keys(\/|$)/, /^\/api\/brain-view(\/|$)/,
  /^\/api\/agent\/(brain|tasks|dots-sleep|vault-sync|shared|dashboard)(\/|$)/,
];
export function ownBrainDecision(path: string, brain: unknown): 'allow' | 'redirect' | 'deny' {
  if (typeof brain !== 'string' || brain === 'hb') return 'allow';
  if (OWN_BRAIN_ALLOWED.some(r => r.test(path))) return 'allow';
  return path.startsWith('/api/') ? 'deny' : 'redirect';
}

export function agentKeyPresented(headers: { get(name: string): string | null }): boolean {
  const auth = headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return (bearer || headers.get('x-agent-key')?.trim() || '').startsWith('tmk_');
}

/** Pantallas del sistema anterior que ya no se usan: para cuentas propias llevan al tablero. */
const RETIRED = /^\/(companies|company-dashboard|projects|categories|user-dashboard|meeting-parser)(\/|$)|^\/data$/;
export const retiredPage = (path: string) => RETIRED.test(path);
