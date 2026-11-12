// Separación anti-solapamiento entre nodos (margen físico de 24 px).
// La versión con rejilla da el mismo resultado que comparar todos los pares,
// pero solo mira vecinos cercanos: el costo crece con los nodos, no con su cuadrado.

export interface CollisionNode {
  x: number;
  y: number;
  radius?: number;
  isPinned?: boolean;
  isDragged?: boolean;
}

const MARGIN = 24;
// Medido en producción con el mapa real desplegado (584 nodos, agrupados en cúmulos densos):
// comparar todos los pares ≈ 4,6 ms por cuadro; con rejilla ≈ 1,4 ms. Con pocos nodos
// visibles (mapa recogido, ~100) la diferencia no importa, así que el umbral es bajo.
// (En una prueba sintética con nodos al azar la rejilla no ganaba hasta ~1.000: la densidad real manda.)
const GRID_FROM = 300;

function pushPair(n1: CollisionNode, n2: CollisionNode) {
  const r1 = n1.radius || 24;
  const r2 = n2.radius || 24;
  const minSpacing = r1 + r2 + MARGIN;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const distSq = dx * dx + dy * dy;
  if (distSq < minSpacing * minSpacing && distSq > 0.001) {
    const dist = Math.sqrt(distSq);
    const overlap = (minSpacing - dist) * 0.5;
    const nx = dx / dist;
    const ny = dy / dist;
    if (!n1.isPinned && !n1.isDragged) {
      n1.x -= nx * overlap * 0.45;
      n1.y -= ny * overlap * 0.45;
    }
    if (!n2.isPinned && !n2.isDragged) {
      n2.x += nx * overlap * 0.45;
      n2.y += ny * overlap * 0.45;
    }
  }
}

/** Referencia: compara todos los pares (la lógica original). Se usa en las pruebas. */
export function resolveCollisionsNaive(nodes: CollisionNode[]) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) pushPair(nodes[i], nodes[j]);
  }
}

const cellKey = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;

/** Mismo resultado que la referencia, usando una rejilla espacial. */
export function resolveCollisions(nodes: CollisionNode[], gridFrom = GRID_FROM) {
  const n = nodes.length;
  if (n < 2) return;
  if (n < gridFrom) { resolveCollisionsNaive(nodes); return; }

  let maxR = 24;
  for (let i = 0; i < n; i++) {
    const r = nodes[i].radius || 24;
    if (r > maxR) maxR = r;
  }
  // Holgura de 1,5x: un nodo empujado en este mismo cuadro no se sale de su vecindad.
  const cell = (maxR * 2 + MARGIN) * 1.5;
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const { x, y } = nodes[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const k = cellKey(Math.floor(x / cell), Math.floor(y / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(i); else grid.set(k, [i]);
  }

  const cand: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
    const cx = Math.floor(a.x / cell);
    const cy = Math.floor(a.y / cell);
    cand.length = 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = grid.get(cellKey(cx + ox, cy + oy));
        if (!bucket) continue;
        for (const j of bucket) if (j > i) cand.push(j);
      }
    }
    // Mismo orden que el recorrido completo (j ascendente).
    cand.sort((p, q) => p - q);
    for (const j of cand) pushPair(a, nodes[j]);
  }
}
