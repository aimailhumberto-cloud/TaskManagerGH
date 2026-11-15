/**
 * Observaciones y bandeja «Por revisar» (fase 3b, parte D).
 * La app revisa con reglas exactas lo que se puede contar y comparar (duplicados, choques de agenda, datos que
 * faltan, cambios a fichas verificadas). Jev aporta el juicio (¿el plan refleja el pedido?, ¿contradice la ficha?).
 * Nada de aquí bloquea por sí solo: los avisos «fuertes» mandan el pedido a aprobación; el resto queda por revisar.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getUnifiedBrainTasks, getVaultPath, loadBrainGraph, type BrainNode } from '../smjBrainService';
import { listEvents } from '../agenda';
import { displayTitle, norm, words, nameAmbiguities, peopleMentioned } from '../brainLens';
import { getPanamaDate } from '../smjBrainService';
import { cerebroDir } from './settings';
import { createdIdOf, linked, eventTitle, type Op } from './ops';
import { knownFieldsOf } from './structure';
import { tr } from '../reqLang';

export interface Observations {
  /** Lo que el modelo dijo que supuso. */
  supuso: string[];
  /** Avisos que mandan el pedido a aprobación (posible duplicado, cambia un dato verificado). */
  fuertes: string[];
  /** Avisos que no bloquean (choque de agenda, posible contradicción). */
  avisos: string[];
  /** Datos que faltan en las fichas tocadas. */
  falta: string[];
  jev?: { fiel: number | null; coherente?: number | null; error?: string; motivo?: string };
}
export interface ReviewItem { id: string; at: string; requestId?: string; kind: 'falta' | 'aviso'; text: string; nodeId?: string; closedAt?: string; closedBy?: string }

const overlap = (a: string, b: string) => { const A = new Set(words(a)), B = new Set(words(b)); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.min(A.size, B.size); };
const nodesById = () => new Map((loadBrainGraph().allNodes || []).map(n => [n.id, n] as [string, BrainNode]));

/** Revisión exacta del plan ANTES de aplicar. */
/** Todos los ids de fichas a los que apunta el plan (principal, con, desde, hacia, conexiones). */
const refsOf = (ops: Op[]): Set<string> => new Set(ops.flatMap(op => { const a = op.args || {}; return [a.ficha, a.desde, a.hacia, ...linked(a), ...(Array.isArray(a.conectar_con) ? a.conectar_con.map((c: any) => c?.hacia) : []), createdIdOf(op)]; }).filter(Boolean).map(String));
/**
 * Si el pedido nombra a una persona que el plan no menciona y hay UNA sola reunión en el plan, la persona se añade a «con».
 * Devuelve lo que añadió, en palabras (el modelo omitió algo que el pedido decía claramente).
 */
export function completeMeetings(ops: Op[], text: string): string[] {
  const meets = ops.filter(o => o.name === 'agendar'); if (meets.length !== 1) return [];
  let people: { id: string; title: string }[] = []; try { people = peopleMentioned(text); } catch { return []; }
  const have = refsOf(ops); const add = people.filter(p => !have.has(p.id) && !!nodesById().get(p.id)); if (!add.length) return [];
  const a = meets[0].args; const con = Array.isArray(a.con) ? [...a.con] : typeof a.con === 'string' && a.con ? a.con.split(/[,;]\s*/) : [];
  a.con = [...con, ...add.map(p => p.id)];
  return [tr(`Añadí a ${add.map(p => p.title).join(', ')} a la reunión porque el pedido lo nombra.`, `I added ${add.map(p => p.title).join(', ')} to the meeting because the request names them.`)];
}

const titleOf = (id: string) => { const n = nodesById().get(id); return n ? displayTitle(n.title) : id; };
/**
 * No inventa: en una agenda solo quedan las personas y empresas que el pedido nombra.
 * En un viaje, «con» solo lleva personas (nunca ciudades ni mercados). Devuelve lo que quitó, en palabras.
 */
