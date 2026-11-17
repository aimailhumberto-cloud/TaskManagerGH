/**
 * Qué idioma usar cuando una persona entra. Sin imports: lo usan el servidor, el middleware (borde) y las pruebas.
 * Orden: 1) lo que la persona eligió (cookie)  2) el idioma de su navegador, si es español o inglés  3) inglés.
 * Inglés por defecto porque S.M. Jaleel & Co. trabaja en inglés; quien tenga el navegador en español entra en español.
 */
export type PickedLang = 'es' | 'en';
const SUPPORTED: readonly PickedLang[] = ['es', 'en'];
const asPicked = (v: unknown): PickedLang | null => (v === 'es' || v === 'en' ? v : null);

/** Del encabezado Accept-Language («es-419,es;q=0.9,en;q=0.8»): el primer idioma que la app entiende, por orden de preferencia; null si ninguno. */
export function fromAcceptLanguage(header: string | null | undefined): PickedLang | null {
  if (!header) return null;
  const items = String(header).split(',').map((p, i) => {
    const [tag, ...params] = p.trim().split(';'); const q = params.map(x => /^\s*q\s*=\s*([\d.]+)/i.exec(x)?.[1]).find(Boolean);
    return { tag: tag.trim().toLowerCase(), q: q === undefined ? 1 : Number(q), i };
  }).filter(x => x.tag && x.tag !== '*' && Number.isFinite(x.q) && x.q > 0);
  items.sort((a, b) => b.q - a.q || a.i - b.i);
  for (const it of items) { const primary = it.tag.split('-')[0] as PickedLang; if ((SUPPORTED as readonly string[]).includes(primary)) return primary; }
  return null;
}

export function pickLang(o: { cookie?: string | null; accept?: string | null }): PickedLang {
  return asPicked(o.cookie) ?? fromAcceptLanguage(o.accept) ?? 'en';
}
