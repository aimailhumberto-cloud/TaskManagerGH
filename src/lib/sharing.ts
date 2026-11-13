/**
 * Cerebros que se hablan. Regla única: de un cerebro ajeno solo sale lo que su dueño marcó para compartir.
 *   visibility: public  → lo ve toda la compañía.
 *   visibility: shared + shared_with: [ids] → lo ven solo esos cerebros.
 *   cualquier otra cosa (o nada) → privado: nunca sale.
 * Solo sale título, tipo y un extracto corto. Cada consulta queda registrada.
 */
import * as fs from 'fs';
import * as path from 'path';
import { runInBrain } from './brainContext';
import { loadBrainGraph, getBrainNodeDetail } from './smjBrainService';
import { updateNoteFile } from './vaultFiles';
import { ensureDailySnapshot } from './vaultBackup';
import { dataRoot, listBrains, vaultPathFor, COMPANY_BRAIN_ID, PRIMARY_BRAIN_ID } from './brains';
import { tr } from './reqLang';

export interface SharedNode { brainId: string; owner: string; id: string; title: string; type: string; visibility: string; excerpt: string }
export const visibleTo = (n: { visibility?: string; shared_with?: string[] }, requester: string) =>
  n.visibility === 'public' || (n.visibility === 'shared' && Array.isArray(n.shared_with) && n.shared_with.includes(requester.toLowerCase()));

export function querySharedNodes(requesterBrainId: string, q = '', limit = 50): SharedNode[] {
  const needle = q.trim().toLowerCase().slice(0, 100);
  const out: SharedNode[] = [];
  for (const b of listBrains()) {
    // El de la compañía se consulta entero por su propia vía; el propio no es «ajeno».
    if (!b.exists || b.brainId === requesterBrainId || b.brainId === COMPANY_BRAIN_ID) continue;
    const vaultPath = vaultPathFor(b.brainId); if (!vaultPath) continue;
    const nodes = runInBrain({ brainId: b.brainId, vaultPath, primary: b.brainId === PRIMARY_BRAIN_ID, via: 'consulta-entre-cerebros' }, () => { const g = loadBrainGraph(); return g.allNodes || g.nodes; });
    for (const n of nodes) {
      if (!visibleTo(n, requesterBrainId)) continue;
      if (needle && !(`${n.title} ${n.body}`.toLowerCase().includes(needle))) continue;
      out.push({ brainId: b.brainId, owner: b.owner, id: n.id, title: n.title, type: n.type, visibility: n.visibility as string, excerpt: (n.body || '').replace(/\s+/g, ' ').slice(0, 300) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function logSharedQuery(e: { requester: string; actor?: string; q: string; results: number }) {
  try { const f = path.join(dataRoot(), 'accounts', 'shared-queries.jsonl'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), ...e }) + '\n'); } catch {}
}

/** Cambia la visibilidad de una ficha del cerebro en curso (debe llamarse dentro de ese cerebro). */
export function setVisibility(vaultPath: string, nodeId: string, visibility: string, sharedWith: string[]): { ok: boolean; error?: string } {
  if (!['private', 'shared', 'public'].includes(visibility)) return { ok: false, error: tr('visibility debe ser private, shared o public.', 'visibility must be private, shared or public.') };
  const valid = new Set(listBrains().map(b => b.brainId));
  const targets = visibility === 'shared' ? Array.from(new Set(sharedWith.map(s => String(s).toLowerCase()).filter(s => valid.has(s)))) : [];
  if (visibility === 'shared' && targets.length === 0) return { ok: false, error: tr('Indica al menos un cerebro existente en sharedWith.', 'Give at least one existing brain in sharedWith.') };
  const g = loadBrainGraph(); const node = (g.allNodes || g.nodes).find(n => n.id === nodeId);
  if (!node || !getBrainNodeDetail(nodeId)) return { ok: false, error: tr('Ficha no encontrada en tu cerebro.', 'Note not found in your brain.') };
  const root = path.resolve(vaultPath), abs = path.resolve(node.filePath);
  if (!abs.startsWith(root + path.sep)) return { ok: false, error: tr('Ficha fuera de la bóveda.', 'Note outside the vault.') };
  ensureDailySnapshot(vaultPath);
  const upd = updateNoteFile(abs, (fm) => { fm.visibility = visibility; if (targets.length) fm.shared_with = targets; else delete fm.shared_with; fm.last_updated_at = new Date().toISOString(); });
  return upd.ok ? { ok: true } : { ok: false, error: upd.error };
}
