'use client';
import React, { useState } from 'react';
import { kpiProgress, type KpiStatus } from '@/lib/kpiProgress';

export type KpiData = { id: string; name: string; unit: string; value: number; target: number | null; period: string; updatedAt: string; updatedBy?: string; history: { at: string; value: number; by?: string; note?: string }[]; startDate?: string; endDate?: string; baseline?: number; direction?: 'up' | 'down' };
const BLUE = '#0a3fbf', NAVY = '#0b1f4d', SOFT = '#f2f6fd';
const TONE: Record<KpiStatus, { bg: string; fg: string }> = {
  done: { bg: '#e3f6f1', fg: '#0f766e' }, ahead: { bg: '#e3f6f1', fg: '#0f766e' }, on: { bg: '#e8f1ff', fg: BLUE },
  behind: { bg: '#fef3c7', fg: '#92400e' }, late: { bg: '#fde8ea', fg: '#b4232f' }, none: { bg: '#f1f5f9', fg: '#475569' },
};
const BAR: Record<KpiStatus, string> = { done: '#2a9d8f', ahead: '#2a9d8f', on: BLUE, behind: '#d97706', late: '#d62839', none: BLUE };

/** Barras: un valor por actualización, con la meta como línea. */
function HistoryBars({ points, target, big, T, fmt, color }: { points: { at: string; value: number }[]; target: number | null; big: boolean; T: (s: string) => string; fmt: (n: number) => string; color: string }) {
  const pts = points.slice(-(big ? 24 : 12));
  if (pts.length === 0) return null;
  const W = 300, H = big ? 120 : 44, base = H - 2, top = big ? 14 : 4;
  const max = Math.max(...pts.map(p => p.value), target ?? 0, 1), min = Math.min(0, ...pts.map(p => p.value));
  const y = (v: number) => base - ((v - min) / (max - min || 1)) * (base - top);
  const gap = 4, bw = Math.max(4, (W - gap * (pts.length - 1)) / pts.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T('Valores registrados')} className="block h-auto w-full">
      {pts.map((p, i) => <rect key={i} x={i * (bw + gap)} y={Math.min(y(p.value), base)} width={bw} height={Math.max(2, Math.abs(base - y(p.value)))} rx="2" fill={color} fillOpacity={i === pts.length - 1 ? 1 : 0.45} />)}
      {target !== null && <g><line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke={NAVY} strokeDasharray="4 4" strokeWidth="1.2" />{big && <text x={W} y={Math.max(10, y(target) - 3)} fontSize="10" fill={NAVY} textAnchor="end">{T('Meta')} {fmt(target)}</text>}</g>}
    </svg>
  );
}

export default function KpiCard({ k, today, readOnly, T, fmt, locale, onEdit, onDelete }: { k: KpiData; today: string; readOnly: boolean; T: (s: string) => string; fmt: (n: number) => string; locale: string; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const pr = kpiProgress(k, today);
  const day = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const label: Record<KpiStatus, string> = { done: T('Meta cumplida'), ahead: T('Adelantado'), on: T('Al ritmo'), behind: T('Atrasado'), late: T('Venció sin llegar'), none: '' };
  const bar = Math.min(100, pr.pct ?? 0), color = BAR[pr.status];
  return (
    <div className="rounded-2xl p-4" style={{ background: SOFT }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600">{k.name}{k.period ? ` · ${k.period}` : ''}</p>
        {pr.status !== 'none' && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: TONE[pr.status].bg, color: TONE[pr.status].fg }}>{label[pr.status]}</span>}
      </div>
      <p className="mt-1 text-2xl font-bold" style={{ color: NAVY }}>{fmt(k.value)} <span className="text-sm font-medium text-slate-500">{k.unit}</span></p>
      {pr.pct !== null && (<>
        <div className="relative mt-2 h-2.5 rounded-full bg-white" role="progressbar" aria-valuenow={Math.round(bar)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2.5 rounded-full" style={{ width: `${bar}%`, background: color }} />
          {pr.timePct !== null && <span className="absolute -top-1 h-4.5 w-0.5 rounded" style={{ left: `calc(${pr.timePct}% - 1px)`, top: -3, height: 16, background: NAVY }} title={T('Dónde deberías ir hoy')} />}
        </div>
        <p className="mt-1 text-xs text-slate-500">{Math.round(pr.pct)} % {T('de la meta de')} {fmt(k.target as number)} {k.unit}{pr.daysLeft !== null && pr.status !== 'done' ? ` · ${pr.daysLeft >= 0 ? `${pr.daysLeft} ${T('días restantes')}` : `${-pr.daysLeft} ${T('días de atraso')}`}` : ''}</p>
        {pr.projected !== null && pr.status !== 'done' && <p className="mt-1 text-xs font-medium" style={{ color: TONE[pr.status].fg }}>{T('A este ritmo cierras en')} {fmt(pr.projected)} {k.unit}{pr.projectedPct !== null ? ` (${Math.round(pr.projectedPct)} %)` : ''}</p>}
      </>)}
      {k.history.length > 1 && <div className="mt-2"><HistoryBars points={k.history} target={k.target} big={false} T={T} fmt={fmt} color={color} /></div>}
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{k.updatedBy ? `${k.updatedBy} · ` : ''}{new Date(k.updatedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}</span>
        <span className="flex gap-3">
          <button className="underline" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? T('Cerrar') : T('Ver detalle')}</button>
          {!readOnly && <><button className="underline" onClick={onEdit}>{T('Actualizar')}</button><button className="underline" onClick={onDelete}>{T('Borrar')}</button></>}
        </span>
      </div>
      {open && (
        <div className="mt-3 rounded-xl bg-white p-3">
          <HistoryBars points={k.history} target={k.target} big T={T} fmt={fmt} color={color} />
          {pr.timePct !== null && <p className="mt-2 text-[11px] text-slate-400">{T('La raya oscura marca dónde deberías ir hoy')} ({Math.round(pr.timePct)} % {T('del tiempo')})</p>}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            {k.startDate && <><dt className="text-slate-400">{T('Inicio')}</dt><dd>{day(k.startDate)}</dd></>}
            {k.endDate && <><dt className="text-slate-400">{T('Fin')}</dt><dd>{day(k.endDate)}</dd></>}
            {k.baseline !== undefined && <><dt className="text-slate-400">{T('Valor de arranque')}</dt><dd>{fmt(k.baseline)} {k.unit}</dd></>}
            {k.direction === 'down' && <><dt className="text-slate-400">{T('Sentido')}</dt><dd>{T('Bajar es bueno')}</dd></>}
          </dl>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs text-slate-600">
            {[...k.history].reverse().slice(0, 12).map((h, i) => (<li key={i} className="flex justify-between gap-2 border-t border-slate-100 pt-1"><span>{day(h.at)}{h.by ? ` · ${h.by}` : ''}{h.note ? ` · ${h.note}` : ''}</span><span className="font-semibold" style={{ color: NAVY }}>{fmt(h.value)} {k.unit}</span></li>))}
          </ul>
        </div>
      )}
    </div>
  );
}
