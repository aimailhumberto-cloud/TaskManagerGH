'use client';
import React, { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { useUiLang } from '@/lib/uiLang';

type Req = { id: string; at: string; by: string; text: string; status: string; plan: string[]; why?: string; results?: string[]; message?: string; changeId?: string; model?: string; ms?: number; confidence?: number | null; decidedBy?: string; decidedVia?: string; decidedAt?: string; dialog?: { q: string; a?: string }[]; recognized?: { id: string; name: string; type: string; verification?: string; isNew?: boolean }[]; links?: { label: string; href: string }[]; summary?: string; kind?: string; obs?: { supuso: string[]; fuertes: string[]; avisos: string[]; falta: string[]; jev?: { fiel: number | null; coherente?: number | null } } };
type Auto = { agenda: boolean; novedades: boolean; contactos: boolean; cifras: boolean };
type Settings = { models: { rapido: string; grande: string }; mode: 'proponer' | 'auto' | 'mixto'; auto: Auto; bigTouch: number; bigCreate: number; agentCanApprove: boolean; threshold: number };
type State = { ready: boolean; jev: boolean; settings: Settings; usage: { today: { calls: number; usd: number }; month: { calls: number; usd: number }; avgMs: number; unknownPrice: boolean }; canApprove: boolean; pending: Req[]; questions?: Req[]; review?: { id: string; kind: string; text: string; at: string }[]; recent: Req[] };
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
  const [reply, setReply] = useState('');
  const [omit, setOmit] = useState<Record<string, number[]>>({});

  const load = useCallback(async () => {
    const r = await fetch('/api/agent/cerebro', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (r.ok) setSt(d); else setError(d.error || 'Sin acceso.');
  }, []);
  useEffect(() => { load(); }, [load]);
  const post = async (body: unknown) => {
    const r = await fetch('/api/agent/cerebro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { r, d: await r.json().catch(() => ({})) };
  };
  async function pedir(kind: 'pedir' | 'leer' = 'pedir') {
    if (text.trim().length < 3) return;
    setBusy(kind); setError(null); setAnswer(null); setLast(null);
    const { d } = await post({ action: kind, text });
    if (d?.id) { setLast(d); if (d.status === 'aplicado' || d.status === 'pendiente') setText(''); } else setError(d.error || 'No se pudo.');
    setBusy(null); load();
  }
  async function responder(id: string) {
    if (!reply.trim()) return;
    setBusy('responder'); setError(null);
    const { d } = await post({ action: 'responder', id, text: reply });
    if (d?.id) { setLast(d); setReply(''); if (d.status === 'aplicado' || d.status === 'pendiente') setText(''); } else setError(d.error || 'No se pudo.');
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
    const { r, d } = await post({ action, id, ...(action === 'aprobar' && omit[id]?.length ? { omitir: omit[id] } : {}) });
    if (!r.ok) setError(d.error || 'No se pudo.'); else if (last?.id === id) setLast(d.request);
    setBusy(null); load();
  }
  async function revisado(id: string) { await post({ action: 'revisado', id }); load(); }
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
  const TYPE: Record<string, string> = { person: L('persona', 'person'), distributor: L('distribuidor', 'distributor'), brand: L('marca', 'brand'), market: L('mercado', 'market'), customer: L('cliente', 'customer'), organization: L('organización', 'organization'), department: L('departamento', 'department') };
  const Plan = ({ r }: { r: Req }) => (
    <>
      {!!r.recognized?.length && <p className="mt-2 text-xs text-slate-600">{L('Reconocí a:', 'I recognized:')} {r.recognized.map(x => `${x.name} (${TYPE[x.type] || x.type}${x.isNew ? `, ${L('NUEVA', 'NEW')}` : x.verification === 'verified' ? `, ${L('verificada', 'verified')}` : `, ${L('sin verificar', 'unverified')}`})`).join(' · ')}</p>}
      {r.decidedBy && (r.status === 'aplicado' || r.status === 'rechazado') && <p className="mt-2 text-xs text-slate-500">{r.status === 'rechazado' ? L('Rechazado', 'Rejected') : L('Aprobado', 'Approved')} {r.decidedVia === 'agente' ? L('por el agente', 'by the agent') : L('manualmente', 'manually')} · {r.decidedBy}{r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>}
      {r.summary && <p className="mt-2 text-sm font-semibold">{L('Encontré:', 'I found:')} {r.summary}</p>}
      {r.status === 'pendiente' && r.plan.length > 1 && st?.canApprove
        ? <ul className="mt-2 space-y-1 text-sm text-[#0b1f4d]">{r.plan.map((p, i) => { const off = (omit[r.id] || []).includes(i); return (<li key={i}><label className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={!off} onChange={() => setOmit(o => ({ ...o, [r.id]: off ? (o[r.id] || []).filter(x => x !== i) : [...(o[r.id] || []), i] }))} /><span className={off ? 'text-slate-400 line-through' : ''}>{p}</span></label></li>); })}</ul>
        : <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[#0b1f4d]">{(r.results?.length ? r.results : r.plan).map((p, i) => <li key={i}>{p}</li>)}</ol>}
      {r.obs && (r.obs.supuso.length + r.obs.fuertes.length + r.obs.avisos.length + r.obs.falta.length > 0 || r.obs.jev?.fiel != null) && (
        <div className="mt-3 space-y-1 rounded-xl bg-[#f7f9fd] p-3 text-xs text-slate-700">
          <p className="font-semibold text-[#0b1f4d]">{L('Observaciones', 'Notes')}{r.obs.jev?.fiel != null ? ` · Jev: ${Math.round(r.obs.jev.fiel * 100)} % ${L('de confianza en el plan', 'confidence in the plan')}` : ''}{r.obs.jev?.coherente != null ? ` · ${Math.round(r.obs.jev.coherente * 100)} % ${L('coherente con lo anterior', 'consistent with before')}` : ''}</p>
          {r.obs.supuso.map((t, i) => <p key={'s' + i}><span className="font-semibold">{L('Supuse:', 'Assumed:')}</span> {t}</p>)}
          {r.obs.fuertes.map((t, i) => <p key={'f' + i} className="text-amber-800"><span className="font-semibold">{L('Ojo:', 'Check:')}</span> {t}</p>)}
          {r.obs.avisos.map((t, i) => <p key={'a' + i} className="text-amber-800"><span className="font-semibold">{L('Aviso:', 'Note:')}</span> {t}</p>)}
          {r.obs.falta.map((t, i) => <p key={'m' + i}><span className="font-semibold">{L('Falta:', 'Missing:')}</span> {t}</p>)}
        </div>)}
      {r.status === 'aplicado' && !!r.links?.length && <p className="mt-3 flex flex-wrap gap-2 text-xs">{L('Ver dónde quedó:', 'See where it went:')}{r.links.map(l => <a key={l.href} href={l.href} className="rounded-full bg-[#eef3fb] px-2.5 py-1 font-semibold text-[#0a3fbf] hover:bg-[#dbe7fb]">{l.label} →</a>)}</p>}
    </>
  );
  const Talk = ({ r }: { r: Req }) => (
    <div className="mt-2 space-y-2">
      {(r.dialog || []).map((d, i) => (<div key={i} className="space-y-1 text-sm"><p className="rounded-xl bg-[#eef3fb] px-3 py-2"><span className="font-semibold">{L('El Cerebro:', 'The brain:')}</span> {d.q}</p>{d.a && <p className="ml-6 rounded-xl bg-[#0a3fbf] px-3 py-2 text-white">{d.a}</p>}</div>))}
      {r.status === 'pregunta' && (
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); responder(r.id); }}>
          <input autoFocus className={input} value={reply} onChange={e => setReply(e.target.value)} placeholder={L('Responde solo lo que falta…', 'Answer just what is missing…')} />
          <button className={btn} disabled={!!busy}>{busy === 'responder' ? L('Pensando…', 'Thinking…') : L('Responder', 'Reply')}</button>
        </form>)}
    </div>
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
        {st && !st.ready && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{L('El Cerebro aún no tiene modelo conectado (falta la llave de Ollama en Render). Mientras tanto, «Solo preguntar» responde con los datos del cerebro.', 'The brain has no model connected yet (Ollama key missing in Render). Meanwhile, “Just ask” answers from the brain data.')}</p>}
        <div className={card}>
          <textarea className={`${input} min-h-[110px]`} value={text} onChange={e => setText(e.target.value)} maxLength={60000}
            placeholder={L('Ej.: «La reunión con MEDIMEX pasó al lunes 16 a las 3 pm; anótalo y crea tarea de enviar la propuesta el viernes.»', 'E.g.: “The MEDIMEX meeting moved to Monday 16 at 3 pm; note it and add a task to send the proposal on Friday.”')} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className={btn} disabled={!!busy || !st?.ready} onClick={() => pedir('pedir')}>{busy === 'pedir' ? L('Pensando…', 'Thinking…') : L('Pedir un cambio', 'Make a change')}</button>
            <button className={ghost} disabled={!!busy || !st?.ready} onClick={() => pedir('leer')}>{busy === 'leer' ? L('Leyendo…', 'Reading…') : L('Leer y extraer', 'Read and extract')}</button>
            <button className={ghost} disabled={!!busy} onClick={preguntar}>{busy === 'preguntar' ? L('Buscando…', 'Searching…') : L('Solo preguntar', 'Just ask')}</button>
          </div>
          <div className="mt-3 space-y-0.5 text-xs text-slate-500">
            <p><span className="font-semibold text-[#0a3fbf]">{L('Pedir un cambio', 'Make a change')}:</span> {L('anota, agenda, crea tareas o fichas. ', 'notes, schedules, creates tasks or notes. ')}{s?.mode === 'auto' ? L('Se aplica solo; lo grande y lo delicado espera tu aprobación.', 'Applies on its own; big or sensitive things wait for you.') : s?.mode === 'proponer' ? L('Nada cambia hasta que apruebes.', 'Nothing changes until you approve.') : L('Lo que marcaste como automático en Ajustes se aplica solo; el resto espera tu aprobación.', 'What you set as automatic in Settings applies on its own; the rest waits for you.')}</p>
            <p><span className="font-semibold text-[#0a3fbf]">{L('Leer y extraer', 'Read and extract')}:</span> {L('pega un correo o una nota; saca personas, fechas, compromisos y cifras, y te muestra el resumen.', 'paste an email or note; it pulls people, dates, commitments and figures and shows you the summary.')}</p>
            <p><span className="font-semibold text-[#0a3fbf]">{L('Solo preguntar', 'Just ask')}:</span> {L('consulta lo que el cerebro sabe. No cambia nada.', 'looks up what the brain knows. Changes nothing.')}</p>
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
            {last.status === 'pregunta' ? <Talk r={last} /> : last.message && <p className="mt-2 text-sm">{last.message}</p>}
            {last.why && last.status === 'pendiente' && <p className="mt-1 text-xs text-amber-700">{last.why}</p>}
            {last.plan?.length > 0 && <Plan r={last} />}
            <Actions r={last} />
          </div>
        )}
        {!!st?.questions?.filter(q => q.id !== last?.id).length && (
          <div className={card}>
            <h2 className="text-base font-semibold">{L('El Cerebro espera tu respuesta', 'The brain is waiting for your answer')}</h2>
            <div className="mt-2 divide-y divide-[#eef3fb]">
              {st.questions.filter(q => q.id !== last?.id).map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0"><p className="text-xs text-slate-500">«{r.text.length > 90 ? r.text.slice(0, 90) + '…' : r.text}» · {r.by}</p><p className="mt-0.5">{r.message}</p></div>
                  <button className={ghost} onClick={() => { setLast(r); setReply(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{L('Responder', 'Reply')}</button>
                </div>))}
            </div>
          </div>)}
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
        {!!st?.review?.length && (
          <div className={card}>
            <h2 className="text-base font-semibold">{L('Por revisar', 'To review')} <span className="ml-1 rounded-full bg-[#eef3fb] px-2 py-0.5 text-xs text-[#0a3fbf]">{st.review.length}</span></h2>
            <p className="mt-1 text-xs text-slate-500">{L('Pendientes de calidad. No bloquean nada; ciérralos cuando los resuelvas.', 'Quality follow-ups. They block nothing; close them once resolved.')}</p>
            <div className="mt-2 divide-y divide-[#eef3fb]">
              {st.review.slice(0, 15).map(i => (
                <div key={i.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <p className="min-w-0"><span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold ${i.kind === 'falta' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>{i.kind === 'falta' ? L('Falta', 'Missing') : L('Aviso', 'Note')}</span>{i.text}</p>
                  <button className="shrink-0 text-xs font-semibold text-[#0a3fbf] underline underline-offset-2" onClick={() => revisado(i.id)}>{L('Listo', 'Done')}</button>
                </div>))}
            </div>
          </div>)}
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
              <div className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-slate-600">{L('Qué se aplica solo (lo demás espera tu aprobación)', 'What applies on its own (the rest waits for you)')}</span>
                {([['agenda', L('Tareas y agenda', 'Tasks and agenda')], ['novedades', L('Novedades y datos de fichas', 'Updates and note data')], ['contactos', L('Fichas nuevas: contactos y empresas', 'New notes: contacts and companies')], ['cifras', L('Cifras e indicadores', 'Figures and indicators')]] as [keyof Auto, string][]).map(([k, name]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!s.auto?.[k]} onChange={e => saveSettings({ auto: { ...s.auto, [k]: e.target.checked } })} /><span>{name}</span></label>))}
              </div>
              <label className="space-y-1"><span className="text-xs font-semibold text-slate-600">{L('Confianza mínima de Jev', 'Minimum Jev confidence')} ({Math.round(s.threshold * 100)} %)</span>
                <input type="range" min={30} max={100} step={5} className="w-full" value={Math.round(s.threshold * 100)} onChange={e => saveSettings({ threshold: Number(e.target.value) / 100 })} /></label>
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
