/**
 * Estructura única del Cerebro (fase 5, etapa 5.1).
 * Qué tipos de ficha existen (y en qué carpeta nacen), qué relaciones se pueden escribir (y entre qué tipos),
 * qué campos se reconocen por tipo y cómo se leen las relaciones viejas. Antes esto vivía repartido en el código y
 * en el texto del modelo; ahora hay UNA fuente: el archivo `00-System/estructura.yaml` de la bóveda.
 *
 * Cómo se carga (nunca deja al motor sin estructura):
 *   1. `<bóveda>/00-System/estructura.yaml`, si existe y es válido.
 *   2. Si existe pero está mal: la última versión buena (copia fuera de la bóveda) y el error queda visible.
 *   3. Si no existe, o no hay copia buena: los valores por defecto de este archivo (iguales a los de antes de la etapa).
 *
 * Lo que el archivo NO puede hacer: borrar un tipo o una relación que el motor ya usa, ni cambiar su carpeta,
 * prefijo o id (romperían las fichas que ya existen). Sí puede agregar tipos, relaciones, campos y equivalencias.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { isDeepStrictEqual } from 'util';
import YAML from 'yaml';
import { cerebroDir } from './settings';
import { getVaultPath } from '../smjBrainService';
import { tr } from '../reqLang';

export interface TypeDef {
  /** Carpeta de la bóveda donde nace una ficha de este tipo. */
  folder: string;
  /** Prefijo del título y del archivo: «Person» → «Person: Ana» / «Person - Ana.md». */
  prefix: string;
  /** Prefijo del id: «dist» → dist-medimex. */
  idPrefix: string;
  /** ¿El Cerebro puede crear fichas de este tipo? */
  creatable: boolean;
  /** Campos que se reconocen para este tipo aunque ninguna ficha los use todavía. */
  fields: string[];
}
export interface RelationDef {
  /** Tipos de ficha desde los que se puede escribir. Sin esto: cualquiera. */
  from?: string[];
  /** Tipos de ficha hacia los que se puede escribir. Sin esto: cualquiera. */
  to?: string[];
  /** Para qué sirve, en una frase (se le muestra al modelo). */
  desc?: string;
}
export interface Structure {
  version: number;
  types: Record<string, TypeDef>;
  relations: Record<string, RelationDef>;
  /** Relación vieja → relación vigente. Lo que el modelo escriba con el nombre viejo se guarda con el vigente. */
  aliases: Record<string, string>;
  /** Campos estándar que valen en cualquier tipo (estado y fechas de alta y baja). */
  commonFields: string[];
}
export type StructureSource = 'archivo' | 'ultima_buena' | 'defecto';
export interface Loaded { s: Structure; source: StructureSource; errors: string[]; hash: string }

/** Campos que ninguna operación del Cerebro puede escribir, pase lo que pase con el archivo. */
export const PROTECTED_FIELDS = new Set(['id', 'title', 'type', 'brain_id', 'brain_owner', 'owner', 'visibility', 'shared_with', 'verification_status', 'verified_at', 'verified_by', 'memory_tier', 'relations', 'recent_actions', 'pending_tasks', 'updated_at', 'last_updated_at', 'field_sources', 'relation_sources']);

const PERSON_FIELDS = ['email_primary', 'email_secondary', 'phone_mobile', 'phone_office_ext', 'whatsapp', 'job_title', 'organization', 'mailing_address'];
const COMPANY_FIELDS = ['email_general', 'email_orders', 'email_accounting', 'phone_main', 'headquarters_address', 'company_name', 'short_name', 'legal_name'];
const type = (folder: string, prefix: string, idPrefix: string, fields: string[] = []): TypeDef => ({ folder, prefix, idPrefix, creatable: true, fields });
const COMPANY_TYPES = ['organization', 'distributor', 'customer'];

