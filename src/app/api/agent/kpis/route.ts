import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { deleteKpi, KpiError, listKpis, setKpi } from '@/lib/kpis';
import { getAccount } from '@/lib/localAccounts';
export const dynamic = 'force-dynamic';

/**
 * Indicadores del cerebro. GET → lista con historial.
 * POST {action:'set', name, value, unit?, target?, period?, note?, id?} → crea el indicador o registra un valor nuevo.
 * POST {action:'delete', id} → lo borra (personas, o agentes con alcance «escribir»).
 */
async function _GET() {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  return NextResponse.json({ ok: true, kpis: listKpis(ctx.vaultPath) });
}
async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return NextResponse.json({ ok: false, error: 'Sin cerebro.' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const who = ctx.actor?.startsWith('local-') ? getAccount(ctx.actor)?.name || ctx.actor : ctx.actor ? 'Agente' : undefined;
  try {
    if (b?.action === 'delete') {
      if (!canWriteFully()) return NextResponse.json({ ok: false, error: 'Esta llave no puede borrar indicadores.' }, { status: 403 });
      return NextResponse.json({ ok: deleteKpi(ctx.vaultPath, String(b.id || '')) });
    }
    if (b?.action === 'set') return NextResponse.json({ ok: true, kpi: setKpi(ctx.vaultPath, b, who) });
    return NextResponse.json({ ok: false, error: "action debe ser 'set' o 'delete'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof KpiError ? e.message : 'No se pudo guardar el indicador.' }, { status: e instanceof KpiError ? e.status : 500 });
  }
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
