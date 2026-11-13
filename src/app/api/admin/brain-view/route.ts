import { NextRequest, NextResponse } from 'next/server';
import { requireManager } from '@/lib/accountGuard';
import { BRAIN_VIEW_COOKIE, PRIMARY_BRAIN_ID, COMPANY_BRAIN_ID, brainIdForAccount, ensureBrain, listBrains, logBrainAccess } from '@/lib/brains';
import { getAccount, TOP_ROLES } from '@/lib/localAccounts';
import { tr, withReqLang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';

/** Selector de cerebro del administrador. Solo Owner/Admin; cada cambio queda registrado. */
async function _GET(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  if (!TOP_ROLES.includes(g.actor.role)) return NextResponse.json({ error: tr('Solo un Owner o Admin puede ver otros cerebros.', 'Only an Owner or Admin can view other brains.') }, { status: 403 });
  const mine = getAccount(g.actor.id); 
  return NextResponse.json({ brains: listBrains(), viewing: request.cookies.get(BRAIN_VIEW_COOKIE)?.value || null, mine: mine ? brainIdForAccount(mine) : PRIMARY_BRAIN_ID });
}
async function _POST(request: NextRequest) {
  const g = await requireManager(request); if (!g.ok) return g.res;
  if (!TOP_ROLES.includes(g.actor.role)) return NextResponse.json({ error: tr('Solo un Owner o Admin puede ver otros cerebros.', 'Only an Owner or Admin can view other brains.') }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (b?.action === 'create_company') { ensureBrain(COMPANY_BRAIN_ID, 'la compañía'); logBrainAccess({ actor: g.actor.id, role: g.actor.role, brainId: COMPANY_BRAIN_ID, path: '/api/admin/brain-view', method: 'CREATE' }); return NextResponse.json({ ok: true, created: COMPANY_BRAIN_ID }); }
  const res = NextResponse.json({ ok: true, viewing: b?.brainId || null });
  if (!b?.brainId) { res.cookies.delete(BRAIN_VIEW_COOKIE); return res; }
  if (!listBrains().some(x => x.brainId === b.brainId)) return NextResponse.json({ error: tr('Ese cerebro no existe.', 'That brain does not exist.') }, { status: 404 });
  logBrainAccess({ actor: g.actor.id, role: g.actor.role, brainId: b.brainId, path: '/api/admin/brain-view', method: 'SELECT' });
  res.cookies.set(BRAIN_VIEW_COOKIE, b.brainId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 4 });
  return res;
}

export const GET = withReqLang(_GET);
export const POST = withReqLang(_POST);
