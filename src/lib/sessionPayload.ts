export function validSessionPayload(value: any, now = Date.now()): boolean {
  const created = Date.parse(value?.createdAt);
  return !!value && ['userId', 'personId', 'email', 'role'].every(key => typeof value[key] === 'string' && value[key].length > 0) && Number.isFinite(created) && created <= now + 60000 && now - created < 7 * 86400000;
}
export async function validEdgeSession(token: string, secret?: string): Promise<boolean> {
  return (await edgeSessionPayload(token, secret)) !== null;
}
/** Carga útil de la sesión si la firma y la vigencia son válidas; si no, null. */
export async function edgeSessionPayload(token: string, secret?: string): Promise<Record<string, any> | null> {
  try {
    if (!secret || secret.length < 32 || token.length > 4096) return null;
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) return null;
    const decode = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, decode(signature), new TextEncoder().encode(payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    // Las sesiones de cuentas propias deben decir a qué cerebro pertenecen; las anteriores a esa regla caducan.
    if (typeof data?.userId === 'string' && data.userId.startsWith('local-') && typeof data.brain !== 'string') return null;
    return validSessionPayload(data) ? data : null;
  } catch { return null; }
}
