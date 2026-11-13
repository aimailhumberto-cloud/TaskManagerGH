/**
 * Diario de cambios del cerebro (fase 1). Toda petición que escribe corre dentro de un «cambio»:
 * cada archivo que se toca guarda su contenido de antes y de después. Al terminar queda una entrada
 * en el diario (quién, cuándo, por dónde, qué archivos y qué campos) y una foto para deshacer.
 *  - Lo usan withBrain (todas las rutas), el ciclo nocturno y Jev en segundo plano.
 *  - Deshacer devuelve cada archivo a su versión anterior, solo si nadie lo cambió después.
 *  - Vive junto al registro del cerebro (dots-sleep/journal), fuera de la bóveda.
 * Este módulo no importa vaultFiles: vaultFiles lo llama a él antes de cada escritura.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import YAML from 'yaml';
import { AsyncLocalStorage } from 'async_hooks';

export interface ChangeMeta { actor?: string; via?: string; route?: string; action?: string; request?: string; note?: string }
export interface FileChange { path: string; title?: string; op: 'creado' | 'cambiado' | 'borrado'; fields?: string[]; body?: boolean; detail?: string[] }
export interface JournalEntry extends ChangeMeta { id: string; at: string; summary: string; files: FileChange[]; undoneAt?: string; undoneBy?: string; undoOf?: string }

interface Ctx { vaultPath: string; meta: ChangeMeta; files: Map<string, string | null>; closed: boolean }
const g = globalThis as unknown as { __journalALS?: AsyncLocalStorage<Ctx> };
const store = (g.__journalALS ??= new AsyncLocalStorage<Ctx>());

const sleepDir = (vaultPath: string) => path.join(path.dirname(path.resolve(vaultPath)), 'dots-sleep');
const dir = (vaultPath: string) => path.join(sleepDir(vaultPath), 'journal');
const logFile = (vaultPath: string) => path.join(dir(vaultPath), 'journal.jsonl');
const snapFile = (vaultPath: string, id: string) => path.join(dir(vaultPath), 'snap', `${id}.json`);
/** Archivos fuera de la bóveda que también cuentan como datos del cerebro. */
const SIDE_FILES = new Set(['agenda.json', 'kpis.json']);
export const SNAP_DAYS = 45;
const MAX_LOG_BYTES = 5 * 1024 * 1024;

const readRaw = (abs: string): string | null => { try { return fs.readFileSync(abs, 'utf8'); } catch { return null; } };

function tracked(vaultPath: string, abs: string): string | null {
  const a = path.resolve(abs), v = path.resolve(vaultPath);
  if (a.endsWith('.tmp')) return null;
  if (a.startsWith(v + path.sep)) return path.relative(v, a).split(path.sep).join('/');
  if (path.dirname(a) === path.resolve(sleepDir(vaultPath)) && SIDE_FILES.has(path.basename(a))) return `~${path.basename(a)}`;
  return null;
}
const absOf = (vaultPath: string, rel: string) => rel.startsWith('~') ? path.join(sleepDir(vaultPath), rel.slice(1)) : path.join(path.resolve(vaultPath), rel);

/** Lo llama toda escritura o borrado ANTES de tocar el archivo. Sin cambio abierto no hace nada. */
export function trackBefore(abs: string): void {
  const c = store.getStore();
  if (!c || c.closed) return;
  const a = path.resolve(abs);
  if (c.files.has(a) || !tracked(c.vaultPath, a)) return;
  c.files.set(a, readRaw(a));
}
export const inChange = () => { const c = store.getStore(); return !!c && !c.closed; };

/** Devuelve todo lo que el cambio en curso ya escribió a como estaba (para «todo o nada»). */
export function rollbackCurrent(): number {
  const c = store.getStore();
  if (!c || c.closed) return 0;
  let n = 0;
  for (const [abs, before] of c.files) {
    const now = readRaw(abs);
    if (now === before) continue;
    if (before === null) { try { fs.unlinkSync(abs); } catch {} } else writeRaw(abs, before);
    n++;
  }
  c.files.clear();
  return n;
}

function writeRaw(abs: string, content: string) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8'); fs.renameSync(tmp, abs);
}

