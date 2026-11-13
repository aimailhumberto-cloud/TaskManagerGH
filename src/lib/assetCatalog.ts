import CATALOG_JSON from '../../public/brands/catalog.json';

/** Biblioteca de imágenes de marca. Las de fábrica viven en public/brands (catálogo generado por scripts/build-asset-catalog.mjs). */
export interface BrandAsset { id: string; url: string; thumb: string; brand: string; kind: string; w?: number; h?: number; bytes?: number; custom?: boolean; label?: string }
export const BUILTIN_ASSETS: BrandAsset[] = CATALOG_JSON as BrandAsset[];

/** Palabras que delatan cada marca en el título o el identificador de una ficha. La más específica va primero. */
const BRAND_WORDS: [string, RegExp][] = [
  ['kool-kidz', /kool[\s_-]?kidz/], ['caribbean-cool', /caribbean[\s_-]?cool/], ['cole-cold', /cole[\s_-]?cold/], ['island-fusion', /island[\s_-]?fusion/],
  ['trinidad-juices', /trinidad[\s_-]?juices/], ['juciful', /juciful/], ['frutopia', /frutopia/], ['chubby', /chubby/], ['busta', /busta/], ['fruta', /fruta/],
  ['oasis', /oasis/], ['altitude', /altitude/], ['freshh', /freshh/], ['turbo', /turbo/], ['classic', /\bclassic\b/], ['viva', /\bviva\b/], ['medimex', /medimex/],
];
const KIND_ORDER = ['logo', 'tile', 'product', 'banner'];
/** Imagen preferida de cada marca; si no hay una fijada, la primera por tipo (logo, mosaico, producto). */
const PREFERRED: Record<string, string> = { chubby: 'chubby', busta: 'busta', fruta: 'fruta', oasis: 'oasis', altitude: 'altitude', medimex: 'medimex-logo', smjaleel: 'smjaleel-white' };
const byId = new Map(BUILTIN_ASSETS.map(a => [a.id, a]));

export function brandOf(text: string): string | null {
  const t = (text || '').toLowerCase();
  for (const [brand, re] of BRAND_WORDS) if (re.test(t)) return brand;
  return null;
}
export function defaultAssetForBrand(brand: string): BrandAsset | null {
  const fixed = PREFERRED[brand] && byId.get(PREFERRED[brand]); if (fixed) return fixed;
  const mine = BUILTIN_ASSETS.filter(a => a.brand === brand);
  for (const k of KIND_ORDER) { const a = mine.find(x => x.kind === k); if (a) return a; }
  return mine[0] || null;
}
/** Tipos de ficha a los que se les pone sola la imagen de su marca. Personas, mercados y tareas no: una coincidencia de nombre no basta. */
const AUTO_TYPES = new Set(['brand', 'line', 'flavor', 'product', 'sku', 'packaging', 'product_variant', 'catalog_listing', 'portfolio', 'category', 'core', 'distributor']);
/**
 * Imagen que le toca a una ficha sin foto propia: la de su marca si el tipo lo permite y el nombre la delata.
 * Devuelve null si la ficha ya tiene foto, si no es de un tipo de catálogo o si no se reconoce la marca.
 */
export function autoAssetFor(node: { id: string; title?: string; type?: string; frontmatter?: Record<string, any> }): BrandAsset | null {
  const fm = node.frontmatter || {};
  if (fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url) return null;
  if (fm.asset_auto === false) return null;
  const type = String(node.type || '').toLowerCase();
  if (type === 'core') return defaultAssetForBrand('smjaleel');
  if (!AUTO_TYPES.has(type)) return null;
  const brand = brandOf(`${node.id} ${node.title || ''} ${fm.brand || ''} ${fm.line || ''}`);
  if (!brand) return null;
  if (type === 'distributor' && brand !== 'medimex') return null;
  return defaultAssetForBrand(brand);
}
