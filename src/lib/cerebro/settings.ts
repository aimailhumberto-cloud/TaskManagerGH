/** Ajustes del Cerebro (IA interna) de cada cerebro. Se guardan junto a su registro, fuera de la bóveda. */
import * as fs from 'fs';
import * as path from 'path';
export interface CerebroSettings {
  /** Modelo por tarea: rápido para archivar y consultar; grande para pedidos largos. */
  models: { rapido: string; grande: string };
  /** proponer = todo espera aprobación; auto = lo mecánico se aplica solo. */
  mode: 'proponer' | 'auto';
  /** Un pedido es grande (va a propuesta) si toca más de N fichas o crea más de M. */
  bigTouch: number; bigCreate: number;
  /** ¿Puede un agente con llave aprobar propuestas? Por defecto no: aprueba la persona en la app. */
  agentCanApprove: boolean;
  /** Confianza mínima de Jev para aplicar solo. */
  threshold: number;
}
const dir = (vaultPath: string) => path.join(path.dirname(path.resolve(vaultPath)), 'dots-sleep', 'cerebro');
const file = (vaultPath: string) => path.join(dir(vaultPath), 'settings.json');
export const cerebroDir = dir;
export function defaults(): CerebroSettings {
  const m = process.env.OLLAMA_MODEL?.trim() || 'gemma4';
  return { models: { rapido: m, grande: process.env.OLLAMA_MODEL_LARGE?.trim() || m }, mode: 'proponer', bigTouch: 10, bigCreate: 5, agentCanApprove: false, threshold: 0.85 };
}
export function loadSettings(vaultPath: string): CerebroSettings {
  const d = defaults();
  try {
    const s = JSON.parse(fs.readFileSync(file(vaultPath), 'utf8'));
    const str = (v: unknown, f: string) => (typeof v === 'string' && /^[\w.:\-/]{1,80}$/.test(v) ? v : f);
    const num = (v: unknown, f: number, lo: number, hi: number) => (typeof v === 'number' && v >= lo && v <= hi ? v : f);
    return { models: { rapido: str(s?.models?.rapido, d.models.rapido), grande: str(s?.models?.grande, d.models.grande) }, mode: s?.mode === 'auto' ? 'auto' : 'proponer',
      bigTouch: num(s?.bigTouch, d.bigTouch, 1, 500), bigCreate: num(s?.bigCreate, d.bigCreate, 1, 500), agentCanApprove: s?.agentCanApprove === true, threshold: num(s?.threshold, d.threshold, 0.5, 1) };
  } catch { return d; }
}
export function saveSettings(vaultPath: string, patch: Record<string, unknown>): CerebroSettings {
  const cur = loadSettings(vaultPath);
  const merged = { ...cur, ...patch, models: { ...cur.models, ...((patch.models as object) || {}) } };
  fs.mkdirSync(dir(vaultPath), { recursive: true });
  fs.writeFileSync(file(vaultPath), JSON.stringify(merged, null, 2));
  return loadSettings(vaultPath); // relee y valida
}
