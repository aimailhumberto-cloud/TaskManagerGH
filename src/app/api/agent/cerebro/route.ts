import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { currentBrain } from '@/lib/brainContext';
import { pedir, responder, consultar, decidir, listRequests, usageSummary, canDecide } from '@/lib/cerebro/engine';
import { loadSettings, saveSettings } from '@/lib/cerebro/settings';
import { llmConfigured, listModels, balance, chat, LlmError } from '@/lib/cerebro/ollama';
import { MENU } from '@/lib/cerebro/ops';
import { listReview, closeReview } from '@/lib/cerebro/review';
import { actorLabel } from '@/lib/actor';
import { configuredProvider } from '@/lib/decisionEngine';
import { withLang, tr, tw, replyLang, asLang, detectLang, type Lang } from '@/lib/reqLang';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * El Cerebro: la inteligencia interna. Los agentes y la app le hablan en palabras.
 * GET                      → estado, ajustes, consumo, «Por aprobar» y pedidos recientes
 * GET ?q=pregunta          → consulta (respuesta corta + expediente). &size=breve|normal|completo
 * GET ?models=1            → modelos disponibles en Ollama y saldo
 * GET ?id=ped-…            → un pedido
 * Idioma: la respuesta sale en el idioma del texto (español o inglés). Se puede forzar con «lang»:'es'|'en'; la pantalla manda «uiLang» como pista
 *   cuando el texto no basta. Los textos que la app escribe dentro de las fichas siguen el idioma de trabajo del cerebro (ajuste «workLang»).
 * POST {action:'pedir', text, deep?, dryRun?}   → arma el plan y lo aplica o lo deja «Por aprobar»
 * POST {action:'leer', text, source?, dryRun?}    → lee un correo o nota y extrae personas, fechas, compromisos y cifras
 * POST {action:'revisado', id}                   → cierra un pendiente de «Por revisar»
 * POST {action:'responder', id, text}            → contesta lo que el Cerebro preguntó; sigue con el mismo pedido
 * POST {action:'consultar', q, size?}           → igual que GET ?q=
 * POST {action:'aprobar'|'rechazar', id, omitir?:[n]} → decide una propuesta
 * POST {action:'ajustes', models?, mode?, bigTouch?, bigCreate?, agentCanApprove?, threshold?, workLang?}
 * POST {action:'probar'}                        → prueba la conexión con el modelo
 */
const isAgent = () => String(currentBrain()?.actor || '').startsWith('agente');
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const SIZES = ['breve', 'normal', 'completo'] as const;
const sizeOf = (v: unknown) => (SIZES.includes(v as any) ? v : 'normal') as (typeof SIZES)[number];

/** Idiomas de este pedido: respuesta (el del texto, o el forzado) y trabajo (el del cerebro; si aún no se eligió, el de quien lo usa por primera vez). */
function langsFor(vaultPath: string, input: { forced?: unknown; ui?: unknown; text?: string; fallback?: Lang }): { reply: Lang; work: Lang } {
  const s = loadSettings(vaultPath); const ui = asLang(input.ui);
  const hint = input.fallback ?? ui ?? s.workLang; // un texto dudoso sigue el idioma del pedido que ya existe; si no, el de la pantalla
  const reply = asLang(input.forced) ?? (input.text ? detectLang(input.text, hint) : hint);
  if (!s.workLangSet && ui && !isAgent()) { try { saveSettings(vaultPath, { workLang: ui }); } catch {} return { reply, work: ui }; }
  return { reply, work: s.workLang };
}

const httpOf = (st: string) => (st === 'fallo' ? 502 : st === 'no_entendido' ? 422 : st === 'pendiente' ? 202 : 200);
const nextOf = (st: string) => (st === 'pendiente' ? tr('Una persona lo aprueba en la app (Pedir → Por aprobar).', 'A person approves it in the app (Pedir → To approve).') : st === 'pregunta' ? tr("Contesta con POST {action:'responder', id, text}: solo lo que falta; el Cerebro recuerda el pedido.", "Answer with POST {action:'responder', id, text}: only what is missing; the Brain remembers the request.") : undefined);

