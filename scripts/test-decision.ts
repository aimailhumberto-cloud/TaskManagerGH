/**
 * Etapa 5.4: la decisión simple. ¿Se guarda, se guarda una parte o espera a una persona? Una tabla pura (decision.ts) que usan igual el pedido real
 * y el ensayo, con una categoría por cada espera.
 *   A. La tabla, fila por fila.  B. La revisión: qué es texto libre y qué es un dato corregible; categorías de cada aviso.
 *   C. Ajustes: política por categoría.  D. Contar las esperas.  E. pedir() completo (modelo y Jev simulados).  F. El banco mide con la decisión real.
 * Bóveda temporal con fichas reales copiadas; sin red. Uso: npx tsx scripts/test-decision.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
const deepFreeze = <T>(o: T): T => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o as any)) deepFreeze(v); } return o; };

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-'));
  const vault = path.join(root, 'vault');
  const FILES = ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md', '02-External-Clients/Market - Panama.md', '03-Portfolio-Supply/Brand - Chubby.md'];
  for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(vault, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(vault, f)); }
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  process.chdir(root); // upsertNode copia lo nuevo a <cwd>/vault: con cwd aquí no ensucia el repo
  const D = await import('../src/lib/cerebro/decision');
  const Set_ = await import('../src/lib/cerebro/settings');
  const S = await import('../src/lib/cerebro/structure');
  const R = await import('../src/lib/cerebro/review');
  const E = await import('../src/lib/cerebro/engine');
  const B = await import('../src/lib/cerebro/bank');
  const { readNoteStrict } = await import('../src/lib/vaultFiles');
  const fmOf = (rel: string) => (readNoteStrict(path.join(vault, rel)) as any).frontmatter as Record<string, any>;
  const MEDIMEX = '02-External-Clients/Distributor - MEDIMEX.md', TOMAS = '01-Internal-Clients/Person - Tomas Casas.md', HUMBERTO = '01-Internal-Clients/Person - Humberto Bouche.md';

  // ================= A. La tabla =================
  const S0 = Set_.defaults();
  const jev = (o: Partial<{ score: number | null; seguridad: number | null; reason: string; problem: string }> = {}) => ({ score: 1 as number | null, seguridad: 0.9 as number | null, noul: null, reason: '', problem: '', ...o });
  const dec = (over: Record<string, any> = {}) => D.decide({ ops: [], obs: { fuertes: [], fuertesCat: [] }, s: S0, scope: undefined, incompleto: false, leer: false, correccion: false, jev: jev(), segundaVuelta: false, ...over });
  const nov = (f = 'person-tomas-casas') => ({ name: 'registrar_novedad', args: { ficha: f, resumen: 'x', fuente: 'x' } });
  const del = { name: 'borrar_ficha', args: { ficha: 'person-humberto-bouche', motivo: 'x' } };
  const ver = { name: 'marcar_verificado', args: { ficha: 'person-tomas-casas', fuente: 'x' } };
  const conn = { name: 'conectar', args: { desde: 'person-tomas-casas', hacia: 'person-humberto-bouche', relacion: 'related_to' } };
  const nueva = (nombre: string, completa = true) => ({ name: 'crear_ficha', args: { tipo: 'person', nombre, ...(completa ? { campos: { email_primary: `${nombre.toLowerCase().replace(/\W+/g, '')}@x.test` }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'contact_of' }] } : {}) } });
  const row = (name: string, d: ReturnType<typeof dec>, accion: string, categoria: string | null, extra = true, info = '') => t(name, d.accion === accion && d.categoria === categoria && extra, `${d.accion}/${d.categoria} · ${d.porque} ${info}`);

  row('A1 un cambio simple con Jev conforme se guarda', dec({ ops: [nov()] }), 'guardar', null);
  row('A2 borrar espera siempre: delicado', dec({ ops: [del] }), 'esperar', 'delicado');
  row('A3 verificar espera siempre: delicado', dec({ ops: [ver] }), 'esperar', 'delicado');
  row('A4 un pedido que crea demasiadas fichas es grande', dec({ ops: Array.from({ length: 6 }, (_, i) => nueva(`Persona Numero${i}`)) }), 'esperar', 'grande');
  row('A5 un pedido que toca demasiadas fichas es grande', dec({ ops: Array.from({ length: 11 }, (_, i) => nov(`person-x${i}`)) }), 'esperar', 'grande');
  row('A6 una llave de agente que solo propone: espera', dec({ ops: [nov()], scope: 'proponer' }), 'esperar', 'agente');
  row('A7 una ficha nueva incompleta con «contactos» en proponer: espera, categoría ajustes', dec({ ops: [nueva('Zed Vacio', false)] }), 'esperar', 'ajustes');
  row('A8 Pierre: ficha nueva COMPLETA se guarda sola aunque «contactos» esté en proponer', dec({ ops: [nueva('Pierre Canavaggio')] }), 'guardar', null);
  const p1 = dec({ ops: [nov(), del] });
  row('A9 lo cierto se guarda y solo lo delicado espera', p1, 'guardar_parcial', 'delicado', p1.guardar.length === 1 && p1.esperar.length === 1 && p1.esperar[0].name === 'borrar_ficha' && JSON.stringify(p1.categoriaCada) === '["delicado"]');
  const p2 = dec({ ops: [nov('person-tomas-casas'), nov('person-humberto-bouche')], obs: { fuertes: ['«Richard» puede ser A o B: el plan usa a person-tomas-casas. ¿Es esa persona?'], fuertesCat: ['identidad'] } });
  row('A10 una duda de identidad deja esperando solo lo que toca a esa persona', p2, 'guardar_parcial', 'identidad', p2.guardar.length === 1 && p2.esperar[0].args.ficha === 'person-tomas-casas' && JSON.stringify(p2.categoriaCada) === '["identidad"]');
  row('A11 un aviso del plan entero (cobertura) que no toca a nadie en particular: espera todo', dec({ ops: [nov()], obs: { fuertes: ['El plan no recoge todo lo que dice el pedido: horas 10:00.'], fuertesCat: ['cobertura'] } }), 'esperar', 'cobertura');
  row('A12 un aviso sin categoría vale «otro»', dec({ ops: [nov()], obs: { fuertes: ['algo raro'] } }), 'esperar', 'otro');

  // Política por categoría
  const avisar = (...cats: string[]) => ({ ...S0, politica: Object.fromEntries(cats.map(c => [c, 'avisar'])) as any });
  const cob = { fuertes: ['El plan no recoge todo lo que dice el pedido: horas 10:00.'], fuertesCat: ['cobertura'] };
  let d = dec({ ops: [nov()], obs: cob, s: avisar('cobertura') });
  t('A13 con politica.cobertura = avisar: se guarda y el aviso queda con su explicación', d.accion === 'guardar' && d.fuertes.length === 0 && d.avisos.some(a => /horas 10:00/.test(a) && /Se guardó igual: en tus Ajustes este aviso no frena/.test(a)), JSON.stringify(d.avisos));
  row('A14 lo mismo con duplicado', dec({ ops: [nov()], obs: { fuertes: ['La tarea se parece a una que ya existe'], fuertesCat: ['duplicado'] }, s: avisar('duplicado') }), 'guardar', null);
  row('A15 lo mismo con pisa_texto', dec({ ops: [nov()], obs: { fuertes: ['REEMPLAZA un texto'], fuertesCat: ['pisa_texto'] }, s: avisar('pisa_texto') }), 'guardar', null);
  row('A16 lo mismo con campo', dec({ ops: [nov()], obs: { fuertes: ['campo raro'], fuertesCat: ['campo'] }, s: avisar('campo') }), 'guardar', null);
  row('A17 sin política, esas categorías siguen esperando (como siempre)', dec({ ops: [nov()], obs: { fuertes: ['REEMPLAZA un texto'], fuertesCat: ['pisa_texto'] } }), 'esperar', 'pisa_texto');
  // Lo que NO se afloja aunque Ajustes lo pida
  const hard = (cat: string, op: any = nov()) => dec({ ops: [op], obs: { fuertes: [`aviso de ${cat}`], fuertesCat: [cat] }, s: { ...S0, politica: { [cat]: 'avisar' } as any } });
  row('A18 identidad no se afloja: nunca se adivina cuál persona', hard('identidad'), 'esperar', 'identidad');
  row('A19 dato verificado no se afloja', hard('dato_verificado'), 'esperar', 'dato_verificado');
  row('A20 una fecha que no cuadra no se afloja', hard('fecha'), 'esperar', 'fecha');
  row('A21 delicado no se afloja', dec({ ops: [del], s: { ...S0, politica: { delicado: 'avisar' } as any } }), 'esperar', 'delicado');
  t('A22 las categorías que se pueden aflojar son exactamente cinco', JSON.stringify([...Set_.POLICY_CATEGORIES]) === '["duplicado","pisa_texto","campo","cobertura","jev_duda"]');

  // Jev
  const lowJ = jev({ score: 1 / 3, reason: 'falta algo' });
  d = dec({ ops: [nov()], jev: lowJ });
  t('A23 Jev duda de un cambio simple: primero una segunda vuelta con el modelo grande', d.repetir === 'falta algo', JSON.stringify(d.repetir));
  d = dec({ ops: [nov()], jev: lowJ, segundaVuelta: true });
  t('A24 ya hecha la segunda vuelta: se guarda y avisa (cambio simple y reversible)', d.repetir === null && d.accion === 'guardar' && d.avisos.some(a => /Jev dudó de este plan \(33 %\)/.test(a) && /Se guardó igual porque es un cambio simple/.test(a)), JSON.stringify(d.avisos));
  d = dec({ ops: [nov()], jev: lowJ, leer: true });
  t('A25 al leer un correo no hay segunda vuelta: se guarda y avisa', d.repetir === null && d.accion === 'guardar' && d.avisos.some(a => /Jev dudó/.test(a)));
  row('A26 Jev duda de algo que NO es simple: espera, categoría jev_duda', dec({ ops: [conn], jev: lowJ }), 'esperar', 'jev_duda');
  d = dec({ ops: [conn], jev: lowJ, s: avisar('jev_duda') });
  t('A27 con politica.jev_duda = avisar: se guarda y lo dice', d.accion === 'guardar' && d.avisos.some(a => /en tus Ajustes esa duda solo avisa/.test(a)), JSON.stringify(d.avisos));
  d = dec({ ops: [conn], jev: jev({ score: null, problem: 'caído' }) });
  t('A28 Jev caído en algo no simple: se guarda pero queda un aviso visible', d.accion === 'guardar' && d.avisos.some(a => /Jev no pudo revisar este plan \(caído\)/.test(a)));
  row('A29 Jev caído y obligatorio en Ajustes: espera, categoría jev_obligatorio', dec({ ops: [conn], jev: jev({ score: null, problem: 'caído' }), s: { ...S0, jevRequired: true } }), 'esperar', 'jev_obligatorio');
  d = dec({ ops: [nov()], jev: jev({ score: null, problem: 'caído' }), s: { ...S0, jevRequired: true } });
  t('A30 Jev caído y obligatorio, pero el cambio es simple: se guarda sin molestar', d.accion === 'guardar' && d.avisos.length === 0);
  row('A31 buen puntaje con poca seguridad y mínimo exigido: espera, categoría jev_seguridad', dec({ ops: [conn], jev: jev({ score: 1, seguridad: 0.3 }), s: { ...S0, jevMinConfidence: 0.5 } }), 'esperar', 'jev_seguridad');
  d = dec({ ops: [nov()], jev: jev({ score: 0.64 }) });
  t('A32 un puntaje apenas sobre el umbral guarda con un «échale un ojo»', d.accion === 'guardar' && d.avisos.some(a => /échale un ojo/.test(a)));

  // Orden de prioridad y límites del reparto
  row('A33 delicado manda sobre un aviso fuerte y sobre Jev', dec({ ops: [del], obs: { fuertes: ['x'], fuertesCat: ['identidad'] }, jev: lowJ }), 'esperar', 'delicado');
  row('A34 un aviso fuerte manda sobre Jev', dec({ ops: [conn], obs: { fuertes: ['se parece a otra'], fuertesCat: ['duplicado'] }, jev: lowJ }), 'esperar', 'duplicado');
  const c1 = dec({ ops: [nov(), del], correccion: true });
  t('A35 una corrección reemplaza la propuesta completa: no se parte', c1.accion === 'esperar' && c1.esperar.length === 2 && c1.guardar.length === 0);
  t('A36 con el expediente incompleto no se parte', dec({ ops: [nov(), del], incompleto: true }).accion === 'esperar');
  t('A37 al leer un correo no se parte', dec({ ops: [nov(), del], leer: true }).accion === 'esperar');
  t('A38 con todo en «proponer» en Ajustes no se parte', dec({ ops: [nov()], s: { ...S0, auto: { agenda: false, novedades: false, contactos: false, cifras: false }, mode: 'proponer' } }).accion === 'esperar');
  t('A39 si la espera la causó Jev, no se parte: espera completo', dec({ ops: [nov(), conn, del], jev: jev({ score: null, problem: 'x' }), s: { ...S0, jevRequired: true } }).esperar.length >= 1 && dec({ ops: [conn, nueva('Ana Dos')], jev: jev({ score: null, problem: 'x' }), s: { ...S0, jevRequired: true } }).accion === 'esperar');
  const sc = D.splitCierto([nueva('Yan Solo', false), nov('person-yan-solo')], [], S0);
  t('A40 lo que depende de una ficha que espera, espera con categoría «depende»', sc.wait.length === 2 && sc.catEach[1] === 'depende' && sc.catEach[0] === 'ajustes', JSON.stringify(sc.catEach));
  let threw = false; try { dec(deepFreeze({ ops: [nov(), del], obs: { fuertes: ['a'], fuertesCat: ['cobertura'] }, s: avisar('cobertura'), jev: jev(), scope: undefined, incompleto: false, leer: false, correccion: false, segundaVuelta: false })); } catch { threw = true; }
  t('A41 la decisión es pura: no modifica nada de lo que recibe', !threw);
  t('A42 whyProposal sigue dando el texto de siempre (compatibilidad)', E.whyProposal([del], S0) === D.waitReason([del], S0)!.why && E.whyProposal([nov()], S0) === null);

  // ================= B. La revisión =================
  const upd = (ficha: string, campos: Record<string, string>) => ({ name: 'actualizar_campos', args: { ficha, campos } });
  let o = R.inspectPlan([upd('dist-medimex', { headquarters_address: 'Calle 50, Edificio Ejemplo, Ciudad de Panamá' })], [], 'cambia la dirección');
  t('B1 cambiar una dirección NO frena (antes la regla del texto largo la mandaba a aprobación)', o.fuertes.length === 0 && o.avisos.some(a => /se reemplaza headquarters_address/.test(a)), JSON.stringify([o.fuertes, o.avisos]));
  o = R.inspectPlan([upd('dist-medimex', { payment_terms: 'Letter of Credit / 60 days net' })], [], 'cambia las condiciones');
  t('B2 tampoco unas condiciones de pago (un dato largo, pero un dato)', o.fuertes.length === 0);
  o = R.inspectPlan([upd('dist-medimex', { executive_observations: 'Nuevo texto completamente distinto y sin relación con lo que decía la ficha antes.' })], [], 'cambia las observaciones');
  t('B3 pisar un TEXTO LIBRE con otro distinto sí frena, con categoría pisa_texto', o.fuertes.length === 1 && o.fuertesCat?.[0] === 'pisa_texto' && /REEMPLAZA un texto/.test(o.fuertes[0]), JSON.stringify([o.fuertes, o.fuertesCat]));
  const before = String(fmOf(MEDIMEX).executive_observations);
  o = R.inspectPlan([upd('dist-medimex', { executive_observations: `${before} Además se confirmó la visita.` })], [], 'agrega');
  t('B4 agregar al texto libre (el nuevo contiene el anterior) NO frena', o.fuertes.length === 0);
  t('B5 los campos de texto libre salen de la estructura', S.structure().textFields.includes('executive_observations') && !S.structure().textFields.includes('headquarters_address'));
  const crowded = [{ name: 'crear_ficha', args: { tipo: 'distributor', nombre: 'MEDIMEX' } }, upd('dist-medimex', { executive_observations: 'Texto que reemplaza por completo lo anterior de forma total.' }), upd('person-humberto-bouche', { campo_que_nadie_usa: 'x' })];
  o = R.inspectPlan(crowded, [], '');
  t('B6 cada aviso fuerte lleva su categoría, alineada con su texto y en orden', o.fuertes.length === 3 && JSON.stringify(o.fuertesCat) === '["duplicado","pisa_texto","campo"]', JSON.stringify(o.fuertesCat));
  const ag = [{ name: 'agendar', args: { titulo: 'x', fecha: '2026-11-21', con: ['person-tomas-casas'] } }];
  o = R.inspectPlan(ag, [], 'Reunión el 20 de noviembre a las 10:00');
  t('B7 una fecha que no cuadra es de categoría «fecha» y una hora sin recoger, «cobertura»', !!(o.fuertesCat?.includes('fecha') && o.fuertesCat?.includes('cobertura')), JSON.stringify(o.fuertesCat));
  const custom = YAML.parse(fs.readFileSync(path.join(REPO, '00-System', 'estructura.yaml'), 'utf8')); custom.textFields = ['headquarters_address'];
  fs.mkdirSync(path.join(vault, '00-System'), { recursive: true }); fs.writeFileSync(path.join(vault, '00-System', 'estructura.yaml'), YAML.stringify(custom)); S.resetStructureCache();
  o = R.inspectPlan([upd('dist-medimex', { headquarters_address: 'Otra dirección completamente distinta de la anterior' })], [], 'x');
  t('B8 si el archivo de estructura declara la dirección como texto libre, vuelve a frenar (se decide en el archivo, no en el código)', o.fuertesCat?.[0] === 'pisa_texto' && S.structure().textFields.includes('executive_observations'), JSON.stringify(o.fuertesCat));
  const badTf = YAML.parse(fs.readFileSync(path.join(REPO, '00-System', 'estructura.yaml'), 'utf8')); badTf.textFields = ['Mal Nombre', 'owner'];
  t('B9 un campo de texto libre mal escrito o protegido se rechaza', !S.validateStructure(badTf).ok);
  fs.rmSync(path.join(vault, '00-System', 'estructura.yaml')); S.resetStructureCache();

  // ================= C. Ajustes =================
  t('C1 por defecto la política está vacía: todo se comporta como siempre', JSON.stringify(Set_.defaults().politica) === '{}');
  Set_.saveSettings(vault, { politica: { cobertura: 'avisar', duplicado: 'esperar' } });
  let ls = Set_.loadSettings(vault); t('C2 se guarda y se lee', ls.politica.cobertura === 'avisar' && ls.politica.duplicado === 'esperar', JSON.stringify(ls.politica));
  Set_.saveSettings(vault, { politica: { campo: 'avisar' } });
  ls = Set_.loadSettings(vault); t('C3 un cambio nuevo se suma, no reemplaza lo anterior', ls.politica.cobertura === 'avisar' && ls.politica.campo === 'avisar', JSON.stringify(ls.politica));
  Set_.saveSettings(vault, { politica: { identidad: 'avisar', fecha: 'avisar', delicado: 'avisar', pisa_texto: 'quizás', campo: 7 } });
  ls = Set_.loadSettings(vault); t('C4 las categorías duras y los valores inválidos se descartan al leer: no se puede aflojar lo que no se debe', !('identidad' in ls.politica) && !('fecha' in ls.politica) && !('delicado' in ls.politica) && !('pisa_texto' in ls.politica) && !('campo' in ls.politica) && ls.politica.cobertura === 'avisar', JSON.stringify(ls.politica));
  Set_.saveSettings(vault, { politica: {} }); Set_.saveSettings(vault, { politica: { cobertura: 'esperar' } });

  // ================= D. Contar las esperas =================
  let n = 0;
  const mk = (o: Record<string, any>): any => ({ id: `ped-${++n}`, at: '2026-11-15T10:00:00Z', by: 'Persona', via: 'app', text: 't', ops: [], plan: [], ...o });
  const waitedApproved = (cat: string) => mk({ status: 'aplicado', decidedBy: 'HB', esperaCat: cat });
  const waitedRejected = (cat: string) => mk({ status: 'rechazado', decidedBy: 'HB', esperaCat: cat });
  const solo = () => mk({ status: 'aplicado' });
  let w = D.waitStats([], new Set()); t('D1 sin pedidos: lo dice y no inventa', w.pedidos === 0 && w.advertencias.some(a => /nada que contar/.test(a)));
  const reqs = [...Array(14)].map(() => waitedApproved('cobertura')).concat([...Array(1)].map(() => waitedRejected('cobertura')), [...Array(11)].map(() => waitedApproved('identidad')), [...Array(3)].map(() => waitedRejected('delicado')), [...Array(20)].map(solo), [mk({ status: 'pendiente', esperaCat: 'campo' })]);
  w = D.waitStats(reqs, new Set());
  const cob_ = w.porCategoria.find(c => c.categoria === 'cobertura')!;
  t('D2 cuenta por categoría y qué pasó con cada espera', cob_.total === 15 && cob_.aprobadas === 14 && cob_.descartadas === 1 && w.porCategoria[0].categoria === 'cobertura', JSON.stringify(w.porCategoria));
  t('D3 cuenta los pedidos que se guardaron solos y los que tuvieron espera', w.seGuardaronSolos === 20 && w.conEspera === 30 && w.pedidos === 50, JSON.stringify([w.pedidos, w.seGuardaronSolos, w.conEspera]));
  t('D4 marca cuáles categorías se pueden aflojar y cuáles son regla dura', cob_.aflojable === true && w.porCategoria.find(c => c.categoria === 'identidad')!.aflojable === false && w.porCategoria.find(c => c.categoria === 'delicado')!.aflojable === false);
  t('D5 una categoría aflojable que se aprueba casi siempre: sugiere politica = avisar', w.lecturas.some(l => /«cobertura»: 15 esperas, 93 % aprobadas tal cual\. Es una aprobación de más: puedes poner politica\.cobertura = «avisar»/.test(l)), JSON.stringify(w.lecturas));
  t('D6 una regla dura que se aprueba casi siempre NO sugiere aflojarla: dice que hay que mejorar el motor', w.lecturas.some(l => /«identidad»: 100 % aprobadas tal cual, pero esta categoría es una regla dura/.test(l)) && !w.lecturas.some(l => /politica\.identidad/.test(l)));
  t('D7 una categoría que siempre se rechaza no se sugiere aflojar', !w.lecturas.some(l => /«delicado».*avisar/.test(l)));
  w = D.waitStats([...Array(5)].map(() => waitedApproved('cobertura')), new Set());
  t('D8 con muestra chica advierte y no sugiere nada', w.advertencias.some(a => /10 esperas resueltas/.test(a)) && !w.lecturas.some(l => /politica/.test(l)));
  w = D.waitStats([mk({ status: 'pendiente', partial: { saved: ['x'] }, waitCats: ['delicado', 'delicado', 'identidad'] })], new Set());
  t('D9 un pedido que se guardó en parte cuenta cada categoría una vez', w.porCategoria.length === 2 && w.porCategoria.every(c => c.total === 1) && w.conEspera === 1);
  w = D.waitStats([mk({ status: 'aplicado', decidedBy: 'HB', esperaCat: 'cobertura', changeId: 'ch-1' })], new Set(['ch-1']));
  t('D10 una espera aprobada y luego deshecha cuenta como aprobada (se deshizo después, aparte)', w.porCategoria[0].aprobadas === 1);
  t('D11 el informe en palabras trae la tabla y la lectura', /ESPERAS POR CATEGORÍA/.test(D.formatWaitStats(D.waitStats(reqs))) && /se afloja/.test(D.formatWaitStats(D.waitStats(reqs))) && /LECTURA/.test(D.formatWaitStats(D.waitStats(reqs))));

  // ================= E. pedir() completo =================
  const real = globalThis.fetch; const cfg = { llmPlan: [] as any[] };
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) return json({ message: { content: '', tool_calls: cfg.llmPlan.map(c => ({ function: c })) }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 });
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: 0.9 }; if (b.questions.coherente) a.coherente = { type: 'score', score: 1, confidence: 0.9 }; return json({ answers: a, model: 'jev-simulado', usage: {} }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    // Pierre, en un solo mensaje y sin aprobaciones
    const pierre = { tipo: 'person', nombre: 'Pierre Canavaggio', campos: { email_primary: 'pcanavaggio@medimex.com' }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB' };
    const textP = 'Crea el contacto de Pierre Canavaggio, dueño de MEDIMEX. Su correo publicado es pcanavaggio@medimex.com.';
    cfg.llmPlan = [{ name: 'crear_ficha', arguments: pierre }];
    const dry: any = await E.pedir({ text: textP, dryRun: true });
    t('E1 el ENSAYO dice la verdad: con «contactos» en proponer, Pierre se guardaría solo (antes salía «esperaría» porque cortaba antes de guardar primero)', dry.decision?.accion === 'guardar' && /^Ensayo: se aplicaría solo/.test(dry.why), JSON.stringify([dry.decision, dry.why]));
    t('E2 el ensayo no escribe nada', !fs.existsSync(path.join(vault, '01-Internal-Clients', 'Person - Pierre Canavaggio.md')));
    const rP: any = await E.pedir({ text: textP });
    t('E3 el pedido real: un mensaje, cero aprobaciones', rP.status === 'aplicado' && rP.decision?.accion === 'guardar' && !rP.esperaCat && fs.existsSync(path.join(vault, '01-Internal-Clients', 'Person - Pierre Canavaggio.md')), `${rP.status} ${rP.why || rP.message}`);
    // Cambiar la dirección de MEDIMEX
    cfg.llmPlan = [{ name: 'actualizar_campos', arguments: { ficha: 'dist-medimex', campos: { headquarters_address: 'Calle 50, Edificio Ejemplo, Ciudad de Panamá' }, clase: 'publicado', fuente: 'sitio web de MEDIMEX' } }];
    const rA: any = await E.pedir({ text: 'La dirección de MEDIMEX ahora es Calle 50, Edificio Ejemplo, Ciudad de Panamá, según su sitio web.' });
    t('E4 cambiar la dirección de una empresa se guarda sin esperar', rA.status === 'aplicado' && fmOf(MEDIMEX).headquarters_address === 'Calle 50, Edificio Ejemplo, Ciudad de Panamá', `${rA.status} ${rA.why}`);
    t('E5 y queda con su origen (5.2) y con el aviso de qué se reemplazó', fmOf(MEDIMEX).field_sources?.headquarters_address?.clase === 'publicado' && (rA.obs?.avisos || []).some((x: string) => /se reemplaza headquarters_address/.test(x)));
    // Pisar un texto libre: espera con su categoría
    cfg.llmPlan = [{ name: 'actualizar_campos', arguments: { ficha: 'dist-medimex', campos: { executive_observations: 'Nuevo texto completamente distinto sin ninguna relación con lo anterior de la ficha.' } } }];
    const textO = 'Cambia las observaciones ejecutivas de MEDIMEX por un texto nuevo completamente distinto.';
    const rO: any = await E.pedir({ text: textO });
    t('E6 reemplazar un texto libre espera, con categoría pisa_texto', rO.status === 'pendiente' && rO.esperaCat === 'pisa_texto' && rO.decision?.accion === 'esperar' && String(fmOf(MEDIMEX).executive_observations) !== 'Nuevo texto completamente distinto sin ninguna relación con lo anterior de la ficha.', `${rO.status} ${rO.esperaCat} ${rO.why}`);
    // Guardar primero: una parte cierta y una delicada
    cfg.llmPlan = [{ name: 'registrar_novedad', arguments: { ficha: 'person-tomas-casas', resumen: 'Revisó el correo de hoy.', fuente: 'HB' } }, { name: 'borrar_ficha', arguments: { ficha: 'person-humberto-bouche', motivo: 'duplicada' } }];
    const textD = 'Anota que Tomás revisó el correo de hoy y borra la ficha de Humberto.';
    const dryD: any = await E.pedir({ text: textD, dryRun: true });
    t('E7 el ensayo de un pedido mixto dice lo que pasaría: guardar una parte y esperar otra', dryD.decision?.accion === 'guardar_parcial' && dryD.decision.guardaria === 1 && dryD.decision.esperaria === 1 && /Ensayo: se guardarían 1 y esperarían 1/.test(dryD.why), JSON.stringify([dryD.decision, dryD.why]));
    t('E8 y no guardó nada', !JSON.stringify(fmOf(TOMAS)).includes('Revisó el correo de hoy'));
    const rD: any = await E.pedir({ text: textD });
    t('E9 el pedido real guarda lo cierto y deja esperando solo lo delicado, con su categoría', rD.status === 'pendiente' && rD.partial?.saved?.length === 1 && rD.esperaCat === 'delicado' && JSON.stringify(rD.waitCats) === '["delicado"]' && rD.decision?.accion === 'guardar_parcial', `${rD.status} ${JSON.stringify(rD.partial)} ${rD.esperaCat}`);
    t('E10 lo cierto quedó guardado y la ficha a borrar sigue ahí', JSON.stringify(fmOf(TOMAS)).includes('Revisó el correo de hoy') && fs.existsSync(path.join(vault, HUMBERTO)));
    // Una categoría aflojable: cobertura (una hora que el plan no recoge)
    cfg.llmPlan = [{ name: 'agendar', arguments: { titulo: 'ver second brain', fecha: '2026-11-20', con: ['person-tomas-casas'] } }];
    const textG = 'Agenda una reunión con Tomás el 20 de noviembre a las 10:00 para ver el Second Brain.';
    Set_.saveSettings(vault, { politica: {} });
    const rG: any = await E.pedir({ text: textG });
    t('E11 con la política por defecto, un plan que no recoge la hora espera (categoría cobertura)', rG.status === 'pendiente' && rG.esperaCat === 'cobertura', `${rG.status} ${rG.esperaCat} ${rG.why}`);
    Set_.saveSettings(vault, { politica: { cobertura: 'avisar' } });
    cfg.llmPlan = [{ name: 'agendar', arguments: { titulo: 'ver second brain dos', fecha: '2026-11-20', con: ['person-tomas-casas'] } }];
    const rG2: any = await E.pedir({ text: 'Agenda otra reunión con Tomás el 20 de noviembre a las 10:00 para ver el Second Brain dos.' });
    t('E12 con politica.cobertura = avisar, el mismo plan se guarda y el aviso queda a la vista', rG2.status === 'aplicado' && (rG2.obs?.avisos || []).some((x: string) => /Se guardó igual: en tus Ajustes este aviso no frena/.test(x)) && !(rG2.obs?.fuertes || []).length, `${rG2.status} ${JSON.stringify(rG2.obs?.avisos)}`);
    Set_.saveSettings(vault, { politica: { cobertura: 'esperar' } });
    // Los casos guardados alimentan el conteo
    const ws = D.waitStats(E.listRequests(vault), new Set());
    t('E13 el conteo de esperas lee los casos que acaba de guardar el motor', ws.porCategoria.some(c => c.categoria === 'pisa_texto') && ws.porCategoria.some(c => c.categoria === 'delicado') && ws.porCategoria.some(c => c.categoria === 'cobertura') && ws.seGuardaronSolos >= 3, JSON.stringify(ws.porCategoria.map(c => [c.categoria, c.total])));
    t('E14 la prueba no dejó fichas en la bóveda real del repo', !fs.existsSync(path.join(REPO, '01-Internal-Clients', 'Person - Pierre Canavaggio.md')));
  } finally { globalThis.fetch = real; }

  // ================= F. El banco mide con la decisión real =================
  const cases = new Map(B.bankCases().map(c => [c.n, c]));
  const ctx = { status: 'pendiente', ops: [], plan: [] } as any;
  const piercing = [{ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Pierre Canavaggio', campos: { email_primary: 'pcanavaggio@medimex.com' }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'contact_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }] } }];
  t('F1 caso 13: con la decisión «guardar», pasa aunque el texto diga otra cosa', cases.get(13)!.check({ ...ctx, ops: piercing, why: 'cualquier texto', decision: { accion: 'guardar', categoria: null, guardaria: 1, esperaria: 0 } }, []) === null);
  t('F2 caso 13: con «guardar_parcial» o «esperar» falla', /esperaría/.test(String(cases.get(13)!.check({ ...ctx, ops: piercing, why: 'Ensayo: se aplicaría solo.', decision: { accion: 'esperar', categoria: 'ajustes', guardaria: 0, esperaria: 1 } }, []))) && /esperaría/.test(String(cases.get(13)!.check({ ...ctx, ops: piercing, why: 'x', decision: { accion: 'guardar_parcial', categoria: 'delicado', guardaria: 1, esperaria: 1 } }, []))));
  const addr = [{ name: 'actualizar_campos', args: { ficha: 'dist-medimex', campos: { headquarters_address: 'Calle 50' } } }];
  t('F3 caso 14: cambiar la dirección pasa cuando la decisión es «guardar»', cases.get(14)!.check({ ...ctx, ops: addr, why: 'x', decision: { accion: 'guardar', categoria: null, guardaria: 1, esperaria: 0 } }, []) === null);
  t('F4 sin el campo «decision» el banco sigue entendiendo el texto de antes (compatibilidad)', cases.get(13)!.check({ ...ctx, ops: piercing, why: 'Ensayo: se aplicaría solo.' }, []) === null);
  process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); // primero salir de la carpeta: Windows no deja borrar el directorio de trabajo
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
