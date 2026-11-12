import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Ciclo nocturno de DOTS en modo SOLO PROPUESTAS.
 *
 * Revisa el cerebro (solo lectura) y deja un informe con cosas que conviene atender:
 * memoria de trabajo vieja, seguimientos vencidos, enlaces rotos, posibles duplicados,
 * nodos aislados, fichas incompletas y datos sin verificar.
 *
 * NO modifica ninguna nota del vault. Las decisiones (aprobar / rechazar / posponer) solo
 * se registran en un archivo aparte; aplicar cambios queda para un paso posterior que HB autorice.
 * El informe y las decisiones viven fuera del vault (carpeta hermana `dots-sleep`), para no
 * ensuciar el grafo ni los respaldos de notas.
 */

export type SleepKind =
  | 'memoria_de_trabajo_vieja'
  | 'seguimiento_vencido'
  | 'enlace_roto'
  | 'posible_duplicado'
  | 'nodo_aislado'
  | 'ficha_incompleta'
  | 'sin_verificar';

export type Severity = 'alta' | 'media' | 'baja';
export type Decision = 'aprobada' | 'rechazada' | 'pospuesta';

export interface SleepProposal {
  id: string;
  kind: SleepKind;
  severity: Severity;
  title: string;
  reason: string;
  suggestion: string;
  nodeIds: string[];
}

export interface SleepInputNode {
  id: string;
  title: string;
  type: string;
  memory_tier?: string;
  status?: string;
  completeness_score?: number;
  links?: string[];
  frontmatter?: Record<string, any>;
}
export interface SleepInputLink { source: string; target: string }

export interface SleepReport {
  generatedAt: string;
  day: string; // YYYY-MM-DD hora de Panamá
  nodeCount: number;
  linkCount: number;
  mode: 'solo_propuestas';
  counts: Record<string, number>;
  proposals: SleepProposal[];
}

export interface DecisionRecord { decision: Decision; decidedAt: string; decidedBy?: string; note?: string }
export type DecisionMap = Record<string, DecisionRecord>;

export const STALE_WORKING_DAYS = 3;
export const INCOMPLETE_BELOW = 50;
const POSTPONE_DAYS = 7;

const SEVERITY_ORDER: Record<Severity, number> = { alta: 0, media: 1, baja: 2 };

export function panamaDay(now: Date): string {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function panamaHour(now: Date): number {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).getUTCHours();
}

function proposalId(kind: SleepKind, key: string): string {
  return crypto.createHash('sha1').update(`${kind}|${key}`).digest('hex').slice(0, 12);
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.floor((Date.parse(toDay + 'T00:00:00Z') - Date.parse(fromDay + 'T00:00:00Z')) / 86400000);
}

