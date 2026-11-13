import * as fs from 'fs'; import * as os from 'os'; import * as path from 'path';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-'));
const primaryVault = path.join(root, 'vault'); fs.mkdirSync(path.join(primaryVault, '01'), { recursive: true });
fs.writeFileSync(path.join(primaryVault, '01', 'Core.md'), '---\nid: core-sm-jaleel\ntitle: SMJ\ntype: core\n---\nSECRETO-DE-HB\n');
fs.writeFileSync(path.join(primaryVault, '01', 'Privado.md'), '---\nid: privado-hb\ntitle: Privado HB\ntype: person\n---\nSECRETO-DE-HB\n');
fs.writeFileSync(path.join(root, 'fuera.md'), 'FUERA');
process.env.SMJ_VAULT_PATH = primaryVault; process.env.LOCAL_ACCOUNTS_FILE = path.join(root, 'accounts', 'accounts.json');
process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef'; process.env.AGENT_API_KEY = 'llave-agente-de-prueba';
import * as S from '../src/lib/smjBrainService';
import * as B from '../src/lib/brains';
import { runInBrain, currentBrain } from '../src/lib/brainContext';
import { createAccount, updateAccount } from '../src/lib/localAccounts';
import { encryptSession } from '../src/lib/session';
import { ownBrainDecision } from '../src/lib/loginGate';
let fail = 0;
const eq = (n: string, a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fail++; console.error('FALLA', n, JSON.stringify(a), '!=', JSON.stringify(b)); } };
const hb = createAccount({ email: 'hb@t.co', name: 'HB', role: 'Owner', password: 'Clave-larga-123', createdBy: 'setup' });
const ana = createAccount({ email: 'ana@t.co', name: 'Ana', role: 'Miembro', password: 'Clave-larga-123', createdBy: hb.id });
const luis = createAccount({ email: 'luis@t.co', name: 'Luis', role: 'Gerente', password: 'Clave-larga-123', createdBy: hb.id });
const ro = createAccount({ email: 'ro@t.co', name: 'Rosa', role: 'Solo lectura', password: 'Clave-larga-123', createdBy: hb.id });
const tok = (a: { id: string; email: string; role: string; createdBy: string }) => encryptSession({ userId: a.id, personId: a.id, email: a.email, role: a.role, brain: B.brainIdForAccount(a), createdAt: new Date().toISOString() });
const H = (o: Record<string, string> = {}) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });
const res = (a: any, extra: Partial<B.ResolveInput> = {}) => B.resolveBrain({ sessionToken: a ? tok(a) : undefined, headers: H(), path: '/api/agent/brain', method: 'GET', ...extra });
const ctxOf = (r: B.Resolved) => { if (!r.ok) throw new Error(r.error); return r.ctx; };

// --- quién abre qué
eq('HB → principal', ctxOf(res(hb)).brainId, 'hb'); eq('HB ruta', ctxOf(res(hb)).vaultPath, primaryVault);
const anaCtx = ctxOf(res(ana)), luisCtx = ctxOf(res(luis));
eq('Ana → suyo', anaCtx.brainId, ana.id); eq('Ana ruta', anaCtx.vaultPath, path.join(root, 'brains', ana.id, 'vault'));
eq('cerebro creado', fs.existsSync(path.join(anaCtx.vaultPath, '01-Internal-Clients', 'Core.md')), true);
eq('distintos', anaCtx.vaultPath !== luisCtx.vaultPath && anaCtx.vaultPath !== primaryVault, true);
eq('llave → principal', ctxOf(B.resolveBrain({ headers: H({ 'x-agent-key': 'llave-agente-de-prueba' }), path: '/x', method: 'GET' })).via, 'llave');
// el navegador no elige: cookie de vista ignorada para quien no es Owner/Admin
eq('Ana no mira a HB', ctxOf(res(ana, { brainView: 'hb' })).brainId, ana.id);
eq('Luis (Gerente) no mira a Ana', ctxOf(res(luis, { brainView: ana.id })).brainId, luis.id);
eq('ruta inventada', ctxOf(res(ana, { brainView: '../../vault' })).brainId, ana.id);
eq('HB mira a Ana', ctxOf(res(hb, { brainView: ana.id })).brainId, ana.id);
eq('HB vista inexistente → el suyo', ctxOf(res(hb, { brainView: 'local-999' })).brainId, 'hb');
eq('HB vista con ruta → el suyo', ctxOf(res(hb, { brainView: '../x' })).brainId, 'hb');
eq('acceso registrado', fs.readFileSync(path.join(root, 'accounts', 'brain-access.jsonl'), 'utf8').includes(`"brainId":"${ana.id}"`), true);
updateAccount(ro.id, { isActive: false }, { id: hb.id, role: 'Owner' });
eq('desactivada no entra', res(ro).ok, false);
eq('vaultPathFor inválido', [B.vaultPathFor('../x'), B.vaultPathFor('local-1/../..'), B.vaultPathFor('')], [null, null, null]);