/** Los valores de siempre (los que el código tenía fijos) más lo que esta etapa agrega: dueño o persona clave de una empresa y correo general. */
export const DEFAULT_STRUCTURE: Structure = {
  version: 1,
  types: {
    person: type('01-Internal-Clients', 'Person', 'person', PERSON_FIELDS),
    department: type('01-Internal-Clients', 'Dept', 'dept'),
    organization: type('01-Internal-Clients', 'Organization', 'org', COMPANY_FIELDS),
    distributor: type('02-External-Clients', 'Distributor', 'dist', COMPANY_FIELDS),
    market: type('02-External-Clients', 'Market', 'market'),
    customer: type('02-External-Clients', 'Customer', 'cust', COMPANY_FIELDS),
    channel: type('02-External-Clients', 'Channel', 'channel'),
    brand: type('03-Portfolio-Supply', 'Brand', 'brand'),
    product_line: type('03-Portfolio-Supply', 'Line', 'line'),
    project: type('04-Operations-Routines', 'Project', 'project'),
    routine: type('04-Operations-Routines', 'Routine', 'routine'),
  },
  relations: {
    belongs_to: { desc: 'pertenece a (departamento, línea, grupo)' },
    reports_to: { desc: 'reporta a (jerarquía de personas)' },
    works_at: { desc: 'trabaja en (empresa o departamento)' },
    operates_in_market: { desc: 'opera en un mercado' },
    carries_brand: { desc: 'lleva o distribuye una marca' },
    distributed_by: { desc: 'lo distribuye' },
    supplies_client: { desc: 'abastece a un cliente' },
    contact_of: { desc: 'es contacto de una empresa' },
    coordinates_with: { desc: 'coordina con' },
    related_to: { desc: 'relación general, cuando ninguna otra aplica' },
    owner_of: { from: ['person'], to: COMPANY_TYPES, desc: 'es dueño o socio de una empresa' },
    key_person_of: { from: ['person'], to: COMPANY_TYPES, desc: 'persona clave o decisora de una empresa (sin ser dueño)' },
  },
  aliases: { belongs_to_market: 'operates_in_market', carries_brands: 'carries_brand', collaborates_with: 'coordinates_with', professional_contact_of: 'contact_of' },
  commonFields: ['status', 'end_date', 'start_date', 'inactive_reason', 'is_active'],
};

// ---------- Validación ----------
const NAME = /^[a-z][a-z0-9_]{2,40}$/, FIELD = /^[a-z][a-z0-9_]{1,60}$/, FOLDER = /^[0-9A-Za-z][\w\- ]{0,60}$/, PREFIX = /^[A-Za-z][A-Za-z ]{0,30}$/, IDP = /^[a-z][a-z0-9]{1,12}$/;
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : null);

