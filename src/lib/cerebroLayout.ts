/**
 * Motor de layout nativo del Cerebro SMJ: vistas "Brujula" (radial) y "Version 1 Ajustada" (columnas).
 *
 * Reglas:
 *  - El eje se define por el tipo del nodo; la columna/anillo por su rol; el angulo/carril se hereda del padre.
 *  - El padre sale SOLO del frontmatter del vault (market, parent_distributor_id, supplied_by, relations.*,
 *    reports_to, department, parent_id). Si no se puede resolver, el nodo va a la bandeja "Sin ubicar".
 *  - Las posiciones manuales (spatial_override / visual_coordinates) siempre ganan.
 * Modulo puro (sin fs): se usa en el cliente. La configuracion llega desde vault/00-System/layouts/*.yaml.
 */

export type LayoutViewKey = 'brujula' | 'version-1-ajustada';
export type AxisKey = 'west' | 'north' | 'east' | 'south' | 'northwest' | 'southeast' | 'center' | 'unplaced';
export type LayerKey = 'core' | 'market' | 'portfolio' | 'organization' | 'supply' | 'projects' | 'cognitive' | 'unplaced';

export interface AxisConfig {
  label: string;
  angle: number; // grados, matematico (0 = este, 90 = norte)
  span: number; // apertura angular en grados
  order_from_center: string[]; // columnas del centro hacia afuera
}

export interface LayoutConfig {
  view: LayoutViewKey;
  version: number;
  center_node: string;
  axes: Record<'west' | 'north' | 'east' | 'south', AxisConfig>;
  column_order: string[]; // V1: columnas de oeste a este (incluye 'core')
  north_rows: string[]; // V1: filas desde el centro hacia arriba
  south_rows: string[]; // V1: filas desde el centro hacia abajo
  country_order: string[];
  country_tags: Record<string, string>;
  brand_order: string[];
  spacing: {
    ring_base: number;
    ring_step: number;
    min_node_gap: number;
    column_width: number;
    row_height: number;
    lane_padding: number;
    tray_gap: number;
  };
  visible_layers: LayerKey[];
}

const COUNTRY_TAGS: Record<string, string> = {
  belize: 'BZ', panama: 'PA', usa: 'US', canada: 'CA', trinidad: 'TT', 'costa-rica': 'CR', 'el-salvador': 'SV',
  barbados: 'BB', guyana: 'GY', 'saint-lucia': 'LC', suriname: 'SR', jamaica: 'JM', 'south-africa': 'ZA',
};

const BASE_AXES: LayoutConfig['axes'] = {
  west: { label: 'MERCADO', angle: 180, span: 110, order_from_center: ['outlet', 'channel', 'distributor', 'country'] },
  north: { label: 'PORTAFOLIO', angle: 90, span: 80, order_from_center: ['brand', 'line', 'flavor', 'packaging'] },
  east: { label: 'ORGANIZACION', angle: 0, span: 90, order_from_center: ['chairman', 'ceo', 'head', 'person'] },
  south: { label: 'SUPPLY', angle: 270, span: 70, order_from_center: ['site', 'supplier', 'logistics'] },
};

export const DEFAULT_LAYOUTS: Record<LayoutViewKey, LayoutConfig> = {
  brujula: {
    view: 'brujula',
    version: 1,
    center_node: 'core-sm-jaleel',
    axes: BASE_AXES,
    column_order: ['country', 'distributor', 'channel', 'outlet', 'core', 'chairman', 'ceo', 'head', 'person'],
    north_rows: ['brand', 'line', 'flavor', 'packaging'],
    south_rows: ['site', 'supplier', 'logistics'],
    country_order: ['belize', 'panama', 'usa', 'canada', 'trinidad', 'costa-rica', 'el-salvador', 'jamaica', 'barbados', 'saint-lucia', 'guyana', 'suriname', 'south-africa'],
    country_tags: COUNTRY_TAGS,
    brand_order: ['brand-chubby', 'brand-fruta', 'brand-busta', 'brand-oasis', 'brand-altitude'],
    spacing: { ring_base: 190, ring_step: 150, min_node_gap: 52, column_width: 230, row_height: 58, lane_padding: 24, tray_gap: 64 },
    visible_layers: ['core', 'market', 'portfolio', 'organization', 'supply', 'projects', 'cognitive', 'unplaced'],
  },
  'version-1-ajustada': {
    view: 'version-1-ajustada',
    version: 1,
    center_node: 'core-sm-jaleel',
    axes: BASE_AXES,
    column_order: ['country', 'distributor', 'channel', 'outlet', 'core', 'chairman', 'ceo', 'head', 'person'],
    north_rows: ['brand', 'line', 'flavor', 'packaging'],
    south_rows: ['site', 'supplier', 'logistics'],
    country_order: ['belize', 'panama', 'usa', 'canada', 'trinidad', 'costa-rica', 'el-salvador', 'jamaica', 'barbados', 'saint-lucia', 'guyana', 'suriname', 'south-africa'],
    country_tags: COUNTRY_TAGS,
    brand_order: ['brand-chubby', 'brand-fruta', 'brand-busta', 'brand-oasis', 'brand-altitude'],
    spacing: { ring_base: 190, ring_step: 150, min_node_gap: 52, column_width: 230, row_height: 58, lane_padding: 24, tray_gap: 64 },
    visible_layers: ['core', 'market', 'portfolio', 'organization', 'supply', 'projects', 'cognitive', 'unplaced'],
  },
};

