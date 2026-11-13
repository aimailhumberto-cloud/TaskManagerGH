/**
 * Menú de operaciones del Cerebro. El modelo SOLO puede pedir estas; la app revisa cada una y la ejecuta
 * con las mismas manos de la fase 1 (diario, recibo, deshacer). Niveles:
 *   sola      → se puede aplicar sin aprobación (en modo automático y si el pedido no es grande)
 *   aprobar   → siempre espera a una persona (borrar, marcar verificado, compartir)
 * Fusionar fichas no está en el menú todavía: el Cerebro lo deja como pregunta.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getUnifiedBrainTasks, getVaultPath, resolveNodeFile, createBrainTask, completeBrainTask, rescheduleBrainTask, upsertNode, deleteVaultFile, loadBrainGraph, safeRelative } from '../smjBrainService';
import { updateNoteFile, readNoteStrict } from '../vaultFiles';
import { recordUpdate } from '../recordUpdate';
import { upsertEvent, deleteEvent, listEvents } from '../agenda';
import { setKpi } from '../kpis';
import { setVisibility } from '../sharing';
import { actorLabel } from '../actor';
import type { ToolDef } from './ollama';
import { tr, tw } from '../reqLang';

export interface Op { name: string; args: Record<string, any> }
export type Level = 'sola' | 'aprobar';
interface Def { level: Level; desc: string; params: Record<string, string>; required: string[]; touches?: (a: any) => string[]; creates?: boolean }

const DAY = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Carpeta donde nace cada tipo de ficha. */
const FOLDER: Record<string, [string, string]> = {
  person: ['01-Internal-Clients', 'Person'], department: ['01-Internal-Clients', 'Dept'], organization: ['01-Internal-Clients', 'Organization'],
  distributor: ['02-External-Clients', 'Distributor'], market: ['02-External-Clients', 'Market'], customer: ['02-External-Clients', 'Customer'], channel: ['02-External-Clients', 'Channel'],
  brand: ['03-Portfolio-Supply', 'Brand'], product_line: ['03-Portfolio-Supply', 'Line'], project: ['04-Operations-Routines', 'Project'], routine: ['04-Operations-Routines', 'Routine'],
};
/** Vocabulario corto de relaciones (fase 5 migra las antiguas). */
export const RELATIONS = ['belongs_to', 'reports_to', 'works_at', 'operates_in_market', 'carries_brand', 'distributed_by', 'supplies_client', 'contact_of', 'coordinates_with', 'related_to'];
const PROTECTED = new Set(['id', 'title', 'type', 'brain_id', 'brain_owner', 'owner', 'visibility', 'shared_with', 'verification_status', 'verified_at', 'verified_by', 'memory_tier', 'relations', 'recent_actions', 'pending_tasks', 'updated_at', 'last_updated_at']);

