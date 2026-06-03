import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SESSION_SECRET = process.env.SESSION_SECRET || 'hermes-default-secure-secret-key-32-chars';

// Generate a static 32-character key deterministically from our secret
const SECRET_KEY = crypto.scryptSync(SESSION_SECRET, 'salt', 32);
const IV_LENGTH = 16;

export interface SessionData {
  userId: string;
  personId: string;
  email: string;
  role: string;
  companyId?: string;
  createdAt: string;
}

/**
 * Encrypts a session payload into a secure string.
 */
export function encryptSession(sessionData: SessionData): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(sessionData), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a secure session string back into its original payload.
 * Returns null if the token is invalid or has been tampered with.
 */
export function decryptSession(token: string): SessionData | null {
  try {
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted) as SessionData;
  } catch (e) {
    return null;
  }
}
