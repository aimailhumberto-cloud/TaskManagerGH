import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { getAccount, isLocalId, TOP_ROLES } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
import { BRAIN_VIEW_COOKIE, COMPANY_BRAIN_ID, companyBrainExists } from '@/lib/brains';
import { tr, withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/** Cualquier persona puede pasar a ver el cerebro de la compañía (solo consulta) y volver al suyo. */
function me(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  const acc = s && isLocalId(s.userId) ? getAccount(s.userId) : null;
  return acc?.isActive ? acc : null;
}
async function _GET(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: tr('Inicia sesión con tu cuenta.', 'Sign in with your account.') }, { status: 401 });
  return NextResponse.json({ companyExists: companyBrainExists(), viewing: request.cookies.get(BRAIN_VIEW_COOKIE)?.value || null, canEditCompany: TOP_ROLES.includes(acc.role) });
}
async function _POST(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: tr('Inicia sesión con tu cuenta.', 'Sign in with your account.') }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: tr('Origen de la solicitud no permitido.', 'Request origin not allowed.') }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true, viewing: b?.brainId === COMPANY_BRAIN_ID ? COMPANY_BRAIN_ID : null });
  if (b?.brainId === COMPANY_BRAIN_ID) {
    if (!companyBrainExists()) return NextResponse.json({ error: tr('El cerebro de la compañía todavía no existe.', 'The company brain does not exist yet.') }, { status: 404 });
    res.cookies.set(BRAIN_VIEW_COOKIE, COMPANY_BRAIN_ID, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 });
  } else res.cookies.delete(BRAIN_VIEW_COOKIE);
  return res;
}

export const GET = withReqLang(_GET);
export const POST = withReqLang(_POST);
