// Nodos «comunidad»: cuando hay demasiados nodos a la vez, los hermanos del mismo tipo y
// del mismo padre se agrupan en una burbuja («24 sabores · Chubby») que se abre con doble clic.
//
// Apagado por defecto: solo actúa si los nodos visibles superan `threshold` (900 normalmente;
// hoy hay 584 en total, así que el mapa no cambia). Para probarlo: ?comunidades=100 en la URL.
// No modifica el vault ni los nodos originales; es solo una forma de dibujar.

import type { LinkData } from './types';

export const DEFAULT_COMMUNITY_THRESHOLD = 900;
export const MIN_COMMUNITY_SIZE = 12;
export const COMMUNITY_ID_PREFIX = 'community::';

export interface CommunityOptions {
  threshold: number;
  minGroup?: number;
  /** Nodos que nunca se agrupan (seleccionados, anclados, con ficha abierta…). */
  protectedIds?: Set<string>;
  /** Claves de comunidades que la persona ya abrió: sus miembros se ven sueltos. */
  openKeys?: Set<string>;
  levelOf: (type: string) => number;
}

export interface CommunityResult {
  nodes: any[];
  links: LinkData[];
  /** id de comunidad → ids de sus miembros */
  members: Map<string, string[]>;
  /** id de comunidad → clave (para abrirla) */
  keys: Map<string, string>;
}

const PLURAL: Record<string, string> = {
  flavor: 'sabores', packaging: 'empaques', product_variant: 'SKUs', product_line: 'líneas',
  catalog_listing: 'listados', person: 'personas', customer: 'clientes', distributor: 'distribuidores',
  channel: 'canales', market: 'mercados', site: 'sitios', project: 'proyectos', working_memory: 'notas de trabajo',
  outlet: 'puntos de venta', client: 'clientes', client_group: 'grupos de clientes', operator: 'operadores',
};

export function communityIdFor(key: string) {
  return COMMUNITY_ID_PREFIX + key;
}
export function isCommunityId(id: string) {
  return id.startsWith(COMMUNITY_ID_PREFIX);
}

export function buildCommunities(nodes: any[], links: LinkData[], opts: CommunityOptions): CommunityResult {
  const members = new Map<string, string[]>();
  const keys = new Map<string, string>();
  if (nodes.length <= opts.threshold) return { nodes, links, members, keys };

  const minGroup = opts.minGroup ?? MIN_COMMUNITY_SIZE;
  const protectedIds = opts.protectedIds ?? new Set<string>();
  const openKeys = opts.openKeys ?? new Set<string>();
  const byId = new Map<string, any>(nodes.map((n) => [n.id, n]));

  // Vecinos de cada nodo (sin importar la dirección del enlace)
  const neighbors = new Map<string, string[]>();
  const add = (a: string, b: string) => { const l = neighbors.get(a); if (l) l.push(b); else neighbors.set(a, [b]); };
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const t = typeof l.target === 'string' ? l.target : (l.target as any).id;
    if (byId.has(s) && byId.has(t)) { add(s, t); add(t, s); }
  }

  // Padre = el vecino de nivel más alto en la jerarquía (menor número) que esté por encima del nodo
  const groups = new Map<string, any[]>();
  for (const n of nodes) {
    const lvl = opts.levelOf(n.type);
    if (lvl < 2 || protectedIds.has(n.id) || n.isPinned) continue;
    let parent: string | null = null;
    let best = Infinity;
    for (const nb of neighbors.get(n.id) || []) {
      const nl = opts.levelOf(byId.get(nb)!.type);
      if (nl < lvl && (nl < best || (nl === best && nb < (parent as string)))) { best = nl; parent = nb; }
    }
    const key = `${n.type}|${parent ?? 'sin-padre'}`;
    const g = groups.get(key);
    if (g) g.push(n); else groups.set(key, [n]);
  }

  const grouped = new Map<string, string>(); // id del miembro → id de comunidad
  const communityNodes: any[] = [];
  for (const [key, g] of groups) {
    if (g.length < minGroup || openKeys.has(key)) continue;
    const [type, parentId] = key.split('|');
    const parent = parentId !== 'sin-padre' ? byId.get(parentId) : undefined;
    const cid = communityIdFor(key);
    const label = PLURAL[type] || type;
    const parentTitle = parent ? String(parent.title || parent.id).replace(/^[A-Za-z ]+:\s*/, '') : '';
    members.set(cid, g.map((m) => m.id));
    keys.set(cid, key);
    for (const m of g) grouped.set(m.id, cid);
    communityNodes.push({
      id: cid,
      title: `${g.length} ${label}${parentTitle ? ` · ${parentTitle}` : ''}`,
      type: 'community',
      memory_tier: 'long_term',
      status: 'active',
      hierarchy_level: Math.min(...g.map((m) => opts.levelOf(m.type))),
      body: '',
      frontmatter: { community: true, member_count: g.length, member_type: type, parent: parentId },
      links: [],
      filePath: '',
    });
  }
  if (!communityNodes.length) return { nodes, links, members, keys };

  // Enlaces: los de miembros pasan a la comunidad; sin duplicados ni lazos de una comunidad consigo misma
  const seen = new Set<string>();
  const outLinks: LinkData[] = [];
  for (const l of links) {
    const s0 = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const t0 = typeof l.target === 'string' ? l.target : (l.target as any).id;
    const s = grouped.get(s0) ?? s0;
    const t = grouped.get(t0) ?? t0;
    if (s === t) continue;
    const touchesCommunity = s !== s0 || t !== t0;
    const k = touchesCommunity ? `${s}->${t}` : `${s}->${t}:${l.relationType}`;
    if (seen.has(k)) continue;
    seen.add(k);
    outLinks.push(touchesCommunity ? { source: s, target: t, relationType: 'agrupado' } : l);
  }

  return {
    nodes: [...nodes.filter((n) => !grouped.has(n.id)), ...communityNodes],
    links: outLinks,
    members,
    keys,
  };
}

/** Umbral efectivo: ?comunidades=N en la URL, o el valor guardado, o el normal. */
export function readCommunityThreshold(): number {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('comunidades');
    if (fromUrl !== null && /^\d+$/.test(fromUrl)) return parseInt(fromUrl, 10);
    const stored = localStorage.getItem('cerebro_community_threshold');
    if (stored && /^\d+$/.test(stored)) return parseInt(stored, 10);
  } catch {}
  return DEFAULT_COMMUNITY_THRESHOLD;
}
