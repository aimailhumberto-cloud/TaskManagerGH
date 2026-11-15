/**
 * La decisión (fase 5, etapa 5.4): ¿se guarda, se guarda una parte, o espera a una persona?
 *
 * Antes era una cadena de condiciones dentro de pedir(), con efectos laterales y cuatro caminos de salida, y el ensayo (dryRun) cortaba antes de
 * «guardar primero», así que medía mal. Ahora es UNA función pura, `decide()`, que usan igual el pedido real y el ensayo.
 *
 * La tabla (de arriba abajo; la primera que aplica manda):
 *   1. DELICADO  → espera siempre: borrar, verificar, compartir. Nunca se afloja.
 *   2. GRANDE / AJUSTES / AGENTE → espera: toca o crea más que el límite, el tipo está en «proponer» en Ajustes, o la llave del agente solo propone.
 *   3. AVISO FUERTE → espera si su categoría bloquea:
 *        nunca se afloja: identidad (no se adivina cuál persona), dato verificado, fecha que no cuadra;
 *        se puede aflojar en Ajustes (politica = 'avisar'): duplicado, pisa_texto, campo, cobertura.
 *   4. JEV → solo suma duda: obligatorio y caído, poca seguridad, o puntaje bajo (en un cambio simple y reversible avisa y guarda).
 *   5. Si algo espera pero otras partes son CIERTAS (simples, sin duda, permitidas), se guarda lo cierto ya y solo lo demás espera.
 *   6. Si nada espera, se guarda todo.
 * Cada espera lleva su categoría: así se cuenta cuántas hay de cada tipo y cuántas se aprobaron tal cual (scripts/esperas.ts), que es con lo que se decide qué aflojar.
 */
import { loadBrainGraph } from '../smjBrainService';
import { displayTitle } from '../titles';
import { tr } from '../reqLang';
import { MENU, levelOf, kindOf, kindName, touchesOf, createdIdOf, type Op } from './ops';
import { POLICY_CATEGORIES, type CerebroSettings, type PolicyCategory } from './settings';
import { jevPolicy, type JevResult } from './jev';
import { outcomeOf } from './jevcal';
import type { CerebroRequest } from './engine';

/** Por qué espera algo. Las primeras cuatro y «identidad», «dato_verificado» y «fecha» nunca se aflojan. */
export type WaitCategory =
  | 'delicado' | 'grande' | 'ajustes' | 'agente'
  | 'duplicado' | 'identidad' | 'dato_verificado' | 'pisa_texto' | 'fecha' | 'campo' | 'cobertura'
  | 'jev_duda' | 'jev_seguridad' | 'jev_obligatorio'
  | 'dudoso' | 'depende' | 'otro';

// ---------- Piezas (antes dentro de engine.ts) ----------
/** Operaciones simples y reversibles: notas, tareas, agenda y datos de una ficha que ya existe. */
const LOW_OPS = new Set(['registrar_novedad', 'crear_tarea', 'completar_tarea', 'reprogramar_tarea', 'agendar', 'cancelar_evento', 'actualizar_campos']);
/**
 * Riesgo bajo: solo operaciones simples, sobre pocas fichas que ya existen, sin avisos fuertes y con el expediente completo.
 * En riesgo bajo, la duda de Jev no frena: se guarda, se avisa y se puede deshacer.
 */
export function lowRisk(ops: Op[], obs: { fuertes: string[] }, incompleto = false): boolean {
  if (!ops.length || incompleto || obs.fuertes.length) return false;
  if (!ops.every(o => LOW_OPS.has(o.name))) return false;
  return new Set(ops.flatMap(touchesOf)).size <= 3;
}

/** «Nueva y completa»: una persona o empresa con nombre y al menos dos datos (correo, teléfono, cargo, empresa) o una conexión. Se crea sola. */
function isCompleteNew(op: Op): boolean {
  if (op.name !== 'crear_ficha' || !['person', 'organization', 'distributor', 'customer'].includes(String(op.args?.tipo))) return false;
  const c = op.args?.campos && typeof op.args.campos === 'object' ? op.args.campos : {};
  const data = ['email_primary', 'phone_mobile', 'phone', 'job_title', 'organization', 'company'].filter(k => String(c[k] || '').trim()).length + (Array.isArray(op.args?.conectar_con) && op.args.conectar_con.length ? 1 : 0);
  return String(op.args?.nombre || '').trim().length >= 3 && data >= 2;
}

