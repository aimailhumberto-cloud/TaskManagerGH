// Conexiones del Cerebro: curvas, color según el tipo de vínculo, grosor según su fuerza
// y sinapsis (un pulso de luz) donde hubo actividad reciente o sobre la ficha enfocada.
import type { NodeData, LinkData } from './types';

/** Familias de vínculo. Cada una tiene su color; «ref» es la mención suelta, la más tenue. */
const REL_FAMILY: Record<string, 'org' | 'people' | 'commercial' | 'portfolio' | 'work' | 'ref'> = {
  reports_to: 'org', direct_reports: 'org', belongs_to_department: 'org', department: 'org', part_of: 'org', parent: 'org',
  collaborates_with: 'people', coordinates_with: 'people', observed_contacts: 'people', contacts: 'people',
  operates_in_market: 'commercial', active_in_markets: 'commercial', distributed_by: 'commercial', carries_brand: 'commercial', assigned_brands: 'commercial', serves_clients: 'commercial', supplied_by: 'commercial',
  belongs_to_line: 'portfolio', packaging: 'portfolio', flavor: 'portfolio',
  touches: 'work', assigned_to: 'work', blocks: 'work',
};
const COLOR = { org: '111, 155, 255', people: '76, 201, 255', commercial: '179, 162, 255', portfolio: '255, 176, 102', work: '255, 140, 192', ref: '159, 220, 255' } as const;
type Fam = keyof typeof COLOR;
const FAMS = Object.keys(COLOR) as Fam[];
const famOf = (rel: string): Fam => REL_FAMILY[rel] || 'ref';

/** Nombre legible del vínculo para la etiqueta sobre la línea. */
const REL_NAME: Record<string, [string, string]> = {
  reports_to: ['reporta a', 'reports to'], direct_reports: ['equipo directo', 'direct report'], collaborates_with: ['colabora con', 'works with'], coordinates_with: ['coordina con', 'coordinates with'],
  observed_contacts: ['contacto', 'contact'], operates_in_market: ['opera en', 'operates in'], active_in_markets: ['activo en', 'active in'], distributed_by: ['distribuye', 'distributed by'],
  carries_brand: ['lleva la marca', 'carries brand'], assigned_brands: ['marca asignada', 'assigned brand'], belongs_to_line: ['línea', 'line'], packaging: ['empaque', 'packaging'], flavor: ['sabor', 'flavor'],
  touches: ['toca', 'touches'], references: ['menciona', 'mentions'],
};
let langAt = 0, lang: 0 | 1 = 0;
function relName(rel: string): string {
  const now = Date.now();
  if (now - langAt > 2000) { langAt = now; try { lang = localStorage.getItem('cerebro_lang') === 'en' ? 1 : 0; } catch { lang = 0; } }
  return (REL_NAME[rel] || [rel.replace(/_/g, ' '), rel.replace(/_/g, ' ')])[lang];
}

/** Por lista de enlaces (se calcula una vez): familia, fuerza y lado de la curva de cada uno. */
interface Meta { fam: Fam; width: number; bend: number }
const metaCache = new WeakMap<object, Meta[]>();
const degCache = new WeakMap<object, Map<string, number>>();
function metaFor(links: LinkData[]): Meta[] {
  let m = metaCache.get(links);
  if (!m) {
    const pairCount = new Map<string, number>();
    const key = (l: LinkData) => (l.source < l.target ? l.source + '|' + l.target : l.target + '|' + l.source);
    for (const l of links) pairCount.set(key(l), (pairCount.get(key(l)) || 0) + 1);
    const deg = new Map<string, number>(); for (const l of links) { deg.set(l.source, (deg.get(l.source) || 0) + 1); deg.set(l.target, (deg.get(l.target) || 0) + 1); }
    degCache.set(links, deg);
    m = links.map(l => {
      const fam = famOf(l.relationType), k = key(l);
      let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
      // Fuerza: un vínculo con nombre pesa más que una mención; varios vínculos entre el mismo par, más todavía.
      const width = (fam === 'ref' ? 0.6 : 1) + Math.min(1.2, ((pairCount.get(k) || 1) - 1) * 0.4);
      return { fam, width, bend: (h & 1 ? 1 : -1) * (0.08 + (Math.abs(h >> 3) % 7) / 100) };
    });
    metaCache.set(links, m);
  }
  return m;
}

