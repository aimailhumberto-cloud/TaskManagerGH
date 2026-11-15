/**
 * Etapa 5.0b: el uso de Jev en el motor. Todo con modelo y Jev SIMULADOS (sin red), en una bóveda temporal.
 *   A. Lo que Jev ve: las respuestas de quien pide, los nombres, el expediente, y el plan siempre cabe en el tope del proveedor.
 *   B. Lo que se le pregunta y lo que se guarda de su respuesta (seguridad, prueba nativa).
 *   C. Qué hace la app cuando Jev no responde o duda con poca seguridad.
 *   D. Ajustes nuevos.  E. Calibración.  F. Integración: pedir() completo de punta a punta.
 * Uso: npx tsx scripts/test-jev-uso.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jevuso-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true }); fs.mkdirSync(path.join(vault, '02-External-Clients'), { recursive: true });
  for (const f of ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md']) fs.copyFileSync(path.join(REPO, f), path.join(vault, f));
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  const J = await import('../src/lib/cerebro/jev');
  const { MAX_STATE_CHARS } = await import('../src/lib/decisionEngine');
  const { loadSettings, saveSettings, defaults } = await import('../src/lib/cerebro/settings');
  const { calibrate, outcomeOf, formatCalibration } = await import('../src/lib/cerebro/jevcal');
  const E = await import('../src/lib/cerebro/engine');

  // ---- Jev simulado: registra lo que recibe y responde según el modo ----
  const real = globalThis.fetch;
  const seen: { state: string; questions: Record<string, any> }[] = [];
  const cfg = { jev: 'ok' as 'ok' | 'down', fiel: 3, conf: 0.9, motivo: 'bien', noul: 0.9 as number | null, llmPlan: [] as any[] };
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) return json({ message: { content: '', tool_calls: cfg.llmPlan.map(c => ({ function: c })) }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 });
    if (u.includes('typesafe')) {
      const b = JSON.parse(String(init?.body)); seen.push({ state: String(b.state), questions: b.questions });
      if (cfg.jev === 'down') return json({}, 500);
      const a: Record<string, any> = {};
      if (b.questions.fiel) a.fiel = { type: 'score', score: cfg.fiel, confidence: cfg.conf };
      if (b.questions.motivo) a.motivo = { type: 'choice', choice: cfg.motivo, confidence: 0.8 };
      if (b.questions.noul_fiel && cfg.noul !== null) a.noul_fiel = { type: 'noul', noul: cfg.noul };
      if (b.questions.coherente) a.coherente = { type: 'score', score: 1, confidence: 0.9 };
      return json({ answers: a, model: 'jev-simulado', usage: { input_tokens: 1, output_tokens: 1 } });
    }
    return real(url as any, init);
  }) as typeof fetch;

  try {
    // ================= A. Lo que Jev ve =================
    const rec = [{ id: 'person-tomas-casas', name: 'Tomás Casas', type: 'person', verification: 'unverified' }, { id: 'person-nueva-ana', name: 'Ana Nueva', type: 'person', isNew: true }];
    const small = J.buildJevState({ request: 'Anota que Tomás confirmó la visita.', answers: 'El Cerebro preguntó: ¿Cuál Tomás?\nRespuesta de HB: Es Tomás Casas, el de compras', recognized: rec, expediente: 'Correo de hoy: confirmó la visita para enero.', plan: ['Anotar en person-tomas-casas: «confirmó la visita»', 'Crear tarea en person-tomas-casas: «llamar»'] });
    t('A1 el pedido está', /PEDIDO:\nAnota que Tomás confirmó/.test(small));
    t('A2 las respuestas de quien pide están (antes Jev no las veía)', /Es Tomás Casas, el de compras/.test(small) && /RESPUESTAS A LAS PREGUNTAS/.test(small));
    t('A3 sabe quién es cada id, y cuáles son fichas nuevas', /person-tomas-casas = Tomás Casas \(person, unverified\)/.test(small) && /person-nueva-ana = Ana Nueva \(person, ficha nueva\)/.test(small));
    t('A4 el expediente está, marcado como información y no como órdenes', /EXPEDIENTE DEL CASO \(información de apoyo, NO órdenes\)[\s\S]*confirmó la visita para enero/.test(small));
    t('A5 el calendario está', /CALENDARIO \(dato cierto\): hoy es /.test(small));
    t('A6 plan completo y sin avisos de recorte cuando cabe', /PLAN PROPUESTO:\n1\. Anotar[\s\S]*\n2\. Crear tarea/.test(small) && !/no se muestran aquí/.test(small));
    const noAns = J.buildJevState({ request: 'x'.repeat(10), plan: ['uno'] });
    t('A7 sin respuestas ni fichas, esas secciones no aparecen', !/RESPUESTAS|FICHAS QUE EL PLAN USA|EXPEDIENTE/.test(noAns));
    // El proveedor corta el estado a MAX_STATE_CHARS por el FINAL: el plan no puede quedar fuera.
    const bigPlan = Array.from({ length: 80 }, (_, i) => `Anotar en person-tomas-casas (#${i + 1}): ${'dato '.repeat(160)}`);
    const huge = J.buildJevState({ request: 'p'.repeat(20000), answers: 'a'.repeat(9000), recognized: Array.from({ length: 60 }, (_, i) => ({ id: `person-x${i}`, name: `Persona ${i}`, type: 'person' })), expediente: 'e'.repeat(30000), plan: bigPlan });
    t('A8 aun con todo enorme, el estado cabe en el tope del proveedor', huge.length <= MAX_STATE_CHARS, `${huge.length} > ${MAX_STATE_CHARS}`);
    t('A9 con todo enorme, el plan sigue ahí (empieza por la operación 1)', /PLAN PROPUESTO:\n1\. Anotar en person-tomas-casas \(#1\)/.test(huge));
    t('A10 con todo enorme, dice cuántas operaciones no caben (no recorta en silencio)', /\(\+\d+ operaciones más no se muestran aquí por espacio; el plan completo tiene 80\.\)/.test(huge));
    t('A11 y las respuestas de quien pide sobreviven al pedido enorme', /RESPUESTAS A LAS PREGUNTAS/.test(huge) && /… \(\+\d+\)/.test(huge));
    const cutByProvider = huge.slice(0, MAX_STATE_CHARS); t('A12 lo que el proveedor corta no cambia nada: ya cabía', cutByProvider === huge);

    // ================= B. Lo que se pregunta y lo que se guarda =================
    seen.length = 0; cfg.jev = 'ok'; cfg.fiel = 2; cfg.conf = 0.55; cfg.motivo = 'dato'; cfg.noul = 0.7;
    let r = await J.judge('Anota algo', ['1. Anotar en person-tomas-casas'], { answers: 'Respuesta de HB: Es Tomás Casas', recognized: rec, expediente: 'EXP-DATO' });
    t('B1 a Jev le llegaron las respuestas, los nombres y el expediente', /Es Tomás Casas/.test(seen[0].state) && /person-tomas-casas = Tomás Casas/.test(seen[0].state) && /EXP-DATO/.test(seen[0].state));
    t('B2 se le hacen las tres preguntas: puntaje, motivo y prueba nativa', !!seen[0].questions.fiel && !!seen[0].questions.motivo && seen[0].questions.noul_fiel?.type === 'noul');
    t('B3 se guarda el puntaje, su seguridad (antes se descartaba) y la prueba nativa', r.score !== null && Math.abs(r.score - 2 / 3) < 1e-9 && r.seguridad === 0.55 && r.noul === 0.7, JSON.stringify(r));
    t('B4 el motivo de la duda sale en palabras', /fecha, cifra o dato dudoso|doubtful date/.test(r.reason), r.reason);
    cfg.noul = null; r = await J.judge('Anota algo', ['1. algo']);
    t('B5 si Jev no contesta la prueba nativa, no pasa nada: queda en null', r.noul === null && r.score !== null);
    seen.length = 0; await J.coherence('FICHA X: estado', ['hecho'], 'pedido');
    t('B6 la pregunta de coherencia no lleva la prueba nativa', !seen[0].questions.noul_fiel);

    // ================= C. Qué hace la app con lo que dijo Jev =================
    const S = { ...defaults(), threshold: 0.6 };
    const R = (o: Partial<ReturnType<typeof defaults>> = {}) => ({ ...S, ...o });
    const down = { score: null, seguridad: null, noul: null, reason: '', problem: 'Jev no está conectado' };
    const good = (seguridad: number | null, score = 1) => ({ score, seguridad, noul: null, reason: '', problem: '' });
    let p = J.jevPolicy({ jev: down, s: R(), lowRisk: false });
    t('C1 Jev caído y plan no simple: queda un aviso (antes, silencio) y no espera', !!p.aviso && /Jev no pudo revisar/.test(p.aviso) && p.why === null, JSON.stringify(p));
    p = J.jevPolicy({ jev: down, s: R({ jevRequired: true }), lowRisk: false });
    t('C2 Jev caído, obligatorio en Ajustes y plan no simple: espera aprobación', !!p.why && /obligatoria/.test(p.why) && !!p.aviso, JSON.stringify(p));
    p = J.jevPolicy({ jev: down, s: R({ jevRequired: true }), lowRisk: true });
    t('C3 Jev caído pero el cambio es simple y reversible: no se frena ni se avisa', p.why === null && p.aviso === null);
    p = J.jevPolicy({ jev: good(0.3), s: R({ jevMinConfidence: 0.5 }), lowRisk: false });
    t('C4 buen puntaje pero poca seguridad, con mínimo exigido: cuenta como duda', !!p.why && /30 %/.test(p.why) && /50 %/.test(p.why), JSON.stringify(p));
    p = J.jevPolicy({ jev: good(0.3), s: R({ jevMinConfidence: 0.5 }), lowRisk: true });
    t('C5 lo mismo en un cambio simple: no frena', p.why === null);
    p = J.jevPolicy({ jev: good(0.3), s: R(), lowRisk: false });
    t('C6 sin mínimo exigido (por defecto) la seguridad no cambia nada', p.why === null && p.aviso === null);
    p = J.jevPolicy({ jev: good(null), s: R({ jevMinConfidence: 0.5 }), lowRisk: false });
    t('C7 si Jev no dio seguridad, no se inventa una duda', p.why === null);
    p = J.jevPolicy({ jev: good(0.9, 0.3), s: R({ jevMinConfidence: 0.5 }), lowRisk: false });
    t('C8 un puntaje bajo lo maneja la regla del umbral, no esta función', p.why === null);
    p = J.jevPolicy({ jev: good(0.95), s: R({ jevMinConfidence: 0.5, jevRequired: true }), lowRisk: false });
    t('C9 Jev respondió bien y seguro: nada que decir', p.why === null && p.aviso === null);

    // ================= D. Ajustes nuevos =================
    const d = defaults(); t('D1 por defecto no cambia el comportamiento de hoy', d.jevRequired === false && d.jevMinConfidence === 0);
    saveSettings(vault, { jevRequired: true, jevMinConfidence: 0.5 });
    let s = loadSettings(vault); t('D2 se guardan y se leen', s.jevRequired === true && s.jevMinConfidence === 0.5, JSON.stringify([s.jevRequired, s.jevMinConfidence]));
    saveSettings(vault, { jevRequired: 'sí', jevMinConfidence: 7 });
    s = loadSettings(vault); t('D3 valores inválidos vuelven al valor seguro', s.jevRequired === false && s.jevMinConfidence === 0, JSON.stringify([s.jevRequired, s.jevMinConfidence]));
    saveSettings(vault, { jevRequired: false, jevMinConfidence: 0 });

    // ================= E. Calibración =================
    let n = 0;
    const mk = (o: Record<string, any>): any => ({ id: `ped-${++n}`, at: '2026-11-15T10:00:00Z', by: 'Persona', via: 'app', text: 't', ops: [], plan: [], ...o });
    const waitApproved = (fiel: number, extra: Record<string, any> = {}) => mk({ status: 'aplicado', decidedBy: 'HB', why: 'Jev no está seguro de que el plan refleje el pedido (confianza 33 %).', obs: { supuso: [], fuertes: [], avisos: [], falta: [], jev: { fiel, ...extra } } });
    const waitRejected = (fiel: number) => mk({ status: 'rechazado', decidedBy: 'HB', why: 'Jev no está seguro de que el plan refleje el pedido (confianza 33 %).', obs: { supuso: [], fuertes: [], avisos: [], falta: [], jev: { fiel } } });
    const auto = (fiel: number, o: Record<string, any> = {}) => mk({ status: 'aplicado', changeId: `ch-${n}`, obs: { supuso: [], fuertes: [], avisos: [], falta: [], jev: { fiel } }, ...o });
    t('E1 resultado de cada caso', outcomeOf(mk({ status: 'aplicado' }), new Set()) === 'aplicado_solo' && outcomeOf(mk({ status: 'aplicado', decidedBy: 'HB' }), new Set()) === 'aprobado' && outcomeOf(mk({ status: 'rechazado' }), new Set()) === 'descartado' && outcomeOf(mk({ status: 'reemplazado' }), new Set()) === 'corregido' && outcomeOf(mk({ status: 'pendiente' }), new Set()) === 'abierto' && outcomeOf(mk({ status: 'aplicado', changeId: 'X' }), new Set(['X'])) === 'deshecho' && outcomeOf(mk({ status: 'fallo' }), new Set()) === null);
    t('E2 una aplicación parcial deshecha cuenta como deshecha', outcomeOf(mk({ status: 'aplicado', partial: { saved: ['x'], changeId: 'P' } }), new Set(['P'])) === 'deshecho');
    let c = calibrate([], new Set(), 0.6);
    t('E3 sin casos: lo dice y no inventa nada', c.conPuntaje === 0 && c.advertencias.some(x => /nada que calibrar/.test(x)) && c.umbralSugerido === null);
    c = calibrate([...Array(8)].map(() => waitApproved(1 / 3)).concat([...Array(2)].map(() => waitRejected(1 / 3)), [...Array(30)].map(() => auto(1))), new Set(), 0.6);
    t('E4 cuenta las esperas por Jev y cuántas se aprobaron igual', c.esperasPorJev.total === 10 && c.esperasPorJev.aprobadas === 8 && c.esperasPorJev.descartadas === 2, JSON.stringify(c.esperasPorJev));
    t('E5 con muestra chica advierte y no sugiere cambiar el umbral', c.advertencias.some(x => /Muestra chica/.test(x)) && c.umbralSugerido === null);
    t('E6 la tabla pone cada caso en su escalón', c.porPuntaje[1].n === 10 && c.porPuntaje[3].n === 30 && c.porPuntaje[3].aplicado_solo === 30);
    const many = [...Array(22)].map(() => waitApproved(1 / 3)).concat([...Array(3)].map(() => waitRejected(1 / 3)), [...Array(10)].map(() => auto(1)));
    c = calibrate(many, new Set(), 0.6);
    t('E7 con muestra suficiente y casi todo aprobado igual: sugiere bajar el umbral y dice por qué', c.umbralSugerido === 0.3 && c.lecturas.some(x => /frenando de más/.test(x)) && c.lecturas.some(x => /Sugerencia: bajar el umbral a 0.3/.test(x)), JSON.stringify(c.lecturas));
    const withUndone = many.concat([auto(1, { changeId: 'MALO' })]);
    c = calibrate(withUndone, new Set(['MALO']), 0.6);
    t('E8 si algo con puntaje alto se deshizo, advierte y NO sugiere bajar el umbral', c.deshechosConJevAlto === 1 && c.umbralSugerido === null && c.lecturas.some(x => /OJO/.test(x)));
    c = calibrate(many, new Set(), 0.3);
    t('E9 si el umbral ya es el más bajo, no sugiere más', c.umbralSugerido === null);
    c = calibrate([mk({ status: 'aplicado', obs: { supuso: [], fuertes: [], avisos: [], falta: [], jev: { fiel: null, error: 'caído' } } }), auto(1)], new Set(), 0.6);
    t('E10 cuenta los casos donde Jev no respondió', c.sinPuntaje === 1 && c.conPuntaje === 1 && c.advertencias.some(x => /no respondió/.test(x)));
    c = calibrate([waitApproved(1 / 3, { seguridad: 0.9, noul: 0.8 }), waitApproved(1 / 3, { seguridad: 0.7, noul: 0.6 }), waitRejected(0)].map((r, i) => (i === 2 ? { ...r, obs: { ...r.obs, jev: { fiel: 0, seguridad: 0.4, noul: 0.2 } } } : r)), new Set(), 0.6);
    t('E11 compara seguridad y prueba nativa entre lo aprobado y lo descartado', c.seguridad.aprobadas === 0.8 && c.seguridad.descartadas === 0.4 && c.noul.aprobadas === 0.7 && c.noul.descartadas === 0.2, JSON.stringify([c.seguridad, c.noul]));
    t('E12 el informe en palabras trae la tabla y la lectura', /CALIBRACIÓN DE JEV/.test(formatCalibration(c)) && /Puntaje \| casos/.test(formatCalibration(c)) && /LECTURA/.test(formatCalibration(calibrate(many, new Set(), 0.6))));

    // ================= F. Integración: pedir() completo con modelo y Jev simulados =================
    const nov = (ficha: string) => [{ name: 'registrar_novedad', arguments: { ficha, resumen: 'Confirmó la visita para enero.', fuente: 'correo de hoy' } }];
    const prior = { id: 'ped-20261115100000-abcdef', at: new Date().toISOString(), by: 'Persona', via: 'app', text: 'Anota que Tomás confirmó la visita.', status: 'pregunta', ops: [], plan: [], dialog: [{ q: '¿Cuál Tomás?', a: 'Es Tomás Casas, el de compras', by: 'HB' }] } as any;
    cfg.jev = 'ok'; cfg.fiel = 3; cfg.conf = 0.9; cfg.motivo = 'bien'; cfg.noul = 0.9; cfg.llmPlan = nov('person-tomas-casas'); seen.length = 0;
    let rec1: any = await E.pedir({ text: 'Anota que Tomás confirmó la visita.', prior, md: 'Correo de hoy: Tomás confirmó la visita para enero.' });
    t('F1 el pedido se aplica (cambio simple, Jev conforme)', rec1.status === 'aplicado', `${rec1.status} ${rec1.message}`);
    const fielCall = seen.find(x => x.questions.fiel);
    t('F2 Jev recibió la respuesta que dio quien pide', !!fielCall && /Es Tomás Casas, el de compras/.test(fielCall.state), fielCall?.state.slice(0, 300));
    t('F3 Jev recibió quién es cada ficha y el expediente', !!fielCall && /person-tomas-casas = Tom[aá]s Casas/.test(fielCall.state) && /Tomás confirmó la visita para enero/.test(fielCall.state));
    t('F4 queda guardada la seguridad y la prueba nativa en el caso', rec1.obs?.jev?.seguridad === 0.9 && rec1.obs?.jev?.noul === 0.9, JSON.stringify(rec1.obs?.jev));
    t('F5 y la coherencia posterior', typeof rec1.obs?.jev?.coherente === 'number');
    // Jev duda con un motivo en un cambio simple: se guarda igual (riesgo bajo) y el motivo NO se pierde al aplicar (antes se pisaba).
    cfg.fiel = 1; cfg.motivo = 'persona'; cfg.llmPlan = nov('person-tomas-casas'); seen.length = 0;
    const rec2: any = await E.pedir({ text: 'Anota que Tomás confirmó otra cosa.' });
    t('F6 Jev duda de un cambio simple: se guarda igual y avisa', rec2.status === 'aplicado' && rec2.obs?.avisos?.some((x: string) => /Jev dudó/.test(x)), `${rec2.status} ${JSON.stringify(rec2.obs?.avisos)}`);
    t('F7 el motivo de la duda sigue en el caso después de aplicar (antes se perdía)', /persona o la ficha elegida|chosen person or note/.test(rec2.obs?.jev?.motivo || ''), JSON.stringify(rec2.obs?.jev));
    // Jev caído con un plan que no es simple (conectar no es de bajo riesgo).
    const con = [{ name: 'conectar', arguments: { desde: 'person-tomas-casas', hacia: 'person-humberto-bouche', relacion: 'coordinates_with' } }];
    cfg.jev = 'down'; cfg.llmPlan = con;
    const rec3: any = await E.pedir({ text: 'Conecta a Tomás con Humberto para coordinar.' });
    t('F8 Jev caído: el plan sigue (como antes) pero ahora hay un aviso visible', rec3.status === 'aplicado' && rec3.obs?.avisos?.some((x: string) => /Jev no pudo revisar/.test(x)), `${rec3.status} ${JSON.stringify(rec3.obs?.avisos)}`);
    saveSettings(vault, { jevRequired: true }); cfg.llmPlan = [{ name: 'conectar', arguments: { desde: 'person-humberto-bouche', hacia: 'person-tomas-casas', relacion: 'related_to' } }];
    const rec4: any = await E.pedir({ text: 'Conecta a Humberto con Tomás de forma general.' });
    t('F9 Jev caído y obligatorio en Ajustes: espera aprobación y no guarda nada', rec4.status === 'pendiente' && /obligatoria/.test(rec4.why || '') && !rec4.changeId, `${rec4.status} why=${rec4.why} avisos=${JSON.stringify(rec4.obs?.avisos)} jev=${JSON.stringify(rec4.obs?.jev)} ops=${JSON.stringify(rec4.plan)} cfg=${JSON.stringify(loadSettings(vault))}`);
    saveSettings(vault, { jevRequired: false });
    // Con Jev caído, un cambio simple no se frena aunque sea obligatorio (no se bloquea el trabajo diario).
    saveSettings(vault, { jevRequired: true }); cfg.llmPlan = nov('person-humberto-bouche');
    const rec5: any = await E.pedir({ text: 'Anota que Humberto revisó el correo.' });
    t('F10 Jev caído y obligatorio, pero cambio simple y reversible: se guarda', rec5.status === 'aplicado', `${rec5.status} ${rec5.why}`);
    saveSettings(vault, { jevRequired: false });
    // Seguridad mínima exigida.
    cfg.jev = 'ok'; cfg.fiel = 3; cfg.conf = 0.2; cfg.motivo = 'bien'; saveSettings(vault, { jevMinConfidence: 0.5 });
    cfg.llmPlan = [{ name: 'conectar', arguments: { desde: 'person-tomas-casas', hacia: 'person-humberto-bouche', relacion: 'related_to' } }];
    const rec6: any = await E.pedir({ text: 'Conecta a Tomás con Humberto de forma general.' });
    t('F11 buen puntaje con poca seguridad y mínimo exigido: espera aprobación', rec6.status === 'pendiente' && /poca seguridad|low confidence/.test(rec6.why || ''), `${rec6.status} ${rec6.why}`);
    saveSettings(vault, { jevMinConfidence: 0 });
    // Los casos quedaron guardados con lo que Jev dijo: alimentan la calibración.
    const cal = calibrate(E.listRequests(vault), new Set(), 0.6);
    // 6 casos: F1, F6 y F11 con puntaje de Jev; F8, F9 y F10 con Jev caído (sin puntaje).
    t('F12 la calibración lee los casos reales que acaba de guardar el motor: 3 con puntaje y 3 con Jev caído', cal.conPuntaje === 3 && cal.sinPuntaje === 3, JSON.stringify({ con: cal.conPuntaje, sin: cal.sinPuntaje }));
    t('F13 y cuenta como espera causada por Jev la de poca seguridad (F11), todavía abierta', cal.esperasPorJev.total === 1 && cal.esperasPorJev.abiertas === 1 && cal.porPuntaje[3].n === 2, JSON.stringify(cal.esperasPorJev));
  } finally { globalThis.fetch = real; fs.rmSync(root, { recursive: true, force: true }); }
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
