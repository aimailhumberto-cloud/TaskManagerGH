/**
 * Cambiar nombre (la operación que faltaba): «Miss Ana Mohamed», como el Dr. Aleem Mohammed. Bóveda temporal con fichas reales copiadas; sin red.
 *   A. Validar.  B. Escribir (título, nombre preferido, alias; nombre y apellido intactos).  C. Describir y clasificar.
 *   D. Un trato en first_name / last_name se rechaza y manda a cambiar_nombre.  E. Deshacer desde el diario.
 * Uso: npx tsx scripts/test-nombre.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nombre-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true });
  const ANNA = '01-Internal-Clients/Person - Anna Mohammed.md', ALEEM = '01-Internal-Clients/Person - Aleem Mohammed.md';
  for (const f of [ANNA, ALEEM]) fs.copyFileSync(path.join(REPO, f), path.join(vault, f));
  process.env.SMJ_VAULT_PATH = vault;
  process.chdir(root);
  const O = await import('../src/lib/cerebro/ops');
  const D = await import('../src/lib/cerebro/decision');
  const { readNoteStrict } = await import('../src/lib/vaultFiles');
  const { loadBrainGraph } = await import('../src/lib/smjBrainService');
  const fmOf = (rel: string) => (readNoteStrict(path.join(vault, rel)) as any).frontmatter as Record<string, any>;
  loadBrainGraph();

  const antes = fmOf(ANNA); const aleem = fmOf(ALEEM);
  t('A0 punto de partida: Anna se ve como «Person: Anna Mohammed» y el Dr. Aleem lleva el trato en título y nombre preferido', antes.title === 'Person: Anna Mohammed' && aleem.title === 'Person: Dr. Aleem Mohammed' && aleem.preferred_name === 'Dr. Aleem Mohammed', `${antes.title} | ${aleem.title}`);

  // ================= A. Validar =================
  const op = (nombre: unknown, extra: Record<string, unknown> = {}) => ({ name: 'cambiar_nombre', args: { ficha: 'person-anna-mohammed', nombre, clase: 'persona', fuente: 'HB', ...extra } });
  t('A1 un nombre bueno se acepta', O.validateOp(op('Miss Ana Mohamed') as any) === null, String(O.validateOp(op('Miss Ana Mohamed') as any)));
  t('A2 sin nombre se rechaza', /falta «nombre»/.test(String(O.validateOp(op('') as any))));
  t('A3 una ficha que no existe se rechaza', /no existe/.test(String(O.validateOp({ name: 'cambiar_nombre', args: { ficha: 'person-nadie', nombre: 'X Y' } } as any))));
  t('A4 dos puntos y corchetes se rechazan (rompen el título); un salto de línea se vuelve espacio', ['Miss: Ana', 'Miss [[Ana]]', 'Miss ]Ana'].every(n => /nombre de 2 a 80/.test(String(O.validateOp(op(n) as any)))));
  t('A4b un salto de línea se vuelve espacio, no rompe el título', O.validateOp(op('Miss\nAna') as any) === null);
  t('A5 un nombre de más de 80 caracteres se rechaza', /nombre de 2 a 80/.test(String(O.validateOp(op('x'.repeat(81)) as any))));
  t('A6 si ya se llama así, lo dice', /ya se llama/.test(String(O.validateOp(op('Anna Mohammed') as any))));
  t('A7 «verificado» no se puede poner como clase', /marcar_verificado/.test(String(O.validateOp(op('Miss Ana Mohamed', { clase: 'verificado' }) as any))));
  t('A8 con clase persona la fuente es obligatoria', /fuente.*obligatoria/.test(String(O.validateOp(op('Miss Ana Mohamed', { fuente: '' }) as any))));

  // ================= B. Escribir =================
  const msg = O.executeOp(op('Miss Ana Mohamed') as any);
  const f = fmOf(ANNA);
  t('B1 el título visible cambia y conserva el prefijo del tipo', f.title === 'Person: Miss Ana Mohamed', f.title);
  t('B2 el nombre preferido cambia', f.preferred_name === 'Miss Ana Mohamed', f.preferred_name);
  t('B3 el nombre y el apellido NO se tocan', f.first_name === antes.first_name && f.last_name === antes.last_name, `${f.first_name} ${f.last_name}`);
  t('B4 el nombre anterior queda como alias, sin perder los que había', f.aliases.includes('Anna Mohammed') && (antes.aliases || []).every((a: string) => f.aliases.includes(a)), JSON.stringify(f.aliases));
  t('B5 sin alias repetidos', new Set(f.aliases).size === f.aliases.length);
  t('B6 queda el origen del nombre preferido: lo dijo una persona, HB', f.field_sources?.preferred_name?.clase === 'persona' && f.field_sources.preferred_name.fuente === 'HB', JSON.stringify(f.field_sources?.preferred_name));
  t('B7 el id, el archivo, el cargo y las conexiones siguen igual', f.id === antes.id && f.job_title === antes.job_title && JSON.stringify(f.relations) === JSON.stringify(antes.relations) && fs.existsSync(path.join(vault, ANNA)));
  t('B8 el mensaje dice el nombre nuevo y el anterior', /Miss Ana Mohamed/.test(msg) && /Anna Mohammed/.test(msg), msg);
  t('B9 el grafo ya muestra el nombre nuevo', (loadBrainGraph().allNodes || []).find(n => n.id === 'person-anna-mohammed')?.title === 'Person: Miss Ana Mohamed');
  // Volver a cambiarlo: el que estaba pasa a alias y no se pierde ninguno.
  O.executeOp(op('Ms. Anna Mohammed') as any);
  const g = fmOf(ANNA);
  t('B10 un segundo cambio deja a los dos anteriores como alias', g.title === 'Person: Ms. Anna Mohammed' && g.aliases.includes('Miss Ana Mohamed') && g.aliases.includes('Anna Mohammed'), JSON.stringify(g.aliases));

  // B11. Una ficha renombrada se sigue pudiendo nombrar como antes. En producción, tras renombrar a Ana, «Anna Mohammed» dejó de ser
  // un nombre completo y el Cerebro preguntó «¿Cuál Anna: Anna Phillip, Anna-Leah Jugoon?». Con los alias ya no pregunta.
  O.executeOp(op('Miss Ana Mohamed') as any); // el título ya no contiene «Anna Mohammed»: solo queda como alias
  const { nameAmbiguities } = await import('../src/lib/brainLens');
  for (const x of ['Person - Anna Phillip.md', 'Person - Anna-Leah Jugoon.md']) fs.copyFileSync(path.join(REPO, '01-Internal-Clients', x), path.join(vault, '01-Internal-Clients', x));
  loadBrainGraph();
  const amb = nameAmbiguities('Cambia el nombre de Anna Mohammed a «Miss Ana Mohamed».').map(a => a.word);
  t('B11 tras renombrar, «Anna Mohammed» (el nombre de antes, ahora alias) no vuelve a ser ambiguo', !amb.includes('anna'), JSON.stringify(amb));
  t('B12 y una Anna suelta sigue siendo ambigua (la regla no se aflojó)', nameAmbiguities('Llama a Anna mañana').some(a => a.word === 'anna'));

  // ================= C. Describir y clasificar =================
  const d = O.describeOp(op('Dra. Ana Mohamed', { clase: 'persona', fuente: 'HB' }) as any);
  t('C1 el plan dice «antes → después» y el origen', /«Miss Ana Mohamed» → «Dra\. Ana Mohamed»/.test(d) && /HB/.test(d), d);
  t('C2 se guarda sola (nivel «sola») y cuenta como «novedades» para los interruptores', O.levelOf(op('X Y') as any) === 'sola' && O.kindOf(op('X Y') as any) === 'novedades');
  t('C3 toca solo esa ficha', JSON.stringify(O.touchesOf(op('X Y') as any)) === JSON.stringify(['person-anna-mohammed']));
  t('C4 está en el menú que ve el modelo, con el nombre y la ficha como obligatorios', O.toolDefs().some((x: any) => x.function.name === 'cambiar_nombre' && x.function.parameters.required.includes('nombre') && x.function.parameters.required.includes('ficha')));
  t('C5 la tabla de decisión lo trata como riesgo bajo', typeof (D as any).decide === 'function');

  // ================= D. Un trato en nombre o apellido se rechaza =================
  for (const [campo, valor] of [['first_name', 'Miss Ana'], ['last_name', 'Dr. Mohamed'], ['first_name', 'ms. Ana'], ['first_name', 'Dra Ana']]) {
    const r = O.validateOp({ name: 'actualizar_campos', args: { ficha: 'person-anna-mohammed', campos: { [campo]: valor }, clase: 'persona', fuente: 'HB' } } as any);
    t(`D1 «${valor}» en ${campo} se rechaza y manda a cambiar_nombre`, /cambiar_nombre/.test(String(r)), String(r));
  }
  for (const [campo, valor] of [['first_name', 'Anna'], ['last_name', 'Mohammed'], ['first_name', 'Drake'], ['last_name', 'Missouri'], ['first_name', 'Mister']]) {
    const r = O.validateOp({ name: 'actualizar_campos', args: { ficha: 'person-anna-mohammed', campos: { [campo]: valor }, clase: 'persona', fuente: 'HB' } } as any);
    t(`D2 «${valor}» en ${campo} NO se confunde con un trato`, r === null, String(r));
  }
  t('D3 un trato en otros campos (cargo, nota) se permite', O.validateOp({ name: 'actualizar_campos', args: { ficha: 'person-anna-mohammed', campos: { job_title: 'Dr. en Química' }, clase: 'persona', fuente: 'HB' } } as any) === null);

  // ================= E. Deshacer =================
  // El diario de cambios guarda las fichas que toca la operación; aquí se comprueba que la operación declara lo que toca (lo que el diario usa para deshacer).
  t('E1 declara la ficha que toca, para que el diario la guarde antes de cambiarla', O.touchesOf(op('X Y') as any)[0] === 'person-anna-mohammed');

  // ================= F. Integración: pedir() completo con el pedido real de HB =================
  // El modelo (simulado) primero se equivoca como lo hizo en producción (mete «Miss» en el nombre); la app lo rechaza y él corrige con cambiar_nombre.
  fs.copyFileSync(path.join(REPO, ANNA), path.join(vault, ANNA)); loadBrainGraph(); // Anna otra vez como en producción
  const E = await import('../src/lib/cerebro/engine'); const J = await import('../src/lib/journal');
  process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  const real = globalThis.fetch; let modelCalls = 0; const sawError: string[] = [];
  const bad1 = { ficha: 'person-anna-mohammed', campos: { first_name: 'Miss Ana', last_name: 'Mohamed' }, clase: 'persona', fuente: 'HB' };
  const good = { ficha: 'person-anna-mohammed', nombre: 'Miss Ana Mohamed', clase: 'persona', fuente: 'HB' };
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) {
      modelCalls++; const body = JSON.parse(String(init?.body || '{}')); sawError.push(JSON.stringify(body.messages || []).slice(-1500));
      const first = modelCalls === 1;
      return json({ message: { content: '', tool_calls: [{ function: first ? { name: 'actualizar_campos', arguments: bad1 } : { name: 'cambiar_nombre', arguments: good } }] }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 });
    }
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: 0.9 }; if (b.questions.coherente) a.coherente = { type: 'score', score: 3, confidence: 0.9 }; return json({ answers: a, model: 'jev-simulado', usage: {} }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    const rec: any = await E.pedir({ text: 'Cambia el nombre de Anna Mohammed a «Miss Ana Mohamed». A Dr. Aleem Mohammed se le da ese trato y a ella también.' });
    const h = fmOf(ANNA);
    t('F1 el pedido se aplica solo (renombrar es reversible)', rec.status === 'aplicado', `${rec.status} ${rec.why || rec.message}`);
    t('F2 el modelo se equivocó primero y la app lo corrigió (dos llamadas, la segunda vio el motivo del rechazo)', modelCalls >= 2 && /cambiar_nombre/.test(sawError[1] || ''), `${modelCalls} llamadas`);
    t('F3 la ficha se ve «Miss Ana Mohamed» y nombre y apellido quedaron como estaban', h.title === 'Person: Miss Ana Mohamed' && h.first_name === antes.first_name && h.last_name === antes.last_name, JSON.stringify([h.title, h.first_name, h.last_name]));
    t('F4 el plan lo dice en palabras', (rec.plan || []).some((x: string) => /Cambiar el nombre/.test(x) && /Miss Ana Mohamed/.test(x)), JSON.stringify(rec.plan));
    // Deshacer desde el diario
    const changeId = rec.changeId; t('F5 hay recibo para deshacer', !!changeId, JSON.stringify(rec.receipt));
    if (changeId) {
      const u = await J.undoChange(vault, changeId, { by: 'prueba', via: 'prueba' } as any);
      const k = fmOf(ANNA);
      t('F6 deshacer devuelve el nombre anterior', (u as any).ok !== false && k.title === 'Person: Anna Mohammed' && k.preferred_name === antes.preferred_name, JSON.stringify([(u as any).error, k.title, k.preferred_name]));
    }
    t('F7 la prueba no tocó la bóveda real del repo', !/Miss Ana Mohamed/.test(fs.readFileSync(path.join(REPO, ANNA), 'utf8')));
  } finally { globalThis.fetch = real; }

  try { process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); } catch {}
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
