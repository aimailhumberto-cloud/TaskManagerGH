/**
 * Motor de decisiones del cerebro. Hace preguntas tipadas a un modelo de decisión (Jev, de TypeSafe)
 * y devuelve valores estructurados con su confianza. Regla del proyecto: SIEMPRE PROPONE.
 * Nada de lo que responde el modelo cambia una nota; solo ordena y anota las propuestas.
 * El proveedor está detrás de una interfaz para poder cambiarlo sin tocar el resto.
 */
import * as fs from 'fs';
import * as path from 'path';

export type Question =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export type Answer =
  | { type: 'noul'; noul: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities?: Record<string, number> }
  | { type: 'score'; score: number; confidence: number };

export interface DecisionResult {
  model: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number };
  ms: number;
}
export interface DecisionProvider {
  name: string;
  decide(state: string, questions: Record<string, Question>): Promise<DecisionResult>;
}
export class DecisionError extends Error { constructor(message: string, public status = 502) { super(message); } }

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
export const MAX_STATE_CHARS = 12000;

const clamp01 = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : NaN);

/** Valida la respuesta contra las preguntas: lo que no cuadra se descarta, nunca se inventa. */
export function parseAnswers(raw: any, questions: Record<string, Question>): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const [id, q] of Object.entries(questions)) {
    const a = raw?.[id];
    if (!a || a.type !== q.type) continue;
    if (q.type === 'noul') { const v = clamp01(a.noul); if (!Number.isNaN(v)) out[id] = { type: 'noul', noul: v }; }
    else if (q.type === 'choice') {
      const c = clamp01(a.confidence);
      if (typeof a.choice === 'string' && a.choice in q.criteria && !Number.isNaN(c)) out[id] = { type: 'choice', choice: a.choice, confidence: c, probabilities: a.probabilities };
    } else {
      const c = clamp01(a.confidence);
      if (typeof a.score === 'number' && a.score >= 0 && a.score <= q.criteria.length - 1 && !Number.isNaN(c)) out[id] = { type: 'score', score: a.score, confidence: c };
    }
  }
  return out;
}

export function jevProvider(apiKey: string, opts: { fetcher?: Fetcher; model?: string; timeoutMs?: number } = {}): DecisionProvider {
  const fetcher = opts.fetcher || (fetch as Fetcher);
  const model = opts.model || process.env.JEV_MODEL || 'jev-latest';
  return {
    name: 'jev',
    async decide(state, questions) {
      const started = Date.now();
      const body = JSON.stringify({ state: state.slice(0, MAX_STATE_CHARS), model, questions });
      let lastError = 'sin respuesta';
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
          res = await fetcher(JEV_URL, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(opts.timeoutMs ?? 10000) });
        } catch (e: any) { lastError = e?.name === 'TimeoutError' ? 'tiempo de espera agotado' : 'no se pudo conectar'; continue; }
        if (res.status === 401 || res.status === 403) throw new DecisionError('Jev rechazó la llave (revisa TYPESAFE_API_KEY en Render).', 401);
        if (res.status === 402) throw new DecisionError('Jev pide saldo o medio de pago en la consola de TypeSafe.', 402);
        if (res.status === 429 || res.status >= 500) { lastError = `Jev respondió ${res.status}`; await new Promise(r => setTimeout(r, 400)); continue; }
        if (!res.ok) throw new DecisionError(`Jev respondió ${res.status}.`, 502);
        const json: any = await res.json().catch(() => null);
        if (!json?.answers) throw new DecisionError('Respuesta de Jev sin el formato esperado.', 502);
        return {
          model: typeof json.model === 'string' ? json.model : model,
          answers: parseAnswers(json.answers, questions),
          usage: { input_tokens: Number(json.usage?.input_tokens) || 0, output_tokens: Number(json.usage?.output_tokens) || 0 },
          ms: Date.now() - started,
        };
      }
      throw new DecisionError(`Jev no disponible: ${lastError}.`, 503);
    },
  };
}

export function configuredProvider(): DecisionProvider | null {
  const key = process.env.TYPESAFE_API_KEY?.trim();
  return key ? jevProvider(key) : null;
}

// ---------- Revisión de las propuestas del informe nocturno ----------