// ---------- Resumen legible de cada archivo ----------
function parseMd(raw: string | null): { fm: Record<string, any>; body: string } | null {
  if (raw === null) return null;
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw };
  try { const fm = YAML.parse(m[1]); return { fm: fm && typeof fm === 'object' ? fm : {}, body: m[2] }; } catch { return { fm: {}, body: raw }; }
}
const STAMP_KEYS = new Set(['updated_at', 'last_updated_at', 'last_updated_by']);
function describe(rel: string, before: string | null, after: string | null): FileChange {
  const op: FileChange['op'] = before === null ? 'creado' : after === null ? 'borrado' : 'cambiado';
  if (rel.startsWith('~')) return { path: rel.slice(1), title: rel === '~agenda.json' ? 'Agenda' : 'Indicadores', op, detail: sideDetail(rel, before, after) };
  const b = parseMd(before), a = parseMd(after);
  const title = String((a || b)?.fm?.title || path.basename(rel, '.md'));
  if (op !== 'cambiado' || !rel.endsWith('.md')) return { path: rel, title, op };
  const keys = new Set([...Object.keys(b!.fm), ...Object.keys(a!.fm)]);
  const fields = [...keys].filter(k => !STAMP_KEYS.has(k) && JSON.stringify(b!.fm[k]) !== JSON.stringify(a!.fm[k]));
  return { path: rel, title, op, fields, body: b!.body.trim() !== a!.body.trim() };
}
function sideDetail(rel: string, before: string | null, after: string | null): string[] {
  const list = (raw: string | null, key: string): any[] => { try { const d = JSON.parse(raw || '{}'); return Array.isArray(d[key]) ? d[key] : []; } catch { return []; } };
  const key = rel === '~agenda.json' ? 'events' : 'kpis';
  const b = new Map(list(before, key).map(x => [x.id, x])), a = new Map(list(after, key).map(x => [x.id, x]));
  const name = (x: any) => key === 'events' ? `${x.title} (${x.date}${x.time ? ' ' + x.time : ''})` : `${x.name}: ${x.value}${x.unit ? ' ' + x.unit : ''}`;
  const out: string[] = [];
  for (const [id, x] of a) { const y = b.get(id); if (!y) out.push(`nuevo: ${name(x)}`); else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(key === 'events' && (x.date !== y.date || x.time !== y.time) ? `movido: ${y.title} de ${y.date}${y.time ? ' ' + y.time : ''} a ${x.date}${x.time ? ' ' + x.time : ''}` : `cambiado: ${name(x)}`); }
  for (const [id, y] of b) if (!a.has(id)) out.push(`quitado: ${name(y)}`);
  return out.slice(0, 20);
}
function summarize(files: FileChange[]): string {
  return files.map(f => {
    if (f.detail?.length) return `${f.title}: ${f.detail.join('; ')}`;
    if (f.op !== 'cambiado') return `${f.title}: ${f.op}`;
    const parts = [...(f.fields || []).slice(0, 8)]; if (f.body) parts.push('texto');
    return `${f.title}: ${parts.length ? parts.join(', ') : 'formato'}`;
  }).join(' · ').slice(0, 1500);
}

// ---------- Abrir y cerrar un cambio ----------
export async function withChange<T>(vaultPath: string, meta: ChangeMeta, fn: () => T | Promise<T>): Promise<{ result: T; entry: JournalEntry | null }> {
  const ctx: Ctx = { vaultPath, meta, files: new Map(), closed: false };
  const result = await store.run(ctx, fn);
  ctx.closed = true;
  let entry: JournalEntry | null = null;
  try { entry = commit(ctx); } catch (e: any) { console.error('[diario] no se pudo registrar el cambio:', e?.message || e); }
  return { result, entry };
}

function newId(now: Date) { return `ch-${now.toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`; }

function commit(ctx: Ctx): JournalEntry | null {
  const snaps: { path: string; before: string | null; after: string | null }[] = [];
  const files: FileChange[] = [];
  for (const [abs, before] of ctx.files) {
    const after = readRaw(abs);
    if (after === before) continue;
    const rel = tracked(ctx.vaultPath, abs)!;
    snaps.push({ path: rel, before, after });
    files.push(describe(rel, before, after));
  }
  if (!files.length) return null;
  const now = new Date();
  const entry: JournalEntry = { id: newId(now), at: now.toISOString(), ...ctx.meta, summary: summarize(files), files };
  writeRaw(snapFile(ctx.vaultPath, entry.id), JSON.stringify({ id: entry.id, files: snaps }));
  appendLine(ctx.vaultPath, entry);
  if (Math.random() < 0.05) pruneSnapshots(ctx.vaultPath, now);
  return entry;
}

function appendLine(vaultPath: string, obj: unknown) {
  const f = logFile(vaultPath);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  try { if (fs.statSync(f).size > MAX_LOG_BYTES) fs.renameSync(f, path.join(dir(vaultPath), `journal-${new Date().toISOString().slice(0, 10)}.jsonl`)); } catch {}
  fs.appendFileSync(f, JSON.stringify(obj) + '\n');
}

