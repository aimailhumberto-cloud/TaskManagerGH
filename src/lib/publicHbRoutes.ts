/** Edge-safe allowlist. No account/session objects or data modules imported here. */
export const publicHbPath = (path: string) => ['/', '/empresas', '/agenda', '/supervision', '/buscar', '/workspace/hb-lake-hero.png'].includes(path);
