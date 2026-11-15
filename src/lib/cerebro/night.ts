/**
 * La noche del Cerebro (etapa 5.5): UN solo proceso que corre una vez al día después de las 2 a.m. de Panamá.
 *   1. Avanza los casos que llevan más de 24 horas esperando respuesta (regla de las 24 h; hoy solo corría si alguien visitaba).
 *   2. Pasa lo del día anterior a una sesión en 05-Consolidation-Sessions (una nota, con enlaces a las notas de caso).
 *   3. Audita la estructura: tipos, relaciones y campos fuera de 00-System/estructura.yaml, fichas sueltas, posibles duplicados, datos sin clasificar.
 *   4. Deja el resumen de la mañana (corto) en dots-sleep/night/<día>.json.
 * Solo AVISA: no borra, no mueve, no cambia fichas ni la estructura. Lo único que escribe son la sesión del día y el resumen.
 * La lógica de cada paso es pura (recibe los casos y el grafo) para poder probarla sin red ni modelos.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { serializeNote, readNoteStrict } from '../vaultFiles';
import { panamaDay, panamaHour, getSleepDir } from '../dotsSleep';
import { displayTitle } from '../titles';
import { tw } from '../reqLang';
import { structure, knownFieldsOf, PROTECTED_FIELDS, type Structure } from './structure';
import { NOISE_PATTERN } from './neighborhood';
import type { CerebroRequest } from './engine';

export const NIGHT_HOUR = 2;
const DAY_MS = 86_400_000;
const KEEP_NIGHTS = 30;
/** Cuántos ejemplos se muestran por cada cosa rara (el resto solo se cuenta). */
const EXAMPLES = 5;
/** Tipos que el Cerebro usa por dentro y que no pertenecen a la estructura del negocio. */
const SYSTEM_TYPES = new Set(['core', 'working_memory', 'consolidation_session']);
/** Catálogo: miles de fichas hijas que no necesitan enlace propio. */
const CATALOG_TYPES = new Set(['product_variant', 'flavor', 'packaging', 'catalog_listing']);

const dayOf = (iso?: string): string | null => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? panamaDay(new Date(t)) : null; };
/** El día que resume la noche: el día de Panamá anterior al de la corrida. */
export const coveredDay = (now: Date): string => panamaDay(new Date(now.getTime() - DAY_MS));
const oneLine = (s: string, n: number) => s.replace(/\s+/g, ' ').trim().slice(0, n);
const top = <T extends { n: number }>(a: T[], k = EXAMPLES) => a.sort((x, y) => y.n - x.n).slice(0, k);

// ---------- 1. lo que pasó con los casos ----------
export interface Digest {
  dia: string;
  /** Casos que entraron ese día. */
  entraron: number;
  /** Casos que se cerraron ese día, por cómo terminaron. */
  cerrados: { guardados: number; sinCambios: number; cancelados: number; rechazados: number; fallos: number; otros: number };
  /** De los guardados: los que se guardaron solos y los que aprobó una persona. */
  guardadosSolos: number;
  aprobadosPorPersona: number;
  /** Los que avanzó la regla de las 24 h esa noche. */
  avanzados: string[];
  /** Todo lo que sigue abierto ahora. */
  abiertos: { preguntas: number; esperandoAprobacion: number; esperaMasDe24h: number; esperaPorCategoria: Record<string, number>; masViejoDias: number | null };
  /** Casos que tocaron ese día (abrieron, cerraron o decidieron): van a la sesión. */
  tocados: { id: string; estado: string; texto: string; cat?: string }[];
}

