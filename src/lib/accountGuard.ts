import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from './session';
import { getAccount, isLocalId, canManageUsers, AccountError, TOP_ROLES } from './localAccounts';
import { validateApiKey, sameRequestOrigin } from './auth';
import { tr } from './reqLang';

export type Actor = { id: string; role: string; email: string };
export type Guard = { ok: true; actor: Actor } | { ok: false; res: NextResponse };
const deny = (error: string, status: number): Guard => ({ ok: false, res: NextResponse.json({ error }, { status }) });

/** Quién puede administrar usuarios: cuentas propias Owner/Admin/Gerente, o sesiones originales Owner/Admin. */
export async function requireManager(request: NextRequest): Promise<Guard> {
  const session = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!session) return deny(tr('Inicia sesión para continuar.', 'Sign in to continue.'), 401);
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (writing && !sameRequestOrigin(request)) return deny(tr('Origen de la solicitud no permitido.', 'Request origin not allowed.'), 403);
  if (isLocalId(session.userId)) {
    const acc = getAccount(session.userId);
    if (!acc?.isActive) return deny(tr('Sesión revocada.', 'Session revoked.'), 401);
    if (!canManageUsers(acc.role)) return deny(tr('Esta acción requiere un perfil de gerencia.', 'This action requires a management profile.'), 403);
    return { ok: true, actor: { id: acc.id, role: acc.role, email: acc.email } };
  }
  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.session) return deny(auth.error || 'Sin acceso.', auth.status || 401);
  if (!TOP_ROLES.includes(auth.session.role)) return deny(tr('Esta acción requiere un perfil de gerencia.', 'This action requires a management profile.'), 403);
  return { ok: true, actor: { id: auth.session.userId, role: auth.session.role, email: auth.session.email } };
}
export const accountErrorResponse = (e: unknown) =>
  e instanceof AccountError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: tr('No se pudo completar la operación.', 'Could not complete the operation.') }, { status: 500 });