/** Fichas con las que es un evento: la principal y las de «con», sin repetir. */
export const linked = (a: any): string[] => [...new Set([a?.ficha, ...(Array.isArray(a?.con) ? a.con : typeof a?.con === 'string' && a.con ? a.con.split(/[,;]\s*/) : [])].map(x => String(x || '').trim()).filter(Boolean))];
export const MENU: Record<string, Def> = {
  registrar_novedad: { level: 'sola', desc: 'Anota en una ficha algo que pasó (correo, reunión, acuerdo, dato nuevo). Puede fijar el próximo paso, el último correo y el estado actual.', params: { ficha: 'id de la ficha', resumen: 'qué pasó, 1-2 frases', fecha: 'AAAA-MM-DD (opcional)', tipo: 'correo|reunion|llamada|acuerdo|nota', fuente: 'de dónde sale el dato', estado_actual: 'texto corto de lo que hoy es verdad (opcional)', proximo_paso_fecha: 'AAAA-MM-DD (opcional)', proximo_paso: 'texto (opcional)', correo_asunto: 'opcional', correo_fecha: 'opcional', correo_de: 'opcional' }, required: ['ficha', 'resumen'], touches: a => [a.ficha] },
  crear_tarea: { level: 'sola', desc: 'Crea una tarea en una ficha.', params: { ficha: 'id de la ficha', titulo: 'qué hay que hacer', vence: 'AAAA-MM-DD (opcional)', prioridad: 'High|Medium|Low' }, required: ['ficha', 'titulo'], touches: a => [a.ficha] },
  completar_tarea: { level: 'sola', desc: 'Marca una tarea como hecha.', params: { tarea: 'id de la tarea' }, required: ['tarea'] },
  reprogramar_tarea: { level: 'sola', desc: 'Cambia la fecha de una tarea.', params: { tarea: 'id de la tarea', vence: 'AAAA-MM-DD' }, required: ['tarea', 'vence'] },
  agendar: { level: 'sola', desc: 'Crea o mueve una reunión, llamada, viaje o evento. Pon en «con» los ids de las personas y empresas con quienes es; la app arma el título y lo anota en sus fichas. Si ya existe, lo mueve.', params: { titulo: 'tema corto, sin nombres de personas (ej.: «ver second brain»)', fecha: 'AAAA-MM-DD', con: 'lista de ids de fichas (personas, empresas) con quienes es', hora: 'HH:MM 24h (opcional)', hora_fin: 'HH:MM (opcional)', tipo: 'reunion|viaje|evento', lugar: 'opcional', fecha_fin: 'AAAA-MM-DD para viajes (opcional)', ficha: 'id de la ficha principal (opcional)' }, required: ['titulo', 'fecha'], touches: a => linked(a) },
  cancelar_evento: { level: 'sola', desc: 'Quita un evento de la agenda.', params: { titulo: 'título exacto', fecha: 'AAAA-MM-DD' }, required: ['titulo', 'fecha'] },
  registrar_indicador: { level: 'sola', desc: 'Guarda el valor de un indicador (ventas, volumen…). Solo cifras que vengan en el pedido.', params: { nombre: 'nombre del indicador', valor: 'número', unidad: 'opcional', meta: 'número (opcional)', periodo: 'opcional', nota: 'fuente de la cifra' }, required: ['nombre', 'valor'] },
  actualizar_campos: { level: 'sola', desc: 'Cambia datos de una ficha (teléfono, correo, cargo, ciudad…). No cambia identidad, permisos ni verificación.', params: { ficha: 'id de la ficha', campos: 'objeto {campo: valor}' }, required: ['ficha', 'campos'], touches: a => [a.ficha] },
  conectar: { level: 'sola', desc: `Conecta dos fichas. Relaciones permitidas: ${RELATIONS.join(', ')}.`, params: { desde: 'id de la ficha', hacia: 'id de la otra ficha', relacion: 'una de las permitidas' }, required: ['desde', 'hacia', 'relacion'], touches: a => [a.desde] },
  desconectar: { level: 'sola', desc: 'Quita una conexión entre dos fichas.', params: { desde: 'id', hacia: 'id', relacion: 'nombre de la relación' }, required: ['desde', 'hacia', 'relacion'], touches: a => [a.desde] },
  crear_ficha: { level: 'sola', desc: `Crea una ficha nueva. Tipos: ${Object.keys(FOLDER).join(', ')}. Antes comprueba que no exista.`, params: { tipo: 'tipo de ficha', nombre: 'nombre', campos: 'objeto con datos (opcional)', texto: 'descripción breve (opcional)', conectar_con: 'lista de {hacia, relacion} (opcional)' }, required: ['tipo', 'nombre'], creates: true },
  borrar_ficha: { level: 'aprobar', desc: 'Pide borrar una ficha. Siempre espera la aprobación de una persona.', params: { ficha: 'id de la ficha', motivo: 'por qué' }, required: ['ficha', 'motivo'], touches: a => [a.ficha] },
  marcar_verificado: { level: 'aprobar', desc: 'Pide marcar una ficha como verificada. Siempre espera a una persona.', params: { ficha: 'id', fuente: 'quién o qué lo confirma' }, required: ['ficha', 'fuente'], touches: a => [a.ficha] },
  compartir: { level: 'aprobar', desc: 'Pide cambiar quién ve una ficha. Siempre espera a una persona.', params: { ficha: 'id', visibilidad: 'private|shared|public' }, required: ['ficha', 'visibilidad'], touches: a => [a.ficha] },
};

export const toolDefs = (): ToolDef[] => Object.entries(MENU).map(([name, d]) => ({ type: 'function', function: { name, description: d.desc, parameters: { type: 'object', properties: Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, { type: k === 'campos' ? 'object' : k === 'conectar_con' || k === 'con' ? 'array' : k === 'valor' || k === 'meta' ? 'number' : 'string', description: v }])), required: d.required } } }));

