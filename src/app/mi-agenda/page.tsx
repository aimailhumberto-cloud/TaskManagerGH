'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Task = { id: string; title: string; dueDate?: string; priority: string; isCompleted: boolean; isOverdue: boolean; isToday: boolean; sourceNodeTitle?: string };
const NAVY = '#00308f', CYAN = '#00a8f0';
const label = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); };

export default function MiAgendaPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/agent/tasks', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (r.ok && d.ok) setTasks(d.tasks); else setMsg(d.error || 'No se pudo cargar la agenda.');
  }, []);
  useEffect(() => { load(); }, [load]);
  const move = async (id: string, date: string) => {
    const r = await fetch('/api/agent/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reschedule', taskId: id, newDueDate: date }) });
    const d = await r.json().catch(() => ({})); setMsg(r.ok && d.ok !== false ? 'Reprogramada.' : d.message || d.error || 'No se pudo reprogramar.'); await load();
  };
  const open = (tasks || []).filter(t => !t.isCompleted && t.dueDate);
  const overdue = open.filter(t => t.isOverdue).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const days = new Map<string, Task[]>();
  for (const t of open.filter(x => !x.isOverdue).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))) { const k = (t.dueDate || '').slice(0, 10); days.set(k, [...(days.get(k) || []), t]); }
  const row = (t: Task) => (
    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{t.title}</p>{t.sourceNodeTitle && <p className="truncate text-xs text-slate-500">{t.sourceNodeTitle}</p>}</div>
      <input type="date" aria-label="Reprogramar" className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs" onChange={e => e.target.value && move(t.id, e.target.value)} />
    </li>);
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div><h1 className="text-2xl font-bold" style={{ color: NAVY }}>Agenda</h1><p className="text-sm text-slate-600">Todo lo que tiene fecha en tu cerebro: tareas y seguimientos. Para agregar algo, créalo en <Link className="underline" href="/tasks">Tareas</Link> con fecha.</p></div>
      {msg && <p className="rounded-xl bg-sky-50 px-4 py-2 text-sm text-slate-700">{msg}</p>}
      {tasks === null && !msg && <p className="text-sm text-slate-500">Cargando…</p>}
      {tasks !== null && open.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No tienes nada con fecha.</p>}
      {overdue.length > 0 && (
        <section className="rounded-2xl border border-red-200 bg-white p-5"><h2 className="text-sm font-bold text-red-700">Vencidas ({overdue.length})</h2><ul className="divide-y divide-slate-100">{overdue.map(row)}</ul></section>)}
      {[...days.entries()].map(([day, list]) => (
        <section key={day} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold capitalize" style={{ color: list[0].isToday ? CYAN : NAVY }}>{list[0].isToday ? 'Hoy · ' : ''}{label(day)}</h2>
          <ul className="divide-y divide-slate-100">{list.map(row)}</ul>
        </section>))}
    </div>
  );
}
