'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useUiLang } from '@/lib/uiLang';

type Occ = { id: string; layer: string; title: string; date: string; time?: string; location?: string; detail?: string; links?: { id: string; title: string; role?: string }[] };
const add = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Reuniones y viajes junto a las tareas: hoy y los dos días siguientes; al buscar, los próximos 45 días.
 * Una reunión es parte del día igual que una tarea, y se encuentra por el nombre de la persona.
 */
export default function MeetingsStrip({ filter = '' }: { filter?: string }) {
  const { L, locale } = useUiLang();
  const [occ, setOcc] = useState<Occ[]>([]);
  const [today, setToday] = useState('');
  useEffect(() => {
    let alive = true;
    fetch('/api/agent/agenda', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d?.ok) { setToday(d.today); setOcc((d.occurrences as Occ[]).filter(o => o.layer === 'reuniones' || o.layer === 'viajes')); } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const q = norm(filter.trim());
  const list = useMemo(() => {
    if (!today) return [];
    if (q) return occ.filter(o => norm([o.title, o.detail, o.location, ...(o.links || []).map(l => `${l.title} ${l.role || ''}`)].join(' ')).includes(q)).slice(0, 12);
    return occ.filter(o => o.date <= add(today, 2)).slice(0, 8);
  }, [occ, today, q]);
  if (!list.length) return null;
  const dayName = (d: string) => (d === today ? L('Hoy', 'Today') : d === add(today, 1) ? L('Mañana', 'Tomorrow') : new Date(d + 'T12:00:00Z').toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }));
  return (
    <div className="mb-6 rounded-2xl border border-[#dbe4f3] bg-white p-4 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]" style={{ fontFamily: 'Poppins, system-ui, sans-serif' }}>
      <p className="text-sm font-semibold text-[#0b1f4d]">{q ? L('Reuniones que coinciden', 'Matching meetings') : L('Reuniones y viajes de estos días', 'Meetings and trips these days')} <span className="ml-1 rounded-full bg-[#eef3fb] px-2 py-0.5 text-xs text-[#0a3fbf]">{list.length}</span></p>
      <ul className="mt-2 divide-y divide-[#eef3fb]">
        {list.map(o => (
          <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
            <span className="w-24 shrink-0 text-xs font-semibold text-[#0a3fbf]">{dayName(o.date)}{o.time ? ` · ${o.time}` : ''}</span>
            <a href={`/mi-agenda?day=${o.date}`} className="min-w-0 flex-1 font-medium text-[#0b1f4d] hover:underline">{o.title}</a>
            {(o.links || []).slice(0, 3).map(l => <a key={l.id} href={`/cerebro?node=${encodeURIComponent(l.id)}`} className="rounded-full bg-[#eef3fb] px-2 py-0.5 text-xs font-semibold text-[#0a3fbf]">{l.title}</a>)}
          </li>))}
      </ul>
    </div>
  );
}
