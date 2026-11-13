import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dataRoot } from './brains';
import { BUILTIN_ASSETS, type BrandAsset } from './assetCatalog';

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
  if (typeof input.dataBase64 !== 'string' || !input.dataBase64) throw new AssetError('Falta dataBase64 con la imagen.');
  const b64 = input.dataBase64.replace(/^data:[^;]+;base64,/, '');
  if (b64.length > MAX_BYTES * 1.4) throw new AssetError('La imagen pasa de 2 MB.', 413);
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length > MAX_BYTES) throw new AssetError('La imagen está vacía o pasa de 2 MB.', 413);
  const t = sniff(buf); if (!t) throw new AssetError('Solo se aceptan imágenes PNG, JPG o WEBP.');
  const idx = readIndex(); if (idx.length >= MAX_CUSTOM) throw new AssetError('La biblioteca llegó a su límite de imágenes subidas.', 409);
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
