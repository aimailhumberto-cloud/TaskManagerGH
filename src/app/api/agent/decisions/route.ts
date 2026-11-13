import { NextRequest, NextResponse } from 'next/server';
import { getVaultPath, loadBrainGraph } from '@/lib/smjBrainService';
import { applyDecisions, getSleepDir, loadDecisions, loadLatestReport } from '@/lib/dotsSleep';
import { configuredProvider, DecisionError, lastLog, loadReviews, logCall, reviewProposals, saveReviews } from '@/lib/decisionEngine';

export const dynamic = 'force-dynamic';

/**
 * Motor de decisiones (Jev). Siempre propone: ninguna acción de aquí cambia una nota.
 * GET                    → estado: si hay llave, última llamada, cuántas propuestas tienen revisión.
 * POST {action:'ping'}   → llamada mínima de prueba (no envía nada del cerebro).
 * POST {action:'review'} → Jev revisa las propuestas pendientes del informe nocturno y anota confianza y urgencia.
 */
export async function GET() {
  const sleepDir = getSleepDir(getVaultPath());
  return NextResponse.json({ ok: true, configured: !!configuredProvider(), provider: 'jev', mode: 'solo_propuestas', reviews: Object.keys(loadReviews(sleepDir)).length, last: lastLog(sleepDir) });
}

export async function POST(req: NextRequest) {
  const vaultPath = getVaultPath();
  const sleepDir = getSleepDir(vaultPath);
  const body = await req.json().catch(() => ({}));
  const provider = configuredProvider();
  if (!provider) return NextResponse.json({ ok: false, error: 'Falta TYPESAFE_API_KEY en Render.' }, { status: 503 });
  try {
    if (body.action === 'ping') {
      const r = await provider.decide('The sky is blue on a clear day.', { check: { type: 'noul', instructions: 'The text says that the sky is blue.' } });
      const a = r.answers.check;
      logCall(sleepDir, { action: 'ping', ok: true, model: r.model, ms: r.ms, input_tokens: r.usage.input_tokens });
      return NextResponse.json({ ok: true, model: r.model, ms: r.ms, answer: a?.type === 'noul' ? a.noul : null, usage: r.usage });
    }
    if (body.action === 'review') {
      const report = loadLatestReport(vaultPath);
      if (!report) return NextResponse.json({ ok: false, error: 'Aún no hay informe nocturno.' }, { status: 404 });
      const view = applyDecisions(report, loadDecisions(vaultPath), new Date());
      const pending = view.proposals.filter((p: any) => !p.decision);
      const g = loadBrainGraph();
      const out = await reviewProposals(provider, pending, (g.allNodes || g.nodes) as any);
      saveReviews(sleepDir, out.reviews, new Set(report.proposals.map(p => p.id)));
      logCall(sleepDir, { action: 'review', ok: out.errors.length === 0, ms: out.ms, input_tokens: out.usage.input_tokens, reviewed: out.reviewed, error: out.errors[0] });
      const status = out.reviewed === 0 && out.errors.length ? 502 : 200;
      return NextResponse.json({ ok: status === 200, reviewed: out.reviewed, pending: pending.length, skipped: out.skipped, usage: out.usage, errors: out.errors, applied: false }, { status });
    }
    return NextResponse.json({ ok: false, error: "action debe ser 'ping' o 'review'" }, { status: 400 });
  } catch (e: any) {
    const msg = e instanceof DecisionError ? e.message : 'No se pudo consultar a Jev.';
    logCall(sleepDir, { action: String(body.action || ''), ok: false, error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof DecisionError ? e.status : 500 });
  }
}
