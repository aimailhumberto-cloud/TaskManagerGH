// Diagnóstico: campos de jerarquía en personas y departamentos del vault.
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const root = process.argv[2] || path.join(__dirname, '..', 'vault');
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc); else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}
for (const f of walk(root)) {
  const c = fs.readFileSync(f, 'utf-8');
  const m = c.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let fm = {}; try { fm = m ? YAML.parse(m[1]) || {} : {}; } catch {}
  if (!['person', 'department', 'organization', 'group', 'site', 'role'].includes(fm.type)) continue;
  const pick = {};
  for (const k of Object.keys(fm)) {
    if (/report|manag|head|lead|depart|position|job_title|role|location|country|organization|employer|parent|hierarchy/i.test(k)) pick[k] = fm[k];
  }
  const rel = fm.relations ? Object.fromEntries(Object.entries(fm.relations).map(([k, v]) => [k, v])) : {};
  console.log(`${fm.type} ${fm.id} :: ${JSON.stringify(pick)} :: rel=${JSON.stringify(rel)}`.slice(0, 600));
}
