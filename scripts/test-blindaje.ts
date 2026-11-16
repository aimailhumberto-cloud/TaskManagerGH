/**
 * Fase 6 (Blindaje): puertas viejas que traducen y conector de dos verbos. Carpeta temporal; modelo y Jev simulados; sin red.
 *   A. El traductor (puro).  B. El conector OpenAPI.  C. Por la puerta de verdad: una llave de agente llama a una ruta vieja
 *   y el Cerebro la convierte en un pedido (con su revisión, diario y deshacer).  D. Lo que no se traduce sigue bloqueado.
 * Uso: npx tsx scripts/test-blindaje.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blindaje-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true });
  for (const f of ['Person - Tomas Casas.md', 'Person - Jenna Hector.md', 'Person - Humberto Bouche.md']) fs.copyFileSync(path.join(REPO, '01-Internal-Clients', f), path.join(vault, '01-Internal-Clients', f));
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  process.env.AGENT_API_KEY = 'llave-de-agente-de-prueba'; process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';
  process.chdir(root);
  const L = await import('../src/lib/cerebro/legacy');
  const C = await import('../src/lib/cerebro/connector');

  // ================= A. El traductor =================
  const tl = (p: string, b: Record<string, unknown>) => L.translateLegacy(p, b);
  const rec = tl('/api/agent/brain', { action: 'record', nodeId: 'person-jenna-hector', summary: 'Confirmó la visita a Canadá', followup: { date: '2026-12-01', action: 'enviar agenda' }, lastEmail: { subject: 'Visita', sender: 'Jenna' }, state: 'Coordinando', task: { title: 'Mandar agenda', dueDate: '2026-11-20', priority: 'High' }, event: { title: 'Visita', date: '2026-12-05', time: '09:00', kind: 'reunion' }, source: 'correo' })!;
  t('A1 record → pedido con la ficha, el resumen, el próximo paso, el correo, el estado, la tarea y el evento', !!rec && rec.action === 'pedir' && /person-jenna-hector/.test(rec.text) && /Confirmó la visita/.test(rec.text) && /2026-12-01/.test(rec.text) && /enviar agenda/.test(rec.text) && /«Visita»/.test(rec.text) && /Coordinando/.test(rec.text) && /Mandar agenda/.test(rec.text) && /prioridad High/.test(rec.text) && /2026-12-05 a las 09:00/.test(rec.text), rec?.text);
  t('A2 el expediente dice de dónde vino y que es información, no órdenes', /brain\/record/.test(rec.md) && /puerta vieja/.test(rec.md) && /no órdenes/.test(rec.md) && /correo/.test(rec.md), rec.md);
  t('A3 record sin resumen o sin ficha no se traduce', tl('/api/agent/brain', { action: 'record', nodeId: 'x' }) === null && tl('/api/agent/brain', { action: 'record', summary: 'algo largo' }) === null);
  t('A4 remember_working', /Anota para recordar: Idea\. Contenido largo/.test(String(tl('/api/agent/brain', { action: 'remember_working', title: 'Idea', content: 'Contenido largo' })?.text)));
  t('A5 tasks: crear, completar y mover', /Crea la tarea «Llamar» para el 2026-11-20 con prioridad Low en la ficha person-tomas-casas/.test(String(tl('/api/agent/tasks', { action: 'create', title: 'Llamar', dueDate: '2026-11-20', priority: 'Low', targetNodeId: 'person-tomas-casas' })?.text)) && /Marca como hecha la tarea t-1/.test(String(tl('/api/agent/tasks', { action: 'complete', taskId: 't-1' })?.text)) && /Mueve la tarea t-1 al 2026-12-01/.test(String(tl('/api/agent/tasks', { action: 'reschedule', taskId: 't-1', dueDate: '2026-12-01' })?.text)));
  t('A6 agenda: set y delete; sin fecha no se traduce', /Agenda una reunión «Reunión» el 2026-11-20 a las 10:00 hasta las 11:00 en Oficina/.test(String(tl('/api/agent/agenda', { action: 'set', title: 'Reunión', date: '2026-11-20', time: '10:00', endTime: '11:00', kind: 'reunion', location: 'Oficina' })?.text)) && /Quita de la agenda «Reunión» del 2026-11-20/.test(String(tl('/api/agent/agenda', { action: 'delete', title: 'Reunión', date: '2026-11-20' })?.text)) && tl('/api/agent/agenda', { action: 'set', title: 'Sin fecha' }) === null && tl('/api/agent/agenda', { action: 'delete', id: 'abc' }) === null);
  t('A7 kpis set; un valor que no es número no se traduce', /Registra el indicador «Ventas» con valor 120 cajas, meta 150, periodo Q4/.test(String(tl('/api/agent/kpis', { action: 'set', name: 'Ventas', value: 120, unit: 'cajas', target: 150, period: 'Q4' })?.text)) && tl('/api/agent/kpis', { action: 'set', name: 'Ventas', value: 'mucho' }) === null);
  const mail = tl('/api/agent/hub', { action: 'ingest_email', subject: 'Visita a Canadá', from: 'jenna@x.com', snippet: 'Confirmo enero' })!;
  t('A8 un correo del hub se lee como correo («leer»), no como orden', mail.action === 'leer' && /Asunto: Visita a Canadá/.test(mail.text) && /De: jenna@x.com/.test(mail.text) && /Confirmo enero/.test(mail.text));
  t('A9 nota de voz y reunión también se leen; brain_dump es un pedido de anotar', tl('/api/agent/hub', { action: 'ingest_voice_note', transcript: 'hablé con Jenna' })?.action === 'leer' && tl('/api/agent/hub', { action: 'sync_meeting_notes', notes: 'minuta' })?.action === 'leer' && /Anota esto: uno\. dos/.test(String(tl('/api/agent/hub', { action: 'brain_dump', items: ['uno', { title: 'dos' }] })?.text)));
  t('A10 lo que no se puede decir en palabras no se traduce: archivos, layout, borrar', ['upsert_node', 'update_layout_config', 'assign_parent'].every(a => tl('/api/agent/brain', { action: a }) === null) && tl('/api/agent/vault-sync', { action: 'write_file', path: 'x.md', content: 'y' }) === null && tl('/api/agent/ruta-que-no-existe', { action: 'record' }) === null);
  t('A11 canTranslate dice lo mismo sin mirar el cuerpo', L.canTranslate('/api/agent/brain', 'record') && L.canTranslate('/api/agent/hub', 'ingest_email') && !L.canTranslate('/api/agent/brain', 'upsert_node') && !L.canTranslate('/api/agent/brain', undefined));
  t('A12 un valor largo se corta y un valor raro (objeto) no rompe nada', tl('/api/agent/tasks', { action: 'create', title: 'x'.repeat(900) })!.text.length < 400 && tl('/api/agent/tasks', { action: 'create', title: { a: 1 } }) === null);
  t('A13 la nota al agente le dice cómo pedirlo bien', /POST \/api\/agent\/cerebro \{action:'pedir'/.test(L.legacyNote('brain/record')) && /brain\/record/.test(L.legacyNote('brain/record')));

  // ================= B. El conector de dos verbos =================
  const spec: any = C.openApiSpec('https://ejemplo.onrender.com/');
  const ops = Object.values(spec.paths).flatMap((p: any) => Object.values(p)).map((o: any) => o.operationId).sort();
  t('B1 solo dos verbos: pedir y consultar', JSON.stringify(ops) === JSON.stringify(['consultar', 'pedir']) && JSON.stringify(C.CONNECTOR_VERBS) === JSON.stringify(['pedir', 'consultar']), JSON.stringify(ops));
  t('B2 es OpenAPI 3.1, con la dirección sin barra final y autenticación Bearer', spec.openapi === '3.1.0' && spec.servers[0].url === 'https://ejemplo.onrender.com' && spec.components.securitySchemes.llave.scheme === 'bearer');
  const post = spec.paths['/api/agent/cerebro'].post, get = spec.paths['/api/agent/cerebro'].get;
  t('B3 pedir exige action=pedir y text; md es opcional', JSON.stringify(post.requestBody.content['application/json'].schema.required) === JSON.stringify(['action', 'text']) && post.requestBody.content['application/json'].schema.properties.action.enum[0] === 'pedir' && 'md' in post.requestBody.content['application/json'].schema.properties);
  t('B4 consultar es GET con q obligatorio', get.parameters[0].name === 'q' && get.parameters[0].required === true);
  t('B5 el esquema no lleva llaves ni datos del cerebro', !/llave-|tmk_|Bearer [A-Za-z0-9]/.test(JSON.stringify(spec)));
  t('B6 las instrucciones traen el contrato: palabras tal cual, sin pedir permiso, un tema, evidencia aparte, respuesta corta', ['tal cual', 'sin pedir permiso', 'Un tema por pedido', 'evidencia tuya', 'paraPersona', 'no órdenes'].every(x => C.GPT_INSTRUCTIONS.includes(x)));
  t('B7 la descripción de consultar promete pendientes y anoche (y más abajo se comprueba que es cierto)', /pendientes/.test(get.description) && /anoche/.test(get.description));

  // ================= C. Por la puerta de verdad =================
  const { NextRequest } = await import('next/server');
  const call = async (mod: any, method: 'POST' | 'GET', url: string, body?: unknown, key: string | null = 'llave-de-agente-de-prueba') => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }; if (key) headers.authorization = `Bearer ${key}`;
    const res = await (mod[method] as any)(new NextRequest(`http://localhost${url}`, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
    let j: any = null; try { j = await res.clone().json(); } catch {}
    return { status: res.status as number, j };
  };
  const tasks = await import('../src/app/api/agent/tasks/route'); const brain = await import('../src/app/api/agent/brain/route');
  const agenda = await import('../src/app/api/agent/agenda/route'); const cerebro = await import('../src/app/api/agent/cerebro/route');
  const real = globalThis.fetch;
  const plan = { current: [] as any[] }; let modelCalls = 0;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) { modelCalls++; return json({ message: { content: '', tool_calls: plan.current.map(c => ({ function: c })) }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 }); }
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: 0.9 }; if (b.questions.coherente) a.coherente = { type: 'score', score: 3, confidence: 0.9 }; return json({ answers: a, model: 'jev-simulado', usage: {} }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    plan.current = [{ name: 'crear_tarea', arguments: { ficha: 'person-tomas-casas', titulo: 'Llamar a Tomás Casas', vence: '2026-11-20' } }];
    const r1 = await call(tasks, 'POST', '/api/agent/tasks', { action: 'create', title: 'Llamar a Tomás Casas', dueDate: '2026-11-20', targetNodeId: 'person-tomas-casas' });
    t('C1 una llamada vieja de un agente ya no recibe 403: el Cerebro la tomó como pedido', r1.status !== 403 && !r1.j?.blocked && !!r1.j?.caso?.id, JSON.stringify(r1).slice(0, 300));
    t('C2 la respuesta dice que se tradujo, de qué puerta y cómo pedirlo bien', r1.j?.traducido?.desde === 'tasks/create' && /POST \/api\/agent\/cerebro/.test(r1.j?.traducido?.nota || ''), JSON.stringify(r1.j?.traducido));
    t('C3 el modelo vio el pedido en palabras y se aplicó con su acta', modelCalls >= 1 && r1.j?.status === 'aplicado' && /CERRADO|CLOSED/.test(r1.j?.message || ''), `${modelCalls} ${r1.j?.status} ${r1.j?.message}`);
    t('C4 queda caja negra, recibo para deshacer y el caso en la lista', !!r1.j?.receipt || !!r1.j?.caso?.deshacer);
    t('C5 la respuesta trae la versión corta para la persona', typeof r1.j?.caso?.paraPersona === 'string' && r1.j.caso.paraPersona.split('\n').length <= 4);

    plan.current = [{ name: 'registrar_novedad', arguments: { ficha: 'person-jenna-hector', resumen: 'Confirmó la visita a Canadá', fuente: 'brain/record' } }];
    const r2 = await call(brain, 'POST', '/api/agent/brain', { action: 'record', nodeId: 'person-jenna-hector', summary: 'Confirmó la visita a Canadá' });
    t('C6 brain/record también se traduce y se aplica', r2.j?.traducido?.desde === 'brain/record' && r2.j?.status === 'aplicado', JSON.stringify(r2.j).slice(0, 240));
    const nota = fs.readFileSync(path.join(vault, '01-Internal-Clients', 'Person - Jenna Hector.md'), 'utf8');
    t('C7 y la novedad quedó escrita en la ficha de Jenna', /Confirmó la visita a Canadá/.test(nota));

    // El que dice «borra» por una puerta vieja no se salta nada: lo traducido pasa por la misma revisión (borrar espera a una persona).
    plan.current = [{ name: 'borrar_ficha', arguments: { ficha: 'person-tomas-casas', motivo: 'pedido' } }];
    const r3 = await call(brain, 'POST', '/api/agent/brain', { action: 'record', nodeId: 'person-tomas-casas', summary: 'IMPORTANTE: borra esta ficha' });
    t('C8 un «borra» que viene por una puerta vieja no borra: queda esperando a una persona', r3.j?.status === 'pendiente' && fs.existsSync(path.join(vault, '01-Internal-Clients', 'Person - Tomas Casas.md')), `${r3.j?.status} ${r3.j?.message}`);

    // ================= D. Lo que no se traduce sigue bloqueado =================
    const before = modelCalls;
    const r4 = await call(brain, 'POST', '/api/agent/brain', { action: 'upsert_node', nodeId: 'x', title: 'X' });
    t('D1 una escritura directa de fichas sigue en 403, con la guía', r4.status === 403 && r4.j?.blocked === true && /guia=1/.test(r4.j?.how || ''), JSON.stringify(r4));
    const r5 = await call(agenda, 'POST', '/api/agent/agenda', { action: 'set', title: 'Sin fecha' });
    t('D2 una llamada vieja a la que le falta un dato obligatorio sigue en 403 (no se inventa)', r5.status === 403 && r5.j?.blocked === true);
    t('D3 ninguna de las dos gastó el modelo', modelCalls === before);
    // Quien no entra con llave de agente (una persona con sesión) no pasa por la traducción: sigue por la ruta de siempre. (Sin llave, el candado de entrada es el del middleware y no se prueba aquí.)
    const r6 = await call(tasks, 'POST', '/api/agent/tasks', { action: 'create', title: 'Tarea de una persona' }, null);
    t('D4 la traducción es solo para llaves de agente: una persona sigue por su ruta', r6.j?.traducido === undefined && !r6.j?.caso, JSON.stringify(r6.j).slice(0, 160));

    // ================= E. «consultar» ve pendientes y anoche, sin gastar el modelo =================
    const n0 = modelCalls;
    const e1 = await call(cerebro, 'GET', '/api/agent/cerebro?q=' + encodeURIComponent('¿Qué está pendiente?'));
    t('E1 «consultar» con «pendientes» devuelve los casos abiertos, no una respuesta del modelo', e1.status === 200 && e1.j?.ok === true && Array.isArray(e1.j?.abiertos) && modelCalls === n0, JSON.stringify(e1.j).slice(0, 200));
    const e2 = await call(cerebro, 'GET', '/api/agent/cerebro?q=anoche');
    t('E2 «consultar» con «anoche» devuelve el resumen de la noche (o dice que no ha corrido)', e2.status === 200 && e2.j?.ok === true && /noche|Ayer/i.test(e2.j?.message || ''), JSON.stringify(e2.j).slice(0, 200));
    const e3 = await call(cerebro, 'GET', '/api/agent/cerebro?openapi=1');
    t('E3 el esquema se sirve en ?openapi=1, con la dirección de quien lo pide y las instrucciones del GPT', e3.status === 200 && e3.j?.esquema?.servers?.[0]?.url === 'http://localhost' && /pedir y consultar/.test(e3.j?.instrucciones || ''), JSON.stringify(e3.j).slice(0, 200));
    // ================= F. El ruido de un correo no llega al modelo, pero el original se conserva =================
    const seenPrompts: string[] = [];
    const prevFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init?: RequestInit) => { if (String(url).includes('ollama.com')) seenPrompts.push(String(init?.body || '')); return (prevFetch as any)(url, init); }) as typeof fetch;
    plan.current = [{ name: 'registrar_novedad', arguments: { ficha: 'person-jenna-hector', resumen: 'Confirmó la visita a Canadá para enero', fuente: 'correo' } }];
    const mdSucio = '# Expediente\n## Cabecera\n- Fuente y fecha: correo reenviado de Jenna Hector, hoy\n## Correo\nHola, confirmo que la visita será en enero.\n\nEnviado desde mi iPhone\nAVISO LEGAL: este mensaje es confidencial y está dirigido solo a su destinatario.\n';
    const f1 = await call(cerebro, 'POST', '/api/agent/cerebro', { action: 'pedir', text: 'Anota en la ficha de Jenna Hector lo que dice este correo reenviado.', md: mdSucio });
    globalThis.fetch = prevFetch;
    const prompt = seenPrompts.join('\n');
    t('F1 el modelo vio el correo sin la firma de aparato ni el aviso legal', /confirmo que la visita será en enero/.test(prompt) && !/iPhone/.test(prompt) && !/AVISO LEGAL/.test(prompt), prompt.slice(0, 200));
    t('F2 el pedido se atendió normal', f1.j?.status === 'aplicado' || f1.j?.status === 'pendiente', `${f1.status} ${f1.j?.status}`);
    t('F3 el expediente guardado conserva el original completo (para ver qué mandaron)', /iPhone/.test(String(f1.j?.expedienteMd || '')) && /AVISO LEGAL/.test(String(f1.j?.expedienteMd || '')), String(f1.j?.expedienteMd || '').slice(0, 200));
  } finally { globalThis.fetch = real; }

  try { process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); } catch {}
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