export function digestOf(reqs: CerebroRequest[], day: string, now: Date, avanzados: string[] = []): Digest {
  const cerrados = { guardados: 0, sinCambios: 0, cancelados: 0, rechazados: 0, fallos: 0, otros: 0 };
  let entraron = 0, solos = 0, aprobados = 0;
  const tocados: Digest['tocados'] = [];
  for (const r of reqs) {
    const abrio = dayOf(r.at) === day, cerro = dayOf(r.closedAt) === day, decidio = dayOf(r.decidedAt) === day;
    if (abrio) entraron++;
    if (cerro) {
      if (r.status === 'aplicado' || (r.partial?.saved?.length && r.status !== 'pendiente' && r.status !== 'pregunta')) { cerrados.guardados++; if (r.decidedAt) aprobados++; else solos++; }
      else if (r.status === 'sin_cambios' || r.status === 'respuesta') cerrados.sinCambios++;
      else if (r.status === 'cancelado') cerrados.cancelados++;
      else if (r.status === 'rechazado') cerrados.rechazados++;
      else if (r.status === 'fallo' || r.status === 'no_entendido') cerrados.fallos++;
      else cerrados.otros++;
    }
    if (abrio || cerro || decidio) tocados.push({ id: r.id, estado: r.status, texto: oneLine(r.text, 140), ...(r.esperaCat ? { cat: r.esperaCat } : {}) });
  }
  const esperan = reqs.filter(r => r.status === 'pendiente');
  const porCat: Record<string, number> = {};
  for (const r of esperan) { const c = r.esperaCat || 'sin_categoria'; porCat[c] = (porCat[c] || 0) + 1; }
  const abiertosViejos = reqs.filter(r => (r.status === 'pendiente' || r.status === 'pregunta') && now.getTime() - Date.parse(r.at) > DAY_MS);
  const edades = abiertosViejos.map(r => Math.floor((now.getTime() - Date.parse(r.at)) / DAY_MS));
  return {
    dia: day, entraron, cerrados, guardadosSolos: solos, aprobadosPorPersona: aprobados, avanzados, tocados,
    abiertos: { preguntas: reqs.filter(r => r.status === 'pregunta').length, esperandoAprobacion: esperan.length, esperaMasDe24h: abiertosViejos.length, esperaPorCategoria: porCat, masViejoDias: edades.length ? Math.max(...edades) : null },
  };
}

// ---------- 2. auditoría de la estructura (solo lectura) ----------
export interface AuditNode { id: string; title: string; type: string; frontmatter?: Record<string, any> }
export interface Audit {
  nodos: number;
  tiposFuera: { tipo: string; n: number }[];
  relacionesFuera: { relacion: string; n: number }[];
  camposFuera: { campo: string; n: number }[];
  sinClasificar: { fichas: number; campos: number };
  sueltas: { n: number; ejemplos: string[] };
  duplicados: { n: number; ejemplos: string[] };
  /** Casos viejos que la regla de las 24 h no toca porque son anteriores al formato con «faltan». */
  casosViejosSinFormato: number;
}
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function auditEstructura(nodes: AuditNode[], links: { source: string; target: string }[], s: Structure, reqs: CerebroRequest[] = [], now = new Date()): Audit {
  const tipos = new Map<string, number>(), rels = new Map<string, number>(), campos = new Map<string, number>();
  let sinFichas = 0, sinCampos = 0;
  const known = new Set(Object.keys(s.types)); const declaredText = new Set(s.textFields);
  for (const n of nodes) {
    if (!known.has(n.type) && !SYSTEM_TYPES.has(n.type) && !CATALOG_TYPES.has(n.type)) tipos.set(n.type, (tipos.get(n.type) || 0) + 1);
    const fm = n.frontmatter || {};
    const relObj = fm.relations && typeof fm.relations === 'object' && !Array.isArray(fm.relations) ? fm.relations as Record<string, unknown> : {};
    for (const k of CATALOG_TYPES.has(n.type) ? [] : Object.keys(relObj)) {
      if (k === 'touches' || NOISE_PATTERN.test(k) || s.relations[k] || s.aliases[k]) continue;
      rels.set(k, (rels.get(k) || 0) + 1);
    }
    if (known.has(n.type)) {
      const ok = knownFieldsOf(n.type);
      for (const k of Object.keys(fm)) { if (PROTECTED_FIELDS.has(k) || ok.has(k) || declaredText.has(k)) continue; campos.set(k, (campos.get(k) || 0) + 1); }
    }
    const fs0 = fm.field_sources && typeof fm.field_sources === 'object' ? Object.values(fm.field_sources as Record<string, any>) : [];
    const sc = fs0.filter(e => e && (e as any).clase === 'sin_clasificar').length;
    if (sc) { sinFichas++; sinCampos += sc; }
  }
  const linked = new Set<string>(); for (const l of links) { linked.add(String(l.source)); linked.add(String(l.target)); }
  const sueltas = nodes.filter(n => !SYSTEM_TYPES.has(n.type) && !CATALOG_TYPES.has(n.type) && !linked.has(n.id));
  const groups = new Map<string, AuditNode[]>();
  for (const n of nodes) { if (SYSTEM_TYPES.has(n.type) || CATALOG_TYPES.has(n.type)) continue; const k = `${n.type}|${slug(displayTitle(n.title))}`; if (k.endsWith('|')) continue; (groups.get(k) || groups.set(k, []).get(k)!).push(n); }
  const dups = [...groups.values()].filter(g => g.length > 1);
  return {
    nodos: nodes.length,
    tiposFuera: top([...tipos].map(([tipo, n]) => ({ tipo, n }))),
    relacionesFuera: top([...rels].filter(([, n]) => n >= 2).map(([relacion, n]) => ({ relacion, n }))),
    camposFuera: top([...campos].filter(([, n]) => n >= 3).map(([campo, n]) => ({ campo, n }))),
    sinClasificar: { fichas: sinFichas, campos: sinCampos },
    sueltas: { n: sueltas.length, ejemplos: sueltas.slice(0, EXAMPLES).map(n => oneLine(displayTitle(n.title) || n.id, 60)) },
    duplicados: { n: dups.length, ejemplos: dups.slice(0, EXAMPLES).map(g => g.map(n => n.id).join(' = ')) },
    casosViejosSinFormato: reqs.filter(r => r.status === 'pregunta' && !r.esperaPersona && !Array.isArray(r.faltan) && now.getTime() - Date.parse(r.at) > DAY_MS).length,
  };
}