/** Fecha (YYYY-MM-DD, hora de Panamá) en que se capturó una nota de trabajo, si se puede saber. */
function capturedDay(n: SleepInputNode): string | null {
  const fm = n.frontmatter || {};
  for (const k of ['captured_at', 'captured', 'created_at', 'created', 'updated_at', 'last_updated_at']) {
    const v = fm[k];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v.slice(0, 10) : panamaDay(d);
    }
  }
  const m = n.id.match(/(20\d{2})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function normTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/^(person|brand|market|distributor|role|dept|department|customer|site|channel)\s*:\s*/i, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const noTouchTypes = new Set(['core', 'consolidation_session']);

export function buildSleepReport(
  nodes: SleepInputNode[],
  links: SleepInputLink[],
  now: Date,
): SleepReport {
  const day = panamaDay(now);
  const out: SleepProposal[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const label = (n: SleepInputNode) => n.title || n.id;

  // 1. Memoria de trabajo que lleva días sin consolidarse
  for (const n of nodes) {
    if (n.memory_tier !== 'working') continue;
    const d = capturedDay(n);
    if (!d) {
      out.push({
        id: proposalId('memoria_de_trabajo_vieja', n.id), kind: 'memoria_de_trabajo_vieja', severity: 'baja',
        title: `Memoria de trabajo sin fecha: ${label(n)}`,
        reason: 'La nota está en memoria de trabajo y no se puede saber desde cuándo.',
        suggestion: 'Revisar la nota y decidir si se consolida a largo plazo o se descarta.', nodeIds: [n.id],
      });
      continue;
    }
    const age = daysBetween(d, day);
    if (age >= STALE_WORKING_DAYS) {
      out.push({
        id: proposalId('memoria_de_trabajo_vieja', n.id), kind: 'memoria_de_trabajo_vieja',
        severity: age >= 7 ? 'media' : 'baja',
        title: `Consolidar memoria de trabajo: ${label(n)}`,
        reason: `Lleva ${age} días en memoria de trabajo (capturada el ${d}).`,
        suggestion: 'Consolidarla a largo plazo si ya tiene lo necesario, o cerrarla si dejó de aplicar.', nodeIds: [n.id],
      });
    }
  }

  // 2. Seguimientos vencidos
  for (const n of nodes) {
    const f = n.frontmatter?.next_followup_date;
    if (typeof f !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(f)) continue;
    const late = daysBetween(f.slice(0, 10), day);
    if (late > 0) {
      const action = n.frontmatter?.next_followup_action;
      out.push({
        id: proposalId('seguimiento_vencido', `${n.id}|${f.slice(0, 10)}`), kind: 'seguimiento_vencido',
        severity: late >= 7 ? 'alta' : 'media',
        title: `Seguimiento vencido: ${label(n)}`,
        reason: `El seguimiento estaba para el ${f.slice(0, 10)} (hace ${late} día${late === 1 ? '' : 's'})${action ? `: ${String(action).slice(0, 120)}` : '.'}`,
        suggestion: 'Hacer el seguimiento o reprogramarlo con una fecha nueva.', nodeIds: [n.id],
      });
    }
  }

  // 3. Enlaces rotos: apuntan a algo que no existe (misma regla que el panel de salud del mapa)
  const ids = new Set(nodes.map((n) => n.id.toLowerCase()));
  const titles = new Set(nodes.map((n) => normTitle(n.title)));
  const broken = new Map<string, Set<string>>();
  for (const l of links) {
    const target = String(l.target || '').toLowerCase();
    if (!target || ids.has(target) || titles.has(normTitle(target))) continue;
    if (!broken.has(target)) broken.set(target, new Set());
    broken.get(target)!.add(l.source);
  }
  for (const [target, sources] of broken) {
    const src = [...sources];
    out.push({
      id: proposalId('enlace_roto', target), kind: 'enlace_roto', severity: 'media',
      title: `Enlace roto hacia «${target}»`,
      reason: `${src.length} nota${src.length === 1 ? '' : 's'} apunta${src.length === 1 ? '' : 'n'} a algo que no existe en el cerebro.`,
      suggestion: 'Crear la ficha que falta o corregir el nombre del enlace.', nodeIds: src.slice(0, 10),
    });
  }

  // 4. Posibles duplicados: mismo nombre normalizado y mismo tipo
  const groups = new Map<string, SleepInputNode[]>();
  for (const n of nodes) {
    if (noTouchTypes.has(n.type) || n.type === 'working_memory') continue;
    const k = `${n.type}|${normTitle(n.title)}`;
    if (!normTitle(n.title)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(n);
  }
  for (const [k, g] of groups) {
    if (g.length < 2) continue;
    out.push({
      id: proposalId('posible_duplicado', g.map((x) => x.id).sort().join(',')), kind: 'posible_duplicado', severity: 'media',
      title: `Posible duplicado: ${label(g[0])}`,
      reason: `${g.length} fichas del mismo tipo (${g[0].type}) tienen el mismo nombre: ${g.map((x) => x.id).join(', ')}.`,
      suggestion: 'Revisar si son la misma entidad y, de serlo, unir en una sola ficha.', nodeIds: g.map((x) => x.id),
    });
    void k;
  }

  // 5. Nodos aislados: sin ningún enlace de entrada ni de salida
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
  }
  const isolated = nodes.filter((n) => !noTouchTypes.has(n.type) && !(degree.get(n.id) || 0) && !(n.links || []).length);
  if (isolated.length) {
    out.push({
      id: proposalId('nodo_aislado', 'lote'), kind: 'nodo_aislado', severity: 'baja',
      title: `${isolated.length} ficha${isolated.length === 1 ? '' : 's'} sin ninguna conexión`,
      reason: 'No tienen enlaces de entrada ni de salida, así que no aparecen conectadas en el mapa.',
      suggestion: 'Conectarlas a su marca, mercado o área, o archivarlas si ya no aplican.', nodeIds: isolated.slice(0, 25).map((n) => n.id),
    });
  }

  // 6. Fichas incompletas (solo las que declaran su puntaje)
  for (const n of nodes) {
    const s = n.completeness_score ?? n.frontmatter?.completeness_score;
    if (typeof s === 'number' && s < INCOMPLETE_BELOW) {
      out.push({
        id: proposalId('ficha_incompleta', n.id), kind: 'ficha_incompleta', severity: 'baja',
        title: `Ficha incompleta (${s}%): ${label(n)}`,
        reason: `Su puntaje de completitud es ${s}%, por debajo de ${INCOMPLETE_BELOW}%.`,
        suggestion: 'Pedirle a DOTS que complete los datos que faltan.', nodeIds: [n.id],
      });
    }
  }

  // 7. Datos sin verificar
  const unverified = nodes.filter((n) => {
    const st = String(n.status || '').toLowerCase();
    const vs = String(n.frontmatter?.verification_status || '').toLowerCase();
    return st.includes('pending') || vs.includes('pending') || vs.includes('unverified') || vs.includes('sin_verificar');
  });
  for (const n of unverified) {
    out.push({
      id: proposalId('sin_verificar', n.id), kind: 'sin_verificar', severity: 'baja',
      title: `Dato sin verificar: ${label(n)}`,
      reason: `Su estado indica que falta validar la fuente (${n.status || n.frontmatter?.verification_status}).`,
      suggestion: 'Confirmar con la fuente y marcarla como verificada, o corregirla.', nodeIds: [n.id],
    });
  }

  // un mismo id no se repite
  const seen = new Set<string>();
  const proposals = out
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));

  const counts: Record<string, number> = {};
  for (const p of proposals) counts[p.kind] = (counts[p.kind] || 0) + 1;
  void byId;

  return {
    generatedAt: now.toISOString(), day, nodeCount: nodes.length, linkCount: links.length,
    mode: 'solo_propuestas', counts, proposals,
  };
}

