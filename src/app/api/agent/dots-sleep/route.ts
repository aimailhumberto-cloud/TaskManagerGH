import { NextRequest, NextResponse } from 'next/server';
import { getVaultPath, loadBrainGraph } from '@/lib/smjBrainService';
import {
  applyDecisions, loadDecisions, loadLatestReport, listReportDays, needsNightlyReport,
  recordDecision, runSleepCycle, type Decision, type SleepReport,
} from '@/lib/dotsSleep';
import fs from 'fs';
import path from 'path';
import { getSleepDir } from '@/lib/dotsSleep';
import { loadReviews } from '@/lib/decisionEngine';

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

function view(vaultPath: string, report: SleepReport | null, generated: boolean) {
  if (!report) return { ok: true, report: null, generated };
  const decisions = loadDecisions(vaultPath);
  const applied = applyDecisions(report, decisions, new Date());
  // Revisión del motor de decisiones (Jev): solo anota confianza y urgencia; no cambia el orden de gravedad ni ninguna nota.
  const reviews = loadReviews(getSleepDir(vaultPath));
  return { ok: true, generated, report: { ...applied, proposals: applied.proposals.map((p: any) => (reviews[p.id] ? { ...p, ai: reviews[p.id] } : p)) } };
}

/**
 * Informe del ciclo nocturno de DOTS (solo propuestas: no modifica notas).
 * GET            → último informe con las decisiones ya aplicadas (si hoy toca y no hay, lo genera).
 * GET ?history=1 → días con informe.   GET ?day=YYYY-MM-DD → informe de ese día.
 * POST {action:'run'} → genera ahora.   POST {action:'decide', id, decision, by?, note?} → registra la decisión.
 */
export async function GET(req: NextRequest) {
  try {
    const vaultPath = getVaultPath();
    const { searchParams } = new URL(req.url);

    if (searchParams.get('history') === '1') {
      return NextResponse.json({ ok: true, days: listReportDays(vaultPath) }, { headers: CORS_HEADERS });
    }
    const day = searchParams.get('day');
    if (day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return NextResponse.json({ ok: false, error: 'day debe ser YYYY-MM-DD' }, { status: 400, headers: CORS_HEADERS });
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

export async function POST(req: NextRequest) {
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
        return NextResponse.json({ ok: false, error: `decision debe ser una de: ${DECISIONS.join(', ')}` }, { status: 400, headers: CORS_HEADERS });
      }
      const latest = loadLatestReport(vaultPath);
      if (!id || !latest?.proposals.some((p) => p.id === id)) {
        return NextResponse.json({ ok: false, error: 'La propuesta no existe en el último informe' }, { status: 404, headers: CORS_HEADERS });
      }
      const rec = recordDecision(vaultPath, id, decision, typeof body.by === 'string' ? body.by.slice(0, 60) : undefined, typeof body.note === 'string' ? body.note : undefined);
      return NextResponse.json(
        {
          ok: true, id, record: rec,
          // v1: solo se registra; ninguna nota cambia
          applied: false,
          note: 'La decisión quedó registrada. En esta versión DOTS no modifica notas por sí solo.',
        },
        { headers: CORS_HEADERS },
      );
    }

    return NextResponse.json({ ok: false, error: "action debe ser 'run' o 'decide'" }, { status: 400, headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'error' }, { status: 500, headers: CORS_HEADERS });
  }
}
