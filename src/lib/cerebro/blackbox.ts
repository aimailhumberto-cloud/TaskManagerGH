/**
 * Caja negra: cada llamada de un agente al Cerebro queda guardada tal como llegó (sin llaves),
 * con lo que se entendió y lo que se contestó. Sirve para saber qué mandó de verdad un agente.
 * Registrar nunca puede hacer fallar la llamada.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { cerebroDir } from './settings';
import { redact } from './intake';

export interface Call {
  id: string; at: string; actor: string; via?: string; method: string; path: string; action?: string;
  campos: string[]; tieneMd: boolean; mdChars: number; textChars: number; raw?: unknown; contentType?: string;
  arreglos: string[]; status?: number; blocked?: boolean; repeated?: boolean;
  salida?: { ok?: boolean; status?: string; caso?: string; mensaje?: string }; ms?: number;
}
const file = (v: string) => path.join(cerebroDir(v), 'blackbox.jsonl');
const MAX_BYTES = 2_000_000, KEEP = 300;

export function recordCall(vault: string, c: Omit<Call, 'id' | 'at'>) {
  try {
    fs.mkdirSync(cerebroDir(vault), { recursive: true });
    const f = file(vault);
    try { if (fs.statSync(f).size > MAX_BYTES) { const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-KEEP); fs.writeFileSync(f, lines.join('\n') + '\n'); } } catch { /* no existe aún */ }
    const e: Call = { id: 'call-' + crypto.randomBytes(4).toString('hex'), at: new Date().toISOString(), ...c, raw: redact(c.raw) };
    fs.appendFileSync(f, JSON.stringify(e) + '\n');
  } catch { /* nunca falla la llamada */ }
}
export function listCalls(vault: string, n = 50): Call[] {
  try { return fs.readFileSync(file(vault), 'utf8').split('\n').filter(Boolean).slice(-Math.max(1, Math.min(n, 200))).map(l => JSON.parse(l) as Call).reverse(); } catch { return []; }
}