/** ¿Por qué este plan no se aplica solo, por las reglas duras y los Ajustes? null = nada lo frena aquí. */
export function waitReason(ops: Op[], s: CerebroSettings, scope?: string): { why: string; cat: WaitCategory } | null {
  const strict = ops.filter(o => levelOf(o) === 'aprobar');
  if (strict.length) return { cat: 'delicado', why: strict.some(o => o.name === 'borrar_ficha')
    ? tr(`Incluye borrar ficha: eso siempre lo aprueba una persona, con doble confirmación.`, `Includes delete note: a person always approves that, with double confirmation.`)
    : tr(`Incluye ${strict.map(o => o.name.replace(/_/g, ' ')).join(', ')}: eso siempre lo aprueba una persona.`, `Includes ${strict.map(o => o.name.replace(/_/g, ' ')).join(', ')}: a person always approves that.`) };
  const touched = new Set(ops.flatMap(touchesOf)).size, creates = ops.filter(o => MENU[o.name]?.creates).length;
  if (touched > s.bigTouch) return { cat: 'grande', why: tr(`Es un pedido grande: toca ${touched} fichas (límite ${s.bigTouch}).`, `It is a big request: it touches ${touched} notes (limit ${s.bigTouch}).`) };
  if (creates > s.bigCreate) return { cat: 'grande', why: tr(`Es un pedido grande: crea ${creates} fichas (límite ${s.bigCreate}).`, `It is a big request: it creates ${creates} notes (limit ${s.bigCreate}).`) };
  if (scope === 'proponer') return { cat: 'agente', why: tr('La llave del agente solo puede proponer.', 'The agent key can only propose.') };
  const waits = [...new Set(ops.map(kindOf).filter((k): k is NonNullable<ReturnType<typeof kindOf>> => !!k && !s.auto[k]))];
  if (waits.length) return { cat: 'ajustes', why: tr(`Incluye ${waits.map(kindName).join(' y ')}: eso está en «proponer» en tus Ajustes.`, `Includes ${waits.map(kindName).join(' and ')}: that is set to “propose” in your Settings.`) };
  return null;
}
/** Igual que waitReason pero solo el texto (lo que exportaba engine.ts). */
export const whyProposal = (ops: Op[], s: CerebroSettings, scope?: string): string | null => waitReason(ops, s, scope)?.why ?? null;

/**
 * Guardar primero: reparte el plan en tres. CIERTO (simple, sin duda, permitido en Ajustes) se guarda ya;
 * DUDOSO (una advertencia fuerte lo toca) y DELICADO (borrar, verificar, compartir, o lo que Ajustes manda proponer) esperan.
 * Lo que depende de algo que espera, espera también. Devuelve por qué espera cada una y de qué categoría.
 * `cats` = la categoría de cada aviso fuerte, en el mismo orden que `fuertes`.
 */