/** Revisa un archivo de estructura ya leído. Devuelve la estructura completa si todo cuadra, o la lista de errores. */
export function validateStructure(raw: unknown): { ok: true; s: Structure } | { ok: false; errors: string[] } {
  const errors: string[] = []; const D = DEFAULT_STRUCTURE;
  if (!isObj(raw)) return { ok: false, errors: ['El archivo no es un objeto YAML (tipos, relaciones…).'] };
  const rt = raw.types, rr = raw.relations;
  if (!isObj(rt) || !Object.keys(rt).length) errors.push('Falta «types» (los tipos de ficha).');
  if (!isObj(rr) || !Object.keys(rr).length) errors.push('Falta «relations» (las relaciones).');
  if (errors.length) return { ok: false, errors };
  const types: Record<string, TypeDef> = {}; const relations: Record<string, RelationDef> = {}; const aliases: Record<string, string> = {};
  if (Object.keys(rt).length > 60) errors.push('Demasiados tipos (máximo 60).');
  if (Object.keys(rr).length > 120) errors.push('Demasiadas relaciones (máximo 120).');
  const fieldsOk = (f: unknown, where: string): string[] => {
    if (f === undefined) return [];
    const a = strs(f); if (!a || a.length > 80) { errors.push(`${where}: «fields» debe ser una lista de hasta 80 nombres.`); return []; }
    const bad = a.filter(x => !FIELD.test(x) || PROTECTED_FIELDS.has(x)); if (bad.length) errors.push(`${where}: campos no permitidos (${bad.join(', ')}): minúsculas, números y _, y no protegidos.`);
    return [...new Set(a)];
  };
  for (const [k, v] of Object.entries(rt)) {
    if (!NAME.test(k)) { errors.push(`Tipo «${k}»: el nombre debe ir en minúsculas, números y _ (3 a 41 caracteres).`); continue; }
    if (!isObj(v)) { errors.push(`Tipo «${k}»: debe llevar folder, prefix e idPrefix.`); continue; }
    const base = D.types[k];
    const fields = fieldsOk(v.fields, `Tipo «${k}»`);
    if (base) { // un tipo de siempre: solo se le pueden sumar campos
      for (const p of ['folder', 'prefix', 'idPrefix'] as const) if (v[p] !== base[p]) errors.push(`Tipo «${k}»: «${p}» no se puede cambiar (debe seguir siendo «${base[p]}»); las fichas que ya existen dependen de eso.`);
      if (v.creatable !== undefined && v.creatable !== base.creatable) errors.push(`Tipo «${k}»: «creatable» no se puede cambiar.`);
      types[k] = { ...base, fields: [...new Set([...base.fields, ...fields])] };
    } else {
      if (typeof v.folder !== 'string' || !FOLDER.test(v.folder) || v.folder.includes('..')) errors.push(`Tipo «${k}»: «folder» inválido (una carpeta de la bóveda, sin «..»).`);
      if (typeof v.prefix !== 'string' || !PREFIX.test(v.prefix)) errors.push(`Tipo «${k}»: «prefix» inválido (solo letras).`);
      if (typeof v.idPrefix !== 'string' || !IDP.test(v.idPrefix)) errors.push(`Tipo «${k}»: «idPrefix» inválido (minúsculas y números, 2 a 13).`);
      if (v.creatable !== undefined && typeof v.creatable !== 'boolean') errors.push(`Tipo «${k}»: «creatable» debe ser true o false.`);
      types[k] = { folder: String(v.folder), prefix: String(v.prefix), idPrefix: String(v.idPrefix), creatable: v.creatable !== false, fields };
    }
  }
  for (const k of Object.keys(D.types)) if (!(k in rt)) errors.push(`Falta el tipo «${k}»: el motor lo usa y no se puede quitar.`);
  const ids = new Map<string, string>(); for (const [k, v] of Object.entries(types)) { const o = ids.get(v.idPrefix); if (o) errors.push(`El idPrefix «${v.idPrefix}» lo usan «${o}» y «${k}».`); else ids.set(v.idPrefix, k); }
  const known = (x: string) => x in types;
  for (const [k, v] of Object.entries(rr)) {
    if (!NAME.test(k)) { errors.push(`Relación «${k}»: el nombre debe ir en minúsculas, números y _ (3 a 41 caracteres).`); continue; }
    if (!isObj(v) && v !== null) { errors.push(`Relación «${k}»: debe ser un objeto (puede ir vacío).`); continue; }
    const d: RelationDef = {}; const o = (v || {}) as Record<string, any>;
    for (const side of ['from', 'to'] as const) {
      if (o[side] === undefined) continue; const a = strs(o[side]);
      if (!a || !a.length) { errors.push(`Relación «${k}»: «${side}» debe ser una lista de tipos.`); continue; }
      const bad = a.filter(x => !known(x)); if (bad.length) errors.push(`Relación «${k}»: «${side}» nombra tipos que no existen (${bad.join(', ')}).`); else d[side] = [...new Set(a)];
    }
    if (o.desc !== undefined) { if (typeof o.desc !== 'string' || o.desc.length > 200) errors.push(`Relación «${k}»: «desc» debe ser un texto corto.`); else d.desc = o.desc; }
    relations[k] = d;
  }
  for (const k of Object.keys(D.relations)) if (!(k in rr)) errors.push(`Falta la relación «${k}»: el motor la usa y no se puede quitar.`);
  const ra = raw.aliases;
  if (ra !== undefined && ra !== null) {
    if (!isObj(ra) || Object.keys(ra).length > 200) errors.push('«aliases» debe ser un objeto de «relación vieja: relación vigente» (hasta 200).');
    else for (const [old, now] of Object.entries(ra)) {
      if (!NAME.test(old)) errors.push(`Equivalencia «${old}»: nombre inválido.`);
      else if (old in relations) errors.push(`Equivalencia «${old}»: ya es una relación vigente; no puede ser también «vieja».`);
      else if (typeof now !== 'string' || !(now in relations)) errors.push(`Equivalencia «${old}»: «${String(now)}» no es una relación vigente.`);
      else aliases[old] = now;
    }
  }
  let commonFields = D.commonFields;
  if (raw.commonFields !== undefined) { const f = fieldsOk(raw.commonFields, 'commonFields'); commonFields = [...new Set([...D.commonFields, ...f])]; }
  const version = typeof raw.version === 'number' && raw.version >= 1 ? Math.floor(raw.version) : 1;
  if (errors.length) return { ok: false, errors };
  return { ok: true, s: { version, types, relations, aliases, commonFields } };
}

