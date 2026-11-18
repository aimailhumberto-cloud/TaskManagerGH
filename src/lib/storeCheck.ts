/**
 * Store check (visitas a tienda). Pestaña aparte: NO toca el Cerebro ni el vault.
 * Aquí van los tipos y las reglas puras (limpiar lo que llega, resumir, exportar). El guardado está en storeCheckStore.ts.
 */

export const COUNTRIES = ['Panamá', 'Miami', 'Otro'] as const;
export const CHANNELS = ['Supermercado', 'Minisúper', 'Conveniencia / gasolinera', 'Farmacia', 'Mayorista', 'Club de precios', 'Tienda de barrio', 'Otro'] as const;
export const PRESENCE = ['si', 'no', 'agotado'] as const;          // agotado = listado pero con hueco en el estante
export const PLACES = ['gondola', 'shelf', 'punta', 'caja', 'frio', 'piso'] as const;
export const POSITIONS = ['1', '2', '3+'] as const;
export const HEIGHTS = ['ojos', 'manos', 'pies', 'arriba'] as const;
export const CONDITIONS = ['bien', 'regular', 'mal'] as const;
export const COLD_OWNERS = ['nuestro', 'tienda', 'competencia', 'mixto'] as const;
export const SECOND_SPOTS = ['punta', 'caja', 'exhibidor', 'isla', 'frio_caja', 'otro'] as const;
export const PHOTO_TAGS = ['general', 'producto', 'frio', 'competencia', 'promo', 'segundo_punto'] as const;

export type Tri = boolean | null;
export interface CatalogProduct { id: string; brand: string; name: string; category: string; flavors: string[]; suggestedPrice: number | null; active: boolean }
export interface Catalog { products: CatalogProduct[]; competitors: { brand: string; category: string }[]; updatedAt?: string }

export interface ProductCheck {
  productId: string; name: string; brand: string;
  presence: '' | (typeof PRESENCE)[number];
  place: '' | (typeof PLACES)[number];
  position: '' | (typeof POSITIONS)[number];
  height: '' | (typeof HEIGHTS)[number];
  facings: number | null;          // frentes
  shelfShare: number | null;       // % del espacio de la categoría
  flavorsFound: string[];          // sabores/presentaciones vistos
  price: number | null;            // precio en estante
  priceTag: Tri;                   // ¿tiene precio comunicado?
  promo: Tri; promoDetail: string;
  inCold: Tri;
  expiry: string;                  // fecha de vencimiento más cercana (AAAA-MM-DD o texto)
  condition: '' | (typeof CONDITIONS)[number];
  backstock: Tri;                  // inventario en bodega
  notes: string;
}
export interface CompetitorCheck { id: string; brand: string; product: string; category: string; price: number | null; promo: Tri; promoDetail: string; facings: number | null; position: '' | (typeof POSITIONS)[number]; inCold: Tri; newLaunch: Tri; notes: string }
export interface Photo { id: string; file: string; tag: (typeof PHOTO_TAGS)[number]; productId: string; caption: string; at: string; size: number }
export interface Visit {
  id: string; status: 'abierta' | 'cerrada';
  createdAt: string; updatedAt: string; checkIn: string; checkOut: string;
  by: { id: string; name: string };
  store: { name: string; chain: string; channel: string; country: string; city: string; address: string; contact: string; contactPhone: string };
  location: { lat: number; lng: number; accuracy: number | null } | null;
  products: ProductCheck[];
  competitors: CompetitorCheck[];
  cold: { has: Tri; owner: '' | (typeof COLD_OWNERS)[number]; doors: number | null; ourShare: number | null; foreignInOurs: Tri; working: Tri; clean: Tri; notes: string };
  secondary: { has: Tri; where: string[]; notes: string };
  pop: { ours: Tri; competitors: Tri; notes: string };
  score: number | null; notes: string; followUps: string;
  photosPending: boolean;
  photos: Photo[];
}

export const DEFAULT_CATALOG: Catalog = {
  products: [
    { id: 'busta', brand: 'Busta', name: 'Busta', category: 'Refrescos', flavors: [], suggestedPrice: null, active: true },
    { id: 'chubby', brand: 'Chubby', name: 'Chubby', category: 'Bebidas infantiles', flavors: [], suggestedPrice: null, active: true },
    { id: 'fruta', brand: 'Fruta', name: 'Fruta', category: 'Jugos', flavors: [], suggestedPrice: null, active: true },
    { id: 'oasis', brand: 'Oasis', name: 'Oasis', category: 'Agua', flavors: [], suggestedPrice: null, active: true },
    { id: 'altitude', brand: 'Altitude', name: 'Altitude', category: 'Agua', flavors: [], suggestedPrice: null, active: true },
  ],
  competitors: [],
};