async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return bad('Sin cerebro.', 401);
  const sp = new URL(req.url).searchParams;
  const { reply, work } = langsFor(ctx.vaultPath, { forced: sp.get('lang'), ui: sp.get('uiLang'), text: sp.get('q') || undefined });
  return withLang(reply, work, () => getInner(ctx, sp));
}
async function getInner(ctx: NonNullable<ReturnType<typeof currentBrain>>, sp: URLSearchParams) {
  if (sp.get('q')) { const r = await consultar(String(sp.get('q')), sizeOf(sp.get('size'))); return NextResponse.json(r, { status: r.status }); }
  if (sp.get('models')) {
    if (!llmConfigured()) return bad(tr('Falta OLLAMA_API_KEY en Render.', 'OLLAMA_API_KEY is missing in Render.'), 503);
    try { return NextResponse.json({ ok: true, models: await listModels(), balance: await balance() }); } catch (e: any) { return bad(e instanceof LlmError ? e.message : tr('No se pudo consultar Ollama.', 'Could not reach Ollama.'), 502); }
  }
  const all = listRequests(ctx.vaultPath);
  if (sp.get('id')) { const r = all.find(x => x.id === sp.get('id')); return r ? NextResponse.json({ ok: true, request: r }) : bad(tr('No existe ese pedido.', 'That request does not exist.'), 404); }
  return NextResponse.json({
    ok: true, name: 'el Cerebro', lang: replyLang(), ready: llmConfigured(), jev: !!configuredProvider(), settings: loadSettings(ctx.vaultPath), usage: usageSummary(ctx.vaultPath),
    canApprove: canDecide().ok, pending: all.filter(r => r.status === 'pendiente'), review: listReview(ctx.vaultPath).filter(i => !i.closedAt).slice(0, 50), questions: all.filter(r => r.status === 'pregunta' && Date.now() - Date.parse(r.at) < 3 * 86400_000).slice(0, 10), recent: all.filter(r => r.status !== 'pendiente').slice(0, 20),
    menu: Object.entries(MENU).map(([name, d]) => ({ name, level: d.level, what: d.desc })),
    how: tr("POST {action:'pedir', text} para pedir un cambio en palabras; GET ?q= para consultar. Borrar, verificar y compartir siempre esperan a una persona.", "POST {action:'pedir', text} to ask for a change in words; GET ?q= to look something up. Deleting, verifying and sharing always wait for a person."),
  });
}

