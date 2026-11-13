'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useUiLang } from '@/lib/uiLang';

type Task = { id: string; title: string; description?: string; dueDate?: string; priority: string; isCompleted: boolean; isOverdue: boolean; isToday: boolean; sourceNodeTitle?: string };
type People = { me: { id: string; name: string; role: string }; canAssign: boolean; people: { id: string; name: string }[] };

export default function MisTareasPage() {
  const { L } = useUiLang();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [who, setWho] = useState<People | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [f, setF] = useState({ title: '', dueDate: '', priority: 'Medium', description: '', to: '', mentions: [] as string[] });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch('/api/agent/tasks', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) setTasks(d.tasks); else setMsg({ ok: false, text: d.error || L('No se pudieron cargar las tareas.', 'Could not load the tasks.') });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); fetch('/api/people', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(setWho).catch(() => {}); }, [load]);
  const post = async (url: string, body: unknown) => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      const ok = r.ok && d.ok !== false;
      setMsg({ ok, text: d.message || d.error || (ok ? L('Listo.', 'Done.') : L('No se pudo completar.', 'Could not complete.')) });
      if (ok) await load();
      return ok;
    } finally { setBusy(false); }
  };
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setMsg({ ok: false, text: L('Escribe el título de la tarea.', 'Write the task title.') });
    const ok = f.to
      ? await post('/api/admin/assign-task', { toAccountId: f.to, title: f.title, dueDate: f.dueDate || undefined, priority: f.priority, description: f.description, mentions: f.mentions })
      : await post('/api/agent/tasks', { action: 'create', title: f.title, dueDate: f.dueDate || undefined, priority: f.priority, description: f.description });
    if (ok) setF({ title: '', dueDate: '', priority: 'Medium', description: '', to: '', mentions: [] });
  }
  const open = (tasks || []).filter(t => !t.isCompleted);
  const groups: [string, Task[]][] = [
    [L('Vencidas', 'Overdue'), open.filter(t => t.isOverdue)],
    [L('Hoy', 'Today'), open.filter(t => t.isToday && !t.isOverdue)],
    [L('Próximas', 'Upcoming'), open.filter(t => !t.isOverdue && !t.isToday && t.dueDate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))],
    [L('Sin fecha', 'No date'), open.filter(t => !t.dueDate)],
  ];
  const input = 'rounded-lg border border-primary-300 px-3 py-2 text-sm';
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-5">
      <div><h1 className="text-xl font-bold">{L('Mis tareas', 'My tasks')}</h1>
        <p className="text-sm text-primary-600">{L('Las tareas de tu cerebro', 'The tasks in your brain')}{who ? `, ${who.me.name}` : ''}. {L('Solo tú las ves.', 'Only you can see them.')}</p></div>
      {msg && <p className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
      <form onSubmit={create} className="rounded-xl border border-primary-200 p-4 grid gap-2 sm:grid-cols-4">
        <input className={`${input} sm:col-span-4`} placeholder={L('Nueva tarea', 'New task')} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
        <input className={input} type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} aria-label={L('Fecha', 'Date')} />
        <select className={input} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })} aria-label={L('Prioridad', 'Priority')}><option value="High">{L('Alta', 'High')}</option><option value="Medium">{L('Media', 'Medium')}</option><option value="Low">{L('Baja', 'Low')}</option></select>
        {who?.canAssign ? (
          <select className={input} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} aria-label={L('Para', 'For')}><option value="">{L('Para mí', 'For me')}</option>{who.people.map(p => <option key={p.id} value={p.id}>{L('Para', 'For')} {p.name}</option>)}</select>
        ) : <span />}
        <button disabled={busy} className="rounded-lg bg-primary-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{f.to ? L('Asignar', 'Assign') : L('Agregar', 'Add')}</button>
        <textarea className={`${input} sm:col-span-4`} rows={2} placeholder={L('Detalle (opcional)', 'Details (optional)')} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
        {who?.canAssign && f.to && who.people.length > 1 && (
          <div className="sm:col-span-4 text-xs text-primary-600 flex flex-wrap gap-3 items-center">
            <span>{L('Mencionar el cerebro de:', 'Mention the brain of:')}</span>
            {who.people.filter(p => p.id !== f.to).map(p => (
              <label key={p.id} className="flex items-center gap-1"><input type="checkbox" checked={f.mentions.includes(p.id)} onChange={e => setF({ ...f, mentions: e.target.checked ? [...f.mentions, p.id] : f.mentions.filter(x => x !== p.id) })} />{p.name}</label>
            ))}
          </div>
        )}
        {who?.canAssign && f.to && <p className="sm:col-span-4 text-xs text-primary-500">{L('La tarea se crea en el cerebro de esa persona. Tú no ves su cerebro; solo le dejas la tarea.', 'The task is created in that person\'s brain. You cannot see their brain; you only leave them the task.')}</p>}
      </form>
      {tasks === null && !msg && <p className="text-sm">{L('Cargando…', 'Loading…')}</p>}
      {tasks !== null && open.length === 0 && <p className="text-sm text-primary-500">{L('No tienes tareas pendientes.', 'You have no pending tasks.')}</p>}
      {groups.filter(([, list]) => list.length).map(([name, list]) => (
        <section key={name}>
          <h2 className="text-xs font-bold uppercase tracking-wide text-primary-500 mb-1">{name} ({list.length})</h2>
          <ul className="rounded-xl border border-primary-200 divide-y divide-primary-100">
            {list.map(t => (
              <li key={t.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.title}</p>
                  {t.description && <p className="text-xs text-primary-600 whitespace-pre-line line-clamp-3">{t.description}</p>}
                  <p className="text-xs text-primary-500">{t.dueDate || L('Sin fecha', 'No date')} · {t.priority === 'High' ? L('Alta', 'High') : t.priority === 'Low' ? L('Baja', 'Low') : L('Media', 'Medium')}</p>
                </div>
                <div className="shrink-0 flex flex-col gap-1 items-end">
                  <button disabled={busy} className="text-xs underline" onClick={() => post('/api/agent/tasks', { action: 'complete', taskId: t.id, completedBy: who?.me.name })}>{L('Completar', 'Complete')}</button>
                  <input type="date" className="text-xs border border-primary-200 rounded px-1" aria-label={L('Reprogramar', 'Reschedule')} onChange={e => e.target.value && post('/api/agent/tasks', { action: 'reschedule', taskId: t.id, newDueDate: e.target.value })} />
                </div>
              </li>))}
          </ul>
        </section>))}
      {tasks !== null && <p className="text-xs text-primary-500">{(tasks || []).filter(t => t.isCompleted).length} {L('completadas.', 'completed.')}</p>}
    </div>
  );
}
