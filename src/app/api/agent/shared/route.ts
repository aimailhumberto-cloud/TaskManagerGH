import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { querySharedNodes, logSharedQuery, setVisibility } from '@/lib/sharing';
export const dynamic = 'force-dynamic';

/**
 * GET ?q=texto → fichas que OTROS cerebros compartieron con el mío (título, tipo y extracto). Nunca devuelve fichas privadas.
 * POST {action:'set_visibility', nodeId, visibility:'private'|'shared'|'public', sharedWith?:[ids]} → comparte o deja de compartir una ficha MÍA.
 */
async function _GET(req: NextRequest) {
  const ctx = currentBrain();
  const requester = ctx?.ownBrainId || ctx?.brainId; if (!requester) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  const q = new URL(req.url).searchParams.get('q') || '';
  const results = querySharedNodes(requester, q);
  logSharedQuery({ requester, actor: ctx?.actor, q: q.slice(0, 100), results: results.length });
  return NextResponse.json({ ok: true, requester, results });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain();
  const b = await req.json().catch(() => ({}));
  if (b?.action !== 'set_visibility') return NextResponse.json({ ok: false, error: "action debe ser 'set_visibility'." }, { status: 400 });
  if (!ctx || ctx.brainId !== (ctx.ownBrainId || ctx.brainId)) return NextResponse.json({ ok: false, error: 'Solo puedes cambiar la visibilidad de fichas de tu propio cerebro.' }, { status: 403 });
  if (!canWriteFully()) return NextResponse.json({ ok: false, error: 'Esta llave no puede cambiar qué se comparte.' }, { status: 403 });
  const r = setVisibility(ctx.vaultPath, String(b.nodeId || ''), String(b.visibility || ''), Array.isArray(b.sharedWith) ? b.sharedWith : []);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
