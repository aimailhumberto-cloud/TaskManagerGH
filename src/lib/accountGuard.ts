import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from './session';
import { getAccount, isLocalId, canManageUsers, AccountError, TOP_ROLES } from './localAccounts';
import { validateApiKey, sameRequestOrigin } from './auth';

export type Actor = { id: string; role: string; email: string };
export type Guard = { ok: true; actor: Actor } | { ok: false; res: NextResponse };
const deny = (error: string, status: number): Guard => ({ ok: false, res: NextResponse.json({ error }, { status }) });

/** Quién puede administrar usuarios: cuentas propias Owner/Admin/Gerente, o sesiones originales Owner/Admin. */
export async function requireManager(request: NextRequest): Promise<Guard> {
  const session = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!session) return deny('Inicia sesión para continuar.', 401);
  const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (writing && !sameRequestOrigin(request)) return deny('Origen de la solicitud no permitido.', 403);
  if (isLocalId(session.userId)) {
    const acc = getAccount(session.userId);
    if (!acc?.isActive) return deny('Sesión revocada.', 401);
    if (!canManageUsers(acc.role)) return deny('Esta acción requiere un perfil de gerencia.', 403);
    return { ok: true, actor: { id: acc.id, role: acc.role, email: acc.email } };
  }
  const auth = await validateApiKey(request);
  if (!auth.valid || !auth.session) return deny(auth.error || 'Sin acceso.', auth.status || 401);
  if (!TOP_ROLES.includes(auth.session.role)) return deny('Esta acción requiere un perfil de gerencia.', 403);
  return { ok: true, actor: { id: auth.session.userId, role: auth.session.role, email: auth.session.email } };
}
export const accountErrorResponse = (e: unknown) =>
  e instanceof AccountError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: 'No se pudo completar la operación.' }, { status: 500 });
