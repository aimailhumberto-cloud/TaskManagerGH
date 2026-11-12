import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { changeOwnPassword, isLocalId, AccountError } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!s || !isLocalId(s.userId)) return NextResponse.json({ error: 'Inicia sesión con una cuenta propia para cambiar la contraseña.' }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
  try {
    const b = await request.json();
    changeOwnPassword(s.userId, String(b?.current || ''), String(b?.next || ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'No se pudo cambiar la contraseña.' }, { status: 500 });
  }
}
