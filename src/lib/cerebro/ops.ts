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
  if (!def) return `«${op.name}» no existe en el menú.`;
  for (const k of def.required) if (a[k] === undefined || a[k] === null || a[k] === '') return `${op.name}: falta «${k}».`;
  const exists = (id: unknown) => created.has(String(id)) || !!nodeOk(id);
  for (const k of ['ficha', 'desde', 'hacia']) if (a[k] !== undefined && a[k] !== '' && !exists(a[k])) return `${op.name}: la ficha «${a[k]}» no existe. Usa un id de la lista de fichas.`;
  if (op.name === 'agendar') for (const id of linked(a)) if (!exists(id)) return `agendar: la ficha «${id}» no existe. Usa un id de la lista, búscala, o pregunta quién es.`;
  for (const k of ['fecha', 'vence', 'proximo_paso_fecha', 'fecha_fin']) if (a[k] && !DAY.test(String(a[k]))) return `${op.name}: «${k}» debe ser AAAA-MM-DD.`;
  for (const k of ['hora', 'hora_fin']) if (a[k] && !TIME.test(String(a[k]))) return `${op.name}: «${k}» debe ser HH:MM en 24 horas.`;
  if (op.name === 'registrar_indicador' && !Number.isFinite(Number(a.valor))) return 'registrar_indicador: «valor» debe ser un número.';
  if (op.name === 'conectar' && !RELATIONS.includes(String(a.relacion))) return `conectar: la relación «${a.relacion}» no está permitida. Usa: ${RELATIONS.join(', ')}.`;
  if (op.name === 'actualizar_campos') {
    if (!a.campos || typeof a.campos !== 'object' || Array.isArray(a.campos) || !Object.keys(a.campos).length) return 'actualizar_campos: «campos» debe ser un objeto con al menos un dato.';
    const bad = Object.keys(a.campos).filter(k => PROTECTED.has(k) || !/^[a-z][a-z0-9_]{1,60}$/.test(k)); if (bad.length) return `actualizar_campos: no se pueden cambiar ${bad.join(', ')}.`;
  }
  if (op.name === 'crear_ficha') {
    if (!FOLDER[a.tipo]) return `crear_ficha: tipo «${a.tipo}» no permitido.`;
    const id = newId(a.tipo, String(a.nombre)); if (nodeOk(id) || created.has(id)) return `crear_ficha: ya existe la ficha «${id}». Úsala en vez de crear otra.`;
    const same = loadBrainGraph().allNodes?.find(n => n.type === a.tipo && slug(String(n.title).replace(/^[A-Za-z ]+:\s*/, '')) === slug(String(a.nombre)));
    if (same) return `crear_ficha: ya existe «${same.title}» (${same.id}). Úsala en vez de crear otra.`;
    const mail = String(a.campos?.email_primary || '').trim().toLowerCase();
    if (mail) { const owner = loadBrainGraph().allNodes?.find(n => String(n.frontmatter?.email_primary || '').trim().toLowerCase() === mail); if (owner) return `crear_ficha: el correo ${mail} ya es de «${owner.title}» (${owner.id}). Usa esa ficha (actualizar_campos si hay datos nuevos).`; }
    for (const c of Array.isArray(a.conectar_con) ? a.conectar_con : []) { if (!exists(c?.hacia)) return `crear_ficha: no existe la ficha «${c?.hacia}» para conectar.`; if (!RELATIONS.includes(String(c?.relacion))) return `crear_ficha: relación «${c?.relacion}» no permitida.`; }
  }
  if (op.name === 'crear_tarea') {
    const key = (v: unknown) => nrm(v).replace(/[^a-z0-9 ]/g, '').slice(0, 60);
    const dup = getUnifiedBrainTasks().tasks.find(t => !t.isCompleted && t.sourceNodeId === a.ficha && key(t.title) === key(a.titulo));
    if (dup) return `crear_tarea: esa tarea ya existe en ${a.ficha} (${dup.id}). No la dupliques; si cambia la fecha usa reprogramar_tarea.`;
  }
  if (op.name === 'cancelar_evento' && !listEvents(getVaultPath()).some(e => e.title.toLowerCase() === String(a.titulo).toLowerCase() && e.date === a.fecha)) return `cancelar_evento: no hay un evento «${a.titulo}» el ${a.fecha}.`;
  if (op.name === 'compartir' && !['private', 'shared', 'public'].includes(String(a.visibilidad))) return 'compartir: visibilidad debe ser private, shared o public.';
  return null;
}
/** Id que crearía una operación crear_ficha (para que el resto del plan pueda referirse a ella). */
export const createdIdOf = (op: Op) => (op.name === 'crear_ficha' && FOLDER[op.args?.tipo] ? newId(op.args.tipo, String(op.args.nombre || '')) : null);
/** A qué interruptor de autonomía pertenece cada operación. */
const KIND: Record<string, 'agenda' | 'novedades' | 'contactos' | 'cifras'> = { crear_tarea: 'agenda', completar_tarea: 'agenda', reprogramar_tarea: 'agenda', agendar: 'agenda', cancelar_evento: 'agenda', registrar_novedad: 'novedades', actualizar_campos: 'novedades', conectar: 'novedades', desconectar: 'novedades', crear_ficha: 'contactos', registrar_indicador: 'cifras' };
export const kindOf = (op: Op) => KIND[op.name] || null;
export const KIND_NAME: Record<string, string> = { agenda: 'tareas y agenda', novedades: 'novedades y datos de fichas', contactos: 'fichas nuevas (contactos, empresas)', cifras: 'cifras e indicadores' };
export const levelOf = (op: Op): Level => MENU[op.name]?.level || 'aprobar';
export const touchesOf = (op: Op): string[] => (MENU[op.name]?.touches?.(op.args || {}) || []).filter(Boolean);

