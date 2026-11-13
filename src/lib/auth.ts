import { hasAdministrationCapability } from '@/lib/capabilities';
import { legacyWriteBlocked } from './runtimePolicy';
import { NextRequest } from 'next/server';
import { decryptSession, SessionData } from './session';
import { dbService } from '@/services/dbService';
import { validCsrf } from './csrf';
import { getAccount, isLocalId } from './localAccounts';
import { tr } from './reqLang';

export interface AuthValidationResult {
  valid: boolean;
  status?: number;
  error?: string;
  session?: SessionData;
}
export function sameRequestOrigin(request: NextRequest): boolean {
  try {
    const origin = new URL(request.headers.get('origin') || '');
    // Next's internal URL can use localhost behind the local server or a proxy.
    // Compare the browser's origin with the actual HTTP Host, never Referer.
    const host = request.headers.get('host') || request.nextUrl.host;
    return ['http:', 'https:'].includes(origin.protocol) && origin.host === host;
  } catch { return false; }
}
export async function validateApiKey(request: NextRequest): Promise<AuthValidationResult> {
  const session = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!session) return { valid: false, status: 401, error: tr('Inicia sesión para continuar.', 'Sign in to continue.') };
  if (isLocalId(session.userId)) {
    const acc = getAccount(session.userId);
    if (!acc?.isActive) return { valid: false, status: 401, error: tr('Sesión revocada.', 'Session revoked.') };
    // El espacio de trabajo (tareas, empresas, agenda) es del cerebro principal: las demás cuentas no entran.
    if (session.brain !== 'hb') return { valid: false, status: 403, error: tr('Esta sección todavía no está disponible para tu cerebro.', 'This section is not yet available for your brain.') };
    const role = acc.role === 'Gerente' ? 'Admin' : acc.role; // Gerente opera como administrador de la app
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    const adminOnly = request.nextUrl.pathname.startsWith('/api/settings') || request.nextUrl.pathname.startsWith('/api/users');
    if ((writing || adminOnly) && !hasAdministrationCapability(role)) return { valid: false, status: 403, error: tr('Tu perfil es de solo consulta.', 'Your profile is read-only.') };
    if (writing && !sameRequestOrigin(request)) return { valid: false, status: 403, error: tr('Origen de la solicitud no permitido.', 'Request origin not allowed.') };
    if (writing && /^\/api\/(workspace|reminders|integrations)(\/|$)/.test(request.nextUrl.pathname) && !validCsrf(request.cookies.get('hermes_session')!.value, request.headers.get('x-csrf-token'))) return { valid: false, status: 403, error: tr('Verificación CSRF requerida. Recarga y reintenta.', 'CSRF verification required. Reload and try again.') };
    if (writing && legacyWriteBlocked(request.nextUrl.pathname)) return { valid: false, status: 409, error: tr('Usa el flujo de trabajo actual para conservar referencias, revisiones y aceptación.', 'Use the current workflow to keep references, reviews and acceptance.') };
    return { valid: true, session: { ...session, role } };
  }
  try {
    const user = await dbService.getUserById(session.userId);
    if (!user?.isActive || user.personId !== session.personId) return { valid: false, status: 401, error: tr('Sesión revocada.', 'Session revoked.') };
    const person = (await dbService.getPeople()).find(p => p.id === session.personId);
    if (!person) return { valid: false, status: 401, error: tr('Perfil no disponible.', 'Profile not available.') };
    const adminOnly = request.nextUrl.pathname.startsWith('/api/settings') || request.nextUrl.pathname.startsWith('/api/users');
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if ((writing || adminOnly) && !hasAdministrationCapability(person.role)) return { valid: false, status: 403, error: tr('Esta acción requiere al administrador.', 'This action requires the administrator.') };
    if (writing && !sameRequestOrigin(request)) return { valid: false, status: 403, error: tr('Origen de la solicitud no permitido.', 'Request origin not allowed.') };
    if (writing && /^\/api\/(workspace|reminders|integrations)(\/|$)/.test(request.nextUrl.pathname) && !validCsrf(request.cookies.get('hermes_session')!.value, request.headers.get('x-csrf-token'))) return { valid: false, status: 403, error: tr('Verificación CSRF requerida. Recarga y reintenta.', 'CSRF verification required. Reload and try again.') };
    if (writing && legacyWriteBlocked(request.nextUrl.pathname)) return { valid: false, status: 409, error: tr('Usa el flujo de trabajo actual para conservar referencias, revisiones y aceptación.', 'Use the current workflow to keep references, reviews and acceptance.') };
    return { valid: true, session: { ...session, role: person.role } };
  } catch {
    return { valid: false, status: 503, error: tr('No se pudo verificar el acceso. No se realizaron cambios.', 'Could not verify access. No changes were made.') };
  }
}
