// Inventario de tipos de nodo y campos padre en el vault (diagnóstico de layout).
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const root = process.argv[2] || path.join(__dirname, '..', 'vault');
const out = {};
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) {
      const c = fs.readFileSync(p, 'utf-8');
      const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let fm = {};
      try { fm = m ? YAML.parse(m[1]) || {} : {}; } catch {}
      const t = fm.type || 'working_memory';
      (out[t] = out[t] || []).push({
        id: fm.id || e.name, dir: path.relative(root, d),
        keys: ['market','country','country_name','based_in_country','parent_distributor_id','parent_distributor','brand','parent_brand','location','department','channel_of','supplied_by','visual_coordinates','spatial_override'].filter(k => fm[k] !== undefined).map(k => `${k}=${JSON.stringify(fm[k])}`).join(' '),
      });
    }
  }
}
walk(root);
for (const [t, arr] of Object.entries(out)) {
  console.log(`\n## ${t} (${arr.length})`);
  arr.slice(0, Number(process.argv[3] || 6)).forEach(n => console.log(`  ${n.id} [${n.dir}] ${n.keys}`));
}
