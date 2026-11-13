'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type T = { id: string; title: string; dueDate: string | null; priority: string; isOverdue: boolean; isToday: boolean; source: string };
type D = {
  today: string;
  me: { name: string; role: string; isPrimary: boolean; canManage: boolean; isTop: boolean };
  brain: { id: string; viewingOther: boolean; viewingName: string; readOnly: boolean; isEmpty: boolean };
  counts: { overdue: number; today: number; open: number; completed: number };
  tasksToday: T[]; agenda: T[];
  log: { autonomy: string | null; applied: { id: string; title?: string; by?: string; at: string }[]; activity: { at: string; actor: string; action?: string; path: string }[]; pending: number };
  health: { nodes: number; links: number; brokenLinks: number; isolated: number; working: number };
  shared: { withMe: { title: string; owner: string; type: string }[]; companyExists: boolean };
  people: { accounts: { name: string; role: string; isActive: boolean; lastLoginAt: string | null }[]; brains: number } | null;
};
// Colores de la marca S.M. Jaleel, tomados de su logotipo.
const NAVY = '#00308f', CYAN = '#00a8f0';
const BRANDS = ['busta', 'chubby', 'fruta', 'oasis', 'altitude'];
const fmtDay = (iso: string | null) => { if (!iso) return 'Sin fecha'; const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); };
const ACTION: Record<string, string> = { remember_working: 'capturó una nota', create: 'creó una tarea', complete: 'completó una tarea', reschedule: 'reprogramó una tarea', decide: 'decidió una propuesta', update_dossier: 'actualizó una ficha', upsert_node: 'creó o cambió una ficha', consolidate_session: 'consolidó la memoria', ask_dots: 'pidió trabajo al agente' };

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-wide" style={{ color: NAVY }}>{title}</h2>{action}
      </div>
      {children}
    </section>
  );
}