/** Fusiona la config del vault con los defaults (los defaults solo rellenan huecos). */
export function mergeLayoutConfig(view: LayoutViewKey, raw: any): LayoutConfig {
  const base = DEFAULT_LAYOUTS[view];
  if (!raw || typeof raw !== 'object') return base;
  const axes: any = { ...base.axes };
  for (const k of Object.keys(base.axes) as (keyof LayoutConfig['axes'])[]) {
    if (raw.axes && raw.axes[k]) axes[k] = { ...base.axes[k], ...raw.axes[k] };
  }
  return {
    ...base,
    ...raw,
    view,
    axes,
    spacing: { ...base.spacing, ...(raw.spacing || {}) },
    country_tags: { ...base.country_tags, ...(raw.country_tags || {}) },
    column_order: Array.isArray(raw.column_order) ? raw.column_order : base.column_order,
    north_rows: Array.isArray(raw.north_rows) ? raw.north_rows : base.north_rows,
    south_rows: Array.isArray(raw.south_rows) ? raw.south_rows : base.south_rows,
    country_order: Array.isArray(raw.country_order) ? raw.country_order : base.country_order,
    brand_order: Array.isArray(raw.brand_order) ? raw.brand_order : base.brand_order,
    visible_layers: Array.isArray(raw.visible_layers) ? raw.visible_layers : base.visible_layers,
  };
}

// ---------------------------------------------------------------------------------------------
// Clasificacion y resolucion de padres
// ---------------------------------------------------------------------------------------------

export interface LayoutNodeInput {
  id: string;
  title: string;
  type: string;
  body?: string;
  filePath?: string;
  frontmatter?: Record<string, any>;
}

export interface Placement {
  id: string;
  axis: AxisKey;
  column: string;
  layer: LayerKey;
  parentId: string | null;
  lane: string | null; // clave de pais (oeste) o rama (otros ejes)
  reason?: string; // solo para Sin ubicar
}

export function countryKeyFromText(raw: string): string | null {
  const text = String(raw || '').toLowerCase();
  if (!text) return null;
  if (text.includes('beliz') || text.includes('belice')) return 'belize';
  if (text.includes('panam')) return 'panama';
  if (text.includes('canad')) return 'canada';
  if (text.includes('united-states') || text.includes('united states') || text.includes('estados unidos') || text.includes('usa') || text.includes('ee. uu') || text.includes('florida')) return 'usa';
  if (text.includes('costa')) return 'costa-rica';
  if (text.includes('salvador')) return 'el-salvador';
  if (text.includes('barbados')) return 'barbados';
  if (text.includes('guyana')) return 'guyana';
  if (text.includes('lucia')) return 'saint-lucia';
  if (text.includes('surinam')) return 'suriname';
  if (text.includes('jamaica')) return 'jamaica';
  if (text.includes('south africa') || text.includes('south-africa') || text.includes('sudafrica') || text.includes('sudáfrica')) return 'south-africa';
  if (text.includes('trinidad')) return 'trinidad';
  return null;
}

function toRefs(v: any): string[] {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v.flatMap(toRefs);
  if (typeof v !== 'string') return [];
  const s = v.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
  return s ? [s] : [];
}

function basename(p?: string): string {
  if (!p) return '';
  const b = p.split(/[\\/]/).pop() || '';
  return b.replace(/\.md$/i, '');
}

export function buildRefIndex(nodes: LayoutNodeInput[]): (ref: string) => string | null {
  const idx = new Map<string, string>();
  for (const n of nodes) {
    idx.set(n.id.toLowerCase(), n.id);
    if (n.title) idx.set(String(n.title).toLowerCase(), n.id);
    const b = basename(n.filePath);
    if (b) idx.set(b.toLowerCase(), n.id);
  }
  return (ref: string) => {
    const k = String(ref || '').replace(/^\[\[|\]\]$/g, '').split('|')[0].trim().toLowerCase();
    if (!k) return null;
    return idx.get(k) || idx.get(k.replace(/[^a-z0-9_-]+/g, '-')) || null;
  };
}

const MARKET_TYPES = new Set(['market', 'country']);
const OPERATOR_TYPES = new Set(['distributor', 'operator']);
const OUTLET_TYPES = new Set(['customer', 'client_group', 'client', 'catalog_listing', 'outlet']);
const COGNITIVE_TYPES = new Set(['routine', 'working_memory', 'consolidation_session']);
const SUPPLY_TYPES: Record<string, string> = { site: 'site', plant: 'site', production_line: 'site', supplier: 'supplier', input: 'supplier', logistics: 'logistics', carrier: 'logistics', warehouse: 'logistics' };

function marketKeyOf(n: LayoutNodeInput): string | null {
  const fm = n.frontmatter || {};
  return (
    countryKeyFromText(toRefs(fm.market).join(' ')) ||
    countryKeyFromText(`${fm.country_name || ''} ${fm.based_in_country || ''} ${fm.country || ''}`) ||
    (MARKET_TYPES.has(n.type) ? countryKeyFromText(`${n.id} ${n.title}`) : null)
  );
}

function relRefs(fm: Record<string, any>, ...keys: string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    out.push(...toRefs(fm[k]));
    if (fm.relations && typeof fm.relations === 'object') out.push(...toRefs(fm.relations[k]));
  }
  return out;
}

