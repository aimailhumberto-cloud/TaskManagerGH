'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUiLang } from '@/lib/uiLang';

type Occ = { id: string; eventId: string; layer: 'reuniones' | 'viajes' | 'tareas' | 'seguimientos'; kind: string; title: string; date: string; endDate?: string; time?: string; endTime?: string; location?: string; recurring: boolean; source: string; overdue?: boolean; taskId?: string; detail?: string };
type View = 'mes' | 'semana' | 'lista';
const BLUE = '#0a3fbf', NAVY = '#0b1f4d', CYAN = '#00a8f0', SOFT = '#f2f6fd', LINE = '#dbe4f3';
const SHADOW = '0 1px 2px rgba(11,31,77,0.04), 0 12px 28px -18px rgba(11,31,77,0.22)';
const LAYERS = { reuniones: { color: '#7c3aed', soft: '#f1eaff' }, tareas: { color: BLUE, soft: '#e8f1ff' }, seguimientos: { color: '#0f766e', soft: '#e3f6f1' }, viajes: { color: '#b45309', soft: '#fff3d6' } } as const;
const TILES = ['busta', 'chubby', 'fruta', 'oasis', 'altitude', 'busta', 'fruta'];
const add = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dow = (day: string) => (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7; // lunes = 0
const touches = (o: Occ, day: string) => o.date <= day && (o.endDate || o.date) >= day;

export default function MiAgendaPage() {
  const { L, locale, lang } = useUiLang();
  const [today, setToday] = useState('');
  const [cursor, setCursor] = useState('');
  const [selected, setSelected] = useState('');
  const [view, setView] = useState<View>('mes');
  const [layers, setLayers] = useState<Record<keyof typeof LAYERS, boolean>>({ reuniones: true, tareas: true, seguimientos: true, viajes: true });
  const [occ, setOcc] = useState<Occ[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ open: false, kind: 'reunion', title: '', time: '', endTime: '', endDate: '', location: '', repeat: 'none', weekdays: [] as number[], until: '' });

  const fmt = useCallback((day: string, opt: Intl.DateTimeFormatOptions) => { if (!day) return ''; const [y, m, d] = day.split('-').map(Number); const s = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { ...opt, timeZone: 'UTC' }); return s.charAt(0).toUpperCase() + s.slice(1); }, [locale]);
  const range = useMemo(() => {
    if (!cursor) return null;
    if (view === 'semana') { const start = add(cursor, -dow(cursor)); return { from: start, to: add(start, 6) }; }
    if (view === 'lista') return { from: today || cursor, to: add(today || cursor, 45) };
    const first = cursor.slice(0, 8) + '01'; const start = add(first, -dow(first)); return { from: start, to: add(start, 41) };
  }, [cursor, view, today]);
  const load = useCallback(async () => {
    const qs = range ? `?from=${range.from}&to=${range.to}` : '';
    try { const r = await fetch(`/api/agent/agenda${qs}`, { cache: 'no-store' }); const j = await r.json();
      if (!r.ok || !j.ok) return setMsg(j.error || L('No se pudo cargar la agenda.', 'Could not load the agenda.'));
      setOcc(j.occurrences); setReadOnly(!!j.readOnly);
      if (!today) { setToday(j.today); setCursor(j.today); setSelected(j.today); if (window.innerWidth < 768) setView('lista'); }
    } catch { setMsg(L('No se pudo cargar la agenda.', 'Could not load the agenda.')); }
  }, [range, today, L]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => occ.filter(o => layers[o.layer]), [occ, layers]);
  const ofDay = useCallback((day: string) => visible.filter(o => touches(o, day)), [visible]);
  const post = async (url: string, body: unknown, ok: string) => {
    setBusy(true); setMsg(null);
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); const good = r.ok && j.ok !== false; setMsg(good ? ok : j.error || j.message || L('No se pudo completar.', 'Could not complete.')); if (good) await load(); return good; }
    finally { setBusy(false); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.title.trim().length < 2) return setMsg(L('Escribe un título.', 'Enter a title.'));
    if (form.kind === 'tarea') { if (await post('/api/agent/tasks', { action: 'create', title: form.title, dueDate: selected }, L('Tarea creada.', 'Task created.'))) setForm(f => ({ ...f, open: false, title: '' })); return; }
    const body: Record<string, unknown> = { action: 'set', kind: form.kind, title: form.title, date: selected, repeat: form.kind === 'viaje' ? 'none' : form.repeat };
    if (form.time) body.time = form.time; if (form.endTime) body.endTime = form.endTime; if (form.kind === 'viaje' && form.endDate) body.endDate = form.endDate;
    if (form.location) body.location = form.location; if (form.repeat === 'weekly' && form.weekdays.length) body.weekdays = form.weekdays; if (form.until) body.until = form.until;
    if (await post('/api/agent/agenda', body, L('Guardado en tu agenda.', 'Saved to your agenda.'))) setForm({ open: false, kind: 'reunion', title: '', time: '', endTime: '', endDate: '', location: '', repeat: 'none', weekdays: [], until: '' });
  };
  const move = (n: number) => { if (!cursor) return; if (view === 'semana') { setCursor(add(cursor, 7 * n)); return; } const [y, m] = cursor.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setCursor(d.toISOString().slice(0, 10)); };
  const layerName = (k: keyof typeof LAYERS) => ({ reuniones: L('Reuniones', 'Meetings'), tareas: L('Tareas', 'Tasks'), seguimientos: L('Seguimientos', 'Follow-ups'), viajes: L('Viajes', 'Trips') })[k];
  const loadTone = (n: number) => (n >= 6 ? { background: '#ffe9c2', label: L('Día muy cargado', 'Very busy day') } : n >= 4 ? { background: '#dbeafe', label: L('Día cargado', 'Busy day') } : n >= 1 ? { background: '#f4f8ff', label: L('Día liviano', 'Light day') } : { background: '#ffffff', label: L('Día libre', 'Free day') });
  const weekdayNames = useMemo(() => Array.from({ length: 7 }, (_, i) => fmt(add('2026-11-09', i), { weekday: 'short' })), [fmt]);
  const input = 'rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400';
  const pill = (on: boolean) => ({ background: on ? BLUE : SOFT, color: on ? '#fff' : BLUE });

  const Chip = ({ o }: { o: Occ }) => (<span className="block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ background: LAYERS[o.layer].soft, color: LAYERS[o.layer].color }} title={o.title}>{o.time ? `${o.time} ` : ''}{o.title}</span>);
  const Row = ({ o, day }: { o: Occ; day: string }) => (
    <li className="flex items-start gap-3 rounded-2xl px-3 py-2.5" style={{ border: '1px solid #eef2f9', background: '#fff' }}>
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LAYERS[o.layer].color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800">{o.title}</p>
        <p className="text-xs text-slate-500">{[o.time ? `${o.time}${o.endTime ? `–${o.endTime}` : ''}` : null, layerName(o.layer), o.recurring ? L('se repite', 'recurring') : null, o.endDate ? `${fmt(o.date, { day: 'numeric', month: 'short' })} – ${fmt(o.endDate, { day: 'numeric', month: 'short' })}` : null, o.location, o.detail, o.source === 'outlook' ? 'Outlook' : null].filter(Boolean).join(' · ')}</p>
        {o.overdue && <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#fde8ea', color: '#b01e2b' }}>{L('Vencida', 'Overdue')}</span>}
      </div>
      {!readOnly && (o.taskId
        ? <button disabled={busy} onClick={() => post('/api/agent/tasks', { action: 'complete', taskId: o.taskId }, L('Tarea completada.', 'Task completed.'))} className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: SOFT, color: BLUE }}>{L('Completar', 'Complete')}</button>
        : <button disabled={busy} onClick={() => post('/api/agent/agenda', { action: 'delete', id: o.eventId, ...(o.recurring ? { date: o.date } : {}) }, o.recurring ? L('Se canceló solo ese día.', 'Cancelled for that day only.') : L('Evento borrado.', 'Event deleted.'))} className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: SOFT, color: BLUE }}>{o.recurring ? L('Cancelar este día', 'Cancel this day') : L('Borrar', 'Delete')}</button>)}
      <span className="sr-only">{day}</span>
    </li>);

  const dayList = selected ? ofDay(selected) : [];
  const grid = range && view !== 'lista' ? Array.from({ length: view === 'semana' ? 7 : 42 }, (_, i) => add(range.from, i)) : [];
  const listDays = view === 'lista' && range ? Array.from({ length: 46 }, (_, i) => add(range.from, i)).filter(d => ofDay(d).length) : [];
  const title = !cursor ? '' : view === 'semana' && range ? `${fmt(range.from, { day: 'numeric', month: 'short' })} – ${fmt(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}` : view === 'lista' ? L('Próximos 45 días', 'Next 45 days') : fmt(cursor, { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-full p-4 sm:p-7" style={{ background: SOFT, fontFamily: 'Poppins, system-ui, sans-serif', color: NAVY }} lang={lang}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
      <div className="mx-auto flex max-w-[1304px] flex-col gap-5">
        <header className="grid overflow-hidden rounded-[28px] lg:grid-cols-[1.2fr_1fr]" style={{ background: BLUE }}>
          <div className="flex flex-col justify-between gap-4 p-6 sm:p-8">
            <div><p className="text-[13px] font-semibold tracking-[0.08em]" style={{ color: '#9fdcff' }}>{L('SEGUNDO CEREBRO · S.M. JALEEL', 'SECOND BRAIN · S.M. JALEEL')}</p>
              <h1 className="mt-1.5 text-3xl font-bold text-white sm:text-[36px]">{L('Agenda', 'Agenda')}</h1>
              <p className="mt-1 text-[15px]" style={{ color: '#dbeafe' }}>{L('Tus reuniones, viajes, tareas y seguimientos en un solo calendario.', 'Your meetings, trips, tasks and follow-ups in one calendar.')}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => move(-1)} aria-label={L('Anterior', 'Previous')} className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: 'rgba(255,255,255,0.16)' }}>‹</button>
              <span className="min-w-[150px] text-center text-base font-semibold text-white">{title}</span>
              <button onClick={() => move(1)} aria-label={L('Siguiente', 'Next')} className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: 'rgba(255,255,255,0.16)' }}>›</button>
              <button onClick={() => { setCursor(today); setSelected(today); }} className="rounded-full bg-white px-4 py-2 text-sm font-semibold" style={{ color: BLUE }}>{L('Hoy', 'Today')}</button>
              <span className="ml-auto flex gap-1 rounded-full p-1" style={{ background: 'rgba(255,255,255,0.16)' }}>{(['mes', 'semana', 'lista'] as View[]).map(v => (<button key={v} onClick={() => setView(v)} aria-pressed={view === v} className="rounded-full px-3.5 py-1.5 text-sm font-semibold" style={view === v ? { background: '#fff', color: BLUE } : { color: '#fff' }}>{{ mes: L('Mes', 'Month'), semana: L('Semana', 'Week'), lista: L('Lista', 'List') }[v]}</button>))}</span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/smj-bebidas-hero.jpg" alt={L('Bebidas de S.M. Jaleel', 'S.M. Jaleel beverages')} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 72%' }} />
            <div aria-hidden className="absolute inset-y-0 left-0 w-28" style={{ background: `linear-gradient(90deg, ${BLUE}, rgba(10,63,191,0))` }} />
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-white px-4 py-3" style={{ border: `1px solid ${LINE}`, boxShadow: SHADOW }}>
          <span className="mr-1 text-xs font-semibold text-slate-500">{L('Mostrar', 'Show')}</span>
          {(Object.keys(LAYERS) as (keyof typeof LAYERS)[]).map(k => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium" style={{ background: layers[k] ? LAYERS[k].soft : '#f1f5f9', color: layers[k] ? LAYERS[k].color : '#94a3b8' }}>
              <input type="checkbox" checked={layers[k]} onChange={e => setLayers({ ...layers, [k]: e.target.checked })} className="h-3.5 w-3.5" style={{ accentColor: LAYERS[k].color }} />{layerName(k)}
              <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold">{occ.filter(o => o.layer === k).length}</span>
            </label>))}
          <span className="ml-auto hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">{L('Carga del día', 'Day load')}{['#f4f8ff', '#dbeafe', '#ffe9c2'].map(c => <span key={c} className="h-3 w-5 rounded" style={{ background: c, border: `1px solid ${LINE}` }} />)}</span>
        </div>
        {msg && <p className="rounded-xl bg-white px-4 py-2 text-sm text-slate-700" style={{ border: `1px solid ${LINE}` }}>{msg}</p>}

        <div className="grid gap-5 lg:grid-cols-[2.1fr_1fr]">
          <section className="rounded-[22px] bg-white p-3 sm:p-4" style={{ border: `1px solid ${LINE}`, boxShadow: SHADOW }}>
            {view !== 'lista' && (<>
              <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{weekdayNames.map((n, i) => <span key={i}>{n}</span>)}</div>
              <div className="grid grid-cols-7 gap-1.5">{grid.map(day => { const list = ofDay(day); const tone = loadTone(list.length); const out = view === 'mes' && day.slice(0, 7) !== cursor.slice(0, 7); const isToday = day === today, isSel = day === selected; const max = view === 'semana' ? 8 : 3; return (
                <button key={day} onClick={() => setSelected(day)} aria-pressed={isSel} aria-label={`${fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length}`} className="flex flex-col gap-1 rounded-2xl p-1.5 text-left transition-transform hover:-translate-y-0.5" style={{ minHeight: view === 'semana' ? 260 : 96, background: tone.background, border: isSel ? `2px solid ${BLUE}` : `1px solid ${LINE}`, opacity: out ? 0.45 : 1 }}>
                  <span className="flex items-center justify-between"><span className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold" style={isToday ? { background: BLUE, color: '#fff' } : { color: NAVY }}>{Number(day.slice(8))}</span>{list.length > 0 && <span className="text-[10px] font-semibold text-slate-400">{list.length}</span>}</span>
                  <span className="hidden flex-col gap-0.5 sm:flex">{list.slice(0, max).map(o => <Chip key={o.id + day} o={o} />)}{list.length > max && <span className="px-1 text-[10px] font-semibold text-slate-500">+{list.length - max}</span>}</span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden">{list.slice(0, 6).map(o => <span key={o.id + day} className="h-1.5 w-1.5 rounded-full" style={{ background: LAYERS[o.layer].color }} />)}</span>
                </button>); })}</div></>)}
            {view === 'lista' && (listDays.length === 0 ? <p className="p-4 text-sm text-slate-500">{L('No hay nada en los próximos 45 días.', 'Nothing in the next 45 days.')}</p> : (
              <div className="space-y-4 p-1">{listDays.map(day => (<div key={day}>
                <button onClick={() => setSelected(day)} className="mb-1.5 flex items-center gap-2 text-sm font-bold" style={{ color: day === today ? CYAN : NAVY }}>{day === today ? `${L('Hoy', 'Today')} · ` : ''}{fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}<span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: SOFT, color: BLUE }}>{ofDay(day).length}</span></button>
                <ul className="space-y-1.5">{ofDay(day).map(o => <Row key={o.id + day} o={o} day={day} />)}</ul></div>))}</div>))}
          </section>

          <aside className="overflow-hidden rounded-[22px] bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: SHADOW }}>
            <div className="relative h-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selected && <img src={`/brands/${TILES[dow(selected)]}-tile.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,31,77,0.15), rgba(11,31,77,0.82))' }} />
              <div className="absolute bottom-2.5 left-4 right-4 text-white"><p className="text-lg font-bold leading-tight">{fmt(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="text-xs opacity-90">{loadTone(dayList.length).label} · {dayList.length} {L('en el día', 'on this day')}</p></div>
            </div>
            <div className="space-y-3 p-4">
              {dayList.length === 0 ? <p className="text-sm text-slate-500">{L('Nada este día.', 'Nothing this day.')}</p> : <ul className="space-y-1.5">{dayList.map(o => <Row key={o.id} o={o} day={selected} />)}</ul>}
              {!readOnly && !form.open && <button onClick={() => setForm({ ...form, open: true })} className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: BLUE }}>{L('Agregar a este día', 'Add to this day')}</button>}
              {form.open && (
                <form onSubmit={submit} className="space-y-2 rounded-2xl p-3" style={{ background: SOFT }}>
                  <div className="flex flex-wrap gap-1.5">{[['reunion', L('Reunión', 'Meeting')], ['viaje', L('Viaje', 'Trip')], ['evento', L('Evento', 'Event')], ['tarea', L('Tarea', 'Task')]].map(([k, n]) => (<button type="button" key={k} onClick={() => setForm({ ...form, kind: k })} aria-pressed={form.kind === k} className="rounded-full px-3 py-1 text-xs font-semibold" style={pill(form.kind === k)}>{n}</button>))}</div>
                  <input className={`${input} w-full`} placeholder={L('Título', 'Title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} aria-label={L('Título', 'Title')} />
                  {form.kind !== 'tarea' && (<>
                    <div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-slate-500">{L('Empieza', 'Starts')}<input type="time" className={`${input} w-full`} value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></label><label className="text-[11px] text-slate-500">{L('Termina', 'Ends')}<input type="time" className={`${input} w-full`} value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></label></div>
                    {form.kind === 'viaje' && <label className="block text-[11px] text-slate-500">{L('Regreso', 'Return')}<input type="date" min={selected} className={`${input} w-full`} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>}
                    <input className={`${input} w-full`} placeholder={L('Lugar (opcional)', 'Place (optional)')} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} aria-label={L('Lugar', 'Place')} />
                    {form.kind !== 'viaje' && (<>
                      <select className={`${input} w-full`} value={form.repeat} onChange={e => setForm({ ...form, repeat: e.target.value })} aria-label={L('Repetición', 'Repeat')}><option value="none">{L('No se repite', 'Does not repeat')}</option><option value="daily">{L('Cada día', 'Every day')}</option><option value="weekly">{L('Cada semana', 'Every week')}</option><option value="monthly">{L('Cada mes', 'Every month')}</option><option value="yearly">{L('Cada año', 'Every year')}</option></select>
                      {form.repeat === 'weekly' && <div className="flex gap-1">{weekdayNames.map((n, i) => { const v = (i + 1) % 7; const on = form.weekdays.includes(v); return (<button type="button" key={i} onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter(x => x !== v) : [...form.weekdays, v] })} aria-pressed={on} className="flex-1 rounded-lg py-1 text-[11px] font-semibold" style={pill(on)}>{n.slice(0, 2)}</button>); })}</div>}
                      {form.repeat !== 'none' && <label className="block text-[11px] text-slate-500">{L('Hasta (opcional)', 'Until (optional)')}<input type="date" min={selected} className={`${input} w-full`} value={form.until} onChange={e => setForm({ ...form, until: e.target.value })} /></label>}
                    </>)}
                  </>)}
                  <div className="flex gap-2"><button disabled={busy} className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{L('Guardar', 'Save')}</button><button type="button" onClick={() => setForm({ ...form, open: false })} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: '#fff', color: BLUE }}>{L('Cerrar', 'Close')}</button></div>
                </form>)}
              <p className="text-[11px] leading-snug text-slate-400">{L('Las reuniones y viajes los cargas tú o tu agente. Cuando se conecte Outlook, entrarán solos.', 'Meetings and trips are added by you or your agent. Once Outlook is connected, they will come in automatically.')}</p>
            </div>
          </aside>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/Brands-you-Love_2-copy-scaled.jpg" alt={L('Marcas de S.M. Jaleel', 'S.M. Jaleel brands')} className="w-full rounded-[20px]" />
      </div>
    </div>
  );
}
