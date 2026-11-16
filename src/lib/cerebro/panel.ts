/**
 * Lo que el tablero de inicio muestra del Cerebro: qué pasó anoche, dónde hubo movimiento y qué necesita atención.
 * Solo lectura: lee el resumen de la noche, el diario de cambios y los casos. No decide ni escribe nada.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getSleepDir } from '../dotsSleep';
import { displayTitle } from '../titles';
import type { JournalEntry } from '../journal';
import type { CerebroRequest } from './engine';
import type { NightSummary } from './night';

const DAY = 86_400_000;
const nightDir = (vault: string) => path.join(getSleepDir(vault), 'night');

/** Qué hizo el Cerebro cada noche que corrió (por el día en que corrió): casos que avanzó y si dejó la sesión del día. */
export function nightDays(vault: string): Record<string, { avanzados: number; sesion: boolean }> {
  const out: Record<string, { avanzados: number; sesion: boolean }> = {};
  try {
    for (const f of fs.readdirSync(nightDir(vault))) {
      if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
      try { const n = JSON.parse(fs.readFileSync(path.join(nightDir(vault), f), 'utf-8')) as NightSummary; out[f.slice(0, 10)] = { avanzados: n.digest?.avanzados?.length || 0, sesion: !!n.sesion?.escrita }; } catch {}
    }
  } catch {}
  return out;
}

/** Cuánto «ordenó» el Cerebro esa noche: lo que avanzó solo más la sesión del día. Si corrió y no había nada que hacer, es 0. */
export const nightWork = (n: { avanzados: number; sesion: boolean }) => n.avanzados + (n.sesion ? 1 : 0);

export interface NightCard {
  /** El día que cubre (ayer respecto a la corrida) y cuándo corrió. */
  dia: string; corridaEl: string;
  entraron: number; guardados: number; solos: number; aprobados: number; avanzados: number;
  preguntas: number; porAprobar: number; masViejoDias: number | null;
  sueltas: number; duplicados: number; fueraDeEstructura: number;
  /** El texto completo (el mismo que lee un agente con «manana»), para «ver detalle». */
  texto: string;
}
/** El resumen de la noche en números, para una línea corta. */
export function nightCard(n: NightSummary | null): NightCard | null {
  if (!n || !n.digest) return null;
  const d = n.digest, a = n.auditoria;
  return {
    dia: n.dia, corridaEl: n.corridaEl,
    entraron: d.entraron, guardados: d.cerrados?.guardados || 0, solos: d.guardadosSolos || 0, aprobados: d.aprobadosPorPersona || 0, avanzados: d.avanzados?.length || 0,
    preguntas: d.abiertos?.preguntas || 0, porAprobar: d.abiertos?.esperandoAprobacion || 0, masViejoDias: d.abiertos?.masViejoDias ?? null,
    sueltas: a?.sueltas?.n || 0, duplicados: a?.duplicados?.n || 0,
    fueraDeEstructura: (a?.tiposFuera?.length || 0) + (a?.relacionesFuera?.length || 0) + (a?.camposFuera?.length || 0),
    texto: n.texto || '',
  };
}

export interface Moved { id: string; name: string; type: string; value: number }
/**
 * Las fichas que más cambiaron en el periodo, según el diario. Un cambio deshecho no cuenta, ni el propio deshacer;
 * las notas de trabajo y las sesiones (mantenimiento del Cerebro) tampoco: lo que interesa es el negocio.
 */
export function movedNotes(entries: JournalEntry[], nodes: { id: string; title: string; type?: string; filePath?: string }[], vault: string, fromDay: string, limit = 5): Moved[] {
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  const byPath = new Map<string, { id: string; title: string; type?: string }>();
  for (const n of nodes) if (n.filePath) byPath.set(norm(path.isAbsolute(n.filePath) ? path.relative(vault, n.filePath) : n.filePath), n);
  const count = new Map<string, Moved>();
  for (const e of entries) {
    if (e.undoneAt || e.undoOf || !e.at || e.at.slice(0, 10) < fromDay) continue;
    const seen = new Set<string>();
    for (const f of e.files || []) {
      if (f.op === 'borrado') continue;
      const n = byPath.get(norm(f.path)); if (!n || seen.has(n.id)) continue; seen.add(n.id);
      if (n.type === 'working_memory' || n.type === 'consolidation_session') continue;
      const cur = count.get(n.id) || { id: n.id, name: displayTitle(n.title), type: n.type || '', value: 0 }; cur.value++; count.set(n.id, cur);
    }
  }
  return [...count.values()].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, limit);
}

export interface Attention { porAprobar: number; preguntas: number; masViejoDias: number | null; masViejo?: string }
/** Lo que espera a una persona ahora mismo: propuestas por aprobar y preguntas sin respuesta, con la más vieja. */
export function attention(reqs: CerebroRequest[], now = new Date()): Attention {
  const open = reqs.filter(r => r.status === 'pendiente' || r.status === 'pregunta');
  const oldest = open.slice().sort((a, b) => a.at.localeCompare(b.at))[0];
  return {
    porAprobar: open.filter(r => r.status === 'pendiente').length, preguntas: open.filter(r => r.status === 'pregunta').length,
    masViejoDias: oldest ? Math.max(0, Math.floor((now.getTime() - Date.parse(oldest.at)) / DAY)) : null,
    ...(oldest ? { masViejo: oldest.text.replace(/\s+/g, ' ').trim().slice(0, 90) } : {}),
  };
}