export function pruneUnnamed(ops: Op[], text: string): string[] {
  const out: string[] = []; const tw_ = new Set(words(text)); const nt = ' ' + words(text).join(' ') + ' ';
  const named = (id: string) => { if (nt.includes(' ' + id.toLowerCase() + ' ') || text.includes(id)) return true; const n = nodesById().get(id); if (!n) return true; const ws = words(displayTitle(n.title)).filter(w => w.length >= 4); return ws.some(w => tw_.has(w)) && (n.type === 'person' ? true : ws.filter(w => tw_.has(w)).length * 2 >= ws.length); };
  for (const op of ops) {
    if (op.name !== 'agendar') continue; const a = op.args; const con: string[] = Array.isArray(a.con) ? a.con.map(String) : typeof a.con === 'string' && a.con ? a.con.split(/[,;]\s*/) : [];
    if (!con.length) continue;
    const drop = con.filter(id => { const n = nodesById().get(id); if (!n) return false; if (a.tipo === 'viaje' && n.type !== 'person') return true; return !named(id); });
    if (!drop.length) continue;
    a.con = con.filter(id => !drop.includes(id));
    out.push(tr(`Quité ${drop.map(titleOf).join(', ')} de «${a.titulo}» porque el pedido no lo nombra como participante.`, `I removed ${drop.map(titleOf).join(', ')} from “${a.titulo}” because the request does not name them as a participant.`));
  }
  return out;
}
const AIRLINES = ['Copa', 'American', 'Delta', 'United', 'Avianca', 'Air Canada', 'Iberia', 'KLM', 'LATAM', 'Spirit', 'JetBlue', 'Southwest', 'Air France', 'Lufthansa', 'Emirates', 'Aeromexico', 'Volaris', 'Wingo'];
/**
 * Datos que el pedido trae y el plan no recoge (horas, aerolíneas, escala, dudas dichas). Devuelve una lista corta, en palabras.
 * Se usa para pedir una vuelta de arreglo al modelo y, si aún falta, para mandar el plan a aprobación.
 */
export function coverageGaps(ops: Op[], text: string): string[] {
  if (!ops.length) return [];
  const plan = JSON.stringify(ops.map(o => o.args)).toLowerCase(); const t = text.replace(/PLAN DE LA PROPUESTA ANTERIOR[\s\S]*$/i, '').replace(/PLAN OF THE PREVIOUS PROPOSAL[\s\S]*$/i, '');
  const out: string[] = [];
  const times = [...new Set([...t.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)].map(m => `${m[1].padStart(2, '0')}:${m[2]}`))].filter(x => !plan.includes(x) && !plan.includes(x.replace(/^0/, '')));
  if (times.length && ops.some(o => o.name === 'agendar')) out.push(tr(`horas ${times.join(', ')}`, `times ${times.join(', ')}`));
  const air = AIRLINES.filter(x => new RegExp(`\\b${x}\\b`, 'i').test(t) && !plan.includes(x.toLowerCase())); if (air.length && ops.some(o => o.name === 'agendar')) out.push(tr(`aerolíneas ${air.join(', ')}`, `airlines ${air.join(', ')}`));
  const esc = t.match(/(?:escala|layover|stopover|connection)\s+(?:en|in|at)\s+([A-ZÁÉÍÓÚ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][\wáéíóúñ]+)?)/i);
  if (esc && !plan.includes(esc[1].toLowerCase())) out.push(tr(`la escala en ${esc[1]}`, `the stop in ${esc[1]}`));
  if (/(no (se ha )?verific|sin verificar|not (yet )?verified|unverified|no (est[aá]n?|aparece[n]?) expl[ií]cit|not explicit|not confirmed|sin confirmar|zonas? horarias?|time ?zones?)/i.test(t) && !/(verific|zona|huso|time ?zone|confirm|expl[ií]cit)/i.test(plan)) out.push(tr('las dudas que dice el pedido (sin verificar, zona horaria)', 'the doubts the request states (unverified, time zone)'));
  return out;
}

