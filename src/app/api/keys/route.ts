import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { getAccount, isLocalId } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
import { createKey, listKeys, revokeKey, KeyError, SCOPES } from '@/lib/agentKeys';
import { tr, withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/** Llaves del agente de cada persona. Solo con sesión de persona (un agente no puede crearse llaves). */
function me(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  const acc = s && isLocalId(s.userId) ? getAccount(s.userId) : null;
  return acc?.isActive ? acc : null;
}
const fail = (e: unknown) => e instanceof KeyError ? NextResponse.json({ error: e.message }, { status: e.status }) : NextResponse.json({ error: tr('No se pudo completar.', 'Could not complete.') }, { status: 500 });

async function _GET(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: tr('Inicia sesión con tu cuenta.', 'Sign in with your account.') }, { status: 401 });
  return NextResponse.json({ keys: listKeys(acc.id), scopes: SCOPES, canWrite: acc.role !== 'Solo lectura' });
}
async function _POST(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: tr('Inicia sesión con tu cuenta.', 'Sign in with your account.') }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: tr('Origen de la solicitud no permitido.', 'Request origin not allowed.') }, { status: 403 });
  try {
    const b = await request.json();
    if (b?.action === 'revoke') return NextResponse.json({ ok: true, key: revokeKey(acc.id, String(b.id || '')) });
    if (acc.role === 'Solo lectura' && b?.scope !== 'leer') return NextResponse.json({ error: tr('Tu perfil solo puede crear llaves de lectura.', 'Your profile can only create read keys.') }, { status: 403 });
    const out = createKey(acc.id, b?.name, b?.scope);
    return NextResponse.json({ ok: true, key: out.key, record: out.record }, { status: 201 });
  } catch (e) { return fail(e); }
}

export const GET = withReqLang(_GET);
export const POST = withReqLang(_POST);
