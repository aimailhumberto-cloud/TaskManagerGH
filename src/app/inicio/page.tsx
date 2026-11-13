'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useUiLang } from '@/lib/uiLang';
import { EN } from './en';
import KpiCard from './KpiCard';

// Idioma: el componente fija _lang en cada render; T traduce en el momento de pintar.
let _lang: 'es' | 'en' = 'es';
let _locale = 'es-PA';
const T = (es: string) => (_lang === 'en' ? EN[es] ?? es : es);

type Tk = { id: string; title: string; dueDate: string | null; priority: string; isOverdue: boolean; isToday: boolean; source: string; time?: string | null; layer?: string };
type NV = { name: string; value: number };
type Place = { name: string; lat: number; lon: number };
type KpiForm = { open: boolean; id: string; name: string; value: string; unit: string; target: string; period: string; startDate: string; endDate: string; baseline: string; direction: 'up' | 'down' };
const KPI_EMPTY: KpiForm = { open: false, id: '', name: '', value: '', unit: '', target: '', period: '', startDate: '', endDate: '', baseline: '', direction: 'up' };
type Kpi = import('./KpiCard').KpiData;
type D = {
  today: string;
  me: { name: string; role: string; isPrimary: boolean; canManage: boolean; isTop: boolean };
  brain: { id: string; viewingOther: boolean; viewingName: string; readOnly: boolean; isEmpty: boolean };
  counts: { overdue: number; today: number; open: number; completed: number };
  tasksToday: Tk[]; agenda: Tk[];
  log: { autonomy: string | null; applied: { id: string; title?: string; by?: string; at: string }[]; activity: { at: string; actor: string; action?: string; path: string }[]; blocked?: { count: number; byDoor: { door: string; count: number }[] }; pending: number };
  health: { nodes: number; links: number; brokenLinks: number; isolated: number; working: number };
  shared: { withMe: { title: string; owner: string; type: string }[]; companyExists: boolean };
  charts: { types: NV[]; countries: NV[]; verification: { verified: number; pending: number; other: number }; quality: number | null; scored: number; week: { date: string; count: number }[]; brands: { name: string; slug: string; count: number }[]; tasks: { overdue: number; today: number; later: number; undated: number } };
  distributors: { name: string; country: string; status: string; compliance: number | null; target: number | null; actual: number | null }[];
  growth: { ranges: Record<string, { days: number; series: { date: string; nodes: number; links: number | null }[]; newNodes: number; newLinks: number | null; captures: number; consolidated: number; cleanups: number; agentWrites: number; byType: NV[]; linksSince: string | null; nodesEstimated: boolean }>; sleep: { date: string; slept: boolean; tidied: number }[]; active: boolean; quietDays: number };
  kpis: Kpi[]; places: { home: Place | null; hq: Place | null };
  people: { accounts: { name: string; role: string; isActive: boolean; lastLoginAt: string | null }[]; brains: number } | null;
};
// Paleta tomada del logotipo y la publicidad de S.M. Jaleel.
const BLUE = '#0a3fbf', NAVY = '#0b1f4d', CYAN = '#00a8f0', SOFT = '#f2f6fd', LINE = '#dbe4f3';
const PALETTE = [BLUE, CYAN, '#ffb703', '#e63946', '#2a9d8f', '#8b5cf6', '#f97316', '#94a3b8'];
const TYPE_ES: Record<string, string> = { product_variant: 'Productos', flavor: 'Sabores', person: 'Personas', packaging: 'Empaques', market: 'Mercados', product_line: 'Líneas', department: 'Departamentos', site: 'Sedes', organization: 'Organizaciones', distributor: 'Distribuidores', brand: 'Marcas', working_memory: 'Memoria de trabajo', catalog_listing: 'Catálogo', project: 'Proyectos', core: 'Núcleo', consolidation_session: 'Sesiones' };
const TILES = ['busta', 'chubby', 'fruta', 'oasis', 'altitude'];
const WMO: [number, string][] = [[0, 'Despejado'], [3, 'Parcialmente nublado'], [48, 'Niebla'], [57, 'Llovizna'], [67, 'Lluvia'], [77, 'Nieve'], [82, 'Chubascos'], [86, 'Nieve'], [99, 'Tormenta']];
const sky = (code: number) => T((WMO.find(([max]) => code <= max) || WMO[0])[1]);
const fmt = (n: number) => n.toLocaleString(_locale, { maximumFractionDigits: 1 });
const fmtDay = (iso: string | null, opt: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) => { if (!iso) return T('Sin fecha'); const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(_locale, { ...opt, timeZone: 'UTC' }); };
const ACTION: Record<string, string> = { remember_working: 'capturó una nota', create: 'creó una tarea', complete: 'completó una tarea', reschedule: 'reprogramó una tarea', decide: 'decidió una propuesta', update_dossier: 'actualizó una ficha', upsert_node: 'creó o cambió una ficha', consolidate_session: 'consolidó la memoria', set: 'actualizó un indicador', ask_dots: 'pidió trabajo al agente' };
const km = (a: Place, b: { lat: number; lon: number }) => { const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

const SHADOW = '0 1px 2px rgba(11,31,77,0.04), 0 12px 28px -18px rgba(11,31,77,0.22)';
const ICONS: Record<string, string> = {
  tasks: 'M9 11l3 3 8-8M4 6h4M4 12h4M4 18h4m4 0h8', calendar: 'M4 7h16v13H4zM8 3v4m8-4v4M4 11h16', spark: 'M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z', chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  donut: 'M12 3a9 9 0 109 9h-9z M14 3.2A9 9 0 0120.8 10H14z', shield: 'M12 3l8 3v6c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z M9 12l2 2 4-4', target: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0-5a4 4 0 100-8 4 4 0 000 8zm0-4h.01',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z', tag: 'M3 12V4h8l10 10-8 8zM7.5 8h.01', share: 'M8 12a3 3 0 11-6 0 3 3 0 016 0zm14-6a3 3 0 11-6 0 3 3 0 016 0zm0 12a3 3 0 11-6 0 3 3 0 016 0zM7.6 10.7l8.8-3.4M7.6 13.3l8.8 3.4', users: 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0', pin: 'M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
};
function Icon({ name, size = 16, color = BLUE }: { name: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name] || ICONS.spark} /></svg>;
}
function Card({ title, children, action, icon = 'spark' }: { title: string; children: React.ReactNode; action?: React.ReactNode; icon?: string }) {
  return (<section className="rounded-[22px] bg-white p-5 sm:p-6" style={{ border: `1px solid ${LINE}`, boxShadow: SHADOW }}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3" style={{ borderColor: '#eef2f9' }}>
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold" style={{ color: NAVY }}><span className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: '#e8f1ff' }}><Icon name={icon} /></span>{title}</h2>{action}</div>{children}</section>);
}
const linkCls = 'rounded-full px-3 py-1 text-xs font-semibold transition-colors hover:bg-[#e8f1ff]';
/** Agrupa actividad repetida del agente: «capturó una nota ×5». */
function groupActivity(list: { at: string; actor: string; action?: string; path: string }[]) {
  const WHERE: Record<string, string> = { 'vault-sync': 'sincronizó archivos de la bóveda', hub: 'actualizó el espacio de trabajo', tasks: 'trabajó en tareas', brain: 'escribió en el cerebro', kpis: 'actualizó indicadores', 'dots-sleep': 'respondió propuestas', shared: 'cambió qué se comparte', decisions: 'consultó a Jev' };
  const out: { text: string; at: string; n: number }[] = [];
  for (const e of list) {
    const text = T(ACTION[e.action || ''] || WHERE[e.path.replace('/api/agent/', '').split('/')[0]] || T('escribió en el cerebro'));
    const last = out[out.length - 1];
    if (last && last.text === text) last.n++; else out.push({ text, at: e.at, n: 1 });
  }
  return out;
}
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); const v = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`; return m < 1 ? T('ahora') : _lang === 'en' ? `${v} ago` : `hace ${v}`; };
function Bars({ rows, color }: { rows: NV[]; color: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (<div className="space-y-2.5">{rows.map(r => (
    <div key={r.name} className="grid items-center gap-2.5 text-[13px] text-slate-700" style={{ gridTemplateColumns: 'minmax(90px, 38%) 1fr 40px' }}>
      <span className="truncate">{r.name}</span>
      <div className="h-3 rounded-full" style={{ background: '#e8eef9' }}><div className="h-3 rounded-full" style={{ width: `${Math.max(3, (r.value / max) * 100)}%`, background: color }} /></div>
      <span className="text-right font-semibold" style={{ color: NAVY }}>{fmt(r.value)}</span>
    </div>))}</div>);
}
function Donut({ rows, total }: { rows: NV[]; total: number }) {
  const C = 2 * Math.PI * 60; let off = 0;
  return (<svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={T('Composición del cerebro por tipo de ficha')} className="shrink-0">
    {rows.map((r, i) => { const len = total ? (r.value / total) * C : 0; const el = <circle key={r.name} cx="80" cy="80" r="60" fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)" />; off += len; return el; })}
    <text x="80" y="78" textAnchor="middle" fontSize="26" fontWeight="700" fill={NAVY}>{fmt(total)}</text><text x="80" y="96" textAnchor="middle" fontSize="11" fill="#64748b">{T('fichas')}</text></svg>);
}
/** Curva de fichas y conexiones. Cada serie usa su propia escala: importa la forma del crecimiento, no comparar magnitudes. */
function GrowthChart({ series }: { series: { date: string; nodes: number; links: number | null }[] }) {
  const W = 640, H = 150, top = 14, bottom = 128;
  const line = (vals: (number | null)[], color: string) => {
    const pts = vals.map((v, i) => (v === null ? null : { x: series.length > 1 ? (i / (series.length - 1)) * W : W, v })).filter(Boolean) as { x: number; v: number }[];
    if (pts.length === 0) return null;
    const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v)), span = max - min || 1;
    const y = (v: number) => bottom - ((v - min) / span) * (bottom - top) * (max === min ? 0.5 : 1);
    const dPath = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    return <g>{pts.length > 1 && <path d={`${dPath} L${last.x} ${bottom} L${pts[0].x} ${bottom} Z`} fill={color} fillOpacity="0.07" />}<path d={dPath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx={last.x} cy={y(last.v)} r="4.5" fill={color} stroke="#fff" strokeWidth="2" /></g>;
  };
  return (<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={T('Fichas y conexiones a lo largo del tiempo')} className="block h-auto w-full">
    {[top, (top + bottom) / 2].map(yy => <line key={yy} x1="0" x2={W} y1={yy} y2={yy} stroke="#e6edf9" strokeDasharray="3 5" />)}<line x1="0" x2={W} y1={bottom} y2={bottom} stroke="#dbe4f3" />
    {line(series.map(p => p.links), BLUE)}{line(series.map(p => p.nodes), '#2a9d8f')}
    <text x="0" y={H - 4} fontSize="11" fill="#64748b">{fmtDay(series[0]?.date || null, { day: 'numeric', month: 'short' })}</text><text x={W} y={H - 4} fontSize="11" fill="#64748b" textAnchor="end">{T('hoy')}</text>
  </svg>);
}
export default function InicioPage() {
  const ui = useUiLang(); _lang = ui.lang; _locale = ui.locale;
  const [d, setD] = useState<D | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [capture, setCapture] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied'>('idle');
  const [wx, setWx] = useState<Record<string, { temp: number; code: number; time: string }>>({});
  const [placeForm, setPlaceForm] = useState<{ open: boolean; which: 'home' | 'hq'; q: string; results: Place[] }>({ open: false, which: 'home', q: '', results: [] });
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const [kpiForm, setKpiForm] = useState<KpiForm>(KPI_EMPTY);

  const load = useCallback(async () => {
    try { const r = await fetch('/api/agent/dashboard', { cache: 'no-store' }); const j = await r.json(); if (r.ok && j.ok) { setD(j); setErr(null); } else setErr(j.error || T('No se pudo cargar tu tablero.')); }
    catch { setErr(T('No se pudo cargar tu tablero.')); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // Ubicación: solo si la persona ya dio permiso antes; si no, se pide con un botón.
  const locate = useCallback(() => {
    if (!navigator.geolocation) return setGeo('denied');
    setGeo('asking');
    navigator.geolocation.getCurrentPosition(p => { setHere({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100 }); setGeo('idle'); }, () => setGeo('denied'), { maximumAge: 600000, timeout: 10000 });
  }, []);
  useEffect(() => { navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then(s => { if (s.state === 'granted') locate(); }).catch(() => {}); }, [locate]);

  const home = d?.places.home || null, hq = d?.places.hq || null;
  const hereIsKnown = here && ((home && km(home, here) < 40) || (hq && km(hq, here) < 40));
  const spots: { key: string; label: string; p: { lat: number; lon: number } }[] = [
    ...(here && !hereIsKnown ? [{ key: 'here', label: T('Donde estás'), p: here }] : []),
    ...(home ? [{ key: 'home', label: `${home.name}${here && km(home, here) < 40 ? ` · ${T('estás aquí')}` : ''}`, p: home }] : []),
    ...(hq ? [{ key: 'hq', label: `${hq.name}${here && km(hq, here) < 40 ? ` · ${T('estás aquí')}` : ''}`, p: hq }] : []),
  ];
  const spotsKey = spots.map(s => `${s.key}:${s.p.lat},${s.p.lon}`).join('|');
  useEffect(() => {
    if (!spotsKey) return;
    let off = false;
    (async () => {
      const out: Record<string, { temp: number; code: number; time: string }> = {};
      await Promise.all(spotsKey.split('|').map(async s => {
        const [key, ll] = s.split(':'); const [lat, lon] = ll.split(',');
        try { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`); const j = await r.json();
          if (typeof j?.current?.temperature_2m === 'number') out[key] = { temp: j.current.temperature_2m, code: j.current.weather_code ?? 0, time: String(j.current.time || '').slice(11, 16) }; } catch {}
      }));
      if (!off) setWx(out);
    })();
    return () => { off = true; };
  }, [spotsKey]);

  const post = async (url: string, body: unknown, okText: string) => {
    setBusy(true); setNote(null);
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); const ok = r.ok && j.ok !== false; setNote(ok ? okText : j.error || j.message || T('No se pudo completar.')); if (ok) await load(); return ok; }
    finally { setBusy(false); }
  };
  const doCapture = async (e: React.FormEvent) => { e.preventDefault(); const text = capture.trim(); if (text.length < 3) return setNote(T('Escribe lo que quieres capturar.')); if (await post('/api/agent/brain', { action: 'remember_working', title: text.slice(0, 70), content: text, source: 'Tablero inicial' }, T('Capturado en tu cerebro.'))) setCapture(''); };
  const searchPlace = async (e: React.FormEvent) => {
    e.preventDefault(); if (placeForm.q.trim().length < 2) return;
    try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placeForm.q.trim())}&count=5&language=es`); const j = await r.json();
      setPlaceForm(f => ({ ...f, results: (j.results || []).map((x: any) => ({ name: [x.name, x.country].filter(Boolean).join(', '), lat: x.latitude, lon: x.longitude })) })); } catch { setNote(T('No se pudo buscar la ciudad.')); }
  };
  const saveKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { action: 'set', name: kpiForm.name, unit: kpiForm.unit, period: kpiForm.period, target: kpiForm.target === '' ? null : kpiForm.target, startDate: kpiForm.startDate || null, endDate: kpiForm.endDate || null, baseline: kpiForm.baseline === '' ? null : kpiForm.baseline, direction: kpiForm.direction };
    if (kpiForm.id) body.id = kpiForm.id; if (kpiForm.value !== '') body.value = kpiForm.value;
    if (await post('/api/agent/kpis', body, T('Indicador guardado.'))) setKpiForm(KPI_EMPTY);
  };

  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Panama' }));
  const hello = hour < 12 ? T('Buenos días') : hour < 19 ? T('Buenas tardes') : T('Buenas noches');
  if (err) return <div className="p-8"><p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{err}</p></div>;
  if (!d) return <div className="p-8 text-sm text-slate-500">{T('Cargando tu tablero…')}</div>;

  const chip = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] text-white';
  const input = 'rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400';
  const types = d.charts.types.map(t => ({ name: T(TYPE_ES[t.name] || t.name), value: t.value }));
  const donutRows = types.length > 6 ? [...types.slice(0, 5), { name: T('Otros'), value: types.slice(5).reduce((s, t) => s + t.value, 0) }] : types;
  const v = d.charts.verification, vTotal = Math.max(1, v.verified + v.pending); // la barra compara solo lo que ya tiene estado de verificación
  const kpi = (label: string, value: string, sub: string, tone = NAVY) => (
    <div className="overflow-hidden rounded-[20px] bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: SHADOW }}>
      <div className="h-1" style={{ background: tone }} />
      <div className="px-5 py-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="text-[34px] font-bold leading-tight" style={{ color: tone }}>{value}</p><p className="text-xs text-slate-500">{sub}</p></div>
    </div>);
  const brandTiles = d.charts.brands.filter(b => TILES.includes(b.slug));

  return (
    <div className="min-h-full p-4 sm:p-7" style={{ background: SOFT, fontFamily: 'Poppins, system-ui, sans-serif', color: NAVY }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
      <div className="mx-auto flex max-w-[1304px] flex-col gap-5">

        <header className="grid overflow-hidden rounded-[28px] lg:grid-cols-[1.05fr_1fr]" style={{ background: BLUE }}>
          <div className="flex flex-col justify-between gap-5 p-6 sm:p-9">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.08em]" style={{ color: '#9fdcff' }}>{T('SEGUNDO CEREBRO · S.M. JALEEL')}</p>
              <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-[40px]">{hello}, {d.me.name}</h1>
              <p className="mt-1 text-[15px]" style={{ color: '#dbeafe' }}>{(x => x.charAt(0).toUpperCase() + x.slice(1))(fmtDay(d.today, { weekday: 'long', day: 'numeric', month: 'long' }))} · {d.brain.viewingOther ? `${T('estás viendo el cerebro de')} ${d.brain.viewingName}` : T('tu día en una mirada')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {spots.map(s => (<span key={s.key} className={chip} style={{ background: 'rgba(255,255,255,0.14)' }}>{s.label} · {wx[s.key] ? `${Math.round(wx[s.key].temp)} °C · ${sky(wx[s.key].code)} · ${wx[s.key].time}` : '…'}</span>))}
              {!here && geo !== 'denied' && <button onClick={locate} className={chip} style={{ background: 'rgba(255,255,255,0.14)' }}>{geo === 'asking' ? T('Buscando tu ubicación…') : T('Usar mi ubicación')}</button>}
              {!d.brain.readOnly && !d.brain.viewingOther && <button onClick={() => setPlaceForm(f => ({ ...f, open: !f.open }))} className={chip} style={{ background: 'rgba(255,255,255,0.14)' }}>{home || hq ? T('Cambiar ciudades') : T('Elegir casa y sede')}</button>}
              {d.log.autonomy && <span className={chip} style={{ background: CYAN, color: '#04214f', fontWeight: 600 }}>{d.log.autonomy === 'auto' ? T('Modo automático') : T('Modo propuesta')}</span>}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/cerebro" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold" style={{ color: BLUE }}>{T('Abrir mi cerebro')}</Link>
              <Link href="/tasks" className="rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: CYAN, color: '#04214f' }}>{T('Ver mis tareas')}</Link>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="relative h-52 lg:h-auto lg:min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/smj-bebidas-hero.jpg" alt={T('Bebidas de S.M. Jaleel')} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 70%' }} />
            <div aria-hidden className="absolute inset-y-0 left-0 hidden w-28 lg:block" style={{ background: `linear-gradient(90deg, ${BLUE}, rgba(10,63,191,0))` }} />
            <div aria-hidden className="absolute inset-x-0 top-0 h-10 lg:hidden" style={{ background: `linear-gradient(180deg, ${BLUE}, rgba(10,63,191,0))` }} />
          </div>
        </header>

        {placeForm.open && (
          <Card icon="pin" title={T('Ciudades del tablero')}>
            <p className="mb-3 text-sm text-slate-600">{T('Elige tu casa y la sede. Si estás en una de las dos, solo verás dos ciudades; si estás en otro lugar, verás tres. Tu ubicación solo se usa para el clima y no se guarda.')}</p>
            <form onSubmit={searchPlace} className="flex flex-wrap gap-2">
              <select className={input} value={placeForm.which} onChange={e => setPlaceForm(f => ({ ...f, which: e.target.value as 'home' | 'hq' }))} aria-label={T('Cuál ciudad')}><option value="home">{T('Casa')}</option><option value="hq">{T('Sede')}</option></select>
              <input className={`${input} min-w-0 flex-1`} placeholder={T('Ciudad')} value={placeForm.q} onChange={e => setPlaceForm(f => ({ ...f, q: e.target.value }))} aria-label={T('Ciudad')} />
              <button className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>{T('Buscar')}</button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">{placeForm.results.map((p, i) => (<button key={i} disabled={busy} onClick={async () => { if (await post('/api/agent/dashboard', { action: 'places', [placeForm.which]: p }, T('Ciudad guardada.'))) setPlaceForm(f => ({ ...f, results: [], q: '' })); }} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">{p.name}</button>))}</div>
            <p className="mt-2 text-xs text-slate-500">{T('Casa')}: {home?.name || T('sin elegir')} · {T('Sede')}: {hq?.name || T('sin elegir')}</p>
          </Card>
        )}

        {d.brain.isEmpty && !d.brain.viewingOther && (
          <section className="rounded-[20px] p-5" style={{ border: `1px solid ${CYAN}`, background: '#eef9ff' }}>
            <h2 className="text-base font-bold">{T('Tu cerebro está recién creado')}</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700"><li>{T('Captura tu primera idea o dato en el cuadro de abajo.')}</li><li>{T('Crea una tarea en')} <Link className="underline" href="/tasks">{T('Tareas')}</Link>.</li><li>{T('Conecta tu agente de IA desde')} <Link className="underline" href="/mi-agente">{T('Mi agente')}</Link>.</li></ol>
          </section>
        )}

        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {kpi(T('Tareas vencidas'), fmt(d.counts.overdue), `${T('de')} ${fmt(d.counts.open)} ${T('abiertas')}`, d.counts.overdue ? '#d62839' : NAVY)}
          {kpi(T('Para hoy'), fmt(d.counts.today), T('tareas y seguimientos'))}
          {kpi(T('Fichas en mi cerebro'), fmt(d.health.nodes), `${fmt(d.health.links)} ${T('conexiones')}`, BLUE)}
          {kpi(T('Calidad de las fichas'), d.charts.quality === null ? '—' : `${d.charts.quality} %`, d.charts.scored ? `${T('promedio de')} ${fmt(d.charts.scored)} ${T('fichas con puntaje')}` : T('aún sin fichas con puntaje'), '#2a9d8f')}
          {kpi(T('Cambios de Jev y mi agente'), fmt(d.log.applied.length + d.log.activity.length), T('recientes, con deshacer'), CYAN)}
          {kpi(T('Esperan tu criterio'), fmt(d.log.pending), T('propuestas por revisar'), d.log.pending ? '#b45309' : NAVY)}
        </section>

        {!d.brain.readOnly && (
          <form onSubmit={doCapture} className="flex gap-2 rounded-[20px] bg-white p-3" style={{ border: `1px solid ${LINE}` }}>
            <input value={capture} onChange={e => setCapture(e.target.value)} placeholder={T('Captura una idea, un dato o un pendiente')} aria-label={T('Captura rápida')} className={`${input} min-w-0 flex-1 py-2.5`} />
            <button disabled={busy} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{T('Capturar')}</button>
          </form>
        )}
        {note && <p className="rounded-xl bg-white px-4 py-2 text-sm text-slate-700" style={{ border: `1px solid ${LINE}` }}>{note}</p>}

        <Card icon="target" title={T('Mis indicadores')} action={!d.brain.readOnly ? <button onClick={() => setKpiForm({ ...KPI_EMPTY, open: !kpiForm.open })} className={linkCls} style={{ color: BLUE, background: SOFT }}>{kpiForm.open ? T('Cerrar') : T('Agregar indicador')}</button> : undefined}>
          {kpiForm.open && (
            <form onSubmit={saveKpi} className="mb-4 grid gap-2 sm:grid-cols-6">
              <input className={`${input} sm:col-span-2`} placeholder={T('Nombre (ej.: Volumen Belice)')} value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} aria-label={T('Nombre')} />
              <input className={input} placeholder={T('Valor')} inputMode="decimal" value={kpiForm.value} onChange={e => setKpiForm({ ...kpiForm, value: e.target.value })} aria-label={T('Valor')} />
              <input className={input} placeholder={T('Unidad')} value={kpiForm.unit} onChange={e => setKpiForm({ ...kpiForm, unit: e.target.value })} aria-label={T('Unidad')} />
              <input className={input} placeholder={T('Meta')} inputMode="decimal" value={kpiForm.target} onChange={e => setKpiForm({ ...kpiForm, target: e.target.value })} aria-label={T('Meta')} />
              <button disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>{T('Guardar')}</button>
              <label className="flex flex-col gap-1 text-[11px] text-slate-500 sm:col-span-2">{T('Inicio')}<input type="date" className={input} value={kpiForm.startDate} onChange={e => setKpiForm({ ...kpiForm, startDate: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-500 sm:col-span-2">{T('Fin')}<input type="date" className={input} value={kpiForm.endDate} onChange={e => setKpiForm({ ...kpiForm, endDate: e.target.value })} /></label>
              <label className="flex flex-col gap-1 text-[11px] text-slate-500 sm:col-span-2">{T('Valor de arranque')}<input className={input} placeholder="0" inputMode="decimal" value={kpiForm.baseline} onChange={e => setKpiForm({ ...kpiForm, baseline: e.target.value })} /></label>
              <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-3"><input type="checkbox" checked={kpiForm.direction === 'down'} onChange={e => setKpiForm({ ...kpiForm, direction: e.target.checked ? 'down' : 'up' })} />{T('Bajar es bueno (costos, devoluciones)')}</label>
              <input className={`${input} sm:col-span-3`} placeholder={T('Nota (ej.: Q4 2026)')} value={kpiForm.period} onChange={e => setKpiForm({ ...kpiForm, period: e.target.value })} aria-label={T('Nota')} />
            </form>
          )}
          {d.kpis.length === 0 ? <p className="text-sm text-slate-500">{T('Aquí van los números que quieras seguir: volumen, ventas, cuotas. Agrégalos tú o díselo a tu agente y él los mantiene al día.')}</p> : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>{d.kpis.map(k => (
              <KpiCard key={k.id} k={k} today={d.today} readOnly={d.brain.readOnly} T={T} fmt={fmt} locale={_locale}
                onEdit={() => setKpiForm({ open: true, id: k.id, name: k.name, value: '', unit: k.unit, target: k.target === null ? '' : String(k.target), period: k.period, startDate: k.startDate || '', endDate: k.endDate || '', baseline: k.baseline === undefined ? '' : String(k.baseline), direction: k.direction || 'up' })}
                onDelete={() => post('/api/agent/kpis', { action: 'delete', id: k.id }, T('Indicador borrado.'))} />))}</div>)}
        </Card>

        <section className="grid gap-5 lg:grid-cols-3">
          <Card icon="donut" title={T('De qué está hecho mi cerebro')}>
            <div className="flex flex-wrap items-center gap-6"><Donut rows={donutRows} total={d.health.nodes} />
              <div className="min-w-[150px] flex-1 space-y-2">{donutRows.map((r, i) => (<div key={r.name} className="flex items-center justify-between gap-3 text-[13px] text-slate-700"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PALETTE[i % PALETTE.length] }} />{r.name}</span><span className="font-semibold" style={{ color: NAVY }}>{fmt(r.value)}</span></div>))}</div></div>
          </Card>
          {(() => { const gr = d.growth.ranges[range]; const delta = (n: number | null) => (n === null ? '—' : `${n > 0 ? '+' : ''}${fmt(n)}`); const maxT = Math.max(1, ...d.growth.sleep.map(x => x.tidied)); const slept = d.growth.sleep.filter(x => x.slept).length; return (
          <div className="lg:col-span-2"><Card icon="chart" title={T('Cómo crece mi cerebro')} action={<span className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={d.growth.active ? { background: '#e3f6f1', color: '#0f766e' } : { background: '#f1f5f9', color: '#475569' }}>{d.growth.active ? T('Cerebro activo') : d.growth.quietDays > 365 ? T('Cerebro quieto') : `${T('Quieto hace')} ${d.growth.quietDays} ${T('días')}`}</span>
            {(['7', '30', '90'] as const).map(r => (<button key={r} onClick={() => setRange(r)} aria-pressed={range === r} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={range === r ? { background: BLUE, color: '#fff' } : { background: SOFT, color: BLUE }}>{r} {T('días')}</button>))}</span>}>
            <GrowthChart series={gr.series} />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: BLUE }} />{T('Conexiones')}</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: '#2a9d8f' }} />{T('Fichas')}</span>
              <span className="text-slate-400">{gr.linksSince ? `${T('Conexiones medidas desde el')} ${fmtDay(gr.linksSince, { day: 'numeric', month: 'short' })}. ` : ''}{gr.nodesEstimated ? T('Fichas anteriores estimadas por su fecha de creación.') : ''}</span></div>
            <div className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
              {[[T('Fichas nuevas'), delta(gr.newNodes), gr.newNodes > 0], [T('Conexiones nuevas'), delta(gr.newLinks), (gr.newLinks || 0) > 0], [T('Capturas'), fmt(gr.captures), false], [T('A memoria profunda'), fmt(gr.consolidated), false], [T('Limpiezas'), fmt(gr.cleanups), false], [T('Escrituras del agente'), fmt(gr.agentWrites), false]].map(([l, val, up]) => (
                <div key={l as string} className="rounded-[14px] px-3 py-2.5" style={{ background: SOFT }}><p className="text-[11px] font-medium text-slate-500">{l}</p><p className="text-xl font-bold" style={{ color: up ? '#0f766e' : NAVY }}>{val}</p></div>))}
            </div>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div><h3 className="mb-2.5 text-[13px] font-bold">{T('En qué está creciendo')}</h3>{gr.byType.filter(t => t.value > 0).length === 0 ? <p className="text-sm text-slate-500">{T('Sin fichas nuevas en este periodo.')}</p> : <Bars color={BLUE} rows={gr.byType.filter(t => t.value > 0).map(t => ({ name: T(TYPE_ES[t.name] || t.name), value: t.value }))} />}</div>
              <div><h3 className="mb-2.5 text-[13px] font-bold">{T('Sueño y limpieza, últimas 14 noches')}</h3>
                <div className="flex h-9 items-end gap-1.5">{d.growth.sleep.map(x => (<span key={x.date} title={`${fmtDay(x.date, { day: 'numeric', month: 'short' })}: ${x.slept ? `${T('durmió, ordenó')} ${x.tidied}` : T('sin ciclo nocturno')}`} className="w-full max-w-[18px] rounded-[5px]" style={{ height: x.slept ? `${Math.max(30, (x.tidied / maxT) * 100)}%` : '18%', background: x.slept ? '#2a9d8f' : '#cbd5e1' }} />))}</div>
                <p className="mt-2 text-xs text-slate-500">{T('Durmió')} {slept} {T('de 14 noches. La altura mide cuánto ordenó esa noche: notas consolidadas, capturas conectadas y cambios aplicados.')}</p></div>
            </div>
          </Card></div>); })()}
        </section>

        <section className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <Card icon="chart" title={T('Mis tareas abiertas')}>
            <Bars color={BLUE} rows={[{ name: T('Vencidas'), value: d.charts.tasks.overdue }, { name: T('Para hoy'), value: d.charts.tasks.today }, { name: T('Más adelante'), value: d.charts.tasks.later }, { name: T('Sin fecha'), value: d.charts.tasks.undated }]} />
            {d.charts.countries.length > 0 && <><h2 className="mb-3.5 mt-6 text-[15px] font-bold">{T('Fichas por país')}</h2><Bars color={CYAN} rows={d.charts.countries} /></>}
          </Card>
          <Card icon="shield" title={T('Qué tan confiable es lo que sé')}>
            <div className="flex h-[18px] overflow-hidden rounded-full" style={{ background: '#e8eef9' }}><div style={{ width: `${(v.verified / vTotal) * 100}%`, background: '#2a9d8f' }} /><div style={{ width: `${(v.pending / vTotal) * 100}%`, background: '#ffb703' }} /></div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-700"><span><b style={{ color: '#2a9d8f' }}>{fmt(v.verified)}</b> {T('verificadas')}</span><span><b style={{ color: '#b45309' }}>{fmt(v.pending)}</b> {T('pendientes')}</span><span><b>{fmt(v.other)}</b> {T('sin revisar todavía')}</span></div>
            <h2 className="mb-3 mt-6 text-[15px] font-bold">{T('Salud')}</h2>
            <div className="grid grid-cols-3 gap-2.5 text-center">{[[d.health.brokenLinks, T('enlaces rotos')], [d.health.isolated, T('sin conexión')], [d.health.working, T('en memoria de trabajo')]].map(([n, l]) => (<div key={l as string} className="rounded-[14px] p-3" style={{ background: SOFT }}><p className="text-[22px] font-bold">{fmt(n as number)}</p><p className="text-[11px] text-slate-500">{l}</p></div>))}</div>
          </Card>
        </section>

        <section className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <Card icon="tasks" title={T('Mis tareas de hoy')} action={<span className="flex gap-3">{d.me.canManage && <Link href="/mis-tareas" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Asignar a alguien')}</Link>}<Link href="/tasks" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Ver todas')}</Link></span>}>
            {d.tasksToday.length === 0 ? <p className="text-sm text-slate-500">{T('Nada vence hoy.')}</p> : (<ul className="space-y-2">{d.tasksToday.map(t => (
              <li key={t.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[#f7faff]" style={{ border: '1px solid #eef2f9' }}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.isOverdue ? '#d62839' : t.priority === 'High' ? '#ffb703' : CYAN }} aria-hidden />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800" title={t.title}>{t.title}</p>{t.source && <p className="truncate text-xs text-slate-500">{t.source}</p>}</div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={t.isOverdue ? { background: '#fde8ea', color: '#b01e2b' } : { background: '#e8f1ff', color: BLUE }}>{t.isOverdue ? T('Vencida') : T('Hoy')}</span>
                {!d.brain.readOnly && <button disabled={busy} onClick={() => post('/api/agent/tasks', { action: 'complete', taskId: t.id, completedBy: d.me.name }, T('Tarea completada.'))} aria-label={`${T('Completar')}: ${t.title}`} title={T('Completar')} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></button>}
              </li>))}</ul>)}
          </Card>
          <Card icon="calendar" title={T('Agenda de la semana')} action={<Link href="/mi-agenda" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Ver agenda')}</Link>}>
            <div className="grid grid-cols-7 gap-1.5 text-center">{d.charts.week.map((w, i) => (<Link href="/mi-agenda" key={w.date} className="rounded-2xl py-2.5 transition-transform hover:-translate-y-0.5" style={i === 0 ? { background: BLUE, color: '#fff', boxShadow: '0 8px 18px -8px rgba(10,63,191,0.7)' } : { background: SOFT, border: '1px solid #e6edf9' }}><p className="text-[11px] capitalize opacity-80">{fmtDay(w.date, { weekday: 'short' })}</p><p className="text-lg font-bold">{Number(w.date.slice(8))}</p><p className="mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold" style={w.count ? (i === 0 ? { background: '#fff', color: BLUE } : { background: CYAN, color: '#04214f' }) : { opacity: 0.35 }}>{w.count || '·'}</p></Link>))}</div>
            <ul className="mt-4 space-y-1.5">{d.agenda.slice(0, 4).map(t => (<li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[#f7faff]"><span className="w-[76px] shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold capitalize" style={t.isToday ? { background: BLUE, color: '#fff' } : { background: '#e6f6fe', color: '#0369a1' }}>{t.isToday ? T('Hoy') : fmtDay(t.dueDate, { weekday: 'short', day: 'numeric' })}</span><span className="min-w-0 truncate text-sm text-slate-800" title={t.title}>{t.time ? <b className="mr-1.5 font-semibold" style={{ color: BLUE }}>{t.time}</b> : null}{t.title}</span></li>))}</ul>
          </Card>
          <Card icon="spark" title={T('Lo que hicieron Jev y mi agente')} action={<Link href="/cerebro" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Ver el registro')}</Link>}>
            {d.log.applied.length + d.log.activity.length === 0 && d.log.pending === 0 && <p className="text-sm text-slate-500">{T('Todavía no hay actividad.')}</p>}
            <ul className="space-y-2">
              {d.log.applied.map(a => (<li key={a.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ border: '1px solid #eef2f9' }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#e6f6fe' }}><Icon name="spark" size={14} color="#0284c7" /></span>
                <span className="min-w-0 flex-1 text-sm text-slate-800"><span className="block truncate" title={a.title}>{a.title || T('Cambio aplicado')}</span><span className="text-xs text-slate-500">{a.by || T('aprobado')} · {ago(a.at)}</span></span>
                <button disabled={busy} onClick={() => post('/api/agent/dots-sleep', { action: 'undo', id: a.id }, T('Cambio deshecho.'))} className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Deshacer')}</button></li>))}
              {groupActivity(d.log.activity).map((e, i) => (<li key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ border: '1px solid #eef2f9' }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#e8f1ff' }}><Icon name="users" size={14} /></span>
                <span className="min-w-0 flex-1 text-sm text-slate-800">{T('Mi agente')} {e.text}{e.n > 1 && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: '#e8f1ff', color: BLUE }}>×{e.n}</span>}<span className="block text-xs text-slate-500">{ago(e.at)}</span></span></li>))}
              {!!d.log.blocked?.count && <li className="rounded-2xl px-3 py-2.5 text-sm" style={{ background: '#fff7e6', color: '#92400e', border: '1px solid #fde3b0' }}>
                <p className="font-semibold">{d.log.blocked.count} {T('intentos directos bloqueados (7 días)')}</p>
                <p className="text-xs">{T('Mi agente intentó escribir sin pasar por el Cerebro. Lo que se repita es lo que le falta al Cerebro:')} {d.log.blocked.byDoor.slice(0, 4).map(x => `${x.door} ×${x.count}`).join(' · ')}</p></li>}
              {d.log.pending > 0 && <li><Link href="/cerebro" className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium" style={{ background: '#fff7e6', color: '#92400e', border: '1px solid #fde3b0' }}><span>{d.log.pending} {d.log.pending === 1 ? T('propuesta espera tu criterio') : T('propuestas esperan tu criterio')}</span><span aria-hidden>→</span></Link></li>}
            </ul>
          </Card>
        </section>

        {d.distributors.length > 0 && (
          <Card icon="truck" title={T('Cuotas de distribuidores')} action={<Link href="/tasks" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Ver en Tareas')}</Link>}>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>{d.distributors.map(x => { const tone = x.status === 'At Risk' ? '#d62839' : x.status === 'Ahead' ? '#2a9d8f' : x.status === 'On Track' ? BLUE : '#94a3b8'; const label = x.status === 'At Risk' ? T('En riesgo') : x.status === 'Ahead' ? T('Adelantado') : x.status === 'On Track' ? T('En ruta') : T('Sin cuota definida'); return (
              <div key={x.name} className="rounded-2xl p-4" style={{ background: SOFT }}>
                <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-semibold">{x.name}</p><span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: tone }}>{label}</span></div>
                <p className="text-xs text-slate-500">{x.country}</p>
                {x.compliance !== null ? <><div className="mt-2 h-2.5 rounded-full bg-white"><div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, x.compliance))}%`, background: tone }} /></div><p className="mt-1 text-xs text-slate-500">{Math.round(x.compliance)} % {T('de la cuota')}{x.actual !== null && x.target !== null ? ` · ${fmt(x.actual)} ${T('de')} ${fmt(x.target)} ${T('cajas')}` : ''}</p></> : <p className="mt-2 text-xs text-slate-500">{T('Falta registrar su cuota y su avance.')}</p>}
              </div>); })}</div>
          </Card>
        )}

        {brandTiles.length > 0 && (
          <Card icon="tag" title={T('Mis marcas en el cerebro')}>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>{brandTiles.map(b => (
              <Link href="/cerebro" key={b.slug} className="relative block h-[120px] overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/brands/${b.slug}-tile.jpg`} alt={b.name} className="h-full w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: 'rgba(11,31,77,0.88)' }}>{b.name} · {fmt(b.count)} {T('fichas')}</span>
              </Link>))}</div>
          </Card>
        )}

        <section className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <Card icon="share" title={T('Compañía y compartido')} action={<Link href="/compania" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Abrir')}</Link>}>
            <p className="text-sm text-slate-700">{d.shared.companyExists ? T('El cerebro de la compañía está disponible para consulta.') : T('El cerebro de la compañía aún no existe.')}</p>
            {d.shared.withMe.length > 0 ? <ul className="mt-2 space-y-1">{d.shared.withMe.map((s, i) => (<li key={i} className="truncate text-sm text-slate-700">{s.owner} {T('compartió')} «{s.title}»</li>))}</ul> : <p className="mt-1 text-sm text-slate-500">{T('Nadie ha compartido fichas contigo todavía.')}</p>}
          </Card>
          {d.people && (
            <Card icon="users" title={T('Personas')} action={<Link href="/usuarios" className={linkCls} style={{ color: BLUE, background: SOFT }}>{T('Administrar')}</Link>}>
              <p className="mb-2 text-sm text-slate-600">{d.people.accounts.filter(a => a.isActive).length} {T('cuentas activas')} · {d.people.brains} {T('cerebros')}</p>
              <ul className="space-y-1">{d.people.accounts.map((a, i) => (<li key={i} className="flex justify-between gap-2 text-sm"><span className="truncate text-slate-800">{a.name} <span className="text-slate-500">· {a.role}{a.isActive ? '' : ` · ${T('desactivada')}`}</span></span><span className="shrink-0 text-xs text-slate-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString(_locale, { day: 'numeric', month: 'short' }) : T('Sin entrar')}</span></li>))}</ul>
            </Card>)}
        </section>

        {d.me.isPrimary && !d.brain.viewingOther && <p className="text-xs text-slate-500">{T('Tu espacio de trabajo anterior (empresas, proyectos y reuniones) sigue en')} <Link className="underline" href="/clasico">{T('Espacio anterior')}</Link>.</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/Brands-you-Love_2-copy-scaled.jpg" alt={T('Marcas de S.M. Jaleel')} className="w-full rounded-[20px]" />
      </div>
    </div>
  );
}
