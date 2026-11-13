/**
 * Llaves por agente. Cada llave pertenece a una cuenta, abre SOLO el cerebro de esa cuenta y tiene un alcance:
 *   leer      → solo consultar.
 *   cerebro   → leer todo, y escribir SOLO pidiéndoselo al Cerebro (pedir, consultar, leer, responder; aprobar si la persona lo permite).
 *   (proponer y escribir existen en llaves antiguas; todas las llaves de agente siguen la regla de pedir y consultar.)
 * Se guarda solo el hash; la llave se muestra una única vez al crearla.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { tr } from './reqLang';

/** Alcances que se pueden crear hoy. «proponer» y «escribir» quedan solo para llaves viejas: ninguna llave escribe directo. */
export const SCOPES = ['leer', 'cerebro'] as const;
export type Scope = (typeof SCOPES)[number] | 'proponer' | 'escribir';
export const KEY_PREFIX = 'tmk_';
export const MAX_KEYS_PER_ACCOUNT = 5;

export interface AgentKey { id: string; accountId: string; name: string; scope: Scope; hash: string; hint: string; createdAt: string; lastUsedAt?: string; revokedAt?: string }
export type PublicAgentKey = Omit<AgentKey, 'hash'>;
export class KeyError extends Error { constructor(message: string, public status = 400) { super(message); } }

export function keysFile(): string {
  if (process.env.AGENT_KEYS_FILE) return process.env.AGENT_KEYS_FILE;
  const { getPrimaryVaultPath } = require('./smjBrainService');
  return path.join(path.dirname(path.resolve(getPrimaryVaultPath())), 'accounts', 'agent-keys.json');
}
const sha = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const strip = ({ hash: _h, ...rest }: AgentKey): PublicAgentKey => rest;
function load(): AgentKey[] { try { const d = JSON.parse(fs.readFileSync(keysFile(), 'utf8')); return Array.isArray(d.keys) ? d.keys : []; } catch { return []; } }
function save(keys: AgentKey[]) {
  const f = keysFile(); fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, keys }, null, 2), { mode: 0o600 }); fs.renameSync(tmp, f);
}

export const looksLikeAgentKey = (v: string) => v.startsWith(KEY_PREFIX);
export const listKeys = (accountId: string): PublicAgentKey[] => load().filter(k => k.accountId === accountId).map(strip);

export function createKey(accountId: string, name: string, scope: string): { key: string; record: PublicAgentKey } {
  const clean = String(name || '').trim().slice(0, 60);
  if (clean.length < 2) throw new KeyError('Ponle un nombre al agente (2 a 60 caracteres).');
  if (!(SCOPES as readonly string[]).includes(scope)) throw new KeyError(tr('Alcance no válido.', 'Invalid scope.'));
  const keys = load();
  if (keys.filter(k => k.accountId === accountId && !k.revokedAt).length >= MAX_KEYS_PER_ACCOUNT) throw new KeyError(tr(`Máximo ${MAX_KEYS_PER_ACCOUNT} llaves activas. Revoca una primero.`, `Maximum ${MAX_KEYS_PER_ACCOUNT} active keys. Revoke one first.`), 409);
  const id = crypto.randomBytes(4).toString('hex');
  const key = `${KEY_PREFIX}${id}_${crypto.randomBytes(32).toString('hex')}`;
  const rec: AgentKey = { id, accountId, name: clean, scope: scope as Scope, hash: sha(key), hint: `${KEY_PREFIX}${id}_…${key.slice(-4)}`, createdAt: new Date().toISOString() };
  save([...keys, rec]);
  return { key, record: strip(rec) };
}

export function revokeKey(accountId: string, id: string): PublicAgentKey {
  const keys = load();
  const k = keys.find(x => x.id === id && x.accountId === accountId);
  if (!k) throw new KeyError(tr('Llave no encontrada.', 'Key not found.'), 404);
  if (!k.revokedAt) { k.revokedAt = new Date().toISOString(); save(keys); }
  return strip(k);
}

/** Devuelve la llave si es válida y no está revocada. Comparación en tiempo constante sobre el hash. */
export function verifyKey(presented: string): PublicAgentKey | null {
  if (!looksLikeAgentKey(presented) || presented.length > 200) return null;
  const id = presented.slice(KEY_PREFIX.length).split('_')[0];
  const keys = load();
  const k = keys.find(x => x.id === id);
  const a = Buffer.from(sha(presented), 'hex'), b = Buffer.from(k?.hash || '00'.repeat(32), 'hex');
  if (!k || k.revokedAt || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const now = Date.now();
  if (!k.lastUsedAt || now - Date.parse(k.lastUsedAt) > 5 * 60_000) { k.lastUsedAt = new Date(now).toISOString(); try { save(keys); } catch {} }
  return strip(k);
}

export function presentedKey(headers: { get(name: string): string | null }): string {
  const auth = headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return bearer || headers.get('x-agent-key')?.trim() || '';
}