// ---------- 3. resumen de la mañana y sesión del día ----------
export interface NightSummary {
  corridaEl: string; dia: string; corridaDia: string;
  digest: Digest; auditoria: Audit;
  /** El resumen en palabras, corto, listo para leer. */
  texto: string;
  sesion?: { archivo: string; escrita: boolean; motivo?: string };
  errores: string[];
}

/** «1 caso» / «2 casos»: el resumen se lee en voz alta, así que el plural tiene que estar bien. */
const cnt = (n: number, es1: string, esN: string, en1: string, enN: string) => tw(`${n} ${n === 1 ? es1 : esN}`, `${n} ${n === 1 ? en1 : enN}`);
export function morningText(d: Digest, a: Audit): string {
  const L: string[] = [];
  const c = d.cerrados, o = d.abiertos, no = c.cancelados + c.rechazados;
  L.push(tw(`Ayer (${d.dia}) ${d.entraron === 1 ? 'entró 1 pedido' : `entraron ${d.entraron} pedidos`}. Se guardaron ${c.guardados} (${d.guardadosSolos} ${d.guardadosSolos === 1 ? 'solo' : 'solos'}, ${d.aprobadosPorPersona} aprobados por una persona), ${c.sinCambios} sin cambios, ${no} cancelados o rechazados, ${c.fallos} ${c.fallos === 1 ? 'falló' : 'fallaron'}.`,
    `Yesterday (${d.dia}) ${d.entraron === 1 ? '1 request came in' : `${d.entraron} requests came in`}. ${c.guardados} were saved (${d.guardadosSolos} on their own, ${d.aprobadosPorPersona} approved by a person), ${c.sinCambios} with no changes, ${no} cancelled or rejected, ${c.fallos} failed.`));
  if (d.avanzados.length) L.push(tw(`${d.avanzados.length === 1 ? 'Avanzó solo 1 caso' : `Avanzaron solos ${d.avanzados.length} casos`} de más de 24 h sin respuesta: siguió con lo seguro y lo demás quedó por confirmar.`, `${cnt(d.avanzados.length, '', '', '1 case', `${d.avanzados.length} cases`)} with no answer for over 24 h moved on by itself: it went on with what is certain and the rest stays to confirm.`));
  if (o.esperandoAprobacion || o.preguntas) {
    const cats = Object.entries(o.esperaPorCategoria).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k} ${n}`).join(', ');
    const viejo = o.esperaMasDe24h ? tw(` ${o.esperaMasDe24h === 1 ? 'Uno lleva' : `${o.esperaMasDe24h} llevan`} más de 24 h${o.masViejoDias ? `; el más viejo, ${o.masViejoDias} ${o.masViejoDias === 1 ? 'día' : 'días'}` : ''}.`, ` ${o.esperaMasDe24h === 1 ? 'One has' : `${o.esperaMasDe24h} have`} waited over 24 h${o.masViejoDias ? `; the oldest, ${o.masViejoDias} ${o.masViejoDias === 1 ? 'day' : 'days'}` : ''}.`) : '';
    L.push(tw(`Falta: ${o.esperandoAprobacion} ${o.esperandoAprobacion === 1 ? 'espera' : 'esperan'} tu aprobación${cats ? ` (${cats})` : ''} y ${o.preguntas} ${o.preguntas === 1 ? 'espera' : 'esperan'} una respuesta.`, `Missing: ${o.esperandoAprobacion} ${o.esperandoAprobacion === 1 ? 'waits' : 'wait'} for your approval${cats ? ` (${cats})` : ''} and ${o.preguntas} ${o.preguntas === 1 ? 'waits' : 'wait'} for an answer.`) + viejo);
  } else L.push(tw('No queda nada esperando.', 'Nothing is waiting.'));
  const raro: string[] = [];
  const ex = (x: { n: string; v: number }[]) => x.slice(0, 3).map(i => `${i.n} (${i.v})`).join(', ');
  if (a.duplicados.n) raro.push(tw(`${a.duplicados.n} ${a.duplicados.n === 1 ? 'posible duplicado' : 'posibles duplicados'} (${a.duplicados.ejemplos.slice(0, 2).join('; ')})`, `${a.duplicados.n} possible ${a.duplicados.n === 1 ? 'duplicate' : 'duplicates'} (${a.duplicados.ejemplos.slice(0, 2).join('; ')})`));
  if (a.sueltas.n) raro.push(tw(`${a.sueltas.n} ${a.sueltas.n === 1 ? 'ficha' : 'fichas'} sin ninguna conexión`, `${a.sueltas.n} ${a.sueltas.n === 1 ? 'note' : 'notes'} with no connection`));
  if (a.sinClasificar.campos) raro.push(tw(`${a.sinClasificar.campos} ${a.sinClasificar.campos === 1 ? 'dato sin clasificar' : 'datos sin clasificar'} en ${a.sinClasificar.fichas} ${a.sinClasificar.fichas === 1 ? 'ficha' : 'fichas'}`, `${a.sinClasificar.campos} unclassified data ${a.sinClasificar.campos === 1 ? 'point' : 'points'} in ${a.sinClasificar.fichas} ${a.sinClasificar.fichas === 1 ? 'note' : 'notes'}`));
  if (a.tiposFuera.length) raro.push(tw(`tipos fuera de la estructura: ${ex(a.tiposFuera.map(x => ({ n: x.tipo, v: x.n })))}`, `types outside the structure: ${ex(a.tiposFuera.map(x => ({ n: x.tipo, v: x.n })))}`));
  if (a.relacionesFuera.length) raro.push(tw(`relaciones fuera de la estructura: ${ex(a.relacionesFuera.map(x => ({ n: x.relacion, v: x.n })))}`, `relations outside the structure: ${ex(a.relacionesFuera.map(x => ({ n: x.relacion, v: x.n })))}`));
  if (a.camposFuera.length) raro.push(tw(`campos fuera de la estructura: ${ex(a.camposFuera.map(x => ({ n: x.campo, v: x.n })))}`, `fields outside the structure: ${ex(a.camposFuera.map(x => ({ n: x.campo, v: x.n })))}`));
  if (a.casosViejosSinFormato) raro.push(tw(`${a.casosViejosSinFormato} ${a.casosViejosSinFormato === 1 ? 'caso viejo con pregunta que la regla de 24 h no toca (es anterior' : 'casos viejos con pregunta que la regla de 24 h no toca (son anteriores'} al formato nuevo)`, `${a.casosViejosSinFormato} old ${a.casosViejosSinFormato === 1 ? 'case' : 'cases'} with a question that the 24 h rule does not touch (${a.casosViejosSinFormato === 1 ? 'it predates' : 'they predate'} the new format)`));
  L.push(raro.length ? tw(`Raro: ${raro.join('; ')}. Es solo un aviso: no se cambió nada.`, `Odd: ${raro.join('; ')}. This is only a notice: nothing was changed.`) : tw('Nada raro en la estructura.', 'Nothing odd in the structure.'));
  return L.join('\n');
}

export const sessionFile = (day: string) => `${day} - Sesion del dia (Cerebro).md`;
const CASE_NOTE = (id: string) => `caso-${id}`;

export function sessionBody(d: Digest, a: Audit, summaryText: string): string {
  const H = (es: string, en: string) => `## ${tw(es, en)}`;
  return [
    `# ${tw('Sesión del día', 'Day session')} ${d.dia} (Cerebro)`, '',
    summaryText, '',
    H('Casos del día', 'Cases of the day'),
    ...(d.tocados.length ? d.tocados.map(t => `- [[${CASE_NOTE(t.id)}]] · ${t.estado}${t.cat ? ` (${t.cat})` : ''} — ${t.texto}`) : [`- ${tw('Ninguno.', 'None.')}`]), '',
    ...(d.avanzados.length ? [H('Avanzados por la regla de 24 horas', 'Moved on by the 24-hour rule'), ...d.avanzados.map(id => `- [[${CASE_NOTE(id)}]]`), ''] : []),
    H('Estructura (aviso, sin cambios)', 'Structure (notice, no changes)'),
    `- ${tw('Posibles duplicados', 'Possible duplicates')}: ${a.duplicados.n}${a.duplicados.ejemplos.length ? ` — ${a.duplicados.ejemplos.join('; ')}` : ''}`,
    `- ${tw('Fichas sueltas', 'Loose notes')}: ${a.sueltas.n}${a.sueltas.ejemplos.length ? ` — ${a.sueltas.ejemplos.join('; ')}` : ''}`,
    `- ${tw('Datos sin clasificar', 'Unclassified data')}: ${a.sinClasificar.campos} (${a.sinClasificar.fichas} ${tw('fichas', 'notes')})`,
    `- ${tw('Tipos fuera de la estructura', 'Types outside the structure')}: ${a.tiposFuera.map(x => `${x.tipo} ${x.n}`).join(', ') || '—'}`,
    `- ${tw('Relaciones fuera de la estructura', 'Relations outside the structure')}: ${a.relacionesFuera.map(x => `${x.relacion} ${x.n}`).join(', ') || '—'}`,
    `- ${tw('Campos fuera de la estructura', 'Fields outside the structure')}: ${a.camposFuera.map(x => `${x.campo} ${x.n}`).join(', ') || '—'}`,
    '',
  ].join('\n');
}