// ---------- Carga ----------
const fileOf = (vault: string) => path.join(vault, '00-System', 'estructura.yaml');
const goodFile = (vault: string) => path.join(cerebroDir(vault), 'estructura-ultima-buena.json');
const logFile = (vault: string) => path.join(cerebroDir(vault), 'estructura-versiones.jsonl');
const hashOf = (s: unknown) => crypto.createHash('sha1').update(JSON.stringify(s)).digest('hex').slice(0, 12);
const cache = new Map<string, { sig: string; loaded: Loaded }>();

const defaults = (errors: string[] = []): Loaded => ({ s: DEFAULT_STRUCTURE, source: 'defecto', errors, hash: hashOf(DEFAULT_STRUCTURE) });
function readGood(vault: string): Structure | null {
  try { const v = validateStructure(JSON.parse(fs.readFileSync(goodFile(vault), 'utf8'))); return v.ok ? v.s : null; } catch { return null; }
}
/** Guarda la versión buena (para poder volver a ella) y deja una línea de cuándo cambió la estructura. Nunca hace fallar la carga. */
function rememberGood(vault: string, s: Structure, hash: string) {
  try {
    const prev = readGood(vault); if (prev && hashOf(prev) === hash) return;
    fs.mkdirSync(cerebroDir(vault), { recursive: true });
    const tmp = goodFile(vault) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(s)); fs.renameSync(tmp, goodFile(vault));
    fs.appendFileSync(logFile(vault), JSON.stringify({ at: new Date().toISOString(), hash, version: s.version, tipos: Object.keys(s.types).length, relaciones: Object.keys(s.relations).length }) + '\n');
  } catch { /* la copia es una red de seguridad: si falla, la carga sigue */ }
}

/** La estructura vigente de una bóveda. Se vuelve a leer solo si el archivo cambió. */
export function loadStructure(vault: string = getVaultPath()): Loaded {
  const f = fileOf(vault); let st: fs.Stats | null = null; try { st = fs.statSync(f); } catch { /* no existe */ }
  if (!st) { const c = cache.get(vault); if (c && c.sig === 'sin-archivo') return c.loaded; const l = defaults(); cache.set(vault, { sig: 'sin-archivo', loaded: l }); return l; }
  const sig = `${st.mtimeMs}:${st.size}`; const c = cache.get(vault); if (c && c.sig === sig) return c.loaded;
  let loaded: Loaded;
  try {
    const v = validateStructure(YAML.parse(fs.readFileSync(f, 'utf8')));
    if (v.ok) { const hash = hashOf(v.s); rememberGood(vault, v.s, hash); loaded = { s: v.s, source: 'archivo', errors: [], hash }; }
    else { const g = readGood(vault); loaded = g ? { s: g, source: 'ultima_buena', errors: v.errors, hash: hashOf(g) } : defaults(v.errors); }
  } catch (e: any) {
    const errors = [`El archivo no se pudo leer como YAML: ${String(e?.message || e).slice(0, 160)}`]; const g = readGood(vault);
    loaded = g ? { s: g, source: 'ultima_buena', errors, hash: hashOf(g) } : defaults(errors);
  }
  cache.set(vault, { sig, loaded }); return loaded;
}
/** Atajo: la estructura de la bóveda actual. Si algo falla de forma inesperada, los valores por defecto. */
export function structure(): Structure { try { return loadStructure().s; } catch { return DEFAULT_STRUCTURE; } }
/** Se usa en las pruebas para forzar una nueva lectura. */
export function resetStructureCache() { cache.clear(); }

