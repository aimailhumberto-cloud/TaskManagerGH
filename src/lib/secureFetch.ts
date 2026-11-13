import { trc as tr } from './trClient';
export async function secureFetch(url: string, options: RequestInit): Promise<Response> {
  const access = await fetch('/api/auth/csrf', { cache: 'no-store' });
  if (!access.ok) throw new Error(tr('La sesión venció o no pudo verificarse. Inicia sesión y reintenta.', 'The session expired or could not be verified. Sign in and try again.'));
  const { token } = await access.json();
  return fetch(url, { ...options, headers: { ...options.headers, 'X-CSRF-Token': token } });
}
