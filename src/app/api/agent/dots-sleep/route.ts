import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { canWriteFully } from '@/lib/brainContext';
import { getVaultPath, loadBrainGraph } from '@/lib/smjBrainService';
import {
  applyDecisions, loadDecisions, loadLatestReport, listReportDays, needsNightlyReport,
  recordDecision, runSleepCycle, type Decision, type SleepReport,
} from '@/lib/dotsSleep';
import fs from 'fs';
import path from 'path';
import { getSleepDir } from '@/lib/dotsSleep';
import { loadReviews, captureProposals } from '@/lib/decisionEngine';
import { applyProposal, undoProposal, canApply, recentApplied } from '@/lib/sleepApply';
import { tr } from '@/lib/reqLang';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-agent-key, x-vault-token',
  'Cache-Control': 'no-store',
};

const DECISIONS: Decision[] = ['aprobada', 'rechazada', 'pospuesta'];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function generate(vaultPath: string): SleepReport {
  const g = loadBrainGraph();
  return runSleepCycle(vaultPath, { nodes: g.allNodes || g.nodes, links: g.links });
}

/** Informe + capturas que Jev sugiere conectar (viven aparte del informe del día). */
function withCaptures(vaultPath: string, report: SleepReport): SleepReport {
  try {
    const g = loadBrainGraph();
    const ids = new Set((g.allNodes || g.nodes).map((n) => n.id));
    const caps = captureProposals(getSleepDir(vaultPath), ids).filter((c) => !report.proposals.some((p) => p.id === c.id));
    return caps.length ? { ...report, proposals: [...report.proposals, ...(caps as any)] } : report;
  } catch { return report; }
}

function view(vaultPath: string, report0: SleepReport | null, generated: boolean) {
  if (!report0) return { ok: true, report: null, generated };
  const report = withCaptures(vaultPath, report0);
  const decisions = loadDecisions(vaultPath);
  const applied = applyDecisions(report, decisions, new Date());
  // Revisión del motor de decisiones (Jev): solo anota confianza y urgencia; no cambia el orden de gravedad ni ninguna nota.
  const reviews = loadReviews(getSleepDir(vaultPath));
  return { ok: true, generated, report: { ...applied, proposals: applied.proposals.map((p: any) => ({ ...p, canApply: canApply(p.kind), ...(reviews[p.id] ? { ai: reviews[p.id] } : p.ai ? { ai: p.ai } : {}) })), appliedRecent: recentApplied(vaultPath) } };
}

/**
 * Informe del ciclo nocturno de DOTS (solo propuestas: no modifica notas).
 * GET            → último informe con las decisiones ya aplicadas (si hoy toca y no hay, lo genera).
 * GET ?history=1 → días con informe.   GET ?day=YYYY-MM-DD → informe de ese día.
 * POST {action:'run'} → genera ahora.   POST {action:'decide', id, decision, by?, note?} → registra la decisión.
 */
async function _GET(req: NextRequest) {
  try {
    const vaultPath = getVaultPath();
    const { searchParams } = new URL(req.url);

    if (searchParams.get('history') === '1') {
      return NextResponse.json({ ok: true, days: listReportDays(vaultPath) }, { headers: CORS_HEADERS });
    }
    const day = searchParams.get('day');
    if (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return NextResponse.json({ ok: false, error: tr('day debe ser YYYY-MM-DD', 'day must be YYYY-MM-DD') }, { status: 400, headers: CORS_HEADERS });
      }
      let report: SleepReport | null = null;
      try { report = JSON.parse(fs.readFileSync(path.join(getSleepDir(vaultPath), 'reports', `${day}.json`), 'utf8')); } catch {}
      return NextResponse.json(view(vaultPath, report, false), { headers: CORS_HEADERS });
    }

    let generated = false;
    let report = loadLatestReport(vaultPath);
    // Respaldo del temporizador: si el servidor estuvo dormido a las 2 a.m., el informe se arma al consultar.
    if (needsNightlyReport(vaultPath)) {
      report = generate(vaultPath);
      generated = true;
    }
    return NextResponse.json(view(vaultPath, report, generated), { headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500, headers: CORS_HEADERS });
  }
}

async function _POST(req: NextRequest) {
  try {
    const vaultPath = getVaultPath();
    const body = await req.json().catch(() => ({}));

    if (body.action === 'run') {
      return NextResponse.json(view(vaultPath, generate(vaultPath), true), { headers: CORS_HEADERS });
    }

    if (body.action === 'decide') {
      const id = String(body.id || '');
      const decision = body.decision as Decision;
      if (!DECISIONS.includes(decision)) {
        return NextResponse.json({ ok: false, error: tr(`decision debe ser una de: ${DECISIONS.join(', ')}`, `decision must be one of: ${DECISIONS.join(', ')}`) }, { status: 400, headers: CORS_HEADERS });
      }
      const latest0 = loadLatestReport(vaultPath);
      const latest = latest0 ? withCaptures(vaultPath, latest0) : null;
      if (!id || !latest?.proposals.some((p) => p.id === id)) {
        return NextResponse.json({ ok: false, error: tr('La propuesta no existe en el último informe', 'The proposal does not exist in the latest report') }, { status: 404, headers: CORS_HEADERS });
      }
      if (decision === 'aprobada' && !canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave puede proponer, posponer o rechazar, pero no aprobar.', 'This key can propose, postpone or reject, but not approve.') }, { status: 403, headers: CORS_HEADERS });
      const by = typeof body.by === 'string' ? body.by.slice(0, 60) : undefined;
      // Aprobar aplica el cambio solo en los tipos con acción mecánica; primero se aplica y, si falla, no se registra como aprobada.
      const proposal = latest.proposals.find((p) => p.id === id)!;
      let applied = false, applyNote = 'La decisión quedó registrada. Este tipo de propuesta no cambia notas por sí solo.';
      if (decision === 'aprobada' && canApply(proposal.kind)) {
        const g = loadBrainGraph();
        const res = applyProposal(vaultPath, proposal, (g.allNodes || g.nodes) as any, by);
        if (!res.ok) return NextResponse.json({ ok: false, error: res.error, applied: false }, { status: 409, headers: CORS_HEADERS });
        applied = true; applyNote = 'Aprobada y aplicada. Se puede deshacer.';
      }
      const rec = recordDecision(vaultPath, id, decision, by, typeof body.note === 'string' ? body.note : undefined);
      return NextResponse.json({ ok: true, id, record: rec, applied, note: applyNote }, { headers: CORS_HEADERS });
    }

    if (body.action === 'undo') {
      if (!canWriteFully()) return NextResponse.json({ ok: false, error: tr('Esta llave no puede deshacer cambios.', 'This key cannot undo changes.') }, { status: 403, headers: CORS_HEADERS });
      const res = undoProposal(vaultPath, String(body.id || ''));
      if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 409, headers: CORS_HEADERS });
      return NextResponse.json({ ok: true, id: res.record.id, undone: true }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ ok: false, error: tr("action debe ser 'run', 'decide' o 'undo'", 'action must be \'run\', \'decide\' or \'undo\'') }, { status: 400, headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500, headers: CORS_HEADERS });
  }
}

// Cada verbo corre dentro del cerebro de quien hace la petición (ver src/lib/brains.ts).
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
