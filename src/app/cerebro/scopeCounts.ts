// Cuántos nodos muestra el mapa con cada ajuste de «Catálogo» y «Estructura y personal».
// Es la misma regla que usa setupNodesWithMode en page.tsx (sin contar lo abierto a mano).
// Reemplaza números escritos a mano en el menú, que ya habían quedado desactualizados.
import { nodeLevel, isNodeLeader, getPersonDeptCategory } from './layoutTargets';

const CATALOG_SUB = new Set(['flavor', 'packaging', 'product_line', 'product_variant']);

export function countVisibleNodes(nodes: any[], catalogScope: string, orgScope: string): number {
  let count = 0;
  for (const n of nodes) {
    if (nodeLevel(n.type) <= 1) { count++; continue; }
    if (CATALOG_SUB.has(n.type)) {
      if (catalogScope === 'collapsed') continue;
      if (catalogScope === 'all') { count++; continue; }
      const id = (n.id || '').toLowerCase();
      const title = (n.title || '').toLowerCase();
      if (id.includes(catalogScope) || title.includes(catalogScope)) count++;
      continue;
    }
    if (orgScope === 'collapsed') continue;
    if (orgScope === 'all') { count++; continue; }
    if (n.type === 'person') {
      if (orgScope === 'organizations' ? isNodeLeader(n) : getPersonDeptCategory(n) === orgScope) count++;
      continue;
    }
    if (orgScope === 'organizations' && n.type === 'organization') count++;
  }
  return count;
}