// ---------------- limpieza ----------------
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').trim().slice(0, max);
const num = (v: unknown, min = 0, max = 1e7, decimals = 2): number | null => {
  if (v === '' || v == null) return null;
  const txt = typeof v === 'number' ? '' : String(v).replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (typeof v !== 'number' && !/\d/.test(txt)) return null;
  const n = typeof v === 'number' ? v : Number(txt);
  const k = 10 ** decimals;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * k) / k : null;
};
const tri = (v: unknown): Tri => (v === true || v === 'si' || v === 'true' ? true : v === false || v === 'no' || v === 'false' ? false : null);
function pick<T extends readonly string[]>(v: unknown, list: T): '' | T[number] { const s = str(v, 40); return (list as readonly string[]).includes(s) ? (s as T[number]) : ''; }
const list = (v: unknown, max = 40, each = 80) => (Array.isArray(v) ? v : []).map(x => str(x, each)).filter(Boolean).slice(0, max);
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{2,60}$/i.test(v);
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function cleanProduct(p: any): ProductCheck {
  return {
    productId: str(p?.productId, 60), name: str(p?.name, 120), brand: str(p?.brand, 80),
    presence: pick(p?.presence, PRESENCE), place: pick(p?.place, PLACES), position: pick(p?.position, POSITIONS), height: pick(p?.height, HEIGHTS),
    facings: num(p?.facings, 0, 500), shelfShare: num(p?.shelfShare, 0, 100), flavorsFound: list(p?.flavorsFound),
    price: num(p?.price, 0, 100000), priceTag: tri(p?.priceTag), promo: tri(p?.promo), promoDetail: str(p?.promoDetail, 300),
    inCold: tri(p?.inCold), expiry: str(p?.expiry, 30), condition: pick(p?.condition, CONDITIONS), backstock: tri(p?.backstock), notes: str(p?.notes, 1000),
  };
}
export function cleanCompetitor(c: any, i = 0): CompetitorCheck {
  return {
    id: isId(c?.id) ? c.id : `c${i}-${Date.now().toString(36)}`, brand: str(c?.brand, 80), product: str(c?.product, 120), category: str(c?.category, 80),
    price: num(c?.price, 0, 100000), promo: tri(c?.promo), promoDetail: str(c?.promoDetail, 300), facings: num(c?.facings, 0, 500),
    position: pick(c?.position, POSITIONS), inCold: tri(c?.inCold), newLaunch: tri(c?.newLaunch), notes: str(c?.notes, 1000),
  };
}

/** Limpia una visita que llega del teléfono. Las fotos NO vienen del cliente: se conservan las que ya tiene el servidor. */
export function cleanVisit(input: any, prev: Visit | null, by: { id: string; name: string }, now = new Date().toISOString()): Visit {
  const s = input?.store || {}, loc = input?.location, cold = input?.cold || {}, sec = input?.secondary || {}, pop = input?.pop || {};
  const lat = num(loc?.lat, -90, 90, 6), lng = num(loc?.lng, -180, 180, 6);
  const status = input?.status === 'cerrada' ? 'cerrada' : 'abierta';
  return {
    id: prev?.id || (isId(input?.id) ? input.id : newId()),
    status,
    createdAt: prev?.createdAt || now, updatedAt: now,
    checkIn: prev?.checkIn || str(input?.checkIn, 40) || now,
    checkOut: status === 'cerrada' ? prev?.checkOut || str(input?.checkOut, 40) || now : '',
    by: prev?.by || by,
    store: {
      name: str(s.name, 120), chain: str(s.chain, 80), channel: str(s.channel, 60), country: str(s.country, 40) || 'Panamá', city: str(s.city, 80),
      address: str(s.address, 200), contact: str(s.contact, 120), contactPhone: str(s.contactPhone, 40),
    },
    location: lat !== null && lng !== null ? { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, accuracy: num(loc?.accuracy, 0, 1e6) } : prev?.location || null,
    products: (Array.isArray(input?.products) ? input.products : []).slice(0, 200).map(cleanProduct).filter((p: ProductCheck) => p.productId || p.name),
    competitors: (Array.isArray(input?.competitors) ? input.competitors : []).slice(0, 100).map(cleanCompetitor).filter((c: CompetitorCheck) => c.brand || c.product),
    cold: { has: tri(cold.has), owner: pick(cold.owner, COLD_OWNERS), doors: num(cold.doors, 0, 100), ourShare: num(cold.ourShare, 0, 100), foreignInOurs: tri(cold.foreignInOurs), working: tri(cold.working), clean: tri(cold.clean), notes: str(cold.notes, 1000) },
    secondary: { has: tri(sec.has), where: list(sec.where, 10, 40).filter(w => (SECOND_SPOTS as readonly string[]).includes(w)), notes: str(sec.notes, 1000) },
    pop: { ours: tri(pop.ours), competitors: tri(pop.competitors), notes: str(pop.notes, 1000) },
    score: num(input?.score, 1, 5), notes: str(input?.notes, 3000), followUps: str(input?.followUps, 3000),
    photosPending: !!input?.photosPending,
    photos: prev?.photos || [],
  };
}

