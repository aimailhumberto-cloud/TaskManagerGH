import { countVisibleNodes } from '../src/app/cerebro/scopeCounts';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '  ok' : 'FALLÓ'}  ${name}${extra ? ' ' + extra : ''}`); if (!ok) failed++; };
const mk = (type: string, n: number, extra: any = {}) => Array.from({ length: n }, (_, i) => ({ id: `${type}-${i}`, title: `${type} ${i}`, type, ...extra }));
// niveles: core 0, brand/department/market 1, flavor 3, packaging 4, product_variant 5, person 3
const nodes = [...mk('core', 1), ...mk('brand', 6), ...mk('department', 11), ...mk('flavor', 100), ...mk('packaging', 50), ...mk('product_variant', 200), ...mk('person', 70)];

check('recogido: núcleo + primer anillo', countVisibleNodes(nodes, 'collapsed', 'collapsed') === 1 + 6 + 11);
check('catálogo todo suma sabores, empaques y SKUs', countVisibleNodes(nodes, 'all', 'collapsed') === 18 + 350);
check('organización todo suma las personas', countVisibleNodes(nodes, 'collapsed', 'all') === 18 + 70);
check('todo desplegado = todos los nodos', countVisibleNodes(nodes, 'all', 'all') === nodes.length);
check('una marca concreta suma solo la suya', countVisibleNodes([...nodes, { id: 'flavor-zzz-chubby', title: 'x', type: 'flavor' }], 'chubby', 'collapsed') === 18 + 1);
check('sin datos no falla', countVisibleNodes([], 'all', 'all') === 0);
if (failed) { console.log(`${failed} prueba(s) fallaron`); process.exit(1); }
console.log('pruebas de conteo pasaron');
