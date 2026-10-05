import * as crypto from 'crypto';
import { validSessionPayload } from './sessionPayload';
export interface SessionData {
  userId: string; personId: string; email: string; role: string;
  companyId?: string; createdAt: string;
}
export function encryptSession(session: SessionData): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe configurarse antes de iniciar sesión.');
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
export function decryptSession(token: string): SessionData | null {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32 || token.length > 4096) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return validSessionPayload(session) ? session : null;
  } catch { return null; }
}