// --- dentro de cada cerebro solo existe lo suyo
const inAna = <T>(f: () => T) => runInBrain(anaCtx, f), inLuis = <T>(f: () => T) => runInBrain(luisCtx, f);
eq('sin contexto = principal', [currentBrain(), S.getVaultPath()], [null, primaryVault]);
const gHB = S.loadBrainGraph(); eq('HB ve lo suyo', (gHB.allNodes || gHB.nodes).some(n => n.id === 'privado-hb'), true);
const gAna = inAna(() => S.loadBrainGraph());
eq('Ana: 1 nodo', (gAna.allNodes || gAna.nodes).map(n => n.id), [`core-${ana.id}`]);
eq('Ana no ve secreto', JSON.stringify(gAna).includes('SECRETO-DE-HB'), false);
inAna(() => S.saveWorkingMemory({ title: 'Nota de Ana', content: 'SOLO-ANA', source: 'prueba' } as any));
eq('Ana ve su nota', JSON.stringify(inAna(() => S.loadBrainGraph())).includes('SOLO-ANA'), true);
eq('Luis no ve la de Ana', JSON.stringify(inLuis(() => S.loadBrainGraph())).includes('SOLO-ANA'), false);
eq('HB no ve la de Ana', JSON.stringify(S.loadBrainGraph()).includes('SOLO-ANA'), false);
eq('caché no mezcla (HB otra vez)', (S.loadBrainGraph().allNodes || []).some(n => n.id === 'privado-hb'), true);
eq('tareas de Ana sin HB', JSON.stringify(inAna(() => S.getUnifiedBrainTasks())).includes('SECRETO'), false);
eq('detalle ajeno', inAna(() => S.getBrainNodeDetail('privado-hb')), null);
eq('lista de archivos', inAna(() => S.listVaultFiles()).some(f => f.path.includes('Privado')), false);
// --- intentos de salir de la carpeta
for (const p of ['../../vault/01/Privado.md', '../../../fuera.md', '/etc/passwd', 'a/../../../fuera.md', '..\\..\\vault\\01\\Privado.md', path.join(primaryVault, '01', 'Privado.md')]) {
  const r = inAna(() => S.readVaultFile(p));
  eq('leer fuera ' + p, !!r.content && /SECRETO|FUERA|root:/.test(r.content), false);
}
inAna(() => S.writeVaultFile('../../vault/01/Inyectado.md', 'x')); inAna(() => S.writeVaultFile('a/../../../../escapado.md', 'x'));
eq('no escribió en HB', fs.existsSync(path.join(primaryVault, '01', 'Inyectado.md')), false);
eq('no escribió fuera', fs.existsSync(path.join(root, 'escapado.md')) || fs.existsSync(path.join(root, 'brains', 'escapado.md')), false);
inAna(() => S.deleteVaultFile('../../vault/01/Privado.md')); inAna(() => S.deleteVaultFile('../../../fuera.md'));
eq('no borró en HB', fs.existsSync(path.join(primaryVault, '01', 'Privado.md')) && fs.existsSync(path.join(root, 'fuera.md')), true);
eq('confine', [inAna(() => S.confineToVault('../x')), inAna(() => S.confineToVault('ok.md')) !== null], [null, true]);
// --- borde: cuentas con cerebro propio confinadas
eq('borde', [ownBrainDecision('/cerebro', ana.id), ownBrainDecision('/empresas', ana.id), ownBrainDecision('/', ana.id), ownBrainDecision('/api/agent/brain', ana.id), ownBrainDecision('/api/agent/hub', ana.id), ownBrainDecision('/api/agent/decisions', ana.id), ownBrainDecision('/api/public/workspace', ana.id), ownBrainDecision('/api/tasks', ana.id), ownBrainDecision('/api/workspace', ana.id), ownBrainDecision('/tasks', 'hb'), ownBrainDecision('/tasks', undefined), ownBrainDecision('/usuarios', ana.id)],
  ['allow', 'redirect', 'redirect', 'allow', 'deny', 'deny', 'deny', 'deny', 'deny', 'allow', 'allow', 'allow']);
eq('lista de cerebros', B.listBrains().map(b => b.brainId).sort(), ['hb', ana.id, luis.id, ro.id].sort());
if (fail) { console.error(fail + ' fallas'); process.exit(1); } console.log('aislamiento de cerebros: todo ok');
