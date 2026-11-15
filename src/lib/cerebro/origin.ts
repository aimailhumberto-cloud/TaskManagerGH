/**
 * Origen del dato (fase 5, etapa 5.2).
 * Antes un dato se guardaba como verdad o no se guardaba: no había dónde escribir «dueño, según HB» ni «correo publicado en la web,
 * sin confirmar». Ahora cada dato que el Cerebro escribe lleva de dónde viene, y verificar deja de ser todo o nada:
 * se puede verificar un campo sin afirmar que toda la ficha está verificada.
 *
 * Dónde queda (en el encabezado de la ficha, fuera de la vista normal de datos):
 *   field_sources:    { job_title: { clase, fuente, por, at, … } }            un registro por campo
 *   relation_sources: { owner_of: { '[[Distributor - MEDIMEX]]': { … } } }    un registro por conexión
 * Todo son funciones puras sobre ese encabezado (`fm`): no leen ni escriben archivos.
 */
export const ORIGIN_CLASSES = ['persona', 'publicado', 'documento', 'inferido'] as const;
export type OriginClass = (typeof ORIGIN_CLASSES)[number];
/** Lo que ve el modelo al elegir la clase. «verificado» no está: solo lo pone marcar_verificado, que aprueba una persona. */
export const ORIGIN_HELP = 'persona = lo dijo una persona del equipo (HB, un colega) aunque no haya fuente pública; publicado = sale de una fuente pública, con la dirección en «fuente»; documento = sale de un correo, contrato o archivo, di cuál en «fuente»; inferido = lo dedujo el Cerebro y nadie lo dijo';

/** Cómo quedó un dato. `sin_clasificar` = quien lo escribió no dijo de dónde sale (se ve y se puede completar después). */
export interface SourceEntry {
  clase: OriginClass | 'verificado' | 'sin_clasificar';
  /** En palabras: quién lo dijo, o la dirección o el archivo de donde sale. */
  fuente?: string;
  /** Quién lo escribió en la bóveda (el Cerebro y a nombre de quién). */
  por: string;
  /** Cuándo se escribió (ISO). */
  at: string;
  /** Solo si se verificó: quién, cuándo, contra qué fuente, y de qué clase era antes. */
  verificado_por?: string; verificado_el?: string; fuente_verificacion?: string; clase_previa?: string;
}
export interface Stamp { clase?: string; fuente?: string; por: string; at: string }

const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Revisa lo que el modelo mandó como origen. «verificado» no se puede poner por esta vía: afirma que alguien confirmó la fuente. */
export function checkOrigin(args: { clase?: unknown; fuente?: unknown }): string | null {
  if (args.clase !== undefined && args.clase !== null && args.clase !== '') {
    const c = String(args.clase);
    if (c === 'verificado') return '«clase» no puede ser «verificado» aquí: eso solo lo hace marcar_verificado, que aprueba una persona.';
    if (!(ORIGIN_CLASSES as readonly string[]).includes(c)) return `«clase» debe ser una de: ${ORIGIN_CLASSES.join(', ')}.`;
  }
  if (args.fuente !== undefined && args.fuente !== null && (typeof args.fuente !== 'string' || args.fuente.length > 300)) return '«fuente» debe ser un texto de hasta 300 caracteres.';
  if (String(args.clase) === 'persona' && !String(args.fuente ?? '').trim()) return 'con «clase» persona, «fuente» es obligatoria: pon el nombre de quien lo dijo (el que pide), por ejemplo «HB».';
  return null;
}
const entry = (s: Stamp): SourceEntry => ({
  clase: (ORIGIN_CLASSES as readonly string[]).includes(String(s.clase)) ? (s.clase as OriginClass) : 'sin_clasificar',
  ...(s.fuente && String(s.fuente).trim() ? { fuente: String(s.fuente).trim().slice(0, 300) } : {}), por: s.por, at: s.at,
});

/** Anota el origen de estos campos. Un campo que se vuelve a escribir pierde su verificación: el valor nuevo no es el que se verificó. */
export function stampFields(fm: Record<string, any>, fields: string[], s: Stamp): void {
  if (!fields.length) return;
  const cur = isObj(fm.field_sources) ? fm.field_sources : (fm.field_sources = {});
  for (const f of fields) cur[f] = entry(s);
}
/** Anota el origen de una conexión (la relación y a qué ficha apunta). */
export function stampRelation(fm: Record<string, any>, relation: string, target: string, s: Stamp): void {
  const all = isObj(fm.relation_sources) ? fm.relation_sources : (fm.relation_sources = {});
  const byRel = isObj(all[relation]) ? all[relation] : (all[relation] = {});
  byRel[target] = entry(s);
}
/** Quita el origen de una conexión que se desconecta. Si la relación queda vacía, se limpia. */
export function dropRelationSource(fm: Record<string, any>, relation: string, target: string): void {
  const all = fm.relation_sources; if (!isObj(all) || !isObj(all[relation])) return;
  delete all[relation][target]; if (!Object.keys(all[relation]).length) delete all[relation]; if (!Object.keys(all).length) delete fm.relation_sources;
}

