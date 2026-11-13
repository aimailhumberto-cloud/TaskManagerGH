/**
 * Reintentos sin duplicados: si un agente manda la misma petición dos veces con la misma clave
 * (encabezado Idempotency-Key o x-request-id, o campo requestId), la segunda no se aplica: recibe la
 * misma respuesta. Se guarda por cerebro y por quien pide, 48 horas, hasta 500 claves.
 */
import * as fs from 'fs';
import * as path from 'path';

const KEEP_MS = 48 * 3600_000, MAX = 500;
const file = (vaultPath: string) => path.join(path.dirname(path.resolve(vaultPath)), 'dots-sleep', 'idempotency.json');
type Rec = { at: string; status: number; body: unknown };
function load(vaultPath: string): Record<string, Rec> { try { return JSON.parse(fs.readFileSync(file(vaultPath), 'utf8')) || {}; } catch { return {}; } }

export function idemGet(vaultPath: string, actor: string, key: string): Rec | null {
  const r = load(vaultPath)[`${actor}|${key}`];
  return r && Date.now() - Date.parse(r.at) < KEEP_MS ? r : null;
}
export function idemSave(vaultPath: string, actor: string, key: string, status: number, body: unknown) {
  if (status >= 500) return; // un error del servidor se puede reintentar
  const all = load(vaultPath); const now = Date.now();
  all[`${actor}|${key}`] = { at: new Date(now).toISOString(), status, body };
  const kept = Object.entries(all).filter(([, v]) => now - Date.parse(v.at) < KEEP_MS).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, MAX);
  const f = file(vaultPath); fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(kept))); fs.renameSync(tmp, f);
}
