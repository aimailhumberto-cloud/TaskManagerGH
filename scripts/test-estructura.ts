/**
 * Etapa 5.1: la estructura única (tipos, relaciones, campos, equivalencias) sale de 00-System/estructura.yaml.
 * Usa una bóveda temporal con tres fichas reales copiadas; no toca la bóveda del repo ni llama a ningún modelo.
 * Uso: npx tsx scripts/test-estructura.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import YAML from 'yaml';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };
const REPO = path.resolve('vault');

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'estructura-'));
  const vault = path.join(root, 'vault'); fs.mkdirSync(path.join(vault, '01-Internal-Clients'), { recursive: true }); fs.mkdirSync(path.join(vault, '02-External-Clients'), { recursive: true });
  for (const f of ['01-Internal-Clients/Person - Tomas Casas.md', '01-Internal-Clients/Person - Humberto Bouche.md', '02-External-Clients/Distributor - MEDIMEX.md']) fs.copyFileSync(path.join(REPO, f), path.join(vault, f));
  process.env.SMJ_VAULT_PATH = vault;
  const S = await import('../src/lib/cerebro/structure');
  const O = await import('../src/lib/cerebro/ops');
  const R = await import('../src/lib/cerebro/review');
  const { readNoteStrict } = await import('../src/lib/vaultFiles');
  const file = path.join(vault, '00-System', 'estructura.yaml');
  const writeFile = (o: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof o === 'string' ? o : YAML.stringify(o)); };
  const shipped = YAML.parse(fs.readFileSync(path.join(REPO, '00-System', 'estructura.yaml'), 'utf8'));
  const clone = () => structuredClone(shipped) as any;
  const conectar = (desde: string, hacia: string, relacion: string) => O.validateOp({ name: 'conectar', args: { desde, hacia, relacion } });

  // ---- A. Lo de siempre no cambia, y el archivo del repo no se desfasa del código ----
  const v = S.validateStructure(shipped);
  t('el archivo del repo es válido', v.ok, JSON.stringify((v as any).errors));
  t('el archivo del repo es igual a los valores por defecto del código', v.ok && S.sameAsDefault(v.s));
  const D = S.DEFAULT_STRUCTURE;
  const OLD_IDS: Record<string, string> = { person: 'person', distributor: 'dist', market: 'market', brand: 'brand', customer: 'cust', department: 'dept', organization: 'org', channel: 'channel', product_line: 'line', project: 'project', routine: 'routine' };
  t('los 11 tipos de siempre conservan su idPrefix', Object.entries(OLD_IDS).every(([k, p]) => D.types[k]?.idPrefix === p) && Object.keys(D.types).length === 11);
  const OLD_FOLDERS: Record<string, [string, string]> = { person: ['01-Internal-Clients', 'Person'], department: ['01-Internal-Clients', 'Dept'], organization: ['01-Internal-Clients', 'Organization'], distributor: ['02-External-Clients', 'Distributor'], market: ['02-External-Clients', 'Market'], customer: ['02-External-Clients', 'Customer'], channel: ['02-External-Clients', 'Channel'], brand: ['03-Portfolio-Supply', 'Brand'], product_line: ['03-Portfolio-Supply', 'Line'], project: ['04-Operations-Routines', 'Project'], routine: ['04-Operations-Routines', 'Routine'] };
  t('y su carpeta y prefijo de siempre', Object.entries(OLD_FOLDERS).every(([k, [f, p]]) => D.types[k].folder === f && D.types[k].prefix === p));
  const OLD_RELS = ['belongs_to', 'reports_to', 'works_at', 'operates_in_market', 'carries_brand', 'distributed_by', 'supplies_client', 'contact_of', 'coordinates_with', 'related_to'];
  t('las 10 relaciones de siempre siguen y sin restricción de tipos', OLD_RELS.every(r => D.relations[r] && !D.relations[r].from && !D.relations[r].to));
  t('se suman dueño y persona clave, solo de persona a empresa', JSON.stringify(D.relations.owner_of.from) === '["person"]' && D.relations.owner_of.to!.includes('distributor') && !!D.relations.key_person_of);
  t('el correo general es un campo reconocido de las empresas', ['organization', 'distributor', 'customer'].every(k => D.types[k].fields.includes('email_general')));

  // ---- B. Sin archivo: valores por defecto, y el motor funciona como antes ----
  let L = S.loadStructure(vault);
  t('sin archivo: valores por defecto', L.source === 'defecto' && L.errors.length === 0);
  t('sin archivo: id de una ficha nueva como siempre', O.createdIdOf({ name: 'crear_ficha', args: { tipo: 'distributor', nombre: 'Zeta Foods' } }) === 'dist-zeta-foods');
  t('sin archivo: una relación de siempre se acepta', conectar('person-tomas-casas', 'person-humberto-bouche', 'coordinates_with') === null);
  t('sin archivo: una relación que no existe se rechaza', /no está permitida/.test(String(conectar('person-tomas-casas', 'person-humberto-bouche', 'mentor_de'))));
  t('sin archivo: un tipo que no existe se rechaza', /no permitido/.test(String(O.validateOp({ name: 'crear_ficha', args: { tipo: 'contrato', nombre: 'Contrato X' } }))));

  // ---- C. Un cambio en el archivo vale en el siguiente pedido, sin reiniciar ni desplegar ----
  const extra = clone(); extra.version = 2;
  extra.relations.mentor_de = { from: ['person'], to: ['person'], desc: 'es mentor de' };
  extra.types.contrato = { folder: '04-Operations-Routines', prefix: 'Contract', idPrefix: 'contr', fields: ['fecha_firma'] };
  writeFile(extra);
  L = S.loadStructure(vault);
  t('con archivo válido: se usa el archivo', L.source === 'archivo' && L.errors.length === 0 && L.s.version === 2, JSON.stringify(L.errors));
  t('la relación nueva se acepta sin tocar código', conectar('person-tomas-casas', 'person-humberto-bouche', 'mentor_de') === null);
  t('el tipo nuevo se acepta y nace con su prefijo de id', O.validateOp({ name: 'crear_ficha', args: { tipo: 'contrato', nombre: 'Contrato X' } }) === null && O.createdIdOf({ name: 'crear_ficha', args: { tipo: 'contrato', nombre: 'Contrato X' } }) === 'contr-contrato-x');
  const defs = O.toolDefs().map(d => d.function.description).join(' | ');
  t('las herramientas del modelo muestran lo nuevo', /mentor_de/.test(defs) && /contrato/.test(defs));
  t('el bloque de reglas del modelo sale de la estructura', /mentor_de/.test(S.structureBlock()) && /owner_of/.test(S.structureBlock()) && /fecha_firma/.test(S.structureBlock()));
  t('lo que no estaba sigue rechazándose', /no está permitida/.test(String(conectar('person-tomas-casas', 'person-humberto-bouche', 'otra_cosa'))));
  t('queda registrada la versión buena', fs.existsSync(path.join(root, 'dots-sleep', 'cerebro', 'estructura-versiones.jsonl')) && fs.existsSync(path.join(root, 'dots-sleep', 'cerebro', 'estructura-ultima-buena.json')));

  // ---- D. Restricciones de tipos (solo las relaciones nuevas las tienen) ----
  writeFile(shipped); S.resetStructureCache();
  t('dueño: de persona a distribuidor se acepta', conectar('person-tomas-casas', 'dist-medimex', 'owner_of') === null);
  t('dueño: de distribuidor a persona se rechaza', /solo sale de/.test(String(conectar('dist-medimex', 'person-tomas-casas', 'owner_of'))));
  t('dueño: de persona a persona se rechaza', /solo llega a/.test(String(conectar('person-tomas-casas', 'person-humberto-bouche', 'owner_of'))));
  t('persona clave: de persona a distribuidor se acepta', conectar('person-tomas-casas', 'dist-medimex', 'key_person_of') === null);
  t('al crear una persona se puede conectar como dueño', O.validateOp({ name: 'crear_ficha', args: { tipo: 'person', nombre: 'Pierre Prueba', conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }] } }) === null);
  t('al crear un departamento no se puede conectar como dueño', /solo sale de/.test(String(O.validateOp({ name: 'crear_ficha', args: { tipo: 'department', nombre: 'Dept Prueba', conectar_con: [{ hacia: 'dist-medimex', relacion: 'owner_of' }] } }))));
  t('las relaciones de siempre no se restringieron: un departamento se conecta como antes', O.validateOp({ name: 'crear_ficha', args: { tipo: 'department', nombre: 'Dept Prueba', conectar_con: [{ hacia: 'dist-medimex', relacion: 'works_at' }] } }) === null);

  // ---- E. Nombres viejos de relación: se aceptan y se guardan con el vigente ----
  t('un nombre viejo se acepta', conectar('person-tomas-casas', 'dist-medimex', 'belongs_to_market') === null);
  O.executeOp({ name: 'conectar', args: { desde: 'person-tomas-casas', hacia: 'dist-medimex', relacion: 'belongs_to_market' } });
  const tomas = path.join(vault, '01-Internal-Clients', 'Person - Tomas Casas.md');
  let rel = (readNoteStrict(tomas) as any).frontmatter.relations || {};
  t('se guardó con el nombre vigente', JSON.stringify(rel.operates_in_market || []).includes('MEDIMEX') && !('belongs_to_market' in rel), JSON.stringify(rel));
  O.executeOp({ name: 'desconectar', args: { desde: 'person-tomas-casas', hacia: 'dist-medimex', relacion: 'belongs_to_market' } });
  rel = (readNoteStrict(tomas) as any).frontmatter.relations || {};
  t('desconectar con el nombre viejo quita la conexión vigente', !JSON.stringify(rel.operates_in_market || []).includes('MEDIMEX'), JSON.stringify(rel));

  // ---- F. Campos: los declarados no se marcan como inventados ----
  const fi = (ficha: string, campos: Record<string, string>) => R.fieldIssues([{ name: 'actualizar_campos', args: { ficha, campos } }]);
  t('correo general de una empresa: reconocido aunque ninguna ficha lo use', fi('dist-medimex', { email_general: 'info@medimexsa.com' }).length === 0);
  t('un campo inventado sí se marca', fi('dist-medimex', { campo_que_nadie_usa: 'x' }).length === 1);
  t('los campos estándar valen en cualquier tipo', fi('dist-medimex', { status: 'inactive', end_date: '2026-11-15' }).length === 0);
  t('los campos protegidos nunca se escriben', /no se pueden cambiar/.test(String(O.validateOp({ name: 'actualizar_campos', args: { ficha: 'dist-medimex', campos: { owner: 'x' } } }))));

  // ---- G. Un archivo malo nunca deja al motor sin estructura ----
  const no = (name: string, mut: (o: any) => void, re: RegExp) => { const o = clone(); mut(o); const r = S.validateStructure(o); t(name, !r.ok && (r as any).errors.some((e: string) => re.test(e)), JSON.stringify((r as any).errors)); };
  no('rechaza quitar un tipo que el motor usa', o => { delete o.types.person; }, /Falta el tipo «person»/);
  no('rechaza cambiar el idPrefix de un tipo de siempre', o => { o.types.person.idPrefix = 'persona'; }, /«idPrefix» no se puede cambiar/);
  no('rechaza cambiar la carpeta de un tipo de siempre', o => { o.types.brand.folder = 'Otra'; }, /«folder» no se puede cambiar/);
  no('rechaza quitar una relación que el motor usa', o => { delete o.relations.contact_of; }, /Falta la relación «contact_of»/);
  no('rechaza una carpeta que se sale de la bóveda', o => { o.types.nuevo = { folder: '../fuera', prefix: 'Nuevo', idPrefix: 'nuevo' }; }, /«folder» inválido/);
  no('rechaza un idPrefix repetido', o => { o.types.nuevo = { folder: '04-Operations-Routines', prefix: 'Nuevo', idPrefix: 'dist' }; }, /idPrefix «dist» lo usan/);
  no('rechaza una relación hacia un tipo que no existe', o => { o.relations.rara = { to: ['fantasma'] }; }, /tipos que no existen/);
  no('rechaza una equivalencia hacia una relación que no existe', o => { o.aliases.vieja = 'no_existe'; }, /no es una relación vigente/);
  no('rechaza que una relación vigente sea también «vieja»', o => { o.aliases.reports_to = 'related_to'; }, /ya es una relación vigente/);
  no('rechaza un campo protegido en la lista de campos', o => { o.types.person.fields.push('owner'); }, /campos no permitidos/);
  no('rechaza un nombre de relación con mayúsculas', o => { o.relations.MalNombre = {}; }, /nombre debe ir en minúsculas/);
  t('rechaza algo que no es un objeto', !S.validateStructure('hola').ok && !S.validateStructure(null).ok && !S.validateStructure({ types: {} }).ok);

  writeFile(extra); S.resetStructureCache(); S.loadStructure(vault); // vuelve a haber una versión buena con mentor_de
  fs.writeFileSync(file, 'types: [esto no es yaml válido: {'); S.resetStructureCache();
  L = S.loadStructure(vault);
  t('YAML roto con una versión buena guardada: usa la última buena y avisa', L.source === 'ultima_buena' && L.errors.length > 0 && !!L.s.relations.mentor_de, `${L.source} ${JSON.stringify(L.errors)}`);
  t('y el motor sigue usando esa estructura', conectar('person-tomas-casas', 'person-humberto-bouche', 'mentor_de') === null);
  const mal = clone(); delete mal.types.person; writeFile(mal); S.resetStructureCache();
  L = S.loadStructure(vault);
  t('archivo inválido (falta un tipo): última buena y error visible', L.source === 'ultima_buena' && L.errors.some(e => /person/.test(e)));
  const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'estructura2-')); const vault2 = path.join(root2, 'vault'); fs.mkdirSync(path.join(vault2, '00-System'), { recursive: true });
  fs.writeFileSync(path.join(vault2, '00-System', 'estructura.yaml'), ': : :');
  const L2 = S.loadStructure(vault2);
  t('YAML roto y sin versión buena: valores por defecto y error visible', L2.source === 'defecto' && L2.errors.length > 0 && S.sameAsDefault(L2.s));
  fs.rmSync(file); S.resetStructureCache(); L = S.loadStructure(vault);
  t('si borran el archivo: valores por defecto', L.source === 'defecto' && L.errors.length === 0 && !L.s.relations.mentor_de);

  fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(root2, { recursive: true, force: true });
  console.log(`${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
