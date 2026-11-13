import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { getAccount, isLocalId, listAccounts, canManageUsers } from '@/lib/localAccounts';
export const dynamic = 'force-dynamic';

/** Quién soy y, si puedo asignar tareas, a quién (solo nombre e id; nunca correos ni contenido). */
export async function GET(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  const me = s && isLocalId(s.userId) ? getAccount(s.userId) : null;
  if (!me?.isActive) return NextResponse.json({ error: 'Inicia sesión con una cuenta propia.' }, { status: 401 });
  const canAssign = canManageUsers(me.role);
  return NextResponse.json({
    me: { id: me.id, name: me.name, role: me.role }, canAssign,
    people: canAssign ? listAccounts().filter(a => a.isActive && a.id !== me.id).map(a => ({ id: a.id, name: a.name })) : [],
  });
}