/** Escribe la sesión del día. Nunca pisa un archivo que no sea de la noche; si no hubo casos ese día, no escribe nada. */
export function writeSession(vault: string, d: Digest, a: Audit, text: string, now: Date): NonNullable<NightSummary['sesion']> {
  const rel = `05-Consolidation-Sessions/${sessionFile(d.dia)}`;
  if (!d.tocados.length) return { archivo: rel, escrita: false, motivo: 'sin casos ese día' };
  try {
    const dir = path.join(vault, '05-Consolidation-Sessions'); const f = path.join(dir, sessionFile(d.dia));
    if (fs.existsSync(f)) { const old = readNoteStrict(f); if (!old.ok || (old.frontmatter as any)?.generated_by !== 'cerebro-noche') return { archivo: rel, escrita: false, motivo: 'ya existe una nota con ese nombre que no es de la noche' }; }
    const fm = {
      id: `session-cerebro-${d.dia.replace(/-/g, '')}`, title: `${tw('Sesión del día', 'Day session')} ${d.dia} (Cerebro)`, type: 'consolidation_session', memory_tier: 'long_term',
      status: 'closed', source: 'Cerebro (noche)', generated_by: 'cerebro-noche', session_date: d.dia, updated_at: now.toISOString(),
      relations: { touches: d.tocados.map(t => `[[${CASE_NOTE(t.id)}]]`) },
    };
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${f}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, serializeNote(fm, sessionBody(d, a, text)), 'utf-8'); fs.renameSync(tmp, f);
    return { archivo: rel, escrita: true };
  } catch (e: any) { return { archivo: rel, escrita: false, motivo: String(e?.message || e).slice(0, 160) }; }
}

