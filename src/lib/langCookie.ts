/** La preferencia de idioma de la pantalla también vive en una cookie, para que el servidor dibuje la página ya en ese idioma (sin salto). */
export const LANG_COOKIE = 'cerebro_lang';
export function writeLangCookie(l: 'es' | 'en') {
  try { document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`; } catch {}
}
