'use client';
import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/services/mockData';
import { activeWork, eventDay, type CalendarSnapshot, type Reminder } from '@/lib/planning';
import { secureFetch } from '@/lib/secureFetch';
const style = 'w-full rounded-lg border bg-white px-3 py-2 text-sm';
function when(at: string) { return new Intl.DateTimeFormat('es', { timeZone: 'America/Panama', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(at)); }
export default function PlanningPanel({ tasks, actorId, canEdit, days }: { tasks: Task[]; actorId: string; canEdit: boolean; days: string[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [snapshot, setSnapshot] = useState<CalendarSnapshot | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [clientConfigured, setClientConfigured] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [taskId, setTaskId] = useState(''); const [at, setAt] = useState('');
  const [error, setError] = useState(''); const [loaded, setLoaded] = useState(false); const [busy, setBusy] = useState(false);
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const requestBusy = useRef(false);
  async function action(body: Record<string, unknown>) {
    if (requestBusy.current) return;
    requestBusy.current = true; setBusy(true); setError('');
    try {
      const response = await secureFetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setReminders(result.reminders); if (body.action === 'schedule') { pending.current = null; setTaskId(''); setAt(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar. Reintenta.'); }
    finally { setBusy(false); requestBusy.current = false; }
  }
  useEffect(() => {
    let active = true; let checking = false;
    async function refresh() {
      if (checking) return; checking = true;
      try {
        const [r, c] = await Promise.all([canEdit ? secureFetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check' }) }) : fetch('/api/reminders', { cache: 'no-store' }), fetch('/api/integrations/calendar', { cache: 'no-store' })]);
        if (!r.ok || !c.ok) throw new Error('No se pudo comprobar agenda/avisos. Revisa la sesión y reintenta.');
        const [rs, cs] = await Promise.all([r.json(), c.json()]);
        let calendar = cs.snapshot; let calendarError = cs.connectionError || '';
        if (canEdit && cs.appAuthorized) {
          const sync = await secureFetch('/api/integrations/calendar', { method: 'POST' });
          const result = await sync.json();
          if (sync.ok) { calendar = result.snapshot; calendarError = ''; } else calendarError = result.error;
        }
        if (active) { setReminders(rs.reminders); setSnapshot(calendar); setAuthorized(!!cs.appAuthorized); setClientConfigured(!!cs.clientConfigured); setConnectionError(calendarError); setLoaded(true); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'No disponible.'); }
      finally { checking = false; }
    }
    refresh(); const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [canEdit]);
  const owned = tasks.filter(t => t.ownerId === actorId && activeWork(t));
  const state = { Scheduled: 'Programado · dentro de la app', Inbox: 'Aviso disponible', Acknowledged: 'Visto', Cancelled: 'Cancelado', ExternalLinked: 'Vinculado a ChatGPT' };
  return <section aria-label="Agenda y recordatorios integrados" className="my-5 space-y-4">
    <div className="rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">Calendario y conexión</h2><p className="mt-2 text-sm">Google Calendar principal: {snapshot ? 'lectura real incorporada' : 'sin lectura incorporada'}. TaskManager: {authorized ? 'acceso propio de solo lectura guardado en Windows' : clientConfigured ? 'cliente preparado; falta confirmar el permiso en Google' : 'falta configurar el cliente OAuth propio'}.</p>
      <p className="mt-1 text-xs">{snapshot ? `Última lectura: ${when(snapshot.verifiedAt)}. Ventana: ${snapshot.windowStart.slice(0, 10)} a ${snapshot.windowEnd.slice(0, 10)}. ${snapshot.connection === 'oauth-readonly' ? 'Fuente: autorización propia de TaskManager.' : 'Fuente: lectura previa mediante Codex.'} Fuera de esta ventana no se conoce la agenda externa.` : 'La conexión de Codex no concede acceso propio a esta app.'}</p>
      <p className="mt-1 text-xs">{authorized ? 'Actualización cada cinco minutos mientras esta vista esté abierta y la computadora tenga conexión; no modifica eventos ni activa procesos en segundo plano.' : 'La sincronización real está pendiente del cliente y consentimiento de Google. La aprobación de HB ya está registrada; no equivale al permiso técnico de Google.'}</p>
      {connectionError && <p role="status" className="mt-2 text-sm text-amber-800">{connectionError} La última lectura conservada puede estar desactualizada.</p>}
      <div className="mt-3 flex flex-wrap gap-3"><a className="text-sm underline" href="/api/integrations/calendar?format=ics">Descargar plan de tareas (.ics)</a><button disabled={busy || !canEdit} className="text-sm underline" onClick={async () => { setError(''); setBusy(true); try { const r = await secureFetch('/api/integrations/calendar', { method: 'POST' }); const body = await r.json(); if (!r.ok) setError(body.error); else { setSnapshot(body.snapshot); setAuthorized(true); setConnectionError(''); } } catch { setError('No se pudo verificar la conexión. Reintenta.'); } finally { setBusy(false); } }}>Comprobar actualización de calendario</button></div>
      <p className="mt-2 text-xs">El archivo .ics es una exportación manual sin alarmas; no es sincronización ni crea eventos automáticamente.</p>
      {snapshot?.events.filter(e => days.includes(eventDay(e)) && !['cancelled', 'removed'].includes(e.status)).map(e => <article key={e.id} className="mt-3 rounded-lg border p-3"><h3 className="font-semibold">{e.title}</h3><p className="text-sm">{e.allDay ? `${eventDay(e)} · Todo el día` : `${when(e.start)} – ${new Intl.DateTimeFormat('es', { timeZone: 'America/Panama', timeStyle: 'short' }).format(new Date(e.end))}`} · {e.status === 'tentative' ? 'Tentativo' : 'Confirmado en la última lectura'}</p><a href={e.url} target="_blank" rel="noopener noreferrer" className="text-sm underline">Abrir evento original</a></article>)}
    </div>
    <div className="rounded-xl border bg-white p-4"><h2 className="text-lg font-bold">Recordatorios</h2><p className="mt-2 text-sm">Los avisos locales se comprueban mientras esta vista está abierta. Si la app estuvo cerrada, aparecen al volver a abrirla. No hay envío por correo, WhatsApp ni servicio en segundo plano.</p>
      {!loaded && <p className="mt-2 text-sm">Comprobando estado…</p>}
      {reminders.map(r => <article key={r.id} className="mt-3 rounded-lg border p-3" aria-label={`Recordatorio ${r.id}`}><p className="font-semibold">{state[r.state]}</p><p className="text-sm">{when(r.at)} · America/Panama {r.flexible && '· Mañana flexible; 08:00 es nominal'}</p><ul className="list-inside list-disc text-sm">{r.taskIds.map(id => <li key={id}>{tasks.find(t => t.id === id)?.title || 'Tarea no disponible'}</li>)}</ul>
        {r.channel === 'chatgpt' && <><p className="mt-2 text-xs">Un único aviso externo para estas tareas. Estado verificado: {r.externalEnabled ? 'habilitado' : 'no habilitado'}{r.verifiedAt && ` el ${when(r.verifiedAt)}`}. No se crean avisos locales duplicados. {r.deliveredAt ? `Entrega confirmada: ${when(r.deliveredAt)} (precisión de minuto). El aviso no completa los trámites.` : 'Entrega posterior no verificada aquí.'} Se gestiona en ChatGPT.</p>{r.taskIds.some(id => { const t = tasks.find(t => t.id === id); return t && (!activeWork(t) || t.workDate !== r.at.slice(0, 10)); }) && <p className="mt-1 text-sm text-amber-800">La tarea cambió. Revisa el aviso externo en ChatGPT; su horario no se modifica desde aquí.</p>}</>}
        {canEdit && r.channel === 'in-app' && ['Scheduled', 'Inbox'].includes(r.state) && <div className="mt-2 flex gap-3">{r.state === 'Inbox' && <button disabled={busy} className="text-sm underline" onClick={() => action({ action: 'acknowledge', id: r.id, reason: 'Visto por el responsable en TaskManager.' })}>Reconocer aviso</button>}<button disabled={busy} className="text-sm underline" onClick={() => action({ action: 'cancel', id: r.id, reason: 'Cancelado por el responsable en TaskManager.' })}>Cancelar aviso local</button></div>}
        <details className="mt-2 text-xs"><summary>Historial del aviso</summary>{r.history.map((h, i) => <p key={i}>{when(h.at)} · {h.action} · {h.reason}</p>)}</details></article>)}
      {loaded && !reminders.length && <p className="mt-3 text-sm">No hay recordatorios registrados.</p>}
      {canEdit && <form aria-label="Programar recordatorio local" className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const fingerprint = JSON.stringify({ taskId, at }); if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() }; action({ action: 'schedule', id: pending.current.id, taskId, at: at + ':00-05:00' }); }}>
        <label className="text-sm">Tarea para recordatorio<select aria-label="Tarea para recordatorio" required className={style} value={taskId} onChange={e => setTaskId(e.target.value)}><option value="">Elegir tarea</option>{owned.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label className="text-sm">Fecha y hora del aviso en Panamá<input required type="datetime-local" className={style} value={at} onChange={e => setAt(e.target.value)} /></label><button disabled={busy} className="rounded-lg bg-primary-900 px-4 py-2 text-white">Programar aviso en la app</button>
      </form>}
    </div>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error} <button className="underline" onClick={() => window.location.reload()}>Recargar y reintentar</button></p>}
  </section>;
}