export function splitCierto(ops: Op[], fuertes: string[], s: CerebroSettings, cats: string[] = []): { now: Op[]; wait: Op[]; whyEach: string[]; catEach: WaitCategory[] } {
  const titleOf = (id: string) => { try { const n = ((loadBrainGraph() as any).allNodes || []).find((x: any) => x.id === id); return n ? displayTitle(n.title).toLowerCase() : id.toLowerCase(); } catch { return id.toLowerCase(); } };
  const fs_ = fuertes.map(f => f.toLowerCase());
  const reason: (string | null)[] = []; const cat: (WaitCategory | null)[] = [];
  ops.forEach(op => {
    if (levelOf(op) === 'aprobar') { reason.push(tr('delicado: siempre lo aprueba una persona', 'sensitive: a person always approves it')); cat.push('delicado'); return; }
    const k = kindOf(op);
    const hit = fs_.findIndex(f => touchesOf(op).some(id => f.includes(String(id).toLowerCase()) || f.includes(titleOf(String(id)))));
    if (hit >= 0) { reason.push(tr('dudoso: queda por confirmar', 'doubtful: left to confirm')); cat.push((cats[hit] as WaitCategory) || 'dudoso'); return; }
    if (k && !s.auto[k] && !isCompleteNew(op)) { reason.push(tr(`está en «proponer» en tus Ajustes (${kindName(k)})`, `it is set to “propose” in your Settings (${kindName(k)})`)); cat.push('ajustes'); return; }
    reason.push(null); cat.push(null);
  });
  const made = new Map<string, number>(); ops.forEach((o, i) => { const id = createdIdOf(o); if (id) made.set(id, i); });
  for (let again = true; again;) {
    again = false;
    ops.forEach((op, i) => { if (reason[i]) return; const raw = JSON.stringify(op.args || {}); for (const [id, j] of made) if (j !== i && reason[j] && raw.includes(id)) { reason[i] = tr('depende de algo que espera', 'it depends on something that is waiting'); cat[i] = 'depende'; again = true; break; } });
  }
  return { now: ops.filter((_, i) => !reason[i]), wait: ops.filter((_, i) => reason[i]), whyEach: reason.filter((r): r is string => !!r), catEach: cat.filter((c): c is WaitCategory => !!c) };
}

// ---------- La tabla ----------
export interface DecideInput {
  ops: Op[];
  /** Lo que encontró la revisión: avisos fuertes con su categoría. */
  obs: { fuertes: string[]; fuertesCat?: string[] };
  s: CerebroSettings;
  /** Alcance de la llave del agente ('proponer' = solo propone). */
  scope?: string;
  /** El expediente quedó incompleto (quien pidió no tenía más datos). */
  incompleto: boolean;
  /** Es la lectura de un correo o nota (no hay conversación para repetir). */
  leer: boolean;
  /** Este pedido corrige una propuesta que espera: no se parte, se reemplaza completa. */
  correccion: boolean;
  jev: JevResult;
  /** Ya se hizo la segunda vuelta con el modelo grande. */
  segundaVuelta: boolean;
}
export interface Decision {
  accion: 'guardar' | 'guardar_parcial' | 'esperar';
  /** Por qué espera (de todo el plan, o de la parte que espera: la primera). null si se guarda todo. */
  categoria: WaitCategory | null;
  /** El motivo en una línea. null si se guarda todo. */
  porque: string | null;
  guardar: Op[];
  esperar: Op[];
  /** Por qué espera cada operación que espera, y de qué categoría (solo en «guardar_parcial»). */
  porqueCada: string[];
  categoriaCada: WaitCategory[];
  /** Avisos que aporta la decisión (Jev dudó pero se guarda; Jev no pudo revisar; un aviso aflojado por Ajustes). */
  avisos: string[];
  /** Los avisos fuertes que SIGUEN bloqueando (los aflojados pasaron a «avisos»). */
  fuertes: string[]; fuertesCat: string[];
  /** Si no es null: volver a pensar el pedido con el modelo grande, con este motivo (Jev dudó de un cambio simple). El resto de la decisión no vale. */
  repetir: string | null;
}