async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return bad('Sin cerebro.', 401);
  const b = await req.json().catch(() => ({})); const action = String(b?.action || '');
  const known = ['responder', 'aprobar', 'rechazar'].includes(action) ? listRequests(ctx.vaultPath).find(x => x.id === String(b?.id || ''))?.lang : undefined;
  const text = action === 'consultar' ? String(b?.q || b?.text || '') : ['pedir', 'leer', 'responder'].includes(action) ? String(b?.text || '') : '';
  const { reply, work } = langsFor(ctx.vaultPath, { forced: b?.lang, ui: b?.uiLang, text: text.trim() || undefined, fallback: known });
  return withLang(reply, work, () => postInner(ctx, b, action));
}
async function postInner(ctx: NonNullable<ReturnType<typeof currentBrain>>, b: any, action: string) {
  if (action === 'consultar') { const q = String(b.q || b.text || '').trim(); if (!q) return bad(tr('Envía q.', 'Send q.')); const r = await consultar(q, sizeOf(b.size)); return NextResponse.json(r, { status: r.status }); }
  if (action === 'revisado') { const okk = closeReview(ctx.vaultPath, String(b.id || ''), isAgent() ? tw('Agente', 'Agent') : actorLabel(tw('Persona', 'Person'))); return okk ? NextResponse.json({ ok: true }) : bad(tr('No existe ese pendiente o ya está cerrado.', 'That item does not exist or is already closed.'), 404); }
  if (action === 'pedir' || action === 'leer') {
    const text = String(b.text || '').trim();
    if (text.length < 3) return bad(action === 'leer' ? tr('Pega el correo o la nota en «text».', 'Paste the email or note in “text”.') : tr('Escribe el pedido en «text».', 'Write the request in “text”.'));
    if (text.length > 60000) return bad(tr('El pedido es demasiado largo (máximo 60 000 caracteres). Divídelo.', 'The request is too long (60,000 characters maximum). Split it.'), 413);
    const r = await pedir({ text: action === 'leer' && typeof b.source === 'string' && b.source.trim() ? `Fuente: ${b.source.trim().slice(0, 200)}\n\n${text}` : text, deep: b.deep === true, dryRun: b.dryRun === true, kind: action === 'leer' ? 'leer' : 'pedir' });
    return NextResponse.json({ ...r, ok: httpOf(r.status) < 400, next: nextOf(r.status) }, { status: httpOf(r.status) });
  }
  if (action === 'responder') {
    const text = String(b.text || '').trim(); if (!text) return bad(tr('Escribe la respuesta en «text».', 'Write the answer in “text”.'));
    const r = await responder(String(b.id || ''), text);
    if (!r.ok) return bad(r.error, r.status);
    return NextResponse.json({ ...r, ok: !['fallo', 'no_entendido'].includes(r.status), next: nextOf(r.status) }, { status: httpOf(r.status) });
  }
  if (action === 'aprobar' || action === 'rechazar') {
    const r = await decidir(String(b.id || ''), action === 'aprobar', Array.isArray(b.omitir) ? b.omitir.map(Number).filter(Number.isInteger) : []);
    return NextResponse.json(r.ok ? { ok: true, request: r.request, receipt: r.receipt } : { ok: false, error: r.error }, { status: r.status });
  }
  if (action === 'ajustes' || action === 'probar') {
    if (isAgent()) return bad(tr('Los ajustes del Cerebro los cambia una persona en la app.', 'Brain settings are changed by a person in the app.'), 403);
    if (action === 'ajustes') {
      const patch: Record<string, unknown> = {};
      for (const k of ['models', 'mode', 'auto', 'bigTouch', 'bigCreate', 'agentCanApprove', 'threshold', 'workLang']) if (b[k] !== undefined) patch[k] = b[k];
      if (patch.workLang !== undefined && !asLang(patch.workLang)) return bad(tr("workLang debe ser 'es' o 'en'.", "workLang must be 'es' or 'en'."));
      return NextResponse.json({ ok: true, settings: saveSettings(ctx.vaultPath, patch) });
    }
    const s = loadSettings(ctx.vaultPath); const out: Record<string, unknown> = {};
    for (const [k, m] of Object.entries(s.models)) {
      if (Object.values(out).some((o: any) => o.model === m)) { out[k] = Object.values(out).find((o: any) => o.model === m); continue; }
      try { const r = await chat(m, [{ role: 'user', content: 'Responde solo: listo' }], undefined, 30_000); out[k] = { model: m, ok: true, ms: r.ms, reply: r.content.trim().slice(0, 40) }; }
      catch (e: any) { out[k] = { model: m, ok: false, error: e instanceof LlmError ? e.message : tr('Falló.', 'Failed.') }; }
    }
    return NextResponse.json({ ok: Object.values(out).every((o: any) => o.ok), test: out });
  }
  return bad(tr("action debe ser 'pedir', 'leer', 'responder', 'revisado', 'consultar', 'aprobar', 'rechazar', 'ajustes' o 'probar'.", "action must be 'pedir', 'leer', 'responder', 'revisado', 'consultar', 'aprobar', 'rechazar', 'ajustes' or 'probar'."));
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
