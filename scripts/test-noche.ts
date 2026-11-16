/**
 * Etapa 5.5: la noche del Cerebro. Un solo proceso: avanza lo vencido (24 h), escribe la sesión del día, audita la estructura y deja el resumen.
 *   A. Cuándo toca.  B. El día en casos.  C. La auditoría (solo avisa).  D. El resumen de la mañana.  E. La sesión del día.
 *   F. La corrida completa con el motor real (modelo simulado): avanza, escribe, no toca fichas, no se repite.  G. Entrada del agente y apagado.
 * Bóveda temporal con fichas reales copiadas; sin red. Uso: npx tsx scripts/test-noche.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const sha = (p: string) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noche-'));
  const vault = path.join(root, 'vault');
  const FILES = ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md', '02-External-Clients/Market - Panama.md'];
  for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(vault, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(vault, f)); }
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  process.chdir(root); // lo nuevo se copia a <cwd>/vault: con cwd aquí no ensucia el repo
  const N = await import('../src/lib/cerebro/night');
  const S = await import('../src/lib/cerebro/structure');
  const E = await import('../src/lib/cerebro/engine');
  const { readNoteStrict } = await import('../src/lib/vaultFiles');
  const { getSleepDir } = await import('../src/lib/dotsSleep');
  const REQS = path.join(vault, '..', 'dots-sleep', 'cerebro', 'requests.json');
  void REQS;

  // Tiempos en hora de Panamá (UTC-5): «15 nov 03:00 Panamá» = 15 nov 08:00 UTC.
  const NOW = new Date('2026-11-15T08:00:00Z');          // 03:00 en Panamá del 15
  const AYER = '2026-11-14';
  const at = (day: string, hh = '12') => new Date(`${day}T${hh}:00:00-05:00`).toISOString();
  const mk = (o: Record<string, any> = {}): any => ({ id: `c${Math.random().toString(36).slice(2, 8)}`, at: at(AYER), by: 'Agente', via: 'agente', text: 'pedido', status: 'aplicado', ops: [], plan: [], ...o });

  // ================= A. Cuándo toca =================
  t('A1 el día que resume es el anterior al de la corrida', N.coveredDay(NOW) === AYER, N.coveredDay(NOW));
  t('A2 a la 1 a.m. de Panamá no toca', !N.needsNight(vault, new Date('2026-11-15T06:00:00Z')));
  t('A3 a las 3 a.m. de Panamá toca', N.needsNight(vault, NOW));
  t('A4 la hora de corte es la de siempre (2 a.m.)', N.NIGHT_HOUR === 2);

  // ================= B. El día en casos =================
  const reqs = [
    mk({ id: 'a1', status: 'aplicado', closedAt: at(AYER, '13') }),                                                           // guardado solo
    mk({ id: 'a2', status: 'aplicado', closedAt: at(AYER, '15'), decidedAt: at(AYER, '15'), decidedBy: 'HB', esperaCat: 'cobertura' }), // aprobado por una persona
    mk({ id: 'a3', status: 'sin_cambios', closedAt: at(AYER, '16') }),
    mk({ id: 'a4', status: 'cancelado', closedAt: at(AYER, '17') }),
    mk({ id: 'a5', status: 'rechazado', closedAt: at(AYER, '18') }),
    mk({ id: 'a6', status: 'fallo', closedAt: at(AYER, '19') }),
    mk({ id: 'a7', status: 'rechazado', at: at(AYER, '09'), closedAt: at('2026-11-13', '20') }),                                // otro día: no cuenta
    mk({ id: 'a8', status: 'aplicado', at: at('2026-11-13', '08'), closedAt: at('2026-11-13', '09') }),                         // otro día
    mk({ id: 'p1', status: 'pendiente', at: at('2026-11-12', '10'), esperaCat: 'delicado' }),                                   // espera hace 3 días
    mk({ id: 'p2', status: 'pendiente', at: at(AYER, '20'), esperaCat: 'cobertura' }),                                          // espera, de ayer
    mk({ id: 'q1', status: 'pregunta', at: at('2026-11-13', '05'), faltan: ['x'] }),                                            // pregunta, vieja
  ];
  const dg = N.digestOf(reqs, AYER, NOW, ['q0']);
  t('B1 cuántos entraron ayer', dg.entraron === 8 /* a1-a6, a7 (abrió ayer), p2 */, String(dg.entraron));
  t('B2 cuántos se cerraron ayer y cómo', dg.cerrados.guardados === 2 && dg.cerrados.sinCambios === 1 && dg.cerrados.cancelados === 1 && dg.cerrados.rechazados === 1 && dg.cerrados.fallos === 1, JSON.stringify(dg.cerrados));
  t('B3 de los guardados, uno solo y uno aprobado por una persona', dg.guardadosSolos === 1 && dg.aprobadosPorPersona === 1);
  t('B4 lo cerrado otro día no se cuenta como de ayer', !dg.tocados.some(x => x.id === 'a8'));
  t('B5 lo que sigue abierto, con categorías y el más viejo', dg.abiertos.esperandoAprobacion === 2 && dg.abiertos.preguntas === 1 && dg.abiertos.esperaPorCategoria.delicado === 1 && dg.abiertos.esperaPorCategoria.cobertura === 1 && dg.abiertos.masViejoDias === 2, JSON.stringify(dg.abiertos));
  t('B6 los abiertos de más de 24 h se cuentan aparte', dg.abiertos.esperaMasDe24h === 2 /* p1 y q1; p2 es de ayer 20:00, 11 h antes */, String(dg.abiertos.esperaMasDe24h));
  t('B7 los avanzados que recibió la noche quedan en el resumen', dg.avanzados.length === 1 && dg.avanzados[0] === 'q0');
  t('B8 los que tocaron ese día van a la sesión (con su categoría si esperaron)', dg.tocados.some(x => x.id === 'a2' && x.cat === 'cobertura') && dg.tocados.some(x => x.id === 'p2'));
  const empty = N.digestOf([], AYER, NOW);
  t('B9 sin casos todo es cero y sin «más viejo»', empty.entraron === 0 && empty.tocados.length === 0 && empty.abiertos.masViejoDias === null);

  // ================= C. La auditoría =================
  const s = S.structure();
  const node = (id: string, type: string, fm: Record<string, any> = {}, title = id) => ({ id, title, type, frontmatter: { title, ...fm } });
  const nodes = [
    node('person-a', 'person', { relations: { works_at: ['x'], jefe_raro: ['y'], referencia_rara: ['z'] }, campo_raro: 1 }),
    node('person-b', 'person', { relations: { jefe_raro: ['y'], references: ['w'], team_context: ['q'], belongs_to_market: ['m'] }, campo_raro: 1, field_sources: { phone: { clase: 'sin_clasificar' }, email_primary: { clase: 'persona' } } }),
    node('person-c', 'person', { campo_raro: 1, field_sources: { phone: { clase: 'sin_clasificar' } } }),
    node('org-x', 'organization', {}, 'Organization - Acme'),
    node('org-y', 'organization', {}, 'Organization: Acme'),            // mismo nombre que org-x con otro prefijo → duplicado
    node('sitio-1', 'site', {}),                                         // tipo fuera de la estructura
    node('sitio-2', 'site', {}),
    node('core-1', 'core', {}), node('wm-1', 'working_memory', {}), node('ses-1', 'consolidation_session', {}),
    node('sabor-1', 'flavor', {}), node('sabor-2', 'flavor', {}), node('sabor-3', 'flavor', {}), // catálogo: sin enlace no cuenta
    node('lonely', 'person', {}),
  ];
  const links = [{ source: 'person-a', target: 'org-x' }, { source: 'person-b', target: 'org-x' }, { source: 'person-c', target: 'org-y' }, { source: 'sitio-1', target: 'org-x' }];
  const au = N.auditEstructura(nodes as any, links, s, [mk({ status: 'pregunta', at: at('2026-11-10'), faltan: undefined }), mk({ status: 'pregunta', at: at('2026-11-10'), faltan: ['a'] })], NOW);
  t('C1 tipos fuera de la estructura (sin contar los del sistema)', au.tiposFuera.length === 1 && au.tiposFuera[0].tipo === 'site' && au.tiposFuera[0].n === 2, JSON.stringify(au.tiposFuera));
  t('C2 el catálogo (flavor) también cae fuera de la estructura, pero los del sistema no', !au.tiposFuera.some(x => x.tipo === 'core' || x.tipo === 'working_memory') );
  t('C3 relaciones fuera: se cuentan las que se repiten (2+); no las de la estructura, no los alias, no el ruido, no una sola vez', au.relacionesFuera.length === 1 && au.relacionesFuera[0].relacion === 'jefe_raro' && au.relacionesFuera[0].n === 2, JSON.stringify(au.relacionesFuera));
  t('C4 campos fuera: solo los que se repiten (3+) en tipos de la estructura', au.camposFuera.length === 1 && au.camposFuera[0].campo === 'campo_raro' && au.camposFuera[0].n === 3, JSON.stringify(au.camposFuera));
  t('C5 datos sin clasificar: cuántos campos y en cuántas fichas', au.sinClasificar.campos === 2 && au.sinClasificar.fichas === 2, JSON.stringify(au.sinClasificar));
  t('C6 fichas sueltas: solo las de negocio sin ningún enlace (no el sistema ni el catálogo)', au.sueltas.n === 2 && au.sueltas.ejemplos.some(x => /lonely/.test(x)) && au.sueltas.ejemplos.some(x => /sitio-2/.test(x)), JSON.stringify(au.sueltas));
  t('C7 posibles duplicados: mismo tipo y mismo nombre sin el prefijo', au.duplicados.n === 1 && /org-x = org-y|org-y = org-x/.test(au.duplicados.ejemplos[0]), JSON.stringify(au.duplicados));
  t('C8 casos viejos sin el formato nuevo (no los toca la regla de 24 h)', au.casosViejosSinFormato === 1, String(au.casosViejosSinFormato));
  t('C9 la auditoría no cambia lo que recibe', JSON.stringify(nodes).length > 0 && (nodes[0].frontmatter as any).campo_raro === 1);
  const cleanAudit = N.auditEstructura([node('a', 'person', {}), node('b', 'person', {})], [{ source: 'a', target: 'b' }], s, [], NOW);
  t('C10 un cerebro ordenado sale limpio', cleanAudit.tiposFuera.length + cleanAudit.relacionesFuera.length + cleanAudit.camposFuera.length + cleanAudit.sueltas.n + cleanAudit.duplicados.n + cleanAudit.sinClasificar.campos === 0, JSON.stringify(cleanAudit));
  const bigAudit = N.auditEstructura(Array.from({ length: 40 }, (_, i) => node(`z${i}`, `tipo${i}`, {})) as any, [], s, [], NOW);
  t('C11 con mucho desorden solo se muestran 5 ejemplos de cada cosa (el resto se cuenta)', bigAudit.tiposFuera.length === 5 && bigAudit.sueltas.n === 40 && bigAudit.sueltas.ejemplos.length === 5, JSON.stringify([bigAudit.tiposFuera.length, bigAudit.sueltas]));

  // Dos ruidos que se vieron al correrla sobre la bóveda real: el catálogo (cientos de enlaces propios) y los textos libres que la estructura ya declara.
  const ruido = N.auditEstructura([...Array.from({ length: 4 }, (_, i) => node(`v${i}`, 'product_variant', { relations: { belongs_to_line: ['l'], packaging: ['p'] } })), ...Array.from({ length: 4 }, (_, i) => node(`n${i}`, 'person', { notes: 'x', personal_notes: 'y' }))] as any, [], s, [], NOW);
  t('C12 el catálogo no llena la lista de relaciones fuera de la estructura', ruido.relacionesFuera.length === 0, JSON.stringify(ruido.relacionesFuera));
  t('C13 un texto libre que la estructura declara (notes) no es un campo «fuera»', ruido.camposFuera.length === 0, JSON.stringify(ruido.camposFuera));

  // ================= D. El resumen de la mañana =================
  const text = N.morningText(dg, au);
  t('D1 es corto: de 3 a 5 líneas', text.split('\n').length >= 3 && text.split('\n').length <= 5, text);
  t('D2 dice qué entró, qué se guardó (solos y aprobados) y qué falló', text.includes('entraron 8 pedidos') && text.includes('2 (1 solo, 1 aprobados') && text.includes('1 falló'), text);
  t('D3 dice qué avanzó solo', /Avanzó solo 1 caso /.test(text), text);
  t('D4 dice qué falta, por categoría y el más viejo', /2 esperan tu aprobación \((delicado 1, cobertura 1|cobertura 1, delicado 1)\)/.test(text) && /2 días/.test(text), text);
  t('D5 dice qué está raro y que no se cambió nada', /Raro:/.test(text) && /1 posible duplicado/.test(text) && /no se cambió nada/.test(text), text);
  t('D6 sin nada pendiente ni raro lo dice sencillo', (() => { const x = N.morningText(empty, cleanAudit); return /No queda nada esperando/.test(x) && /Nada raro/.test(x) && !/Raro:/.test(x); })());

  // ================= E. La sesión del día =================
  const SES = path.join(vault, '05-Consolidation-Sessions');
  const f1 = path.join(SES, N.sessionFile(AYER));
  const w1 = N.writeSession(vault, dg, au, text, NOW);
  t('E1 escribe la sesión con el nombre del día resumido', w1.escrita && fs.existsSync(f1) && /2026-11-14 - Sesion del dia/.test(f1), JSON.stringify(w1));
  const n1: any = readNoteStrict(f1);
  t('E2 es del tipo sesión, marcada como de la noche, con la fecha', n1.ok && n1.frontmatter.type === 'consolidation_session' && n1.frontmatter.generated_by === 'cerebro-noche' && String(n1.frontmatter.session_date) === AYER, JSON.stringify(n1.frontmatter));
  t('E3 enlaza a la nota de cada caso del día', dg.tocados.every(x => n1.body.includes(`[[caso-${x.id}]]`)) && (n1.frontmatter.relations?.touches || []).length === dg.tocados.length);
  t('E4 trae el resumen y la auditoría', /Ayer \(2026-11-14\)/.test(n1.body) && /Posibles duplicados/.test(n1.body) && /Avanzados por la regla de 24 horas/.test(n1.body) && /caso-q0/.test(n1.body));
  const w1b = N.writeSession(vault, dg, au, text, NOW);
  t('E5 repetir la corrida reescribe la misma nota (no deja otra)', w1b.escrita && fs.readdirSync(SES).filter(x => /Sesion del dia/.test(x)).length === 1);
  const foreign = path.join(SES, N.sessionFile('2026-11-13')); fs.writeFileSync(foreign, '---\nid: mia\ntype: consolidation_session\n---\nNota de una persona\n');
  const wF = N.writeSession(vault, N.digestOf([mk({ at: at('2026-11-13'), closedAt: at('2026-11-13') })], '2026-11-13', NOW), au, text, NOW);
  t('E6 nunca pisa una nota que no es de la noche', !wF.escrita && /no es de la noche/.test(wF.motivo || '') && /Nota de una persona/.test(fs.readFileSync(foreign, 'utf-8')), JSON.stringify(wF));
  fs.rmSync(f1, { force: true });
  const wE = N.writeSession(vault, empty, au, text, NOW);
  t('E7 un día sin casos no deja una nota vacía', !wE.escrita && !fs.existsSync(path.join(SES, N.sessionFile(empty.dia))));
  fs.rmSync(foreign);

  // ================= F. La corrida completa (motor real, modelo simulado) =================
  const before = Object.fromEntries(walk(vault).filter(f => /\.md$/.test(f)).map(f => [f, sha(f)]));
  const real = globalThis.fetch; const realNow = Date.now; const cfg = { llmPlan: [] as any[] };
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) return json({ message: { content: '', tool_calls: cfg.llmPlan.map(c => ({ function: c })) }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 });
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: false, confidence: 0.9 }; return json({ answers: a }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    // Un caso con pregunta de hace 30 horas (formato nuevo: trae «faltan») y otro de hace 2 horas, y uno viejo sin «faltan».
    // La regla de 24 h mira el reloj de verdad (Date.now): se fija en NOW para que la prueba no dependa del día en que corre.
    Date.now = () => NOW.getTime();
    const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
    const dir = path.join(getSleepDir(vault), 'cerebro'); fs.mkdirSync(dir, { recursive: true });
    const old = mk({ id: 'venc1', status: 'pregunta', at: hoursAgo(30), text: 'Anota que Tomás Casas quiere reunión', faltan: ['¿Qué día?'], dialog: [{ q: '¿Qué día?' }] });
    const fresh = mk({ id: 'fresc1', status: 'pregunta', at: hoursAgo(2), text: 'Otro pedido reciente', faltan: ['¿Cuál?'], dialog: [{ q: '¿Cuál?' }] });
    const legacy = mk({ id: 'viejo1', status: 'pregunta', at: hoursAgo(90), text: 'Pedido anterior al formato nuevo', dialog: [{ q: '¿?' }] });
    const spent = mk({ id: 'hecho1', status: 'aplicado', at: hoursAgo(10), closedAt: hoursAgo(9), text: 'Algo que se guardó solo' });
    fs.writeFileSync(path.join(dir, 'requests.json'), JSON.stringify([fresh, old, legacy, spent]));
    cfg.llmPlan = [{ name: 'registrar_novedad', arguments: { ficha: 'person-tomas-casas', resumen: 'Quiere una reunión; sin día definido', fuente: 'pedido' } }];

    const deps = (extra: Record<string, any> = {}) => ({ listRequests: () => E.listRequests(vault), advance: () => E.advanceStaleIds({ limit: 25, force: true }), graph: () => ({ nodes: [] as any[], links: [] as any[] }), ...extra });
    const sum = await N.runNight(vault, deps(), NOW);
    t('F1 avanzó solo el caso vencido de formato nuevo', sum.digest.avanzados.length === 1 && sum.digest.avanzados[0] === 'venc1', JSON.stringify(sum.digest.avanzados) + JSON.stringify(sum.errores));
    const after = E.listRequests(vault);
    t('F2 el caso vencido salió de «pregunta»; el reciente y el viejo sin formato siguen igual', after.find(r => r.id === 'venc1')?.status !== 'pregunta' && after.find(r => r.id === 'fresc1')?.status === 'pregunta' && after.find(r => r.id === 'viejo1')?.status === 'pregunta', after.map(r => `${r.id}:${r.status}`).join(' '));
    t('F3 lo avisa: el caso viejo sin formato aparece en la auditoría', sum.auditoria.casosViejosSinFormato === 1, String(sum.auditoria.casosViejosSinFormato));
    t('F4 dejó el resumen de la mañana, y se puede leer de nuevo', fs.existsSync(path.join(getSleepDir(vault), 'night', `${sum.corridaDia}.json`)) && N.latestNight(vault)?.texto === sum.texto);
    t('F5 después de correr, ya no toca hasta mañana', !N.needsNight(vault, NOW) && N.needsNight(vault, new Date(NOW.getTime() + DAY_MS)));
    const dia = N.coveredDay(NOW);
    t('F6 no hubo errores', sum.errores.length === 0, sum.errores.join(' | '));
    // El de hace 10 horas es de «ayer» en Panamá (la corrida es a las 3 a.m.); el de hace 2 horas es de hoy, 1 a.m.: no entra.
    const sesTxt = () => fs.readFileSync(path.join(SES, N.sessionFile(dia)), 'utf-8');
    t('F7 hay casos del día resumido: escribe la sesión con enlace a la nota de cada caso', sum.sesion?.escrita === true && sesTxt().includes('[[caso-hecho1]]') && !sesTxt().includes('[[caso-fresc1]]') /* fresc1 es de la 1 a.m. de HOY: no es de ayer */, JSON.stringify(sum.sesion));
    t('F7b y el avance de la noche queda anotado en la sesión', /Avanzados por la regla de 24 horas/.test(sesTxt()) && sesTxt().includes('[[caso-venc1]]'));
    // Sin casos ese día: no hay sesión vacía (y el resumen sí queda)
    fs.rmSync(path.join(getSleepDir(vault), 'night', `${sum.corridaDia}.json`)); fs.rmSync(path.join(SES, N.sessionFile(dia)));
    const sumVacio = await N.runNight(vault, deps({ listRequests: () => [], advance: undefined }), NOW);
    t('F8 una noche sin casos del día no deja sesión vacía, pero sí el resumen', !sumVacio.sesion?.escrita && !fs.existsSync(path.join(SES, N.sessionFile(dia))) && !!N.latestNight(vault) && /No queda nada esperando/.test(sumVacio.texto));
    fs.rmSync(path.join(getSleepDir(vault), 'night', `${sumVacio.corridaDia}.json`));
    const sum2 = await N.runNight(vault, deps(), NOW);
    // No cambió ninguna ficha: solo se agregaron la sesión y lo de dots-sleep
    const now = Object.fromEntries(walk(vault).filter(f => /\.md$/.test(f)).map(f => [f, sha(f)]));
    const changed = Object.keys(before).filter(f => now[f] !== before[f]);
    t('F9 las fichas del negocio no cambiaron por la noche (la única que cambió es la de Tomás por el avance de 24 h, que es el caso mismo)', changed.every(f => /Tomas Casas/.test(f)), changed.join(', '));
    const added = Object.keys(now).filter(f => !(f in before));
    t('F10 lo único nuevo en la bóveda es la sesión del día y las notas de caso (00-Working-Memory)', added.every(f => /Sesion del dia|00-Working-Memory/.test(f)), added.join(', '));

    // Cerebro de solo lectura: ni avanza ni escribe la sesión
    fs.rmSync(path.join(getSleepDir(vault), 'night', `${sum2.corridaDia}.json`));
    fs.rmSync(path.join(SES, N.sessionFile(dia)));
    let avanzo = false;
    const sum3 = await N.runNight(vault, deps({ readOnly: true, advance: async () => { avanzo = true; return ['x']; } }), NOW);
    t('F11 un cerebro de solo lectura no avanza ni escribe la sesión, pero sí deja el resumen', !avanzo && !sum3.sesion?.escrita && /solo lectura/.test(sum3.sesion?.motivo || '') && !!N.latestNight(vault));
    // Si falla el avance, la noche sigue
    fs.rmSync(path.join(getSleepDir(vault), 'night', `${sum3.corridaDia}.json`));
    const sum4 = await N.runNight(vault, deps({ advance: async () => { throw new Error('modelo caído'); } }), NOW);
    t('F12 si el avance falla la noche sigue y lo anota', sum4.errores.some(e => /avance: modelo caído/.test(e)) && !!sum4.texto && fs.existsSync(path.join(getSleepDir(vault), 'night', `${sum4.corridaDia}.json`)));
    // Los resúmenes viejos se podan
    const nd = path.join(getSleepDir(vault), 'night');
    for (let i = 1; i <= 35; i++) fs.writeFileSync(path.join(nd, `2026-09-${String(i % 28 + 1).padStart(2, '0')}.json`), '{}');
    fs.rmSync(path.join(nd, `${sum4.corridaDia}.json`));
    await N.runNight(vault, deps(), NOW);
    t('F13 se guardan los últimos 30 resúmenes', fs.readdirSync(nd).filter(x => /\.json$/.test(x)).length <= 30, String(fs.readdirSync(nd).length));
  } finally { globalThis.fetch = real; Date.now = realNow; }

  // ================= G. Entrada del agente, apagado =================
  const { normalizeBody } = await import('../src/lib/cerebro/intake');
  t('G1 el agente puede pedir el resumen: «manana» es una acción conocida', (normalizeBody({ action: 'manana' }) as any).body.action === 'manana');
  t('G2 y también «resumen» o «morning»', (normalizeBody({ action: 'resumen' }) as any).body.action === 'manana' && (normalizeBody({ action: 'morning' }) as any).body.action === 'manana');
  const Sch = await import('../src/lib/dotsSleepScheduler');
  process.env.CEREBRO_NIGHT_DISABLED = '1';
  t('G3 CEREBRO_NIGHT_DISABLED=1 apaga la noche', Sch.runNightOnce(vault) === false);
  delete process.env.CEREBRO_NIGHT_DISABLED;
  // El temporizador de verdad (con reloj simulado): lanza una sola vez, deja el resumen y no se repite el mismo día.
  const ndir = path.join(getSleepDir(vault), 'night'); fs.rmSync(ndir, { recursive: true, force: true });
  t('G3b antes de las 2 a.m. el temporizador no lanza nada', Sch.runNightOnce(vault, new Date('2026-11-15T06:00:00Z')) === false && !fs.existsSync(ndir));
  const lanzo = Sch.runNightOnce(vault, NOW), segundo = Sch.runNightOnce(vault, NOW);
  t('G3c lanza la noche una vez, y una segunda llamada mientras corre no lanza otra', lanzo === true && segundo === false);
  for (let i = 0; i < 100 && !fs.existsSync(path.join(ndir, '2026-11-15.json')); i++) await new Promise(r => setTimeout(r, 50));
  t('G3d al terminar deja el resumen del día', fs.existsSync(path.join(ndir, '2026-11-15.json')));
  await new Promise(r => setTimeout(r, 100));
  t('G3e y ya hecha hoy no se vuelve a lanzar', Sch.runNightOnce(vault, NOW) === false);
  const route = await import('../src/app/api/agent/cerebro/route');
  t('G4 la ruta existe y exporta POST', typeof (route as any).POST === 'function');

  process.chdir(os.tmpdir()); try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* limpiar la carpeta temporal no es parte de la prueba */ }
  console.log(`\n${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
const DAY_MS = 86_400_000;
main().catch(e => { console.error(e); process.exit(1); });