const WD: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const WD_NAME = () => [tr('domingo', 'Sunday'), tr('lunes', 'Monday'), tr('martes', 'Tuesday'), tr('miércoles', 'Wednesday'), tr('jueves', 'Thursday'), tr('viernes', 'Friday'), tr('sábado', 'Saturday')];
const MONTHS = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december';
/**
 * Fechas del plan que no cuadran con lo que dice el pedido (solo en tareas y agenda, que miran hacia adelante):
 * el día de la semana no coincide, el número de día no es el que se dijo, o la fecha ya pasó.
 */
export function dateIssues(ops: Op[], text: string, today: string): string[] {
  const t = norm(text.replace(/PLAN DE LA PROPUESTA ANTERIOR[\s\S]*$/i, '').replace(/EXPEDIENTE DEL CASO[\s\S]*$/i, ''));
  const days = new Set(Object.keys(WD).filter(w => new RegExp(`\\b${w}\\b`).test(t)).map(w => WD[w]));
  const nums = new Set<number>();
  for (const m of t.matchAll(new RegExp(`\\b(?:${Object.keys(WD).join('|')}|el|dia|on|the)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*[:h])`, 'g'))) nums.add(Number(m[1]));
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(?:${MONTHS})\\b`, 'g'))) nums.add(Number(m[1]));
  for (const m of t.matchAll(new RegExp(`\\b(?:${MONTHS})\\s+(\\d{1,2})\\b`, 'g'))) nums.add(Number(m[1]));
  const out: string[] = []; const names = WD_NAME();
  // «mañana», «hoy», «la próxima semana»: fechas relativas; ahí solo se revisa que no esté en el pasado.
  const relative = /\b(hoy|manana|pasado manana|proxim[oa]|siguiente|que viene|en \d+ dias|today|tomorrow|next|in \d+ days)\b/.test(t);
  for (const op of ops) {
    if (!['agendar', 'crear_tarea', 'reprogramar_tarea'].includes(op.name)) continue;
    for (const k of ['fecha', 'vence', 'nueva_fecha']) {
      const d = String(op.args?.[k] || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const wd = new Date(`${d}T12:00:00Z`).getUTCDay(); const dom = Number(d.slice(8));
      const single = days.size <= 1 && nums.size <= 1;
      const okDay = single ? (!days.size || days.has(wd)) && (!nums.size || nums.has(dom)) : days.has(wd) || nums.has(dom);
      if (!relative && (days.size || nums.size) && !okDay && nums.size <= 6 && ![...nums].some(n => n > 31)) out.push(days.size && !days.has(wd) && !nums.has(dom)
        ? tr(`El pedido dice ${[...days].map(x => names[x]).join(' / ')}${nums.size ? ` ${[...nums].join(', ')}` : ''}, pero ${d} es ${names[wd]}.`, `The request says ${[...days].map(x => names[x]).join(' / ')}${nums.size ? ` ${[...nums].join(', ')}` : ''}, but ${d} is a ${names[wd]}.`)
        : tr(`El pedido habla del día ${[...nums].join(', ')} y el plan pone ${d}.`, `The request talks about day ${[...nums].join(', ')} and the plan uses ${d}.`));
      else if (d < today && !t.includes(d)) out.push(tr(`La fecha ${d} ya pasó.`, `The date ${d} is already past.`));
    }
  }
  return [...new Set(out)];
}
/** Los campos que ya tienen las fichas que el plan quiere cambiar (para que el modelo use esos nombres y no invente otros). */
export function fieldHints(ops: Op[]): string {
  const byId = nodesById(); const INTERNAL = /^(id|title|type|tags|relations|source.*|.*sha256|icon_.*|completeness_score|memory_tier)$/;
  return [...new Set(ops.filter(o => o.name === 'actualizar_campos').map(o => String(o.args?.ficha || '')))].map(id => { const n: any = byId.get(id); return n ? `${id}: ${Object.keys(n.frontmatter || {}).filter(k => !INTERNAL.test(k)).slice(0, 40).join(', ')}` : ''; }).filter(Boolean).join(' | ');
}
/** Campos que el plan quiere escribir y que ninguna ficha de ese tipo usa (posible nombre inventado). */
export function fieldIssues(ops: Op[]): string[] {
  const out: string[] = []; const byId = nodesById(); const all = [...byId.values()];
  for (const op of ops) {
    if (op.name !== 'actualizar_campos' || !op.args?.campos || typeof op.args.campos !== 'object') continue;
    const n: any = byId.get(String(op.args.ficha || '')); if (!n) continue;
    const known = new Set<string>(); for (const x of all as any[]) if (x.type === n.type) for (const k of Object.keys(x.frontmatter || {})) known.add(k);
    // Se aceptan los campos que ya usa alguna ficha de ese tipo y los que la estructura declara (estándar y por tipo), aunque ninguna ficha los use todavía.
    const declared = knownFieldsOf(n.type);
    const odd = Object.keys(op.args.campos).filter(k => !known.has(k) && !declared.has(k)); if (!odd.length || known.size < 5) continue;
    out.push(tr(`El plan escribe ${odd.map(k => `«${k}»`).join(', ')} en ${displayTitle(n.title)}, y ninguna ficha de ese tipo usa ese campo. ¿Es el nombre correcto?`, `The plan writes ${odd.map(k => `“${k}”`).join(', ')} in ${displayTitle(n.title)}, and no note of that type uses that field. Is it the right name?`));
  }
  return out;
}
export function inspectPlan(ops: Op[], supuso: string[] = [], text = '', namesText = text): Observations {
  const o: Observations = { supuso: supuso.slice(0, 8), fuertes: [], avisos: [], falta: [] };
  const nodes = nodesById(); const vault = getVaultPath();
  const open = getUnifiedBrainTasks().tasks.filter(t => !t.isCompleted);
  const events = listEvents(vault);
  for (const op of ops) {
    const a = op.args || {};
    if (op.name === 'crear_tarea') {
      const twin = open.find(t => overlap(t.title, String(a.titulo)) >= 0.75 && words(a.titulo).length >= 3);
      if (twin) { const where = twin.sourceNodeId && twin.sourceNodeId !== a.ficha ? twin.sourceNodeId : ''; o.fuertes.push(tr(`La tarea «${String(a.titulo).slice(0, 80)}» se parece a una que ya existe: «${twin.title.slice(0, 80)}»${where ? ` (en ${where})` : ''}. ¿Es la misma?`, `The task “${String(a.titulo).slice(0, 80)}” looks like one that already exists: “${twin.title.slice(0, 80)}”${where ? ` (in ${where})` : ''}. Is it the same one?`)); }
    }
    if (op.name === 'crear_ficha') {
      const name = norm(a.nombre);
      const twin = [...nodes.values()].find(n => n.type === a.tipo && (overlap(displayTitle(n.title), String(a.nombre)) >= 0.99 || (words(a.nombre).length >= 2 && norm(displayTitle(n.title)).includes(name))));
      if (twin) o.fuertes.push(tr(`«${a.nombre}» se parece a una ficha que ya existe: ${displayTitle(twin.title)} (${twin.id}). ¿Es la misma?`, `“${a.nombre}” looks like a note that already exists: ${displayTitle(twin.title)} (${twin.id}). Is it the same one?`));
      const c = a.campos || {};
      if (a.tipo === 'person') {
        if (!c.email_primary && !c.phone_mobile) o.falta.push(tr(`${a.nombre}: sin correo ni teléfono.`, `${a.nombre}: no email or phone.`));
        if (!(Array.isArray(a.conectar_con) && a.conectar_con.length)) o.falta.push(tr(`${a.nombre}: sin conectar a una empresa.`, `${a.nombre}: not connected to a company.`));
      } else if (!(Array.isArray(a.conectar_con) && a.conectar_con.length)) o.falta.push(tr(`${a.nombre}: sin conectar a un mercado o marca.`, `${a.nombre}: not connected to a market or brand.`));
    }
    if (op.name === 'actualizar_campos') {
      const n = nodes.get(String(a.ficha)); const fm = n?.frontmatter || {};
      const changed = Object.entries(a.campos || {}).filter(([k, v]) => fm[k] !== undefined && fm[k] !== null && fm[k] !== '' && String(fm[k]) !== String(v));
      if (changed.length && fm.verification_status === 'verified') o.fuertes.push(tr(`Cambia datos de una ficha VERIFICADA (${displayTitle(n!.title)}): `, `Changes data of a VERIFIED note (${displayTitle(n!.title)}): `) + `${changed.map(([k, v]) => `${k}: «${String(fm[k]).slice(0, 40)}» → «${String(v).slice(0, 40)}»`).join('; ')}.`);
      // Pisar un texto largo que ya existía (notas, descripción) borra información: eso lo decide una persona.
      else if (changed.some(([k, v]) => { const was = String(fm[k] ?? ''); return was.length > 25 && /\s/.test(was) && !norm(String(v ?? '')).includes(norm(was).slice(0, 40)); })) o.fuertes.push(tr(`${displayTitle(n!.title)}: el plan REEMPLAZA un texto que ya existía en ${changed.filter(([k]) => String(fm[k] ?? '').length > 25).map(([k]) => `${k} («${String(fm[k]).slice(0, 60)}…»)`).join(', ')}. Se perdería lo anterior.`, `${displayTitle(n!.title)}: the plan REPLACES text that already existed in ${changed.filter(([k]) => String(fm[k] ?? '').length > 25).map(([k]) => `${k} (“${String(fm[k]).slice(0, 60)}…”)`).join(', ')}. The previous content would be lost.`));
      else if (changed.length) o.avisos.push(tr(`${displayTitle(n!.title)}: se reemplaza ${changed.map(([k]) => `${k} (antes «${String(fm[k]).slice(0, 40)}»)`).join(', ')}.`, `${displayTitle(n!.title)}: replaces ${changed.map(([k]) => `${k} (was “${String(fm[k]).slice(0, 40)}”)`).join(', ')}.`));
    }
    if (op.name === 'agendar' && a.hora) {
      const title = eventTitle(a);
      const clash = events.find(e => e.date === a.fecha && e.time === a.hora && norm(e.title) !== norm(title) && e.repeat === 'none');
      if (clash) o.avisos.push(tr(`El ${a.fecha} a las ${a.hora} ya tienes «${clash.title}».`, `On ${a.fecha} at ${a.hora} you already have “${clash.title}”.`));
    }
  }
  try { o.fuertes.push(...fieldIssues(ops)); } catch {}
  if (text) {
    const refs = refsOf(ops);
    try {
      for (const x of nameAmbiguities(namesText)) {
        const used = x.people.filter(p => refs.has(p.id)); if (!used.length) continue;
        o.fuertes.push(x.kind === 'igual'
          ? tr(`«${x.word}» puede ser ${x.people.map(p => p.title).join(' o ')}: el plan usa a ${used.map(p => p.title).join(', ')}. ¿Es esa persona?`, `“${x.word}” can be ${x.people.map(p => p.title).join(' or ')}: the plan uses ${used.map(p => p.title).join(', ')}. Is that the right person?`)
          : tr(`«${x.word}» no es el nombre exacto de nadie y el plan usa a ${used.map(p => p.title).join(', ')}. ¿Es esa persona?`, `“${x.word}” is nobody’s exact name and the plan uses ${used.map(p => p.title).join(', ')}. Is that the right person?`));
      }
      try { const { dateStr } = getPanamaDate(); o.fuertes.push(...dateIssues(ops, text, dateStr)); } catch {}
      const gaps = coverageGaps(ops, text); if (gaps.length) o.fuertes.push(tr(`El plan no recoge todo lo que dice el pedido: ${gaps.join('; ')}.`, `The plan does not capture everything the request says: ${gaps.join('; ')}.`));
      for (const p of peopleMentioned(text)) if (!refs.has(p.id)) o.avisos.push(tr(`El pedido nombra a ${p.title}, pero el plan no lo menciona.`, `The request names ${p.title}, but the plan does not mention them.`));
    } catch {}
  }
  // Lo que falta en las fichas de personas que el plan usa.
  const used = new Set(ops.flatMap(op => [op.args?.ficha, ...linked(op.name === 'agendar' ? op.args : {})]).filter(Boolean).map(String));
  const made = new Set(ops.map(createdIdOf).filter(Boolean) as string[]);
  for (const id of used) {
    if (made.has(id)) continue; const n = nodes.get(id); if (!n || n.type !== 'person') continue; const fm = n.frontmatter || {};
    if (!fm.email_primary && !fm.phone_mobile && !fm.whatsapp) o.falta.push(tr(`${displayTitle(n.title)}: sin correo ni teléfono.`, `${displayTitle(n.title)}: no email or phone.`));
  }
  o.fuertes = [...new Set(o.fuertes)].slice(0, 10); o.avisos = [...new Set(o.avisos)].slice(0, 10); o.falta = [...new Set(o.falta)].slice(0, 12);
  return o;
}

/** Texto corto de cómo estaban las fichas que el plan va a tocar (para que Jev compare después). */
export function snapshotBefore(ops: Op[]): string {
  const nodes = nodesById(); const ids = [...new Set(ops.filter(o => o.name === 'registrar_novedad' || o.name === 'actualizar_campos').map(o => String(o.args?.ficha)))].slice(0, 4);
  return ids.map(id => { const n = nodes.get(id); if (!n) return ''; const fm = n.frontmatter || {}; const state = (String(n.body || '').match(/## (?:Estado actual|Current state)\s+([\s\S]*?)(?=\n## |$)/)?.[1] || '').trim().slice(0, 500);
    return `FICHA ${displayTitle(n.title)}: ${state || '(sin estado actual)'}${fm.next_followup_date ? ` · próximo paso ${String(fm.next_followup_date).slice(0, 10)}: ${fm.next_followup_action || ''}` : ''}`; }).filter(Boolean).join('\n');
}

// ---------- Bandeja «Por revisar» ----------
const file = (v: string) => path.join(cerebroDir(v), 'review.json');
export function listReview(vaultPath: string): ReviewItem[] { try { const d = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; } }
function save(vaultPath: string, items: ReviewItem[]) {
  const open = items.filter(i => !i.closedAt), closed = items.filter(i => i.closedAt).slice(0, 200);
  fs.mkdirSync(cerebroDir(vaultPath), { recursive: true }); const tmp = file(vaultPath) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify([...open.slice(0, 300), ...closed])); fs.renameSync(tmp, file(vaultPath));
}
/** Después de aplicar: lo que falta y los avisos pasan a «Por revisar» (sin repetir los que ya están abiertos). */
export function fileObservations(vaultPath: string, requestId: string, o: Observations): number {
  const items = listReview(vaultPath); const have = new Set(items.filter(i => !i.closedAt).map(i => i.text)); let n = 0;
  const add = (kind: ReviewItem['kind'], text: string) => { if (have.has(text)) return; have.add(text); items.unshift({ id: `rev-${crypto.randomBytes(4).toString('hex')}`, at: new Date().toISOString(), requestId, kind, text }); n++; };
  for (const t of [...o.fuertes, ...o.avisos]) add('aviso', t);
  for (const t of o.falta) add('falta', t);
  if (n) save(vaultPath, items);
  return n;
}
export function closeReview(vaultPath: string, id: string, by: string): boolean {
  const items = listReview(vaultPath); const it = items.find(i => i.id === id && !i.closedAt); if (!it) return false;
  it.closedAt = new Date().toISOString(); it.closedBy = by; save(vaultPath, items); return true;
}