const nodeOk = (id: unknown) => { const r = resolveNodeFile(String(id || ''), true); return r.ok ? r.filePath : null; };
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const newId = (tipo: string, nombre: string) => `${({ person: 'person', distributor: 'dist', market: 'market', brand: 'brand', customer: 'cust', department: 'dept', organization: 'org', channel: 'channel', product_line: 'line', project: 'project', routine: 'routine' } as Record<string, string>)[tipo]}-${slug(nombre)}`;

/** Revisa una operación SIN escribir. Devuelve el error en palabras, o null si está bien. `created` = ids que el mismo plan crea antes. */
export function validateOp(op: Op, created: Set<string> = new Set()): string | null {
  const def = MENU[op.name]; const a = op.args || {};
  if (!def) return tr(`«${op.name}» no existe en el menú.`, `“${op.name}” is not in the menu.`);
  for (const k of def.required) if (a[k] === undefined || a[k] === null || a[k] === '') return tr(`${op.name}: falta «${k}».`, `${op.name}: “${k}” is missing.`);
  const exists = (id: unknown) => created.has(String(id)) || !!nodeOk(id);
  for (const k of ['ficha', 'desde', 'hacia']) if (a[k] !== undefined && a[k] !== '' && !exists(a[k])) return tr(`${op.name}: la ficha «${a[k]}» no existe. Usa un id de la lista de fichas.`, `${op.name}: the note “${a[k]}” does not exist. Use an id from the list of notes.`);
  if (op.name === 'agendar') for (const id of linked(a)) if (!exists(id)) return tr(`agendar: la ficha «${id}» no existe. Usa un id de la lista, búscala, o pregunta quién es.`, `agendar: the note “${id}” does not exist. Use an id from the list, search for it, or ask who it is.`);
  for (const k of ['fecha', 'vence', 'proximo_paso_fecha', 'fecha_fin']) if (a[k] && !DAY.test(String(a[k]))) return tr(`${op.name}: «${k}» debe ser AAAA-MM-DD.`, `${op.name}: “${k}” must be YYYY-MM-DD.`);
  for (const k of ['hora', 'hora_fin']) if (a[k] && !TIME.test(String(a[k]))) return tr(`${op.name}: «${k}» debe ser HH:MM en 24 horas.`, `${op.name}: “${k}” must be HH:MM in 24-hour time.`);
  if (op.name === 'registrar_indicador' && !Number.isFinite(Number(a.valor))) return tr('registrar_indicador: «valor» debe ser un número.', 'registrar_indicador: “valor” must be a number.');
  if (op.name === 'conectar' && !RELATIONS.includes(String(a.relacion))) return tr(`conectar: la relación «${a.relacion}» no está permitida. Usa: ${RELATIONS.join(', ')}.`, `conectar: the relation “${a.relacion}” is not allowed. Use: ${RELATIONS.join(', ')}.`);
  if (op.name === 'actualizar_campos') {
    if (!a.campos || typeof a.campos !== 'object' || Array.isArray(a.campos) || !Object.keys(a.campos).length) return tr('actualizar_campos: «campos» debe ser un objeto con al menos un dato.', 'actualizar_campos: “campos” must be an object with at least one value.');
    const bad = Object.keys(a.campos).filter(k => PROTECTED.has(k) || !/^[a-z][a-z0-9_]{1,60}$/.test(k)); if (bad.length) return tr(`actualizar_campos: no se pueden cambiar ${bad.join(', ')}.`, `actualizar_campos: these cannot be changed: ${bad.join(', ')}.`);
  }
  if (op.name === 'crear_ficha') {
    if (!FOLDER[a.tipo]) return tr(`crear_ficha: tipo «${a.tipo}» no permitido.`, `crear_ficha: type “${a.tipo}” is not allowed.`);
    const id = newId(a.tipo, String(a.nombre)); if (nodeOk(id) || created.has(id)) return tr(`crear_ficha: ya existe la ficha «${id}». Úsala en vez de crear otra.`, `crear_ficha: the note “${id}” already exists. Use it instead of creating another.`);
    const same = loadBrainGraph().allNodes?.find(n => n.type === a.tipo && slug(String(n.title).replace(/^[A-Za-z ]+:\s*/, '')) === slug(String(a.nombre)));
    if (same) return tr(`crear_ficha: ya existe «${same.title}» (${same.id}). Úsala en vez de crear otra.`, `crear_ficha: “${same.title}” (${same.id}) already exists. Use it instead of creating another.`);
    const mail = String(a.campos?.email_primary || '').trim().toLowerCase();
    if (mail) { const owner = loadBrainGraph().allNodes?.find(n => String(n.frontmatter?.email_primary || '').trim().toLowerCase() === mail); if (owner) return tr(`crear_ficha: el correo ${mail} ya es de «${owner.title}» (${owner.id}). Usa esa ficha (actualizar_campos si hay datos nuevos).`, `crear_ficha: the email ${mail} already belongs to “${owner.title}” (${owner.id}). Use that note (actualizar_campos if there is new data).`); }
    for (const c of Array.isArray(a.conectar_con) ? a.conectar_con : []) { if (!exists(c?.hacia)) return tr(`crear_ficha: no existe la ficha «${c?.hacia}» para conectar.`, `crear_ficha: the note “${c?.hacia}” to connect to does not exist.`); if (!RELATIONS.includes(String(c?.relacion))) return tr(`crear_ficha: relación «${c?.relacion}» no permitida.`, `crear_ficha: relation “${c?.relacion}” is not allowed.`); }
  }
  if (op.name === 'crear_tarea') {
    const key = (v: unknown) => nrm(v).replace(/[^a-z0-9 ]/g, '').slice(0, 60);
    const dup = getUnifiedBrainTasks().tasks.find(t => !t.isCompleted && t.sourceNodeId === a.ficha && key(t.title) === key(a.titulo));
    if (dup) return tr(`crear_tarea: esa tarea ya existe en ${a.ficha} (${dup.id}). No la dupliques; si cambia la fecha usa reprogramar_tarea.`, `crear_tarea: that task already exists in ${a.ficha} (${dup.id}). Do not duplicate it; if the date changes use reprogramar_tarea.`);
  }
  if (op.name === 'cancelar_evento' && !listEvents(getVaultPath()).some(e => e.title.toLowerCase() === String(a.titulo).toLowerCase() && e.date === a.fecha)) return tr(`cancelar_evento: no hay un evento «${a.titulo}» el ${a.fecha}.`, `cancelar_evento: there is no event “${a.titulo}” on ${a.fecha}.`);
  if (op.name === 'compartir' && !['private', 'shared', 'public'].includes(String(a.visibilidad))) return tr('compartir: visibilidad debe ser private, shared o public.', 'compartir: visibility must be private, shared or public.');
  return null;
}
/** Id que crearía una operación crear_ficha (para que el resto del plan pueda referirse a ella). */
export const createdIdOf = (op: Op) => (op.name === 'crear_ficha' && FOLDER[op.args?.tipo] ? newId(op.args.tipo, String(op.args.nombre || '')) : null);
/** A qué interruptor de autonomía pertenece cada operación. */
const KIND: Record<string, 'agenda' | 'novedades' | 'contactos' | 'cifras'> = { crear_tarea: 'agenda', completar_tarea: 'agenda', reprogramar_tarea: 'agenda', agendar: 'agenda', cancelar_evento: 'agenda', registrar_novedad: 'novedades', actualizar_campos: 'novedades', conectar: 'novedades', desconectar: 'novedades', crear_ficha: 'contactos', registrar_indicador: 'cifras' };
export const kindOf = (op: Op) => KIND[op.name] || null;
export const kindName = (k: string): string => ({ agenda: tr('tareas y agenda', 'tasks and agenda'), novedades: tr('novedades y datos de fichas', 'updates and note data'), contactos: tr('fichas nuevas (contactos, empresas)', 'new notes (contacts, companies)'), cifras: tr('cifras e indicadores', 'figures and indicators') } as Record<string, string>)[k] || k;
/**
 * Referencias a fichas que el mismo plan crea. El modelo no conoce el id que tendrá una ficha nueva, así que puede
 * escribir «nueva:Nombre» (o el nombre tal cual); aquí se cambia por el id real. Además se ordena el plan: primero
 * las fichas nuevas (empresas antes que personas), después todo lo demás.
 */