// ---------- 4. la corrida ----------
const nightDir = (vault: string) => path.join(getSleepDir(vault), 'night');
const markerOf = (vault: string, runDay: string) => path.join(nightDir(vault), `${runDay}.json`);

/** ¿Toca la noche? Después de las 2 a.m. de Panamá y si no corrió ya hoy. */
export function needsNight(vault: string, now = new Date()): boolean {
  if (panamaHour(now) < NIGHT_HOUR) return false;
  return !fs.existsSync(markerOf(vault, panamaDay(now)));
}
export function latestNight(vault: string): NightSummary | null {
  try {
    const f = fs.readdirSync(nightDir(vault)).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse()[0];
    return f ? JSON.parse(fs.readFileSync(path.join(nightDir(vault), f), 'utf-8')) as NightSummary : null;
  } catch { return null; }
}

export interface NightDeps {
  /** Los casos, leídos DESPUÉS de avanzar. */
  listRequests: () => CerebroRequest[];
  /** La regla de 24 h: devuelve los casos que avanzó. Sin esto no se avanza nada (por ejemplo, un cerebro de solo lectura). */
  advance?: () => Promise<string[]>;
  graph: () => { nodes: AuditNode[]; links: { source: string; target: string }[] };
  /** Un cerebro de solo lectura no escribe ni la sesión. */
  readOnly?: boolean;
}