export default function InicioPage() {
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [capture, setCapture] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch('/api/agent/dashboard', { cache: 'no-store' }); const j = await r.json(); if (r.ok && j.ok) { setD(j); setErr(null); } else setErr(j.error || 'No se pudo cargar tu tablero.'); }
    catch { setErr('No se pudo cargar tu tablero.'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const post = async (url: string, body: unknown, okText: string) => {
    setBusy(true); setNote(null);
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); setNote(r.ok && j.ok !== false ? okText : j.error || j.message || 'No se pudo completar.'); if (r.ok) await load(); return r.ok; }
    finally { setBusy(false); }
  };
  const doCapture = async (e: React.FormEvent) => { e.preventDefault(); const text = capture.trim(); if (text.length < 3) return setNote('Escribe lo que quieres capturar.'); if (await post('/api/agent/brain', { action: 'remember_working', title: text.slice(0, 70), content: text, source: 'Tablero inicial' }, 'Capturado en tu cerebro.')) setCapture(''); };
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Panama' }));
  const hello = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  if (err) return <div className="p-8"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</p></div>;
  if (!d) return <div className="p-8 text-sm text-slate-500">Cargando tu tablero…</div>;
  const stat = (label: string, value: number, tone?: string) => (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-3xl font-bold leading-tight" style={{ color: tone || NAVY }}>{value}</p>
    </div>
  );
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="relative overflow-hidden rounded-3xl px-6 py-6 text-white sm:px-8" style={{ background: NAVY }}>
        <span aria-hidden className="absolute -right-6 -top-10 h-40 w-40 rounded-full opacity-25" style={{ background: CYAN }} />
        <span aria-hidden className="absolute right-28 top-6 h-14 w-14 rounded-full opacity-40" style={{ background: CYAN }} />
        <span aria-hidden className="absolute right-20 bottom-4 h-6 w-6 rounded-full opacity-60" style={{ background: CYAN }} />
        <span aria-hidden className="absolute right-44 bottom-8 h-3 w-3 rounded-full bg-white opacity-70" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/smjaleel_white.png" alt="S.M. Jaleel" className="mb-3 h-8 w-auto" />
            <h1 className="text-2xl font-bold sm:text-3xl">{hello}, {d.me.name}</h1>
            <p className="text-sm text-white/80">{fmtDay(d.today)} · {d.brain.viewingOther ? `Estás viendo el cerebro de ${d.brain.viewingName}` : 'Tu segundo cerebro'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {d.log.autonomy && <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: CYAN, color: '#04214f' }}>{d.log.autonomy === 'auto' ? 'Modo automático' : 'Modo propuesta'}</span>}
            <Link href="/cerebro" className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold" style={{ color: NAVY }}>Abrir mi cerebro</Link>
          </div>
        </div>
      </header>

      {d.brain.isEmpty && !d.brain.viewingOther && (
        <section className="rounded-2xl border p-5" style={{ borderColor: CYAN, background: '#eef9ff' }}>
          <h2 className="text-base font-bold" style={{ color: NAVY }}>Tu cerebro está recién creado</h2>
          <p className="mt-1 text-sm text-slate-600">Tres pasos para empezar:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Captura tu primera idea o dato en el cuadro de abajo.</li>
            <li>Crea una tarea en <Link className="underline" href="/mis-tareas">Tareas</Link>.</li>
            <li>Conecta tu agente de IA desde <Link className="underline" href="/mi-agente">Mi agente</Link>.</li>
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat('Vencidas', d.counts.overdue, d.counts.overdue ? '#c0262d' : undefined)}
        {stat('Para hoy', d.counts.today)}
        {stat('Cambios de Jev y tu agente', d.log.applied.length + d.log.activity.length, CYAN)}
        {stat('Esperan tu criterio', d.log.pending, d.log.pending ? '#b45309' : undefined)}
      </div>

      {!d.brain.readOnly && (
        <form onSubmit={doCapture} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <input value={capture} onChange={e => setCapture(e.target.value)} placeholder="Captura una idea, un dato o un pendiente" aria-label="Captura rápida" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-sky-400" />
          <button disabled={busy} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: NAVY }}>Capturar</button>
        </form>
      )}
      {note && <p className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-slate-700">{note}</p>}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <Card title="Mis tareas de hoy" action={<Link href="/mis-tareas" className="text-xs font-semibold underline" style={{ color: NAVY }}>Ver todas ({d.counts.open})</Link>}>
            {d.tasksToday.length === 0 ? <p className="text-sm text-slate-500">Nada vence hoy.</p> : (
              <ul className="divide-y divide-slate-100">{d.tasksToday.map(t => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{t.title}</p>{t.source && <p className="truncate text-xs text-slate-500">{t.source}</p>}</div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-xs font-semibold ${t.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>{t.isOverdue ? 'Vencida' : 'Hoy'}</span>
                    {!d.brain.readOnly && <button disabled={busy} onClick={() => post('/api/agent/tasks', { action: 'complete', taskId: t.id, completedBy: d.me.name }, 'Tarea completada.')} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Completar</button>}
                  </div>
                </li>))}</ul>)}
          </Card>
          <Card title="Lo que hicieron Jev y tu agente" action={<Link href="/cerebro" className="text-xs font-semibold underline" style={{ color: NAVY }}>Ver el registro</Link>}>
            {d.log.applied.length + d.log.activity.length === 0 && d.log.pending === 0 && <p className="text-sm text-slate-500">Todavía no hay actividad.</p>}
            <ul className="divide-y divide-slate-100">
              {d.log.applied.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-slate-800">{a.title || 'Cambio aplicado'} <span className="text-slate-500">· {a.by || 'aprobado'}</span></span>
                  <button disabled={busy} onClick={() => post('/api/agent/dots-sleep', { action: 'undo', id: a.id }, 'Cambio deshecho.')} className="shrink-0 text-xs font-semibold underline" style={{ color: NAVY }}>Deshacer</button>
                </li>))}
              {d.log.activity.map((e, i) => (<li key={i} className="py-2.5 text-sm text-slate-700">Tu agente {ACTION[e.action || ''] || 'escribió en tu cerebro'} <span className="text-slate-500">· {new Date(e.at).toLocaleString('es-PA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></li>))}
              {d.log.pending > 0 && <li className="py-2.5 text-sm font-medium text-amber-700">{d.log.pending} {d.log.pending === 1 ? 'cosa espera' : 'cosas esperan'} tu criterio. Están en Cerebro, Ajustes.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-2">
          <Card title="Agenda" action={<Link href="/mi-agenda" className="text-xs font-semibold underline" style={{ color: NAVY }}>Ver agenda</Link>}>
            {d.agenda.length === 0 ? <p className="text-sm text-slate-500">No hay nada con fecha próxima.</p> : (
              <ul className="divide-y divide-slate-100">{d.agenda.map(t => (
                <li key={t.id} className="flex items-baseline gap-3 py-2.5"><span className="w-24 shrink-0 text-xs font-semibold capitalize" style={{ color: CYAN }}>{t.isToday ? 'Hoy' : fmtDay(t.dueDate)}</span><span className="min-w-0 truncate text-sm text-slate-800">{t.title}</span></li>))}</ul>)}
          </Card>
          <Card title="Compañía y compartido" action={<Link href="/compania" className="text-xs font-semibold underline" style={{ color: NAVY }}>Abrir</Link>}>
            <p className="text-sm text-slate-700">{d.shared.companyExists ? 'El cerebro de la compañía está disponible para consulta.' : 'El cerebro de la compañía aún no existe.'}</p>
            {d.shared.withMe.length > 0 ? <ul className="mt-2 space-y-1">{d.shared.withMe.map((s, i) => (<li key={i} className="truncate text-sm text-slate-700">{s.owner} compartió «{s.title}»</li>))}</ul> : <p className="mt-1 text-sm text-slate-500">Nadie ha compartido fichas contigo todavía.</p>}
          </Card>
          <Card title="Salud de mi cerebro">
            <p className="text-sm text-slate-700">{d.health.nodes} fichas · {d.health.links} conexiones</p>
            <p className="text-sm text-slate-500">{d.health.working} en memoria de trabajo · {d.health.brokenLinks} enlaces rotos · {d.health.isolated} sin conexión</p>
          </Card>
        </div>
      </div>

      {d.people && (
        <Card title="Personas" action={<Link href="/usuarios" className="text-xs font-semibold underline" style={{ color: NAVY }}>Administrar</Link>}>
          <p className="mb-2 text-sm text-slate-600">{d.people.accounts.filter(a => a.isActive).length} cuentas activas · {d.people.brains} cerebros</p>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{d.people.accounts.map((a, i) => (<li key={i} className="flex justify-between gap-2 text-sm"><span className="truncate text-slate-800">{a.name} <span className="text-slate-500">· {a.role}{a.isActive ? '' : ' · desactivada'}</span></span><span className="shrink-0 text-xs text-slate-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('es-PA', { day: 'numeric', month: 'short' }) : 'Sin entrar'}</span></li>))}</ul>
        </Card>
      )}

      {d.me.isPrimary && !d.brain.viewingOther && (
        <p className="text-xs text-slate-500">Tu espacio de trabajo anterior (empresas, proyectos y reuniones) sigue disponible en <Link className="underline" href="/clasico">Espacio anterior</Link>.</p>
      )}

      <footer className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        {BRANDS.map(b => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={b} src={`/brands/${b}-logo.png`} alt={b} className="h-7 w-auto opacity-80" />
        ))}
      </footer>
    </div>
  );
}
