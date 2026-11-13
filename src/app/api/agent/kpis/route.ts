import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully, currentBrain } from '@/lib/brainContext';
import { deleteKpi, KpiError, listKpis, setKpi } from '@/lib/kpis';
import { getAccount } from '@/lib/localAccounts';
import { loadBrainGraph, getPanamaDate } from '@/lib/smjBrainService';
import { updateNoteFile } from '@/lib/vaultFiles';
import { ensureDailySnapshot } from '@/lib/vaultBackup';
import path from 'path';
export const dynamic = 'force-dynamic';

/**
 * Indicadores del cerebro. GET → lista con historial.
 * POST {action:'set', name, value, unit?, target?, period?, note?, id?} → crea el indicador o registra un valor nuevo.
 * POST {action:'set_quota', nodeId, targetCasesYear?, actualCasesYtd?, note?} → cuota y avance de un distribuidor (se guardan en su ficha).
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
    if (b?.action === 'set_quota') {
      if (!canWriteFully()) return NextResponse.json({ ok: false, error: 'Esta llave no puede cambiar fichas.' }, { status: 403 });
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e12 ? v : undefined);
      const target = num(b.targetCasesYear), actual = num(b.actualCasesYtd);
      if (target === undefined && actual === undefined) return NextResponse.json({ ok: false, error: 'Envía targetCasesYear o actualCasesYtd como número.' }, { status: 400 });
      const g = loadBrainGraph(); const id = String(b.nodeId || '').toLowerCase();
      const node = (g.allNodes || g.nodes).find(n => n.type === 'distributor' && (n.id.toLowerCase() === id || n.title.toLowerCase() === id));
      if (!node) return NextResponse.json({ ok: false, error: 'No se encontró ese distribuidor en el cerebro.' }, { status: 404 });
      const abs = path.resolve(node.filePath);
      if (!abs.startsWith(path.resolve(ctx.vaultPath) + path.sep)) return NextResponse.json({ ok: false, error: 'Ficha fuera de la bóveda.' }, { status: 400 });
      ensureDailySnapshot(ctx.vaultPath);
      const upd = updateNoteFile(abs, (fm) => {
        if (target !== undefined) fm.target_cases_year = target;
        if (actual !== undefined) fm.actual_cases_ytd = actual;
        fm.quota_updated_at = new Date().toISOString(); fm.quota_updated_by = who || 'Agente';
        if (typeof b.note === 'string' && b.note.trim()) fm.quota_source = b.note.trim().slice(0, 200);
        if (!Array.isArray(fm.recent_actions)) fm.recent_actions = [];
        fm.recent_actions.unshift({ date: getPanamaDate().dateStr, type: 'cuota', summary: `Cuota actualizada${target !== undefined ? `: meta ${target}` : ''}${actual !== undefined ? `, avance ${actual}` : ''} (${who || 'Agente'})` });
        fm.recent_actions = fm.recent_actions.slice(0, 20);
      });
      if (!upd.ok) return NextResponse.json({ ok: false, error: upd.error }, { status: 409 });
      return NextResponse.json({ ok: true, distributor: node.title, targetCasesYear: target, actualCasesYtd: actual });
    }
    if (b?.action === 'set') return NextResponse.json({ ok: true, kpi: setKpi(ctx.vaultPath, b, who) });
    return NextResponse.json({ ok: false, error: "action debe ser 'set', 'set_quota' o 'delete'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof KpiError ? e.message : 'No se pudo guardar el indicador.' }, { status: e instanceof KpiError ? e.status : 500 });
  }
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
