/**
 * Cuentas propias de la app (usuarios y perfiles creados desde el área «Usuarios»).
 * Viven en un JSON en el disco persistente, fuera de la bóveda y fuera de Supabase.
 * Contraseñas con scrypt + sal propia. Nunca se devuelven hash ni sal.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const ROLES = ['Owner', 'Admin', 'Gerente', 'Miembro', 'Solo lectura'] as const;
export type LocalRole = (typeof ROLES)[number];
export const MANAGER_ROLES: string[] = ['Owner', 'Admin', 'Gerente'];
export const TOP_ROLES: string[] = ['Owner', 'Admin'];
export const MIN_PASSWORD = 12;

export interface LocalAccount {
  id: string; email: string; name: string; role: LocalRole; isActive: boolean;
  salt: string; hash: string; mustChange: boolean;
  createdAt: string; createdBy: string; lastLoginAt?: string; passwordChangedAt?: string;
}
export type PublicAccount = Omit<LocalAccount, 'salt' | 'hash'>;
export class AccountError extends Error { constructor(message: string, public status = 400) { super(message); } }

export const isLocalId = (id: unknown): id is string => typeof id === 'string' && id.startsWith('local-');
export const canManageUsers = (role: unknown) => typeof role === 'string' && MANAGER_ROLES.includes(role);

export function accountsFile(): string {
  if (process.env.LOCAL_ACCOUNTS_FILE) return process.env.LOCAL_ACCOUNTS_FILE;
  const { getVaultPath } = require('./smjBrainService');
  return path.join(path.dirname(path.resolve(getVaultPath())), 'accounts', 'accounts.json');
}

const hashPw = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
const strip = ({ salt: _s, hash: _h, ...rest }: LocalAccount): PublicAccount => rest;

function load(file = accountsFile()): LocalAccount[] {
  try { const d = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(d.accounts) ? d.accounts : []; } catch { return []; }
}
function save(accounts: LocalAccount[], file = accountsFile()) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, accounts }, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > 256) return 'La contraseña es demasiado larga.';
  if (/^(.)\1+$/.test(password)) return 'La contraseña es demasiado simple.';
  return null;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const listAccounts = (): PublicAccount[] => load().map(strip);
export const getAccount = (id: string): LocalAccount | null => load().find(a => a.id === id) || null;
export const hasManager = () => load().some(a => a.isActive && MANAGER_ROLES.includes(a.role));

export function createAccount(input: { email: string; name: string; role: string; password: string; createdBy: string; mustChange?: boolean }): PublicAccount {
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.name || '').trim();
  if (!EMAIL.test(email) || email.length > 320) throw new AccountError('Correo no válido.');
  if (name.length < 2 || name.length > 120) throw new AccountError('Escribe el nombre (2 a 120 caracteres).');
  if (!(ROLES as readonly string[]).includes(input.role)) throw new AccountError('Rol no válido.');
  const bad = validatePassword(input.password);
  if (bad) throw new AccountError(bad);
  const accounts = load();
  if (accounts.some(a => a.email === email)) throw new AccountError('Ese correo ya tiene una cuenta.', 409);
  const max = accounts.reduce((m, a) => Math.max(m, Number(a.id.replace('local-', '')) || 0), 0);
  const salt = crypto.randomBytes(16).toString('hex');
  const acc: LocalAccount = {
    id: `local-${max + 1}`, email, name, role: input.role as LocalRole, isActive: true, salt, hash: hashPw(input.password, salt),
    mustChange: input.mustChange ?? false, createdAt: new Date().toISOString(), createdBy: input.createdBy,
  };
  save([...accounts, acc]);
  return strip(acc);
}

/** Devuelve la cuenta si correo y contraseña son correctos y está activa. Tiempo constante aunque no exista. */
export function authenticateLocal(email: string, password: string): PublicAccount | null {
  const accounts = load();
  const acc = accounts.find(a => a.email === String(email).trim().toLowerCase());
  const salt = acc?.salt || '00'.repeat(16);
  const actual = Buffer.from(hashPw(password, salt), 'hex');
  const expected = Buffer.from(acc?.hash || '00'.repeat(64), 'hex');
  const ok = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (!acc || !ok || !acc.isActive) return null;
  acc.lastLoginAt = new Date().toISOString();
  save(accounts);
  return strip(acc);
}

export function updateAccount(id: string, patch: { isActive?: boolean; role?: string; name?: string; newPassword?: string; mustChange?: boolean }, actor: { id: string; role: string }): PublicAccount {
  const accounts = load();
  const acc = accounts.find(a => a.id === id);
  if (!acc) throw new AccountError('Cuenta no encontrada.', 404);
  const actorTop = TOP_ROLES.includes(actor.role);
  if (!actorTop && (TOP_ROLES.includes(acc.role) || (patch.role && TOP_ROLES.includes(patch.role)))) throw new AccountError('Solo un Admin u Owner puede tocar cuentas Admin u Owner.', 403);
  const activeManagers = (list: LocalAccount[]) => list.filter(a => a.isActive && MANAGER_ROLES.includes(a.role)).length;
  if (patch.role !== undefined) { if (!(ROLES as readonly string[]).includes(patch.role)) throw new AccountError('Rol no válido.'); acc.role = patch.role as LocalRole; }
  if (patch.name !== undefined) { const n = patch.name.trim(); if (n.length < 2 || n.length > 120) throw new AccountError('Nombre no válido.'); acc.name = n; }
  if (patch.isActive !== undefined) { if (id === actor.id && !patch.isActive) throw new AccountError('No puedes desactivar tu propia cuenta.'); acc.isActive = patch.isActive; }
  if (patch.newPassword !== undefined) {
    const bad = validatePassword(patch.newPassword); if (bad) throw new AccountError(bad);
    acc.salt = crypto.randomBytes(16).toString('hex'); acc.hash = hashPw(patch.newPassword, acc.salt);
    acc.mustChange = patch.mustChange ?? true; acc.passwordChangedAt = new Date().toISOString();
  }
  if (activeManagers(accounts) === 0) throw new AccountError('Debe quedar al menos un usuario activo que pueda administrar usuarios.');
  save(accounts);
  return strip(acc);
}

export function changeOwnPassword(id: string, current: string, next: string): void {
  const accounts = load();
  const acc = accounts.find(a => a.id === id);
  if (!acc) throw new AccountError('Cuenta no encontrada.', 404);
  const a = Buffer.from(hashPw(current, acc.salt), 'hex'), b = Buffer.from(acc.hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new AccountError('La contraseña actual no es correcta.', 403);
  const bad = validatePassword(next); if (bad) throw new AccountError(bad);
  acc.salt = crypto.randomBytes(16).toString('hex'); acc.hash = hashPw(next, acc.salt);
  acc.mustChange = false; acc.passwordChangedAt = new Date().toISOString();
  save(accounts);
}

export function setupTokenValid(given: unknown, configured = process.env.SETUP_TOKEN): boolean {
  if (typeof given !== 'string' || !configured || configured.length < 16) return false;
  const a = crypto.createHash('sha256').update(given).digest(), b = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(a, b);
}