export function pruneSnapshots(vaultPath: string, now = new Date()) {
  const d = path.join(dir(vaultPath), 'snap');
  try { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (now.getTime() - fs.statSync(p).mtimeMs > SNAP_DAYS * 86400000) fs.unlinkSync(p); } } catch {}
}

// ---------- Leer ----------
/** Entradas del diario (más nuevas primero), con su estado de deshecho ya aplicado. */
export function readJournal(vaultPath: string, opts: { since?: string; limit?: number } = {}): JournalEntry[] {
  const files = [logFile(vaultPath)];
  try { const archived = fs.readdirSync(dir(vaultPath)).filter(f => /^journal-.*\.jsonl$/.test(f)).sort(); if (archived.length) files.unshift(path.join(dir(vaultPath), archived[archived.length - 1])); } catch {}
  const byId = new Map<string, JournalEntry>();
  for (const f of files) {
    const raw = readRaw(f); if (!raw) continue;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line);
        if (o.type === 'undo') { const e = byId.get(o.id); if (e) { e.undoneAt = o.at; e.undoneBy = o.by; } continue; }
        if (o.id) byId.set(o.id, o);
      } catch {}
    }
  }
  const since = opts.since || '';
  return [...byId.values()].filter(e => e.at >= since).sort((a, b) => b.at.localeCompare(a.at)).slice(0, opts.limit || 200);
}
export const findEntry = (vaultPath: string, id: string) => readJournal(vaultPath, { limit: 100000 }).find(e => e.id === id) || null;

// ---------- Deshacer ----------
export type UndoResult = { ok: true; entry: JournalEntry; undo: JournalEntry | null } | { ok: false; error: string; status: number; changedSince?: string[] };
export async function undoChange(vaultPath: string, id: string, by: ChangeMeta): Promise<UndoResult> {
  const entry = findEntry(vaultPath, id);
  if (!entry) return { ok: false, status: 404, error: 'Ese cambio no está en el diario.' };
  if (entry.undoneAt) return { ok: false, status: 409, error: 'Ese cambio ya se deshizo.' };
  let snap: { files: { path: string; before: string | null; after: string | null }[] };
  try { snap = JSON.parse(fs.readFileSync(snapFile(vaultPath, id), 'utf8')); } catch { return { ok: false, status: 410, error: `La foto de ese cambio ya no existe (se guardan ${SNAP_DAYS} días).` }; }
  const changedSince = snap.files.filter(f => readRaw(absOf(vaultPath, f.path)) !== f.after).map(f => f.path.replace(/^~/, ''));
  if (changedSince.length) return { ok: false, status: 409, error: 'No se puede deshacer: esos archivos cambiaron después. Deshaz primero los cambios más nuevos o corrige a mano.', changedSince };
  const { entry: undo } = await withChange(vaultPath, { ...by, action: 'deshacer', note: id }, () => {
    for (const f of snap.files) {
      const abs = absOf(vaultPath, f.path);
      trackBefore(abs);
      if (f.before === null) { try { fs.unlinkSync(abs); } catch {} } else writeRaw(abs, f.before);
    }
  });
  if (undo) { undo.undoOf = id; }
  appendLine(vaultPath, { type: 'undo', id, at: new Date().toISOString(), by: by.actor, undoId: undo?.id });
  return { ok: true, entry, undo };
}

/** Archivos de la bóveda que cambiaron después de `since` sin pasar por el diario (Obsidian, sincronizaciones). */
export function untrackedSince(vaultPath: string, since: string, entries: JournalEntry[]): { path: string; mtime: string }[] {
  const known = new Set(entries.flatMap(e => e.files.map(f => f.path)));
  const out: { path: string; mtime: string }[] = [];
  const t = Date.parse(since) || 0, v = path.resolve(vaultPath);
  const walk = (d: string) => { let list: fs.Dirent[] = []; try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.md')) { const st = fs.statSync(p); const rel = path.relative(v, p).split(path.sep).join('/'); if (st.mtimeMs > t && !known.has(rel)) out.push({ path: rel, mtime: st.mtime.toISOString() }); } } };
  walk(v);
  return out.sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 100);
}

/** Recibo para devolver junto con la respuesta de una escritura. */
export function receiptOf(e: JournalEntry) {
  return { changeId: e.id, at: e.at, summary: e.summary, files: e.files, undo: { method: 'POST', path: '/api/agent/changes', body: { action: 'undo', changeId: e.id } } };
}

/** `since` admite AAAA-MM-DD (medianoche de Panamá) o una fecha ISO. Por defecto: últimas 24 horas. */
export function parseSince(v: string | null, hoursBack = 24): string {
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T05:00:00Z`).toISOString();
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(Date.now() - hoursBack * 3600_000).toISOString();
}

