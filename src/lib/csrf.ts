import { createHmac, timingSafeEqual } from 'crypto';
export function csrfToken(sessionToken: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Sesión no configurada.');
  return createHmac('sha256', secret).update('taskmanager-csrf:' + sessionToken).digest('hex');
}
export function validCsrf(sessionToken: string, token: string | null): boolean {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(csrfToken(sessionToken), 'hex');
  const actual = Buffer.from(token, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
