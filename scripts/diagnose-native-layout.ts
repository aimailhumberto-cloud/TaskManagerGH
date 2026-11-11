// Diagnostico del motor de layout nativo: clasifica el vault y lista "Sin ubicar" con motivo.
// Uso: npx tsx scripts/diagnose-native-layout.ts [rutaVault]
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { classifyNodes, computeBrujulaLayout, computeVersion1Layout } from '../src/lib/cerebroLayout';

const root = process.argv[2] || path.join(__dirname, '..', 'vault');
const nodes: any[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) {
      const c = fs.readFileSync(p, 'utf-8');
      const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      let fm: any = {};
      try { fm = m ? YAML.parse(m[1]) || {} : {}; } catch {}
      const id = fm.id || path.basename(p, '.md').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      nodes.push({ id, title: fm.title || path.basename(p, '.md'), type: fm.type || 'working_memory', frontmatter: fm, body: m ? m[2] : c, filePath: p });
    }
  }
};
walk(root);
const pl = classifyNodes(nodes);
const byAxis: Record<string, number> = {};
for (const p of pl.values()) byAxis[`${p.axis}/${p.column}`] = (byAxis[`${p.axis}/${p.column}`] || 0) + 1;
console.log('Distribucion eje/columna:', byAxis);
console.log('\nSin ubicar:');
for (const p of pl.values()) if (p.axis === 'unplaced') console.log(`  ${p.id} -> ${p.reason}`);
const show = ['market-belize', 'dist-sancas-belize', 'channel-sancas-belize-wholesalers', 'client-brodies-belize', 'person-aleem-mohammed', 'person-anna-mohammed', 'person-clint-villafana', 'person-humberto-bouche', 'brand-busta', 'site-lowland-hampden-site'];
const b = computeBrujulaLayout(nodes, nodes);
const v = computeVersion1Layout(nodes, nodes);
for (const id of show) {
  const p = pl.get(id);
  const fmt = (q?: { x: number; y: number }) => (q ? `(${Math.round(q.x)},${Math.round(q.y)})` : '-');
  console.log(`${id}: ${p?.axis}/${p?.column} parent=${p?.parentId} lane=${p?.lane} brujula=${fmt(b.positions.get(id))} v1=${fmt(v.positions.get(id))}`);
}
// solapes en Brujula (distancia < 20px entre nodos no sobreescritos)
const pts = [...b.positions.entries()];
let overlaps = 0;
for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
  const dx = pts[i][1].x - pts[j][1].x, dy = pts[i][1].y - pts[j][1].y;
  if (dx * dx + dy * dy < 400) overlaps++;
}
console.log('\nPosiciones brujula:', pts.length, 'pares solapados (<20px):', overlaps, 'overrides:', b.overridden.length);
