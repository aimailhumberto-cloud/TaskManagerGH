import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/session';
import { getAccount, isLocalId, TOP_ROLES } from '@/lib/localAccounts';
import { sameRequestOrigin } from '@/lib/auth';
import { BRAIN_VIEW_COOKIE, COMPANY_BRAIN_ID, companyBrainExists } from '@/lib/brains';
export const dynamic = 'force-dynamic';

/** Cualquier persona puede pasar a ver el cerebro de la compañía (solo consulta) y volver al suyo. */
function me(request: NextRequest) {
  const s = decryptSession(request.cookies.get('hermes_session')?.value || '');
  const acc = s && isLocalId(s.userId) ? getAccount(s.userId) : null;
  return acc?.isActive ? acc : null;
}
export async function GET(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: 'Inicia sesión con tu cuenta.' }, { status: 401 });
  return NextResponse.json({ companyExists: companyBrainExists(), viewing: request.cookies.get(BRAIN_VIEW_COOKIE)?.value || null, canEditCompany: TOP_ROLES.includes(acc.role) });
}
export async function POST(request: NextRequest) {
  const acc = me(request); if (!acc) return NextResponse.json({ error: 'Inicia sesión con tu cuenta.' }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true, viewing: b?.brainId === COMPANY_BRAIN_ID ? COMPANY_BRAIN_ID : null });
  if (b?.brainId === COMPANY_BRAIN_ID) {
    if (!companyBrainExists()) return NextResponse.json({ error: 'El cerebro de la compañía todavía no existe.' }, { status: 404 });
    res.cookies.set(BRAIN_VIEW_COOKIE, COMPANY_BRAIN_ID, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 });
  } else res.cookies.delete(BRAIN_VIEW_COOKIE);
  return res;
}
