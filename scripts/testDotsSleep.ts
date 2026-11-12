import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  buildSleepReport, applyDecisions, runSleepCycle, recordDecision, loadDecisions, loadLatestReport,
  listReportDays, needsNightlyReport, getSleepDir, KEEP_REPORTS, type SleepInputNode,
} from '../src/lib/dotsSleep';

let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '  ok' : 'FALLÓ'}  ${name}${extra ? ' ' + extra : ''}`); if (!ok) failed++; };

// 2026-11-12 09:00 en Panamá = 14:00 UTC
const NOW = new Date('2026-11-12T14:00:00Z');
const n = (id: string, over: Partial<SleepInputNode> = {}): SleepInputNode => ({ id, title: id, type: 'brand', memory_tier: 'long_term', links: ['x'], frontmatter: {}, ...over });

const nodes: SleepInputNode[] = [
  n('core-1', { type: 'core' }),
  n('wm-old', { type: 'working_memory', memory_tier: 'working', frontmatter: { captured_at: '2026-11-05T10:00:00-05:00' } }),
  n('wm-new', { type: 'working_memory', memory_tier: 'working', frontmatter: { captured_at: '2026-11-12T08:00:00-05:00' } }),
  n('wm-nodate', { type: 'working_memory', memory_tier: 'working', frontmatter: {} }),
  n('wm-fromid-20261101', { type: 'working_memory', memory_tier: 'working', frontmatter: {} }),
  n('cust-a', { type: 'customer', frontmatter: { next_followup_date: '2026-11-01', next_followup_action: 'Llamar' } }),
  n('cust-b', { type: 'customer', frontmatter: { next_followup_date: '2026-11-20' } }),
  n('brand-a', { title: 'Brand: Chubby' }),
  n('brand-b', { title: 'Chubby' }),
  n('lonely', { links: [] }),
  n('incomplete', { completeness_score: 30 }),
  n('complete', { completeness_score: 90 }),
  n('pending', { status: 'pending_source_validation' }),
];
const links = [
  { source: 'core-1', target: 'brand-a' }, { source: 'core-1', target: 'cust-a' }, { source: 'core-1', target: 'cust-b' },
  { source: 'cust-a', target: 'role---no-existe' }, { source: 'core-1', target: 'wm-old' },
];
const r = buildSleepReport(nodes, links, NOW);
const of = (k: string) => r.proposals.filter((p) => p.kind === k);

check('modo solo propuestas', r.mode === 'solo_propuestas');
check('día en hora de Panamá', r.day === '2026-11-12');
check('memoria de trabajo vieja: la de 7 días y la que se deduce del id', of('memoria_de_trabajo_vieja').some((p) => p.nodeIds[0] === 'wm-old') && of('memoria_de_trabajo_vieja').some((p) => p.nodeIds[0] === 'wm-fromid-20261101'));
check('memoria de trabajo de hoy no se propone', !of('memoria_de_trabajo_vieja').some((p) => p.nodeIds[0] === 'wm-new'));
check('memoria sin fecha se avisa aparte', of('memoria_de_trabajo_vieja').some((p) => p.nodeIds[0] === 'wm-nodate' && p.title.includes('sin fecha')));
check('seguimiento vencido (11 días = alta)', of('seguimiento_vencido').length === 1 && of('seguimiento_vencido')[0].severity === 'alta');
check('seguimiento futuro no se propone', !of('seguimiento_vencido').some((p) => p.nodeIds[0] === 'cust-b'));
check('enlace roto detectado', of('enlace_roto').length === 1 && of('enlace_roto')[0].title.includes('role---no-existe'));
check('duplicado por nombre normalizado', of('posible_duplicado').length === 1 && of('posible_duplicado')[0].nodeIds.length === 2);
check('nodo aislado detectado', of('nodo_aislado').length === 1 && of('nodo_aislado')[0].nodeIds.includes('lonely'));
check('el núcleo no cuenta como aislado', !of('nodo_aislado')[0].nodeIds.includes('core-1'));
check('ficha incompleta solo la de 30%', of('ficha_incompleta').length === 1 && of('ficha_incompleta')[0].nodeIds[0] === 'incomplete');
check('sin verificar detectado', of('sin_verificar').length === 1 && of('sin_verificar')[0].nodeIds[0] === 'pending');
check('ordenadas de más a menos grave', r.proposals[0].severity === 'alta');
check('ids estables entre corridas', JSON.stringify(buildSleepReport(nodes, links, NOW).proposals.map((p) => p.id)) === JSON.stringify(r.proposals.map((p) => p.id)));
check('ids únicos', new Set(r.proposals.map((p) => p.id)).size === r.proposals.length);

// Decisiones
const dec = { [of('enlace_roto')[0].id]: { decision: 'rechazada' as const, decidedAt: NOW.toISOString() }, [of('sin_verificar')[0].id]: { decision: 'aprobada' as const, decidedAt: NOW.toISOString() }, [of('ficha_incompleta')[0].id]: { decision: 'pospuesta' as const, decidedAt: NOW.toISOString() } };
const a = applyDecisions(r, dec, NOW);
check('rechazada deja de proponerse', !a.proposals.some((p) => p.kind === 'enlace_roto') && a.hidden.rechazadas === 1);
check('pospuesta se oculta 7 días', !a.proposals.some((p) => p.kind === 'ficha_incompleta') && a.hidden.pospuestas === 1);
check('aprobada queda visible y marcada', a.proposals.some((p: any) => p.kind === 'sin_verificar' && p.decision?.decision === 'aprobada'));
const later = applyDecisions(r, dec, new Date(NOW.getTime() + 8 * 86400000));
check('pospuesta vuelve a los 8 días', later.proposals.some((p) => p.kind === 'ficha_incompleta'));

// Almacenamiento + garantía de no tocar el vault
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dots-sleep-'));
const vault = path.join(root, 'vault');
fs.mkdirSync(path.join(vault, 'sub'), { recursive: true });
fs.writeFileSync(path.join(vault, 'a.md'), '---\nid: a\n---\nhola');
fs.writeFileSync(path.join(vault, 'sub', 'b.md'), '---\nid: b\n---\nchao');
const hashTree = (dir: string): string => {
  const h = crypto.createHash('sha1');
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else h.update(p + fs.readFileSync(p)); } };
  walk(dir); return h.digest('hex');
};
const before = hashTree(vault);
check('antes del primer informe toca generarlo (09:00 Panamá)', needsNightlyReport(vault, NOW) === true);
check('antes de las 2 a.m. no toca', needsNightlyReport(vault, new Date('2026-11-12T06:30:00Z')) === false);
runSleepCycle(vault, { nodes, links }, NOW);
recordDecision(vault, of('enlace_roto')[0].id, 'rechazada', 'hb', 'ya lo corrijo', NOW);
check('el vault queda idéntico (no se tocó ninguna nota)', hashTree(vault) === before);
check('el informe vive fuera del vault', getSleepDir(vault).startsWith(root) && !getSleepDir(vault).startsWith(vault));
check('se puede leer el último informe', loadLatestReport(vault)?.day === '2026-11-12');
check('la decisión quedó registrada', loadDecisions(vault)[of('enlace_roto')[0].id]?.decision === 'rechazada');
check('ya hay informe de hoy: no se repite', needsNightlyReport(vault, NOW) === false);
check('al día siguiente después de las 2 a.m. toca otra vez', needsNightlyReport(vault, new Date('2026-11-13T09:00:00Z')) === true);
for (let i = 0; i < KEEP_REPORTS + 5; i++) runSleepCycle(vault, { nodes, links }, new Date(NOW.getTime() - (i + 1) * 86400000));
check(`solo se conservan ${KEEP_REPORTS} informes`, listReportDays(vault).length === KEEP_REPORTS);
check('el vault sigue idéntico tras muchas corridas', hashTree(vault) === before);
fs.rmSync(root, { recursive: true, force: true });

if (failed) { console.log(`${failed} prueba(s) fallaron`); process.exit(1); }
console.log('pruebas del ciclo nocturno pasaron');
