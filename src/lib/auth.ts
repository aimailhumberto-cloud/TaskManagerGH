import { hasAdministrationCapability } from '@/lib/capabilities';
import { legacyWriteBlocked } from './runtimePolicy';
import { NextRequest } from 'next/server';
import { decryptSession, SessionData } from './session';
import { dbService } from '@/services/dbService';
import { validCsrf } from './csrf';

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
  if (!session) return { valid: false, status: 401, error: 'Inicia sesión para continuar.' };
  try {
    const user = await dbService.getUserById(session.userId);
    if (!user?.isActive || user.personId !== session.personId) return { valid: false, status: 401, error: 'Sesión revocada.' };
    const person = (await dbService.getPeople()).find(p => p.id === session.personId);
    if (!person) return { valid: false, status: 401, error: 'Perfil no disponible.' };
    const adminOnly = request.nextUrl.pathname.startsWith('/api/settings') || request.nextUrl.pathname.startsWith('/api/users');
    const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if ((writing || adminOnly) && !hasAdministrationCapability(person.role)) return { valid: false, status: 403, error: 'Esta acción requiere al administrador.' };
    if (writing && !sameRequestOrigin(request)) return { valid: false, status: 403, error: 'Origen de la solicitud no permitido.' };
    if (writing && /^\/api\/(workspace|reminders|integrations)(\/|$)/.test(request.nextUrl.pathname) && !validCsrf(request.cookies.get('hermes_session')!.value, request.headers.get('x-csrf-token'))) return { valid: false, status: 403, error: 'Verificación CSRF requerida. Recarga y reintenta.' };
    if (writing && legacyWriteBlocked(request.nextUrl.pathname)) return { valid: false, status: 409, error: 'Usa el flujo de trabajo actual para conservar referencias, revisiones y aceptación.' };
    return { valid: true, session: { ...session, role: person.role } };
  } catch {
    return { valid: false, status: 503, error: 'No se pudo verificar el acceso. No se realizaron cambios.' };
  }
}
