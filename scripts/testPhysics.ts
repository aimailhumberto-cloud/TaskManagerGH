// Pruebas del movimiento de las burbujas. Uso: npm run test:physics
import { stepPhysics, LabelBoard, type PhysNode } from '../src/app/cerebro/physics';
let fails = 0; const ok = (c: boolean, m: string) => { if (!c) { fails++; console.error('FALLA:', m); } };
const mk = (id: string, x: number, y: number, tx = x, ty = y, extra: Partial<PhysNode> = {}): PhysNode => ({ id, x, y, targetX: tx, targetY: ty, radius: 24, vx: 0, vy: 0, ...extra });

// 1. Sin vaivén, un nodo llega a su destino y se queda quieto.
{ const n = [mk('a', 0, 0, 300, -200)]; for (let i = 0; i < 400; i++) stepPhysics(n, [], { time: i * 0.012 }); ok(Math.hypot(n[0].x - 300, n[0].y + 200) < 0.5, 'llega al destino'); ok(n[0].vx === 0 && n[0].vy === 0, 'queda en reposo'); }
// 2. Con vaivén se mantiene cerca del destino (no deriva).
{ const n = [mk('a', 10, 10)]; let max = 0; for (let i = 0; i < 3000; i++) { stepPhysics(n, [], { time: i * 0.012, breathe: true }); max = Math.max(max, Math.hypot(n[0].x - 10, n[0].y - 10)); } ok(max < 6, 'el vaivén no se aleja más de 6 (' + max.toFixed(2) + ')'); }
// 3. Fijada no se mueve; arrastrada no se mueve sola.
{ const n = [mk('p', 5, 5, 400, 400, { isPinned: true, pinnedX: 5, pinnedY: 5 }), mk('d', 50, 50, 0, 0, { isDragged: true })]; for (let i = 0; i < 100; i++) stepPhysics(n, [], { time: i }); ok(n[0].x === 5 && n[0].y === 5, 'fijada quieta'); ok(n[1].x === 50 && n[1].y === 50, 'arrastrada quieta'); }
// 4. Al arrastrar, la vecina se acerca; la que no está conectada, no; la fijada, tampoco.
{ const d = mk('d', 600, 0, 600, 0, { isDragged: true }), v = mk('v', 0, 0), x = mk('x', 0, 100), f = mk('f', 0, 200, 0, 200, { isPinned: true, pinnedX: 0, pinnedY: 200 });
  const links = [{ source: 'd', target: 'v' }, { source: 'd', target: 'f' }]; const n = [d, v, x, f];
  for (let i = 0; i < 300; i++) stepPhysics(n, links, { time: i * 0.012 });
  ok(v.x > 120, 'la vecina sigue a la arrastrada (' + v.x.toFixed(0) + ')'); ok(Math.abs(x.x) < 1, 'la no conectada se queda'); ok(f.x === 0, 'la fijada no se mueve');
  d.isDragged = false; d.isPinned = true; d.pinnedX = 600; d.pinnedY = 0; for (let i = 0; i < 600; i++) stepPhysics(n, links, { time: i * 0.012 });
  ok(Math.abs(v.x) < 1, 'al soltar, la vecina vuelve a su lugar (' + v.x.toFixed(2) + ')'); }
// 5. Nada explota: 3.000 nodos con destinos lejanos y un valor corrupto.
{ const n: PhysNode[] = []; for (let i = 0; i < 3000; i++) n.push(mk('n' + i, (i % 60) * 40, Math.floor(i / 60) * 40, (i * 37) % 5000, (i * 91) % 5000)); n[7].vx = NaN;
  const links = n.slice(1).map((m, i) => ({ source: n[i % 50].id, target: m.id })); n[0].isDragged = true;
  const t0 = performance.now(); for (let i = 0; i < 120; i++) stepPhysics(n, links, { time: i * 0.012, breathe: true }); const ms = (performance.now() - t0) / 120;
  ok(n.every(m => Number.isFinite(m.x) && Number.isFinite(m.y)), 'sin NaN'); ok(n.every(m => Math.hypot(m.vx || 0, m.vy || 0) <= 42.01), 'velocidad con tope');
  console.log(`3.000 nodos: ${ms.toFixed(2)} ms por cuadro`); ok(ms < 8, 'un cuadro de 3.000 nodos cabe en 8 ms'); }
// 6. Etiquetas: la segunda encimada se rechaza; forzada entra; lejos entra.
{ const b = new LabelBoard(); ok(b.claim(0, 0, 100, 30), 'primera etiqueta'); ok(!b.claim(50, 10, 100, 30), 'encimada se rechaza'); ok(b.claim(50, 10, 100, 30, true), 'destacada entra'); ok(b.claim(400, 400, 100, 30), 'lejana entra'); }
console.log(fails ? `${fails} fallas` : 'física: todo ok'); process.exit(fails ? 1 : 0);
