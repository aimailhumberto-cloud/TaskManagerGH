/**
 * Expediente del caso: el MD con todo lo que sabe quien pide. Vive en el Cerebro (fuera de las fichas), con versiones.
 * Plantillas: una cabecera común, un bloque por tipo y «Otros datos» libre. Las plantillas de fichas están VIVAS:
 * sus campos salen de las fichas reales de ese tipo, así que un tipo nuevo trae su plantilla sin tocar código.
 */
import fs from 'fs';
import path from 'path';
import { cerebroDir } from './settings';
import { loadBrainGraph } from '../smjBrainService';
import { tr } from '../reqLang';

const dirOf = (vault: string) => path.join(cerebroDir(vault), 'expedientes');
const safe = (id: string) => id.replace(/[^a-z0-9-]/gi, '');
export const MAX_MD = 20000;

export function expedienteVersions(vault: string, id: string): number {
  try { return fs.readdirSync(dirOf(vault)).filter(f => f.startsWith(`${safe(id)}-v`)).length; } catch { return 0; }
}
export function readExpediente(vault: string, id: string): string {
  const n = expedienteVersions(vault, id); if (!n) return '';
  try { return fs.readFileSync(path.join(dirOf(vault), `${safe(id)}-v${n}.md`), 'utf8'); } catch { return ''; }
}
/** Guarda una versión nueva (si cambió). Devuelve cuántas versiones hay. */
export function saveExpediente(vault: string, id: string, md: string): number {
  const text = String(md || '').trim().slice(0, MAX_MD); if (!text) return expedienteVersions(vault, id);
  if (readExpediente(vault, id) === text) return expedienteVersions(vault, id);
  fs.mkdirSync(dirOf(vault), { recursive: true }); const n = expedienteVersions(vault, id) + 1;
  fs.writeFileSync(path.join(dirOf(vault), `${safe(id)}-v${n}.md`), text); return n;
}