export function newId(d = new Date()): string {
  return `v${d.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanCatalog(input: any): Catalog {
  const seen = new Set<string>();
  const products = (Array.isArray(input?.products) ? input.products : []).slice(0, 300).map((p: any) => {
    const name = str(p?.name, 120), brand = str(p?.brand, 80);
    let id = isId(p?.id) ? p.id : slug(`${brand}-${name}`) || `p${seen.size}`;
    while (seen.has(id)) id = `${id}-x`;
    seen.add(id);
    return { id, brand, name: name || brand, category: str(p?.category, 80), flavors: list(p?.flavors, 60, 60), suggestedPrice: num(p?.suggestedPrice, 0, 100000), active: p?.active !== false };
  }).filter((p: CatalogProduct) => p.name);
  const competitors = (Array.isArray(input?.competitors) ? input.competitors : []).slice(0, 200).map((c: any) => ({ brand: str(c?.brand, 80), category: str(c?.category, 80) })).filter((c: { brand: string }) => c.brand);
  return { products, competitors, updatedAt: new Date().toISOString() };
}

// ---------------- resumen ----------------
export interface VisitSummary { products: number; present: number; missing: number; outOfStock: number; firstPosition: number; withPromo: number; facings: number; offPrice: number; photos: number; issues: string[] }

/** Lo que salta a la vista de una visita: cuántos productos hay, cuáles faltan, precio fuera de lo sugerido. */
export function summarize(v: Visit, catalog?: Catalog): VisitSummary {
  const sug = new Map((catalog?.products || []).map(p => [p.id, p.suggestedPrice]));
  const checked = v.products.filter(p => p.presence);
  const present = checked.filter(p => p.presence === 'si');
  const offPrice = present.filter(p => { const s = sug.get(p.productId); return s != null && p.price != null && Math.abs(p.price - s) / s > 0.05; });
  const issues: string[] = [];
  for (const p of checked) if (p.presence === 'no') issues.push(`No está: ${p.name}`); else if (p.presence === 'agotado') issues.push(`Agotado: ${p.name}`);
  for (const p of offPrice) issues.push(`Precio distinto al sugerido: ${p.name} (${p.price} vs ${sug.get(p.productId)})`);
  for (const p of present) if (p.condition === 'mal') issues.push(`Producto en mal estado: ${p.name}`);
  if (v.cold.has && v.cold.owner === 'nuestro' && v.cold.foreignInOurs) issues.push('Nuestro frío tiene producto ajeno');
  if (v.cold.has && v.cold.owner === 'nuestro' && v.cold.working === false) issues.push('Nuestro frío no funciona');
  if (v.photosPending) issues.push('Faltan fotos');
  return {
    products: checked.length, present: present.length, missing: checked.filter(p => p.presence === 'no').length, outOfStock: checked.filter(p => p.presence === 'agotado').length,
    firstPosition: present.filter(p => p.position === '1').length, withPromo: present.filter(p => p.promo).length,
    facings: present.reduce((a, p) => a + (p.facings || 0), 0), offPrice: offPrice.length, photos: v.photos.length, issues,
  };
}

// ---------------- exportar ----------------
const cell = (v: unknown) => { const s = v == null ? '' : typeof v === 'boolean' ? (v ? 'sí' : 'no') : Array.isArray(v) ? v.join(' | ') : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** Una fila por producto revisado (propio o de competencia) en cada visita. Se abre en Excel. */
export function toCsv(visits: Visit[]): string {
  const head = ['visita', 'fecha', 'persona', 'pais', 'ciudad', 'cadena', 'canal', 'tienda', 'lat', 'lng', 'tipo', 'marca', 'producto', 'presencia', 'lugar', 'posicion', 'altura', 'frentes', 'pct_espacio', 'sabores_vistos', 'precio', 'precio_comunicado', 'promo', 'detalle_promo', 'en_frio', 'vencimiento', 'estado', 'bodega', 'lanzamiento', 'notas', 'frio_hay', 'frio_de_quien', 'segundo_punto', 'puntaje', 'fotos', 'faltan_fotos'];
  const rows = [head.join(',')];
  for (const v of visits) {
    const base = [v.id, v.checkIn.slice(0, 16).replace('T', ' '), v.by.name, v.store.country, v.store.city, v.store.chain, v.store.channel, v.store.name, v.location?.lat ?? '', v.location?.lng ?? ''];
    const tail = [v.cold.has, v.cold.owner, v.secondary.has === null ? '' : v.secondary.has ? v.secondary.where.join(' | ') || 'sí' : 'no', v.score ?? '', v.photos.length, v.photosPending];
    for (const p of v.products.filter(x => x.presence)) rows.push([...base, 'propio', p.brand, p.name, p.presence, p.place, p.position, p.height, p.facings, p.shelfShare, p.flavorsFound, p.price, p.priceTag, p.promo, p.promoDetail, p.inCold, p.expiry, p.condition, p.backstock, '', p.notes, ...tail].map(cell).join(','));
    for (const c of v.competitors) rows.push([...base, 'competencia', c.brand, c.product, '', '', c.position, '', c.facings, '', '', c.price, '', c.promo, c.promoDetail, c.inCold, '', '', '', c.newLaunch, c.notes, ...tail].map(cell).join(','));
    if (!v.products.length && !v.competitors.length) rows.push([...base, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', v.notes, ...tail].map(cell).join(','));
  }
  return '﻿' + rows.join('\n') + '\n';
}