export function resolveRefs(ops: Op[]): Op[] {
  const key = (v: unknown) => slug(String(v || '').replace(/^nueva:\s*/i, ''));
  const made = new Map<string, string>();
  for (const op of ops) { const id = createdIdOf(op); if (id) made.set(key(op.args.nombre), id); }
  if (!made.size) return ops;
  const fix = (v: unknown): unknown => { if (typeof v !== 'string' || !v.trim()) return v; if (nodeOk(v)) return v; return made.get(key(v)) || ([...made.values()].includes(v) ? v : v); };
  const out = ops.map(op => { const a = { ...(op.args || {}) };
    for (const k of ['ficha', 'desde', 'hacia']) if (a[k] !== undefined) a[k] = fix(a[k]);
    if (Array.isArray(a.con)) a.con = a.con.map(fix); else if (typeof a.con === 'string') a.con = a.con.split(/[,;]\s*/).map(fix);
    if (Array.isArray(a.conectar_con)) a.conectar_con = a.conectar_con.map((c: any) => ({ ...c, hacia: fix(c?.hacia) }));
    return { name: op.name, args: a }; });
  const rank = (op: Op) => (op.name !== 'crear_ficha' ? 2 : op.args?.tipo === 'person' ? 1 : 0);
  return out.map((op, i) => ({ op, i })).sort((x, y) => rank(x.op) - rank(y.op) || x.i - y.i).map(x => x.op);
}
export const levelOf = (op: Op): Level => MENU[op.name]?.level || 'aprobar';
export const touchesOf = (op: Op): string[] => (MENU[op.name]?.touches?.(op.args || {}) || []).filter(Boolean);