function reportsToRefs(fm: Record<string, any>): string[] {
  const refs = relRefs(fm, 'reports_to', 'reports_to_person', 'manager_person');
  const mig = fm.reporting_predicate_migration;
  if (refs.length === 0 && mig && mig.canonical_predicate === 'reports_to' && mig.previous_aliases) {
    for (const v of Object.values(mig.previous_aliases)) refs.push(...toRefs(v as any));
  }
  return refs;
}

/** Clasifica todos los nodos: eje, columna, capa y padre real (o motivo de Sin ubicar). */
export function classifyNodes(nodes: LayoutNodeInput[], centerId = 'core-sm-jaleel'): Map<string, Placement> {
  const resolve = buildRefIndex(nodes);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out = new Map<string, Placement>();
  const core = byId.get(centerId) ? centerId : (nodes.find(n => n.type === 'core')?.id || null);
  const first = (refs: string[], pred?: (id: string) => boolean): string | null => {
    for (const r of refs) {
      const id = resolve(r);
      if (id && (!pred || pred(id))) return id;
    }
    return null;
  };
  const typeOf = (id: string) => byId.get(id)?.type || '';
  const marketNodeFor = (key: string | null) => (key ? nodes.find(m => MARKET_TYPES.has(m.type) && marketKeyOf(m) === key)?.id || null : null);

  // Cadena de mando: Chairman y CEO detectados desde el vault (job_title / chairman_of / supervises / reports_to).
  const persons = nodes.filter(n => n.type === 'person');
  const chairman = persons.find(p => /chairman/i.test(String(p.frontmatter?.job_title || '')) || relRefs(p.frontmatter || {}, 'chairman_of').length > 0)?.id || null;
  const supervisedByChair = chairman ? relRefs(byId.get(chairman)!.frontmatter || {}, 'supervises').map(r => resolve(r)).filter(Boolean) as string[] : [];
  const ceo =
    persons.find(p => /\b(ceo|chief executive)\b/i.test(String(p.frontmatter?.job_title || '')))?.id ||
    supervisedByChair.find(id => typeOf(id) === 'person') ||
    persons.find(p => chairman && reportsToRefs(p.frontmatter || {}).some(r => resolve(r) === chairman))?.id ||
    null;

  // Jefe de cada departamento: persona del departamento que reporta al CEO (o con menor hierarchy_level).
  const deptHead = new Map<string, string>();
  for (const p of persons) {
    const fm = p.frontmatter || {};
    const dept = first(toRefs(fm.department), id => typeOf(id) === 'department');
    if (!dept) continue;
    const reportsCeo = reportsToRefs(fm).some(r => resolve(r) === ceo);
    const cur = deptHead.get(dept);
    const lvl = Number(fm.hierarchy_level ?? 9);
    const curLvl = cur ? Number(byId.get(cur)?.frontmatter?.hierarchy_level ?? 9) : 99;
    if (reportsCeo && (!cur || lvl < curLvl)) deptHead.set(dept, p.id);
  }

  const put = (n: LayoutNodeInput, p: Omit<Placement, 'id'>) => out.set(n.id, { id: n.id, ...p });
  const unplaced = (n: LayoutNodeInput, reason: string) => put(n, { axis: 'unplaced', column: 'unplaced', layer: 'unplaced', parentId: null, lane: null, reason });

  for (const n of nodes) {
    const fm = n.frontmatter || {};
    const t = n.type;
    const explicitParent = first(toRefs(fm.parent_id));
    if (n.id === core) { put(n, { axis: 'center', column: 'core', layer: 'core', parentId: null, lane: null }); continue; }

    if (MARKET_TYPES.has(t)) {
      put(n, { axis: 'west', column: 'country', layer: 'market', parentId: null, lane: marketKeyOf(n) || n.id });
      continue;
    }
    if (OPERATOR_TYPES.has(t)) {
      const key = marketKeyOf(n);
      const parent = explicitParent || first(relRefs(fm, 'market'), id => MARKET_TYPES.has(typeOf(id))) || marketNodeFor(key);
      if (!parent) { unplaced(n, 'Distribuidor sin mercado resoluble (market / country)'); continue; }
      put(n, { axis: 'west', column: 'distributor', layer: 'market', parentId: parent, lane: key });
      continue;
    }
    if (t === 'channel') {
      const parent = explicitParent || first(relRefs(fm, 'parent_distributor_id', 'parent_distributor', 'channel_of'));
      if (!parent) { unplaced(n, 'Canal sin parent_distributor_id'); continue; }
      put(n, { axis: 'west', column: 'channel', layer: 'market', parentId: parent, lane: marketKeyOf(n) });
      continue;
    }
    if (OUTLET_TYPES.has(t) || (t === 'organization' && /walmart/i.test(n.id))) {
      const parent =
        explicitParent ||
        first(relRefs(fm, 'supplied_by', 'parent_distributor_id', 'parent_distributor', 'channel_of', 'listed_by_customer')) ||
        first(relRefs(fm, 'market'), id => MARKET_TYPES.has(typeOf(id))) ||
        marketNodeFor(marketKeyOf(n));
      if (!parent) { unplaced(n, 'Cliente/outlet sin distribuidor ni mercado (supplied_by / market)'); continue; }
      put(n, { axis: 'west', column: 'outlet', layer: 'market', parentId: parent, lane: marketKeyOf(n) });
      continue;
    }
    if (t === 'brand') { put(n, { axis: 'north', column: 'brand', layer: 'portfolio', parentId: null, lane: n.id }); continue; }
    if (t === 'product_line') {
      const parent = explicitParent || first(relRefs(fm, 'belongs_to_brand', 'brand'), id => typeOf(id) === 'brand');
      if (!parent) { unplaced(n, 'Linea sin marca registrada en el vault (belongs_to_brand)'); continue; }
      put(n, { axis: 'north', column: 'line', layer: 'portfolio', parentId: parent, lane: null });
      continue;
    }
    if (t === 'flavor' || t === 'packaging' || t === 'product_variant') {
      const parent = explicitParent || first(relRefs(fm, 'belongs_to_line', 'line', 'product_line', 'flavor', 'brand', 'belongs_to_brand'));
      if (!parent) { unplaced(n, 'Sabor/empaque sin linea ni marca (belongs_to_line)'); continue; }
      put(n, { axis: 'north', column: t === 'flavor' ? 'flavor' : 'packaging', layer: 'portfolio', parentId: parent, lane: null });
      continue;
    }
    if (SUPPLY_TYPES[t]) {
      const parent = explicitParent || first(relRefs(fm, 'supplies_site', 'site', 'supplied_by')) || core;
      const countryBody = (n.body || '').match(/"country"\s*:\s*"([^"]+)"/);
      put(n, { axis: 'south', column: SUPPLY_TYPES[t], layer: 'supply', parentId: parent, lane: countryKeyFromText(countryBody ? countryBody[1] : `${fm.country || ''}`) });
      continue;
    }
    if (t === 'project') { put(n, { axis: 'northwest', column: 'project', layer: 'projects', parentId: null, lane: null }); continue; }
    if (COGNITIVE_TYPES.has(t)) { put(n, { axis: 'southeast', column: 'cognitive', layer: 'cognitive', parentId: null, lane: null }); continue; }
    if (t === 'organization' || t === 'group') {
      // Subsidiarias / locations: atributo de agrupacion, banda propia del eje este (no entre empresa y Chairman).
      put(n, { axis: 'east', column: 'subsidiary', layer: 'organization', parentId: null, lane: 'subsidiary' });
      continue;
    }
    if (t === 'department') {
      const head = deptHead.get(n.id) || null;
      // El departamento se ubica en el anillo de jefes, junto a su jefe (mismo carril), bajo el CEO.
      const parent = explicitParent || ceo;
      if (!parent) { unplaced(n, 'Departamento sin CEO resoluble en el vault'); continue; }
      put(n, { axis: 'east', column: 'head', layer: 'organization', parentId: parent, lane: head || n.id });
      continue;
    }
    if (t === 'person') {
      if (n.id === chairman) { put(n, { axis: 'east', column: 'chairman', layer: 'organization', parentId: core, lane: null }); continue; }
      if (n.id === ceo) { put(n, { axis: 'east', column: 'ceo', layer: 'organization', parentId: chairman || core, lane: null }); continue; }
      const boss = explicitParent || first(reportsToRefs(fm), id => typeOf(id) === 'person' && id !== n.id);
      if (boss) { put(n, { axis: 'east', column: 'person', layer: 'organization', parentId: boss, lane: null }); continue; }
      const dept = first(toRefs(fm.department), id => typeOf(id) === 'department');
      if (dept) { put(n, { axis: 'east', column: 'person', layer: 'organization', parentId: dept, lane: null }); continue; }
      const employer = first(relRefs(fm, 'works_at', 'organization', 'signature_company'), id => id !== core);
      if (employer && (OPERATOR_TYPES.has(typeOf(employer)) || typeOf(employer) === 'channel')) {
        put(n, { axis: 'west', column: 'outlet', layer: 'market', parentId: employer, lane: null });
        continue;
      }
      if (employer && (typeOf(employer) === 'organization' || typeOf(employer) === 'group')) {
        put(n, { axis: 'east', column: 'person', layer: 'organization', parentId: employer, lane: 'subsidiary' });
        continue;
      }
      unplaced(n, 'Persona sin linea de reporte (reports_to), departamento ni empleador resoluble');
      continue;
    }
    unplaced(n, `Tipo '${t}' sin eje asignado`);
  }

  // Herencia de carril y deteccion de ciclos / padres de otro eje.
  const laneOf = (id: string, seen = new Set<string>()): string | null => {
    const p = out.get(id);
    if (!p) return null;
    if (p.lane) return p.lane;
    if (!p.parentId || seen.has(id)) return null;
    seen.add(id);
    return laneOf(p.parentId, seen);
  };
  for (const p of out.values()) {
    if (p.axis === 'unplaced' || p.axis === 'center') continue;
    if (p.parentId && !out.has(p.parentId) && p.parentId !== core) {
      p.reason = `Padre '${p.parentId}' no existe en el vault`;
      p.axis = 'unplaced'; p.column = 'unplaced'; p.layer = 'unplaced'; p.parentId = null;
      continue;
    }
    if (!p.lane) p.lane = laneOf(p.id);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Calculo de posiciones
// ---------------------------------------------------------------------------------------------

export interface LayoutDecor {
  kind: 'axis-label' | 'lane' | 'column-label' | 'tray' | 'ring';
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  text?: string;
  tag?: string;
  dim?: boolean;
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
  placements: Map<string, Placement>;
  unplaced: { id: string; title: string; reason: string }[];
  decor: LayoutDecor[];
  overridden: string[];
}

function readOverride(fm: Record<string, any> | undefined, view: LayoutViewKey): { x: number; y: number } | null {
  if (!fm) return null;
  for (const key of ['spatial_override', 'visual_coordinates']) {
    const v = fm[key];
    if (!v || typeof v !== 'object') continue;
    const scoped = v[view];
    if (scoped && typeof scoped.x === 'number' && typeof scoped.y === 'number') return { x: scoped.x, y: scoped.y };
    if (typeof v.x === 'number' && typeof v.y === 'number') return { x: v.x, y: v.y };
  }
  return null;
}

interface TreeItem { id: string; children: TreeItem[]; leaves: number; col: number; t0: number; t1: number }

/**
 * Construye los arboles de un eje con nodos visibles. Si el padre no es visible, sube al primer ancestro visible.
 * Devuelve las raices ordenadas segun la config.
 */
function buildAxisForest(
  axis: AxisKey,
  visible: LayoutNodeInput[],
  placements: Map<string, Placement>,
  colIndex: (p: Placement) => number,
  order: (a: string, b: string) => number,
): TreeItem[] {
  const vis = new Set(visible.map(n => n.id));
  const members = visible.filter(n => placements.get(n.id)?.axis === axis);
  const items = new Map<string, TreeItem>(members.map(n => [n.id, { id: n.id, children: [], leaves: 1, col: colIndex(placements.get(n.id)!), t0: 0, t1: 0 }]));
  const roots: TreeItem[] = [];
  for (const n of members) {
    let pid = placements.get(n.id)?.parentId || null;
    const guard = new Set<string>([n.id]);
    while (pid && (!vis.has(pid) || placements.get(pid)?.axis !== axis) && !guard.has(pid)) {
      guard.add(pid);
      const pp = placements.get(pid);
      if (!pp || pp.axis !== axis) { pid = null; break; }
      pid = pp.parentId;
    }
    const parentItem = pid && !guard.has(pid) ? items.get(pid) : undefined;
    if (parentItem) parentItem.children.push(items.get(n.id)!);
    else roots.push(items.get(n.id)!);
  }
  const titleOf = new Map(visible.map(n => [n.id, n.title]));
  const sortRec = (list: TreeItem[], top: boolean) => {
    list.sort((a, b) => (top ? order(a.id, b.id) : 0) || String(titleOf.get(a.id)).localeCompare(String(titleOf.get(b.id))));
    for (const it of list) sortRec(it.children, false);
  };
  sortRec(roots, true);
  const count = (it: TreeItem, depth = 0): number => {
    if (depth > 40) return 1;
    it.leaves = it.children.length ? it.children.reduce((s, c) => s + count(c, depth + 1), 0) : 1;
    return it.leaves;
  };
  roots.forEach(r => count(r));
  return roots;
}

/** Asigna t en [0,1] por conteo de hojas (cada nodo en el centro de su intervalo). */
function assignSlots(roots: TreeItem[]): TreeItem[] {
  const total = roots.reduce((s, r) => s + r.leaves, 0) || 1;
  const flat: TreeItem[] = [];
  let cursor = 0;
  const walk = (it: TreeItem, t0: number, t1: number, depth: number) => {
    it.t0 = t0; it.t1 = t1;
    flat.push(it);
    if (depth > 40) return;
    let c = t0;
    for (const ch of it.children) {
      const w = (t1 - t0) * (ch.leaves / it.leaves);
      walk(ch, c, c + w, depth + 1);
      c += w;
    }
  };
  for (const r of roots) {
    const w = r.leaves / total;
    walk(r, cursor, cursor + w, 0);
    cursor += w;
  }
  return flat;
}

function makeColIndex(cfg: LayoutConfig, axis: 'west' | 'north' | 'east' | 'south', placements: Map<string, Placement>) {
  const order = cfg.axes[axis].order_from_center;
  const depthCache = new Map<string, number>();
  // Eje este: el anillo es la profundidad real en la cadena de mando (chairman=0, ceo=1, jefes=2, personas>=3).
  const eastDepth = (id: string, guard = 0): number => {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const p = placements.get(id);
    let d = 0;
    if (!p || guard > 30) d = 0;
    else if (p.column === 'chairman') d = order.indexOf('chairman');
    else if (p.column === 'ceo') d = order.indexOf('ceo');
    else if (p.column === 'subsidiary') d = Math.max(order.indexOf('head'), 1);
    else if (p.parentId && placements.get(p.parentId)?.axis === 'east') d = eastDepth(p.parentId, guard + 1) + 1;
    else d = Math.max(order.indexOf(p.column), 0);
    if (p && p.column === 'head') d = Math.max(order.indexOf('head'), 0);
    depthCache.set(id, d);
    return d;
  };
  return (p: Placement): number => {
    if (axis === 'east') return Math.max(0, eastDepth(p.id));
    const i = order.indexOf(p.column);
    const base = i >= 0 ? i : order.length;
    // hijo en la misma columna que su padre (ej. listing de un cliente): medio anillo hacia afuera
    const parent = p.parentId ? placements.get(p.parentId) : undefined;
    if (parent && parent.axis === p.axis && parent.column === p.column) return base + 0.5;
    return base;
  };
}

function orderFn(cfg: LayoutConfig, placements: Map<string, Placement>, nodesById: Map<string, LayoutNodeInput>) {
  return (a: string, b: string) => {
    const pa = placements.get(a), pb = placements.get(b);
    const prio = (p?: Placement) => (p?.column === 'chairman' ? 0 : p?.column === 'subsidiary' ? 2 : 1);
    if (prio(pa) !== prio(pb)) return prio(pa) - prio(pb);
    const ka = pa?.lane ? cfg.country_order.indexOf(pa.lane) : -1;
    const kb = pb?.lane ? cfg.country_order.indexOf(pb.lane) : -1;
    if (ka !== kb) return (ka < 0 ? 999 : ka) - (kb < 0 ? 999 : kb);
    const ba = cfg.brand_order.indexOf(a), bb = cfg.brand_order.indexOf(b);
    if (ba !== bb) return (ba < 0 ? 999 : ba) - (bb < 0 ? 999 : bb);
    return String(nodesById.get(a)?.title).localeCompare(String(nodesById.get(b)?.title));
  };
}

function laneTag(cfg: LayoutConfig, lane: string | null): string {
  if (!lane) return '';
  const tag = cfg.country_tags[lane];
  return tag ? `[${tag}]` : '';
}

function gridTray(ids: string[], x0: number, y0: number, cols: number, gap: number, pos: Map<string, { x: number; y: number }>) {
  ids.forEach((id, i) => pos.set(id, { x: x0 + (i % cols) * gap, y: y0 + Math.floor(i / cols) * gap }));
  return { w: Math.max(1, Math.min(cols, ids.length)) * gap, h: Math.max(1, Math.ceil(ids.length / cols)) * gap };
}

function finish(
  view: LayoutViewKey,
  visible: LayoutNodeInput[],
  placements: Map<string, Placement>,
  pos: Map<string, { x: number; y: number }>,
  decor: LayoutDecor[],
): LayoutResult {
  const overridden: string[] = [];
  for (const n of visible) {
    const o = readOverride(n.frontmatter, view);
    if (o) { pos.set(n.id, o); overridden.push(n.id); }
  }
  const unplaced = visible
    .filter(n => placements.get(n.id)?.axis === 'unplaced')
    .map(n => ({ id: n.id, title: n.title, reason: placements.get(n.id)?.reason || 'Sin padre resoluble' }));
  return { positions: pos, placements, unplaced, decor, overridden };
}

/** Vista radial "Brujula". */
export function computeBrujulaLayout(visible: LayoutNodeInput[], all: LayoutNodeInput[], cfgIn?: LayoutConfig): LayoutResult {
  const cfg = cfgIn || DEFAULT_LAYOUTS.brujula;
  const placements = classifyNodes(all, cfg.center_node);
  const byId = new Map(all.map(n => [n.id, n]));
  const pos = new Map<string, { x: number; y: number }>();
  const decor: LayoutDecor[] = [];
  const { ring_base, ring_step, min_node_gap, tray_gap } = cfg.spacing;
  const order = orderFn(cfg, placements, byId);
  let outerR = ring_base + ring_step * 4;

  for (const n of visible) if (placements.get(n.id)?.axis === 'center') pos.set(n.id, { x: 0, y: 0 });

  for (const axis of ['west', 'north', 'east', 'south'] as const) {
    const ax = cfg.axes[axis];
    const colIdx = makeColIndex(cfg, axis, placements);
    const roots = buildAxisForest(axis, visible, placements, colIdx, order);
    const flat = assignSlots(roots);
    if (!flat.length) continue;
    const spanRad = (ax.span * Math.PI) / 180;
    // radio por anillo: crece con la cantidad de nodos del anillo para evitar solapes
    const ringCounts = new Map<number, number>();
    flat.forEach(it => ringCounts.set(it.col, (ringCounts.get(it.col) || 0) + 1));
    const rings = [...ringCounts.keys()].sort((a, b) => a - b);
    const radius = new Map<number, number>();
    let prev = 0;
    for (const k of rings) {
      const needed = (min_node_gap * (ringCounts.get(k) || 1)) / spanRad;
      const nominal = ring_base + ring_step * k;
      const r = Math.max(nominal, prev + ring_step * (k % 1 === 0 ? 1 : 0.5), Math.min(needed, prev + ring_step * 3));
      radius.set(k, r);
      prev = r;
    }
    outerR = Math.max(outerR, prev);
    const angleOf = (t: number) => ((ax.angle + ax.span / 2 - t * ax.span) * Math.PI) / 180;
    // escalonado radial si el arco por nodo es menor que el gap
    const byRing = new Map<number, TreeItem[]>();
    flat.forEach(it => { const l = byRing.get(it.col) || []; l.push(it); byRing.set(it.col, l); });
    for (const [k, list] of byRing) {
      const r = radius.get(k)!;
      list.sort((a, b) => (a.t0 + a.t1) - (b.t0 + b.t1));
      const arcPer = (r * spanRad) / Math.max(1, list.length);
      const lanes = Math.max(1, Math.ceil(min_node_gap / Math.max(arcPer, 1)));
      list.forEach((it, i) => {
        const rr = r + (lanes > 1 ? (i % lanes) * (ring_step / lanes) : 0);
        const a = angleOf((it.t0 + it.t1) / 2);
        pos.set(it.id, { x: rr * Math.cos(a), y: -rr * Math.sin(a) });
      });
      decor.push({ kind: 'ring', x: 0, y: 0, r, text: '', dim: true });
    }
    // etiqueta de eje
    const a0 = (ax.angle * Math.PI) / 180;
    decor.push({ kind: 'axis-label', x: (prev + 90) * Math.cos(a0), y: -(prev + 90) * Math.sin(a0), text: ax.label });
    // etiquetas de pais en el oeste
    if (axis === 'west') {
      for (const it of roots) {
        const p = placements.get(it.id);
        const tag = laneTag(cfg, p?.lane || null);
        const a = angleOf((it.t0 + it.t1) / 2);
        const rr = (radius.get(it.col) || prev) + 60;
        decor.push({ kind: 'lane', x: rr * Math.cos(a), y: -rr * Math.sin(a), text: byId.get(it.id)?.title || '', tag });
      }
    }
  }

  // Diagonal noroeste: proyectos
  const projects = visible.filter(n => placements.get(n.id)?.axis === 'northwest').sort((a, b) => a.title.localeCompare(b.title));
  projects.forEach((n, i) => {
    const r = ring_base + ring_step * 1.5 + (i % 2) * ring_step * 0.6;
    const a = ((135 + (i - (projects.length - 1) / 2) * 9) * Math.PI) / 180;
    pos.set(n.id, { x: r * Math.cos(a), y: -r * Math.sin(a) });
  });
  if (projects.length) decor.push({ kind: 'axis-label', x: -(ring_base + ring_step * 2.6) * 0.707, y: -(ring_base + ring_step * 2.6) * 0.707, text: 'PROYECTOS' });

  // Esquina sureste atenuada: capa cognitiva DOTS + bandeja Sin ubicar
  const seX = outerR * 0.62, seY = outerR * 0.48;
  const cog = visible.filter(n => placements.get(n.id)?.axis === 'southeast').map(n => n.id).sort();
  const cogBox = gridTray(cog, seX, seY, 4, tray_gap, pos);
  decor.push({ kind: 'tray', x: seX - tray_gap / 2, y: seY - tray_gap / 2 - 18, w: cogBox.w, h: cogBox.h + 18, text: 'CAPA COGNITIVA DOTS', dim: true });
  const un = visible.filter(n => placements.get(n.id)?.axis === 'unplaced').map(n => n.id).sort();
  const unY = seY + cogBox.h + tray_gap;
  const unBox = gridTray(un, seX, unY + 10, 6, tray_gap, pos);
  decor.push({ kind: 'tray', x: seX - tray_gap / 2, y: unY - 18 - tray_gap / 2 + 10, w: unBox.w, h: unBox.h + 18, text: `SIN UBICAR (${un.length})`, dim: false });

  return finish('brujula', visible, placements, pos, decor);
}

/** Vista de columnas "Version 1 Ajustada": un carril horizontal por pais en el oeste, cadena de mando al este. */
export function computeVersion1Layout(visible: LayoutNodeInput[], all: LayoutNodeInput[], cfgIn?: LayoutConfig): LayoutResult {
  const cfg = cfgIn || DEFAULT_LAYOUTS['version-1-ajustada'];
  const placements = classifyNodes(all, cfg.center_node);
  const byId = new Map(all.map(n => [n.id, n]));
  const pos = new Map<string, { x: number; y: number }>();
  const decor: LayoutDecor[] = [];
  const { column_width, row_height, lane_padding, tray_gap } = cfg.spacing;
  const order = orderFn(cfg, placements, byId);
  const coreCol = Math.max(0, cfg.column_order.indexOf('core'));
  const colX = (name: string, fallback: number) => {
    const i = cfg.column_order.indexOf(name);
    return ((i >= 0 ? i : fallback) - coreCol) * column_width;
  };

  for (const n of visible) if (placements.get(n.id)?.axis === 'center') pos.set(n.id, { x: 0, y: 0 });

  // Oeste y este: columnas verticales; filas por hojas; carriles por pais (oeste) o por jefe (este)
  let minY = -row_height * 2, maxY = row_height * 2, maxEastX = column_width * 4;
  for (const axis of ['west', 'east'] as const) {
    const colIdx = makeColIndex(cfg, axis, placements);
    const roots = buildAxisForest(axis, visible, placements, colIdx, order);
    if (!roots.length) continue;
    const ax = cfg.axes[axis];
    const columnName = (k: number) => ax.order_from_center[Math.min(Math.floor(k), ax.order_from_center.length - 1)];
    const totalLeaves = roots.reduce((s, r) => s + r.leaves, 0);
    const gaps = Math.max(0, roots.length - 1) * lane_padding;
    const height = totalLeaves * row_height + gaps;
    let y = -height / 2;
    const placeItem = (it: TreeItem, y0: number, y1: number, depth: number) => {
      const name = columnName(it.col);
      let x: number;
      if (axis === 'west') x = colX(name, coreCol - 1 - it.col);
      else {
        const base = colX(name, coreCol + 1 + it.col);
        const extra = Math.max(0, it.col - (ax.order_from_center.length - 1));
        x = base + extra * column_width; // niveles mas profundos que 'person' siguen hacia el este
      }
      if (it.col % 1 !== 0) x += (axis === 'west' ? -1 : 1) * column_width * 0.5;
      maxEastX = Math.max(maxEastX, x);
      pos.set(it.id, { x, y: (y0 + y1) / 2 });
      if (depth > 40) return;
      let c = y0;
      for (const ch of it.children) {
        const h = (y1 - y0) * (ch.leaves / it.leaves);
        placeItem(ch, c, c + h, depth + 1);
        c += h;
      }
    };
    for (const r of roots) {
      const h = r.leaves * row_height;
      placeItem(r, y, y + h, 0);
      const p = placements.get(r.id);
      const xs = axis === 'west' ? colX('country', 0) - column_width * 0.55 : colX('chairman', coreCol + 1) - column_width * 0.45;
      const w = axis === 'west' ? (coreCol - 0.1) * column_width : (cfg.column_order.length - coreCol + 1) * column_width;
      decor.push({
        kind: 'lane', x: xs, y: y - lane_padding / 3, w, h: h + (lane_padding * 2) / 3,
        text: axis === 'west' ? (byId.get(r.id)?.title || '') : (byId.get(r.id)?.title || ''),
        tag: axis === 'west' ? laneTag(cfg, p?.lane || null) : '',
        dim: axis === 'east' && p?.column === 'subsidiary',
      });
      y += h + lane_padding;
    }
    minY = Math.min(minY, -height / 2);
    maxY = Math.max(maxY, height / 2);
    // encabezados de columna
    for (const name of ax.order_from_center) {
      decor.push({ kind: 'column-label', x: colX(name, 0), y: -height / 2 - 40, text: name.toUpperCase() });
    }
  }

  // Norte y sur: filas horizontales, cada hijo bajo la columna de su marca/sitio
  for (const axis of ['north', 'south'] as const) {
    const colIdx = makeColIndex(cfg, axis, placements);
    const roots = buildAxisForest(axis, visible, placements, colIdx, order);
    if (!roots.length) continue;
    const rows = axis === 'north' ? cfg.north_rows : cfg.south_rows;
    const flat = assignSlots(roots);
    const width = Math.max(column_width * 3, flat.filter(f => f.children.length === 0).length * (column_width * 0.32));
    const rowY = (k: number) => {
      const name = cfg.axes[axis].order_from_center[Math.min(Math.floor(k), cfg.axes[axis].order_from_center.length - 1)];
      const ri = Math.max(0, rows.indexOf(name));
      const off = (ri + (k % 1)) * row_height * 2.2;
      return axis === 'north' ? minY - 120 - off : maxY + 120 + off;
    };
    // escalonado vertical si varios nodos caen muy juntos en la misma fila
    const byRow = new Map<number, TreeItem[]>();
    flat.forEach(it => { const l = byRow.get(it.col) || []; l.push(it); byRow.set(it.col, l); });
    for (const [k, list] of byRow) {
      const per = width / Math.max(1, list.length);
      const lanes = Math.max(1, Math.ceil(cfg.spacing.min_node_gap / Math.max(per, 1)));
      list.sort((a, b) => (a.t0 + a.t1) - (b.t0 + b.t1)).forEach((it, i) => {
        const x = -width / 2 + ((it.t0 + it.t1) / 2) * width;
        const dy = lanes > 1 ? (i % lanes) * (row_height * 2.2 / lanes) : 0;
        pos.set(it.id, { x, y: rowY(k) + (axis === 'north' ? -dy : dy) });
      });
      decor.push({ kind: 'column-label', x: -width / 2 - 90, y: rowY(k), text: (cfg.axes[axis].order_from_center[Math.min(Math.floor(k), 9)] || '').toUpperCase() });
    }
    decor.push({ kind: 'axis-label', x: 0, y: axis === 'north' ? rowY(rows.length - 1) - 90 : rowY(rows.length - 1) + 90, text: cfg.axes[axis].label });
  }

  // Proyectos: diagonal noroeste (entre portafolio y mercado)
  const projects = visible.filter(n => placements.get(n.id)?.axis === 'northwest').sort((a, b) => a.title.localeCompare(b.title));
  projects.forEach((n, i) => pos.set(n.id, { x: colX('channel', 1) - i * 40, y: minY - 100 - i * row_height }));
  if (projects.length) decor.push({ kind: 'axis-label', x: colX('channel', 1), y: minY - 70, text: 'PROYECTOS' });

  // Sureste: capa cognitiva atenuada y bandeja Sin ubicar
  const seX = column_width * 1.5, seY = maxY + 160 + row_height * 2.2 * 3;
  const cog = visible.filter(n => placements.get(n.id)?.axis === 'southeast').map(n => n.id).sort();
  const cogBox = gridTray(cog, seX + column_width * 2, seY, 4, tray_gap, pos);
  decor.push({ kind: 'tray', x: seX + column_width * 2 - tray_gap / 2, y: seY - tray_gap / 2 - 18, w: cogBox.w, h: cogBox.h + 18, text: 'CAPA COGNITIVA DOTS', dim: true });
  const un = visible.filter(n => placements.get(n.id)?.axis === 'unplaced').map(n => n.id).sort();
  const unX = Math.max(maxEastX - tray_gap * 5, seX + column_width * 2 + cogBox.w + tray_gap);
  const unBox = gridTray(un, unX, seY, 6, tray_gap, pos);
  decor.push({ kind: 'tray', x: unX - tray_gap / 2, y: seY - tray_gap / 2 - 18, w: unBox.w, h: unBox.h + 18, text: `SIN UBICAR (${un.length})` });

  return finish('version-1-ajustada', visible, placements, pos, decor);
}

export function computeNativeLayout(view: LayoutViewKey, visible: LayoutNodeInput[], all: LayoutNodeInput[], cfg?: LayoutConfig): LayoutResult {
  return view === 'brujula' ? computeBrujulaLayout(visible, all, cfg) : computeVersion1Layout(visible, all, cfg);
}