export function decide(i: DecideInput): Decision {
  const { ops, s, scope, incompleto, leer, correccion, jev, segundaVuelta } = i;
  const avisos: string[] = [];
  // 0) La política de Ajustes afloja solo las categorías permitidas: el aviso se guarda como aviso y deja de frenar.
  const blocking: { text: string; cat: string }[] = [];
  (i.obs.fuertes || []).forEach((text, k) => {
    const cat = i.obs.fuertesCat?.[k] || 'otro';
    if ((POLICY_CATEGORIES as readonly string[]).includes(cat) && s.politica?.[cat as PolicyCategory] === 'avisar') avisos.push(tr(`${text} (Se guardó igual: en tus Ajustes este aviso no frena.)`, `${text} (Saved anyway: in your Settings this warning does not block.)`));
    else blocking.push({ text, cat });
  });
  const fuertes = blocking.map(b => b.text), fuertesCat = blocking.map(b => b.cat);
  const lr = lowRisk(ops, { fuertes }, incompleto);
  const empty = (extra: Partial<Decision> = {}): Decision => ({ accion: 'guardar', categoria: null, porque: null, guardar: ops, esperar: [], porqueCada: [], categoriaCada: [], avisos, fuertes, fuertesCat, repetir: null, ...extra });

  // 1–3) Reglas duras, Ajustes y avisos fuertes
  let w: { why: string; cat: WaitCategory } | null = waitReason(ops, s, scope);
  if (!w && blocking.length) w = { why: blocking[0].text, cat: (blocking[0].cat as WaitCategory) };
  // 4) Jev: no respondió o dio poca seguridad, y después el puntaje
  const jr = jevPolicy({ jev, s, lowRisk: lr }); if (jr.aviso) avisos.push(jr.aviso);
  if (!w && jr.why) w = { why: jr.why, cat: jev.score === null ? 'jev_obligatorio' : 'jev_seguridad' };
  const conf = jev.score; const pct = conf === null ? 0 : Math.round(conf * 100); const because = jev.reason ? tr(` Motivo: ${jev.reason}.`, ` Reason: ${jev.reason}.`) : '';
  if (!w && conf !== null && conf < s.threshold) {
    // Riesgo bajo: la duda de Jev avisa pero no frena (cambio simple, reversible, sobre fichas que ya existen). Primero una segunda vuelta con el modelo grande.
    if (lr && !segundaVuelta && !leer) return empty({ repetir: jev.reason || tr('la revisión no quedó segura', 'the review was not sure') });
    if (lr) avisos.push(tr(`Jev dudó de este plan (${pct} %).${because} Se guardó igual porque es un cambio simple y se puede deshacer: revísalo.`, `Jev doubted this plan (${pct}%).${because} It was saved anyway because it is a simple change that can be undone: check it.`));
    else if (s.politica?.jev_duda === 'avisar') avisos.push(tr(`Jev dudó de este plan (${pct} %).${because} Se guardó igual porque en tus Ajustes esa duda solo avisa: revísalo.`, `Jev doubted this plan (${pct}%).${because} It was saved anyway because in your Settings that doubt only warns: check it.`));
    else w = { cat: 'jev_duda', why: tr(`Jev no está seguro de que el plan refleje el pedido (confianza ${pct} %, mínimo ${Math.round(s.threshold * 100)} %).${because}`, `Jev is not sure the plan reflects the request (confidence ${pct}%, minimum ${Math.round(s.threshold * 100)}%).${because}`) };
  } else if (conf !== null && conf < 0.65) avisos.push(tr(`Jev dio ${pct} % de confianza a este plan: échale un ojo.${because}`, `Jev gave this plan ${pct}% confidence: take a look.${because}`));

  // 5) Guardar primero: si lo único que frena es lo dudoso o lo delicado, lo cierto se guarda ya y lo demás espera.
  const splitOk = !!w && !leer && !correccion && !!ops.length && s.mode !== 'proponer' && scope !== 'proponer' && !incompleto
    && new Set(ops.flatMap(touchesOf)).size <= s.bigTouch && ops.filter(o => MENU[o.name]?.creates).length <= s.bigCreate && (conf === null || conf >= s.threshold)
    && !jr.why; // si la espera la causó Jev (obligatorio y caído, o poca seguridad), el plan espera completo
  const split = splitOk ? splitCierto(ops, fuertes, s, fuertesCat) : null;
  if (split && !split.wait.length && !fuertes.length) w = null; // todo era cierto (p. ej. fichas nuevas completas): se guarda como siempre
  if (w && split && split.now.length && split.wait.length)
    return empty({ accion: 'guardar_parcial', guardar: split.now, esperar: split.wait, porqueCada: split.whyEach, categoriaCada: split.catEach, porque: [...new Set(split.whyEach)].join(' · '), categoria: split.catEach[0] ?? w.cat });
  // 6) Espera completo, o se guarda todo
  if (w) return empty({ accion: 'esperar', guardar: [], esperar: ops, porque: w.why, categoria: w.cat });
  return empty();
}