/** Verifica solo estos campos. Los que no existen en la ficha no se tocan (se devuelven en `faltan`). No cambia verification_status de la ficha. */
export function markFieldsVerified(fm: Record<string, any>, fields: string[], v: { fuente: string; por: string; at: string }): { hechos: string[]; faltan: string[] } {
  const hechos: string[] = [], faltan: string[] = [];
  const cur = isObj(fm.field_sources) ? fm.field_sources : (fm.field_sources = {});
  for (const f of fields) {
    if (fm[f] === undefined || fm[f] === null || fm[f] === '') { faltan.push(f); continue; }
    const prev = isObj(cur[f]) ? cur[f] as SourceEntry : null;
    cur[f] = { clase: 'verificado', por: prev?.por || v.por, at: prev?.at || v.at, ...(prev?.fuente ? { fuente: prev.fuente } : {}), clase_previa: prev?.clase || 'sin_clasificar', verificado_por: v.por, verificado_el: v.at, fuente_verificacion: String(v.fuente).slice(0, 300) } satisfies SourceEntry;
    hechos.push(f);
  }
  if (!Object.keys(cur).length) delete fm.field_sources;
  return { hechos, faltan };
}

// ---------- Lectura ----------
export const sourceOf = (fm: Record<string, any>, field: string): SourceEntry | null => (isObj(fm?.field_sources) && isObj(fm.field_sources[field]) ? (fm.field_sources[field] as SourceEntry) : null);
export const isFieldVerified = (fm: Record<string, any>, field: string) => sourceOf(fm, field)?.clase === 'verificado';
/** ¿La ficha ya lleva verificación por campo? Si sí, ya no se la trata como «toda verificada o nada». */
export const hasFieldVerification = (fm: Record<string, any>) => isObj(fm?.field_sources) && Object.values(fm.field_sources).some(e => isObj(e) && e.clase === 'verificado');

const CLASE_ES: Record<string, string> = { persona: 'lo dijo una persona', publicado: 'publicado', documento: 'de un documento', inferido: 'inferido por el Cerebro', verificado: 'verificado', sin_clasificar: 'sin origen indicado' };
const CLASE_EN: Record<string, string> = { persona: 'said by a person', publicado: 'published', documento: 'from a document', inferido: 'inferred by the Brain', verificado: 'verified', sin_clasificar: 'no origin given' };
/** Una frase corta: «lo dijo una persona — según HB (2026-11-15)». */
export function originText(e: Pick<SourceEntry, 'clase' | 'fuente' | 'at' | 'verificado_el' | 'fuente_verificacion'> | null, lang: 'es' | 'en' = 'es'): string {
  if (!e) return '';
  const name = (lang === 'en' ? CLASE_EN : CLASE_ES)[e.clase] || e.clase;
  const fuente = e.clase === 'verificado' ? e.fuente_verificacion || e.fuente : e.fuente;
  const when = String(e.clase === 'verificado' ? e.verificado_el || e.at : e.at || '').slice(0, 10);
  return `${name}${fuente ? ` — ${fuente}` : ''}${when ? ` (${when})` : ''}`;
}
/** El origen de lo que lleva el Cerebro en esta operación, en palabras cortas (para el plan, el recibo y la bandeja de aprobación). */
export const stampText = (s: { clase?: unknown; fuente?: unknown }, lang: 'es' | 'en' = 'es'): string => {
  const c = String(s.clase || ''); const f = String(s.fuente || '').trim(); if (!c && !f) return '';
  return `${(lang === 'en' ? CLASE_EN : CLASE_ES)[c] || ''}${c && f ? ' — ' : ''}${f}`.trim();
};
/** Todo el origen de una ficha, listo para mostrar: { campo: frase } y { relación → destino: frase }. Solo lo que tiene registro. */
export function originsOf(fm: Record<string, any>, lang: 'es' | 'en' = 'es'): { campos: Record<string, string>; relaciones: Record<string, string> } {
  const campos: Record<string, string> = {}, relaciones: Record<string, string> = {};
  if (isObj(fm?.field_sources)) for (const [k, e] of Object.entries(fm.field_sources)) if (isObj(e)) campos[k] = originText(e as SourceEntry, lang);
  if (isObj(fm?.relation_sources)) for (const [rel, by] of Object.entries(fm.relation_sources)) if (isObj(by)) for (const [target, e] of Object.entries(by)) if (isObj(e)) relaciones[`${rel} → ${String(target).replace(/^\[\[|\]\]$/g, '')}`] = originText(e as SourceEntry, lang);
  return { campos, relaciones };
}
