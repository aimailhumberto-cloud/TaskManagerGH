import { NextRequest, NextResponse } from 'next/server';
import { primaryOnly } from '@/lib/brains';
import { getVaultPath, loadBrainGraph } from '@/lib/smjBrainService';
import { applyDecisions, getSleepDir, loadDecisions, loadLatestReport } from '@/lib/dotsSleep';
import { autoApply, loadAutonomy, saveAutonomy, recentActivity } from '@/lib/autonomy';
import { recentAppliedAll } from '@/lib/sleepApply';
import { sanitizeQuestions, MAX_STATE_CHARS } from '@/lib/decisionEngine';
import { configuredProvider, DecisionError, lastLog, loadReviews, logCall, reviewProposals, saveReviews } from '@/lib/decisionEngine';
import { tr } from '@/lib/reqLang';

export const dynamic = 'force-dynamic';

/**
 * Motor de decisiones (Jev). Siempre propone: ninguna acción de aquí cambia una nota.
 * GET                    → estado: si hay llave, última llamada, cuántas propuestas tienen revisión.
 * POST {action:'ping'}   → llamada mínima de prueba (no envía nada del cerebro).
 * POST {action:'ask', state, questions} → pregunta libre del agente (hasta 12 preguntas noul/choice/score).
 * POST {action:'review'} → Jev revisa las propuestas pendientes del informe nocturno y anota confianza y urgencia.
 */
async function _GET() {
  const sleepDir = getSleepDir(getVaultPath());
  return NextResponse.json({ ok: true, configured: !!configuredProvider(), provider: 'jev', mode: 'solo_propuestas', reviews: Object.keys(loadReviews(sleepDir)).length, last: lastLog(sleepDir),
    autonomy: loadAutonomy(getVaultPath()), applied: recentAppliedAll(getVaultPath()), activity: recentActivity(getVaultPath()) });
}

async function _POST(req: NextRequest) {
  const vaultPath = getVaultPath();
  const sleepDir = getSleepDir(vaultPath);
  const body = await req.json().catch(() => ({}));
  if (body.action === 'autonomy') return NextResponse.json({ ok: true, autonomy: saveAutonomy(vaultPath, { mode: body.mode, threshold: body.threshold }) });
  const provider = configuredProvider();
  if (!provider) return NextResponse.json({ ok: false, error: tr('Falta TYPESAFE_API_KEY en Render.', 'TYPESAFE_API_KEY is missing on Render.') }, { status: 503 });
  try {
    if (body.action === 'ping') {
      const r = await provider.decide('The sky is blue on a clear day.', { check: { type: 'noul', instructions: 'The text says that the sky is blue.' } });
      const a = r.answers.check;
      logCall(sleepDir, { action: 'ping', ok: true, model: r.model, ms: r.ms, input_tokens: r.usage.input_tokens });
      return NextResponse.json({ ok: true, model: r.model, ms: r.ms, answer: a?.type === 'noul' ? a.noul : null, usage: r.usage });
    }
    if (body.action === 'ask') {
      // El agente pregunta lo que necesite: estado (texto o JSON) + preguntas tipadas. Jev solo opina; no cambia nada.
      const state = typeof body.state === 'string' ? body.state : body.state && typeof body.state === 'object' ? JSON.stringify(body.state) : '';
      if (state.length < 1) return NextResponse.json({ ok: false, error: tr('Falta state (texto u objeto JSON).', 'state is missing (text or JSON object).') }, { status: 400 });
      if (state.length > MAX_STATE_CHARS) return NextResponse.json({ ok: false, error: tr(`state supera ${MAX_STATE_CHARS} caracteres; recórtalo o divídelo.`, `state exceeds ${MAX_STATE_CHARS} characters; trim it or split it.`) }, { status: 413 });
      const questions = sanitizeQuestions(body.questions);
      if (typeof questions === 'string') return NextResponse.json({ ok: false, error: questions }, { status: 400 });
      const r = await provider.decide(state, questions);
      logCall(sleepDir, { action: 'ask', ok: true, model: r.model, ms: r.ms, input_tokens: r.usage.input_tokens, reviewed: Object.keys(r.answers).length });
      return NextResponse.json({ ok: true, model: r.model, ms: r.ms, answers: r.answers, unanswered: Object.keys(questions).filter(k => !(k in r.answers)), usage: r.usage,
        note: tr('Opinión con probabilidad, no un hecho verificado. No autoriza ningún cambio por sí sola.', 'An opinion with a probability, not a verified fact. It does not authorize any change by itself.') });
    }
    if (body.action === 'review') {
      const report = loadLatestReport(vaultPath);
      if (!report) return NextResponse.json({ ok: false, error: tr('Aún no hay informe nocturno.', 'There is no nightly report yet.') }, { status: 404 });
      const view = applyDecisions(report, loadDecisions(vaultPath), new Date());
      const pending = view.proposals.filter((p: any) => !p.decision);
      const g = loadBrainGraph();
      const out = await reviewProposals(provider, pending, (g.allNodes || g.nodes) as any);
      saveReviews(sleepDir, out.reviews, new Set(report.proposals.map(p => p.id)));
      const auto = autoApply(vaultPath, pending, out.reviews, (g.allNodes || g.nodes) as any);
      logCall(sleepDir, { action: 'review', ok: out.errors.length === 0, ms: out.ms, input_tokens: out.usage.input_tokens, reviewed: out.reviewed, error: out.errors[0] });
      const status = out.reviewed === 0 && out.errors.length ? 502 : 200;
      return NextResponse.json({ ok: status === 200, reviewed: out.reviewed, pending: pending.length, skipped: out.skipped, usage: out.usage, errors: [...out.errors, ...auto.errors], applied: auto.applied.length, appliedTitles: auto.applied.map(a => a.title) }, { status });
    }
    return NextResponse.json({ ok: false, error: "action debe ser 'ping', 'review', 'ask' o 'autonomy'" }, { status: 400 });
  } catch (e: any) {
    const msg = e instanceof DecisionError ? e.message : 'No se pudo consultar a Jev.';
    logCall(sleepDir, { action: String(body.action || ''), ok: false, error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: e instanceof DecisionError ? e.status : 500 });
  }
}

// Cada verbo corre dentro del cerebro de quien hace la petición (ver src/lib/brains.ts).
export const GET = primaryOnly(_GET);
export const POST = primaryOnly(_POST);
