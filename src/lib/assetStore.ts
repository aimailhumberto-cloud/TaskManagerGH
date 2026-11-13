import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataRoot } from './brains';
import { BUILTIN_ASSETS, type BrandAsset } from './assetCatalog';
import { tr } from './reqLang';

/** Imágenes subidas por personas o agentes. Se guardan en el disco persistente, compartidas por todos los cerebros. */
export class AssetError extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const dir = () => path.join(dataRoot(), 'assets');
const indexFile = () => path.join(dir(), 'index.json');
const MAX_BYTES = 2 * 1024 * 1024, MAX_CUSTOM = 2000;
const clean = (s: unknown, n: number) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, n);

function readIndex(): BrandAsset[] { try { const x = JSON.parse(fs.readFileSync(indexFile(), 'utf-8')); return Array.isArray(x) ? x : []; } catch { return []; } }
export function listAssets(): BrandAsset[] { return [...BUILTIN_ASSETS, ...readIndex()]; }
export function findAsset(id: string): BrandAsset | null { return listAssets().find(a => a.id === id) || null; }

/** Tipo real del archivo por sus primeros bytes; no se confía en el nombre ni en lo que diga quien lo sube. */
function sniff(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return { ext: 'png', mime: 'image/png' };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
export function saveAsset(input: { name?: unknown; brand?: unknown; kind?: unknown; dataBase64?: unknown }, by?: string): BrandAsset {
  if (typeof input.dataBase64 !== 'string' || !input.dataBase64) throw new AssetError(tr('Falta dataBase64 con la imagen.', 'dataBase64 with the image is missing.'));
  const b64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (b64.length > MAX_BYTES * 1.4) throw new AssetError(tr('La imagen pasa de 2 MB.', 'The image is over 2 MB.'), 413);
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) throw new AssetError(tr('La imagen está vacía o pasa de 2 MB.', 'The image is empty or over 2 MB.'), 413);
  const t = sniff(buf); if (!t) throw new AssetError(tr('Solo se aceptan imágenes PNG, JPG o WEBP.', 'Only PNG, JPG or WEBP images are accepted.'));
  const idx = readIndex(); if (idx.length >= MAX_CUSTOM) throw new AssetError(tr('La biblioteca llegó a su límite de imágenes subidas.', 'The library has reached its limit of uploaded images.'), 409);
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  const existing = idx.find(a => a.id.endsWith(hash)); if (existing) return existing;
  const id = `${clean(input.name, 40) || 'imagen'}-${hash}`, file = `${id}.${t.ext}`;
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), file), buf);
  const KINDS = ['logo', 'tile', 'product', 'banner', 'people', 'plant', 'otro'];
  const asset: BrandAsset = { id, url: `/api/agent/assets/file/${file}`, thumb: `/api/agent/assets/file/${file}`, brand: clean(input.brand, 30) || 'otros', kind: KINDS.includes(String(input.kind)) ? String(input.kind) : 'otro', bytes: buf.length, custom: true, label: String(input.name || '').slice(0, 80) || undefined };
  (asset as any).addedBy = by; (asset as any).addedAt = new Date().toISOString();
  const tmp = indexFile() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify([...idx, asset])); fs.renameSync(tmp, indexFile());
  return asset;
}
/** Ruta en disco de una imagen subida, solo si el nombre es uno de los que este módulo genera. */
export function assetFilePath(file: string): { path: string; mime: string } | null {
  const m = /^[a-z0-9-]{1,60}\.(png|jpg|webp)$/.exec(file); if (!m) return null;
  const p = path.join(dir(), file); if (!fs.existsSync(p)) return null;
  return { path: p, mime: m[1] === 'png' ? 'image/png' : m[1] === 'jpg' ? 'image/jpeg' : 'image/webp' };
}

/** Sitios de los que se permite copiar fotos a la biblioteca: solo la tienda en línea de la empresa y su CDN. */
export const IMPORT_HOSTS = new Set(['cdn.shopify.com', 'shopsmj.com', 'www.shopsmj.com']);
export function isImportableUrl(u: unknown): u is string {
  if (typeof u !== 'string') return false;
  try { const x = new URL(u); return x.protocol === 'https:' && !x.username && !x.password && (x.port === '' || x.port === '443') && IMPORT_HOSTS.has(x.hostname.toLowerCase()); } catch { return false; }
}
/**
 * Descarga una imagen de un sitio permitido. Rechaza otros sitios (y no sigue redirecciones hacia fuera),
 * respuestas que pasen de 2 MB y cualquier cosa que no sea una imagen. `fetchImpl` permite probarla sin red.
 */
export async function fetchRemoteImage(url: string, fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  if (!isImportableUrl(url)) throw new AssetError(tr('Ese sitio no está en la lista permitida.', 'That site is not on the allowed list.'));
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 10000);
  try {
    // Las redirecciones se siguen a mano (máximo dos) para comprobar cada destino ANTES de llamarlo.
    let r = await fetchImpl(url, { signal: ctl.signal, redirect: 'manual', headers: { Accept: 'image/*' } });
    for (let hop = 0; hop < 2 && r.status >= 300 && r.status < 400; hop++) {
      let next = ''; try { next = new URL(r.headers.get('location') || '', url).toString(); } catch {}
      if (!isImportableUrl(next)) throw new AssetError(tr('El sitio redirigió a un lugar no permitido.', 'The site redirected to a place that is not allowed.'));
      r = await fetchImpl(next, { signal: ctl.signal, redirect: 'manual', headers: { Accept: 'image/*' } });
    }
    if (r.status >= 300 && r.status < 400) throw new AssetError('Demasiadas redirecciones.', 502);
    if (!r.ok) throw new AssetError(tr(`El sitio respondió ${r.status}.`, `The site responded ${r.status}.`), 502);
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new AssetError(tr('La imagen pasa de 2 MB.', 'The image is over 2 MB.'), 413);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) throw new AssetError(tr('La imagen está vacía o pasa de 2 MB.', 'The image is empty or over 2 MB.'), 413);
    if (!sniff(buf)) throw new AssetError(tr('Lo descargado no es una imagen PNG, JPG o WEBP.', 'What was downloaded is not a PNG, JPG or WEBP image.'));
    return buf;
  } catch (e) {
    if (e instanceof AssetError) throw e;
    throw new AssetError((e as Error)?.name === 'AbortError' ? 'El sitio tardó demasiado.' : 'No se pudo descargar.', 502);
  } finally { clearTimeout(timer); }
}
