'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { useUiLang } from '@/lib/uiLang';

type Req = { id: string; at: string; by: string; text: string; status: string; plan: string[]; why?: string; results?: string[]; message?: string; changeId?: string; model?: string; ms?: number; confidence?: number | null; decidedBy?: string };
type Settings = { models: { rapido: string; grande: string }; mode: 'proponer' | 'auto'; bigTouch: number; bigCreate: number; agentCanApprove: boolean; threshold: number };
type State = { ready: boolean; jev: boolean; settings: Settings; usage: { today: { calls: number; usd: number }; month: { calls: number; usd: number }; avgMs: number; unknownPrice: boolean }; canApprove: boolean; pending: Req[]; recent: Req[] };
const card = 'rounded-2xl border border-[#dbe4f3] bg-white p-5 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]';
const input = 'w-full rounded-xl border border-[#dbe4f3] bg-white px-3 py-2 text-sm outline-none focus:border-[#0a3fbf]';
const btn = 'rounded-xl bg-[#0a3fbf] px-4 py-2 text-sm font-semibold text-white hover:bg-[#08318f] disabled:opacity-50';
const ghost = 'rounded-xl border border-[#dbe4f3] bg-white px-4 py-2 text-sm font-semibold text-[#0a3fbf] hover:bg-[#eef3fb] disabled:opacity-50';

