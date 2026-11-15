/**
 * Etapa 5.3: vecindario. El modelo recibe, de cada ficha reconocida, su entorno a un paso; y una persona conectada a una empresa HEREDA
 * su mercado y sus marcas al leer (sin que nadie copie enlaces). Qué se hereda lo dice el archivo de estructura (`derives`).
 *   A. Reglas de herencia en la estructura.  B. Herencia y tarjetas.  C. Lectura (ficha y consultas).  D. pedir() entrega el vecindario al modelo.
 * Bóveda temporal con fichas reales copiadas; modelo y Jev simulados; sin red. Uso: npx tsx scripts/test-vecindario.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vecindario-'));
  const vault = path.join(root, 'vault');
  const FILES = ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md', '02-External-Clients/Market - Panama.md', '03-Portfolio-Supply/Brand - Chubby.md', '03-Portfolio-Supply/Brand - Fruta.md', '03-Portfolio-Supply/Brand - Busta.md'];
  for (const f of FILES) { fs.mkdirSync(path.dirname(path.join(vault, f)), { recursive: true }); fs.copyFileSync(path.join(REPO, f), path.join(vault, f)); }
  process.env.SMJ_VAULT_PATH = vault; process.env.OLLAMA_API_KEY = 'llave-ollama-de-prueba'; process.env.TYPESAFE_API_KEY = 'llave-jev-de-prueba';
  process.chdir(root); // upsertNode copia lo nuevo a <cwd>/vault: con cwd aquí no ensucia el repo
  const S = await import('../src/lib/cerebro/structure');
  const N = await import('../src/lib/cerebro/neighborhood');
  const O = await import('../src/lib/cerebro/ops');
  const E = await import('../src/lib/cerebro/engine');
  const L = await import('../src/lib/brainLens');
  const { serializeNote, readNoteStrict } = await import('../src/lib/vaultFiles');
  const fmOf = (rel: string) => (readNoteStrict(path.join(vault, rel)) as any).frontmatter as Record<string, any>;
  const writeNote = (rel: string, fm: Record<string, any>, body = '') => { const f = path.join(vault, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, serializeNote(fm, body), 'utf-8'); };
  const shipped = YAML.parse(fs.readFileSync(path.join(REPO, '00-System', 'estructura.yaml'), 'utf8')); const clone = () => structuredClone(shipped) as any;
  const structFile = path.join(vault, '00-System', 'estructura.yaml');
  const writeStruct = (o: unknown) => { fs.mkdirSync(path.dirname(structFile), { recursive: true }); fs.writeFileSync(structFile, YAML.stringify(o)); S.resetStructureCache(); };
  const names = (it?: { nombre: string }[]) => (it || []).map(x => x.nombre).sort();

  // ================= A. Reglas de herencia en la estructura =================
  const D = S.DEFAULT_STRUCTURE;
  t('A1 cada relación trae su «inverse» (cómo se llama quien la escribe, visto desde el otro lado)', Object.entries(D.relations).every(([, r]) => typeof r.inverse === 'string' && r.inverse.length > 0) && D.relations.owner_of.inverse === 'dueño' && D.relations.key_person_of.inverse === 'persona clave');
  t('A2 la regla por defecto: persona → empresa hereda mercados y marcas', D.derives.length === 1 && JSON.stringify(D.derives[0].from) === '["person"]' && D.derives[0].through.includes('owner_of') && D.derives[0].take.mercados.type === 'market' && D.derives[0].take.marcas.type === 'brand');
  t('A3 no cuentan «references» ni «signature_company»', !D.derives[0].through.includes('references') && !D.derives[0].through.includes('signature_company'));
  const rt = S.validateStructure(shipped); t('A4 el archivo del repo es válido y sigue igual al código', rt.ok && S.sameAsDefault(rt.s));
  const no = (name: string, mut: (o: any) => void, re: RegExp) => { const o = clone(); mut(o); const r = S.validateStructure(o); t(name, !r.ok && (r as any).errors.some((e: string) => re.test(e)), JSON.stringify((r as any).errors)); };
  no('A5 rechaza una regla desde un tipo que no existe', o => { o.derives[0].from = ['fantasma']; }, /«from» nombra tipos que no existen/);
  no('A6 rechaza una regla sin relaciones de enlace', o => { o.derives[0].through = []; }, /«through» debe ser una lista de nombres de relación/);
  no('A7 rechaza un nombre de relación con mayúsculas', o => { o.derives[0].through = ['Works_At']; }, /«through»/);
  no('A8 rechaza un grupo hacia un tipo que no existe', o => { o.derives[0].take.mercados.type = 'fantasma'; }, /necesita un «type» que exista/);
  no('A9 rechaza una regla sin nada que heredar', o => { o.derives[0].take = {}; }, /«take» debe ser un objeto de 1 a 8 grupos/);
  no('A10 rechaza «derives» que no es una lista', o => { o.derives = 'sí'; }, /«derives» debe ser una lista/);
  no('A11 rechaza demasiadas reglas', o => { o.derives = Array.from({ length: 21 }, () => clone().derives[0]); }, /Demasiadas reglas/);
  no('A12 rechaza una inversa de varias líneas, vacía o enorme', o => { o.relations.owner_of.inverse = 'a\nb'; }, /«inverse» debe ser una frase corta/);
  no('A13 rechaza una inversa vacía', o => { o.relations.owner_of.inverse = '  '; }, /«inverse»/);
  no('A14 rechaza una inversa enorme', o => { o.relations.owner_of.inverse = 'x'.repeat(61); }, /«inverse»/);
  const off = clone(); off.derives = []; const roff = S.validateStructure(off); t('A15 «derives: []» es válido y apaga la herencia', roff.ok && roff.s.derives.length === 0);
  const absent = clone(); delete absent.derives; const rab = S.validateStructure(absent); t('A16 un archivo sin «derives» usa los valores por defecto (un archivo viejo no apaga la función)', rab.ok && rab.s.derives.length === 1);
  t('A17 el bloque del modelo dice que lo heredado NO se conecta a mano', /SE HEREDA, NO SE CONECTA: person conectadas a organization\/distributor\/customer \(por works_at, contact_of, owner_of, key_person_of\) heredan de esa empresa mercados y marcas/.test(S.structureBlock()), S.structureBlock().split('\n').pop());

  // ================= B. Herencia y tarjetas =================
  t('B1 sin conexión a una empresa no hereda nada', N.deriveOf('person-humberto-bouche') === null && N.deriveOf('person-tomas-casas') === null);
  t('B2 un tipo que no está en ninguna regla no hereda', N.deriveOf('dist-medimex') === null && N.deriveOf('brand-chubby') === null);
  t('B3 una ficha que no existe da null', N.deriveOf('person-nadie') === null && N.cardOf('person-nadie') === null);
  // Pierre, como lo pidió HB: dueño de MEDIMEX según HB. Nadie le conecta mercado ni marcas.
  O.executeOp({ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Pierre Canavaggio', campos: { email_primary: 'pcanavaggio@medimex.com' }, conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }, { hacia: 'person-humberto-bouche', relacion: 'coordinates_with' }], clase: 'persona', fuente: 'según HB, sin fuente pública' } });
  const PIERRE = '01-Internal-Clients/Person - Pierre Canavaggio.md'; const pf = fmOf(PIERRE);
  t('B4 su ficha NO tiene mercado ni marcas escritos: solo dueño de MEDIMEX y la coordinación', !pf.relations?.operates_in_market && !pf.relations?.carries_brand && !pf.relations?.belongs_to_market && !!pf.relations?.owner_of, JSON.stringify(pf.relations));
  const dv = N.deriveOf('person-pierre-canavaggio');
  t('B5 pero hereda de MEDIMEX su mercado: Panamá, una sola vez (MEDIMEX lo tiene escrito con dos nombres)', JSON.stringify(names(dv?.grupos.mercados)) === '["Panama"]', JSON.stringify(dv?.grupos));
  t('B6 y sus tres marcas', JSON.stringify(names(dv?.grupos.marcas)) === '["Busta","Chubby","Fruta"]', JSON.stringify(names(dv?.grupos.marcas)));
  t('B7 diciendo a través de qué empresa y con qué relación', dv?.empresas.length === 1 && dv.empresas[0].nombre === 'MEDIMEX' && dv.empresas[0].relacion === 'owner_of' && dv.grupos.mercados[0].via === 'MEDIMEX' && dv.grupos.marcas.every(m => m.via === 'MEDIMEX'));
  const cm = N.contactosDe('dist-medimex');
  t('B8 vista desde MEDIMEX: Pierre es su dueño, según HB', cm.length === 1 && cm[0].nombre === 'Pierre Canavaggio' && cm[0].etiqueta === 'dueño' && cm[0].relacion === 'owner_of' && /según HB/.test(cm[0].origen || ''), JSON.stringify(cm));
  t('B9 Humberto coordina con MEDIMEX pero no es de sus contactos (coordinar no es estar conectado a la empresa)', !cm.some(c => c.id === 'person-humberto-bouche'));

  const card = N.cardOf('dist-medimex')!;
  const neigh = card.conexiones.map(c => `${c.sentido}|${c.id}`);
  t('B10 la tarjeta de MEDIMEX trae su mercado y sus tres marcas, cada vecino una sola vez', card.conexiones.filter(c => c.id === 'market-panama').length === 1 && ['brand-chubby', 'brand-fruta', 'brand-busta'].every(b => card.conexiones.filter(c => c.id === b).length === 1) && new Set(neigh.map(x => x.split('|')[1])).size === neigh.length, JSON.stringify(neigh));
  t('B11 Pierre va en «contactos» y no se repite en las conexiones', card.contactos.some(c => c.id === 'person-pierre-canavaggio') && !card.conexiones.some(c => c.id === 'person-pierre-canavaggio'));
  t('B12 ninguna mención automática («references») cuenta como vecindario', ![...card.conexiones, ...card.contactos].some(c => c.relacion === 'references'));
  t('B13 los datos clave son los que declara la estructura para su tipo', card.campos.some(c => c.campo === 'phone_main') && card.campos.every(c => D.types.distributor.fields.includes(c.campo)) && card.campos.length <= 6);
  const pcard = N.cardOf('person-pierre-canavaggio')!;
  t('B14 la tarjeta de Pierre trae su correo con su origen y lo heredado', pcard.campos.find(c => c.campo === 'email_primary')?.clase === 'persona' && pcard.derivado?.grupos.mercados[0].nombre === 'Panama');
  t('B15 y su conexión de dueño con su origen', pcard.conexiones.some(c => c.relacion === 'owner_of' && c.nombre === 'MEDIMEX' && /según HB/.test(c.origen || '')), JSON.stringify(pcard.conexiones));
  const txt = N.cardText(pcard);
  t('B16 en una línea para el modelo: empresa, datos con su clase, y lo que hereda y de quién', /^person-pierre-canavaggio \| Pierre Canavaggio \(person[^)]*\)/.test(txt) && /email_primary=pcanavaggio@medimex.com \[persona\]/.test(txt) && /owner_of: MEDIMEX/.test(txt) && /hereda mercados Panama, marcas [^·]*por MEDIMEX/.test(txt), txt);
  const mtxt = N.cardText(card);
  t('B17 la de MEDIMEX lista a Pierre como dueño según HB', /contactos: Pierre Canavaggio \(dueño, lo dijo una persona — según HB/.test(mtxt), mtxt);
  t('B18 una tarjeta no pasa del tope de caracteres', N.cardText(card, 200).length <= 200 && N.cardText(card, 120).length <= 120 && N.cardText(card, 120).endsWith('…'));
  t('B19 un estado de verificación largo (una frase) no ensucia la tarjeta', N.cardOf('person-tomas-casas')!.verificacion === null);

  // Nombres viejos que ya usa la bóveda, y falsos amigos
  const rel = (o: Record<string, string[]>) => ({ relations: o });
  writeNote('01-Internal-Clients/Organization - Filial Prueba.md', { id: 'org-filial-prueba', title: 'Organization: Filial Prueba', type: 'organization', memory_tier: 'long_term', ...rel({ market_jurisdiction: ['[[Market - Panama]]'], assigned_brands: ['[[Brand - Chubby]]'], sells_brands: ['[[Brand - Busta]]'] }) }, '# Filial\n');
  writeNote('01-Internal-Clients/Organization - Alias Prueba.md', { id: 'org-alias-prueba', title: 'Organization: Alias Prueba', type: 'organization', memory_tier: 'long_term', ...rel({ belongs_to_market: ['[[Market - Panama]]'], carries_brands: ['[[Brand - Fruta]]'] }) }, '# Alias\n');
  writeNote('01-Internal-Clients/Person - Ana Filial.md', { id: 'person-ana-filial', title: 'Person: Ana Filial', type: 'person', memory_tier: 'long_term', ...rel({ works_at: ['[[Organization - Filial Prueba]]'] }) }, '# Ana\n');
  writeNote('01-Internal-Clients/Person - Beto Alias.md', { id: 'person-beto-alias', title: 'Person: Beto Alias', type: 'person', memory_tier: 'long_term', ...rel({ works_at: ['[[Organization - Alias Prueba]]'] }) }, '# Beto\n');
  writeNote('01-Internal-Clients/Person - Zoe Firma.md', { id: 'person-zoe-firma', title: 'Person: Zoe Firma', type: 'person', memory_tier: 'long_term', ...rel({ signature_company: ['[[Distributor - MEDIMEX]]'] }) }, '# Zoe\n');
  writeNote('01-Internal-Clients/Person - Pablo Menciona.md', { id: 'person-pablo-menciona', title: 'Person: Pablo Menciona', type: 'person', memory_tier: 'long_term' }, '# Pablo\nHabló con [[Distributor - MEDIMEX]] ayer.\n');
  writeNote('01-Internal-Clients/Person - Dani Doble.md', { id: 'person-dani-doble', title: 'Person: Dani Doble', type: 'person', memory_tier: 'long_term', ...rel({ works_at: ['[[Organization - Filial Prueba]]'], contact_of: ['[[Distributor - MEDIMEX]]'] }) }, '# Dani\n');
  const ana = N.deriveOf('person-ana-filial');
  t('B20 los nombres que la bóveda ya usa cuentan: market_jurisdiction, assigned_brands y sells_brands', JSON.stringify(names(ana?.grupos.mercados)) === '["Panama"]' && JSON.stringify(names(ana?.grupos.marcas)) === '["Busta","Chubby"]', JSON.stringify(ana?.grupos));
  const beto = N.deriveOf('person-beto-alias');
  t('B21 los nombres viejos con equivalencia (belongs_to_market, carries_brands) también', JSON.stringify(names(beto?.grupos.mercados)) === '["Panama"]' && JSON.stringify(names(beto?.grupos.marcas)) === '["Fruta"]', JSON.stringify(beto?.grupos));
  t('B22 una firma de correo (signature_company) NO es pertenencia a la empresa', N.deriveOf('person-zoe-firma') === null);
  t('B23 una mención en el texto («references») NO es pertenencia a la empresa', N.deriveOf('person-pablo-menciona') === null && !N.contactosDe('dist-medimex').some(c => c.id === 'person-pablo-menciona'));
  const dani = N.deriveOf('person-dani-doble');
  t('B24 conectada a dos empresas hereda de las dos, sin repetir y diciendo de cuál viene cada cosa', dani?.empresas.length === 2 && JSON.stringify(names(dani.grupos.mercados)) === '["Panama"]' && JSON.stringify(names(dani.grupos.marcas)) === '["Busta","Chubby","Fruta"]' && dani.grupos.marcas.find(m => m.nombre === 'Chubby')!.via === 'Filial Prueba', JSON.stringify(dani?.grupos));
  t('B25 las filiales (organization) también tienen contactos', N.contactosDe('org-filial-prueba').map(c => c.id).sort().join() === 'person-ana-filial,person-dani-doble');

  // Bloque para el modelo
  const bl = N.neighborhoodBlock(['dist-medimex', 'person-pierre-canavaggio', 'person-nadie', 'person-dani-doble']);
  t('B26 el bloque trae una línea por ficha que existe y se salta las que no', /^VECINDARIO DE LAS FICHAS RECONOCIDAS/.test(bl) && bl.split('\n').length === 4 && !/person-nadie/.test(bl));
  t('B27 respeta el máximo de fichas y de caracteres', N.neighborhoodBlock(['dist-medimex', 'person-pierre-canavaggio', 'person-dani-doble'], { maxCards: 2 }).split('\n').length === 3 && N.neighborhoodBlock(['dist-medimex', 'person-pierre-canavaggio'], { maxChars: 100 }) === '' && N.neighborhoodBlock(['dist-medimex', 'person-pierre-canavaggio'], { maxChars: 700 }).split('\n').length <= 3);
  t('B28 sin fichas no hay bloque', N.neighborhoodBlock([]) === '' && N.neighborhoodBlock(['nada']) === '');

  // Un cambio en el archivo de estructura vale al siguiente pedido: apagar la herencia
  writeStruct({ ...clone(), derives: [] });
  t('B29 con «derives: []» nadie hereda y las empresas no listan contactos', N.deriveOf('person-pierre-canavaggio') === null && N.contactosDe('dist-medimex').length === 0 && !/hereda/.test(N.cardText(N.cardOf('person-pierre-canavaggio')!)));
  const custom = clone(); custom.derives = [{ from: ['person'], through: ['owner_of'], to: ['distributor'], take: { marcas: { type: 'brand', rels: ['carries_brand'] } } }];
  writeStruct(custom);
  const dc = N.deriveOf('person-pierre-canavaggio');
  t('B30 una regla propia: solo marcas, solo para dueños; funciona sin desplegar', !!dc && !dc.grupos.mercados && names(dc.grupos.marcas).length === 3 && N.deriveOf('person-dani-doble') === null);
  fs.rmSync(structFile); S.resetStructureCache();
  t('B31 sin archivo, vuelve la herencia por defecto', N.deriveOf('person-pierre-canavaggio')?.grupos.mercados?.length === 1);
  // Una empresa con muchas personas: al recortar la tarjeta, lo más útil (mercado y marcas) no se cae; se caen las personas de sobra.
  const gente = Array.from({ length: 12 }, (_, i) => `Gente ${String.fromCharCode(65 + i)}`);
  for (const g of gente) writeNote(`01-Internal-Clients/Person - ${g}.md`, { id: `person-${g.toLowerCase().replace(' ', '-')}`, title: `Person: ${g}`, type: 'person', memory_tier: 'long_term' }, `# ${g}\n`);
  writeNote('02-External-Clients/Distributor - Concurrida.md', { id: 'dist-concurrida', title: 'Distributor: Concurrida', type: 'distributor', memory_tier: 'long_term', ...rel({ coordinates_with: gente.map(g => `[[Person - ${g}]]`), operates_in_market: ['[[Market - Panama]]'], carries_brand: ['[[Brand - Chubby]]'] }) }, '# Concurrida\n');
  const crowded = N.cardOf('dist-concurrida')!; const ctxt = N.cardText(crowded);
  t('B32 con 12 personas, el mercado y la marca van primero y sobreviven al recorte', crowded.conexiones.length >= 14 && /operates_in_market: Panama/.test(ctxt) && /carries_brand: Chubby/.test(ctxt) && ctxt.length <= N.NEIGHBORHOOD.cardChars, `${crowded.conexiones.length} · ${ctxt}`);
  t('B33 y las conexiones de una persona empiezan por su empresa', N.cardOf('person-dani-doble')!.conexiones[0].tipo !== 'person');

  // ================= C. Lectura: la ficha y las consultas =================
  const ctx: any = L.nodeContext('person-pierre-canavaggio');
  t('C1 la ficha de Pierre expone lo heredado, diciendo que no está guardado', ctx.derived?.empresa?.[0] === 'MEDIMEX' && ctx.derived.mercados[0] === 'Panama' && ctx.derived.marcas.length === 3 && /no está guardado en su ficha|not stored/.test(ctx.derived.nota), JSON.stringify(ctx.derived));
  t('C2 y lo heredado NO aparece entre sus datos guardados', !/Panama|Chubby/.test(JSON.stringify(ctx.node.frontmatter)));
  const cmx: any = L.nodeContext('dist-medimex');
  t('C3 la ficha de MEDIMEX expone sus personas con su papel', cmx.people.some((p: any) => p.nombre === 'Pierre Canavaggio' && p.etiqueta === 'dueño'), JSON.stringify(cmx.people));
  t('C4 una persona no tiene «personas»; una empresa no hereda', ctx.people.length === 0 && cmx.derived === null);
  const dos: any = L.dossier({ q: 'MEDIMEX', size: 'completo' }); const pc = (dos.contacts || []).find((c: any) => /Pierre/.test(c.name));
  t('C5 en una consulta, el contacto trae lo que hereda de su empresa', pc?.derivado?.empresa?.[0] === 'MEDIMEX' && pc.derivado.mercados?.[0] === 'Panama' && pc.derivado.marcas?.includes('Chubby'), JSON.stringify(pc));
  t('C6 con su origen y su papel intactos (5.2)', /según HB/.test(String(pc?.relationOrigen || '')) && !!pc?.origen);

  // ================= D. pedir() le entrega el vecindario al modelo =================
  const real = globalThis.fetch; const asked: { system: string; user: string }[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('ollama.com')) { const b = JSON.parse(String(init?.body)); asked.push({ system: String(b.messages?.[0]?.content || ''), user: String(b.messages?.[1]?.content || '') }); return json({ message: { content: '', tool_calls: [{ function: { name: 'registrar_novedad', arguments: { ficha: 'dist-medimex', resumen: 'Se llamó por el pedido.', fuente: 'HB' } } }] }, model: 'modelo-simulado', prompt_eval_count: 5, eval_count: 5 }); }
    if (u.includes('typesafe')) { const b = JSON.parse(String(init?.body)); const a: Record<string, any> = {}; if (b.questions.fiel) a.fiel = { type: 'score', score: 3, confidence: 0.9 }; if (b.questions.motivo) a.motivo = { type: 'choice', choice: 'bien', confidence: 0.8 }; if (b.questions.noul_fiel) a.noul_fiel = { type: 'noul', noul: 0.9 }; if (b.questions.coherente) a.coherente = { type: 'score', score: 1, confidence: 0.9 }; return json({ answers: a, model: 'jev-simulado', usage: {} }); }
    return real(url as any, init);
  }) as typeof fetch;
  try {
    const rec: any = await E.pedir({ text: 'Anota que se llamó a MEDIMEX por el pedido.' });
    t('D1 el pedido se aplica', rec.status === 'aplicado', `${rec.status} ${rec.message}`);
    const u1 = asked[0]?.user || '';
    t('D2 el modelo recibe el vecindario de MEDIMEX: su mercado, sus marcas y a Pierre como dueño según HB', /VECINDARIO DE LAS FICHAS RECONOCIDAS/.test(u1) && /dist-medimex \| MEDIMEX \(distributor/.test(u1) && /operates_in_market: Panama/.test(u1) && /carries_brand: Chubby/.test(u1) && /contactos: [^\n]*Pierre Canavaggio \(dueño, lo dijo una persona — según HB/.test(u1), u1.split('\n').find(l => /^dist-medimex \| MEDIMEX \(distributor, /.test(l)) || '(no hay línea de MEDIMEX)');
    t('D3 y sigue recibiendo la lista de fichas de siempre', /FICHAS QUE PUEDEN SER \(id \| nombre \| tipo\):[\s\S]*dist-medimex \| MEDIMEX \| distributor/.test(u1));
    t('D4 el modelo sabe por sus reglas que lo heredado se calcula y no se conecta', /SE HEREDA, NO SE CONECTA/.test(asked[0].system));
    const block = (u1.match(/VECINDARIO DE LAS FICHAS RECONOCIDAS[^\n]*\n([\s\S]*?)(?:\n\n|$)/) || [, ''])[1];
    t('D5 el vecindario no pasa de su presupuesto (cuesta tokens en cada pedido)', block.length <= N.NEIGHBORHOOD.maxChars, String(block.length));
    asked.length = 0;
    await E.pedir({ text: 'Anota que Pierre Canavaggio pidió el reporte de MEDIMEX.' });
    const u2 = asked[0]?.user || '';
    t('D6 al nombrar a Pierre, su tarjeta dice que hereda Panamá y las marcas de MEDIMEX (el modelo no necesita conectárselos)', /person-pierre-canavaggio \| Pierre Canavaggio \(person[^)]*\)[^\n]*hereda mercados Panama, marcas [^\n]*por MEDIMEX/.test(u2), u2.slice(0, 900));
    t('D7 la prueba no dejó fichas en la bóveda real del repo', !fs.existsSync(path.join(REPO, '01-Internal-Clients', 'Person - Pierre Canavaggio.md')) && !fs.existsSync(path.join(REPO, '01-Internal-Clients', 'Person - Ana Filial.md')));
  } finally { globalThis.fetch = real; process.chdir(os.tmpdir()); fs.rmSync(root, { recursive: true, force: true }); }
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
