/**
 * El nombre visible de una ficha: el título sin el prefijo de tipo («Distributor: MEDIMEX» → «MEDIMEX»).
 * Vive aparte para que lo usen `brainLens` y el módulo de vecindario sin depender uno del otro.
 */
const PREFIX = /^(distributor|distribuidor|brand|marca|market|mercado|person|persona|dept|department|departamento|customer|cliente|working memory|routine|project|proyecto|core|role|channel|canal|organization|group|line|product line)\s*[:\-–·]\s*/i;
export const displayTitle = (t: unknown) => String(t || '').replace(PREFIX, '').trim();
