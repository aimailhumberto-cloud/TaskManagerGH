import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
import { autoApply, loadAutonomy, saveAutonomy, logActivity, recentActivity, AUTO_ACTOR } from '../src/lib/autonomy';
import { loadDecisions, recordDecision } from '../src/lib/dotsSleep';
import { loadApplied, undoProposal } from '../src/lib/sleepApply';
let fail = 0;
const eq = (n: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.error('FALLA', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-')), vault = path.join(root, 'vault'); fs.mkdirSync(vault, { recursive: true });
const w = (id: string, fm: string) => { const f = path.join(vault, id + '.md'); fs.writeFileSync(f, `---\nid: ${id}\ntitle: ${id}\n${fm}\n---\ntexto\n`); return { id, filePath: f }; };
const nodes = [w('a', 'memory_tier: working\nstatus: active'), w('b', 'memory_tier: working\nstatus: active'), w('c', 'status: pending_verification'), w('d', 'memory_tier: working\nstatus: active'), w('e', 'memory_tier: working\nstatus: active')];
const props = [
  { id: 'pa', kind: 'memoria_de_trabajo_vieja', title: 'A', nodeIds: ['a'] }, { id: 'pb', kind: 'memoria_de_trabajo_vieja', title: 'B', nodeIds: ['b'] },
  { id: 'pc', kind: 'sin_verificar', title: 'C', nodeIds: ['c'] }, { id: 'pd', kind: 'memoria_de_trabajo_vieja', title: 'D', nodeIds: ['d'] },
  { id: 'pe', kind: 'memoria_de_trabajo_vieja', title: 'E', nodeIds: ['e'] }, { id: 'pf', kind: 'enlace_roto', title: 'F', nodeIds: ['a'] },
];
const rv = (apply: number | null) => ({ apply, urgency: 1, urgencyConfidence: 1, model: 'm', at: 'x' });
const reviews = { pa: rv(0.95), pb: rv(0.6), pc: rv(0.99), pd: rv(0.9), pe: rv(null), pf: rv(0.99) };
eq('por defecto automático', loadAutonomy(vault), { mode: 'auto', threshold: 0.85 });
recordDecision(vault, 'pd', 'rechazada', 'HB');
const r = autoApply(vault, props, reviews, nodes);
eq('aplicó solo la clara', r.applied.map(x => x.id), ['pa']);
eq('a consolidada', /memory_tier: long_term/.test(fs.readFileSync(nodes[0].filePath, 'utf8')), true);
eq('b baja confianza intacta', /memory_tier: working/.test(fs.readFileSync(nodes[1].filePath, 'utf8')), true);
eq('verificar NUNCA solo', /pending_verification/.test(fs.readFileSync(nodes[2].filePath, 'utf8')), true);
eq('rechazada por HB se respeta', /memory_tier: working/.test(fs.readFileSync(nodes[3].filePath, 'utf8')), true);
eq('sin opinión no aplica', /memory_tier: working/.test(fs.readFileSync(nodes[4].filePath, 'utf8')), true);
eq('quién', [loadApplied(vault).pa.by, loadDecisions(vault).pa.decidedBy], [AUTO_ACTOR, AUTO_ACTOR]);
eq('no repite', autoApply(vault, props, reviews, nodes).applied.length, 0);
eq('se deshace', undoProposal(vault, 'pa').ok, true);
saveAutonomy(vault, { mode: 'proponer' });
eq('modo propuesta no aplica', autoApply(vault, [{ id: 'pb2', kind: 'memoria_de_trabajo_vieja', title: 'B', nodeIds: ['b'] }], { pb2: rv(0.99) }, nodes).applied.length, 0);
eq('umbral inválido ignorado', saveAutonomy(vault, { threshold: 0.1 }).threshold, 0.85); eq('umbral válido', saveAutonomy(vault, { mode: 'auto', threshold: 0.9 }), { mode: 'auto', threshold: 0.9 });
logActivity(vault, { actor: 'agente', path: '/api/agent/brain', action: 'remember_working', status: 201 });
eq('actividad', (recentActivity(vault)[0] as any).action, 'remember_working');
if (fail) { console.error(fail + ' fallas'); process.exit(1); } console.log('autonomía: todo ok');