export default function PedirPage() {
  const { L, locale } = useUiLang();
  const [st, setSt] = useState<State | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<Req | null>(null);
  const [answer, setAnswer] = useState<{ answer: string; writtenBy: string; sources: { title: string }[]; missing: string[] } | null>(null);
  const [models, setModels] = useState<string[] | null>(null);
  const [test, setTest] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/agent/cerebro', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (r.ok) setSt(d); else setError(d.error || 'Sin acceso.');
  }, []);
  useEffect(() => { load(); }, [load]);
  const post = async (body: unknown) => {
    const r = await fetch('/api/agent/cerebro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { r, d: await r.json().catch(() => ({})) };
  };
  async function pedir() {
    if (text.trim().length < 3) return;
    setBusy('pedir'); setError(null); setAnswer(null); setLast(null);
    const { d } = await post({ action: 'pedir', text });
    if (d?.id) { setLast(d); if (d.status === 'aplicado' || d.status === 'pendiente') setText(''); } else setError(d.error || 'No se pudo.');
    setBusy(null); load();
  }
  async function preguntar() {
    if (text.trim().length < 3) return;
    setBusy('preguntar'); setError(null); setAnswer(null); setLast(null);
    const { r, d } = await post({ action: 'consultar', q: text });
    if (r.ok) setAnswer({ answer: d.answer, writtenBy: d.writtenBy, sources: (d.dossier?.sources || []).slice(0, 6), missing: d.dossier?.missing || [] }); else setError(d.error || 'No encontré eso en el cerebro.');
    setBusy(null);
  }
  async function decide(id: string, action: 'aprobar' | 'rechazar') {
    setBusy(id); setError(null);
    const { r, d } = await post({ action, id });
    if (!r.ok) setError(d.error || 'No se pudo.'); else if (last?.id === id) setLast(d.request);
    setBusy(null); load();
  }
  async function undo(changeId: string) {
    setBusy(changeId); setError(null);
    const r = await fetch('/api/agent/changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'undo', changeId }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || 'No se pudo deshacer.'); else { setLast(null); setError(null); setTest(d.message || L('Deshecho.', 'Undone.')); }
    setBusy(null); load();
  }
  async function saveSettings(patch: Partial<Settings>) { const { r, d } = await post({ action: 'ajustes', ...patch }); if (r.ok) setSt(s => (s ? { ...s, settings: d.settings } : s)); else setError(d.error || 'No se pudo guardar.'); }
  async function openSettings() {
    setOpen(o => !o);
    if (models) return;
    const r = await fetch('/api/agent/cerebro?models=1'); const d = await r.json().catch(() => ({}));
    setModels(r.ok ? d.models : []);
  }
  async function probar() {
    setBusy('probar'); setTest(null);
    const { d } = await post({ action: 'probar' });
    const t = d.test || {}; setTest(Object.entries(t).map(([k, v]: [string, any]) => `${k === 'rapido' ? L('Rápido', 'Fast') : L('Grande', 'Large')} (${v.model}): ${v.ok ? `${L('responde en', 'answers in')} ${(v.ms / 1000).toFixed(1)} s` : v.error}`).join(' · ') || d.error || 'Sin respuesta.');
    setBusy(null);
  }
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const STATUS: Record<string, [string, string]> = {
    aplicado: [L('Hecho', 'Done'), 'bg-emerald-100 text-emerald-800'], pendiente: [L('Por aprobar', 'To approve'), 'bg-amber-100 text-amber-800'], rechazado: [L('Rechazado', 'Rejected'), 'bg-slate-100 text-slate-600'],
    pregunta: [L('Falta un dato', 'Needs detail'), 'bg-sky-100 text-sky-800'], no_entendido: [L('No entendido', 'Not understood'), 'bg-rose-100 text-rose-700'], fallo: [L('Falló', 'Failed'), 'bg-rose-100 text-rose-700'],
  };
  const Badge = ({ s }: { s: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[s]?.[1] || 'bg-slate-100'}`}>{STATUS[s]?.[0] || s}</span>;
  const Plan = ({ r }: { r: Req }) => (
    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0b1f4d]">{(r.results?.length ? r.results : r.plan).map((p, i) => <li key={i}>{p}</li>)}</ol>
  );
  const Actions = ({ r }: { r: Req }) => r.status === 'pendiente' && st?.canApprove ? (
    <div className="mt-3 flex gap-2">
      <button className={btn} disabled={!!busy} onClick={() => decide(r.id, 'aprobar')}>{busy === r.id ? L('Aplicando…', 'Applying…') : L('Aprobar', 'Approve')}</button>
      <button className={ghost} disabled={!!busy} onClick={() => decide(r.id, 'rechazar')}>{L('Rechazar', 'Reject')}</button>
    </div>
  ) : r.status === 'aplicado' && r.changeId ? (
    <button className="mt-3 text-xs font-medium text-rose-700 underline underline-offset-2" disabled={!!busy} onClick={() => undo(r.changeId!)}>{L('Deshacer', 'Undo')}</button>
  ) : null;
  const s = st?.settings;

  return (
    <div className="min-h-full bg-[#f2f6fd] text-[#0b1f4d]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <PageHero title={L('Dile al cerebro', 'Tell the brain')} subtitle={L('Pide un cambio o haz una pregunta, con tus palabras.', 'Ask for a change or a question, in your own words.')} />
        {st && !st.ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{L('El Cerebro aún no tiene modelo conectado (falta la llave de Ollama en Render). Mientras tanto, «Preguntar» responde con los datos del cerebro.', 'The brain has no model connected yet (Ollama key missing in Render). Meanwhile, “Ask” answers from the brain data.')}</p>}
        <div className={card}>
          <textarea className={`${input} min-h-[110px]`} value={text} onChange={e => setText(e.target.value)} maxLength={60000}
            placeholder={L('Ej.: «La reunión con MEDIMEX pasó al lunes 16 a las 3 pm; anótalo y crea tarea de enviar la propuesta el viernes.»', 'E.g.: “The MEDIMEX meeting moved to Monday 16 at 3 pm; note it and add a task to send the proposal on Friday.”')} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={btn} disabled={!!busy || !st?.ready} onClick={pedir}>{busy === 'pedir' ? L('Pensando…', 'Thinking…') : L('Pedir', 'Request')}</button>
            <button className={ghost} disabled={!!busy} onClick={preguntar}>{busy === 'preguntar' ? L('Buscando…', 'Searching…') : L('Preguntar', 'Ask')}</button>
            <span className="text-xs text-slate-500">{s?.mode === 'auto' ? L('Modo automático: lo simple se aplica solo; lo grande y lo delicado espera tu aprobación.', 'Automatic mode: simple things apply on their own; big or sensitive ones wait for you.') : L('Modo proponer: nada cambia hasta que apruebes.', 'Propose mode: nothing changes until you approve.')}</span>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {test && <p className="rounded-xl bg-[#eef3fb] p-3 text-sm text-[#0b1f4d]">{test}</p>}
        {answer && (
          <div className={card}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
            {answer.missing.length > 0 && <p className="mt-3 text-xs text-amber-700">{L('Lo que falta:', 'Missing:')} {answer.missing.slice(0, 4).join(' · ')}</p>}
            <p className="mt-3 text-xs text-slate-500">{L('Fuentes:', 'Sources:')} {answer.sources.map(x => x.title).join(' · ')} · {answer.writtenBy === 'app' ? L('respuesta directa del cerebro', 'direct answer from the brain') : `${L('redactó', 'written by')} ${answer.writtenBy}`}</p>
          </div>
        )}
        {last && (
          <div className={card}>
            <div className="flex items-center gap-2"><Badge s={last.status} />{last.ms ? <span className="text-xs text-slate-500">{(last.ms / 1000).toFixed(1)} s · {last.model}</span> : null}</div>
            {last.message && <p className="mt-2 text-sm">{last.message}</p>}
            {last.why && last.status === 'pendiente' && <p className="mt-1 text-xs text-amber-700">{last.why}</p>}
            {last.plan?.length > 0 && <Plan r={last} />}
            <Actions r={last} />
          </div>
        )}
        <div className={card}>
          <h2 className="text-base font-semibold">{L('Por aprobar', 'To approve')} {st?.pending.length ? <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{st.pending.length}</span> : null}</h2>
          {st && st.pending.length === 0 && <p className="mt-2 text-sm text-slate-500">{L('Nada pendiente.', 'Nothing pending.')}</p>}
          <div className="mt-2 divide-y divide-[#eef3fb]">
            {st?.pending.map(r => (
              <div key={r.id} className="py-3">
                <p className="text-xs text-slate-500">{r.by} · {when(r.at)}</p>
                <p className="mt-1 text-sm font-medium">«{r.text.length > 220 ? r.text.slice(0, 220) + '…' : r.text}»</p>
                {r.why && <p className="mt-1 text-xs text-amber-700">{r.why}</p>}
                <Plan r={r} /><Actions r={r} />
              </div>))}
          </div>
        </div>
        <div className={card}>
          <h2 className="text-base font-semibold">{L('Últimos pedidos', 'Recent requests')}</h2>
          <div className="mt-2 divide-y divide-[#eef3fb]">
            {st?.recent.map(r => (
              <details key={r.id} className="py-2 text-sm">
                <summary className="cursor-pointer list-none"><Badge s={r.status} /> <span className="ml-1">{r.text.length > 110 ? r.text.slice(0, 110) + '…' : r.text}</span> <span className="text-xs text-slate-500">· {r.by} · {when(r.at)}</span></summary>
                {r.message && <p className="mt-2 text-xs text-slate-600">{r.message}</p>}
                {r.plan?.length > 0 && <Plan r={r} />}<Actions r={r} />
              </details>))}
            {st && st.recent.length === 0 && <p className="py-2 text-sm text-slate-500">{L('Aún no hay pedidos.', 'No requests yet.')}</p>}
          </div>
        </div>
        <div className={card}>
          <button className="flex w-full items-center justify-between text-left text-base font-semibold" onClick={openSettings}>{L('Ajustes de la IA del cerebro', 'Brain AI settings')}<span className="text-sm text-[#0a3fbf]">{open ? '−' : '+'}</span></button>
          {st && <p className="mt-1 text-xs text-slate-500">{L('Hoy', 'Today')}: {st.usage.today.calls} {L('llamadas', 'calls')} · US$ {st.usage.today.usd.toFixed(3)} · {L('Mes', 'Month')}: {st.usage.month.calls} · US$ {st.usage.month.usd.toFixed(2)}{st.usage.avgMs ? ` · ${(st.usage.avgMs / 1000).toFixed(1)} s ${L('en promedio', 'average')}` : ''}{st.usage.unknownPrice ? ` · ${L('costo aproximado', 'approximate cost')}` : ''} · Jev: {st.jev ? L('conectado', 'connected') : L('no conectado', 'not connected')}</p>}
          {open && s && (
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {(['rapido', 'grande'] as const).map(k => (
                <label key={k} className="space-y-1"><span className="text-xs font-semibold text-slate-600">{k === 'rapido' ? L('Modelo rápido (archivar y responder)', 'Fast model (filing and answers)') : L('Modelo grande (pedidos largos)', 'Large model (long requests)')}</span>
                  <select className={input} value={s.models[k]} onChange={e => saveSettings({ models: { ...s.models, [k]: e.target.value } })}>
                    {[...new Set([s.models[k], ...(models || [])])].map(m => <option key={m} value={m}>{m}</option>)}
                  </select></label>))}
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">{L('Modo', 'Mode')}</span>
                <select className={input} value={s.mode} onChange={e => saveSettings({ mode: e.target.value as Settings['mode'] })}><option value="proponer">{L('Proponer: todo espera mi aprobación', 'Propose: everything waits for me')}</option><option value="auto">{L('Automático: lo simple se aplica solo', 'Automatic: simple things apply')}</option></select></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">{L('Confianza mínima de Jev', 'Minimum Jev confidence')} ({Math.round(s.threshold * 100)} %)</span>
                <input type="range" min={50} max={100} step={5} className="w-full" value={Math.round(s.threshold * 100)} onChange={e => saveSettings({ threshold: Number(e.target.value) / 100 })} /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">{L('Pedido grande si toca más de… fichas', 'Big request if it touches more than… notes')}</span>
                <input type="number" min={1} max={500} className={input} defaultValue={s.bigTouch} onBlur={e => saveSettings({ bigTouch: Number(e.target.value) })} /></label>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">{L('…o crea más de… fichas', '…or creates more than… notes')}</span>
                <input type="number" min={1} max={500} className={input} defaultValue={s.bigCreate} onBlur={e => saveSettings({ bigCreate: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={s.agentCanApprove} onChange={e => saveSettings({ agentCanApprove: e.target.checked })} /><span>{L('Mi agente puede aprobar propuestas (con llave de alcance «Escribir»)', 'My agent may approve proposals (key with “Write” scope)')}</span></label>
              <div className="sm:col-span-2"><button className={ghost} disabled={!!busy || !st?.ready} onClick={probar}>{busy === 'probar' ? L('Probando…', 'Testing…') : L('Probar conexión', 'Test connection')}</button></div>
              <p className="text-xs text-slate-500 sm:col-span-2">{L('Borrar, marcar verificado y compartir siempre esperan a una persona, en cualquier modo. La llave de Ollama vive en Render, nunca aquí.', 'Deleting, verifying and sharing always wait for a person, in any mode. The Ollama key lives in Render, never here.')}</p>
            </div>)}
        </div>
      </div>
    </div>
  );
}
