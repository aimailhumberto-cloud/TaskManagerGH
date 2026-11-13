/**
 * Aplica una propuesta APROBADA por una persona y permite deshacerla.
 * Solo dos tipos tienen una acción mecánica y sin ambigüedad:
 *   - memoria_de_trabajo_vieja → consolida esa nota a largo plazo.
 *   - sin_verificar            → la marca como verificada (la aprobación de la persona es la confirmación).
 * Los demás tipos (enlace roto, duplicado, aislado, ficha incompleta, seguimiento) piden criterio o contenido:
 * su aprobación solo queda registrada. Solo toca el encabezado de la nota; nunca el texto ni borra archivos.
 */
import * as fs from 'fs';
import * as path from 'path';
import { updateNoteFile, readNoteStrict } from './vaultFiles';
import { ensureDailySnapshot } from './vaultBackup';
import { getSleepDir } from './dotsSleep';

export const APPLICABLE_KINDS = ['memoria_de_trabajo_vieja', 'sin_verificar'] as const;
export const canApply = (kind: string) => (APPLICABLE_KINDS as readonly string[]).includes(kind);
const PROTECTED_STATUS = new Set(['in_review_dots', 'solicitado', 'recibido', 'en_analisis', 'borrador_listo', 'archived']);
const ABSENT = '__ausente__';

export interface AppliedChange { file: string; before: Record<string, unknown>; after: Record<string, unknown> }
export interface AppliedRecord { id: string; kind: string; title?: string; at: string; by?: string; changes: AppliedChange[]; undoneAt?: string }
export type AppliedMap = Record<string, AppliedRecord>;
export interface ApplyNode { id: string; filePath: string }
export type ApplyResult = { ok: true; record: AppliedRecord } | { ok: false; error: string };

