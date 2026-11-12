// Mide cuánto cuesta calcular el layout nativo del mapa (brújula y V1) con los datos reales.
// Uso: npx tsx scripts/benchCerebroLayout.ts [url-del-mapa-lite]
// Sirve para decidir, con datos, cuándo vale la pena mover cálculo al servidor o agrupar nodos.
import { computeNativeLayout } from '../src/lib/cerebroLayout';

const url = process.argv[2] || 'https://taskmanagergh.onrender.com/api/agent/brain?view=lite';

function time<T>(f: () => T, n = 15) {
  const a: number[] = []; let r!: T;
  for (let i = 0; i < n; i++) { const s = performance.now(); r = f(); a.push(performance.now() - s); }
  a.sort((x, y) => x - y);
  return { med: +a[Math.floor(n / 2)].toFixed(2), r };
}

async function main() {
  const res = await fetch(url);
  const d: any = await res.json();
  const g = d.data || d;
  const all: any[] = g.nodes;
  console.log(`${all.length} nodos, ${(g.links || []).length} enlaces`);

  for (const view of ['brujula', 'version-1-ajustada'] as const) {
    const t = time(() => computeNativeLayout(view, all, all));
    console.log(`${view}: ${t.med} ms con todos los nodos visibles`);
  }
  for (const k of [2, 5, 10]) {
    const big: any[] = [];
    for (let i = 0; i < k; i++) for (const n of all) big.push({ ...n, id: `${n.id}#${i}` });
    const t = time(() => computeNativeLayout('brujula', big, big), 5);
    console.log(`brujula con ${big.length} nodos (sintético x${k}): ${t.med} ms`);
  }

  // ¿La posición depende de qué nodos están visibles? Si sí, un layout precalculado "de todo" no sirve.
  const first = ['core', 'brand', 'market', 'department', 'organization', 'customer', 'channel', 'distributor', 'site', 'group', 'country'];
  const sub = all.filter((n) => first.includes(n.type));
  const full: any = computeNativeLayout('brujula', all, all);
  const part: any = computeNativeLayout('brujula', sub, all);
  let moved = 0, maxd = 0;
  for (const n of sub) {
    const a = full.positions.get(n.id), b = part.positions.get(n.id);
    if (!a || !b) continue;
    const dd = Math.hypot(a.x - b.x, a.y - b.y);
    if (dd > 0.01) { moved++; maxd = Math.max(maxd, dd); }
  }
  console.log(`de ${sub.length} nodos del primer anillo, ${moved} cambian de lugar según qué otros se vean (hasta ${maxd.toFixed(0)} px)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