/** La operación dicha en palabras, para el recibo y la bandeja de aprobación. */
export function describeOp(op: Op): string {
  const a = op.args || {};
  switch (op.name) {
    case 'registrar_novedad': return `Anotar en ${a.ficha}: «${String(a.resumen).slice(0, 160)}»${a.proximo_paso_fecha ? ` · próximo paso ${a.proximo_paso_fecha}` : ''}`;
    case 'crear_tarea': return `Crear tarea en ${a.ficha}: «${a.titulo}»${a.vence ? ` para el ${a.vence}` : ''}`;
    case 'completar_tarea': return `Completar la tarea ${a.tarea}`;
    case 'reprogramar_tarea': return `Mover la tarea ${a.tarea} al ${a.vence}`;
    case 'agendar': return `Agenda: «${eventTitle(a)}» el ${a.fecha}${a.hora ? ` a las ${a.hora}` : ''}${linked(a).length ? ` · se anota en ${linked(a).join(', ')}` : ''}`;
    case 'cancelar_evento': return `Quitar de la agenda «${a.titulo}» del ${a.fecha}`;
    case 'registrar_indicador': return `Indicador «${a.nombre}»: ${a.valor}${a.unidad ? ' ' + a.unidad : ''}`;
    case 'actualizar_campos': return `Actualizar ${a.ficha}: ${Object.entries(a.campos || {}).map(([k, v]) => `${k} = ${String(v).slice(0, 60)}`).join(', ')}`;
    case 'conectar': return `Conectar ${a.desde} → ${a.hacia} (${a.relacion})`;
    case 'desconectar': return `Desconectar ${a.desde} → ${a.hacia} (${a.relacion})`;
    case 'crear_ficha': return `Crear ficha de ${a.tipo}: «${a.nombre}»${a.campos && Object.keys(a.campos).length ? ` (${Object.entries(a.campos).map(([k, v]) => `${k}: ${String(v).slice(0, 50)}`).join(', ').slice(0, 200)})` : ''}${Array.isArray(a.conectar_con) && a.conectar_con.length ? ` · conectada a ${a.conectar_con.map((c: any) => c?.hacia).join(', ')}` : ' · SIN CONECTAR'}`;
    case 'borrar_ficha': return `BORRAR la ficha ${a.ficha} (motivo: ${a.motivo})`;
    case 'marcar_verificado': return `Marcar ${a.ficha} como verificada (fuente: ${a.fuente})`;
    case 'compartir': return `Cambiar quién ve ${a.ficha}: ${a.visibilidad}`;
    default: return op.name;
  }
}