const file = (vaultPath: string) => path.join(getSleepDir(vaultPath), 'applied.json');
export function loadApplied(vaultPath: string): AppliedMap { try { return JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')) || {}; } catch { return {}; } }
function saveApplied(vaultPath: string, map: AppliedMap) {
  fs.mkdirSync(path.dirname(file(vaultPath)), { recursive: true });
  const tmp = `${file(vaultPath)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2)); fs.renameSync(tmp, file(vaultPath));
}

/** La nota debe estar dentro de la bóveda: nunca se escribe fuera. */
function inside(vaultPath: string, filePath: string): string | null {
  const root = path.resolve(vaultPath), abs = path.resolve(root, filePath);
  return abs.startsWith(root + path.sep) && abs.endsWith('.md') && fs.existsSync(abs) ? abs : null;
}

function plan(kind: string, fm: Record<string, any>, now: Date, by?: string): Record<string, unknown> | string {
  const iso = now.toISOString();
  if (kind === 'memoria_de_trabajo_vieja') {
    if (fm.memory_tier !== 'working') return 'La nota ya no está en memoria de trabajo.';
    if (PROTECTED_STATUS.has(String(fm.status || ''))) return `La nota tiene una instrucción abierta (${fm.status}); no se consolida.`;
    return { memory_tier: 'long_term', status: 'consolidated', promoted_at: iso, promoted_session: 'aprobacion-informe-nocturno', last_updated_at: iso };
  }
  if (kind === 'sin_verificar') {
    const set: Record<string, unknown> = { verification_status: 'verified', verified_at: iso, verified_by: by || 'HB', last_updated_at: iso };
    if (String(fm.status || '').toLowerCase().includes('pending')) set.status = 'verified';
    return set;
  }
  return 'Este tipo de propuesta no tiene una acción automática; la aprobación queda registrada.';
}

export function applyProposal(vaultPath: string, proposal: { id: string; kind: string; title?: string; nodeIds: string[] }, nodes: ApplyNode[], by?: string, now = new Date()): ApplyResult {
  if (!canApply(proposal.kind)) return { ok: false, error: 'Este tipo de propuesta no tiene una acción automática; la aprobación queda registrada.' };
  const applied = loadApplied(vaultPath);
  if (applied[proposal.id] && !applied[proposal.id].undoneAt) return { ok: false, error: 'Esta propuesta ya se aplicó.' };
  const node = nodes.find(n => n.id === proposal.nodeIds[0]);
  const abs = node && inside(vaultPath, node.filePath);
  if (!abs) return { ok: false, error: 'No se encontró la nota dentro de la bóveda.' };
  // Primero se decide leyendo; si no procede, el archivo no se toca.
  const peek = readNoteStrict(abs);
  if (!peek.ok) return { ok: false, error: `No se pudo leer la nota: ${peek.error}` };
  const pre = plan(proposal.kind, peek.frontmatter, now, by);
  if (typeof pre === 'string') return { ok: false, error: pre };
  const backup = ensureDailySnapshot(vaultPath, now);
  if (backup.error) return { ok: false, error: `No se pudo respaldar antes de cambiar: ${backup.error}. No se modificó nada.` };

  let before: Record<string, unknown> = {}, after: Record<string, unknown> = {}, refused = '';
  const upd = updateNoteFile(abs, (fm) => {
    const p = plan(proposal.kind, fm, now, by);
    if (typeof p === 'string') { refused = p; return; }
    after = p;
    before = Object.fromEntries(Object.keys(p).map(k => [k, k in fm ? fm[k] : ABSENT]));
    Object.assign(fm, p);
  });
  if (refused) return { ok: false, error: refused };
  if (!upd.ok) return { ok: false, error: upd.error };
  const record: AppliedRecord = { id: proposal.id, kind: proposal.kind, title: proposal.title, at: now.toISOString(), by, changes: [{ file: path.relative(path.resolve(vaultPath), abs), before, after }] };
  saveApplied(vaultPath, { ...applied, [proposal.id]: record });
  return { ok: true, record };
}

/** Devuelve cada campo a su valor anterior, solo si nadie lo cambió después. */
export function undoProposal(vaultPath: string, id: string, now = new Date()): ApplyResult {
  const applied = loadApplied(vaultPath);
  const rec = applied[id];
  if (!rec || rec.undoneAt) return { ok: false, error: 'No hay un cambio aplicado que deshacer.' };
  for (const ch of rec.changes) {
    const abs = inside(vaultPath, ch.file);
    if (!abs) return { ok: false, error: 'La nota ya no existe; no se deshizo nada.' };
    let conflict = '';
    const peek = readNoteStrict(abs);
    if (!peek.ok) return { ok: false, error: `No se pudo leer la nota: ${peek.error}` };
    const movedNow = Object.keys(ch.after).find(k => JSON.stringify(peek.frontmatter[k]) !== JSON.stringify(ch.after[k]));
    if (movedNow) return { ok: false, error: `El campo «${movedNow}» cambió después de aplicar; no se deshizo para no pisar ese cambio.` };
    const upd = updateNoteFile(abs, (fm) => {
      const moved = Object.keys(ch.after).find(k => JSON.stringify(fm[k]) !== JSON.stringify(ch.after[k]));
      if (moved) { conflict = `El campo «${moved}» cambió después de aplicar; no se deshizo para no pisar ese cambio.`; return; }
      for (const [k, v] of Object.entries(ch.before)) { if (v === ABSENT) delete fm[k]; else fm[k] = v; }
    });
    if (conflict) return { ok: false, error: conflict };
    if (!upd.ok) return { ok: false, error: upd.error };
  }
  rec.undoneAt = now.toISOString();
  saveApplied(vaultPath, applied);
  return { ok: true, record: rec };
}

export function recentApplied(vaultPath: string, limit = 10) {
  return Object.values(loadApplied(vaultPath)).filter(r => !r.undoneAt).sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
    .map(r => ({ id: r.id, kind: r.kind, title: r.title, at: r.at, by: r.by, file: r.changes[0]?.file }));
}

export function recentAppliedAll(vaultPath: string, limit = 30) {
  return Object.values(loadApplied(vaultPath)).sort((a, b) => (b.undoneAt || b.at).localeCompare(a.undoneAt || a.at)).slice(0, limit)
    .map(r => ({ id: r.id, kind: r.kind, title: r.title, at: r.at, by: r.by, undoneAt: r.undoneAt, file: r.changes[0]?.file }));
}