// ---------- Consultas ----------
/** El tipo, solo si el Cerebro puede crear fichas de él. */
export const creatableType = (t: unknown): TypeDef | undefined => { const d = structure().types[String(t)]; return d && d.creatable ? d : undefined; };
/** Relación vigente: si el nombre es una equivalencia vieja, el vigente; si no, el mismo nombre. */
export const canonRelation = (name: unknown): string => { const s = structure(); const n = String(name || '').trim(); return s.aliases[n] || n; };
export const relationNames = (): string[] => Object.keys(structure().relations);
/** Campos que se aceptan para un tipo aunque ninguna ficha los use: los suyos y los estándar. */
export const knownFieldsOf = (t: unknown): Set<string> => { const s = structure(); return new Set([...(s.types[String(t)]?.fields || []), ...s.commonFields]); };
/** ¿Esta relación se puede escribir entre estos tipos? null si sí; si no, el motivo. Un tipo desconocido no frena (puede ser una ficha que el mismo plan crea). */
export function relationFits(relation: string, fromType?: string, toType?: string): string | null {
  const r = structure().relations[relation]; if (!r) return null;
  if (fromType && r.from && !r.from.includes(fromType)) return tr(`la relación «${relation}» solo sale de: ${r.from.join(', ')} (no de «${fromType}»)`, `the relation “${relation}” only starts from: ${r.from.join(', ')} (not “${fromType}”)`);
  if (toType && r.to && !r.to.includes(toType)) return tr(`la relación «${relation}» solo llega a: ${r.to.join(', ')} (no a «${toType}»)`, `the relation “${relation}” only goes to: ${r.to.join(', ')} (not “${toType}”)`);
  return null;
}

/** El bloque que se le entrega al modelo: sale de la estructura vigente, no de texto escrito a mano. */
export function structureBlock(): string {
  const s = structure();
  const types = Object.entries(s.types).filter(([, d]) => d.creatable).map(([k, d]) => `${k}${d.fields.length ? ` (${d.fields.join(', ')})` : ''}`).join('; ');
  const rels = Object.entries(s.relations).map(([k, d]) => `${k}${d.from || d.to ? ` [${(d.from || ['*']).join('|')} → ${(d.to || ['*']).join('|')}]` : ''}${d.desc ? ` = ${d.desc}` : ''}`).join('\n- ');
  const old = Object.entries(s.aliases).map(([a, b]) => `${a} → ${b}`).join(', ');
  return [tr('ESTRUCTURA VIGENTE (sale del archivo de estructura; es la única lista válida de tipos, campos y relaciones):', 'CURRENT STRUCTURE (from the structure file; it is the only valid list of types, fields and relations):'),
    `${tr('Tipos que puedes crear y sus campos conocidos', 'Types you can create and their known fields')}: ${types}.`,
    `${tr('Relaciones', 'Relations')}:\n- ${rels}`,
    `${tr('Campos válidos en cualquier ficha', 'Fields valid in any note')}: ${s.commonFields.join(', ')}.`,
    old ? `${tr('Nombres viejos de relación (se guardan con el vigente)', 'Old relation names (saved with the current one)')}: ${old}.` : ''].filter(Boolean).join('\n');
}
/** ¿La estructura por defecto y un archivo ya leído son iguales? (la prueba de que el archivo del repo no se desfasa del código). */
export const sameAsDefault = (s: Structure) => isDeepStrictEqual(s, DEFAULT_STRUCTURE);
