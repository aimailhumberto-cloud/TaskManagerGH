import { resolveCollisions, resolveCollisionsNaive, type CollisionNode } from '../src/app/cerebro/collision';

let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const make = (n: number, spread: number): CollisionNode[] =>
  Array.from({ length: n }, (_, i) => ({
    x: (rnd() - 0.5) * spread, y: (rnd() - 0.5) * spread,
    radius: [14, 18, 24, 30, 38][Math.floor(rnd() * 5)],
    isPinned: i % 17 === 0, isDragged: i % 53 === 0,
  }));
const clone = (a: CollisionNode[]) => a.map((n) => ({ ...n }));

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '  ok' : 'FALLÓ'}  ${name} ${extra}`); if (!ok) failed++; };

for (const [n, spread] of [[584, 2200], [584, 900], [2000, 3000], [2000, 1500]] as const) {
  const base = make(n, spread);
  const a = clone(base), b = clone(base);
  for (let frame = 0; frame < 5; frame++) { resolveCollisionsNaive(a); resolveCollisions(b, 2); }
  let maxDev = 0;
  for (let i = 0; i < n; i++) maxDev = Math.max(maxDev, Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y));
  const dense = n / (spread * spread) > 5e-4; // amontonados casi unos sobre otros
  check(`${n} nodos en ${spread}px${dense ? ' (muy amontonados)' : ''}: rejilla = todos los pares en 5 cuadros`, dense ? maxDev < 2 : maxDev < 1e-9, `(desviación máx ${maxDev.toExponential(2)})`);
}
check('NaN no rompe', (() => { const a = make(100, 800); a[3].x = NaN; resolveCollisions(a, 2); return true; })());

for (const n of [584, 2000, 5000, 20000]) {
  const base = make(n, Math.sqrt(n) * 90);
  const a = clone(base), b = clone(base);
  const t0 = performance.now(); resolveCollisionsNaive(a); const tn = performance.now() - t0;
  const t1 = performance.now(); resolveCollisions(b, 2); const tg = performance.now() - t1;
  console.log(`  ${String(n).padStart(6)} nodos: todos los pares ${tn.toFixed(1)} ms · rejilla ${tg.toFixed(1)} ms por cuadro`);
}
if (failed) { console.log(`${failed} prueba(s) fallaron`); process.exit(1); }
console.log('pruebas de colisión pasaron');
