import { buildCommunities, DEFAULT_COMMUNITY_THRESHOLD, isCommunityId } from '../src/app/cerebro/communities';
import { nodeLevel } from '../src/app/cerebro/layoutTargets';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '  ok' : 'FALLÓ'}  ${name}${extra ? ' ' + extra : ''}`); if (!ok) failed++; };

// Mundo sintético: núcleo → 5 marcas → cada marca con 30 sabores y 20 empaques; 5 sabores sueltos de otra marca
const nodes: any[] = [{ id: 'core', type: 'core', title: 'Core' }];
const links: any[] = [];
for (let b = 0; b < 5; b++) {
  nodes.push({ id: `brand-${b}`, type: 'brand', title: `Brand: Marca${b}` });
  links.push({ source: 'core', target: `brand-${b}`, relationType: 'x' });
  for (let i = 0; i < 30; i++) { nodes.push({ id: `fl-${b}-${i}`, type: 'flavor', title: `Sabor ${b}-${i}` }); links.push({ source: `brand-${b}`, target: `fl-${b}-${i}`, relationType: 'x' }); }
  for (let i = 0; i < 20; i++) { nodes.push({ id: `pk-${b}-${i}`, type: 'packaging', title: `Pack ${b}-${i}` }); links.push({ source: `brand-${b}`, target: `pk-${b}-${i}`, relationType: 'x' }); }
}
nodes.push({ id: 'brand-x', type: 'brand', title: 'Brand: Pequeña' });
for (let i = 0; i < 5; i++) { nodes.push({ id: `fl-x-${i}`, type: 'flavor', title: `Sabor x-${i}` }); links.push({ source: 'brand-x', target: `fl-x-${i}`, relationType: 'x' }); }
// enlaces cruzados entre un sabor de la marca 0 y uno de la marca 1
links.push({ source: 'fl-0-0', target: 'fl-1-0', relationType: 'combina' });
const opts = { threshold: 100, levelOf: nodeLevel };
const total = nodes.length;

const off = buildCommunities(nodes, links, { ...opts, threshold: DEFAULT_COMMUNITY_THRESHOLD });
check(`con ${total} nodos y umbral ${DEFAULT_COMMUNITY_THRESHOLD}: no cambia nada`, off.nodes === nodes && off.links === links && off.members.size === 0);

const r = buildCommunities(nodes, links, opts);
const comms = r.nodes.filter((n) => n.type === 'community');
check('se crean 10 comunidades (5 marcas × sabores y empaques)', comms.length === 10, `(${comms.length})`);
check('todas tienen id de comunidad y título con el conteo', comms.every((c) => isCommunityId(c.id) && /^\d+ /.test(c.title)));
check('un título de ejemplo es legible', comms.some((c) => c.title === '30 sabores · Marca0'), JSON.stringify(comms.map((c) => c.title).slice(0, 3)));
check('los sabores sueltos (menos de 12) no se agrupan', r.nodes.filter((n) => n.id.startsWith('fl-x-')).length === 5);
check('marcas y núcleo nunca se agrupan', r.nodes.some((n) => n.id === 'core') && r.nodes.filter((n) => n.type === 'brand').length === 6);
check('los miembros agrupados desaparecen del mapa', !r.nodes.some((n) => n.id === 'fl-0-3'));
check('bajan los nodos dibujados', r.nodes.length === total - 250 + 10, `(${total} → ${r.nodes.length})`);
check('no hay enlaces duplicados', new Set(r.links.map((l) => `${l.source}->${l.target}`)).size === r.links.length);
check('ningún enlace apunta a un nodo que no existe', (() => { const ids = new Set(r.nodes.map((n) => n.id)); return r.links.every((l) => ids.has(l.source as string) && ids.has(l.target as string)); })());
check('los enlaces entre dos comunidades de la misma marca no se vuelven lazos', r.links.every((l) => l.source !== l.target));
check('el enlace cruzado une las dos comunidades de sabores', r.links.some((l) => String(l.source).includes('flavor|brand-0') && String(l.target).includes('flavor|brand-1')));
check('la marca queda unida a su comunidad', r.links.some((l) => l.source === 'brand-0' && String(l.target).startsWith('community::flavor|brand-0')));

const key = [...r.keys.values()][0];
const opened = buildCommunities(nodes, links, { ...opts, openKeys: new Set([key]) });
check('abrir una comunidad devuelve sus miembros sueltos', opened.nodes.filter((n) => n.type === 'community').length === 9 && opened.nodes.length > r.nodes.length);
const prot = buildCommunities(nodes, links, { ...opts, protectedIds: new Set(['fl-0-1']) });
check('un nodo protegido (seleccionado o anclado) no se agrupa', prot.nodes.some((n) => n.id === 'fl-0-1'));
check('los nodos originales no se modifican', nodes.length === total && nodes.every((n) => n.type !== 'community'));
check('es determinista', JSON.stringify(buildCommunities(nodes, links, opts).nodes.map((n) => n.id)) === JSON.stringify(r.nodes.map((n) => n.id)));

// Rendimiento con escala
const bigN: any[] = [{ id: 'core', type: 'core', title: 'Core' }]; const bigL: any[] = [];
for (let b = 0; b < 40; b++) { bigN.push({ id: `b${b}`, type: 'brand', title: `B${b}` }); bigL.push({ source: 'core', target: `b${b}`, relationType: 'x' }); for (let i = 0; i < 500; i++) { bigN.push({ id: `f${b}-${i}`, type: 'flavor', title: `F${b}-${i}` }); bigL.push({ source: `b${b}`, target: `f${b}-${i}`, relationType: 'x' }); } }
const t0 = performance.now(); const big = buildCommunities(bigN, bigL, { ...opts, threshold: 900 }); const ms = performance.now() - t0;
check(`${bigN.length} nodos → ${big.nodes.length} dibujados`, big.nodes.length === 1 + 40 + 40, `en ${ms.toFixed(0)} ms`);
check('con 20.000 nodos tarda menos de 250 ms', ms < 250);

if (failed) { console.log(`${failed} prueba(s) fallaron`); process.exit(1); }
console.log('pruebas de comunidades pasaron');
