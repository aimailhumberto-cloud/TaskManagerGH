/** Ajustes del Cerebro (IA interna) de cada cerebro. Se guardan junto a su registro, fuera de la bóveda. */
import * as fs from 'fs';
import * as path from 'path';
export const AUTO_KINDS = ['agenda', 'novedades', 'contactos', 'cifras'] as const;
export type AutoKind = (typeof AUTO_KINDS)[number];
export interface CerebroSettings {
  /** Modelo por tarea: rápido para archivar y consultar; grande para pedidos largos. */
  models: { rapido: string; grande: string };
  /** Qué se aplica solo, por tipo de cosa. Lo que esté en false espera aprobación. */
  auto: Record<AutoKind, boolean>;
  /** Resumen: 'auto' si todo se aplica solo, 'proponer' si nada, 'mixto' si depende del tipo. */
  mode: 'proponer' | 'auto' | 'mixto';
  /** Un pedido es grande (va a propuesta) si toca más de N fichas o crea más de M. */
  bigTouch: number; bigCreate: number;
  /** ¿Puede un agente con llave aprobar propuestas? Por defecto no: aprueba la persona en la app. */
  agentCanApprove: boolean;
  /** Confianza mínima de Jev para aplicar solo. */
  threshold: number;
  /** Idioma de trabajo de este cerebro: el de los textos fijos que la app escribe dentro de las fichas. */
  workLang: 'es' | 'en';
  /** ¿Ya se eligió (o se tomó del idioma de quien lo usa por primera vez)? */
  workLangSet: boolean;
}
const dir = (vaultPath: string) => path.join(path.dirname(path.resolve(vaultPath)), 'dots-sleep', 'cerebro');
const file = (vaultPath: string) => path.join(dir(vaultPath), 'settings.json');
export const cerebroDir = dir;
export function defaults(): CerebroSettings {
  const m = process.env.OLLAMA_MODEL?.trim() || 'gemma4';
  return { models: { rapido: m, grande: process.env.OLLAMA_MODEL_LARGE?.trim() || m }, auto: { agenda: true, novedades: true, contactos: false, cifras: false }, mode: 'mixto', bigTouch: 10, bigCreate: 5, agentCanApprove: false, threshold: 0.6, workLang: 'es', workLangSet: false };
}
export function loadSettings(vaultPath: string): CerebroSettings {
  const d = defaults();
  try {
    const s = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8'));
    const str = (v: unknown, f: string) => (typeof v === 'string' && /^[\w.:\-/]{1,80}$/.test(v) ? v : f);
    const num = (v: unknown, f: number, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : f);
    // Compatibilidad: un «mode» guardado sin «auto» significa todo o nada.
    const all = s?.auto && typeof s.auto === 'object' ? null : s?.mode === 'auto' ? true : s?.mode === 'proponer' && s?.modeExplicit ? false : null;
    const auto = Object.fromEntries(AUTO_KINDS.map(k => [k, all !== null ? all : typeof s?.auto?.[k] === 'boolean' ? s.auto[k] : d.auto[k]])) as Record<AutoKind, boolean>;
    const on = AUTO_KINDS.filter(k => auto[k]).length;
    return { models: { rapido: str(s?.models?.rapido, d.models.rapido), grande: str(s?.models?.grande, d.models.grande) }, auto, mode: on === AUTO_KINDS.length ? 'auto' : on === 0 ? 'proponer' : 'mixto',
      bigTouch: num(s?.bigTouch, d.bigTouch, 1, 500), bigCreate: num(s?.bigCreate, d.bigCreate, 1, 500), agentCanApprove: s?.agentCanApprove === true, threshold: s?.thresholdSet ? num(s?.threshold, d.threshold, 0.3, 1) : d.threshold, workLang: s?.workLang === 'en' ? 'en' : 'es', workLangSet: s?.workLang === 'en' || s?.workLang === 'es' };
  } catch { return d; }
}
export function saveSettings(vaultPath: string, patch: Record<string, unknown>): CerebroSettings {
  const cur = loadSettings(vaultPath);
  // «mode» como atajo: auto = todo solo; proponer = todo espera.
  const fromMode = patch.mode === 'auto' ? Object.fromEntries(AUTO_KINDS.map(k => [k, true])) : patch.mode === 'proponer' ? Object.fromEntries(AUTO_KINDS.map(k => [k, false])) : {};
  const merged = { ...cur, ...patch, models: { ...cur.models, ...((patch.models as object) || {}) }, auto: { ...cur.auto, ...fromMode, ...((patch.auto as object) || {}) } };
  delete (merged as any).mode; delete (merged as any).workLangSet;
  if (patch.workLang !== 'en' && patch.workLang !== 'es') { if (cur.workLangSet) (merged as any).workLang = cur.workLang; else delete (merged as any).workLang; } // sin elegir: no se fija por accidente
  if (patch.threshold !== undefined) (merged as any).thresholdSet = true; else if ((cur as any).thresholdSet === undefined) { try { (merged as any).thresholdSet = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')).thresholdSet === true; } catch {} }
  fs.mkdirSync(dir(vaultPath), { recursive: true });
  fs.writeFileSync(file(vaultPath), JSON.stringify(merged, null, 2));
  return loadSettings(vaultPath); // relee y valida
}