export interface ProposalLike { id: string; kind: string; title: string; reason: string; suggestion: string; nodeIds: string[] }
export interface NodeLike { id: string; title?: string; type?: string; status?: string; memory_tier?: string; body?: string }
export interface AiReview { apply: number | null; urgency: number | null; urgencyConfidence: number | null; model: string; at: string }
export type AiReviewMap = Record<string, AiReview>;

export const REVIEW_QUESTIONS: Record<string, Question> = {
  apply: { type: 'noul', instructions: 'The suggested maintenance action in "proposal" is correct and safe to apply to this knowledge base, judging only from the notes shown in "notes".' },
  urgency: { type: 'score', instructions: 'How soon should the owner of this knowledge base handle the proposal?', criteria: ['It can wait indefinitely', 'It should be handled this week', 'It should be handled today'] },
};

export function proposalState(p: ProposalLike, nodes: NodeLike[]): string {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const notes = p.nodeIds.slice(0, 4).map(id => {
    const n = byId.get(id);
    return n ? { id, title: n.title, type: n.type, status: n.status, memory_tier: n.memory_tier, text: (n.body || '').slice(0, 1500) } : { id, missing: true };
  });
  return JSON.stringify({ proposal: { kind: p.kind, title: p.title, reason: p.reason, suggestion: p.suggestion }, notes });
}

export const MAX_REVIEW = 40;

export async function reviewProposals(provider: DecisionProvider, proposals: ProposalLike[], nodes: NodeLike[], now = new Date()) {
  const reviews: AiReviewMap = {};
  const usage = { input_tokens: 0, output_tokens: 0 };
  const errors: string[] = [];
  const queue = proposals.slice(0, MAX_REVIEW);
  let ms = 0;
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      try {
        const r = await provider.decide(proposalState(p, nodes), REVIEW_QUESTIONS);
        const a = r.answers.apply, u = r.answers.urgency;
        reviews[p.id] = { apply: a?.type === 'noul' ? a.noul : null, urgency: u?.type === 'score' ? u.score : null, urgencyConfidence: u?.type === 'score' ? u.confidence : null, model: r.model, at: now.toISOString() };
        usage.input_tokens += r.usage.input_tokens; usage.output_tokens += r.usage.output_tokens; ms += r.ms;
      } catch (e: any) {
        errors.push(e?.message || 'error');
        if (e instanceof DecisionError && (e.status === 401 || e.status === 402)) { queue.length = 0; return; }
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { reviews, usage, errors: [...new Set(errors)], reviewed: Object.keys(reviews).length, skipped: Math.max(0, proposals.length - MAX_REVIEW), ms };
}

// ---------- Almacenamiento (junto al informe nocturno, fuera de la bóveda) ----------

const reviewsFile = (sleepDir: string) => path.join(sleepDir, 'ai-reviews.json');
const logFile = (sleepDir: string) => path.join(sleepDir, 'ai-log.jsonl');

export function loadReviews(sleepDir: string): AiReviewMap {
  try { return JSON.parse(fs.readFileSync(reviewsFile(sleepDir), 'utf8')) || {}; } catch { return {}; }
}
export function saveReviews(sleepDir: string, add: AiReviewMap, keepIds?: Set<string>) {
  const all = { ...loadReviews(sleepDir), ...add };
  const kept = keepIds ? Object.fromEntries(Object.entries(all).filter(([id]) => keepIds.has(id))) : all;
  fs.mkdirSync(sleepDir, { recursive: true });
  const tmp = `${reviewsFile(sleepDir)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(kept, null, 2)); fs.renameSync(tmp, reviewsFile(sleepDir));
  return kept;
}
/** Registro de uso: nunca guarda el contenido enviado ni la llave. */
export function logCall(sleepDir: string, entry: { action: string; ok: boolean; model?: string; ms?: number; input_tokens?: number; reviewed?: number; error?: string }, now = new Date()) {
  try { fs.mkdirSync(sleepDir, { recursive: true }); fs.appendFileSync(logFile(sleepDir), JSON.stringify({ at: now.toISOString(), ...entry }) + '\n'); } catch {}
}
export function lastLog(sleepDir: string): Record<string, unknown> | null {
  try { const lines = fs.readFileSync(logFile(sleepDir), 'utf8').trim().split('\n'); return JSON.parse(lines[lines.length - 1]); } catch { return null; }
}
