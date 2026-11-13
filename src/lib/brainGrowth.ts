/**
 * Crecimiento del cerebro en el tiempo: cuántas fichas y conexiones tiene cada día, en qué tipos crece,
 * cuánto captura, cuánto pasa a memoria profunda, cuánto se limpia y si «durmió» (ciclo nocturno).
 * Guarda una foto diaria de cifras (unos bytes) junto al registro del cerebro. Lo anterior a la primera
 * foto se reconstruye con las fechas de las fichas y los informes nocturnos; se marca como estimado.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSleepDir } from './dotsSleep';
import { loadApplied } from './sleepApply';

export interface DaySnap { nodes: number; links: number; byType: Record<string, number>; working: number }
export interface GrowthNode { id: string; type?: string; memory_tier?: string; frontmatter?: Record<string, any> }
type Store = { days: Record<string, DaySnap> };
const KEEP_DAYS = 400;
const file = (vaultPath: string) => path.join(getSleepDir(vaultPath), 'growth.json');
const load = (vaultPath: string): Store => { try { const d = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')); return d && d.days ? d : { days: {} }; } catch { return { days: {} }; } };
const dayOf = (v: unknown): string | null => { if (typeof v !== 'string' && !(v instanceof Date)) return null; const t = Date.parse(String(v instanceof Date ? v.toISOString() : v)); return Number.isFinite(t) ? new Date(t - 5 * 3600000).toISOString().slice(0, 10) : null; };
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
/** Día (Panamá) en que nació la ficha, si lo dice su encabezado. */
export const bornDay = (n: GrowthNode): string | null => { const f = n.frontmatter || {}; return dayOf(f.created_at) || dayOf(f.captured_at) || dayOf(f.created) || dayOf(f.date_created) || null; };

