/**
 * Etapa 5.2: origen del dato. Cada dato y cada conexión que el Cerebro escribe lleva de dónde viene (quién lo dijo, cuándo, qué clase de fuente),
 * y verificar deja de ser todo o nada. Bóveda temporal con tres fichas reales copiadas; modelo y Jev simulados; sin red.
 *   A. Funciones puras (origin.ts).  B. Operaciones: validar, escribir, describir.  C. Verificación por campo en la revisión.
 *   D. Lectura: la ficha y las consultas muestran el origen.  E. Integración: pedir() completo con el caso de Pierre.
 * Uso: npx tsx scripts/test-origen.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'origen-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true }); fs.mkdirSync(path.join(vault, '02-External-Clients'), { recursive: true });
  for (const f of ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md']) fs.copyFileSync(path.join(REPO, f), path.join(vault, f));
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  // upsertNode copia cada ficha nueva a <cwd>/vault (la bóveda empaquetada del repo). Con el directorio de trabajo en la carpeta temporal esa copia
  // cae en el mismo archivo y no ensucia el repo (REPO ya se calculó arriba).
  process.chdir(root);
  const Org = await import('../src/lib/cerebro/origin');
  const O = await import('../src/lib/cerebro/ops');
  const R = await import('../src/lib/cerebro/review');
  const E = await import('../src/lib/cerebro/engine');
  const L = await import('../src/lib/brainLens');
  const { readNoteStrict } = await import('../src/lib/vaultFiles');
  const fmOf = (rel: string) => (readNoteStrict(path.join(vault, rel)) as any).frontmatter as Record<string, any>;
  const HUMBERTO = '01-Internal-Clients/Person - Humberto Bouche.md', TOMAS = '01-Internal-Clients/Person - Tomas Casas.md', PIERRE = '01-Internal-Clients/Person - Pierre Canavaggio.md';
  const S = { por: 'Cerebro (HB)', at: '2026-11-15T10:00:00.000Z' };

  // ================= A. Funciones puras =================
  t('A1 clases válidas y vacío se aceptan', Org.checkOrigin({ clase: 'persona', fuente: 'según HB' }) === null && Org.checkOrigin({}) === null && Org.checkOrigin({ clase: 'publicado' }) === null && Org.checkOrigin({ clase: 'documento' }) === null && Org.checkOrigin({ clase: 'inferido' }) === null);
  t('A2 «verificado» no se puede poner por esta vía', /marcar_verificado/.test(String(Org.checkOrigin({ clase: 'verificado' }))));
  t('A3 una clase inventada se rechaza', /debe ser una de/.test(String(Org.checkOrigin({ clase: 'rumor' }))));
  t('A4 una fuente muy larga o que no es texto se rechaza', Org.checkOrigin({ fuente: 'x'.repeat(301) }) !== null && Org.checkOrigin({ fuente: 42 }) !== null);
  const fm: Record<string, any> = { job_title: 'Dueño', email_primary: 'a@b.c', phone_mobile: '+507 1' };
  Org.stampFields(fm, ['job_title'], { clase: 'persona', fuente: '  según HB  ', ...S });
  t('A5 se anota quién, cuándo y clase, y la fuente sin espacios sobrantes', JSON.stringify(fm.field_sources.job_title) === JSON.stringify({ clase: 'persona', fuente: 'según HB', por: S.por, at: S.at }), JSON.stringify(fm.field_sources));
  Org.stampFields(fm, ['email_primary'], { ...S });
  t('A6 sin clase queda «sin_clasificar» y sin fuente no inventa una', fm.field_sources.email_primary.clase === 'sin_clasificar' && !('fuente' in fm.field_sources.email_primary));
  t('A7 los campos que no se tocaron no se anotan', !('phone_mobile' in fm.field_sources));
  Org.stampFields(fm, ['x'], { clase: 'persona', fuente: 'y'.repeat(500), ...S }); t('A8 la fuente se corta a 300', fm.field_sources.x.fuente.length === 300);
  Org.stampFields(fm, [], S); t('A9 sin campos no hace nada', Object.keys(fm.field_sources).length === 3);
  const r1 = Org.markFieldsVerified(fm, ['job_title', 'no_existe'], { fuente: 'contrato', por: 'HB', at: '2026-11-16T00:00:00Z' });
  t('A10 verifica lo que existe y dice lo que falta', JSON.stringify(r1) === JSON.stringify({ hechos: ['job_title'], faltan: ['no_existe'] }));
  t('A11 la verificación recuerda la clase y la fuente de antes', fm.field_sources.job_title.clase === 'verificado' && fm.field_sources.job_title.clase_previa === 'persona' && fm.field_sources.job_title.fuente === 'según HB' && fm.field_sources.job_title.fuente_verificacion === 'contrato' && fm.field_sources.job_title.verificado_por === 'HB');
  t('A12 verificar un campo no verifica la ficha ni los demás', !('verification_status' in fm) && !Org.isFieldVerified(fm, 'email_primary') && Org.isFieldVerified(fm, 'job_title') && Org.hasFieldVerification(fm));
  Org.stampFields(fm, ['job_title'], { clase: 'persona', fuente: 'otro valor', ...S });
  t('A13 volver a escribir un campo verificado le quita la verificación (el valor nuevo no es el que se verificó)', !Org.isFieldVerified(fm, 'job_title') && !Org.hasFieldVerification(fm));
  const empty: Record<string, any> = {}; Org.markFieldsVerified(empty, ['nada'], { fuente: 'x', por: 'p', at: 'a' }); t('A14 verificar solo campos inexistentes no deja basura', !('field_sources' in empty));
  const rel: Record<string, any> = {}; Org.stampRelation(rel, 'owner_of', '[[Distributor - MEDIMEX]]', { clase: 'persona', fuente: 'lo dijo HB', ...S });
  t('A15 se anota el origen de una conexión', rel.relation_sources.owner_of['[[Distributor - MEDIMEX]]'].clase === 'persona');
  Org.stampRelation(rel, 'owner_of', '[[Distributor - Otra]]', S); Org.dropRelationSource(rel, 'owner_of', '[[Distributor - MEDIMEX]]');
  t('A16 al desconectar se quita solo ese origen', !('[[Distributor - MEDIMEX]]' in rel.relation_sources.owner_of) && '[[Distributor - Otra]]' in rel.relation_sources.owner_of);
  Org.dropRelationSource(rel, 'owner_of', '[[Distributor - Otra]]'); t('A17 y si no queda nada, se limpia todo', !('relation_sources' in rel));
  t('A18 el texto del origen, en español e inglés', Org.originText({ clase: 'persona', fuente: 'según HB', at: '2026-11-15T10:00:00Z' }) === 'lo dijo una persona — según HB (2026-11-15)' && Org.originText({ clase: 'publicado', at: '2026-11-15T10:00:00Z' }, 'en') === 'published (2026-11-15)');
  t('A19 un dato verificado muestra quién y cuándo lo verificó', /verificado — contrato \(2026-11-16\)/.test(Org.originText({ clase: 'verificado', fuente: 'según HB', at: '2026-11-15T10:00:00Z', verificado_el: '2026-11-16T00:00:00Z', fuente_verificacion: 'contrato' })));
  t('A20 sin registro no se inventa texto', Org.originText(null) === '' && Org.stampText({}) === '');
  t('A21 el origen de una operación en palabras cortas', Org.stampText({ clase: 'persona', fuente: 'según HB' }) === 'lo dijo una persona — según HB' && Org.stampText({ clase: 'publicado' }) === 'publicado');
  const all = Org.originsOf({ field_sources: { job_title: { clase: 'persona', fuente: 'según HB', por: 'p', at: '2026-11-15T00:00:00Z' } }, relation_sources: { owner_of: { '[[Distributor - MEDIMEX]]': { clase: 'persona', por: 'p', at: '2026-11-15T00:00:00Z' } } } });
  t('A22 todo el origen de una ficha, ordenado', all.campos.job_title === 'lo dijo una persona — según HB (2026-11-15)' && all.relaciones['owner_of → Distributor - MEDIMEX'] === 'lo dijo una persona (2026-11-15)', JSON.stringify(all));
  t('A23 una ficha sin origen da vacío', Object.keys(Org.originsOf({}).campos).length === 0);

  // ================= B. Operaciones =================
  const v = (name: string, args: Record<string, any>) => O.validateOp({ name, args });
  t('B1 clase «verificado» se rechaza en las tres operaciones que escriben', ['actualizar_campos', 'crear_ficha', 'conectar'].every(n => /marcar_verificado/.test(String(v(n, n === 'actualizar_campos' ? { ficha: 'person-humberto-bouche', campos: { job_title: 'x' }, clase: 'verificado' } : n === 'crear_ficha' ? { tipo: 'person', nombre: 'Zed Prueba', clase: 'verificado' } : { desde: 'person-tomas-casas', hacia: 'person-humberto-bouche', relacion: 'related_to', clase: 'verificado' })))));
  t('B2 clase inventada y fuente enorme se rechazan', /debe ser una de/.test(String(v('actualizar_campos', { ficha: 'person-humberto-bouche', campos: { job_title: 'x' }, clase: 'rumor' }))) && /300/.test(String(v('actualizar_campos', { ficha: 'person-humberto-bouche', campos: { job_title: 'x' }, fuente: 'x'.repeat(400) }))));
  t('B3 con clase persona y fuente se acepta', v('actualizar_campos', { ficha: 'person-humberto-bouche', campos: { job_title: 'x' }, clase: 'persona', fuente: 'según HB' }) === null);
  t('B4 los campos de origen no se pueden escribir como dato (falsificar un origen)', /no se pueden cambiar/.test(String(v('actualizar_campos', { ficha: 'person-humberto-bouche', campos: { field_sources: { job_title: { clase: 'verificado' } } } }))) && /no se pueden cambiar/.test(String(v('actualizar_campos', { ficha: 'person-humberto-bouche', campos: { relation_sources: {} } }))));
  t('B5 las herramientas del modelo traen «clase» y «fuente» en las tres operaciones y «campos_verificados» como lista', (() => { const d = O.toolDefs(); const p = (n: string) => (d.find(x => x.function.name === n)!.function.parameters as any).properties; return ['actualizar_campos', 'crear_ficha', 'conectar'].every(n => p(n).clase && p(n).fuente) && p('marcar_verificado').campos_verificados.type === 'array' && /persona = lo dijo una persona/.test(p('conectar').clase.description) && !/verificado =/.test(p('conectar').clase.description); })());

  O.executeOp({ name: 'actualizar_campos', args: { ficha: 'person-humberto-bouche', campos: { job_title: 'Distribution Manager, International Exports' }, clase: 'persona', fuente: 'según HB, 2026-11-15' } });
  let h = fmOf(HUMBERTO);
  t('B6 actualizar_campos deja el origen del campo escrito (y no de los demás)', h.field_sources?.job_title?.clase === 'persona' && h.field_sources.job_title.fuente === 'según HB, 2026-11-15' && /^Cerebro/.test(h.field_sources.job_title.por) && !!h.field_sources.job_title.at && !('phone_mobile' in h.field_sources), JSON.stringify(h.field_sources));
  O.executeOp({ name: 'actualizar_campos', args: { ficha: 'person-humberto-bouche', campos: { phone_mobile: '+507-6000-0000' } } });
  h = fmOf(HUMBERTO); t('B7 sin clase queda «sin_clasificar», con quién y cuándo (trazabilidad aunque nadie diga de dónde sale)', h.field_sources.phone_mobile.clase === 'sin_clasificar' && !!h.field_sources.phone_mobile.por && !!h.field_sources.phone_mobile.at);
  t('B8 el origen no se mezcló con la vista normal: el campo sigue con su valor', h.job_title === 'Distribution Manager, International Exports' && h.phone_mobile === '+507-6000-0000');

  // crear_ficha con el caso de Pierre: dueño según HB; correo publicado
  const pierreOp = { tipo: 'person', nombre: 'Pierre Canavaggio', campos: { email_primary: 'pcanavaggio@medimex.com' }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB, sin fuente pública' };
  t('B9 la ficha de Pierre es válida: dueño de MEDIMEX es persona → distribuidor', v('crear_ficha', pierreOp) === null, String(v('crear_ficha', pierreOp)));
  O.executeOp({ name: 'crear_ficha', args: pierreOp });
  const p = fmOf(PIERRE);
  t('B10 nace con el origen de cada dato', p.field_sources?.email_primary?.clase === 'persona' && p.field_sources.email_primary.fuente === 'según HB, sin fuente pública', JSON.stringify(p.field_sources));
  t('B11 y con el origen de cada conexión, incluido «dueño según HB»', p.relation_sources?.owner_of?.['[[Distributor - MEDIMEX]]']?.clase === 'persona' && JSON.stringify(p.relations?.owner_of || []).includes('MEDIMEX') && !!p.relation_sources.coordinates_with, JSON.stringify(p.relation_sources));
  O.executeOp({ name: 'conectar', args: { desde: 'person-pierre-canavaggio', hacia: 'dist-medimex', relacion: 'key_person_of', clase: 'documento', fuente: 'correo de MEDIMEX de hoy' } });
  O.executeOp({ name: 'conectar', args: { desde: 'person-pierre-canavaggio', hacia: 'dist-medimex', relacion: 'key_person_of' } });
  let pc = fmOf(PIERRE);
  t('B12 conectar de nuevo sin decir de dónde sale NO pisa el origen que ya tenía', pc.relation_sources.key_person_of['[[Distributor - MEDIMEX]]'].clase === 'documento' && pc.relation_sources.key_person_of['[[Distributor - MEDIMEX]]'].fuente === 'correo de MEDIMEX de hoy');
  O.executeOp({ name: 'conectar', args: { desde: 'person-pierre-canavaggio', hacia: 'dist-medimex', relacion: 'key_person_of', clase: 'persona', fuente: 'lo dijo HB' } });
  pc = fmOf(PIERRE); t('B13 conectar de nuevo diciendo el origen sí lo actualiza', pc.relation_sources.key_person_of['[[Distributor - MEDIMEX]]'].clase === 'persona');
  O.executeOp({ name: 'desconectar', args: { desde: 'person-pierre-canavaggio', hacia: 'dist-medimex', relacion: 'key_person_of' } });
  pc = fmOf(PIERRE); t('B14 desconectar quita la conexión y su origen', !pc.relations?.key_person_of && !pc.relation_sources?.key_person_of);
  t('B15 con un nombre viejo de relación el origen queda bajo el nombre vigente', (() => { O.executeOp({ name: 'conectar', args: { desde: 'person-tomas-casas', hacia: 'dist-medimex', relacion: 'belongs_to_market', clase: 'documento', fuente: 'ficha vieja' } }); const x = fmOf(TOMAS); return !!x.relation_sources?.operates_in_market && !x.relation_sources?.belongs_to_market; })());

  // Descripción en el plan, el recibo y la bandeja de aprobación
  const d1 = O.describeOp({ name: 'actualizar_campos', args: { ficha: 'person-humberto-bouche', campos: { job_title: 'X' }, clase: 'persona', fuente: 'según HB' } });
  t('B16 el plan dice de dónde sale lo que se va a escribir', /· origen: lo dijo una persona — según HB$/.test(d1), d1);
  t('B17 también al conectar y al crear una ficha', /· origen: lo dijo una persona — según HB/.test(O.describeOp({ name: 'conectar', args: { desde: 'a', hacia: 'b', relacion: 'owner_of', clase: 'persona', fuente: 'según HB' } })) && /· origen: lo dijo una persona/.test(O.describeOp({ name: 'crear_ficha', args: pierreOp })));
  t('B18 sin origen, el plan se ve como siempre', !/origen/.test(O.describeOp({ name: 'actualizar_campos', args: { ficha: 'person-humberto-bouche', campos: { job_title: 'X' } } })));

  // Verificar solo algunos datos
  t('B19 verificar un campo que la ficha no tiene se rechaza', /no tiene el dato nada_aqui/.test(String(v('marcar_verificado', { ficha: 'person-humberto-bouche', fuente: 'contrato', campos_verificados: ['nada_aqui'] }))));
  t('B20 la lista debe ser una lista de campos no protegidos', /lista de 1 a 30/.test(String(v('marcar_verificado', { ficha: 'person-humberto-bouche', fuente: 'x', campos_verificados: 'job_title' }))) && /lista de 1 a 30/.test(String(v('marcar_verificado', { ficha: 'person-humberto-bouche', fuente: 'x', campos_verificados: ['owner'] }))) && /lista de 1 a 30/.test(String(v('marcar_verificado', { ficha: 'person-humberto-bouche', fuente: 'x', campos_verificados: [] }))));
  t('B21 con campos existentes es válido y sigue siendo delicado (lo aprueba una persona)', v('marcar_verificado', { ficha: 'person-humberto-bouche', fuente: 'contrato', campos_verificados: ['job_title', 'email_primary'] }) === null && O.levelOf({ name: 'marcar_verificado', args: {} }) === 'aprobar');
  t('B22 el plan dice que SOLO esos datos y que la ficha no queda verificada', /SOLO los datos job_title, email_primary[\s\S]*no queda verificada en su totalidad/.test(O.describeOp({ name: 'marcar_verificado', args: { ficha: 'person-humberto-bouche', fuente: 'contrato', campos_verificados: ['job_title', 'email_primary'] } })));
  const statusBefore = fmOf(HUMBERTO).verification_status;
  const out = O.executeOp({ name: 'marcar_verificado', args: { ficha: 'person-humberto-bouche', fuente: 'contrato firmado', campos_verificados: ['job_title', 'email_primary'] } });
  h = fmOf(HUMBERTO);
  t('B23 quedan verificados esos dos datos, con quién, cuándo y contra qué', h.field_sources.job_title.clase === 'verificado' && h.field_sources.email_primary.clase === 'verificado' && h.field_sources.job_title.fuente_verificacion === 'contrato firmado' && h.field_sources.job_title.clase_previa === 'persona');
  t('B24 la ficha NO queda verificada en su totalidad ni cambia su estado', h.verification_status === statusBefore && !h.verified_at && !h.verified_by, JSON.stringify([h.verification_status, h.verified_at]));
  t('B25 y el teléfono (no verificado) sigue sin verificar', !Org.isFieldVerified(h, 'phone_mobile') && /no queda verificada en su totalidad/.test(out));
  O.executeOp({ name: 'marcar_verificado', args: { ficha: 'person-tomas-casas', fuente: 'confirmación de HB' } });
  const tm = fmOf(TOMAS); t('B26 sin «campos_verificados» verificar sigue siendo de la ficha completa (como siempre)', tm.verification_status === 'verified' && !!tm.verified_at && !tm.field_sources?.organization);

  // ================= C. La revisión distingue datos verificados =================
  const upd = (ficha: string, campos: Record<string, string>) => [{ name: 'actualizar_campos', args: { ficha, campos } }];
  let o = R.inspectPlan(upd('person-humberto-bouche', { job_title: 'Otro cargo' }), [], 'cambia el cargo');
  t('C1 cambiar un dato verificado frena y lo dice', o.fuertes.some(x => /Cambia datos VERIFICADOS/.test(x) && /job_title/.test(x)), JSON.stringify(o.fuertes));
  o = R.inspectPlan(upd('person-humberto-bouche', { phone_mobile: '+507-1111-1111' }), [], 'cambia el teléfono');
  t('C2 cambiar un dato NO verificado de la misma ficha no frena por verificación (antes sí, si la ficha estaba verificada)', !o.fuertes.some(x => /VERIFICAD/.test(x)), JSON.stringify(o.fuertes));
  o = R.inspectPlan(upd('person-humberto-bouche', { phone_mobile: '+507-1111-1111', job_title: 'Otro' }), [], 'cambia');
  t('C3 si cambia uno verificado y uno no, solo el verificado se menciona', o.fuertes.some(x => /job_title/.test(x) && !/phone_mobile/.test(x)));
  o = R.inspectPlan(upd('person-tomas-casas', { organization: '[[otra]]' }), [], 'cambia la empresa');
  t('C4 una ficha verificada completa (sin verificación por campo) frena como siempre', o.fuertes.some(x => /Cambia datos de una ficha VERIFICADA/.test(x)), JSON.stringify(o.fuertes));
  o = R.inspectPlan(upd('person-humberto-bouche', { job_title: 'Distribution Manager, International Exports' }), [], 'mismo valor');
  t('C5 escribir el mismo valor no cambia nada y no frena', !o.fuertes.some(x => /VERIFICAD/.test(x)));

  // ================= D. Lectura =================
  const ctx: any = L.nodeContext('person-pierre-canavaggio');
  t('D1 la ficha muestra el origen de cada dato y cada conexión', ctx?.origins?.campos?.email_primary === 'lo dijo una persona — según HB, sin fuente pública (' + new Date().toISOString().slice(0, 10) + ')' && /owner_of → Distributor - MEDIMEX/.test(Object.keys(ctx?.origins?.relaciones || {}).join('|')), JSON.stringify(ctx?.origins));
  t('D2 los registros crudos no ensucian la vista normal de datos', ctx && !('field_sources' in ctx.node.frontmatter) && !('relation_sources' in ctx.node.frontmatter) && ctx.node.frontmatter.email_primary === 'pcanavaggio@medimex.com');
  const hb: any = L.nodeContext('person-humberto-bouche');
  t('D3 un dato verificado se muestra como verificado, con la fuente', /^verificado — contrato firmado/.test(hb.origins.campos.job_title), JSON.stringify(hb.origins.campos));
  const dos: any = L.dossier({ q: 'MEDIMEX', size: 'completo' });
  const card = (dos.contacts || []).find((c: any) => /Pierre/.test(c.name));
  t('D4 en una consulta, el contacto trae el origen de su correo', !!card?.origen && /según HB/.test(JSON.stringify(card.origen)), JSON.stringify(card));
  t('D5 y de dónde sale que es dueño de MEDIMEX', /según HB/.test(String(card?.relationOrigen || '')) && /owner of/.test(String(card?.relation || '')), JSON.stringify(card));

  // ================= E. Integración: pedir() completo, el caso de Pierre =================
  const real = globalThis.fetch; const seen: { state: string }[] = [];
  const pierre2 = { tipo: 'person', nombre: 'Luc Prueba', campos: { email_primary: 'luc@medimex.com' }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB, lo sé yo' };
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) return json({ message: { content: '', tool_calls: [{ function: { name: 'crear_ficha', arguments: pierre2 } }] }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 });
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); seen.push({ state: String(b.state) }); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: 0.9 }; if (b.questions.coherente) a.coherente = { type: 'score', score: 1, confidence: 0.9 }; return json({ answers: a, model: 'jev-simulado', usage: {} }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    const rec: any = await E.pedir({ text: 'Crea el contacto de Luc Prueba, dueño de MEDIMEX. Lo sé yo, no hay fuente pública.' });
    t('E1 el pedido se aplica de una (ficha nueva completa)', rec.status === 'aplicado', `${rec.status} ${rec.why || rec.message}`);
    t('E2 el plan que ve quien aprueba y el recibo dicen el origen', (rec.plan || []).some((x: string) => /· origen: lo dijo una persona — según HB, lo sé yo/.test(x)), JSON.stringify(rec.plan));
    const lucFile = '01-Internal-Clients/Person - Luc Prueba.md'; const luc = fs.existsSync(path.join(vault, lucFile)) ? fmOf(lucFile) : {};
    t('E3 la ficha quedó con dueño según HB y correo con su origen', luc.field_sources?.email_primary?.clase === 'persona' && luc.relation_sources?.owner_of?.['[[Distributor - MEDIMEX]]']?.fuente === 'según HB, lo sé yo' && JSON.stringify(luc.relations?.owner_of || []).includes('MEDIMEX'), JSON.stringify([luc.field_sources, luc.relation_sources]));
    t('E4 Jev vio el origen en el plan (puede juzgar si lo dicho por HB es creíble)', seen.some(s => /origen: lo dijo una persona — según HB, lo sé yo/.test(s.state)));
    const dos2: any = L.dossier({ q: 'MEDIMEX', size: 'completo' }); const c2 = (dos2.contacts || []).find((c: any) => /Luc/.test(c.name));
    t('E5 y una consulta posterior lo devuelve con su origen', /según HB/.test(JSON.stringify(c2?.origen || '')) && /según HB/.test(String(c2?.relationOrigen || '')), JSON.stringify(c2));
    t('F1 la prueba no dejó fichas en la bóveda real del repo', !fs.existsSync(path.join(REPO, '01-Internal-Clients', 'Person - Pierre Canavaggio.md')) && !fs.existsSync(path.join(REPO, '01-Internal-Clients', 'Person - Luc Prueba.md')));
  } finally { globalThis.fetch = real; process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); }
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
