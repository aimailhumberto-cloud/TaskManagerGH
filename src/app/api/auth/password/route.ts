import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { changeOwnPassword, isLocalId, AccountError } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
import { tr, withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

async function _POST(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  if (!s || !isLocalId(s.userId)) return NextResponse.json({ error: tr('Inicia sesión con una cuenta propia para cambiar la contraseña.', 'Sign in with your own account to change the password.') }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: tr('Origen de la solicitud no permitido.', 'Request origin not allowed.') }, { status: 403 });
  try {
    const b = await request.json();
    changeOwnPassword(s.userId, String(b?.current || ''), String(b?.next || ''));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccountError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: tr('No se pudo cambiar la contraseña.', 'Could not change the password.') }, { status: 500 });
  }
}

export const POST = withReqLang(_POST);