/** Fichas con actividad reciente (memoria de trabajo o cambiadas en las últimas 72 horas). Se recalcula cada minuto. */
let recentFor: NodeData[] | null = null, recentAt = 0, recentIds = new Set<string>();
const RECENT_MS = 72 * 3600 * 1000;
export function recentNodeIds(nodes: NodeData[]): Set<string> {
  const now = Date.now();
  if (recentFor !== nodes || now - recentAt > 60000) {
    recentFor = nodes; recentAt = now; recentIds = new Set();
    for (const n of nodes) {
      const fm = n.frontmatter || {}, t = Date.parse(String(fm.updated_at || fm.updatedAt || ''));
      if (n.memory_tier === 'working' || (Number.isFinite(t) && now - t < RECENT_MS)) recentIds.add(n.id);
    }
  }
  return recentIds;
}

export interface LinkFrame {
  links: LinkData[]; nodes: NodeData[]; nodeMap: Map<string, NodeData>;
  view: { left: number; right: number; top: number; bottom: number }; scale: number; time: number;
  focusId: string | null | undefined; deckIds: Set<string>; focusCount: number; hideIdle: boolean;
}
const MAX_PULSES = 160; // tope de pulsos por cuadro, para que miles de enlaces no cuesten más

export function drawLinks(ctx: CanvasRenderingContext2D, f: LinkFrame): void {
  const { links, nodeMap, view, scale, time } = f;
  const meta = metaFor(links), focus = !!f.focusId, recent = focus ? null : recentNodeIds(f.nodes);
  const curved = scale >= 0.3; // muy de lejos una recta se ve igual y cuesta menos
  // Punto de control de la curva: el medio, desplazado hacia un lado.
  const ctrl = (s: NodeData, t: NodeData, bend: number): [number, number] => [(s.x + t.x) / 2 - (t.y - s.y) * bend, (s.y + t.y) / 2 + (t.x - s.x) * bend];
  const trace = (s: NodeData, t: NodeData, bend: number) => { ctx.moveTo(s.x, s.y); if (curved) { const [cx, cy] = ctrl(s, t, bend); ctx.quadraticCurveTo(cx, cy, t.x, t.y); } else ctx.lineTo(t.x, t.y); };
  const pulse = (s: NodeData, t: NodeData, bend: number, u: number, r: number, color: string) => {
    const [cx, cy] = curved ? ctrl(s, t, bend) : [(s.x + t.x) / 2, (s.y + t.y) / 2], v = 1 - u;
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(v * v * s.x + 2 * v * u * cx + u * u * t.x, v * v * s.y + 2 * v * u * cy + u * u * t.y, r, 0, Math.PI * 2); ctx.fill();
  };
  const offscreen = (s: NodeData, t: NodeData) => (s.x < view.left && t.x < view.left) || (s.x > view.right && t.x > view.right) || (s.y < view.top && t.y < view.top) || (s.y > view.bottom && t.y > view.bottom);

  if (!focus) {
    if (f.hideIdle) return;
    // Un enlace está «vivo» si sus dos fichas cambiaron hace poco, o si una es reciente y poco conectada
    // (una nota nueva, una tarea). Así un nodo central recién editado no enciende medio mapa.
    const deg = degCache.get(links)!;
    const lively = (n: NodeData) => recent!.has(n.id) && (n.memory_tier === 'working' || (deg.get(n.id) || 0) <= 10);
    const isHot = (s: NodeData, t: NodeData) => lively(s) || lively(t) || (recent!.has(s.id) && recent!.has(t.id) && (deg.get(s.id) || 0) <= 40 && (deg.get(t.id) || 0) <= 40);
    // Panorámica: todos los enlaces de un mismo color van en un solo trazo. Los que tocan algo reciente brillan más.
    const hot: number[] = [];
    for (const fam of FAMS) {
      const quiet = fam === 'ref' ? 0.08 : 0.2;
      for (const wide of [false, true]) {
        ctx.beginPath(); let any = false;
        for (let i = 0; i < links.length; i++) {
          const m = meta[i]; if (m.fam !== fam || (m.width > 1.2) !== wide) continue;
          const s = nodeMap.get(links[i].source), t = nodeMap.get(links[i].target);
          if (!s || !t || offscreen(s, t)) continue;
          if (isHot(s, t)) { hot.push(i); continue; }
          trace(s, t, m.bend); any = true;
        }
        if (any) { ctx.strokeStyle = `rgba(${COLOR[fam]}, ${quiet})`; ctx.lineWidth = wide ? 1.5 : fam === 'ref' ? 0.6 : 0.9; ctx.stroke(); }
      }
    }
    // Sinapsis: enlaces con actividad reciente, más vivos y con un pulso que viaja.
    if (hot.length) {
      ctx.beginPath();
      for (const i of hot) { const s = nodeMap.get(links[i].source)!, t = nodeMap.get(links[i].target)!; trace(s, t, meta[i].bend); }
      ctx.strokeStyle = 'rgba(255, 215, 94, 0.34)'; ctx.lineWidth = 1.1; ctx.stroke();
      if (scale >= 0.25) {
        const step = Math.max(1, Math.ceil(hot.length / MAX_PULSES));
        for (let j = 0; j < hot.length; j += step) {
          const i = hot[j], s = nodeMap.get(links[i].source)!, t = nodeMap.get(links[i].target)!;
          // Cada enlace lleva su propio compás; el pulso sale de la ficha reciente hacia la otra.
          const u = (time * 0.22 + (i % 17) / 17) % 1, fromS = lively(s) || !lively(t);
          pulse(fromS ? s : t, fromS ? t : s, fromS ? meta[i].bend : -meta[i].bend, u, 2.1, 'rgba(255, 233, 160, 0.95)');
        }
      }
    }
    return;
  }

  // Con una ficha enfocada: solo su vecindario, en el color de cada vínculo, con resplandor y dos pulsos.
  const act: number[] = [];
  for (let i = 0; i < links.length; i++) {
    const l = links[i], s = nodeMap.get(l.source), t = nodeMap.get(l.target);
    if (!s || !t || offscreen(s, t)) continue;
    if (l.source === f.focusId || l.target === f.focusId || (f.deckIds.has(s.id) && f.deckIds.has(t.id))) act.push(i);
  }
  for (const fam of FAMS) {
    const mine = act.filter(i => meta[i].fam === fam); if (!mine.length) continue;
    const rgb = fam === 'ref' ? '0, 168, 240' : COLOR[fam];
    // Resplandor: un trazo ancho y translúcido debajo (más barato que una sombra difuminada).
    ctx.beginPath(); for (const i of mine) trace(nodeMap.get(links[i].source)!, nodeMap.get(links[i].target)!, meta[i].bend);
    ctx.strokeStyle = `rgba(${rgb}, 0.16)`; ctx.lineWidth = 6; ctx.stroke();
    for (const wide of [false, true]) {
      ctx.beginPath(); let any = false;
      for (const i of mine) { if ((meta[i].width > 1.2) !== wide) continue; trace(nodeMap.get(links[i].source)!, nodeMap.get(links[i].target)!, meta[i].bend); any = true; }
      if (any) { ctx.strokeStyle = `rgba(${rgb}, 0.9)`; ctx.lineWidth = wide ? 2.6 : 1.5; ctx.stroke(); }
    }
  }
  const step = Math.max(1, Math.ceil(act.length / (MAX_PULSES / 2)));
  for (let j = 0; j < act.length; j += step) {
    const i = act[j], l = links[i], s = nodeMap.get(l.source)!, t = nodeMap.get(l.target)!;
    // Los pulsos salen de la ficha enfocada hacia sus vecinas.
    const out = l.source === f.focusId || l.target !== f.focusId, a = out ? s : t, b = out ? t : s, bend = out ? meta[i].bend : -meta[i].bend;
    const u = (time * 0.2 + (i % 13) / 13) % 1;
    pulse(a, b, bend, u, 2.3, '#e6f6ff'); pulse(a, b, bend, (u + 0.5) % 1, 1.6, `rgb(${meta[i].fam === 'ref' ? '0, 168, 240' : COLOR[meta[i].fam]})`);
  }
  // Nombre del vínculo sobre la línea: solo de cerca y con pocas conexiones, para que se pueda leer.
  if (scale >= 1.05 && f.focusCount <= 14) {
    ctx.font = '500 9.5px Poppins, system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const i of act) {
      const l = links[i]; if (l.source !== f.focusId && l.target !== f.focusId) continue;
      const s = nodeMap.get(l.source)!, t = nodeMap.get(l.target)!, [cx, cy] = ctrl(s, t, meta[i].bend);
      const mx = 0.25 * s.x + 0.5 * cx + 0.25 * t.x, my = 0.25 * s.y + 0.5 * cy + 0.25 * t.y, name = relName(l.relationType), w = ctx.measureText(name).width + 10;
      ctx.fillStyle = 'rgba(7, 18, 48, 0.88)'; ctx.beginPath(); ctx.roundRect(mx - w / 2, my - 8, w, 16, 8); ctx.fill();
      ctx.fillStyle = '#dbeafe'; ctx.fillText(name, mx, my + 0.5);
    }
  }
}
