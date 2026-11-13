import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { currentBrain } from '@/lib/brainContext';
import { pedir, consultar, decidir, listRequests, usageSummary, canDecide } from '@/lib/cerebro/engine';
import { loadSettings, saveSettings } from '@/lib/cerebro/settings';
import { llmConfigured, listModels, balance, chat, LlmError } from '@/lib/cerebro/ollama';
import { MENU } from '@/lib/cerebro/ops';
import { configuredProvider } from '@/lib/decisionEngine';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * El Cerebro: la inteligencia interna. Los agentes y la app le hablan en palabras.
 * GET                      → estado, ajustes, consumo, «Por aprobar» y pedidos recientes
 * GET ?q=pregunta          → consulta (respuesta corta + expediente). &size=breve|normal|completo
 * GET ?models=1            → modelos disponibles en Ollama y saldo
 * GET ?id=ped-…            → un pedido
 * POST {action:'pedir', text, deep?, dryRun?}   → arma el plan y lo aplica o lo deja «Por aprobar»
 * POST {action:'consultar', q, size?}           → igual que GET ?q=
 * POST {action:'aprobar'|'rechazar', id, omitir?:[n]} → decide una propuesta
 * POST {action:'ajustes', models?, mode?, bigTouch?, bigCreate?, agentCanApprove?, threshold?}
 * POST {action:'probar'}                        → prueba la conexión con el modelo
 */
const isAgent = () => String(currentBrain()?.actor || '').startsWith('agente');
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const SIZES = ['breve', 'normal', 'completo'] as const;
const sizeOf = (v: unknown) => (SIZES.includes(v as any) ? v : 'normal') as (typeof SIZES)[number];

async function _GET(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return bad('Sin cerebro.', 401);
  const sp = new URL(req.url).searchParams;
  if (sp.get('q')) { const r = await consultar(String(sp.get('q')), sizeOf(sp.get('size'))); return NextResponse.json(r, { status: r.status }); }
  if (sp.get('models')) {
    if (!llmConfigured()) return bad('Falta OLLAMA_API_KEY en Render.', 503);
    try { return NextResponse.json({ ok: true, models: await listModels(), balance: await balance() }); } catch (e: any) { return bad(e instanceof LlmError ? e.message : 'No se pudo consultar Ollama.', 502); }
  }
  const all = listRequests(ctx.vaultPath);
  if (sp.get('id')) { const r = all.find(x => x.id === sp.get('id')); return r ? NextResponse.json({ ok: true, request: r }) : bad('No existe ese pedido.', 404); }
  return NextResponse.json({
    ok: true, name: 'el Cerebro', ready: llmConfigured(), jev: !!configuredProvider(), settings: loadSettings(ctx.vaultPath), usage: usageSummary(ctx.vaultPath),
    canApprove: canDecide().ok, pending: all.filter(r => r.status === 'pendiente'), recent: all.filter(r => r.status !== 'pendiente').slice(0, 20),
    menu: Object.entries(MENU).map(([name, d]) => ({ name, level: d.level, what: d.desc })),
    how: "POST {action:'pedir', text} para pedir un cambio en palabras; GET ?q= para consultar. Borrar, verificar y compartir siempre esperan a una persona.",
  });
}

async function _POST(req: NextRequest) {
  const ctx = currentBrain(); if (!ctx) return bad('Sin cerebro.', 401);
  const b = await req.json().catch(() => ({})); const action = String(b?.action || '');
  if (action === 'consultar') { const q = String(b.q || b.text || '').trim(); if (!q) return bad('Envía q.'); const r = await consultar(q, sizeOf(b.size)); return NextResponse.json(r, { status: r.status }); }
  if (action === 'pedir') {
    const text = String(b.text || '').trim();
    if (text.length < 3) return bad('Escribe el pedido en «text».');
    if (text.length > 60000) return bad('El pedido es demasiado largo (máximo 60 000 caracteres). Divídelo.', 413);
    const r = await pedir({ text, deep: b.deep === true, dryRun: b.dryRun === true });
    const status = r.status === 'fallo' ? 502 : r.status === 'no_entendido' ? 422 : r.status === 'pendiente' ? 202 : 200;
    return NextResponse.json({ ok: status < 400, ...r, next: r.status === 'pendiente' ? 'Una persona lo aprueba en la app (Pedir → Por aprobar).' : r.status === 'pregunta' ? 'Responde la pregunta enviando el pedido de nuevo, completo.' : undefined }, { status });
  }
  if (action === 'aprobar' || action === 'rechazar') {
    const r = await decidir(String(b.id || ''), action === 'aprobar', Array.isArray(b.omitir) ? b.omitir.map(Number).filter(Number.isInteger) : []);
    return NextResponse.json(r.ok ? { ok: true, request: r.request, receipt: r.receipt } : { ok: false, error: r.error }, { status: r.status });
  }
  if (action === 'ajustes' || action === 'probar') {
    if (isAgent()) return bad('Los ajustes del Cerebro los cambia una persona en la app.', 403);
    if (action === 'ajustes') {
      const patch: Record<string, unknown> = {};
      for (const k of ['models', 'mode', 'bigTouch', 'bigCreate', 'agentCanApprove', 'threshold']) if (b[k] !== undefined) patch[k] = b[k];
      return NextResponse.json({ ok: true, settings: saveSettings(ctx.vaultPath, patch) });
    }
    const s = loadSettings(ctx.vaultPath); const out: Record<string, unknown> = {};
    for (const [k, m] of Object.entries(s.models)) {
      if (Object.values(out).some((o: any) => o.model === m)) { out[k] = Object.values(out).find((o: any) => o.model === m); continue; }
      try { const r = await chat(m, [{ role: 'user', content: 'Responde solo: listo' }], undefined, 30_000); out[k] = { model: m, ok: true, ms: r.ms, reply: r.content.trim().slice(0, 40) }; }
      catch (e: any) { out[k] = { model: m, ok: false, error: e instanceof LlmError ? e.message : 'Falló.' }; }
    }
    return NextResponse.json({ ok: Object.values(out).every((o: any) => o.ok), test: out });
  }
  return bad("action debe ser 'pedir', 'consultar', 'aprobar', 'rechazar', 'ajustes' o 'probar'.");
}
export const GET = withBrain(_GET);
export const POST = withBrain(_POST);
