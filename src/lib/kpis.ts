/**
 * Indicadores (KPIs) de cada cerebro: volumen, ventas, cuotas o lo que la persona quiera seguir.
 * Los pone y actualiza la persona o su agente. Cada cambio guarda quién y cuándo, y queda historial.
 * Viven junto al registro del cerebro, fuera de la bóveda.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSleepDir } from './dotsSleep';

export interface KpiPoint { at: string; value: number; by?: string; note?: string }
export interface Kpi { id: string; name: string; unit: string; value: number; target: number | null; period: string; updatedAt: string; updatedBy?: string; history: KpiPoint[] }
export interface Place { name: string; lat: number; lon: number }
export interface DashboardPrefs { home: Place | null; hq: Place | null }
export class KpiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const MAX_KPIS = 24, MAX_HISTORY = 60;

const file = (vaultPath: string, name: string) => path.join(getSleepDir(vaultPath), name);
function readJson<T>(f: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } }
function writeJson(f: string, data: unknown) { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(data, null, 2)); fs.renameSync(tmp, f); }
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v; return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e15 ? n : null; };

export const listKpis = (vaultPath: string): Kpi[] => { const d = readJson<{ kpis?: Kpi[] }>(file(vaultPath, 'kpis.json'), {}); return Array.isArray(d.kpis) ? d.kpis : []; };

/** Crea el indicador si no existe (por id o por nombre) o registra un valor nuevo. */
export function setKpi(vaultPath: string, input: { id?: unknown; name?: unknown; value?: unknown; unit?: unknown; target?: unknown; period?: unknown; note?: unknown }, by?: string, now = new Date()): Kpi {
  const kpis = listKpis(vaultPath);
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 80) : '';
  const id = typeof input.id === 'string' && input.id ? slug(input.id) : slug(name);
  if (!id) throw new KpiError('El indicador necesita un nombre.');
  const value = num(input.value);
  let k = kpis.find(x => x.id === id);
  if (!k) {
    if (name.length < 2) throw new KpiError('El indicador necesita un nombre.');
    if (value === null) throw new KpiError('El indicador necesita un valor numérico.');
    if (kpis.length >= MAX_KPIS) throw new KpiError(`Máximo ${MAX_KPIS} indicadores. Borra uno primero.`, 409);
    k = { id, name, unit: '', value, target: null, period: '', updatedAt: now.toISOString(), history: [] };
    kpis.push(k);
  }
  if (name) k.name = name;
  if (typeof input.unit === 'string') k.unit = input.unit.trim().slice(0, 16);
  if (typeof input.period === 'string') k.period = input.period.trim().slice(0, 40);
  if (input.target !== undefined) { if (input.target === null || input.target === '') k.target = null; else { const t = num(input.target); if (t === null) throw new KpiError('La meta debe ser un número.'); k.target = t; } }
  if (value !== null) {
    k.value = value;
    k.history = [...k.history, { at: now.toISOString(), value, by, note: typeof input.note === 'string' ? input.note.slice(0, 200) : undefined }].slice(-MAX_HISTORY);
  } else if (input.value !== undefined && input.value !== '') throw new KpiError('El valor debe ser un número.');
  k.updatedAt = now.toISOString(); k.updatedBy = by;
  writeJson(file(vaultPath, 'kpis.json'), { version: 1, kpis });
  return k;
}
export function deleteKpi(vaultPath: string, id: string): boolean {
  const kpis = listKpis(vaultPath); const next = kpis.filter(k => k.id !== id);
  if (next.length === kpis.length) return false;
  writeJson(file(vaultPath, 'kpis.json'), { version: 1, kpis: next }); return true;
}

const place = (p: any): Place | null => { const lat = num(p?.lat), lon = num(p?.lon); const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 60) : ''; return name && lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { name, lat, lon } : null; };
export const loadPrefs = (vaultPath: string): DashboardPrefs => { const d = readJson<any>(file(vaultPath, 'dashboard.json'), {}); return { home: place(d.home), hq: place(d.hq) }; };
export function savePrefs(vaultPath: string, input: { home?: unknown; hq?: unknown }): DashboardPrefs {
  const cur = loadPrefs(vaultPath);
  const next = { home: input.home === undefined ? cur.home : place(input.home), hq: input.hq === undefined ? cur.hq : place(input.hq) };
  writeJson(file(vaultPath, 'dashboard.json'), next); return next;
}
