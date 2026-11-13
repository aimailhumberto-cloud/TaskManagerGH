// Movimiento de las burbujas: cada una va hacia su lugar con inercia, respira en reposo
// y, cuando se arrastra una, sus vecinas la siguen por el tirón de las conexiones.
// Es una función pura sobre la lista de nodos para poder probarla sin navegador.

export interface PhysNode {
  id: string; x: number; y: number; vx?: number; vy?: number; targetX: number; targetY: number;
  radius?: number; isPinned?: boolean; isDragged?: boolean; pinnedX?: number; pinnedY?: number;
}
export interface PhysLink { source: string; target: string }

const MAX_SPEED = 42;      // tope de velocidad por cuadro: nada sale disparado
const BREATH = 1.6;        // amplitud del vaivén en reposo, en unidades del mapa
const FOLLOW_MAX = 24;     // máximo de vecinas que siguen a la arrastrada (un nodo central puede tener cientos)

/** Vecinas de cada nodo. Se calcula una vez por lista de enlaces y se reutiliza. */
const adjCache = new WeakMap<object, Map<string, string[]>>();
export function adjacency(links: PhysLink[]): Map<string, string[]> {
  let adj = adjCache.get(links);
  if (!adj) {
    adj = new Map();
    for (const l of links) {
      (adj.get(l.source) || adj.set(l.source, []).get(l.source)!).push(l.target);
      (adj.get(l.target) || adj.set(l.target, []).get(l.target)!).push(l.source);
    }
    adjCache.set(links, adj);
  }
  return adj;
}

/** Fase propia de cada nodo para el vaivén, derivada de su identificador (estable entre cuadros). */
const phaseCache = new Map<string, number>();
function phase(id: string): number {
  let p = phaseCache.get(id);
  if (p === undefined) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; p = (Math.abs(h) % 6283) / 1000; if (phaseCache.size > 20000) phaseCache.clear(); phaseCache.set(id, p); }
  return p;
}

export interface StepOptions { time: number; breathe?: boolean }

/**
 * Avanza un cuadro. Fijadas y arrastrada no se mueven; el resto va a su destino con resorte e inercia.
 * `pull` (0..1) indica cuánto tira la arrastrada de cada vecina: mientras tira, la vecina afloja su resorte.
 */
export function stepPhysics<N extends PhysNode>(nodes: N[], links: PhysLink[], opts: StepOptions): void {
  // 1. ¿Hay una burbuja arrastrada? Sus vecinas (y, más flojo, las vecinas de estas) la siguen.
  let dragged: N | null = null;
  for (const n of nodes) if (n.isDragged) { dragged = n; break; }
  let pull: Map<string, { toward: PhysNode; k: number; rest: number }> | null = null;
  if (dragged) {
    const adj = adjacency(links), byId = new Map(nodes.map(n => [n.id, n]));
    pull = new Map();
    // Un nodo central con decenas de conexiones no debe arrastrar medio mapa: siguen solo las más cercanas
    // y el tirón se reparte (más conexiones, tirón más suave para cada una).
    const d0 = dragged;
    const all = (adj.get(d0.id) || []).map(id => byId.get(id)).filter((m): m is N => !!m && !m.isPinned && m !== d0);
    const first = all.length > FOLLOW_MAX ? all.sort((p, q) => Math.hypot(p.x - d0.x, p.y - d0.y) - Math.hypot(q.x - d0.x, q.y - d0.y)).slice(0, FOLLOW_MAX) : all;
    const k1 = 0.05 * Math.min(1, 6 / Math.max(1, first.length));
    for (const m of first) pull.set(m.id, { toward: d0, k: k1, rest: (d0.radius || 24) + (m.radius || 24) + 70 });
    // Segundo anillo (vecinas de las vecinas): solo cuando la arrastrada tiene pocas conexiones.
    let budget = first.length <= 8 ? 40 : 0;
    for (const m of first) {
      if (budget <= 0) break;
      for (const id2 of adj.get(m.id) || []) {
        if (budget <= 0) break;
        if (id2 === d0.id || pull.has(id2)) continue;
        const m2 = byId.get(id2); if (!m2 || m2.isPinned) continue;
        pull.set(id2, { toward: m, k: 0.014, rest: (m.radius || 24) + (m2.radius || 24) + 60 }); budget--;
      }
    }
  }

  // 2. Resorte hacia el destino con inercia, vaivén en reposo y tirón de la arrastrada.
  for (const n of nodes) {
    if (n.isPinned) { n.vx = 0; n.vy = 0; n.x = n.pinnedX ?? n.x; n.y = n.pinnedY ?? n.y; continue; }
    if (n.isDragged) { n.vx = 0; n.vy = 0; continue; }
    const mass = Math.max(0.7, (n.radius || 24) / 24);
    const p = pull?.get(n.id);
    let stiffness = 0.06 / mass;
    const damping = 0.84;
    let tx = n.targetX, ty = n.targetY;
    if (opts.breathe) { const ph = phase(n.id); tx += Math.sin(opts.time * 0.9 + ph) * BREATH; ty += Math.cos(opts.time * 0.7 + ph * 1.3) * BREATH; }
    let ax = 0, ay = 0;
    if (p) {
      stiffness *= p.k >= 0.03 ? 0.3 : 0.7; // mientras la jalan fuerte, se suelta de su lugar
      const dx = p.toward.x - n.x, dy = p.toward.y - n.y, d = Math.hypot(dx, dy);
      if (d > p.rest) { const f = ((d - p.rest) * p.k) / mass; ax = (dx / d) * f; ay = (dy / d) * f; }
    }
    const dx = tx - n.x, dy = ty - n.y;
    let vx = ((n.vx || 0) + dx * stiffness + ax) * damping, vy = ((n.vy || 0) + dy * stiffness + ay) * damping;
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) { vx = 0; vy = 0; }
    const sp = Math.hypot(vx, vy); if (sp > MAX_SPEED) { vx = (vx / sp) * MAX_SPEED; vy = (vy / sp) * MAX_SPEED; }
    if (!opts.breathe && !p && Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) { n.vx = 0; n.vy = 0; continue; }
    n.vx = vx; n.vy = vy; n.x += vx; n.y += vy;
  }
}

/** Evita que las etiquetas se encimen: se reserva el rectángulo de cada una y la que choca no se dibuja. */
export class LabelBoard {
  private cells = new Map<number, number[]>(); private rects: number[] = [];
  private static CELL = 96;
  /** true si el rectángulo quedó libre y se reservó; false si choca con otra etiqueta ya puesta. */
  claim(x: number, y: number, w: number, h: number, force = false): boolean {
    const C = LabelBoard.CELL, x0 = Math.floor(x / C), x1 = Math.floor((x + w) / C), y0 = Math.floor(y / C), y1 = Math.floor((y + h) / C);
    if (!force) for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const b = this.cells.get(cx * 73856093 + cy * 19349663); if (!b) continue;
      for (const i of b) { const r = this.rects; if (x < r[i] + r[i + 2] && x + w > r[i] && y < r[i + 1] + r[i + 3] && y + h > r[i + 1]) return false; }
    }
    const i = this.rects.length; this.rects.push(x, y, w, h);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = cx * 73856093 + cy * 19349663; const b = this.cells.get(k); if (b) b.push(i); else this.cells.set(k, [i]); }
    return true;
  }
}