const short = (t: unknown) => String(t || '').replace(/^[A-Za-zÁ-ú ]{2,24}:\s*/, '').trim();
const titleOf = (id: string) => { const f = nodeOk(id); if (!f) return id; const n = readNoteStrict(f); return n.ok ? short(n.frontmatter.title) || id : id; };
const KIND_WORD: Record<string, string> = { reunion: 'Reunión', viaje: 'Viaje', evento: 'Evento' };
const nrm = (v: unknown) => String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
/** Título completo del evento: con quién y para qué. Lo arma la app, no el modelo. */
export function eventTitle(a: any): string {
  const raw = String(a?.titulo || '').trim(); const names = linked(a).map(titleOf);
  const missing = names.filter(n => !nrm(raw).includes(nrm(n).split(' ')[0]));
  if (!names.length || !missing.length) return raw.slice(0, 160);
  const kind = KIND_WORD[a?.tipo] || 'Reunión'; const who = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  const topic = raw.replace(/^(reuni[oó]n|llamada|meeting|viaje|evento)\b[:\s-]*/i, '').trim();
  return `${kind} con ${who}${topic ? `: ${topic}` : ''}`.slice(0, 160);
}
const link = (file: string) => `[[${path.basename(file, '.md')}]]`;
/** Ejecuta UNA operación ya revisada. Lanza Error con el motivo si no se pudo. */
export function executeOp(op: Op): string {
  const a = op.args || {}; const vault = getVaultPath(); const by = actorLabel('Cerebro');
  const must = (r: { ok: boolean; message?: string; error?: string }) => { if (!r.ok) throw new Error(r.message || r.error || 'No se pudo.'); };
  switch (op.name) {
    case 'registrar_novedad': {
      const r = recordUpdate({ nodeId: a.ficha, summary: a.resumen, date: a.fecha, type: a.tipo, source: a.fuente, state: a.estado_actual,
        followup: a.proximo_paso_fecha || a.proximo_paso ? { date: a.proximo_paso_fecha, action: a.proximo_paso } : undefined,
        lastEmail: a.correo_asunto || a.correo_fecha || a.correo_de ? { subject: a.correo_asunto, date: a.correo_fecha, sender: a.correo_de } : undefined });
      if (!r.ok) throw new Error(r.error); return r.done.join('; ');
    }
    case 'crear_tarea': { const r = createBrainTask({ title: String(a.titulo), dueDate: a.vence, priority: ['High', 'Medium', 'Low'].includes(a.prioridad) ? a.prioridad : undefined, targetNodeId: a.ficha }); must(r); return `Tarea «${a.titulo}» creada (${r.taskId})`; }
    case 'completar_tarea': { must(completeBrainTask(String(a.tarea), by)); return `Tarea ${a.tarea} completada`; }
    case 'reprogramar_tarea': { must(rescheduleBrainTask(String(a.tarea), String(a.vence))); return `Tarea ${a.tarea} movida al ${a.vence}`; }
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
      const whenTxt = `${ev.date}${ev.time ? ' a las ' + ev.time : ''}`;
      // Motor de guardado: la reunión también vive en la ficha de cada persona o empresa nombrada.
      if (!near || moved) for (const id of ev.nodeIds || []) {
        const f = nodeOk(id); if (!f) continue; const cur = readNoteStrict(f);
        const follows = cur.ok && moved && String(cur.frontmatter.next_followup_date || '').slice(0, 10) === oldDate;
        const r = recordUpdate({ nodeId: id, type: 'reunion', source: 'Agenda', summary: moved ? `«${ev.title}» pasó del ${oldDate}${oldTime ? ' ' + oldTime : ''} al ${whenTxt}.` : `«${ev.title}» agendada para el ${whenTxt}.`, ...(follows ? { followup: { date: ev.date } } : {}) });
        if (!r.ok) throw new Error(r.error);
      }
      return moved ? `«${ev.title}» movida del ${oldDate} al ${whenTxt}` : `«${ev.title}» en la agenda el ${whenTxt}`;
    }
    case 'cancelar_evento': { const ev = listEvents(vault).find(e => e.title.toLowerCase() === String(a.titulo).toLowerCase() && e.date === a.fecha); if (!ev || !deleteEvent(vault, ev.id)) throw new Error('No se encontró el evento.'); return `«${ev.title}» quitado de la agenda`; }
    case 'registrar_indicador': { const k = setKpi(vault, { name: a.nombre, value: Number(a.valor), unit: a.unidad, target: a.meta, period: a.periodo, note: a.nota }, by); return `Indicador «${k.name}» = ${k.value}${k.unit ? ' ' + k.unit : ''}`; }
    case 'actualizar_campos': { const f = nodeOk(a.ficha)!; const u = updateNoteFile(f, fm => { Object.assign(fm, a.campos); fm.last_updated_by = by; }); if (!u.ok) throw new Error(u.error); return `${a.ficha}: ${Object.keys(a.campos).join(', ')} actualizado`; }
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
      must(r); loadBrainGraph(); return `Ficha «${safeName}» creada (${id})`;
    }
    case 'borrar_ficha': { const f = nodeOk(a.ficha)!; deleteVaultFile(path.relative(vault, f)); if (fs.existsSync(f)) throw new Error('No se pudo borrar.'); loadBrainGraph(); return `Ficha ${a.ficha} borrada (se puede deshacer desde el diario)`; }
    case 'marcar_verificado': { const f = nodeOk(a.ficha)!; const peek = readNoteStrict(f); if (!peek.ok) throw new Error(peek.error); const now = new Date().toISOString(); const u = updateNoteFile(f, fm => { fm.verification_status = 'verified'; fm.verified_at = now; fm.verified_by = by; fm.verification_source = String(a.fuente).slice(0, 200); }); if (!u.ok) throw new Error(u.error); return `${a.ficha} marcada como verificada`; }
    case 'compartir': { const r = setVisibility(vault, String(a.ficha), String(a.visibilidad), []); if (!(r as any).ok) throw new Error((r as any).error || 'No se pudo cambiar.'); return `${a.ficha}: visibilidad ${a.visibilidad}`; }
  }
  throw new Error(`«${op.name}» no existe en el menú.`);
}
