import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { compactMap } from '@/lib/brainLens';
export const dynamic = 'force-dynamic';
/** Mapa compacto del cerebro: una fila por ficha. ?type=distributor,person · ?catalog=0 deja fuera variantes, sabores y empaques. */
async function _GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  return NextResponse.json({ ok: true, ...compactMap({ type: sp.get('type') || undefined, catalog: sp.get('catalog') !== '0' }) });
}
export const GET = withBrain(_GET);