// ---------- Contar las esperas ----------
export interface WaitRow { categoria: string; total: number; aprobadas: number; descartadas: number; corregidas: number; abiertas: number; aflojable: boolean }
export interface WaitStats {
  pedidos: number; seGuardaronSolos: number; conEspera: number;
  porCategoria: WaitRow[];
  lecturas: string[]; advertencias: string[];
}
/**
 * Cuántas esperas hubo de cada categoría y qué pasó con cada una (la persona la aprobó tal cual, la descartó, la corrigió). Solo lee.
 * Es la base para decidir qué aflojar: una categoría aflojable que se aprueba casi siempre es una aprobación de más.
 */
export function waitStats(requests: CerebroRequest[], undone: Set<string> = new Set()): WaitStats {
  const rows = new Map<string, WaitRow>(); let pedidos = 0, solos = 0, conEspera = 0;
  for (const r of requests) {
    const o = outcomeOf(r, undone); if (!o) continue;
    pedidos++;
    const cats = [...new Set((r.waitCats?.length ? r.waitCats : r.esperaCat ? [r.esperaCat] : []).filter(Boolean))];
    if (!cats.length) { if (o === 'aplicado_solo') solos++; continue; }
    conEspera++;
    for (const c of cats) {
      const row = rows.get(c) || { categoria: c, total: 0, aprobadas: 0, descartadas: 0, corregidas: 0, abiertas: 0, aflojable: (POLICY_CATEGORIES as readonly string[]).includes(c) }; rows.set(c, row);
      row.total++;
      if (o === 'aprobado' || o === 'deshecho') row.aprobadas++; else if (o === 'descartado') row.descartadas++; else if (o === 'corregido') row.corregidas++; else row.abiertas++;
    }
  }
  const porCategoria = [...rows.values()].sort((a, b) => b.total - a.total);
  const out: WaitStats = { pedidos, seGuardaronSolos: solos, conEspera, porCategoria, lecturas: [], advertencias: [] };
  if (!pedidos) { out.advertencias.push('Todavía no hay pedidos: no hay nada que contar.'); return out; }
  out.lecturas.push(`De ${pedidos} pedidos, ${solos} se guardaron solos y ${conEspera} tuvieron alguna espera.`);
  for (const c of porCategoria) {
    const resueltas = c.aprobadas + c.descartadas + c.corregidas; if (resueltas < 10) continue;
    const rate = c.aprobadas / resueltas;
    if (c.aflojable && rate >= 0.9) out.lecturas.push(`«${c.categoria}»: ${c.total} esperas, ${Math.round(rate * 100)} % aprobadas tal cual. Es una aprobación de más: puedes poner politica.${c.categoria} = «avisar» en Ajustes.`);
    else if (!c.aflojable && rate >= 0.9) out.lecturas.push(`«${c.categoria}»: ${Math.round(rate * 100)} % aprobadas tal cual, pero esta categoría es una regla dura y no se afloja en Ajustes: si estorba, hay que mejorar el motor, no la política.`);
  }
  if (porCategoria.every(c => c.aprobadas + c.descartadas + c.corregidas < 10)) out.advertencias.push('Ninguna categoría tiene 10 esperas resueltas todavía: con menos no conviene aflojar nada.');
  return out;
}
export function formatWaitStats(w: WaitStats): string {
  const L = ['ESPERAS POR CATEGORÍA', `Pedidos: ${w.pedidos} · guardados solos: ${w.seGuardaronSolos} · con alguna espera: ${w.conEspera}`, '', 'Categoría         | total | aprobadas | descartadas | corregidas | abiertas | se afloja'];
  for (const c of w.porCategoria) L.push(`${c.categoria.padEnd(17)} | ${String(c.total).padStart(5)} | ${String(c.aprobadas).padStart(9)} | ${String(c.descartadas).padStart(11)} | ${String(c.corregidas).padStart(10)} | ${String(c.abiertas).padStart(8)} | ${c.aflojable ? 'sí (politica)' : 'no (regla dura)'}`);
  if (w.lecturas.length) L.push('', 'LECTURA', ...w.lecturas.map(x => `- ${x}`));
  if (w.advertencias.length) L.push('', 'ADVERTENCIAS', ...w.advertencias.map(x => `- ${x}`));
  return L.join('\n');
}