/** Quita lo rechazado y lo pospuesto (por ahora) y marca lo ya aprobado. */
export function applyDecisions(report: SleepReport, decisions: DecisionMap, now: Date) {
  const open: (SleepProposal & { decision?: DecisionRecord })[] = [];
  let rejected = 0, postponed = 0, approved = 0;
  for (const p of report.proposals) {
    const d = decisions[p.id];
    if (!d) { open.push(p); continue; }
    if (d.decision === 'rechazada') { rejected++; continue; }
    if (d.decision === 'pospuesta') {
      const ageDays = (now.getTime() - Date.parse(d.decidedAt)) / 86400000;
      if (ageDays < POSTPONE_DAYS) { postponed++; continue; }
      open.push(p); continue;
    }
    approved++;
    open.push({ ...p, decision: d });
  }
  return { ...report, proposals: open, hidden: { rechazadas: rejected, pospuestas: postponed }, approved };
}

// ---------- Almacenamiento (fuera del vault) ----------

export function getSleepDir(vaultPath: string): string {
  return path.join(path.dirname(path.resolve(vaultPath)), 'dots-sleep');
}

function writeJsonAtomic(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | null {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return null; }
}

export const KEEP_REPORTS = 30;

export function saveReport(vaultPath: string, report: SleepReport) {
  const dir = path.join(getSleepDir(vaultPath), 'reports');
  writeJsonAtomic(path.join(dir, `${report.day}.json`), report);
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
  for (const old of files.slice(KEEP_REPORTS)) { try { fs.unlinkSync(path.join(dir, old)); } catch {} }
}

export function loadLatestReport(vaultPath: string): SleepReport | null {
  const dir = path.join(getSleepDir(vaultPath), 'reports');
  let files: string[] = [];
  try { files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse(); } catch { return null; }
  return files.length ? readJson<SleepReport>(path.join(dir, files[0])) : null;
}

export function listReportDays(vaultPath: string): string[] {
  const dir = path.join(getSleepDir(vaultPath), 'reports');
  try { return fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort().reverse(); } catch { return []; }
}

export function loadDecisions(vaultPath: string): DecisionMap {
  return readJson<DecisionMap>(path.join(getSleepDir(vaultPath), 'decisions.json')) || {};
}

export function recordDecision(vaultPath: string, id: string, decision: Decision, by?: string, note?: string, now = new Date()): DecisionRecord {
  const all = loadDecisions(vaultPath);
  const rec: DecisionRecord = { decision, decidedAt: now.toISOString(), ...(by ? { decidedBy: by } : {}), ...(note ? { note: note.slice(0, 500) } : {}) };
  all[id] = rec;
  writeJsonAtomic(path.join(getSleepDir(vaultPath), 'decisions.json'), all);
  return rec;
}

/** Corre el ciclo: lee el grafo (solo lectura), arma el informe y lo guarda. */
export function runSleepCycle(
  vaultPath: string,
  graph: { nodes: SleepInputNode[]; links: SleepInputLink[] },
  now = new Date(),
): SleepReport {
  const report = buildSleepReport(graph.nodes, graph.links, now);
  saveReport(vaultPath, report);
  return report;
}

/** Hora (Panamá) a partir de la cual toca el informe del día. */
export const NIGHTLY_HOUR = 2;

export function needsNightlyReport(vaultPath: string, now = new Date()): boolean {
  if (panamaHour(now) < NIGHTLY_HOUR) return false;
  const latest = listReportDays(vaultPath)[0];
  return latest !== panamaDay(now);
}
