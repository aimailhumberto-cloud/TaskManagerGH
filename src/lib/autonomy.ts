/**
 * Modo automático (decisión de HB, 2026-11-12): Jev y el agente trabajan solos y HB revisa después en el registro.
 * Jev aplica sin pedir aprobación lo que es mecánico y reversible, cuando su confianza supera el umbral.
 * Nunca automático: marcar un dato como verificado (eso afirma que alguien confirmó la fuente), borrar o fusionar.
 * Todo queda en el registro y se puede deshacer.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSleepDir, recordDecision, loadDecisions } from './dotsSleep';
import { applyProposal, type ApplyNode } from './sleepApply';
import type { AiReviewMap } from './decisionEngine';

export const AUTO_KINDS = ['memoria_de_trabajo_vieja', 'clasificar_captura'];
export const AUTO_ACTOR = 'Jev (automático)';
export interface Autonomy { mode: 'auto' | 'proponer'; threshold: number }

const file = (vaultPath: string) => path.join(getSleepDir(vaultPath), 'autonomy.json');
export function loadAutonomy(vaultPath: string): Autonomy {
  const def: Autonomy = { mode: process.env.JEV_AUTONOMY === 'proponer' ? 'proponer' : 'auto', threshold: 0.85 };
  try {
    const d = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8'));
    return { mode: d.mode === 'proponer' ? 'proponer' : d.mode === 'auto' ? 'auto' : def.mode, threshold: typeof d.threshold === 'number' && d.threshold >= 0.5 && d.threshold <= 1 ? d.threshold : def.threshold };
  } catch { return def; }
}
export function saveAutonomy(vaultPath: string, a: Partial<Autonomy>): Autonomy {
  const next = { ...loadAutonomy(vaultPath), ...(a.mode === 'auto' || a.mode === 'proponer' ? { mode: a.mode } : {}), ...(typeof a.threshold === 'number' && a.threshold >= 0.5 && a.threshold <= 1 ? { threshold: a.threshold } : {}) };
  fs.mkdirSync(path.dirname(file(vaultPath)), { recursive: true });
  fs.writeFileSync(file(vaultPath), JSON.stringify(next, null, 2));
  return next;
}

export interface AutoResult { applied: { id: string; title?: string }[]; skipped: number; errors: string[] }
export function autoApply(vaultPath: string, proposals: { id: string; kind: string; title?: string; nodeIds: string[] }[], reviews: AiReviewMap, nodes: ApplyNode[], now = new Date()): AutoResult {
  const out: AutoResult = { applied: [], skipped: 0, errors: [] };
  const a = loadAutonomy(vaultPath);
  if (a.mode !== 'auto') return out;
  const decided = loadDecisions(vaultPath);
  for (const p of proposals) {
    const conf = reviews[p.id]?.apply;
    if (!AUTO_KINDS.includes(p.kind) || decided[p.id] || typeof conf !== 'number' || conf < a.threshold) { out.skipped++; continue; }
    const r = applyProposal(vaultPath, p, nodes, AUTO_ACTOR, now);
    if (!r.ok) { out.errors.push(`${p.title || p.id}: ${r.error}`); continue; }
    recordDecision(vaultPath, p.id, 'aprobada', AUTO_ACTOR, `Aplicada sola con confianza ${Math.round(conf * 100)} %`, now);
    out.applied.push({ id: p.id, title: p.title });
  }
  return out;
}

// ---------- Registro de actividad de agentes (quién escribió qué, sin contenido) ----------
const activityFile = (vaultPath: string) => path.join(getSleepDir(vaultPath), 'activity.jsonl');
export function logActivity(vaultPath: string, e: { actor: string; via?: string; path: string; action?: string; status: number; blocked?: boolean }) {
  try { fs.mkdirSync(getSleepDir(vaultPath), { recursive: true }); fs.appendFileSync(activityFile(vaultPath), JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n'); } catch {}
}
export function recentActivity(vaultPath: string, limit = 30): Record<string, unknown>[] {
  try {
    const lines = fs.readFileSync(activityFile(vaultPath), 'utf8').trim().split('\n');
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter((e: any) => e && !e.blocked).slice(-limit).reverse() as Record<string, unknown>[];
  } catch { return []; }
}

/** Intentos de escribir por la puerta directa que la regla de pedir y consultar frenó (para ver qué le falta al Cerebro). */
export function blockedAttempts(vaultPath: string, days = 7, now = Date.now()): { count: number; recent: Record<string, unknown>[]; byDoor: { door: string; count: number }[] } {
  let all: Record<string, any>[] = [];
  try { all = fs.readFileSync(activityFile(vaultPath), 'utf8').trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { /* sin registro */ }
  const hits = all.filter(e => e.blocked && now - Date.parse(e.at) <= days * 86400000);
  const by = new Map<string, number>(); for (const e of hits) { const d = `${String(e.path).replace('/api/agent/', '')}${e.action ? ' · ' + e.action : ''}`; by.set(d, (by.get(d) || 0) + 1); }
  return { count: hits.length, recent: hits.slice(-8).reverse(), byDoor: [...by].map(([door, count]) => ({ door, count })).sort((a, b) => b.count - a.count).slice(0, 8) };
}
