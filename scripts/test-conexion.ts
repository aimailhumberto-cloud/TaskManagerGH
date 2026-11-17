/**
 * Conectar al equipo: textos y prueba de conexión del agente (agentConnect.ts) y la actividad que ve el administrador (actividad.ts).
 * Carpeta temporal; sin red. Uso: npx tsx scripts/test-conexion.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conexion-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true });
  process.env.SMJ_VAULT_PATH = vault; process.chdir(root);
  const C = await import('../src/lib/agentConnect');
  const A = await import('../src/lib/cerebro/actividad');
  const K = await import('../src/lib/agentKeys');

  // ================= A. Textos =================
  const KEY = 'tmk_' + 'ab12cd34' + '_' + 'f'.repeat(64);
  t('A1 el formato de llave coincide con el que genera el sistema', (() => { process.env.AGENT_KEYS_FILE = path.join(root, 'keys.json'); const k = K.createKey('local-x', 'Mi agente', 'cerebro'); return C.looksLikeKey(k.key) && k.key.startsWith('tmk_'); })());
  t('A2 una llave se limpia de espacios y comillas al pegarla', C.cleanKey(`  "${KEY}"\n`) === KEY && C.cleanKey('') === '' && C.looksLikeKey(` ${KEY} `));
  t('A3 lo que no es una llave se detecta', !C.looksLikeKey('hola') && !C.looksLikeKey('tmk_corta') && !C.looksLikeKey(KEY.slice(0, -1)) && !C.looksLikeKey(''));
  const es = C.pasteToAgent('https://cerebro.ejemplo.com/', 'es'), en = C.pasteToAgent('https://cerebro.ejemplo.com', 'en');
  t('A4 el texto para pegar dice dónde está el cerebro (sin barra doble), cómo autenticar y los dos verbos', /ejemplo\.com\./.test(es) && !/com\/\/api/.test(es) && /Authorization: Bearer <mi llave>/.test(es) && /"action":"pedir"/.test(es) && /\?q=<pregunta>/.test(es) && /guia=1/.test(es));
  t('A5 trae la fórmula: palabras tal cual, un tema por pedido, responder con otro pedir, respuesta corta', /tal cual/.test(es) && /Un tema por pedido/.test(es) && /otro «pedir»/.test(es) && /paraPersona/.test(es));
  t('A6 dice que solo puede pedir y consultar (no escribe directo) y menciona pendientes y anoche', /Solo puedes PEDIR y CONSULTAR/.test(es) && /q=pendientes/.test(es) && /q=anoche/.test(es));
  t('A7 la versión en inglés está completa', /Authorization: Bearer <my key>/.test(en) && /ASK and LOOK THINGS UP/.test(en) && /One topic per request/.test(en) && !/tal cual/.test(en));
  t('A8 el texto para pegar NO lleva ninguna llave', !/tmk_/.test(es) && !/tmk_/.test(en));
  t('A9 los pasos de ChatGPT son seis, con autenticación Bearer y esquema', C.GPT_STEPS_ES.length === 6 && /Bearer/.test(C.GPT_STEPS_ES[2]) && /esquema/i.test(C.GPT_STEPS_ES[3]));

  // ================= B. Prueba de conexión =================
  let seen: { url: string; init: any } | null = null;
  const mk = (res: () => Response | Promise<Response>) => (async (url: any, init: any) => { seen = { url: String(url), init }; return res(); }) as typeof fetch;
  const r1 = await C.testConnection('https://c.ejemplo.com/', KEY, mk(() => json({ ok: true, abiertos: [{}, {}, {}] })));
  t('B1 con la llave buena dice «ok» y cuántos casos hay abiertos', r1.kind === 'ok' && r1.abiertos === 3, JSON.stringify(r1));
  t('B2 la prueba va SOLO con la llave: sin la sesión del navegador (credentials omit) y con Bearer', (seen as any)?.init?.credentials === 'omit' && (seen as any)?.init?.headers?.authorization === `Bearer ${KEY}` && /\/api\/agent\/cerebro\?q=pendientes$/.test((seen as any)?.url) && !/\/\/api/.test((seen as any)?.url.replace('https://', '')));
  t('B3 una llave mala (401) o revocada (403) lo dice', (await C.testConnection('https://c', KEY, mk(() => json({}, 401)))).kind === 'llave' && (await C.testConnection('https://c', KEY, mk(() => json({}, 403)))).kind === 'llave');
  t('B4 sin red lo dice', (await C.testConnection('https://c', KEY, (async () => { throw new Error('x'); }) as any)).kind === 'red');
  t('B5 un error del servidor no se confunde con llave mala', (await C.testConnection('https://c', KEY, mk(() => json({}, 500)))).kind === 'otro' && (await C.testConnection('https://c', KEY, mk(() => json({ ok: false }, 200)))).kind === 'otro');
  t('B6 sin llave ni siquiera llama', await (async () => { let called = false; const r = await C.testConnection('https://c', '  ', (async () => { called = true; return json({}); }) as any); return r.kind === 'sin_llave' && !called; })());
  t('B7 sin casos abiertos devuelve cero', (await C.testConnection('https://c', KEY, mk(() => json({ ok: true })))).abiertos === 0);

  // ================= C. Actividad para el administrador =================
  const sleep = path.join(root, 'dots-sleep'); fs.mkdirSync(path.join(sleep, 'journal'), { recursive: true }); fs.mkdirSync(path.join(sleep, 'cerebro'), { recursive: true });
  const NOW = Date.parse('2026-11-17T15:00:00Z'); const ago = (h: number) => new Date(NOW - h * 3600_000).toISOString();
  fs.writeFileSync(path.join(sleep, 'activity.jsonl'), [
    { at: ago(1), actor: 'agente:ab12', via: 'llave-de-agente', path: '/api/agent/cerebro', action: 'pedir', status: 200 },
    { at: ago(2), actor: 'agente:ab12', via: 'llave-de-agente', path: '/api/agent/cerebro', action: 'consultar', status: 200 },
    { at: ago(3), actor: 'agente:ab12', via: 'llave-de-agente', path: '/api/agent/brain', action: 'upsert_node', status: 403, blocked: true },
    { at: ago(24 * 20), actor: 'agente:ab12', via: 'llave-de-agente', path: '/api/agent/cerebro', action: 'pedir', status: 200 },
  ].map(e => JSON.stringify(e)).join('\n') + '\n');
  fs.writeFileSync(path.join(sleep, 'journal', 'journal.jsonl'), [
    { id: 'ch-1', at: ago(1), actor: 'Agente Mi agente', via: 'llave-de-agente', route: '/api/agent/cerebro', summary: 'Novedad en Tomás Casas', files: [] },
    { id: 'ch-2', at: ago(5), actor: 'Tomás', via: 'sesion', route: '/api/agent/tasks', summary: 'Tarea creada', files: [] },
    { id: 'ch-3', at: ago(6), actor: 'Tomás', via: 'sesion', summary: 'deshacer', undoOf: 'ch-2', files: [] },
  ].map(e => JSON.stringify(e)).join('\n') + '\n');
  fs.writeFileSync(path.join(sleep, 'cerebro', 'requests.json'), JSON.stringify([
    { id: 'p1', at: ago(1), by: 'Agente', via: 'llave', text: 'Anota que Jenna confirmó', status: 'aplicado', ops: [], plan: [] },
    { id: 'p2', at: ago(24 * 30), by: 'Tomás', via: 'app', text: 'Pedido viejo', status: 'aplicado', ops: [], plan: [] },
  ]));
  const r = A.resumenCerebro(vault, 'Tomás', 7, NOW);
  t('C1 cuenta las llamadas del agente del periodo (no las bloqueadas ni las viejas)', r.existe && r.llamadas === 2 && r.bloqueadas === 1, JSON.stringify({ l: r.llamadas, b: r.bloqueadas }));
  t('C2 dice cuándo fue la última llamada', r.ultimaLlamada === ago(1));
  t('C3 cuenta los pedidos y los cambios del periodo (el deshacer y lo viejo no cuentan)', r.pedidos === 1 && r.cambios === 2 && r.ultimoCambio === ago(1), JSON.stringify({ p: r.pedidos, c: r.cambios }));
  t('C4 los movimientos salen del más nuevo al más viejo y distinguen agente, persona, bloqueado y pedido', r.eventos.length >= 5 && r.eventos.every((e, i, a) => i === 0 || a[i - 1].at >= e.at) && ['agente', 'persona', 'bloqueado', 'pedido'].every(x => r.eventos.some(e => e.tipo === x)), JSON.stringify(r.eventos.map(e => e.tipo)));
  t('C5 un cambio hecho por el agente se marca «(agente)» y uno de la persona no', r.eventos.some(e => /Novedad en Tomás Casas/.test(e.texto) && /\(agente\)/.test(e.quien)) && r.eventos.some(e => /Tarea creada/.test(e.texto) && e.quien === 'Tomás'));
  t('C6 un bloqueo dice qué puerta intentó', r.eventos.some(e => e.tipo === 'bloqueado' && /brain · upsert_node/.test(e.texto)));
  t('C7 no se filtra el contenido de las fichas: solo resúmenes cortos', r.eventos.every(e => e.texto.length <= 140));
  t('C8 un periodo de 30 días incluye lo de hace 20 días', A.resumenCerebro(vault, 'Tomás', 30, NOW).llamadas === 3);
  const sin = A.resumenCerebro(path.join(root, 'no-existe'), 'Nadie', 7, NOW);
  t('C9 una persona sin cerebro todavía no rompe nada', sin.existe === false && sin.llamadas === 0 && sin.eventos.length === 0 && A.resumenCerebro(null, 'x').existe === false);
  t('C10 el tope de movimientos se respeta', A.resumenCerebro(vault, 'Tomás', 7, NOW, 2).eventos.length === 2);

  // ================= D. El estado de cada persona =================
  const base = { activa: true, ultimoIngreso: ago(3), llaves: [] as any[], cerebro: { llamadas: 0, pedidos: 0, cambios: 0 } };
  t('D1 desactivada', A.estadoDe({ ...base, activa: false }) === 'inactiva');
  t('D2 la cuenta existe pero nunca entró (el caso de Tomás hoy)', A.estadoDe({ ...base, ultimoIngreso: null }) === 'sin_entrar');
  t('D3 entró pero no ha conectado agente', A.estadoDe(base) === 'sin_agente' && A.estadoDe({ ...base, llaves: [{ id: 'a', nombre: 'x', alcance: 'cerebro', ultimoUso: null, revocada: true }] }) === 'sin_agente');
  t('D4 creó la llave pero no la ha usado', A.estadoDe({ ...base, llaves: [{ id: 'a', nombre: 'x', alcance: 'cerebro', ultimoUso: null, revocada: false }] }) === 'agente_sin_usar');
  t('D5 activo: usó la llave', A.estadoDe({ ...base, llaves: [{ id: 'a', nombre: 'x', alcance: 'cerebro', ultimoUso: ago(2), revocada: false }] }) === 'activo');
  t('D6 activo también si hubo llamadas aunque la llave diga sin uso', A.estadoDe({ ...base, llaves: [{ id: 'a', nombre: 'x', alcance: 'cerebro', ultimoUso: null, revocada: false }], cerebro: { llamadas: 4, pedidos: 0, cambios: 0 } }) === 'activo');

  // ================= E. La ruta del administrador no se abre sin sesión =================
  const { NextRequest } = await import('next/server');
  const route = await import('../src/app/api/admin/actividad/route');
  const res = await (route.GET as any)(new NextRequest('http://localhost/api/admin/actividad', { method: 'GET' }));
  t('E1 sin sesión de administrador no entrega nada', res.status === 401 || res.status === 403, String(res.status));

  try { process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); } catch {}
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