/** La operación dicha en palabras, para el recibo y la bandeja de aprobación. */
export function describeOp(op: Op): string {
  const a = op.args || {};
  switch (op.name) {
    case 'registrar_novedad': return tr(`Anotar en ${a.ficha}: «${String(a.resumen).slice(0, 160)}»${a.proximo_paso_fecha ? ` · próximo paso ${a.proximo_paso_fecha}` : ''}`, `Note in ${a.ficha}: “${String(a.resumen).slice(0, 160)}”${a.proximo_paso_fecha ? ` · next step ${a.proximo_paso_fecha}` : ''}`);
    case 'crear_tarea': return tr(`Crear tarea en ${a.ficha}: «${a.titulo}»${a.vence ? ` para el ${a.vence}` : ''}`, `Create task in ${a.ficha}: “${a.titulo}”${a.vence ? ` due ${a.vence}` : ''}`);
    case 'completar_tarea': return tr(`Completar la tarea ${a.tarea}`, `Complete task ${a.tarea}`);
    case 'reprogramar_tarea': return tr(`Mover la tarea ${a.tarea} al ${a.vence}`, `Move task ${a.tarea} to ${a.vence}`);
    case 'agendar': return tr(`Agenda: «${eventTitle(a)}» el ${a.fecha}${a.hora ? ` a las ${a.hora}` : ''}${linked(a).length ? ` · se anota en ${linked(a).join(', ')}` : ''}`, `Agenda: “${eventTitle(a)}” on ${a.fecha}${a.hora ? ` at ${a.hora}` : ''}${linked(a).length ? ` · noted in ${linked(a).join(', ')}` : ''}`);
    case 'cancelar_evento': return tr(`Quitar de la agenda «${a.titulo}» del ${a.fecha}`, `Remove from the agenda “${a.titulo}” of ${a.fecha}`);
    case 'registrar_indicador': return tr(`Indicador «${a.nombre}»: ${a.valor}${a.unidad ? ' ' + a.unidad : ''}`, `Indicator “${a.nombre}”: ${a.valor}${a.unidad ? ' ' + a.unidad : ''}`);
    case 'actualizar_campos': return tr(`Actualizar ${a.ficha}: `, `Update ${a.ficha}: `) + Object.entries(a.campos || {}).map(([k, v]) => `${k} = ${String(v).slice(0, 60)}`).join(', ');
    case 'conectar': return tr(`Conectar ${a.desde} → ${a.hacia} (${a.relacion})`, `Connect ${a.desde} → ${a.hacia} (${a.relacion})`);
    case 'desconectar': return tr(`Desconectar ${a.desde} → ${a.hacia} (${a.relacion})`, `Disconnect ${a.desde} → ${a.hacia} (${a.relacion})`);
    case 'crear_ficha': { const extra = a.campos && Object.keys(a.campos).length ? ` (${Object.entries(a.campos).map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`).join(', ').slice(0, 200)})` : ''; const conn = Array.isArray(a.conectar_con) && a.conectar_con.length ? a.conectar_con.map((c: any) => c?.hacia).join(', ') : '';
      return tr(`Crear ficha de ${a.tipo}: «${a.nombre}»${extra}${conn ? ` · conectada a ${conn}` : ' · SIN CONECTAR'}`, `Create ${a.tipo} note: “${a.nombre}”${extra}${conn ? ` · connected to ${conn}` : ' · NOT CONNECTED'}`); }
    case 'borrar_ficha': return tr(`BORRAR la ficha ${a.ficha} (motivo: ${a.motivo})`, `DELETE note ${a.ficha} (reason: ${a.motivo})`);
    case 'marcar_verificado': return tr(`Marcar ${a.ficha} como verificada (fuente: ${a.fuente})`, `Mark ${a.ficha} as verified (source: ${a.fuente})`);
    case 'compartir': return tr(`Cambiar quién ve ${a.ficha}: ${a.visibilidad}`, `Change who can see ${a.ficha}: ${a.visibilidad}`);
    default: return op.name;
  }
}

const short = (t: unknown) => String(t || '').replace(/^[A-Za-zÁ-ú ]{2,24}:\s*/, '').trim();
const titleOf = (id: string) => { const f = nodeOk(id); if (!f) return id; const n = readNoteStrict(f); return n.ok ? short(n.frontmatter.title) || id : id; };
const kindWord = (k: unknown) => (tw({ reunion: 'Reunión', viaje: 'Viaje', evento: 'Evento' }[String(k)] || 'Reunión', { reunion: 'Meeting', viaje: 'Trip', evento: 'Event' }[String(k)] || 'Meeting'));
const nrm = (v: unknown) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
/** Título completo del evento: con quién y para qué. Lo arma la app, no el modelo. */
export function eventTitle(a: any): string {
  const raw = String(a?.titulo || '').trim(); const names = linked(a).map(titleOf);
  const missing = names.filter(n => !nrm(raw).includes(nrm(n).split(' ')[0]));
  if (!names.length || !missing.length) return raw.slice(0, 160);
  const kind = kindWord(a?.tipo); const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} ${tw('y', 'and')} ${names[names.length - 1]}` : names[0];
  const topic = raw.replace(/^(reuni[oó]n|llamada|meeting|call|viaje|trip|evento|event)\b[:\s-]*/i, '').trim();
  return `${kind} ${tw('con', 'with')} ${who}${topic ? `: ${topic}` : ''}`.slice(0, 160);
}
const link = (file: string) => `[[${path.basename(file, '.md')}]]`;
/** Ejecuta UNA operación ya revisada. Lanza Error con el motivo si no se pudo. */
export function executeOp(op: Op): string {
  const a = op.args || {}; const vault = getVaultPath(); const by = actorLabel('Cerebro');
  const must = (r: { ok: boolean; message?: string; error?: string }) => { if (!r.ok) throw new Error(r.message || r.error || tr('No se pudo.', 'It could not be done.')); };
  switch (op.name) {
    case 'registrar_novedad': {
      const r = recordUpdate({ nodeId: a.ficha, summary: a.resumen, date: a.fecha, type: a.tipo, source: a.fuente, state: a.estado_actual,
        followup: a.proximo_paso_fecha || a.proximo_paso ? { date: a.proximo_paso_fecha, action: a.proximo_paso } : undefined,
        lastEmail: a.correo_asunto || a.correo_fecha || a.correo_de ? { subject: a.correo_asunto, date: a.correo_fecha, sender: a.correo_de } : undefined });
      if (!r.ok) throw new Error(r.error); return r.done.join('; ');
    }
    case 'crear_tarea': { const r = createBrainTask({ title: String(a.titulo), dueDate: a.vence, priority: ['High', 'Medium', 'Low'].includes(a.prioridad) ? a.prioridad : undefined, targetNodeId: a.ficha }); must(r); return tr(`Tarea «${a.titulo}» creada (${r.taskId})`, `Task “${a.titulo}” created (${r.taskId})`); }
    case 'completar_tarea': { must(completeBrainTask(String(a.tarea), by)); return tr(`Tarea ${a.tarea} completada`, `Task ${a.tarea} completed`); }
    case 'reprogramar_tarea': { must(rescheduleBrainTask(String(a.tarea), String(a.vence))); return tr(`Tarea ${a.tarea} movida al ${a.vence}`, `Task ${a.tarea} moved to ${a.vence}`); }
    case 'agendar': {
      const kind = ['reunion', 'viaje', 'evento'].includes(a.tipo) ? a.tipo : 'reunion';
      const ids = linked(a); const title = eventTitle({ ...a, tipo: kind });
      // La misma reunión (mismo título, o mismas fichas y tema) a ±45 días se MUEVE; no se crea otra.
      const sameSet = (e: { nodeIds?: string[] }) => !!e.nodeIds?.length && e.nodeIds.length === ids.length && ids.every(x => e.nodeIds!.includes(x));
      const same = listEvents(vault).filter(e => e.repeat === 'none' && e.kind === kind && (nrm(e.title) === nrm(title) || nrm(e.title) === nrm(a.titulo) || (sameSet(e) && nrm(e.title).includes(nrm(a.titulo)))))
        .sort((x, y) => Math.abs(Date.parse(x.date) - Date.parse(a.fecha)) - Math.abs(Date.parse(y.date) - Date.parse(a.fecha)))[0];
      const near = same && Math.abs(Date.parse(same.date) - Date.parse(a.fecha)) <= 45 * 86400000 ? same : null;
      const oldDate = near?.date, oldTime = near?.time;
      const ev = upsertEvent(vault, { ...(near ? { id: near.id } : {}), kind, title, date: a.fecha, ...(a.hora ? { time: a.hora } : {}), ...(a.hora_fin ? { endTime: a.hora_fin } : {}), ...(a.fecha_fin ? { endDate: a.fecha_fin } : {}), ...(a.lugar ? { location: a.lugar } : {}), ...(ids.length ? { nodeIds: [...new Set([...(near?.nodeIds || []), ...ids])] } : {}), source: 'cerebro' }, by);
      const moved = !!near && (oldDate !== ev.date || (oldTime || '') !== (ev.time || ''));
      const whenTxt = `${ev.date}${ev.time ? tw(' a las ', ' at ') + ev.time : ''}`; // lo que queda escrito en la ficha
      const whenShow = `${ev.date}${ev.time ? tr(' a las ', ' at ') + ev.time : ''}`; // lo que se le muestra a quien pidió
      // Motor de guardado: la reunión también vive en la ficha de cada persona o empresa nombrada.
      if (!near || moved) for (const id of ev.nodeIds || []) {
        const f = nodeOk(id); if (!f) continue; const cur = readNoteStrict(f);
        const follows = cur.ok && moved && String(cur.frontmatter.next_followup_date || '').slice(0, 10) === oldDate;
        const r = recordUpdate({ nodeId: id, type: 'reunion', source: tw('Agenda', 'Agenda'), summary: moved ? tw(`«${ev.title}» pasó del ${oldDate}${oldTime ? ' ' + oldTime : ''} al ${whenTxt}.`, `“${ev.title}” moved from ${oldDate}${oldTime ? ' ' + oldTime : ''} to ${whenTxt}.`) : tw(`«${ev.title}» agendada para el ${whenTxt}.`, `“${ev.title}” scheduled for ${whenTxt}.`), ...(follows ? { followup: { date: ev.date } } : {}) });
        if (!r.ok) throw new Error(r.error);
      }
      return moved ? tr(`«${ev.title}» movida del ${oldDate} al ${whenShow}`, `“${ev.title}” moved from ${oldDate} to ${whenShow}`) : tr(`«${ev.title}» en la agenda el ${whenShow}`, `“${ev.title}” on the agenda for ${whenShow}`);
    }
    case 'cancelar_evento': { const ev = listEvents(vault).find(e => e.title.toLowerCase() === String(a.titulo).toLowerCase() && e.date === a.fecha); if (!ev || !deleteEvent(vault, ev.id)) throw new Error(tr('No se encontró el evento.', 'The event was not found.')); return tr(`«${ev.title}» quitado de la agenda`, `“${ev.title}” removed from the agenda`); }
    case 'registrar_indicador': { const k = setKpi(vault, { name: a.nombre, value: Number(a.valor), unit: a.unidad, target: a.meta, period: a.periodo, note: a.nota }, by); return tr(`Indicador «${k.name}» = ${k.value}${k.unit ? ' ' + k.unit : ''}`, `Indicator “${k.name}” = ${k.value}${k.unit ? ' ' + k.unit : ''}`); }
    case 'actualizar_campos': { const f = nodeOk(a.ficha)!; const u = updateNoteFile(f, fm => { Object.assign(fm, a.campos); fm.last_updated_by = by; }); if (!u.ok) throw new Error(u.error); return tr(`${a.ficha}: ${Object.keys(a.campos).join(', ')} actualizado`, `${a.ficha}: ${Object.keys(a.campos).join(', ')} updated`); }
    case 'conectar': case 'desconectar': {
      const f = nodeOk(a.desde)!, t = nodeOk(a.hacia)!; const target = link(t);
      const u = updateNoteFile(f, fm => { const rel = (fm.relations && typeof fm.relations === 'object' ? fm.relations : (fm.relations = {})) as Record<string, any>; const cur: string[] = Array.isArray(rel[a.relacion]) ? rel[a.relacion] : rel[a.relacion] ? [rel[a.relacion]] : [];
        const has = cur.some(x => String(x).toLowerCase() === target.toLowerCase());
        if (op.name === 'conectar') { if (!has) rel[a.relacion] = [...cur, target]; } else { rel[a.relacion] = cur.filter(x => String(x).toLowerCase() !== target.toLowerCase()); if (!rel[a.relacion].length) delete rel[a.relacion]; } });
      if (!u.ok) throw new Error(u.error); loadBrainGraph(); return `${a.desde} ${op.name === 'conectar' ? '→' : '✕'} ${a.hacia} (${a.relacion})`;
    }
    case 'crear_ficha': {
      const [folder, prefix] = FOLDER[a.tipo]; const id = newId(a.tipo, String(a.nombre)); const safeName = String(a.nombre).replace(/[/\\?%*:|"<>]/g, '-').trim().slice(0, 80);
      const extra = Object.fromEntries(Object.entries(a.campos && typeof a.campos === 'object' ? a.campos : {}).filter(([k]) => !PROTECTED.has(k) && /^[a-z][a-z0-9_]{1,60}$/.test(k)));
      const relations: Record<string, string[]> = {};
      for (const c of Array.isArray(a.conectar_con) ? a.conectar_con : []) { const t = nodeOk(c.hacia); if (t) (relations[c.relacion] ||= []).push(link(t)); }
      const now = new Date().toISOString();
      const r = upsertNode({ relativePath: safeRelative(`${folder}/${prefix} - ${safeName}.md`), frontmatter: { id, title: `${prefix}: ${safeName}`, type: a.tipo, memory_tier: 'long_term', status: 'active', verification_status: 'unverified', created_at: now, created_by: by, ...extra, ...(Object.keys(relations).length ? { relations } : {}) }, body: `# ${safeName}\n\n${String(a.texto || '').trim()}\n` });
      must(r); loadBrainGraph(); return tr(`Ficha «${safeName}» creada (${id})`, `Note “${safeName}” created (${id})`);
    }
    case 'borrar_ficha': { const f = nodeOk(a.ficha)!; deleteVaultFile(path.relative(vault, f)); if (fs.existsSync(f)) throw new Error(tr('No se pudo borrar.', 'Could not delete it.')); loadBrainGraph(); return tr(`Ficha ${a.ficha} borrada (se puede deshacer desde el diario)`, `Note ${a.ficha} deleted (can be undone from the journal)`); }
    case 'marcar_verificado': { const f = nodeOk(a.ficha)!; const peek = readNoteStrict(f); if (!peek.ok) throw new Error(peek.error); const now = new Date().toISOString(); const u = updateNoteFile(f, fm => { fm.verification_status = 'verified'; fm.verified_at = now; fm.verified_by = by; fm.verification_source = String(a.fuente).slice(0, 200); }); if (!u.ok) throw new Error(u.error); return tr(`${a.ficha} marcada como verificada`, `${a.ficha} marked as verified`); }
    case 'compartir': { const r = setVisibility(vault, String(a.ficha), String(a.visibilidad), []); if (!(r as any).ok) throw new Error((r as any).error || tr('No se pudo cambiar.', 'Could not change it.')); return tr(`${a.ficha}: visibilidad ${a.visibilidad}`, `${a.ficha}: visibility ${a.visibilidad}`); }
  }
  throw new Error(tr(`«${op.name}» no existe en el menú.`, `“${op.name}” is not in the menu.`));
}