// ---------- ¿Cuándo hace falta el expediente? ----------
const OUTSIDE = /(correo|e-?mail|hilo|adjunt|documento|pdf|whatsapp|llamada|minuta|reuni[oó]n de (ayer|hoy)|seg[uú]n |confirm[oó]|envi[oó]|dijo|inform[oó]|respondi[oó]|thread|attachment|document|call with|according to|confirmed|sent|said|replied)/i;
/** Un pedido corto y completo no necesita expediente; uno largo o que trae información de afuera, sí. */
export const needsExpediente = (text: string) => text.length > 200 || OUTSIDE.test(text);
/** «No tengo más», «es todo lo que tengo»: el Cerebro sigue con lo que hay. */
export const NO_MORE = /(no (lo |la |los |las )?tengo|no hay m[aá]s|es todo lo que (tengo|hay)|no dispongo|sin m[aá]s datos|i (do not|don'?t) have|nothing (else|more)|that'?s all i have|no more (data|info))/i;

// ---------- Plantillas ----------
const HEADER = () => [
  tr('## Cabecera', '## Header'),
  tr('- Quién pide:', '- Who asks:'),
  tr('- Para quién (persona dueña del Cerebro):', '- For whom (owner of the Brain):'),
  tr('- Fuente y fecha (correo, reunión, mensaje…):', '- Source and date (email, meeting, message…):'),
  tr('- Fichas que ya verifiqué (id o nombre completo):', '- Notes I already verified (id or full name):'),
  tr('- Qué confirmó mi persona, y con qué palabras:', '- What my person confirmed, in their words:'),
  tr('- Qué NO sé:', '- What I do NOT know:'),
];
const FREE = () => [tr('## Otros datos (libre: pega aquí el correo, notas, lo que no cabe arriba)', '## Other data (free: paste the email, notes, whatever does not fit above)'), ''];
/** Plantillas de lo que PASA (no son tipos de ficha). */
const ACTION: Record<string, { es: string; en: string; fields: [string, string][]; match: RegExp }> = {
  reunion_viaje: { es: 'Reunión o viaje', en: 'Meeting or trip', match: /(reuni[oó]n|viaje|vuelo|boleto|itinerario|cita|llamada con|meeting|trip|flight|ticket|itinerary)/i,
    fields: [['Qué es', 'What it is'], ['Fecha', 'Date'], ['Hora de salida o inicio', 'Start or departure time'], ['Hora de llegada o fin (y fecha si es otro día)', 'End or arrival time (and date if another day)'], ['Lugar', 'Place'], ['Con quién (nombres completos)', 'With whom (full names)'], ['Tramos: origen, destino, aerolínea, vuelo, escala', 'Legs: origin, destination, airline, flight, stop'], ['Estado: confirmado o sin verificar', 'Status: confirmed or unverified']] },
  tarea: { es: 'Tarea o seguimiento', en: 'Task or follow-up', match: /(tarea|seguimiento|pendiente|recordar|recordatorio|task|follow-?up|remind)/i,
    fields: [['Qué hay que hacer', 'What must be done'], ['Responsable', 'Owner'], ['Fecha', 'Date'], ['De qué ficha cuelga (persona, empresa, proyecto)', 'Which note it belongs to'], ['¿Ya existe una tarea parecida? Cuál', 'Is there a similar task already? Which']] },
  cambio_estado: { es: 'Cambio de estado o baja', en: 'Status change or removal', match: /(inactiv|renunci|baja|ya no trabaja|sali[oó] de|borra|elimina|desactiva|corrige el estado|resigned|left the company|inactive|delete|remove|deactivate)/i,
    fields: [['Qué ficha (nombre completo o id)', 'Which note (full name or id)'], ['Qué cambia', 'What changes'], ['Desde cuándo', 'Since when'], ['Motivo', 'Reason'], ['Qué se conserva (historial, relaciones)', 'What is kept (history, relations)']] },
  cifra: { es: 'Cifra o indicador', en: 'Figure or indicator', match: /(indicador|kpi|cifra|ventas de|cajas|meta de|forecast|pron[oó]stico|indicator|figure|sales of|target)/i,
    fields: [['Qué se mide', 'What is measured'], ['Valor', 'Value'], ['Unidad', 'Unit'], ['Periodo', 'Period'], ['Fuente', 'Source']] },
  novedad: { es: 'Novedad (algo que pasó)', en: 'Update (something that happened)', match: /$^/,
    fields: [['Qué pasó', 'What happened'], ['Quién lo dijo o lo hizo (nombre completo)', 'Who said or did it (full name)'], ['A quién o a qué afecta (persona, empresa, proyecto)', 'Who or what it affects'], ['Qué queda pendiente', 'What stays pending']] },
  varios: { es: 'Varios temas', en: 'Several topics', match: /$^/,
    fields: [['Tema 1 (qué pasó, quién, a quién afecta, qué queda pendiente)', 'Topic 1 (what happened, who, whom it affects, what is pending)'], ['Tema 2', 'Topic 2'], ['Tema 3', 'Topic 3']] },
};
/** Nombre amable ↔ tipos de ficha. Lo que no esté aquí usa el nombre del tipo tal cual (plantilla viva). */
const FRIENDLY: Record<string, { types: string[]; es: string; en: string; match: RegExp }> = {
  persona: { types: ['person'], es: 'Persona o contacto', en: 'Person or contact', match: /(contacto nuevo|nuevo contacto|nueva persona|agrega a .* como|new contact|new person)/i },
  empresa: { types: ['distributor', 'customer', 'organization'], es: 'Empresa (cliente, distribuidor, proveedor)', en: 'Company (customer, distributor, supplier)', match: /(nueva empresa|nuevo distribuidor|nuevo cliente|nuevo proveedor|new company|new distributor|new customer)/i },
  producto: { types: ['product_variant', 'product_line'], es: 'Producto', en: 'Product', match: /(nuevo producto|nueva presentaci[oó]n|sku|new product)/i },
  marca: { types: ['brand'], es: 'Marca', en: 'Brand', match: /(nueva marca|new brand)/i },
  mercado: { types: ['market'], es: 'Mercado', en: 'Market', match: /(nuevo mercado|new market)/i },
  pedido_exportacion: { types: ['export_order', 'order'], es: 'Pedido de exportación', en: 'Export order', match: /(pedido de exportaci[oó]n|orden de exportaci[oó]n|export order|contenedor)/i },
};
const INTERNAL = /^(id|title|type|memory_tier|tags|relations|source.*|.*sha256|icon_.*|completeness_score|last_.*|updated_at|created_at|observed_on|.*_audit|.*verification.*|registry_verified|promoted_.*|captured_at|lifecycle_stage|spatial_anchor|brain_id|owner|visibility|shared_with|evidence_note|prepared_at)$/;
const DEFAULT_FIELDS: Record<string, string[]> = {
  persona: ['nombre completo', 'empresa', 'cargo', 'correo', 'teléfono', 'país', 'con quién se relaciona', 'estado (activo/inactivo y desde cuándo)'],
  empresa: ['nombre', 'tipo (cliente, distribuidor, proveedor)', 'país o mercado', 'contactos', 'relación con SMJ'],
  producto: ['nombre', 'marca', 'presentación', 'unidades por caja'], marca: ['nombre', 'categoría'], mercado: ['país', 'región', 'estado'],
  pedido_exportacion: ['cliente o distribuidor', 'mercado', 'productos y cantidades', 'fecha de despacho', 'incoterm', 'estado'],
};
/** Campos reales más usados en las fichas de esos tipos (lo que hace viva a la plantilla). */
function liveFields(types: string[]): string[] {
  try {
    const g: any = loadBrainGraph(); const nodes: any[] = (g.allNodes || g.nodes || []).filter((n: any) => types.includes(n.type)); if (!nodes.length) return [];
    const count = new Map<string, number>();
    for (const n of nodes) for (const [k, v] of Object.entries(n.frontmatter || {})) if (v !== '' && v != null && !INTERNAL.test(k)) count.set(k, (count.get(k) || 0) + 1);
    return [...count].filter(([, c]) => c / nodes.length >= 0.3 || nodes.length < 4).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
  } catch { return []; }
}
/** Todas las plantillas que hay hoy: las de acción, las amables y una por cada tipo de ficha que exista en el Cerebro. */
export function templateList(): { name: string; label: string; kind: 'accion' | 'ficha' }[] {
  const out: { name: string; label: string; kind: 'accion' | 'ficha' }[] = [];
  for (const [k, v] of Object.entries(FRIENDLY)) out.push({ name: k, label: tr(v.es, v.en), kind: 'ficha' });
  for (const [k, v] of Object.entries(ACTION)) out.push({ name: k, label: tr(v.es, v.en), kind: 'accion' });
  try {
    const covered = new Set(Object.values(FRIENDLY).flatMap(f => f.types)); const g: any = loadBrainGraph();
    const types = new Set<string>((g.allNodes || g.nodes || []).map((n: any) => String(n.type || '')).filter(Boolean));
    for (const t of [...types].sort()) if (!covered.has(t) && !/^(working_memory|consolidation_session)$/.test(t)) out.push({ name: t, label: t.replace(/_/g, ' '), kind: 'ficha' });
  } catch {}
  return out;
}
/** Qué plantilla toca según lo que dice el pedido. */
export function detectTemplate(text: string): string {
  for (const [k, v] of Object.entries(FRIENDLY)) if (v.match.test(text)) return k;
  for (const k of ['cambio_estado', 'reunion_viaje', 'cifra', 'tarea']) if (ACTION[k].match.test(text)) return k;
  return 'novedad';
}
/** La plantilla en MD. «known» son líneas que el Cerebro ya entendió del pedido y deja escritas. */
export function templateMd(name: string, opts: { pedido?: string; quien?: string; known?: string[] } = {}): string {
  const a = ACTION[name]; const f = FRIENDLY[name];
  const label = a ? tr(a.es, a.en) : f ? tr(f.es, f.en) : name.replace(/_/g, ' ');
  let fields: string[];
  if (a) fields = a.fields.map(([es, en]) => tr(es, en));
  else { const live = liveFields(f ? f.types : [name]); fields = [...new Set([...(DEFAULT_FIELDS[name] || []), ...live])].slice(0, 16); if (!fields.length) fields = [tr('nombre', 'name'), tr('descripción', 'description')]; }
  const head = HEADER(); if (opts.quien) head[1] += ` ${opts.quien}`;
  return [tr(`# Expediente — ${label}`, `# Case file — ${label}`), '', opts.pedido ? tr(`**Pedido:** ${opts.pedido.slice(0, 500)}`, `**Request:** ${opts.pedido.slice(0, 500)}`) : '', '',
    ...head, '', ...(opts.known?.length ? [tr('## Lo que el Cerebro ya entendió', '## What the Brain already understood'), ...opts.known.map(k => `- ${k}`), ''] : []),
    `## ${label}`, ...fields.map(x => `- ${x}:`), '', ...FREE()].join('\n');
}
