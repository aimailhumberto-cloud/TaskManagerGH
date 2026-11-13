import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { searchBrain } from '@/lib/brainLens';
import { tr } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';
/** Buscador: ?q=texto&type=person,distributor&limit=20&catalog=0. Sin acentos, con sinónimos de países. */
async function _GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams; const q = (sp.get('q') || '').slice(0, 200);
  if (!q.trim()) return NextResponse.json({ ok: false, error: tr('Falta q.', 'q is missing.') }, { status: 400 });
  const results = searchBrain(q, { type: sp.get('type') || undefined, limit: Math.min(100, Number(sp.get('limit')) || 20), catalog: sp.get('catalog') !== '0' });
  return NextResponse.json({ ok: true, q, count: results.length, results });
}
export const GET = withBrain(_GET);