export function snapshotOf(nodes: GrowthNode[], links: number): DaySnap {
  const byType: Record<string, number> = {}; let working = 0;
  for (const n of nodes) { byType[n.type || 'otro'] = (byType[n.type || 'otro'] || 0) + 1; if (n.memory_tier === 'working') working++; }
  return { nodes: nodes.length, links, byType, working };
}
/** Guarda (o actualiza) la foto de hoy. Barato: se puede llamar en cada carga del tablero. */
export function recordGrowth(vaultPath: string, nodes: GrowthNode[], links: number, today: string): DaySnap {
  const store = load(vaultPath); const snap = snapshotOf(nodes, links);
  const prev = store.days[today];
  if (prev && prev.nodes === snap.nodes && prev.links === snap.links && prev.working === snap.working) return prev;
  store.days[today] = snap;
  const keys = Object.keys(store.days).sort(); for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete store.days[k];
  try { fs.mkdirSync(path.dirname(file(vaultPath)), { recursive: true }); const tmp = `${file(vaultPath)}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(store)); fs.renameSync(tmp, file(vaultPath)); } catch {}
  return snap;
}

function reportDays(vaultPath: string): Record<string, { nodes: number; links: number }> {
  const out: Record<string, { nodes: number; links: number }> = {};
  try { const dir = path.join(getSleepDir(vaultPath), 'reports'); for (const f of fs.readdirSync(dir)) { if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue; try { const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); out[f.slice(0, 10)] = { nodes: Number(r.nodeCount) || 0, links: Number(r.linkCount) || 0 }; } catch {} } } catch {}
  return out;
}
function activityDays(vaultPath: string): Record<string, number> {
  const out: Record<string, number> = {};
  try { for (const line of fs.readFileSync(path.join(getSleepDir(vaultPath), 'activity.jsonl'), 'utf8').split('\n')) { if (!line) continue; try { const d = dayOf(JSON.parse(line).at); if (d) out[d] = (out[d] || 0) + 1; } catch {} } } catch {}
  return out;
}

export interface GrowthRange {
  days: number; series: { date: string; nodes: number; links: number | null }[];
  newNodes: number; newLinks: number | null; captures: number; consolidated: number; cleanups: number; agentWrites: number;
  byType: { name: string; value: number }[]; linksSince: string | null; nodesEstimated: boolean;
}
export interface Growth { ranges: Record<'7' | '30' | '90', GrowthRange>; sleep: { date: string; slept: boolean; tidied: number }[]; active: boolean; quietDays: number; firstSnapshot: string | null }

export function computeGrowth(vaultPath: string, nodes: GrowthNode[], links: number, today: string): Growth {
  const store = load(vaultPath); store.days[today] = snapshotOf(nodes, links);
  const reports = reportDays(vaultPath), activity = activityDays(vaultPath);
  const applied = Object.values(loadApplied(vaultPath)).filter(a => !a.undoneAt).map(a => dayOf(a.at)).filter(Boolean) as string[];
  const born = nodes.map(n => ({ day: bornDay(n), type: n.type || 'otro', wm: n.type === 'working_memory' }));
  const promoted = nodes.map(n => dayOf(n.frontmatter?.promoted_at)).filter(Boolean) as string[];
  const undated = born.filter(b => !b.day).length;
  const snapDays = Object.keys(store.days).sort();
  const firstSnapshot = snapDays[0] || null;
  const linkDays = Array.from(new Set([...snapDays, ...Object.keys(reports).filter(d => reports[d].links > 0)])).sort();
  const nodesAt = (day: string) => store.days[day]?.nodes ?? (reports[day]?.nodes || undated + born.filter(b => b.day && b.day <= day).length);
  const linksAt = (day: string): number | null => store.days[day]?.links ?? (reports[day]?.links || null);
  const count = (list: string[], from: string) => list.filter(d => d >= from && d <= today).length;

  const range = (days: number): GrowthRange => {
    const from = addDays(today, -(days - 1));
    const step = days <= 30 ? 1 : 3;
    const series: GrowthRange['series'] = [];
    let lastLinks: number | null = null;
    for (let i = days - 1; i >= 0; i -= step) { const date = addDays(today, -i); const l = linksAt(date); if (l !== null) lastLinks = l; series.push({ date, nodes: nodesAt(date), links: l ?? (linkDays[0] && date >= linkDays[0] ? lastLinks : null) }); }
    if (series[series.length - 1].date !== today) series.push({ date: today, nodes: nodes.length, links });
    const startLinksDay = linkDays.find(d => d >= from) || null;
    const startLinks = startLinksDay ? linksAt(startLinksDay) : null;
    // En qué crece: fotos si hay una al inicio del periodo; si no, por fecha de nacimiento de las fichas.
    const startSnapDay = snapDays.find(d => d >= from && d < today);
    const diff: Record<string, number> = {};
    if (startSnapDay && startSnapDay <= addDays(from, 2)) { const a = store.days[startSnapDay].byType, b = store.days[today].byType; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff[k] = (b[k] || 0) - (a[k] || 0); }
    else for (const b of born) if (b.day && b.day >= from) diff[b.type] = (diff[b.type] || 0) + 1;
    return {
      days, series, newNodes: nodes.length - nodesAt(addDays(from, -1)), newLinks: startLinks === null ? null : links - startLinks,
      captures: born.filter(b => b.wm && b.day && b.day >= from).length, consolidated: count(promoted, from), cleanups: count(applied, from),
      agentWrites: Object.entries(activity).filter(([d]) => d >= from && d <= today).reduce((s, [, n]) => s + n, 0),
      byType: Object.entries(diff).filter(([k, v]) => v !== 0 && k !== 'working_memory' && k !== 'consolidation_session').sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })),
      linksSince: linkDays[0] && linkDays[0] > from ? linkDays[0] : null, nodesEstimated: !firstSnapshot || firstSnapshot > from,
    };
  };
  const sleep = Array.from({ length: 14 }, (_, i) => { const date = addDays(today, -(13 - i)); return { date, slept: !!reports[date], tidied: applied.filter(d => d === date).length + promoted.filter(d => d === date).length }; });
  const lastActive = [...born.map(b => b.day), ...applied, ...promoted, ...Object.keys(activity)].filter((d): d is string => !!d && d <= today).sort().pop() || null;
  const quietDays = lastActive ? Math.max(0, Math.round((Date.parse(today) - Date.parse(lastActive)) / 86400000)) : 999;
  return { ranges: { '7': range(7), '30': range(30), '90': range(90) }, sleep, active: quietDays <= 7, quietDays, firstSnapshot };
}