export async function runNight(vault: string, deps: NightDeps, now = new Date()): Promise<NightSummary> {
  const errores: string[] = [];
  let avanzados: string[] = [];
  if (deps.advance && !deps.readOnly) { try { avanzados = await deps.advance(); } catch (e: any) { errores.push(`avance: ${String(e?.message || e).slice(0, 160)}`); } }
  const day = coveredDay(now);
  let reqs: CerebroRequest[] = []; let g: ReturnType<NightDeps['graph']> = { nodes: [], links: [] };
  try { reqs = deps.listRequests(); } catch (e: any) { errores.push(`casos: ${String(e?.message || e).slice(0, 160)}`); }
  try { g = deps.graph(); } catch (e: any) { errores.push(`grafo: ${String(e?.message || e).slice(0, 160)}`); }
  const digest = digestOf(reqs, day, now, avanzados);
  const auditoria = auditEstructura(g.nodes, g.links, structure(), reqs, now);
  const texto = morningText(digest, auditoria);
  const sesion = deps.readOnly ? { archivo: `05-Consolidation-Sessions/${sessionFile(day)}`, escrita: false, motivo: 'cerebro de solo lectura' } : writeSession(vault, digest, auditoria, texto, now);
  const summary: NightSummary = { corridaEl: now.toISOString(), dia: day, corridaDia: panamaDay(now), digest, auditoria, texto, sesion, errores };
  try {
    fs.mkdirSync(nightDir(vault), { recursive: true });
    const f = markerOf(vault, summary.corridaDia); const tmp = `${f}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(summary, null, 2), 'utf-8'); fs.renameSync(tmp, f);
    for (const old of fs.readdirSync(nightDir(vault)).filter(x => /^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse().slice(KEEP_NIGHTS)) { try { fs.unlinkSync(path.join(nightDir(vault), old)); } catch {} }
  } catch (e: any) { summary.errores.push(`resumen: ${String(e?.message || e).slice(0, 160)}`); }
  return summary;
}
